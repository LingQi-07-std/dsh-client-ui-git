// @dsh-external/dsh-client-ui-git — host half
// GitGateway: read-only queries + the write set, exposed to the browser as the
// `git` Remote service (typert). All git logic lives in ./git-core.mjs so the
// git MCP server can mirror it. See ./typert.host.js for the strict invocation
// surface auto-registered by @deepseek-ai/dsh-typert-loader.
import Schema from "@deepseek-ai/schemastery";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import * as git from "./git-core.mjs";
import * as githubAuth from "./github-auth.mjs";
import { readState, writeState } from "./state.mjs";

/**
 * Plugin configuration (settings panel).
 *
 * The namespace is the Loader row id (`ui-git`), so these values land in the
 * profile's `cordis.patch.yml` under `- id: ui-git`. They are the panel's
 * "reset to default" reference; the panel additionally mirrors every change
 * into the plugin-local store (see `pluginSettingsUpdate`) because a row patch
 * write is not guaranteed to be visible to an already-running host half.
 */
export const Config = Schema.object({
	/** Commit author used when the repo/user git config has no identity. */
	userName: Schema.string().default(""),
	userEmail: Schema.string().default(""),
	/** Opt-in: keep reflog rows past their expiry in the plugin-local store. */
	reflogBackup: Schema.boolean().default(false),
	/** Show this plugin's own page inside DSH's Settings dialog. */
	showDshSettings: Schema.boolean().default(false),
	/** Where the panel's dialogs open: inside the drawer, or centred on screen. */
	modalAnchor: Schema.union(["panel", "screen"]).default("panel"),
	/** Bottom diagnostics strip (workspace resolution + call counters). */
	devMode: Schema.boolean().default(false),
	/** Allow the panel to create a GitHub repository and link it in one step. */
	allowCreateRepo: Schema.boolean().default(false),
	/** Show the "this repo has no remote" hint bubble above the workspace. */
	promptRemoteLink: Schema.boolean().default(true),
	/** Title shown once a remote is linked (empty = use the repository name). */
	remoteTitle: Schema.string().default(""),
	/** How long a background fetch may take before it counts as failed (ms). */
	fetchTimeoutMs: Schema.number().default(5000),
	/** GitHub account used for every remote operation (empty = GCM default). */
	activeAccount: Schema.string().default(""),
	/** How long a permission probe result stays valid (ms, default 5 minutes). */
	permissionCacheMs: Schema.number().default(300000),
	/** Show the PR list in the "more" menu instead of above the working tree. */
	prInMoreMenu: Schema.boolean().default(false),
	/** MCP: expose the dangerous tools (reset / restore / force push). */
	allowDangerousTools: Schema.boolean().default(false),
	/** MCP-only commit identity (separate from the panel's identity). */
	mcpUserName: Schema.string().default(""),
	mcpUserEmail: Schema.string().default(""),
	/** GCM account the MCP server pins for push/pull/fetch (empty = GCM default). */
	mcpAccount: Schema.string().default(""),
	/** Modifier that turns "hover an element" into "add it to the chat box". */
	chatElementKey: Schema.union(["alt", "ctrl", "shift"]).default("alt"),
	/** Show the yellow "current branch is hidden" bubble above the timeline. */
	syncHiddenHint: Schema.boolean().default(true)
});

/** Store key holding the panel-written settings (overrides the Config row). */
const SETTINGS_KEY = "settings";
/** Values used when neither the row config nor the store supplies one. */
const SETTINGS_DEFAULTS = {
	userName: "",
	userEmail: "",
	reflogBackup: false,
	showDshSettings: false,
	modalAnchor: "panel",
	devMode: false,
	allowCreateRepo: false,
	promptRemoteLink: true,
	remoteTitle: "",
	fetchTimeoutMs: 5000,
	activeAccount: "",
	permissionCacheMs: 300000,
	prInMoreMenu: false,
	allowDangerousTools: false,
	mcpUserName: "",
	mcpUserEmail: "",
	mcpAccount: "",
	chatElementKey: "alt",
	syncHiddenHint: true
};

/** Coerce any stored value into the settings shape (never throws). */
function normalizeSettings(raw) {
	const source = raw !== null && typeof raw === "object" ? raw : {};
	const text = (value, fallback) => (typeof value === "string" ? value : fallback);
	return {
		userName: text(source.userName, SETTINGS_DEFAULTS.userName),
		userEmail: text(source.userEmail, SETTINGS_DEFAULTS.userEmail),
		reflogBackup: source.reflogBackup === true,
		showDshSettings: source.showDshSettings === true,
		modalAnchor: source.modalAnchor === "screen" ? "screen" : "panel",
		devMode: source.devMode === true,
		allowCreateRepo: source.allowCreateRepo === true,
		promptRemoteLink: source.promptRemoteLink !== false,
		remoteTitle: text(source.remoteTitle, SETTINGS_DEFAULTS.remoteTitle),
		fetchTimeoutMs: (() => {
			const raw = Number(source.fetchTimeoutMs);
			if (!Number.isFinite(raw)) return SETTINGS_DEFAULTS.fetchTimeoutMs;
			return Math.min(60000, Math.max(1000, Math.round(raw)));
		})(),
		activeAccount: text(source.activeAccount, SETTINGS_DEFAULTS.activeAccount),
		permissionCacheMs: (() => {
			const raw = Number(source.permissionCacheMs);
			if (!Number.isFinite(raw)) return SETTINGS_DEFAULTS.permissionCacheMs;
			return Math.min(3600000, Math.max(10000, Math.round(raw)));
		})(),
		prInMoreMenu: source.prInMoreMenu === true,
		allowDangerousTools: source.allowDangerousTools === true,
		mcpUserName: text(source.mcpUserName, SETTINGS_DEFAULTS.mcpUserName),
		mcpUserEmail: text(source.mcpUserEmail, SETTINGS_DEFAULTS.mcpUserEmail),
		mcpAccount: text(source.mcpAccount, SETTINGS_DEFAULTS.mcpAccount),
		chatElementKey: source.chatElementKey === "ctrl" ? "ctrl" : source.chatElementKey === "shift" ? "shift" : "alt",
		syncHiddenHint: source.syncHiddenHint !== false
	};
}

/** Read the panel-written overrides; {} when nothing was ever saved. */
async function readSettingsOverrides() {
	try {
		const parsed = JSON.parse(String(await readState(SETTINGS_KEY)));
		return parsed !== null && typeof parsed === "object" ? parsed : {};
	} catch (error) {
		return {};
	}
}

/**
 * Mirror the MCP-relevant switches into `$DSH_HOME/mcp-git/config.json`.
 * The MCP server is a separate process and reads this file at startup, so a
 * change here takes effect the next time that server launches.
 */
function syncMcpConfig(settings) {
	const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
	const dir = join(home, "mcp-git");
	const file = join(dir, "config.json");
	let config = {};
	try {
		const parsed = JSON.parse(readFileSync(file, "utf8"));
		if (parsed !== null && typeof parsed === "object") config = parsed;
	} catch (error) {
		// Missing or unreadable: start from an empty object.
	}
	config.allowDangerousTools = settings.allowDangerousTools === true;
	config.allowCreateRepo = settings.allowCreateRepo === true;
	config.mcpUserName = typeof settings.mcpUserName === "string" ? settings.mcpUserName : "";
	config.mcpUserEmail = typeof settings.mcpUserEmail === "string" ? settings.mcpUserEmail : "";
	config.mcpAccount = typeof settings.mcpAccount === "string" ? settings.mcpAccount : "";
	try {
		mkdirSync(dir, { recursive: true });
		writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
	} catch (error) {
		// Best effort: the MCP server falls back to safe defaults without the file.
	}
}

/**
 * Effective settings: built-in defaults, then the Loader row config, then the
 * panel-written store (which is what the panel itself edits).
 */
function resolveSettings(rowConfig, overrides) {
	const row = normalizeSettings(rowConfig ?? {});
	const merged = normalizeSettings({ ...row, ...overrides });
	return merged;
}

/** Read a persisted array; returns [] for missing / malformed values. */
async function stateList(key) {
	try {
		const parsed = JSON.parse(String(await readState(key)));
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		return [];
	}
}
/** Identity used to de-duplicate reflog rows across snapshots. */
const reflogId = (event) => `${event?.ref ?? ""}|${event?.newHash ?? ""}|${event?.message ?? ""}|${event?.date ?? ""}`;

/**
 * Read/write git projection gateway. Plain methods; the strict manifest names
 * them. All take `{ path, ... }` and resolve against the repo containing dir.
 */
class GitGateway extends TypertRemoteService {
	static inject = [];

	constructor(ctx, config) {
		super(ctx, "git");
		// Loader row config (`- id: ui-git` in the profile patch). cordis passes
		// the validated config to a class plugin's constructor, so this is the
		// host half's own view of the settings schema above.
		this.config = config !== null && typeof config === "object" ? config : {};
	}

	// ---- settings (plugin page + DSH settings section) ----
	/** Effective settings: defaults <- row config <- panel-written store. */
	async pluginSettings() {
		return resolveSettings(this.config, await readSettingsOverrides());
	}
	/**
	 * Probe a runtime dependency on demand (only after something already failed):
	 * `git` when a git command errored, `gcm` when no account is signed in.
	 */
	async checkDependency(request) {
		const target = request?.target === "gcm" ? "gcm" : "git";
		const args = target === "git" ? ["--version"] : ["credential-manager", "--version"];
		const result = await new Promise((resolve) => {
			let child;
			try {
				child = spawn("git", args, { stdio: ["ignore", "ignore", "ignore"], windowsHide: true });
			} catch (error) {
				resolve({ available: false, error: error instanceof Error ? error.message : String(error) });
				return;
			}
			let settled = false;
			const finish = (value) => {
				if (settled === true) return;
				settled = true;
				resolve(value);
			};
			child.on("error", (error) => finish({ available: false, error: error instanceof Error ? error.message : String(error) }));
			child.on("close", (code) => finish({ available: code === 0 }));
		});
		return { ok: true, target, available: result.available === true, ...(result.error !== void 0 ? { error: result.error } : null) };
	}
	/**
	 * Write the panel's edits. Only the fields actually sent are touched, so a
	 * page that owns one control cannot clobber another page's values.
	 */
	async pluginSettingsUpdate(request) {
		const current = await readSettingsOverrides();
		const next = { ...current };
		const assignText = (key) => {
			if (typeof request?.[key] === "string") next[key] = request[key];
		};
		assignText("userName");
		assignText("userEmail");
		if (typeof request?.reflogBackup === "boolean") next.reflogBackup = request.reflogBackup;
		if (typeof request?.showDshSettings === "boolean") next.showDshSettings = request.showDshSettings;
		if (request?.modalAnchor === "panel" || request?.modalAnchor === "screen") next.modalAnchor = request.modalAnchor;
		if (typeof request?.devMode === "boolean") next.devMode = request.devMode;
		// Remote-related settings: without these the switches rendered but the write
		// was silently dropped, so the UI snapped back on the next read.
		if (typeof request?.allowCreateRepo === "boolean") next.allowCreateRepo = request.allowCreateRepo;
		if (typeof request?.promptRemoteLink === "boolean") next.promptRemoteLink = request.promptRemoteLink;
		assignText("remoteTitle");
		if (typeof request?.fetchTimeoutMs === "number") next.fetchTimeoutMs = request.fetchTimeoutMs;
		assignText("activeAccount");
		if (typeof request?.permissionCacheMs === "number") next.permissionCacheMs = request.permissionCacheMs;
		if (typeof request?.prInMoreMenu === "boolean") next.prInMoreMenu = request.prInMoreMenu;
		// MCP surface: dangerous tools (reset/restore/force push) are opt-in, and the
		// create-repo tool follows the panel's own allowCreateRepo switch.
		if (typeof request?.allowDangerousTools === "boolean") next.allowDangerousTools = request.allowDangerousTools;
		// MCP-only commit identity: separate from the panel's own commit identity.
		assignText("mcpUserName");
		assignText("mcpUserEmail");
		assignText("mcpAccount");
		if (request?.chatElementKey === "alt" || request?.chatElementKey === "ctrl" || request?.chatElementKey === "shift") next.chatElementKey = request.chatElementKey;
		if (typeof request?.syncHiddenHint === "boolean") next.syncHiddenHint = request.syncHiddenHint;
		await writeState(SETTINGS_KEY, JSON.stringify(next));
		// Mirror the MCP-relevant switches into the MCP server's own config file; the
		// server reads it at startup (next launch picks the change up).
		if (typeof request?.allowDangerousTools === "boolean" || typeof request?.allowCreateRepo === "boolean" || typeof request?.mcpUserName === "string" || typeof request?.mcpUserEmail === "string" || typeof request?.mcpAccount === "string") {
			syncMcpConfig(next);
		}
		return resolveSettings(this.config, next);
	}

	// ---- GitHub authentication (delegated to Git Credential Manager) ----
	// This plugin never stores a token: GCM owns the credential in the Windows
	// Credential Manager, and `git push` picks it up automatically.
	/** Known GitHub accounts in GCM. */
	async githubAccounts() {
		return githubAuth.listAccounts();
	}
	/** Who this account's token belongs to (used for the avatar + name). */
	async githubUser(request) {
		return githubAuth.githubUser(request?.account);
	}
	/** Can this account push to owner/repo? (drives the disabled state + hint) */
	async repoPermission(request) {
		return githubAuth.repoPermission(request?.account, request?.owner, request?.repo);
	}
	/** Create an empty repository under this account (auto_init stays false). */
	async createRepo(request) {
		return githubAuth.createRepo(request?.account, request?.options ?? {});
	}
	/** Pull requests whose head is this branch (any state). */
	async listPullRequests(request) {
		return githubAuth.listPullRequests(request?.account, request?.owner, request?.repo, request?.branch);
	}
	/** Fork lineage of the repository (parent/source). */
	async repoInfo(request) {
		return githubAuth.repoInfo(request?.account, request?.owner, request?.repo);
	}
	/** Outgoing / internal / incoming PRs for the current branch. */
	async listAllPullRequests(request) {
		return githubAuth.listAllPullRequests(request?.account, request?.owner, request?.repo, request?.branch);
	}
	/** Open a pull request (supports cross-repo via "owner:branch"). */
	async createPullRequest(request) {
		return githubAuth.createPullRequest(request?.account, request?.owner, request?.repo, request?.options ?? {});
	}
	/** Begin a browser OAuth login; poll with `githubLoginPoll`. */
	async githubLoginStart() {
		return githubAuth.startBrowserLogin();
	}
	async githubLoginPoll(request) {
		return githubAuth.pollLogin(request?.id);
	}
	async githubLoginCancel(request) {
		return githubAuth.cancelLogin(request?.id);
	}
	/** Log in with a Personal Access Token (handed straight to GCM). */
	async githubLoginToken(request) {
		return githubAuth.loginWithToken(request?.token);
	}
	/** Remove one account from GCM. */
	async githubLogout(request) {
		return githubAuth.logout(request?.account);
	}

	// ---- read ----
	async snapshot(request) {
		return git.snapshot(git.requireDir(request?.path));
	}
	async log(request) {
		return git.log(git.requireDir(request?.path), request?.limit);
	}
	async status(request) {
		return git.status(git.requireDir(request?.path));
	}
	async diff(request) {
		// Forward the optional narrowing: the panel asks for ONE file's patch
		// when a commit file is opened, and for `stat: true` when listing files.
		// `base: "HEAD"` gives a working-tree file's full change (both staged and
		// unstaged), which is what the file-preview popup needs.
		return git.diff(git.requireDir(request?.path), request?.commit, {
			paths: Array.isArray(request?.paths) ? request.paths : [],
			stat: request?.stat === true,
			base: typeof request?.base === "string" && request.base.length > 0 ? request.base : void 0
		});
	}
	async branch(request) {
		return git.branch(git.requireDir(request?.path));
	}
	async branchDetails(request) {
		return git.branchDetails(git.requireDir(request?.path));
	}
	/** Pending push/pull commits for the current branch + whole-chain file changes. */
	async syncCommits(request) {
		return git.syncCommits(git.requireDir(request?.path));
	}
	/** Remote-tracking branches and which local branch tracks each. */
	async remoteBranches(request) {
		return git.remoteBranches(git.requireDir(request?.path));
	}
	/** Per-branch pending-pull chains (kept visible by the timeline filter). */
	async branchSyncs(request) {
		return git.branchSyncs(git.requireDir(request?.path));
	}
	/** Link a local branch to an existing remote-tracking branch. */
	async linkUpstream(request) {
		return git.linkUpstream(git.requireDir(request?.path), request?.branch, request?.upstream);
	}
	// ---- remote operations (network) ----
	/** Remote name/URL and, for GitHub, owner/repo (drives the PR button). */
	async remoteInfo(request) {
		return git.remoteInfo(git.requireDir(request?.path));
	}
	/**
	 * Pin the credential account for a network call: an explicit account wins,
	 * then the panel's configured account, then the repo-local credential pin.
	 * Without a pin GCM opens its multi-user picker, which blocks the panel (and
	 * is exactly what the automated refresh used to trigger).
	 */
	async resolveAccount(dir, account) {
		const given = typeof account === "string" ? account.trim() : "";
		if (given.length > 0) return given;
		try {
			const settings = resolveSettings(this.config, await readSettingsOverrides());
			const configured = typeof settings.activeAccount === "string" ? settings.activeAccount.trim() : "";
			if (configured.length > 0) return configured;
		} catch (error) {
			// Settings are best effort here.
		}
		try {
			const repo = await git.repoConfig(dir);
			const pinned = typeof repo?.credentialUser === "string" ? repo.credentialUser.trim() : "";
			if (pinned.length > 0) return pinned;
		} catch (error) {
			// An unreadable local config just means "no pin".
		}
		return undefined;
	}
	async fetchRemote(request) {
		const dir = git.requireDir(request?.path);
		return git.fetchRemote(dir, request?.remote, await this.resolveAccount(dir, request?.account));
	}
	/** fetch + merge; conflicts land in the normal conflict flow. */
	async pullRemote(request) {
		const dir = git.requireDir(request?.path);
		return git.pullRemote(dir, request?.remote, request?.branch, await this.resolveAccount(dir, request?.account));
	}
	/** force is force-with-lease only; setUpstream links a new branch in one step. */
	async pushRemote(request) {
		const dir = git.requireDir(request?.path);
		return git.pushRemote(dir, request?.remote, request?.branch, {
			setUpstream: request?.setUpstream === true,
			force: request?.force === true,
			account: await this.resolveAccount(dir, request?.account)
		});
	}
	/** Diff between two revisions (optionally narrowed to paths). */
	async rangeDiff(request) {
		return git.rangeDiff(git.requireDir(request?.path), request?.from, request?.to, Array.isArray(request?.paths) ? request.paths : []);
	}
	/** Attach a remote to a repo that has none, or repoint an existing one. */
	async addRemote(request) {
		return git.addRemote(git.requireDir(request?.path), request?.url, request?.name);
	}
	/** Detach a remote; local history is untouched. */
	async removeRemote(request) {
		return git.removeRemote(git.requireDir(request?.path), request?.name);
	}
	/** Repository-local settings: identity + credential pin (repo settings page). */
	async repoConfig(request) {
		return git.repoConfig(git.requireDir(request?.path));
	}
	async repoConfigWrite(request) {
		const patch = {};
		if (typeof request?.userName === "string") patch.userName = request.userName;
		if (typeof request?.userEmail === "string") patch.userEmail = request.userEmail;
		if (typeof request?.credentialUser === "string") patch.credentialUser = request.credentialUser;
		return git.repoConfigWrite(git.requireDir(request?.path), patch);
	}
	/** Root `.gitignore`: read / save (with backup) / restore / check a path. */
	async gitignoreRead(request) {
		return git.gitignoreRead(git.requireDir(request?.path));
	}
	async gitignoreWrite(request) {
		return git.gitignoreWrite(git.requireDir(request?.path), request?.content);
	}
	async gitignoreRestore(request) {
		return git.gitignoreRestore(git.requireDir(request?.path));
	}
	async gitignoreCheck(request) {
		return git.gitignoreCheck(git.requireDir(request?.path), request?.target);
	}
	async gitignoreFiles(request) {
		return git.gitignoreFiles(git.requireDir(request?.path), request?.limit);
	}
	/** Open a repository file with the platform's default application. */
	async openPath(request) {
		const dir = git.requireDir(request?.path);
		const relative = typeof request?.file === "string" && request.file.trim().length > 0 ? request.file.trim() : ".gitignore";
		const root = resolve(dir);
		const target = resolve(root, relative);
		if (target !== root && !target.startsWith(`${root}\\`) && !target.startsWith(`${root}/`)) {
			return { ok: false, error: "路径不在仓库内" };
		}
		try {
			// Explorer is the shell's file-association entry point: `explorer <file>`
			// hands it to the registered default application. (cmd /c start reports
			// success from a detached child but does not always reach the desktop.)
			const child = spawn("explorer.exe", [target], { detached: true, stdio: "ignore" });
			child.unref();
			return { ok: true, message: "已用默认程序打开" };
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : String(error) };
		}
	}
	async branchExclusiveCommits(request) {
		return git.branchExclusiveCommits(git.requireDir(request?.path), request?.name);
	}
	async repoOperation(request) {
		return git.repoOperation(git.requireDir(request?.path));
	}
	async conflictFile(request) {
		return git.conflictFile(git.requireDir(request?.path), request?.file);
	}
	async orphanedCommits(request) {
		return git.orphanedCommits(git.requireDir(request?.path));
	}
	async reflogEvents(request) {
		return git.reflogEvents(git.requireDir(request?.path));
	}
	async createBranch(request) {
		return git.createBranch(git.requireDir(request?.path), request?.name, request?.from);
	}
	async isRepo(request) {
		try {
			return { repo: await git.isRepo(git.requireDir(request?.path)) };
		} catch (error) {
			return { repo: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	// ---- safe write set ----
	async init(request) {
		// Initializing a repository is the one place the plugin writes `.git/config`:
		// fall back to the panel's configured identity so `git init` lands with the
		// user's own name/email instead of the built-in placeholder.
		const settings = resolveSettings(this.config, await readSettingsOverrides());
		const userName = typeof request?.userName === "string" && request.userName.trim() !== "" ? request.userName : settings.userName;
		const userEmail = typeof request?.userEmail === "string" && request.userEmail.trim() !== "" ? request.userEmail : settings.userEmail;
		return git.init(git.requireDir(request?.path), { userName, userEmail });
	}
	async commit(request) {
		// `paths` = commit exactly the selected files (untracked included);
		// otherwise the index is committed (stagedOnly) or everything is staged first.
		// The settings panel's identity is used only where git has none configured.
		const settings = resolveSettings(this.config, await readSettingsOverrides());
		return git.commit(git.requireDir(request?.path), request?.message, {
			stagedOnly: request?.stagedOnly === true,
			paths: Array.isArray(request?.paths) ? request.paths : [],
			identity: { name: settings.userName, email: settings.userEmail }
		});
	}
	async checkout(request) {
		return git.checkout(git.requireDir(request?.path), request?.target);
	}
	/** Pre-flight: fast-forward possible? would it conflict? (no working-tree change) */
	async mergePreview(request) {
		return git.mergePreview(git.requireDir(request?.path), request?.target, request?.source);
	}
	/** Stash actions: push / list / show / apply / pop / drop / clear / branch. */
	async stash(request) {
		return git.stashAction(git.requireDir(request?.path), {
			action: request?.action,
			message: request?.message,
			ref: request?.ref,
			includeUntracked: request?.includeUntracked === true,
			all: request?.all === true,
			paths: Array.isArray(request?.paths) ? request.paths : [],
			index: request?.index === true,
			staged: request?.staged === true,
			keepIndex: request?.keepIndex === true,
			branch: request?.branch
		});
	}
	async revert(request) {
		return git.revert(git.requireDir(request?.path), request?.commit);
	}
	/** Rebase `source` (default: current) onto `upstream` (commit or branch). */
	async rebase(request) {
		return git.rebase(git.requireDir(request?.path), request?.upstream, request?.source);
	}
	async rebaseSkip(request) {
		return git.rebaseSkip(git.requireDir(request?.path));
	}
	async merge(request) {
		// `mode`: ff-only | no-ff | squash; the panel picks how the merge lands.
		const mode = request?.mode;
		return git.merge(git.requireDir(request?.path), request?.target, {
			mode: mode === "ff-only" || mode === "no-ff" || mode === "squash" ? mode : void 0
		});
	}
	async deleteBranch(request) {
		return git.deleteBranch(git.requireDir(request?.path), request?.name, { force: request?.force === true });
	}
	async renameBranch(request) {
		const dir = git.requireDir(request?.path);
		return git.renameBranch(dir, request?.from, request?.to, {
			force: request?.force === true,
			renameRemote: request?.renameRemote === true,
			account: await this.resolveAccount(dir, request?.account)
		});
	}
	/** Finish an in-progress merge / squash / revert / cherry-pick. */
	async operationContinue(request) {
		return git.operationContinue(git.requireDir(request?.path), request?.kind);
	}
	/** Abort an in-progress operation (merge / revert / cherry-pick / rebase / squash). */
	async operationAbort(request) {
		return git.abortOperation(git.requireDir(request?.path), request?.kind);
	}
	/** Stage the given paths (the panel's per-file selection). */
	async add(request) {
		return git.addPaths(git.requireDir(request?.path), Array.isArray(request?.paths) ? request.paths : []);
	}
	/** Unstage the given paths (keeps the working-tree changes). */
	async unstage(request) {
		return git.unstagePaths(git.requireDir(request?.path), Array.isArray(request?.paths) ? request.paths : []);
	}

	// ---- destructive ops (UI-plugin only; never MCP tools) ----
	async restore(request) {
		return git.restore(git.requireDir(request?.path), Array.isArray(request?.paths) ? request.paths : []);
	}
	async reset(request) {
		return git.reset(git.requireDir(request?.path), request?.commit, request?.mode);
	}

	// ---- plugin-local persistence (never touches the workspace) ----
	// Data lives in `<plugin>/.data/state.json`, so uninstalling the plugin
	// removes it too. Future reflog snapshots will use the same key-value store.
	async readPluginState(request) {
		return { ok: true, value: await readState(request?.key) };
	}
	async writePluginState(request) {
		await writeState(request?.key, request?.value);
		return { ok: true };
	}
	// ---- reflog backup (opt-in; keeps creation/merge events past reflog expiry) ----
	/** Merge newly seen reflog rows into the plugin-local snapshot. */
	async reflogBackup(request) {
		const dir = git.requireDir(request?.path);
		const snapshot = await git.snapshot(dir);
		if (snapshot.repo !== true) return { ok: false, error: "not-a-repo" };
		const key = `reflog:${snapshot.root}`;
		const stored = await stateList(key);
		const seen = new Set(stored.map(reflogId));
		const events = (await git.reflogEvents(dir)).events ?? [];
		let added = 0;
		for (const event of events) {
			const id = reflogId(event);
			if (seen.has(id)) continue;
			seen.add(id);
			stored.push(event);
			added += 1;
		}
		await writeState(key, JSON.stringify(stored));
		return { ok: true, added, total: stored.length };
	}
	/** Read the persisted reflog snapshot for this repository. */
	async reflogBackupRead(request) {
		const dir = git.requireDir(request?.path);
		const snapshot = await git.snapshot(dir);
		if (snapshot.repo !== true) return { ok: false, error: "not-a-repo", events: [] };
		return { ok: true, events: await stateList(`reflog:${snapshot.root}`) };
	}
	/**
	 * Read (or flip) the per-repository opt-in switch. Without a per-repo value
	 * the global settings toggle (`reflogBackup`) decides, so flipping the switch
	 * in the settings panel changes the default for every repository at once.
	 */
	async reflogBackupConfig(request) {
		const dir = git.requireDir(request?.path);
		const snapshot = await git.snapshot(dir);
		if (snapshot.repo !== true) return { ok: false, error: "not-a-repo", enabled: false, total: 0 };
		const key = `reflog-backup:${snapshot.root}`;
		if (typeof request?.enabled === "boolean") {
			await writeState(key, request.enabled ? "true" : "false");
		}
		let enabled;
		try {
			const stored = JSON.parse(String(await readState(key)));
			enabled = typeof stored === "boolean" ? stored : null;
		} catch (error) {
			enabled = null;
		}
		if (enabled === null) {
			const settings = resolveSettings(this.config, await readSettingsOverrides());
			enabled = settings.reflogBackup === true;
		}
		const events = await stateList(`reflog:${snapshot.root}`);
		return { ok: true, enabled, total: events.length };
	}
}

// cordis validates a class plugin's config against `runtime.Config`; exposing it
// on the constructor as well covers the case where the runtime object IS the
// class rather than the module namespace.
GitGateway.Config = Config;

export { GitGateway, GitGateway as default };
