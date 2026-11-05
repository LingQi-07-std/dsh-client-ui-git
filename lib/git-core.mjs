// @dsh-external/dsh-client-ui-git — git-core.mjs
// Shared pure-function git helpers: read-only queries + the safe write set.
// Host half (GitGateway) and the git MCP server each consume their own copy
// (MCP keeps a synced copy under $DSH_HOME/mcp-git/git-core.mjs) so both run
// standalone without cross-directory imports. Keep both in sync:
//   node scripts/sync-git-core.mjs          # copy workspace -> MCP copy
//   node scripts/sync-git-core.mjs --check  # verify both sides agree
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

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
	if (/Not possible to fast-forward|Diverging branches/i.test(text)) return "not-fast-forward";
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
			env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C.UTF-8", ...(options.env ?? {}) }
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
		runGit(dir, ["status", "--porcelain", "-z", "-uall"]),
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
	const fmt = ["%H", "%P", "%D", "%an", "%ae", "%aI", "%s", "%b"].join("%x1f");
	// `--all` includes refs/stash, which the panel wants (the orange stash card), but
	// it also walks the stash's *second* commit — the "index on …" snapshot. That one
	// is pure bookkeeping and is filtered out while parsing (see below).
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
		const [hash, parentsRaw, decorate, author, email, date, subject, bodyRaw] = fields;
		// The stash's index snapshot ("index on <branch>: …") is an implementation
		// detail of `git stash`, never something to show on the timeline.
		if (/^index on \S+/.test(subject.trim())) continue;
		commits.push({
			hash,
			short: hash.slice(0, 8),
			parents: parentsRaw ? parentsRaw.split(" ") : [],
			refs: decorate ? decorate.split(", ").map((p) => p.replace(/^HEAD -> /, "")).filter(Boolean) : [],
			author,
			email,
			date,
			subject,
			body: typeof bodyRaw === "string" ? bodyRaw.trim().slice(0, 4000) : ""
		});
	}
	// Every stash entry belongs on the timeline, but `git log --all` only reaches the
	// newest one: refs/stash points at the top of the stack and older entries survive
	// only in its reflog. Pull those out of the object store and tag them with the ref
	// the stash panel uses (stash@{n}).
	const stashRes = await runGit(dir, ["stash", "list", "--format=%gd%x1f%H"]);
	if (stashRes.code === 0) {
		const stashRefs = new Map();
		for (const line of stashRes.stdout.split("\n")) {
			const parts = line.split("\x1f");
			const ref = (parts[0] ?? "").trim();
			const hash = (parts[1] ?? "").trim();
			if (ref.length > 0 && hash.length > 0) stashRefs.set(hash, ref);
		}
		for (const [hash, ref] of stashRefs) {
			const existing = commits.find((item) => item.hash === hash);
			if (existing !== void 0) {
				existing.stashRef = ref;
				continue;
			}
			const shown = await runGit(dir, ["show", "-s", `--format=${fmt}`, hash]);
			if (shown.code !== 0) continue;
			const fields = (shown.stdout.split("\x1e")[0] ?? "").trim().split("\x1f");
			if (fields.length < 7 || fields[0] === "") continue;
			const [shownHash, parentsRaw, decorate, author, email, date, subject, bodyRaw] = fields;
			commits.push({
				hash: shownHash,
				short: shownHash.slice(0, 8),
				parents: parentsRaw ? parentsRaw.split(" ") : [],
				refs: decorate ? decorate.split(", ").map((p) => p.replace(/^HEAD -> /, "")).filter(Boolean) : [],
				author,
				email,
				date,
				subject,
				body: typeof bodyRaw === "string" ? bodyRaw.trim().slice(0, 4000) : "",
				stashRef: ref
			});
		}
		// Newest first, same ordering the panel assumes everywhere.
		commits.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
	}
	return { commits };
}

/** Working-tree status entries. */
export async function status(dir) {
	// `-uall` lists every file inside an untracked directory. Without it git
	// collapses the whole folder into `?? dir/`, which the panel cannot render
	// as a file row (and whose trailing slash produced an empty filename).
	const result = await runGit(dir, ["status", "--porcelain", "-z", "-uall"]);
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
 * Changed-file status letters (A/M/D/R/C/T/U) parsed from `--name-status`.
 * Rename/copy rows carry `old\tnew`; the new path is the one reported.
 * @param stdout - raw name-status text.
 * @returns Map<path, status>
 */
function parseNameStatus(stdout) {
	const map = new Map();
	for (const line of stdout.split("\n")) {
		if (!line.trim()) continue;
		const parts = line.split("\t");
		const raw = parts[0] ?? "";
		const status = raw[0] ?? "M";
		const path = parts.length >= 3 ? parts[2] : parts[1];
		if (typeof path === "string" && path.length > 0) map.set(path, status);
	}
	return map;
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
	const pathArgs = paths.length ? ["--", ...paths] : [];
	if (typeof commit === "string" && commit.length > 0) {
		if (!/^[0-9a-f]{4,40}$/i.test(commit)) throw new Error("commit 参数无效");
		const [numstat, nameStatus, patch] = await Promise.all([
			// `show --first-parent` is what actually works for stash/merge commits:
			// diff-tree drops their diff unless -m is given, show does not.
			runGit(dir, ["show", "--numstat", "--format=", "--first-parent", commit, ...pathArgs]),
			runGit(dir, ["show", "--name-status", "--format=", "--first-parent", commit, ...pathArgs]),
			runGit(dir, ["show", "--format=", "--no-color", "--first-parent", commit, ...pathArgs], { maxOutput: maxBytes, timeoutMs: SLOW_TIMEOUT_MS })
		]);
		const statusMap = parseNameStatus(nameStatus.stdout);
		const files = parseNumstat(numstat.stdout).map((file) => ({ ...file, status: statusMap.get(file.path) ?? "M" }));
		return { commit, files, patch: patch.stdout, truncated: patch.capped === true, errorCode: patch.errorCode };
	}
	const common = [];
	if (options.staged === true) common.push("--cached");
	if (typeof options.base === "string" && options.base.length > 0) common.push(options.base);
	if (paths.length > 0) common.push("--", ...paths);
	const [numstat, nameStatus, patch] = await Promise.all([
		runGit(dir, ["diff", "--numstat", ...common], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--name-status", ...common], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--no-color", ...(options.stat === true ? ["--stat"] : []), ...common], { maxOutput: maxBytes, timeoutMs: SLOW_TIMEOUT_MS })
	]);
	const statusMap = parseNameStatus(nameStatus.stdout);
	const files = parseNumstat(numstat.stdout).map((file) => ({ ...file, status: statusMap.get(file.path) ?? "M" }));
	return {
		commit: null,
		staged: options.staged === true,
		files,
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
	// Read the upstream BEFORE renaming: after `branch -m` the old name is gone.
	const upstreamRes = await runGit(dir, ["rev-parse", "--abbrev-ref", `${from}@{upstream}`]);
	const upstream = upstreamRes.code === 0 ? upstreamRes.stdout.trim() : "";
	const res = await runGit(dir, ["branch", options.force === true ? "-M" : "-m", from, to]);
	if (res.code !== 0) return { ok: false, error: res.stderr.trim() || `重命名失败(exit ${res.code})`, errorCode: res.errorCode };
	if (options.renameRemote !== true || upstream.length === 0) {
		return { ok: true, message: `已重命名 ${from} → ${to}` };
	}
	// The local rename migrated the upstream config but it still points at the OLD
	// remote branch. Move the remote side over as well: push new, delete old, re-link.
	const slash = upstream.indexOf("/");
	const remoteName = slash > 0 ? upstream.slice(0, slash) : "origin";
	const remoteBranch = slash > 0 ? upstream.slice(slash + 1) : upstream;
	const push = await runGit(dir, ["push", remoteName, `${to}:${to}`], { timeoutMs: SLOW_TIMEOUT_MS });
	if (push.code !== 0) {
		return { ok: false, error: `本地已重命名为 ${to}，但推送远程分支失败：${push.stderr.trim() || `exit ${push.code}`}`, errorCode: push.errorCode };
	}
	const removeOld = await runGit(dir, [...credentialArgs(options.account), "push", remoteName, "--delete", remoteBranch], { timeoutMs: SLOW_TIMEOUT_MS });
	if (removeOld.code !== 0) {
		return { ok: false, error: `本地与远程新分支已就绪，但删除远程旧分支 ${remoteBranch} 失败：${removeOld.stderr.trim() || `exit ${removeOld.code}`}`, errorCode: removeOld.errorCode };
	}
	await runGit(dir, ["branch", `--set-upstream-to=${remoteName}/${to}`, to]);
	return { ok: true, message: `已重命名本地与远程分支 ${from} → ${to}` };
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

/** Default identity used when the repo/user has no user.name/user.email. */
const DEFAULT_IDENTITY = { name: "DSH", email: "dsh@local" };

/**
 * `-c user.name/user.email` args, only for values the repo/user has not
 * configured. `override` is the identity from the settings panel: it replaces
 * the built-in fallback, but never overrides an identity the repo or the user's
 * global git config already declares (that would silently rewrite authorship).
 * `force` (MCP commits) pins the override: the supplied fields win even when the
 * repo/user config already has a value.
 */
async function identityArgs(dir, override, force) {
	const [name, email] = await Promise.all([
		runGit(dir, ["config", "user.name"]),
		runGit(dir, ["config", "user.email"])
	]);
	const pick = (value, fallback) => (typeof value === "string" && value.trim() !== "" ? value.trim() : fallback);
	const wanted = {
		name: pick(override?.name, DEFAULT_IDENTITY.name),
		email: pick(override?.email, DEFAULT_IDENTITY.email)
	};
	const forced = {
		name: force === true && typeof override?.name === "string" && override.name.trim() !== "",
		email: force === true && typeof override?.email === "string" && override.email.trim() !== ""
	};
	const args = [];
	if (forced.name || name.code !== 0 || name.stdout.trim() === "") args.push("-c", `user.name=${wanted.name}`);
	if (forced.email || email.code !== 0 || email.stdout.trim() === "") args.push("-c", `user.email=${wanted.email}`);
	return args;
}

/** Commit with identity configured if empty; returns {ok, message, id?}. */
export async function commit(dir, message, { stagedOnly = false, paths = [], identity: identityOverride, forceIdentity = false } = {}) {
	if (typeof message !== "string" || !message.trim()) throw new Error("提交信息不能为空");
	const list = normalizePaths(paths);
	const identity = await identityArgs(dir, identityOverride, forceIdentity === true);
	// Selected-file commit: stage exactly those paths (untracked included) and
	// commit ONLY them, leaving any other staged work untouched in the index.
	if (list.length > 0) {
		const add = await runGit(dir, ["add", "--", ...list]);
		if (add.code !== 0) return { ok: false, error: `git add 失败: ${add.stderr.trim()}`, errorCode: add.errorCode };
		const res = await runGit(dir, [...identity, "commit", "-m", message, "--", ...list], { timeoutMs: SLOW_TIMEOUT_MS });
		if (res.code !== 0) return commitError(res);
		const m = res.stdout.match(/\[([^\]]+)\]/);
		return { ok: true, message: res.stdout.trim(), id: m ? m[1].split(" ")[0] : undefined };
	}
	if (!stagedOnly) {
		const add = await runGit(dir, ["add", "-A"]);
		if (add.code !== 0) return { ok: false, error: `git add 失败: ${add.stderr.trim()}`, errorCode: add.errorCode };
	} else {
		// Pre-check the index ourselves: git's "nothing to commit" message is
		// localized on Windows, so stderr matching alone is unreliable.
		const staged = await runGit(dir, ["diff", "--cached", "--quiet"]);
		if (staged.code === 0) return { ok: false, error: "没有可提交的改动", errorCode: "nothing-to-commit" };
	}
	const res = await runGit(dir, [...identity, "commit", "-m", message], { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code !== 0) return commitError(res);
	const m = res.stdout.match(/\[([^\]]+)\]/);
	return { ok: true, message: res.stdout.trim(), id: m ? m[1].split(" ")[0] : undefined };
}

/** Map a failed `git commit` onto the shared ok/error shape. */
function commitError(res) {
	const stderr = res.stderr.trim();
	if (/nothing to commit|no changes added|Working tree clean/.test(stderr)) return { ok: false, error: "没有可提交的改动", errorCode: "nothing-to-commit" };
	if (/Author identity unknown|Please tell me who you are/.test(stderr)) return { ok: false, error: "缺少 git 身份配置（user.name/user.email），请先设置后再提交", errorCode: "no-identity" };
	return { ok: false, error: `git commit 失败: ${stderr}`, errorCode: res.errorCode };
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

/** Porcelain conflict letters: both sides touch the hunk. */
const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

/** Paths whose porcelain status code is an unresolved conflict. */
function conflictPaths(entries) {
	return entries.filter((entry) => CONFLICT_CODES.has(`${entry.x}${entry.y}`)).map((entry) => entry.path);
}

/**
 * Merge target into the current branch.
 * @param options - { mode: "ff-only" | "no-ff" | "squash" }; default = git's own choice.
 *   ff-only refuses when the branches diverged; squash applies the whole diff as a
 *   single new commit (no merge commit, no MERGE_HEAD).
 */
/**
 * Pre-flight for a merge: can `source` fast-forward into `target`, and would
 * the merge conflict? Uses `merge-tree --write-tree` (git >= 2.38) so nothing
 * touches the working tree.
 */
export async function mergePreview(dir, target, source) {
	const targetRef = String(target ?? "").trim();
	const sourceRef = String(source ?? "").trim();
	if (targetRef.length === 0 || sourceRef.length === 0) return { ok: false, error: "缺少分支名" };
	const base = await runGit(dir, ["merge-base", targetRef, sourceRef]);
	const targetHash = await runGit(dir, ["rev-parse", targetRef]);
	const ffOnly = base.code === 0 && targetHash.code === 0 && base.stdout.trim() === targetHash.stdout.trim();
	const tree = await runGit(dir, ["merge-tree", "--write-tree", "--no-messages", targetRef, sourceRef]);
	// Conflict rows look like "100644 <hash> 2\t<path>"; keep the unique paths.
	const conflicts = tree.code === 1
		? Array.from(new Set(tree.stdout.split("\n")
			.slice(1)
			.map((line) => line.trim())
			.map((line) => line.split("\t").pop() ?? "")
			.filter((path) => path.length > 0)))
		: [];
	return { ok: true, ffOnly, conflicts };
}

/**
 * Rebase `source` (default: current branch) onto `upstream` (a commit or
 * branch). Conflicts pause the rebase; the panel then uses the normal rebase
 * conflict flow.
 */
export async function rebase(dir, upstream, source) {
	const target = String(upstream ?? "").trim();
	if (target.length === 0) throw new Error("缺少变基目标");
	const branch = String(source ?? "").trim();
	if (branch.length > 0) {
		const head = await runGit(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
		if (head.code === 0 && head.stdout.trim() !== branch) {
			const checkout = await runGit(dir, ["checkout", branch]);
			if (checkout.code !== 0) {
				return { ok: false, error: checkout.stderr.trim() || "切换分支失败", errorCode: checkout.errorCode };
			}
		}
	}
	const res = await runGit(dir, ["rebase", target], { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code === 0) return { ok: true, message: res.stdout.trim() || `已变基到 ${target}` };
	const conflict = await status(dir);
	return {
		ok: false,
		error: res.stderr.trim() || `rebase 失败(exit ${res.code})`,
		errorCode: res.errorCode,
		conflicts: conflictPaths(conflict.entries)
	};
}

/** Skip the current commit while a rebase is paused. */
export async function rebaseSkip(dir) {
	const res = await runGit(dir, ["rebase", "--skip"], { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code === 0) return { ok: true, message: "已跳过当前提交" };
	const conflict = await status(dir);
	return {
		ok: false,
		error: res.stderr.trim() || `rebase --skip 失败(exit ${res.code})`,
		errorCode: res.errorCode,
		conflicts: conflictPaths(conflict.entries)
	};
}

/** Rebase progress: how many commits are done / left while a rebase is paused. */
export async function rebaseProgress(dir) {
	// `--git-path` returns a path relative to the repo, so ask for absolute
	// paths — reading the relative one against the process cwd silently fails.
	const [msgnum, end] = await Promise.all([
		runGit(dir, ["rev-parse", "--path-format=absolute", "--git-path", "rebase-merge/msgnum"]),
		runGit(dir, ["rev-parse", "--path-format=absolute", "--git-path", "rebase-merge/end"])
	]);
	const readNumber = async (gitPath) => {
		if (gitPath.code !== 0) return null;
		const file = await readFile(gitPath.stdout.trim(), "utf8").catch(() => null);
		const value = Number(String(file ?? "").trim());
		return Number.isFinite(value) ? value : null;
	};
	const current = await readNumber(msgnum);
	const total = await readNumber(end);
	return current !== null && total !== null ? { current, total } : null;
}

export async function merge(dir, target, options = {}) {
	if (typeof target !== "string" || !target.trim()) throw new Error("缺少要合并的分支");
	const mode = options.mode === "ff-only" || options.mode === "no-ff" || options.mode === "squash" ? options.mode : "default";
	if (mode === "squash") {
		const applied = await runGit(dir, ["merge", "--squash", target], { timeoutMs: SLOW_TIMEOUT_MS });
		if (applied.code !== 0) {
			const conflict = await status(dir);
			return {
				ok: false,
				error: applied.stderr.trim() || `merge --squash 失败(exit ${applied.code})`,
				errorCode: errorCodeOf(applied.stderr, applied.code, applied.timedOut),
				conflicts: conflictPaths(conflict.entries)
			};
		}
		const committed = await runGit(dir, ["commit", "--no-edit"], { timeoutMs: SLOW_TIMEOUT_MS });
		if (committed.code !== 0) {
			return {
				ok: false,
				error: `摘取已应用，但自动提交失败: ${committed.stderr.trim() || committed.errorCode}`,
				errorCode: committed.errorCode
			};
		}
		return { ok: true, message: committed.stdout.trim() || `已摘取 ${target} 的改动（squash）` };
	}
	const args = ["merge"];
	if (mode === "ff-only") args.push("--ff-only");
	if (mode === "no-ff") args.push("--no-ff");
	args.push("--no-edit", target);
	const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code === 0) return { ok: true, message: res.stdout.trim() || `已将 ${target} 合并` };
	const conflict = await status(dir);
	return {
		ok: false,
		error: res.stderr.trim() || `merge 失败(exit ${res.code})`,
		errorCode: errorCodeOf(res.stderr, res.code, res.timedOut),
		conflicts: conflictPaths(conflict.entries)
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
 * @param kind - merge | revert | cherry-pick | rebase | squash
 *
 * A squash merge writes SQUASH_MSG instead of MERGE_HEAD, so `merge --abort`
 * cannot undo it; dropping the staged merge result is the only way back.
 */
export async function abortOperation(dir, kind) {
	if (kind === "squash") {
		const res = await runGit(dir, ["reset", "--hard", "HEAD"]);
		return res.code === 0
			? { ok: true, message: "已中止这次摘取（解决进度已丢弃）" }
			: { ok: false, error: res.stderr.trim() || `中止摘取失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	const allowed = new Set(["merge", "revert", "cherry-pick", "rebase"]);
	if (!allowed.has(kind)) throw new Error(`不支持的中止类型: ${kind}（可用 merge / revert / cherry-pick / rebase / squash）`);
	const res = await runGit(dir, [kind, "--abort"]);
	return res.code === 0
		? { ok: true, message: `已中止进行中的 ${kind}` }
		: { ok: false, error: res.stderr.trim() || `中止 ${kind} 失败(exit ${res.code})`, errorCode: res.errorCode };
}

/**
 * Stash actions: push / list / show / apply / pop / drop / clear / branch.
 * @param options - { action, message, ref, includeUntracked, all, paths, index,
 *                    staged, keepIndex, branch }
 */
export async function stashAction(dir, options = {}) {
	const action = options.action ?? "list";
	const ref = typeof options.ref === "string" && options.ref.length > 0 ? options.ref : void 0;
	if (action === "list") {
		const res = await runGit(dir, ["stash", "list", "--format=%gd|%H|%cI|%an|%gs"]);
		if (res.code !== 0) return { ok: false, error: res.stderr.trim(), errorCode: res.errorCode };
		const entries = res.stdout.split("\n").filter(Boolean).map((line) => {
			const [entryRef, hash, date, author, ...rest] = line.split("|");
			const message = rest.join("|");
			return { ref: entryRef ?? "", hash: hash ?? "", date: date ?? "", author: author ?? "", message };
		});
		return { ok: true, entries };
	}
	if (action === "push") {
		const args = ["stash", "push"];
		const paths = normalizePaths(options.paths);
		// Selected paths: stage them first so untracked files can be stashed too
		// (git refuses `stash push -- <untracked>` without an index entry).
		if (paths.length > 0 && options.staged !== true) {
			await runGit(dir, ["add", "--", ...paths]);
			args.push("--staged");
		} else if (options.staged === true) args.push("--staged");
		else if (options.all === true) args.push("-a");
		else if (options.includeUntracked === true) args.push("-u");
		if (options.keepIndex === true) args.push("--keep-index");
		if (typeof options.message === "string" && options.message.length > 0) args.push("-m", options.message);
		if (paths.length > 0) args.push("--", ...paths);
		const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
		return res.code === 0
			? { ok: true, message: res.stdout.trim() || "已暂存改动到 stash" }
			: { ok: false, error: res.stderr.trim() || `stash push 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	if (action === "pop" || action === "apply") {
		const args = ["stash", action];
		if (options.index === true) args.push("--index");
		if (ref !== void 0) args.push(ref);
		const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
		if (res.code === 0) return { ok: true, message: res.stdout.trim() || `stash ${action} 完成` };
		// A conflicting apply/pop leaves markers in the working tree; report them so
		// the panel can enter the normal conflict flow.
		const conflict = await status(dir);
		return {
			ok: false,
			error: res.stderr.trim() || `stash ${action} 失败(exit ${res.code})`,
			errorCode: res.errorCode,
			conflicts: conflictPaths(conflict.entries)
		};
	}
	if (action === "drop") {
		const args = ["stash", "drop"];
		if (ref !== void 0) args.push(ref);
		const res = await runGit(dir, args);
		return res.code === 0
			? { ok: true, message: res.stdout.trim() || "已删除 stash" }
			: { ok: false, error: res.stderr.trim() || `stash drop 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	if (action === "clear") {
		const res = await runGit(dir, ["stash", "clear"]);
		return res.code === 0
			? { ok: true, message: "已清空 stash" }
			: { ok: false, error: res.stderr.trim() || `stash clear 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	if (action === "branch") {
		const name = typeof options.branch === "string" && options.branch.length > 0 ? options.branch : "stash-branch";
		const args = ["stash", "branch", name];
		if (ref !== void 0) args.push(ref);
		const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
		return res.code === 0
			? { ok: true, message: res.stdout.trim() || `已从 stash 创建分支 ${name}` }
			: { ok: false, error: res.stderr.trim() || `stash branch 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	if (action === "show") {
		const args = ["stash", "show", "-p"];
		if (ref !== void 0) args.push(ref);
		const res = await runGit(dir, args, { maxOutput: MAX_OUTPUT, timeoutMs: SLOW_TIMEOUT_MS });
		return res.code === 0
			? { ok: true, patch: res.stdout, truncated: res.capped === true }
			: { ok: false, error: res.stderr.trim() || `stash show 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	throw new Error(`不支持的 stash 动作: ${action}（可用 push / list / show / apply / pop / drop / clear / branch）`);
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

/**
 * Every history-shaping reflog event, read straight from `.git/logs`.
 *
 * Unlike `reflog()` this spawns nothing and applies NO row cap: it is meant to
 * be merged with `log()` so the panel can show things the commit graph cannot —
 * branch creation, checkout, merge, reset/rebase, and commits that are no longer
 * reachable from any ref (reflog keeps their old hashes).
 */
export async function reflogEvents(dir) {
	const root = requireDir(dir);
	// A linked worktree has `.git` as a file pointing at the real git dir.
	let gitDir = join(root, ".git");
	try {
		const info = await stat(gitDir);
		if (info.isFile()) {
			const text = await readFile(gitDir, "utf8");
			const match = /^gitdir:\s*(.+)$/m.exec(text);
			if (match !== null) gitDir = resolve(root, match[1].trim());
		}
	} catch (error) {
		return { ok: false, error: "不是 git 仓库", errorCode: "NO_REPO" };
	}
	const logsDir = join(gitDir, "logs");
	const files = [join(logsDir, "HEAD")];
	try {
		const heads = join(logsDir, "refs", "heads");
		// Branch names can contain slashes (feat/x), so walk the tree recursively.
		for (const name of await readdir(heads, { recursive: true })) {
			files.push(join(heads, name));
		}
	} catch (error) {
		// No branch reflogs yet (fresh repo) — HEAD alone is fine.
	}
	// History-shaping actions only. `checkout:` is deliberately excluded: it fires
	// on every branch switch, adds no graph information, and drowns the real events.
	// `branch:` is narrowed to a real creation record: `branch -f` writes
	// "branch: Reset to <hash>" and `branch -m` writes "branch: renamed ...",
	// which are NOT creation events (they used to render as fake branch cards).
	const KEEP = /^(branch: Created from|merge |reset:|rebase|cherry-pick|clone:|initial pull|pull)/i;
	const events = [];
	// HEAD and a branch reflog both record the same operation; keep one copy.
	const seen = new Set();
	for (const file of files) {
		let text;
		try {
			text = await readFile(file, "utf8");
		} catch (error) {
			continue;
		}
		const ref = relative(logsDir, file).replace(/\\/g, "/");
		for (const line of text.split("\n")) {
			if (line.length === 0) continue;
			const tab = line.indexOf("\t");
			if (tab < 0) continue;
			const head = line.slice(0, tab).split(" ");
			if (head.length < 5) continue;
			const message = line.slice(tab + 1).trim();
			if (KEEP.test(message) === false) continue;
			// Format: <old> <new> <name> <email> <timestamp> <tz>
			const [oldHash, newHash, name, email, stamp] = head;
			// Any record that moves a ref onto itself is a no-op and must not take a row:
			//   reset: moving to HEAD      (git reset with no args = unstage)
			//   merge x: updating HEAD     (merge already up to date)
			if (oldHash === newHash) continue;
			const seconds = Number(stamp);
			const key = `${oldHash}|${newHash}|${stamp}|${message}`;
			if (seen.has(key)) continue;
			seen.add(key);
			events.push({
				ref,
				oldHash,
				newHash,
				actor: [name, email].filter(Boolean).join(" ").trim(),
				date: Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : "",
				message: message.slice(0, 300),
				action: (message.split(":")[0] || message).trim()
			});
		}
	}
	events.sort((a, b) => (a.date < b.date ? 1 : -1));
	return { ok: true, events, gitDir };
}

// --- destructive ops (opt-in; never part of the default tool surface) -------

/** Discard changes for optional paths (all when empty): index, working tree AND untracked. */
export async function restore(dir, paths = []) {
	// --staged --worktree: a file whose change is only staged must be reset too,
	// otherwise `git restore` (working tree only) looks like a no-op.
	const targets = Array.isArray(paths) && paths.length > 0 ? paths : [];
	const args = ["restore", "--staged", "--worktree", ...(targets.length > 0 ? ["--", ...targets] : ["."])];
	const res = await runGit(dir, args);
	if (res.code !== 0) return { ok: false, error: res.stderr.trim(), errorCode: res.errorCode };
	// `restore` never touches untracked files — clean them as well.
	const clean = await runGit(dir, ["clean", "-fd", ...(targets.length > 0 ? ["--", ...targets] : [])]);
	if (clean.code !== 0) return { ok: false, error: clean.stderr.trim(), errorCode: clean.errorCode };
	return { ok: true, message: "已丢弃未提交改动" };
}

/** Hard reset to a commit (rewrites history — local & unpushed only). */
export async function reset(dir, commit, mode) {
	// `soft` keeps the dropped commits' changes in the index — squash relies on it
	// (reset --soft <parent> followed by a single commit).
	const soft = mode === "soft";
	const res = await runGit(dir, ["reset", soft ? "--soft" : "--hard", commit]);
	return res.code === 0
		? { ok: true, message: soft ? `已软回退到 ${commit}（改动保留在暂存区）` : `已硬回退到 ${commit}` }
		: { ok: false, error: res.stderr.trim(), errorCode: res.errorCode };
}

// --- branch management / merge-conflict state -------------------------------

/** Absolute path of the real git dir (a linked worktree stores `.git` as a file). */
async function gitDirOf(dir) {
	const res = await runGit(dir, ["rev-parse", "--absolute-git-dir"]);
	return res.code === 0 && res.stdout.trim().length > 0 ? res.stdout.trim() : null;
}

/** Work-tree root, or the input dir when git cannot resolve one. */
async function workTreeOf(dir) {
	const res = await runGit(dir, ["rev-parse", "--show-toplevel"]);
	return res.code === 0 && res.stdout.trim().length > 0 ? res.stdout.trim() : dir;
}

async function readTextOrNull(path) {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		return null;
	}
}

/** Raw reflog records from HEAD plus every branch log. */
async function reflogRecords(gitDir) {
	const logsDir = join(gitDir, "logs");
	const files = [join(logsDir, "HEAD")];
	try {
		const heads = join(logsDir, "refs", "heads");
		for (const name of await readdir(heads, { recursive: true })) files.push(join(heads, name));
	} catch (error) {
		// Fresh repository: HEAD alone is fine.
	}
	const records = [];
	for (const file of files) {
		const text = await readTextOrNull(file);
		if (text === null) continue;
		const ref = relative(logsDir, file).replace(/\\/g, "/");
		for (const line of text.split("\n")) {
			if (line.length === 0) continue;
			const tab = line.indexOf("\t");
			if (tab < 0) continue;
			const head = line.slice(0, tab).split(" ");
			if (head.length < 5) continue;
			const [oldHash, newHash, name, email, stamp] = head;
			const seconds = Number(stamp);
			records.push({
				ref,
				oldHash,
				newHash,
				actor: [name, email].filter(Boolean).join(" ").trim(),
				ts: Number.isFinite(seconds) ? seconds : 0,
				message: line.slice(tab + 1).trim()
			});
		}
	}
	return records;
}

/** Count `<<<<<<<` marker lines: one block per conflict hunk. */
function countConflictBlocks(text) {
	const matches = String(text ?? "").match(/^<{7}/gm);
	return matches === null ? 0 : matches.length;
}

/** Latest branch creation record for one branch (`branch: Created from X`). */
function creationOf(records, name) {
	const target = `refs/heads/${name}`;
	let best = null;
	for (const record of records) {
		if (record.ref !== target) continue;
		if (/^branch: Created from/i.test(record.message) === false) continue;
		if (best === null || record.ts >= best.ts) best = record;
	}
	if (best === null) return null;
	const match = /Created from\s+(.+)$/i.exec(best.message);
	return {
		date: best.ts > 0 ? new Date(best.ts * 1000).toISOString() : "",
		from: match === null ? "" : match[1].trim(),
		hash: best.newHash
	};
}

/**
 * Local branches with everything the branch panel needs: tip, last commit,
 * upstream, whether it is merged into HEAD, and the creation record.
 */
export async function branchDetails(dir) {
	requireDir(dir);
	const [refs, currentRes, mergedRes, gitDir] = await Promise.all([
		// `%(upstream:track)` prints "[ahead 3, behind 1]" — cheaper than running
		// rev-list per branch, and empty for branches without an upstream.
		runGit(dir, ["for-each-ref", "--format=%(refname:short)%1f%(objectname)%1f%(upstream:short)%1f%(committerdate:iso-strict)%1f%(subject)%1f%(upstream:track)", "refs/heads"]),
		runGit(dir, ["symbolic-ref", "--short", "-q", "HEAD"]),
		runGit(dir, ["for-each-ref", "--merged=HEAD", "--format=%(refname:short)", "refs/heads"]),
		gitDirOf(dir)
	]);
	const current = currentRes.stdout.trim();
	const merged = new Set(mergedRes.stdout.split("\n").map((item) => item.trim()).filter(Boolean));
	const records = gitDir === null ? [] : await reflogRecords(gitDir);
	const branches = [];
	for (const line of refs.stdout.split("\n")) {
		if (line.trim().length === 0) continue;
		const [name, hash, upstream, date, subject, track] = line.split("\x1f");
		if (typeof name !== "string" || name.length === 0) continue;
		const aheadMatch = /ahead (\d+)/.exec(track ?? "");
		const behindMatch = /behind (\d+)/.exec(track ?? "");
		branches.push({
			name,
			hash: hash ?? "",
			short: (hash ?? "").slice(0, 8),
			upstream: upstream ?? "",
			date: date ?? "",
			subject: subject ?? "",
			// Commits this branch has that its upstream does not (and vice versa).
			ahead: aheadMatch === null ? 0 : Number(aheadMatch[1]),
			behind: behindMatch === null ? 0 : Number(behindMatch[1]),
			current: name === current,
			merged: merged.has(name),
			created: creationOf(records, name)
		});
	}
	// `main` / `master` is usually created by `git init`, so no
	// "branch: Created from" reflog row exists. Fall back to the root commit so
	// the branch panel can still show a creation time instead of "unknown".
	const isPrimary = (name) => name === "main" || name === "master";
	await Promise.all(branches
		.filter((branch) => branch.created === null && isPrimary(branch.name))
		.map(async (branch) => {
			const root = await runGit(dir, ["rev-list", "--max-parents=0", "--max-count=1", branch.name]);
			const hash = root.stdout.trim().split("\n")[0] ?? "";
			if (hash.length === 0) return;
			const shown = await runGit(dir, ["show", "-s", "--format=%aI", hash]);
			const date = shown.stdout.trim();
			if (date.length > 0) branch.created = { date, from: "仓库初始", hash };
		}));
	// Order: current branch, then the primary branch, then newest commit first.
	branches.sort((a, b) => {
		if (a.current !== b.current) return a.current ? -1 : 1;
		const pa = isPrimary(a.name) ? 0 : 1;
		const pb = isPrimary(b.name) ? 0 : 1;
		if (pa !== pb) return pa - pb;
		if (a.date !== b.date) return a.date < b.date ? 1 : -1;
		return a.name.localeCompare(b.name);
	});
	return { branches };
}

// ---- remote sync: pending commits and remote branches ----

/**
 * Link a local branch to a remote-tracking branch (`git branch --set-upstream-to`).
 * This is the fix for the panel's "未关联" state when the remote branch already
 * exists; a branch that has no remote counterpart is pushed with `-u` instead.
 */
export async function linkUpstream(dir, branch, upstream) {
	requireDir(dir);
	const name = String(branch ?? "").trim();
	const target = String(upstream ?? "").trim();
	if (name.length === 0) return { ok: false, error: "缺少本地分支名" };
	if (target.length === 0) return { ok: false, error: "缺少远程分支名" };
	const res = await runGit(dir, ["branch", "--set-upstream-to", target, name]);
	if (res.code !== 0) {
		return { ok: false, error: res.stderr.trim() || `关联失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	return { ok: true, message: res.stdout.trim() || `已将 ${name} 关联到 ${target}` };
}

/** Parse `log --format=%H%x1f%an%x1f%aI%x1f%s` output into commit rows. */
function parseCommitLines(text) {
	const out = [];
	for (const line of String(text ?? "").split("\n")) {
		if (line.trim().length === 0) continue;
		const [hash, author, date, subject] = line.split("\x1f");
		if (typeof hash !== "string" || hash.length === 0) continue;
		out.push({ hash, short: hash.slice(0, 8), author: author ?? "", date: date ?? "", subject: subject ?? "" });
	}
	return out;
}

/**
 * Merge `diff --numstat` and `diff --name-status` into one file row per path.
 * `numstat` carries the line counts (and marks binaries with "-"), while
 * `name-status` carries the A/M/D/R letter.
 */
function mergeNumstat(numstatText, nameStatusText) {
	const status = new Map();
	for (const line of String(nameStatusText ?? "").split("\n")) {
		if (line.trim().length === 0) continue;
		const parts = line.split("\t");
		const code = parts[0] ?? "";
		const path = parts[parts.length - 1] ?? "";
		if (path.length > 0) status.set(path, code.charAt(0));
	}
	const files = [];
	for (const line of String(numstatText ?? "").split("\n")) {
		if (line.trim().length === 0) continue;
		const parts = line.split("\t");
		if (parts.length < 3) continue;
		const added = parts[0];
		const removed = parts[1];
		const path = parts.slice(2).join("\t");
		files.push({
			path,
			added: added === "-" ? null : Number(added),
			removed: removed === "-" ? null : Number(removed),
			status: status.get(path) ?? "M"
		});
	}
	return files;
}

/**
 * Pending sync work for the CURRENT branch, relative to its upstream:
 * the commits a push would send, the commits a pull would bring in, and the
 * NET file changes of each side (the whole chain merged, not per commit —
 * that is what the panel's bubbles list under the commit chain).
 *
 * A branch without an upstream returns `upstream: ""` and empty lists; the
 * panel renders that as "未关联".
 */
export async function syncCommits(dir) {
	requireDir(dir);
	const up = await runGit(dir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
	const upstream = up.code === 0 ? up.stdout.trim() : "";
	if (upstream.length === 0) {
		return { ok: true, upstream: "", ahead: [], behind: [], aheadFiles: [], behindFiles: [], mergeBase: "" };
	}
	const fmt = ["%H", "%an", "%aI", "%s"].join("%x1f");
	// Each side is diffed against the MERGE BASE, not against the other side:
	// "what this chain changes" must not include the other side's work (a file
	// only the local chain added would otherwise look deleted on the remote side).
	const baseRes = await runGit(dir, ["merge-base", "HEAD", upstream]);
	const base = baseRes.stdout.trim();
	const from = base.length > 0 ? base : upstream;
	const [aheadRes, behindRes, aheadNum, aheadName, behindNum, behindName] = await Promise.all([
		runGit(dir, ["log", `--format=${fmt}`, "HEAD", "--not", upstream], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["log", `--format=${fmt}`, upstream, "--not", "HEAD"], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--numstat", from, "HEAD"], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--name-status", from, "HEAD"], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--numstat", from, upstream], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--name-status", from, upstream], { timeoutMs: SLOW_TIMEOUT_MS })
	]);
	return {
		ok: true,
		upstream,
		ahead: parseCommitLines(aheadRes.stdout),
		behind: parseCommitLines(behindRes.stdout),
		// Whole-chain changes: what a push would publish / what a pull would bring.
		aheadFiles: mergeNumstat(aheadNum.stdout, aheadName.stdout),
		behindFiles: mergeNumstat(behindNum.stdout, behindName.stdout),
		mergeBase: base.slice(0, 8)
	};
}

/**
 * Remote-tracking branches (`refs/remotes/*`), plus which local branch (if
 * any) tracks each one. The branch panel merges a local branch and its
 * upstream into ONE row when `trackedBy` matches, and lists the rest under the
 * remote group.
 */
export async function remoteBranches(dir) {
	requireDir(dir);
	const [remoteRes, localRes] = await Promise.all([
		// Full refnames: `%(refname:short)` resolves `refs/remotes/origin/HEAD`
		// to just `origin`, which then looks like a branch named after the remote.
		runGit(dir, ["for-each-ref", "--format=%(refname)%1f%(objectname)%1f%(committerdate:iso-strict)%1f%(subject)", "refs/remotes"]),
		runGit(dir, ["for-each-ref", "--format=%(refname:short)%1f%(upstream:short)", "refs/heads"])
	]);
	// upstream ref -> local branch that tracks it
	const trackedBy = new Map();
	for (const line of localRes.stdout.split("\n")) {
		if (line.trim().length === 0) continue;
		const [local, upstream] = line.split("\x1f");
		if (typeof local === "string" && local.length > 0 && typeof upstream === "string" && upstream.length > 0) trackedBy.set(upstream, local);
	}
	const branches = [];
	for (const line of remoteRes.stdout.split("\n")) {
		if (line.trim().length === 0) continue;
		const [full, hash, date, subject] = line.split("\x1f");
		if (typeof full !== "string" || !full.startsWith("refs/remotes/")) continue;
		const name = full.slice("refs/remotes/".length);
		// `origin/HEAD` is a symbolic alias, not a branch.
		if (name.length === 0 || name.endsWith("/HEAD")) continue;
		const slash = name.indexOf("/");
		branches.push({
			name,
			remote: slash > 0 ? name.slice(0, slash) : "origin",
			branch: slash > 0 ? name.slice(slash + 1) : name,
			hash: hash ?? "",
			short: (hash ?? "").slice(0, 8),
			date: date ?? "",
			subject: subject ?? "",
			trackedBy: trackedBy.get(name) ?? ""
		});
	}
	branches.sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date < b.date ? 1 : -1));
	return { branches };
}

// ---- remote operations (network; every call uses the slow timeout) ----

/** Parse an https / ssh GitHub remote URL into { host, owner, repo }. */
function parseRemoteUrl(url) {
	const text = String(url ?? "").trim();
	let host = "";
	let owner = "";
	let repo = "";
	const https = /^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(text);
	const ssh = /^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/.exec(text);
	const match = https ?? ssh;
	if (match !== null) {
		host = match[1];
		owner = match[2];
		repo = match[3];
	}
	return { host, owner, repo, github: host === "github.com" && owner.length > 0 && repo.length > 0 };
}

/**
 * The repo's push/fetch target: remote name, URL, and (for GitHub) owner/repo.
 * `github` is what the panel uses to decide whether "创建 PR" makes sense.
 */
export async function remoteInfo(dir) {
	requireDir(dir);
	const list = await runGit(dir, ["remote"]);
	const names = list.stdout.split("\n").map((item) => item.trim()).filter(Boolean);
	const name = names.includes("origin") ? "origin" : names[0] ?? "";
	if (name.length === 0) return { ok: true, name: "", url: "", host: "", owner: "", repo: "", github: false };
	const urlRes = await runGit(dir, ["remote", "get-url", name]);
	const url = urlRes.stdout.trim();
	return { ok: true, name, url, ...parseRemoteUrl(url) };
}

/**
 * Prefix that pins a git command to one GitHub account.
 *
 * GCM stores credentials per host and picks "the most recent one" when no
 * username is supplied, which becomes unpredictable once several accounts are
 * logged in. Passing it as `-c credential.username=` makes GCM match exactly
 * that user, and — unlike rewriting the remote URL — leaves the repository's
 * own config untouched.
 */
function credentialArgs(account) {
	const user = String(account ?? "").trim();
	return user.length > 0 ? ["-c", `credential.username=${user}`] : [];
}

/**
 * Attach a remote to a repository that has none (`git remote add`), or point an
 * existing one at a new URL. This is the "关联远程仓库" action.
 */
export async function addRemote(dir, url, name) {
	requireDir(dir);
	const target = String(url ?? "").trim();
	if (target.length === 0) return { ok: false, error: "缺少远程地址" };
	const remoteName = String(name ?? "").trim() || "origin";
	const existing = await runGit(dir, ["remote", "get-url", remoteName]);
	const res = existing.code === 0
		? await runGit(dir, ["remote", "set-url", remoteName, target])
		: await runGit(dir, ["remote", "add", remoteName, target]);
	if (res.code !== 0) {
		return { ok: false, error: res.stderr.trim() || `添加远程失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	return { ok: true, message: existing.code === 0 ? `已更新远程 ${remoteName}` : `已关联远程 ${remoteName}` };
}

/** Detach a remote (`git remote remove`). Local commits and history are untouched. */
export async function removeRemote(dir, name) {
	requireDir(dir);
	const remoteName = String(name ?? "").trim() || "origin";
	const res = await runGit(dir, ["remote", "remove", remoteName]);
	if (res.code !== 0) {
		return { ok: false, error: res.stderr.trim() || `取消关联失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	return { ok: true, message: `已取消关联 ${remoteName}` };
}

/** `git fetch --prune [remote]`: updates remote-tracking refs only. */
export async function fetchRemote(dir, remote, account) {
	requireDir(dir);
	const target = String(remote ?? "").trim();
	const args = [...credentialArgs(account), "fetch", "--prune"];
	if (target.length > 0) args.push(target);
	const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code !== 0) {
		return { ok: false, error: res.stderr.trim() || `fetch 失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	return { ok: true, message: "已更新远程状态" };
}

/** `git pull --no-rebase`: fetch + MERGE. Conflicts pause in the normal flow. */
export async function pullRemote(dir, remote, branch, account) {
	requireDir(dir);
	const target = String(remote ?? "").trim();
	const name = String(branch ?? "").trim();
	const args = [...credentialArgs(account), "pull", "--no-rebase"];
	if (target.length > 0) args.push(target);
	if (name.length > 0) args.push(name);
	const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code !== 0) {
		const conflict = await status(dir);
		const conflicts = conflictPaths(conflict.entries);
		return {
			ok: false,
			error: conflicts.length > 0 ? "拉取产生冲突" : (res.stderr.trim() || `pull 失败(exit ${res.code})`),
			errorCode: conflicts.length > 0 ? "conflict" : res.errorCode,
			conflicts
		};
	}
	const last = res.stdout.trim().split("\n").filter(Boolean).pop() ?? "";
	return { ok: true, message: last || "已拉取" };
}

/**
 * `git push [-u] [--force-with-lease] [remote] [branch]`.
 *
 * `setUpstream` is how an unlinked branch gets its upstream in the same step;
 * `force` is deliberately force-WITH-LEASE only (never --force).
 */
export async function pushRemote(dir, remote, branch, options = {}) {
	requireDir(dir);
	const target = String(remote ?? "").trim();
	const name = String(branch ?? "").trim();
	const args = [...credentialArgs(options.account), "push"];
	if (options.force === true) args.push("--force-with-lease");
	if (options.setUpstream === true) args.push("-u");
	if (target.length > 0) args.push(target);
	if (name.length > 0) args.push(name);
	const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code !== 0) {
		const text = res.stderr.trim();
		const rejected = /non-fast-forward|\[rejected\]|fetch first|updates were rejected/i.test(text);
		return {
			ok: false,
			error: rejected ? "远程有新提交，推送被拒绝（先拉取）" : (text || `push 失败(exit ${res.code})`),
			errorCode: rejected ? "non-fast-forward" : res.errorCode
		};
	}
	return { ok: true, message: "已推送" };
}

/**
 * Diff between two revisions, optionally narrowed to `paths`.
 *
 * This is what the panel's sync bubbles use for "the whole chain's change of
 * THIS file": `git diff <merge-base> <upstream|HEAD> -- <path>`. The plain
 * `diff()` helper can only compare one revision against the working tree.
 */
export async function rangeDiff(dir, from, to, paths) {
	requireDir(dir);
	const fromRef = String(from ?? "").trim();
	const toRef = String(to ?? "").trim();
	if (fromRef.length === 0 || toRef.length === 0) {
		return { ok: false, from: fromRef, to: toRef, files: [], patch: "", truncated: false, error: "缺少比较范围" };
	}
	const list = normalizePaths(paths);
	const pathArgs = list.length > 0 ? ["--", ...list] : [];
	const [numstat, nameStatus, patch] = await Promise.all([
		runGit(dir, ["diff", "--numstat", fromRef, toRef, ...pathArgs], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--name-status", fromRef, toRef, ...pathArgs], { timeoutMs: SLOW_TIMEOUT_MS }),
		runGit(dir, ["diff", "--no-color", fromRef, toRef, ...pathArgs], { maxOutput: MAX_OUTPUT, timeoutMs: SLOW_TIMEOUT_MS })
	]);
	const statusMap = parseNameStatus(nameStatus.stdout);
	const files = parseNumstat(numstat.stdout).map((file) => ({ ...file, status: statusMap.get(file.path) ?? "M" }));
	return { ok: true, from: fromRef, to: toRef, files, patch: patch.stdout, truncated: patch.capped === true };
}

/**
 * What multi-step operation is in progress (if any) plus its conflict state.
 * Merge state lives in `.git`: MERGE_HEAD for a normal merge, SQUASH_MSG for a
 * squash merge (which has no MERGE_HEAD), REVERT_HEAD / CHERRY_PICK_HEAD, and
 * the rebase-merge / rebase-apply directories.
 */
export async function repoOperation(dir) {
	requireDir(dir);
	const gitDir = await gitDirOf(dir);
	if (gitDir === null) return { operation: null, conflicts: [], resolved: [], total: 0, unresolved: 0 };
	const [mergeHead, cherryHead, revertHead, squashMsg, mergeMsg, currentRes, root] = await Promise.all([
		readTextOrNull(join(gitDir, "MERGE_HEAD")),
		readTextOrNull(join(gitDir, "CHERRY_PICK_HEAD")),
		readTextOrNull(join(gitDir, "REVERT_HEAD")),
		readTextOrNull(join(gitDir, "SQUASH_MSG")),
		readTextOrNull(join(gitDir, "MERGE_MSG")),
		runGit(dir, ["symbolic-ref", "--short", "-q", "HEAD"]),
		workTreeOf(dir)
	]);
	let kind = null;
	if (existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) kind = "rebase";
	else if (mergeHead !== null && mergeHead.trim().length > 0) kind = "merge";
	else if (cherryHead !== null && cherryHead.trim().length > 0) kind = "cherry-pick";
	else if (revertHead !== null && revertHead.trim().length > 0) kind = "revert";
	else if (squashMsg !== null) kind = "squash";
	if (kind === null) return { operation: null, conflicts: [], resolved: [], total: 0, unresolved: 0 };

	let target = currentRes.stdout.trim();
	// `git ls-files -u` lists every stage of a conflict, so the path set is
	// exactly what the user still has to resolve.
	const unmerged = await runGit(dir, ["ls-files", "-u", "-z"]);
	const conflictSet = new Set();
	if (unmerged.code === 0) {
		for (const part of unmerged.stdout.split("\0")) {
			const tab = part.indexOf("\t");
			if (tab >= 0) conflictSet.add(part.slice(tab + 1));
		}
	}
	const porcelain = await status(dir);
	const codeByPath = new Map();
	for (const entry of porcelain.entries) {
		if (CONFLICT_CODES.has(`${entry.x}${entry.y}`)) codeByPath.set(entry.path, `${entry.x}${entry.y}`);
	}
	const conflicts = [];
	for (const path of conflictSet) {
		const text = await readTextOrNull(join(root, path));
		conflicts.push({
			path,
			code: codeByPath.get(path) ?? "UU",
			blocks: text === null ? 0 : countConflictBlocks(text)
		});
	}
	conflicts.sort((a, b) => a.path.localeCompare(b.path));

	// Files already taken out of the conflict set: staged during this operation.
	const stagedRes = await runGit(dir, ["diff", "--cached", "--name-only", "-z"]);
	const resolved = [];
	if (stagedRes.code === 0) {
		for (const path of stagedRes.stdout.split("\0")) {
			const clean = path.trim();
			if (clean.length === 0 || conflictSet.has(clean)) continue;
			resolved.push({ path: clean });
		}
	}

	const head = kind === "merge" ? (mergeHead ?? "").trim().split("\n")[0]
		: kind === "cherry-pick" ? (cherryHead ?? "").trim()
			: kind === "revert" ? (revertHead ?? "").trim()
				: "";
	let source = "";
	if (kind === "rebase") {
		// rebase-merge/head-name = the branch being rebased, onto = the new base.
		const headName = await readTextOrNull(join(gitDir, "rebase-merge/head-name"));
		const onto = await readTextOrNull(join(gitDir, "rebase-merge/onto"));
		source = (headName ?? "").trim().replace(/^refs\/heads\//, "");
		target = (onto ?? "").trim().slice(0, 8);
	} else if (kind === "merge" && head.length > 0) {
		const named = await runGit(dir, ["for-each-ref", "--format=%(refname:short)%1f%(objectname)", "refs/heads"]);
		if (named.code === 0) {
			for (const line of named.stdout.split("\n")) {
				const [name, hash] = line.split("\x1f");
				if (hash !== undefined && hash.trim() === head) { source = name; break; }
			}
		}
		if (source.length === 0) source = head.slice(0, 8);
	}
	const message = (mergeMsg ?? squashMsg ?? "").split("\n").find((line) => line.trim().length > 0) ?? "";
	let startedAt = "";
	try {
		const info = await stat(join(gitDir, "MERGE_HEAD"));
		startedAt = info.mtime.toISOString();
	} catch (error) {
		startedAt = "";
	}
	const operation = { kind, source, target, message: message.trim().slice(0, 200), startedAt, head };
	if (kind === "rebase") {
		const progress = await rebaseProgress(dir);
		if (progress !== null) operation.progress = progress;
	}
	return {
		operation,
		conflicts,
		resolved,
		total: conflicts.length + resolved.length,
		unresolved: conflicts.length
	};
}

/**
 * One conflict file: the working-tree copy (with markers) plus the three index
 * stages (base / ours / theirs) so the UI can show what each side wanted.
 */
export async function conflictFile(dir, file) {
	requireDir(dir);
	const relativePath = requireRelativePath(file);
	const root = await workTreeOf(dir);
	const work = await readTextOrNull(join(root, relativePath));
	const [ours, theirs, base] = await Promise.all([
		runGit(dir, ["show", `:2:${relativePath}`]),
		runGit(dir, ["show", `:3:${relativePath}`]),
		runGit(dir, ["show", `:1:${relativePath}`])
	]);
	const pick = (res) => (res.code === 0 ? res.stdout : "");
	const content = work ?? "";
	const large = content.length > MAX_OUTPUT;
	return {
		file: relativePath,
		worktree: large ? content.slice(0, MAX_OUTPUT) : content,
		ours: pick(ours).slice(0, MAX_OUTPUT),
		theirs: pick(theirs).slice(0, MAX_OUTPUT),
		base: pick(base).slice(0, MAX_OUTPUT),
		binary: content.includes("\u0000"),
		truncated: large
	};
}

/**
 * Commits that still exist as objects but no ref reaches any more — what a
 * hard reset or a branch deletion leaves behind. Reflog is the only source of
 * "when/how it was lost".
 */
export async function orphanedCommits(dir, limit = 50) {
	requireDir(dir);
	const gitDir = await gitDirOf(dir);
	if (gitDir === null) return { ok: false, error: "不是 git 仓库", errorCode: "NO_REPO", commits: [] };
	const records = await reflogRecords(gitDir);
	const candidates = new Map();
	for (const record of records) {
		for (const hash of [record.oldHash, record.newHash]) {
			if (!/^[0-9a-f]{40}$/i.test(hash) || /^0{40}$/.test(hash)) continue;
			const previous = candidates.get(hash);
			if (previous === undefined || record.ts >= previous.ts) candidates.set(hash, record);
		}
	}
	const reachableRes = await runGit(dir, ["rev-list", "--all"], { timeoutMs: SLOW_TIMEOUT_MS });
	if (reachableRes.code !== 0 || reachableRes.capped) {
		return { ok: false, error: reachableRes.capped ? "仓库过大，无法判断可达性" : reachableRes.stderr.trim(), errorCode: reachableRes.errorCode, commits: [] };
	}
	const reachable = new Set(reachableRes.stdout.split("\n").filter(Boolean));
	const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
	const ordered = [...candidates.entries()].sort((a, b) => b[1].ts - a[1].ts);
	const commits = [];
	for (const [hash, record] of ordered) {
		if (commits.length >= max) break;
		if (reachable.has(hash)) continue;
		const shown = await runGit(dir, ["show", "-s", "--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI", hash]);
		if (shown.code !== 0) continue;
		const [full, short, subject, author, date] = shown.stdout.trim().split("\x1f");
		commits.push({
			hash: full,
			short,
			subject: subject ?? "",
			author: author ?? "",
			date: date ?? "",
			lostAt: record.ts > 0 ? new Date(record.ts * 1000).toISOString() : "",
			reason: record.message,
			ref: record.ref
		});
	}
	commits.sort((a, b) => (a.lostAt < b.lostAt ? 1 : -1));
	return { ok: true, commits };
}

/** Commits only `name` reaches: what becomes unreachable if that branch is deleted. */
export async function branchExclusiveCommits(dir, name) {
	requireDir(dir);
	if (typeof name !== "string" || name.trim().length === 0) throw new Error("分支名不能为空");
	const refs = await runGit(dir, ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes", "refs/tags"]);
	const others = refs.stdout.split("\n").map((item) => item.trim()).filter((item) => item.length > 0 && item !== `refs/heads/${name}`);
	const args = ["rev-list", name, ...(others.length > 0 ? ["--not", ...others] : [])];
	const res = await runGit(dir, args, { timeoutMs: SLOW_TIMEOUT_MS });
	if (res.code !== 0) return { ok: false, error: res.stderr.trim() || "无法计算独占提交", errorCode: res.errorCode, commits: [] };
	const commits = [];
	for (const hash of res.stdout.split("\n").filter(Boolean).slice(0, 100)) {
		const shown = await runGit(dir, ["show", "-s", "--format=%h%x1f%s", hash]);
		if (shown.code !== 0) continue;
		const [short, subject] = shown.stdout.trim().split("\x1f");
		commits.push({ hash, short, subject: subject ?? "" });
	}
	return { ok: true, commits };
}

/**
 * Finish an in-progress merge / squash / revert / cherry-pick.
 * A squash merge has no MERGE_HEAD, so "continue" is a plain commit that uses
 * SQUASH_MSG as the default message.
 */
export async function operationContinue(dir, kind) {
	requireDir(dir);
	// Refuse while any conflict file still contains markers: committing them
	// would bake the markers into the repo. The UI disables the button; this is
	// the host-side guard for direct calls.
	const current = await status(dir);
	for (const path of conflictPaths(current.entries)) {
		const file = await conflictFile(dir, path);
		if (file !== null && file !== void 0 && countConflictBlocks(String(file.worktree ?? "")) > 0) {
			return { ok: false, error: `还有文件包含冲突标记：${path}`, errorCode: "conflict-markers" };
		}
	}
	const env = { GIT_EDITOR: "true" };
	if (kind === "squash") {
		const res = await runGit(dir, ["commit", "--no-edit"], { timeoutMs: SLOW_TIMEOUT_MS, env });
		return res.code === 0
			? { ok: true, message: res.stdout.trim() || "已提交摘取结果" }
			: { ok: false, error: res.stderr.trim() || `提交失败(exit ${res.code})`, errorCode: res.errorCode };
	}
	if (["merge", "revert", "cherry-pick", "rebase"].includes(kind) === false) throw new Error(`不支持继续的操作: ${kind}`);
	const res = await runGit(dir, [kind, "--continue"], { timeoutMs: SLOW_TIMEOUT_MS, env });
	if (res.code === 0) return { ok: true, message: res.stdout.trim() || `${kind} 已完成` };
	const conflict = await status(dir);
	return {
		ok: false,
		error: res.stderr.trim() || `${kind} --continue 失败(exit ${res.code})`,
		errorCode: errorCodeOf(res.stderr, res.code, res.timedOut),
		conflicts: conflictPaths(conflict.entries)
	};
}

export { assertOk, normalizePaths };
