/* Hand-written TYPERT host manifest for @dsh-external/dsh-client-ui-git.
 * Auto-registered by @deepseek-ai/dsh-typert-loader (exports["./typert"]),
 * giving the Host gateway strict invocation definitions for the `git` service.
 */
import { z } from "zod";

/** Request object shared by every method: `{ path, ... }` (extra fields pass through). */
const gitRequest = z.object({ path: z.string() }).passthrough();

const gitSnapshotResult = z.union([
	z.object({ repo: z.literal(false), path: z.string() }),
	z.object({
		repo: z.literal(true),
		path: z.string(),
		root: z.string(),
		branch: z.string(),
		head: z.union([z.string(), z.null()]),
		clean: z.boolean(),
		changes: z.object({ staged: z.number(), unstaged: z.number(), untracked: z.number(), total: z.number() }),
		ahead: z.number(),
		behind: z.number()
	})
]);

const gitCommit = z.object({
	hash: z.string(),
	short: z.string(),
	parents: z.array(z.string()),
	refs: z.array(z.string()),
	author: z.string(),
	email: z.string(),
	date: z.string(),
	subject: z.string(),
	body: z.string()
});

const gitLogResult = z.object({ commits: z.array(gitCommit) });

const gitStatusEntry = z.object({ x: z.string(), y: z.string(), path: z.string() });
const gitStatusResult = z.object({ clean: z.boolean(), entries: z.array(gitStatusEntry) });

const gitDiffFile = z.object({
	path: z.string(),
	added: z.union([z.number(), z.null()]),
	removed: z.union([z.number(), z.null()]),
	binary: z.boolean(),
	status: z.string()
});
const gitDiffResult = z.object({ commit: z.string(), files: z.array(gitDiffFile), patch: z.string(), truncated: z.boolean() });

const gitBranchResult = z.object({ branches: z.array(z.string()) });
const gitReflogEvent = z.object({
	ref: z.string(),
	oldHash: z.string(),
	newHash: z.string(),
	actor: z.string(),
	date: z.string(),
	message: z.string(),
	action: z.string()
});
const gitReflogResult = z.object({ ok: z.boolean(), events: z.array(gitReflogEvent).optional(), error: z.string().optional() });
const gitIsRepoResult = z.object({ repo: z.boolean(), error: z.string().optional() });

/** ok/error result shared by write operations (commit adds optional id). */
const gitWriteResult = z.union([
	z.object({ ok: z.literal(true), message: z.string(), id: z.string().optional() }),
	z.object({ ok: z.literal(false), error: z.string(), errorCode: z.string().optional() })
]);
/** Plugin-local key-value store: value is JSON text (or omitted on error). */
const gitPluginStateResult = z.object({ ok: z.boolean(), value: z.string().optional(), error: z.string().optional() });
/** Merge pre-flight: ff-only possible, and the would-be conflict list. */
const gitMergePreviewResult = z.object({ ok: z.boolean(), ffOnly: z.boolean().optional(), conflicts: z.array(z.string()).optional(), error: z.string().optional() });
/** Stash actions: list/push/apply/pop/drop/clear/branch/show. */
const gitStashResult = z.union([
	z.object({ ok: z.literal(true), message: z.string().optional(), entries: z.array(z.object({ ref: z.string(), hash: z.string().optional(), date: z.string().optional(), author: z.string().optional(), message: z.string() })).optional(), patch: z.string().optional(), truncated: z.boolean().optional() }),
	z.object({ ok: z.literal(false), error: z.string(), errorCode: z.string().optional(), conflicts: z.array(z.string()).optional() })
]);
/** Reflog backup: merge current reflog into the plugin-local snapshot. */
const gitReflogBackupResult = z.union([
	z.object({ ok: z.literal(true), added: z.number(), total: z.number() }),
	z.object({ ok: z.literal(false), error: z.string() })
]);
const gitReflogBackupReadResult = z.object({ ok: z.boolean(), events: z.array(gitReflogEvent), error: z.string().optional() });
const gitReflogBackupConfigResult = z.object({ ok: z.boolean(), enabled: z.boolean(), total: z.number(), error: z.string().optional() });
/** Effective plugin settings (settings panel); every field is always present. */
const gitPluginSettings = z.object({
	userName: z.string(),
	userEmail: z.string(),
	reflogBackup: z.boolean(),
	showDshSettings: z.boolean(),
	modalAnchor: z.string(),
	devMode: z.boolean(),
	allowCreateRepo: z.boolean(),
	promptRemoteLink: z.boolean(),
	remoteTitle: z.string(),
	fetchTimeoutMs: z.number(),
	activeAccount: z.string(),
	permissionCacheMs: z.number(),
	prInMoreMenu: z.boolean()
});
/** GitHub accounts known to Git Credential Manager. */
const gitGithubAccounts = z.object({
	ok: z.boolean(),
	accounts: z.array(z.object({ name: z.string() })),
	error: z.string().optional()
});
/** Who the account's token belongs to, plus its avatar URL. */
const gitGithubUser = z.object({
	ok: z.boolean(),
	login: z.string(),
	avatarUrl: z.string(),
	reason: z.string(),
	status: z.number()
});
/** Push/pull permission for one repository; null = unknown (network failure). */
const gitRepoPermission = z.object({
	ok: z.boolean(),
	canPush: z.union([z.boolean(), z.null()]),
	canPull: z.union([z.boolean(), z.null()]),
	status: z.number(),
	reason: z.string()
});
/** Result of creating an empty repository. */
const gitCreateRepoResult = z.object({
	ok: z.boolean(),
	owner: z.string().optional(),
	fullName: z.string().optional(),
	cloneUrl: z.string().optional(),
	error: z.string().optional(),
	errorCode: z.string().optional()
});
/** One pull request that involves a branch. */
const gitPullRequest = z.object({
	number: z.number(),
	title: z.string(),
	state: z.string(),
	merged: z.boolean(),
	draft: z.boolean(),
	url: z.string(),
	base: z.string(),
	author: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	mergedAt: z.string(),
	mergeCommit: z.string()
});
/** Fork lineage of a repository. */
const gitRepoInfoResult = z.object({
	ok: z.boolean(),
	isFork: z.boolean(),
	parent: z.object({ owner: z.string(), repo: z.string(), defaultBranch: z.string() }).nullable(),
	source: z.object({ owner: z.string(), repo: z.string(), defaultBranch: z.string() }).nullable(),
	reason: z.string(),
	status: z.number()
});
/** One PR row with both head and base sides resolved. */
const gitPullRequestDetail = z.object({
	number: z.number(),
	title: z.string(),
	state: z.string(),
	merged: z.boolean(),
	draft: z.boolean(),
	url: z.string(),
	base: z.string(),
	baseOwner: z.string(),
	baseRepo: z.string(),
	head: z.string(),
	headOwner: z.string(),
	author: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	mergedAt: z.string(),
	mergeCommit: z.string(),
	direction: z.string().optional()
});
/** All three PR classes for a branch. */
const gitPullRequestsAllResult = z.object({
	ok: z.boolean(),
	outgoing: z.array(gitPullRequestDetail),
	internal: z.array(gitPullRequestDetail),
	incoming: z.array(gitPullRequestDetail),
	reason: z.string(),
	status: z.number()
});
/** Result of opening a pull request. */
const gitCreatePrResult = z.object({
	ok: z.boolean(),
	number: z.number(),
	url: z.string(),
	reason: z.string(),
	status: z.number()
});

/** Pull requests whose head is this branch. */
const gitPullRequestsResult = z.object({
	ok: z.boolean(),
	prs: z.array(gitPullRequest),
	reason: z.string(),
	status: z.number()
});
/** Handle for a pending browser OAuth login. */
const gitGithubLoginStart = z.object({
	ok: z.boolean(),
	id: z.string().optional(),
	url: z.string().optional(),
	error: z.string().optional()
});
/** Browser-login progress: pending | done | failed | unknown. */
const gitGithubLoginPoll = z.object({
	ok: z.boolean(),
	status: z.string(),
	accounts: z.array(z.object({ name: z.string() })).optional(),
	error: z.string().optional()
});
/** Token login / cancel / logout share this shape. */
const gitGithubAction = z.object({
	ok: z.boolean(),
	cancelled: z.boolean().optional(),
	accounts: z.array(z.object({ name: z.string() })).optional(),
	error: z.string().optional()
});
/** merge may additionally report conflicting files (ok:false with conflicts). */
const gitMergeResult = z.union([
	z.object({ ok: z.literal(true), message: z.string() }),
	z.object({ ok: z.literal(false), error: z.string(), errorCode: z.string().optional(), conflicts: z.array(z.string()).optional() })
]);

const gitBranchInfo = z.object({
	name: z.string(),
	hash: z.string(),
	short: z.string(),
	upstream: z.string(),
	date: z.string(),
	subject: z.string(),
	/** Commits this branch has that its upstream does not, and vice versa. */
	ahead: z.number(),
	behind: z.number(),
	current: z.boolean(),
	merged: z.boolean(),
	created: z.union([
		z.null(),
		z.object({ date: z.string(), from: z.string(), hash: z.string() })
	])
});
const gitBranchDetailsResult = z.object({ branches: z.array(gitBranchInfo) });
/** One pending sync commit (push or pull side). */
const gitSyncCommit = z.object({
	hash: z.string(),
	short: z.string(),
	author: z.string(),
	date: z.string(),
	subject: z.string()
});
/** One file changed by a whole pending chain. */
const gitSyncFile = z.object({
	path: z.string(),
	added: z.union([z.number(), z.null()]),
	removed: z.union([z.number(), z.null()]),
	status: z.string()
});
/** Pending push/pull work for the current branch (empty lists when no upstream). */
const gitSyncResult = z.object({
	ok: z.boolean(),
	upstream: z.string(),
	ahead: z.array(gitSyncCommit),
	behind: z.array(gitSyncCommit),
	aheadFiles: z.array(gitSyncFile),
	behindFiles: z.array(gitSyncFile),
	mergeBase: z.string()
});
/** A remote-tracking branch and the local branch tracking it (empty = untracked). */
const gitRemoteBranch = z.object({
	name: z.string(),
	remote: z.string(),
	branch: z.string(),
	hash: z.string(),
	short: z.string(),
	date: z.string(),
	subject: z.string(),
	trackedBy: z.string()
});
const gitRemoteBranchesResult = z.object({ branches: z.array(gitRemoteBranch) });
/** Remote target info; `github` is true when owner/repo could be parsed. */
const gitRemoteInfoResult = z.object({
	ok: z.boolean(),
	name: z.string(),
	url: z.string(),
	host: z.string(),
	owner: z.string(),
	repo: z.string(),
	github: z.boolean()
});
/** Two-revision diff (used by the sync bubbles' per-file view). */
const gitRangeDiffResult = z.object({
	ok: z.boolean(),
	from: z.string(),
	to: z.string(),
	files: z.array(gitDiffFile),
	patch: z.string(),
	truncated: z.boolean(),
	error: z.string().optional()
});

const gitRepoOperation = z.object({
	kind: z.string(),
	source: z.string(),
	target: z.string(),
	message: z.string(),
	startedAt: z.string(),
	head: z.string()
});
const gitConflictEntry = z.object({ path: z.string(), code: z.string(), blocks: z.number() });
const gitRepoOperationResult = z.object({
	operation: z.union([z.null(), gitRepoOperation]),
	conflicts: z.array(gitConflictEntry),
	resolved: z.array(z.object({ path: z.string() })),
	total: z.number(),
	unresolved: z.number()
});

const gitConflictFileResult = z.object({
	file: z.string(),
	worktree: z.string(),
	ours: z.string(),
	theirs: z.string(),
	base: z.string(),
	binary: z.boolean(),
	truncated: z.boolean()
});

const gitOrphanCommit = z.object({
	hash: z.string(),
	short: z.string(),
	subject: z.string(),
	author: z.string(),
	date: z.string(),
	lostAt: z.string(),
	reason: z.string(),
	ref: z.string()
});
const gitOrphanResult = z.object({ ok: z.boolean(), commits: z.array(gitOrphanCommit), error: z.string().optional() });

const gitExclusiveCommit = z.object({ hash: z.string(), short: z.string(), subject: z.string() });
const gitExclusiveResult = z.object({ ok: z.boolean(), commits: z.array(gitExclusiveCommit), error: z.string().optional() });

const PKG = "@dsh-external/dsh-client-ui-git";

/**
 * `diff` accepts EITHER a commit (committed patch) or no commit at all
 * (working-tree patch), so its request schema must not require `commit`.
 */
function reqDiff(packageId, method, typeBase, resultSchema) {
	const requestSchema = () => z.object({
		path: z.string(),
		commit: z.string().optional(),
		paths: z.array(z.string()).optional(),
		base: z.string().optional(),
		stat: z.boolean().optional(),
		staged: z.boolean().optional()
	}).passthrough();
	return {
		id: `${packageId}#git/${method}`,
		service: "git",
		namespace: "git",
		method,
		invocation: { kind: "direct" },
		parameters: [
			{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: `${packageId}/types#GitRequest`,
					schema: requestSchema(),
					create: requestSchema
				}
			}
		],
		result: { mode: "strict", typeSymbol: `${packageId}/types#${typeBase}`, schema: resultSchema, create: () => resultSchema }
	};
}

/** Invocation descriptor for the shared `{ path, ... }` request shape. */
function req(packageId, method, typeBase, resultSchema) {
	return {
		id: `${packageId}#git/${method}`,
		service: "git",
		namespace: "git",
		method,
		invocation: { kind: "direct" },
		parameters: [
			{
				name: "request",
				wire: "request",
				source: "json",
				codec: { mode: "strict", typeSymbol: `${packageId}/types#GitRequest`, schema: gitRequest, create: () => gitRequest }
			}
		],
		result: { mode: "strict", typeSymbol: `${packageId}/types#${typeBase}`, schema: resultSchema, create: () => resultSchema }
	};
}
/** Invocation whose request adds a `commit` field (diff/revert/reset). */
function reqWithCommit(packageId, method, typeBase, resultSchema) {
	// `mode` is optional and only meaningful for reset ("soft" keeps the dropped
	// commits staged); declaring it keeps the request shape honest instead of
	// relying on passthrough alone.
	const requestSchema = () => z.object({ path: z.string(), commit: z.string(), mode: z.string().optional() }).passthrough();
	return {
		id: `${packageId}#git/${method}`,
		service: "git",
		namespace: "git",
		method,
		invocation: { kind: "direct" },
		parameters: [
			{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: `${packageId}/types#GitRequest`,
					schema: requestSchema(),
					create: () => requestSchema()
				}
			}
		],
		result: { mode: "strict", typeSymbol: `${packageId}/types#${typeBase}`, schema: resultSchema, create: () => resultSchema }
	};
}
/** Invocation whose request adds a `target` field (checkout/merge). */
function reqWithTarget(packageId, method, typeBase, resultSchema) {
	return {
		id: `${packageId}#git/${method}`,
		service: "git",
		namespace: "git",
		method,
		invocation: { kind: "direct" },
		parameters: [
			{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: `${packageId}/types#GitRequest`,
					schema: z.object({ path: z.string(), target: z.string() }).passthrough(),
					create: () => z.object({ path: z.string(), target: z.string() }).passthrough()
				}
			}
		],
		result: { mode: "strict", typeSymbol: `${packageId}/types#${typeBase}`, schema: resultSchema, create: () => resultSchema }
	};
}
/** Invocation whose request adds a `message` field (commit). */
function reqWithMessage(packageId, method, typeBase, resultSchema) {
	return {
		id: `${packageId}#git/${method}`,
		service: "git",
		namespace: "git",
		method,
		invocation: { kind: "direct" },
		parameters: [
			{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: `${packageId}/types#GitRequest`,
					schema: z.object({ path: z.string(), message: z.string() }).passthrough(),
					create: () => z.object({ path: z.string(), message: z.string() }).passthrough()
				}
			}
		],
		result: { mode: "strict", typeSymbol: `${packageId}/types#${typeBase}`, schema: resultSchema, create: () => resultSchema }
	};
}

/** Invocation whose request adds a `paths` array (add / unstage). */
function reqWithPaths(packageId, method, typeBase, resultSchema) {
	const schema = z.object({ path: z.string(), paths: z.array(z.string()) }).passthrough();
	return {
		id: `${packageId}#git/${method}`,
		service: "git",
		namespace: "git",
		method,
		invocation: { kind: "direct" },
		parameters: [
			{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: `${packageId}/types#GitRequest`,
					schema,
					create: () => schema
				}
			}
		],
		result: { mode: "strict", typeSymbol: `${packageId}/types#${typeBase}`, schema: resultSchema, create: () => resultSchema }
	};
}

/** Invocation whose request is `{ path, ...shape }` (extra fields pass through). */
function reqShaped(packageId, method, typeBase, resultSchema, shape) {
	const schema = () => z.object({ path: z.string(), ...shape }).passthrough();
	return {
		id: `${packageId}#git/${method}`,
		service: "git",
		namespace: "git",
		method,
		invocation: { kind: "direct" },
		parameters: [
			{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: `${packageId}/types#GitRequest`,
					schema: schema(),
					create: schema
				}
			}
		],
		result: { mode: "strict", typeSymbol: `${packageId}/types#${typeBase}`, schema: resultSchema, create: () => resultSchema }
	};
}

/**
 * Invocation whose request is `{ ...shape }` with NO workspace path: settings
 * are plugin-wide, so they must be callable before any repository is known.
 */
function reqBare(packageId, method, typeBase, resultSchema, shape = {}) {
	const schema = () => z.object({ ...shape }).passthrough();
	return {
		id: `${packageId}#git/${method}`,
		service: "git",
		namespace: "git",
		method,
		invocation: { kind: "direct" },
		parameters: [
			{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: `${packageId}/types#GitSettingsRequest`,
					schema: schema(),
					create: schema
				}
			}
		],
		result: { mode: "strict", typeSymbol: `${packageId}/types#${typeBase}`, schema: resultSchema, create: () => resultSchema }
	};
}

export const TYPERT = {
	package: PKG,
	face: "host",
	schemas: [],
	invocations: [
		req(PKG, "snapshot", "GitSnapshotResult", gitSnapshotResult),
		req(PKG, "log", "GitLogResult", gitLogResult),
		req(PKG, "status", "GitStatusResult", gitStatusResult),
		reqDiff(PKG, "diff", "GitDiffResult", gitDiffResult),
		req(PKG, "branch", "GitBranchResult", gitBranchResult),
		req(PKG, "branchDetails", "GitBranchDetailsResult", gitBranchDetailsResult),
		req(PKG, "syncCommits", "GitSyncResult", gitSyncResult),
		req(PKG, "remoteBranches", "GitRemoteBranchesResult", gitRemoteBranchesResult),
		reqShaped(PKG, "linkUpstream", "GitWriteResult", gitWriteResult, { branch: z.string(), upstream: z.string() }),
		req(PKG, "remoteInfo", "GitRemoteInfoResult", gitRemoteInfoResult),
		reqShaped(PKG, "fetchRemote", "GitWriteResult", gitWriteResult, { remote: z.string().optional(), account: z.string().optional() }),
		reqShaped(PKG, "pullRemote", "GitMergeResult", gitMergeResult, { remote: z.string().optional(), branch: z.string().optional(), account: z.string().optional() }),
		reqShaped(PKG, "pushRemote", "GitMergeResult", gitMergeResult, {
			remote: z.string().optional(),
			branch: z.string().optional(),
			setUpstream: z.boolean().optional(),
			force: z.boolean().optional(),
			account: z.string().optional()
		}),
		reqShaped(PKG, "rangeDiff", "GitRangeDiffResult", gitRangeDiffResult, { from: z.string(), to: z.string(), paths: z.array(z.string()).optional() }),
		reqShaped(PKG, "addRemote", "GitWriteResult", gitWriteResult, { url: z.string(), name: z.string().optional() }),
		reqShaped(PKG, "removeRemote", "GitWriteResult", gitWriteResult, { name: z.string().optional() }),
		reqShaped(PKG, "branchExclusiveCommits", "GitExclusiveResult", gitExclusiveResult, { name: z.string() }),
		req(PKG, "repoOperation", "GitRepoOperationResult", gitRepoOperationResult),
		reqShaped(PKG, "conflictFile", "GitConflictFileResult", gitConflictFileResult, { file: z.string() }),
		req(PKG, "orphanedCommits", "GitOrphanResult", gitOrphanResult),
		req(PKG, "reflogEvents", "GitReflogResult", gitReflogResult),
		req(PKG, "createBranch", "GitWriteResult", gitWriteResult),
		req(PKG, "isRepo", "GitIsRepoResult", gitIsRepoResult),
		req(PKG, "init", "GitWriteResult", gitWriteResult),
		reqWithMessage(PKG, "commit", "GitWriteResult", gitWriteResult),
		reqWithTarget(PKG, "checkout", "GitWriteResult", gitWriteResult),
		reqWithCommit(PKG, "revert", "GitWriteResult", gitWriteResult),
		reqWithTarget(PKG, "merge", "GitMergeResult", gitMergeResult),
		reqShaped(PKG, "rebase", "GitMergeResult", gitMergeResult, { upstream: z.string(), source: z.string().optional() }),
		reqShaped(PKG, "rebaseSkip", "GitMergeResult", gitMergeResult, {}),
		reqWithPaths(PKG, "add", "GitWriteResult", gitWriteResult),
		reqWithPaths(PKG, "unstage", "GitWriteResult", gitWriteResult),
		reqShaped(PKG, "deleteBranch", "GitWriteResult", gitWriteResult, { name: z.string(), force: z.boolean().optional() }),
		reqShaped(PKG, "renameBranch", "GitWriteResult", gitWriteResult, { from: z.string(), to: z.string(), force: z.boolean().optional(), renameRemote: z.boolean().optional(), account: z.string().optional() }),
		reqShaped(PKG, "operationContinue", "GitWriteResult", gitWriteResult, { kind: z.string() }),
		reqShaped(PKG, "operationAbort", "GitWriteResult", gitWriteResult, { kind: z.string() }),
		reqShaped(PKG, "restore", "GitWriteResult", gitWriteResult, { paths: z.array(z.string()).optional() }),
		reqShaped(PKG, "mergePreview", "GitMergePreviewResult", gitMergePreviewResult, { target: z.string(), source: z.string() }),
		reqShaped(PKG, "stash", "GitStashResult", gitStashResult, {
			action: z.string(),
			message: z.string().optional(),
			ref: z.string().optional(),
			includeUntracked: z.boolean().optional(),
			all: z.boolean().optional(),
			paths: z.array(z.string()).optional(),
			index: z.boolean().optional(),
			staged: z.boolean().optional(),
			keepIndex: z.boolean().optional(),
			branch: z.string().optional()
		}),
		reqWithCommit(PKG, "reset", "GitWriteResult", gitWriteResult),
		reqShaped(PKG, "readPluginState", "GitPluginStateResult", gitPluginStateResult, { key: z.string() }),
		reqShaped(PKG, "writePluginState", "GitPluginStateResult", gitPluginStateResult, { key: z.string(), value: z.string().optional() }),
		reqShaped(PKG, "reflogBackup", "GitReflogBackupResult", gitReflogBackupResult, {}),
		reqShaped(PKG, "reflogBackupRead", "GitReflogBackupReadResult", gitReflogBackupReadResult, {}),
		reqShaped(PKG, "reflogBackupConfig", "GitReflogBackupConfigResult", gitReflogBackupConfigResult, { enabled: z.boolean().optional() }),
		// Settings panel: plugin-wide values, readable without a workspace.
		reqBare(PKG, "pluginSettings", "GitPluginSettings", gitPluginSettings),
		reqBare(PKG, "pluginSettingsUpdate", "GitPluginSettings", gitPluginSettings, {
			userName: z.string().optional(),
			userEmail: z.string().optional(),
			reflogBackup: z.boolean().optional(),
			showDshSettings: z.boolean().optional(),
			modalAnchor: z.string().optional(),
			devMode: z.boolean().optional(),
			allowCreateRepo: z.boolean().optional(),
			promptRemoteLink: z.boolean().optional(),
			remoteTitle: z.string().optional(),
			fetchTimeoutMs: z.number().optional(),
			activeAccount: z.string().optional(),
			permissionCacheMs: z.number().optional(),
			prInMoreMenu: z.boolean().optional()
		}),
		// GitHub authentication (Git Credential Manager); plugin-wide, no path.
		reqBare(PKG, "githubAccounts", "GitGithubAccounts", gitGithubAccounts),
		reqBare(PKG, "githubUser", "GitGithubUser", gitGithubUser, { account: z.string().optional() }),
		reqBare(PKG, "repoPermission", "GitRepoPermission", gitRepoPermission, {
			account: z.string().optional(),
			owner: z.string(),
			repo: z.string()
		}),
		reqBare(PKG, "createRepo", "GitCreateRepoResult", gitCreateRepoResult, {
			account: z.string().optional(),
			options: z.object({
				name: z.string(),
				description: z.string().optional(),
				private: z.boolean().optional()
			})
		}),
		reqBare(PKG, "repoInfo", "GitRepoInfoResult", gitRepoInfoResult, {
			account: z.string().optional(),
			owner: z.string(),
			repo: z.string()
		}),
		reqBare(PKG, "listAllPullRequests", "GitPullRequestsAllResult", gitPullRequestsAllResult, {
			account: z.string().optional(),
			owner: z.string(),
			repo: z.string(),
			branch: z.string().optional()
		}),
		reqBare(PKG, "createPullRequest", "GitCreatePrResult", gitCreatePrResult, {
			account: z.string().optional(),
			owner: z.string(),
			repo: z.string(),
			options: z.object({
				title: z.string(),
				body: z.string().optional(),
				head: z.string(),
				base: z.string()
			})
		}),
		reqBare(PKG, "listPullRequests", "GitPullRequestsResult", gitPullRequestsResult, {
			account: z.string().optional(),
			owner: z.string(),
			repo: z.string(),
			branch: z.string().optional()
		}),
		reqBare(PKG, "githubLoginStart", "GitGithubLoginStart", gitGithubLoginStart),
		reqBare(PKG, "githubLoginPoll", "GitGithubLoginPoll", gitGithubLoginPoll, { id: z.string() }),
		reqBare(PKG, "githubLoginCancel", "GitGithubAction", gitGithubAction, { id: z.string() }),
		reqBare(PKG, "githubLoginToken", "GitGithubAction", gitGithubAction, { token: z.string() }),
		reqBare(PKG, "githubLogout", "GitGithubAction", gitGithubAction, { account: z.string() })
	],
	model: {
		services: [],
		events: [],
		objects: []
	}
};
