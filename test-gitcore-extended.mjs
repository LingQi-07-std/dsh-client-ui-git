// Extended git-core test: working-tree/staged diffs, staging control, log
// filters, show/blame/reflog, tags, branch admin, soft reset, stash, abort,
// and the structured error codes. Uses one scratch repository per section so
// failures stay isolated.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as git from "./lib/git-core.mjs";

const root = mkdtempSync(join(tmpdir(), "dsh-gitcore-ext-"));
const results = [];
const check = (name, fn) => {
	try {
		const out = fn();
		results.push(`PASS ${name}`);
		return out;
	} catch (error) {
		results.push(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
		return void 0;
	}
};
const checkAsync = async (name, fn) => {
	try {
		await fn();
		results.push(`PASS ${name}`);
	} catch (error) {
		results.push(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	}
};
const makeRepo = (name) => {
	const dir = join(root, name);
	spawnSync("git", ["init", "-q", "-b", "main", dir], { stdio: "pipe" });
	spawnSync("git", ["-C", dir, "config", "user.email", "t@t.t"], { stdio: "pipe" });
	spawnSync("git", ["-C", dir, "config", "user.name", "Tester"], { stdio: "pipe" });
	return dir;
};
const sh = (dir, ...args) => spawnSync("git", ["-C", dir, ...args], { stdio: "pipe" });

try {
	// ---------- diff / staging ----------
	const a = makeRepo("diff");
	writeFileSync(join(a, "a.txt"), "one\ntwo\n");
	writeFileSync(join(a, "b.txt"), "bee\n");
	await git.commit(a, "init");

	writeFileSync(join(a, "a.txt"), "one\ntwo\nthree\n");
	await checkAsync("diff (working tree) sees unstaged edit", async () => {
		const out = await git.diff(a);
		if (out.files.length !== 1 || out.files[0].path !== "a.txt") throw new Error(JSON.stringify(out.files));
		if (!out.patch.includes("+three")) throw new Error("patch missing the new line");
	});

	await checkAsync("addPaths stages one path only", async () => {
		const staged = await git.addPaths(a, ["a.txt"]);
		if (!staged.ok) throw new Error(staged.error);
		const out = await git.diff(a, void 0, { staged: true });
		if (out.files.length !== 1 || out.files[0].path !== "a.txt") throw new Error(JSON.stringify(out.files));
		if (out.staged !== true) throw new Error("staged flag missing");
	});

	await checkAsync("unstagePaths keeps the working-tree change", async () => {
		const out = await git.unstagePaths(a, ["a.txt"]);
		if (!out.ok) throw new Error(out.error);
		const staged = await git.diff(a, void 0, { staged: true });
		if (staged.files.length !== 0) throw new Error("index not clean: " + JSON.stringify(staged.files));
		const work = await git.diff(a);
		if (work.files.length !== 1) throw new Error("working tree lost the change");
	});

	await checkAsync("commit stagedOnly refuses an empty index", async () => {
		const out = await git.commit(a, "nothing staged", { stagedOnly: true });
		if (out.ok !== false) throw new Error("should have refused");
		if (out.errorCode !== "nothing-to-commit") throw new Error("bad code: " + out.errorCode);
	});

	await checkAsync("diff with paths filter", async () => {
		writeFileSync(join(a, "b.txt"), "bee\nmore\n");
		const out = await git.diff(a, void 0, { paths: ["b.txt"] });
		if (out.files.length !== 1 || out.files[0].path !== "b.txt") throw new Error(JSON.stringify(out.files));
	});

	await checkAsync("commit picks up every change", async () => {
		const out = await git.commit(a, "second");
		if (!out.ok) throw new Error(out.error);
	});

	// ---------- log filters / show / blame / reflog / tag ----------
	await checkAsync("log filters by path", async () => {
		const out = await git.log(a, 10, { paths: ["b.txt"] });
		if (out.commits.length !== 2) throw new Error("expected 2 commits touching b.txt, got " + out.commits.length);
	});
	await checkAsync("log filters by author", async () => {
		const out = await git.log(a, 10, { author: "Nobody" });
		if (out.commits.length !== 0) throw new Error("author filter ignored");
	});
	await checkAsync("log filters by grep", async () => {
		const out = await git.log(a, 10, { grep: "second" });
		if (out.commits.length === 0) throw new Error("grep filter ignored");
	});

	await checkAsync("showFile returns the historical content", async () => {
		const first = (await git.log(a, 10)).commits.at(-1);
		const out = await git.showFile(a, first.hash, "a.txt");
		if (!out.ok || !out.content.includes("two")) throw new Error(JSON.stringify(out).slice(0, 200));
	});

	await checkAsync("blame returns lines with commits", async () => {
		const out = await git.blame(a, "a.txt", { start: 1, end: 5 });
		if (!out.ok || !out.text.includes("Tester")) throw new Error(JSON.stringify(out).slice(0, 200));
	});

	await checkAsync("reflog returns entries", async () => {
		const out = await git.reflog(a, 5);
		if (!out.ok || out.entries.length === 0) throw new Error(JSON.stringify(out).slice(0, 200));
	});

	await checkAsync("tag create/list/delete", async () => {
		const created = await git.tagCreate(a, "v0.0.1-test", { message: "test tag" });
		if (!created.ok) throw new Error(created.error);
		const list = await git.tagList(a);
		if (!list.ok || !list.tags.some((t) => t.name === "v0.0.1-test")) throw new Error(JSON.stringify(list));
		const removed = await git.tagDelete(a, "v0.0.1-test");
		if (!removed.ok) throw new Error(removed.error);
	});

	// ---------- branch admin + soft reset ----------
	await checkAsync("branch create/rename/delete", async () => {
		const created = await git.createBranch(a, "topic");
		if (!created.ok) throw new Error(created.error);
		const renamed = await git.renameBranch(a, "topic", "topic2");
		if (!renamed.ok) throw new Error(renamed.error);
		const list = await git.branch(a);
		if (!list.branches.includes("topic2")) throw new Error("rename lost the branch");
		const removed = await git.deleteBranch(a, "topic2");
		if (!removed.ok) throw new Error(removed.error);
	});

	await checkAsync("resetSoft keeps the work staged", async () => {
		const before = await git.log(a, 1);
		const out = await git.resetSoft(a, "HEAD~1");
		if (!out.ok) throw new Error(out.error);
		const after = await git.log(a, 1);
		if (after.commits[0].hash === before.commits[0].hash) throw new Error("HEAD did not move");
		const staged = await git.diff(a, void 0, { staged: true });
		if (staged.files.length === 0) throw new Error("changes were not preserved in the index");
		// restore the state for later sections
		await git.commit(a, "reapplied");
	});

	// ---------- stash ----------
	await checkAsync("stash push/list/pop", async () => {
		writeFileSync(join(a, "a.txt"), "dirty\n");
		const pushed = await git.stashAction(a, { action: "push", message: "wip", includeUntracked: true });
		if (!pushed.ok) throw new Error(pushed.error);
		const list = await git.stashAction(a, { action: "list" });
		if (!list.ok || list.entries.length === 0) throw new Error("stash list empty");
		const popped = await git.stashAction(a, { action: "pop" });
		if (!popped.ok) throw new Error(popped.error);
		const work = await git.diff(a);
		if (work.files.length === 0) throw new Error("pop did not restore the change");
		await git.commit(a, "stash restored");
	});

	// ---------- abort merge conflict ----------
	const c = makeRepo("conflict");
	writeFileSync(join(c, "f.txt"), "base\n");
	await git.commit(c, "base");
	await git.createBranch(c, "side");
	await git.checkout(c, "side");
	writeFileSync(join(c, "f.txt"), "side\n");
	await git.commit(c, "side change");
	await git.checkout(c, "main");
	writeFileSync(join(c, "f.txt"), "main\n");
	await git.commit(c, "main change");

	await checkAsync("merge reports a conflict with a code", async () => {
		const out = await git.merge(c, "side");
		if (out.ok !== false) throw new Error("merge should conflict");
		if (!Array.isArray(out.conflicts) || out.conflicts.length === 0) throw new Error("no conflicts reported");
	});

	await checkAsync("abort merge restores a clean tree", async () => {
		const out = await git.abortOperation(c, "merge");
		if (!out.ok) throw new Error(out.error);
		const state = await git.status(c);
		if (!state.clean) throw new Error("tree still dirty: " + JSON.stringify(state.entries));
	});

	// ---------- structured errors ----------
	await checkAsync("log on a non-repo reports not-a-repo", async () => {
		const plain = mkdtempSync(join(tmpdir(), "dsh-gitcore-plain-"));
		try {
			const out = await git.log(plain, 5);
			if (out.errorCode !== "not-a-repo") throw new Error("expected not-a-repo, got " + out.errorCode);
		} finally {
			rmSync(plain, { recursive: true, force: true });
		}
	});

	await checkAsync("showFile on a missing revision reports bad-revision", async () => {
		const out = await git.showFile(a, "deadbeef", "a.txt");
		if (out.ok !== false) throw new Error("should have failed");
		if (out.errorCode !== "bad-revision") throw new Error("bad code: " + out.errorCode);
	});

	await checkAsync("bad branch name is rejected", async () => {
		let threw = false;
		try {
			await git.createBranch(a, "bad name");
		} catch {
			threw = true;
		}
		if (!threw) throw new Error("bad name accepted");
	});

	console.log(results.join("\n"));
	console.log(process.exitCode === 1 ? "\nSOME EXTENDED CHECKS FAILED" : "\nALL EXTENDED CHECKS PASSED");
} finally {
	rmSync(root, { recursive: true, force: true });
}
