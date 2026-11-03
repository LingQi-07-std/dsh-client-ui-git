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

	// ---------- branch details / merge modes / conflict state ----------
	const m = makeRepo("modes");
	writeFileSync(join(m, "f.txt"), "base\n");
	await git.commit(m, "base");
	await git.createBranch(m, "side");
	await git.checkout(m, "side");
	writeFileSync(join(m, "f.txt"), "side\n");
	await git.commit(m, "side change");
	await git.checkout(m, "main");
	writeFileSync(join(m, "g.txt"), "main only\n");
	await git.commit(m, "main change");

	await checkAsync("branchDetails reports tip, current, merged and creation", async () => {
		const out = await git.branchDetails(m);
		const main = out.branches.find((branch) => branch.name === "main");
		const side = out.branches.find((branch) => branch.name === "side");
		if (main === void 0 || side === void 0) throw new Error("branches missing: " + JSON.stringify(out.branches));
		if (main.current !== true) throw new Error("main should be current");
		if (side.merged !== false) throw new Error("side should not be merged");
		if (side.created === null || side.created.from !== "main") throw new Error("creation record missing: " + JSON.stringify(side.created));
		if (!/^[0-9a-f]{8}$/.test(side.short)) throw new Error("short hash missing");
		if (out.branches[0].name !== "main") throw new Error("current branch must sort first");
		if (main.created === null || main.created.from !== "仓库初始") throw new Error("primary branch should fall back to the root commit: " + JSON.stringify(main.created));
	});

	await checkAsync("branchDetails orders newer branches before older ones", async () => {
		await git.createBranch(m, "newer");
		const out = await git.branchDetails(m);
		const names = out.branches.map((branch) => branch.name);
		if (names[0] !== "main") throw new Error("current first: " + names.join(","));
		const newerAt = names.indexOf("newer");
		const sideAt = names.indexOf("side");
		if (newerAt < 0 || sideAt < 0 || newerAt > sideAt) throw new Error("newest should come before older: " + names.join(","));
		await git.deleteBranch(m, "newer");
	});

	await checkAsync("branch -f reflog rows are not creation events", async () => {
		const rb = makeRepo("reflogbranch");
		writeFileSync(join(rb, "f.txt"), "v1\n");
		await git.commit(rb, "first");
		writeFileSync(join(rb, "f.txt"), "v2\n");
		await git.commit(rb, "second");
		await git.createBranch(rb, "topic");
		sh(rb, "branch", "-f", "topic", "HEAD~1");
		const out = await git.reflogEvents(rb);
		const resetRow = out.events.find((event) => /Reset to/i.test(event.message));
		if (resetRow !== void 0) throw new Error("branch -f must not become a timeline event: " + resetRow.message);
		const created = out.events.find((event) => /branch: Created from/i.test(event.message));
		if (created === void 0) throw new Error("real creation record missing");
	});

	await checkAsync("merge ff-only refuses diverged branches with not-fast-forward", async () => {
		const out = await git.merge(m, "side", { mode: "ff-only" });
		if (out.ok !== false) throw new Error("should refuse");
		if (out.errorCode !== "not-fast-forward") throw new Error("bad code: " + out.errorCode);
	});

	await checkAsync("merge no-ff creates a merge commit", async () => {
		const out = await git.merge(m, "side", { mode: "no-ff" });
		if (!out.ok) throw new Error(out.error);
		const head = (await git.log(m, 1)).commits[0];
		if (head.parents.length !== 2) throw new Error("not a merge commit: " + JSON.stringify(head.parents));
	});

	const sq = makeRepo("squash");
	writeFileSync(join(sq, "a.txt"), "base a\n");
	writeFileSync(join(sq, "b.txt"), "base b\n");
	await git.commit(sq, "base");
	await git.createBranch(sq, "side");
	await git.checkout(sq, "side");
	writeFileSync(join(sq, "a.txt"), "side a\n");
	await git.commit(sq, "side change");
	await git.checkout(sq, "main");
	writeFileSync(join(sq, "b.txt"), "main b\n");
	await git.commit(sq, "main change");

	await checkAsync("squash merge applies one single-parent commit", async () => {
		const out = await git.merge(sq, "side", { mode: "squash" });
		if (!out.ok) throw new Error(out.error);
		const head = (await git.log(sq, 1)).commits[0];
		if (head.parents.length !== 1) throw new Error("squash should have one parent: " + JSON.stringify(head.parents));
		const content = await git.showFile(sq, head.hash, "a.txt");
		if (!content.ok || !content.content.includes("side a")) throw new Error("side change not applied");
	});

	const c2 = makeRepo("conflictstate");
	writeFileSync(join(c2, "f.txt"), "base\n");
	await git.commit(c2, "base");
	await git.createBranch(c2, "side");
	await git.checkout(c2, "side");
	writeFileSync(join(c2, "f.txt"), "side\n");
	await git.commit(c2, "side change");
	await git.checkout(c2, "main");
	writeFileSync(join(c2, "f.txt"), "main\n");
	await git.commit(c2, "main change");

	await checkAsync("merge conflict is visible in repoOperation", async () => {
		const merged = await git.merge(c2, "side");
		if (merged.ok !== false) throw new Error("should conflict");
		const state = await git.repoOperation(c2);
		if (state.operation === null || state.operation.kind !== "merge") throw new Error("operation not detected: " + JSON.stringify(state.operation));
		if (state.operation.source !== "side" || state.operation.target !== "main") throw new Error("merge direction wrong: " + JSON.stringify(state.operation));
		if (state.conflicts.length !== 1 || state.conflicts[0].path !== "f.txt") throw new Error(JSON.stringify(state.conflicts));
		if (state.conflicts[0].blocks !== 1) throw new Error("expected one conflict block, got " + state.conflicts[0].blocks);
		if (state.unresolved !== 1) throw new Error("unresolved count wrong");
	});

	await checkAsync("conflictFile exposes worktree markers and both sides", async () => {
		const out = await git.conflictFile(c2, "f.txt");
		if (!out.worktree.includes("<<<<<<<") || !out.worktree.includes(">>>>>>>")) throw new Error("markers missing");
		if (!out.ours.includes("main") || !out.theirs.includes("side")) throw new Error("sides wrong: " + JSON.stringify({ ours: out.ours, theirs: out.theirs }).slice(0, 200));
	});

	await checkAsync("edited file shows zero blocks, add clears it, continue finishes the merge", async () => {
		writeFileSync(join(c2, "f.txt"), "resolved\n");
		const edited = await git.repoOperation(c2);
		const file = edited.conflicts.find((item) => item.path === "f.txt");
		if (file === void 0 || file.blocks !== 0) throw new Error("blocks should be 0 after editing: " + JSON.stringify(file));
		await git.addPaths(c2, ["f.txt"]);
		const after = await git.repoOperation(c2);
		if (after.unresolved !== 0) throw new Error("still unresolved: " + JSON.stringify(after.conflicts));
		if (!after.resolved.some((item) => item.path === "f.txt")) throw new Error("resolved list missing f.txt");
		const done = await git.operationContinue(c2, "merge");
		if (!done.ok) throw new Error(done.error);
		const clear = await git.repoOperation(c2);
		if (clear.operation !== null) throw new Error("operation not cleared");
		const head = (await git.log(c2, 1)).commits[0];
		if (head.parents.length !== 2) throw new Error("merge commit missing");
	});

	const c3 = makeRepo("squashconflict");
	writeFileSync(join(c3, "f.txt"), "base\n");
	await git.commit(c3, "base");
	await git.createBranch(c3, "side");
	await git.checkout(c3, "side");
	writeFileSync(join(c3, "f.txt"), "side\n");
	await git.commit(c3, "side change");
	await git.checkout(c3, "main");
	writeFileSync(join(c3, "f.txt"), "main\n");
	await git.commit(c3, "main change");

	await checkAsync("squash conflict is detected as kind squash and aborts cleanly", async () => {
		const merged = await git.merge(c3, "side", { mode: "squash" });
		if (merged.ok !== false) throw new Error("should conflict");
		const state = await git.repoOperation(c3);
		if (state.operation === null || state.operation.kind !== "squash") throw new Error("kind wrong: " + JSON.stringify(state.operation));
		const aborted = await git.abortOperation(c3, "squash");
		if (!aborted.ok) throw new Error(aborted.error);
		const after = await git.repoOperation(c3);
		if (after.operation !== null) throw new Error("squash state not cleared");
	});

	// ---------- orphaned commits / branch deletion preview ----------
	const o = makeRepo("orphans");
	writeFileSync(join(o, "f.txt"), "v1\n");
	await git.commit(o, "first");
	writeFileSync(join(o, "f.txt"), "v2\n");
	await git.commit(o, "second");
	const lostHash = (await git.log(o, 1)).commits[0].hash;
	await git.reset(o, "HEAD~1");

	await checkAsync("orphanedCommits finds the commit a hard reset dropped", async () => {
		const out = await git.orphanedCommits(o);
		if (!out.ok) throw new Error(out.error);
		const lost = out.commits.find((commit) => commit.hash === lostHash);
		if (lost === void 0) throw new Error("lost commit not listed: " + JSON.stringify(out.commits.map((commit) => commit.short)));
		if (lost.subject !== "second") throw new Error("subject missing");
		if (lost.lostAt.length === 0) throw new Error("lostAt missing");
	});

	await checkAsync("branchExclusiveCommits lists commits only that branch has", async () => {
		await git.createBranch(o, "recover", lostHash);
		const out = await git.branchExclusiveCommits(o, "recover");
		if (!out.ok) throw new Error(out.error);
		if (out.commits.length !== 1 || out.commits[0].hash !== lostHash) throw new Error(JSON.stringify(out.commits));
	});

	await checkAsync("deleteBranch refuses unmerged unless forced", async () => {
		const refused = await git.deleteBranch(o, "recover");
		if (refused.ok !== false || refused.errorCode !== "not-merged") throw new Error("should refuse: " + JSON.stringify(refused));
		const forced = await git.deleteBranch(o, "recover", { force: true });
		if (!forced.ok) throw new Error(forced.error);
		const list = await git.branch(o);
		if (list.branches.includes("recover")) throw new Error("branch still listed");
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

	// ---- remote sync: pending commits, whole-chain files, remote branches ----
	await checkAsync("syncCommits reports ahead/behind commits and whole-chain files", async () => {
		const bare = join(root, "remote.git");
		spawnSync("git", ["init", "-q", "--bare", "-b", "main", bare], { stdio: "pipe" });
		const local = makeRepo("sync-local");
		writeFileSync(join(local, "a.txt"), "one\n");
		sh(local, "add", "a.txt");
		sh(local, "commit", "-qm", "first");
		sh(local, "remote", "add", "origin", bare);
		sh(local, "push", "-q", "-u", "origin", "main");

		// Remote branches: exactly one, and it is tracked by the local `main`.
		const linked = await git.remoteBranches(local);
		if (linked.branches.length !== 1) throw new Error("expected 1 remote branch, got " + JSON.stringify(linked.branches.map((b) => b.name)));
		if (linked.branches[0].name !== "origin/main") throw new Error("remote branch name: " + linked.branches[0].name);
		if (linked.branches[0].trackedBy !== "main") throw new Error("trackedBy: " + linked.branches[0].trackedBy);

		// Local-only commit -> ahead 1, one added file.
		writeFileSync(join(local, "b.txt"), "two\n");
		sh(local, "add", "b.txt");
		sh(local, "commit", "-qm", "local only");
		let sync = await git.syncCommits(local);
		if (sync.upstream !== "origin/main") throw new Error("upstream: " + sync.upstream);
		if (sync.ahead.length !== 1 || sync.behind.length !== 0) throw new Error("ahead/behind: " + JSON.stringify(sync));
		if (sync.ahead[0].subject !== "local only") throw new Error("ahead subject: " + sync.ahead[0].subject);
		if (sync.aheadFiles.length !== 1 || sync.aheadFiles[0].path !== "b.txt") throw new Error("aheadFiles: " + JSON.stringify(sync.aheadFiles));
		if (sync.aheadFiles[0].status !== "A") throw new Error("file status: " + sync.aheadFiles[0].status);

		// A second clone pushes -> behind 1 after fetch.
		const other = join(root, "sync-other");
		spawnSync("git", ["clone", "-q", bare, other], { stdio: "pipe" });
		spawnSync("git", ["-C", other, "config", "user.email", "t@t.t"], { stdio: "pipe" });
		spawnSync("git", ["-C", other, "config", "user.name", "Tester"], { stdio: "pipe" });
		writeFileSync(join(other, "c.txt"), "three\n");
		sh(other, "add", "c.txt");
		sh(other, "commit", "-qm", "remote only");
		sh(other, "push", "-q", "origin", "main");
		sh(local, "fetch", "-q", "origin");
		sync = await git.syncCommits(local);
		if (sync.behind.length !== 1) throw new Error("behind: " + JSON.stringify(sync.behind));
		if (sync.behind[0].subject !== "remote only") throw new Error("behind subject: " + sync.behind[0].subject);
		if (sync.behindFiles.length !== 1 || sync.behindFiles[0].path !== "c.txt") throw new Error("behindFiles: " + JSON.stringify(sync.behindFiles));
		if (sync.mergeBase.length !== 8) throw new Error("mergeBase: " + sync.mergeBase);
	});

	await checkAsync("syncCommits reports an unlinked branch as empty", async () => {
		const lonely = makeRepo("sync-lonely");
		writeFileSync(join(lonely, "x.txt"), "x\n");
		sh(lonely, "add", "x.txt");
		sh(lonely, "commit", "-qm", "only");
		const sync = await git.syncCommits(lonely);
		if (sync.upstream !== "") throw new Error("upstream should be empty: " + sync.upstream);
		if (sync.ahead.length !== 0 || sync.behind.length !== 0) throw new Error("lists should be empty");
		if (sync.aheadFiles.length !== 0 || sync.behindFiles.length !== 0) throw new Error("file lists should be empty");
	});

	console.log(results.join("\n"));
	console.log(process.exitCode === 1 ? "\nSOME EXTENDED CHECKS FAILED" : "\nALL EXTENDED CHECKS PASSED");
} finally {
	rmSync(root, { recursive: true, force: true });
}
