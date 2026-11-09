// @dsh-external/dsh-client-ui-git — browser half
// Git visualizer panel: a sidebar-footer action opens a drawer with the
// current session workspace's branch, working-tree status, commit graph, and
// per-commit diff browser. All git facts come from the host `git` Remote
// service (read-only). Ships as a self-contained __ModuleLoader__ bundle.
window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-git",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");

		// DSH 0.2.0 migration: `react/jsx-runtime` no longer resolves to the React
		// factory in this module table (its `jsx`/`jsxs` come back undefined), and
		// rendering an element built from an undefined factory is React error #130
		// ("element type is invalid"). Rebuild both factories on top of
		// `react.createElement`, which IS available, keeping the automatic-runtime
		// call shape used throughout this bundle: (type, props) => element.
		if (typeof react_jsx_runtime.jsx !== "function" || typeof react_jsx_runtime.jsxs !== "function") {
			const normalize = (type, props) => {
				if (props === null || props === void 0) return [type, null, null];
				const { children, ...rest } = props;
				const meaningful = Object.keys(rest).length > 0 ? rest : null;
				return [type, meaningful, children];
			};
			react_jsx_runtime = {
				...react_jsx_runtime,
				jsx: (type, props) => {
					const [t, p, c] = normalize(type, props);
					return react.createElement(t, p, c === void 0 ? null : c);
				},
				jsxs: (type, props) => {
					const [t, p, c] = normalize(type, props);
					if (Array.isArray(c)) return react.createElement(t, p, ...c);
					return react.createElement(t, p, c === void 0 ? null : c);
				},
				Fragment: react_jsx_runtime.Fragment ?? react.Fragment,
			};
		}

		// Pinpoint the exact element type when the tree builds an invalid element:
		// React #130 only says "element type is invalid" and hides which component
		// came back undefined.
		const __jsx = react_jsx_runtime.jsx;
		const __jsxs = react_jsx_runtime.jsxs;
		const guardType = (type) => {
			if (type === void 0 || type === null) {
				console.error("[git 面板] jsx() got an undefined element type; stack:", new Error("invalid element type").stack);
			}
			return type;
		};
		react_jsx_runtime = {
			...react_jsx_runtime,
			// NEVER forward `undefined` as props: React 18's jsx runtime reads
			// `config.key` without a null guard, so `jsx(type, undefined)` throws
			// "Cannot read properties of undefined (reading 'key')".
			jsx: (type, props) => __jsx(guardType(type), props ?? {}),
			jsxs: (type, props) => __jsxs(guardType(type), props ?? {}),
		};

//#region typert remote contribution (inlined; was the separate
		// @dsh-external/dsh-client-git-remote package). The api-gateway client
		// parses every parameter and result through these schemas, so they must
		// stay in sync with lib/typert.host.js. Inlining removes the second
		// plugin row and lets this bundle mount `remote.git` itself.
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
		/** Effective plugin settings; every field is always present. */
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
		/** Runtime dependency probe (git binary / GCM subcommand). */
		const gitDependencyResult = z.object({
			ok: z.boolean(),
			target: z.string(),
			available: z.boolean(),
			error: z.string().optional()
		});
		const gitGithubAccounts = z.object({
			ok: z.boolean(),
			accounts: z.array(z.object({ name: z.string() })),
			error: z.string().optional()
		});
		const gitGithubUser = z.object({
			ok: z.boolean(),
			login: z.string(),
			avatarUrl: z.string(),
			reason: z.string(),
			status: z.number()
		});
		const gitRepoPermission = z.object({
			ok: z.boolean(),
			canPush: z.union([z.boolean(), z.null()]),
			canPull: z.union([z.boolean(), z.null()]),
			status: z.number(),
			reason: z.string()
		});
		const gitCreateRepoResult = z.object({
			ok: z.boolean(),
			owner: z.string().optional(),
			fullName: z.string().optional(),
			cloneUrl: z.string().optional(),
			error: z.string().optional(),
			errorCode: z.string().optional()
		});
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
		const gitPullRequestsResult = z.object({
			ok: z.boolean(),
			prs: z.array(gitPullRequest),
			reason: z.string(),
			status: z.number()
		});
		/** Fork lineage of a repository. */
		const gitRepoInfoResult = z.object({
			ok: z.boolean(),
			isFork: z.boolean(),
			parent: z.any().optional(),
			source: z.any().optional(),
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
				const gitGithubLoginStart = z.object({
			ok: z.boolean(),
			id: z.string().optional(),
			url: z.string().optional(),
			error: z.string().optional()
		});
		const gitGithubLoginPoll = z.object({
			ok: z.boolean(),
			status: z.string(),
			accounts: z.array(z.object({ name: z.string() })).optional(),
			error: z.string().optional()
		});
		const gitGithubAction = z.object({
			ok: z.boolean(),
			cancelled: z.boolean().optional(),
			accounts: z.array(z.object({ name: z.string() })).optional(),
			error: z.string().optional()
		});
		/** Pending sync work (push / pull side) for the current branch. */
		const gitSyncCommit = z.object({
			hash: z.string(),
			short: z.string(),
			author: z.string(),
			date: z.string(),
			subject: z.string()
		});
		const gitSyncFile = z.object({
			path: z.string(),
			added: z.union([z.number(), z.null()]),
			removed: z.union([z.number(), z.null()]),
			status: z.string()
		});
		const gitSyncResult = z.object({
			ok: z.boolean(),
			upstream: z.string(),
			ahead: z.array(gitSyncCommit),
			behind: z.array(gitSyncCommit),
			aheadFiles: z.array(gitSyncFile),
			behindFiles: z.array(gitSyncFile),
			mergeBase: z.string()
		});
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
		const gitBranchSyncsResult = z.object({
			ok: z.boolean(),
			branches: z.array(z.object({ branch: z.string(), ahead: z.array(z.string()), behind: z.array(z.string()) })).optional(),
			error: z.string().optional()
		});
		const gitRangeDiffResult = z.object({
			ok: z.boolean(),
			from: z.string(),
			to: z.string(),
			files: z.array(z.object({
				path: z.string(),
				added: z.union([z.number(), z.null()]),
				removed: z.union([z.number(), z.null()]),
				binary: z.boolean(),
				status: z.string()
			})),
			patch: z.string(),
			truncated: z.boolean(),
			error: z.string().optional()
		});
		const gitRemoteInfoResult = z.object({
			ok: z.boolean(),
			name: z.string(),
			url: z.string(),
			host: z.string(),
			owner: z.string(),
			repo: z.string(),
			github: z.boolean()
		});
		const gitRepoConfigResult = z.object({
			ok: z.boolean(),
			userName: z.string().optional(),
			userEmail: z.string().optional(),
			credentialUser: z.string().optional(),
			error: z.string().optional()
		});
		const gitGitignoreResult = z.object({
			ok: z.boolean(),
			exists: z.boolean(),
			content: z.string(),
			error: z.string().optional()
		});
		const gitGitignoreRestoreResult = z.object({
			ok: z.boolean(),
			message: z.string().optional(),
			content: z.string().optional(),
			error: z.string().optional()
		});
		const gitGitignoreCheckResult = z.object({
			ok: z.boolean(),
			ignored: z.boolean().optional(),
			match: z.string().optional(),
			error: z.string().optional()
		});
		const gitGitignoreFilesResult = z.object({
			ok: z.boolean(),
			files: z.array(z.string()).optional(),
			truncated: z.boolean().optional(),
			error: z.string().optional()
		});
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
		const withCommit = z.object({ path: z.string(), commit: z.string(), mode: z.string().optional() }).passthrough();
		const withPaths = z.object({ path: z.string(), paths: z.array(z.string()) }).passthrough();
		const withName = z.object({ path: z.string(), name: z.string() }).passthrough();
		const withFile = z.object({ path: z.string(), file: z.string() }).passthrough();
		const withKind = z.object({ path: z.string(), kind: z.string() }).passthrough();
		const withOptionalPaths = z.object({ path: z.string(), paths: z.array(z.string()).optional() }).passthrough();
		const TYPERT_REMOTE = {
			// The contribution belongs to THIS package now (it used to name the
			// separate remote plugin); descriptor ids already use PKG.
			package: PKG,
			descriptors: [
				descrip("snapshot", "GitSnapshotResult", gitSnapshotResult),
				descrip("log", "GitLogResult", gitLogResult),
				descrip("status", "GitStatusResult", gitStatusResult),
				descrip("diff", "GitDiffResult", gitDiffResult, withCommit),
				descrip("branch", "GitBranchResult", gitBranchResult),
				descrip("branchDetails", "GitBranchDetailsResult", gitBranchDetailsResult),
				descrip("syncCommits", "GitSyncResult", gitSyncResult),
				descrip("remoteBranches", "GitRemoteBranchesResult", gitRemoteBranchesResult),
				descrip("branchSyncs", "GitBranchSyncsResult", gitBranchSyncsResult),
				descrip("linkUpstream", "GitWriteResult", gitWriteResult, z.object({ path: z.string(), branch: z.string(), upstream: z.string() }).passthrough()),
				descrip("remoteInfo", "GitRemoteInfoResult", gitRemoteInfoResult),
				descrip("repoConfig", "GitRepoConfigResult", gitRepoConfigResult),
				descrip("repoConfigWrite", "GitWriteResult", gitWriteResult, z.object({
					path: z.string(),
					userName: z.string().optional(),
					userEmail: z.string().optional(),
					credentialUser: z.string().optional()
				}).passthrough()),
				descrip("gitignoreRead", "GitGitignoreResult", gitGitignoreResult),
				descrip("gitignoreWrite", "GitWriteResult", gitWriteResult, z.object({ path: z.string(), content: z.string() }).passthrough()),
				descrip("gitignoreRestore", "GitGitignoreRestoreResult", gitGitignoreRestoreResult),
				descrip("gitignoreCheck", "GitGitignoreCheckResult", gitGitignoreCheckResult, z.object({ path: z.string(), target: z.string() }).passthrough()),
				descrip("gitignoreFiles", "GitGitignoreFilesResult", gitGitignoreFilesResult, z.object({ path: z.string(), limit: z.number().optional() }).passthrough()),
				descrip("openPath", "GitWriteResult", gitWriteResult, z.object({ path: z.string(), file: z.string().optional() }).passthrough()),
				descrip("fetchRemote", "GitWriteResult", gitWriteResult, z.object({ path: z.string(), remote: z.string().optional(), account: z.string().optional() }).passthrough()),
				descrip("pullRemote", "GitMergeResult", gitMergeResult, z.object({ path: z.string(), remote: z.string().optional(), branch: z.string().optional(), account: z.string().optional() }).passthrough()),
				descrip("pushRemote", "GitMergeResult", gitMergeResult, z.object({
					path: z.string(),
					remote: z.string().optional(),
					branch: z.string().optional(),
					setUpstream: z.boolean().optional(),
					force: z.boolean().optional(),
					account: z.string().optional()
				}).passthrough()),
				descrip("rangeDiff", "GitRangeDiffResult", gitRangeDiffResult, z.object({
					path: z.string(),
					from: z.string(),
					to: z.string(),
					paths: z.array(z.string()).optional()
				}).passthrough()),
				descrip("addRemote", "GitWriteResult", gitWriteResult, z.object({ path: z.string(), url: z.string(), name: z.string().optional() }).passthrough()),
				descrip("removeRemote", "GitWriteResult", gitWriteResult, z.object({ path: z.string(), name: z.string().optional() }).passthrough()),
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
				descrip("rebase", "GitMergeResult", gitMergeResult, z.object({ path: z.string(), upstream: z.string(), source: z.string().optional() }).passthrough()),
				descrip("rebaseSkip", "GitMergeResult", gitMergeResult, z.object({ path: z.string() }).passthrough()),
				descrip("mergePreview", "GitMergePreviewResult", gitMergePreviewResult, z.object({ path: z.string(), target: z.string(), source: z.string() }).passthrough()),
				descrip("stash", "GitStashResult", gitStashResult, z.object({ path: z.string(), action: z.string(), message: z.string().optional(), ref: z.string().optional(), includeUntracked: z.boolean().optional(), all: z.boolean().optional(), paths: z.array(z.string()).optional(), index: z.boolean().optional(), staged: z.boolean().optional(), keepIndex: z.boolean().optional(), branch: z.string().optional() }).passthrough()),
				descrip("add", "GitWriteResult", gitWriteResult, withPaths),
				descrip("unstage", "GitWriteResult", gitWriteResult, withPaths),
				descrip("deleteBranch", "GitWriteResult", gitWriteResult, withName),
				descrip("renameBranch", "GitWriteResult", gitWriteResult, z.object({ path: z.string(), from: z.string(), to: z.string(), renameRemote: z.boolean().optional(), account: z.string().optional() }).passthrough()),
				descrip("operationContinue", "GitWriteResult", gitWriteResult, withKind),
				descrip("operationAbort", "GitWriteResult", gitWriteResult, withKind),
				descrip("restore", "GitWriteResult", gitWriteResult, withOptionalPaths),
				descrip("reset", "GitWriteResult", gitWriteResult, withCommit),
				descrip("readPluginState", "GitPluginStateResult", gitPluginStateResult, z.object({ path: z.string(), key: z.string() }).passthrough()),
				descrip("writePluginState", "GitPluginStateResult", gitPluginStateResult, z.object({ path: z.string(), key: z.string(), value: z.string().optional() }).passthrough()),
				descrip("reflogBackup", "GitReflogBackupResult", gitReflogBackupResult),
				descrip("reflogBackupRead", "GitReflogBackupReadResult", gitReflogBackupReadResult),
				descrip("reflogBackupConfig", "GitReflogBackupConfigResult", gitReflogBackupConfigResult, z.object({ path: z.string(), enabled: z.boolean().optional() }).passthrough()),
				// Settings panel: plugin-wide, no workspace path in the request.
				descrip("pluginSettings", "GitPluginSettings", gitPluginSettings, z.object({}).passthrough()),
				descrip("pluginSettingsUpdate", "GitPluginSettings", gitPluginSettings, z.object({
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
					prInMoreMenu: z.boolean().optional(),
					chatElementKey: z.string().optional(),
					syncHiddenHint: z.boolean().optional(),
					mcpAccount: z.string().optional()
				}).passthrough()),
				// GitHub authentication (Git Credential Manager); plugin-wide.
				descrip("checkDependency", "GitDependencyResult", gitDependencyResult, z.object({ target: z.string().optional() }).passthrough()),
				descrip("githubAccounts", "GitGithubAccounts", gitGithubAccounts, z.object({}).passthrough()),
				descrip("githubUser", "GitGithubUser", gitGithubUser, z.object({ account: z.string().optional() }).passthrough()),
				descrip("repoPermission", "GitRepoPermission", gitRepoPermission, z.object({ account: z.string().optional(), owner: z.string(), repo: z.string() }).passthrough()),
				descrip("createRepo", "GitCreateRepoResult", gitCreateRepoResult, z.object({
					account: z.string().optional(),
					options: z.object({
						name: z.string(),
						description: z.string().optional(),
						private: z.boolean().optional()
					})
				}).passthrough()),
				descrip("repoInfo", "GitRepoInfoResult", gitRepoInfoResult, z.object({
					account: z.string().optional(),
					owner: z.string(),
					repo: z.string()
				}).passthrough()),
				descrip("listAllPullRequests", "GitPullRequestsAllResult", gitPullRequestsAllResult, z.object({
					account: z.string().optional(),
					owner: z.string(),
					repo: z.string(),
					branch: z.string().optional()
				}).passthrough()),
				descrip("createPullRequest", "GitCreatePrResult", gitCreatePrResult, z.object({
					account: z.string().optional(),
					owner: z.string(),
					repo: z.string(),
					options: z.object({
						title: z.string(),
						body: z.string().optional(),
						head: z.string(),
						base: z.string()
					})
				}).passthrough()),
				descrip("listPullRequests", "GitPullRequestsResult", gitPullRequestsResult, z.object({
					account: z.string().optional(),
					owner: z.string(),
					repo: z.string(),
					branch: z.string().optional()
				}).passthrough()),
				descrip("githubLoginStart", "GitGithubLoginStart", gitGithubLoginStart, z.object({}).passthrough()),
				descrip("githubLoginPoll", "GitGithubLoginPoll", gitGithubLoginPoll, z.object({ id: z.string() }).passthrough()),
				descrip("githubLoginCancel", "GitGithubAction", gitGithubAction, z.object({ id: z.string() }).passthrough()),
				descrip("githubLoginToken", "GitGithubAction", gitGithubAction, z.object({ token: z.string() }).passthrough()),
				descrip("githubLogout", "GitGithubAction", gitGithubAction, z.object({ account: z.string() }).passthrough())
			]
		};

		//#region styles
		const css = [
			".dshg-root{--dshg-border:var(--dsw-alias-border-l2);--dshg-muted:var(--dsw-alias-label-tertiary);--dshg-text:var(--dsw-alias-label-primary);--dshg-sub:var(--dsw-alias-label-secondary);--dshg-hover:var(--dsw-alias-interactive-bg-hover);--dshg-danger:var(--dsw-alias-state-error-primary,#d5482f);--dshg-ok:var(--dsw-alias-state-success-primary,#1e8e5a);--dshg-warn:var(--dsw-alias-state-warning-primary,#c98a1b);--dshg-solid:var(--dsw-alias-bg-layer-2,#fff);--dshg-drawer-width:min(440px,100vw - 32px);box-sizing:border-box;font-family:var(--dsw-font-ui,inherit);font-size:13px;line-height:18px}",
			"@media (prefers-color-scheme:dark){.dshg-root{--dshg-solid:var(--dsw-alias-bg-layer-2,#1b1b1f)}}",
			// Mask stays at 900. The drawer must still paint above the mask (otherwise
			// the mask dims it), yet sit below the top bar: 950 leaves room for a top
			// bar with z-index >= 951 to cover it, and keeps it above page content.
			// Its content starts below the top bar strip (padding), while the panel
			// background itself reaches y=0. The mask simply stops at the drawer's left
			// edge (right offset) instead of being masked out, so it never sits under a
			// translucent panel.
			".dshg-overlay{position:fixed;top:0;left:0;right:var(--dshg-drawer-width,min(440px,100vw - 32px));bottom:0;background:var(--dsw-alias-bg-mask-1);z-index:900;animation:dshg-fade .15s ease-out}",
			// Dark mode: the mask covers the whole screen (the drawer sits above it, so a
			// translucent panel simply reads a little deeper).
			"@media (prefers-color-scheme:dark){.dshg-overlay{right:0}}",
			"@keyframes dshg-fade{from{opacity:0}}",
			".dshg-drawer{position:fixed;top:0;right:0;bottom:0;width:var(--dshg-drawer-width,min(440px,100vw - 32px));padding-top:var(--dshg-bar-height,40px);background:var(--dshg-solid,var(--dsw-specific-menu,#fff));border-left:1px solid var(--dshg-border);z-index:950;display:flex;flex-direction:column;box-shadow:var(--dsw-shadow-lv3,none);animation:dshg-slide .18s var(--ds-ease-in-out, ease-out)}",
			"@keyframes dshg-slide{from{transform:translateX(24px);opacity:0}}",
			".dshg-header{display:flex;flex-direction:column;align-items:stretch;gap:3px;padding:10px 14px;border-bottom:1px solid var(--dshg-border);flex:none}",
			".dshg-headerTop{display:flex;align-items:center;gap:8px;min-width:0}",
			".dshg-headerBranch{font-size:10.5px;line-height:14px;color:var(--dshg-muted);padding-left:24px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-headerBranchWarn{color:var(--dshg-warn)}",
			".dshg-title{font-size:14px;font-weight:600;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}",
			// Header GitHub icon doubles as a link to the repository page.
			".dshg-repoLink{flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0;border:none;border-radius:4px;background:transparent;color:var(--dshg-text);cursor:pointer;line-height:1}",
			".dshg-repoLink:hover:not(:disabled){color:var(--dsw-alias-accent,#3b82f6)}",
			".dshg-repoLink:disabled{cursor:default}",
			".dshg-badge{display:inline-flex;align-items:center;gap:4px;max-width:140px;padding:1px 8px;border-radius:999px;font-family:var(--dsw-font-ui,inherit);font-size:11px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--dsw-alias-fill-l2);color:var(--dshg-sub);border:1px solid var(--dshg-border);flex:none}",
			".dshg-badgeOk{color:var(--dshg-ok)}",
			".dshg-badgeWarn{color:var(--dshg-warn)}",
			".dshg-iconButton{cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:8px;background:transparent;color:var(--dshg-sub);flex:none;padding:0}",
			".dshg-iconButton:hover{background:var(--dshg-hover);color:var(--dshg-text)}",
			".dshg-body{flex:1;min-height:0;overflow:hidden;padding:10px 14px 16px;display:flex;flex-direction:column;gap:10px}",
			".dshg-summary{display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
			".dshg-chip{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:6px;font-size:11px;line-height:18px;background:var(--dsw-alias-fill-l2);color:var(--dshg-sub);flex:none}",
			".dshg-chipB{color:var(--dshg-text)}",
			".dshg-chipA{color:var(--dshg-ok)}",
			".dshg-chipM{color:var(--dshg-warn)}",
			".dshg-chipD{color:var(--dshg-danger)}",
			".dshg-section{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--dshg-muted);margin:4px 0 2px}",
			".dshg-empty{color:var(--dshg-muted);font-size:12px;padding:8px 2px}",
			".dshg-fileRow{display:flex;align-items:center;gap:8px;padding:3px 4px;border-radius:6px;min-width:0}",
			".dshg-fileRow:hover{background:var(--dshg-hover)}",
			".dshg-fileStatus{flex:none;width:18px;text-align:center;font-family:var(--dsw-font-ui,inherit);font-size:11px;font-weight:700}",
			".dshg-filePath{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dshg-text);font-family:var(--dsw-font-ui,inherit);font-size:12px}",
			".dshg-groupRow{display:flex;align-items:center;gap:6px;padding:4px 4px;border-radius:6px;cursor:pointer;color:var(--dshg-sub);min-width:0}",
			// Unified, always-visible custom scrollbars for the three panes so a
			// vertical bar never silently vanishes (browser overlay scrollbars
			// hide themselves; ::-webkit-scrollbar renders deterministically).
			// Keep the thumb a plain solid rounded bar — a transparent border +
			// background-clip trick makes short thumbs nearly invisible (you can
			// still drag an invisible thumb; that matched the reported bug).
			".dshg-statusPane,.dshg-timeline,.dshg-diffPane{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2,#c2ccd9) transparent}",
			".dshg-statusPane::-webkit-scrollbar,.dshg-timeline::-webkit-scrollbar,.dshg-diffPane::-webkit-scrollbar{width:8px;height:8px}",
			".dshg-statusPane::-webkit-scrollbar-thumb,.dshg-timeline::-webkit-scrollbar-thumb,.dshg-diffPane::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,#c2ccd9);border-radius:4px;min-height:24px}",
			".dshg-statusPane::-webkit-scrollbar-thumb:hover,.dshg-timeline::-webkit-scrollbar-thumb:hover,.dshg-diffPane::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2,#9aa8b8);min-height:24px}",
			".dshg-statusPane::-webkit-scrollbar-track,.dshg-timeline::-webkit-scrollbar-track,.dshg-diffPane::-webkit-scrollbar-track{background:transparent}",
			".dshg-groupCaret{flex:none;width:12px;text-align:center;font-size:10px;color:var(--dshg-muted);transition:transform .12s var(--ds-ease-in-out,ease-out)}",
			".dshg-groupCaretOpen{transform:rotate(90deg)}",
			".dshg-groupIcon{flex:none;color:var(--dshg-sub)}",
			".dshg-groupName{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-ui,inherit);font-size:12px;color:var(--dshg-sub)}",
			".dshg-groupCount{flex:none;color:var(--dshg-muted);font-size:11px}",
			".dshg-groupFiles{padding-left:22px}",
			// Content-driven panes. The "feature" pane (working tree when idle,
			// diff when a commit is selected) NEVER shrinks: it renders at its
			// natural height and only starts scrolling once THAT pane's own
			// content exceeds its cap (70% / 60%). The timeline instead carries
			// all shrink/grow — it fills whatever remains and scrolls freely,
			// so it may never be the reason a compact status list scrolls.
			".dshg-statusPane{flex:0 0 auto;min-height:0;max-height:70%;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px;border-bottom:1px solid var(--dshg-border)}",
			".dshg-timeline{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding-right:2px}",
			".dshg-diffPane{display:none}",
			".dshg-mode-detail .dshg-statusPane{display:none}",
			".dshg-mode-detail .dshg-timeline{flex:1 1 auto;min-height:0;overflow-y:auto}",
			".dshg-mode-detail .dshg-diffPane{flex:0 0 auto;min-height:0;max-height:60%;overflow-y:auto;border-top:1px solid var(--dshg-border);padding-top:8px;display:flex;flex-direction:column;gap:6px}",
			".dshg-diffHint{color:var(--dshg-muted);font-size:12px;text-align:center;padding:24px 8px}",
			".dshg-ops{display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex:none}",
			".dshg-op{cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:7px;border:1px solid var(--dshg-border);background:transparent;color:var(--dshg-sub);font-size:12px;line-height:18px;flex:none}",
			".dshg-op:hover{background:var(--dshg-hover);color:var(--dshg-text)}",
			".dshg-opDisabled{opacity:.5;cursor:not-allowed}",
			".dshg-opPrimary{background:var(--dsw-alias-accent-bg,transparent);color:var(--dsw-alias-accent,#3b82f6);border-color:var(--dsw-alias-accent-border,transparent)}",
			".dshg-opDanger{color:var(--dshg-danger);border-color:var(--dshg-danger)}",
			// Primary + danger (force push): the later primary rule would otherwise win
			// on border-color, leaving a blue frame around red text.
			".dshg-opPrimary.dshg-opDanger{border-color:var(--dshg-danger)}",
			".dshg-opDanger:hover{background:color-mix(in srgb,var(--dshg-danger) 12%,transparent);color:var(--dshg-danger)}",
			".dshg-busy{width:12px;height:12px;border-radius:50%;border:2px solid var(--dshg-border);border-top-color:var(--dshg-sub);animation:dshg-spin .7s linear infinite;flex:none;display:inline-block;vertical-align:-2px}",
			".dshg-opMsg{padding:6px 10px;border-radius:7px;font-size:12px;line-height:18px;flex:none;max-width:100%;max-height:72px;overflow-y:auto;white-space:pre-wrap;word-break:break-word}",
			".dshg-opMsgOk{color:var(--dshg-ok);background:color-mix(in srgb,var(--dshg-ok) 10%,transparent)}",
			".dshg-opMsgErr{color:var(--dshg-danger);background:color-mix(in srgb,var(--dshg-danger) 10%,transparent)}",
			// Side padding keeps the card off the drawer edges: the card widths below
			// are relative to this content box (100%), not to the viewport.
			".dshg-modal{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:950;background:var(--dsw-alias-bg-mask-2,transparent);padding:0 12px;box-sizing:border-box}",
			".dshg-modalTop{z-index:980}",
			".dshg-modalScreen{position:fixed}",
			".dshg-modalCard{width:min(360px,100%);box-sizing:border-box;max-height:80vh;overflow-y:auto;background:var(--dshg-solid,var(--dsw-specific-menu,#fff));border:1px solid var(--dshg-border);border-radius:12px;padding:16px;box-shadow:var(--dsw-shadow-lv3,none);display:flex;flex-direction:column;gap:10px}",
			".dshg-modalTitle{font-size:14px;font-weight:600;color:var(--dshg-text)}",
			".dshg-modalDesc{font-size:12px;line-height:20px;color:var(--dshg-sub)}",
			".dshg-modalList{max-height:140px;overflow-y:auto;border:1px solid var(--dshg-border);border-radius:7px;padding:4px;font-family:var(--dsw-font-ui,inherit);font-size:11px;color:var(--dshg-sub);display:flex;flex-direction:column;gap:2px}",
			".dshg-input{box-sizing:border-box;width:100%;padding:6px 9px;border-radius:7px;border:1px solid var(--dshg-border);background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dshg-text);font-size:12px;font-family:var(--dsw-font-ui,inherit)}",
			".dshg-input:focus{outline:none;border-color:var(--dshg-sub)}",
			".dshg-modalActions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}",
			".dshg-notRepo{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--dshg-muted);text-align:center;padding:24px;min-height:0}",
			".dshg-notRepoIcon{color:var(--dshg-border);flex:none}",
			".dshg-notRepoTitle{font-size:14px;font-weight:600;color:var(--dshg-sub)}",
			".dshg-notRepoDesc{font-size:12px;line-height:20px;max-width:280px}",
			".dshg-commitRow{display:flex;gap:8px;border-radius:8px;cursor:pointer;padding:5px 6px;min-width:0}",
			".dshg-commitRow:hover{background:var(--dshg-hover)}",
			".dshg-commitRowSel{background:var(--dshg-hover)}",
			".dshg-graph{flex:none;width:22px;display:flex;flex-direction:column;align-items:center;position:relative}",
			".dshg-graphLine{flex:1;width:2px;background:var(--dshg-border);min-height:8px}",
			".dshg-graphDot{width:10px;height:10px;border-radius:50%;margin:2px 0;border:2px solid var(--dsw-alias-bg-layer-2,var(--dsw-specific-menu));flex:none;box-sizing:border-box}",
			".dshg-dotHead{background:var(--dshg-text)}",
			".dshg-dotBranch{background:var(--dshg-ok)}",
			".dshg-dotMerge{background:var(--dshg-warn)}",
			".dshg-dotPlain{background:var(--dsw-alias-fill-l3,#a7b3c6)}",
			// Timeline dots for commits that are not yet in sync: solid amber = would be
			// pushed, hollow dashed = would be pulled in. Two classes on purpose: the
			// base `.dshg-node` rule sets a solid border and is declared later, so a
			// single-class rule loses the border to it.
			".dshg-node.dshg-dotAhead{background:var(--dshg-warn)}",
			// Hollow dashed ring drawn as an inline SVG: dash and gap are equal, the gap
			// is tight, and the ring sits just inside the node edge (so the hover ring
			// outside it reads as a separate circle).
			".dshg-node.dshg-dotBehind{background:transparent;border:0;overflow:visible}",
			".dshg-syncRing{position:absolute;inset:0;pointer-events:none}",
			// Merge commits that still need a sync get their own treatment: a solid
			// branch-coloured glyph with an amber rim for "push", and the same dashed
			// ring for "pull" (drawn inside the node, tight against the hover ring).
			".dshg-node.dshg-mergePush{width:12px;height:12px;border:2px solid var(--dshg-warn)}",
			".dshg-node.dshg-mergePull{width:12px;height:12px;background:transparent;border:0;overflow:visible;box-shadow:0 0 3px color-mix(in srgb,var(--dshg-text) 22%,transparent)}",
			".dshg-commitMain{flex:1;min-width:0}",
			".dshg-commitSubject{color:var(--dshg-text);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-commitMeta{color:var(--dshg-muted);font-size:11px;display:flex;gap:6px;align-items:center;margin-top:1px;white-space:nowrap;overflow:hidden}",
			".dshg-refs{display:flex;gap:4px;flex-wrap:wrap;max-height:0;margin-top:0;overflow:hidden;transition:max-height .22s var(--ds-ease-in-out,ease-out),margin-top .22s var(--ds-ease-in-out,ease-out)}",
			".dshg-refsShow{max-height:96px;margin-top:3px}",
			".dshg-ref{font-size:10px;line-height:16px;padding:0 5px;border-radius:4px;background:var(--dsw-alias-fill-l2);color:var(--dshg-sub);font-family:var(--dsw-font-ui,inherit);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-refHead{color:var(--dshg-text);border:1px solid var(--dshg-border)}",
			".dshg-refRemote{display:inline-flex;align-items:center;gap:3px}",
			// Fetch failed: the retry button in the header turns amber.
			".dshg-fetchFail{color:var(--dshg-warn)}",
			".dshg-fetchFail:hover{color:var(--dshg-warn)}",
			".dshg-diffFiles{margin-top:2px}",
			".dshg-diffFileRow{display:flex;align-items:center;gap:8px;padding:2px 4px;border-radius:6px}",
			".dshg-num{flex:none;min-width:30px;text-align:right;font-family:var(--dsw-font-ui,inherit);font-size:11px}",
			".dshg-numAdd{color:var(--dshg-ok)}",
			".dshg-numDel{color:var(--dshg-danger)}",
			".dshg-patch{margin:6px 0 2px;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dshg-border);overflow:auto;max-height:280px}",
			".dshg-patch pre{margin:0;font-family:var(--dsw-font-ui,inherit);font-size:11px;line-height:16px;color:var(--dshg-sub);white-space:pre}",
			".dshg-error{color:var(--dshg-danger);font-size:12px;padding:6px 2px}",
			".dshg-loading{color:var(--dshg-muted);font-size:12px;padding:8px 2px;display:flex;align-items:center;gap:8px}",
			".dshg-spinner{width:12px;height:12px;border-radius:50%;border:2px solid var(--dshg-border);border-top-color:var(--dshg-sub);animation:dshg-spin .7s linear infinite;flex:none}",
			"@keyframes dshg-spin{to{transform:rotate(360deg)}}",
			".dshg-footerBtn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:none;background:transparent;border-radius:50%;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;margin:8px 0 10px}",
			".dshg-footerBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dshg-footerBadge{position:absolute;top:-2px;right:-2px;min-width:14px;height:14px;padding:0 3px;border-radius:999px;background:var(--dshg-warn);color:#fff;font-size:9px;line-height:14px;text-align:center;font-weight:700;box-sizing:border-box}",
			".dshg-footerBranch{max-width:none;flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-ui,inherit);font-size:12px;color:var(--dsw-alias-label-tertiary)}",
			".dshg-footerLabel{position:relative;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;width:calc(100% + 8px);height:34px;margin:4px -4px;padding:6px 2px 6px 10px;border-radius:12px;cursor:pointer;color:var(--dsw-alias-label-primary);background:transparent;border:none;font-family:inherit;font-size:14px;line-height:22px;min-width:0;overflow:hidden}",
			".dshg-footerLabel:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			// The Arona theme's `[class*='footer']{background:transparent !important}`
			// also matches these git button classes (ids contain "footer"), which
			// would kill the hover highlight. Re-assert with a more specific rule.
			"body[data-arona-theme] :is([data-pane='sidebar'],[class*='sidebarCol']) .dshg-footerLabel:hover,body[data-arona-theme] :is([data-pane='sidebar'],[class*='sidebarCol']) .dshg-footerBtn:hover{background:var(--dsw-alias-interactive-bg-hover) !important;color:var(--dsw-alias-label-primary) !important}",
			".dshg-detached{color:var(--dshg-muted);font-size:12px}",
			".dshg-trunc{color:var(--dshg-muted);font-size:11px;margin-top:2px}",
			// --- worktree sections / timeline / detail (2026-10-21 UI rebuild) ---
			".dshg-body{position:relative}",
			".dshg-opsBar{display:flex;flex-wrap:nowrap;gap:3px;align-items:center;flex:none;padding:8px 10px;overflow:visible}",
			".dshg-opsLeft{display:flex;gap:4px;align-items:center;flex:none;overflow:hidden;max-width:600px;margin-right:auto;transition:max-width .2s ease .24s,opacity .14s ease .24s}",
			// Coming back must wait for the more bar to finish shrinking: otherwise the
			// row is briefly wider than the drawer and the bar pushes past the right
			// edge before snapping back.
			".dshg-opsLeftHidden{max-width:0;opacity:0;pointer-events:none;transition-delay:0s}",
			".dshg-opsRightHidden{width:0;min-width:0;padding:0;border:0;margin:0;opacity:0;overflow:hidden;pointer-events:none}",
			".dshg-opsBar::-webkit-scrollbar{display:none}",
			".dshg-opsBar .dshg-op{font-size:10.5px;line-height:16px;padding:2px 5px;gap:3px}",
			".dshg-opsBar .dshg-opIcon{padding:2px 6px}",
			// Branch button collapses with the rest of the bar. It used to be removed
			// from the tree while the more bar was open, so on the way back it popped
			// in instead of fading like the left-hand buttons. The slot collapses its
			// own width (the button keeps its padding) and gives back the flex gaps.
			".dshg-branchSlot{display:flex;flex:none;overflow:hidden;max-width:40px;transition:max-width .18s ease .24s,opacity .14s ease .24s}",
			".dshg-branchSlotOut{max-width:0;opacity:0;margin-left:-4px;margin-right:-4px;pointer-events:none;transition-delay:0s}",
			".dshg-main{position:relative;flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:8px 12px 12px}",
			// Missing runtime dependency (git): a full-area placeholder over the panel.
			".dshg-depMissing{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--dshg-solid,var(--dsw-specific-menu,#fff));padding:24px;text-align:center}",
			".dshg-depIcon{position:relative;display:inline-flex;align-items:center;justify-content:center;color:var(--dshg-muted)}",
			".dshg-depBadge{position:absolute;right:-8px;bottom:-6px;width:20px;height:20px;border-radius:50%;background:var(--dshg-solid,var(--dsw-specific-menu,#fff));border:1.5px solid var(--dshg-danger,#d5482f);color:var(--dshg-danger,#d5482f);font-size:13px;line-height:17px;text-align:center;font-weight:600}",
			".dshg-depText{font-size:12.5px;line-height:18px;color:var(--dshg-muted);max-width:260px}",
			".dshg-clean{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 16px;color:var(--dshg-muted)}",
			".dshg-cleanText{font-size:13px;color:var(--dshg-sub)}",
			".dshg-cleanSub{font-size:11px;line-height:15px;color:var(--dshg-muted);text-align:center}",
			// ---- pending sync bubbles (shown instead of the clean placeholder) ----
			// Full width of the panel body: the bubble card itself carries the colour,
			// not just the dot (green = would push, amber = would pull).
			// flex:none on both levels is what stops the clipping: as flex children they
			// default to flex-shrink:1, so once the content filled the rounded box the
			// browser shrank the bubble, and overflow:hidden (needed for the radius) cut
			// the bottom off. It only showed up after the box was "full", which is
			// exactly the shrink kicking in. Not shrinking makes the parent scroll instead.
			".dshg-bubbles{display:flex;flex-direction:column;gap:8px;padding:0 0 4px;flex:none}",
			".dshg-bubble{flex:none;border-radius:10px;overflow:hidden;border:1px solid transparent}",
			".dshg-bubblePull{background:color-mix(in srgb,var(--dshg-warn) 15%,transparent);border-color:color-mix(in srgb,var(--dshg-warn) 42%,transparent)}",
			".dshg-bubblePush{background:color-mix(in srgb,var(--dshg-ok) 15%,transparent);border-color:color-mix(in srgb,var(--dshg-ok) 42%,transparent)}",
			".dshg-bubbleHead{display:flex;align-items:center;gap:7px;width:100%;padding:8px 11px;background:transparent;border:0;font:inherit;font-size:12px;color:var(--dshg-text);cursor:pointer;text-align:left}",
			".dshg-bubbleHead:hover{background:color-mix(in srgb,var(--dshg-text) 7%,transparent)}",
			".dshg-bubbleDot{flex:none;width:8px;height:8px;border-radius:50%}",
			".dshg-bubblePull .dshg-bubbleDot{background:var(--dshg-warn)}",
			".dshg-bubblePush .dshg-bubbleDot{background:var(--dshg-ok)}",
			".dshg-bubbleLabel{flex:1;min-width:0}",
			".dshg-bubbleCaret{flex:none;font-size:10px;color:var(--dshg-muted)}",
			".dshg-bubbleBody{display:grid;grid-template-rows:0fr;overflow:hidden;opacity:0;transition:grid-template-rows .3s cubic-bezier(.22,.75,.28,1),opacity .24s ease}",
			".dshg-bubbleBodyInner{min-height:0;overflow:hidden;display:flex;flex-direction:column}",
			// Expanded: the two halves scroll INDEPENDENTLY. Commits take at most 40%
			// of the open body, changes at most 60%. The caps are calc() off a fixed
			// height rather than percentages: a percentage max-height resolves against
			// the parent's used height, which here depends on the children, and that
			// made the scroll area a few pixels shorter than its content (the last
			// row stayed clipped even at the bottom).
			".dshg-bubbleBodyOpen{grid-template-rows:1fr;opacity:1}",
			".dshg-bubbleBodyOpen .dshg-bubbleBodyInner{max-height:var(--dshg-cap,33vh);overflow:hidden}",
			".dshg-chain{flex:0 1 auto;min-height:0;max-height:calc(var(--dshg-bubble-h) * .4);overflow-y:hidden;display:flex;flex-direction:column;padding:2px 10px 6px}",
			".dshg-chain.dshg-scrollReady{overflow-y:auto}",
			".dshg-chainFiles.dshg-scrollReady{overflow-y:auto}",
			".dshg-chain::-webkit-scrollbar{width:0;height:0}",
			".dshg-chainItem{position:relative;display:flex;align-items:center;gap:6px;padding:4px 0 4px 14px;cursor:pointer;border-radius:6px}",
			".dshg-chainItem:hover{background:var(--dshg-hover)}",
			".dshg-chainItem::before{content:'';position:absolute;left:3px;top:0;bottom:0;width:1px;background:var(--dshg-border)}",
			".dshg-chainItem:first-child::before{top:50%}",
			".dshg-chainItem:last-child::before{bottom:50%}",
			// Half the old size (7px -> 4px). Styling by direction happens on the
			// timeline's commit dots, not here.
			".dshg-chainNode{position:absolute;left:1px;top:50%;margin-top:-2px;box-sizing:border-box;width:4px;height:4px;border-radius:50%;background:var(--dshg-sub)}",
			".dshg-chainHash{flex:none;font-family:var(--dsw-font-ui,inherit);font-size:10px;color:var(--dshg-muted)}",
			".dshg-chainSubject{flex:1;min-width:0;font-size:11.5px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-chainAuthor{flex:none;font-size:10px;color:var(--dshg-muted)}",
			// The changes half: a non-scrolling head + a scroller that fills the rest.
			// Capping the BLOCK (not the scroller) is what keeps the last row reachable:
			// the scroller's own height is then whatever is actually left over, so it
			// cannot claim more room than it has.
			".dshg-changesBlock{flex:0 1 auto;min-height:0;max-height:calc(var(--dshg-bubble-h) * .6);display:flex;flex-direction:column;border-top:1px solid var(--dshg-border)}",
			".dshg-chainFilesHead{flex:none;font-size:10px;color:var(--dshg-muted);padding:6px 10px 4px}",
			".dshg-chainFiles{flex:1 1 auto;min-height:0;overflow-y:hidden;padding:0 10px 16px}",
			// Existing PR row inside the push bubble.
			".dshg-cleanBlock{display:flex;flex-direction:column;gap:8px}",
			// Pull request list: one purple capsule holding every PR that touches this branch.
			".dshg-prList{border-color:color-mix(in srgb,#8b5cf6 42%,transparent);background:color-mix(in srgb,#8b5cf6 10%,transparent);margin:3px 0}",
			".dshg-prListHead{font-size:12.5px;color:var(--dshg-sub)}",
			".dshg-prListIcon{flex:none;display:inline-flex;color:#a78bfa}",
			".dshg-prListHead:hover{color:var(--dshg-text)}",
			".dshg-prListSummary{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshg-prListBody{display:grid;grid-template-rows:0fr;overflow:hidden;opacity:0;transition:grid-template-rows .3s cubic-bezier(.22,.75,.28,1),opacity .24s ease}",
			".dshg-bubbleBodyInner.dshg-prListBodyInner{gap:7px;padding:0;transition:padding .3s cubic-bezier(.22,.75,.28,1),gap .3s cubic-bezier(.22,.75,.28,1)}",
			".dshg-bubbleBodyOpen .dshg-bubbleBodyInner.dshg-prListBodyInner{gap:7px;padding:8px 10px 6px}",
			".dshg-prRow .dshg-bubbleBodyInner{gap:5px;padding:0;transition:padding .3s cubic-bezier(.22,.75,.28,1),gap .3s cubic-bezier(.22,.75,.28,1)}",
			".dshg-prRow .dshg-bubbleBodyOpen .dshg-bubbleBodyInner{gap:5px;padding:6px 8px 8px}",
			".dshg-prListOpen .dshg-prListBody{grid-template-rows:1fr;opacity:1}",
			".dshg-prRow{display:flex;flex-direction:column;max-height:400px;border-radius:8px;background:color-mix(in srgb,var(--dshg-text) 5%,transparent);overflow:hidden;transition:max-height .19s ease,opacity .19s ease}",
			".dshg-prRowOut{max-height:0;opacity:0;pointer-events:none}",
			// Header wrapper hosts the dismiss control OUTSIDE the header button.
			".dshg-prHeadWrap{position:relative;display:flex;align-items:center}",
			".dshg-prKind{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;font-size:11px;background:color-mix(in srgb,currentColor 16%,transparent)}",
			".dshg-prKind-out{color:#60a5fa}",
			".dshg-prKind-in{color:#34d399}",
			".dshg-prKind-loopOut,.dshg-prKind-loopIn{color:#a78bfa}",
			".dshg-prTitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshg-prState{flex:none;padding:1px 8px;border-radius:9px;font-size:10.5px;line-height:15px}",
			".dshg-prState-open{color:var(--dshg-ok);background:color-mix(in srgb,var(--dshg-ok) 18%,transparent)}",
			".dshg-prState-closed{color:var(--dshg-danger);background:color-mix(in srgb,var(--dshg-danger) 18%,transparent)}",
			".dshg-prState-merged{color:#a78bfa;background:color-mix(in srgb,#8b5cf6 22%,transparent)}",
			".dshg-prDismiss{position:absolute;right:8px;top:50%;transform:translateY(-50%);padding:2px 9px;border:1px solid color-mix(in srgb,var(--dshg-text) 20%,transparent);border-radius:9px;font:inherit;font-size:10.5px;line-height:15px;background:color-mix(in srgb,var(--dshg-text) 10%,transparent);color:var(--dshg-text);cursor:pointer;transition:background .15s ease,border-color .15s ease}",
			".dshg-prDismiss:hover{background:color-mix(in srgb,var(--dshg-danger) 24%,transparent);border-color:color-mix(in srgb,var(--dshg-danger) 55%,transparent);color:var(--dshg-text)}",
			".dshg-prDismiss:hover{background:color-mix(in srgb,var(--dshg-text) 22%,transparent)}",
			".dshg-prFooterActions{display:flex;gap:6px;margin-left:auto}",
			".dshg-prDismiss:hover{background:color-mix(in srgb,var(--dshg-text) 12%,transparent);color:var(--dshg-text)}",
			".dshg-prCaret{flex:none;font-size:10px;color:var(--dshg-muted)}",
			".dshg-prRowLine{display:flex;gap:8px;font-size:11px;line-height:15px}",
			".dshg-prKey{flex:none;width:48px;color:var(--dshg-muted)}",
			".dshg-prVal{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dshg-text)}",
			".dshg-prDirection{font-family:var(--dsw-font-ui,inherit);font-size:10.5px}",
			".dshg-prFooter{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:4px}",
			".dshg-prGh{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;color:var(--dshg-sub);text-decoration:none}",
			".dshg-prGh:hover{background:color-mix(in srgb,var(--dshg-text) 10%,transparent);color:var(--dshg-text)}",
			".dshg-chainFile{display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0}",
			".dshg-chainFilePick{cursor:pointer;border-radius:4px;margin:0 -4px;padding:2px 4px}",
			".dshg-chainFilePick:hover{background:color-mix(in srgb,var(--dshg-text) 7%,transparent)}",
			".dshg-chainFileStatus{flex:none;width:10px;font-family:var(--dsw-font-ui,inherit);font-size:10px;color:var(--dshg-warn)}",
			".dshg-chainFileName{flex:1;min-width:0;color:var(--dshg-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left}",
			".dshg-chainFileAdd{flex:none;font-size:10px;color:var(--dshg-ok)}",
			".dshg-chainFileDel{flex:none;font-size:10px;color:var(--dshg-danger)}",
			".dshg-sec{border:1px solid var(--dshg-border);border-radius:10px;overflow:hidden;flex:none}",
			".dshg-secHead{display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--dsw-alias-fill-l2);cursor:pointer;user-select:none}",
			".dshg-secTitle{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dshg-sub);flex:1}",
			".dshg-secCount{font-size:11px;color:var(--dshg-muted);flex:none}",
			".dshg-check{width:14px;height:14px;flex:none;box-sizing:border-box;border:1px solid var(--dshg-border);border-radius:4px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px;line-height:1;cursor:pointer}",
			".dshg-checkOn{background:var(--dsw-alias-accent,#3b82f6);border-color:transparent}",
			".dshg-row{display:flex;align-items:center;gap:8px;padding:3px 8px;min-width:0;cursor:pointer;user-select:none;border-radius:6px}",
			".dshg-row:hover{background:var(--dshg-hover)}",
			".dshg-rowSel{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 12%,transparent)}",
			".dshg-letter{flex:none;width:14px;text-align:center;font-family:var(--dsw-font-ui,inherit);font-size:9px;font-weight:700;letter-spacing:-1px;line-height:1}",
			".dshg-path{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-ui,inherit);font-size:12px}",
			".dshg-green{color:var(--dshg-ok)}",
			".dshg-yellow{color:var(--dshg-warn)}",
			".dshg-orange{color:#e0813c}",
			".dshg-red{color:var(--dshg-danger)}",
			".dshg-dirRow{display:flex;align-items:center;gap:6px;padding:3px 8px;user-select:none;color:var(--dshg-sub);border-radius:6px}",
			".dshg-dirRow:hover{background:var(--dshg-hover)}",
			".dshg-caret{flex:none;width:10px;text-align:center;font-size:9px;color:var(--dshg-muted);transition:transform .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-caretOpen{transform:rotate(90deg)}",
			".dshg-caretUp{font-size:9px;color:var(--dshg-muted)}",
			".dshg-dirName{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-ui,inherit);font-size:12px;color:var(--dshg-sub)}",
			".dshg-timeline{display:flex;flex-direction:column;gap:4px;flex:none;padding-top:0}",
			".dshg-commit{display:flex;flex-direction:column;border:1px solid transparent;border-radius:10px;overflow:hidden;transition:border-color .18s,background .18s}",
			".dshg-commitOpen{border-color:var(--dshg-border);background:var(--dsw-alias-fill-l2)}",
			".dshg-commitHead{display:flex;gap:8px;align-items:flex-start;padding:6px;cursor:pointer;min-width:0}",
			".dshg-commitBody{max-height:0;opacity:0;transition:max-height .22s var(--ds-ease-in-out,ease-out),opacity .18s var(--ds-ease-in-out,ease-out);overflow:hidden}",
			".dshg-commitBodyOpen{max-height:240px;opacity:1}",
			".dshg-commitMsg{font-size:12px;line-height:18px;color:var(--dshg-sub);white-space:pre-wrap;word-break:break-word;padding:0 10px 6px}",
			".dshg-commitActions{display:flex;align-items:center;gap:6px;padding:0 10px 8px;flex-wrap:wrap}",
			".dshg-commitActionsRight{margin-left:auto;display:flex;align-items:center;gap:2px}",
			".dshg-opDetail{display:inline-flex;align-items:center;gap:4px}",
			".dshg-detail{position:absolute;left:0;right:0;bottom:0;max-height:60%;display:flex;flex-direction:column;background:var(--dshg-solid,var(--dsw-specific-menu,#fff));border-top:1px solid var(--dshg-border);box-shadow:var(--dsw-shadow-lv3,none);transform:translateY(100%);opacity:0;transition:transform .22s var(--ds-ease-in-out,ease-out),opacity .16s var(--ds-ease-in-out,ease-out);pointer-events:none;z-index:3}",
			".dshg-detailOpen{transform:none;opacity:1;pointer-events:auto}",
			".dshg-detailHead{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dshg-border);flex:none}",
			".dshg-detailTitle{flex:1;min-width:0;font-size:12px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-detailList{flex:1 1 auto;min-height:0;overflow-y:auto;padding:4px 8px 8px}",
			".dshg-groupTitle{font-size:11px;font-weight:600;color:var(--dshg-muted);padding:6px 4px 2px;letter-spacing:.04em}",
			".dshg-diffNums{flex:none;display:flex;gap:6px;font-family:var(--dsw-font-ui,inherit);font-size:11px}",
			".dshg-numAdd{color:var(--dshg-ok)}",
			".dshg-numDel{color:var(--dshg-danger)}",
			".dshg-fileDiff{flex:none;max-height:280px;overflow:auto;border-top:1px solid var(--dshg-border);padding:8px 12px;background:var(--dsw-alias-bg-layer-1)}",
			".dshg-fileDiffHead{display:flex;align-items:center;gap:8px;margin-bottom:4px}",
			".dshg-fileDiffTitle{flex:1;min-width:0;font-size:11px;font-family:var(--dsw-font-ui,inherit);color:var(--dshg-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-fileDiff pre{margin:0;font-family:var(--dsw-font-ui,inherit);font-size:11px;line-height:16px;color:var(--dshg-sub);white-space:pre}",
			"@media (prefers-reduced-motion:reduce){.dshg-commitBody,.dshg-detail,.dshg-caret{transition:none}}",
			// --- one merged list, continuous graph, detail polish (2026-10-21 r2) ---
			".dshg-fileList{display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:45%;flex:none}",
			".dshg-group{border:1px solid var(--dshg-border);border-radius:10px;overflow:hidden;flex:none}",
			".dshg-groupFiles{padding:2px 0}",
			".dshg-warnDot{flex:none;width:14px;height:14px;border-radius:50%;background:var(--dshg-warn,#d19a12);color:#2c2100;font-size:10px;font-weight:800;line-height:14px;text-align:center;box-sizing:border-box}",
			// Extra left padding gives the branch arrow room to sit outside the dot without
			// being clipped by the scrolling container's edge.
			".dshg-timeline{position:relative;display:flex;flex-direction:column;gap:4px;flex:none;padding:2px 0 2px 28px}",
			".dshg-timeline::before{content:'';position:absolute;left:9px;top:8px;bottom:8px;width:2px;background:var(--dshg-border);border-radius:1px}",
			".dshg-commit{position:relative;display:flex;flex-direction:column;border:1px solid transparent;border-radius:10px;overflow:hidden;transition:border-color .15s var(--ds-ease-in-out,ease-out),background .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-commit:hover{background:var(--dshg-hover)}",
			".dshg-commitOpen{border-color:var(--dshg-border);background:var(--dsw-alias-fill-l2)}",
			".dshg-nodeWrap{position:absolute;left:-20px;top:10px;width:20px;display:flex;justify-content:center;pointer-events:none}",
			".dshg-node{width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:2px solid var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;transition:box-shadow .15s var(--ds-ease-in-out,ease-out)}",
			// Stash commit: a filled yellow node with a white sheet glyph, sized like
			// the branch-creation dot (14px) so both read as the same weight.
			".dshg-nodeStash{background:var(--dshg-warn);width:14px;height:14px}",
			".dshg-nodeSelect{cursor:pointer;pointer-events:auto;background:var(--dshg-text)}",
			".dshg-moreActionDisabled{opacity:.45}",
			".dshg-moreBubble{position:fixed;z-index:80;padding:5px 9px;border-radius:7px;background:var(--dshg-danger,#ef4444);color:#fff;font-size:11px;line-height:1.4;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.18);pointer-events:none;max-width:calc(100vw - 16px)}",
			".dshg-moreBubble::after{content:'';position:absolute;left:var(--arrow-left,75%);transform:translateX(-50%);bottom:100%;border:5px solid transparent;border-bottom-color:var(--dshg-danger,#ef4444)}",
			".dshg-nodeSelected{background:var(--dsw-alias-accent,#3b82f6);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 45%,transparent)}",
			".dshg-nodeDisabled{opacity:.3}",
			".dshg-commitSelected{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 20%,transparent) !important}",
			".dshg-commitUnselectable{opacity:.45}",
			".dshg-selectHint{margin:8px 12px 0;padding:7px 10px;border:1px solid color-mix(in srgb,var(--dshg-warn) 45%,transparent);border-radius:8px;background:color-mix(in srgb,var(--dshg-warn) 10%,transparent);color:var(--dshg-warn);font-size:11px;line-height:1.5}",
			".dshg-rebaseBtns{display:flex;gap:5px;margin-top:6px}",
			".dshg-conflictBtns{display:flex;gap:5px;padding:0 10px 8px 34px}",
			".dshg-moreBarDisabled{opacity:.45;pointer-events:none}",
			".dshg-commit:hover .dshg-node{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 40%,transparent)}",
			".dshg-commitBody{max-height:0;opacity:0;overflow:hidden;transition:max-height .2s var(--ds-ease-in-out,ease-out),opacity .2s var(--ds-ease-in-out,ease-out)}",
			".dshg-commitBodyOpen{max-height:240px;opacity:1}",
			".dshg-fileDiff{flex:none;max-height:none;overflow:auto;border-top:1px solid var(--dshg-border);padding:8px 12px;background:var(--dsw-alias-bg-layer-1);transition:height .2s var(--ds-ease-in-out,ease-out)}",
			".dshg-patchLines{font-family:var(--dsw-font-ui,inherit);font-size:11px;line-height:16px;white-space:pre}",
			".dshg-pl{white-space:pre}",
			".dshg-add{color:var(--dshg-ok)}",
			".dshg-del{color:var(--dshg-danger)}",
			".dshg-hunk{color:var(--dshg-muted)}",
			".dshg-ctx{color:var(--dshg-sub)}",
			".dshg-footerCount{margin-left:auto;flex:none;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dshg-warn,#d19a12);color:#fff;font-size:10px;line-height:16px;text-align:center;font-weight:700;box-sizing:border-box}",
			".dshg-commit{overflow:visible}",
			".dshg-commitOpen{border-radius:10px}",
			// --- tree layout, blue selection, grid-animated rows (2026-10-21 r3) ---
			".dshg-tree{display:flex;flex-direction:column;gap:1px;flex:none;overflow-y:auto;max-height:45%;padding:2px 0}",
			".dshg-dir{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:6px;cursor:pointer;user-select:none}",
			".dshg-dir:hover{background:var(--dshg-hover)}",
			".dshg-row{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:6px;cursor:pointer;user-select:none;min-width:0}",
			".dshg-rowSel{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 28%,transparent)}",
			".dshg-rowSel .dshg-path,.dshg-rowSel .dshg-letter,.dshg-rowSel .dshg-warnDot{color:#fff}",
			".dshg-plain{color:var(--dshg-text)}",
			".dshg-commit{border:none;background:transparent;border-radius:8px;overflow:visible}",
			".dshg-commit:hover{background:var(--dshg-hover)}",
			".dshg-commitOpen{background:var(--dsw-alias-fill-l2);border:1px solid var(--dshg-border)}",
			".dshg-commitOpen:hover{background:var(--dsw-alias-fill-l2)}",
			// Collapsed: single line + ellipsis + marquee. Expanded: multi-line, but the
			// switch happens through max-height so the row never jumps.
			".dshg-commitSubject{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-height:1.45em;transition:max-height .22s var(--ds-ease-in-out,ease-out)}",
			".dshg-commitSubjectOpen{white-space:normal;overflow:hidden;text-overflow:clip;max-height:12em}",
			// Keep the subject on ONE line during the expand animation; it switches to
			// multi-line once the row has finished growing (see `wrapped` in CommitRow).
			".dshg-commitSubjectOpen{white-space:normal;overflow:visible;text-overflow:clip}",
			".dshg-commitBody{display:grid;grid-template-rows:0fr;opacity:0;max-height:none;overflow:visible;transition:grid-template-rows .22s var(--ds-ease-in-out,ease-out),opacity .22s var(--ds-ease-in-out,ease-out)}",
			".dshg-commitBodyOpen{grid-template-rows:1fr;opacity:1;max-height:none}",
			".dshg-commitBodyInner{overflow:hidden;min-height:0}",
			".dshg-opDetail{border:none;background:transparent;padding:2px 4px}",
			".dshg-opDetail:hover{background:var(--dshg-hover)}",
			// --- fixed letter colours, folder selection, marquee (2026-10-21 r4) ---
			".dshg-muted{color:var(--dshg-muted)}",
			".dshg-warnDot{width:11px;height:11px;line-height:11px;font-size:8px}",
			".dshg-dirPartial{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 12%,transparent)}",
			".dshg-dirAll{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 26%,transparent)}",
			".dshg-selCount{flex:none;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-accent,#3b82f6);color:#fff;font-size:10px;line-height:16px;text-align:center;font-weight:700;box-sizing:border-box}",
			".dshg-nodeActive{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 55%,transparent)}",
			".dshg-op{border:1px solid var(--dshg-border)}",
			".dshg-opPrimary{border-color:var(--dsw-alias-accent,#3b82f6)}",
			".dshg-commitMain{overflow:hidden;min-width:0}",
			"@keyframes dshg-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
			".dshg-marquee{animation:dshg-marquee 3.2s ease-in-out infinite alternate}",
			// --- open-row highlight, borderless detail, exact marquee (2026-10-21 r5) ---
			".dshg-commitOpen{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 16%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 45%,transparent)}",
			".dshg-commitOpen:hover{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 16%,transparent)}",
			".dshg-opDetail{border:none;background:transparent}",
			".dshg-opDetail:hover{background:var(--dshg-hover)}",
			// --- readable diff body: line numbers, no git plumbing headers ---
			".dshg-patchLines{font-family:var(--dsw-font-ui,inherit);font-size:11px;line-height:16px}",
			".dshg-pl{display:flex;gap:4px;align-items:flex-start}",
			".dshg-ln{flex:none;text-align:right;color:var(--dshg-muted);font-size:10px;user-select:none;padding-right:2px}",
			".dshg-sign{flex:none;width:8px;text-align:center;user-select:none}",
			".dshg-code{flex:1;min-width:0;white-space:pre-wrap;word-break:break-all}",
			".dshg-hunkRow{color:var(--dshg-muted);font-size:10px;padding:4px 0 2px;margin-top:4px;border-top:1px dashed var(--dshg-border);user-select:none}",
			// --- diff rows: tinted background, side bar, coloured numbers, Prism tokens ---
			".dshg-add{background:color-mix(in srgb,#2ea043 14%,transparent);box-shadow:inset 2px 0 0 #2ea043}",
			".dshg-del{background:color-mix(in srgb,#d73a49 14%,transparent);box-shadow:inset 2px 0 0 #d73a49}",
			".dshg-add .dshg-ln{color:#2ea043}",
			".dshg-del .dshg-ln{color:#d73a49}",
			".dshg-patchLines .token.comment{color:#8a9aa8;font-style:italic}",
			".dshg-patchLines .token.string{color:#4f9ad6}",
			".dshg-patchLines .token.keyword{color:#a875d8}",
			".dshg-patchLines .token.number{color:#d08a45}",
			".dshg-patchLines .token.function{color:#3f9d9d}",
			".dshg-patchLines .token.operator,.dshg-patchLines .token.punctuation{color:var(--dshg-sub)}",
			// --- working-tree file preview popup ---
			".dshg-previewCard{width:min(920px,94vw);max-height:78vh;display:flex;flex-direction:column}",
			".dshg-previewHead{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dshg-border)}",
			".dshg-previewTitle{flex:1;min-width:0;font-size:12px;font-family:var(--dsw-font-ui,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dshg-text)}",
			".dshg-detailWork{flex:none;min-height:0;overflow:auto;padding:8px 10px}",
			// Only when the patch overflows: a generated block is real content, so it
			// scrolls into view instead of vanishing like a padding-bottom does.
			".dshg-detailWorkScroll::after{content:'';display:block;height:16px}",
			// Keep a readable floor when a range diff fails: an error is one short
			// line, and without a floor the pane collapses to a sliver the moment
			// the request comes back, which reads as "clicking did nothing".
			".dshg-detailRangeHost{min-height:88px}",
			// "No remote" hint above the workspace: amber, dismissible, click-through to
			// the link dialog.
			".dshg-remoteHint{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--dshg-warn) 16%,transparent);border:1px solid color-mix(in srgb,var(--dshg-warn) 42%,transparent);cursor:pointer;font-size:12px;color:var(--dshg-text)}",
			".dshg-hiddenHint{flex:none;display:flex;align-items:center;gap:8px;margin:2px 0 6px;padding:7px 10px;border-radius:9px;background:color-mix(in srgb,var(--dshg-warn) 16%,transparent);border:1px solid color-mix(in srgb,var(--dshg-warn) 45%,transparent);color:var(--dshg-warn);font-size:11.5px;line-height:16px;cursor:pointer;user-select:none;-webkit-user-select:none}",
			".dshg-hiddenHint:hover{background:color-mix(in srgb,var(--dshg-warn) 24%,transparent)}",
			".dshg-hiddenHintText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshg-hiddenHintClose{flex:none;width:18px;height:18px;padding:0;border:none;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:16px}",
			".dshg-hiddenHintClose:hover{background:color-mix(in srgb,var(--dshg-warn) 24%,transparent)}",
			// No-account hint: same shape as the hidden-branch bubble, danger tinted.
			".dshg-accountHint{flex:none;display:flex;align-items:center;gap:8px;margin:2px 0 6px;padding:7px 10px;border-radius:9px;background:color-mix(in srgb,var(--dshg-danger,#d5482f) 12%,transparent);border:1px solid color-mix(in srgb,var(--dshg-danger,#d5482f) 40%,transparent);color:var(--dshg-danger,#d5482f);font-size:11.5px;line-height:16px}",
			".dshg-accountHintText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshg-accountHintClose{flex:none;width:18px;height:18px;padding:0;border:none;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:16px}",
			".dshg-accountHintClose:hover{background:color-mix(in srgb,var(--dshg-danger,#d5482f) 20%,transparent)}",
			".dshg-remoteHint:hover{background:color-mix(in srgb,var(--dshg-warn) 22%,transparent)}",
			".dshg-remoteHintText{flex:1;min-width:0}",
			".dshg-remoteHintClose{flex:none;background:transparent;border:0;color:var(--dshg-muted);font-size:14px;line-height:1;cursor:pointer;padding:0 2px;font-family:inherit}",
			".dshg-remoteHintClose:hover{color:var(--dshg-text)}",
			// Inside the branch popover the hint is a full-width row under the head.
			".dshg-remoteHintPop{margin:8px 4px 2px}",
			// Denied variant: warning icon + a follow-up action row under the text.
			".dshg-remoteHintDenied{flex-direction:column;align-items:stretch;gap:6px}",
			".dshg-remoteHintRow{display:flex;align-items:center;gap:7px}",
			".dshg-remoteHintIcon{flex:none;display:inline-flex;color:var(--dshg-warn)}",
			".dshg-remoteHintActions{display:flex;justify-content:flex-end}",
			// Remote management dialog
			".dshg-remoteCard{width:min(460px,100%)}",
			".dshg-remoteStatus{font-size:12px;line-height:18px;padding:8px 10px;border-radius:8px;margin:4px 0 10px;background:color-mix(in srgb,var(--dshg-warn) 16%,transparent);border:1px solid color-mix(in srgb,var(--dshg-warn) 42%,transparent);color:var(--dshg-text)}",
			".dshg-remoteStatusOk{background:color-mix(in srgb,var(--dshg-ok) 14%,transparent);border-color:color-mix(in srgb,var(--dshg-ok) 40%,transparent)}",
			".dshg-remoteInfo{display:flex;flex-direction:column;gap:6px}",
			".dshg-remoteRow{display:flex;gap:8px;font-size:12px;align-items:baseline}",
			".dshg-remoteLabel{flex:none;width:72px;color:var(--dshg-muted)}",
			".dshg-remoteValue{flex:1;min-width:0;color:var(--dshg-text);word-break:break-all;font-family:var(--dsw-font-ui,inherit);font-size:11.5px}",
			".dshg-remoteSection{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-top:1px dashed var(--dshg-border)}",
			".dshg-remoteSectionTitle{font-size:12px;font-weight:600;color:var(--dshg-text)}",
			".dshg-remoteCheck{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dshg-sub);cursor:pointer}",
			".dshg-remoteSelect{margin-left:auto;max-width:62%;height:26px;border-radius:7px;border:1px solid var(--dshg-border);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));color:var(--dshg-text);font:inherit;font-size:12px;padding:0 6px}",
			".dshg-permResult{font-size:11.5px;line-height:16px;padding:6px 8px;border-radius:6px}",
			".dshg-permOk{background:color-mix(in srgb,var(--dshg-ok) 14%,transparent);color:var(--dshg-ok)}",
			".dshg-permDenied{background:color-mix(in srgb,var(--dshg-danger) 14%,transparent);color:var(--dshg-danger)}",
			".dshg-permUnknown{background:color-mix(in srgb,var(--dshg-warn) 14%,transparent);color:var(--dshg-warn)}",
			// Accordion (link / create) used when repository creation is allowed.
			".dshg-remoteAccordion{display:flex;flex-direction:column;gap:8px;margin-top:4px}",
			".dshg-remotePanel{border:1px solid var(--dshg-border);border-radius:10px;overflow:hidden}",
			".dshg-remotePanelOpen{border-color:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 45%,var(--dshg-border))}",
			".dshg-remotePanelHead{display:flex;align-items:center;width:100%;padding:9px 11px;background:transparent;border:0;font:inherit;font-size:12.5px;color:var(--dshg-text);cursor:pointer;text-align:left}",
			".dshg-remotePanelHead:hover{background:color-mix(in srgb,var(--dshg-text) 6%,transparent)}",
			".dshg-remotePanelOpen .dshg-remotePanelHead{font-weight:600}",
			".dshg-remotePanelBody{display:flex;flex-direction:column;gap:8px;max-height:0;overflow:hidden;opacity:0;pointer-events:none;padding:0 11px;transition:max-height .22s ease,opacity .16s ease,padding .22s ease}",
			".dshg-remotePanelOpen .dshg-remotePanelBody{max-height:260px;opacity:1;pointer-events:auto;padding:0 11px 11px}",
			".dshg-remoteAccount{display:flex;align-items:center;gap:8px;padding:6px 0}",
			".dshg-remoteAvatar{flex:none;width:22px;height:22px;border-radius:50%;object-fit:cover;background:var(--dshg-border)}",
			".dshg-remoteAvatarFallback{display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:var(--dshg-muted)}",
			".dshg-remoteAccountName{flex:1;min-width:0;font-size:12px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			// Creation failure: the repository may already exist, so offer the link.
			".dshg-createFail{display:flex;flex-direction:column;gap:5px;padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--dshg-danger) 12%,transparent);border:1px solid color-mix(in srgb,var(--dshg-danger) 38%,transparent)}",
			".dshg-createFailText{font-size:11.5px;line-height:16px;color:var(--dshg-danger);word-break:break-word}",
			".dshg-createFailLink{font-size:11.5px;color:var(--dsw-alias-accent,#3b82f6);text-decoration:underline}",
			".dshg-confirmCard{width:min(380px,100%)}",
			".dshg-prModalCard{display:flex;flex-direction:column;gap:10px;width:min(440px,100%);max-height:72vh}",
			".dshg-prModalHead{display:flex;align-items:center;justify-content:space-between;gap:10px}",
			".dshg-prModalTitle{font-size:13px;font-weight:600;color:var(--dshg-text)}",
			".dshg-prModalCount{font-size:11px;padding:1px 9px;border-radius:10px;color:var(--dshg-warn);background:color-mix(in srgb,var(--dshg-warn) 16%,transparent)}",
			// Bare list inside the dialog: no capsule, no purple tint.
			// Bare mode rides on the collapsed-list class, so it must undo the 0fr row:
			// leaving it inherited rendered an empty-looking dialog.
			".dshg-prListBodyBare{grid-template-rows:1fr;gap:6px;max-height:56vh;overflow-y:auto;scrollbar-width:none;opacity:1}",
			".dshg-prListBodyBare::-webkit-scrollbar{width:0;height:0}",
			// Empty / unavailable states inside the PR dialog.
			".dshg-prEmpty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:160px;padding:36px 16px}",
			".dshg-prEmptyText{font-size:12px;line-height:18px;color:var(--dshg-muted);text-align:center}",
			// Create-PR dialog.
			".dshg-prCreateCard{display:flex;flex-direction:column;gap:9px;width:min(460px,100%)}",
			".dshg-prCreateField{display:flex;align-items:center;gap:10px}",
			".dshg-prCreateLabel{flex:none;font-size:12px;color:var(--dshg-muted)}",
			// The pickers share the row with a fixed-width label.
			".dshg-prCreateField .dshg-setSelect{flex:1;min-width:0;height:30px;font-size:12px}",
			// Source branch block: branch on top, "owner/repo" underneath.
			".dshg-prSource{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}",
			".dshg-prSourceName{font-family:var(--dsw-font-ui,inherit);font-size:12px;line-height:16px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-prSourceRepo{font-size:11px;line-height:14px;color:var(--dshg-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			// Unpushed-commits notice: a PR cannot contain commits that never left the box.
			".dshg-prWarn{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;font-size:11.5px;line-height:16px;background:color-mix(in srgb,var(--dshg-warn,#d19a12) 14%,transparent);border:1px solid color-mix(in srgb,var(--dshg-warn,#d19a12) 38%,transparent);color:var(--dshg-text)}",
			".dshg-prWarnText{flex:1;min-width:0}",
			// Push confirmation: commit list + inline notes.
			".dshg-pushCard{width:min(460px,100%)}",
			".dshg-pushList{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow-y:auto;scrollbar-width:thin;border:1px solid var(--dshg-border);border-radius:8px;padding:4px 6px}",
			".dshg-pushCommit{display:flex;gap:8px;align-items:baseline;font-size:11px;line-height:16px;white-space:nowrap}",
			".dshg-pushHash{flex:none;font-family:var(--dsw-font-ui,inherit);color:var(--dshg-muted)}",
			".dshg-pushSubject{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}",
			".dshg-pushAuthor{flex:none;color:var(--dshg-muted)}",
			".dshg-pushNote{font-size:11px;color:var(--dshg-muted)}",
			".dshg-squashCard{width:min(460px,100%)}",
			".dshg-squashCard .dshg-setInput{flex:1;min-width:0;height:30px;box-sizing:border-box}",
			// Body editors: multi-line, user-resizable, same skin as the one-line inputs.
			".dshg-modalTextarea{display:block;width:100%;min-height:64px;resize:vertical;font-family:inherit;line-height:1.5;padding:6px 8px;box-sizing:border-box}",
			".dshg-squashBody{height:auto;min-height:64px;resize:vertical;line-height:1.5;padding:6px 8px}",
			".dshg-pushSection{display:flex;flex-direction:column;gap:3px;min-height:0}",
			".dshg-pushSectionTitle{font-size:11px;color:var(--dshg-muted)}",
			".dshg-pullCard{width:min(440px,100%)}",
			".dshg-opDelta{display:inline-flex;align-items:center;gap:4px;margin-left:1px;font-size:10px;font-family:var(--dsw-font-ui,inherit);letter-spacing:.02em}",
			// Action-bar deltas are tight: the arrow glyphs are already narrow
			// (NarrowArrow), and there is no gap between a glyph and its number
			// (the branch rows keep their own spacing).
			".dshg-opDelta .dshg-bDeltaUp,.dshg-opDelta .dshg-bDeltaDown{gap:0}",
			// Rebase count sits right against the ↑N: "×" had too much air on its left.
			".dshg-opDeltaTight{gap:0}",
			// Rebase: "×N" counts local commits that will be rewritten.
			".dshg-rebaseCount{color:var(--dshg-danger);margin-left:-1px}",
			// Compact counter: the plus rides as a superscript and takes no width.
			".dshg-count{position:relative;display:inline-block}",
			".dshg-countPlus{position:absolute;left:100%;top:-.15em;font-size:.62em;line-height:1;font-weight:700}",
			".dshg-prCreateBody{resize:vertical;min-height:76px;font:inherit;font-size:12px;line-height:18px}",
			".dshg-prCreateResult{padding:7px 9px;border-radius:7px;font-size:11.5px;line-height:16px;word-break:break-word}",
			// ---- entrance / exit motion ----
			// Bubbles slide in from above; the sibling content is pushed down by layout,
			// so no manual height bookkeeping is needed.
			"@keyframes dshgBubbleIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}",
			"@keyframes dshgFadeIn{from{opacity:0}to{opacity:1}}",
			"@keyframes dshgPopIn{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}",
			".dshg-bubble,.dshg-prList,.dshg-remoteHint,.dshg-cleanBlock,.dshg-clean{animation:dshgBubbleIn .18s ease}",
			// Presence wrapper: keeps a bubble mounted while it fades out.
			// Exit is opacity-only on purpose: a transform here would turn the wrapper
			// into the containing block of the absolutely positioned `.dshg-modal`
			// inside it, so the dialog jumped to the bottom while fading out.
			".dshg-presence{transition:opacity .18s ease}",
			".dshg-presenceIn{opacity:1}",
			".dshg-presenceOut{opacity:0;pointer-events:none}",
			// Modal: backdrop fades, card pops.
			".dshg-modal{animation:dshgFadeIn .16s ease}",
			".dshg-modalCard{animation:dshgPopIn .18s ease}",
			".dshg-prModalCard .dshg-prList{margin-bottom:0;max-height:58vh;overflow-y:auto;scrollbar-width:none}",
			".dshg-prModalCard .dshg-prList::-webkit-scrollbar{width:0;height:0}",
			".dshg-setAccountCurrent{font-size:11px;padding:1px 7px;border-radius:9px;color:var(--dshg-ok);background:color-mix(in srgb,var(--dshg-ok) 16%,transparent)}",
			// GitHub account section: collapsible header + one row per account.
			".dshg-setAccountsHead{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:9px 12px;border:1px solid var(--dshg-border);border-radius:10px;background:transparent;color:var(--dshg-text);font:inherit;font-size:12.5px;cursor:pointer;text-align:left}",
			".dshg-setAccountsHead:hover{background:color-mix(in srgb,var(--dshg-text) 6%,transparent)}",
			".dshg-setAccountsHeadText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshg-setAccountsCaret{flex:none;font-size:10px;color:var(--dshg-muted)}",
			".dshg-setAccountsList{display:flex;flex-direction:column;gap:2px;margin-top:6px;padding:6px;border:1px solid var(--dshg-border);border-radius:12px;background:color-mix(in srgb,var(--dshg-text) 4%,transparent)}",
			".dshg-setAccountRow{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px}",
			".dshg-setAccountRow:hover{background:color-mix(in srgb,var(--dshg-text) 5%,transparent)}",
			".dshg-setAvatar{flex:none;width:20px;height:20px;border-radius:50%;object-fit:cover;background:var(--dshg-border)}",
			".dshg-setAvatarDefault{display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:var(--dshg-muted)}",
			".dshg-setAccountName{flex:1;min-width:0;font-size:12px;color:var(--dshg-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			// --- animate the pane height across mode switches ---
			".dshg-detail{display:block;height:0;overflow:hidden;transition:height .22s var(--ds-ease-in-out,ease-out)}",
			// --- pane expansion: plain max-height (no grid/flex dependence) ---
			".dshg-detail{position:static;flex:none;margin:0 10px 10px;border-radius:12px}",
			// Soft drop shadow instead of a hard edge: the pane floats above the
			// drawer background inside that margin.
			".dshg-detailOpen{box-shadow:0 6px 20px rgba(0,0,0,.14),0 1px 4px rgba(0,0,0,.08)}",
			".dshg-detail{display:block;grid-template-rows:none;max-height:0;overflow:hidden;transition:max-height .22s var(--ds-ease-in-out,ease-out)}",
			// Height is pinned/transitioned by JS across content swaps; the open cap
			// keeps the pane at the same share of the column as the commit pane.
			".dshg-detail{transition:max-height .22s var(--ds-ease-in-out,ease-out),height .22s var(--ds-ease-in-out,ease-out)}",
			// It is a flex child of the scrolling column: without `flex:none` the
			// column squeezes it back down to a couple of rows.
			".dshg-detail{flex:none}",
			".dshg-detailOpen{max-height:56vh;overflow:auto}",
			".dshg-detailWork{max-height:100%;overflow:auto}",
			// Grid-era height rules must not win over the max-height scheme.
			".dshg-detail{height:auto}",
			// --- plain diff text keeps the theme colour; only the sign/number is tinted ---
			".dshg-pl{padding-left:6px}",
			".dshg-add,.dshg-del{color:var(--dshg-text)}",
			".dshg-add .dshg-sign{color:#2ea043}",
			".dshg-del .dshg-sign{color:#d73a49}",
			"@keyframes dshg-marquee{0%{transform:translateX(0)}25%{transform:translateX(var(--dshg-shift,0px))}50%{transform:translateX(var(--dshg-shift,0px))}75%{transform:translateX(0)}100%{transform:translateX(0)}}",
			".dshg-marquee{animation:dshg-marquee 6s linear infinite;text-overflow:clip}",
			".dshg-timeline::before{top:15px;bottom:15px}",
			// --- graph endpoints, inline detail pane, marquee takeover (2026-10-21 r6) ---
			".dshg-timeline{gap:0}",
			".dshg-timeline::before{display:none}",
			".dshg-commit::before{content:'';position:absolute;left:-11px;top:0;bottom:0;width:2px;background:var(--dshg-border);border-radius:1px}",
			".dshg-commit:first-child::before{top:15px}",
			".dshg-commit:last-child::before{bottom:auto;height:15px}",
			// A single commit has no neighbour to connect to: the first/last rules
			// above would still draw a stub below the only dot.
			".dshg-timelineSingle .dshg-commit::before{display:none}",
			// With no rail to anchor to, nudge the lone dot down to sit mid-card.
			// Two classes on the container so this outranks the later
			// `.dshg-timeline > :first-child .dshg-nodeWrap` rule (same specificity,
			// declared after it would otherwise win).
			".dshg-timeline.dshg-timelineSingle .dshg-commit .dshg-nodeWrap{top:16px;transform:none}",
			".dshg-main{overflow-y:auto}",
			".dshg-detail{position:static;max-height:none;transform:none;opacity:1;box-shadow:none;pointer-events:auto;z-index:auto;display:grid;grid-template-rows:0fr;border-top:1px solid transparent;transition:grid-template-rows .22s var(--ds-ease-in-out,ease-out),border-color .22s var(--ds-ease-in-out,ease-out)}",
			".dshg-detailOpen{grid-template-rows:1fr;border-top-color:var(--dshg-border)}",
			".dshg-detailInner{overflow:hidden;min-height:0;display:flex;flex-direction:column}",
			".dshg-fileDiffClosed{display:none}",
			// Fixed height: the patch box must NOT resize when its content loads,
			// otherwise the pane's animated height gets bumped mid-transition.
			".dshg-fileDiff{height:280px;overflow:auto}",
			".dshg-marquee{animation:none;text-overflow:clip}",
			// --- sticky rounded detail pane, stable graph gutter, first-commit chip (2026-10-21 r7) ---
			".dshg-detail{position:sticky;bottom:0;border-radius:12px;border:1px solid transparent;background:var(--dshg-solid,var(--dsw-specific-menu,#fff));box-shadow:0 -8px 24px rgba(0,0,0,.18);z-index:2;margin-top:6px}",
			".dshg-detailOpen{border-color:var(--dshg-border)}",
			".dshg-commit{border:1px solid transparent}",
			".dshg-commitOpen{border-color:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 45%,transparent)}",
			// --- seamless graph, natural detail height, stable gutter (2026-10-21 r8) ---
			".dshg-commit::before{top:-1px;bottom:-1px}",
			".dshg-commit:first-child::before{top:14px}",
			// The newest row's dot sits at the very top of the rail — whichever kind of row
			// it is (commit, branch-created card, merge card).
			".dshg-timeline > :first-child .dshg-nodeWrap{top:4px}",
			".dshg-timeline > :first-child::before{top:14px}",
			".dshg-commit:last-child::before{height:16px}",
			".dshg-detailInner{display:block;overflow:hidden;border-radius:11px}",
			".dshg-detailList{flex:none;max-height:none;overflow:visible}",
			".dshg-main{scrollbar-gutter:stable}",
			".dshg-diag{flex:none;font-size:10px;line-height:14px;color:var(--dshg-muted);padding:4px 10px 6px;white-space:normal;word-break:break-all;border-top:1px dashed var(--dshg-border)}",
			// --- selection legibility + theme-aware hover (2026-10-21 r9) ---
			// Hover mixes the THEME TEXT colour, so light mode darkens and dark mode
			// lightens by the same small amount without ever hurting contrast.
			".dshg-row:hover{background:color-mix(in srgb,var(--dshg-text) 8%,transparent)}",
			".dshg-dir:hover{background:color-mix(in srgb,var(--dshg-text) 8%,transparent)}",
			".dshg-rowSel{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 26%,transparent)}",
			".dshg-rowSel:hover{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 34%,transparent)}",
			".dshg-rowSel .dshg-path,.dshg-rowSel .dshg-letter{color:var(--dshg-text)}",
			".dshg-rowSel .dshg-warnDot{color:#2c2100}",
			// --- no text selection while clicking a commit card (2026-10-21 r10) ---
			".dshg-commit{user-select:none;-webkit-user-select:none}",
			".dshg-commitMsg{user-select:text;-webkit-user-select:text}",
			// --- no divider line on the detail container (2026-10-21 r11) ---
			".dshg-detail{border:none}",
			".dshg-detailOpen{border:none}",
			// --- panel edges readable in BOTH themes (2026-10-21 r12) ---
			// Mixing the THEME TEXT colour lifts the surface in dark mode and sinks
			// it in light mode, so the boundary shows without any hard border. The
			// shadow is centred (no offset) so it spreads on ALL sides.
			".dshg-detail{background:transparent;box-shadow:none}",
			".dshg-detailOpen{background:color-mix(in srgb,var(--dshg-text) 5%,var(--dshg-solid,var(--dsw-specific-menu,#fff)));box-shadow:0 0 12px 1px rgba(0,0,0,.16),0 0 34px 6px rgba(0,0,0,.10)}",
			".dshg-fileDiff{background:color-mix(in srgb,var(--dshg-text) 10%,var(--dsw-alias-bg-layer-1));padding:8px 8px}",
			// --- AUTHORITATIVE detail-pane rules. MUST stay LAST in this array. ---
			// Earlier batches (r2..r12) redefine .dshg-detail many times; the r6 batch
			// sets `display:grid; grid-template-rows:0fr; max-height:none`, which
			// silently overrode every max-height attempt and made the pane grow to
			// the full column. These final rules win on source order.
			".dshg-detail{display:block;grid-template-rows:none;height:0;max-height:none;overflow:hidden;flex:none;transition:none}",
			// Height is driven entirely by the WAAPI animation (inline px while it
			// runs, settled exact px afterwards); max-height must not cap it, and the
			// old max-height cap rules below are neutralised on purpose.
			".dshg-detailOpen{max-height:none;overflow:auto}",
			".dshg-detailOpen{max-height:none;overflow:auto}",
			".dshg-detailOpen{max-height:none;overflow:auto}",
			// The header stays pinned while the patch scrolls under it.
			".dshg-detailHead{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--dshg-text) 5%,var(--dshg-solid,var(--dsw-specific-menu,#fff)))}",
			// `sticky` only works if no ancestor clips: the inner wrapper used to set
			// overflow:hidden, which silently disabled the pinned header.
			".dshg-detailInner{overflow:visible}",
			// Absolutely no stroke on the pane or its inner wrapper; the only depth cue
			// is the (soft) drop shadow below.
			".dshg-detail,.dshg-detailOpen,.dshg-detailInner{border:none;outline:none}",
			// Inner scrolling: the header stays put, the file list scrolls on its own,
			// and the patch block only takes the room its content needs (up to a cap).
			".dshg-detailOpen{overflow:hidden}",
			// Back to a content-sized wrapper (flex + max-height:100% broke measurement
			// and collapsed the pane to its header). The list caps itself in viewport
			// units; the patch block grows with its content up to a fixed cap.
			".dshg-detailInner{display:block;max-height:none;min-height:0;overflow:visible}",
			".dshg-detailList{max-height:30vh;overflow:auto}",
			// Auto height: the pane holds its size while loading (previous patch is
			// kept) and then settles to the new patch's real height.
			".dshg-fileDiff{height:auto;max-height:280px;overflow:auto}",
			// Working-tree preview: half the sidebar at most, scrolls inside.
			".dshg-detailWork{max-height:calc((100vh - var(--dshg-bar-height,40px)) / 2 - 44px);overflow:auto}",
			// Mode switches cross-fade the content; the height itself is CSS-capped,
			// so no JS measurement can flicker.
			".dshg-detailInner{animation:dshg-fadeIn .16s var(--ds-ease-in-out,ease-out)}",
			"@keyframes dshg-fadeIn{from{opacity:0}to{opacity:1}}",
			// --- reflog event rows: same geometry as a commit row, coloured dot on the rail ---
			".dshg-eventRow{position:relative;display:flex;gap:8px;align-items:flex-start;padding:6px}",
			".dshg-eventRow::before{content:'';position:absolute;left:-10.3px;top:-1px;bottom:-1px;width:2px;background:var(--dshg-border)}",
			".dshg-eventDot{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:2px solid var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2,#fff));box-sizing:border-box;transition:box-shadow .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-eventIcon{font-size:10px;line-height:1;font-weight:700;pointer-events:none;transform:translate(-0.2px,0.5px)}",
			".dshg-eventIconArrow{font-size:8px;line-height:1;font-weight:700;pointer-events:none;transform:translate(-0.3px,0.3px)}",
			".dshg-eventCard{display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:8px;margin-left:1px;min-width:0}",
			".dshg-nodeMergeIcon{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center}",
			".dshg-eventRow{position:relative;display:flex;gap:8px;align-items:flex-start;padding:6px;border-radius:8px;transition:background .15s var(--ds-ease-in-out,ease-out);user-select:none;-webkit-user-select:none}",
			".dshg-eventCard{display:flex;flex-direction:column;gap:2px;padding:0;border-radius:8px;min-width:0}",
			".dshg-eventTitle{font-size:13px;line-height:1.35;font-weight:600;color:var(--dshg-text)}",
			".dshg-eventMeta{font-size:10px;line-height:1.4;color:var(--dshg-muted)}",
			// Branch name legibility: light mode gets a soft dark halo, dark mode a thin
			// white outline; on dark backgrounds the dot's rim turns white too.
			".dshg-branchName{font-weight:600}",
			"@media (prefers-color-scheme:light){.dshg-rimLight{text-shadow:0 0 4px color-mix(in srgb,var(--dshg-text) 35%,transparent)}}",
			"@media (prefers-color-scheme:dark){.dshg-rimDark{text-shadow:0 0 1.2px rgba(255,255,255,.65)}.dshg-rimWhite{border-color:#fff}}",
			// Merge-pull node: light mode gets a soft shadow; dark mode drops it and
			// (only for bright branch colours) adds a thin white ring outside the dashes.
			"@media (prefers-color-scheme:dark){.dshg-node.dshg-mergePull{box-shadow:none}}",
			"@media (prefers-color-scheme:dark){.dshg-node.dshg-mergePull.dshg-mergePullRim{box-shadow:0 0 0 1px #fff}}",
			".dshg-eventKind{align-self:flex-start;padding:0 5px;border-radius:4px;font-size:10px;line-height:15px;background:color-mix(in srgb,var(--dshg-warn,#d19a12) 24%,transparent);color:var(--dshg-text)}",
			".dshg-eventSub{font-size:10px;color:var(--dshg-muted)}",
			".dshg-eventMeta{font-size:10px;color:var(--dshg-muted)}",
			".dshg-eventRow{position:relative;display:flex;gap:8px;align-items:flex-start;padding:6px;border-radius:8px;transition:background .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-eventRow:hover{background:var(--dshg-hover)}",
			".dshg-eventDetailBtn{align-self:flex-end;margin-top:2px;padding:0 6px;border-radius:4px;border:1px solid var(--dshg-border);background:transparent;color:var(--dshg-sub);font-size:10px;line-height:16px;cursor:pointer}",
			".dshg-eventDetailBtn:hover{color:var(--dshg-text);border-color:var(--dshg-text)}",
			".dshg-eventRow:hover .dshg-eventDot{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 40%,transparent)}",
			".dshg-eventBodyOpen{max-height:160px}",
			".dshg-eventBodyLine{font-size:10px;color:var(--dshg-muted)}",
			".dshg-eventChevron{position:absolute;right:4px;bottom:2px;font-size:10px;color:var(--dshg-muted);transition:transform .18s var(--ds-ease-in-out,ease-out)}",
			".dshg-eventChevronOpen{transform:rotate(180deg)}",
			".dshg-branchArrow{position:absolute;left:-8px;top:0.5px;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:6px solid var(--dshg-border);pointer-events:none;z-index:30}",
			".dshg-nodeIcon{font-size:9px;line-height:1;color:#fff;font-weight:700;pointer-events:none}",
			".dshg-refEvent{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 12%,transparent)}",
			// --- branch popover / conflict banner / recycle bin (2026-10-24) ---
			".dshg-opsBar{position:relative}",
			".dshg-opIcon{padding:3px 7px}",
			".dshg-opPush{margin-left:auto}",
			".dshg-opActive{border-color:var(--dsw-alias-accent,#3b82f6);color:var(--dsw-alias-accent,#3b82f6);background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 28%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 65%,transparent)}",
			".dshg-opResolve{color:var(--dshg-ok);border-color:color-mix(in srgb,var(--dshg-ok) 35%,transparent)}",
			".dshg-pop{position:absolute;top:calc(100% + 6px);right:0;z-index:60;width:380px;max-height:58vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--dshg-border);border-radius:12px;background:var(--dshg-solid,var(--dsw-specific-menu,#fff));box-shadow:0 14px 34px rgba(0,0,0,.35);padding:8px;opacity:0;transform:translateY(-4px) scale(.98);pointer-events:none;transition:opacity .16s ease,transform .16s ease}",
			".dshg-popOpen{opacity:1;transform:none;pointer-events:auto}",
			// Count: accent-coloured digits after a small gap. max-width animates the
			// button's growth/shrink; the negative margin cancels the button's flex gap
			// while collapsed so no width is reserved for an absent count.
			".dshg-opBadge{display:inline-block;box-sizing:border-box;max-width:0;margin-left:-3px;opacity:0;overflow:hidden;color:var(--dsw-alias-accent,#3b82f6);font-size:8px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;transition:max-width .18s ease,margin-left .18s ease,opacity .15s ease}",
			".dshg-opBadgeOn{max-width:26px;margin-left:2px;opacity:1}",
			".dshg-blink{animation:dshg-blink .8s ease-in-out infinite alternate}",
			"@keyframes dshg-blink{from{background:transparent}to{background:var(--dshg-hover)}}",
			".dshg-blink:hover{animation:none;background:var(--dshg-hover)}",
			// Disabled actions must read as grey, even the danger ones (danger colour
			// is reserved for buttons the user can actually press).
			".dshg-op:disabled,.dshg-op:disabled.dshg-opDanger,.dshg-op:disabled.dshg-opPrimary{color:var(--dshg-muted);border-color:var(--dshg-border);background:transparent;cursor:default;opacity:.8}",
			".dshg-popHead{display:flex;align-items:center;gap:8px;padding:2px 4px 8px;border-bottom:1px solid var(--dshg-border);flex:none}",
			".dshg-popTitle{flex:none;font-size:12px;font-weight:600;color:var(--dshg-text)}",
			".dshg-popCount{margin-right:auto;padding-left:5px;font-size:10px;color:var(--dshg-muted)}",
			".dshg-popNote{padding:6px 4px 0;font-size:10.5px;color:var(--dshg-warn)}",
			".dshg-popList{margin-top:6px;overflow:auto;min-height:0;max-height:calc((100vh - var(--dshg-bar-height,40px)) / 2)}",
			".dshg-bBranch{border-radius:8px}",
			".dshg-bBranch:hover{background:var(--dshg-hover)}",
			".dshg-bOpen{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 12%,transparent)}",
			".dshg-bHead{display:flex;align-items:center;gap:6px;padding:5px 6px;cursor:pointer}",
			".dshg-bDot{width:10px;height:10px;flex:none;border-radius:50%;border:2px solid var(--dshg-border);padding:0;background:transparent;cursor:pointer;transition:background-color .18s ease,transform .12s ease,border-color .18s ease}",
			".dshg-bDot:hover{transform:scale(1.18)}",
			".dshg-bDotOn{transform:scale(1)}",
			".dshg-bName{flex:1;min-width:0;font-size:12px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-bCurrent .dshg-bName{font-weight:600}",
			".dshg-bTag{flex:none;font-size:9.5px;line-height:14px;padding:0 4px;border-radius:4px;color:var(--dshg-warn);background:color-mix(in srgb,var(--dshg-warn) 16%,transparent)}",
			// Remote sync marks on a branch row.
			// Fixed-width left slot: "未关联" / "已同步" / "↑3 ↓4" all occupy the same
			// box so the branch names below them stay aligned.
			".dshg-bDelta{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:48px;font-size:10px;font-family:var(--dsw-font-ui,inherit);letter-spacing:.02em;color:var(--dshg-muted)}",
			".dshg-bDeltaUp{display:inline-flex;align-items:center;gap:1px;color:var(--dshg-ok)}",
			".dshg-bDeltaDown{display:inline-flex;align-items:center;gap:1px;color:var(--dshg-warn)}",
			".dshg-bDeltaNone{color:var(--dshg-muted)}",
			".dshg-bDeltaOk{color:var(--dshg-muted)}",
			".dshg-bGh{flex:none;display:inline-flex;color:var(--dshg-muted);margin-left:-1px}",
			".dshg-bUnlinked{flex:none;font-size:9.5px;line-height:14px;padding:0 4px;border-radius:4px;color:var(--dshg-muted);border:1px dashed var(--dshg-border)}",
			".dshg-popSection{flex:none;font-size:10px;letter-spacing:.06em;color:var(--dshg-muted);padding:10px 4px 4px}",
			".dshg-bRemote{cursor:default}",
			".dshg-bRemote:hover{background:transparent}",
			".dshg-bTime{flex:none;font-size:10px;color:var(--dshg-muted)}",
			".dshg-bCurrentTag{flex:none;font-size:10px;color:var(--dshg-sub);padding:1px 6px;border:1px solid var(--dshg-border);border-radius:5px}",
			".dshg-bBody{max-height:0;overflow:hidden;opacity:0;pointer-events:none;padding:0 8px;display:flex;flex-direction:column;gap:4px;transition:max-height .22s ease,opacity .16s ease,padding .22s ease}",
			".dshg-bBodyOpen{max-height:420px;opacity:1;pointer-events:inherit;padding:6px 8px 8px;border-top:1px dashed var(--dshg-border)}",
			".dshg-bSubject{font-size:11.5px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-bMeta{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--dshg-muted)}",
			".dshg-bHash{font-family:var(--dsw-font-ui,inherit)}",
			".dshg-bCreated{font-size:10.5px;line-height:1.5;color:var(--dshg-sub)}",
			".dshg-bJump{align-self:flex-start;padding:0 6px}",
			".dshg-bActions{display:flex;align-items:center;margin-top:4px;gap:6px}",
			".dshg-bActionsRight{margin-left:auto;display:flex;gap:6px}",
			".dshg-bSwitch{height:18px;flex:none;display:inline-grid;place-items:center;padding:0 7px;border:1px solid var(--dshg-border);border-radius:5px;background:transparent;color:var(--dshg-sub);font-size:10px;line-height:16px;cursor:pointer}",
			".dshg-bSwitch:hover:not(:disabled){color:var(--dshg-text);border-color:var(--dshg-text)}",
			".dshg-bSwitch:disabled{opacity:.4;cursor:default}",
			".dshg-bIconBtn{width:26px;height:18px;flex:none;display:inline-grid;place-items:center;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dshg-sub);cursor:pointer}",
			".dshg-bIconBtn:hover:not(:disabled){color:var(--dshg-text);background:var(--dshg-hover)}",
			".dshg-bIconBtn:disabled{opacity:.4;cursor:default}",
			".dshg-bCardExpired{color:var(--dshg-warn)}",
			".dshg-bCard{margin-top:6px;padding:7px 8px;border:1px solid var(--dshg-border);border-radius:8px;background:color-mix(in srgb,var(--dshg-text) 3%,transparent);cursor:pointer;transition:border-color .15s ease,background .15s ease}",
			".dshg-bCard:hover{border-color:var(--dsw-alias-accent,#3b82f6);background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 8%,transparent)}",
			".dshg-bCardDisabled{cursor:default;opacity:.65}",
			".dshg-bCardDisabled:hover{border-color:var(--dshg-border);background:color-mix(in srgb,var(--dshg-text) 3%,transparent)}",
			".dshg-bCardLabel{font-size:9px;letter-spacing:.6px;color:var(--dshg-muted);margin-bottom:2px}",
			".dshg-bCardTitle{font-size:11.5px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-bCardMeta{display:flex;gap:8px;font-size:10px;color:var(--dshg-muted);margin-top:2px}",
			// "More" bar: collapsed it is the 2x2 square glyph; expanded it grows to
			// the left and the squares slide out while the icon actions slide in.
			".dshg-moreBar{position:relative;flex:none;width:28px;height:18.5px;box-sizing:border-box;border:1px solid var(--dshg-border);border-radius:6px;background:transparent;cursor:pointer;overflow:hidden;transition:width .24s var(--ds-ease-in-out,ease-out),border-color .15s ease}",
			".dshg-moreBar:hover{border-color:var(--dshg-text)}",
			// Collapsed: 28px. Expanded: one 22px slot per action + 3px gaps,
			// 22px for the chevron on the right and a little breathing room.
			// (The old 22*count+30 under-sized six actions and clipped the last icon.)
			".dshg-moreBarOpen{width:calc(25px * var(--count,3) + 26px)}",
			".dshg-moreSquares{position:absolute;left:50%;top:50%;transform:translate(calc(-50% - 0.6px),calc(-50% - 0.8px));display:grid;grid-template-columns:4px 4px;grid-template-rows:4px 4px;gap:3px;pointer-events:none}",
			".dshg-moreSquare{position:static;width:4px;height:4px;border:1px solid var(--dshg-sub);border-radius:1px;background:transparent;transition:transform .18s ease,opacity .16s ease;transition-delay:calc(110ms + var(--i) * 30ms)}",
			".dshg-moreSquare-tl{left:0;top:0}",
			".dshg-moreSquare-tr{right:0;top:0}",
			".dshg-moreSquare-bl{left:0;bottom:0}",
			".dshg-moreSquare-br{right:0;bottom:0}",
			".dshg-moreBarOpen .dshg-moreSquare{transform:translateX(-10px);opacity:0;transition-delay:calc(var(--i) * 30ms)}",
			".dshg-moreItems{position:absolute;right:22px;top:50%;transform:translateY(-50%);display:flex;gap:3px}",
			// Collapse chevron: two strokes, no shaft; slides in after the actions.
			".dshg-moreArrow{position:absolute;right:6px;top:50%;width:11px;height:11px;display:grid;place-items:center;color:var(--dshg-sub);transform:translate(6px,-50%);opacity:0;pointer-events:none;transition:opacity .16s ease,transform .18s ease}",
			".dshg-moreBarOpen .dshg-moreArrow{opacity:1;transform:translate(0,-50%);pointer-events:auto;transition-delay:calc(150ms + var(--count,3) * 35ms)}",
			".dshg-moreAction{width:22px;height:16px;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dshg-sub);cursor:pointer;opacity:0;transform:translateX(10px);pointer-events:none;transition:opacity .16s ease,transform .18s ease,color .12s ease;transition-delay:calc(var(--i) * 30ms)}",
			".dshg-moreAction:hover{color:var(--dshg-text);background:var(--dshg-hover)}",
			".dshg-moreBarOpen .dshg-moreAction{opacity:1;transform:none;pointer-events:auto;transition-delay:calc(120ms + var(--i) * 35ms)}",
			".dshg-moreItem{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--dshg-text);font:inherit;font-size:12px;padding:7px 9px;border-radius:7px;cursor:pointer}",
			".dshg-moreItem:hover{background:var(--dshg-hover)}",
			".dshg-conflict{margin:8px 12px 0;border:1px solid color-mix(in srgb,var(--dshg-danger) 40%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dshg-danger) 8%,transparent);flex:none}",
			".dshg-conflictHead{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer}",
			".dshg-conflictIcon{width:19px;height:19px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;align-self:flex-start;margin-top:-2px;background:color-mix(in srgb,var(--dshg-danger) 20%,transparent);color:var(--dshg-danger);font-size:11px;font-weight:700}",
			".dshg-conflictText{flex:1;min-width:0}",
			".dshg-conflictTitle{font-size:12px;font-weight:600;color:var(--dshg-danger)}",
			".dshg-conflictSub{font-size:10.5px;color:var(--dshg-sub);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-conflictCaret{width:24px;height:24px}",
			".dshg-conflictList{border-top:1px solid color-mix(in srgb,var(--dshg-danger) 22%,transparent);max-height:0;overflow:hidden;opacity:0;transition:max-height .22s var(--ds-ease-in-out,ease-out),opacity .18s ease}",
			".dshg-conflictListOpen{max-height:var(--dshg-cap,33vh);overflow:auto;opacity:1;padding:4px 0 6px}",
			".dshg-conflictTree{display:flex;flex-direction:column}",
			".dshg-conflictEmpty{padding:6px 12px;font-size:11px;color:var(--dshg-ok)}",
			".dshg-cDir{display:flex;align-items:center;gap:5px;padding:3px 10px 3px 6px;font-size:11px;color:var(--dshg-sub)}",
			".dshg-cDirName{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-cDirCount{font-size:10px;color:var(--dshg-muted)}",
			".dshg-cFile{display:flex;align-items:center;gap:7px;padding:3px 10px 3px 20px;cursor:pointer;font-size:11.5px}",
			".dshg-cFile:hover{background:var(--dshg-hover)}",
			".dshg-cFileActive{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 14%,transparent)}",
			".dshg-cLetter{width:12px;flex:none;font-family:var(--dsw-font-ui,inherit);font-size:10px;font-weight:700;color:var(--dshg-danger);text-align:center}",
			".dshg-cPath{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dshg-text)}",
			".dshg-cCount{flex:none;font-size:10px;color:var(--dshg-danger);font-variant-numeric:tabular-nums}",
			".dshg-cCountOk{color:var(--dshg-ok)}",
			".dshg-conflictView{font-family:var(--dsw-font-ui,inherit);font-size:10.5px;line-height:17px;padding:2px 0 10px}",
			".dshg-cfLine{display:flex;white-space:pre}",
			".dshg-cfNum{width:34px;flex:none;text-align:right;padding-right:9px;color:var(--dshg-muted);user-select:none}",
			".dshg-cfText{flex:1;min-width:0;padding-right:10px;color:var(--dshg-sub)}",
			".dshg-cfOurs{background:color-mix(in srgb,var(--dshg-danger) 12%,transparent);border-left:3px solid var(--dshg-danger)}",
			".dshg-cfTheirs{background:color-mix(in srgb,var(--dsw-alias-accent,#8b7cf0) 12%,transparent);border-left:3px solid var(--dsw-alias-accent,#8b7cf0)}",
			".dshg-cfBase{background:color-mix(in srgb,var(--dshg-warn) 10%,transparent);border-left:3px solid var(--dshg-warn)}",
			".dshg-cfBlockHead{display:flex;align-items:center;gap:6px;padding:2px 10px 2px 34px;font-size:10px;font-weight:600;letter-spacing:.02em;border-left:3px solid transparent}",
			".dshg-cfBlockHead.dshg-cfOurs{color:var(--dshg-danger);background:color-mix(in srgb,var(--dshg-danger) 12%,transparent);border-left-color:var(--dshg-danger)}",
			".dshg-cfBlockHead.dshg-cfTheirs{color:var(--dsw-alias-accent,#8b7cf0);background:color-mix(in srgb,var(--dsw-alias-accent,#8b7cf0) 12%,transparent);border-left-color:var(--dsw-alias-accent,#8b7cf0)}",
			".dshg-cfBlockHead.dshg-cfBase{color:var(--dshg-warn);background:color-mix(in srgb,var(--dshg-warn) 10%,transparent);border-left-color:var(--dshg-warn)}",
			".dshg-mergeModes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:2px 0 10px}",
			".dshg-mergeMode{display:flex;flex-direction:column;align-items:flex-start;gap:2px;border:1px solid var(--dshg-border);background:transparent;color:var(--dshg-sub);font:inherit;font-size:11px;padding:7px 9px;border-radius:8px;cursor:pointer;text-align:left;transition:border-color .15s ease,background .15s ease}",
			".dshg-mergeMode:hover{border-color:var(--dshg-text)}",
			".dshg-mergeMode:disabled{opacity:.45;cursor:default}",
			".dshg-mergeModeLabel{font-size:12px;font-weight:600;color:var(--dshg-text)}",
			".dshg-mergeModeDesc{font-size:9.5px;line-height:1.4;color:var(--dshg-muted)}",
			".dshg-mergeModeOn{color:var(--dshg-text);border-color:var(--dsw-alias-accent,#3b82f6);background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 14%,transparent)}",
			".dshg-modalWarn{color:var(--dshg-danger)}",
			".dshg-modalHint{font-size:10.5px;line-height:1.6;color:var(--dshg-muted);margin-top:8px}",
			".dshg-recycleCard{width:min(560px,100%);max-height:78vh;display:flex;flex-direction:column}",
			".dshg-recycleList{flex:1;min-height:0;overflow:auto;margin-top:8px;display:flex;flex-direction:column;gap:6px}",
			".dshg-recycleRow{border:1px solid var(--dshg-border);border-radius:9px;background:color-mix(in srgb,var(--dshg-text) 4%,transparent);transition:border-color .15s ease,background .15s ease}",
			".dshg-recycleRow:hover{border-color:var(--dsw-alias-accent,#3b82f6)}",
			".dshg-recycleRowOpen{border-color:var(--dsw-alias-accent,#3b82f6);background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 6%,transparent)}",
			".dshg-recycleRowExpiring{border-color:color-mix(in srgb,var(--dshg-danger) 55%,transparent);background:color-mix(in srgb,var(--dshg-danger) 8%,transparent)}",
			".dshg-recycleHead{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer}",
			".dshg-recycleHash{flex:none;font-family:var(--dsw-font-ui,inherit);font-size:10px;color:var(--dshg-sub);background:color-mix(in srgb,var(--dshg-text) 7%,transparent);padding:1px 5px;border-radius:4px}",
			".dshg-recycleSubject{flex:1;min-width:0;font-size:12px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-recycleExpiringTag{flex:none;font-size:9px;line-height:1.4;padding:1px 5px;border-radius:4px;background:color-mix(in srgb,var(--dshg-danger) 18%,transparent);color:var(--dshg-danger)}",
			".dshg-recycleMeta{flex:none;font-size:10px;color:var(--dshg-muted)}",
			".dshg-recycleBody{max-height:0;overflow:hidden;padding:0 10px;transition:max-height .2s ease}",
			".dshg-recycleBodyOpen{max-height:220px;overflow:auto;padding:0 10px 9px}",
			".dshg-recycleInfo{display:flex;flex-direction:column;gap:2px;font-size:10.5px;color:var(--dshg-muted);margin-bottom:7px}",
			".dshg-recycleLine{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-recycleOps{display:flex;gap:5px}",
			// Stash panel: same card language as the conflict banner, yellow theme.
			".dshg-stash{margin:8px 12px 0;border:1px solid color-mix(in srgb,var(--dshg-warn) 45%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dshg-warn) 7%,transparent);flex:none}",
			".dshg-stashHead{display:flex;align-items:center;gap:8px;padding:8px 10px}",
			".dshg-stashIcon{width:19px;height:19px;flex:none;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--dshg-warn) 20%,transparent);color:var(--dshg-warn);font-size:11px;font-weight:700}",
			".dshg-stashText{flex:1;min-width:0}",
			".dshg-stashTitle{font-size:12px;font-weight:600;color:var(--dshg-text)}",
			".dshg-stashSub{font-size:10px;color:var(--dshg-muted);margin-top:1px}",
			".dshg-stashList{display:flex;flex-direction:column;gap:4px;padding:0 8px 8px}",
			".dshg-stashRow{border:1px solid var(--dshg-border);border-radius:8px;background:color-mix(in srgb,var(--dshg-text) 3%,transparent)}",
			".dshg-stashRowOpen{border-color:color-mix(in srgb,var(--dshg-warn) 55%,transparent)}",
			".dshg-stashRowHead{display:flex;align-items:center;gap:7px;padding:6px 8px;cursor:pointer}",
			".dshg-stashRef{flex:none;font-family:var(--dsw-font-ui,inherit);font-size:10px;color:var(--dshg-warn)}",
			".dshg-stashMsg{flex:1;min-width:0;font-size:11px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-stashOps{flex:none;display:flex;gap:4px}",
			".dshg-stashBody{padding:0 8px 8px}",
			".dshg-stashPatch{margin:0;max-height:180px;overflow:auto;font-family:var(--dsw-font-ui,inherit);font-size:10px;line-height:1.5;color:var(--dshg-sub);white-space:pre-wrap;word-break:break-all}",
			".dshg-stashFiles{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}",
			".dshg-stashFile{font-size:10px;padding:2px 6px;border-radius:5px;border:1px solid var(--dshg-border);cursor:pointer;color:var(--dshg-sub);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshg-stashFileOn{border-color:var(--dshg-warn);color:var(--dshg-warn);background:color-mix(in srgb,var(--dshg-warn) 12%,transparent)}",
			".dshg-stashMain{flex:1;min-width:0}",
			".dshg-stashSubject{font-size:12px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-stashMeta{font-size:10px;color:var(--dshg-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-stashLayout{display:flex;gap:10px}",
			".dshg-stashBtns{display:flex;flex-direction:row;gap:5px;flex-wrap:wrap;align-items:center}",
			".dshg-stashView{margin-left:auto;border:0;background:transparent;color:var(--dshg-text);font:inherit;font-size:11px;cursor:pointer;padding:2px 4px;border-radius:4px}",
			".dshg-stashView:hover{background:var(--dshg-hover)}",
			".dshg-stashContent{flex:1;min-width:0}",
			".dshg-stashCheck{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dshg-sub);cursor:pointer}",
			".dshg-stashEmpty{padding:8px 10px 10px;font-size:11px;color:var(--dshg-muted)}",
			// ---- settings panel (plugin page + DSH settings section) ----
			".dshg-set{display:flex;flex-direction:column;gap:12px;padding:2px 0 10px;font-size:13px;line-height:18px;color:var(--dshg-text)}",
			// Card layout (see the theme plugin's SETTINGS-PANEL.md): each section is
			// a rounded translucent card instead of a hairline-separated block.
			".dshg-setBlock{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.34);border:1px solid rgba(128,140,160,.18)}",
			"@media (prefers-color-scheme:dark){.dshg-setBlock{background:rgba(20,24,40,.34);border-color:rgba(140,150,175,.18)}}",
			".dshg-setTitle{margin:0;font-size:15px;font-weight:600;line-height:22px;color:var(--dshg-text)}",
			// ---- repository settings dialog ----
			".dshg-repoCard{width:min(440px,100%)}",
			".dshg-modalTitleRow{display:flex;align-items:center;justify-content:space-between;gap:8px}",
			".dshg-repoNotice{font-size:12px;color:var(--dshg-ok,#1e8e5a)}",
			".dshg-repoSection{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dshg-border);padding-top:10px}",
			".dshg-repoTitle{font-size:13px;font-weight:600;color:var(--dshg-text)}",
			".dshg-repoHint{font-size:11.5px;line-height:16px;color:var(--dshg-muted);word-break:break-all}",
			".dshg-repoRow{display:flex;align-items:center;gap:8px}",
			".dshg-repoLabel{flex:none;width:70px;font-size:11.5px;color:var(--dshg-sub)}",
			".dshg-repoRadio{display:flex;align-items:flex-start;gap:6px;font-size:12px;color:var(--dshg-text);cursor:pointer}",
			".dshg-repoRadioTitle{display:block;font-size:12px;color:var(--dshg-text)}",
			".dshg-repoRadioNote{display:block;font-size:10.5px;color:var(--dshg-muted)}",
			".dshg-repoCard .dshg-setSelect{width:100%;box-sizing:border-box;height:30px;border-radius:7px;border:1px solid var(--dshg-border);background:var(--dshg-solid,var(--dsw-specific-menu,#fff));color:var(--dshg-text);font-size:12px;padding:0 8px}",
			".dshg-ignoreEditor{width:100%;box-sizing:border-box;min-height:120px;resize:vertical;padding:6px 8px;border-radius:7px;border:1px solid var(--dshg-border);background:var(--dshg-solid,var(--dsw-specific-menu,#fff));color:var(--dshg-text);font-size:12px;line-height:17px}",
			".dshg-ignoreRules{max-height:150px;overflow:auto;border:1px solid var(--dshg-border);border-radius:7px}",
			".dshg-searchRow{display:flex;align-items:center;gap:8px}",
			".dshg-searchRow .dshg-repoTitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshg-searchInput{flex:1;min-width:0;box-sizing:border-box;height:26px;padding:0 8px;border-radius:7px;border:1px solid var(--dshg-border);background:var(--dshg-solid,var(--dsw-specific-menu,#fff));color:var(--dshg-text);font-size:12px}",
			".dshg-searchBtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:none;border-radius:5px;background:transparent;color:var(--dshg-sub);cursor:pointer;user-select:none;-webkit-user-select:none}",
			".dshg-searchBtn:hover{background:var(--dshg-hover);color:var(--dshg-text)}",
			".dshg-ignoreRule{display:flex;align-items:center;gap:6px;padding:1px 8px 1px 2px;border-bottom:1px solid var(--dshg-border);min-height:20px}",
			".dshg-ignoreRule:last-child{border-bottom:none}",
			".dshg-ignoreRuleLine{flex:none;width:18px;text-align:right;font-size:10px;color:var(--dshg-muted)}",
			".dshg-ignoreRuleText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:16px;color:var(--dshg-text)}",
			".dshg-ignoreKind{flex:none;font-size:10px;line-height:14px;padding:0 5px;border-radius:4px;border:1px solid var(--dshg-border);color:var(--dshg-sub);background:color-mix(in srgb,var(--dshg-text) 4%,transparent)}",
			".dshg-ignoreKindDir{color:var(--dsw-alias-accent,#3b82f6);border-color:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 45%,transparent)}",
			".dshg-ignoreKindFile{color:var(--dshg-ok,#1e8e5a)}",
			".dshg-ignoreKindGlob{color:var(--dshg-warn,#c98a1b)}",
			".dshg-ignoreKindNeg{color:var(--dshg-danger,#d5482f)}",
			".dshg-ignoreKindName{color:var(--dshg-muted)}",
			".dshg-ignoreWhitelist{font-size:11.5px;line-height:16px;padding:5px 8px;border-radius:6px;border:1px solid color-mix(in srgb,var(--dshg-warn,#c98a1b) 45%,transparent);background:color-mix(in srgb,var(--dshg-warn,#c98a1b) 8%,transparent);color:var(--dshg-warn,#c98a1b)}",
			".dshg-ignoreDel{flex:none;height:18px;padding:0 7px;font:inherit;font-size:10.5px;line-height:16px;border:.5px solid var(--dshg-border);border-radius:5px;background:transparent;color:var(--dshg-sub);cursor:pointer}",
			".dshg-ignoreDel:hover{background:var(--dshg-hover);color:var(--dshg-text)}",
			".dshg-ignoreDel:disabled{opacity:.5;cursor:default}",
			".dshg-ignoreFiles{max-height:170px;overflow:auto;border:1px solid var(--dshg-border);border-radius:7px}",
			".dshg-ignoreFile{display:flex;align-items:center;gap:6px;padding:1px 8px;border-bottom:1px solid var(--dshg-border);cursor:pointer;min-height:20px;user-select:none;-webkit-user-select:none}",
			".dshg-ignoreFile:last-child{border-bottom:none}",
			".dshg-ignoreFile:hover{background:var(--dshg-hover)}",
			".dshg-ignoreFilePath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;color:var(--dshg-sub)}",
			".dshg-ignoreFileHint{flex:none;font-size:10.5px;color:var(--dshg-muted)}",
			".dshg-setHeadRow{display:flex;align-items:center;gap:8px;margin:0 0 14px;color:var(--dshg-text)}",
			".dshg-setHeadLabel{font-size:15px;font-weight:600;letter-spacing:.2px}",
			".dshg-setHint{margin:0;font-size:12px;line-height:17px;color:var(--dshg-muted)}",
			".dshg-setRows{display:flex;flex-direction:column;gap:2px}",
			".dshg-setRow{display:flex;align-items:center;gap:14px;min-height:40px;padding:5px 0}",
			".dshg-setRowTop{align-items:flex-start}",
			".dshg-setLabel{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}",
			".dshg-setName{font-size:13px;color:var(--dshg-text)}",
			".dshg-setNote{font-size:11.5px;line-height:16px;color:var(--dshg-muted)}",
			".dshg-setCtl{flex:none;display:flex;align-items:center;gap:8px;justify-content:flex-end}",
			".dshg-setInput{height:36px;min-width:200px;box-sizing:border-box;padding:0 12px;font:inherit;font-size:13px;color:var(--dshg-text);background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));border:.5px solid var(--dsw-alias-border-l4,var(--dshg-border));border-radius:var(--dsw-radius-md,12px);outline:none}",
			".dshg-setInput::placeholder{color:var(--dshg-muted)}",
			".dshg-setInput:focus{border-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));box-shadow:inset 0 0 0 .5px var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}",
			".dshg-setInput:disabled{opacity:.55;cursor:not-allowed}",
			".dshg-setSelect{height:36px;box-sizing:border-box;padding:0 10px;font:inherit;font-size:13px;color:var(--dshg-text);background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));border:.5px solid var(--dsw-alias-border-l4,var(--dshg-border));border-radius:var(--dsw-radius-md,12px);outline:none;cursor:pointer}",
			".dshg-setBtn{height:32px;padding:0 12px;font:inherit;font-size:13px;color:var(--dshg-text);background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));border:.5px solid var(--dsw-alias-border-l4,var(--dshg-border));border-radius:var(--dsw-radius-md,12px);cursor:pointer}",
			".dshg-setBtn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}",
			".dshg-setBtn:disabled{opacity:.5;cursor:not-allowed}",
			".dshg-setBtnPrimary{color:var(--dsw-alias-label-primary-inverse,#fff);background:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));border-color:transparent}",
			".dshg-setSwitch{position:relative;flex:none;width:38px;height:22px;border-radius:999px;background:color-mix(in srgb,var(--dshg-text) 18%,transparent);border:.5px solid transparent;cursor:pointer;transition:background var(--ds-transition-duration-fast,.1s) ease-out;padding:0}",
			".dshg-setSwitchOn{background:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}",
			".dshg-setSwitch:disabled{opacity:.5;cursor:not-allowed}",
			".dshg-setKnob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform var(--ds-transition-duration-fast,.1s) ease-out}",
			".dshg-setSwitchOn .dshg-setKnob{transform:translateX(16px)}",
			".dshg-setState{font-size:12px;color:var(--dshg-muted);min-height:16px}",
			".dshg-setNotice{padding:8px 12px;border-radius:var(--dsw-radius-md,12px);font-size:12px;line-height:18px;background:color-mix(in srgb,var(--dshg-ok) 10%,transparent);color:var(--dshg-ok)}",
			".dshg-setWarn{padding:10px 12px;border-radius:var(--dsw-radius-md,12px);font-size:12px;line-height:18px;background:var(--dsw-alias-state-warn-tertiary,color-mix(in srgb,var(--dshg-warn) 12%,transparent));color:var(--dshg-warn)}",
			".dshg-setCode{font-family:var(--ds-font-family-code,var(--dsw-font-ui,inherit));font-size:12px;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-module-platform,var(--dsw-alias-bg-layer-3))}",
			".dshg-setTokenRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}",
			".dshg-setAccount{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dshg-text)}",
			".dshg-setAccountDot{width:7px;height:7px;border-radius:50%;background:var(--dshg-ok);flex:none}",
		].join("");
		const cssTagId = "@dsh-external/dsh-client-ui-git/main.css";
		if (typeof document !== "undefined") {
			const existing = document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]");
			const tag = existing !== null && existing !== void 0 ? existing : document.createElement("style");
			if (existing === null || existing === void 0) {
				tag.dataset.plugin = "@dsh-external/dsh-client-ui-git";
				tag.dataset.pluginCss = cssTagId;
				document.head.appendChild(tag);
			}
			// Always refresh the text: a hot-reloaded bundle must not keep stale CSS
			// (this is why new styles appeared to be ignored after reloads).
			if (tag.textContent !== css) tag.textContent = css;
		}
		//#endregion

		//#region shared panel store
		// Module-level store so the footer badge and the drawer share one fact
		// source without crossing cordis scopes. IMMUTABLE updates (new object
		// identity per setStore) so react useSyncExternalStore sees real changes —
		// mutating in place would make every snapshot compare equal and the UI
		// would never refresh.
		// Dev diagnostics (the bottom strip that prints how the workspace was
		// resolved). OFF by default; a future settings page flips it through
		// `window.__dshGitDev.set(true)` and the choice is persisted locally.
		const DEV_STORAGE_KEY = "dsh-git-dev-mode";
		function readDevMode() {
			try {
				if (typeof window !== "undefined" && window.localStorage !== void 0 && window.localStorage !== null) {
					return window.localStorage.getItem(DEV_STORAGE_KEY) === "1";
				}
			} catch (error) {
				// Storage can be unavailable (private mode / sandbox); stay off.
			}
			return false;
		}
		// Branch filter persistence. The data lives in the plugin's own `.data`
		// directory (host half owns the file), so uninstalling the plugin removes
		// it and the workspace is never touched. An empty list means "all branches".
		// Credential hint: when this repository is dismissed ("don't show again"),
		// the panel stops offering credential-dependent actions for it.
		const ACCOUNT_HINT_KEY = (root) => `account-hint:${root}`;
		async function loadAccountHint(ctx, root) {
			try {
				const envelope = await callRemote(ctx, "readPluginState", { path: root, key: ACCOUNT_HINT_KEY(root) });
				const text = envelope !== null && typeof envelope === "object" && typeof envelope.value === "string" ? envelope.value : envelope;
				const parsed = JSON.parse(String(text ?? "null"));
				return parsed === true;
			} catch (error) {
				return false;
			}
		}
		async function saveAccountHint(ctx, root, dismissed) {
			try {
				await callRemote(ctx, "writePluginState", { path: root, key: ACCOUNT_HINT_KEY(root), value: JSON.stringify(dismissed === true) });
			} catch (error) {
				// Persistence failure must never break the panel.
			}
		}
		/** Probe one runtime dependency (git binary / GCM) and remember the verdict. */
		async function probeDependency(ctx, target) {
			try {
				const result = await callRemote(ctx, "checkDependency", { target });
				const available = result?.available === true;
				setStore({ deps: { ...(store.deps ?? {}), [target]: available } });
				return available;
			} catch (error) {
				return null;
			}
		}
		const BRANCH_FILTER_KEY = (root) => `branch-filter:${root}`;
		async function loadBranchFilter(ctx, root) {
			try {
				const envelope = await callRemote(ctx, "readPluginState", { path: root, key: BRANCH_FILTER_KEY(root) });
				// The api gateway wraps the host result once more: the payload is
				// {ok, value:{ok, value:"<json>"}}, so unwrap before parsing.
				const text = envelope !== null && typeof envelope === "object" && typeof envelope.value === "string" ? envelope.value : envelope;
				const parsed = JSON.parse(String(text ?? "null"));
				return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
			} catch (error) {
				return [];
			}
		}
		async function saveBranchFilter(ctx, root, names) {
			try {
				await callRemote(ctx, "writePluginState", { path: root, key: BRANCH_FILTER_KEY(root), value: JSON.stringify(Array.isArray(names) ? names : []) });
			} catch (error) {
				// Persistence failure must never break the panel.
			}
		}
		// "recycle": the live trash-can entry. "expand": the finished animated more
		// bar (kept for later; see MoreBar + its CSS block). One-line switch.
		const MORE_BAR_MODE = "expand";
		let storeBase = {
			cwd: null,
			snapshot: null,
			log: null,
			status: null,
			branch: null,
			// History-shaping reflog events (branch created / merged / reset); the commit
			// graph cannot express these, so they ride alongside the log.
			reflogEvents: [],
			// Branch panel data (tip, last commit, merged state, creation record).
			branchDetails: null,
			// In-progress merge / squash / revert / cherry-pick and its conflicts.
			repoOperation: null,
			// One conflict file's worktree copy + the three index stages.
			conflictFile: null,
			conflictFileKey: null,
			conflictFileError: null,
			conflictFileLoading: false,
			// Recycle bin: commits no ref reaches any more.
			orphans: null,
			orphansError: null,
			orphansLoading: false,
			// Reserved for the future settings panel: hide conflict files from the
			// working-tree list. OFF by default (the bubble and the tree both list them).
			conflictListFilter: false,
			// Commit detail (files + statuses for the drawer's detail page).
			detail: null,
			detailHash: null,
			// Which commit actually owns the cached detail payload.
			detailLoadedHash: null,
			detailError: null,
			detailLoading: false,
			// One file's patch inside the open detail page.
			fileDiff: null,
			fileDiffKey: null,
			// Which key actually owns the currently cached patch. Rendering checks
			// this so stale data from another commit/file can never flash.
			fileDiffLoadedKey: null,
			fileDiffError: null,
			fileDiffLoading: false,
			// Working-tree file preview popup (opened by left-clicking a file row).
			workDiff: null,
			workDiffPath: null,
			workDiffError: null,
			workDiffLoading: false,
			error: null,
			clientError: null,
			working: false,
			opMessage: null,
			loading: false,
			// Where dialogs appear: "panel" = centred inside the drawer (default),
			// "screen" = centred in the viewport. A control panel may flip it via
			// window.__dshGitUi.setModalAnchor().
			modalAnchor: "panel",
			// Branch filter, restored from the plugin-local store on every refresh.
			branchFilter: [],
			// Pending push/pull work for the current branch (null until first read)
			// and the remote-tracking branches the panel lists separately.
			sync: null,
			remoteBranches: [],
			// Remote target (name / url / owner / repo) for the PR button.
			remoteInfo: null,
			// Background `git fetch` state: idle | running | ok | failed.
			// "failed" surfaces the cloud-with-x button in the header.
			fetchState: "idle",
			devMode: readDevMode(),
			// Effective plugin settings (host half owns them): commit identity,
			// reflog backup, DSH-settings visibility, dialog anchor. `null` until
			// the first read lands, so the panel can tell "loading" from "empty".
			settings: null,
			settingsError: null,
			settingsBusy: false,
			// GitHub auth (delegated to Git Credential Manager). `accounts` is
			// null until the first read lands; `login` tracks one browser OAuth
			// attempt ({ id, status, error }) and is polled while pending.
			githubAccounts: null,
			githubError: null,
			githubLogin: null,
			// Per-repository "don't show the no-account hint again" flag.
			accountHintDismissed: false,
			// Runtime dependency probes: null = unknown, true/false after a check.
			deps: { git: null, gcm: null },
			version: 0
		};
		let store = storeBase;
		// Last background `git fetch` attempt (ms). Module-level so switching
		// workspaces does not let two panels fetch in a tight loop.
		let lastFetchAt = 0;
		const FETCH_THROTTLE_MS = 30000;
		// Permission probe cache: keyed by "<account>|<owner>/<repo>", with the TTL
		// coming from settings (default 5 minutes).
		let permissionCache = { key: "", value: null, checkedAt: 0 };
		const listeners = new Set();
		function subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
		function getSnapshot() {
			return store;
		}
		function setStore(patch) {
			const version = store.version + 1;
			store = { ...store, ...patch, version };
			for (const listener of [...listeners]) {
				try {
					listener();
				} catch (error) {
					console.error("[ui-git] store listener threw:", error);
				}
			}
		}
		function storeFace() {
			return { subscribe, getSnapshot };
		}
		/**
		 * Toggle the dev diagnostics strip. This is the hook a settings page will
		 * call; it also persists the choice so it survives a reload.
		 */
		function setDevMode(enabled) {
			const value = enabled === true;
			setStore({ devMode: value });
			try {
				if (typeof window !== "undefined" && window.localStorage !== void 0 && window.localStorage !== null) {
					window.localStorage.setItem(DEV_STORAGE_KEY, value ? "1" : "0");
				}
			} catch (error) {
				// Non-fatal: the in-memory flag still controls this session.
			}
			return value;
		}
		// Guard rails: capture uncaught runtime errors so a bad render never
		// silently takes the whole slot down; the message is shown in the
		// footer/tooltip so it is reportable instead of invisible.
		if (typeof window !== "undefined") {
			window.addEventListener("error", (event) => {
				setStore({ clientError: (event?.error?.message ?? event?.message) || "uncaught error" });
			});
			window.addEventListener("unhandledrejection", (event) => {
				setStore({ clientError: event?.reason?.message || String(event?.reason ?? "unhandled rejection") });
			});
		}
		/**
		* Local error boundary so a crash inside a git component degrades to a
		* visible fallback instead of abdicating the whole slot entry forever.
		*/
		function Safeguard({ fallback, children }) {
			return (0, react_jsx_runtime.jsx)(SafeguardBoundary, { fallback, children });
		}
		class SafeguardBoundary extends react.Component {
			constructor(props) {
				super(props);
				this.state = { failed: null };
			}
			static getDerivedStateFromError(error) {
				return { failed: error };
			}
			componentDidCatch(error) {
				console.error("[ui-git] component crashed:", error);
				setStore({ clientError: error?.message || String(error) });
			}
			render() {
				if (this.state.failed !== null) {
					if (typeof this.props.fallback === "function") return this.props.fallback(this.state.failed);
					return this.props.fallback ?? null;
				}
				return this.props.children;
			}
		}
		//#endregion

		//#region icons
		function GitIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M21.2 11.4 12.6 2.8c-.5-.5-1.3-.5-1.8 0L9 4.6l2.3 2.3c.5-.2 1.1-.1 1.5.3.4.4.5 1 .3 1.5l2.2 2.2c.5-.2 1.1-.1 1.5.3.6.6.6 1.5 0 2.1-.6.6-1.5.6-2.1 0-.4-.4-.5-1-.3-1.5l-2-2v5.1c.4.2.7.6.7 1.1 0 .7-.6 1.3-1.3 1.3s-1.3-.6-1.3-1.3c0-.5.2-.9.6-1.1V9.7c-.4-.2-.6-.6-.6-1.1 0-.4.2-.8.5-1L9.8 5.2 2.8 12.2c-.5.5-.5 1.3 0 1.8l8.6 8.6c.5.5 1.3.5 1.8 0l8-8c.5-.5.5-1.3 0-1.8Z",
					fill: "currentColor"
				})
			});
		}
		/** Squash glyph: two branches converging into one line. */
		function SquashIcon({ size = 14 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					h("path", { d: "M3 3v3l5 3.5 5-3.5V3" }),
					h("path", { d: "M8 9.5V14" }),
					h("path", { d: "M6 12l2 2 2-2" })
				]
			});
		}
		/** Amend glyph: a folded-corner sheet with a plus cut into its corner. */
		function AmendIcon({ size = 14 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					h("path", { d: "M3.5 1.5h6L13 5v9.5h-9.5z" }),
					h("path", { d: "M9.5 1.5V5H13" }),
					// Transparent cut-out (menu background) so the sheet lines stop at the plus.
					h("circle", { cx: 12, cy: 12, r: 3.2, fill: "var(--dsw-specific-menu,#fff)", stroke: "none" }),
					h("path", { d: "M12 9.6v4.8M9.6 12h4.8" })
				]
			});
		}
		function CloseIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M4 4l8 8M12 4l-8 8",
					stroke: "currentColor",
					strokeWidth: 1.6,
					strokeLinecap: "round"
				})
			});
		}
		function ArrowUpIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M3.8 7.7L8 3.5l4.2 4.2",
					stroke: "currentColor",
					strokeWidth: 1.6,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function RefreshIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3",
					stroke: "currentColor",
					strokeWidth: 1.5,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function FolderIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.5 2H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V4Z",
					stroke: "currentColor",
					strokeWidth: 1.3,
					strokeLinejoin: "round"
				})
			});
		}
		//#endregion

		//#region helpers
		/** "2026-01-05T03:04:05+08:00" -> "1月5日" / "3分钟前"-style label. */
		function formatDate(iso, t) {
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return iso;
			const diff = Date.now() - date.getTime();
			const minutes = Math.floor(diff / 60000);
			if (minutes < 1) return t("time.now");
			if (minutes < 60) return t("time.minutes", { n: minutes });
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return t("time.hours", { n: hours });
			const days = Math.floor(hours / 24);
			if (days < 7) return t("time.days", { n: days });
			return `${date.getMonth() + 1}月${date.getDate()}日`;
		}
		function basename(path) {
			if (typeof path !== "string") return "";
			const parts = path.split(/[\\/]/).filter((part) => part.length > 0);
			return parts.length > 0 ? parts[parts.length - 1] : path;
		}
		const STATUS_LABEL = { M: "M", A: "A", D: "D", R: "R", C: "C", U: "U", "?": "?" };
		function statusClass(x, y) {
			if (x === "?" || y === "?") return "dshg-chipB";
			if (x === "D" || y === "D") return "dshg-chipD";
			if (x === "A" || x === "R" || x === "C" || y === "A" || y === "R") return "dshg-chipA";
			if (x !== " " || y !== " ") return "dshg-chipM";
			return "";
		}
		/** Group status entries by directory; "" key = repo root. Defensive: no
		 * iterator-based loops so malformed payloads degrade instead of throwing. */
		function groupEntries(entries) {
			const result = [];
			const filesByDir = new Map();
			if (!Array.isArray(entries)) return result;
			for (let i = 0; i < entries.length; i += 1) {
				const entry = entries[i];
				if (entry === null || typeof entry !== "object" || typeof entry.path !== "string") continue;
				const parts = entry.path.split(/[\\/]/);
				const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
				let list = filesByDir.get(dir);
				if (list === void 0) {
					list = [];
					filesByDir.set(dir, list);
					result.push({ dir, items: list });
				}
				list.push(entry);
			}
			return result;
		}
		/** Defensive status label + color for one entry (never throws). */
		function fileLabel(entry) {
			const x = typeof entry?.x === "string" ? entry.x : "";
			const y = typeof entry?.y === "string" ? entry.y : "";
			return `${STATUS_LABEL[x] ?? x}${STATUS_LABEL[y] ?? y}`.trim();
		}
		//#endregion

		//#region refresh pipeline
		/** Fetch snapshot+log+status for a cwd; safe to call concurrently. */
		async function refreshAll(ctx, cwd) {
			if (typeof cwd !== "string" || cwd.length === 0) {
				setStore({ snapshot: null, log: null, status: null, error: null, loading: false, cwd: null });
				return;
			}
			// A refresh of the SAME workspace must keep the selected commit's diff:
			// the panel's own mount refresh and the footer badge refresh race with
			// the user clicking a commit, and clearing diffHash here used to wipe
			// the diff that had just loaded (the pane fell back to "loading").
			const sameWorkspace = store.cwd === cwd;
			setStore({ loading: true, error: null, cwd });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const snapshot = await run("snapshot", { path: cwd });
				// Non-repository directories: log/status/branch would fail inside
				// git, so only query them when snapshot proved a work tree.
				// reflogEvents rides along with the other reads: it supplies the branch
				// creation / merge events that a commit graph cannot express.
				// The branch panel and the conflict bubble ride along with the other
				// reads: both are cheap queries and the panel must be able to show an
				// in-progress operation the moment it is opened.
				const emptyOperation = { operation: null, conflicts: [], resolved: [], total: 0, unresolved: 0 };
				const emptySync = { ok: true, upstream: "", ahead: [], behind: [], aheadFiles: [], behindFiles: [], mergeBase: "" };
				const [log, status, branch, reflog, branchDetails, repoOperation, sync, remotes, branchSyncs, remoteInfo] = snapshot.repo === true
					? await Promise.all([
						run("log", { path: cwd, limit: 60 }),
						run("status", { path: cwd }),
						run("branch", { path: cwd }),
						run("reflogEvents", { path: cwd }),
						run("branchDetails", { path: cwd }),
						run("repoOperation", { path: cwd }),
						run("syncCommits", { path: cwd }),
						run("remoteBranches", { path: cwd }),
						run("branchSyncs", { path: cwd }),
						run("remoteInfo", { path: cwd })
					])
					: [{ commits: [] }, { clean: true, entries: [] }, { branches: [] }, { ok: true, events: [] }, { branches: [] }, emptyOperation, emptySync, { branches: [] }, { branches: [] }, { ok: true, name: "", url: "", host: "", owner: "", repo: "", github: false }];
				// Restore the persisted branch filter here (not in a component
				// effect): the read must happen with a live ctx and before the
				// panel renders its first tree.
				let branchFilter = [];
				let accountHintDismissed = false;
				if (snapshot.repo === true && typeof snapshot.root === "string" && snapshot.root.length > 0) {
					branchFilter = await loadBranchFilter(ctx, snapshot.root);
					accountHintDismissed = await loadAccountHint(ctx, snapshot.root);
				}
				setStore({
					snapshot,
					log,
					status,
					branch,
					reflogEvents: Array.isArray(reflog?.events) ? reflog.events : [],
					branchDetails,
					repoOperation,
					sync,
					remoteBranches: Array.isArray(remotes?.branches) ? remotes.branches : [],
					branchSyncs: Array.isArray(branchSyncs?.branches) ? branchSyncs.branches : [],
					remoteInfo: remoteInfo ?? null,
					branchFilter,
					accountHintDismissed,
					loading: false,
					error: null,
					// Switching workspaces must also drop the previous repo's fetch verdict,
					// otherwise the cloud-with-x icon survives into the new workspace.
					...(sameWorkspace ? null : { detail: null, detailHash: null, detailError: null, fileDiff: null, fileDiffKey: null, fileDiffError: null, conflictFile: null, conflictFileKey: null, fetchState: "idle" })
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				setStore({ loading: false, error: message });
				// A git command just failed: only then is it worth probing whether the
				// git binary itself is missing (spawn ENOENT). No GCM probe here.
				if (/ENOENT|not found|not recognized|无法找到|不是内部或外部命令|spawn/i.test(message)) {
					await probeDependency(ctx, "git");
				}
			}
		}
		/**
		 * Run one write action through ctx.remote.git, refresh after success, and
		 * surface the outcome in store.opMessage. Never throws.
		 */
		async function runAction(ctx, cwd, method, args) {
			setStore({ working: true, opMessage: null });
			try {
				const result = await ctx.remote.git[method]({ path: cwd, ...args });
				if (result.ok === false || result.ok === void 0) {
					const err = result?.error?.message || result?.error || "操作失败";
					setStore({ working: false, opMessage: { type: "error", text: err } });
					return result;
				}
				const value = result.value;
				// Business failure: git refused the operation (dirty tree, conflict,
				// not-merged...). The RPC envelope is still ok:true, so without this
				// check the panel claimed "操作成功" while nothing had changed.
				if (value !== null && typeof value === "object" && value.ok === false) {
					// A conflicting merge still leaves the tree in an operation state:
					// refresh so the conflict banner/tree appear instead of a bare error.
					if (Array.isArray(value.conflicts) && value.conflicts.length > 0) {
						setStore({ working: false, opMessage: { type: "error", text: `合并冲突：${value.conflicts.length} 个文件需要解决` } });
						refreshAll(ctx, cwd);
						return result;
					}
					setStore({ working: false, opMessage: { type: "error", text: value.error || value.errorCode || "操作失败" } });
					return result;
				}
				setStore({ working: false, opMessage: { type: "ok", text: value?.id ? `提交成功：${value.id}` : (value?.message || "操作成功") } });
				refreshAll(ctx, cwd);
				return result;
			} catch (error) {
				setStore({ working: false, opMessage: { type: "error", text: error instanceof Error ? error.message : String(error) } });
				return { ok: false };
			}
		}
		/** Fetch one commit's file list; keeps the previous list until it lands. */
		async function refreshDetail(ctx, cwd, hash) {
			// Keep the previous detail visible while loading so the slide-up pane
			// keeps its height instead of collapsing to a spinner and jumping.
			setStore({ detailHash: hash, detailError: null, detailLoading: true, fileDiff: null, fileDiffKey: null, fileDiffError: null });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const detail = await run("diff", { path: cwd, commit: hash, stat: true });
				setStore({ detail, detailError: null, detailLoading: false, detailLoadedHash: hash });
			} catch (error) {
				setStore({ detailError: error instanceof Error ? error.message : String(error), detailLoading: false });
			}
		}
		/** Fetch one file's patch inside the open commit detail. */
		async function refreshFileDiff(ctx, cwd, hash, path) {
			const key = `${hash}:${path}`;
			if (store.fileDiffKey === key && store.fileDiff !== null) return;
			// Same policy as the detail list: hold the previous patch (and its
			// height) until the new one arrives.
			setStore({ fileDiffKey: key, fileDiffError: null, fileDiffLoading: true });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const fileDiff = await run("diff", { path: cwd, commit: hash, paths: [path] });
				setStore({ fileDiff, fileDiffError: null, fileDiffLoading: false, fileDiffLoadedKey: key });
			} catch (error) {
				setStore({ fileDiff: null, fileDiffError: error instanceof Error ? error.message : String(error), fileDiffLoading: false });
			}
		}
		/** Working-tree patch for ONE file (staged + unstaged, compared with HEAD). */
		async function refreshWorkDiff(ctx, cwd, path) {
			if (store.workDiffPath === path && store.workDiff !== null) return;
			// Point the cache at the new path immediately: the previous file's patch
			// must stop counting as "ready" the moment the selection changes, and the
			// pane holds its height until the new data lands.
			setStore({ workDiffPath: path, workDiffError: null, workDiffLoading: true });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const workDiff = await run("diff", { path: cwd, paths: [path], base: "HEAD" });
				setStore({ workDiff, workDiffError: null, workDiffLoading: false });
			} catch (error) {
				setStore({ workDiff: null, workDiffError: error instanceof Error ? error.message : String(error), workDiffLoading: false });
			}
		}
		/** One remote call with the {ok, value} envelope unwrapped. */
		async function callRemote(ctx, method, request) {
			const result = await ctx.remote.git[method](request);
			if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
			return result.value;
		}
		/**
		 * Read one conflict file. No cache short-circuit: the whole point is to see
		 * the markers disappear while the user edits the file outside the panel.
		 */
		async function refreshConflictFile(ctx, cwd, path) {
			const key = `${cwd}:${path}`;
			setStore({ conflictFileKey: key, conflictFileError: null, conflictFileLoading: true });
			try {
				const file = await callRemote(ctx, "conflictFile", { path: cwd, file: path });
				if (store.conflictFileKey !== key) return;
				setStore({ conflictFile: file, conflictFileError: null, conflictFileLoading: false });
			} catch (error) {
				setStore({ conflictFile: null, conflictFileError: error instanceof Error ? error.message : String(error), conflictFileLoading: false });
			}
		}
		/** Load the recycle bin (commits no ref reaches any more). */
		async function refreshOrphans(ctx, cwd) {
			setStore({ orphansLoading: true, orphansError: null });
			try {
				const out = await callRemote(ctx, "orphanedCommits", { path: cwd });
				if (out.ok !== true) throw new Error(out.error ?? "读取回收站失败");
				setStore({ orphans: out.commits, orphansLoading: false });
			} catch (error) {
				setStore({ orphans: [], orphansError: error instanceof Error ? error.message : String(error), orphansLoading: false });
			}
		}
		/**
		 * Continue an in-progress operation. Files whose markers are gone are
		 * staged first (the panel only shows "resolved"; git needs the add), then
		 * the operation's own continue command runs.
		 */
		async function continueOperation(ctx, cwd) {
			const operation = store.repoOperation;
			const kind = operation?.operation?.kind;
			if (typeof kind !== "string") return;
			setStore({ working: true, opMessage: null });
			try {
				const ready = (operation.conflicts ?? []).filter((file) => file.blocks === 0).map((file) => file.path);
				if (ready.length > 0) await callRemote(ctx, "add", { path: cwd, paths: ready });
				const result = await callRemote(ctx, "operationContinue", { path: cwd, kind });
				setStore({ working: false, opMessage: { type: "ok", text: result?.message ?? "已完成" }, conflictFile: null, conflictFileKey: null });
				await refreshAll(ctx, cwd);
			} catch (error) {
				setStore({ working: false, opMessage: { type: "error", text: error instanceof Error ? error.message : String(error) } });
			}
		}
		/** Stage one conflict file (the detail pane's "标记已解决"). */
		async function markResolved(ctx, cwd, path) {
			setStore({ working: true, opMessage: null });
			try {
				await callRemote(ctx, "add", { path: cwd, paths: [path] });
				setStore({ working: false, opMessage: { type: "ok", text: `已标记 ${path}` }, conflictFile: null, conflictFileKey: null });
				await refreshAll(ctx, cwd);
			} catch (error) {
				setStore({ working: false, opMessage: { type: "error", text: error instanceof Error ? error.message : String(error) } });
			}
		}
		//#endregion

		// Prism.js 1.29.0 (MIT) — inlined because a client bundle cannot require
		// npm packages and this app may run offline. `manual` is forced so Prism
		// never auto-highlights the host page; only PatchLines calls it directly.
		const Prism = (function () {
			// Prism's UMD tail does `module.exports = Prism`; shadow `module` here so
			// it cannot hijack this bundle's exports.
			const module = { exports: {} };
			if (typeof window !== "undefined") window.Prism = { manual: true };

/* **********************************************
     Begin prism-core.js
********************************************** */

/// <reference lib="WebWorker"/>

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
			? self // if in worker
			: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 *
 * @license MIT <https://opensource.org/licenses/MIT>
 * @author Lea Verou <https://lea.verou.me>
 * @namespace
 * @public
 */
var Prism = (function (_self) {

	// Private helper vars
	var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
	var uniqueId = 0;

	// The grammar object for plaintext
	var plainTextGrammar = {};


	var _ = {
		/**
		 * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
		 * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
		 * additional languages or plugins yourself.
		 *
		 * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
		 *
		 * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
		 * empty Prism object into the global scope before loading the Prism script like this:
		 *
		 * ```js
		 * window.Prism = window.Prism || {};
		 * Prism.manual = true;
		 * // add a new <script> to load Prism's script
		 * ```
		 *
		 * @default false
		 * @type {boolean}
		 * @memberof Prism
		 * @public
		 */
		manual: _self.Prism && _self.Prism.manual,
		/**
		 * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
		 * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
		 * own worker, you don't want it to do this.
		 *
		 * By setting this value to `true`, Prism will not add its own listeners to the worker.
		 *
		 * You obviously have to change this value before Prism executes. To do this, you can add an
		 * empty Prism object into the global scope before loading the Prism script like this:
		 *
		 * ```js
		 * window.Prism = window.Prism || {};
		 * Prism.disableWorkerMessageHandler = true;
		 * // Load Prism's script
		 * ```
		 *
		 * @default false
		 * @type {boolean}
		 * @memberof Prism
		 * @public
		 */
		disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,

		/**
		 * A namespace for utility methods.
		 *
		 * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
		 * change or disappear at any time.
		 *
		 * @namespace
		 * @memberof Prism
		 */
		util: {
			encode: function encode(tokens) {
				if (tokens instanceof Token) {
					return new Token(tokens.type, encode(tokens.content), tokens.alias);
				} else if (Array.isArray(tokens)) {
					return tokens.map(encode);
				} else {
					return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
				}
			},

			/**
			 * Returns the name of the type of the given value.
			 *
			 * @param {any} o
			 * @returns {string}
			 * @example
			 * type(null)      === 'Null'
			 * type(undefined) === 'Undefined'
			 * type(123)       === 'Number'
			 * type('foo')     === 'String'
			 * type(true)      === 'Boolean'
			 * type([1, 2])    === 'Array'
			 * type({})        === 'Object'
			 * type(String)    === 'Function'
			 * type(/abc+/)    === 'RegExp'
			 */
			type: function (o) {
				return Object.prototype.toString.call(o).slice(8, -1);
			},

			/**
			 * Returns a unique number for the given object. Later calls will still return the same number.
			 *
			 * @param {Object} obj
			 * @returns {number}
			 */
			objId: function (obj) {
				if (!obj['__id']) {
					Object.defineProperty(obj, '__id', { value: ++uniqueId });
				}
				return obj['__id'];
			},

			/**
			 * Creates a deep clone of the given object.
			 *
			 * The main intended use of this function is to clone language definitions.
			 *
			 * @param {T} o
			 * @param {Record<number, any>} [visited]
			 * @returns {T}
			 * @template T
			 */
			clone: function deepClone(o, visited) {
				visited = visited || {};

				var clone; var id;
				switch (_.util.type(o)) {
					case 'Object':
						id = _.util.objId(o);
						if (visited[id]) {
							return visited[id];
						}
						clone = /** @type {Record<string, any>} */ ({});
						visited[id] = clone;

						for (var key in o) {
							if (o.hasOwnProperty(key)) {
								clone[key] = deepClone(o[key], visited);
							}
						}

						return /** @type {any} */ (clone);

					case 'Array':
						id = _.util.objId(o);
						if (visited[id]) {
							return visited[id];
						}
						clone = [];
						visited[id] = clone;

						(/** @type {Array} */(/** @type {any} */(o))).forEach(function (v, i) {
							clone[i] = deepClone(v, visited);
						});

						return /** @type {any} */ (clone);

					default:
						return o;
				}
			},

			/**
			 * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
			 *
			 * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
			 *
			 * @param {Element} element
			 * @returns {string}
			 */
			getLanguage: function (element) {
				while (element) {
					var m = lang.exec(element.className);
					if (m) {
						return m[1].toLowerCase();
					}
					element = element.parentElement;
				}
				return 'none';
			},

			/**
			 * Sets the Prism `language-xxxx` class of the given element.
			 *
			 * @param {Element} element
			 * @param {string} language
			 * @returns {void}
			 */
			setLanguage: function (element, language) {
				// remove all `language-xxxx` classes
				// (this might leave behind a leading space)
				element.className = element.className.replace(RegExp(lang, 'gi'), '');

				// add the new `language-xxxx` class
				// (using `classList` will automatically clean up spaces for us)
				element.classList.add('language-' + language);
			},

			/**
			 * Returns the script element that is currently executing.
			 *
			 * This does __not__ work for line script element.
			 *
			 * @returns {HTMLScriptElement | null}
			 */
			currentScript: function () {
				if (typeof document === 'undefined') {
					return null;
				}
				if ('currentScript' in document && 1 < 2 /* hack to trip TS' flow analysis */) {
					return /** @type {any} */ (document.currentScript);
				}

				// IE11 workaround
				// we'll get the src of the current script by parsing IE11's error stack trace
				// this will not work for inline scripts

				try {
					throw new Error();
				} catch (err) {
					// Get file src url from stack. Specifically works with the format of stack traces in IE.
					// A stack will look like this:
					//
					// Error
					//    at _.util.currentScript (http://localhost/components/prism-core.js:119:5)
					//    at Global code (http://localhost/components/prism-core.js:606:1)

					var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
					if (src) {
						var scripts = document.getElementsByTagName('script');
						for (var i in scripts) {
							if (scripts[i].src == src) {
								return scripts[i];
							}
						}
					}
					return null;
				}
			},

			/**
			 * Returns whether a given class is active for `element`.
			 *
			 * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
			 * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
			 * given class is just the given class with a `no-` prefix.
			 *
			 * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
			 * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
			 * ancestors have the given class or the negated version of it, then the default activation will be returned.
			 *
			 * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
			 * version of it, the class is considered active.
			 *
			 * @param {Element} element
			 * @param {string} className
			 * @param {boolean} [defaultActivation=false]
			 * @returns {boolean}
			 */
			isActive: function (element, className, defaultActivation) {
				var no = 'no-' + className;

				while (element) {
					var classList = element.classList;
					if (classList.contains(className)) {
						return true;
					}
					if (classList.contains(no)) {
						return false;
					}
					element = element.parentElement;
				}
				return !!defaultActivation;
			}
		},

		/**
		 * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
		 *
		 * @namespace
		 * @memberof Prism
		 * @public
		 */
		languages: {
			/**
			 * The grammar for plain, unformatted text.
			 */
			plain: plainTextGrammar,
			plaintext: plainTextGrammar,
			text: plainTextGrammar,
			txt: plainTextGrammar,

			/**
			 * Creates a deep copy of the language with the given id and appends the given tokens.
			 *
			 * If a token in `redef` also appears in the copied language, then the existing token in the copied language
			 * will be overwritten at its original position.
			 *
			 * ## Best practices
			 *
			 * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
			 * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
			 * understand the language definition because, normally, the order of tokens matters in Prism grammars.
			 *
			 * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
			 * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
			 *
			 * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
			 * @param {Grammar} redef The new tokens to append.
			 * @returns {Grammar} The new language created.
			 * @public
			 * @example
			 * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
			 *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
			 *     // at its original position
			 *     'comment': { ... },
			 *     // CSS doesn't have a 'color' token, so this token will be appended
			 *     'color': /\b(?:red|green|blue)\b/
			 * });
			 */
			extend: function (id, redef) {
				var lang = _.util.clone(_.languages[id]);

				for (var key in redef) {
					lang[key] = redef[key];
				}

				return lang;
			},

			/**
			 * Inserts tokens _before_ another token in a language definition or any other grammar.
			 *
			 * ## Usage
			 *
			 * This helper method makes it easy to modify existing languages. For example, the CSS language definition
			 * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
			 * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
			 * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
			 * this:
			 *
			 * ```js
			 * Prism.languages.markup.style = {
			 *     // token
			 * };
			 * ```
			 *
			 * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
			 * before existing tokens. For the CSS example above, you would use it like this:
			 *
			 * ```js
			 * Prism.languages.insertBefore('markup', 'cdata', {
			 *     'style': {
			 *         // token
			 *     }
			 * });
			 * ```
			 *
			 * ## Special cases
			 *
			 * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
			 * will be ignored.
			 *
			 * This behavior can be used to insert tokens after `before`:
			 *
			 * ```js
			 * Prism.languages.insertBefore('markup', 'comment', {
			 *     'comment': Prism.languages.markup.comment,
			 *     // tokens after 'comment'
			 * });
			 * ```
			 *
			 * ## Limitations
			 *
			 * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
			 * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
			 * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
			 * deleting properties which is necessary to insert at arbitrary positions.
			 *
			 * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
			 * Instead, it will create a new object and replace all references to the target object with the new one. This
			 * can be done without temporarily deleting properties, so the iteration order is well-defined.
			 *
			 * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
			 * you hold the target object in a variable, then the value of the variable will not change.
			 *
			 * ```js
			 * var oldMarkup = Prism.languages.markup;
			 * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
			 *
			 * assert(oldMarkup !== Prism.languages.markup);
			 * assert(newMarkup === Prism.languages.markup);
			 * ```
			 *
			 * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
			 * object to be modified.
			 * @param {string} before The key to insert before.
			 * @param {Grammar} insert An object containing the key-value pairs to be inserted.
			 * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
			 * object to be modified.
			 *
			 * Defaults to `Prism.languages`.
			 * @returns {Grammar} The new grammar object.
			 * @public
			 */
			insertBefore: function (inside, before, insert, root) {
				root = root || /** @type {any} */ (_.languages);
				var grammar = root[inside];
				/** @type {Grammar} */
				var ret = {};

				for (var token in grammar) {
					if (grammar.hasOwnProperty(token)) {

						if (token == before) {
							for (var newToken in insert) {
								if (insert.hasOwnProperty(newToken)) {
									ret[newToken] = insert[newToken];
								}
							}
						}

						// Do not insert token which also occur in insert. See #1525
						if (!insert.hasOwnProperty(token)) {
							ret[token] = grammar[token];
						}
					}
				}

				var old = root[inside];
				root[inside] = ret;

				// Update references in other language definitions
				_.languages.DFS(_.languages, function (key, value) {
					if (value === old && key != inside) {
						this[key] = ret;
					}
				});

				return ret;
			},

			// Traverse a language definition with Depth First Search
			DFS: function DFS(o, callback, type, visited) {
				visited = visited || {};

				var objId = _.util.objId;

				for (var i in o) {
					if (o.hasOwnProperty(i)) {
						callback.call(o, i, o[i], type || i);

						var property = o[i];
						var propertyType = _.util.type(property);

						if (propertyType === 'Object' && !visited[objId(property)]) {
							visited[objId(property)] = true;
							DFS(property, callback, null, visited);
						} else if (propertyType === 'Array' && !visited[objId(property)]) {
							visited[objId(property)] = true;
							DFS(property, callback, i, visited);
						}
					}
				}
			}
		},

		plugins: {},

		/**
		 * This is the most high-level function in Prism’s API.
		 * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
		 * each one of them.
		 *
		 * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
		 *
		 * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
		 * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
		 * @memberof Prism
		 * @public
		 */
		highlightAll: function (async, callback) {
			_.highlightAllUnder(document, async, callback);
		},

		/**
		 * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
		 * {@link Prism.highlightElement} on each one of them.
		 *
		 * The following hooks will be run:
		 * 1. `before-highlightall`
		 * 2. `before-all-elements-highlight`
		 * 3. All hooks of {@link Prism.highlightElement} for each element.
		 *
		 * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
		 * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
		 * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
		 * @memberof Prism
		 * @public
		 */
		highlightAllUnder: function (container, async, callback) {
			var env = {
				callback: callback,
				container: container,
				selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
			};

			_.hooks.run('before-highlightall', env);

			env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));

			_.hooks.run('before-all-elements-highlight', env);

			for (var i = 0, element; (element = env.elements[i++]);) {
				_.highlightElement(element, async === true, env.callback);
			}
		},

		/**
		 * Highlights the code inside a single element.
		 *
		 * The following hooks will be run:
		 * 1. `before-sanity-check`
		 * 2. `before-highlight`
		 * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
		 * 4. `before-insert`
		 * 5. `after-highlight`
		 * 6. `complete`
		 *
		 * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
		 * the element's language.
		 *
		 * @param {Element} element The element containing the code.
		 * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
		 * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
		 * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
		 * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
		 *
		 * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
		 * asynchronous highlighting to work. You can build your own bundle on the
		 * [Download page](https://prismjs.com/download.html).
		 * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
		 * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
		 * @memberof Prism
		 * @public
		 */
		highlightElement: function (element, async, callback) {
			// Find language
			var language = _.util.getLanguage(element);
			var grammar = _.languages[language];

			// Set language on the element, if not present
			_.util.setLanguage(element, language);

			// Set language on the parent, for styling
			var parent = element.parentElement;
			if (parent && parent.nodeName.toLowerCase() === 'pre') {
				_.util.setLanguage(parent, language);
			}

			var code = element.textContent;

			var env = {
				element: element,
				language: language,
				grammar: grammar,
				code: code
			};

			function insertHighlightedCode(highlightedCode) {
				env.highlightedCode = highlightedCode;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
				callback && callback.call(env.element);
			}

			_.hooks.run('before-sanity-check', env);

			// plugins may change/add the parent/element
			parent = env.element.parentElement;
			if (parent && parent.nodeName.toLowerCase() === 'pre' && !parent.hasAttribute('tabindex')) {
				parent.setAttribute('tabindex', '0');
			}

			if (!env.code) {
				_.hooks.run('complete', env);
				callback && callback.call(env.element);
				return;
			}

			_.hooks.run('before-highlight', env);

			if (!env.grammar) {
				insertHighlightedCode(_.util.encode(env.code));
				return;
			}

			if (async && _self.Worker) {
				var worker = new Worker(_.filename);

				worker.onmessage = function (evt) {
					insertHighlightedCode(evt.data);
				};

				worker.postMessage(JSON.stringify({
					language: env.language,
					code: env.code,
					immediateClose: true
				}));
			} else {
				insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
			}
		},

		/**
		 * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
		 * and the language definitions to use, and returns a string with the HTML produced.
		 *
		 * The following hooks will be run:
		 * 1. `before-tokenize`
		 * 2. `after-tokenize`
		 * 3. `wrap`: On each {@link Token}.
		 *
		 * @param {string} text A string with the code to be highlighted.
		 * @param {Grammar} grammar An object containing the tokens to use.
		 *
		 * Usually a language definition like `Prism.languages.markup`.
		 * @param {string} language The name of the language definition passed to `grammar`.
		 * @returns {string} The highlighted HTML.
		 * @memberof Prism
		 * @public
		 * @example
		 * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
		 */
		highlight: function (text, grammar, language) {
			var env = {
				code: text,
				grammar: grammar,
				language: language
			};
			_.hooks.run('before-tokenize', env);
			if (!env.grammar) {
				throw new Error('The language "' + env.language + '" has no grammar.');
			}
			env.tokens = _.tokenize(env.code, env.grammar);
			_.hooks.run('after-tokenize', env);
			return Token.stringify(_.util.encode(env.tokens), env.language);
		},

		/**
		 * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
		 * and the language definitions to use, and returns an array with the tokenized code.
		 *
		 * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
		 *
		 * This method could be useful in other contexts as well, as a very crude parser.
		 *
		 * @param {string} text A string with the code to be highlighted.
		 * @param {Grammar} grammar An object containing the tokens to use.
		 *
		 * Usually a language definition like `Prism.languages.markup`.
		 * @returns {TokenStream} An array of strings and tokens, a token stream.
		 * @memberof Prism
		 * @public
		 * @example
		 * let code = `var foo = 0;`;
		 * let tokens = Prism.tokenize(code, Prism.languages.javascript);
		 * tokens.forEach(token => {
		 *     if (token instanceof Prism.Token && token.type === 'number') {
		 *         console.log(`Found numeric literal: ${token.content}`);
		 *     }
		 * });
		 */
		tokenize: function (text, grammar) {
			var rest = grammar.rest;
			if (rest) {
				for (var token in rest) {
					grammar[token] = rest[token];
				}

				delete grammar.rest;
			}

			var tokenList = new LinkedList();
			addAfter(tokenList, tokenList.head, text);

			matchGrammar(text, tokenList, grammar, tokenList.head, 0);

			return toArray(tokenList);
		},

		/**
		 * @namespace
		 * @memberof Prism
		 * @public
		 */
		hooks: {
			all: {},

			/**
			 * Adds the given callback to the list of callbacks for the given hook.
			 *
			 * The callback will be invoked when the hook it is registered for is run.
			 * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
			 *
			 * One callback function can be registered to multiple hooks and the same hook multiple times.
			 *
			 * @param {string} name The name of the hook.
			 * @param {HookCallback} callback The callback function which is given environment variables.
			 * @public
			 */
			add: function (name, callback) {
				var hooks = _.hooks.all;

				hooks[name] = hooks[name] || [];

				hooks[name].push(callback);
			},

			/**
			 * Runs a hook invoking all registered callbacks with the given environment variables.
			 *
			 * Callbacks will be invoked synchronously and in the order in which they were registered.
			 *
			 * @param {string} name The name of the hook.
			 * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
			 * @public
			 */
			run: function (name, env) {
				var callbacks = _.hooks.all[name];

				if (!callbacks || !callbacks.length) {
					return;
				}

				for (var i = 0, callback; (callback = callbacks[i++]);) {
					callback(env);
				}
			}
		},

		Token: Token
	};
	_self.Prism = _;


	// Typescript note:
	// The following can be used to import the Token type in JSDoc:
	//
	//   @typedef {InstanceType<import("./prism-core")["Token"]>} Token

	/**
	 * Creates a new token.
	 *
	 * @param {string} type See {@link Token#type type}
	 * @param {string | TokenStream} content See {@link Token#content content}
	 * @param {string|string[]} [alias] The alias(es) of the token.
	 * @param {string} [matchedStr=""] A copy of the full string this token was created from.
	 * @class
	 * @global
	 * @public
	 */
	function Token(type, content, alias, matchedStr) {
		/**
		 * The type of the token.
		 *
		 * This is usually the key of a pattern in a {@link Grammar}.
		 *
		 * @type {string}
		 * @see GrammarToken
		 * @public
		 */
		this.type = type;
		/**
		 * The strings or tokens contained by this token.
		 *
		 * This will be a token stream if the pattern matched also defined an `inside` grammar.
		 *
		 * @type {string | TokenStream}
		 * @public
		 */
		this.content = content;
		/**
		 * The alias(es) of the token.
		 *
		 * @type {string|string[]}
		 * @see GrammarToken
		 * @public
		 */
		this.alias = alias;
		// Copy of the full string this token was created from
		this.length = (matchedStr || '').length | 0;
	}

	/**
	 * A token stream is an array of strings and {@link Token Token} objects.
	 *
	 * Token streams have to fulfill a few properties that are assumed by most functions (mostly internal ones) that process
	 * them.
	 *
	 * 1. No adjacent strings.
	 * 2. No empty strings.
	 *
	 *    The only exception here is the token stream that only contains the empty string and nothing else.
	 *
	 * @typedef {Array<string | Token>} TokenStream
	 * @global
	 * @public
	 */

	/**
	 * Converts the given token or token stream to an HTML representation.
	 *
	 * The following hooks will be run:
	 * 1. `wrap`: On each {@link Token}.
	 *
	 * @param {string | Token | TokenStream} o The token or token stream to be converted.
	 * @param {string} language The name of current language.
	 * @returns {string} The HTML representation of the token or token stream.
	 * @memberof Token
	 * @static
	 */
	Token.stringify = function stringify(o, language) {
		if (typeof o == 'string') {
			return o;
		}
		if (Array.isArray(o)) {
			var s = '';
			o.forEach(function (e) {
				s += stringify(e, language);
			});
			return s;
		}

		var env = {
			type: o.type,
			content: stringify(o.content, language),
			tag: 'span',
			classes: ['token', o.type],
			attributes: {},
			language: language
		};

		var aliases = o.alias;
		if (aliases) {
			if (Array.isArray(aliases)) {
				Array.prototype.push.apply(env.classes, aliases);
			} else {
				env.classes.push(aliases);
			}
		}

		_.hooks.run('wrap', env);

		var attributes = '';
		for (var name in env.attributes) {
			attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
		}

		return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
	};

	/**
	 * @param {RegExp} pattern
	 * @param {number} pos
	 * @param {string} text
	 * @param {boolean} lookbehind
	 * @returns {RegExpExecArray | null}
	 */
	function matchPattern(pattern, pos, text, lookbehind) {
		pattern.lastIndex = pos;
		var match = pattern.exec(text);
		if (match && lookbehind && match[1]) {
			// change the match to remove the text matched by the Prism lookbehind group
			var lookbehindLength = match[1].length;
			match.index += lookbehindLength;
			match[0] = match[0].slice(lookbehindLength);
		}
		return match;
	}

	/**
	 * @param {string} text
	 * @param {LinkedList<string | Token>} tokenList
	 * @param {any} grammar
	 * @param {LinkedListNode<string | Token>} startNode
	 * @param {number} startPos
	 * @param {RematchOptions} [rematch]
	 * @returns {void}
	 * @private
	 *
	 * @typedef RematchOptions
	 * @property {string} cause
	 * @property {number} reach
	 */
	function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
		for (var token in grammar) {
			if (!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			var patterns = grammar[token];
			patterns = Array.isArray(patterns) ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				if (rematch && rematch.cause == token + ',' + j) {
					return;
				}

				var patternObj = patterns[j];
				var inside = patternObj.inside;
				var lookbehind = !!patternObj.lookbehind;
				var greedy = !!patternObj.greedy;
				var alias = patternObj.alias;

				if (greedy && !patternObj.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
					patternObj.pattern = RegExp(patternObj.pattern.source, flags + 'g');
				}

				/** @type {RegExp} */
				var pattern = patternObj.pattern || patternObj;

				for ( // iterate the token list and keep track of the current token/string position
					var currentNode = startNode.next, pos = startPos;
					currentNode !== tokenList.tail;
					pos += currentNode.value.length, currentNode = currentNode.next
				) {

					if (rematch && pos >= rematch.reach) {
						break;
					}

					var str = currentNode.value;

					if (tokenList.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					var removeCount = 1; // this is the to parameter of removeBetween
					var match;

					if (greedy) {
						match = matchPattern(pattern, pos, text, lookbehind);
						if (!match || match.index >= text.length) {
							break;
						}

						var from = match.index;
						var to = match.index + match[0].length;
						var p = pos;

						// find the node that contains the match
						p += currentNode.value.length;
						while (from >= p) {
							currentNode = currentNode.next;
							p += currentNode.value.length;
						}
						// adjust pos (and p)
						p -= currentNode.value.length;
						pos = p;

						// the current node is a Token, then the match starts inside another Token, which is invalid
						if (currentNode.value instanceof Token) {
							continue;
						}

						// find the last node which is affected by this match
						for (
							var k = currentNode;
							k !== tokenList.tail && (p < to || typeof k.value === 'string');
							k = k.next
						) {
							removeCount++;
							p += k.value.length;
						}
						removeCount--;

						// replace with the new match
						str = text.slice(pos, p);
						match.index -= pos;
					} else {
						match = matchPattern(pattern, 0, str, lookbehind);
						if (!match) {
							continue;
						}
					}

					// eslint-disable-next-line no-redeclare
					var from = match.index;
					var matchStr = match[0];
					var before = str.slice(0, from);
					var after = str.slice(from + matchStr.length);

					var reach = pos + str.length;
					if (rematch && reach > rematch.reach) {
						rematch.reach = reach;
					}

					var removeFrom = currentNode.prev;

					if (before) {
						removeFrom = addAfter(tokenList, removeFrom, before);
						pos += before.length;
					}

					removeRange(tokenList, removeFrom, removeCount);

					var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
					currentNode = addAfter(tokenList, removeFrom, wrapped);

					if (after) {
						addAfter(tokenList, currentNode, after);
					}

					if (removeCount > 1) {
						// at least one Token object was removed, so we have to do some rematching
						// this can only happen if the current pattern is greedy

						/** @type {RematchOptions} */
						var nestedRematch = {
							cause: token + ',' + j,
							reach: reach
						};
						matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);

						// the reach might have been extended because of the rematching
						if (rematch && nestedRematch.reach > rematch.reach) {
							rematch.reach = nestedRematch.reach;
						}
					}
				}
			}
		}
	}

	/**
	 * @typedef LinkedListNode
	 * @property {T} value
	 * @property {LinkedListNode<T> | null} prev The previous node.
	 * @property {LinkedListNode<T> | null} next The next node.
	 * @template T
	 * @private
	 */

	/**
	 * @template T
	 * @private
	 */
	function LinkedList() {
		/** @type {LinkedListNode<T>} */
		var head = { value: null, prev: null, next: null };
		/** @type {LinkedListNode<T>} */
		var tail = { value: null, prev: head, next: null };
		head.next = tail;

		/** @type {LinkedListNode<T>} */
		this.head = head;
		/** @type {LinkedListNode<T>} */
		this.tail = tail;
		this.length = 0;
	}

	/**
	 * Adds a new node with the given value to the list.
	 *
	 * @param {LinkedList<T>} list
	 * @param {LinkedListNode<T>} node
	 * @param {T} value
	 * @returns {LinkedListNode<T>} The added node.
	 * @template T
	 */
	function addAfter(list, node, value) {
		// assumes that node != list.tail && values.length >= 0
		var next = node.next;

		var newNode = { value: value, prev: node, next: next };
		node.next = newNode;
		next.prev = newNode;
		list.length++;

		return newNode;
	}
	/**
	 * Removes `count` nodes after the given node. The given node will not be removed.
	 *
	 * @param {LinkedList<T>} list
	 * @param {LinkedListNode<T>} node
	 * @param {number} count
	 * @template T
	 */
	function removeRange(list, node, count) {
		var next = node.next;
		for (var i = 0; i < count && next !== list.tail; i++) {
			next = next.next;
		}
		node.next = next;
		next.prev = node;
		list.length -= i;
	}
	/**
	 * @param {LinkedList<T>} list
	 * @returns {T[]}
	 * @template T
	 */
	function toArray(list) {
		var array = [];
		var node = list.head.next;
		while (node !== list.tail) {
			array.push(node.value);
			node = node.next;
		}
		return array;
	}


	if (!_self.document) {
		if (!_self.addEventListener) {
			// in Node.js
			return _;
		}

		if (!_.disableWorkerMessageHandler) {
			// In worker
			_self.addEventListener('message', function (evt) {
				var message = JSON.parse(evt.data);
				var lang = message.language;
				var code = message.code;
				var immediateClose = message.immediateClose;

				_self.postMessage(_.highlight(code, _.languages[lang], lang));
				if (immediateClose) {
					_self.close();
				}
			}, false);
		}

		return _;
	}

	// Get current script and highlight
	var script = _.util.currentScript();

	if (script) {
		_.filename = script.src;

		if (script.hasAttribute('data-manual')) {
			_.manual = true;
		}
	}

	function highlightAutomaticallyCallback() {
		if (!_.manual) {
			_.highlightAll();
		}
	}

	if (!_.manual) {
		// If the document state is "loading", then we'll use DOMContentLoaded.
		// If the document state is "interactive" and the prism.js script is deferred, then we'll also use the
		// DOMContentLoaded event because there might be some plugins or languages which have also been deferred and they
		// might take longer one animation frame to execute which can create a race condition where only some plugins have
		// been loaded when Prism.highlightAll() is executed, depending on how fast resources are loaded.
		// See https://github.com/PrismJS/prism/issues/2102
		var readyState = document.readyState;
		if (readyState === 'loading' || readyState === 'interactive' && script && script.defer) {
			document.addEventListener('DOMContentLoaded', highlightAutomaticallyCallback);
		} else {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(highlightAutomaticallyCallback);
			} else {
				window.setTimeout(highlightAutomaticallyCallback, 16);
			}
		}
	}

	return _;

}(_self));

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}

// some additional documentation/types

/**
 * The expansion of a simple `RegExp` literal to support additional properties.
 *
 * @typedef GrammarToken
 * @property {RegExp} pattern The regular expression of the token.
 * @property {boolean} [lookbehind=false] If `true`, then the first capturing group of `pattern` will (effectively)
 * behave as a lookbehind group meaning that the captured text will not be part of the matched text of the new token.
 * @property {boolean} [greedy=false] Whether the token is greedy.
 * @property {string|string[]} [alias] An optional alias or list of aliases.
 * @property {Grammar} [inside] The nested grammar of this token.
 *
 * The `inside` grammar will be used to tokenize the text value of each token of this kind.
 *
 * This can be used to make nested and even recursive language definitions.
 *
 * Note: This can cause infinite recursion. Be careful when you embed different languages or even the same language into
 * each another.
 * @global
 * @public
 */

/**
 * @typedef Grammar
 * @type {Object<string, RegExp | GrammarToken | Array<RegExp | GrammarToken>>}
 * @property {Grammar} [rest] An optional grammar object that will be appended to this grammar.
 * @global
 * @public
 */

/**
 * A function which will invoked after an element was successfully highlighted.
 *
 * @callback HighlightCallback
 * @param {Element} element The element successfully highlighted.
 * @returns {void}
 * @global
 * @public
 */

/**
 * @callback HookCallback
 * @param {Object<string, any>} env The environment variables of the hook.
 * @returns {void}
 * @global
 * @public
 */


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': {
		pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
		greedy: true
	},
	'prolog': {
		pattern: /<\?[\s\S]+?\?>/,
		greedy: true
	},
	'doctype': {
		// https://www.w3.org/TR/xml/#NT-doctypedecl
		pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
		greedy: true,
		inside: {
			'internal-subset': {
				pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
				lookbehind: true,
				greedy: true,
				inside: null // see below
			},
			'string': {
				pattern: /"[^"]*"|'[^']*'/,
				greedy: true
			},
			'punctuation': /^<!|>$|[[\]]/,
			'doctype-tag': /^DOCTYPE/i,
			'name': /[^\s<>'"]+/
		}
	},
	'cdata': {
		pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
		greedy: true
	},
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
		greedy: true,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'special-attr': [],
			'attr-value': {
				pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
				inside: {
					'punctuation': [
						{
							pattern: /^=/,
							alias: 'attr-equals'
						},
						{
							pattern: /^(\s*)["']|["']$/,
							lookbehind: true
						}
					]
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': [
		{
			pattern: /&[\da-z]{1,8};/i,
			alias: 'named-entity'
		},
		/&#x?[\da-f]{1,8};/i
	]
};

Prism.languages.markup['tag'].inside['attr-value'].inside['entity'] =
	Prism.languages.markup['entity'];
Prism.languages.markup['doctype'].inside['internal-subset'].inside = Prism.languages.markup;

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function (env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Object.defineProperty(Prism.languages.markup.tag, 'addInlined', {
	/**
	 * Adds an inlined language to markup.
	 *
	 * An example of an inlined language is CSS with `<style>` tags.
	 *
	 * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
	 * case insensitive.
	 * @param {string} lang The language key.
	 * @example
	 * addInlined('style', 'css');
	 */
	value: function addInlined(tagName, lang) {
		var includedCdataInside = {};
		includedCdataInside['language-' + lang] = {
			pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
			lookbehind: true,
			inside: Prism.languages[lang]
		};
		includedCdataInside['cdata'] = /^<!\[CDATA\[|\]\]>$/i;

		var inside = {
			'included-cdata': {
				pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
				inside: includedCdataInside
			}
		};
		inside['language-' + lang] = {
			pattern: /[\s\S]+/,
			inside: Prism.languages[lang]
		};

		var def = {};
		def[tagName] = {
			pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function () { return tagName; }), 'i'),
			lookbehind: true,
			greedy: true,
			inside: inside
		};

		Prism.languages.insertBefore('markup', 'cdata', def);
	}
});
Object.defineProperty(Prism.languages.markup.tag, 'addAttribute', {
	/**
	 * Adds an pattern to highlight languages embedded in HTML attributes.
	 *
	 * An example of an inlined language is CSS with `style` attributes.
	 *
	 * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
	 * case insensitive.
	 * @param {string} lang The language key.
	 * @example
	 * addAttribute('style', 'css');
	 */
	value: function (attrName, lang) {
		Prism.languages.markup.tag.inside['special-attr'].push({
			pattern: RegExp(
				/(^|["'\s])/.source + '(?:' + attrName + ')' + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
				'i'
			),
			lookbehind: true,
			inside: {
				'attr-name': /^[^\s=]+/,
				'attr-value': {
					pattern: /=[\s\S]+/,
					inside: {
						'value': {
							pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
							lookbehind: true,
							alias: [lang, 'language-' + lang],
							inside: Prism.languages[lang]
						},
						'punctuation': [
							{
								pattern: /^=/,
								alias: 'attr-equals'
							},
							/"|'/
						]
					}
				}
			}
		});
	}
});

Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;

Prism.languages.xml = Prism.languages.extend('markup', {});
Prism.languages.ssml = Prism.languages.xml;
Prism.languages.atom = Prism.languages.xml;
Prism.languages.rss = Prism.languages.xml;


/* **********************************************
     Begin prism-css.js
********************************************** */

(function (Prism) {

	var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;

	Prism.languages.css = {
		'comment': /\/\*[\s\S]*?\*\//,
		'atrule': {
			pattern: RegExp('@[\\w-](?:' + /[^;{\s"']|\s+(?!\s)/.source + '|' + string.source + ')*?' + /(?:;|(?=\s*\{))/.source),
			inside: {
				'rule': /^@[\w-]+/,
				'selector-function-argument': {
					pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
					lookbehind: true,
					alias: 'selector'
				},
				'keyword': {
					pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
					lookbehind: true
				}
				// See rest below
			}
		},
		'url': {
			// https://drafts.csswg.org/css-values-3/#urls
			pattern: RegExp('\\burl\\((?:' + string.source + '|' + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ')\\)', 'i'),
			greedy: true,
			inside: {
				'function': /^url/i,
				'punctuation': /^\(|\)$/,
				'string': {
					pattern: RegExp('^' + string.source + '$'),
					alias: 'url'
				}
			}
		},
		'selector': {
			pattern: RegExp('(^|[{}\\s])[^{}\\s](?:[^{};"\'\\s]|\\s+(?![\\s{])|' + string.source + ')*(?=\\s*\\{)'),
			lookbehind: true
		},
		'string': {
			pattern: string,
			greedy: true
		},
		'property': {
			pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
			lookbehind: true
		},
		'important': /!important\b/i,
		'function': {
			pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
			lookbehind: true
		},
		'punctuation': /[(){};:,]/
	};

	Prism.languages.css['atrule'].inside.rest = Prism.languages.css;

	var markup = Prism.languages.markup;
	if (markup) {
		markup.tag.addInlined('style', 'css');
		markup.tag.addAttribute('style', 'css');
	}

}(Prism));


/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
			lookbehind: true,
			greedy: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true,
			greedy: true
		}
	],
	'string': {
		pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
		lookbehind: true,
		inside: {
			'punctuation': /[.\\]/
		}
	},
	'keyword': /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
	'boolean': /\b(?:false|true)\b/,
	'function': /\b\w+(?=\()/,
	'number': /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
	'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'class-name': [
		Prism.languages.clike['class-name'],
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
			lookbehind: true
		}
	],
	'keyword': [
		{
			pattern: /((?:^|\})\s*)catch\b/,
			lookbehind: true
		},
		{
			pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
			lookbehind: true
		},
	],
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
	'number': {
		pattern: RegExp(
			/(^|[^\w$])/.source +
			'(?:' +
			(
				// constant
				/NaN|Infinity/.source +
				'|' +
				// binary integer
				/0[bB][01]+(?:_[01]+)*n?/.source +
				'|' +
				// octal integer
				/0[oO][0-7]+(?:_[0-7]+)*n?/.source +
				'|' +
				// hexadecimal integer
				/0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source +
				'|' +
				// decimal bigint
				/\d+(?:_\d+)*n/.source +
				'|' +
				// decimal number (integer or float) but no bigint
				/(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source
			) +
			')' +
			/(?![\w$])/.source
		),
		lookbehind: true
	},
	'operator': /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
});

Prism.languages.javascript['class-name'][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: RegExp(
			// lookbehind
			// eslint-disable-next-line regexp/no-dupe-characters-character-class
			/((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source +
			// Regex pattern:
			// There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
			// classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
			// with the only syntax, so we have to define 2 different regex patterns.
			/\//.source +
			'(?:' +
			/(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source +
			'|' +
			// `v` flag syntax. This supports 3 levels of nested character classes.
			/(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source +
			')' +
			// lookahead
			/(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
		),
		lookbehind: true,
		greedy: true,
		inside: {
			'regex-source': {
				pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
				lookbehind: true,
				alias: 'language-regex',
				inside: Prism.languages.regex
			},
			'regex-delimiter': /^\/|\/$/,
			'regex-flags': /^[a-z]+$/,
		}
	},
	// This must be declared before keyword because we use "function" inside the look-forward
	'function-variable': {
		pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
		alias: 'function'
	},
	'parameter': [
		{
			pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		}
	],
	'constant': /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});

Prism.languages.insertBefore('javascript', 'string', {
	'hashbang': {
		pattern: /^#!.*/,
		greedy: true,
		alias: 'comment'
	},
	'template-string': {
		pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
		greedy: true,
		inside: {
			'template-punctuation': {
				pattern: /^`|`$/,
				alias: 'string'
			},
			'interpolation': {
				pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
				lookbehind: true,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	},
	'string-property': {
		pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
		lookbehind: true,
		greedy: true,
		alias: 'property'
	}
});

Prism.languages.insertBefore('javascript', 'operator', {
	'literal-property': {
		pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
		lookbehind: true,
		alias: 'property'
	},
});

if (Prism.languages.markup) {
	Prism.languages.markup.tag.addInlined('script', 'javascript');

	// add attribute support for all DOM events.
	// https://developer.mozilla.org/en-US/docs/Web/Events#Standard_events
	Prism.languages.markup.tag.addAttribute(
		/on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
		'javascript'
	);
}

Prism.languages.js = Prism.languages.javascript;


/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {

	if (typeof Prism === 'undefined' || typeof document === 'undefined') {
		return;
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
	if (!Element.prototype.matches) {
		Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
	}

	var LOADING_MESSAGE = 'Loading…';
	var FAILURE_MESSAGE = function (status, message) {
		return '✖ Error ' + status + ' while fetching file: ' + message;
	};
	var FAILURE_EMPTY_MESSAGE = '✖ Error: File does not exist or is empty';

	var EXTENSIONS = {
		'js': 'javascript',
		'py': 'python',
		'rb': 'ruby',
		'ps1': 'powershell',
		'psm1': 'powershell',
		'sh': 'bash',
		'bat': 'batch',
		'h': 'c',
		'tex': 'latex'
	};

	var STATUS_ATTR = 'data-src-status';
	var STATUS_LOADING = 'loading';
	var STATUS_LOADED = 'loaded';
	var STATUS_FAILED = 'failed';

	var SELECTOR = 'pre[data-src]:not([' + STATUS_ATTR + '="' + STATUS_LOADED + '"])'
		+ ':not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';

	/**
	 * Loads the given file.
	 *
	 * @param {string} src The URL or path of the source file to load.
	 * @param {(result: string) => void} success
	 * @param {(reason: string) => void} error
	 */
	function loadFile(src, success, error) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', src, true);
		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4) {
				if (xhr.status < 400 && xhr.responseText) {
					success(xhr.responseText);
				} else {
					if (xhr.status >= 400) {
						error(FAILURE_MESSAGE(xhr.status, xhr.statusText));
					} else {
						error(FAILURE_EMPTY_MESSAGE);
					}
				}
			}
		};
		xhr.send(null);
	}

	/**
	 * Parses the given range.
	 *
	 * This returns a range with inclusive ends.
	 *
	 * @param {string | null | undefined} range
	 * @returns {[number, number | undefined] | undefined}
	 */
	function parseRange(range) {
		var m = /^\s*(\d+)\s*(?:(,)\s*(?:(\d+)\s*)?)?$/.exec(range || '');
		if (m) {
			var start = Number(m[1]);
			var comma = m[2];
			var end = m[3];

			if (!comma) {
				return [start, start];
			}
			if (!end) {
				return [start, undefined];
			}
			return [start, Number(end)];
		}
		return undefined;
	}

	Prism.hooks.add('before-highlightall', function (env) {
		env.selector += ', ' + SELECTOR;
	});

	Prism.hooks.add('before-sanity-check', function (env) {
		var pre = /** @type {HTMLPreElement} */ (env.element);
		if (pre.matches(SELECTOR)) {
			env.code = ''; // fast-path the whole thing and go to complete

			pre.setAttribute(STATUS_ATTR, STATUS_LOADING); // mark as loading

			// add code element with loading message
			var code = pre.appendChild(document.createElement('CODE'));
			code.textContent = LOADING_MESSAGE;

			var src = pre.getAttribute('data-src');

			var language = env.language;
			if (language === 'none') {
				// the language might be 'none' because there is no language set;
				// in this case, we want to use the extension as the language
				var extension = (/\.(\w+)$/.exec(src) || [, 'none'])[1];
				language = EXTENSIONS[extension] || extension;
			}

			// set language classes
			Prism.util.setLanguage(code, language);
			Prism.util.setLanguage(pre, language);

			// preload the language
			var autoloader = Prism.plugins.autoloader;
			if (autoloader) {
				autoloader.loadLanguages(language);
			}

			// load file
			loadFile(
				src,
				function (text) {
					// mark as loaded
					pre.setAttribute(STATUS_ATTR, STATUS_LOADED);

					// handle data-range
					var range = parseRange(pre.getAttribute('data-range'));
					if (range) {
						var lines = text.split(/\r\n?|\n/g);

						// the range is one-based and inclusive on both ends
						var start = range[0];
						var end = range[1] == null ? lines.length : range[1];

						if (start < 0) { start += lines.length; }
						start = Math.max(0, Math.min(start - 1, lines.length));
						if (end < 0) { end += lines.length; }
						end = Math.max(0, Math.min(end, lines.length));

						text = lines.slice(start, end).join('\n');

						// add data-start for line numbers
						if (!pre.hasAttribute('data-start')) {
							pre.setAttribute('data-start', String(start + 1));
						}
					}

					// highlight code
					code.textContent = text;
					Prism.highlightElement(code);
				},
				function (error) {
					// mark as failed
					pre.setAttribute(STATUS_ATTR, STATUS_FAILED);

					code.textContent = error;
				}
			);
		}
	});

	Prism.plugins.fileHighlight = {
		/**
		 * Executes the File Highlight plugin for all matching `pre` elements under the given container.
		 *
		 * Note: Elements which are already loaded or currently loading will not be touched by this method.
		 *
		 * @param {ParentNode} [container=document]
		 */
		highlight: function highlight(container) {
			var elements = (container || document).querySelectorAll(SELECTOR);

			for (var i = 0, element; (element = elements[i++]);) {
				Prism.highlightElement(element);
			}
		}
	};

	var logged = false;
	/** @deprecated Use `Prism.plugins.fileHighlight.highlight` instead. */
	Prism.fileHighlight = function () {
		if (!logged) {
			console.warn('Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.');
			logged = true;
		}
		Prism.plugins.fileHighlight.highlight.apply(this, arguments);
	};

}());
			const prismLocal = Prism;
			if (typeof window !== "undefined") { try { delete window.Prism; } catch (error) { window.Prism = void 0; } }
			return prismLocal;
		})();

		//#region GitPanel
		const h = react_jsx_runtime.jsx;
		const hs = react_jsx_runtime.jsxs;

		/**
		 * Merge porcelain entries into ONE row per path. The working-tree side
		 * wins for colouring and the warning dot (it is the side needing action).
		 */
		function mergeEntries(entries) {
			const map = new Map();
			if (!Array.isArray(entries)) return [];
			for (let i = 0; i < entries.length; i += 1) {
				const entry = entries[i];
				if (entry === null || typeof entry !== "object" || typeof entry.path !== "string") continue;
				const x = typeof entry.x === "string" ? entry.x : " ";
				const y = typeof entry.y === "string" ? entry.y : " ";
				let row = map.get(entry.path);
				if (row === void 0) { row = { path: entry.path, x: " ", y: " " }; map.set(entry.path, row); }
				if (x !== " ") row.x = x;
				if (y !== " ") row.y = y;
			}
			const rows = [];
			for (const row of map.values()) {
				const untracked = row.x === "?" || row.y === "?";
				const working = untracked || row.y !== " ";
				const staged = !untracked && row.x !== " ";
				const letter = untracked ? "?" : working ? row.y : row.x;
				rows.push({ path: row.path, x: row.x, y: row.y, letter, working, staged });
			}
			return rows;
		}

		/** Staged: add green / delete red / others plain. Working: yellow, delete orange. */
		function toneOf(row) {
			if (row.working) {
				if (row.letter === "U") return "dshg-red";
				return row.letter === "D" ? "dshg-orange" : "dshg-yellow";
			}
			if (row.letter === "U") return "dshg-red";
			if (row.letter === "A") return "dshg-green";
			if (row.letter === "D") return "dshg-red";
			return "dshg-plain";
		}

		/** The status letter keeps a fixed colour, independent of staging. */
		/** Unmerged porcelain states (both sides changed the same file). */
		const CONFLICT_CODES = new Set(["UU", "AA", "DD", "AU", "UA", "DU", "UD"]);

		function letterTone(letter) {
			if (letter === "A") return "dshg-green";
			if (letter === "D" || letter === "U") return "dshg-red";
			if (letter === "?") return "dshg-muted";
			return "dshg-yellow";
		}

		/** Every file path below one tree node. */
		function collectPaths(node, out = []) {
			for (let i = 0; i < node.files.length; i += 1) out.push(node.files[i].path);
			for (const child of node.children.values()) collectPaths(child, out);
			return out;
		}

		/** Build a directory tree (nested folders, no boxes). */
		function buildTree(rows) {
			const root = { name: "", path: "", children: new Map(), files: [] };
			for (let i = 0; i < rows.length; i += 1) {
				const row = rows[i];
				const parts = row.path.split(/[\\/]/);
				let node = root;
				for (let p = 0; p < parts.length - 1; p += 1) {
					const name = parts[p];
					let child = node.children.get(name);
					if (child === void 0) {
						child = { name, path: node.path === "" ? name : `${node.path}/${name}`, children: new Map(), files: [] };
						node.children.set(name, child);
					}
					node = child;
				}
				node.files.push(row);
			}
			return root;
		}

		/** Collapse single-child directory chains into one label. */
		function compactNode(node) {
			let current = node;
			let label = node.name;
			while (current.files.length === 0 && current.children.size === 1) {
				current = current.children.values().next().value;
				label = `${label}/${current.name}`;
			}
			return { label, target: current };
		}

		/** Any working-tree row anywhere below this node? */
		function subtreeHasWorking(node) {
			for (let i = 0; i < node.files.length; i += 1) if (node.files[i].working) return true;
			for (const child of node.children.values()) if (subtreeHasWorking(child)) return true;
			return false;
		}

		/** Total file count below this node. */
		function subtreeCount(node) {
			let total = node.files.length;
			for (const child of node.children.values()) total += subtreeCount(child);
			return total;
		}

		/** Small yellow circle with an exclamation mark. */
		function WarnDot() {
			return h("span", { key: "warnDot", className: "dshg-warnDot", title: "有未暂存的改动", children: "!" });
		}

		/** One file row: status letter + warning dot + name (no checkbox). */
		function FileRow({ row, level, selected, onDown, onEnter, onPreview, onHover }) {
			const key = `file:${row.path}`;
			const picked = selected[key] === true;
			const tone = toneOf(row);
			const chatElement = { ref: `git-file:${row.path}`, label: basename(row.path), clipboardText: row.path };
			return hs("div", {
				key: row.path,
				className: `dshg-row${picked ? " dshg-rowSel" : ""}`,
				style: { paddingLeft: `${6 + level * 14}px` },
				// Right button selects (and starts drag-select); left button opens the
				// file's change preview. Hover + the configured modifier drops the path
				// into the chat box (middle click scrolls, so it cannot be the trigger).
				onMouseDown: (event) => { if (event.button === 2) onDown(row.path); },
				onMouseEnter: () => { onEnter(row.path); if (typeof onHover === "function") onHover(chatElement); },
				onMouseLeave: () => { if (typeof onHover === "function") onHover(null); },
				onContextMenu: (event) => { event.preventDefault(); },
				onClick: () => { if (typeof onPreview === "function") onPreview(row.path); },
				children: [
					// git-style pair (index + work tree) in one letter cell: MM vs M,
					// while untracked stays a single "?".
					h("span", {
						className: `dshg-letter ${letterTone(row.letter)}`,
						children: row.x === "?" ? "?" : `${row.x === " " ? "" : row.x}${row.y === " " ? "" : row.y}`
					}),
					row.working ? h(WarnDot, {}) : null,
					h("span", { className: `dshg-path ${tone}`, title: row.path, children: basename(row.path) })
				]
			});
		}

		/** Recursive directory rendering (indent = level). */
		function TreeNodes({ node, level, collapsed, selected, onToggle, onDown, onEnter, onGroupToggle, onPreview, onHover }) {
			return h("div", {
				children: Array.from(node.children.values()).map((child) => {
					const compacted = compactNode(child);
					const target = compacted.target;
					const hasWorking = subtreeHasWorking(target);
					const isCollapsed = collapsed[target.path] === true;
					const paths = collectPaths(target);
					const selectedCount = paths.filter((path) => selected[`file:${path}`] === true).length;
					const partial = selectedCount > 0 && selectedCount < paths.length;
					const allSelected = selectedCount > 0 && selectedCount === paths.length;
					return h("div", {
						key: target.path,
						children: [
							hs("div", {
								className: `dshg-dir${partial ? " dshg-dirPartial" : ""}${allSelected ? " dshg-dirAll" : ""}`,
								style: { paddingLeft: `${6 + level * 14}px` },
								onClick: () => onToggle(target.path),
								// Right click toggles the whole folder's selection.
								onContextMenu: (event) => {
									event.preventDefault();
									if (typeof onGroupToggle === "function") onGroupToggle(paths, !allSelected);
								},
								children: [
									h("span", { className: `dshg-caret${isCollapsed ? "" : " dshg-caretOpen"}`, children: "▶" }),
									h("span", { className: "dshg-groupIcon", children: h(FolderIcon, { size: 12 }) }),
									hasWorking ? h(WarnDot, {}) : null,
									h("span", { className: `dshg-dirName${hasWorking ? " dshg-yellow" : ""}`, title: target.path, children: compacted.label }),
									selectedCount > 0 ? h("span", { className: "dshg-selCount", children: selectedCount }) : null,
									h("span", { className: "dshg-secCount", children: `${subtreeCount(target)}` })
								]
							}),
							isCollapsed ? null : h("div", {
								children: [
									target.files.map((row) => h(FileRow, { key: row.path, row, level: level + 1, selected, onDown, onEnter, onPreview, onHover })),
									h(TreeNodes, { node: target, level: level + 1, collapsed, selected, onToggle, onDown, onEnter, onGroupToggle, onPreview, onHover })
								]
							})
						]
					});
				})
			});
		}

		/** Timeline row: click expands, double click opens the detail pane. */
		/**
		 * Branch creation as its own timeline row. A commit graph cannot express it, so it
		 * gets a green dot on the single track plus a card.
		 */
		/**
		 * Best-effort source branch of a merge, read from its reflog message.
		 * Handles "merge branch 'x' of …", "Merge pull request #N from owner/x"
		 * and plain "merge x"; falls back to the caller's value.
		 */
		function parseMergeSource(message, fallback) {
			const text = String(message ?? "").replace(/^merge\s+/i, "").trim();
			const quoted = text.match(/^branch\s+'([^']+)'/i);
			if (quoted !== null) return quoted[1];
			// "from owner/branch" / "pull request #N from owner/branch": keep the
			// branch part only, so "feat/pr-demo" stays "feat/pr-demo".
			const trimOwner = (ref) => {
				const parts = ref.split("/");
				return parts.length > 1 ? parts.slice(1).join("/") : parts[0];
			};
			const pull = text.match(/pull request #\d+\s+from\s+([\w./-]+)/i);
			if (pull !== null) return trimOwner(pull[1]);
			const from = text.match(/\bfrom\s+([\w./-]+)/i);
			if (from !== null) return trimOwner(from[1]);
			const head = text.split(":")[0].trim();
			if (head.length > 0 && /\s/.test(head) === false) return head;
			return fallback;
		}

		/** Stable per-branch colour derived from its name (same branch => same colour). */
		function branchHue(name) {
			let hash = 0;
			for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
			return hash % 360;
		}

		function branchColor(name) {
			return `hsl(${branchHue(name)} 62% 52%)`;
		}

		/**
		 * Rough relative luminance (0..1) of `branchColor(name)`. The colour is
		 * always hsl(hue 62% 52%), so the hue alone decides how bright it looks.
		 */
		function branchLuminance(name) {
			const hue = branchHue(name) / 360;
			const channel = (offset) => {
				const k = (offset + hue * 12) % 12;
				const a = 0.62 * Math.min(0.52, 1 - 0.52);
				return 0.52 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
			};
			return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
		}

		/** Icon colour that stays readable on top of the branch colour. */
		function branchIconColor(name) {
			// hsl(h, 62%, 52%) -> rough relative luminance; light hues get a dark glyph.
			return branchLuminance(name) > 0.42 ? "#10202e" : "#ffffff";
		}

		/**
		 * Does a dot filled with this colour need a white rim on a dark panel?
		 * Only genuinely dark hues do: mid-tone colours (yellow, green, light
		 * blue) already stand off the background, and ringing them in white
		 * made them look muddy. 0.30 is deliberately lower than the glyph
		 * threshold so the white ring shows up less often than before.
		 */
		function branchNeedsWhiteRim(name) {
			return branchLuminance(name) < 0.3;
		}

		/**
		 * Contrast aid for coloured TEXT (branch names, ref chips), keyed to the
		 * same luminance as the dot rim so the two never disagree:
		 *   dark hue  -> white halo in the dark theme (it would vanish otherwise)
		 *   light hue -> dark halo in the light theme
		 * Mid-tone colours get neither: they already read fine on both panels.
		 */
		function branchRimClass(name) {
			const luminance = branchLuminance(name);
			const classes = [];
			if (luminance < 0.3) classes.push("dshg-rimDark");
			else if (luminance > 0.6) classes.push("dshg-rimLight");
			return classes.length > 0 ? ` ${classes.join(" ")}` : "";
		}

		/** Reflog actors are stored as "Name <email>"; show just the name. */
		function actorName(actor) {
			return String(actor ?? "").replace(/\s*<[^>]*>\s*/g, "").trim() || "（未知）";
		}

		/**
		 * Branch creation as its own timeline row (a commit graph cannot express it).
		 * Collapsed it is two lines; the detail line stays a single row.
		 */
		function BranchEventRow({ events, eventHash, blink, onBlinkEnd }) {
			const first = events[0];
			const name = first.ref.replace(/^refs\/heads\//, "") || "（未知分支）";
			const base = /Created from\s+(.+)$/i.exec(first.message)?.[1]?.trim() ?? "";
			const color = branchColor(name);
			const baseLabel = base.length > 0 ? base : "（未知）";
			return h("div", {
				"data-branch-event": eventHash,
				className: `dshg-eventRow${blink === true ? " dshg-blink" : ""}`,
				title: first.message,
				onMouseEnter: () => { if (blink === true && typeof onBlinkEnd === "function") onBlinkEnd(); },
				children: [
					h("span", {
						className: "dshg-nodeWrap",
						children: h("span", {
							className: `dshg-eventDot${branchNeedsWhiteRim(name) ? " dshg-rimWhite" : ""}`,
							style: { background: color },
							children: h("span", { className: "dshg-eventIcon", style: { color: branchIconColor(name) }, children: "+" })
						})
					}),
					h("div", {
						className: "dshg-eventCard",
						children: [
							h("span", { className: "dshg-eventTitle", children: ["创建分支 ", h("span", { className: `dshg-branchName${branchRimClass(name)}`, style: { color }, children: name })] }),
							h("span", {
								className: "dshg-eventMeta",
								children: `基于 ${baseLabel}（${first.newHash.slice(0, 8)}） ${baseLabel}分支 · ${actorName(first.actor)} · ${formatDate(first.date, translate)}`
							})
						]
					})
				]
			});
		}

		/**
		 * A merge that produced no commit (fast-forward): nothing to expand, so it is a
		 * plain row. Title reads "快进合并 <branch> → <target>".
		 */
		function MergeEventRow({ events }) {
			const first = events[0];
			const branch = parseMergeSource(first.message, first.ref.replace(/^refs\/heads\//, ""));
			const target = first.ref.replace(/^refs\/heads\//, "") || "（未知）";
			const kind = /fast-forward/i.test(first.message) ? "快进" : "";
			const color = branchColor(branch);
			return h("div", {
				className: "dshg-eventRow",
				title: first.message,
				children: [
					h("span", {
						className: "dshg-nodeWrap",
						children: h("span", {
							className: `dshg-eventDot${branchNeedsWhiteRim(branch) ? " dshg-rimWhite" : ""}`,
							style: { background: color },
							children: h("span", { className: "dshg-eventIconArrow", style: { color: branchIconColor(branch) }, children: "⇄" })
						})
					}),
					h("div", {
						className: "dshg-eventCard",
						children: [
							h("span", {
								className: "dshg-eventTitle",
								children: [
									kind.length > 0 ? `${kind}合并 ` : "合并 ",
									h("span", { className: `dshg-branchName${branchRimClass(branch)}`, style: { color }, children: branch }),
									" → ",
									h("span", { children: target })
								]
							}),
							h("span", {
								className: "dshg-eventMeta",
								children: `${first.oldHash.slice(0, 8)} → ${first.newHash.slice(0, 8)} · ${actorName(first.actor)} · ${formatDate(first.date, translate)}`
							})
						]
					})
				]
			});
		}

		/** Remote names seen in the last refresh (`origin`, `upstream`, ...). */
		function remoteNameSet() {
			const names = new Set();
			for (const remote of Array.isArray(store.remoteBranches) ? store.remoteBranches : []) {
				if (typeof remote?.remote === "string" && remote.remote.length > 0) names.add(remote.remote);
			}
			// Before the first refresh lands the list is empty; the conventional
			// name keeps `origin/main` recognisable as a remote ref.
			if (names.size === 0) names.add("origin");
			return names;
		}

		/**
		 * Pending-sync bubbles shown in place of the "clean" placeholder.
		 *
		 * Each bubble lists the whole chain of commits that a push/pull would move
		 * (connected by a vertical line) and, below them, the NET file changes of
		 * that chain. Clicking a commit jumps to it in the timeline and expands it.
		 */
		function SyncBubbles({ ahead, behind, aheadFiles, behindFiles, onJumpCommit, onPickFile }) {
			const [open, setOpen] = (0, react.useState)(null);
			// Scrolling is enabled only after the expand animation finishes.
			const [scrollReady, setScrollReady] = (0, react.useState)(false);
			(0, react.useEffect)(() => { if (open === null) setScrollReady(false); }, [open]);
			const aheadList = Array.isArray(ahead) ? ahead : [];
			const behindList = Array.isArray(behind) ? behind : [];
			const aheadChanges = Array.isArray(aheadFiles) ? aheadFiles : [];
			const behindChanges = Array.isArray(behindFiles) ? behindFiles : [];
			if (aheadList.length === 0 && behindList.length === 0) {
				// Synced with the remote. PRs are NOT shown here any more: the PR bubbles
				// and the PR panel own that information, this block is only the clean state.
				return h("div", {
					className: "dshg-cleanBlock",
					children: h("div", {
						className: "dshg-clean",
						children: [
							h("div", { className: "dshg-notRepoIcon", children: h(GitIcon, { size: 34 }) }),
							h("div", { className: "dshg-cleanText", children: "干净" }),
							// Linked to a remote: "本地" makes clear the remote side may differ.
							h("div", { className: "dshg-cleanSub", children: "当前本地暂无文件改动与新增" })
						]
					})
				});
			}
			const bubble = (kind, label, commits, files) => {
				const isOpen = open === kind;
				return h("div", {
					key: kind,
					className: `dshg-bubble ${kind === "behind" ? "dshg-bubblePull" : "dshg-bubblePush"}${isOpen ? " dshg-bubbleOpen" : ""}`,
					children: [
						h("button", {
							type: "button",
							className: "dshg-bubbleHead",
							onClick: () => setOpen(isOpen ? null : kind),
							children: [
								h("span", { className: "dshg-bubbleDot" }),
								h("span", { className: "dshg-bubbleLabel", children: `${label} ${commits.length} 个提交` }),
								h("span", { className: "dshg-bubbleCaret", children: isOpen ? "▴" : "▾" })
							]
						}),
						// (PR info now lives in its own panel, not inside the push bubble.)
						h("div", {
							className: `dshg-bubbleBody${isOpen ? " dshg-bubbleBodyOpen" : ""}`,
							children: h("div", {
									className: `dshg-bubbleBodyInner${scrollReady === true ? " dshg-scrollReady" : ""}`,
									onTransitionEnd: (event) => { if (event.propertyName === "grid-template-rows") setScrollReady(true); },
									children: [
								h("div", {
									className: `dshg-chain dshg-chain-${kind}${scrollReady === true ? " dshg-scrollReady" : ""}`,
									children: commits.map((commit) => h("div", {
										key: commit.hash,
										className: "dshg-chainItem",
										title: `跳到 ${commit.short} 并展开`,
										onClick: () => onJumpCommit(commit.hash),
										children: [
											h("span", { className: "dshg-chainNode" }),
											h("span", { className: "dshg-chainHash", children: commit.short }),
											h("span", { className: "dshg-chainSubject", children: commit.subject }),
											h("span", { className: "dshg-chainAuthor", children: commit.author })
										]
									}))
								}),
								files.length > 0 ? h("div", {
									className: "dshg-changesBlock",
									children: [
										// The head sits OUTSIDE the scroller so it never moves
										// while the list scrolls.
										h("div", { className: "dshg-chainFilesHead", children: `改动 ${files.length} 个文件` }),
										h("div", {
											className: `dshg-chainFiles${scrollReady === true ? " dshg-scrollReady" : ""}`,
											children: files.slice(0, 20).map((file) => h("div", {
												key: file.path,
												className: "dshg-chainFile dshg-chainFilePick",
												title: file.path,
												onClick: () => onPickFile(kind, file.path),
												children: [
													h("span", { className: "dshg-chainFileStatus", children: file.status }),
													h("span", { className: "dshg-chainFileName", children: file.path }),
													file.added === null ? null : h("span", { className: "dshg-chainFileAdd", children: `+${file.added}` }),
													file.removed === null ? null : h("span", { className: "dshg-chainFileDel", children: `-${file.removed}` })
												]
											}))
										})
									]
								}) : null
							] })
						})
					]
				});
			};
			return h("div", {
				className: "dshg-bubbles",
				"data-ahead": String(aheadList.length),
				"data-behind": String(behindList.length),
				children: [
					behindList.length > 0 ? bubble("behind", "待拉取", behindList, behindChanges) : null,
					aheadList.length > 0 ? bubble("ahead", "待推送", aheadList, aheadChanges) : null
				]
			});
		}

		function CommitRow({ commit, index, reflog, expanded, detailOpen, isFirst, isNewest, visibleBranches, locked, selectMode, selected, selectable, syncSide, onSelect, onToggle, onOpenDetail, onAction, onStashAction, onHover }) {
			// Branch filter: only refs of selected branches draw the tip arrow / pills.
			// `origin/HEAD` is a symbolic alias for the remote's default branch and
			// always sits on the same commit as `origin/main`, so it is dropped.
			const refsAll = (Array.isArray(commit.refs) ? commit.refs : [])
				.map((ref) => String(ref).replace(/^HEAD -> /, ""))
				.filter((ref) => ref !== "HEAD" && /\/HEAD$/.test(ref) === false);
			const remoteNames = remoteNameSet();
			/** A ref owned by a remote (`origin/main`), not a local branch or tag. */
			const isRemoteRef = (name) => {
				const slash = name.indexOf("/");
				return slash > 0 && remoteNames.has(name.slice(0, slash));
			};
			// A stash is a commit too (refs/stash): keep it out of branch arrows and
			// mark its node so it never reads as a branch tip. `stashRef` comes from
			// git-core, which also surfaces stash entries older than refs/stash.
			const isStash = commit.stashRef !== void 0 || refsAll.some((ref) => /(^|\/)stash$/.test(ref));
			const branchRefs = refsAll.filter((ref) => ref.length > 0 && ref !== "HEAD" && /(^|\/)stash$/.test(ref) === false);
			const filterSet = visibleBranches instanceof Set ? visibleBranches : null;
			// Branch filter: only refs of selected branches draw the tip arrow / pills.
			// Remote-tracking refs (`origin/main`) stay visible: the filter is about
			// local branches, and dropping them hid every cloud pill as soon as one
			// branch got deselected.
			const shownBranchRefs = filterSet === null
				? branchRefs
				: branchRefs.filter((ref) => filterSet.has(ref) || isRemoteRef(ref));
			const displayRefs = filterSet === null ? refsAll : shownBranchRefs;
			// A stash commit has 2-3 parents but is not a merge: never label it as one.
			const isMerge = Array.isArray(commit.parents) && commit.parents.length > 1 && isStash !== true;
			// Direction of a merge commit: "<source> → <target>", recovered from the merge
			// reflog event that produced it.
			const mergeEvent = (Array.isArray(reflog) ? reflog : []).find((item) => item.action.startsWith("merge"));
			const mergeSourceName = mergeEvent === void 0
				? "merge"
				: parseMergeSource(mergeEvent.action, "merge");
			// Colour source for the merge node: the local branch this merge commit
			// belongs to (its own refs), then the reflog target, then the source name.
			// Using the source name alone left merges without a matching branch colour.
			const mergeColorBranch = (() => {
				// 1) The branch the merge brought IN (parsed from the commit subject):
				//    "Merge branch 'main' of …" -> main, "… from owner/feat/x" -> feat/x.
				const fromSubject = parseMergeSource(commit.subject, "");
				if (fromSubject.length > 0 && fromSubject !== "merge") return fromSubject;
				// 2) A local branch sitting on this commit.
				const local = displayRefs.find((ref) => ref !== "HEAD" && isRemoteRef(ref) === false && /(^|\/)stash$/.test(ref) === false);
				if (typeof local === "string" && local.length > 0) return local;
				// 3) The branch the reflog says the merge landed on.
				if (mergeEvent !== void 0) {
					const target = mergeEvent.ref.replace(/^refs\/heads\//, "");
					if (typeof target === "string" && target.length > 0) return target;
				}
				return mergeSourceName;
			})();
			const mergeIconColor = branchIconColor(mergeColorBranch);
			const mergeLabel = isMerge === false
				? "合并"
				: mergeEvent === void 0
					? "合并"
					: `合并 ${mergeSourceName} → ${(Array.isArray(commit.refs) && commit.refs.length > 0 ? commit.refs[0] : "main")}`;
			// Pending-sync commits get their own dot: solid amber = would be pushed,
			// hollow dashed = would be pulled in. Merge commits take a plain base dot
			// instead (their own `.dshg-mergePush` / `.dshg-mergePull` rules draw the
			// glyph and ring; the dashed-pull mask would punch a hole in the glyph).
			const dot = isMerge === true
				? "dshg-dotMerge"
				: syncSide === "ahead" ? "dshg-dotAhead" : syncSide === "behind" ? "dshg-dotBehind" : "dshg-dotPlain";
			// Which branch this pending commit belongs to (drives the dot colour).
			const syncBranchName = (() => {
				const localRef = displayRefs.find((ref) => ref !== "HEAD" && isRemoteRef(ref) === false && /(^|\/)stash$/.test(ref) === false);
				if (typeof localRef === "string" && localRef.length > 0) return localRef;
				const first = Array.isArray(commit.refs) && commit.refs.length > 0 ? String(commit.refs[0]).replace(/^HEAD -> /, "") : "";
				return first.length > 0 ? first : "main";
			})();
			const syncColor = branchColor(syncBranchName);
			const syncInk = branchIconColor(syncBranchName);
			// A commit that only lives on the remote is a detached object here: it can be
			// checked out, but it is not part of this branch's history, so reverting it or
			// resetting onto it would move/rewrite a history it does not belong to.
			const remoteOnly = syncSide === "behind";
			// Selection mode (squash / amend) owns the timeline: history buttons are
			// off-limits until the run is confirmed or cancelled.
			const selectActive = selectMode !== null;
			const historyBlocked = remoteOnly === true || locked === true || selectActive;
			const historyTitle = selectActive
				? "正在选择提交，先完成或取消选择"
				: remoteOnly === true
					? "该提交还没有拉取到当前分支，先拉取再还原或回退"
					: locked === true ? "冲突处理中，先解决或中止" : void 0;
			const subjectRef = (0, react.useRef)(null);
			const [marquee, setMarquee] = (0, react.useState)(false);
			const marqueeAnim = (0, react.useRef)(null);
			const hoverRef = (0, react.useRef)(false);
			// Single-click delay, so a double click can cancel it.
			const clickTimer = (0, react.useRef)(null);
			const startMarquee = () => {
				// Only a collapsed row marquees, and it moves by the exact overflow
				// so the whole subject becomes visible.
				if (expanded) return;
				const el = subjectRef.current;
				if (el === null || el === void 0) return;
				// Measure in the natural (clipped) state; a previous run may have
				// left width:max-content behind and would report zero overflow.
				el.style.width = "";
				el.style.overflow = "hidden";
				const overflow = el.scrollWidth - el.clientWidth;
				if (overflow <= 2) return;
				// Let the text escape its own ellipsis box, otherwise the scroll
				// only slides a clipped window and the tail stays hidden.
				el.style.textOverflow = "clip";
				el.style.overflow = "visible";
				el.style.width = "max-content";
				if (typeof el.animate === "function") {
					// Constant speed (~70px/s): time scales with the distance, so a
					// longer subject takes longer instead of moving faster.
					const moveMs = Math.max(500, Math.round((overflow / 70) * 1000));
					const holdMs = 1500;
					const total = moveMs * 2 + holdMs * 2;
					const travel = moveMs / total;
					const hold = (moveMs + holdMs) / total;
					const back = (moveMs * 2 + holdMs) / total;
					marqueeAnim.current = el.animate([
						{ transform: "translateX(0)", offset: 0 },
						{ transform: `translateX(${-overflow}px)`, offset: travel },
						{ transform: `translateX(${-overflow}px)`, offset: hold },
						{ transform: "translateX(0)", offset: back },
						{ transform: "translateX(0)", offset: 1 }
					], { duration: total, iterations: Infinity, easing: "linear" });
				}
				setMarquee(true);
			};
			const stopMarquee = () => {
				const el = subjectRef.current;
				if (marqueeAnim.current !== null) { marqueeAnim.current.cancel(); marqueeAnim.current = null; }
				if (el !== null && el !== void 0) {
					el.style.textOverflow = "";
					el.style.overflow = "";
					el.style.width = "";
					el.style.transform = "";
				}
				setMarquee(false);
			};
			// Expanding drops the banner; collapsing brings it back while hovered.
			(0, react.useEffect)(() => {
				if (expanded === true) {
					if (marqueeAnim.current !== null) {
						marqueeAnim.current.cancel();
						marqueeAnim.current = null;
						const el = subjectRef.current;
						if (el !== null && el !== void 0) {
							el.style.textOverflow = "";
							el.style.overflow = "";
							el.style.width = "";
							el.style.transform = "";
						}
						setMarquee(false);
					}
					return;
				}
				if (hoverRef.current === true) startMarquee();
			}, [expanded]);
			return hs("div", {
				key: commit.hash,
				"data-commit": commit.hash,
				className: `dshg-commit${expanded ? " dshg-commitOpen" : ""}${isNewest ? " dshg-commitFirst" : ""}${selected ? " dshg-commitSelected" : ""}`,
				// Hover + modifier key puts this commit / stash into the chat box.
				onMouseEnter: () => {
					if (typeof onHover !== "function") return;
					if (isStash === true) {
						onHover({
							ref: `git-stash:${commit.stashRef ?? "stash@{0}"}/${commit.hash}`,
							label: commit.subject,
							clipboardText: `${commit.stashRef ?? "stash@{0}"} ${commit.hash} ${commit.subject}`
						});
						return;
					}
					onHover({
						ref: `git-commit:${commit.hash}`,
						label: `${commit.short ?? commit.hash.slice(0, 8)} ${commit.subject}`,
						clipboardText: `${commit.hash} ${commit.subject}`
					});
				},
				onMouseLeave: () => { if (typeof onHover === "function") onHover(null); },
				// The whole card is the click target (head AND expanded body). Detection
				// happens on MOUSE DOWN so the second press of a double click reacts
				// immediately; inner buttons are skipped explicitly.
				onMouseDown: (event) => {
					if (event.button !== 0) return;
					const target = event.target;
					if (target !== null && target !== void 0 && typeof target.closest === "function" && target.closest("button") !== null) return;
					if ((event.detail ?? 0) >= 2) {
						if (clickTimer.current !== null) {
							clearTimeout(clickTimer.current);
							clickTimer.current = null;
						}
						if (isFirst !== true) onOpenDetail(commit.hash);
						return;
					}
					if (clickTimer.current !== null) clearTimeout(clickTimer.current);
					clickTimer.current = window.setTimeout(() => {
						clickTimer.current = null;
						onToggle();
					}, 200);
				},
				children: [
					h("span", {
						className: "dshg-nodeWrap",
						children: [
							// One triangle per branch tip; stacked towards the dot (rightwards)
							// so extra arrows never leave the timeline's left padding.
							shownBranchRefs.map((ref, index) => h("span", {
								key: ref,
								className: "dshg-branchArrow",
								style: {
									borderLeftColor: branchColor(ref),
									left: `${-8 + index * 4}px`,
									zIndex: 30 - index
								}
							})),
							h("span", {
								className: `dshg-node ${dot}${expanded || detailOpen ? " dshg-nodeActive" : ""}${isMerge ? " dshg-nodeMergeIcon" : ""}${isStash ? " dshg-nodeStash" : ""}${selectMode !== null ? " dshg-nodeSelect" : ""}${selected ? " dshg-nodeSelected" : ""}${selectMode !== null && selectable === false ? " dshg-nodeDisabled" : ""}${isMerge === true && branchNeedsWhiteRim(mergeSourceName) ? " dshg-rimWhite" : ""}${isMerge === true && syncSide === "ahead" ? " dshg-mergePush" : ""}${isMerge === true && syncSide === "behind" ? " dshg-mergePull" : ""}${isMerge === true && syncSide === "behind" && branchNeedsWhiteRim(syncBranchName) ? " dshg-mergePullRim" : ""}`,
								style: selected === true ? { background: "var(--dsw-alias-accent,#3b82f6)" } : isStash === true ? { background: "var(--dshg-warn)" } : isMerge === true ? { background: syncSide === "behind" ? "transparent" : branchColor(mergeColorBranch) } : syncSide !== null ? { "--dshg-sync-color": syncColor, "--dshg-sync-ink": syncInk } : void 0,
								onMouseDown: selectMode !== null ? (event) => event.stopPropagation() : void 0,
								onClick: selectMode !== null ? (event) => { event.stopPropagation(); if (selectable !== false) onSelect(commit.hash); } : void 0,
								// Stash: a folded-corner sheet glyph. Merge: the branch-merge glyph
								// (branch-coloured while the commit is still pending a pull).
								// Pending pull: a dashed ring just inside the node edge, so the
								// hover/selection ring outside it stays a separate circle.
								children: [
									syncSide === "behind" ? (() => {
										const size = isMerge === true ? 12 : 10;
										const stroke = isMerge === true ? 2 : 1.5;
										return h("svg", {
											key: "syncRing",
											className: "dshg-syncRing",
											width: size,
											height: size,
											viewBox: `0 0 ${size} ${size}`,
											children: h("circle", {
												cx: size / 2,
												cy: size / 2,
												r: size / 2 - stroke / 2,
												fill: "none",
												stroke: "var(--dshg-warn)",
												strokeWidth: stroke,
												strokeDasharray: isMerge === true ? "3 1.5" : "2 2"
											})
										});
									})() : null,
									isStash === true ? h("svg", {
									width: 8,
									height: 8,
									viewBox: "0 0 16 16",
									fill: "none",
									stroke: "#fff",
									strokeWidth: 1.8,
									strokeLinejoin: "round",
									strokeLinecap: "round",
									children: [
										h("path", { d: "M3.5 1.5h6L13 5v9.5h-9.5z" }),
										h("path", { d: "M9.5 1.5V5H13" })
									]
								}) : isMerge === true ? h("svg", {
									width: 8,
									height: 8,
									viewBox: "0 0 8 8",
									style: { transform: "translate(-0.5px, 0.5px)" },
									children: [
										h("path", { d: "M 2.2 1 L 2.2 7", stroke: isMerge === true && syncSide === "behind" ? syncColor : mergeIconColor, strokeWidth: 1.4, fill: "none", strokeLinecap: "round" }),
										// Diagonal straight line merging up into the left rail.
										h("path", { d: "M 5.8 7 L 2.2 3.4", stroke: isMerge === true && syncSide === "behind" ? syncColor : mergeIconColor, strokeWidth: 1.4, fill: "none", strokeLinecap: "round" })
									]
								}) : null
								]
							})
						]
					}),
					hs("div", {
						className: "dshg-commitHead",
						onMouseEnter: () => { hoverRef.current = true; startMarquee(); },
						onMouseLeave: () => { hoverRef.current = false; stopMarquee(); },
						children: h("div", {
							className: "dshg-commitMain",
							children: [
								h("div", {
									ref: subjectRef,
									className: `dshg-commitSubject${expanded ? " dshg-commitSubjectOpen" : ""}${!expanded && marquee ? " dshg-marquee" : ""}`,
									title: commit.subject,
									children: commit.subject
								}),
								hs("div", {
									className: "dshg-commitMeta",
									children: [
										h("span", { children: commit.short }),
										h("span", { children: commit.author }),
										h("span", { children: formatDate(commit.date, translate) }),
										isMerge ? h("span", { className: "dshg-detached", children: mergeLabel }) : null
									]
								}),
								displayRefs.length > 0 ? h("div", {
									className: `dshg-refs${expanded ? " dshg-refsShow" : ""}`,
									children: displayRefs.slice(0, 4).map((ref) => {
										const isHead = ref === "HEAD";
										const name = ref.replace(/^HEAD -> /, "");
										const color = isHead ? void 0 : branchColor(name);
										const cloud = isRemoteRef(name);
										return h("span", {
											key: ref,
											className: `dshg-ref${isHead ? " dshg-refHead" : ""}${cloud ? " dshg-refRemote" : ""}${isHead ? "" : branchRimClass(name)}`,
											style: color === void 0 ? void 0 : { background: `color-mix(in srgb, ${color} 22%, transparent)`, color },
											children: cloud
												? [h(CloudIcon, { key: "cloud", size: 10 }), h("span", { key: "name", children: name })]
												: ref
										});
									})
								}) : null,
								// Reflog events that belong to this commit but have no dedicated row
								// (merge of a real merge commit, reset, ...).
								(Array.isArray(reflog) ? reflog : []).length > 0 ? h("div", {
									className: `dshg-refs${expanded ? " dshg-refsShow" : ""}`,
									children: (Array.isArray(reflog) ? reflog : []).slice(0, 3).map((event, i) => h("span", {
										key: `${event.action}-${i}`,
										className: "dshg-ref dshg-refEvent",
										title: `${event.message} · ${event.actor}`,
										children: event.action
									}))
								}) : null
							]
						})
					}),
					h("div", {
						className: `dshg-commitBody${expanded ? " dshg-commitBodyOpen" : ""}`,
						children: hs("div", {
							className: "dshg-commitBodyInner",
							children: [
								commit.body ? h("div", { className: "dshg-commitMsg", children: commit.body }) : null,
								hs("div", {
									className: "dshg-commitActions",
									children: [
										// A stash is not branch history: checkout/revert/reset make no
										// sense on it, so its actions are the stash panel's own.
										isStash === true
											? h(react.Fragment, { children: [
												h("button", { type: "button", className: "dshg-op", disabled: locked === true, title: "把 stash 的改动恢复到工作区，并从栈里删除", onClick: (event) => { event.stopPropagation(); onStashAction("pop", commit.stashRef); }, children: "取出" }),
												h("button", { type: "button", className: "dshg-op", disabled: locked === true, title: "把 stash 的改动恢复到工作区，保留这条 stash", onClick: (event) => { event.stopPropagation(); onStashAction("apply", commit.stashRef); }, children: "应用" }),
												h("button", { type: "button", className: "dshg-op", disabled: locked === true, title: "从这条 stash 创建分支", onClick: (event) => { event.stopPropagation(); onStashAction("branch", commit.stashRef); }, children: "分支" }),
												h("button", { type: "button", className: "dshg-op dshg-opDanger", disabled: locked === true, title: "从栈里删除这条 stash", onClick: (event) => { event.stopPropagation(); onStashAction("drop", commit.stashRef); }, children: "删除" })
											] })
											: h(react.Fragment, { children: [
												h("button", { type: "button", className: "dshg-op", disabled: historyBlocked, title: historyTitle, onClick: (event) => { event.stopPropagation(); onAction("checkout", commit.hash); }, children: "检出提交" }),
												h("button", { type: "button", className: "dshg-op", disabled: historyBlocked, title: historyTitle, onClick: (event) => { event.stopPropagation(); onAction("revert", commit.hash); }, children: "还原提交" }),
												h("button", { type: "button", className: "dshg-op dshg-opDanger", disabled: historyBlocked, title: historyTitle, onClick: (event) => { event.stopPropagation(); onAction("reset", commit.hash); }, children: "强制回退" })
											] }),
										h("div", {
											className: "dshg-commitActionsRight",
											children: isFirst === true
												? h("button", {
													type: "button",
													className: "dshg-op dshg-opDetail dshg-opDisabled",
													disabled: true,
													title: "这是仓库的首次提交，没有可展开的改动",
													children: h("span", { children: "首次提交" })
												})
												: h("button", {
													type: "button",
													className: "dshg-op dshg-opDetail",
													onClick: (event) => { event.stopPropagation(); onOpenDetail(commit.hash); },
													children: h("span", { children: detailOpen ? "收起详细" : "展开详细" })
												})
										})
									]
								})
							]
						})
					})
				]
			});
		}

		/** Pick a Prism grammar from the file extension. */
		function languageOf(path) {
			const ext = String(path ?? "").toLowerCase().split(".").pop();
			if (ext === "json") return "json";
			if (ext === "css" || ext === "scss" || ext === "less") return "css";
			if (ext === "html" || ext === "htm" || ext === "xml" || ext === "svg" || ext === "md") return "markup";
			return "javascript";
		}

		/** Prism highlight with a hard fallback: highlighting must never break a row. */
		function highlightPatchLine(code, language) {
			if (code === "") return null;
			if (typeof Prism === "undefined" || Prism === null || typeof Prism.highlight !== "function") return null;
			const grammar = (Prism.languages !== void 0 && Prism.languages !== null)
				? (Prism.languages[language] ?? Prism.languages.javascript)
				: void 0;
			if (grammar === void 0) return null;
			try {
				return Prism.highlight(code, grammar, Prism.languages[language] !== void 0 ? language : "javascript");
			} catch (error) {
				return null;
			}
		}

		/** Render a patch as coloured lines (+ green, - red, @@ muted). */
		/**
		 * Render a patch as coloured lines with line numbers.
		 * Memoised on (patch, language): without it every parent re-render re-ran
		 * Prism over the entire diff, which is what made large diffs feel laggy.
		 * Very long diffs are capped and fall back to plain text.
		 */
		function PatchLines({ patch, language }) {
			const text = typeof patch === "string" ? patch : "";
			const rows = (0, react.useMemo)(() => {
				if (text === "") return null;
				const all = text.split("\n");
				// Drop the trailing newline's empty pieces: `git diff` output always ends
				// with "\n", so split() leaves one (or more) empty strings. They are not
				// lines — rendered as context rows they got a line number assigned and
				// showed up as a phantom blank row under the last real line.
				while (all.length > 0 && all[all.length - 1] === "") all.pop();
				const MAX_LINES = 1500;
				// Past this size, skip syntax highlighting entirely: it is the
				// expensive part and costs far more than it adds on huge diffs.
				const plain = all.length > 400;
				const lines = all.length > MAX_LINES ? all.slice(0, MAX_LINES) : all;
				let scanOld = 0;
				let scanNew = 0;
				let maxNo = 0;
				for (const line of lines) {
					if (line.startsWith("@@")) {
						const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
						if (match !== null) {
							scanOld = Number(match[1]);
							scanNew = Number(match[2]);
							maxNo = Math.max(maxNo, scanOld, scanNew);
						}
					} else if (line.startsWith("+")) {
						scanNew += 1;
						maxNo = Math.max(maxNo, scanNew);
					} else if (line.startsWith("-")) {
						scanOld += 1;
						maxNo = Math.max(maxNo, scanOld);
					} else if (line.length > 0 && !line.startsWith("diff ") && !line.startsWith("index ") && !line.startsWith("--- ") && !line.startsWith("+++ ")) {
						scanOld += 1;
						scanNew += 1;
						maxNo = Math.max(maxNo, scanOld, scanNew);
					}
				}
				const digits = Math.max(2, String(maxNo).length);
				const lnStyle = { width: `${digits}ch` };
				const out = [];
				let oldNo = 0;
				let newNo = 0;
				for (let index = 0; index < lines.length; index += 1) {
					const line = lines[index];
					// Git plumbing headers: the file name is already the pane's title.
					if (
						line.startsWith("diff --git") ||
						line.startsWith("index ") ||
						line.startsWith("new file mode") ||
						line.startsWith("deleted file mode") ||
						line.startsWith("old mode") ||
						line.startsWith("new mode") ||
						line.startsWith("similarity index") ||
						line.startsWith("rename from") ||
						line.startsWith("rename to") ||
						line.startsWith("--- ") ||
						line.startsWith("+++ ")
					) continue;
					if (line.startsWith("@@")) {
						const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
						if (match !== null) {
							oldNo = Number(match[1]);
							newNo = Number(match[2]);
						}
						out.push(h("div", {
							key: index,
							className: "dshg-hunkRow",
							children: match === null ? line : `⋯ 第 ${newNo} 行附近 ⋯`
						}));
						continue;
					}
					if (line === "\\ No newline at end of file") {
						out.push(h("div", { key: index, className: "dshg-hunkRow", children: "（文件末尾没有换行）" }));
						continue;
					}
					const isAdd = line.startsWith("+");
					const isDel = line.startsWith("-");
					const content = line.length > 0 ? line.slice(1) : "";
					const oldShown = isAdd ? "" : String(oldNo);
					const newShown = isDel ? "" : String(newNo);
					if (!isAdd) oldNo += 1;
					if (!isDel) newNo += 1;
					const highlighted = plain ? null : highlightPatchLine(content, language ?? "javascript");
					out.push(h("div", {
						key: index,
						className: `dshg-pl ${isAdd ? "dshg-add" : isDel ? "dshg-del" : "dshg-ctx"}`,
						children: [
							h("span", { className: "dshg-ln", style: lnStyle, children: oldShown }),
							h("span", { className: "dshg-ln", style: lnStyle, children: newShown }),
							h("span", { className: "dshg-sign", children: isAdd ? "+" : isDel ? "-" : "\u00a0" }),
							h("span", highlighted === null
								? { className: "dshg-code", children: content === "" ? "\u00a0" : content }
								: { className: "dshg-code", dangerouslySetInnerHTML: { __html: highlighted } })
						]
					}));
				}
				if (all.length > MAX_LINES) {
					out.push(h("div", { key: "truncated", className: "dshg-hunkRow", children: `⋯ 改动过长，仅显示前 ${MAX_LINES} 行（共 ${all.length} 行）` }));
				}
				return out;
			}, [text, language]);
			if (rows === null) return h("div", { className: "dshg-empty", children: "（没有文本改动）" });
			return h("div", { className: "dshg-patchLines", children: rows });
		}

		/** Slide-up commit detail: grouped files + one file's patch. */
		function DetailPane({ open, detailHash, detail, detailError, detailLoading, detailReady, filePath, fileDiff, fileDiffError, fileDiffLoading, fileDiffReady, workPath, workDiff, workDiffLoading, workDiffError, workDiffReady, conflictPath, conflictFile, conflictFileError, conflictFileLoading, rangePath, rangeDiff, rangeDiffLoading, rangeDiffError, onClose, onPickFile, onCloseFile, onCloseWork, onCloseConflict, onCloseRange, onMarkResolved }) {
			// Only render payloads that belong to the current selection; anything else
			// is stale cache from the previous commit/file and must not flash.
			const detailReadyNow = detailReady === true;
			const fileDiffReadyNow = fileDiffReady === true;
			const files = detailReadyNow === true && Array.isArray(detail?.files) ? detail.files : [];
			const added = files.filter((file) => file.status === "A");
			const deleted = files.filter((file) => file.status === "D");
			const modified = files.filter((file) => file.status !== "A" && file.status !== "D");
			const groups = [
				{ key: "A", label: "新增", rows: added },
				{ key: "M", label: "修改", rows: modified },
				{ key: "D", label: "删除", rows: deleted }
			];
			// Working mode: the same bottom pane shows one working-tree file's patch.
			const isWork = typeof workPath === "string" && workPath.length > 0;
			// Conflict mode: the file's worktree copy with its markers.
			const isConflict = typeof conflictPath === "string" && conflictPath.length > 0;
			// Range mode: one file's NET change across the whole pending chain
			// (`git diff <merge-base> <upstream|HEAD> -- <path>`), opened from a
			// sync bubble. Same pane, same animation, same close affordance.
			const isRange = typeof rangePath === "string" && rangePath.length > 0;
			// Height motion: FLIP via WAAPI, driven by a ResizeObserver on the INNER
			// element. The observer is what keeps the animation in sync with the real
			// content: a mode switch renders twice (loading state, then the patch), and
			// an update only observed at contentKey time would animate to the loading
			// height and then jump.
			// NOTE: the key deliberately EXCLUDES filePath — expanding a file's patch
			// inside a commit must not resize the whole pane; that patch scrolls
			// inside it instead.
			const contentKey = isConflict ? `conflict:${conflictPath}` : isWork ? `work:${workPath}` : isRange ? `range:${rangePath}` : `commit:${detailHash ?? ""}`;
			const paneRef = (0, react.useRef)(null);
			const paneLast = (0, react.useRef)(0);
			const paneAnim = (0, react.useRef)(null);
			// Working-file preview: only give the bottom extra room when the patch
			// actually scrolls. A short file should sit flush (no dead gap), a long one
			// needs the gap so its last line clears the pane edge.
			const workHostRef = (0, react.useRef)(null);
			const [workOverflows, setWorkOverflows] = (0, react.useState)(false);
			(0, react.useLayoutEffect)(() => {
				const el = workHostRef.current;
				if (el === null || el === void 0) {
					setWorkOverflows(false);
					return void 0;
				}
				setWorkOverflows(el.scrollHeight > el.clientHeight + 1);
				return void 0;
			}, [contentKey, open, workDiffReady]);
			(0, react.useLayoutEffect)(() => {
				const el = paneRef.current;
				if (el === null || el === void 0) return void 0;
				const inner = el.firstElementChild;
				if (inner === null || inner === void 0) return void 0;
				const viewHeight = () => (typeof window !== "undefined" && Number.isFinite(window.innerHeight) ? window.innerHeight : 800);
				// Cap the pane at 56% of the viewport AND half of the drawer: with many
				// changed files the list scrolls inside the pane instead of eating the
				// whole sidebar, so the timeline above always keeps at least half.
				// Cap at half of the WHOLE drawer (not half of the scrolling main
				// area): the latter made the pane look capped at ~25% of the sidebar.
				const capHeight = () => {
					let cap = viewHeight() * 0.56;
					const drawer = el.closest(".dshg-drawer");
					const drawerHeight = drawer !== null && drawer !== void 0 && Number.isFinite(drawer.clientHeight) ? drawer.clientHeight : 0;
					if (drawerHeight > 0) cap = Math.min(cap, drawerHeight * 0.5);
					return cap;
				};
				const apply = () => {
					// Give the patch block priority: before measuring the pane, cap the file
					// list to whatever space is left after the header and the patch.
					if (open === true) {
						const listEl = el.querySelector(".dshg-detailList");
						const patchEl = el.querySelector(".dshg-fileDiff");
						if (listEl !== null && listEl !== void 0 && patchEl !== null && patchEl !== void 0) {
							const headEl = el.querySelector(".dshg-detailHead");
							const headH = headEl !== null && headEl !== void 0 ? headEl.offsetHeight : 0;
							const patchH = patchEl.offsetHeight;
							const natural = listEl.scrollHeight;
							const available = Math.max(72, capHeight() - headH - patchH - 14);
							listEl.style.maxHeight = `${Math.round(Math.min(natural, available))}px`;
						}
					}
					// Hold the current height until the payload that belongs to the current
					// selection has arrived: the placeholder content is empty, and measuring
					// it would shrink the pane before the real content lands.
					// The placeholder is just another target height, NOT a direct style write:
					// the loading window has to grow out of 0 with the same motion as the
					// real content, and the pane then continues from there to its final size.
					let ready = true;
					if (open === true) {
						ready = isConflict === true
							? conflictFileLoading !== true
							: isWork === true
								? workDiffReady === true
								: isRange === true
									? rangeDiffLoading !== true
									: detailReady === true && (filePath === null || fileDiffReady === true);
					}
					// Keep a small, stable placeholder instead of letting the CSS fall back
					// to `height:auto` (which made the pane fill the sidebar while the first
					// payload was still loading). NOTE: a closed pane leaves an inline
					// "0px", NOT "" — the old check that only treated "" as unset kept the
					// pane at 0 while the payload loaded ("the click did nothing").
					const target = open !== true
						? 0
						: ready === true
							? Math.round(Math.min(inner.getBoundingClientRect().height, capHeight()))
							: (paneLast.current > 0 ? paneLast.current : 120);
					const previous = paneLast.current;
					paneLast.current = target;
					if (typeof el.animate !== "function") {
						el.style.height = `${target}px`;
						return;
					}
					// Animate in BOTH directions: grow (open / bigger content) and
					// shrink (mode switch / collapse). The inline height always ends at
					// the exact target, so nothing stale survives.
					if (Math.abs(target - previous) <= 1 && el.style.height !== "") return;
					if (paneAnim.current !== null) {
						try { paneAnim.current.cancel(); } catch (error) { /* already gone */ }
						paneAnim.current = null;
					}
					el.style.height = `${previous}px`;
					const anim = el.animate(
						[{ height: `${previous}px` }, { height: `${target}px` }],
						{ duration: 220, easing: "cubic-bezier(.4, 0, .2, 1)" }
					);
					paneAnim.current = anim;
					anim.finished.then(() => {
						if (paneAnim.current === anim) {
							paneAnim.current = null;
							el.style.height = `${target}px`;
						}
					}).catch(() => { /* cancelled */ });
				};
				apply();
				if (typeof ResizeObserver !== "function") return void 0;
				const observer = new ResizeObserver(apply);
				observer.observe(inner);
				return () => observer.disconnect();
			// Every mode's readiness flag MUST be a dependency: the height is only
			// re-measured when this effect runs, so a mode whose "loading finished"
			// transition is missing here keeps the placeholder height forever (the
			// pane then only resizes when some OTHER mode forces a re-run).
			}, [contentKey, open, workDiffReady, detailReady, conflictFileLoading, rangeDiffLoading]);
			// Keep the previous patch visible while the next one loads (stable height);
			// it is replaced the moment the new payload lands.
			const patch = typeof fileDiff?.patch === "string" ? fileDiff.patch : "";
			const workPatch = typeof workDiff?.patch === "string" ? workDiff.patch : "";
			const rangePatch = typeof rangeDiff?.patch === "string" ? rangeDiff.patch : "";
			// Only trust the cached patch when it belongs to THIS file: after A -> commit
			// -> B the store still held A's patch, and rendering it flashed A's diff.
			const showWorkPatch = workDiffReady === true ? workPatch : "";
			return hs("div", {
				className: `dshg-detail${open ? " dshg-detailOpen" : ""}`,
				ref: paneRef,
				children: hs("div", {
					// A new key remounts the content on a mode switch, which replays
					// the fade-in animation (the height itself is capped by CSS).
					key: isConflict ? "conflict" : isWork ? "work" : isRange ? "range" : "commit",
					className: "dshg-detailInner",
					children: [
						hs("div", {
							className: "dshg-detailHead",
							children: [
								h("span", {
									className: "dshg-detailTitle",
									children: isConflict
										? `冲突文件：${basename(conflictPath)}`
										: isWork
											? `工作区改动：${basename(workPath)}`
											: isRange
												? `整链改动：${basename(rangePath)}`
												: detailHash === null ? "" : `提交 ${String(detailHash).slice(0, 8)} 的改动`
								}),
								isConflict ? h("button", {
									type: "button",
									className: "dshg-op dshg-opResolve",
									disabled: conflictFileLoading === true,
									onClick: () => onMarkResolved(conflictPath),
									children: "提交改动"
								}) : null,
								(isConflict ? conflictFileLoading === true : isWork ? workDiffLoading === true : isRange ? rangeDiffLoading === true : detailLoading === true) ? h("span", { className: "dshg-spinner" }) : null,
								h("button", {
									type: "button",
									className: "dshg-iconButton",
									onClick: isConflict ? onCloseConflict : isWork ? onCloseWork : isRange ? onCloseRange : onClose,
									children: h(CloseIcon, { size: 12 })
								})
							]
						}),
						isConflict
							? h(ConflictView, {
								file: conflictFile,
								loading: conflictFileLoading === true,
								error: conflictFileError
							})
							: isWork
							? h("div", {
								className: `dshg-detailWork dshg-detailWorkFile${workOverflows === true ? " dshg-detailWorkScroll" : ""}`,
								ref: workHostRef,
								children: workDiffError !== null && workDiffError !== void 0
									? h("div", { className: "dshg-error", children: workDiffError })
									: h(PatchLines, { patch: showWorkPatch, language: languageOf(workPath) })
							})
							: isRange
							? h("div", {
								className: "dshg-detailWork dshg-detailRangeHost",
								children: rangeDiffError !== null && rangeDiffError !== void 0
									? h("div", { className: "dshg-error", children: rangeDiffError })
									: h(PatchLines, { patch: rangePatch, language: languageOf(rangePath) })
							})
							: h(react.Fragment, {
								children: [
									detailError !== null && detailError !== void 0 ? h("div", { className: "dshg-error", children: detailError }) : null,
									detailError !== null && detailError !== void 0 ? null : h("div", {
										className: "dshg-detailList",
										children: detailReadyNow === true && detail !== null
											? groups.map((group) => {
												if (group.rows.length === 0) return null;
												return hs("div", {
													key: group.key,
													children: [
														h("div", { className: "dshg-groupTitle", children: `${group.label}（${group.rows.length}）` }),
														group.rows.map((file) => hs("div", {
															key: file.path,
															className: `dshg-row${filePath === file.path ? " dshg-rowSel" : ""}`,
															onClick: () => onPickFile(file.path),
															children: [
																h("span", { className: `dshg-letter ${letterTone(file.status)}`, children: file.status }),
																h("span", { className: "dshg-path", title: file.path, children: file.path }),
																h("span", {
																	className: "dshg-diffNums",
																	children: [
																		h("span", { className: "dshg-numAdd", children: file.binary ? "bin" : `+${file.added ?? 0}` }),
																		h("span", { className: "dshg-numDel", children: file.binary ? "" : `-${file.removed ?? 0}` })
																	]
																})
															]
														}))
													]
												});
											})
											: hs("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取提交内容…"] })
									}),
									hs("div", {
										className: `dshg-fileDiff${filePath === null ? " dshg-fileDiffClosed" : ""}`,
										children: [
											fileDiffError !== null && fileDiffError !== void 0
												? h("div", { className: "dshg-error", children: fileDiffError })
												: h(PatchLines, { patch, language: languageOf(filePath) })
										]
									})
								]
							})
					]
				})
			});
		}

		/** The drawer. */
		function GitPanel({ cwd, sessionId, t, git, onClose, source, version, diag, devMode }) {
			const state = (0, react.useSyncExternalStore)(storeFace().subscribe, storeFace().getSnapshot);
			// No remote = the whole remote feature set stays invisible, exactly as if
			// the plugin had no such feature: local buttons, no bubbles, no fetching.
			// Declared here because the fetch effect below depends on it.
			const hasRemote = typeof state?.remoteInfo?.name === "string" && state.remoteInfo.name.length > 0;
			// Credentials gate: null = not read yet, [] = signed in nowhere. Without an
			// account every GCM-backed action would either pop a picker or fail, so the
			// panel offers them disabled instead.
			const githubAccountList = Array.isArray(state.githubAccounts) ? state.githubAccounts : null;
			const noCredentials = Array.isArray(githubAccountList) && githubAccountList.length === 0;
			// git missing: probed only after a git command actually failed.
			const gitMissing = state.deps?.git === false;
			// GCM presence decides the wording of the no-account hint and the sign-in
			// panel: "not signed in" vs "not installed".
			const gcmMissing = state.deps?.gcm === false;
			const [modal, setModal] = (0, react.useState)(null);
			const [commitMsg, setCommitMsg] = (0, react.useState)("");
			const [commitBody, setCommitBody] = (0, react.useState)("");
			// Shared with ActionModal: "include unstaged" defaults to on for every push.
			const [stashIncludeUnstaged, setStashIncludeUnstaged] = (0, react.useState)(true);
			// Rename the remote branch too (default on) when the branch has an upstream.
			const [renameRemote, setRenameRemote] = (0, react.useState)(true);
			// Account used for the remote rename push (probed for push permission).
			const [renameAccount, setRenameAccount] = (0, react.useState)("");
			const [mergeTarget, setMergeTarget] = (0, react.useState)("");
			const [newBranchName, setNewBranchName] = (0, react.useState)("");
			const [switchTarget, setSwitchTarget] = (0, react.useState)("");
			const [selected, setSelected] = (0, react.useState)({});
			const [collapsedDirs, setCollapsedDirs] = (0, react.useState)({});
			const [expandedHash, setExpandedHash] = (0, react.useState)(null);
			const [detailHash, setDetailHash] = (0, react.useState)(null);
			const [filePath, setFilePath] = (0, react.useState)(null);
			// Working-tree file preview popup (opened by left-clicking a file row).
			const [previewPath, setPreviewPath] = (0, react.useState)(null);
			// Whole-chain diff of one file, opened from a sync bubble. Rendered by
			// the SAME detail pane as commit / work / conflict diffs.
			const [rangePath, setRangePath] = (0, react.useState)(null);
			const [rangeDiff, setRangeDiff] = (0, react.useState)(null);
			const [rangeDiffLoading, setRangeDiffLoading] = (0, react.useState)(false);
			const [rangeDiffError, setRangeDiffError] = (0, react.useState)(null);
			// "This repo has no remote" hint: dismissal is persisted per repo root.
			const [hintDismissed, setHintDismissed] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const root = typeof state?.snapshot?.root === "string" ? state.snapshot.root : "";
				try {
					setHintDismissed(window.localStorage.getItem(`dshg-remote-hint:${root}`) === "1");
				} catch (error) {
					setHintDismissed(false);
				}
			}, [state?.snapshot?.root]);
			const dismissRemoteHint = () => {
				const root = typeof state?.snapshot?.root === "string" ? state.snapshot.root : "";
				try { window.localStorage.setItem(`dshg-remote-hint:${root}`, "1"); } catch (error) { /* storage blocked */ }
				setHintDismissed(true);
			};
			// Draft URL for the "link remote" dialog.
			const [linkUrl, setLinkUrl] = (0, react.useState)("");
			// Remote management dialog (link / inspect / create).
			const [remoteManagerOpen, setRemoteManagerOpen] = (0, react.useState)(false);
			// PR panel opened from the "more" menu (when the inline list is disabled).
			const [prPanelOpen, setPrPanelOpen] = (0, react.useState)(false);
			const [accounts, setAccounts] = (0, react.useState)([]);
			const [accountUser, setAccountUser] = (0, react.useState)(null);
			const [expandedSection, setExpandedSection] = (0, react.useState)("link");
			// Load the GCM account list + the active account's profile (avatar/name).
			// The profile is cached globally (not per repo) for one day, keyed by the
			// account name, so opening the panel does not hit the GitHub API every time.
			const PROFILE_CACHE_KEY = "dshg-gh-profile";
			const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
			const readProfileCache = (account) => {
				try {
					const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
					if (typeof raw !== "string" || raw.length === 0) return null;
					const parsed = JSON.parse(raw);
					if (parsed === null || typeof parsed !== "object") return null;
					if (parsed.account !== account) return null;
					if (!(Number(parsed.ts) > 0) || Date.now() - Number(parsed.ts) > PROFILE_TTL_MS) return null;
					return { ok: true, login: String(parsed.login ?? ""), avatarUrl: String(parsed.avatarUrl ?? "") };
				} catch (error) {
					return null;
				}
			};
			const writeProfileCache = (account, user) => {
				try {
					window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ account, login: user?.login ?? "", avatarUrl: user?.avatarUrl ?? "", ts: Date.now() }));
				} catch (error) {
					// Storage full / disabled: caching is an optimisation only.
				}
			};
			const loadRemoteAccounts = async () => {
				try {
					const list = await callRemote(ctxRef, "githubAccounts", {});
					setAccounts(Array.isArray(list?.accounts) ? list.accounts : []);
				} catch (error) {
					setAccounts([]);
				}
				const active = typeof state?.settings?.activeAccount === "string" ? state.settings.activeAccount : "";
				// Logged out (or no account selected): drop the cached profile so the
				// remote manager does not keep showing the old account.
				if (active.length === 0) {
					setAccountUser(null);
					return;
				}
				const cached = readProfileCache(active);
				if (cached !== null) {
					setAccountUser(cached);
					return;
				}
				try {
					const user = await callRemote(ctxRef, "githubUser", { account: active });
					setAccountUser(user?.ok === true ? user : null);
					if (user?.ok === true) writeProfileCache(active, user);
				} catch (error) {
					setAccountUser(null);
				}
			};
			const [repoNameDraft, setRepoNameDraft] = (0, react.useState)("");
			const [repoDescDraft, setRepoDescDraft] = (0, react.useState)("");
			const [repoPrivate, setRepoPrivate] = (0, react.useState)(true);
			// Repository creation: in-flight flag + failure payload (with a link when the
			// repository was created but the first push failed).
			const [creatingRepo, setCreatingRepo] = (0, react.useState)(false);
			const [createFailure, setCreateFailure] = (0, react.useState)(null);
			// In-panel confirmation dialog. Never window.confirm here: it opens the
			// Electron native dialog, which looks nothing like the plugin.
			const [confirmDialog, setConfirmDialog] = (0, react.useState)(null);
			const askConfirm = (dialog) => setConfirmDialog(dialog);
			// Pull requests that already involve the current branch (any state).
			const [pullRequests, setPullRequests] = (0, react.useState)([]);
			// PR cards the user confirmed away: "<owner>/<repo>#<number>" -> timestamp.
			// Persisted through pluginState so the bubble stays gone across restarts.
			const [dismissedPrs, setDismissedPrs] = (0, react.useState)({});
			// Bumped by the dialog's refresh button to re-run the PR query.
			const [prReloadToken, setPrReloadToken] = (0, react.useState)(0);
			// Manual refresh in flight: the button spins and locks until the reload
			// settles (or the timeout below fires).
			const [prRefreshing, setPrRefreshing] = (0, react.useState)(false);
			// Create-PR dialog state.
			const [prCreateOpen, setPrCreateOpen] = (0, react.useState)(false);
			const [repoForkInfo, setRepoForkInfo] = (0, react.useState)(null);
			const [prTargetMode, setPrTargetMode] = (0, react.useState)("self");
			const [prCustomTarget, setPrCustomTarget] = (0, react.useState)("");
			const [prTitleDraft, setPrTitleDraft] = (0, react.useState)("");
			const [prBodyDraft, setPrBodyDraft] = (0, react.useState)("");
			const [prCreating, setPrCreating] = (0, react.useState)(false);
			const [prCreateResult, setPrCreateResult] = (0, react.useState)(null);
			// Create-PR dialog: base branch, pushing account and the "ahead" warning.
			// `prAccount` is per-creation only — it is never written back to the
			// plugin's activeAccount setting.
			const [prTargetBranch, setPrTargetBranch] = (0, react.useState)("main");
			const [prAccount, setPrAccount] = (0, react.useState)("");
			const [prPushing, setPrPushing] = (0, react.useState)(false);
			// Push/sync confirmation dialog: everything a remote write needs to say.
			const [pushOpen, setPushOpen] = (0, react.useState)(false);
			const [pushMode, setPushMode] = (0, react.useState)("push");
			const [pushAccount, setPushAccount] = (0, react.useState)("");
			const [pushForce, setPushForce] = (0, react.useState)(false);
			const [pushBusy, setPushBusy] = (0, react.useState)(false);
			const [pushError, setPushError] = (0, react.useState)(null);
			// Pull confirmation: a light dialog that only lists the incoming commits.
			const [pullOpen, setPullOpen] = (0, react.useState)(false);
			const [pullBusy, setPullBusy] = (0, react.useState)(false);
			const [pullError, setPullError] = (0, react.useState)(null);
			// Rebase + push dialog.
			const [rebaseOpen, setRebaseOpen] = (0, react.useState)(false);
			const [rebaseAccount, setRebaseAccount] = (0, react.useState)("");
			const [rebaseBackup, setRebaseBackup] = (0, react.useState)(true);
			const [rebaseBusy, setRebaseBusy] = (0, react.useState)(false);
			const [rebaseError, setRebaseError] = (0, react.useState)(null);
			// True while a rebase is mid-conflict: "continue" must push once it finishes.
			const [rebasePushPending, setRebasePushPending] = (0, react.useState)(false);
			// Manual permission probe (null = never checked).
			const [permission, setPermission] = (0, react.useState)(null);
			const [checkingPermission, setCheckingPermission] = (0, react.useState)(false);
			// Ask GitHub whether an account can push to the linked repo.
			// Results are cached for `permissionCacheMs` (default 5 min); manual checks
			// pass force=true. `accountOverride` lets the push panel probe the account
			// the user picked there without touching the global setting.
			// canPush === null means "unknown" and must not disable anything.
			const checkPermission = async (force, accountOverride) => {
				const info = state?.remoteInfo;
				if (info === null || info === void 0 || info.github !== true) {
					setPermission(null);
					return;
				}
				// No signed-in account: the probe would hit the GitHub API with empty
				// credentials and could pop GCM's login flow. Skip it entirely.
				if (githubAccountList === null || githubAccountList.length === 0) {
					setPermission(null);
					return;
				}
				const account = typeof accountOverride === "string"
					? accountOverride
					: (typeof state.settings?.activeAccount === "string" ? state.settings.activeAccount : "");
				const key = `${account}|${info.owner}/${info.repo}`;
				const configured = Number(state?.settings?.permissionCacheMs);
				const ttl = Number.isFinite(configured) && configured >= 10000 ? configured : 300000;
				const now = Date.now();
				if (force !== true && permissionCache.key === key && now - permissionCache.checkedAt < ttl) {
					setPermission(permissionCache.value);
					return;
				}
				setCheckingPermission(true);
				try {
					const result = await callRemote(ctxRef, "repoPermission", { account, owner: info.owner, repo: info.repo });
					permissionCache = { key, value: result, checkedAt: Date.now() };
					setPermission(result);
				} catch (error) {
					const failure = { ok: false, canPush: null, canPull: null, status: 0, reason: "network" };
					permissionCache = { key, value: failure, checkedAt: Date.now() };
					setPermission(failure);
				} finally {
					setCheckingPermission(false);
				}
			};
			// No automatic probe any more: the push panel runs it when it opens, and
			// again whenever the account changes there.
			// Load the PRs that involve this branch (drives the bubble row + the
			// "create PR" button, which should not offer a duplicate).
			(0, react.useEffect)(() => {
				if (hasRemote !== true) { setPullRequests([]); return void 0; }
				// No account (or not read yet): skip the GitHub call entirely, otherwise
				// it pops GCM's login window on every panel open.
				if (githubAccountList === null || githubAccountList.length === 0) { setPullRequests([]); return void 0; }
				const info = state?.remoteInfo;
				if (info === null || info === void 0 || info.github !== true) { setPullRequests([]); return void 0; }
				let alive = true;
				callRemote(ctxRef, "listAllPullRequests", {
					account: typeof state.settings?.activeAccount === "string" ? state.settings.activeAccount : "",
					owner: info.owner,
					repo: info.repo,
					branch: typeof state?.snapshot?.branch === "string" ? state.snapshot.branch : ""
				})
					.then((result) => {
						if (alive !== true) return;
						// One flat list, newest first, each row tagged with its direction.
						const rows = [
							...(Array.isArray(result?.outgoing) ? result.outgoing : []).map((item) => ({ ...item, kind: "outgoing" })),
							...(Array.isArray(result?.internal) ? result.internal : []).map((item) => ({ ...item, kind: "internal" })),
							...(Array.isArray(result?.incoming) ? result.incoming : []).map((item) => ({ ...item, kind: "incoming" }))
						].sort((a, b) => {
							const at = typeof a.updatedAt === "string" ? a.updatedAt : "";
							const bt = typeof b.updatedAt === "string" ? b.updatedAt : "";
							return bt.localeCompare(at);
						});
						setPullRequests(rows);
						setPrRefreshing(false);
					})
					.catch(() => { if (alive === true) { setPullRequests([]); setPrRefreshing(false); } });
				return () => { alive = false; };
			}, [hasRemote, state?.remoteInfo?.owner, state?.remoteInfo?.repo, state?.settings?.activeAccount, state?.snapshot?.branch, prReloadToken]);
			// Load the dismissed-PR map once per mounted panel.
			(0, react.useEffect)(() => {
				callRemote(ctxRef, "readPluginState", { key: "prDismissed" })
					.then((result) => {
						const raw = result?.value;
						if (typeof raw !== "string") return;
						const parsed = JSON.parse(raw);
						if (parsed !== null && typeof parsed === "object" && Array.isArray(parsed) === false) setDismissedPrs(parsed);
					})
					.catch(() => { /* keep the empty default */ });
				return void 0;
			}, []);
			/** Confirm a finished PR card away (green ones are live and cannot be dismissed). */
			const dismissPr = (pr) => {
				const owner = state?.remoteInfo?.owner ?? "";
				const repo = state?.remoteInfo?.repo ?? "";
				if (owner.length === 0 || repo.length === 0) return;
				const next = { ...dismissedPrs, [`${owner}/${repo}#${pr.number}`]: Date.now() };
				setDismissedPrs(next);
				callRemote(ctxRef, "writePluginState", { key: "prDismissed", value: JSON.stringify(next) }).catch(() => { /* best effort */ });
			};
			/**
			 * Open the push confirmation dialog: the only place that decides whether a
			 * push may happen, what it carries and which account performs it.
			 * `mode === "sync"` adds the incoming side and pulls before pushing.
			 */
			const openPushPanel = (mode) => {
				const account = typeof state?.settings?.activeAccount === "string" ? state.settings.activeAccount : "";
				setPushMode(mode === "sync" ? "sync" : "push");
				setPushOpen(true);
				setPushAccount(account);
				setPushForce(false);
				setPushError(null);
				loadRemoteAccounts();
				// Always probe for the account the panel shows, force-refreshing the cache.
				checkPermission(true, account);
			};
			const submitPush = () => {
				// Force-pushing rewrites the remote branch: ask once more, in-panel.
				if (pushForce === true) {
					askConfirm({
						title: "强制推送",
						message: `将以 --force-with-lease 覆盖远程分支。\n如果远程已被他人更新，这次推送会被拒绝；一旦成功，远程历史会被改写，已有 PR 的评审记录可能失效。`,
						confirmLabel: "强制推送",
						danger: true,
						onOk: () => { performPush(); }
					});
					return;
				}
				performPush();
			};
			const performPush = async () => {
				const remoteName = typeof state?.remoteInfo?.name === "string" && state.remoteInfo.name.length > 0 ? state.remoteInfo.name : "origin";
				setPushBusy(true);
				setPushError(null);
				if (pushMode === "sync") {
					// Pull first: a rejected push after a half-done sync is worse than
					// stopping here and letting the conflict UI take over.
					const pulled = await git.run("pullRemote", cwd, { remote: remoteName, branch: "" });
					if (pulled?.ok === false) {
						setPushBusy(false);
						setPushError(typeof pulled.error === "string" ? pulled.error : "拉取失败");
						return;
					}
				}
				const result = await pushCurrentBranch({ account: pushAccount, force: pushForce });
				setPushBusy(false);
				if (result.ok !== true) {
					setPushError(result.message);
					return;
				}
				setPushOpen(false);
				setStore({ opMessage: { type: "ok", text: result.message } });
			};
			/** Light pull dialog: list what is coming in, then pull. */
			const openPullPanel = () => {
				setPullError(null);
				setPullOpen(true);
			};
			const submitPull = async () => {
				const remoteName = typeof state?.remoteInfo?.name === "string" && state.remoteInfo.name.length > 0 ? state.remoteInfo.name : "origin";
				setPullBusy(true);
				setPullError(null);
				const pulled = await git.run("pullRemote", cwd, { remote: remoteName, branch: "" });
				setPullBusy(false);
				if (pulled?.ok === false) {
					setPullError(typeof pulled.error === "string" ? pulled.error : "拉取失败");
					return;
				}
				setPullOpen(false);
			};
			/**
			 * Push right after a rebase. force-with-lease is mandatory: the rebase
			 * rewrote history, so a plain push can only be rejected.
			 */
			const pushAfterRebase = async () => {
				const pushed = await pushCurrentBranch({ account: rebaseAccount, force: true });
				setRebasePushPending(false);
				if (pushed.ok !== true) {
					setStore({ opMessage: { type: "error", text: `变基已完成，但推送失败：${pushed.message}` } });
					return false;
				}
				setStore({ opMessage: { type: "ok", text: "已推送" } });
				return true;
			};
			/** Open the one-click rebase + push dialog. */
			const openRebasePanel = () => {
				const account = typeof state?.settings?.activeAccount === "string" ? state.settings.activeAccount : "";
				setRebaseOpen(true);
				setRebaseAccount(account);
				setRebaseBackup(true);
				setRebaseError(null);
				setRebasePushPending(false);
				loadRemoteAccounts();
				checkPermission(true, account);
			};
			const submitRebase = async () => {
				const upstream = typeof state.sync?.upstream === "string" ? state.sync.upstream : "";
				if (upstream.length === 0) return;
				setRebaseBusy(true);
				setRebaseError(null);
				try {
					if (rebaseBackup === true) {
						const branch = typeof snapshot?.branch === "string" && snapshot.branch.length > 0 ? snapshot.branch : "HEAD";
						const backupName = `backup/${branch}-${Date.now()}`;
						const made = await callRemote(ctxRef, "createBranch", { path: cwd, name: backupName, from: "HEAD" });
						if (made?.ok === false) {
							// A backup that cannot be made means no safety net: stop here.
							setRebaseError(`备份分支创建失败：${made.error ?? "未知错误"}`);
							return;
						}
					}
					const result = await callRemote(ctxRef, "rebase", { path: cwd, upstream });
					if (result?.ok === false) {
						const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
						if (conflicts.length > 0) {
							// The conflict banner takes over; its "继续变基" finishes the push.
							setRebaseOpen(false);
							setRebasePushPending(true);
							if (git !== null && git !== void 0 && typeof git.refresh === "function") git.refresh(cwd);
							return;
						}
						setRebaseError(String(result.error ?? "变基失败"));
						return;
					}
					const pushed = await pushAfterRebase();
					if (pushed === true) setRebaseOpen(false);
				} catch (error) {
					setRebaseError(error instanceof Error ? error.message : String(error));
				} finally {
					setRebaseBusy(false);
				}
			};
			/** Conflict resolved: continue the rebase and push once it actually finished. */
			const continueRebaseWithPush = async () => {
				await git.continueOperation(cwd);
				if (rebasePushPending !== true) return;
				// More conflicts (or a failed continue) leave the operation in place.
				if (store.repoOperation?.operation !== null && store.repoOperation?.operation !== void 0) return;
				await pushAfterRebase();
			};
			/** Default PR base: the repo's default branch (main / master). */
			const defaultPrBranch = () => {
				const names = branchList.map((item) => (typeof item?.name === "string" ? item.name : ""));
				if (names.includes("main")) return "main";
				if (names.includes("master")) return "master";
				return "main";
			};
			/**
			 * Push the current branch with the dialog's account.
			 *
			 * Extracted on purpose: the upcoming push-confirmation panel reuses this
			 * instead of re-deriving remote / upstream / account on its own. Returns
			 * `{ ok, message }` and never throws.
			 */
			const pushCurrentBranch = async (overrides) => {
				const branch = typeof state?.snapshot?.branch === "string" ? state.snapshot.branch : "";
				if (branch.length === 0) return { ok: false, message: "没有可推送的分支" };
				const remote = typeof state?.remoteInfo?.name === "string" && state.remoteInfo.name.length > 0 ? state.remoteInfo.name : "origin";
				const upstream = typeof state?.sync?.upstream === "string" ? state.sync.upstream : "";
				try {
					const result = await callRemote(ctxRef, "pushRemote", {
						path: cwd,
						remote,
						branch,
						setUpstream: upstream.length === 0,
						force: overrides?.force === true,
						account: typeof overrides?.account === "string" ? overrides.account : prAccount
					});
					if (git !== null && git !== void 0 && typeof git.refresh === "function") git.refresh(cwd);
					if (result?.ok === false) {
						return { ok: false, message: typeof result.error === "string" && result.error.length > 0 ? result.error : "推送失败" };
					}
					return { ok: true, message: typeof result?.message === "string" ? result.message : "已推送" };
				} catch (error) {
					return { ok: false, message: error instanceof Error ? error.message : String(error) };
				}
			};
			/** Human wording for the failure codes `createPullRequest` can return. */
			const prFailureText = (result) => {
				const reason = String(result?.reason ?? "");
				const status = Number(result?.status ?? 0);
				if (status === 422 && /already exists/i.test(reason)) return "该分支已有 PR，可在 PR 面板里直接打开";
				if (status === 422 && /no commits between/i.test(reason)) return "两个分支之间没有差异，无需创建 PR";
				if (status === 404) return "目标仓库不存在，或当前账户没有访问权限";
				if (reason === "no-token") return "推送账户未登录，请先在设置里登录";
				if (reason === "bad-request") return "标题、源分支和目标分支都不能为空";
				return reason.length > 0 ? reason : `创建失败（HTTP ${status}）`;
			};
			/** Open the create dialog: prefill title/base/account, then load fork + accounts. */
			const openCreatePr = () => {
				setPrCreateOpen(true);
				setPrCreateResult(null);
				setPrBodyDraft("");
				setPrTargetMode("self");
				setPrCustomTarget("");
				setPrTargetBranch(defaultPrBranch());
				setPrAccount(typeof state?.settings?.activeAccount === "string" ? state.settings.activeAccount : "");
				const branch = typeof state?.snapshot?.branch === "string" ? state.snapshot.branch : "";
				const newest = Array.isArray(state?.log?.commits) && state.log.commits.length > 0 ? state.log.commits[0] : null;
				const subject = typeof newest?.subject === "string" ? newest.subject.trim() : "";
				// Prefill the title with the newest commit subject (a good PR title);
				// fall back to the branch name when the log is empty.
				setPrTitleDraft(subject.length > 0 ? subject : branch);
				// Fills `accounts` for the pushing-account picker.
				loadRemoteAccounts();
				const info = state?.remoteInfo;
				if (info === null || info === void 0 || info.github !== true) { setRepoForkInfo(null); return; }
				callRemote(ctxRef, "repoInfo", {
					account: typeof state.settings?.activeAccount === "string" ? state.settings.activeAccount : "",
					owner: info.owner,
					repo: info.repo
				})
					.then((result) => {
						const fork = result !== null && result !== void 0 && result.ok === true ? result : null;
						setRepoForkInfo(fork);
						// Forked repo: the parent's default branch is the natural base.
						if (fork?.isFork === true && typeof fork.parent?.defaultBranch === "string" && fork.parent.defaultBranch.length > 0) {
							setPrTargetBranch(fork.parent.defaultBranch);
						}
					})
					.catch(() => setRepoForkInfo(null));
			};
			/** Resolve the target repository for the currently selected mode. */
			const createPrTarget = () => {
				const info = state?.remoteInfo;
				if (info === null || info === void 0) return null;
				if (prTargetMode === "parent" && repoForkInfo !== null && repoForkInfo.parent !== null && repoForkInfo.parent !== void 0) {
					return { owner: repoForkInfo.parent.owner, repo: repoForkInfo.parent.repo };
				}
				if (prTargetMode === "custom") {
					const parts = prCustomTarget.trim().split("/").filter((item) => item.length > 0);
					if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
					return null;
				}
				return { owner: info.owner, repo: info.repo };
			};
			const submitCreatePr = async () => {
				const target = createPrTarget();
				const info = state?.remoteInfo;
				const branch = typeof state?.snapshot?.branch === "string" ? state.snapshot.branch : "";
				const base = prTargetBranch.trim();
				if (target === null || info === null || info === void 0 || branch.length === 0 || base.length === 0) return;
				setPrCreating(true);
				setPrCreateResult(null);
				// The picker falls back to the active account, then to the first known
				// one: an empty value means "let GCM decide", which is not valid here.
				const account = prAccount.length > 0
					? prAccount
					: (typeof state?.settings?.activeAccount === "string" && state.settings.activeAccount.length > 0
						? state.settings.activeAccount
						: (Array.isArray(accounts) && accounts.length > 0 ? accounts[0].name : ""));
				try {
					const result = await callRemote(ctxRef, "createPullRequest", {
						account,
						owner: target.owner,
						repo: target.repo,
						options: {
							title: prTitleDraft.trim(),
							body: prBodyDraft,
							// Cross-repo PRs need the owning account in front of the branch name,
							// otherwise GitHub looks for the branch inside the target repo.
							head: `${info.owner}:${branch}`,
							base
						}
					});
					// The host reports failures as a value, not as a thrown error.
					if (result?.ok === false) {
						setPrCreateResult({ ok: false, message: prFailureText(result), url: "" });
						return;
					}
					setPrCreateResult({ ok: true, message: `已创建 PR #${result.number}`, url: result.url });
					setPrCreateOpen(false);
					setPrReloadToken(prReloadToken + 1);
					if (git !== null && git !== void 0 && typeof git.refresh === "function") git.refresh(cwd);
				} catch (error) {
					setPrCreateResult({ ok: false, message: error instanceof Error ? error.message : String(error), url: "" });
				} finally {
					setPrCreating(false);
				}
			};
			/**
			 * Create an empty GitHub repository, attach it as origin, and push the local
			 * history as the creating account (it owns the repo, so it is guaranteed to
			 * have write access; the currently selected account may not).
			 */
			const createRepoAndLink = () => {
				const name = repoNameDraft.trim();
				if (name.length === 0) return;
				// Plugin-styled confirmation instead of the Electron native dialog.
				askConfirm({
					title: "新建并连接仓库",
					message: `将在 GitHub 创建仓库「${name}」并推送当前仓库的历史。\n该操作会在你的账号下真实创建仓库，无法撤销。`,
					confirmLabel: "创建并连接",
					danger: false,
					onOk: () => { performCreateRepo(); }
				});
			};
			const performCreateRepo = async () => {
				const name = repoNameDraft.trim();
				if (name.length === 0) return;
				setCreatingRepo(true);
				setCreateFailure(null);
				const account = typeof state?.settings?.activeAccount === "string" ? state.settings.activeAccount : "";
				let created = null;
				try {
					created = await callRemote(ctxRef, "createRepo", {
						account,
						options: { name, description: repoDescDraft, private: repoPrivate === true }
					});
					await callRemote(ctxRef, "addRemote", { path: cwd, url: created.cloneUrl });
					await callRemote(ctxRef, "pushRemote", {
						path: cwd,
						remote: "origin",
						branch: typeof snapshot?.branch === "string" ? snapshot.branch : "",
						setUpstream: true,
						account: typeof created.owner === "string" && created.owner.length > 0 ? created.owner : account
					});
					setStore({ opMessage: { type: "ok", text: `已创建并连接 ${created.fullName}` } });
					setRepoNameDraft("");
					setRepoDescDraft("");
					setRemoteManagerOpen(false);
					if (git !== null && git !== void 0 && typeof git.refresh === "function") git.refresh(cwd);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					if (created === null) {
						setCreateFailure({ message: `创建仓库失败：${message}`, url: "" });
					} else {
						setCreateFailure({
							message: `仓库已创建，但首次推送失败：${message}`,
							url: `https://github.com/${created.fullName}`
						});
					}
				} finally {
					setCreatingRepo(false);
				}
			};
			// Refresh spinner stays on until the remote probe finishes too.
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			// Current PR card: newest (by update time) PR whose bubble the user has not
			// confirmed away. A live (open) PR also reports the previous PR's outcome.
			const dismissedKey = (pr) => `${state?.remoteInfo?.owner ?? ""}/${state?.remoteInfo?.repo ?? ""}#${pr.number}`;
			const visiblePrs = pullRequests
				.filter((pr) => dismissedPrs[dismissedKey(pr)] !== true)
				.slice()
				.sort((a, b) => {
					const at = typeof a.updatedAt === "string" ? a.updatedAt : "";
					const bt = typeof b.updatedAt === "string" ? b.updatedAt : "";
					return bt.localeCompare(at);
				});
			// A push can only touch a PR whose HEAD **is this branch**. Incoming PRs
			// (another fork -> this branch) and PRs opened from other branches must not
			// trigger the "pushing will update this PR" warning.
			const branchForPr = typeof state?.snapshot?.branch === "string" ? state.snapshot.branch : "";
			const currentPr = visiblePrs.find((pr) => pr.state === "open" && pr.kind !== "incoming" && pr.head === branchForPr) ?? null;
			// When on, the PR list lives in the "more" menu instead of above the tree.
			const prInMoreMenu = state?.settings?.prInMoreMenu === true;
			// Rows the user has not confirmed away — shown as the dialog badge.
			const pendingPrCount = pullRequests.filter((pr) => dismissedPrs[dismissedKey(pr)] !== true).length;
			// Clicking the cloud-with-x retries the probe and spins in place.
			const [cloudRetrying, setCloudRetrying] = (0, react.useState)(false);
			// Background fetch: keeps ahead/behind fresh without blocking the panel's
			// own reads. Throttled; a failure surfaces the cloud-with-x button.
			/**
			 * Background fetch with a hard timeout. Returns a promise so the refresh
			 * button can wait for the network probe before it stops spinning.
			 */
			const fetchRemoteNow = async () => {
				if (typeof cwd !== "string" || cwd.length === 0) return;
				// No remote: stay off the network entirely.
				if (hasRemote !== true) return;
				// No credentials (or the list is not read yet): skip the automatic fetch,
				// it would only fail or pop GCM's login window.
				if (githubAccountList === null || githubAccountList.length === 0) return;
				const now = Date.now();
				if (now - lastFetchAt < FETCH_THROTTLE_MS) return;
				lastFetchAt = now;
				setStore({ fetchState: "running" });
				const configured = Number(state?.settings?.fetchTimeoutMs);
				const timeoutMs = Number.isFinite(configured) && configured >= 1000 ? configured : 5000;
				let timer = null;
				const timeout = new Promise((resolve, reject) => {
					timer = window.setTimeout(() => reject(new Error("fetch timeout")), timeoutMs);
				});
				try {
					await Promise.race([callRemote(ctxRef, "fetchRemote", { path: cwd }), timeout]);
					setStore({ fetchState: "ok" });
					if (git !== null && git !== void 0 && typeof git.refresh === "function") git.refresh(cwd);
				} catch (error) {
					setStore({ fetchState: "failed" });
				} finally {
					if (timer !== null) window.clearTimeout(timer);
				}
			};
			(0, react.useEffect)(() => {
				if (typeof cwd !== "string" || cwd.length === 0) return void 0;
				// No remote: never reach the network, exactly like the feature being absent.
				if (hasRemote !== true) return void 0;
				fetchRemoteNow();
				return void 0;
			}, [cwd, hasRemote]);
			// One file's NET change across a whole pending chain, shown in the same
			// pane as commit / work / conflict diffs (so the height animation and
			// the close affordance are identical and transitions blend).
			const openRangeDiff = (kind, path) => {
				const mergeBase = typeof state.sync?.mergeBase === "string" ? state.sync.mergeBase : "";
				const upstream = typeof state.sync?.upstream === "string" ? state.sync.upstream : "";
				const to = kind === "behind" ? upstream : "HEAD";
				// Clicking the same file again closes the pane, like every other mode.
				if (rangePath === path) {
					setRangePath(null);
					setRangeDiff(null);
					setRangeDiffError(null);
					return;
				}
				// Exclusive with the other three pane modes.
				setDetailHash(null);
				setFilePath(null);
				setPreviewPath(null);
				setConflictPath(null);
				setRangePath(path);
				setRangeDiff(null);
				setRangeDiffError(null);
				if (mergeBase.length === 0 || to.length === 0) {
					setRangeDiffError("缺少比较范围，先刷新一次");
					setRangeDiffLoading(false);
					return;
				}
				setRangeDiffLoading(true);
				callRemote(ctxRef, "rangeDiff", { path: cwd, from: mergeBase, to, paths: [path] })
					.then((value) => {
						setRangeDiff(value);
						setRangeDiffLoading(false);
					})
					.catch((error) => {
						setRangeDiffError(error instanceof Error ? error.message : String(error));
						setRangeDiffLoading(false);
					});
			};
			// Branch popover / more menu / recycle bin / conflict pane.
			const [branchOpen, setBranchOpen] = (0, react.useState)(false);
			const [moreOpen, setMoreOpen] = (0, react.useState)(false);
			const [recycleOpen, setRecycleOpen] = (0, react.useState)(false);
			// Repository settings (identity / credential pin / ignore / safe.directory).
			const [repoSettingsOpen, setRepoSettingsOpen] = (0, react.useState)(false);
			const [repoConfig, setRepoConfig] = (0, react.useState)(null);
			const [repoConfigError, setRepoConfigError] = (0, react.useState)(null);
			// Root .gitignore editor: current file (or null while loading) + last check result.
			const [ignoreState, setIgnoreState] = (0, react.useState)(null);
			const [ignoreCheckResult, setIgnoreCheckResult] = (0, react.useState)(null);
			const [ignoreFilesState, setIgnoreFilesState] = (0, react.useState)(null);
			// Stash panel: a yellow card inside the drawer (below the conflict list).
			const [stashOpen, setStashOpen] = (0, react.useState)(false);
			const [stashEntries, setStashEntries] = (0, react.useState)([]);
			const [stashLoading, setStashLoading] = (0, react.useState)(false);
			const [stashError, setStashError] = (0, react.useState)(null);
			const [stashPreview, setStashPreview] = (0, react.useState)(null);
			const [stashPreviewLoading, setStashPreviewLoading] = (0, react.useState)(false);
			const [conflictOpen, setConflictOpen] = (0, react.useState)(true);
			const [conflictPath, setConflictPath] = (0, react.useState)(null);
			// Commit selection mode: "squash" (merge adjacent) / "amend" (add staged).
			const [selectionMode, setSelectionMode] = (0, react.useState)(null);
			const [selectedHashes, setSelectedHashes] = (0, react.useState)([]);
			// Squash confirmation: list the commits that will collapse and let the
			// user name the resulting commit before anything is rewritten.
			const [squashOpen, setSquashOpen] = (0, react.useState)(false);
			const [squashTitle, setSquashTitle] = (0, react.useState)("");
			const [squashBody, setSquashBody] = (0, react.useState)("");
			const [moreBubble, setMoreBubble] = (0, react.useState)(null);
			const moreBubbleRef = (0, react.useRef)(null);
			// Measure the bubble after it renders, then place it so that the arrow (at
			// the bubble's right quarter) sits on the button that triggered it. Real
			// width, so nothing overflows the viewport and the bar never shifts.
			(0, react.useLayoutEffect)(() => {
				const element = moreBubbleRef.current;
				if (element === null || moreBubble === null || moreBubble.rect === null || moreBubble.rect === void 0) return;
				const width = element.offsetWidth;
				if (!(width > 0)) return;
				const viewport = window.innerWidth || 480;
				const center = moreBubble.rect.left + moreBubble.rect.width / 2;
				let left = center - width * 0.25;
				left = Math.min(Math.max(left, 4), Math.max(4, viewport - width - 4));
				element.style.left = `${left}px`;
				const arrow = Math.min(Math.max(center - left, 12), Math.max(12, width - 12));
				element.style.setProperty("--arrow-left", `${arrow}px`);
			}, [moreBubble]);
			const [rebaseSource, setRebaseSource] = (0, react.useState)(null);
			const [rebasePreview, setRebasePreview] = (0, react.useState)(null);
			const loadStash = async () => {
				setStashLoading(true);
				setStashError(null);
				try {
					const value = await git.stash("list");
					setStashEntries(Array.isArray(value?.entries) ? value.entries : []);
				} catch (error) {
					setStashError(error instanceof Error ? error.message : String(error));
				} finally {
					setStashLoading(false);
				}
			};
			// Timeline row that should flash after "跳到创建节点".
			const [blinkHash, setBlinkHash] = (0, react.useState)(null);
			// Branch filter: empty = show everything, otherwise only the nodes that
			// belong to these branches (ancestors / merges touching them / creation).
			// It lives in the store because refreshAll restores it before render.
			const filterBranches = Array.isArray(state.branchFilter) ? state.branchFilter : [];
			const dragRef = (0, react.useRef)(null);
			// Timestamp of the last finished drag, used to swallow the contextmenu
			// that a right-drag fires over whatever row it ended on.
			const dragEndAt = (0, react.useRef)(0);
			const treeRef = (0, react.useRef)(null);
			const mainRef = (0, react.useRef)(null);
			const autoCollapsed = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				setExpandedHash(null);
				setDetailHash(null);
				setFilePath(null);
				setPreviewPath(null);
				setConflictPath(null);
				setSelected({});
				git.refresh(cwd);
			}, [cwd, git]);
			// Account list drives the "no credentials" state of every remote action.
			(0, react.useEffect)(() => {
				if (store.githubAccounts === null) loadGithubAccounts(ctxRef);
			}, []);
			// Always-on stash panel needs the list up front, not only on demand.
			(0, react.useEffect)(() => {
				loadStash();
			}, [cwd]);
			(0, react.useEffect)(() => {
				const onUp = () => {
					// Remember when a real drag ended: the contextmenu that follows a
					// right-drag must not select a folder it merely passed over.
					if (dragRef.current !== null) dragEndAt.current = Date.now();
					dragRef.current = null;
				};
				document.addEventListener("mouseup", onUp);
				return () => document.removeEventListener("mouseup", onUp);
			}, []);
			(0, react.useEffect)(() => {
				if (state.opMessage === null || state.opMessage === void 0) return void 0;
				const timer = window.setTimeout(() => { setStore({ opMessage: null }); }, 5000);
				return () => window.clearTimeout(timer);
			}, [state.opMessage]);
			(0, react.useEffect)(() => {
				if (branchOpen !== true && moreOpen !== true) return void 0;
				const onDown = (event) => {
					const target = event.target;
					if (target === null || target === void 0 || typeof target.closest !== "function") return;
					if (target.closest(".dshg-pop") !== null) return;
					if (target.closest(".dshg-opsBar") !== null) return;
					// A dialog opened from the popover must not close it.
					if (target.closest(".dshg-modal") !== null) return;
					setBranchOpen(false);
					setMoreOpen(false);
				};
				document.addEventListener("mousedown", onDown);
				return () => document.removeEventListener("mousedown", onDown);
			}, [branchOpen, moreOpen]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") {
						if (modal !== null) setModal(null);
						else if (recycleOpen === true) setRecycleOpen(false);
						else if (branchOpen === true) setBranchOpen(false);
						else if (moreOpen === true) setMoreOpen(false);
						else if (conflictPath !== null) setConflictPath(null);
						else if (filePath !== null) setFilePath(null);
						else if (detailHash !== null) setDetailHash(null);
						else onClose();
					}
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [modal, filePath, detailHash, onClose, recycleOpen, branchOpen, moreOpen, conflictPath]);

			const snapshot = state.snapshot;
			const repo = snapshot?.repo === true;
			const detached = repo && /^[0-9a-f]{7,40}$/i.test(snapshot?.branch ?? "");
			const operation = state.repoOperation?.operation ?? null;
			const conflicts = Array.isArray(state.repoOperation?.conflicts) ? state.repoOperation.conflicts : [];
			const resolvedFiles = Array.isArray(state.repoOperation?.resolved) ? state.repoOperation.resolved : [];
			const branchList = Array.isArray(state.branchDetails?.branches) ? state.branchDetails.branches : [];
			// The merge modal's target options: detail rows when available, the bare
			// name list as a fallback (older host without branchDetails).
			const branches = branchList.length > 0
				? branchList.map((branch) => branch.name)
				: (state.branch?.branches ?? []).filter((name) => !/^remotes\//.test(name) && !/ -> HEAD/.test(name));
			// Branch filter: an empty state means "all selected". A real selection
			// always keeps at least one branch, and selecting every branch again
			// behaves like no filter (the whole graph, including loose commits).
			const allBranchNames = branchList.map((branch) => branch.name);
			const storedFilter = filterBranches.filter((name) => allBranchNames.includes(name));
			const effectiveFilter = filterBranches.length === 0 || storedFilter.length === 0
				? allBranchNames
				: storedFilter;
			const toggleBranchFilter = (name) => {
				const current = filterBranches.length === 0 || storedFilter.length === 0
					? allBranchNames
					: storedFilter;
				if (current.includes(name)) {
					if (current.length <= 1) return;
				} else if (allBranchNames.includes(name) === false) {
					return;
				}
				const next = current.includes(name)
					? current.filter((item) => item !== name)
					: [...current, name];
				// Selecting every branch collapses back to "no filter".
				const normalized = next.length === allBranchNames.length ? [] : next;
				// Restoring the current branch clears a previous "don't show again".
				// An empty selection means "all selected", so the branch is visible again
				// even though normalized is [].
				const currentName = (Array.isArray(state.branchDetails?.branches) ? state.branchDetails.branches : []).find((branch) => branch?.current === true)?.name ?? "";
				const currentVisible = currentName.length > 0 && (normalized.length === 0 || normalized.includes(currentName));
				setStore({ branchFilter: normalized, hiddenHintDismissed: currentVisible ? "" : state.hiddenHintDismissed });
				const root = state.snapshot?.root;
				if (typeof root === "string" && root.length > 0) git.savePrefs(root, normalized);
			};
			const loading = state.loading && !repo;
			const rows = mergeEntries(state.status?.entries);
			const hasWork = rows.some((row) => row.working);
			const hasStaged = rows.some((row) => row.staged);
			// Which timeline commits a push / pull would move (drives the dot style).
			const aheadHashes = new Set((Array.isArray(state.sync?.ahead) ? state.sync.ahead : []).map((item) => item.hash));
			const behindHashes = new Set((Array.isArray(state.sync?.behind) ? state.sync.behind : []).map((item) => item.hash));
			// Per-branch sync hashes (every branch with an upstream). Lets the timeline
			// mark pending commits for ALL selected branches, not only the current one.
			const branchSyncMap = new Map((Array.isArray(state.branchSyncs) ? state.branchSyncs : []).map((item) => [item.branch, {
				ahead: Array.isArray(item.ahead) ? item.ahead : [],
				behind: Array.isArray(item.behind) ? item.behind : []
			}]));
			const clean = repo && rows.length === 0 && snapshot?.clean !== false;
			// Amend mode: only staged files are offered in the working-tree list.
			const treeRows = selectionMode === "amend" ? rows.filter((row) => row.staged) : rows;
			const tree = buildTree(treeRows);
			const selectedPaths = Object.keys(selected).filter((key) => key.startsWith("file:"))
				.map((key) => key.slice(5))
				.filter((path) => rows.some((row) => row.path === path));
			const selectedWork = selectedPaths.filter((path) => rows.some((row) => row.path === path && row.working));
			const selectedStaged = selectedPaths.filter((path) => rows.some((row) => row.path === path && row.staged && !row.working));
			(0, react.useEffect)(() => {
				const el = treeRef.current;
				if (el === null || el === void 0) return;
				if (autoCollapsed.current) return;
				if (el.scrollHeight > el.clientHeight + 8) {
					autoCollapsed.current = true;
					const next = {};
					for (const row of rows) {
						const parts = row.path.split(/[\\/]/);
						for (let i = 1; i < parts.length; i += 1) next[parts.slice(0, i).join("/")] = true;
					}
					setCollapsedDirs(next);
				}
			}, [rows.length]);
			const pickOne = (path, value) => {
				const key = `file:${path}`;
				setSelected((previous) => {
					if ((previous[key] === true) === value) return previous;
					const next = { ...previous };
					if (value) next[key] = true;
					else delete next[key];
					return next;
				});
			};
			const onRowDown = (path) => {
				const key = `file:${path}`;
				const value = selected[key] !== true;
				dragRef.current = { value };
				pickOne(path, value);
			};
			const onRowEnter = (path) => {
				const current = dragRef.current;
				if (current === null) return;
				pickOne(path, current.value);
			};
			/** Right-click on a folder: select or clear every file below it. */
			const onGroupToggle = (paths, value) => {
				// Only a real right-CLICK on a folder toggles its selection. A right
				// drag that happens to pass over the folder must not.
				if (dragRef.current !== null) return;
				if (Date.now() - dragEndAt.current < 350) return;
				setSelected((previous) => {
					const next = { ...previous };
					for (const path of paths) {
						const key = `file:${path}`;
						if (value === true) next[key] = true;
						else delete next[key];
					}
					return next;
				});
			};
			const doAction = (method, args) => {
				if (method === "merge") {
					const source = args?.source;
					const target = args?.target;
					const mode = args?.mode;
					if (typeof source === "string" && source.length > 0) {
						if (typeof target === "string" && target.length > 0 && target !== (snapshot?.branch ?? "")) {
							// Merge into another branch: switch there first, then merge the source in.
							git.run("checkout", cwd, { target }).then(() => git.run("merge", cwd, { target: source, mode }));
						} else {
							git.run("merge", cwd, { target: source, mode });
						}
					}
				} else if (method === "deleteBranch") {
					git.run("deleteBranch", cwd, { name: args?.name, force: args?.force === true });
				} else if (method === "addRemote") {
					// Linking a remote is followed by a fetch so the panel learns the
					// remote state immediately instead of waiting for the next open.
					git.run("addRemote", cwd, { url: args?.url }).then(() => git.run("fetchRemote", cwd, {}));
				} else if (method === "renameBranch") {
					git.run("renameBranch", cwd, { from: args?.from, to: args?.to, renameRemote: args?.renameRemote === true, account: args?.account });
				} else if (method === "operationAbort") {
					git.run("operationAbort", cwd, { kind: args?.kind });
				} else if (method === "stash") {
					git.run("stash", cwd, args ?? {}).finally(() => loadStash());
				} else {
					git.run(method, cwd, args ?? {});
				}
				setModal(null);
				setSelected({});
			};
			const conflictSet = new Set(conflicts.map((file) => file.path));
			/**
			 * Middle-click anywhere in the panel: append this element to the chat box as
			 * into the chat box as plain text. Only identifiers are sent; the agent
			 * reads the content.
			 */
			const addToChat = (element) => {
				if (element === null || element === void 0) return;
				const result = insertChatReference(sessionId, element);
				if (result !== true) setStore({ opMessage: { type: "error", text: `无法添加到对话：${result}` } });
			};
			/**
			 * Hover + configured modifier key (default Alt) appends this element to the
			 * chat box as a reference chip. Middle click cannot be used: it scrolls.
			 */
			const [hoveredChatElement, setHoveredChatElement] = (0, react.useState)(null);
			const chatHover = (element) => setHoveredChatElement(element);
			(0, react.useEffect)(() => {
				if (hoveredChatElement === null) return void 0;
				const configured = String(state?.settings?.chatElementKey ?? "alt").toLowerCase();
				const keyMatches = (event) => configured === "ctrl" ? event.ctrlKey === true : configured === "shift" ? event.shiftKey === true : event.altKey === true;
				const handler = (event) => {
					if (event.key !== "Alt" && event.key !== "Control" && event.key !== "Shift") return;
					if (keyMatches(event) !== true) return;
					event.preventDefault();
					addToChat(hoveredChatElement);
					setHoveredChatElement(null);
				};
				window.addEventListener("keydown", handler);
				return () => window.removeEventListener("keydown", handler);
			}, [hoveredChatElement, state?.settings?.chatElementKey]);
			/** Left-click on a file: conflict files open the conflict pane instead. */
			const openPreview = (path, fromWork) => {
				// Clicking the same file again closes its preview (both modes).
				if (fromWork !== true && conflictSet.has(path)) {
					if (conflictPath === path) {
						setConflictPath(null);
						return;
					}
					setDetailHash(null);
					setFilePath(null);
					setExpandedHash(null);
					setPreviewPath(null);
					setRangePath(null);
					setRangeDiff(null);
					setRangeDiffError(null);
					setConflictPath(path);
					git.refreshConflict(cwd, path);
					return;
				}
				if (previewPath === path) {
					setPreviewPath(null);
					return;
				}
				setDetailHash(null);
				setFilePath(null);
				setExpandedHash(null);
				setConflictPath(null);
				setRangePath(null);
				setRangeDiff(null);
				setRangeDiffError(null);
				setPreviewPath(path);
				git.refreshWorkDiff(cwd, path);
			};
			/** Double click / the 详细 button: expand THIS row and open the pane. */
			const openDetail = (hash) => {
				if (detailHash === hash) { setDetailHash(null); setFilePath(null); return; }
				setExpandedHash(hash);
				setDetailHash(hash);
				setFilePath(null);
				// The pane modes are exclusive: opening one closes the others.
				setPreviewPath(null);
				setConflictPath(null);
				setRangePath(null);
				setRangeDiff(null);
				setRangeDiffError(null);
				git.refreshDetail(cwd, hash);
				// After the pane opens, bring the selected commit's dot above the pane
				// so its action buttons stay reachable.
				const revealCommit = () => {
					const main = mainRef.current;
					if (main === null || main === void 0) return;
					const row = main.querySelector(`[data-commit="${hash}"]`);
					const pane = main.parentElement ? main.parentElement.querySelector(".dshg-detail") : null;
					if (row === null || row === void 0 || pane === null || pane === void 0) return;
					const paneTop = pane.getBoundingClientRect().top;
					const margin = 24;
					// Use the row's BOTTOM so the expanded action buttons clear the pane.
					const overflowBy = row.getBoundingClientRect().bottom - (paneTop - margin);
					if (overflowBy > 0) {
						if (typeof main.scrollTo === "function") main.scrollTo({ top: main.scrollTop + overflowBy, behavior: "smooth" });
						else main.scrollTop += overflowBy;
					}
				};
				window.setTimeout(revealCommit, 300);
			};
			/** Single click: switching rows closes the pane unless it is the same row. */
			const toggleRow = (hash) => {
				if (expandedHash === hash) {
					setExpandedHash(null);
					if (detailHash === hash) { setDetailHash(null); setFilePath(null); }
					return;
				}
				if (detailHash !== null && detailHash !== hash) { setDetailHash(null); setFilePath(null); }
				setExpandedHash(hash);
			};
			/** Selection mode: pick a commit (squash keeps a contiguous range). */
			const toggleSelectCommit = (hash) => {
				if (selectionMode === null) return;
				if (selectionMode === "rebase") {
					const picked = selectedHashes.includes(hash);
					setSelectedHashes(picked ? [] : [hash]);
					setRebasePreview(null);
					if (!picked) {
						// Pre-flight: would rebasing this branch onto `hash` conflict?
						git.run("mergePreview", cwd, { target: hash, source: snapshot?.branch ?? "" }).then((res) => {
							const value = res?.value ?? null;
							if (value?.ok === true) setRebasePreview({ conflicts: Array.isArray(value.conflicts) ? value.conflicts : [] });
						}).catch(() => setRebasePreview(null));
					}
					return;
				}
				if (selectionMode === "amend") {
					setSelectedHashes((previous) => previous.includes(hash) ? [] : [hash]);
					return;
				}
				setSelectedHashes((previous) => {
					if (previous.includes(hash) === false) return [...previous, hash];
					// Un-pick: drop this commit and everything picked beyond it, so the
					// selection always stays one contiguous range.
					const order = (state.log?.commits ?? []).map((commit) => commit.hash);
					const at = order.indexOf(hash);
					const picked = previous.map((item) => order.indexOf(item)).filter((index) => index >= 0);
					if (picked.length === 0) return [];
					const far = Math.max(...picked);
					if (at < far) {
						return previous.filter((item) => {
							const index = order.indexOf(item);
							return index < at || index > far;
						});
					}
					return previous.filter((item) => item !== hash);
				});
			};
			/** Selected commits, in timeline order (newest first). */
			const squashSelection = () => timeline.filter((commit) => selectedHashes.includes(commit.hash));
			/** Validate the squash range, then open the naming dialog (nothing is rewritten yet). */
			const confirmSelection = async () => {
				if (selectionMode === "rebase") {
					const target = selectedHashes[0];
					const source = rebaseSource;
					setSelectionMode(null);
					setSelectedHashes([]);
					git.run("rebase", cwd, { upstream: target, source: source ?? void 0 });
					return;
				}
				if (selectionMode === "squash") {
					const commits = squashSelection();
					if (commits.length < 2) return;
					// Rewriting history with a dirty tree would sweep the uncommitted
					// changes into the squashed commit.
					if (snapshot?.clean !== true) {
						setStore({ opMessage: { type: "error", text: "先提交或暂存当前改动，再合并相邻提交" } });
						return;
					}
					const order = commits.map((commit) => timeline.findIndex((item) => item.hash === commit.hash)).sort((a, b) => a - b);
					if (order[order.length - 1] - order[0] !== order.length - 1) {
						setStore({ opMessage: { type: "error", text: "只能合并连续相邻的提交" } });
						return;
					}
					const oldest = commits[commits.length - 1];
					const parent = Array.isArray(oldest.parents) && oldest.parents.length > 0 ? String(oldest.parents[0]) : "";
					if (parent.length === 0) {
						setStore({ opMessage: { type: "error", text: "不能合并仓库的初始提交" } });
						return;
					}
					const newest = commits[0];
					setSquashTitle(typeof newest.subject === "string" && newest.subject.length > 0 ? newest.subject : `合并 ${commits.length} 个提交`);
					setSquashBody("");
					setSquashOpen(true);
					return;
				}
				setStore({ opMessage: { type: "ok", text: "补充暂存到提交：执行逻辑开发中" } });
			};
			/** Execute the squash after the user confirms the message. */
			const runSquash = async () => {
				const commits = squashSelection();
				const oldest = commits[commits.length - 1];
				const parent = oldest !== void 0 && Array.isArray(oldest.parents) && oldest.parents.length > 0 ? String(oldest.parents[0]) : "";
				if (commits.length < 2 || parent.length === 0) { setSquashOpen(false); return; }
				const title = squashTitle.trim().length > 0 ? squashTitle.trim() : `合并 ${commits.length} 个提交`;
				setSquashOpen(false);
				setSelectionMode(null);
				setSelectedHashes([]);
				try {
					// Drop the commits while keeping their net change staged…
					await callRemote(ctxRef, "reset", { path: cwd, commit: parent, mode: "soft" });
					// …then commit everything once, so the range collapses into one commit.
					// Message = title + optional body typed by the user.
					const message = squashBody.trim().length > 0 ? `${title}\n\n${squashBody.trim()}` : title;
					await callRemote(ctxRef, "commit", { path: cwd, message, stagedOnly: true });
					setStore({ opMessage: { type: "ok", text: `已把 ${commits.length} 个提交合并为一个` } });
					if (git !== null && git !== void 0 && typeof git.refresh === "function") git.refresh(cwd);
				} catch (error) {
					setStore({ opMessage: { type: "error", text: error instanceof Error ? error.message : String(error) } });
				}
			};
			/**
			 * Floating bubble anchored to the clicked more-bar button. The rect is
			 * captured here; the actual left offset is measured after render (see the
			 * layout effect), because estimating the text width caused the bubble to
			 * overflow the viewport and the whole bar to shift sideways.
			 */
			const showMoreBubble = (text, element) => {
				const rect = element !== null && element !== void 0 && typeof element.getBoundingClientRect === "function" ? element.getBoundingClientRect() : null;
				setMoreBubble({ text, rect });
				window.setTimeout(() => setMoreBubble(null), 2600);
			};
			const filesNow = rows.filter((row) => row.staged).map((row) => row.path);
			// Files with working-tree changes that are NOT in the index: "全部提交"
			// only commits the staged set, so the dialog warns about these.
			const unstagedNow = rows.filter((row) => row.working).map((row) => row.path);
			const opButton = (label, onClick, options = {}) => h("button", {
				type: "button",
				key: options.key ?? label,
				className: `dshg-op${options.danger ? " dshg-opDanger" : ""}${options.primary ? " dshg-opPrimary" : ""}${options.disabled ? " dshg-opDisabled" : ""}${options.active ? " dshg-opActive" : ""}${options.extra ? ` ${options.extra}` : ""}`,
				disabled: options.disabled === true,
				title: options.title,
				onClick,
				children: options.icon ?? [
					label,
					// The badge stays mounted so the button can grow/shrink smoothly.
					// Collapsed it has zero width and a negative margin that cancels the
					// flex gap, so an empty count reserves no space at all.
					// Counts stop at two digits; anything above shows as "99+".
					h("span", {
						className: `dshg-opBadge${options.badge === void 0 || options.badge === null ? "" : " dshg-opBadgeOn"}`,
						children: options.badge === void 0 || options.badge === null
							? ""
							: (Number(options.badge) > 99 ? "99+" : String(options.badge))
					})
				]
			});
			const conflictPending = operation !== null ? conflicts.filter((file) => file.blocks > 0).length : 0;
			const stagedPaths = rows.filter((row) => row.staged).map((row) => row.path);
			const selectedCount = selectedPaths.length;
			const selectedWorkingCount = selectedWork.length;
			const hasSelection = selectedCount > 0;
			const canCommitAll = rows.length > 0;
			const canStageAll = rows.some((row) => row.working);
			const canDiscardAll = rows.length > 0;
			// Badge only when files are selected; the all-mode never shows a count.
			const stashBadge = hasSelection ? selectedCount : 0;
			const ops = [];
			const rightOps = [];
			const opLocked = operation !== null;
			if (selectionMode !== null) {
				// Commit-selection mode: confirm / exit replace the normal actions.
				const canConfirm = selectionMode === "squash" ? selectedHashes.length >= 2 : selectedHashes.length === 1;
				const amendLabel = selectedCount > 0 ? "选中补充" : "全部补充";
				const confirmLabel = selectionMode === "squash" ? "确认合并" : selectionMode === "rebase" ? "确认变基" : amendLabel;
				const cancelLabel = selectionMode === "squash" ? "取消合并" : selectionMode === "rebase" ? "取消变基" : "取消补充";
				ops.push(opButton(confirmLabel, () => confirmSelection(), { key: "confirmSelect", primary: true, disabled: state.working || canConfirm !== true, badge: selectionMode === "amend" && selectedCount > 0 ? selectedCount : void 0 }));
				ops.push(opButton(cancelLabel, () => { setSelectionMode(null); setSelectedHashes([]); }, { key: "exitSelect" }));
			} else if (hasSelection) {
				ops.push(opButton("选中提交", () => setModal({ kind: "commit", paths: selectedPaths }), { key: "commit", primary: true, disabled: state.working || opLocked, badge: selectedCount }));
				ops.push(opButton("选中暂存", () => {
					if (selectedWorkingCount > 0) {
						git.run("add", cwd, { paths: selectedWork });
						setSelected({});
					}
				}, { key: "stage", disabled: state.working || opLocked || selectedWorkingCount === 0, badge: selectedWorkingCount }));
				ops.push(opButton("选中回退", () => setModal({ kind: "restore", paths: selectedPaths }), { key: "restore", danger: true, disabled: state.working || opLocked, badge: selectedCount }));
				// The undo button is always present so the bar never reflows; it is
				// simply greyed out while nothing in the selection is staged.
				ops.push(opButton("选中撤销", () => {
					if (selectedStaged.length === 0) return;
					git.run("unstage", cwd, { paths: selectedStaged });
					setSelected({});
				}, { key: "unstage", disabled: state.working || opLocked || selectedStaged.length === 0, badge: selectedStaged.length }));
			} else if (snapshot?.clean === true && hasRemote === true) {
				// Clean working tree: every local action is a no-op, so this row
				// becomes the remote sync row instead (push / pull / sync / rebase / PR).
				const upstream = typeof state.sync?.upstream === "string" ? state.sync.upstream : "";
				const aheadCount = Array.isArray(state.sync?.ahead) ? state.sync.ahead.length : 0;
				const behindCount = Array.isArray(state.sync?.behind) ? state.sync.behind.length : 0;
				const remoteName = typeof state.remoteInfo?.name === "string" && state.remoteInfo.name.length > 0 ? state.remoteInfo.name : "origin";
				// The PR base is the repository default branch (main/master), NOT this
				// branch's upstream — using the upstream made base === current and kept the
				// "create PR" button permanently disabled.
				const baseBranch = (() => {
					const names = branchList.map((item) => (typeof item?.name === "string" ? item.name : ""));
					if (names.includes("main")) return "main";
					if (names.includes("master")) return "master";
					return "";
				})();
				const currentBranch = typeof snapshot?.branch === "string" ? snapshot.branch : "";
				const busyNow = state.working === true || opLocked;
				// The push confirmation dialog owns every warning (unpushed/behind,
				// permissions, the "this updates PR #n" notice), so the button just opens it.
				const doPush = () => openPushPanel();
				const doPull = () => openPullPanel();
				// Sync = pull then push: it reuses the push dialog with the incoming
				// commits shown on top.
				const doSync = () => openPushPanel("sync");
				ops.push(opButton("推送改动", doPush, {
					key: "push",
					primary: true,
					badge: aheadCount > 0 ? aheadCount : void 0,
					title: noCredentials === true ? "未登录 GitHub 账号，无法推送" : "选择账户、确认提交并推送",
					// Behind commits no longer block the button: the push panel explains
					// the risk, and the push need not target this branch forever.
					disabled: busyNow || noCredentials === true || (upstream !== "" && aheadCount === 0)
				}));
				ops.push(opButton("拉取改动", doPull, {
					key: "pull",
					badge: behindCount > 0 ? behindCount : void 0,
					title: noCredentials === true ? "未登录 GitHub 账号，无法拉取" : void 0,
					disabled: busyNow || noCredentials === true || upstream === "" || behindCount === 0
				}));
				ops.push(opButton("同步改动", doSync, {
					key: "sync",
					// Same ↑out / ↓in pair the branch rows use, so the two never disagree.
					icon: hs(react.Fragment, { children: [
						"同步改动",
						h(SyncDelta, { ahead: aheadCount, behind: behindCount })
					] }),
					title: noCredentials === true ? "未登录 GitHub 账号，无法同步" : void 0,
					disabled: busyNow || noCredentials === true || upstream === "" || (aheadCount === 0 && behindCount === 0)
				}));
				ops.push(opButton("变基推送", () => openRebasePanel(), {
					key: "remoteRebase",
					// ↑N = remote commits the branch is rebased onto,
					// ×M = local commits that get rewritten (red: history is discarded).
					icon: hs(react.Fragment, { children: [
						"变基推送",
						behindCount > 0 && aheadCount > 0 ? h("span", {
							className: "dshg-opDelta dshg-opDeltaTight",
							title: `变基到远程 ${behindCount} 个新提交之上，重写本地 ${aheadCount} 个提交`,
							children: [
								h("span", { key: "up", className: "dshg-bDeltaUp", children: [h(NarrowArrow, { direction: "up" }), String(behindCount)] }),
								h("span", { key: "rebase", className: "dshg-rebaseCount", children: h(CountText, { value: aheadCount, prefix: "×" }) })
							]
						}) : null
					] }),
					// Say WHY it is greyed out: four different reasons reach the same state.
					title: noCredentials === true
						? "未登录 GitHub 账号，无法变基推送"
						: busyNow
							? "正在处理另一个操作"
							: upstream === ""
								? "当前分支还没有关联远程分支"
								: aheadCount === 0
									? "没有本地提交可以重放到上游之上"
									: behindCount === 0
										? "远程没有新提交，变基会是无操作"
										: "把本地提交重放到上游最新提交之上，然后强制推送",
					disabled: busyNow || noCredentials === true || upstream === "" || aheadCount === 0 || behindCount === 0
				}));
				// GitHub compare URLs keep "/" literal; %2F would be treated as part of the
				// branch name and the comparison would come back empty.
				const encodeBranch = (name) => encodeURIComponent(name).replace(/%2F/gi, "/");
				const github = state.remoteInfo?.github === true;
				const prUrl = github && currentBranch.length > 0 && baseBranch.length > 0 && currentBranch !== baseBranch
					? `https://github.com/${state.remoteInfo.owner}/${state.remoteInfo.repo}/compare/${encodeBranch(baseBranch)}...${encodeBranch(currentBranch)}?expand=1`
					: "";
				// An open PR for this branch already exists: open it instead of
				// offering to create a duplicate (GitHub rejects the duplicate anyway).
				// Otherwise the button opens the in-panel dialog: the compare page was
				// a detour and could not set the base branch or account.
				const existingPr = Array.isArray(pullRequests) ? (pullRequests.find((item) => item.state === "open") ?? null) : null;
				const canCreatePr = github === true && currentBranch.length > 0 && baseBranch.length > 0 && currentBranch !== baseBranch;
				ops.push(opButton(existingPr !== null ? "查看PR" : "创建PR", () => {
					if (existingPr !== null) {
						if (existingPr.url.length > 0) window.open(existingPr.url, "_blank", "noopener,noreferrer");
						return;
					}
					openCreatePr();
				}, {
					key: "createPr",
					disabled: busyNow || noCredentials === true || (existingPr === null && canCreatePr !== true),
					title: noCredentials === true
						? "未登录 GitHub 账号，无法创建 PR"
						: existingPr !== null
							? `已有 PR #${existingPr.number}：${existingPr.title}`
							: canCreatePr !== true ? "需要 GitHub 远程、且当前分支不是默认分支" : prUrl
				}));
			} else {
				// Always visible, greyed out when there is nothing to do (teacher's rule).
				ops.push(opButton("全部提交", () => setModal({ kind: "commit" }), { key: "commit", primary: true, disabled: state.working || opLocked || !canCommitAll }));
				ops.push(opButton("全部暂存", () => {
					git.run("add", cwd, { paths: rows.filter((row) => row.working).map((row) => row.path) });
					setSelected({});
				}, { key: "stage", disabled: state.working || opLocked || !canStageAll }));
				ops.push(opButton("回退修改", () => setModal({ kind: "restore" }), { key: "restore", danger: true, disabled: state.working || opLocked || !canDiscardAll }));
				ops.push(opButton("全部撤销", () => {
					if (stagedPaths.length === 0) return;
					git.run("unstage", cwd, { paths: stagedPaths });
					setSelected({});
				}, { key: "unstage", disabled: state.working || opLocked || stagedPaths.length === 0 }));
			}
			if (opLocked !== true && selectionMode === null && snapshot?.clean !== true) {
				// "入栈": staged-only for the all-mode; selected paths (staged or not)
				// when files are selected. Skipped on a clean tree: the row is the
				// remote-sync row there and a stash has nothing to take.
				ops.push(opButton(hasSelection ? "选中入栈" : "全部入栈", () => {
					setStashIncludeUnstaged(true);
					const totalChanges = Number(snapshot?.changes?.total) || stagedPaths.length;
					setModal({ kind: "stashPush", paths: hasSelection ? selectedPaths : void 0, count: hasSelection ? selectedCount : totalChanges });
				}, { key: "stash", badge: stashBadge > 0 ? stashBadge : void 0, disabled: state.working || (hasSelection ? selectedCount === 0 : false) }));
			}
			// Branch stays outside the "more" bar: selection mode disables the bar
			// but the branch panel must remain reachable. While the more bar is open
			// the branch button collapses into it (no separate icon) — except in
			// selection mode, where the bar is forced closed but branch stays reachable.
			// The slot stays mounted in both states so closing the bar fades the
			// button back in with the left-hand group instead of popping it in.
			rightOps.push(h("div", {
				key: "branchSlot",
				className: `dshg-branchSlot${moreOpen === true && selectionMode === null ? " dshg-branchSlotOut" : ""}`,
				children: opButton("", () => {
					setBranchOpen((value) => value !== true);
					setMoreOpen(false);
				}, { key: "branch", icon: h(BranchGlyph, { size: 14 }), title: "分支", extra: "dshg-opIcon", active: branchOpen })
			}));
			if (MORE_BAR_MODE === "expand") {
				rightOps.push(h(MoreBar, {
					key: "more",
					open: moreOpen && selectionMode === null,
					disabled: selectionMode !== null,
					onToggle: () => {
						setMoreOpen((value) => value !== true);
						// The branch panel lives in the same corner: opening "more" closes it.
						setBranchOpen(false);
						// Collapsing "more" takes its bubble with it.
						setMoreBubble(null);
					},
					items: [
						// Only offered when the panel was moved out of the working-tree area.
						...(prInMoreMenu === true ? [{
							key: "prPanel",
							title: "PR 面板",
							icon: PrIcon,
							disabled: selectionMode !== null,
							onClick: () => {
								setPrPanelOpen(true);
							}
						}] : []),
						{
							key: "remoteManager",
							title: "远程管理",
							icon: GithubIcon,
							disabled: selectionMode !== null,
							onClick: () => {
								setExpandedSection("link");
								setRemoteManagerOpen(true);
								loadRemoteAccounts();
							}
						},
						{
							key: "stash",
							title: "暂存改动",
							icon: StashIcon,
							disabled: selectionMode !== null,
							onClick: () => {
								setStashOpen(true);
								loadStash();
							}
						},
						{
							key: "squash",
							title: "合并相邻提交",
							icon: SquashIcon,
							disabled: selectionMode !== null,
							onClick: () => {
								setSelectionMode("squash");
								setSelectedHashes([]);
							}
						},
						{
							key: "amend",
							title: "补充暂存到提交",
							icon: AmendIcon,
							disabled: selectionMode !== null || stagedPaths.length === 0,
							onBlocked: (element) => {
								showMoreBubble("暂存区无内容，无法补充", element);
							},
							onClick: () => {
								setSelectionMode("amend");
								setSelectedHashes([]);
							}
						},
						{
							key: "recycle",
							title: "回收站",
							icon: TrashIcon,
							disabled: selectionMode !== null,
							onClick: () => {
								setRecycleOpen(true);
								git.refreshOrphans(cwd);
							}
						},
						{
							key: "repoSettings",
							title: "仓库设置",
							icon: GitIcon,
							disabled: selectionMode !== null,
							onClick: () => {
								setRepoSettingsOpen(true);
								setRepoConfigError(null);
								setRepoConfig(null);
								setIgnoreState(null);
								setIgnoreCheckResult(null);
								// The credential picker lists GCM accounts: make sure they are loaded.
								loadRemoteAccounts();
								Promise.resolve(callRemote(ctxRef, "repoConfig", { path: cwd })).then((result) => {
									if (result?.ok === true) setRepoConfig(result);
									else setRepoConfigError(result?.error ?? "读取仓库配置失败");
								}).catch((error) => setRepoConfigError(error instanceof Error ? error.message : String(error)));
								Promise.resolve(callRemote(ctxRef, "gitignoreRead", { path: cwd })).then((result) => {
									if (result?.ok === true) setIgnoreState({ exists: result.exists, content: result.content });
									else setIgnoreState({ exists: false, content: "", error: result?.error ?? "读取失败" });
								}).catch((error) => setIgnoreState({ exists: false, content: "", error: error instanceof Error ? error.message : String(error) }));
								Promise.resolve(callRemote(ctxRef, "gitignoreFiles", { path: cwd })).then((result) => {
									if (result?.ok === true) setIgnoreFilesState({ files: result.files ?? [], truncated: result.truncated === true });
									else setIgnoreFilesState({ files: [], truncated: false, error: result?.error ?? "读取被忽略文件失败" });
								}).catch((error) => setIgnoreFilesState({ files: [], truncated: false, error: error instanceof Error ? error.message : String(error) }));
							}
						}
					]
				}));
			}
			const timeline = state.log?.commits ?? [];
			// Reflog events split into two buckets:
			//   branch  -> its own row (a commit graph cannot show branch creation)
			//   merge   -> own row ONLY when no merge commit was produced (fast-forward);
			//              a real merge renders as its commit row, so the event becomes a tag.
			const reflogEvents = Array.isArray(state.reflogEvents) ? state.reflogEvents : [];
			// Branch filter: nothing selected shows the whole graph; otherwise keep
			// commits reachable from the selected tips plus merges that touch a
			// selected branch on either side.
			const filterSet = new Set(effectiveFilter);
			// Selecting every branch is the same as no filter at all.
			const filterActive = filterSet.size > 0 && filterSet.size < allBranchNames.length;
			// Pending-sync visuals belong to the CURRENT branch's upstream: hide them
			// once the filter deselects that branch (its commits may still show through
			// another selected branch, but they are no longer "pending" for the view).
			const currentBranchName = (Array.isArray(branchList) ? branchList : []).find((branch) => branch?.current === true)?.name ?? "";
			const syncVisible = filterActive !== true || (currentBranchName.length > 0 && filterSet.has(currentBranchName));
			const aheadHashesVisible = syncVisible === true ? aheadHashes : new Set();
			const behindHashesVisible = syncVisible === true ? behindHashes : new Set();
			// Yellow bubble between the workspace and the timeline: the current branch
			// was filtered out (its sync marks disappear), the bubble offers a one-click
			// way back. Dismissing remembers the branch name so switching branches (or
			// restoring and hiding again) brings the bubble back.
			const hiddenCurrentBranch = filterActive === true && currentBranchName.length > 0 && filterSet.has(currentBranchName) === false;
			const hiddenHintEnabled = state?.settings?.syncHiddenHint !== false;
			const hiddenHintDismissed = typeof state.hiddenHintDismissed === "string" ? state.hiddenHintDismissed : "";
			const showHiddenHint = hiddenCurrentBranch === true && hiddenHintEnabled === true && hiddenHintDismissed !== currentBranchName;
			const restoreHiddenBranch = () => {
				const next = [...new Set([...allBranchNames.filter((name) => filterSet.has(name)), currentBranchName])];
				const normalized = next.length >= allBranchNames.length ? [] : next;
				setStore({ branchFilter: normalized, hiddenHintDismissed: "" });
				const root = state.snapshot?.root;
				if (typeof root === "string" && root.length > 0) git.savePrefs(root, normalized);
			};
			const dismissHiddenHint = () => setStore({ hiddenHintDismissed: currentBranchName });
			// Credential hint: offered on any repo with a remote while no GitHub
			// account is signed in. Dismissing it is remembered per repository.
			const showAccountHint = hasRemote === true && noCredentials === true && state.accountHintDismissed !== true;
			const dismissAccountHint = () => {
				setStore({ accountHintDismissed: true });
				const root = state.snapshot?.root;
				if (typeof root === "string" && root.length > 0) saveAccountHint(ctxRef, root, true);
			};
			// No account: probe whether GCM is even installed, so the hint can say
			// "not installed" instead of "not signed in".
			(0, react.useEffect)(() => {
				if (noCredentials !== true || state.deps?.gcm !== null) return;
				probeDependency(ctxRef, "gcm");
			}, [noCredentials, state.deps?.gcm]);
			// GitHub page for the header icon: https, no trailing .git, ssh rewritten.
			const repoPageUrl = (() => {
				const raw = typeof state.remoteInfo?.url === "string" ? state.remoteInfo.url.trim() : "";
				if (raw.length === 0) return "";
				return raw
					.replace(/^git@([^:]+):/, "https://$1/")
					.replace(/\.git$/, "");
			})();
			const openRepoPage = () => {
				if (repoPageUrl.length === 0) return;
				window.open(repoPageUrl, "_blank", "noopener");
			};
			const allowedCommits = new Set();
			if (filterActive === true) {
				const byHash = new Map(timeline.map((commit) => [commit.hash, commit]));
				const queue = [];
				for (const name of filterSet) {
					const branch = branchList.find((item) => item.name === name);
					if (branch !== undefined && typeof branch.hash === "string") queue.push(branch.hash);
				}
				while (queue.length > 0) {
					const hash = queue.pop();
					if (allowedCommits.has(hash)) continue;
					const commit = byHash.get(hash);
					if (commit === undefined) continue;
					allowedCommits.add(hash);
					for (const parent of commit.parents) queue.push(parent);
				}
				for (const event of reflogEvents) {
					if (event.action.startsWith("merge") === false) continue;
					const source = parseMergeSource(event.message, "");
					if (filterSet.has(source)) allowedCommits.add(event.newHash);
				}
				// Pending-sync commits are actionable state, not history browsing: a
				// selected branch's pending-pull chain stays on the axis even though
				// those commits are not reachable from any local branch yet.
				const syncByBranch = new Map((Array.isArray(state.branchSyncs) ? state.branchSyncs : []).map((item) => [item.branch, Array.isArray(item.behind) ? item.behind : []]));
				for (const name of filterSet) {
					for (const hash of syncByBranch.get(name) ?? []) {
						if (typeof hash === "string" && hash.length > 0) allowedCommits.add(hash);
					}
				}
			}
			// Timeline sync marks follow the branches the view shows: every selected
			// branch contributes its own ahead/behind chains (no filter = all branches).
			const syncVisibleNames = filterActive === true ? [...filterSet] : allBranchNames;
			const timelineAheadHashes = new Set();
			const timelineBehindHashes = new Set();
			for (const name of syncVisibleNames) {
				const entry = branchSyncMap.get(name);
				if (entry === undefined) continue;
				for (const hash of entry.ahead) if (typeof hash === "string" && hash.length > 0) timelineAheadHashes.add(hash);
				for (const hash of entry.behind) if (typeof hash === "string" && hash.length > 0) timelineBehindHashes.add(hash);
			}
			const branchRows = new Map();
			const mergeRows = new Map();
			const eventsByHash = new Map();
			for (const event of reflogEvents) {
				if (typeof event?.newHash !== "string" || event.newHash.startsWith("0000000")) continue;
				if (event.action === "branch" && /Created from/i.test(event.message ?? "")) {
					// The primary branch is created by `git init`, not by a branch
					// command; never draw a "创建分支 main" card for it.
					const branchName = event.ref.replace(/^refs\/heads\//, "");
					if (branchName === "main" || branchName === "master") continue;
					if (filterActive === true && filterSet.has(branchName) === false) continue;
					const list = branchRows.get(event.newHash) ?? [];
					list.push(event);
					branchRows.set(event.newHash, list);
					continue;
				}
				if (event.action.startsWith("merge")) {
					const source = parseMergeSource(event.message, "");
					const targetName = event.ref.replace(/^refs\/heads\//, "");
					if (filterActive === true && filterSet.has(source) === false && filterSet.has(targetName) === false) continue;
					const target = timeline.find((commit) => commit.hash === event.newHash);
					const realMerge = target !== void 0 && Array.isArray(target.parents) && target.parents.length > 1;
					const bucket = realMerge === true ? eventsByHash : mergeRows;
					const list = bucket.get(event.newHash) ?? [];
					list.push(event);
					bucket.set(event.newHash, list);
					continue;
				}
				const others = eventsByHash.get(event.newHash) ?? [];
				others.push(event);
				eventsByHash.set(event.newHash, others);
			}
			return hs("div", {
				className: "dshg-root",
				children: [
					h("div", { className: "dshg-overlay", onClick: onClose }),
					hs("div", {
						className: "dshg-drawer",
						role: "dialog",
						"aria-label": "Git 面板",
						children: [
							hs("div", {
								className: "dshg-header",
								children: [
									hs("div", {
										className: "dshg-headerTop",
										children: [
											hasRemote === true ? h("button", {
												type: "button",
												className: "dshg-repoLink",
												title: repoPageUrl.length > 0 ? `打开仓库页面 ${repoPageUrl}` : "打开仓库页面",
												disabled: repoPageUrl.length === 0,
												onClick: openRepoPage,
												children: h(GithubIcon, { size: 16 })
											}) : h(GitIcon, { size: 16 }),
											h("span", {
												className: "dshg-title",
												children: repo
													? (hasRemote === true
														? (typeof state.settings?.remoteTitle === "string" && state.settings.remoteTitle.length > 0
															? state.settings.remoteTitle
															: (typeof state.remoteInfo?.repo === "string" && state.remoteInfo.repo.length > 0
																? state.remoteInfo.repo
																: basename(snapshot?.root)))
														: basename(snapshot?.root))
													: "Git 面板"
											}),
											repo ? h("span", {
												className: snapshot?.clean ? "dshg-badge dshg-badgeOk" : "dshg-badge dshg-badgeWarn",
												title: snapshot?.root ?? "",
												children: snapshot?.clean ? "干净" : `${Number(snapshot?.changes?.total) || 0} 处改动`
											}) : null,
											noCredentials === true || state.fetchState === "failed" || cloudRetrying === true ? h("button", {
												type: "button",
												className: "dshg-iconButton dshg-fetchFail",
												title: noCredentials === true
													? "未登录 GitHub 账号，远程操作不可用"
													: cloudRetrying === true ? "正在重试…" : "远程状态未同步（fetch 失败），点击重试",
												disabled: cloudRetrying === true || noCredentials === true,
												onClick: () => {
													if (noCredentials === true) return;
													setCloudRetrying(true);
													lastFetchAt = 0;
													fetchRemoteNow().finally(() => setCloudRetrying(false));
												},
												children: cloudRetrying === true ? h("span", { className: "dshg-spinner" }) : h(CloudXIcon, { size: 14 })
											}) : null,
											h("button", {
												type: "button",
												className: "dshg-iconButton",
												title: "刷新",
												disabled: state.loading === true || refreshing === true,
												onClick: async () => {
													setExpandedHash(null);
													// A manual refresh also retries the remote probe (clearing the
													// throttle) and only stops spinning once BOTH the local read
													// and the fetch have settled.
													setRefreshing(true);
													lastFetchAt = 0;
													try {
														await git.refresh(cwd);
														await fetchRemoteNow();
													} finally {
														setRefreshing(false);
													}
												},
												children: state.loading === true || refreshing === true ? h("span", { className: "dshg-spinner" }) : h(RefreshIcon, {})
											}),
											h("button", { type: "button", className: "dshg-iconButton", title: "关闭", onClick: onClose, children: h(CloseIcon, {}) })
										]
									}),
									repo ? h("div", {
										className: detached ? "dshg-headerBranch dshg-headerBranchWarn" : "dshg-headerBranch",
										title: detached ? (operation?.kind === "rebase" ? "变基中：正在把分支变基到新基点" : "游离 HEAD：当前不在任何分支上") : (snapshot?.branch ?? ""),
										children: detached ? (operation?.kind === "rebase" ? `变基中（${String(snapshot?.branch ?? "").slice(0, 8)}）` : `游离 HEAD（${String(snapshot?.branch ?? "").slice(0, 8)}）`) : (snapshot?.branch ?? "")
									}) : null
								]
							}),
							state.error !== null && state.error !== void 0 ? h("div", { className: "dshg-error", children: state.error }) : null,
							loading ? hs("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取 git 状态…"] }) : null,
							!loading && !repo ? hs("div", {
								className: "dshg-notRepo",
								children: [
									h("div", { className: "dshg-notRepoIcon", children: h(GitIcon, { size: 40 }) }),
									h("div", { className: "dshg-notRepoTitle", children: "这里还不是 git 仓库" }),
									h("div", { className: "dshg-notRepoDesc", children: "在当前工作区运行 git init 初始化后，就能在这里看到分支、提交历史和改动记录了" }),
									devMode === true ? h("div", { className: "dshg-notRepoDesc", children: `当前路径：${cwd}（来源：${source ?? "?"}，v${version ?? "?"}）` }) : null,
									devMode === true ? h("div", { className: "dshg-notRepoDesc", children: `诊断：${diag ?? "?"}` }) : null,
									h("button", { type: "button", className: "dshg-op dshg-opPrimary", disabled: state.working, onClick: () => setModal({ kind: "init" }), children: "初始化仓库" })
								]
							}) : null,
							repo && !loading ? hs(react.Fragment, {
								children: [
									h("div", {
										className: "dshg-opsBar",
										children: [
											// The four fixed actions collapse while the more bar is
											// expanded, so the bar never wraps or scrolls.
											h("div", {
												className: `dshg-opsLeft${moreOpen === true && selectionMode === null ? " dshg-opsLeftHidden" : ""}`,
												children: ops
											}),
											...rightOps,
											moreBubble !== null ? h("div", {
												ref: moreBubbleRef,
												className: "dshg-moreBubble",
												style: moreBubble.rect !== null && moreBubble.rect !== void 0 ? { top: `${moreBubble.rect.bottom + 6}px` } : void 0,
												children: moreBubble.text
											}) : null,
											h(BranchPopover, {
												visible: branchOpen,
												dirty: snapshot?.clean === false,
												filtered: effectiveFilter,
												onToggleFilter: toggleBranchFilter,
												branches: branchList,
												remotes: state.remoteBranches,
												hasRemote,
												onHover: chatHover,
												showLinkHint: repo && hasRemote !== true && state.settings?.promptRemoteLink !== false && hintDismissed !== true,
												onLinkRemote: () => setModal({ kind: "linkRemote" }),
												onDismissHint: dismissRemoteHint,
												notice: state.opMessage,
												operation,
												busy: state.working,
												onClose: () => setBranchOpen(false),
												onSwitch: (name) => { setBranchOpen(false); git.run("checkout", cwd, { target: name }); },
												onCreate: () => { setNewBranchName(""); setModal({ kind: "createBranch" }); },
												onRename: (from) => {
													const info = branchList.find((branch) => branch.name === from);
													const active = typeof state?.settings?.activeAccount === "string" ? state.settings.activeAccount : "";
													setRenameRemote(true);
													setRenameAccount(active);
													loadRemoteAccounts();
													// Probe before the user commits to a remote rename.
													if (typeof info?.upstream === "string" && info.upstream.length > 0) checkPermission(true, active);
													setModal({ kind: "renameBranch", from, upstream: typeof info?.upstream === "string" ? info.upstream : "" });
												},
												onDelete: (branch) => {
													setModal({ kind: "deleteBranch", name: branch.name, merged: branch.merged, current: branch.current });
												},
												onMerge: (source) => { setMergeTarget(snapshot?.branch ?? ""); setModal({ kind: "merge", source }); },
												onRebase: (name) => {
													setBranchOpen(false);
													setRebaseSource(name);
													setSelectionMode("rebase");
													setSelectedHashes([]);
												},
												onJumpCommit: (hash) => {
													setBranchOpen(false);
													setExpandedHash(hash);
													const main = mainRef.current;
													const row = main === null || main === void 0 ? null : main.querySelector(`[data-commit="${hash}"]`);
													if (row !== null && row !== void 0 && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "center", behavior: "smooth" });
												},
												onJumpEvent: (hash) => {
													setBranchOpen(false);
													setBlinkHash(hash);
													window.setTimeout(() => {
														const main = mainRef.current;
														const node = main === null || main === void 0 ? null : main.querySelector(`[data-branch-event="${hash}"]`);
														if (node !== null && node !== void 0 && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "center", behavior: "smooth" });
													}, 30);
												},
												onLinkUpstream: (name) => {
													// Link to the remote branch of the same name; when there is
													// none the branch simply has not been pushed yet.
													const candidates = (Array.isArray(state.remoteBranches) ? state.remoteBranches : []).filter((remote) => remote.branch === name);
													if (candidates.length === 0) {
														setStore({ opMessage: { type: "error", text: `远程没有与 ${name} 同名的分支，先推送一次就会自动建立关联` } });
														return;
													}
													git.run("linkUpstream", cwd, { branch: name, upstream: candidates[0].name });
												}
											})
										]
									}),
									selectionMode !== null ? h("div", {
										className: "dshg-selectHint",
										children: (() => {
											if (selectionMode === "squash") return "选择一段连续的提交，然后点「确认合并」把它们压成一条。";
											if (selectionMode === "rebase") {
												if (selectedHashes.length === 0) return "选择一个提交作为变基目标";
												const base = `将把 ${rebaseSource ?? "当前分支"} 变基到 ${String(selectedHashes[0]).slice(0, 8)}`;
												if (rebasePreview === null) return `${base}（检查冲突中…）`;
												if (rebasePreview.conflicts.length > 0) return `${base}：可能冲突（${rebasePreview.conflicts.length} 个文件）`;
												return `${base}：无冲突`;
											}
											if (selectedHashes.length === 0) return "选择一个提交，把暂存区的文件补充进去。";
											if (selectedCount > 0) {
												// N = unpicked staged files + unstaged files; hide the tail when 0.
												const pending = (stagedPaths.length - selectedCount) + unstagedNow.length;
												return pending > 0 ? `将提交 ${selectedCount} 个已暂存改动，${pending} 个改动未进入提交列表` : `将提交 ${selectedCount} 个已暂存改动`;
											}
											const base = `将提交 ${stagedPaths.length} 个已暂存改动`;
											return unstagedNow.length > 0 ? `${base}，${unstagedNow.length} 个未暂存改动未进入提交列表` : base;
										})()
									}) : null,
									operation !== null ? h(ConflictBanner, {
										operation,
										conflicts,
										resolved: resolvedFiles,
										open: conflictOpen,
										busy: state.working,
										onHover: chatHover,
										onToggle: () => setConflictOpen((value) => value !== true),
										onContinue: () => continueRebaseWithPush(),
										onAbort: () => setModal({ kind: "abortOperation", kindName: operation.kind }),
										onSkip: () => git.run("rebaseSkip", cwd, {}),
										onOpenFile: (path) => {
											// Clicking the active conflict file again closes the pane.
											if (conflictPath === path) {
												setConflictPath(null);
												return;
											}
											setConflictPath(path);
											setDetailHash(null);
											setFilePath(null);
											setPreviewPath(null);
											setExpandedHash(null);
											git.refreshConflict(cwd, path);
										},
										activePath: conflictPath
									}) : null,
									// While the branch panel is open its own notice area owns the
									// message, so branch actions report there instead of above the
									// workspace.
									branchOpen !== true && state.opMessage !== null && state.opMessage !== void 0 ? h("div", {
										className: `dshg-opMsg ${state.opMessage.type === "ok" ? "dshg-opMsgOk" : "dshg-opMsgErr"}`,
										children: state.opMessage.text
									}) : null,
									hs("div", {
										className: "dshg-main",
										ref: mainRef,
										children: [
											gitMissing === true ? h("div", {
												className: "dshg-depMissing",
												children: [
													h("div", { className: "dshg-depIcon", children: [
														h(GitIcon, { size: 44 }),
														h("span", { className: "dshg-depBadge", children: "×" })
													] }),
													h("div", { className: "dshg-depText", children: "此设备未检测到 git 安装，请安装 git 后重试" })
												]
											}) : null,
											// (The "link a remote" hint now lives inside the branch panel,
											// next to the other branch/remote actions.)
											// (The "no push permission" hint moved into the push panel.)
											// Every pull request that touches this branch (unless the panel was moved into "more").
											prInMoreMenu !== true ? h(PrList, {
												prs: pullRequests,
												dismissedKey,
												dismissed: dismissedPrs,
												onDismiss: dismissPr,
												onJumpCommit: (hash) => {
													setExpandedHash(hash);
													window.setTimeout(() => {
														const main = mainRef.current;
														const row = main !== null ? main.querySelector(`[data-commit="${hash}"]`) : null;
														if (row !== null) row.scrollIntoView({ block: "center", behavior: "smooth" });
													}, 30);
												}
											}) : null,
											selectionMode === "rebase" ? null : clean ? (hasRemote === true && syncVisible === true ? h(SyncBubbles, {
												ahead: state.sync?.ahead,
												behind: state.sync?.behind,
												aheadFiles: state.sync?.aheadFiles,
												behindFiles: state.sync?.behindFiles,
												onPickFile: openRangeDiff,
												onJumpCommit: (hash) => {
													setExpandedHash(hash);
													window.setTimeout(() => {
														const main = mainRef.current;
														const row = main === null || main === void 0 ? null : main.querySelector(`[data-commit="${hash}"]`);
														if (row !== null && row !== void 0 && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "center", behavior: "smooth" });
													}, 30);
												}
											}) : h("div", {
												className: "dshg-clean",
												children: [
													h("div", { className: "dshg-notRepoIcon", children: h(GitIcon, { size: 34 }) }),
													h("div", { className: "dshg-cleanText", children: "干净" }),
													// No remote: nothing can be "local", so the plain wording.
													h("div", { className: "dshg-cleanSub", children: "当前暂无文件改动与新增" })
												]
											})) : null,
											selectionMode === "rebase" ? null : showAccountHint === true ? h("div", {
												className: "dshg-accountHint",
												children: [
													h("span", { className: "dshg-accountHintText", children: gcmMissing === true
														? "未安装 Git Credential Manager：无法登录 GitHub 账号，推送、拉取、创建 PR 等操作已禁用。"
														: "未登录 GitHub 账号：推送、拉取、创建 PR 等操作已禁用。" }),
													h("button", {
														type: "button",
														className: "dshg-accountHintClose",
														title: "不再提示（本仓库）",
														"aria-label": "关闭提示",
														onClick: dismissAccountHint,
														children: "×"
													})
												]
											}) : null,
											selectionMode === "rebase" ? null : clean ? null : h(Safeguard, {
												fallback: (error) => h("div", {
													className: "dshg-error",
													children: `文件列表渲染出错：${error?.message ?? "unknown"}${error?.stack ? ` | ${String(error.stack).split("\n").slice(1, 4).join(" | ")}` : ""}`
												}),
												children: hs("div", {
													className: "dshg-tree",
													ref: treeRef,
													children: [
														tree.files.map((row) => h(FileRow, {
															key: row.path,
															row,
															level: 0,
															selected,
															onDown: onRowDown,
															onEnter: onRowEnter,
															onHover: chatHover,
															onPreview: (path) => openPreview(path)
														})),
														h(TreeNodes, {
															node: tree,
															level: 0,
															collapsed: collapsedDirs,
															selected,
															onToggle: (path) => setCollapsedDirs((previous) => ({ ...previous, [path]: !previous[path] })),
															onDown: onRowDown,
															onEnter: onRowEnter,
															onGroupToggle,
															onPreview: (path) => openPreview(path),
															onHover: chatHover
														})
													]
												})
											}),
											showHiddenHint === true ? h("div", {
												className: "dshg-hiddenHint",
												role: "button",
												tabIndex: 0,
												title: "点击恢复显示当前分支",
												onClick: restoreHiddenBranch,
												onKeyDown: (event) => {
													if (event.key === "Enter" || event.key === " ") {
														event.preventDefault();
														restoreHiddenBranch();
													}
												},
												children: [
													h("span", { className: "dshg-hiddenHintText", children: `当前分支 ${currentBranchName} 已被筛选隐藏，点击恢复显示` }),
													h("button", {
														type: "button",
														className: "dshg-hiddenHintClose",
														title: "不再提示",
														"aria-label": "关闭提示",
														onClick: (event) => { event.stopPropagation(); dismissHiddenHint(); },
														children: "×"
													})
												]
											}) : null,
											h(Safeguard, {
												fallback: (error) => h("div", { className: "dshg-error", children: `时间线渲染出错：${error?.message ?? "unknown"}` }),
												children: h("div", {
													className: `dshg-timeline${timeline.length === 1 ? " dshg-timelineSingle" : ""}`,
													children: timeline.length === 0
														? h("div", { className: "dshg-empty", children: "仓库还没有提交" })
														: (selectionMode === null ? timeline : timeline.filter((commit) => Array.isArray(commit.parents) && commit.parents.length <= 1)).flatMap((commit, index, visibleList) => {
															const rows = [];
															const branchHere = (branchRows.get(commit.hash) ?? []).filter((event) => {
																if (filterActive === false) return true;
																const name = event.ref.replace(/^refs\/heads\//, "");
																return filterSet.has(name);
															});
															if (selectionMode === null && branchHere.length > 0) rows.push(h(BranchEventRow, {
																key: `branch-${commit.hash}`,
																events: branchHere,
																eventHash: commit.hash,
																blink: blinkHash === commit.hash,
																onBlinkEnd: () => setBlinkHash(null)
															}));
															const mergeHere = (mergeRows.get(commit.hash) ?? []).filter((event) => {
																if (filterActive === false) return true;
																const source = parseMergeSource(event.message, "");
																const target = event.ref.replace(/^refs\/heads\//, "");
																return filterSet.has(source) || filterSet.has(target);
															});
															if (selectionMode === null && mergeHere.length > 0) rows.push(h(MergeEventRow, { key: `merge-${commit.hash}`, events: mergeHere, onOpenDetail: openDetail }));
															if (filterActive === true && allowedCommits.has(commit.hash) === false && branchHere.length === 0 && mergeHere.length === 0 && commit.stashRef === void 0) return rows;
															// Selection mode: only normal commits are shown; the node picks
															// commits, squash keeps the picked range contiguous.
															const selected = selectionMode !== null && selectedHashes.includes(commit.hash);
															let selectable = true;
															if (selectionMode === "squash") {
																const picked = visibleList.map((item, at) => selectedHashes.includes(item.hash) ? at : -1).filter((at) => at >= 0);
																if (picked.length > 0) {
																	const min = Math.min(...picked);
																	const max = Math.max(...picked);
																	// Already-picked nodes stay clickable (to un-pick them).
																	selectable = selected || index === min - 1 || index === max + 1;
																}
															} else if (selectionMode === "amend" || selectionMode === "rebase") {
																// Every commit stays clickable: picking another one switches.
																selectable = true;
															}
															// Squash/amend rewrite the branch's own history: a commit that was
															// never pulled into it cannot take part.
															if (behindHashes.has(commit.hash) && (selectionMode === "squash" || selectionMode === "amend")) {
																selectable = false;
															}
															rows.push(h(CommitRow, {
																key: commit.hash,
																commit,
																index,
																reflog: eventsByHash.get(commit.hash) ?? [],
																expanded: expandedHash === commit.hash,
																detailOpen: detailHash === commit.hash,
																isFirst: index === timeline.length - 1 && commit.stashRef === void 0,
																isNewest: index === 0,
																visibleBranches: filterActive ? filterSet : null,
																locked: operation !== null || (selectionMode !== null && selected !== true),
																selectMode: selectionMode,
																selected,
																selectable,
																syncSide: timelineAheadHashes.has(commit.hash) ? "ahead" : timelineBehindHashes.has(commit.hash) ? "behind" : null,
																onSelect: (hash) => toggleSelectCommit(hash),
																onToggle: () => toggleRow(commit.hash),
																onOpenDetail: openDetail,
																onAction: (kind, hash) => setModal({ kind, hash }),
																// Stash cards drive the stash panel's own actions.
																onStashAction: (kind, ref) => setModal({
																	kind: kind === "pop" ? "stashPop" : kind === "apply" ? "stashApply" : kind === "branch" ? "stashBranch" : "stashDrop",
																	ref: typeof ref === "string" && ref.length > 0 ? ref : "stash@{0}"
																}),
																onHover: chatHover
															}));
															return rows;
														})
												})
											})
										]
									}),
									// The pane is a flex child of the drawer (not of the scrolling
									// column), so it is pinned to the sidebar's bottom edge and
									// expands upward from there.
									h(Safeguard, {
										fallback: (error) => h("div", { className: "dshg-error", children: `详情渲染出错：${error?.message ?? "unknown"}` }),
										children: h(DetailPane, {
											open: detailHash !== null || previewPath !== null || conflictPath !== null || rangePath !== null,
											detailHash,
											detail: state.detail,
											detailError: state.detailError,
											detailLoading: state.detailLoading,
											detailReady: state.detailLoadedHash === detailHash,
											filePath,
											fileDiff: state.fileDiff,
											fileDiffError: state.fileDiffError,
											fileDiffLoading: state.fileDiffLoading,
											fileDiffReady: state.fileDiffLoadedKey === `${detailHash}:${filePath}`,
											workPath: previewPath,
											workDiff: state.workDiff,
											// Ready only when the cached patch belongs to this path AND no
											// request is in flight — otherwise the previous file's patch
											// flashes while the new one loads.
											workDiffReady: state.workDiffPath === previewPath && state.workDiffLoading !== true,
											workDiffLoading: state.workDiffLoading,
											workDiffError: state.workDiffError,
											conflictPath,
											conflictFile: state.conflictFile,
											conflictFileError: state.conflictFileError,
											conflictFileLoading: state.conflictFileLoading,
											rangePath,
											rangeDiff,
											rangeDiffError,
											rangeDiffLoading,
											onClose: () => { setDetailHash(null); setFilePath(null); },
											onPickFile: (path) => {
												if (filePath === path) { setFilePath(null); return; }
												setFilePath(path);
												git.refreshFileDiff(cwd, detailHash, path);
											},
											onCloseFile: () => setFilePath(null),
											onCloseWork: () => setPreviewPath(null),
											onCloseConflict: () => setConflictPath(null),
											onCloseRange: () => { setRangePath(null); setRangeDiff(null); setRangeDiffError(null); },
											onMarkResolved: (path) => { git.markResolved(cwd, path); setConflictPath(null); }
										})
									}),
									devMode === true ? h("div", { className: "dshg-diag", title: diag, children: diag }) : null
								]
							}) : null,
							modal !== null ? h(ActionModal, {
								modal,
								anchor: state.modalAnchor,
								t,
								doAction,
								commitMsg,
								setCommitMsg,
								commitBody,
								setCommitBody,
								stashIncludeUnstaged,
								setStashIncludeUnstaged,
								renameRemote,
								setRenameRemote,
								accountUser,
								renameAccount,
								setRenameAccount,
								permission,
								checkingPermission,
								checkRenamePermission: (account) => checkPermission(true, account),
								mergeTarget,
								setMergeTarget,
								newBranchName,
								setNewBranchName,
								switchTarget,
								setSwitchTarget,
								linkUrl,
								setLinkUrl,
								currentBranch: snapshot?.branch ?? "",
								files: filesNow,
								unstagedFiles: unstagedNow,
								dirty: snapshot?.clean !== true,
								branches,
								loadExclusive: (name) => git.exclusive(cwd, name),
								previewMerge: (target, source) => git.previewMerge(target, source),
								onClose: () => setModal(null)
							}) : null,
							h(RemoteManagerModal, {
								open: remoteManagerOpen,
								remoteInfo: state.remoteInfo,
								allowCreateRepo: state.settings?.allowCreateRepo === true,
								busy: state.working === true,
								linkUrl,
								setLinkUrl,
								nameDraft: repoNameDraft,
								setNameDraft: setRepoNameDraft,
								descDraft: repoDescDraft,
								setDescDraft: setRepoDescDraft,
								isPrivate: repoPrivate,
								setIsPrivate: setRepoPrivate,
								permission,
								checkingPermission,
								accounts: Array.isArray(state.githubAccounts) ? state.githubAccounts : accounts,
								accountUser,
								expandedSection,
								setExpandedSection,
								onCheckPermission: () => checkPermission(true),
								onSwitchAccount: (name) => {
									if (typeof name !== "string" || name.length === 0) return;
									setStore({ settings: { ...(state.settings ?? {}), activeAccount: name } });
									callRemote(ctxRef, "pluginSettingsUpdate", { activeAccount: name })
										.then(() => loadRemoteAccounts())
										.catch(() => { /* keep the local value */ });
								},
								onClose: () => setRemoteManagerOpen(false),
								onUnlink: () => {
									askConfirm({
										title: "取消链接",
										message: "只会移除本地的 remote 配置，不会删除远端仓库，也不会丢失任何本地提交。",
										confirmLabel: "取消链接",
										danger: true,
										onOk: () => {
											git.run("removeRemote", cwd, { name: state?.remoteInfo?.name ?? "origin" });
											permissionCache = { key: "", value: null, checkedAt: 0 };
											setPermission(null);
											setRemoteManagerOpen(false);
										}
									});
								},
								onLink: () => {
									doAction("addRemote", { url: linkUrl.trim() });
									setRemoteManagerOpen(false);
								},
								creating: creatingRepo,
								failure: createFailure,
								onCreate: createRepoAndLink
							}),
							// PR panel moved out of the working-tree area (settings toggle).
							h(Presence, { show: prPanelOpen === true, children: h("div", { className: "dshg-modal", children: h("div", {
								className: "dshg-modalCard dshg-prModalCard",
								children: [
									h("div", { className: "dshg-prModalHead", children: [
										h("span", { className: "dshg-prModalTitle", children: "PR 管理" }),
										hasRemote === true && pendingPrCount > 0 ? h("span", { className: "dshg-prModalCount", children: `待处理 ${pendingPrCount}` }) : null
									]}),
									hasRemote !== true
										? h("div", { className: "dshg-prEmpty", children: h("div", { className: "dshg-prEmptyText", children: "未关联远程仓库，无法查看 PR" }) })
										: noCredentials === true
											? h("div", { className: "dshg-prEmpty", children: h("div", { className: "dshg-prEmptyText", children: "未登录 GitHub 账号，无法使用 PR 面板。请在「设置 → Git」里登录。" }) })
											: pendingPrCount === 0
											? h("div", { className: "dshg-prEmpty", children: [
												h("div", { className: "dshg-prEmptyText", children: "当前暂无待处理 PR" }),
												h("button", {
													type: "button",
													className: "dshg-op",
													disabled: prRefreshing === true,
													onClick: () => {
														if (prRefreshing === true) return;
														setPrRefreshing(true);
														setPrReloadToken(prReloadToken + 1);
														// Watchdog: a hung request must not lock the button forever.
														window.setTimeout(() => setPrRefreshing(false), 15000);
													},
													children: prRefreshing === true
														? [h("span", { key: "spin", className: "dshg-spinner" }), "刷新中…"]
														: "刷新"
												})
											] })
											: h(PrList, {
												bare: true,
										prs: pullRequests,
										dismissedKey,
										dismissed: dismissedPrs,
										onDismiss: dismissPr,
										onJumpCommit: (hash) => {
											setExpandedHash(hash);
											window.setTimeout(() => {
												const main = mainRef.current;
												const row = main !== null ? main.querySelector(`[data-commit="${hash}"]`) : null;
												if (row !== null) row.scrollIntoView({ block: "center", behavior: "smooth" });
											}, 30);
										}
									}),
									h("div", { className: "dshg-modalActions", children: [
										hasRemote === true && noCredentials !== true ? h("button", {
											type: "button",
											className: "dshg-op dshg-opPrimary",
											onClick: openCreatePr,
											children: "创建 PR"
										}) : null,
										h("button", {
											type: "button",
											className: "dshg-op",
											onClick: () => setPrPanelOpen(false),
											children: "关闭"
										})
									] })
								]
							}) }) }),
							// Create pull request: source branch, target repo/branch, pushing
							// account, unpushed-commit warning, title + body.
							h(Presence, { show: prCreateOpen === true, children: (() => {
								const owner = state?.remoteInfo?.owner ?? "";
								const repo = state?.remoteInfo?.repo ?? "";
								const ahead = Array.isArray(state?.sync?.ahead) ? state.sync.ahead.length : 0;
								const parent = repoForkInfo !== null && repoForkInfo !== void 0 ? repoForkInfo.parent : null;
								const names = [...new Set([
									prTargetBranch,
									parent !== null && parent !== void 0 ? parent.defaultBranch : "",
									...branchList.map((item) => (typeof item?.name === "string" ? item.name : "")),
									"main",
									"master"
								].filter((name) => typeof name === "string" && name.length > 0))];
								return h("div", { className: "dshg-modal", children: h("div", {
									className: "dshg-modalCard dshg-prCreateCard",
									children: [
										h("div", { className: "dshg-modalTitle", children: "创建 PR" }),
										// Read-only source branch + the repo it lives in: GitHub
										// needs "owner:branch" for a cross-repo head.
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "源分支" }),
											h("div", { className: "dshg-prSource", children: [
												h("span", { className: "dshg-prSourceName", children: snapshot?.branch ?? "" }),
												h("span", { className: "dshg-prSourceRepo", children: `${owner}/${repo}` })
											] })
										]}),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "目标仓库" }),
											h("select", {
												className: "dshg-setSelect",
												value: prTargetMode,
												onChange: (event) => setPrTargetMode(event.target.value),
												children: [
													h("option", { value: "self", children: `${owner}/${repo}（当前仓库）` }, "self"),
													parent !== null && parent !== void 0
														? h("option", { value: "parent", children: `${parent.owner}/${parent.repo}（源仓库）` }, "parent")
														: null,
													h("option", { value: "custom", children: "自定义…" }, "custom")
												]
											})
										]}),
										prTargetMode === "custom" ? h("input", {
											className: "dshg-setInput",
											value: prCustomTarget,
											placeholder: "owner/repo",
											onChange: (event) => setPrCustomTarget(event.target.value)
										}) : null,
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "目标分支" }),
											h("select", {
												className: "dshg-setSelect",
												value: prTargetBranch,
												onChange: (event) => setPrTargetBranch(event.target.value),
												children: names.map((name) => h("option", { key: name, value: name, children: name }))
											})
										]}),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "推送账户" }),
											h("select", {
												className: "dshg-setSelect",
												value: prAccount,
												onChange: (event) => setPrAccount(event.target.value),
												children: (Array.isArray(accounts) && accounts.length > 0 ? accounts : [{ name: "" }]).map((item) => h("option", {
													key: item.name.length > 0 ? item.name : "default",
													value: item.name,
													children: item.name.length > 0 ? item.name : "（默认凭据）"
												}))
											})
										]}),
										// A PR only contains commits that reached the remote first.
										ahead > 0 ? h("div", { className: "dshg-prWarn", children: [
											h("span", { className: "dshg-prWarnText", children: `当前分支有 ${ahead} 个提交未推送，PR 不会包含它们` }),
											h("button", {
												type: "button",
												className: "dshg-op dshg-opTiny",
												disabled: prPushing === true,
												onClick: async () => {
													setPrPushing(true);
													const pushed = await pushCurrentBranch({ account: prAccount });
													setPrPushing(false);
													setPrCreateResult(pushed.ok === true
														? { ok: true, message: "已推送，PR 将包含这些提交", url: "" }
														: { ok: false, message: pushed.message, url: "" });
												},
												children: prPushing === true ? "推送中…" : "先推送"
											})
										]}) : null,
										h("input", {
											className: "dshg-setInput",
											value: prTitleDraft,
											placeholder: "标题（必填）",
											onChange: (event) => setPrTitleDraft(event.target.value)
										}),
										h("textarea", {
											className: "dshg-setInput dshg-prCreateBody",
											value: prBodyDraft,
											placeholder: "描述（可选）",
											rows: 4,
											onChange: (event) => setPrBodyDraft(event.target.value)
										}),
										prCreateResult !== null && prCreateResult !== void 0 ? h("div", {
											className: `dshg-prCreateResult ${prCreateResult.ok === true ? "dshg-permOk" : "dshg-permDenied"}`,
											children: [
												h("span", { key: "text", children: prCreateResult.message }),
												typeof prCreateResult.url === "string" && prCreateResult.url.length > 0 ? h("a", {
													key: "link",
													className: "dshg-createFailLink",
													href: prCreateResult.url,
													target: "_blank",
													rel: "noopener noreferrer",
													children: "打开"
												}) : null
											]
										}) : null,
										h("div", { className: "dshg-modalActions", children: [
											h("button", {
												type: "button",
												className: "dshg-op dshg-opPrimary",
												disabled: prCreating === true || prTitleDraft.trim().length === 0 || createPrTarget() === null || prTargetBranch.trim().length === 0,
												onClick: submitCreatePr,
												children: prCreating === true ? "创建中…" : "创建 PR"
											}),
											h("button", {
												type: "button",
												className: "dshg-op",
												onClick: () => setPrCreateOpen(false),
												children: "取消"
											})
										]})
									]
								}) });
							})() }),
							// Push confirmation: branch, account, commits, permission probe,
							// behind warning, PR-overwrite notice and force-push switch.
							h(Presence, { show: pushOpen === true, children: (() => {
								const branch = typeof snapshot?.branch === "string" ? snapshot.branch : "";
								const upstream = typeof state.sync?.upstream === "string" ? state.sync.upstream : "";
								const ahead = Array.isArray(state.sync?.ahead) ? state.sync.ahead : [];
								const behind = Array.isArray(state.sync?.behind) ? state.sync.behind : [];
								const files = Array.isArray(state.sync?.aheadFiles) ? state.sync.aheadFiles : [];
								const remoteName = typeof state.remoteInfo?.name === "string" && state.remoteInfo.name.length > 0 ? state.remoteInfo.name : "origin";
								const targetLabel = upstream.length > 0 ? upstream : `${remoteName}/${branch}`;
								const denied = permission !== null && permission !== void 0 && permission.canPush === false;
								return h("div", { className: "dshg-modal", children: h("div", {
									className: "dshg-modalCard dshg-pushCard",
									children: [
										h("div", { className: "dshg-modalTitle", children: pushMode === "sync" ? "同步改动" : "推送改动" }),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "分支" }),
											h("div", { className: "dshg-prSource", children: [
												h("span", { className: "dshg-prSourceName", children: `${branch} → ${targetLabel}` }),
												upstream.length === 0 ? h("span", { className: "dshg-prSourceRepo", children: "首次推送会建立跟踪关系" }) : null
											] })
										]}),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "推送账户" }),
											h("select", {
												className: "dshg-setSelect",
												value: pushAccount,
												onChange: (event) => {
													const next = event.target.value;
													setPushAccount(next);
													// Another account may well have other rights.
													checkPermission(true, next);
												},
												children: (Array.isArray(accounts) && accounts.length > 0 ? accounts : [{ name: "" }]).map((item) => h("option", {
													key: item.name.length > 0 ? item.name : "default",
													value: item.name,
													children: item.name.length > 0 ? item.name : "（默认凭据）"
												}))
											})
										]}),
										// Sync shows both sides: what arrives, then what leaves.
										pushMode === "sync" ? h("div", { className: "dshg-pushSection", children: [
											h("span", { className: "dshg-pushSectionTitle", children: `即将拉取（${behind.length}）` }),
											h(CommitList, { commits: behind, emptyText: "远程没有新提交" })
										]}) : null,
										h("div", { className: "dshg-pushSection", children: [
											h("span", { className: "dshg-pushSectionTitle", children: `即将推送（${ahead.length}）` }),
											h(CommitList, { commits: ahead, emptyText: upstream.length === 0 ? "首次推送会发送整个本地历史" : "没有待推送的提交" })
										]}),
										files.length > 0 ? h("div", { className: "dshg-pushNote", children: `涉及 ${files.length} 个文件` }) : null,
										checkingPermission === true ? h("div", { className: "dshg-permResult dshg-permUnknown", children: "正在检测推送权限…" }) : null,
										checkingPermission !== true && permission !== null && permission !== void 0 ? h("div", {
											className: `dshg-permResult ${permission.canPush === true ? "dshg-permOk" : permission.canPush === false ? "dshg-permDenied" : "dshg-permUnknown"}`,
											children: permission.canPush === true
												? "此账户拥有推送权限"
												: permission.canPush === false
													? `此账户没有推送权限（${permission.reason.length > 0 ? permission.reason : "denied"}）`
													: `无法确定推送权限（${permission.reason.length > 0 ? permission.reason : "unknown"}）`
										}) : null,
										denied === true ? h("button", {
											type: "button",
											className: "dshg-op dshg-opTiny",
											disabled: checkingPermission === true,
											onClick: () => checkPermission(true, pushAccount),
											children: checkingPermission === true ? "检查中…" : "我拿到权限了，重新检查"
										}) : null,
										// Only a plain push can be rejected by new remote commits; the
										// sync mode pulls them first, so the warning would be noise there.
										pushMode === "push" && behind.length > 0 ? h("div", { className: "dshg-prWarn", children: [
											h("span", { className: "dshg-prWarnText", children: `远程有 ${behind.length} 个新提交，推送可能被拒绝` }),
											h("button", {
												type: "button",
												className: "dshg-op dshg-opTiny",
												// Same confirmation dialog as the toolbar action: the panel
												// only points at it, it never pulls on its own.
												onClick: () => { setPushOpen(false); openPullPanel(); },
												children: "先拉取"
											})
										]}) : null,
										currentPr !== null ? h("div", { className: "dshg-prWarn", children: h("span", { className: "dshg-prWarnText", children: `推送会更新已有的 PR #${currentPr.number}「${currentPr.title}」；之后若变基或强制推送，评审记录可能失去行锚点` }) }) : null,
										h("label", { className: "dshg-remoteCheck", children: [
											h("input", { type: "checkbox", checked: pushForce === true, onChange: (event) => setPushForce(event.target.checked) }),
											h("span", { children: "强制推送（--force-with-lease，会覆盖远程同名分支）" })
										]}),
										pushError !== null && pushError !== void 0 ? h("div", { className: "dshg-prCreateResult dshg-permDenied", children: pushError }) : null,
										h("div", { className: "dshg-modalActions", children: [
											h("button", {
												type: "button",
												className: `dshg-op dshg-opPrimary${pushForce === true ? " dshg-opDanger" : ""}`,
												// A sync may run with only incoming commits; a push needs something to send.
												disabled: pushBusy === true || denied === true || (pushMode === "push" && upstream !== "" && ahead.length === 0) || (pushMode === "sync" && upstream !== "" && ahead.length === 0 && behind.length === 0),
												onClick: submitPush,
												children: pushBusy === true ? "处理中…" : (pushMode === "sync" ? "同步" : "推送")
											}),
											h("button", { type: "button", className: "dshg-op", onClick: () => setPushOpen(false), children: "取消" })
										]})
									]
								}) });
							})() }),
							// Pull confirmation: a short dialog listing the incoming commits.
							h(Presence, { show: pullOpen === true, children: (() => {
								const upstream = typeof state.sync?.upstream === "string" ? state.sync.upstream : "";
								const behind = Array.isArray(state.sync?.behind) ? state.sync.behind : [];
								const files = Array.isArray(state.sync?.behindFiles) ? state.sync.behindFiles : [];
								const remoteName = typeof state.remoteInfo?.name === "string" && state.remoteInfo.name.length > 0 ? state.remoteInfo.name : "origin";
								return h("div", { className: "dshg-modal", children: h("div", {
									className: "dshg-modalCard dshg-pullCard",
									children: [
										h("div", { className: "dshg-modalTitle", children: "拉取改动" }),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "来源" }),
											h("div", { className: "dshg-prSource", children: [
												h("span", { className: "dshg-prSourceName", children: upstream.length > 0 ? upstream : `${remoteName}/（远程分支）` }),
												files.length > 0 ? h("span", { className: "dshg-prSourceRepo", children: `涉及 ${files.length} 个文件` }) : null
											] })
										]}),
										h("div", { className: "dshg-pushSection", children: [
											h("span", { className: "dshg-pushSectionTitle", children: `即将拉取（${behind.length}）` }),
											h(CommitList, { commits: behind, emptyText: "远程没有新提交" })
										]}),
										pullError !== null && pullError !== void 0 ? h("div", { className: "dshg-prCreateResult dshg-permDenied", children: pullError }) : null,
										h("div", { className: "dshg-modalActions", children: [
											h("button", {
												type: "button",
												className: "dshg-op dshg-opPrimary",
												disabled: pullBusy === true || behind.length === 0,
												onClick: submitPull,
												children: pullBusy === true ? "拉取中…" : "拉取"
											}),
											h("button", { type: "button", className: "dshg-op", onClick: () => setPullOpen(false), children: "取消" })
										]})
									]
								}) });
							})() }),
							// Rebase + push: one click, so the dialog must spell out the rewrite,
							// the conflict risk and the forced push before anything happens.
							h(Presence, { show: rebaseOpen === true, children: (() => {
								const upstream = typeof state.sync?.upstream === "string" ? state.sync.upstream : "";
								const ahead = Array.isArray(state.sync?.ahead) ? state.sync.ahead : [];
								const branch = typeof snapshot?.branch === "string" ? snapshot.branch : "";
								const denied = permission !== null && permission !== void 0 && permission.canPush === false;
								return h("div", { className: "dshg-modal", children: h("div", {
									className: "dshg-modalCard dshg-pushCard",
									children: [
										h("div", { className: "dshg-modalTitle", children: "变基推送" }),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "分支" }),
											h("div", { className: "dshg-prSource", children: [
												h("span", { className: "dshg-prSourceName", children: `${branch} → ${upstream}` }),
												h("span", { className: "dshg-prSourceRepo", children: "完成后将以 --force-with-lease 推送" })
											] })
										]}),
										h("div", { className: "dshg-pushSection", children: [
											h("span", { className: "dshg-pushSectionTitle", children: `将被重写的提交（${ahead.length}）` }),
											h(CommitList, { commits: ahead, emptyText: "没有可重放的提交" })
										]}),
										h("div", { className: "dshg-prWarn", children: h("span", { className: "dshg-prWarnText", children: `变基会重写这 ${ahead.length} 个本地提交，过程中可能产生冲突；冲突解决后会继续推送` }) }),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "推送账户" }),
											h("select", {
												className: "dshg-setSelect",
												value: rebaseAccount,
												onChange: (event) => {
													const next = event.target.value;
													setRebaseAccount(next);
													checkPermission(true, next);
												},
												children: (Array.isArray(accounts) && accounts.length > 0 ? accounts : [{ name: "" }]).map((item) => h("option", {
													key: item.name.length > 0 ? item.name : "default",
													value: item.name,
													children: item.name.length > 0 ? item.name : "（默认凭据）"
												}))
											})
										]}),
										checkingPermission === true ? h("div", { className: "dshg-permResult dshg-permUnknown", children: "正在检测推送权限…" }) : null,
										checkingPermission !== true && permission !== null && permission !== void 0 ? h("div", {
											className: `dshg-permResult ${permission.canPush === true ? "dshg-permOk" : permission.canPush === false ? "dshg-permDenied" : "dshg-permUnknown"}`,
											children: permission.canPush === true
												? "此账户拥有推送权限"
												: permission.canPush === false
													? `此账户没有推送权限（${permission.reason.length > 0 ? permission.reason : "denied"}）`
													: `无法确定推送权限（${permission.reason.length > 0 ? permission.reason : "unknown"}）`
										}) : null,
										h("label", { className: "dshg-remoteCheck", children: [
											h("input", { type: "checkbox", checked: rebaseBackup === true, onChange: (event) => setRebaseBackup(event.target.checked) }),
											h("span", { children: "变基前创建备份分支（backup/…）" })
										]}),
										rebaseError !== null && rebaseError !== void 0 ? h("div", { className: "dshg-prCreateResult dshg-permDenied", children: rebaseError }) : null,
										h("div", { className: "dshg-modalActions", children: [
											h("button", {
												type: "button",
												className: "dshg-op dshg-opPrimary",
												disabled: rebaseBusy === true || denied === true || upstream.length === 0 || ahead.length === 0,
												onClick: submitRebase,
												children: rebaseBusy === true ? "处理中…" : "变基推送"
											}),
											h("button", { type: "button", className: "dshg-op", onClick: () => setRebaseOpen(false), children: "取消" })
										]})
									]
								}) });
							})() }),
							// Squash confirmation: show exactly what collapses, let the user name it.
							h(Presence, { show: squashOpen === true, children: (() => {
								const commits = squashSelection();
								return h("div", { className: "dshg-modal", children: h("div", {
									className: "dshg-modalCard dshg-squashCard",
									children: [
										h("div", { className: "dshg-modalTitle", children: "合并相邻提交" }),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "将合并" }),
											h("span", { className: "dshg-pushNote", children: `${commits.length} 个提交压缩为一个，原提交会从历史中移除` })
										]}),
										h(CommitList, { commits, emptyText: "没有选中的提交" }),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "提交标题" }),
											h("input", {
												className: "dshg-setInput",
												value: squashTitle,
												placeholder: "合并后的提交标题",
												onChange: (event) => setSquashTitle(event.target.value)
											})
										]}),
										h("div", { className: "dshg-prCreateField", children: [
											h("span", { className: "dshg-prCreateLabel", children: "正文" }),
											h("textarea", {
												className: "dshg-setInput dshg-squashBody",
												value: squashBody,
												rows: 3,
												placeholder: "补充正文（可选）",
												onChange: (event) => setSquashBody(event.target.value)
											})
										]}),
										h("div", { className: "dshg-modalActions", children: [
											h("button", {
												type: "button",
												className: "dshg-op dshg-opPrimary",
												disabled: squashTitle.trim().length === 0 || commits.length < 2,
												onClick: runSquash,
												children: "合并"
											}),
											h("button", { type: "button", className: "dshg-op", onClick: () => setSquashOpen(false), children: "取消" })
										]})
									]
								}) });
							})() }),
							h(ConfirmModal, {
								dialog: confirmDialog,
								onClose: () => setConfirmDialog(null)
							}),
							recycleOpen === true ? h(RecycleBin, {
								cwd,
								dirty: snapshot?.clean === false,
								orphans: state.orphans,
								loading: state.orphansLoading,
								error: state.orphansError,
								onClose: () => setRecycleOpen(false),
								onRefresh: () => git.refreshOrphans(cwd),
								onRestore: (hash) => { setRecycleOpen(false); setModal({ kind: "recoverCommit", hash }); },
								onView: (hash) => { setRecycleOpen(false); setDetailHash(hash); setPreviewPath(null); setConflictPath(null); git.refreshDetail(cwd, hash); },
								onCheckout: (hash) => { setRecycleOpen(false); setModal({ kind: "checkout", hash }); },
								onHover: chatHover
							}) : null,
							stashOpen === true ? h(StashModal, {
								entries: stashEntries,
								loading: stashLoading,
								error: stashError,
								busy: state.working,
								preview: stashPreview,
								previewLoading: stashPreviewLoading,
								onClose: () => { setStashOpen(false); setStashPreview(null); },
								onRefresh: () => loadStash(),
								onTake: (ref) => setModal({ kind: "stashPop", ref }),
								onApply: (ref) => setModal({ kind: "stashApply", ref }),
								onDrop: (ref) => setModal({ kind: "stashDrop", ref }),
								onBranch: (ref) => setModal({ kind: "stashBranch", ref }),
								onHover: chatHover,
								translate,
								onView: (hash) => {
									// Close the modal, open that stash commit's detail on the timeline.
									setStashOpen(false);
									setStashPreview(null);
									setExpandedHash(hash);
									setDetailHash(hash);
									setFilePath(null);
									git.refreshDetail(cwd, hash);
									window.setTimeout(() => {
										const main = mainRef.current;
										const row = main !== null ? main.querySelector(`[data-commit="${hash}"]`) : null;
										if (row !== null) row.scrollIntoView({ block: "center", behavior: "smooth" });
									}, 30);
								},
								onLocate: (hash) => {
									// Jump to the stash commit on the timeline.
									setStashOpen(false);
									setStashPreview(null);
									setExpandedHash(hash);
									setDetailHash(null);
									window.setTimeout(() => {
										const main = mainRef.current;
										const row = main !== null ? main.querySelector(`[data-commit="${hash}"]`) : null;
										if (row !== null) row.scrollIntoView({ block: "center", behavior: "smooth" });
									}, 30);
								},
								onPreview: async (ref) => {
									setStashPreviewLoading(true);
									try {
										const value = await git.stash("show", { ref });
										setStashPreview({ ref, patch: value?.patch ?? "" });
									} catch (error) {
										setStashPreview({ ref, patch: `读取失败：${error instanceof Error ? error.message : String(error)}` });
									} finally {
										setStashPreviewLoading(false);
									}
								},
								onClear: () => setModal({ kind: "stashClear" })
							}) : null,
							repoSettingsOpen === true ? h(Safeguard, {
								fallback: (error) => h("div", {
									className: "dshg-modal",
									children: h("div", {
										className: "dshg-modalCard",
										children: h("div", { className: "dshg-error", children: `仓库设置渲染出错：${error?.message ?? String(error)}` })
									})
								}),
								children: h(RepoConfigModal, {
								cwd,
								config: repoConfig,
								error: repoConfigError,
								// The locally loaded GCM account list (state.githubAccounts is only
								// used by the separate settings page).
								accounts,
								settings: state.settings,
								busy: state.working,
								remoteUrl: state.remoteInfo?.url,
								translate,
								onClose: () => setRepoSettingsOpen(false),
								onOpenRemote: () => { setRepoSettingsOpen(false); setRemoteManagerOpen(true); loadRemoteAccounts(); },
								onOpenPath: (file) => callRemote(ctxRef, "openPath", { path: cwd, file }).then((result) => {
									setStore({ opMessage: { type: "ok", text: result?.message ?? "已用默认程序打开" } });
									return result;
								}).catch((error) => {
									const message = error instanceof Error ? error.message : String(error);
									setStore({ opMessage: { type: "error", text: `打开失败：${message}` } });
									return null;
								}),
								onSave: (patch) => {
									// Optimistic UI, but the write result is handed back so the dialog can
									// show exactly why a write was rejected. Notices ride the panel-wide
									// opMessage store (this scope has no local notice setter).
									setRepoConfig((previous) => ({ ...(previous ?? { ok: true }), ...patch }));
									return callRemote(ctxRef, "repoConfigWrite", { path: cwd, ...patch }).then(() => {
										setStore({ opMessage: { type: "ok", text: "仓库配置已保存" } });
										return { ok: true };
									}).catch((error) => {
										const message = error instanceof Error ? error.message : String(error);
										setStore({ opMessage: { type: "error", text: `保存失败：${message}` } });
										// Restore the real values, the optimistic merge was not persisted.
										callRemote(ctxRef, "repoConfig", { path: cwd }).then((fresh) => {
											if (fresh?.ok === true) setRepoConfig(fresh);
										}).catch(() => void 0);
										return { ok: false, error: message };
									});
								},
								ignore: ignoreState,
								ignoreCheck: ignoreCheckResult,
								ignoreFiles: ignoreFilesState,
								onRefreshIgnoreFiles: () => callRemote(ctxRef, "gitignoreFiles", { path: cwd }).then((result) => {
									if (result?.ok === true) setIgnoreFilesState({ files: result.files ?? [], truncated: result.truncated === true });
									return result;
								}).catch(() => ({ ok: false })),
								onSaveIgnore: (content) => callRemote(ctxRef, "gitignoreWrite", { path: cwd, content }).then((result) => {
									if (result?.ok !== false) {
										setIgnoreState({ exists: true, content });
										setStore({ opMessage: { type: "ok", text: "已保存 .gitignore" } });
									}
									return result;
								}).catch((error) => {
									const message = error instanceof Error ? error.message : String(error);
									setStore({ opMessage: { type: "error", text: `保存 .gitignore 失败：${message}` } });
									return { ok: false, error: message };
								}),
								onRestoreIgnore: () => callRemote(ctxRef, "gitignoreRestore", { path: cwd }).then((result) => {
									if (result?.ok === true && typeof result.content === "string") {
										setIgnoreState({ exists: true, content: result.content });
									}
									return result;
								}).catch(() => ({ ok: false })),
								onCheckIgnore: (target) => callRemote(ctxRef, "gitignoreCheck", { path: cwd, target }).then((result) => {
									setIgnoreCheckResult(result ?? null);
									return result;
								}).catch((error) => {
									const message = error instanceof Error ? error.message : String(error);
									setIgnoreCheckResult({ ok: false, error: message });
									return null;
								})
							}) }) : null
						]
					})
				]
			});
		}

		/** Reusable confirm/modal for every git action. */
		function ActionModal({ modal, anchor, t, onClose, doAction, commitMsg, setCommitMsg, commitBody, setCommitBody, stashIncludeUnstaged, setStashIncludeUnstaged, renameRemote, setRenameRemote, accountUser, renameAccount, setRenameAccount, permission, checkingPermission, checkRenamePermission, dirty, mergeTarget, setMergeTarget, newBranchName, setNewBranchName, switchTarget, setSwitchTarget, linkUrl, setLinkUrl, currentBranch, files, unstagedFiles, branches, loadExclusive, previewMerge }) {
			const [mergeMode, setMergeMode] = (0, react.useState)("no-ff");
			const [renameName, setRenameName] = (0, react.useState)("");
			const [recoverName, setRecoverName] = (0, react.useState)("");
			const [exclusive, setExclusive] = (0, react.useState)(null);
			const [exclusiveLoading, setExclusiveLoading] = (0, react.useState)(false);
			const [hardConfirm, setHardConfirm] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (modal.kind !== "deleteBranch" || modal.current === true) return void 0;
				let alive = true;
				setExclusive(null);
				setExclusiveLoading(true);
				Promise.resolve(typeof loadExclusive === "function" ? loadExclusive(modal.name) : null)
					.then((out) => {
						if (alive === false) return;
						setExclusive(Array.isArray(out?.commits) ? out.commits : []);
						setExclusiveLoading(false);
					})
					.catch(() => { if (alive === true) setExclusiveLoading(false); });
				return () => { alive = false; };
			}, [modal.kind, modal.name, loadExclusive]);
			// Merge pre-flight: ff-only availability and would-be conflicts.
			const [mergePreview, setMergePreview] = (0, react.useState)(null);
			const [mergePreviewError, setMergePreviewError] = (0, react.useState)("");
			const [stashMessage, setStashMessage] = (0, react.useState)("");
			const [stashIndex, setStashIndex] = (0, react.useState)(true);
			// Branch creation: validate inside the dialog (a duplicate name must not
			// close it, git would only fail after the fact with an English error).
			const [branchNameError, setBranchNameError] = (0, react.useState)("");
			const checkBranchName = (value) => {
				const name = String(value ?? "").trim();
				if (name.length === 0) return "";
				if (/[\s~^:?*[\\]/.test(name) || name.startsWith("-")) return "分支名不能含空格或 git 保留字符，且不能以 - 开头";
				if (Array.isArray(branches) && branches.includes(name)) return `已存在同名分支「${name}」`;
				return "";
			};
			(0, react.useEffect)(() => {
				if (modal.kind !== "merge") return void 0;
				if (typeof previewMerge !== "function") {
					setMergePreview(null);
					setMergePreviewError("预览方法不可用");
					return void 0;
				}
				const source = typeof modal.source === "string" ? modal.source : "";
				const targets = branches.filter((name) => name !== source);
				const target = mergeTarget.trim().length > 0 ? mergeTarget.trim() : (targets.includes(currentBranch) ? currentBranch : targets[0] ?? "");
				if (source.length === 0 || target.length === 0) {
					setMergePreview(null);
					setMergePreviewError("缺少分支名");
					return void 0;
				}
				let alive = true;
				// Switching target/source must clear the previous verdict immediately:
				// the hint shows "预检中…" until the new result arrives.
				setMergePreview(null);
				setMergePreviewError("");
				previewMerge(target, source).then((value) => {
					if (alive === false) return;
					if (value?.ok === true) {
						setMergePreview(value);
						setMergePreviewError("");
					} else {
						setMergePreview(null);
						setMergePreviewError(String(value?.error ?? "预检返回失败"));
					}
					// Diverged branches cannot fast-forward: fall back to a real merge.
					if (value?.ok === true && value.ffOnly === false && mergeMode === "ff-only") setMergeMode("no-ff");
				}).catch((error) => {
					if (alive === true) {
						setMergePreview(null);
						setMergePreviewError(error instanceof Error ? error.message : String(error));
					}
				});
				return () => { alive = false; };
			}, [modal.kind, modal.source, mergeTarget, currentBranch, branches.length]);
			const kind = modal.kind;
			const cancel = () => onClose();
			const inputCls = "dshg-input";
			const localBranches = branches.length ? branches.filter((name) => !/^remotes\//.test(name)) : branches;
			let title = "";
			let body = null;
			let confirmLabel = "";
			let danger = false;
			let onOk = () => {};
			if (kind === "init") {
				title = "初始化 git 仓库";
				body = h("div", { className: "dshg-modalDesc", children: "在当前工作区执行 git init。之后就能开始存档和回档了。" });
				confirmLabel = "初始化仓库";
				onOk = () => doAction("init", {});
			} else if (kind === "linkRemote") {
				const allowCreate = modal.allowCreate === true;
				title = "关联远程仓库";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: "输入远程仓库地址（https 或 ssh），关联后即可推送与拉取：" }),
						h("input", {
							className: inputCls,
							value: linkUrl,
							placeholder: "https://github.com/owner/repo.git",
							onChange: (event) => setLinkUrl(event.target.value),
							autoFocus: true
						}),
						allowCreate ? h("div", {
							className: "dshg-modalDesc",
							children: "（设置里已允许插件创建仓库；本版先支持关联已有仓库。）"
						}) : null
					]
				});
				confirmLabel = "关联";
				onOk = () => doAction("addRemote", { url: linkUrl.trim() });
			} else if (kind === "createBranch") {
				title = "新建分支";
				const nameProblem = checkBranchName(newBranchName);
				const shownProblem = branchNameError !== "" ? branchNameError : nameProblem;
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: "从当前 HEAD 创建一个新分支：" }),
						h("input", {
							className: inputCls,
							value: newBranchName,
							placeholder: "输入新分支名",
							onChange: (event) => { setBranchNameError(""); setNewBranchName(event.target.value); },
							autoFocus: true
						}),
						shownProblem !== ""
							? h("div", { className: `dshg-modalDesc ${branchNameError !== "" ? "dshg-modalWarn" : "dshg-modalHint"}`, children: shownProblem })
							: null
					]
				});
				confirmLabel = "新建分支";
				// Reject inside the dialog: a duplicate never reaches git and the window stays open.
				onOk = () => {
					const problem = checkBranchName(newBranchName);
					if (problem !== "") { setBranchNameError(problem); return; }
					doAction("createBranch", { name: newBranchName.trim() });
				};
			} else if (kind === "switch") {
				title = "切换分支";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: "选择要切换到的本地分支（切换后工作区将更新为该分支内容）：" }),
						h("select", {
							className: inputCls,
							value: switchTarget,
							onChange: (event) => setSwitchTarget(event.target.value),
							children: [
								h("option", { key: "", value: "", disabled: true, children: "选择分支" }),
								localBranches.map((name) => h("option", { value: name, children: name === currentBranch ? `${name}（当前）` : name }, name))
							]
						})
					]
				});
				confirmLabel = "切换分支";
				onOk = () => doAction("checkout", { target: switchTarget.trim() });
			} else if (kind === "commit") {
				const picked = Array.isArray(modal.paths) ? modal.paths : [];
				const unstagedList = Array.isArray(unstagedFiles) ? unstagedFiles : [];
				title = picked.length > 0 ? "选中提交" : "提交存档";
				body = hs(react.Fragment, {
					children: [
						h("div", {
							className: "dshg-modalDesc",
							children: picked.length > 0
								? `提交选中的 ${picked.length} 个文件（未暂存的会自动暂存后一起提交）：`
								: "仅提交已暂存的文件；未暂存改动不会被提交："
						}),
						picked.length === 0 && unstagedList.length > 0 ? h("div", {
							className: "dshg-modalDesc dshg-modalWarn",
							children: `注意：还有 ${unstagedList.length} 个文件未暂存，本次提交不会包含它们${unstagedList.length > 0 ? `（${unstagedList.slice(0, 4).join("、")}${unstagedList.length > 4 ? " 等" : ""}）` : ""}。`
						}) : null,
						h("input", {
							className: inputCls,
							value: commitMsg,
							placeholder: "输入提交说明（必填）",
							onChange: (event) => setCommitMsg(event.target.value),
							autoFocus: true
						}),
						h("textarea", {
							className: `${inputCls} dshg-modalTextarea`,
							value: commitBody,
							placeholder: "补充正文（可选）",
							rows: 3,
							onChange: (event) => setCommitBody(event.target.value)
						}),
						(picked.length > 0 ? picked : files).length > 0
							? h("div", {
								className: "dshg-modalList",
								children: (picked.length > 0 ? picked : files).slice(0, 40).map((path, index) => h("span", { key: index, children: path }))
							})
							: h("div", { className: "dshg-modalDesc", children: "没有可提交的文件" })
					]
				});
				confirmLabel = picked.length > 0 ? "选中提交" : "提交存档";
				// Title + optional body: `-m` gets one message with a blank line between.
				const fullMessage = commitBody.trim().length > 0 ? `${commitMsg.trim()}\n\n${commitBody.trim()}` : commitMsg.trim();
				onOk = () => doAction("commit", picked.length > 0
					? { message: fullMessage, paths: picked }
					: { message: fullMessage, stagedOnly: true });
			} else if (kind === "merge") {
				const source = typeof modal.source === "string" && modal.source.length > 0 ? modal.source : null;
				const targets = branches.filter((name) => name !== source);
				const target = mergeTarget.trim().length > 0 ? mergeTarget.trim() : (targets.includes(currentBranch) ? currentBranch : targets[0] ?? "");
				const ffBlocked = mergePreview !== null && mergePreview.ok === true && mergePreview.ffOnly === false;
				const conflictCount = mergePreview !== null && mergePreview.ok === true && Array.isArray(mergePreview.conflicts) ? mergePreview.conflicts.length : 0;
				const previewHint = mergePreviewError !== ""
					? `预检失败：${mergePreviewError}（仍可直接合并）`
					: mergePreview === null
						? "预检中…"
						: conflictCount > 0
							? `有 ${conflictCount} 个文件会冲突（${mergePreview.conflicts.slice(0, 4).join("、")}${conflictCount > 4 ? " 等" : ""}），继续后会进入冲突处理流程。`
							: ffBlocked
								? "两边已经分叉，快速合并不可用。"
								: "";
				title = source === null ? "合并分支" : `合并 ${source}`;
				body = hs(react.Fragment, {
					children: [
						h("div", {
							className: "dshg-mergeModes",
							children: [
								["ff-only", "快速", "只快进"],
								["no-ff", "三方", "生成合并提交"],
								["squash", "摘取", "压成一个提交"]
							].map(([value, label, desc]) => {
								const pendingPreview = value === "ff-only" && mergePreview === null && mergePreviewError === "";
								const blocked = value === "ff-only" && (ffBlocked || pendingPreview);
								return h("button", {
									key: value,
									type: "button",
									className: `dshg-mergeMode${mergeMode === value ? " dshg-mergeModeOn" : ""}`,
									disabled: blocked,
									title: pendingPreview ? "正在预检，稍等" : blocked ? "两边已经分叉，无法快进；请用三方或摘取" : void 0,
									onClick: () => setMergeMode(value),
									children: [
										h("span", { className: "dshg-mergeModeLabel", children: label }),
										h("span", { className: "dshg-mergeModeDesc", children: pendingPreview ? "预检中…" : blocked ? "已分叉，不可用" : desc })
									]
								});
							})
						}),
						h("div", { className: "dshg-modalDesc", children: "选择要把这个分支合并进的目标分支：" }),
						h("select", {
							className: inputCls,
							value: target,
							onChange: (event) => setMergeTarget(event.target.value),
							children: targets.map((name) => h("option", { value: name, children: name === currentBranch ? `${name}（当前）` : name }, name))
						}),
						previewHint !== "" ? h("div", {
							className: `dshg-modalDesc${conflictCount > 0 || ffBlocked ? " dshg-modalWarn" : ""}`,
							children: previewHint
						}) : null
					]
				});
				confirmLabel = "合并";
				onOk = () => doAction("merge", { source, target, mode: mergeMode });
			} else if (kind === "stashPush") {
				const paths = Array.isArray(modal.paths) ? modal.paths : null;
				const count = paths === null ? Number(modal.count) || 0 : paths.length;
				title = paths === null ? "全部入栈" : "选中入栈";
				body = hs(react.Fragment, {
					children: [
						h("div", {
							className: "dshg-modalDesc",
							children: paths === null
								? stashIncludeUnstaged === true
									? `把当前 ${count} 处改动收进 stash（包含未暂存的改动）。`
									: `只把暂存区里的 ${count} 处改动收进 stash；未暂存和未跟踪文件不会入栈。`
								: `把选中的 ${count} 个文件收进 stash（即使没有暂存也会一起入栈）。`
						}),
						paths === null ? h("label", {
							className: "dshg-stashCheck",
							children: [
								h("input", {
									type: "checkbox",
									checked: stashIncludeUnstaged,
									onChange: (event) => setStashIncludeUnstaged(event.target.checked)
								}),
								"包含未暂存的内容"
							]
						}) : null,
						h("input", {
							className: inputCls,
							value: stashMessage,
							placeholder: "入栈说明（可选）",
							onChange: (event) => setStashMessage(event.target.value)
						}),
						h("div", { className: "dshg-modalHint", children: "入栈后这些改动会从工作区移除，可以从 stash 面板恢复。" })
					]
				});
				confirmLabel = "入栈";
				onOk = () => doAction("stash", { action: "push", message: stashMessage, paths: paths ?? void 0, staged: paths === null && stashIncludeUnstaged !== true });
			} else if (kind === "stashBranch") {
				const ref = typeof modal.ref === "string" ? modal.ref : "stash@{0}";
				title = "从 stash 创建分支";
				const nameProblem = checkBranchName(newBranchName);
				const shownProblem = branchNameError !== "" ? branchNameError : nameProblem;
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: `从 ${ref} 创建新分支，并把其中的改动恢复过去。` }),
						h("input", {
							className: inputCls,
							value: newBranchName,
							placeholder: "新分支名",
							onChange: (event) => { setBranchNameError(""); setNewBranchName(event.target.value); }
						}),
						shownProblem !== ""
							? h("div", { className: `dshg-modalDesc ${branchNameError !== "" ? "dshg-modalWarn" : "dshg-modalHint"}`, children: shownProblem })
							: null
					]
				});
				confirmLabel = "创建";
				onOk = () => {
					const problem = checkBranchName(newBranchName);
					if (problem !== "") { setBranchNameError(problem); return; }
					doAction("stash", { action: "branch", ref, branch: newBranchName.trim() });
				};
			} else if (kind === "stashPop" || kind === "stashApply") {
				const isTake = kind === "stashPop";
				const ref = typeof modal.ref === "string" ? modal.ref : "stash@{0}";
				title = isTake ? "取出 stash" : "应用 stash";
				body = hs(react.Fragment, {
					children: [
						h("div", {
							className: "dshg-modalDesc",
							children: isTake
								? `把 ${ref} 的改动恢复到工作区，并从 stash 栈里删除该条目。`
								: `把 ${ref} 的改动恢复到工作区，stash 条目会保留。`
						}),
						h("label", {
							className: "dshg-stashCheck",
							children: [
								h("input", {
									type: "checkbox",
									checked: stashIndex,
									onChange: (event) => setStashIndex(event.target.checked)
								}),
								"恢复暂存区状态（--index）"
							]
						}),
						h("div", { className: "dshg-modalHint", children: "取消勾选时，暂存内容会回到工作区（不保持暂存状态）。" }),
						// git refuses to overlay a stash on top of uncommitted work; say so in
						// the dialog instead of letting the raw English error surface.
						dirty === true
							? h("div", { className: "dshg-modalDesc dshg-modalWarn", children: `存在未提交的改动，无法${isTake ? "取出" : "应用"}：先提交或暂存当前改动，再${isTake ? "取出" : "应用"}这条 stash。` })
							: null
					]
				});
				confirmLabel = isTake ? "取出" : "应用";
				onOk = () => {
					// Warning already explains why; keep the dialog open, touch nothing.
					if (dirty === true) return;
					doAction("stash", { action: isTake ? "pop" : "apply", ref, index: stashIndex });
				};
			} else if (kind === "stashDrop") {
				const ref = typeof modal.ref === "string" ? modal.ref : "stash@{0}";
				title = "删除 stash？";
				body = h("div", { className: "dshg-modalDesc dshg-modalWarn", children: `会从栈里删除 ${ref}，且不可恢复（除非 reflog 里还能找回）。` });
				danger = true;
				confirmLabel = "我知道我在做什么";
				onOk = () => doAction("stash", { action: "drop", ref });
			} else if (kind === "stashClear") {
				title = "清空所有 stash？";
				body = h("div", { className: "dshg-modalDesc dshg-modalWarn", children: "会删除全部 stash 条目，且不可恢复（除非 reflog 里还能找回）。" });
				danger = true;
				confirmLabel = "清空";
				onOk = () => doAction("stash", { action: "clear" });
			} else if (kind === "deleteBranch") {
				const name = String(modal.name ?? "");
				const isCurrent = modal.current === true;
				const merged = modal.merged === true;
				const list = Array.isArray(exclusive) ? exclusive : [];
				if (hardConfirm === true) {
					// Second confirmation for the force delete: show the exact orphan count.
					title = `彻底删除 ${name}？`;
					body = hs(react.Fragment, {
						children: [
							h("div", {
								className: "dshg-modalDesc dshg-modalWarn",
								children: exclusiveLoading === true
									? "正在统计会游离的提交…"
									: `将产生 ${list.length} 个游离提交。它们会从所有分支和时间线上消失，但仍可在「更多 → 回收站」里找回。`
							}),
							exclusiveLoading === true ? h("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "统计中…"] }) : null,
							h("div", { className: "dshg-modalHint", children: "确定要彻底删除吗？" })
						]
					});
					confirmLabel = "确认彻底删除";
					danger = true;
					onOk = () => doAction("deleteBranch", { name, force: true });
				} else {
					title = `删除分支 ${name}`;
					body = hs(react.Fragment, {
						children: [
							isCurrent
								? h("div", { className: "dshg-modalDesc dshg-modalWarn", children: "这是当前分支。先切换到其他分支再删除。" })
								: merged
									? h("div", { className: "dshg-modalDesc", children: "这个分支的提交都已经并进当前分支，删除不会丢提交。" })
									: hs(react.Fragment, {
										children: [
											h("div", { className: "dshg-modalDesc dshg-modalWarn", children: "这个分支有提交只在这里，安全删除会被 git 拒绝。彻底删除后它们会变成游离提交：" }),
											exclusiveLoading === true ? h("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "统计游离提交…"] }) : null,
											list.length > 0 ? h("div", {
												className: "dshg-modalList",
												children: list.slice(0, 6).map((commit) => h("span", { key: commit.hash, children: `${commit.short} ${commit.subject}` }))
											}) : null,
											h("div", { className: "dshg-modalHint", children: "删除后仍可在「更多 → 回收站」里找回（reflog 保留期内）。" })
										]
									})
						]
					});
					confirmLabel = isCurrent ? "无法删除" : "安全删除";
					danger = false;
					onOk = isCurrent ? () => {} : () => doAction("deleteBranch", { name });
				}
			} else if (kind === "renameBranch") {
				title = `重命名分支 ${modal.from}`;
				const upstreamName = typeof modal.upstream === "string" ? modal.upstream : "";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: "输入新的分支名：" }),
						h("input", {
							className: inputCls,
							value: renameName,
							placeholder: "新分支名",
							onChange: (event) => setRenameName(event.target.value),
							autoFocus: true
						}),
						upstreamName !== "" ? h("label", {
							className: "dshg-stashCheck",
							children: [
								h("input", {
									type: "checkbox",
									checked: renameRemote,
									onChange: (event) => setRenameRemote(event.target.checked)
								}),
								`同时重命名远程分支（${upstreamName}）`
							]
						}) : null,
						upstreamName !== "" && renameRemote === true ? h(react.Fragment, { children: [
							// Show WHO will push (current account + avatar); no account switching
							// here — the panel's active account owns remote operations.
							h("div", { className: "dshg-remoteCheck", children: [
								h("span", { children: "操作用户：" }),
								accountUser !== null && accountUser !== void 0 && String(accountUser.avatarUrl ?? "").length > 0
									? h("img", { className: "dshg-remoteAvatar", src: accountUser.avatarUrl, alt: "" })
									: h("span", { className: "dshg-remoteAvatar dshg-remoteAvatarFallback", children: "?" }),
								h("span", { children: accountUser !== null && accountUser !== void 0 && String(accountUser.login ?? "").length > 0 ? accountUser.login : (renameAccount.length > 0 ? renameAccount : "默认账户") })
							]}),
							checkingPermission === true
								? h("div", { className: "dshg-permResult dshg-permUnknown", children: "正在检测推送权限…" })
								: permission !== null && permission !== void 0
									? h("div", {
										className: `dshg-permResult ${permission.canPush === true ? "dshg-permOk" : permission.canPush === false ? "dshg-permDenied" : "dshg-permUnknown"}`,
										children: permission.canPush === true
											? "此账户拥有推送权限"
											: permission.canPush === false
												? `此账户没有推送权限（${permission.reason.length > 0 ? permission.reason : "denied"}）`
												: `无法确定推送权限（${permission.reason.length > 0 ? permission.reason : "unknown"}）`
									}) : null,
							h("div", { className: "dshg-modalHint", children: "会在远程创建同名新分支并删除旧分支，然后重新关联上游。" })
						] }) : null
					]
				});
				confirmLabel = "重命名";
				onOk = () => doAction("renameBranch", { from: modal.from, to: renameName.trim(), renameRemote: upstreamName !== "" && renameRemote === true, account: renameAccount });
			} else if (kind === "abortOperation") {
				const label = modal.kindName === "squash" ? "摘取合并" : modal.kindName === "revert" ? "还原" : modal.kindName === "rebase" ? "变基" : "合并";
				title = "中止进行中的操作";
				body = h("div", { className: "dshg-modalDesc dshg-modalWarn", children: `中止这次${label}？已解决的进度和你手动改过的冲突文件内容都会被还原。` });
				confirmLabel = "中止";
				danger = true;
				onOk = () => doAction("operationAbort", { kind: modal.kindName });
			} else if (kind === "recoverCommit") {
				title = "恢复为分支";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: `从这个提交（${String(modal.hash).slice(0, 8)}）新建一个分支：` }),
						h("input", {
							className: inputCls,
							value: recoverName,
							placeholder: "新分支名",
							onChange: (event) => setRecoverName(event.target.value),
							autoFocus: true
						})
					]
				});
				confirmLabel = "创建分支";
				onOk = () => doAction("createBranch", { name: recoverName.trim(), from: modal.hash });
			} else if (kind === "checkout") {
				title = "检出提交";
				body = h("div", { className: "dshg-modalDesc", children: `工作区将切换到 ${String(modal.hash).slice(0, 8)}。未提交改动若冲突会被 git 阻止，不会丢失。` });
				confirmLabel = "检出提交";
				onOk = () => doAction("checkout", { target: modal.hash });
			} else if (kind === "revert") {
				title = "还原提交";
				body = h("div", { className: "dshg-modalDesc", children: `为 ${String(modal.hash).slice(0, 8)} 生成一个反向提交，撤销那次改动但保留完整历史（推荐的安全做法）。` });
				confirmLabel = "还原提交";
				onOk = () => doAction("revert", { commit: modal.hash });
			} else if (kind === "reset") {
				title = "强制回退";
				body = h("div", { className: "dshg-modalDesc", children: `危险操作：把分支指针直接强制移到 ${String(modal.hash).slice(0, 8)}，之后的提交与改动都会消失（仅限本地未推送时）。确定继续？` });
				confirmLabel = "强制回退";
				danger = true;
				onOk = () => doAction("reset", { commit: modal.hash });
			} else if (kind === "restore") {
				const picked = Array.isArray(modal.paths) ? modal.paths : [];
				title = picked.length > 0 ? `回退选中的 ${picked.length} 个文件` : "回退所有修改";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc dshg-modalWarn", children: "危险操作：将丢弃这些文件未提交的改动（无法恢复）。确定继续？" }),
						picked.length > 0 ? h("div", {
							className: "dshg-modalList",
							children: picked.slice(0, 40).map((path, index) => h("span", { key: index, children: path }))
						}) : null
					]
				});
				confirmLabel = "回退";
				danger = true;
				onOk = () => doAction("restore", { paths: picked });
			}
			return hs("div", {
				// `dshg-modalTop`: the action dialog must sit above other panel overlays
				// (the stash manager renders after it with the same z-index and would
				// otherwise cover the confirm buttons).
				className: `dshg-modal dshg-modalTop${anchor === "screen" ? " dshg-modalScreen" : ""}`,
				children: hs("div", {
					className: "dshg-modalCard",
					children: [
						h("div", { className: "dshg-modalTitle", children: title }),
						body,
						hs("div", {
							className: "dshg-modalActions",
							children: kind === "deleteBranch"
								? (hardConfirm === true
									? [
										h("button", { key: "back", type: "button", className: "dshg-op", onClick: () => setHardConfirm(false), children: "返回" }),
										h("button", {
											key: "confirm",
											type: "button",
											className: "dshg-op dshg-opDanger",
											disabled: exclusiveLoading === true,
											onClick: () => doAction("deleteBranch", { name: modal.name, force: true }),
											children: exclusiveLoading === true ? "统计中…" : "确认彻底删除"
										})
									]
									: [
										h("button", { key: "cancel", type: "button", className: "dshg-op", onClick: cancel, children: "取消" }),
										h("button", {
											key: "soft",
											type: "button",
											className: "dshg-op",
											disabled: modal.current === true,
											title: "只删除已经合并进当前分支的分支；未合并会被 git 拒绝",
											onClick: () => doAction("deleteBranch", { name: modal.name, force: false }),
											children: "安全删除"
										}),
										h("button", {
											key: "hard",
											type: "button",
											className: "dshg-op dshg-opDanger",
											disabled: modal.current === true,
											title: "强制删除；只在这个分支上的提交会变成游离提交",
											onClick: () => setHardConfirm(true),
											children: "彻底删除"
										})
									])
								: [
									h("button", { key: "cancel", type: "button", className: "dshg-op", onClick: cancel, children: "取消" }),
									h("button", {
										key: "ok",
										type: "button",
										className: `dshg-op${danger ? " dshg-opDanger" : " dshg-opPrimary"}`,
										onClick: onOk,
										children: confirmLabel
									})
								]
						})
					]
				})
			});
		}
		//#endregion

		//#region locales
		const zh = {
			"action.aria": "Git 面板",
			"action.title": "Git 可视化面板",
			"action.refresh": "刷新",
			"action.close": "关闭",
			"action.branch.unknown": "git",
			"panel.aria": "Git 可视化面板",
			"panel.title": "Git 面板",
			"state.clean": "干净",
			"state.changes": "处改动",
			"state.staged": "已暂存",
			"state.unstaged": "未暂存",
			"state.untracked": "未跟踪",
			"state.loading": "读取 git 状态…",
			"state.notRepo": "当前工作区不是 git 仓库：{path}",
			"state.noCommits": "仓库还没有提交",
			"state.noFiles": "此提交没有文件变更",
			"state.merge": "合并",
			"state.truncated": "（补丁过大已截断）",
			"state.notRepoTitle": "这里还不是 git 仓库",
			"state.notRepoDesc": "在当前工作区运行 git init 初始化后，就能在这里看到分支、提交历史和改动记录了",
			"state.selectHint": "点击上方时间线中的提交，这里会显示它改动了哪些文件",
			"state.root": "（根目录）",
			"state.noChanges": "没有待提交的改动",
			"action.cancel": "取消",
			"op.init": "初始化仓库",
			"op.commit": "提交存档",
			"op.merge": "合并分支",
			"op.restore": "丢弃改动",
			"op.checkoutHere": "检出提交",
			"op.revert": "还原提交",
			"op.reset": "强制回退",
			"op.createBranch": "新建分支",
			"op.switch": "切换分支",
			"modal.createBranch.title": "新建分支",
			"modal.createBranch.desc": "从当前 HEAD 创建一个新分支：",
			"modal.createBranch.placeholder": "输入新分支名",
			"modal.switch.title": "切换分支",
			"modal.switch.desc": "选择要切换到的本地分支（切换后工作区将更新为该分支内容）：",
			"modal.switch.placeholder": "选择分支",
			"modal.init.title": "初始化 git 仓库",
			"modal.init.desc": "在当前工作区执行 git init。之后就能开始存档和回档了。",
			"modal.commit.title": "提交存档",
			"modal.commit.desc": "将暂存全部改动并创建一次提交（包含以下文件）：",
			"modal.commit.placeholder": "输入提交说明（必填）",
			"modal.merge.title": "合并分支",
			"modal.merge.desc": "选择要合并进当前分支的目标分支：",
			"modal.merge.placeholder": "选择目标分支",
			"modal.checkout.title": "检出提交",
			"modal.checkout.desc": "工作区将切换到 {target}。未提交改动若冲突会被 git 阻止，不会丢失。",
			"modal.revert.title": "还原提交",
			"modal.revert.desc": "为 {target} 生成一个反向提交，撤销那次改动但保留完整历史（推荐的安全做法）。",
			"modal.reset.title": "强制回退",
			"modal.reset.desc": "危险操作：把分支指针直接强制移到 {target}，之后的提交与改动都会消失（仅限本地未推送时）。确定继续？",
			"modal.restore.title": "丢弃未提交改动",
			"modal.restore.desc": "危险操作：将丢弃当前所有未提交的改动（无法恢复）。确定继续？",
			"section.status": "工作区状态",
			"section.commits": "提交历史",
			"section.diff": "提交差异",
			"time.now": "刚刚",
			"time.minutes": "{n}分钟前",
			"time.hours": "{n}小时前",
			"time.days": "{n}天前"
		};
		const en = {
			"action.aria": "Git panel",
			"action.title": "Git visualizer",
			"action.refresh": "Refresh",
			"action.close": "Close",
			"action.branch.unknown": "git",
			"panel.aria": "Git visualizer",
			"panel.title": "Git",
			"state.clean": "clean",
			"state.changes": "changes",
			"state.staged": "staged",
			"state.unstaged": "unstaged",
			"state.untracked": "untracked",
			"state.loading": "Reading git state…",
			"state.notRepo": "This workspace is not a git repository: {path}",
			"state.noCommits": "No commits yet",
			"state.noFiles": "No file changes in this commit",
			"state.merge": "merge",
			"state.truncated": "(patch truncated)",
			"state.notRepoTitle": "Not a git repository yet",
			"state.notRepoDesc": "Run git init in this workspace to see branches, history and changes here",
			"state.selectHint": "Select a commit above to see what it changed",
			"state.root": "(root)",
			"state.noChanges": "Nothing to commit",
			"action.cancel": "Cancel",
			"op.init": "Init repo",
			"op.commit": "Commit",
			"op.merge": "Merge",
			"op.restore": "Discard changes",
			"op.checkoutHere": "Checkout commit",
			"op.revert": "Revert",
			"op.reset": "Force reset",
			"op.createBranch": "New branch",
			"op.switch": "Switch branch",
			"modal.createBranch.title": "New branch",
			"modal.createBranch.desc": "Create a branch from the current HEAD:",
			"modal.createBranch.placeholder": "Branch name",
			"modal.switch.title": "Switch branch",
			"modal.switch.desc": "Pick a local branch to switch to (working tree updates to that branch):",
			"modal.switch.placeholder": "Select branch",
			"modal.init.title": "Initialize git repository",
			"modal.init.desc": "Runs git init in this workspace so you can start committing and rolling back.",
			"modal.commit.title": "Commit changes",
			"modal.commit.desc": "Stage all changes and create one commit (includes):",
			"modal.commit.placeholder": "Commit message (required)",
			"modal.merge.title": "Merge branch",
			"modal.merge.desc": "Pick the branch to merge into the current one:",
			"modal.merge.placeholder": "Select target branch",
			"modal.checkout.title": "Checkout this commit",
			"modal.checkout.desc": "Switch the workspace to {target}. Conflicting uncommitted changes are blocked by git, not lost.",
			"modal.revert.title": "Revert this commit",
			"modal.revert.desc": "Create an inverse commit for {target} (keeps history — the safe rollback).",
			"modal.reset.title": "Hard reset",
			"modal.reset.desc": "DANGER: hard-resets HEAD to {target} and discards everything after (local & unpushed only). Continue?",
			"modal.restore.title": "Discard uncommitted changes",
			"modal.restore.desc": "DANGER: discards all current uncommitted changes (not recoverable). Continue?",
			"section.status": "Working tree",
			"section.commits": "History",
			"section.diff": "Commit diff",
			"time.now": "just now",
			"time.minutes": "{n}m ago",
			"time.hours": "{n}h ago",
			"time.days": "{n}d ago"
		};
		//#endregion

		//#region plugin body
		const NS = "git";
		/** One-line shape of an unknown value — diagnostics only. */
		// The outer fiber only needs `remote` (to mount the namespace). Everything
		// else — slots, locale, and `remote.git` itself — is injected by the child
		// `GitUiPlugin` fiber; declaring `remote.git` here would deadlock on the
		// service this same fiber provides.
		const inject = ["remote"];
		// DSH 0.2.1 removed the shared `@deepseek-ai/dsh-client-ui-primitives`
		// package from the browser module table (a client half may no longer load
		// another Harness Client package as a module, so that `require` now
		// throws). The one glyph this entry needs is inlined instead of shipped
		// as an optional dependency.
		/** Four hollow squares: the "more" tool glyph (design doc 4.1). */
		function MoreIcon({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				children: [
					react_jsx_runtime.jsx("rect", { x: 2.2, y: 2.2, width: 4.6, height: 4.6, rx: 1 }),
					react_jsx_runtime.jsx("rect", { x: 9.2, y: 2.2, width: 4.6, height: 4.6, rx: 1 }),
					react_jsx_runtime.jsx("rect", { x: 2.2, y: 9.2, width: 4.6, height: 4.6, rx: 1 }),
					react_jsx_runtime.jsx("rect", { x: 9.2, y: 9.2, width: 4.6, height: 4.6, rx: 1 })
				]
			});
		}

		/** Trash can glyph (recycle bin action). */
		function TrashIcon({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					react_jsx_runtime.jsx("path", { d: "M3 4.5h10" }),
					react_jsx_runtime.jsx("path", { d: "M6 4.5V3.2h4v1.3" }),
					react_jsx_runtime.jsx("path", { d: "M4.4 4.5l.6 8.2h6l.6-8.2" }),
					react_jsx_runtime.jsx("path", { d: "M6.8 7v3.6M9.2 7v3.6" })
				]
			});
		}

		/** Stash glyph (arrow into a tray). */
		function StashIcon({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					react_jsx_runtime.jsx("path", { d: "M8 2.5v6" }),
					react_jsx_runtime.jsx("path", { d: "M5.5 6L8 8.5 10.5 6" }),
					react_jsx_runtime.jsx("path", { d: "M3 10.5v2h10v-2" })
				]
			});
		}

		/** Pencil glyph for the rename button. */
		function PencilIcon({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					react_jsx_runtime.jsx("path", { d: "M11.2 2.8l2 2L6 12l-3 1 1-3 7.2-7.2z" }),
					react_jsx_runtime.jsx("path", { d: "M9.8 4.2l2 2" })
				]
			});
		}

		/**
		 * GitHub mark (filled). Used to mark branches that are linked to a
		 * GitHub remote; kept inline because the client half cannot require
		 * another Harness Client package for icons.
		 */
		function GithubIcon({ size }) {
			return react_jsx_runtime.jsx("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				"aria-hidden": "true",
				fill: "currentColor",
				children: react_jsx_runtime.jsx("path", {
					d: "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
				})
			});
		}

		/** Small up/down arrow used for the sync delta (counts, not line diffs). */
		function SyncArrow({ direction, size }) {
			return react_jsx_runtime.jsx("svg", {
				width: size,
				height: size,
				viewBox: "0 0 12 12",
				// Squash horizontally when the box is narrower than it is tall (the
				// action bar uses 3x9); at square sizes this is a no-op.
				preserveAspectRatio: "none",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.7,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: react_jsx_runtime.jsx("path", {
					d: direction === "up" ? "M6 10.2V2.4M2.6 5.8L6 2.4l3.4 3.4" : "M6 1.8v7.8M2.6 6.2L6 9.6l3.4-3.4"
				})
			});
		}

		/**
		 * Compact counter: above 9 it renders "9+" with the plus as a superscript
		 * that does not take layout width (absolute, sits over the button padding).
		 */
		function CountText({ value, prefix }) {
			const number = Number(value);
			const capped = Number.isFinite(number) && number > 9;
			return h("span", { className: "dshg-count", children: [
				prefix ? String(prefix) : null,
				capped ? "9" : String(value),
				capped ? h("span", { key: "plus", className: "dshg-countPlus", children: "+" }) : null
			] });
		}

		/**
		 * ↑ahead / ↓behind pair. Shared by the branch rows and the sync action
		 * button so both always show the same numbers and colours.
		 */
		function SyncDelta({ ahead, behind }) {
			const up = Number.isFinite(ahead) ? ahead : 0;
			const down = Number.isFinite(behind) ? behind : 0;
			if (up === 0 && down === 0) return null;
			return h("span", { className: "dshg-opDelta", children: [
				up > 0 ? h("span", { key: "up", className: "dshg-bDeltaUp", children: [h(NarrowArrow, { direction: "up" }), h(CountText, { value: up })] }) : null,
				down > 0 ? h("span", { key: "down", className: "dshg-bDeltaDown", children: [h(NarrowArrow, { direction: "down" }), h(CountText, { value: down })] }) : null
			] });
		}

		/**
		 * Narrow vertical arrow for the action bar: a centred shaft with one small
		 * head at the tip. Only 4px wide, so ↑N / ↓M stays readable without
		 * squeezing the rest of the bar out.
		 */
		function NarrowArrow({ direction }) {
			return react_jsx_runtime.jsx("svg", {
				width: 4,
				height: 10,
				viewBox: "0 0 4 10",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: react_jsx_runtime.jsx("path", {
					d: direction === "up"
						? "M2 9V1.4M0.7 2.8L2 1.4l1.3 1.4"
						: "M2 1v7.6M0.7 7.2L2 8.6l1.3-1.4"
				})
			});
		}

		/** Small outlined cloud: marks a ref that lives on a remote. */
		function CloudIcon({ size }) {
			return react_jsx_runtime.jsx("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: react_jsx_runtime.jsx("path", {
					d: "M4.7 12.1h6.6a2.9 2.9 0 0 0 .3-5.78 3.9 3.9 0 0 0-7.36-.66A2.86 2.86 0 0 0 4.7 12.1z"
				})
			});
		}

		/** Small cloud with an x: "remote state not refreshed". */
		function CloudXIcon({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					react_jsx_runtime.jsx("path", {
						key: "cloud",
						d: "M4.7 10.9h6.2a2.6 2.6 0 0 0 .3-5.2 3.6 3.6 0 0 0-6.8-.6A2.6 2.6 0 0 0 4.7 10.9z"
					}),
					// Wide stroke in the surface colour, drawn under the cross: it knocks a
					// gap out of the cloud outline so the x reads as sitting ON TOP of it
					// instead of merging into the same line weight.
					react_jsx_runtime.jsx("path", {
						key: "x-bg",
						d: "M10.1 10.8l3.5 3.5M13.6 10.8l-3.5 3.5",
						stroke: "var(--dsw-alias-bg-layer-2,#24242a)",
						strokeWidth: 3.8
					}),
					react_jsx_runtime.jsx("path", {
						key: "x",
						d: "M10.1 10.8l3.5 3.5M13.6 10.8l-3.5 3.5",
						strokeWidth: 2
					})
				]
			});
		}

		/** Plugin-styled confirmation dialog (never window.confirm / native modal). */
		function ConfirmModal({ dialog, onClose }) {
			if (dialog === null || dialog === void 0) return null;
			return hs("div", {
				className: "dshg-modal",
				children: hs("div", {
					className: "dshg-modalCard dshg-confirmCard",
					children: [
						h("div", { className: "dshg-modalTitle", children: dialog.title }),
						h("div", { className: "dshg-modalDesc", children: dialog.message }),
						hs("div", {
							className: "dshg-modalActions",
							children: [
								h("button", {
									type: "button",
									className: dialog.danger === true ? "dshg-op dshg-opDanger" : "dshg-op dshg-opPrimary",
									onClick: () => {
										const run = dialog.onOk;
										onClose();
										if (typeof run === "function") run();
									},
									children: dialog.confirmLabel !== void 0 ? dialog.confirmLabel : "确定"
								}),
								h("button", { type: "button", className: "dshg-op", onClick: onClose, children: "取消" })
							]
						})
					]
				})
			});
		}

		/**
		 * Remote management dialog: configure a remote when the repo has none, or
		 * inspect the connected one. Creating a repository is offered only when the
		 * setting allows it.
		 */
		function RemoteManagerModal({ open, remoteInfo, allowCreateRepo, busy, creating, failure, linkUrl, setLinkUrl, nameDraft, setNameDraft, descDraft, setDescDraft, isPrivate, setIsPrivate, permission, checkingPermission, accounts, accountUser, expandedSection, setExpandedSection, onClose, onLink, onUnlink, onCreate, onCheckPermission, onSwitchAccount }) {
			const connected = typeof remoteInfo?.name === "string" && remoteInfo.name.length > 0;
			// Signed-in accounts drive the "未登录" state here: a stale profile must not
			// keep showing an account that was logged out in the settings page.
			const hasAccounts = Array.isArray(accounts) && accounts.length > 0;
			const infoRow = (label, value) => h("div", {
				key: label,
				className: "dshg-remoteRow",
				children: [
					h("span", { className: "dshg-remoteLabel", children: label }),
					h("span", { className: "dshg-remoteValue", title: value, children: value })
				]
			});
			return h(Presence, { show: open === true, children: hs("div", {
				className: "dshg-modal",
				children: hs("div", {
					className: "dshg-modalCard dshg-remoteCard",
					children: [
						h("div", { className: "dshg-modalTitle", children: "远程管理" }),
						h("div", {
							className: connected ? "dshg-remoteStatus dshg-remoteStatusOk" : "dshg-remoteStatus",
							children: connected ? "此仓库已连接远程" : "此仓库未连接远程，请在下方配置"
						}),
						connected === true
							? hs(react.Fragment, { children: [
								h("div", { className: "dshg-remoteInfo", children: [
									infoRow("远程名称", remoteInfo.name),
									infoRow("仓库地址", remoteInfo.url),
									infoRow("托管平台", remoteInfo.github === true ? "GitHub" : (remoteInfo.host.length > 0 ? remoteInfo.host : "其他")),
									infoRow("仓库标识", remoteInfo.github === true ? `${remoteInfo.owner}/${remoteInfo.repo}` : "—")
								] }),
								remoteInfo.github === true ? h("div", { className: "dshg-remoteSection", children: [
									// Current account sits where the old probe button used to be.
									h("div", { className: "dshg-remoteAccount", children: [
										hasAccounts === true && accountUser !== null && accountUser !== void 0 && accountUser.avatarUrl.length > 0
											? h("img", { className: "dshg-remoteAvatar", src: accountUser.avatarUrl, alt: "" })
											: h("span", { className: "dshg-remoteAvatar dshg-remoteAvatarFallback", children: "?" }),
										h("span", { className: "dshg-remoteAccountName", children: hasAccounts !== true
											? "未登录 GitHub 账号"
											: (accountUser !== null && accountUser !== void 0 && accountUser.login.length > 0 ? accountUser.login : "未登录账户") })
									]}),
									hasAccounts !== true ? null : permission !== null && permission !== void 0 ? h("div", {
										className: `dshg-permResult ${permission.canPush === true ? "dshg-permOk" : permission.canPush === false ? "dshg-permDenied" : "dshg-permUnknown"}`,
										children: permission.canPush === true
											? "此账户拥有推送权限"
											: permission.canPush === false
												? `此账户没有推送权限（${permission.reason.length > 0 ? permission.reason : "denied"}）`
												: `无法确定推送权限（${permission.reason.length > 0 ? permission.reason : "unknown"}）`
									}) : null
								] }) : null,
								// Re-point the remote at another URL: the same addRemote
								// action becomes `git remote set-url` when a remote exists.
								h("div", { className: "dshg-remoteSection", children: [
									h("div", { className: "dshg-remoteRow", children: [
										h("span", { className: "dshg-remoteLabel", children: "更改地址" }),
										h("input", {
											className: "dshg-setInput",
											value: typeof linkUrl === "string" ? linkUrl : "",
											placeholder: remoteInfo.url,
											disabled: busy,
											onChange: (event) => setLinkUrl(event.target.value)
										})
									]}),
									h("button", {
										type: "button",
										className: "dshg-op",
										disabled: busy || String(linkUrl ?? "").trim().length === 0,
										onClick: async () => {
											const next = String(linkUrl ?? "").trim();
											const result = await onLink(next);
											if (result?.ok === true) setLinkUrl("");
										},
										children: "更新连接地址"
									})
								]})
							] })
							: allowCreateRepo === true
								? h("div", { className: "dshg-remoteAccordion", children: [
									// 1) link an existing remote (collapsed by default when create is available)
									h("div", { key: "link", className: `dshg-remotePanel${expandedSection === "link" ? " dshg-remotePanelOpen" : ""}`, children: [
										h("button", {
											type: "button",
											className: "dshg-remotePanelHead",
											onClick: () => setExpandedSection("link"),
											children: "通过链接连接远程仓库"
										}),
										h("div", { className: "dshg-remotePanelBody", children: [
											h("input", {
												className: "dshg-setInput",
												value: linkUrl,
												placeholder: "https://github.com/owner/repo.git",
												onChange: (event) => setLinkUrl(event.target.value)
											}),
											h("button", {
												type: "button",
												className: "dshg-op dshg-opPrimary",
												disabled: busy === true || linkUrl.trim().length === 0,
												onClick: onLink,
												children: "关联"
											})
										] })
									] }),
									// 2) create a repository, under the selected account
									h("div", { key: "create", className: `dshg-remotePanel${expandedSection === "create" ? " dshg-remotePanelOpen" : ""}`, children: [
										h("button", {
											type: "button",
											className: "dshg-remotePanelHead",
											onClick: () => setExpandedSection("create"),
											children: "新建并连接远程仓库"
										}),
										h("div", { className: "dshg-remotePanelBody", children: [
											h("input", {
												className: "dshg-setInput",
												value: nameDraft,
												placeholder: "仓库名（必填）",
												onChange: (event) => setNameDraft(event.target.value)
											}),
											h("input", {
												className: "dshg-setInput",
												value: descDraft,
												placeholder: "介绍（可选）",
												onChange: (event) => setDescDraft(event.target.value)
											}),
											h("label", {
												className: "dshg-remoteCheck",
												children: [
													h("input", { type: "checkbox", checked: isPrivate === true, onChange: (event) => setIsPrivate(event.target.checked) }),
													h("span", { children: "私有仓库" })
												]
											}),
											h("div", { className: "dshg-remoteAccount", children: [
												accountUser !== null && accountUser !== void 0 && accountUser.avatarUrl.length > 0
													? h("img", { className: "dshg-remoteAvatar", src: accountUser.avatarUrl, alt: "" })
													: h("span", { className: "dshg-remoteAvatar dshg-remoteAvatarFallback", children: "?" }),
												h("span", { className: "dshg-remoteAccountName", children: accountUser !== null && accountUser !== void 0 && accountUser.login.length > 0 ? accountUser.login : "未登录账户" }),
												Array.isArray(accounts) && accounts.length > 1
													? h("select", {
														className: "dshg-setSelect",
														value: accountUser !== null && accountUser !== void 0 ? accountUser.login : "",
														onChange: (event) => onSwitchAccount(event.target.value),
														children: accounts.map((item) => h("option", { key: item.name, value: item.name, children: item.name }))
													})
													: null
											]}),
											h("button", {
												type: "button",
												className: "dshg-op dshg-opPrimary",
												disabled: busy === true || nameDraft.trim().length === 0,
												onClick: onCreate,
												children: "创建并连接"
											})
										] })
									] })
								] })
								: hs(react.Fragment, { children: [
								h("div", { className: "dshg-remoteSection", children: [
									h("div", { className: "dshg-remoteSectionTitle", children: "关联已有远程" }),
									h("input", {
										className: "dshg-setInput",
										value: linkUrl,
										placeholder: "https://github.com/owner/repo.git",
										onChange: (event) => setLinkUrl(event.target.value)
									}),
									h("button", {
										type: "button",
										className: "dshg-op dshg-opPrimary",
										disabled: busy === true || linkUrl.trim().length === 0,
										onClick: onLink,
										children: "关联"
									})
								] }),
								allowCreateRepo === true ? h("div", { className: "dshg-remoteSection", children: [
									h("div", { className: "dshg-remoteSectionTitle", children: "新建仓库并连接" }),
									h("input", {
										className: "dshg-setInput",
										value: nameDraft,
										placeholder: "仓库名（必填）",
										onChange: (event) => setNameDraft(event.target.value)
									}),
									h("input", {
										className: "dshg-setInput",
										value: descDraft,
										placeholder: "描述（可选）",
										onChange: (event) => setDescDraft(event.target.value)
									}),
									h("label", {
										className: "dshg-remoteCheck",
										children: [
											h("input", { type: "checkbox", checked: isPrivate === true, onChange: (event) => setIsPrivate(event.target.checked) }),
											h("span", { children: "私有仓库" })
										]
									}),
									h("button", {
										type: "button",
										className: "dshg-op dshg-opPrimary",
										disabled: busy === true || creating === true || nameDraft.trim().length === 0,
										onClick: onCreate,
										children: creating === true ? "创建中…" : "创建并连接"
									}),
									failure !== null && failure !== void 0 ? h("div", {
										className: "dshg-createFail",
										children: [
											h("div", { className: "dshg-createFailText", children: failure.message }),
											failure.url.length > 0 ? h("a", {
												className: "dshg-createFailLink",
												href: failure.url,
												target: "_blank",
												rel: "noopener noreferrer",
												onClick: (event) => event.stopPropagation(),
												children: "打开仓库并手动推送"
											}) : null
										]
									}) : null
								] }) : null
							] }),
						hs("div", {
							className: "dshg-modalActions",
							children: [
								connected === true && remoteInfo.github === true ? h("button", {
									type: "button",
									className: "dshg-op",
									disabled: checkingPermission === true,
									onClick: onCheckPermission,
									children: checkingPermission === true ? "检测中…" : "检测推送权限"
								}) : null,
								connected === true ? h("button", {
									type: "button",
									className: "dshg-op dshg-opDanger",
									disabled: busy === true,
									onClick: onUnlink,
									children: "取消链接"
								}) : null,
								h("button", { type: "button", className: "dshg-op", onClick: onClose, children: "关闭" })
							]
						})
					]
				})
			}) });
		}

		/** Human-readable timestamp for PR cards. */
		function formatPrStamp(iso) {
			if (typeof iso !== "string" || iso.length === 0) return "";
			const value = new Date(iso);
			if (Number.isNaN(value.getTime())) return "";
			return value.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
		}

		/** Icon + label describing the three PR directions. */
		function prKindMeta(kind, direction) {
			if (kind === "outgoing") return { icon: "↗", label: "发出", cls: "out" };
			if (kind === "incoming") return { icon: "↙", label: "收到", cls: "in" };
			return direction === "in"
				? { icon: "↻", label: "内循环（入）", cls: "loopIn" }
				: { icon: "↻", label: "内循环（出）", cls: "loopOut" };
		}

		/** A single pull request row: head line + expandable details. */
		function PrRow({ pr, expanded, onToggle, onDismiss, onJumpCommit }) {
			const prState = typeof pr.state === "string" ? pr.state : "";
			const mergedAt = typeof pr.mergedAt === "string" ? pr.mergedAt : "";
			const updatedAt = typeof pr.updatedAt === "string" ? pr.updatedAt : "";
			const author = typeof pr.author === "string" ? pr.author : "";
			const mergeCommit = typeof pr.mergeCommit === "string" ? pr.mergeCommit : "";
			const head = typeof pr.head === "string" ? pr.head : "";
			const headOwner = typeof pr.headOwner === "string" ? pr.headOwner : "";
			const base = typeof pr.base === "string" ? pr.base : "";
			const baseOwner = typeof pr.baseOwner === "string" ? pr.baseOwner : "";
			const meta = prKindMeta(typeof pr.kind === "string" ? pr.kind : "internal", typeof pr.direction === "string" ? pr.direction : "out");
			const tone = pr.merged === true ? "merged" : prState === "open" ? "open" : "closed";
			const toneLabel = tone === "open" ? "开启中" : tone === "merged" ? "已合并" : "已关闭";
			const stamp = tone === "merged" && mergedAt.length > 0 ? mergedAt : updatedAt;
			const canJump = tone === "merged" && mergeCommit.length > 0;
			// The row fades + collapses before it is actually removed, so the rows below
			// slide up instead of jumping.
			const [leaving, setLeaving] = (0, react.useState)(false);
			// Scrolling stays off until the expand animation settles, so the scrollbar
			// cannot flicker in and shift the footer buttons.
			const [scrollReady, setScrollReady] = (0, react.useState)(false);
			(0, react.useEffect)(() => { if (expanded !== true) setScrollReady(false); }, [expanded]);
			const requestDismiss = () => {
				if (leaving === true) return;
				setLeaving(true);
				window.setTimeout(onDismiss, 220);
			};
			return h("div", { className: `dshg-bubble dshg-prRow dshg-prRow-${tone}${expanded === true ? " dshg-prRowOpen" : ""}${leaving === true ? " dshg-prRowOut" : ""}`, children: [
				// The header only toggles; every action lives in the footer so nothing
				// shifts around when the row expands.
				h("button", {
					type: "button",
					className: "dshg-bubbleHead",
					onClick: onToggle,
					children: [
						h("span", { className: `dshg-prKind dshg-prKind-${meta.cls}`, title: meta.label, children: meta.icon }),
						h("span", { className: "dshg-prTitle", title: pr.title, children: `#${pr.number} ${pr.title}` }),
						h("span", { className: `dshg-prState dshg-prState-${tone}`, children: toneLabel })
					]
				}),
				// grid-rows transition: the inner wrapper is the single grid child, so the
				// animation interpolates against the real content height (no dead zone).
				h("div", { className: `dshg-bubbleBody${expanded === true ? " dshg-bubbleBodyOpen" : ""}`, children: h("div", {
					className: `dshg-bubbleBodyInner${scrollReady === true ? " dshg-scrollReady" : ""}`,
					onTransitionEnd: (event) => { if (event.propertyName === "grid-template-rows") setScrollReady(true); },
					children: [
					h("div", { className: "dshg-prRowLine", children: [
						h("span", { className: "dshg-prKey", children: "提交时间" }),
						h("span", { className: "dshg-prVal", children: formatPrStamp(stamp) })
					]}),
					h("div", { className: "dshg-prRowLine", children: [
						h("span", { className: "dshg-prKey", children: "提交人" }),
						h("span", { className: "dshg-prVal", children: author.length > 0 ? author : "—" })
					]}),
					h("div", { className: "dshg-prRowLine", children: [
						h("span", { className: "dshg-prKey", children: "方向" }),
						h("span", { className: "dshg-prVal dshg-prDirection", children: `${headOwner}/${head} → ${baseOwner}/${base}` })
					]}),
					h("div", { className: "dshg-prFooter", children: [
						h("a", {
							className: "dshg-prGh",
							href: pr.url,
							target: "_blank",
							rel: "noopener noreferrer",
							title: "在 GitHub 打开",
							children: h(GithubIcon, { size: 15 })
						}),
						// Always rendered for closed/merged rows so the action row keeps a
						// fixed width; it is simply invisible while the row is collapsed.
						h("div", { className: "dshg-prFooterActions", children: [
							canJump ? h("button", {
								type: "button",
								className: "dshg-op dshg-opTiny",
								onClick: () => onJumpCommit(mergeCommit),
								children: "跳转合并提交"
							}) : null,
							tone !== "open" ? h("button", {
								type: "button",
								className: "dshg-op dshg-opTiny dshg-prConfirm",
								onClick: requestDismiss,
								children: "确认"
							}) : null
						]})
					]})
				] }) })
			] });
		}

		/**
		 * Every pull request that touches the current branch, in one purple capsule:
		 * outgoing (this repo -> another), internal (both directions inside this repo)
		 * and incoming (another fork -> this repo).
		 */
		function PrList({ prs, dismissedKey, dismissed, onDismiss, onJumpCommit, bare }) {
			// Collapsed by default, and only one row may be expanded at a time.
			const [open, setOpen] = (0, react.useState)(false);
			const [openKey, setOpenKey] = (0, react.useState)(null);
			const visible = prs.filter((pr) => dismissed[dismissedKey(pr)] !== true);
			if (visible.length === 0) return null;
			const rows = visible.map((pr) => {
				const key = `${pr.kind}-${pr.number}`;
				return h(PrRow, {
					key,
					pr,
					expanded: openKey === key,
					onToggle: () => setOpenKey(openKey === key ? null : key),
					onDismiss: () => onDismiss(pr),
					onJumpCommit
				});
			});
			// Bare mode: rendered inside the "PR 管理" dialog — no capsule, no header.
			if (bare === true) return h("div", { className: "dshg-prListBody dshg-prListBodyBare", children: rows });
			const openCount = visible.filter((pr) => pr.state === "open").length;
			const summary = openCount === visible.length
				? `有 ${visible.length} 个开启中 PR`
				: `有 ${visible.length} 个待检查 PR`;
			return h("div", { className: `dshg-bubble dshg-prList${open === true ? " dshg-prListOpen" : ""}`, children: [
				h("button", {
					type: "button",
					className: "dshg-bubbleHead dshg-prListHead",
					onClick: () => setOpen(open !== true),
					children: [
						h("span", { className: "dshg-prListIcon", children: h(PrIcon, { size: 15 }) }),
						h("span", { className: "dshg-prListSummary", children: summary }),
						h("span", { className: "dshg-prCaret", children: open === true ? "▴" : "▾" })
					]
				}),
				h("div", { className: `dshg-bubbleBody${open === true ? " dshg-bubbleBodyOpen" : ""}`, children: h("div", { className: "dshg-bubbleBodyInner dshg-prListBodyInner", children: rows }) })
			] });
		}

		/**
		 * Scrollable commit list shared by the push / sync / pull dialogs. The
		 * container caps its own height, so a long history scrolls inside it
		 * instead of stretching the dialog.
		 */
		function CommitList({ commits, emptyText }) {
			const list = Array.isArray(commits) ? commits : [];
			if (list.length === 0) return h("div", { className: "dshg-pushNote", children: emptyText });
			return h("div", { className: "dshg-pushList", children: list.map((item) => h("div", {
				key: item.hash,
				className: "dshg-pushCommit",
				children: [
					h("span", { className: "dshg-pushHash", children: item.short ?? String(item.hash ?? "").slice(0, 8) }),
					h("span", { className: "dshg-pushSubject", children: item.subject }),
					h("span", { className: "dshg-pushAuthor", children: item.author })
				]
			})) });
		}

		/** Pull-request glyph (GitHub Octicon git-pull-request, filled). */
		function PrIcon({ size }) {
			return react_jsx_runtime.jsx("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "currentColor",
				children: react_jsx_runtime.jsx("path", {
					d: "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
				})
			});
		}

		/**
		 * Keeps a bubble mounted while it fades out, so dismissal is animated too.
		 * Layout around it reflows naturally as it collapses.
		 */
		function Presence({ show, children }) {
			const [mounted, setMounted] = (0, react.useState)(show === true);
			const [visible, setVisible] = (0, react.useState)(show === true);
			(0, react.useEffect)(() => {
				if (show === true) {
					setMounted(true);
					const id = window.requestAnimationFrame(() => setVisible(true));
					return () => window.cancelAnimationFrame(id);
				}
				setVisible(false);
				const timer = window.setTimeout(() => setMounted(false), 190);
				return () => window.clearTimeout(timer);
			}, [show]);
			if (mounted !== true) return null;
			return h("div", { className: `dshg-presence${visible === true ? " dshg-presenceIn" : " dshg-presenceOut"}`, children });
		}

		/** Generic user silhouette (default avatar when there is no picture). */
		function UserIcon({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					react_jsx_runtime.jsx("circle", { key: "head", cx: 8, cy: 5.6, r: 2.6 }),
					react_jsx_runtime.jsx("path", { key: "body", d: "M3.2 13.6c0-2.6 2.1-4.2 4.8-4.2s4.8 1.6 4.8 4.2" })
				]
			});
		}

		/** Warning triangle with an exclamation mark. */
		function WarnIcon({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					react_jsx_runtime.jsx("path", { key: "tri", d: "M8 2.1l6.1 10.8H1.9z" }),
					react_jsx_runtime.jsx("path", { key: "stem", d: "M8 6.2v3.3" }),
					react_jsx_runtime.jsx("circle", { key: "dot", cx: 8, cy: 11.6, r: 0.75, fill: "currentColor", stroke: "none" })
				]
			});
		}

		/** Conflict file body: plain text with the three marker lines coloured. */
		function ConflictView({ file, loading, error }) {
			if (loading === true) return h("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取冲突文件…"] });
			if (error !== null && error !== void 0) return h("div", { className: "dshg-error", children: error });
			const text = typeof file?.worktree === "string" ? file.worktree : "";
			if (text.length === 0) return h("div", { className: "dshg-empty", children: "文件为空或已在合并中被删除" });
			const lines = text.split("\n");
			// Parse merge markers into colored sections instead of showing the
			// raw <<<<<<< / ======= / >>>>>>> symbol lines.
			const rows = [];
			let section = null;
			let sectionCount = 0;
			let plainCount = 0;
			lines.forEach((line, index) => {
				if (/^<{7}/.test(line)) { section = "dshg-cfOurs"; sectionCount = 0; rows.push({ key: index, head: "当前分支", tone: "dshg-cfOurs" }); return; }
				if (/^\|{7}/.test(line)) { section = "dshg-cfBase"; sectionCount = 0; rows.push({ key: index, head: "共同祖先", tone: "dshg-cfBase" }); return; }
				if (/^={7}/.test(line)) { section = "dshg-cfTheirs"; sectionCount = 0; rows.push({ key: index, head: "对方分支", tone: "dshg-cfTheirs" }); return; }
				if (/^>{7}/.test(line)) { section = null; return; }
				// Each conflict section gets its own line numbers; lines outside a
				// section count on one continuous list.
				const num = section !== null ? ++sectionCount : ++plainCount;
				rows.push({ key: index, line, num, tone: section ?? "" });
			});
			return h("div", {
				className: "dshg-detailWork",
				children: h("div", {
					className: "dshg-conflictView",
					children: rows.map((row) => row.head !== void 0
						? h("div", { key: row.key, className: `dshg-cfBlockHead ${row.tone}`, children: row.head })
						: h("div", {
							key: row.key,
							className: `dshg-cfLine${row.tone.length > 0 ? ` ${row.tone}` : ""}`,
							children: [
								h("span", { className: "dshg-cfNum", children: row.num }),
								h("span", { className: "dshg-cfText", children: row.line.length === 0 ? " " : row.line })
							]
						}))
				})
			});
		}

		/** Conflict files as the same directory tree the working-tree list uses. */
		function ConflictTree({ files, activePath, onOpen, onHover }) {
			const tree = buildTree(files.map((file) => ({ path: file.path, blocks: file.blocks, code: file.code })));
			const renderNode = (node, level) => [
				...Array.from(node.children.values()).map((child) => {
					const compacted = compactNode(child);
					const target = compacted.target;
					return h("div", {
						key: target.path,
						children: [
							h("div", {
								className: "dshg-cDir",
								style: { paddingLeft: `${6 + level * 14}px` },
								children: [
									h("span", { className: "dshg-caret dshg-caretOpen", children: "▶" }),
									h("span", { className: "dshg-cDirName", title: target.path, children: compacted.label }),
									h("span", { className: "dshg-cDirCount", children: subtreeCount(target) })
								]
							}),
							...renderNode(target, level + 1)
						]
					});
				}),
				...node.files.map((file) => h("div", {
					key: file.path,
					className: `dshg-cFile${activePath === file.path ? " dshg-cFileActive" : ""}`,
					style: { paddingLeft: `${20 + level * 14}px` },
					onClick: () => onOpen(file.path),
					// Hover + modifier: the conflicted file's path, as a file element.
					onMouseEnter: () => { if (typeof onHover === "function") onHover({ ref: `git-file:${file.path}`, label: basename(file.path), clipboardText: file.path }); },
					onMouseLeave: () => { if (typeof onHover === "function") onHover(null); },
					children: [
						h("span", { className: "dshg-cLetter", children: file.code === "UU" ? "U" : String(file.code ?? "U").charAt(0) }),
						h("span", { className: "dshg-cPath", title: file.path, children: basename(file.path) }),
						h("span", {
							className: `dshg-cCount${file.blocks === 0 ? " dshg-cCountOk" : ""}`,
							children: file.blocks === 0 ? "（解决）" : `${file.blocks} 处冲突`
						})
					]
				}))
			];
			return h("div", { className: "dshg-conflictTree", children: renderNode(tree, 0) });
		}

		/** Split a stash patch into per-file chunks (for the file list + preview). */
		function parsePatchFiles(patch) {
			if (typeof patch !== "string" || patch.length === 0) return [];
			const files = [];
			const parts = patch.split(/^diff --git /m);
			for (const part of parts.slice(1)) {
				const header = (part.split("\n")[0] ?? "").trim();
				const match = header.match(/^a\/(.+?) b\/(.+)$/);
				files.push({ path: match ? match[2] : header, diff: `diff --git ${part}`.replace(/\s+$/, "") });
			}
			return files;
		}

		/** Parse "WIP on <branch>: <subject>" (or a custom stash message). */
		function parseStashMessage(message) {
			const match = String(message ?? "").match(/^WIP on ([^:]+):\s*(.*)$/);
			if (match === null) return { branch: "", subject: String(message ?? "") };
			return { branch: match[1] === "(no branch)" ? "" : match[1], subject: match[2] };
		}

		/**
		 * Repository settings: the repository-local identity / credential pin, a jump
		 * to remote management, and placeholders for the ignore + safe.directory work.
		 */
		function RepoConfigModal({ config, error, accounts, settings, busy, onClose, onOpenRemote, onSave, onOpenPath, remoteUrl, ignore, ignoreCheck, ignoreFiles, onRefreshIgnoreFiles, onSaveIgnore, onRestoreIgnore, onCheckIgnore }) {
			const list = Array.isArray(accounts) ? accounts : [];
			const [draftName, setDraftName] = (0, react.useState)(null);
			const [draftEmail, setDraftEmail] = (0, react.useState)(null);
			const [draftCred, setDraftCred] = (0, react.useState)(null);
			const [draftIgnore, setDraftIgnore] = (0, react.useState)(null);
			const [ignoreEditing, setIgnoreEditing] = (0, react.useState)(false);
			const [newRule, setNewRule] = (0, react.useState)("");
			// Per-list search: a magnifier toggles a full-width row that filters the list.
			const [ruleSearchOpen, setRuleSearchOpen] = (0, react.useState)(false);
			const [ruleQuery, setRuleQuery] = (0, react.useState)("");
			const [fileSearchOpen, setFileSearchOpen] = (0, react.useState)(false);
			const [fileQuery, setFileQuery] = (0, react.useState)("");
			const [checkTarget, setCheckTarget] = (0, react.useState)("");
			const [notice, setNotice] = (0, react.useState)("");
			const repoName = typeof config?.userName === "string" ? config.userName : "";
			const repoEmail = typeof config?.userEmail === "string" ? config.userEmail : "";
			const repoCred = typeof config?.credentialUser === "string" ? config.credentialUser : "";
			const configuredAccount = typeof settings?.activeAccount === "string" && settings.activeAccount.length > 0 ? settings.activeAccount : "";
			const nameValue = typeof draftName === "string" ? draftName : repoName;
			const emailValue = typeof draftEmail === "string" ? draftEmail : repoEmail;
			const credValue = typeof draftCred === "string" ? draftCred : repoCred;
			// Root .gitignore content (draft wins) and the last check-ignore summary.
			const ignoreValue = typeof draftIgnore === "string" ? draftIgnore : (typeof ignore?.content === "string" ? ignore.content : "");
			// Editable rule list: every non-empty, non-comment line is a rule addressed
			// by its 1-based line number in the file.
			const ignoreRules = ignoreValue
				.split("\n")
				.map((text, index) => ({ line: index + 1, text }))
				.filter((item) => item.text.trim().length > 0 && item.text.trim().startsWith("#") !== true);
			// Static classification of a rule's intent (git cannot tell a "file" rule from
			// a "name" rule without a concrete candidate, so this stays textual).
			const classifyRule = (text) => {
				const value = text.trim();
				if (value.startsWith("!")) return { label: "例外", cls: "dshg-ignoreKindNeg" };
				if (value.endsWith("/")) return { label: "文件夹", cls: "dshg-ignoreKindDir" };
				if (/[*?\[\]]/.test(value)) return { label: "通配", cls: "dshg-ignoreKindGlob" };
				if (value.includes(".")) return { label: "文件", cls: "dshg-ignoreKindFile" };
				return { label: "名称", cls: "dshg-ignoreKindName" };
			};
			// List header: a title with a magnifier that swaps itself for a full-width
			// search row (and back) — the query only filters the list below it.
			const searchGlyph = h("svg", {
				width: 13,
				height: 13,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				children: [h("circle", { cx: 7, cy: 7, r: 4.5 }), h("path", { d: "M10.4 10.4 14 14" })]
			});
			const closeGlyph = h("svg", {
				width: 13,
				height: 13,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				children: [h("path", { d: "M3 3l10 10" }), h("path", { d: "M13 3L3 13" })]
			});
			const searchHeader = (title, open, query, setQuery, setOpen, placeholder) => h("div", {
				className: "dshg-searchRow",
				children: open === true
					? [
						h("input", {
							className: "dshg-searchInput",
							value: query,
							placeholder,
							disabled: busy,
							onChange: (event) => setQuery(event.target.value)
						}),
						h("button", {
							type: "button",
							className: "dshg-searchBtn",
							title: "关闭搜索",
							onClick: () => { setOpen(false); setQuery(""); },
							children: closeGlyph
						})
					]
					: [
						h("span", { className: "dshg-repoTitle", children: title }),
						h("button", {
							type: "button",
							className: "dshg-searchBtn",
							title: "搜索",
							onClick: () => setOpen(true),
							children: searchGlyph
						})
					]
			});
			const ignoredFiles = Array.isArray(ignoreFiles?.files) ? ignoreFiles.files : [];
			// Whitelist mode: an "ignore everything" pattern plus at least one negation.
			// Worth calling out because a single deleted `*` releases the whole tree.
			const isWhitelistMode = ignoreRules.some((rule) => ["*", "/*", "**"].includes(rule.text.trim()))
				&& ignoreRules.some((rule) => rule.text.trim().startsWith("!"));
			const filteredRules = ruleQuery.trim() === "" ? ignoreRules : ignoreRules.filter((rule) => rule.text.includes(ruleQuery.trim()));
			const filteredFiles = fileQuery.trim() === "" ? ignoredFiles : ignoredFiles.filter((file) => file.includes(fileQuery.trim()));
			const removeIgnoreRule = (lineNumber) => {
				const lines = ignoreValue.split("\n");
				if (lineNumber < 1 || lineNumber > lines.length) return;
				lines.splice(lineNumber - 1, 1);
				setDraftIgnore(lines.join("\n"));
			};
			const appendIgnoreRule = () => {
				const text = newRule.trim();
				if (text.length === 0) return;
				const base = ignoreValue.length > 0 && ignoreValue.endsWith("\n") !== true ? `${ignoreValue}\n` : ignoreValue;
				setDraftIgnore(`${base}${text}\n`);
				setNewRule("");
			};
			const ignoreCheckText = ignoreCheck === null || ignoreCheck === void 0
				? ""
				: ignoreCheck.ok === false
					? `检查失败：${ignoreCheck.error ?? "未知错误"}`
					: ignoreCheck.ignored === true
						? `被忽略：${ignoreCheck.match ?? ""}`
						: "未被任何规则忽略";
			const save = (patch) => Promise.resolve(onSave(patch)).then((result) => {
				if (result?.ok === true) {
					setNotice("已保存");
				} else {
					// Roll the drafts back so the controls show what actually landed.
					setNotice(`保存失败：${JSON.stringify(result ?? null)}`);
					if (Object.prototype.hasOwnProperty.call(patch, "credentialUser")) setDraftCred(null);
					if (Object.prototype.hasOwnProperty.call(patch, "userName") || Object.prototype.hasOwnProperty.call(patch, "userEmail")) {
						setDraftName(null);
						setDraftEmail(null);
					}
				}
				return result;
			}).catch((error) => {
				setNotice(`保存失败：${error instanceof Error ? error.message : String(error)}`);
				setDraftCred(null);
				return { ok: false };
			});
			const saveIdentity = () => {
				const patch = {};
				if (nameValue.trim() !== repoName) patch.userName = nameValue.trim();
				if (emailValue.trim() !== repoEmail) patch.userEmail = emailValue.trim();
				if (Object.keys(patch).length > 0) save(patch);
			};
			const inputRow = (label, value, onChange, placeholder) => react_jsx_runtime.jsxs("div", {
				className: "dshg-repoRow",
				children: [
					react_jsx_runtime.jsx("span", { className: "dshg-repoLabel", children: label }),
					react_jsx_runtime.jsx("input", {
						className: "dshg-setInput",
						value,
						placeholder,
						disabled: busy,
						onChange: (event) => onChange(event.target.value)
					})
				]
			});
			// The credential pin is a dropdown: one option per logged-in account plus
			// "follow settings". A successful write refreshes the config, and the draft
			// keeps the chosen value until then so the control never snaps back.
			const credSelect = () => react_jsx_runtime.jsx("select", {
				className: "dshg-setSelect",
				value: credValue,
				disabled: busy,
				onChange: (event) => {
					const value = event.target.value;
					setDraftCred(value);
					save({ credentialUser: value });
				},
				children: [
					react_jsx_runtime.jsx("option", {
						value: "",
						children: configuredAccount.length > 0 ? `跟随设置（${configuredAccount}）` : "跟随设置（自动选择）"
					}),
					...list.map((account) => react_jsx_runtime.jsx("option", { value: account.name, children: account.name }, account.name))
				]
			});
			return h("div", {
				className: "dshg-modal",
				onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
				children: hs("div", {
					className: "dshg-modalCard dshg-repoCard",
					children: [
						hs("div", {
							className: "dshg-modalTitleRow",
							children: [
								react_jsx_runtime.jsx("span", { className: "dshg-modalTitle", children: "仓库设置" }),
								react_jsx_runtime.jsx("button", { type: "button", className: "dshg-iconButton", onClick: onClose, children: "×" })
							]
						}),
						error !== null && error !== void 0 ? react_jsx_runtime.jsx("div", { className: "dshg-error", children: error }) : null,
						notice.length > 0 ? react_jsx_runtime.jsx("div", { className: "dshg-repoNotice", children: notice }) : null,
						react_jsx_runtime.jsxs("div", {
							className: "dshg-repoSection",
							children: [
								react_jsx_runtime.jsx("div", { className: "dshg-repoTitle", children: "仓库身份" }),
								react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: "写入仓库的 .git/config；留空表示继承全局或默认身份。这个身份也会用在合并等原生 git 操作上。" }),
								inputRow("user.name", nameValue, setDraftName, "ARONA"),
								inputRow("user.email", emailValue, setDraftEmail, "name@users.noreply.github.com"),
								react_jsx_runtime.jsx("button", {
									type: "button",
									className: "dshg-op dshg-opPrimary",
									disabled: busy,
									onClick: saveIdentity,
									children: "写入仓库配置"
								})
							]
						}),
						react_jsx_runtime.jsxs("div", {
							className: "dshg-repoSection",
							children: [
								react_jsx_runtime.jsx("div", { className: "dshg-repoTitle", children: "远程连接" }),
								react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: typeof remoteUrl === "string" && remoteUrl.length > 0 ? remoteUrl : "尚未关联远程仓库" }),
								react_jsx_runtime.jsx("button", {
									type: "button",
									className: "dshg-op",
									onClick: onOpenRemote,
									children: "前往远程管理"
								})
							]
						}),
						react_jsx_runtime.jsxs("div", {
							className: "dshg-repoSection",
							children: [
								react_jsx_runtime.jsx("div", { className: "dshg-repoTitle", children: "固定凭据账户" }),
								react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: "写入仓库级 credential.username，避免 Git Credential Manager 在多账户时弹出选择框。" }),
								credSelect(),
								repoCred.length > 0 ? react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: list.some((account) => account.name === repoCred)
									? `当前固定：${repoCred}`
									: `当前固定：${repoCred}（该账户已不在凭据管理器中，可点「跟随设置」清除）` }) : null
							]
						}),
						react_jsx_runtime.jsxs("div", {
							className: "dshg-repoSection",
							children: [
								searchHeader(".gitignore", ruleSearchOpen, ruleQuery, setRuleQuery, setRuleSearchOpen, "搜索规则…"),
								react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: typeof ignore?.error === "string" && ignore.error.length > 0 ? `读取 .gitignore 失败：${ignore.error}（宿主半若刚更新，需要重启 DSH）` : ignore?.exists === true ? "仓库根 .gitignore；删除规则会立即让对应文件重新变成未跟踪。" : "尚未创建 .gitignore，保存即创建。" }),
								isWhitelistMode === true ? react_jsx_runtime.jsx("div", {
									className: "dshg-ignoreWhitelist",
									children: "检测到白名单模式：没被 ! 放行的文件都会被忽略；删掉 * 规则会让整个仓库的文件重新变成未跟踪。"
								}) : null,
								react_jsx_runtime.jsxs("div", {
									className: "dshg-ignoreRules",
									children: filteredRules.length === 0
										? [react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: ruleQuery.trim().length > 0 ? "没有匹配的规则" : "暂无规则" }, "empty")]
										: filteredRules.map((rule) => {
											const kind = classifyRule(rule.text);
											return react_jsx_runtime.jsxs("div", {
												className: "dshg-ignoreRule",
												children: [
													react_jsx_runtime.jsx("span", { className: "dshg-ignoreRuleLine", children: rule.line }),
													react_jsx_runtime.jsx("span", { className: `dshg-ignoreKind ${kind.cls}`, children: kind.label }),
													react_jsx_runtime.jsx("span", { className: "dshg-ignoreRuleText", title: rule.text, children: rule.text }),
													react_jsx_runtime.jsx("button", {
														type: "button",
														className: "dshg-ignoreDel",
														disabled: busy,
														onClick: () => removeIgnoreRule(rule.line),
														children: "删除"
													})
												]
											}, `${rule.line}:${rule.text}`);
										})
								}),
								react_jsx_runtime.jsxs("div", {
									className: "dshg-searchRow",
									children: [
										react_jsx_runtime.jsx("input", {
											className: "dshg-searchInput",
											value: newRule,
											placeholder: "添加规则，例如 node_modules/",
											disabled: busy,
											onChange: (event) => setNewRule(event.target.value),
											onKeyDown: (event) => { if (event.key === "Enter") appendIgnoreRule(); }
										}),
										react_jsx_runtime.jsx("button", {
											type: "button",
											className: "dshg-op",
											disabled: busy || newRule.trim().length === 0,
											onClick: appendIgnoreRule,
											children: "添加"
										})
									]
								}),
								searchHeader(`当前被忽略的文件（${filteredFiles.length}）`, fileSearchOpen, fileQuery, setFileQuery, setFileSearchOpen, "搜索文件…"),
								ignoreFiles?.error ? react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: `读取被忽略文件失败：${ignoreFiles.error}` }) : null,
								react_jsx_runtime.jsx("div", {
									className: "dshg-ignoreFiles",
									children: filteredFiles.length === 0
										? [react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: fileQuery.trim().length > 0 ? "没有匹配的文件" : "没有文件被忽略" }, "empty")]
										: filteredFiles.map((file) => react_jsx_runtime.jsx("div", {
											className: "dshg-ignoreFile",
											title: "单击查看它被哪条规则忽略；双击用默认程序打开",
											onClick: () => onCheckIgnore(file),
											onDoubleClick: () => onOpenPath(file),
											children: [
												react_jsx_runtime.jsx("span", { className: "dshg-ignoreFilePath", children: file }),
												react_jsx_runtime.jsx("span", { className: "dshg-ignoreFileHint", children: "规则" })
											]
										}, file))
								}),
								ignoreFiles?.truncated === true ? react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: "列表已截断（最多显示 300 个）" }) : null,
								react_jsx_runtime.jsx("button", {
									type: "button",
									className: "dshg-setBtn",
									disabled: busy,
									onClick: () => onRefreshIgnoreFiles(),
									children: "刷新文件列表"
								}),
								react_jsx_runtime.jsxs("div", {
									className: "dshg-searchRow",
									children: [
										react_jsx_runtime.jsx("input", {
											className: "dshg-searchInput",
											value: checkTarget,
											placeholder: "检查路径是否被忽略，例如 lib/client.js",
											disabled: busy,
											onChange: (event) => setCheckTarget(event.target.value)
										}),
										react_jsx_runtime.jsx("button", {
											type: "button",
											className: "dshg-op",
											disabled: busy || checkTarget.trim().length === 0,
											onClick: () => onCheckIgnore(checkTarget.trim()),
											children: "检查"
										})
									]
								}),
								ignoreCheckText.length > 0 ? react_jsx_runtime.jsx("div", { className: "dshg-repoHint", children: ignoreCheckText }) : null,
								react_jsx_runtime.jsxs("div", {
									className: "dshg-repoRow",
									children: [
										react_jsx_runtime.jsx("button", {
											type: "button",
											className: "dshg-op dshg-opPrimary",
											disabled: busy,
											onClick: () => {
												Promise.resolve(onSaveIgnore(ignoreValue)).then((result) => {
													if (result?.ok !== false) setDraftIgnore(null);
												}).catch(() => void 0);
											},
											children: "保存 .gitignore"
										}),
										react_jsx_runtime.jsx("button", {
											type: "button",
											className: "dshg-op",
											disabled: busy,
											onClick: () => {
												Promise.resolve(onRestoreIgnore()).then((result) => {
													if (result?.ok === true) setDraftIgnore(null);
												}).catch(() => void 0);
											},
											children: "还原备份"
										}),
										react_jsx_runtime.jsx("button", {
											type: "button",
											className: "dshg-op",
											disabled: busy,
											onClick: () => onOpenPath(".gitignore"),
											children: "查看原文"
										})
									]
								})
							]
						})
					]
				})
			});
		}

		/** Stash modal: recycle-bin layout, one card per stash entry. */
		function StashModal({ entries, loading, error, busy, onClose, onRefresh, onTake, onApply, onBranch, onDrop, onView, onClear, translate, onHover }) {
			const [expanded, setExpanded] = (0, react.useState)(null);
			const list = Array.isArray(entries) ? entries : [];
			return hs("div", {
				className: "dshg-modal",
				onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
				children: hs("div", {
					className: "dshg-modalCard dshg-recycleCard",
					children: [
						h("div", { className: "dshg-modalTitle", children: `暂存改动（${list.length}）` }),
						h("div", { className: "dshg-modalDesc", children: "每个条目都是一个独立提交，可以展开查看 diff，也可以应用、弹出、开分支或删除。" }),
						loading === true ? h("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取…"] }) : null,
						error !== null && error !== void 0 ? h("div", { className: "dshg-error", children: error }) : null,
						loading !== true && list.length === 0 ? h("div", { className: "dshg-empty", children: "没有暂存的改动。" }) : null,
						h("div", {
							className: "dshg-recycleList",
							children: list.map((entry) => {
								const open = expanded === entry.ref;
								const parsed = parseStashMessage(entry.message);
								const number = Number((String(entry.ref).match(/\{(\d+)\}/) ?? [])[1] ?? 0) + 1;
								const meta = [
									parsed.branch !== "" ? `基于 ${parsed.branch}` : null,
									typeof entry.hash === "string" && entry.hash.length > 0 ? entry.hash.slice(0, 8) : null,
									entry.author,
									formatDate(entry.date, translate)
								].filter((part) => typeof part === "string" && part.length > 0).join(" · ");
								return h("div", {
									key: entry.ref,
									className: `dshg-recycleRow${open ? " dshg-recycleRowOpen" : ""}`,
									onMouseEnter: () => { if (typeof onHover === "function") onHover({
										ref: `git-stash:${entry.ref}/${entry.hash}`,
										label: entry.message,
										clipboardText: `${entry.ref} ${entry.hash} ${entry.message}`
									}); },
									onMouseLeave: () => { if (typeof onHover === "function") onHover(null); },
									children: [
										h("div", {
											className: "dshg-recycleHead",
											onClick: () => setExpanded(open ? null : entry.ref),
											onDoubleClick: () => setExpanded(entry.ref),
											children: [
												h("div", {
													className: "dshg-stashMain",
													children: [
														h("div", { className: "dshg-stashSubject", title: parsed.subject, children: parsed.subject }),
														h("div", { className: "dshg-stashMeta", children: meta })
													]
												}),
												h("span", { className: "dshg-stashRef", children: `暂存 ${number}` })
											]
										}),
										h("div", {
											className: `dshg-recycleBody${open ? " dshg-recycleBodyOpen" : ""}`,
											children: h("div", {
												className: "dshg-stashBtns",
												children: [
													h("button", { type: "button", className: "dshg-op", onClick: () => onTake(entry.ref), children: "取出" }),
													h("button", { type: "button", className: "dshg-op", onClick: () => onApply(entry.ref), children: "应用" }),
													h("button", { type: "button", className: "dshg-op", onClick: () => onBranch(entry.ref), children: "分支" }),
													h("button", { type: "button", className: "dshg-op dshg-opDanger", onClick: () => onDrop(entry.ref), children: "删除" }),
													h("button", { type: "button", className: "dshg-stashView", onClick: () => onView(entry.hash), children: "查看" })
												]
											})
										})
									]
								});
							})
						}),
						hs("div", {
							className: "dshg-modalActions",
							children: [
								h("button", { type: "button", className: "dshg-op", onClick: onRefresh, children: "刷新" }),
								h("button", { type: "button", className: "dshg-op dshg-opDanger", disabled: busy === true || list.length === 0, onClick: onClear, children: "清空" }),
								h("button", { type: "button", className: "dshg-op", onClick: onClose, children: "关闭" })
							]
						})
					]
				})
			});
		}

		/** Stash panel: a yellow card inside the drawer, below the conflict list. */
		function StashPanel({ entries, loading, error, operation, busy, persistent, preview, previewLoading, onClose, onRefresh, onApply, onPop, onDrop, onBranch, onPreview, onClear }) {
			const locked = operation !== null;
			const [expanded, setExpanded] = (0, react.useState)(null);
			// Default collapsed: only the header shows until it is opened.
			const [collapsed, setCollapsed] = (0, react.useState)(true);
			const list = Array.isArray(entries) ? entries : [];
			return h("div", {
				className: "dshg-stash",
				children: [
					h("div", {
						className: "dshg-stashHead",
						onClick: () => setCollapsed((value) => value !== true),
						children: [
							h("span", { className: "dshg-stashIcon", children: "≡" }),
							h("div", {
								className: "dshg-stashText",
								children: [
									h("div", { className: "dshg-stashTitle", children: `暂存改动（${list.length}）` }),
									h("div", {
										className: "dshg-stashSub",
										children: locked === true ? "已进入冲突处理，暂存面板暂不可操作" : "把工作区改动收进 stash，稍后可以恢复"
									})
								]
							}),
							h("button", { type: "button", className: "dshg-op", disabled: busy === true, onClick: (event) => { event.stopPropagation(); onRefresh(); }, children: "刷新" }),
							h("button", { type: "button", className: "dshg-op dshg-opDanger", disabled: busy === true || locked === true || list.length === 0, onClick: (event) => { event.stopPropagation(); onClear(); }, children: "清空" }),
							h("button", { type: "button", className: "dshg-iconButton", onClick: (event) => { event.stopPropagation(); onClose(); }, children: "×" })
						]
					}),
					collapsed === true ? null : loading === true ? h("div", { className: "dshg-stashEmpty", children: "读取…" })
						: error !== null && error !== void 0 ? h("div", { className: "dshg-stashEmpty dshg-modalWarn", children: error })
							: list.length === 0 ? h("div", { className: "dshg-stashEmpty", children: "没有暂存的改动" })
								: h("div", {
									className: "dshg-stashList",
									children: list.map((entry) => {
										const open = expanded === entry.ref;
										return h("div", {
											key: entry.ref,
											className: `dshg-stashRow${open ? " dshg-stashRowOpen" : ""}`,
											children: [
												h("div", {
													className: "dshg-stashRowHead",
													onClick: () => {
														setExpanded(open ? null : entry.ref);
														if (open !== true) onPreview(entry.ref);
													},
													children: [
														h("span", { className: "dshg-stashRef", children: entry.ref }),
														h("span", { className: "dshg-stashMsg", title: entry.message, children: entry.message }),
														locked === true ? null : h("span", {
															className: "dshg-stashOps",
															children: [
																h("button", { type: "button", className: "dshg-op dshg-opTiny", onClick: (event) => { event.stopPropagation(); onApply(entry.ref); }, children: "应用" }),
																h("button", { type: "button", className: "dshg-op dshg-opTiny", onClick: (event) => { event.stopPropagation(); onPop(entry.ref); }, children: "弹出" }),
																h("button", { type: "button", className: "dshg-op dshg-opTiny", onClick: (event) => { event.stopPropagation(); onBranch(entry.ref); }, children: "开分支" }),
																h("button", { type: "button", className: "dshg-op dshg-opTiny dshg-opDanger", onClick: (event) => { event.stopPropagation(); onDrop(entry.ref); }, children: "删除" })
															]
														})
													]
												}),
												open ? h("div", {
													className: "dshg-stashBody",
													children: previewLoading === true && (preview === null || preview.ref !== entry.ref)
														? h("div", { className: "dshg-stashEmpty", children: "读取 diff…" })
														: h("pre", { className: "dshg-stashPatch", children: preview !== null && preview !== void 0 && preview.ref === entry.ref ? (preview.patch.length > 0 ? preview.patch : "（空 diff）") : "点击读取 diff" })
												}) : null
											]
										});
									})
								})
				]
			});
		}

		/** Top banner shown while a merge/squash/revert/rebase is in progress. */
		function ConflictBanner({ operation, conflicts, resolved, open, busy, onToggle, onContinue, onAbort, onSkip, onOpenFile, activePath, onHover }) {
			const kindLabel = operation.kind === "squash" ? "摘取合并"
				: operation.kind === "revert" ? "还原"
					: operation.kind === "rebase" ? "变基"
						: operation.kind === "cherry-pick" ? "摘取提交"
							: "合并";
			const source = operation.source.length > 0 ? operation.source : "?";
			const target = operation.target.length > 0 ? operation.target : "?";
			// A file whose markers are gone counts as resolved even before `git add`
			// (the panel only stages them when "继续" runs) — teacher-confirmed rule.
			const pending = conflicts.filter((file) => file.blocks > 0).length;
			const done = (conflicts.length - pending) + resolved.length;
			const isRebase = operation.kind === "rebase";
			const progress = operation.progress;
			const progressLine = isRebase && progress !== null && progress !== void 0
				? `当前进行到第 ${progress.current} 个点，剩余 ${Math.max(0, progress.total - progress.current)} 个点`
				: "";
			return h("div", {
				className: "dshg-conflict",
				children: [
					h("div", {
						className: "dshg-conflictHead",
						onClick: onToggle,
						children: [
							h("span", { className: "dshg-conflictIcon", children: "!" }),
							h("div", {
								className: "dshg-conflictText",
								children: [
									h("div", { className: "dshg-conflictTitle", children: pending > 0 ? (isRebase ? [`存在未解决的变基冲突（${pending} 个文件）`, h("br"), progressLine] : `存在未处理的合并冲突（${pending} 个文件）`) : "冲突已全部解决" }),
									h("div", {
										className: "dshg-conflictSub",
										children: `${source} → ${target} · ${done} 已解决`
									})
								]
							}),
							isRebase ? null : h("button", {
								type: "button",
								className: "dshg-op",
								disabled: busy === true || pending > 0,
								title: pending > 0 ? `还剩 ${pending} 个冲突` : "继续",
								onClick: (event) => { event.stopPropagation(); onContinue(); },
								children: "继续合并"
							}),
							isRebase ? null : h("button", {
								type: "button",
								className: "dshg-op dshg-opDanger",
								disabled: busy === true,
								onClick: (event) => { event.stopPropagation(); onAbort(); },
								children: "中止"
							})
						]
					}),
					isRebase ? h("div", {
						className: "dshg-conflictBtns",
						children: [
							h("button", { type: "button", className: "dshg-op", disabled: busy === true || pending > 0, title: pending > 0 ? `还剩 ${pending} 个冲突` : "继续变基", onClick: onContinue, children: "继续变基" }),
							h("button", { type: "button", className: "dshg-op dshg-opDanger", disabled: busy === true, onClick: onAbort, children: "终止变基" }),
							h("button", { type: "button", className: "dshg-op", disabled: busy === true, onClick: onSkip, children: "跳过此点" })
						]
					}) : null,
					h("div", {
						className: `dshg-conflictList${open === true ? " dshg-conflictListOpen" : ""}`,
						children: conflicts.length === 0
							? h("div", { className: "dshg-conflictEmpty", children: "冲突已全部解决，可以继续合并" })
							: h(ConflictTree, { files: conflicts, activePath, onOpen: onOpenFile, onHover })
					})
				]
			});
		}

		/** Floating branch list (design doc section 4). */
		function BranchPopover({ visible, dirty, filtered, onToggleFilter, branches, remotes, hasRemote, showLinkHint, onLinkRemote, onDismissHint, notice, onHover, operation, busy, onClose, onSwitch, onCreate, onRename, onDelete, onMerge, onRebase, onJumpCommit, onJumpEvent, onLinkUpstream }) {
			const [expanded, setExpanded] = (0, react.useState)(null);
			const locked = operation !== null;
			const filteredSet = new Set(Array.isArray(filtered) ? filtered : []);
			// Remote branches that no local branch tracks: they get their own group
			// (a remote branch WITH a local counterpart is merged into that row).
			const untrackedRemotes = (Array.isArray(remotes) ? remotes : []).filter((remote) => remote.trackedBy === "");
			return h("div", {
				className: `dshg-pop${visible === true ? " dshg-popOpen" : ""}`,
				onClick: (event) => event.stopPropagation(),
				children: [
					h("div", {
						className: "dshg-popHead",
						children: [
							h("span", { className: "dshg-popTitle", children: "分支管理" }),
							h("span", { className: "dshg-popCount", children: String(branches.length) }),
							h("button", { type: "button", className: "dshg-op", disabled: busy === true, onClick: onCreate, children: "新建分支" })
						]
					}),
					// No remote yet: the hint sits at the top of the branch panel, where
					// remote/branch actions live, instead of above the workspace.
					showLinkHint === true ? h("div", {
						className: "dshg-remoteHint dshg-remoteHintPop",
						title: "打开仓库关联窗口",
						onClick: () => onLinkRemote(),
						children: [
							h("span", { className: "dshg-remoteHintText", children: "当前仓库未关联远程，点击此处进行关联" }),
							h("button", {
								type: "button",
								className: "dshg-remoteHintClose",
								title: "不再提示",
								"aria-label": "关闭提示",
								onClick: (event) => { event.stopPropagation(); onDismissHint(); },
								children: "×"
							})
						]
					}) : null,
					// Results of actions started inside this panel (link / rename / switch…).
					notice !== null && notice !== void 0 ? h("div", {
						className: `dshg-opMsg ${notice.type === "ok" ? "dshg-opMsgOk" : "dshg-opMsgErr"}`,
						children: notice.text
					}) : null,
					locked ? h("div", { className: "dshg-popNote", children: "合并进行中，先解决冲突或中止" }) : null,
					h("div", {
						className: "dshg-popList",
						children: branches.map((branch) => {
							const open = expanded === branch.name;
							const isMain = branch.name === "main" || branch.name === "master";
							// The remote-tracking branch this local branch follows, when known:
							// the expanded card shows both tips so the two sides are comparable.
							const remoteBranch = (Array.isArray(remotes) ? remotes : []).find((item) => item.name === branch.upstream);
							return h("div", {
								key: branch.name,
								className: `dshg-bBranch${branch.current ? " dshg-bCurrent" : ""}${open ? " dshg-bOpen" : ""}`,
								// Hover + modifier: branch name + upstream into the chat.
								onMouseEnter: () => {
									if (typeof onHover !== "function") return;
									const upstream = typeof branch.upstream === "string" && branch.upstream.length > 0 ? ` (${branch.upstream})` : "";
									onHover({
										ref: `git-branch:${branch.name}`,
										label: `${branch.name}${upstream}`,
										clipboardText: `branch ${branch.name}${upstream}`
									});
								},
								onMouseLeave: () => { if (typeof onHover === "function") onHover(null); },
								children: [
									h("div", {
										className: "dshg-bHead",
										onClick: (event) => {
											// The filter dot handles its own clicks; never expand the
											// row when the dot is the target.
											const target = event?.target;
											if (target !== null && target !== void 0 && typeof target.closest === "function" && target.closest(".dshg-bDot") !== null) return;
											setExpanded(open ? null : branch.name);
										},
										children: [
											// Left slot, fixed width so every row lines up: synced / unlinked
											// text or the up-down commit counts. Hidden entirely while the
											// repo has no remote — the feature does not exist yet.
											hasRemote !== true ? null : h("span", {
												className: `dshg-bDelta${branch.upstream === "" ? " dshg-bDeltaNone" : ""}${branch.upstream !== "" && branch.ahead === 0 && branch.behind === 0 ? " dshg-bDeltaOk" : ""}`,
												title: branch.upstream === ""
													? "该分支还没有关联远程分支"
													: branch.ahead === 0 && branch.behind === 0
														? "本地与远程一致"
														: `待推送 ${branch.ahead} 个提交 · 待拉取 ${branch.behind} 个提交`,
												children: branch.upstream === ""
													? "未关联"
													: branch.ahead === 0 && branch.behind === 0
														? "已同步"
														: [
															branch.ahead > 0 ? h("span", { key: "up", className: "dshg-bDeltaUp", children: [h(SyncArrow, { direction: "up", size: 9 }), String(branch.ahead)] }) : null,
															branch.behind > 0 ? h("span", { key: "down", className: "dshg-bDeltaDown", children: [h(SyncArrow, { direction: "down", size: 9 }), String(branch.behind)] }) : null
														]
											}),
											h("button", {
												type: "button",
												className: `dshg-bDot${filteredSet.has(branch.name) ? " dshg-bDotOn" : ""}`,
												title: filteredSet.has(branch.name) ? "取消只看这个分支" : "只看这个分支",
												"aria-label": filteredSet.has(branch.name) ? "取消只看这个分支" : "只看这个分支",
												"aria-pressed": filteredSet.has(branch.name),
												style: {
													borderColor: branchColor(branch.name),
													background: filteredSet.has(branch.name) ? branchColor(branch.name) : "transparent"
												},
												onMouseDown: (event) => event.stopPropagation(),
												onClick: (event) => { event.stopPropagation(); onToggleFilter(branch.name); }
											}),
											h("span", { className: "dshg-bName", title: branch.name, children: branch.name }),
											branch.merged !== true ? h("span", { className: "dshg-bTag", children: "未合并" }) : null,
											h("span", { className: "dshg-bTime", children: formatDate(branch.date, translate) }),
											branch.current
												? h("span", { className: "dshg-bCurrentTag", children: "当前" })
												: h("button", {
													type: "button",
													className: "dshg-bSwitch",
													title: dirty === true ? "先提交或暂存改动再切换" : "切换到此分支",
													disabled: busy === true || locked || dirty === true,
													onClick: (event) => { event.stopPropagation(); onSwitch(branch.name); },
													children: "切换"
												})
										]
									}),
									h("div", {
										className: `dshg-bBody${open ? " dshg-bBodyOpen" : ""}`,
										children: [
											h("div", {
												className: "dshg-bCard",
												title: "跳到本地最新提交",
												onClick: () => onJumpCommit(branch.hash),
												children: [
													h("div", { className: "dshg-bCardLabel", children: "本地最新提交" }),
													h("div", { className: "dshg-bCardTitle", children: branch.subject.length > 0 ? branch.subject : "（无提交信息）" }),
													h("div", {
														className: "dshg-bCardMeta",
														children: [
															h("span", { className: "dshg-bHash", children: branch.short }),
															h("span", { children: formatDate(branch.date, translate) })
														]
													})
												]
											}),
											remoteBranch !== void 0 ? h("div", {
												className: "dshg-bCard",
												title: `跳到远程最新提交（${remoteBranch.name}）`,
												onClick: () => onJumpCommit(remoteBranch.hash),
												children: [
													h("div", { className: "dshg-bCardLabel", children: "远程最新提交" }),
													h("div", { className: "dshg-bCardTitle", children: remoteBranch.subject.length > 0 ? remoteBranch.subject : "（无提交信息）" }),
													h("div", {
														className: "dshg-bCardMeta",
														children: [
															h("span", { className: "dshg-bHash", children: remoteBranch.short }),
															h("span", { children: formatDate(remoteBranch.date, translate) })
														]
													})
												]
											}) : null,
											branch.name === "main" || branch.name === "master" ? null : h("div", {
												className: `dshg-bCard${branch.created === null ? " dshg-bCardDisabled" : ""}`,
												title: branch.created === null ? "创建日志已过期" : "跳到创建节点",
												onClick: () => { if (branch.created !== null) onJumpEvent(branch.created.hash); },
												children: [
													h("div", { className: "dshg-bCardLabel", children: "创建节点" }),
													h("div", {
														className: "dshg-bCardTitle",
														children: branch.created === null
															? "创建时间大于 90 天"
															: `基于 ${branch.created.from === "HEAD" || branch.created.from.length === 0 ? "当前分支" : branch.created.from}`
													}),
													branch.created === null
														? h("div", { className: "dshg-bCardMeta dshg-bCardExpired", children: "日志已过期" })
														: h("div", {
															className: "dshg-bCardMeta",
															children: [
																h("span", { className: "dshg-bHash", children: String(branch.created.hash).slice(0, 8) }),
																h("span", { children: formatDate(branch.created.date, translate) })
															]
														})
												]
											}),
											h("div", {
												className: "dshg-bActions",
												children: [
													// Unlinked branch: the fix lives here, bottom-left.
													branch.upstream === ""
														? h("button", {
															type: "button",
															className: "dshg-op",
															disabled: busy === true || locked,
															title: "选择一个远程分支建立跟踪关系",
															onClick: () => onLinkUpstream(branch.name),
															children: "关联远程分支"
														})
														: null,
													h("button", {
														type: "button",
														className: "dshg-bIconBtn",
														title: "重命名",
														"aria-label": "重命名",
														disabled: busy === true || locked,
														onClick: () => onRename(branch.name),
														children: h(PencilIcon, { size: 13 })
													}),
													h("div", {
														className: "dshg-bActionsRight",
														children: [
															h("button", {
																type: "button",
																className: "dshg-op dshg-opDanger",
																disabled: busy === true || locked || branch.current === true,
																onClick: () => onDelete(branch),
																children: "删除"
															}),
															h("button", {
																type: "button",
																className: "dshg-op",
																disabled: busy === true || locked || dirty === true,
																onClick: () => onMerge(branch.name),
																children: "合并"
															}),
															h("button", {
																type: "button",
																className: "dshg-op",
																disabled: busy === true || locked || dirty === true,
																title: dirty === true ? "工作区/索引不干净，先提交或暂存" : "把这个分支变基到某个提交",
																onClick: () => onRebase(branch.name),
																children: "变基"
															})
														]
													})
												]
											})
										]
									})
								]
							});
						})
					}),
					// Remote-only branches (no local counterpart to merge into).
					...(untrackedRemotes.length === 0 ? [] : [
						h("div", { className: "dshg-popSection", key: "remoteSection", children: "远程分支" }),
						h("div", {
							className: "dshg-popList",
							key: "remoteList",
							children: untrackedRemotes.map((remote) => h("div", {
								key: remote.name,
								className: "dshg-bBranch dshg-bRemote",
								children: h("div", {
									className: "dshg-bHead",
									children: [
										h("span", { className: "dshg-bGh", title: remote.name, children: h(GithubIcon, { size: 12 }) }),
										h("span", { className: "dshg-bName", title: remote.name, children: remote.name }),
										h("span", { className: "dshg-bTime", children: formatDate(remote.date, translate) })
									]
								})
							}))
						})
					])
				]
			});
		}

		/** The "more" bar: four squares slide away and icon actions slide in. */
		function MoreBar({ open, onToggle, items, disabled }) {
			const squares = ["tl", "tr", "bl", "br"];
			return h("div", {
				className: `dshg-moreBar${open === true ? " dshg-moreBarOpen" : ""}${disabled === true ? " dshg-moreBarDisabled" : ""}`,
				title: open === true ? "收起" : "更多",
				role: "button",
				tabIndex: 0,
				style: { "--count": String(Array.isArray(items) ? items.length : 0) },
				// Collapsed: clicking the squares expands. Expanded: only the chevron
				// (or an item whose action says so) closes it, so inner buttons that
				// open a panel cannot make the bar disappear by accident.
				onClick: (event) => { event.stopPropagation(); if (disabled === true) return; if (open !== true) onToggle(); },
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onToggle();
					}
				},
				children: [
					h("div", {
						className: "dshg-moreSquares",
						children: squares.map((key, index) => h("span", {
							key,
							className: `dshg-moreSquare dshg-moreSquare-${key}`,
							style: { "--i": String(index) }
						}))
					}),
					h("div", {
						className: "dshg-moreItems",
						children: (Array.isArray(items) ? items : []).map((item, index) => h("button", {
							key: item.key,
							type: "button",
							className: `dshg-moreAction${item.disabled === true ? " dshg-moreActionDisabled" : ""}`,
							title: item.title,
							"aria-label": item.title,
							style: { "--i": String(index) },
							onClick: (event) => {
								event.stopPropagation();
								if (item.disabled === true) {
									if (typeof item.onBlocked === "function") item.onBlocked(event.currentTarget);
									return;
								}
								item.onClick();
								if (item.closeOnClick !== false) onToggle();
							},
							children: h(item.icon, { size: 14 })
						}))
					}),
					h("span", {
						className: "dshg-moreArrow",
						role: "button",
						tabIndex: 0,
						title: "收起",
						onClick: (event) => { event.stopPropagation(); onToggle(); },
						onKeyDown: (event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								onToggle();
							}
						},
						children: h("svg", {
							width: 11,
							height: 11,
							viewBox: "0 0 16 16",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: 1.5,
							strokeLinecap: "round",
							strokeLinejoin: "round",
							children: h("path", { d: "M6 3.5L10.5 8L6 12.5" })
						})
					})
				]
			});
		}

		/** Recycle bin: commits no ref reaches any more. */
		function RecycleBin({ cwd, dirty, orphans, loading, error, onClose, onRefresh, onRestore, onView, onCheckout, onHover }) {
			const commits = Array.isArray(orphans) ? orphans : [];
			const [expanded, setExpanded] = (0, react.useState)(null);
			// A dropped commit leaves the reflog after 30 days; warn in the last 3.
			const RETENTION_DAYS = 30;
			const WARN_DAYS = 3;
			const daysSince = (value) => {
				const stamp = Date.parse(String(value ?? ""));
				return Number.isFinite(stamp) ? (Date.now() - stamp) / 86400000 : 0;
			};
			return hs("div", {
				className: "dshg-modal",
				onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
				children: hs("div", {
					className: "dshg-modalCard dshg-recycleCard",
					children: [
						h("div", { className: "dshg-modalTitle", children: `已丢弃的提交（${commits.length}）` }),
						h("div", { className: "dshg-modalDesc", children: "硬回退或删除分支后不再被任何分支引用的提交。只在 reflog 保留期内可以通过这里找回。" }),
						loading === true ? h("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取…"] }) : null,
						error !== null && error !== void 0 ? h("div", { className: "dshg-error", children: error }) : null,
						loading !== true && commits.length === 0 ? h("div", { className: "dshg-empty", children: "没有找到丢掉的提交。" }) : null,
						h("div", {
							className: "dshg-recycleList",
							children: commits.map((commit) => {
								const open = expanded === commit.hash;
								const daysLeft = RETENTION_DAYS - daysSince(commit.lostAt);
								const expiring = daysLeft <= WARN_DAYS;
								return h("div", {
									key: commit.hash,
									className: `dshg-recycleRow${open ? " dshg-recycleRowOpen" : ""}${expiring ? " dshg-recycleRowExpiring" : ""}`,
									// Dropped commits are regular commits for the chat insertion too.
									onMouseEnter: () => {
										if (typeof onHover !== "function") return;
										onHover({
											ref: `git-commit:${commit.hash}`,
											label: commit.short ?? commit.hash.slice(0, 8),
											clipboardText: commit.hash
										});
									},
									onMouseLeave: () => { if (typeof onHover === "function") onHover(null); },
									children: [
										h("div", {
											className: "dshg-recycleHead",
											onClick: () => setExpanded(open ? null : commit.hash),
											children: [
												h("span", { className: "dshg-recycleHash", children: commit.short }),
												h("span", { className: "dshg-recycleSubject", title: commit.subject, children: commit.subject.length > 0 ? commit.subject : "（无提交信息）" }),
												expiring ? h("span", { className: "dshg-recycleExpiringTag", children: "即将过期" }) : null,
												h("span", { className: "dshg-recycleMeta", children: formatDate(commit.lostAt, translate) })
											]
										}),
										h("div", {
											className: `dshg-recycleBody${open ? " dshg-recycleBodyOpen" : ""}`,
											children: [
												h("div", {
													className: "dshg-recycleInfo",
													children: [
														`作者：${commit.author}`,
														`提交时间：${formatDate(commit.date, translate)}`,
														`丢弃时间：${formatDate(commit.lostAt, translate)}`,
														`原因：${String(commit.reason ?? "").slice(0, 80)}`
													].map((line, index) => h("div", { key: index, className: "dshg-recycleLine", children: line }))
												}),
												h("div", {
													className: "dshg-recycleOps",
													children: [
														h("button", { type: "button", className: "dshg-op dshg-opTiny", onClick: () => onView(commit.hash), children: "查看" }),
														h("button", {
															type: "button",
															className: "dshg-op dshg-opTiny",
															disabled: dirty === true,
															title: dirty === true ? "工作区有未提交改动，先提交或暂存再切换" : "检出该提交（游离 HEAD）",
															onClick: () => onCheckout(commit.hash),
															children: "切换"
														}),
														h("button", { type: "button", className: "dshg-op dshg-opTiny dshg-opPrimary", onClick: () => onRestore(commit.hash), children: "恢复为分支" })
													]
												})
											]
										})
									]
								});
							})
						}),
						hs("div", {
							className: "dshg-modalActions",
							children: [
								h("button", { type: "button", className: "dshg-op", onClick: onRefresh, children: "刷新" }),
								h("button", { type: "button", className: "dshg-op", onClick: onClose, children: "关闭" })
							]
						})
					]
				})
			});
		}

		function BranchGlyph({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					react_jsx_runtime.jsx("circle", { cx: 4.5, cy: 3.5, r: 1.6 }),
					react_jsx_runtime.jsx("circle", { cx: 4.5, cy: 12.5, r: 1.6 }),
					react_jsx_runtime.jsx("circle", { cx: 11.5, cy: 5.2, r: 1.6 }),
					react_jsx_runtime.jsx("path", { d: "M4.5 5.1v5.8M6.1 9.4h2.4a3 3 0 0 0 3-3V6.8" })
				]
			});
		}
		// Sidebar entry, rewritten for DSH 0.2.0 in the same shape as the working
		// usage-stats entry: a small self-contained component (local state, its own
		// hook, no DOM walking, no portals).
		// Mounts the real panel over the sidebar when the entry is open. The panel
		// keeps the bundle's own styles (the CSS layer registers on import) and is
		// positioned by `.dshg-overlay` (position:fixed), so no portal and no DOM
		// walking are needed — both of which the 0.2.0 renderer dislikes.
		function GitPanelHost({ cwd, sessionId, t, onClose, source, version, diag, devMode }) {
			const [barHeight, setBarHeight] = react.useState(0);
			// GitPanel's mount effect depends on this object, so a fresh instance
			// per render would re-run the refresh on EVERY render. Keep one stable
			// instance for the mount.
			const gitApi = (0, react.useRef)(null);
			if (gitApi.current === null) {
				gitApi.current = {
					refresh: (target) => refreshAll(ctxRef, target),
					refreshDetail: (target, hash) => refreshDetail(ctxRef, target, hash),
					refreshFileDiff: (target, hash, path) => refreshFileDiff(ctxRef, target, hash, path),
					refreshWorkDiff: (target, path) => refreshWorkDiff(ctxRef, target, path),
					refreshConflict: (target, path) => refreshConflictFile(ctxRef, target, path),
					refreshOrphans: (target) => refreshOrphans(ctxRef, target),
					continueOperation: (target) => continueOperation(ctxRef, target),
					markResolved: (target, path) => markResolved(ctxRef, target, path),
					exclusive: (target, name) => callRemote(ctxRef, "branchExclusiveCommits", { path: target, name }),
					previewMerge: (target, source) => callRemote(ctxRef, "mergePreview", { path: cwd, target, source }),
					stash: (action, args) => callRemote(ctxRef, "stash", { path: cwd, action, ...(args ?? {}) }),
					loadPrefs: (root) => loadBranchFilter(ctxRef, root),
					savePrefs: (root, names) => saveBranchFilter(ctxRef, root, names),
					run: (method, target, args) => runAction(ctxRef, target, method, args ?? {})
				};
			}
			// Start the drawer BELOW the shell's window bar so the three window
			// buttons stay on their own surface instead of floating over the panel.
			// The bar is the frame's `::before` band, so it is measured at runtime
			// (its height differs between platforms) and exposed as a variable the
			// stylesheet can use; a failed measurement falls back to the CSS default.
			react.useLayoutEffect(() => {
				try {
					const frame = document.querySelector("[class*='frame']");
					const bar = frame === null ? null : getComputedStyle(frame, "::before");
					const measured = bar === null ? 0 : Number.parseFloat(bar.height);
					if (Number.isFinite(measured) && measured > 0) setBarHeight(Math.round(measured));
				} catch (_) { /* keep the stylesheet default */ }
			}, []);
			return react_jsx_runtime.jsx("div", {
				className: "dshg-overlay",
				style: barHeight > 0 ? { "--dshg-bar-height": `${barHeight}px` } : void 0,
				onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
				children: react_jsx_runtime.jsx(GitPanel, {
					cwd,
					sessionId,
					t,
					onClose,
					source,
					version,
					diag,
					devMode: devMode === true,
					git: gitApi.current
				})
			});
		}
		let ctxRef = null;
		/**
		 * Append one git element to the current session's composer as plain text.
		 * The chip path (`insertReference`) is span-CAS'd against the input machine's
		 * revision, which an outside plugin cannot read reliably, so only the single
		 * draft-write path is used.
		 */
		function insertChatReference(sessionId, element) {
			const ctx = ctxRef;
			if (ctx === null) return "面板尚未就绪";
			if (typeof sessionId !== "string" || sessionId.length === 0) return "没有当前会话";
			try {
				const sessions = ctx.get("sessions");
				if (sessions === null || sessions === void 0) return "sessions 服务不可用";
				const actx = typeof sessions.scope === "function" ? sessions.scope(sessionId) : void 0;
				if (actx === void 0) return "当前会话的输入作用域未就绪";
				const conversation = ctx.get("conversation");
				if (conversation === null || conversation === void 0) return "conversation 服务不可用";
				const input = conversation.input.for(actx);
				if (input === null || input === void 0 || typeof input.setDraft !== "function") return "输入框不可写";
				const snapshot = input.snapshot;
				const draft = snapshot !== null && snapshot !== void 0 && typeof snapshot.draft === "string" ? snapshot.draft : "";
				const separator = draft.length > 0 && draft.endsWith(" ") !== true ? " " : "";
				input.setDraft(`${draft}${separator}${element.ref}`);
				return true;
			} catch (error) {
				return `写入失败：${error instanceof Error ? error.message : String(error)}`;
			}
		}
		// The slot runtime used to bind `t` through a registered locale namespace;
		// this simplified entry no longer registers one, so bind the panel's own
		// dictionary here. `{name}` placeholders are interpolated.
		function translate(key, params) {
			const raw = zh?.[key] ?? en?.[key] ?? key;
			if (params === void 0 || params === null) return raw;
			return String(raw).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
				params[name] === void 0 || params[name] === null ? match : String(params[name]));
		}
		/**
		 * Sidebar entry. The workspace shown is resolved, in order, from:
		 *   1. the sidebar's selected conversation row (DOM) — authoritative,
		 *      because this build never exposes that selection through feeds;
		 *   2. DSH's own recent workspace;
		 *   3. the live selection cell / freshest session row;
		 *   4. the workspace that owns the freshest session.
		 * Feeds are kept as fallbacks: the DOM row can vanish for a frame while
		 * the list re-renders.
		 */
		function GitFooterEntry(props) {
			const { wide, useSessions, useWorkspaces } = props;
			const PANEL_VERSION = "0.1.5";
			const [open, setOpen] = (0, react.useState)(false);
			// The sidebar row is the only place the selected conversation shows up:
			// [data-row-key="session:<id>"][aria-selected="true"].
			const [domSessionId, setDomSessionId] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (typeof document === "undefined") return void 0;
				const read = () => {
					let node = null;
					try {
						node = document.querySelector('[data-row-key^="session:"][aria-selected="true"]');
					} catch (error) {
						node = null;
					}
					if (node === null || node === void 0) return;
					const key = typeof node.getAttribute === "function" ? node.getAttribute("data-row-key") : null;
					if (typeof key !== "string" || key.length === 0) return;
					const raw = key.startsWith("session:") ? key.slice(8) : key;
					setDomSessionId((previous) => (previous === raw ? previous : raw));
				};
				read();
				if (typeof MutationObserver !== "function") return void 0;
				const observer = new MutationObserver(read);
				try {
					observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected", "data-row-key"] });
				} catch (error) {
					return void 0;
				}
				return () => observer.disconnect();
			}, []);
			const state = (0, react.useSyncExternalStore)(storeFace().subscribe, storeFace().getSnapshot);
			const useSessionsSafe = typeof useSessions === "function" ? useSessions : () => void 0;
			const useWorkspacesSafe = typeof useWorkspaces === "function" ? useWorkspaces : () => void 0;
			const currentSessionId = useSessionsSafe((list) => (typeof list?.current === "string" ? list.current : void 0));
			const sessionCount = useSessionsSafe((list) => (Array.isArray(list?.ids) ? list.ids.length : Array.isArray(list?.items) ? list.items.length : -1));
			const workspaceCount = useWorkspacesSafe((list) => (Array.isArray(list?.items) ? list.items.length : -1));
			const latestSessionId = useSessionsSafe((list) => {
				const ids = Array.isArray(list?.ids) ? list.ids : [];
				if (ids.length > 0 && typeof ids[0] === "string") return ids[0];
				const byId = list?.byId;
				if (byId === null || byId === void 0 || typeof byId !== "object") return void 0;
				let bestStamp = -1;
				let bestId;
				for (const id of Object.keys(byId)) {
					const row = byId[id];
					if (row === void 0 || row === null) continue;
					const stamp = Number(row.updatedAt) || 0;
					if (stamp >= bestStamp) {
						bestStamp = stamp;
						bestId = id;
					}
				}
				return bestId;
			});
			const domSessionCwd = useSessionsSafe((list) => {
				if (typeof domSessionId !== "string" || domSessionId.length === 0) return void 0;
				const byId = list?.byId;
				if (byId === null || byId === void 0 || typeof byId !== "object") return void 0;
				const bare = domSessionId.replace(/^session-/, "");
				const candidates = [domSessionId, bare, `session-${bare}`];
				for (const key of candidates) {
					const row = byId[key];
					if (row !== null && row !== void 0 && typeof row.cwd === "string" && row.cwd.length > 0) return row.cwd;
				}
				return void 0;
			});
			const latestSessionCwd = useSessionsSafe((list) => {
				const rows = [];
				const byId = list?.byId;
				if (byId !== null && byId !== void 0 && typeof byId === "object") {
					for (const id of Object.keys(byId)) if (byId[id] !== void 0 && byId[id] !== null) rows.push(byId[id]);
				}
				if (Array.isArray(list?.items)) {
					for (const row of list.items) if (row !== void 0 && row !== null) rows.push(row);
				}
				let bestStamp = -1;
				let bestCwd;
				for (const row of rows) {
					if (typeof row.cwd !== "string" || row.cwd.length === 0) continue;
					const stamp = Number(row.updatedAt ?? row.createdAt ?? row.lastActiveAt) || 0;
					if (stamp >= bestStamp) {
						bestStamp = stamp;
						bestCwd = row.cwd;
					}
				}
				return bestCwd;
			});
			const sessionCwd = useSessionsSafe((list) => {
				const current = list?.current;
				if (typeof current !== "string") return void 0;
				const row = list?.byId?.[current];
				if (row !== void 0 && row !== null && typeof row.cwd === "string" && row.cwd.length > 0) return row.cwd;
				const items = Array.isArray(list?.items) ? list.items : [];
				const found = items.find((item) => item?.id === current || item?.sessionId === current);
				return typeof found?.cwd === "string" && found.cwd.length > 0 ? found.cwd : void 0;
			});
			const ownedWorkspaceCwd = useWorkspacesSafe((list) => {
				const items = Array.isArray(list?.items) ? list.items : [];
				if (items.length === 0 || typeof currentSessionId !== "string") return void 0;
				const owner = items.find((item) => Array.isArray(item?.sessionIds) && item.sessionIds.includes(currentSessionId));
				return typeof owner?.path === "string" && owner.path.length > 0 ? owner.path : void 0;
			});
			const workspaceCwd = useWorkspacesSafe((list) => {
				const items = Array.isArray(list?.items) ? list.items : [];
				if (items.length === 0) return void 0;
				const recentId = list?.recentWorkspaceId;
				// Only a real id: falling back to items[0] used to pin the panel to
				// the first workspace (often a non-repo) after a switch.
				if (typeof recentId !== "string") return void 0;
				const picked = items.find((item) => item?.workspaceId === recentId || item?.id === recentId);
				return typeof picked?.path === "string" && picked.path.length > 0 ? picked.path : void 0;
			});
			const latestOwnedWorkspaceCwd = useWorkspacesSafe((list) => {
				const items = Array.isArray(list?.items) ? list.items : [];
				if (items.length === 0 || typeof latestSessionId !== "string") return void 0;
				const owner = items.find((item) => Array.isArray(item?.sessionIds) && item.sessionIds.includes(latestSessionId));
				return typeof owner?.path === "string" && owner.path.length > 0 ? owner.path : void 0;
			});
			const resolvedCwd = typeof domSessionCwd === "string"
				? domSessionCwd
				: typeof workspaceCwd === "string"
					? workspaceCwd
					: typeof sessionCwd === "string"
						? sessionCwd
						: typeof latestSessionCwd === "string"
							? latestSessionCwd
							: typeof latestOwnedWorkspaceCwd === "string"
								? latestOwnedWorkspaceCwd
								: ownedWorkspaceCwd;
			// The feeds can blink empty while the store republishes; keeping the last
			// path prevents the slot entry from unmounting (which is permanent).
			const cwdCache = (0, react.useRef)(null);
			if (typeof resolvedCwd === "string" && resolvedCwd.length > 0) cwdCache.current = resolvedCwd;
			const cwd = typeof resolvedCwd === "string" && resolvedCwd.length > 0 ? resolvedCwd : cwdCache.current;
			const cwdSource = typeof domSessionCwd === "string"
				? "dom-selection"
				: typeof workspaceCwd === "string"
					? "recent-workspace"
					: typeof sessionCwd === "string"
						? "session"
						: typeof latestSessionCwd === "string"
							? "active-session"
							: typeof latestOwnedWorkspaceCwd === "string"
								? "active-workspace"
								: typeof ownedWorkspaceCwd === "string" ? "workspace" : "none";
			const diag = `source=${cwdSource} · cwd=${typeof cwd === "string" ? cwd : "none"} · domSid=${typeof domSessionId === "string" ? domSessionId.slice(-8) : "none"} · domCwd=${typeof domSessionCwd === "string" ? domSessionCwd : "none"} · ids0Cwd=${typeof latestSessionCwd === "string" ? latestSessionCwd : "none"} · recent=${typeof workspaceCwd === "string" ? workspaceCwd : "none"} · sessions=${sessionCount} · ws=${workspaceCount}`;
			(0, react.useEffect)(() => {
				if (typeof cwd !== "string" || cwd.length === 0) return;
				if (ctxRef === null) return;
				refreshAll(ctxRef, cwd);
			}, [cwd]);
			if (typeof cwd !== "string" || cwd.length === 0) {
				return react_jsx_runtime.jsx("button", {
					type: "button",
					className: wide === true ? "dshg-footerLabel" : "dshg-footerBtn",
					title: "Git 面板：当前没有可用的工作区",
					"aria-label": "Git 面板",
					disabled: true,
					children: react_jsx_runtime.jsx(BranchGlyph, { size: wide === true ? 14 : 16 })
				});
			}
			// Only trust a snapshot produced for THIS workspace; a stale one would
			// mislabel the branch (or the dirty count) right after a switch.
			const fresh = state.cwd === cwd ? state.snapshot : null;
			const isRepo = fresh?.repo === true;
			const branch = isRepo && typeof fresh.branch === "string" && fresh.branch.length > 0 ? fresh.branch : void 0;
			const count = isRepo && fresh.clean === false ? Number(fresh.changes?.total) || 0 : 0;
			const title = branch === void 0
				? `Git 面板 v${PANEL_VERSION}（${cwdSource}）：${cwd}`
				: `Git 面板 v${PANEL_VERSION}（${cwdSource}）：${cwd} — ${branch}${count > 0 ? `，${count} 处改动` : ""}`;
			const glyph = react_jsx_runtime.jsx(BranchGlyph, { size: wide === true ? 14 : 16 });
			// Wide row: the count sits on the right, in line with the branch name.
			const inlineCount = count > 0 ? react_jsx_runtime.jsx("span", {
				className: "dshg-footerCount",
				children: count > 99 ? "99+" : count
			}) : null;
			// Rail: no room for a row, keep the corner badge.
			const cornerBadge = count > 0 ? react_jsx_runtime.jsx("span", {
				className: "dshg-footerBadge",
				children: count > 99 ? "99+" : count
			}) : null;
			const button = wide === true
				? react_jsx_runtime.jsxs("button", {
					type: "button",
					className: "dshg-footerLabel",
					title,
					onClick: () => setOpen((value) => !value),
					children: [glyph, react_jsx_runtime.jsx("span", { className: "dshg-footerBranch", children: branch ?? "git" }), inlineCount]
				})
				: react_jsx_runtime.jsxs("button", {
					type: "button",
					className: "dshg-footerBtn",
					title,
					"aria-label": "Git 面板",
					onClick: () => setOpen((value) => !value),
					children: [glyph, cornerBadge]
				});
			if (!open) return button;
			// The drawer is wrapped in an error boundary: a crash inside the panel
			// must degrade to a visible button, never unmount the sidebar entry
			// (DSH's SlotErrorBoundary would abdicate the slot permanently).
			const fallback = react_jsx_runtime.jsxs("button", {
				type: "button",
				className: "dshg-footerBtn",
				title: `Git 面板渲染出错：${state.clientError ?? "unknown"}`,
				"aria-label": "Git 面板（渲染出错）",
				onClick: () => setOpen(true),
				children: [react_jsx_runtime.jsx(BranchGlyph, { size: 16 }), react_jsx_runtime.jsx("span", { className: "dshg-footerBadge", children: "!" })]
			});
			return react_jsx_runtime.jsx(Safeguard, {
				fallback,
				children: react_jsx_runtime.jsxs(react.Fragment, {
					children: [button, react_jsx_runtime.jsx(GitPanelHost, {
						cwd,
						// The list's `current` can be empty even while a conversation is open,
						// so fall back to the sidebar's selected row id.
						sessionId: typeof currentSessionId === "string" && currentSessionId.length > 0 ? currentSessionId : (typeof domSessionId === "string" && domSessionId.length > 0 ? domSessionId : latestSessionId),
						t: translate,
						source: cwdSource,
						version: PANEL_VERSION,
						diag,
						devMode: state.devMode === true,
						onClose: () => setOpen(false)
					})]
				})
			});
		}

		//#region settings panel
		// Two surfaces, one component:
		//   * plugin page — `plugins.row.config` (row page, editable form) and
		//     `plugins.bundle.config` (the bundle card in the plugin list);
		//   * DSH settings — `settings.section`, registered ONLY while
		//     `showDshSettings` is on, so the settings nav stays clean otherwise.
		// Values come from the host half (`pluginSettings`), which merges the
		// Loader row config with the panel-written store; the row page's `form` is
		// additionally written (best effort) so the Config projection agrees.

		/** Apply the settings that the panel itself renders from (anchor + dev strip). */
		function applySideEffects(value) {
			if (value?.modalAnchor === "screen") setStore({ modalAnchor: "screen" });
			else if (value?.modalAnchor === "panel") setStore({ modalAnchor: "panel" });
			// `devMode` used to live only in localStorage; it is a settings field
			// now, so the host value wins and localStorage follows it.
			if (typeof value?.devMode === "boolean" && value.devMode !== store.devMode) setDevMode(value.devMode);
		}
		/** Read the effective settings from the host half. Never throws. */
		async function loadPluginSettings(ctx) {
			const target = ctx ?? ctxRef;
			if (target === null || target === void 0) return null;
			try {
				const value = await callRemote(target, "pluginSettings", {});
				setStore({ settings: value, settingsError: null });
				applySideEffects(value);
				return value;
			} catch (error) {
				// A host half from before this feature has no `pluginSettings`;
				// say so instead of showing an empty form.
				setStore({ settingsError: error instanceof Error ? error.message : String(error) });
				return null;
			}
		}
		/** Persist a settings patch; resolves to the new settings, or null. */
		async function savePluginSettings(patch) {
			const target = ctxRef;
			if (target === null || target === void 0) return null;
			setStore({ settingsBusy: true, settingsError: null });
			try {
				const value = await callRemote(target, "pluginSettingsUpdate", patch ?? {});
				setStore({ settings: value, settingsBusy: false, settingsError: null });
				applySideEffects(value);
				return value;
			} catch (error) {
				setStore({ settingsBusy: false, settingsError: error instanceof Error ? error.message : String(error) });
				return null;
			}
		}

		// ---- GitHub auth (Git Credential Manager owns the credential) ----
		/** Read the GitHub accounts GCM knows about. Never throws. */
		async function loadGithubAccounts(ctx) {
			const target = ctx ?? ctxRef;
			if (target === null || target === void 0) return null;
			try {
				const value = await callRemote(target, "githubAccounts", {});
				setStore({
					githubAccounts: Array.isArray(value?.accounts) ? value.accounts : [],
					githubError: value?.ok === false ? value.error ?? "读取 GitHub 账号失败" : null
				});
				return value;
			} catch (error) {
				setStore({ githubAccounts: [], githubError: error instanceof Error ? error.message : String(error) });
				return null;
			}
		}
		/** Begin a browser OAuth login; the panel polls until it settles. */
		async function startGithubLogin() {
			const target = ctxRef;
			if (target === null || target === void 0) return;
			setStore({ githubError: null, githubLogin: { id: null, status: "starting", error: null } });
			try {
				const value = await callRemote(target, "githubLoginStart", {});
				if (value?.ok !== true) {
					setStore({ githubLogin: null, githubError: value?.error ?? "无法启动浏览器登录" });
					return;
				}
				setStore({ githubLogin: { id: value.id, status: "pending", error: null } });
			} catch (error) {
				setStore({ githubLogin: null, githubError: error instanceof Error ? error.message : String(error) });
			}
		}
		/** One poll tick for a pending browser login. */
		async function pollGithubLogin(id) {
			const target = ctxRef;
			if (target === null || target === void 0 || typeof id !== "string") return;
			try {
				const value = await callRemote(target, "githubLoginPoll", { id });
				if (value?.status === "pending") return;
				if (value?.status === "done") {
					setStore({ githubLogin: null, githubAccounts: Array.isArray(value.accounts) ? value.accounts : [], githubError: null });
					return;
				}
				setStore({ githubLogin: null, githubError: value?.error ?? "登录未完成" });
			} catch (error) {
				setStore({ githubLogin: null, githubError: error instanceof Error ? error.message : String(error) });
			}
		}
		/** Abandon a pending browser login. */
		async function cancelGithubLogin() {
			const login = store.githubLogin;
			setStore({ githubLogin: null });
			if (login?.id === void 0 || login?.id === null) return;
			try {
				await callRemote(ctxRef, "githubLoginCancel", { id: login.id });
			} catch (error) {
				// The session may already be gone.
			}
		}
		/** Log in with a Personal Access Token (handed straight to GCM). */
		async function loginGithubWithToken(token) {
			const target = ctxRef;
			if (target === null || target === void 0) return false;
			const value = String(token ?? "").trim();
			if (value.length === 0) {
				setStore({ githubError: "请先填入 Token" });
				return false;
			}
			setStore({ githubError: null, githubLogin: { id: null, status: "starting", error: null } });
			try {
				const result = await callRemote(target, "githubLoginToken", { token: value });
				if (result?.ok !== true) {
					setStore({ githubLogin: null, githubError: result?.error ?? "Token 登录失败" });
					return false;
				}
				setStore({ githubLogin: null, githubAccounts: Array.isArray(result.accounts) ? result.accounts : [], githubError: null });
				return true;
			} catch (error) {
				setStore({ githubLogin: null, githubError: error instanceof Error ? error.message : String(error) });
				return false;
			}
		}
		/** Remove one account from GCM. */
		async function logoutGithubAccount(name) {
			const target = ctxRef;
			if (target === null || target === void 0) return;
			try {
				const result = await callRemote(target, "githubLogout", { account: name });
				if (result?.ok !== true) {
					setStore({ githubError: result?.error ?? "登出失败" });
					return;
				}
				const remaining = Array.isArray(result.accounts) ? result.accounts : [];
				setStore({ githubAccounts: remaining, githubError: null });
				// Logging out must also drop the pinned accounts: leaving them behind
				// made the panel keep naming an account GCM no longer has.
				const nextSettings = { ...(store.settings ?? {}) };
				if (nextSettings.activeAccount === name) nextSettings.activeAccount = remaining.length > 0 ? remaining[0].name : "";
				if (nextSettings.mcpAccount === name) nextSettings.mcpAccount = remaining.length > 0 ? remaining[0].name : "";
				if (nextSettings.activeAccount !== store.settings?.activeAccount || nextSettings.mcpAccount !== store.settings?.mcpAccount) {
					setStore({ settings: nextSettings });
					await savePluginSettings({ activeAccount: nextSettings.activeAccount, mcpAccount: nextSettings.mcpAccount });
				}
			} catch (error) {
				setStore({ githubError: error instanceof Error ? error.message : String(error) });
			}
		}

		/** One settings row: name + note on the left, control on the right. */
		function SettingsRow(props) {
			return react_jsx_runtime.jsxs("div", {
				className: props.top === true ? "dshg-setRow dshg-setRowTop" : "dshg-setRow",
				children: [
					react_jsx_runtime.jsxs("div", {
						className: "dshg-setLabel",
						children: [
							react_jsx_runtime.jsx("span", { className: "dshg-setName", children: props.name }),
							typeof props.note === "string" && props.note.length > 0
								? react_jsx_runtime.jsx("span", { className: "dshg-setNote", children: props.note })
								: null
						]
					}),
					react_jsx_runtime.jsx("div", { className: "dshg-setCtl", children: props.children })
				]
			});
		}

		/** Accessible pill switch (native checkbox styling is unreadable here). */
		function SettingsSwitch(props) {
			const on = props.value === true;
			return react_jsx_runtime.jsx("button", {
				type: "button",
				role: "switch",
				"aria-checked": on,
				"aria-label": props.label,
				className: on ? "dshg-setSwitch dshg-setSwitchOn" : "dshg-setSwitch",
				disabled: props.disabled === true,
				onClick: () => {
					if (props.disabled !== true) props.onChange(on !== true);
				},
				children: react_jsx_runtime.jsx("span", { className: "dshg-setKnob" })
			});
		}

		/**
		 * The settings panel. `props.view` is "summary" (one plain sentence under
		 * the row title) or "page" (the real form); `props.form` exists only on the
		 * plugin row page and is used to keep the row Config in sync.
		 */
		function GitSettingsPanel(props) {
			const state = react.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
			const settings = state.settings;
			const [draftName, setDraftName] = react.useState(null);
			const [draftEmail, setDraftEmail] = react.useState(null);
			// MCP-only identity drafts (kept separate from the panel identity).
			const [draftMcpName, setDraftMcpName] = react.useState(null);
			const [draftMcpEmail, setDraftMcpEmail] = react.useState(null);
			const [notice, setNotice] = react.useState("");
			const [githubToken, setGithubToken] = react.useState("");
			// Accounts known to GCM — the list below shows exactly these.
			// NOTE: the store holds the array itself (loadGithubAccounts unwraps
			// `value.accounts`), not the {ok, accounts} envelope.
			const accountList = Array.isArray(state.githubAccounts) ? state.githubAccounts : [];
			// The account list is a collapsible section: one row per account with
			// switch / logout, plus a "let GCM choose" entry.
			const [accountsOpen, setAccountsOpen] = react.useState(false);
			// Which account is currently being signed out (button spinner + lock).
			const [logoutBusy, setLogoutBusy] = react.useState("");
			// Guard: the stored settings may predate this field.
			const activeAccountName = typeof settings.activeAccount === "string" ? settings.activeAccount : "";
			// Read once per mount: the host value outlives page switches.
			(0, react.useEffect)(() => {
				if (store.settings === null) loadPluginSettings(ctxRef);
				if (store.githubAccounts === null) loadGithubAccounts(ctxRef);
			}, []);
			// The "let the credential manager choose" option was removed: an empty
			// setting is exactly what made GCM pop its account picker. Older settings
			// start empty, so pin the first account automatically. (These effects run
			// after `commit` is defined, so no TDZ when the harness renders eagerly.)
			const firstAccountName = Array.isArray(state.githubAccounts) && state.githubAccounts.length > 0 ? state.githubAccounts[0].name : "";
			// Same rule for the MCP account: no "auto" entry, older empty settings
			// inherit the first account so headless calls never open the picker.
			const mcpAccountName = typeof settings.mcpAccount === "string" ? settings.mcpAccount : "";
			// Poll a pending browser login every 2s until it settles.
			const githubLoginId = state.githubLogin?.id ?? null;
			const githubLoginStatus = state.githubLogin?.status ?? null;
			(0, react.useEffect)(() => {
				if (githubLoginId === null || githubLoginStatus !== "pending") return void 0;
				const timer = setInterval(() => {
					pollGithubLogin(githubLoginId);
				}, 2000);
				return () => clearInterval(timer);
			}, [githubLoginId, githubLoginStatus]);
			(0, react.useEffect)(() => {
				if (notice === "") return void 0;
				const timer = setTimeout(() => setNotice(""), 2200);
				return () => clearTimeout(timer);
			}, [notice]);
			const name = typeof settings?.userName === "string" ? settings.userName : "";
			const email = typeof settings?.userEmail === "string" ? settings.userEmail : "";
			const mcpName = typeof settings?.mcpUserName === "string" ? settings.mcpUserName : "";
			const mcpEmail = typeof settings?.mcpUserEmail === "string" ? settings.mcpUserEmail : "";
			if (props.view === "summary") {
				// Plain text only: this sits in the row's description slot.
				return `${name || "DSH"} <${email || "dsh@local"}> · reflog 备份${settings?.reflogBackup === true ? "开" : "关"} · 设置页${settings?.showDshSettings === true ? "显示" : "隐藏"}`;
			}
			if (settings === null) {
				return react_jsx_runtime.jsx("div", {
					className: "dshg-set",
					children: react_jsx_runtime.jsx("p", {
						className: state.settingsError === null ? "dshg-setHint" : "dshg-setWarn",
						children: state.settingsError === null
							? "正在读取设置…"
							: `读取设置失败：${state.settingsError}（宿主半若刚更新，需要重启 DSH）`
					})
				});
			}
			/** Best effort: mirror a value into the row page's Config form. */
			const syncForm = (key, value) => {
				try {
					const form = props.form;
					if (form === void 0 || form === null || typeof form.mutate !== "function") return;
					form.mutate([{ op: "set", path: [key], value }], form.state?.revision);
				} catch (error) {
					// The host store is the source of truth; a form write may be refused.
				}
			};
			const commit = async (patch) => {
				const next = await savePluginSettings(patch);
				if (next === null) {
					setNotice("");
					return false;
				}
				for (const key of Object.keys(patch)) syncForm(key, patch[key]);
				setNotice("已保存");
				return true;
			};
			// Auto-pin an account when the stored settings predate the "no auto" rule:
			// an empty value is exactly what makes GCM pop its account picker.
			(0, react.useEffect)(() => {
				if (activeAccountName.length > 0 || firstAccountName.length === 0) return;
				commit({ activeAccount: firstAccountName });
			}, [activeAccountName, firstAccountName]);
			(0, react.useEffect)(() => {
				if (mcpAccountName.length > 0 || firstAccountName.length === 0) return;
				commit({ mcpAccount: firstAccountName });
			}, [mcpAccountName, firstAccountName]);
			const commitIdentity = (field, draft, current) => {
				const value = typeof draft === "string" ? draft.trim() : current;
				if (value === current) return;
				commit({ [field]: value });
			};
			// Sign out with a spinner + lock, and a hard timeout so a hung GCM call
			// cannot leave the button spinning forever.
			const doLogout = async (name) => {
				if (logoutBusy.length > 0) return;
				setLogoutBusy(name);
				let timer = null;
				const timeout = new Promise((resolve) => {
					timer = setTimeout(() => {
						setStore({ githubError: "退出登录超时（GCM 没有响应），请稍后重试" });
						resolve(null);
					}, 20000);
				});
				try {
					await Promise.race([logoutGithubAccount(name), timeout]);
				} finally {
					if (timer !== null) clearTimeout(timer);
					setLogoutBusy("");
				}
			};
			const busy = state.settingsBusy === true;
			const githubLogin = state.githubLogin;
			const identityInput = (field, draft, setDraft, current, placeholder) => react_jsx_runtime.jsx("input", {
				type: "text",
				className: "dshg-setInput",
				spellCheck: false,
				autoComplete: "off",
				placeholder,
				value: draft === null ? current : draft,
				disabled: busy,
				onChange: (event) => setDraft(event.target.value),
				onBlur: () => {
					commitIdentity(field, draft, current);
					setDraft(null);
				},
				onKeyDown: (event) => {
					if (event.key !== "Enter") return;
					event.currentTarget.blur();
				}
			});
			return react_jsx_runtime.jsxs("div", {
				className: "dshg-set",
				children: [
					// The settings shell's nav entry takes no icon option, so the page
					// carries the same branch mark the sidebar entry uses.
					react_jsx_runtime.jsxs("div", {
						className: "dshg-setHeadRow",
						children: [
							react_jsx_runtime.jsx(GitIcon, { size: 16 }),
							react_jsx_runtime.jsx("span", { className: "dshg-setHeadLabel", children: "Git" })
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: "dshg-setBlock",
						children: [
							react_jsx_runtime.jsx("h3", { className: "dshg-setTitle", children: "提交身份" }),
							react_jsx_runtime.jsx("p", {
								className: "dshg-setHint",
								children: "仓库或全局 git 已经配了 user.name / user.email 时以那份为准；这里只补空缺，不会改写已有作者信息。"
							}),
							react_jsx_runtime.jsxs("div", {
								className: "dshg-setRows",
								children: [
									react_jsx_runtime.jsx(SettingsRow, {
										name: "用户名",
										note: "留空 = 使用内置的 DSH",
										top: true,
										children: identityInput("userName", draftName, setDraftName, name, "DSH")
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "邮箱",
										note: "留空 = 使用内置的 dsh@local",
										top: true,
										children: identityInput("userEmail", draftEmail, setDraftEmail, email, "dsh@local")
									}),
									// MCP runs as its own process: its commits can carry a different
									// author so agent-made commits stay distinguishable.
									react_jsx_runtime.jsx(SettingsRow, {
										name: "MCP 用户名",
										note: "仅用于 MCP 工具创建的提交；留空则沿用上面的身份",
										top: true,
										children: identityInput("mcpUserName", draftMcpName, setDraftMcpName, mcpName, "MCP")
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "MCP 邮箱",
										note: "留空则沿用上面的邮箱",
										top: true,
										children: identityInput("mcpUserEmail", draftMcpEmail, setDraftMcpEmail, mcpEmail, "mcp@local")
									})
								]
							}),
							react_jsx_runtime.jsxs("p", {
								className: "dshg-setState",
								children: [
									"当前生效：",
									react_jsx_runtime.jsx("span", { className: "dshg-setCode", children: `${name || "DSH"} <${email || "dsh@local"}>` })
								]
							})
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: "dshg-setBlock",
						children: [
							react_jsx_runtime.jsx("h3", { className: "dshg-setTitle", children: "面板与集成" }),
							react_jsx_runtime.jsx("p", {
								className: "dshg-setHint",
								children: "控制 Git 面板出现在哪些位置，以及弹窗从哪里弹出。"
							}),
							react_jsx_runtime.jsxs("div", {
								className: "dshg-setRows",
								children: [
									// The DSH settings page hides this: it is already visible there.
									props.surface === "dsh" ? null : react_jsx_runtime.jsx(SettingsRow, {
										name: "在 DSH 设置里显示 Git 面板",
										note: "开启后，设置对话框左侧会多出一个「Git」栏目",
										children: react_jsx_runtime.jsx(SettingsSwitch, {
											label: "在 DSH 设置里显示 Git 面板",
											value: settings.showDshSettings === true,
											disabled: busy,
											onChange: (next) => commit({ showDshSettings: next })
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "弹窗位置",
										note: "面板内 = 在抽屉中央弹出；屏幕中央 = 覆盖整个窗口",
										children: react_jsx_runtime.jsx("select", {
											className: "dshg-setSelect",
											value: settings.modalAnchor === "screen" ? "screen" : "panel",
											disabled: busy,
											onChange: (event) => commit({ modalAnchor: event.target.value === "screen" ? "screen" : "panel" }),
											children: [
												react_jsx_runtime.jsx("option", { value: "panel", children: "面板内" }, "panel"),
												react_jsx_runtime.jsx("option", { value: "screen", children: "屏幕中央" }, "screen")
											]
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "显示诊断条",
										note: "面板底部打印工作区解析过程与调用次数，排查问题时再打开",
										children: react_jsx_runtime.jsx(SettingsSwitch, {
											label: "显示诊断条",
											value: settings.devMode === true,
											disabled: busy,
											onChange: (next) => commit({ devMode: next })
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "未关联远程时显示提示",
										note: "仓库没有远程时，在工作区上方显示一条可关闭的黄色提示",
										children: react_jsx_runtime.jsx(SettingsSwitch, {
											label: "未关联远程时显示提示",
											value: settings.promptRemoteLink !== false,
											disabled: busy,
											onChange: (next) => commit({ promptRemoteLink: next })
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "允许插件新建仓库",
										note: "开启后关联窗口里可以创建新的 GitHub 仓库并直接关联；MCP 的 create_repo 工具也受它控制",
										children: react_jsx_runtime.jsx(SettingsSwitch, {
											label: "允许插件新建仓库",
											value: settings.allowCreateRepo === true,
											disabled: busy,
											onChange: (next) => commit({ allowCreateRepo: next })
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "MCP：允许危险工具",
										note: "开启后 MCP 服务器会暴露 reset / restore / 强制推送；改动在 MCP 服务器下次启动时生效",
										children: react_jsx_runtime.jsx(SettingsSwitch, {
											label: "MCP：允许危险工具",
											value: settings.allowDangerousTools === true,
											disabled: busy,
											onChange: (next) => commit({ allowDangerousTools: next })
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "添加到对话的触发键",
										note: "鼠标悬停在元素上时按下该键，会把文件名 / 提交哈希等引用加入对话输入框",
										children: react_jsx_runtime.jsx("select", {
											className: "dshg-setSelect",
											value: settings.chatElementKey === "ctrl" ? "ctrl" : settings.chatElementKey === "shift" ? "shift" : "alt",
											disabled: busy,
											onChange: (event) => commit({ chatElementKey: event.target.value }),
											children: [
												react_jsx_runtime.jsx("option", { value: "alt", children: "Alt" }),
												react_jsx_runtime.jsx("option", { value: "ctrl", children: "Ctrl" }),
												react_jsx_runtime.jsx("option", { value: "shift", children: "Shift" })
											]
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "PR 收入更多栏",
										note: "开启后顶部不再显示 PR 面板，改从「更多」菜单里的「PR 面板」打开",
										children: react_jsx_runtime.jsx(SettingsSwitch, {
											label: "PR 收入更多栏",
											value: settings.prInMoreMenu === true,
											disabled: busy,
											onChange: (next) => commit({ prInMoreMenu: next })
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "分支隐藏提示",
										note: "当前分支被筛选隐藏时，在工作区与时间线之间显示黄色气泡，点击可恢复显示；关闭后完全不提示",
										children: react_jsx_runtime.jsx(SettingsSwitch, {
											label: "分支隐藏提示",
											value: settings.syncHiddenHint !== false,
											disabled: busy,
											onChange: (next) => commit({ syncHiddenHint: next })
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "关联后的标题",
										note: "留空则显示远程仓库名；填写后优先显示这段文字",
										children: react_jsx_runtime.jsx("input", {
											className: "dshg-setInput",
											value: typeof settings.remoteTitle === "string" ? settings.remoteTitle : "",
											placeholder: "例如：我的项目",
											disabled: busy,
											onChange: (event) => commit({ remoteTitle: event.target.value })
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "远程探测超时",
										note: "刷新时等待 fetch 的最长毫秒数；超时按「远程不可用」处理并显示云朵图标",
										children: react_jsx_runtime.jsx("input", {
											className: "dshg-setInput",
											type: "number",
											min: 1000,
											step: 500,
											value: String(Number.isFinite(Number(settings.fetchTimeoutMs)) ? Number(settings.fetchTimeoutMs) : 5000),
											disabled: busy,
											onChange: (event) => {
												const next = Number(event.target.value);
												if (Number.isFinite(next) && next >= 1000) commit({ fetchTimeoutMs: Math.round(next) });
											}
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "权限检测缓存",
										note: "推送权限检测结果的缓存毫秒数（默认 5 分钟），过期后下次刷新重新检测",
										children: react_jsx_runtime.jsx("input", {
											className: "dshg-setInput",
											type: "number",
											min: 10000,
											step: 60000,
											value: String(Number.isFinite(Number(settings.permissionCacheMs)) ? Number(settings.permissionCacheMs) : 300000),
											disabled: busy,
											onChange: (event) => {
												const next = Number(event.target.value);
												if (Number.isFinite(next) && next >= 10000) commit({ permissionCacheMs: Math.round(next) });
											}
										})
									})
								]
							})
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: "dshg-setBlock",
						children: [
							react_jsx_runtime.jsx("h3", { className: "dshg-setTitle", children: "数据" }),
							react_jsx_runtime.jsx("p", {
								className: "dshg-setHint",
								children: "插件数据只写在自己的安装目录，卸载插件即一并清除，不碰工作区。"
							}),
							react_jsx_runtime.jsxs("div", {
								className: "dshg-setRows",
								children: [
									react_jsx_runtime.jsx(SettingsRow, {
										name: "保留 reflog 备份",
										note: "把分支创建、合并等事件留在插件本地，避免 reflog 过期后丢失",
										children: react_jsx_runtime.jsx(SettingsSwitch, {
											label: "保留 reflog 备份",
											value: settings.reflogBackup === true,
											disabled: busy,
											onChange: (next) => commit({ reflogBackup: next })
										})
									})
								]
							})
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: "dshg-setBlock",
						children: [
							react_jsx_runtime.jsx("h3", { className: "dshg-setTitle", children: "GitHub" }),
							react_jsx_runtime.jsx("p", {
								className: "dshg-setHint",
								children: "凭据交给 Git Credential Manager 保管（Windows 凭据管理器，DPAPI 加密），本插件不保存 Token；登录后 git push / fetch 会自动复用。"
							}),
							react_jsx_runtime.jsxs("div", {
								className: "dshg-setRows",
								children: state.githubAccounts === null
									? [react_jsx_runtime.jsx("div", {
										className: "dshg-setRow",
										children: react_jsx_runtime.jsx("span", { className: "dshg-setNote", children: "正在读取 GitHub 账号…" })
									}, "loading")]
									: state.githubAccounts.length === 0
										? [react_jsx_runtime.jsx("div", {
											className: "dshg-setRow",
											children: react_jsx_runtime.jsx("span", { className: "dshg-setNote", children: state.deps?.gcm === false
												? "未检测到 Git Credential Manager（GCM），无法登录或列出账户"
												: "还没有登录任何 GitHub 账号" })
										}, "empty")]
										: [
											// Collapsible header: shows the active account, click to expand the list.
											react_jsx_runtime.jsx("button", {
												type: "button",
												className: "dshg-setAccountsHead",
												onClick: () => setAccountsOpen(accountsOpen !== true),
												children: [
													react_jsx_runtime.jsx("span", { className: "dshg-setAccountsHeadText", children: `当前账户：${activeAccountName.length > 0 ? settings.activeAccount : "未选择（自动使用第一项）"}` }),
													react_jsx_runtime.jsx("span", { className: "dshg-setAccountsCaret", children: accountsOpen === true ? "▴" : "▾" })
												]
											}, "head"),
											accountsOpen === true ? react_jsx_runtime.jsxs("div", {
												className: "dshg-setAccountsList",
												children: [
													...accountList.map((account) => react_jsx_runtime.jsxs("div", {
														className: "dshg-setAccountRow",
														children: [
															react_jsx_runtime.jsx("img", {
																className: "dshg-setAvatar",
																src: `https://github.com/${encodeURIComponent(account.name)}.png?size=40`,
																alt: ""
															}),
															react_jsx_runtime.jsx("span", { className: "dshg-setAccountName", children: account.name }),
															activeAccountName === account.name
																? react_jsx_runtime.jsx("span", { className: "dshg-setAccountCurrent", children: "当前" })
																: react_jsx_runtime.jsx("button", {
																	type: "button",
																	className: "dshg-setBtn",
																	onClick: () => commit({ activeAccount: account.name }),
																	children: "切换"
																}),
															react_jsx_runtime.jsx("button", {
																type: "button",
																className: "dshg-setBtn",
																disabled: logoutBusy.length > 0,
																onClick: () => doLogout(account.name),
																children: logoutBusy === account.name
																	? [react_jsx_runtime.jsx("span", { key: "spin", className: "dshg-spinner" }), "登出中…"]
																	: "登出"
															})
														]
													}, account.name))
												]
											}, "list") : null
										]
							}),
							react_jsx_runtime.jsxs("div", {
								className: "dshg-setRows",
								children: [
									// MCP works headlessly: pinning the credential account keeps GCM
									// from opening its multi-user picker in the middle of a call.
									react_jsx_runtime.jsx(SettingsRow, {
										name: "MCP 账户",
										note: "MCP 的 push / pull / fetch 固定使用这个 GCM 账户，避免弹出账户选择框",
										children: react_jsx_runtime.jsx("select", {
											className: "dshg-setSelect",
											value: accountList.length === 0 ? "__none__" : (typeof settings.mcpAccount === "string" ? settings.mcpAccount : ""),
											disabled: busy || accountList.length === 0,
											onChange: (event) => commit({ mcpAccount: event.target.value }),
											children: [
												accountList.length === 0
													? [react_jsx_runtime.jsx("option", { value: "__none__", children: "未登录账户" }, "no-account")]
													: accountList.map((account) => react_jsx_runtime.jsx("option", { value: account.name, children: account.name }, account.name))
											]
										})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "浏览器登录",
										note: githubLogin === null
											? "点按钮后系统浏览器会打开 GitHub 授权页，完成授权即回到这里"
											: githubLogin.status === "pending"
												? "等待浏览器授权…（最多 3 分钟）"
												: "正在启动登录…",
										children: githubLogin === null
											? react_jsx_runtime.jsx("button", {
												type: "button",
												className: "dshg-setBtn dshg-setBtnPrimary",
												onClick: () => startGithubLogin(),
												children: "打开浏览器登录"
											})
											: react_jsx_runtime.jsx("button", {
												type: "button",
												className: "dshg-setBtn",
												onClick: () => cancelGithubLogin(),
												children: "取消"
											})
									}),
									react_jsx_runtime.jsx(SettingsRow, {
										name: "Token 登录",
										note: "在 GitHub → Settings → Developer settings 生成，粘贴后立即交给 GCM，不落盘到插件",
										top: true,
										children: react_jsx_runtime.jsxs("div", {
											className: "dshg-setTokenRow",
											children: [
												react_jsx_runtime.jsx("input", {
													type: "password",
													className: "dshg-setInput",
													placeholder: "ghp_… 或 github_pat_…",
													autoComplete: "off",
													spellCheck: false,
													value: githubToken,
													onChange: (event) => setGithubToken(event.target.value),
													onKeyDown: (event) => {
														if (event.key !== "Enter") return;
														loginGithubWithToken(githubToken).then((ok) => {
															if (ok) setGithubToken("");
														});
													}
												}),
												react_jsx_runtime.jsx("button", {
													type: "button",
													className: "dshg-setBtn",
													disabled: githubToken.trim().length === 0,
													onClick: () => {
														loginGithubWithToken(githubToken).then((ok) => {
															if (ok) setGithubToken("");
														});
													},
													children: "登录"
												})
											]
										})
									})
								]
							})
						]
					}),
					notice === "" ? null : react_jsx_runtime.jsx("div", { className: "dshg-setNotice", children: notice }),
					state.settingsError === null ? null : react_jsx_runtime.jsx("div", { className: "dshg-setWarn", children: `保存失败：${state.settingsError}` }),
					state.githubError === null ? null : react_jsx_runtime.jsx("div", { className: "dshg-setWarn", children: `GitHub：${state.githubError}` })
				]
			});
		}
		//#endregion

		async function apply(ctx) {
			// Two stages on purpose. `remote.git` is a NESTED cordis service: the
			// ctx proxy resolves `ctx.remote.git` through the injection guard, so a
			// fiber may only READ it when it injects it — and the fiber that mounts
			// it cannot inject it (it would wait for the service it provides). This
			// outer fiber therefore owns the mount only; `GitUiPlugin`, a child
			// fiber, owns every UI registration with `remote.git` injected.
			try {
				await ctx.remote.$mount(TYPERT_REMOTE);
			} catch (error) {
				console.error("[ui-git] mounting the git Remote failed:", error);
				setStore({ clientError: error instanceof Error ? error.message : String(error) });
				return;
			}
			await ctx.plugin(GitUiPlugin);
		}
		/** UI half; separate fiber so it can inject the namespace it did not mount. */
		GitUiPlugin.inject = ["slots", "locale", "remote.git", "conversation", "sessions"];
		function GitUiPlugin(ctx) {
			ctxRef = ctx;
			// Dev-mode switch, reserved for the future settings panel:
			//   window.__dshGitDev.set(true)  /  window.__dshGitDev.get()
			try {
				if (typeof window !== "undefined") {
					window.__dshGitDev = {
						set: setDevMode,
						get: () => store.devMode === true
					};
				}
			} catch (error) {
				// A locked-down window object must not break activation.
			}
			// UI preferences reserved for the future settings panel: where dialogs
			// open ("panel" = centred in the drawer, the default; "screen" = viewport).
			try {
				if (typeof window !== "undefined") {
					window.__dshGitUi = {
						setModalAnchor: (anchor) => setStore({ modalAnchor: anchor === "screen" ? "screen" : "panel" }),
						getModalAnchor: () => (storeFace().getSnapshot().modalAnchor === "screen" ? "screen" : "panel")
					};
				}
			} catch (error) {
				// Same guard as above.
			}
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "git-panel",
				order: 5
			}, GitFooterEntry));

			// ---- settings nav icon (DOM patch) ----
			// `settings.section` has no icon option: the settings shell hard-codes a
			// nav icon per section id and falls back to a gear for unknown ids. The
			// settings panel is portal-rendered only while open, so observe the body
			// and swap our row's leading icon for the same branch mark the sidebar
			// entry uses. Idempotent via a dataset marker; disposed with the fiber.
			try {
				const swapNavIcon = () => {
					const nav = document.querySelector('[role="dialog"] nav');
					if (nav === null || nav === void 0) return;
					for (const button of nav.querySelectorAll("button")) {
						if (button.dataset === void 0 || button.dataset.dshgNavIcon !== void 0) continue;
						const text = typeof button.textContent === "string" ? button.textContent.trim() : "";
						if (text !== "Git") continue;
						const previous = button.firstElementChild;
						if (previous === null || previous === void 0) continue;
						const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
						svg.setAttribute("viewBox", "0 0 16 16");
						svg.setAttribute("width", "16");
						svg.setAttribute("height", "16");
						svg.setAttribute("fill", "none");
						svg.setAttribute("stroke", "currentColor");
						svg.setAttribute("stroke-width", "1.4");
						svg.setAttribute("stroke-linecap", "round");
						svg.setAttribute("stroke-linejoin", "round");
						svg.style.cssText = "width:16px;height:16px;flex:none";
						const dot = (cx, cy) => {
							const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
							circle.setAttribute("cx", cx);
							circle.setAttribute("cy", cy);
							circle.setAttribute("r", "1.6");
							svg.appendChild(circle);
						};
						dot("4.5", "3.5");
						dot("4.5", "12.5");
						dot("11.5", "5.2");
						const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
						path.setAttribute("d", "M4.5 5.1v5.8M6.1 9.4h2.4a3 3 0 0 0 3-3V6.8");
						svg.appendChild(path);
						previous.replaceWith(svg);
						button.dataset.dshgNavIcon = "1";
					}
				};
				if (typeof MutationObserver === "function" && typeof document !== "undefined") {
					const observer = new MutationObserver(() => swapNavIcon());
					observer.observe(document.body, { childList: true, subtree: true });
					swapNavIcon();
					ctx.effect(() => () => { observer.disconnect(); }, "ui-git: settings nav icon observer");
				}
			} catch (error) {
				// DOM patching is best effort: a locked-down document must not break activation.
			}

			// ---- settings surfaces ----
			// Plugin page: the bundle card (key = package name) and the component
			// row (key = `<package>#<cordis.patch.yml row id>`). Only the row page
			// passes `form`; both read their values from the host half.
			const ROW_ID = "ui-git";
			ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: PKG
			}, function GitBundleConfig(innerProps) {
				return react_jsx_runtime.jsx(GitSettingsPanel, { ...innerProps });
			}));
			ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
				name: "plugins.row.config",
				key: `${PKG}#${ROW_ID}`
			}, function GitRowConfig(innerProps) {
				return react_jsx_runtime.jsx(GitSettingsPanel, { ...innerProps });
			}));
			// DSH Settings → Git: registered only while `showDshSettings` is on.
			// The registration is created and disposed from the store subscription
			// below, so flipping the switch takes effect without a reload.
			let sectionDispose = null;
			const syncSettingsSection = () => {
				const want = store.settings?.showDshSettings === true;
				if (want && sectionDispose === null) {
					sectionDispose = ctx.slots.inject("settings.section", () => ctx.slots.register({
						name: "settings.section",
						id: "git-settings",
						order: 120,
						label: "Git"
					}, function GitSettingsSection(innerProps) {
						// `surface: "dsh"` hides the self-referential "show the Git nav entry"
						// switch: once you are reading this page, it is already on.
						return react_jsx_runtime.jsx(GitSettingsPanel, { ...innerProps, surface: "dsh" });
					}));
				} else if (!want && sectionDispose !== null) {
					try {
						sectionDispose();
					} catch (error) {
						// The slot may already be gone; nothing left to release.
					}
					sectionDispose = null;
				}
			};
			const unsubscribeSettings = subscribe(syncSettingsSection);
			// `ctx.effect` is cordis core, but a minimal host (or a test harness)
			// may not provide it; losing the cleanup must not abort activation.
			if (typeof ctx.effect === "function") {
				ctx.effect(() => () => {
					unsubscribeSettings();
					if (sectionDispose !== null) {
						try {
							sectionDispose();
						} catch (error) {
							// Same guard as above.
						}
						sectionDispose = null;
					}
				}, "ui-git: settings section");
			}
			loadPluginSettings(ctx);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
