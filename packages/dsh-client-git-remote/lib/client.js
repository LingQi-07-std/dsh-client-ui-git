// @dsh-external/dsh-client-git-remote — browser half
// Mounts the `git` Remote namespace (read + write set) on the client api
// gateway so UI plugins may inject "remote.git". Mirrors how
// @deepseek-ai/dsh-api-remotes owns the official Remote contributions:
// mounting lives in its own plugin, consumers inject the namespace.
window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-git-remote",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		//#region minimal zod v4-compatible schemas (parse-only)
		// The api-gateway client calls codec.schema.parse() on every parameter
		// and result, so these schemas must validate and return real data.
		function zodFail(message) {
			const error = new Error(message);
			error.name = "ZodError";
			throw error;
		}
		function zodType(parse) {
			const schema = { parse };
			schema.passthrough = () => zodType((v) => {
				const parsed = parse(v);
				return parsed !== void 0 && typeof parsed === "object" && parsed !== null ? { ...parsed, ...v } : parsed;
			});
			schema.optional = () => {
				const sc = zodType((v) => (v === void 0 ? void 0 : parse(v)));
				sc._optional = true;
				return sc;
			};
			Object.defineProperty(schema, "_zod", { value: { traits: new Set() } });
			return schema;
		}
		const z = {
			string: () => zodType((v) => (typeof v === "string" ? v : zodFail(`expected string, got ${typeof v}`))),
			number: () => zodType((v) => (typeof v === "number" && Number.isFinite(v) ? v : zodFail(`expected number, got ${typeof v}`))),
			boolean: () => zodType((v) => (typeof v === "boolean" ? v : zodFail(`expected boolean, got ${typeof v}`))),
			any: () => zodType((v) => v),
			null: () => zodType((v) => (v === null ? v : zodFail("expected null"))),
			literal: (value) => zodType((v) => (v === value ? v : zodFail(`expected literal ${JSON.stringify(value)}`))),
			union: (options) => zodType((v) => {
				for (const option of options) {
					try {
						return option.parse(v);
					} catch {
						// try next option
					}
				}
				return zodFail("union: no option matched");
			}),
			array: (element) => zodType((v) => {
				if (!Array.isArray(v)) return zodFail("expected array");
				return v.map((item) => element.parse(item));
			}),
			object: (shape) => zodType((v) => {
				if (v === null || typeof v !== "object" || Array.isArray(v)) return zodFail("expected object");
				const out = {};
				for (const key of Object.keys(shape)) {
					if (!Object.prototype.hasOwnProperty.call(v, key)) {
						if (shape[key]._optional === true) continue;
						return zodFail(`missing field "${key}"`);
					}
					const parsed = shape[key].parse(v[key]);
					if (parsed !== void 0) out[key] = parsed;
				}
				return out;
			}),
			optional: (schema) => {
				const sc = zodType((v) => (v === void 0 ? void 0 : schema.parse(v)));
				sc._optional = true;
				return sc;
			},
			nullable: (schema) => zodType((v) => (v === null ? null : schema.parse(v)))
		};
		//#endregion

		//#region typert remote contribution (mirrors host lib/typert.host.js)
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
		const gitStatusResult = z.object({ clean: z.boolean(), entries: z.array(z.object({ x: z.string(), y: z.string(), path: z.string() })) });
		const gitDiffResult = z.object({
			commit: z.string(),
			files: z.array(z.object({
				path: z.string(),
				added: z.union([z.number(), z.null()]),
				removed: z.union([z.number(), z.null()]),
				binary: z.boolean(),
				status: z.string()
			})),
			patch: z.string(),
			truncated: z.boolean()
		});
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
		const gitWriteResult = z.union([
			z.object({ ok: z.literal(true), message: z.string(), id: z.string().optional() }),
			z.object({ ok: z.literal(false), error: z.string(), errorCode: z.string().optional() })
		]);
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
			current: z.boolean(),
			merged: z.boolean(),
			created: z.union([
				z.null(),
				z.object({ date: z.string(), from: z.string(), hash: z.string() })
			])
		});
		const gitBranchDetailsResult = z.object({ branches: z.array(gitBranchInfo) });
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
		const gitPluginStateResult = z.object({ ok: z.boolean(), value: z.string().optional(), error: z.string().optional() });
		const gitMergePreviewResult = z.object({ ok: z.boolean(), ffOnly: z.boolean().optional(), conflicts: z.array(z.string()).optional(), error: z.string().optional() });
		const gitStashResult = z.union([
			z.object({ ok: z.literal(true), message: z.string().optional(), entries: z.array(z.object({ ref: z.string(), hash: z.string().optional(), date: z.string().optional(), author: z.string().optional(), message: z.string() })).optional(), patch: z.string().optional(), truncated: z.boolean().optional() }),
			z.object({ ok: z.literal(false), error: z.string(), errorCode: z.string().optional(), conflicts: z.array(z.string()).optional() })
		]);
		const gitReflogBackupResult = z.union([
			z.object({ ok: z.literal(true), added: z.number(), total: z.number() }),
			z.object({ ok: z.literal(false), error: z.string() })
		]);
		const gitReflogBackupReadResult = z.object({ ok: z.boolean(), events: z.array(z.any()), error: z.string().optional() });
		const gitReflogBackupConfigResult = z.object({ ok: z.boolean(), enabled: z.boolean(), total: z.number(), error: z.string().optional() });
		//#endregion

		const PKG = "@dsh-external/dsh-client-ui-git";
		function descrip(method, typeBase, schema, reqSchema) {
			return {
				id: `${PKG}#git/${method}`,
				service: "git",
				namespace: "git",
				method,
				invocation: { kind: "direct" },
				parameters: [{ name: "request", wire: "request", source: "json", codec: { mode: "strict", typeSymbol: `${PKG}/types#GitRequest`, schema: reqSchema ?? gitRequest, create: () => reqSchema ?? gitRequest } }],
				result: { mode: "strict", typeSymbol: `${PKG}/types#${typeBase}`, schema, create: () => schema }
			};
		}
		const withTarget = z.object({ path: z.string(), target: z.string() }).passthrough();
		const withMessage = z.object({ path: z.string(), message: z.string() }).passthrough();
		const withCommit = z.object({ path: z.string(), commit: z.string() }).passthrough();
		const withPaths = z.object({ path: z.string(), paths: z.array(z.string()) }).passthrough();
		const withName = z.object({ path: z.string(), name: z.string() }).passthrough();
		const withFile = z.object({ path: z.string(), file: z.string() }).passthrough();
		const withKind = z.object({ path: z.string(), kind: z.string() }).passthrough();
		const withOptionalPaths = z.object({ path: z.string(), paths: z.array(z.string()).optional() }).passthrough();
		const TYPERT_REMOTE = {
			package: "@dsh-external/dsh-client-git-remote",
			descriptors: [
				descrip("snapshot", "GitSnapshotResult", gitSnapshotResult),
				descrip("log", "GitLogResult", gitLogResult),
				descrip("status", "GitStatusResult", gitStatusResult),
				descrip("diff", "GitDiffResult", gitDiffResult, withCommit),
				descrip("branch", "GitBranchResult", gitBranchResult),
				descrip("branchDetails", "GitBranchDetailsResult", gitBranchDetailsResult),
				descrip("branchExclusiveCommits", "GitExclusiveResult", gitExclusiveResult, withName),
				descrip("repoOperation", "GitRepoOperationResult", gitRepoOperationResult),
				descrip("conflictFile", "GitConflictFileResult", gitConflictFileResult, withFile),
				descrip("orphanedCommits", "GitOrphanResult", gitOrphanResult),
				descrip("reflogEvents", "GitReflogResult", gitReflogResult),
				descrip("createBranch", "GitWriteResult", gitWriteResult),
				descrip("isRepo", "GitIsRepoResult", gitIsRepoResult),
				descrip("init", "GitWriteResult", gitWriteResult),
				descrip("commit", "GitWriteResult", gitWriteResult, withMessage),
				descrip("checkout", "GitWriteResult", gitWriteResult, withTarget),
				descrip("revert", "GitWriteResult", gitWriteResult, withCommit),
				descrip("merge", "GitMergeResult", gitMergeResult, withTarget),
				descrip("mergePreview", "GitMergePreviewResult", gitMergePreviewResult, z.object({ path: z.string(), target: z.string(), source: z.string() }).passthrough()),
				descrip("stash", "GitStashResult", gitStashResult, z.object({ path: z.string(), action: z.string(), message: z.string().optional(), ref: z.string().optional(), includeUntracked: z.boolean().optional(), all: z.boolean().optional(), paths: z.array(z.string()).optional(), index: z.boolean().optional(), staged: z.boolean().optional(), keepIndex: z.boolean().optional(), branch: z.string().optional() }).passthrough()),
				descrip("add", "GitWriteResult", gitWriteResult, withPaths),
				descrip("unstage", "GitWriteResult", gitWriteResult, withPaths),
				descrip("deleteBranch", "GitWriteResult", gitWriteResult, withName),
				descrip("renameBranch", "GitWriteResult", gitWriteResult, z.object({ path: z.string(), from: z.string(), to: z.string() }).passthrough()),
				descrip("operationContinue", "GitWriteResult", gitWriteResult, withKind),
				descrip("operationAbort", "GitWriteResult", gitWriteResult, withKind),
				descrip("restore", "GitWriteResult", gitWriteResult, withOptionalPaths),
				descrip("reset", "GitWriteResult", gitWriteResult, withCommit),
				descrip("readPluginState", "GitPluginStateResult", gitPluginStateResult, z.object({ path: z.string(), key: z.string() }).passthrough()),
				descrip("writePluginState", "GitPluginStateResult", gitPluginStateResult, z.object({ path: z.string(), key: z.string(), value: z.string().optional() }).passthrough()),
				descrip("reflogBackup", "GitReflogBackupResult", gitReflogBackupResult),
				descrip("reflogBackupRead", "GitReflogBackupReadResult", gitReflogBackupReadResult),
				descrip("reflogBackupConfig", "GitReflogBackupConfigResult", gitReflogBackupConfigResult, z.object({ path: z.string(), enabled: z.boolean().optional() }).passthrough())
			]
		};
		//#endregion

		//#region plugin body
		const inject = ["remote"];
		async function apply(ctx) {
			await ctx.remote.$mount(TYPERT_REMOTE);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
