// End-to-end test of git-core write set: init -> commit -> branch/checkout ->
// revert -> merge -> restore, plus read queries. Uses a scratch repo.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as git from "./lib/git-core.mjs";

const dir = mkdtempSync(join(tmpdir(), "dsh-gitcore-"));
const sh = (...args) => spawnSync("git", args, { cwd: dir, stdio: "pipe" });
const results = [];
const check = (name, fn) => { try { fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } };

try {
	// init with identity
	const initOut = await git.init(dir, { userName: "T", userEmail: "t@t.t" });
	check("init", () => { if (!initOut.ok) throw new Error(initOut.error); });

	writeFileSync(join(dir, "a.txt"), "hello\n");
	writeFileSync(join(dir, "b.txt"), "two\n");
	// commit (auto stage all)
	const c1 = await git.commit(dir, "first commit");
	check("commit 1", () => { if (!c1.ok) throw new Error(c1.error); if (!c1.id) throw new Error("no id"); });
	check("repo isRepo", async () => { if (!(await git.isRepo(dir))) throw new Error("not repo"); });

	// create feature branch, add a file
	sh("checkout", "-q", "-b", "feature");
	writeFileSync(join(dir, "c.txt"), "three\n");
	const c2 = await git.commit(dir, "feature commit");
	check("commit on branch", () => { if (!c2.ok) throw new Error(c2.error); });
	// back to the base (non-feature) branch, whatever it is named
	const b0 = await git.branch(dir);
	const base = b0.branches.find((x) => !x.includes("feature"));
	if (!base) throw new Error("no base branch found: " + JSON.stringify(b0.branches));
	const co = await git.checkout(dir, base);
	check("checkout back to base branch", () => { if (!co.ok) throw new Error(co.error); });
	// createBranch
	const cb = await git.createBranch(dir, "dev");
	check("createBranch dev", () => { if (!cb.ok) throw new Error(cb.error); });
	check("branch includes dev", async () => {
		const b = await git.branch(dir);
		if (!b.branches.includes("dev")) throw new Error("dev missing");
	});
	check("branch list", async () => {
		const b = await git.branch(dir);
		if (!b.branches.some((x) => x.endsWith("feature"))) throw new Error("feature missing: " + JSON.stringify(b.branches));
	});

	// merge feature into base branch
	const mg = await git.merge(dir, "feature");
	check("merge feature", () => { if (!mg.ok) throw new Error(mg.error); });
	check("log after merge", async () => {
		const l = await git.log(dir, 10);
		if (l.commits.length < 2) throw new Error("expected >=2 commits, got " + l.commits.length);
	});

	// revert the merge commit (HEAD)
	sh("checkout", "-q", "feature");
	const lc = await git.log(dir, 1);
	const rv = await git.revert(dir, lc.commits[0].hash);
	check("revert feature head", () => { if (!rv.ok) throw new Error(rv.error); });

	// clean snapshot
	check("clean snapshot", async () => {
		const s = await git.snapshot(dir);
		if (!s.repo) throw new Error("not repo");
	});

	// restore: verify on a clean, independent repo (a tracked-file modification)
	const rdir = mkdtempSync(join(tmpdir(), "dsh-gitcore-rst-"));
	try {
		await git.init(rdir, { userName: "T", userEmail: "t@t.t" });
		writeFileSync(join(rdir, "a.txt"), "tracked\n");
		await git.commit(rdir, "base");
		writeFileSync(join(rdir, "a.txt"), "dirty\n");
		const rd0 = await git.status(rdir);
		check("restore: dirty = tracked modification", () => { if (rd0.clean || rd0.entries[0]?.x !== " " && rd0.entries[0]?.x !== "M" && rd0.entries[0]?.y !== "M") throw new Error("expected tracked M, got " + JSON.stringify(rd0.entries)); });
		const rrs = await git.restore(rdir, []);
		check("restore: command ok", () => { if (!rrs.ok) throw new Error(rrs.error); });
		const rd1 = await git.status(rdir);
		check("restore: clean after", () => { if (!rd1.clean) throw new Error("not clean: " + JSON.stringify(rd1.entries)); });
		// Untracked directories must be expanded to individual files (`-uall`),
		// otherwise the panel gets one `dir/` entry with an empty file name.
		mkdirSync(join(rdir, "nested", "deep"), { recursive: true });
		writeFileSync(join(rdir, "nested", "deep", "file.txt"), "x\n");
		const rd2 = await git.status(rdir);
		const paths = rd2.entries.map((entry) => entry.path);
		check("status: untracked dir is expanded to files", () => {
			if (!paths.includes("nested/deep/file.txt")) throw new Error("expected nested file, got " + JSON.stringify(paths));
			if (paths.some((path) => path.endsWith("/"))) throw new Error("directory entry leaked: " + JSON.stringify(paths));
		});
	} finally {
		try { rmSync(rdir, { recursive: true, force: true }); } catch { /* ignore */ }
	}

	console.log(results.join("\n"));
	console.log(process.exitCode === 1 ? "\nSOME GITCORE CHECKS FAILED" : "\nALL GITCORE CHECKS PASSED");
} finally {
	sh("config", "user.name", "T"); // noop guard
	try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}
