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
	z.object({ ok: z.literal(false), error: z.string() })
]);
/** merge may additionally report conflicting files (ok:false with conflicts). */
const gitMergeResult = z.union([
	z.object({ ok: z.literal(true), message: z.string() }),
	z.object({ ok: z.literal(false), error: z.string(), conflicts: z.array(z.string()).optional() })
]);

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
					schema: z.object({ path: z.string(), commit: z.string() }).passthrough(),
					create: () => z.object({ path: z.string(), commit: z.string() }).passthrough()
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
		req(PKG, "reflogEvents", "GitReflogResult", gitReflogResult),
		req(PKG, "createBranch", "GitWriteResult", gitWriteResult),
		req(PKG, "isRepo", "GitIsRepoResult", gitIsRepoResult),
		req(PKG, "init", "GitWriteResult", gitWriteResult),
		reqWithMessage(PKG, "commit", "GitWriteResult", gitWriteResult),
		reqWithTarget(PKG, "checkout", "GitWriteResult", gitWriteResult),
		reqWithCommit(PKG, "revert", "GitWriteResult", gitWriteResult),
		reqWithTarget(PKG, "merge", "GitMergeResult", gitMergeResult),
		reqWithPaths(PKG, "add", "GitWriteResult", gitWriteResult),
		reqWithPaths(PKG, "unstage", "GitWriteResult", gitWriteResult),
		reqWithCommit(PKG, "restore", "GitWriteResult", gitWriteResult),
		reqWithCommit(PKG, "reset", "GitWriteResult", gitWriteResult)
	],
	model: {
		services: [],
		events: [],
		objects: []
	}
};
