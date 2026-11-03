// GitHub authentication through Git Credential Manager (GCM).
//
// The panel never stores a token itself: GCM owns the credential (Windows
// Credential Manager, DPAPI-encrypted) and `git push` picks it up for free.
// Two entry points are offered, both real OAuth/token flows inside GCM:
//
//   * browser login — `github login --browser --no-ui`: GCM opens the system
//     browser on github.com's authorize page and waits on a loopback callback.
//     The device-code flow (`--device`) is NOT usable here: with `--no-ui` and
//     no tty GCM never prints the code, so the user would have nothing to type.
//   * token login — `github login --pat <token> --no-ui`: the panel collects a
//     Personal Access Token and hands it straight to GCM.
//
// The browser flow takes as long as the user needs, so it runs as a background
// child process: start → poll → (cancel). Everything else is one-shot.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** GCM's own ceiling for a login attempt before we kill the child. */
const LOGIN_TIMEOUT_MS = 180000;

/** Live browser-login sessions, keyed by an opaque id. */
const sessions = new Map();
let nextSessionId = 1;

/** Run `git credential-manager <args>` and collect its output. */
function runGcm(args, { timeoutMs = 30000 } = {}) {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn("git", ["credential-manager", ...args], {
				stdio: ["ignore", "pipe", "pipe"],
				windowsHide: true
			});
		} catch (error) {
			resolve({ code: -1, stdout: "", stderr: error instanceof Error ? error.message : String(error) });
			return;
		}
		let stdout = "";
		let stderr = "";
		let settled = false;
		const finish = (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({ code, stdout, stderr });
		};
		const timer = setTimeout(() => {
			try {
				child.kill();
			} catch (error) {
				// Already gone.
			}
			finish(-2);
		}, timeoutMs);
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) => {
			stderr += error instanceof Error ? error.message : String(error);
			finish(-1);
		});
		child.on("close", (code) => finish(code ?? -1));
	});
}

/** One account per line, as printed by `github list --no-ui`. */
function parseAccounts(text) {
	return String(text ?? "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !/^(info|warn|error|fail)\b/i.test(line))
		.map((name) => ({ name }));
}

/** Known GitHub accounts in GCM. */
export async function listAccounts() {
	const result = await runGcm(["github", "list", "--no-ui"]);
	if (result.code !== 0) {
		return { ok: false, accounts: [], error: firstLine(result.stderr) || `github list 退出码 ${result.code}` };
	}
	return { ok: true, accounts: parseAccounts(result.stdout) };
}

/** Trim GCM's verbose stderr down to the sentence worth showing. */
function firstLine(text) {
	const lines = String(text ?? "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !/^\d{2}:\d{2}:\d{2}/.test(line) && !/trace:|\[RunInternalAsync\]|\[CreateClient\]/.test(line));
	return lines[0] ?? "";
}

/**
 * Start a browser login. Resolves as soon as the child is up; the caller polls
 * `pollLogin(id)` until it reports done/failed.
 */
export async function startBrowserLogin() {
	const id = `gh-${nextSessionId++}`;
	let child;
	try {
		child = spawn("git", ["credential-manager", "github", "login", "--browser", "--no-ui"], {
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	const session = { child, startedAt: Date.now(), stdout: "", stderr: "", done: false, code: null };
	child.stdout?.on("data", (chunk) => {
		session.stdout += chunk.toString();
	});
	child.stderr?.on("data", (chunk) => {
		session.stderr += chunk.toString();
	});
	child.on("error", (error) => {
		session.stderr += error instanceof Error ? error.message : String(error);
		session.done = true;
		session.code = -1;
	});
	child.on("close", (code) => {
		session.done = true;
		session.code = code ?? -1;
	});
	sessions.set(id, session);
	// Give the child a moment: an immediate exit means it failed to even start
	// the browser (no GCM, broken install), which must not look like "waiting".
	await new Promise((resolve) => setTimeout(resolve, 1200));
	if (session.done && session.code !== 0) {
		sessions.delete(id);
		return { ok: false, error: firstLine(session.stderr) || "无法启动浏览器登录" };
	}
	return { ok: true, id, url: extractAuthorizeUrl(session.stderr) };
}

/** Pull the authorize URL out of GCM's trace-free stderr, when present. */
function extractAuthorizeUrl(text) {
	const match = String(text ?? "").match(/https:\/\/[^\s"']*login\/oauth\/authorize[^\s"']*/);
	return match === null ? void 0 : match[0];
}

/** Check a browser-login session. Never throws. */
export async function pollLogin(id) {
	const session = sessions.get(String(id ?? ""));
	if (session === void 0) return { ok: false, status: "unknown", error: "会话不存在或已过期" };
	if (!session.done) {
		if (Date.now() - session.startedAt > LOGIN_TIMEOUT_MS) {
			try {
				session.child.kill();
			} catch (error) {
				// Already gone.
			}
			sessions.delete(String(id));
			return { ok: true, status: "failed", error: "登录超时（3 分钟未完成授权）" };
		}
		return { ok: true, status: "pending" };
	}
	sessions.delete(String(id));
	if (session.code !== 0) {
		return { ok: true, status: "failed", error: firstLine(session.stderr) || `登录退出码 ${session.code}` };
	}
	const listed = await listAccounts();
	return { ok: true, status: "done", accounts: listed.accounts };
}

/** Abort a pending browser login. */
export async function cancelLogin(id) {
	const session = sessions.get(String(id ?? ""));
	if (session === void 0) return { ok: true, cancelled: false };
	try {
		session.child.kill();
	} catch (error) {
		// Already gone.
	}
	sessions.delete(String(id));
	return { ok: true, cancelled: true };
}

/**
 * Log in with a Personal Access Token. The token travels on the command line
 * (`--pat`), which GCM requires; it is never written by this plugin.
 */
export async function loginWithToken(token) {
	const value = String(token ?? "").trim();
	if (value.length === 0) return { ok: false, error: "Token 不能为空" };
	const result = await runGcm(["github", "login", "--pat", value, "--no-ui"], { timeoutMs: 60000 });
	if (result.code !== 0) {
		return { ok: false, error: firstLine(result.stderr) || `登录失败（退出码 ${result.code}）` };
	}
	const listed = await listAccounts();
	return { ok: true, accounts: listed.accounts };
}

/** Remove one account from GCM (and therefore from Windows Credential Manager). */
export async function logout(account) {
	const name = String(account ?? "").trim();
	if (name.length === 0) return { ok: false, error: "缺少账号名" };
	const result = await runGcm(["github", "logout", name, "--no-ui"], { timeoutMs: 60000 });
	if (result.code !== 0) {
		return { ok: false, error: firstLine(result.stderr) || `登出失败（退出码 ${result.code}）` };
	}
	return { ok: true, accounts: (await listAccounts()).accounts };
}

// ---- API access (permission probing, account info, repository creation) ----

/**
 * Read the token GCM would use for `account`.
 *
 * Passing `username=` makes GCM match that account exactly instead of picking
 * whichever credential it considers most recent.
 */
export function getToken(account) {
	return new Promise((resolve) => {
		let out = "";
		let child;
		try {
			child = spawn("git", ["credential", "fill"], { stdio: ["pipe", "pipe", "pipe"] });
		} catch (error) {
			resolve("");
			return;
		}
		child.stdout.on("data", (chunk) => { out += chunk.toString(); });
		child.on("error", () => resolve(""));
		child.on("close", () => {
			const match = out.match(/^password=(.*)$/m);
			resolve(match === null ? "" : match[1].trim());
		});
		const user = String(account ?? "").trim();
		child.stdin.write(`protocol=https\nhost=github.com\n${user.length > 0 ? `username=${user}\n` : ""}\n`);
		child.stdin.end();
	});
}

/**
 * Run one GitHub API request in a child process.
 *
 * The host process cannot start with `--use-system-ca`, and api.github.com needs
 * the system CA store here (plain fetch fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE).
 * A child process can be given that flag without affecting the harness.
 */
function apiViaChild(payload) {
	return new Promise((resolve) => {
		let script;
		try {
			script = fileURLToPath(new URL("./github-api-child.mjs", import.meta.url));
		} catch (error) {
			resolve({ ok: false, status: 0, reason: "child", error: "script path", json: null });
			return;
		}
		let child;
		try {
			child = spawn(process.execPath, ["--use-system-ca", "--no-warnings", script], {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
			});
		} catch (error) {
			resolve({ ok: false, status: 0, reason: "spawn", error: String(error?.message ?? error), json: null });
			return;
		}
		let out = "";
		let err = "";
		child.stdout.on("data", (chunk) => { out += chunk.toString(); });
		child.stderr.on("data", (chunk) => { err += chunk.toString(); });
		child.on("error", (error) => {
			resolve({ ok: false, status: 0, reason: "spawn", error: String(error?.message ?? error), json: null });
		});
		child.on("close", () => {
			try {
				resolve(JSON.parse(out));
			} catch (error) {
				resolve({ ok: false, status: 0, reason: "child", error: (err || out).slice(0, 300), json: null });
			}
		});
		child.stdin.end(JSON.stringify(payload));
	});
}

/** One GitHub REST call with the given account's token. */
async function githubApi(account, path, init) {
	const token = await getToken(account);
	if (token.length === 0) return { ok: false, status: 0, reason: "no-token", json: null };
	return apiViaChild({
		url: `https://api.github.com${path}`,
		token,
		method: init?.method ?? "GET",
		body: init?.body,
		headers: init?.headers
	});
}

/** `GET /user`: who this token belongs to, plus the avatar URL. */
export async function githubUser(account) {
	const res = await githubApi(account, "/user");
	if (!res.ok) return { ok: false, login: "", avatarUrl: "", reason: res.reason ?? "http", status: res.status };
	return {
		ok: true,
		login: typeof res.json?.login === "string" ? res.json.login : "",
		avatarUrl: typeof res.json?.avatar_url === "string" ? res.json.avatar_url : "",
		reason: "",
		status: res.status
	};
}

/**
 * Can this account push to `owner/repo`?
 *
 * A 404 means GitHub refuses to reveal the repository (private + no access), so
 * it is reported as "no permission" rather than as an error.
 */
export async function repoPermission(account, owner, repo) {
	const ownerText = String(owner ?? "").trim();
	const repoText = String(repo ?? "").trim();
	if (ownerText.length === 0 || repoText.length === 0) {
		return { ok: false, canPush: null, canPull: null, status: 0, reason: "no-repo" };
	}
	const res = await githubApi(account, `/repos/${ownerText}/${repoText}`);
	if (res.status === 404) return { ok: true, canPush: false, canPull: false, status: 404, reason: "not-found" };
	if (!res.ok) return { ok: false, canPush: null, canPull: null, status: res.status, reason: res.reason ?? "http" };
	const perms = res.json?.permissions ?? {};
	return { ok: true, canPush: perms.push === true, canPull: perms.pull === true, status: res.status, reason: "" };
}

/**
 * Create an empty repository under `account`.
 *
 * `auto_init` is deliberately false: an initial commit on the remote would
 * diverge from the local history and make the first push impossible.
 */
export async function createRepo(account, options) {
	const name = String(options?.name ?? "").trim();
	if (name.length === 0) return { ok: false, error: "缺少仓库名" };
	const res = await githubApi(account, "/user/repos", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name,
			description: String(options?.description ?? ""),
			private: options?.private === true,
			auto_init: false
		})
	});
	if (!res.ok) {
		return { ok: false, error: res.json?.message ?? `创建失败(HTTP ${res.status})`, errorCode: res.reason ?? "http" };
	}
	return {
		ok: true,
		owner: typeof res.json?.owner?.login === "string" ? res.json.owner.login : "",
		fullName: typeof res.json?.full_name === "string" ? res.json.full_name : "",
		cloneUrl: typeof res.json?.clone_url === "string" ? res.json.clone_url : ""
	};
}

/**
 * Pull requests that involve this branch (`head=owner:branch`).
 *
 * `state=all` on purpose: a merged or closed PR for the same branch is still
 * worth surfacing, otherwise the panel would offer "create a PR" again for a
 * branch that already has one.
 */
export async function listPullRequests(account, owner, repo, branch) {
	const ownerText = String(owner ?? "").trim();
	const repoText = String(repo ?? "").trim();
	const branchText = String(branch ?? "").trim();
	if (ownerText.length === 0 || repoText.length === 0) {
		return { ok: false, prs: [], reason: "no-repo", status: 0 };
	}
	const query = branchText.length > 0
		? `?head=${encodeURIComponent(`${ownerText}:${branchText}`)}&state=all&per_page=10`
		: "?state=all&per_page=10";
	const res = await githubApi(account, `/repos/${ownerText}/${repoText}/pulls${query}`);
	if (!res.ok) {
		return { ok: false, prs: [], reason: res.reason ?? "http", status: res.status };
	}
	const list = Array.isArray(res.json) ? res.json : [];
	return {
		ok: true,
		prs: list.map((pr) => ({
			number: Number(pr.number) || 0,
			title: String(pr.title ?? ""),
			state: String(pr.state ?? ""),
			// GitHub reports merged PRs as state="closed"; only merged_at tells them apart.
			merged: pr.merged_at !== null && pr.merged_at !== void 0,
			draft: pr.draft === true,
			url: String(pr.html_url ?? ""),
			base: String(pr.base?.ref ?? ""),
			author: String(pr.user?.login ?? ""),
			createdAt: String(pr.created_at ?? ""),
			updatedAt: String(pr.updated_at ?? ""),
			mergedAt: String(pr.merged_at ?? ""),
			// Present only for merged PRs; drives the "jump to merge commit" action.
			mergeCommit: String(pr.merge_commit_sha ?? "")
		})),
		reason: "",
		status: res.status
	};
}

/**
 * Repository identity + fork lineage.
 *
 * `parent` is the repo this one was forked from; `source` is the root of the
 * fork chain. Both are null for a normal repository.
 */
export async function repoInfo(account, owner, repo) {
	const ownerText = String(owner ?? "").trim();
	const repoText = String(repo ?? "").trim();
	if (ownerText.length === 0 || repoText.length === 0) {
		return { ok: false, isFork: false, parent: null, source: null, reason: "no-repo", status: 0 };
	}
	const res = await githubApi(account, `/repos/${ownerText}/${repoText}`);
	if (!res.ok) {
		return { ok: false, isFork: false, parent: null, source: null, reason: res.reason ?? "http", status: res.status };
	}
	const json = res.json ?? {};
	const shape = (value) => value === null || value === undefined ? null : {
		owner: String(value.owner?.login ?? ""),
		repo: String(value.name ?? ""),
		defaultBranch: String(value.default_branch ?? "")
	};
	return {
		ok: true,
		isFork: json.fork === true,
		parent: shape(json.parent),
		source: shape(json.source),
		reason: "",
		status: res.status
	};
}

/**
 * The three kinds of pull request that matter for the current branch:
 *
 *   outgoing — this branch (in this repo) opens a PR against ANOTHER repo
 *   internal — this branch opens a PR against another branch of THIS repo
 *   incoming — another fork opens a PR against THIS branch of this repo
 */
export async function listAllPullRequests(account, owner, repo, branch) {
	const ownerText = String(owner ?? "").trim();
	const repoText = String(repo ?? "").trim();
	const branchText = String(branch ?? "").trim();
	if (ownerText.length === 0 || repoText.length === 0) {
		return { ok: false, outgoing: [], internal: [], incoming: [], reason: "no-repo", status: 0 };
	}
	const shape = (pr) => ({
		number: Number(pr.number) || 0,
		title: String(pr.title ?? ""),
		state: String(pr.state ?? ""),
		merged: pr.merged_at !== null && pr.merged_at !== void 0,
		draft: pr.draft === true,
		url: String(pr.html_url ?? ""),
		base: String(pr.base?.ref ?? ""),
		baseOwner: String(pr.base?.repo?.owner?.login ?? ""),
		baseRepo: String(pr.base?.repo?.name ?? ""),
		head: String(pr.head?.ref ?? ""),
		headOwner: String(pr.head?.user?.login ?? pr.head?.repo?.owner?.login ?? ""),
		author: String(pr.user?.login ?? ""),
		createdAt: String(pr.created_at ?? ""),
		updatedAt: String(pr.updated_at ?? ""),
		mergedAt: String(pr.merged_at ?? ""),
		mergeCommit: String(pr.merge_commit_sha ?? "")
	});

	const headQuery = branchText.length > 0 ? `&head=${encodeURIComponent(`${ownerText}:${branchText}`)}` : "";
	const baseQuery = branchText.length > 0 ? `&base=${encodeURIComponent(branchText)}` : "";

	const [internalRes, incomingRes, infoRes] = await Promise.all([
		githubApi(account, `/repos/${ownerText}/${repoText}/pulls?state=all&per_page=10${headQuery}`),
		githubApi(account, `/repos/${ownerText}/${repoText}/pulls?state=all&per_page=10${baseQuery}`),
		githubApi(account, `/repos/${ownerText}/${repoText}`)
	]);
	const info = infoRes.ok ? infoRes.json ?? {} : {};
	const parentOwner = String(info.parent?.owner?.login ?? "");
	const parentRepo = String(info.parent?.name ?? "");

	// Outgoing lives in the PARENT repository (head is this fork's branch).
	let outgoing = [];
	if (parentOwner.length > 0 && parentRepo.length > 0 && branchText.length > 0) {
		const res = await githubApi(account, `/repos/${parentOwner}/${parentRepo}/pulls?state=all&per_page=10&head=${encodeURIComponent(`${ownerText}:${branchText}`)}`);
		if (res.ok && Array.isArray(res.json)) outgoing = res.json.map(shape);
	}

	const internalList = internalRes.ok && Array.isArray(internalRes.json) ? internalRes.json.map(shape) : [];
	const incomingList = incomingRes.ok && Array.isArray(incomingRes.json) ? incomingRes.json.map(shape) : [];

	// Internal covers BOTH directions inside this repo:
	//   "out" — this branch opens a PR against another branch here
	//   "in"  — another branch here opens a PR against this branch
	const internalOut = internalList
		.filter((pr) => pr.headOwner === ownerText || pr.headOwner.length === 0)
		.map((pr) => ({ ...pr, direction: "out" }));
	const internalIn = incomingList
		.filter((pr) => pr.headOwner === ownerText)
		.map((pr) => ({ ...pr, direction: "in" }));
	const seenKeys = new Set();
	const internal = [];
	for (const pr of [...internalOut, ...internalIn]) {
		const key = String(pr.number);
		if (seenKeys.has(key)) continue;
		seenKeys.add(key);
		internal.push(pr);
	}

	return {
		ok: true,
		outgoing,
		internal,
		incoming: incomingList.filter((pr) => pr.headOwner.length > 0 && pr.headOwner !== ownerText),
		reason: "",
		status: 200
	};
}

/**
 * Open a pull request. `head` must be "owner:branch" for cross-repo PRs; GitHub
 * looks for the branch inside the target repository otherwise.
 */
export async function createPullRequest(account, targetOwner, targetRepo, options) {
	const ownerText = String(targetOwner ?? "").trim();
	const repoText = String(targetRepo ?? "").trim();
	if (ownerText.length === 0 || repoText.length === 0) {
		return { ok: false, number: 0, url: "", reason: "no-repo", status: 0 };
	}
	const payload = {
		title: String(options?.title ?? "").trim(),
		body: String(options?.body ?? ""),
		head: String(options?.head ?? "").trim(),
		base: String(options?.base ?? "").trim()
	};
	if (payload.title.length === 0 || payload.head.length === 0 || payload.base.length === 0) {
		return { ok: false, number: 0, url: "", reason: "bad-request", status: 0 };
	}
	const res = await githubApi(account, `/repos/${ownerText}/${repoText}/pulls`, {
		method: "POST",
		body: JSON.stringify(payload)
	});
	if (!res.ok) {
		return {
			ok: false,
			number: 0,
			url: "",
			reason: typeof res.json?.message === "string" ? res.json.message : (res.reason ?? "http"),
			status: res.status
		};
	}
	return {
		ok: true,
		number: Number(res.json?.number) || 0,
		url: String(res.json?.html_url ?? ""),
		reason: "",
		status: res.status
	};
}

/** Kill every pending session (plugin unload). */
export function disposeAll() {
	for (const [id, session] of sessions) {
		try {
			session.child.kill();
		} catch (error) {
			// Already gone.
		}
		sessions.delete(id);
	}
}
