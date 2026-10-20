// @dsh-external/dsh-client-ui-git — git-core.mjs
// Shared pure-function git helpers: read-only queries + the safe write set.
// Host half (GitGateway) and the git MCP server each consume their own copy
// (MCP keeps a synced copy under $DSH_HOME/mcp-git/git-core.mjs) so both run
// standalone without cross-directory imports. Keep both in sync:
//   node scripts/sync-git-core.mjs          # copy workspace -> MCP copy
//   node scripts/sync-git-core.mjs --check  # verify both sides agree
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";

/** Max output bytes captured from one git command. */
const MAX_OUTPUT = 8 * 1024 * 1024;
/** Default command timeout: a hung git must never block a tool call forever. */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Commands that legitimately take longer on big repositories. */
const SLOW_TIMEOUT_MS = 120_000;

/**
 * Classify a failed git invocation into a stable code the model/UI can branch
 * on, instead of making every caller parse localized stderr text.
 * @param stderr - captured stderr.
 * @param code - exit status (or -1 for spawn failures).
 * @param timedOut - whether the watchdog killed the process.
 * @returns a stable code, or undefined on success.
 */
function errorCodeOf(stderr, code, timedOut) {
	if (timedOut) return "timeout";
	if (code === 0) return void 0;
	const text = stderr ?? "";
	if (/not a git repository/i.test(text)) return "not-a-repo";
	if (/CONFLICT|Automatic merge failed|fix conflicts|needs merge/i.test(text)) return "conflict";
	if (/no upstream branch|has no upstream/i.test(text)) return "no-upstream";
	if (/Authentication failed|could not read (Username|Password)|terminal prompts disabled|Permission denied \(publickey/i.test(text)) return "auth";
	if (/(pre-commit|post-commit|pre-push|hook) .*(failed|declined)/i.test(text)) return "hook-failed";
	if (/unknown revision|bad revision|did not match any|Not a valid object name|invalid object name|ambiguous argument|exists on disk, but not in/i.test(text)) return "bad-revision";
	if (/pathspec .* did not match/i.test(text)) return "bad-pathspec";
	if (/already exists/i.test(text)) return "already-exists";
	if (/not fully merged/i.test(text)) return "not-merged";
	if (/is not a valid branch name|Invalid branch name/i.test(text)) return "bad-branch-name";
	if (/nothing to commit|no changes added|Working tree clean/i.test(text)) return "nothing-to-commit";
	if (/Author identity unknown|Please tell me who you are/i.test(text)) return "no-identity";
	if (/cannot be resolved to branch|reference is not a tree/i.test(text)) return "bad-ref";
	return "git-exit";
}

/**
 * Run `git -C <dir> <args...>` and collect stdout/stderr (never rejects).
 * @param dir - repository directory or any dir (git resolves upwards).
 * @param args - git arguments.
 * @param options - { timeoutMs, maxOutput } overrides.
 * @returns {code, stdout, stderr, capped, timedOut, errorCode}.
 */
export function runGit(dir, args, options = {}) {
	const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
	const maxOutput = Number.isFinite(options.maxOutput) ? options.maxOutput : MAX_OUTPUT;
	return new Promise((resolve) => {
		const child = spawn("git", ["-C", dir, "-c", "core.quotepath=false", "--no-pager", ...args], {
			windowsHide: true,
			env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C.UTF-8" }
		});
		let stdout = Buffer.alloc(0);
		let stderr = Buffer.alloc(0);
		let capped = false;
		let timedOut = false;
		let settled = false;
		const cap = (buffer, chunk) => {
			const next = Buffer.concat([buffer, chunk]);
			if (next.length > maxOutput) {
				capped = true;
				return next.subarray(0, maxOutput);
			}
			return next;
		};
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutMs);
		const finish = (code, errorText) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			const text = stdout.toString("utf8");
			const err = errorText ?? stderr.toString("utf8");
			resolve({ code, stdout: text, stderr: err, capped, timedOut, errorCode: errorCodeOf(err, code, timedOut) });
		};
		child.stdout.on("data", (chunk) => { stdout = cap(stdout, chunk); if (capped) child.kill(); });
		child.stderr.on("data", (chunk) => { stderr = Buffer.concat([stderr, chunk]); if (stderr.length > 128 * 1024) stderr = stderr.subarray(0, 128 * 1024); });
		child.on("error", (error) => finish(-1, String(error?.message ?? error)));
		child.on("close", (code) => finish(code ?? 1));
	});
}

/** Require `path` to be an existing directory; returns it, else throws. */
export function requireDir(path) {
	if (typeof path !== "string" || path.length === 0) throw new Error("缺失 path 参数");
	if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error(`不是目录: ${path}`);
	return path;
}

/** Normalize a pathspec list input (array of non-empty strings). */
function normalizePaths(paths) {
	if (!Array.isArray(paths)) return [];
	return paths.filter((item) => typeof item === "string" && item.length > 0);
}

/** Normalize a required single path argument. */
function requireRelativePath(path) {
	if (typeof path !== "string" || path.trim().length === 0) throw new Error("缺失文件路径参数");
	return path;
}

/** Throw on a failed git result, keeping the structured error code. */
function assertOk(result, action) {
	if (result.code === 0) return result;
	const error = new Error(`${action}失败: ${result.stderr.trim() || result.errorCode || `exit ${result.code}`}`);
	error.code = result.errorCode ?? "git-exit";
	error.timedOut = result.timedOut === true;
	throw error;
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

/**
 * Commit history (newest first).
 * @param dir - repo directory.
 * @param limit - max commits (1..500).
 * @param options - { paths, author, since, grep } filters (all optional).
 */
export async function log(dir, limit = 60, options = {}) {
	const clamp = Math.min(Math.max(Number(limit) || 60, 1), 500);
	const fmt = ["%H", "%P", "%D", "%an", "%ae", "%aI", "%s"].join("%x1f");
	const args = ["log", "--all", "--date=iso-strict", `-n ${clamp}`, `--format=${fmt}%x1e`];
	if (typeof options.author === "string" && options.author.length > 0) args.push(`--author=${options.author}`);
	if (typeof options.since === "string" && options.since.length > 0) args.push(`--since=${options.since}`);
	if (typeof options.grep === "string" && options.grep.length > 0) args.push(`--grep=${options.grep}`, "-i");
	const paths = normalizePaths(options.paths);
	if (paths.length > 0) args.push("--", ...paths);
	const result = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
	if (result.code !== 0) return { commits: [], errorCode: result.errorCode };
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

/**
 * Changed-file rows parsed from `--numstat` output.
 * @param stdout - raw numstat text.
 * @returns [{ path, added, removed, binary }]
 */
function parseNumstat(stdout) {
	const files = [];
	for (const line of stdout.split("\n")) {
		if (!line.trim()) continue;
		const [added, removed, ...rest] = line.split("\t");
		files.push({
			path: rest.join("\t") ?? "",
			added: added === "-" ? null : Number(added) || 0,
			removed: removed === "-" ? null : Number(removed) || 0,
			binary: added === "-" || removed === "-"
		});
	}
	return files;
}

/**
 * Diff a single commit (files + patch), or — when `commit` is omitted — the
 * working tree / index, so "what did I change?" needs no extra tool.
 * @param dir - repo directory.
 * @param commit - commit hash; omit for working-tree diff.
 * @param options - { staged, base, paths, stat, maxBytes }
 */
export async function diff(dir, commit, options = {}) {
	const paths = normalizePaths(options.paths);
	const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : MAX_OUTPUT;
	if (typeof commit === "string" && commit.length > 0) {
		if (!/^[0-9a-f]{4,40}$/i.test(commit)) throw new Error("commit 参数无效");
		const [numstat, patch] = await Promise.all([
			runGit(dir, ["diff-tree", "-r", "--numstat", "--format=", commit, ...(paths.length ? ["--", ...paths] : [])]),
			runGit(dir, ["show", "--format=", "--no-color", commit, ...(paths.length ? ["--", ...paths] : [])], { maxOutput: maxBytes, timeoutMs: SLOW_TIMEOUT_MS })
		]);
		return { commit, files: parseNumstat(numstat.stdout), patch: patch.stdout, truncated: patch.capped === true, errorCode: patch.errorCode };
	}
	const common = [];
	if (options.staged === true) common.push("--cached");
	if (typeof options.base === "string" && options.base.length > 0) common.push(options.base);
	if (paths.length > 0) common.push("--", ...paths);
	const [numstat, patch] = await Promise.all([
		runGit(dir, ["diff", "--numstat", ...common], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--no-color", ...(options.stat === true ? ["--stat"] : []), ...common], { maxOutput: maxBytes, timeoutMs: SLOW_TIMEOUT_MS })
	]);
	return {
		commit: null,
		staged: options.staged === true,
		files: parseNumstat(numstat.stdout),
		patch: patch.stdout,
		truncated: patch.capped === true,
		errorCode: patch.errorCode
	};
}

/** Content of one file at one revision (`git show <rev>:<path>`). */
export async function showFile(dir, commit, path) {
	if (typeof commit !== "string" || commit.length === 0) throw new Error("缺失 commit 参数");
	const file = requireRelativePath(path);
	const result = await runGit(dir, ["show", `${commit}:${file}`], { timeoutMs: SLOW_TIMEOUT_MS });
	if (result.code !== 0) return { ok: false, error: result.stderr.trim() || "无法读取该文件版本", errorCode: result.errorCode };
	return { ok: true, commit, path: file, content: result.stdout, truncated: result.capped === true };
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
	if (/[\s~^:?*[\\]/.test(name) || name.startsWith("-")) throw new Error("分支名不合法（不能含空格或 git 保留字符，不能以 - 开头）");
	const args = ["branch", name];
	if (from && typeof from === "string" && from.trim()) args.push(from);
	const res = await runGit(dir, args);
	return res.code === 0
		? { ok: true, message: `已创建分支 ${name}` }
		: { ok: false, error: res.stderr.trim() || `创建分支失败(exit ${res.code})`, errorCode: res.errorCode };
}

/** Delete one local branch (-d refuses unmerged; force deletes anyway). */
export async function deleteBranch(dir, name, options = {}) {
	if (typeof name !== "string" || !name.trim()) throw new Error("分支名不能为空");
	const res = await runGit(dir, ["branch", options.force === true ? "-D" : "-d", name]);
	return res.code === 0
		? { ok: true, message: res.stdout.trim() || `已删除分支 ${name}` }
		: { ok: false, error: res.stderr.trim() || `删除分支失败(exit ${res.code})`, errorCode: res.errorCode };
}

/** Rename one local branch. */
export async function renameBranch(dir, from, to, options = {}) {
	if (typeof from !== "string" || !from.trim()) throw new Error("缺失原分支名");
	if (typeof to !== "string" || !to.trim()) throw new Error("缺失新分支名");
	const res = await runGit(dir, ["branch", options.force === true ? "-M" : "-m", from, to]);
	return res.code === 0
		? { ok: true, message: `已重命名 ${from} → ${to}` }
		: { ok: false, error: res.stderr.trim() || `重命名失败(exit ${res.code})`, errorCode: res.errorCode };
}

// --- safe write set ---------------------------------------------------------

/** Stage the given paths (a commit-scoped `add`; empty list is rejected). */
export async function addPaths(dir, paths) {
	const list = normalizePaths(paths);
	if (list.length === 0) throw new Error("缺少要暂存的路径");
	const res = await runGit(dir, ["add", "--", ...list]);
	return res.code === 0
		? { ok: true, message: `已暂存 ${list.length} 个路径` }
		: { ok: false, error: res.stderr.trim() || `git add 失败(exit ${res.code})`, errorCode: res.errorCode };
}

/** Unstage the given paths (keeps the working-tree changes). */
export async function unstagePaths(dir, paths) {
	const list = normalizePaths(paths);
	if (list.length === 0) throw new Error("缺少要取消暂存的路径");
	const head = await runGit(dir, ["rev-parse", "--verify", "--quiet", "HEAD"]);
	const args = head.code === 0
		? ["reset", "-q", "HEAD", "--", ...list]
		: ["rm", "-r", "--cached", "-q", "--", ...list];
	const res = await runGit(dir, args);
	return res.code === 0
		? { ok: true, message: `已取消暂存 ${list.length} 个路径` }
		: { ok: false, error: res.stderr.trim() || `取消暂存失败(exit ${res.code})`, errorCode: res.errorCode };
}

/** Commit with identity configured if empty; returns {ok, message, id?}. */
export async function commit(dir, message, { stagedOnly = false } = {}) {
	if (typeof message !== "string" || !message.trim()) throw new Error("提交信息不能为空");
	if (!stagedOnly) {
		const add = await runGit(dir, ["add", "-A"]);
		if (add.code !== 0) return { ok: false, error: `git add 失败: ${add.stderr.trim()}`, errorCode: add.errorCode };
	} else {
		// Pre-check the index ourselves: git's "nothing to commit" message is
		// localized on Windows, so stderr matching alone is unreliable.
		const staged = await runGit(dir, ["diff", "--cached", "--quiet"]);
		if (staged.code === 0) return { ok: false, error: "没有可提交的改动", errorCode: "nothing-to-commit" };
	}
	const res = await runGit(dir, ["commit", "-m", message], { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code !== 0) {
		const stderr = res.stderr.trim();
		if (/nothing to commit|no changes added|Working tree clean/.test(stderr)) return { ok: false, error: "没有可提交的改动", errorCode: "nothing-to-commit" };
		if (/Author identity unknown|Please tell me who you are/.test(stderr)) return { ok: false, error: "缺少 git 身份配置（user.name/user.email），请先在仓库执行 git init 时设置，或手动 git config", errorCode: "no-identity" };
		return { ok: false, error: `git commit 失败: ${stderr}`, errorCode: res.errorCode };
	}
	const m = res.stdout.match(/\[([^\]]+)\]/);
	return { ok: true, message: res.stdout.trim(), id: m ? m[1].split(" ")[0] : undefined };
}

/** Initialize a repo; optionally set identity + write a starter .gitignore. */
export async function init(dir, { userName, userEmail, gitignore = true } = {}) {
	requireDir(dir);
	const initRes = await runGit(dir, ["init"]);
	if (initRes.code !== 0) return { ok: false, error: `git init 失败: ${initRes.stderr.trim()}`, errorCode: initRes.errorCode };
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
	const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
	const mode = ref.code === 0 ? "分支" : "提交(游离 HEAD)";
	return res.code === 0
		? { ok: true, message: `已切换到${mode} ${target}` }
		: { ok: false, error: res.stderr.trim() || `checkout 失败(exit ${res.code})`, errorCode: res.errorCode };
}

/** Revert one commit by creating an inverse commit (safe). */
export async function revert(dir, commit) {
	if (typeof commit !== "string" || !commit.trim()) throw new Error("缺少要还原的 commit");
	const res = await runGit(dir, ["revert", "--no-edit", commit], { timeoutMs: SLOW_TIMEOUT_MS });
	return res.code === 0
		? { ok: true, message: res.stdout.trim() || `已生成还原提交` }
		: { ok: false, error: res.stderr.trim() || `revert 失败(exit ${res.code})`, errorCode: res.errorCode };
}

/** Merge target branch into current; returns ok or the conflict summary. */
export async function merge(dir, target) {
	if (typeof target !== "string" || !target.trim()) throw new Error("缺少要合并的分支");
	const res = await runGit(dir, ["merge", "--no-edit", target], { timeoutMs: SLOW_TIMEOUT_MS });
	const stderr = res.stderr.trim();
	if (res.code === 0) return { ok: true, message: res.stdout.trim() || `已将 ${target} 合并` };
	const conflict = await status(dir);
	return {
		ok: false,
		error: stderr,
		errorCode: res.errorCode,
		conflicts: conflict.entries.filter((e) => e.x === "U" || e.y === "U" || e.x === "A" || e.y === "A" || e.x === "D" || e.y === "D").map((e) => e.path)
	};
}

/**
 * Soft-reset HEAD to a commit: moves the branch pointer but keeps every
 * change staged, so "undo the last commit, keep the work" is one safe call.
 */
export async function resetSoft(dir, commit) {
	if (typeof commit !== "string" || !commit.trim()) throw new Error("缺少目标 commit");
	const res = await runGit(dir, ["reset", "--soft", commit]);
	return res.code === 0
		? { ok: true, message: `已软回退到 ${commit}（改动仍保留在暂存区）` }
		: { ok: false, error: res.stderr.trim() || `软回退失败(exit ${res.code})`, errorCode: res.errorCode };
}

/**
 * Abort an in-progress operation left behind by a conflict.
 * @param kind - merge | revert | cherry-pick
 */
export async function abortOperation(dir, kind) {
	const allowed = new Set(["merge", "revert", "cherry-pick"]);
	if (!allowed.has(kind)) throw new Error(`不支持的 aborted 类型: ${kind}（可用 merge / revert / cherry-pick）`);
	const res = await runGit(dir, [kind, "--abort"]);
	return res.code === 0
		? { ok: true, message: `已中止进行中的 ${kind}` }
		: { ok: false, error: res.stderr.trim() || `中止 ${kind} 失败(exit ${res.code})`, errorCode: res.errorCode };
}

/**
 * Stash actions: push / pop / apply / list / drop / show.
 * @param options - { action, message, ref, includeUntracked, paths }
 */
export async function stashAction(dir, options = {}) {
	const action = options.action ?? "list";
	const ref = typeof options.ref === "string" && options.ref.length > 0 ? options.ref : void 0;
	if (action === "list") {
		const res = await runGit(dir, ["stash", "list"]);
		if (res.code !== 0) return { ok: false, error: res.stderr.trim(), errorCode: res.errorCode };
		const entries = res.stdout.split("\n").filter(Boolean).map((line) => {
			const match = line.match(/^(stash@\{\d+\}):\s*(.*)$/);
			return { ref: match ? match[1] : "", message: match ? match[2] : line };
		});
		return { ok: true, entries };
	}
	if (action === "push") {
		const args = ["stash", "push"];
		if (options.includeUntracked === true) args.push("-u");
		if (typeof options.message === "string" && options.message.length > 0) args.push("-m", options.message);
		const paths = normalizePaths(options.paths);
		if (paths.length > 0) args.push("--", ...paths);
		const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
		return res.code === 0
			? { ok: true, message: res.stdout.trim() || "已暂存改动到 stash" }
			: { ok: false, error: res.stderr.trim() || `stash push 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	if (action === "pop" || action === "apply" || action === "drop") {
		const args = ["stash", action];
		if (ref !== void 0) args.push(ref);
		const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
		return res.code === 0
			? { ok: true, message: res.stdout.trim() || `stash ${action} 完成` }
			: { ok: false, error: res.stderr.trim() || `stash ${action} 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	if (action === "show") {
		const args = ["stash", "show", "-p"];
		if (ref !== void 0) args.push(ref);
		const res = await runGit(dir, args, { maxOutput: MAX_OUTPUT, timeoutMs: SLOW_TIMEOUT_MS });
		return res.code === 0
			? { ok: true, patch: res.stdout, truncated: res.capped === true }
			: { ok: false, error: res.stderr.trim() || `stash show 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	throw new Error(`不支持的 stash 动作: ${action}（可用 push / pop / apply / list / drop / show）`);
}

/** List tags (optionally filtered by pattern). */
export async function tagList(dir, pattern) {
	const args = ["tag", "-l", "--format=%(refname:short)%1f%(objectname:short)%1f%(subject)"];
	if (typeof pattern === "string" && pattern.length > 0) args.push(pattern);
	const res = await runGit(dir, args);
	if (res.code !== 0) return { ok: false, error: res.stderr.trim(), errorCode: res.errorCode };
	const tags = res.stdout.split("\n").filter(Boolean).map((line) => {
		const [name, object, subject] = line.split("\x1f");
		return { name, object, subject: subject ?? "" };
	});
	return { ok: true, tags };
}

/** Create a lightweight or annotated tag. */
export async function tagCreate(dir, name, options = {}) {
	if (typeof name !== "string" || !name.trim()) throw new Error("标签名不能为空");
	const args = ["tag"];
	if (typeof options.message === "string" && options.message.length > 0) args.push("-a", name, "-m", options.message);
	else args.push(name);
	if (typeof options.commit === "string" && options.commit.length > 0) args.push(options.commit);
	const res = await runGit(dir, args);
	return res.code === 0
		? { ok: true, message: `已创建标签 ${name}` }
		: { ok: false, error: res.stderr.trim() || `创建标签失败(exit ${res.code})`, errorCode: res.errorCode };
}

/** Delete one local tag. */
export async function tagDelete(dir, name) {
	if (typeof name !== "string" || !name.trim()) throw new Error("标签名不能为空");
	const res = await runGit(dir, ["tag", "-d", name]);
	return res.code === 0
		? { ok: true, message: res.stdout.trim() || `已删除标签 ${name}` }
		: { ok: false, error: res.stderr.trim() || `删除标签失败(exit ${res.code})`, errorCode: res.errorCode };
}

/**
 * Line-blame for one file (bounded so a huge file cannot flood the context).
 * @param options - { rev, start, end }
 */
export async function blame(dir, path, options = {}) {
	const file = requireRelativePath(path);
	const start = Number.isFinite(options.start) ? Math.max(1, Math.trunc(options.start)) : 1;
	const end = Number.isFinite(options.end) ? Math.max(start, Math.trunc(options.end)) : start + 199;
	const args = ["blame", "--date=iso", "-L", `${start},${end}`, ...(typeof options.rev === "string" && options.rev.length > 0 ? [options.rev] : []), "--", file];
	const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
	return res.code === 0
		? { ok: true, path: file, start, end, text: res.stdout, truncated: res.capped === true }
		: { ok: false, error: res.stderr.trim() || `blame 失败(exit ${res.code})`, errorCode: res.errorCode };
}

/** Recent reflog entries (recovery hints after a mistaken reset/rebase). */
export async function reflog(dir, limit = 30) {
	const clamp = Math.min(Math.max(Number(limit) || 30, 1), 200);
	const res = await runGit(dir, ["reflog", "--date=iso", `-n ${clamp}`, "--format=%h%x1f%gd%x1f%gs%x1f%aI"]);
	if (res.code !== 0) return { ok: false, error: res.stderr.trim() || "读取 reflog 失败", errorCode: res.errorCode };
	const entries = res.stdout.split("\n").filter(Boolean).map((line) => {
		const [hash, selector, subject, date] = line.split("\x1f");
		return { hash, selector, subject: subject ?? "", date: date ?? "" };
	});
	return { ok: true, entries };
}

// --- destructive ops (opt-in; never part of the default tool surface) -------

/** Discard working-tree changes for optional paths (all when empty). */
export async function restore(dir, paths = []) {
	const args = ["restore"]; // -W working tree only
	args.push(...(Array.isArray(paths) && paths.length ? paths : ["."]));
	const res = await runGit(dir, args);
	return res.code === 0 ? { ok: true, message: "已丢弃未提交改动" } : { ok: false, error: res.stderr.trim(), errorCode: res.errorCode };
}

/** Hard reset to a commit (rewrites history — local & unpushed only). */
export async function reset(dir, commit) {
	const res = await runGit(dir, ["reset", "--hard", commit]);
	return res.code === 0
		? { ok: true, message: `已硬回退到 ${commit}` }
		: { ok: false, error: res.stderr.trim(), errorCode: res.errorCode };
}

export { assertOk, normalizePaths };
