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
	console.log("\nALL HOST CHECKS PASSED");
} finally {
	rmSync(dir, { recursive: true, force: true });
}
