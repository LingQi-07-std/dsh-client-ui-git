// Quick verification for the host half: build a scratch repo and exercise the
// gateway methods directly (no cordis context needed for pure git calls).
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitGateway } from "./lib/index.js";

const dir = mkdtempSync(join(tmpdir(), "dsh-git-test-"));
const sh = (...args) => spawnSync("git", args, { cwd: dir, stdio: "pipe" });
try {
	sh("init", "-q", "-b", "main");
	sh("config", "user.email", "test@test.test");
	sh("config", "user.name", "Tester");
	writeFileSync(join(dir, "a.txt"), "hello\n");
	sh("add", "a.txt");
	sh("commit", "-qm", "first commit");
	writeFileSync(join(dir, "a.txt"), "hello\nworld\n");
	writeFileSync(join(dir, "b.txt"), "new\n");
	sh("add", "b.txt");
	sh("commit", "-qm", "second commit");
	sh("checkout", "-q", "-b", "feature");
	writeFileSync(join(dir, "c.txt"), "feature\n");
	sh("add", "c.txt");
	sh("commit", "-qm", "feature commit");
	sh("checkout", "-q", "main");
	writeFileSync(join(dir, "a.txt"), "hello\nworld\nchanged\n");
	// working tree: a.txt modified, untracked u.txt
	writeFileSync(join(dir, "u.txt"), "untracked\n");

	// Gateway methods do not touch `this`, so a bare prototype instance is a
	// valid test receiver (real cordis ctx only matters at construction).
	const gateway = Object.create(GitGateway.prototype);
	const fakeRequest = { path: dir };

	const snapshot = await gateway.snapshot(fakeRequest);
	console.log("snapshot:", JSON.stringify(snapshot, null, 1));
	const log = await gateway.log({ path: dir, limit: 10 });
	console.log("log commits:", JSON.stringify(log.commits, null, 1));
	const status = await gateway.status(fakeRequest);
	console.log("status:", JSON.stringify(status, null, 1));
	const diff = await gateway.diff({ path: dir, commit: log.commits[0].hash });
	console.log("diff files:", JSON.stringify(diff.files, null, 1), "patch head:", diff.patch.slice(0, 80).replace(/\n/g, "\\n"));

	const notRepo = await gateway.snapshot({ path: tmpdir() });
	console.log("not-a-repo snapshot:", JSON.stringify(notRepo));
	// Non-repo directories must yield empty results, not errors.
	const notRepoLog = await gateway.log({ path: tmpdir(), limit: 10 });
	const notRepoStatus = await gateway.status({ path: tmpdir() });
	console.log("not-a-repo log/status:", JSON.stringify(notRepoLog), JSON.stringify(notRepoStatus));

	if (!snapshot.repo || snapshot.branch !== "main") throw new Error("snapshot sanity failed");
	if (log.commits.length !== 3) throw new Error("expected 3 commits, got " + log.commits.length);
	if (!log.commits[0].refs.some((r) => r.includes("feature"))) throw new Error("expected feature ref on head");
	if (status.entries.length !== 2) throw new Error("expected 2 status entries");
	if (diff.files.length < 1) throw new Error("expected diff files");
	if (notRepo.repo !== false) throw new Error("non-repo snapshot should report repo=false");
	if (!Array.isArray(notRepoLog.commits) || notRepoLog.commits.length !== 0) throw new Error("non-repo log should be empty");
	if (notRepoStatus.clean !== true || notRepoStatus.entries.length !== 0) throw new Error("non-repo status should be clean/empty");
	// Plugin-local persistence: data goes to the plugin dir, never the workspace.
	process.env.DSH_GIT_STATE_DIR = join(dir, ".dsh-state");
	const readEmpty = await gateway.readPluginState({ key: "prefs" });
	if (!readEmpty.ok || readEmpty.value !== "null") throw new Error("empty state should be null: " + JSON.stringify(readEmpty));
	const writeState = await gateway.writePluginState({ key: "prefs", value: JSON.stringify({ branches: ["main"], n: 1 }) });
	if (!writeState.ok) throw new Error("writePluginState failed: " + JSON.stringify(writeState));
	const readBack = await gateway.readPluginState({ key: "prefs" });
	if (readBack.value !== JSON.stringify({ branches: ["main"], n: 1 })) throw new Error("state round-trip failed: " + readBack.value);
	let rejected = false;
	try {
		await gateway.writePluginState({ key: "prefs", value: "{broken" });
	} catch (error) {
		rejected = true;
	}
	if (rejected !== true) throw new Error("invalid JSON should be rejected");
	const afterReject = await gateway.readPluginState({ key: "prefs" });
	if (afterReject.value !== JSON.stringify({ branches: ["main"], n: 1 })) throw new Error("state must survive a rejected write");
	// Reflog backup: opt-in snapshot of history-shaping reflog rows.
	sh("branch", "backup-probe");
	const backup = await gateway.reflogBackup({ path: dir });
	if (!backup.ok || backup.total < 1) throw new Error("reflogBackup failed: " + JSON.stringify(backup));
	const backupAgain = await gateway.reflogBackup({ path: dir });
	if (!backupAgain.ok || backupAgain.added !== 0) throw new Error("reflogBackup should be idempotent: " + JSON.stringify(backupAgain));
	const config = await gateway.reflogBackupConfig({ path: dir, enabled: true });
	if (!config.ok || config.enabled !== true) throw new Error("reflogBackupConfig failed: " + JSON.stringify(config));
	const storedEvents = await gateway.reflogBackupRead({ path: dir });
	if (!storedEvents.ok || storedEvents.events.length < 1) throw new Error("reflogBackupRead failed");
	// Merge pre-flight: reports ff-only availability and would-be conflicts.
	const preview = await gateway.mergePreview({ path: dir, target: "main", source: "feature" });
	if (!preview.ok || typeof preview.ffOnly !== "boolean" || !Array.isArray(preview.conflicts)) throw new Error("mergePreview failed: " + JSON.stringify(preview));
	// Stash round trip: push (-u) / list / apply / drop.
	writeFileSync(join(dir, "stash-probe.txt"), "stash me\n");
	const pushed = await gateway.stash({ path: dir, action: "push", message: "probe", includeUntracked: true });
	if (!pushed.ok) throw new Error("stash push failed: " + JSON.stringify(pushed));
	const listed = await gateway.stash({ path: dir, action: "list" });
	if (!listed.ok || listed.entries.length < 1) throw new Error("stash list failed: " + JSON.stringify(listed));
	const applied = await gateway.stash({ path: dir, action: "apply", ref: listed.entries[0].ref });
	if (!applied.ok) throw new Error("stash apply failed: " + JSON.stringify(applied));
	const dropped = await gateway.stash({ path: dir, action: "drop", ref: listed.entries[0].ref });
	if (!dropped.ok) throw new Error("stash drop failed: " + JSON.stringify(dropped));
	delete process.env.DSH_GIT_STATE_DIR;
	console.log("\nALL HOST CHECKS PASSED");
} finally {
	rmSync(dir, { recursive: true, force: true });
}
