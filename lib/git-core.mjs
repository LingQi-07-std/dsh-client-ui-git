// @dsh-external/dsh-client-ui-git — git-core.mjs
// Shared pure-function git helpers: read-only queries + the safe write set.
// Host half (GitGateway) and the git MCP server each consume their own copy
// (MCP keeps a synced copy under $DSH_HOME/mcp-git/git-core.mjs) so both run
// standalone without cross-directory imports. Keep both in sync.
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";

/** Max output bytes captured from one git command. */
const MAX_OUTPUT = 8 * 1024 * 1024;

/**
 * Run `git -C <dir> <args...>` and collect stdout/stderr (never rejects).
 * @param dir - repository directory or any dir (git resolves upwards).
 * @param args - git arguments.
 * @returns {code, stdout, stderr, capped}.
 */
export function runGit(dir, args) {
	return new Promise((resolve) => {
		const child = spawn("git", ["-C", dir, "-c", "core.quotepath=false", "--no-pager", ...args], {
			windowsHide: true,
			env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C.UTF-8" }
		});
		let stdout = Buffer.alloc(0);
		let stderr = Buffer.alloc(0);
		let capped = false;
		const cap = (buffer, chunk) => {
			const next = Buffer.concat([buffer, chunk]);
			if (next.length > MAX_OUTPUT) {
				capped = true;
				return next.subarray(0, MAX_OUTPUT);
			}
			return next;
		};
		child.stdout.on("data", (chunk) => { stdout = cap(stdout, chunk); if (capped) child.kill(); });
		child.stderr.on("data", (chunk) => { stderr = Buffer.concat([stderr, chunk]); if (stderr.length > 128 * 1024) stderr = stderr.subarray(0, 128 * 1024); });
		child.on("error", (error) => resolve({ code: -1, stdout: "", stderr: String(error?.message ?? error), capped: false }));
		child.on("close", (code) => resolve({ code: code ?? 1, stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8"), capped }));
	});
}

/** Require `path` to be an existing directory; returns it, else throws. */
export function requireDir(path) {
	if (typeof path !== "string" || path.length === 0) throw new Error("缺失 path 参数");
	if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error(`不是目录: ${path}`);
	return path;
}

function parsePorcelainZ(buffer) {
	const parts = buffer.split("\0").filter((part) => part.length > 0);
	const entries = [];
	for (const part of parts) {
		const x = part[0];
		const y = part[1];
		if (x === "#" || y === "#") continue;
		entries.push({ x, y, path: part.slice(3) });
	}
	return entries;
}

/** Whether `dir` is inside a git work tree. */
export async function isRepo(dir) {
	const probe = await runGit(dir, ["rev-parse", "--is-inside-work-tree"]);
	return probe.code === 0 && probe.stdout.trim() === "true";
}

/** Repository overview (repo:false when dir is not a work tree). */
export async function snapshot(dir) {
	if (!(await isRepo(dir))) return { repo: false, path: dir };
	const [root, branch, head, statusRes, upstream] = await Promise.all([
		runGit(dir, ["rev-parse", "--show-toplevel"]),
		runGit(dir, ["symbolic-ref", "--short", "-q", "HEAD"]),
		runGit(dir, ["rev-parse", "--short", "HEAD"]),
		runGit(dir, ["status", "--porcelain", "-z"]),
		runGit(dir, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
	]);
	const entries = parsePorcelainZ(statusRes.stdout);
	const staged = entries.filter((e) => e.x !== " " && e.x !== "?").length;
	const unstaged = entries.filter((e) => e.y !== " " && e.x !== "?").length;
	const untracked = entries.filter((e) => e.x === "?").length;
	let ahead = 0;
	let behind = 0;
	if (upstream.code === 0) {
		const [l, r] = upstream.stdout.trim().split(/\s+/).map(Number);
		ahead = l || 0;
		behind = r || 0;
	}
	return {
		repo: true,
		path: dir,
		root: root.stdout.trim() || dir,
		branch: branch.stdout.trim() || head.stdout.trim() || "detached",
		head: head.stdout.trim() || null,
		clean: entries.length === 0,
		changes: { staged, unstaged, untracked, total: entries.length },
		ahead,
		behind
	};
}

/** Commit history (newest first). */
export async function log(dir, limit = 60) {
	const clamp = Math.min(Math.max(Number(limit) || 60, 1), 500);
	const fmt = ["%H", "%P", "%D", "%an", "%ae", "%aI", "%s"].join("%x1f");
	const result = await runGit(dir, ["log", "--all", "--date=iso-strict", `-n ${clamp}`, `--format=${fmt}%x1e`]);
	if (result.code !== 0) return { commits: [] };
	const commits = [];
	for (const record of result.stdout.split("\x1e")) {
		const fields = record.trim().split("\x1f");
		if (fields.length < 7 || fields[0] === "") continue;
		const [hash, parentsRaw, decorate, author, email, date, subject] = fields;
		commits.push({
			hash,
			short: hash.slice(0, 8),
			parents: parentsRaw ? parentsRaw.split(" ") : [],
			refs: decorate ? decorate.split(", ").map((p) => p.replace(/^HEAD -> /, "")).filter(Boolean) : [],
			author,
			email,
			date,
			subject
		});
	}
	return { commits };
}

/** Working-tree status entries. */
export async function status(dir) {
	const result = await runGit(dir, ["status", "--porcelain", "-z"]);
	if (result.code !== 0) return { clean: true, entries: [] };
	const entries = parsePorcelainZ(result.stdout);
	return { clean: entries.length === 0, entries };
}

/** One commit's changed files (numstat) + raw patch (capped). */
export async function diff(dir, commit) {
	if (typeof commit !== "string" || !/^[0-9a-f]{4,40}$/i.test(commit)) throw new Error("commit 参数无效");
	const [numstat, patch] = await Promise.all([
		runGit(dir, ["diff-tree", "-r", "--numstat", "--format=", commit]),
		runGit(dir, ["show", "--format=", "--no-color", commit])
	]);
	const files = [];
	for (const line of numstat.stdout.split("\n")) {
		if (!line.trim()) continue;
		const [added, removed, path] = line.split("\t");
		files.push({ path: path ?? "", added: added === "-" ? null : Number(added) || 0, removed: removed === "-" ? null : Number(removed) || 0, binary: added === "-" || removed === "-" });
	}
	return { commit, files, patch: patch.stdout, truncated: patch.capped === true };
}

/** Local + remote branch names. */
export async function branch(dir) {
	const result = await runGit(dir, ["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"]);
	if (result.code !== 0) return { branches: [] };
	const branches = result.stdout.split("\n").map((b) => b.trim()).filter(Boolean);
	return { branches };
}

/** Create a new local branch from the current HEAD, or from `from` when given. */
export async function createBranch(dir, name, from) {
	if (typeof name !== "string" || !name.trim()) throw new Error("分支名不能为空");
	if (/\s/.test(name) || name.startsWith("-")) throw new Error("分支名不合法（不能含空格或以 - 开头）");
	const args = ["branch", name];
	if (from && typeof from === "string" && from.trim()) args.push(from);
	const res = await runGit(dir, args);
	return res.code === 0
		? { ok: true, message: `已创建分支 ${name}` }
		: { ok: false, error: res.stderr.trim() || `创建分支失败(exit ${res.code})` };
}

// --- safe write set ---------------------------------------------------------

/** Commit with identity configured if empty; returns {ok, message, id?}. */
export async function commit(dir, message, { stagedOnly = false } = {}) {
	if (typeof message !== "string" || !message.trim()) throw new Error("提交信息不能为空");
	if (!stagedOnly) {
		const add = await runGit(dir, ["add", "-A"]);
		if (add.code !== 0) return { ok: false, error: `git add 失败: ${add.stderr.trim()}` };
	}
	const res = await runGit(dir, ["commit", "-m", message]);
	if (res.code !== 0) {
		const stderr = res.stderr.trim();
		if (/nothing to commit|no changes added|Working tree clean/.test(stderr)) return { ok: false, error: "没有可提交的改动" };
		if (/Author identity unknown|Please tell me who you are/.test(stderr)) return { ok: false, error: "缺少 git 身份配置（user.name/user.email），请先在仓库执行 git init 时设置，或手动 git config" };
		return { ok: false, error: `git commit 失败: ${stderr}` };
	}
	const m = res.stdout.match(/\[([^\]]+)\]/);
	return { ok: true, message: res.stdout.trim(), id: m ? m[1].split(" ")[0] : undefined };
}

/** Initialize a repo; optionally set identity + write a starter .gitignore. */
export async function init(dir, { userName, userEmail, gitignore = true } = {}) {
	requireDir(dir);
	const initRes = await runGit(dir, ["init"]);
	if (initRes.code !== 0) return { ok: false, error: `git init 失败: ${initRes.stderr.trim()}` };
	if ((userName && typeof userName === "string") || (userEmail && typeof userEmail === "string")) {
		if (userName) await runGit(dir, ["config", "user.name", userName]);
		if (userEmail) await runGit(dir, ["config", "user.email", userEmail]);
	}
	return { ok: true, message: initRes.stdout.trim() || "仓库已初始化" };
}

/** Checkout/switch to a branch (normal) or a commit (detaches HEAD). */
export async function checkout(dir, target) {
	if (typeof target !== "string" || !target.trim()) throw new Error("缺少切换目标");
	// A name that resolves to a local branch checks out normally; anything else
	// (a commit hash, a remote branch, a tag) detaches HEAD.
	const ref = await runGit(dir, ["show-ref", "--verify", "--quiet", `refs/heads/${target}`]);
	const args = ref.code === 0
		? ["checkout", "-q", target]
		: ["checkout", "-q", "--detach", target];
	const res = await runGit(dir, args);
	const mode = ref.code === 0 ? "分支" : "提交(游离 HEAD)";
	return res.code === 0
		? { ok: true, message: `已切换到${mode} ${target}` }
		: { ok: false, error: res.stderr.trim() || `checkout 失败(exit ${res.code})` };
}

/** Revert one commit by creating an inverse commit (safe). */
export async function revert(dir, commit) {
	if (typeof commit !== "string" || !commit.trim()) throw new Error("缺少要还原的 commit");
	const res = await runGit(dir, ["revert", "--no-edit", commit]);
	return res.code === 0
		? { ok: true, message: res.stdout.trim() || `已生成还原提交` }
		: { ok: false, error: res.stderr.trim() || `revert 失败(exit ${res.code})` };
}

/** Merge target branch into current; returns ok or the conflict summary. */
export async function merge(dir, target) {
	if (typeof target !== "string" || !target.trim()) throw new Error("缺少要合并的分支");
	const res = await runGit(dir, ["merge", "--no-edit", target]);
	const stderr = res.stderr.trim();
	if (res.code === 0) return { ok: true, message: res.stdout.trim() || `已将 ${target} 合并` };
	const conflict = await status(dir);
	return {
		ok: false,
		error: stderr,
		conflicts: conflict.entries.filter((e) => e.x === "U" || e.y === "U" || e.x === "A" || e.y === "A" || e.x === "D" || e.y === "D").map((e) => e.path)
	};
}

// --- destructive ops (UI-plugin only, never surfaced as MCP tools) -----------

/** Discard working-tree changes for optional paths (all when empty). */
export async function restore(dir, paths = []) {
	const args = ["restore"]; // -W working tree only
	args.push(...(paths.length ? paths : ["."]));
	const res = await runGit(dir, args);
	return res.code === 0 ? { ok: true, message: "已丢弃未提交改动" } : { ok: false, error: res.stderr.trim() };
}

/** Hard reset to a commit (rewrites history — local & unpushed only). */
export async function reset(dir, commit) {
	const res = await runGit(dir, ["reset", "--hard", commit]);
	return res.code === 0 ? { ok: true, message: `已硬回退到 ${commit}` } : { ok: false, error: res.stderr.trim() };
}
