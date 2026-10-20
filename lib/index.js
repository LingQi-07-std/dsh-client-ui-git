// @dsh-external/dsh-client-ui-git — host half
// GitGateway: read-only queries + the write set, exposed to the browser as the
// `git` Remote service (typert). All git logic lives in ./git-core.mjs so the
// git MCP server can mirror it. See ./typert.host.js for the strict invocation
// surface auto-registered by @deepseek-ai/dsh-typert-loader.
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import * as git from "./git-core.mjs";

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
		return git.diff(git.requireDir(request?.path), request?.commit, {
			paths: Array.isArray(request?.paths) ? request.paths : [],
			stat: request?.stat === true
		});
	}
	async branch(request) {
		return git.branch(git.requireDir(request?.path));
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
		// otherwise the whole index is committed.
		return git.commit(git.requireDir(request?.path), request?.message, {
			stagedOnly: false,
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
		return git.merge(git.requireDir(request?.path), request?.target);
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
}

export { GitGateway, GitGateway as default };
