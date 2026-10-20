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
			subject: z.string()
		});
		const gitLogResult = z.object({ commits: z.array(gitCommit) });
		const gitStatusResult = z.object({ clean: z.boolean(), entries: z.array(z.object({ x: z.string(), y: z.string(), path: z.string() })) });
		const gitDiffResult = z.object({
			commit: z.string(),
			files: z.array(z.object({
				path: z.string(),
				added: z.union([z.number(), z.null()]),
				removed: z.union([z.number(), z.null()]),
				binary: z.boolean()
			})),
			patch: z.string(),
			truncated: z.boolean()
		});
		const gitBranchResult = z.object({ branches: z.array(z.string()) });
		const gitIsRepoResult = z.object({ repo: z.boolean(), error: z.string().optional() });
		const gitWriteResult = z.union([
			z.object({ ok: z.literal(true), message: z.string(), id: z.string().optional() }),
			z.object({ ok: z.literal(false), error: z.string() })
		]);
		const gitMergeResult = z.union([
			z.object({ ok: z.literal(true), message: z.string() }),
			z.object({ ok: z.literal(false), error: z.string(), conflicts: z.array(z.string()).optional() })
		]);
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
		const TYPERT_REMOTE = {
			package: "@dsh-external/dsh-client-git-remote",
			descriptors: [
				descrip("snapshot", "GitSnapshotResult", gitSnapshotResult),
				descrip("log", "GitLogResult", gitLogResult),
				descrip("status", "GitStatusResult", gitStatusResult),
				descrip("diff", "GitDiffResult", gitDiffResult, withCommit),
				descrip("branch", "GitBranchResult", gitBranchResult),
				descrip("createBranch", "GitWriteResult", gitWriteResult),
				descrip("isRepo", "GitIsRepoResult", gitIsRepoResult),
				descrip("init", "GitWriteResult", gitWriteResult),
				descrip("commit", "GitWriteResult", gitWriteResult, withMessage),
				descrip("checkout", "GitWriteResult", gitWriteResult, withTarget),
				descrip("revert", "GitWriteResult", gitWriteResult, withCommit),
				descrip("merge", "GitMergeResult", gitMergeResult, withTarget),
				descrip("restore", "GitWriteResult", gitWriteResult, withCommit),
				descrip("reset", "GitWriteResult", gitWriteResult, withCommit)
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
