// @dsh-external/dsh-client-ui-git — host half
// GitGateway: read-only queries + the write set, exposed to the browser as the
// `git` Remote service (typert). All git logic lives in ./git-core.mjs so the
// git MCP server can mirror it. See ./typert.host.js for the strict invocation
// surface auto-registered by @deepseek-ai/dsh-typert-loader.
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import * as git from "./git-core.mjs";
import { readState, writeState } from "./state.mjs";

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

	constructor(ctx) {
		super(ctx, "git");
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
		return git.init(git.requireDir(request?.path), {
			userName: request?.userName,
			userEmail: request?.userEmail
		});
	}
	async commit(request) {
		// `paths` = commit exactly the selected files (untracked included);
		// otherwise the index is committed (stagedOnly) or everything is staged first.
		return git.commit(git.requireDir(request?.path), request?.message, {
			stagedOnly: request?.stagedOnly === true,
			paths: Array.isArray(request?.paths) ? request.paths : []
		});
	}
	async checkout(request) {
		return git.checkout(git.requireDir(request?.path), request?.target);
	}
	async revert(request) {
		return git.revert(git.requireDir(request?.path), request?.commit);
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
		return git.renameBranch(git.requireDir(request?.path), request?.from, request?.to, { force: request?.force === true });
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
		return git.reset(git.requireDir(request?.path), request?.commit);
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
	/** Read (or flip) the opt-in switch; reserved for the future settings panel. */
	async reflogBackupConfig(request) {
		const dir = git.requireDir(request?.path);
		const snapshot = await git.snapshot(dir);
		if (snapshot.repo !== true) return { ok: false, error: "not-a-repo", enabled: false, total: 0 };
		const key = `reflog-backup:${snapshot.root}`;
		if (typeof request?.enabled === "boolean") {
			await writeState(key, request.enabled ? "true" : "false");
		}
		let enabled = false;
		try {
			enabled = JSON.parse(String(await readState(key))) === true;
		} catch (error) {
			enabled = false;
		}
		const events = await stateList(`reflog:${snapshot.root}`);
		return { ok: true, enabled, total: events.length };
	}
}

export { GitGateway, GitGateway as default };
