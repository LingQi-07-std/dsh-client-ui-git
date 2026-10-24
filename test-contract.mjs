// Contract test: the TYPERT host manifest's zod schemas must parse the exact
// payloads GitGateway returns (the Host gateway decodes every result through
// them), and the mini-zod in client.js must accept the same payloads.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitGateway } from "./lib/index.js";
import { TYPERT } from "./lib/typert.host.js";

// --- mini-zod replica of the client.js implementation (keep in sync) ---
function zodFail(message) { const e = new Error(message); e.name = "ZodError"; throw e; }
function zodType(parse) { const s = { parse }; s.passthrough = () => zodType((v) => { const p = parse(v); return p !== void 0 && typeof p === "object" && p !== null ? { ...p, ...v } : p; }); s.optional = () => { const sc = zodType((v) => (v === void 0 ? void 0 : parse(v))); sc._optional = true; return sc; }; Object.defineProperty(s, "_zod", { value: { traits: new Set() } }); return s; }
const z = {
	string: () => zodType((v) => (typeof v === "string" ? v : zodFail("string"))),
	number: () => zodType((v) => (typeof v === "number" && Number.isFinite(v) ? v : zodFail("number"))),
	boolean: () => zodType((v) => (typeof v === "boolean" ? v : zodFail("boolean"))),
	any: () => zodType((v) => v),
	null: () => zodType((v) => (v === null ? v : zodFail("null"))),
	literal: (value) => zodType((v) => (v === value ? v : zodFail("literal"))),
	union: (options) => zodType((v) => { for (const o of options) { try { return o.parse(v); } catch { /* next */ } } return zodFail("union"); }),
	array: (el) => zodType((v) => (Array.isArray(v) ? v.map((i) => el.parse(i)) : zodFail("array"))),
	object: (shape) => zodType((v) => {
		if (v === null || typeof v !== "object" || Array.isArray(v)) return zodFail("object");
		const out = {};
		for (const key of Object.keys(shape)) {
			if (!Object.prototype.hasOwnProperty.call(v, key)) {
				if (shape[key]._optional === true) continue;
				return zodFail(`missing ${key}`);
			}
			const parsed = shape[key].parse(v[key]);
			if (parsed !== void 0) out[key] = parsed;
		}
		return out;
	}),
	record: (val) => zodType((v) => { const out = {}; for (const k of Object.keys(v)) out[k] = val.parse(v[k]); return out; }),
	optional: (s) => { const sc = zodType((v) => (v === void 0 ? void 0 : s.parse(v))); sc._optional = true; return sc; },
	nullable: (s) => zodType((v) => (v === null ? null : s.parse(v))),
	enum: (vals) => zodType((v) => (vals.includes(v) ? v : zodFail("enum")))
};
// --- end mini-zod replica ---

const dir = mkdtempSync(join(tmpdir(), "dsh-git-contract-"));
const repo2 = mkdtempSync(join(tmpdir(), "dsh-git-contract2-"));
const sh = (...args) => spawnSync("git", args, { cwd: dir, stdio: "pipe" });
const results = [];
const check = (name, fn) => { try { fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } };

try {
	sh("init", "-q", "-b", "main");
	sh("config", "user.email", "t@t.t");
	sh("config", "user.name", "T");
	writeFileSync(join(dir, "a.txt"), "hello\n");
	sh("add", "a.txt"); sh("commit", "-qm", "first");
	writeFileSync(join(dir, "b.txt"), "two\n");
	sh("add", "b.txt"); sh("commit", "-qm", "second");
	sh("checkout", "-q", "-b", "feat");
	writeFileSync(join(dir, "c.txt"), "three\n");
	sh("add", "c.txt"); sh("commit", "-qm", "feature work");
	sh("checkout", "-q", "main");
	writeFileSync(join(dir, "a.txt"), "changed\n");
	writeFileSync(join(dir, "u.txt"), "new\n");

	const gateway = Object.create(GitGateway.prototype);
	const manifest = TYPERT;
	const byMethod = Object.fromEntries(manifest.invocations.map((i) => [i.method, i]));

	check("manifest face/package", () => {
		if (manifest.face !== "host") throw new Error("face != host");
		if (manifest.package !== "@dsh-external/dsh-client-ui-git") throw new Error("package mismatch");
		if (!Array.isArray(manifest.invocations) || manifest.invocations.length !== 26) throw new Error("expected 26 invocations, got " + manifest.invocations?.length);
		if (!Array.isArray(manifest.schemas)) throw new Error("schemas must be array");
		if (typeof manifest.model !== "object" || !Array.isArray(manifest.model.services)) throw new Error("model malformed");
	});

	const snapshot = await gateway.snapshot({ path: dir });
	check("host snapshot parses through manifest schema", () => {
		const decoded = byMethod.snapshot.result.schema.parse(snapshot);
		if (!decoded.repo || decoded.branch !== "main") throw new Error("bad decoded snapshot");
		if (!("changes" in decoded && "ahead" in decoded)) throw new Error("missing fields");
	});

	check("host snapshot(not repo) parses through manifest schema", () => {
		const decoded = byMethod.snapshot.result.schema.parse({ repo: false, path: dir });
		if (decoded.repo !== false) throw new Error("bad non-repo");
	});

	const log = await gateway.log({ path: dir, limit: 10 });
	check("host log parses through manifest schema", () => {
		const decoded = byMethod.log.result.schema.parse(log);
		if (decoded.commits.length !== 3) throw new Error("expected 3 commits");
		const head = decoded.commits[0];
		if (!Array.isArray(head.parents) || !Array.isArray(head.refs) || !head.subject) throw new Error("bad commit shape");
	});

	const status = await gateway.status({ path: dir });
	check("host status parses through manifest schema", () => {
		const decoded = byMethod.status.result.schema.parse(status);
		if (decoded.entries.length !== 2) throw new Error("expected 2 entries");
	});

	const diff = await gateway.diff({ path: dir, commit: log.commits[0].hash });
	check("host diff parses through manifest schema", () => {
		const decoded = byMethod.diff.result.schema.parse(diff);
		if (!Array.isArray(decoded.files) || typeof decoded.patch !== "string") throw new Error("bad diff shape");
	});

	check("host diff request schema passes extra fields (passthrough)", () => {
		const param = byMethod.diff.parameters[0];
		const decoded = param.codec.schema.parse({ path: dir, commit: "abc", limit: 5 });
		if (decoded.limit !== 5) throw new Error("passthrough lost extra field");
	});

	// mini-zod: mirror the client-side schemas and parse the same payloads.
	const mzRequest = z.object({ path: z.string() }).passthrough();
	const mzSnapshot = z.union([
		z.object({ repo: z.literal(false), path: z.string() }),
		z.object({ repo: z.literal(true), path: z.string(), root: z.string(), branch: z.string(), head: z.union([z.string(), z.null()]), clean: z.boolean(), changes: z.object({ staged: z.number(), unstaged: z.number(), untracked: z.number(), total: z.number() }), ahead: z.number(), behind: z.number() })
	]);
	const mzLog = z.object({ commits: z.array(z.object({ hash: z.string(), short: z.string(), parents: z.array(z.string()), refs: z.array(z.string()), author: z.string(), email: z.string(), date: z.string(), subject: z.string(), body: z.string() })) });
	const mzStatus = z.object({ clean: z.boolean(), entries: z.array(z.object({ x: z.string(), y: z.string(), path: z.string() })) });
	const mzDiff = z.object({ commit: z.string(), files: z.array(z.object({ path: z.string(), added: z.union([z.number(), z.null()]), removed: z.union([z.number(), z.null()]), binary: z.boolean(), status: z.string() })), patch: z.string(), truncated: z.boolean() });

	check("mini-zod request passthrough", () => {
		const d = mzRequest.parse({ path: dir, limit: 3 });
		if (d.limit !== 3) throw new Error("lost limit");
	});
	check("mini-zod snapshot parse", () => {
		const d = mzSnapshot.parse(snapshot);
		if (!d.repo) throw new Error("bad");
		const n = mzSnapshot.parse({ repo: false, path: dir });
		if (n.repo !== false) throw new Error("bad non-repo");
	});
	check("mini-zod log/status/diff parse", () => {
		mzLog.parse(log);
		mzStatus.parse(status);
		mzDiff.parse(diff);
	});
	check("mini-zod write-result parses ok & error shapes", () => {
		const mzWrite = z.union([
			z.object({ ok: z.literal(true), message: z.string(), id: z.string().optional() }),
			z.object({ ok: z.literal(false), error: z.string() })
		]);
		const ok = mzWrite.parse({ ok: true, message: "m", id: "abc" });
		if (ok.id !== "abc") throw new Error("id lost");
		mzWrite.parse({ ok: true, message: "m" }); // id optional
		const err = mzWrite.parse({ ok: false, error: "boom" });
		if (err.ok !== false) throw new Error("bad error shape");
	});
	check("mini-zod merge result parses conflicts", () => {
		const mzMerge = z.union([
			z.object({ ok: z.literal(true), message: z.string() }),
			z.object({ ok: z.literal(false), error: z.string(), conflicts: z.array(z.string()).optional() })
		]);
		const c = mzMerge.parse({ ok: false, error: "conflict", conflicts: ["a.txt", "b.txt"] });
		if (c.conflicts.length !== 2) throw new Error("conflicts lost");
		mzMerge.parse({ ok: false, error: "conflict" }); // conflicts optional
	});
	check("mini-zod rejects missing fields", () => {
		let threw = false;
		try { mzSnapshot.parse({ repo: true, path: dir }); } catch { threw = true; }
		if (!threw) throw new Error("should have thrown");
	});

	// --- branch management / conflict contract (independent repository) ---
	const sh2 = (...args) => spawnSync("git", args, { cwd: repo2, stdio: "pipe" });
	sh2("init", "-q", "-b", "main");
	sh2("config", "user.email", "t@t.t");
	sh2("config", "user.name", "T");
	writeFileSync(join(repo2, "f.txt"), "base\n");
	sh2("add", "f.txt");
	sh2("commit", "-qm", "base");
	sh2("checkout", "-q", "-b", "side");
	writeFileSync(join(repo2, "f.txt"), "side\n");
	sh2("commit", "-qam", "side");
	sh2("checkout", "-q", "main");
	writeFileSync(join(repo2, "f.txt"), "main\n");
	sh2("commit", "-qam", "main");

	const details = await gateway.branchDetails({ path: repo2 });
	check("branchDetails parses through manifest schema", () => {
		const decoded = byMethod.branchDetails.result.schema.parse(details);
		const side = decoded.branches.find((branch) => branch.name === "side");
		if (side === void 0 || side.created === null) throw new Error("missing branch detail");
		if (side.created.from !== "main" && side.created.from !== "HEAD") throw new Error("creation source wrong: " + side.created.from);
	});

	const mergedAgain = await gateway.merge({ path: repo2, target: "side", mode: "no-ff" });
	const operation = await gateway.repoOperation({ path: repo2 });
	check("repoOperation parses through manifest schema", () => {
		if (mergedAgain.ok !== false) throw new Error("merge should conflict");
		const decoded = byMethod.repoOperation.result.schema.parse(operation);
		if (decoded.operation === null || decoded.operation.kind !== "merge") throw new Error("bad operation");
		if (decoded.operation.source !== "side" || decoded.operation.target !== "main") throw new Error("bad direction");
		if (decoded.conflicts.length !== 1 || decoded.conflicts[0].blocks !== 1) throw new Error("bad conflicts");
	});

	const conflict = await gateway.conflictFile({ path: repo2, file: "f.txt" });
	check("conflictFile parses through manifest schema", () => {
		const decoded = byMethod.conflictFile.result.schema.parse(conflict);
		if (!decoded.worktree.includes("<<<<<<<")) throw new Error("markers missing");
		if (!decoded.ours.includes("main") || !decoded.theirs.includes("side")) throw new Error("sides wrong");
	});

	writeFileSync(join(repo2, "f.txt"), "resolved\n");
	sh2("add", "f.txt");
	const continued = await gateway.operationContinue({ path: repo2, kind: "merge" });
	check("operationContinue parses through manifest schema", () => {
		const decoded = byMethod.operationContinue.result.schema.parse(continued);
		if (decoded.ok !== true) throw new Error("continue failed");
	});

	const orphans = await gateway.orphanedCommits({ path: repo2 });
	check("orphanedCommits parses through manifest schema", () => {
		const decoded = byMethod.orphanedCommits.result.schema.parse(orphans);
		if (decoded.ok !== true || !Array.isArray(decoded.commits)) throw new Error("bad orphans");
	});

	const exclusive = await gateway.branchExclusiveCommits({ path: repo2, name: "side" });
	check("branchExclusiveCommits parses through manifest schema", () => {
		const decoded = byMethod.branchExclusiveCommits.result.schema.parse(exclusive);
		if (decoded.ok !== true) throw new Error("bad exclusive");
	});

	sh2("branch", "tmp");
	const renamed = await gateway.renameBranch({ path: repo2, from: "tmp", to: "tmp2" });
	check("renameBranch parses through manifest schema", () => {
		const decoded = byMethod.renameBranch.result.schema.parse(renamed);
		if (decoded.ok !== true) throw new Error("rename failed");
	});

	const removed = await gateway.deleteBranch({ path: repo2, name: "tmp2" });
	check("deleteBranch parses through manifest schema", () => {
		const decoded = byMethod.deleteBranch.result.schema.parse(removed);
		if (decoded.ok !== true) throw new Error("delete failed");
	});

	const restored = await gateway.restore({ path: repo2 });
	check("restore request without commit passes the manifest", () => {
		const decoded = byMethod.restore.result.schema.parse(restored);
		if (decoded.ok !== true) throw new Error("restore failed");
	});

	// client.js no longer embeds the remote contribution: the mount moved to
	// the separate @dsh-external/dsh-client-git-remote bundle (official
	// api-remotes split, because cordis inject guards nested ctx access).
	const clientSource = readFileSync(new URL("./lib/client.js", import.meta.url), "utf8");
	check("client.js declares remote.git inject + slot", () => {
		if (!clientSource.includes('"remote.git"')) throw new Error("missing remote.git inject");
		if (!clientSource.includes("sidebar.footer.action")) throw new Error("missing slot registration");
		if (clientSource.includes("$mount")) throw new Error("mount must live in git-remote, not ui");
	});
	const remoteSource = readFileSync(new URL("./packages/dsh-client-git-remote/lib/client.js", import.meta.url), "utf8");
	check("git-remote bundle embeds mount", () => {
		if (!remoteSource.includes("$mount")) throw new Error("missing $mount");
		const marshalCalls = (remoteSource.match(/descrip\("/g) ?? []).length;
		if (marshalCalls !== 26) throw new Error("expected 26 descriptors, got " + marshalCalls);
		if (!remoteSource.includes('package: "@dsh-external/dsh-client-git-remote"')) throw new Error("missing package id");
	});

	console.log(results.join("\n"));
	console.log(process.exitCode === 1 ? "\nSOME CHECKS FAILED" : "\nALL CONTRACT CHECKS PASSED");
} finally {
	rmSync(dir, { recursive: true, force: true });
	rmSync(repo2, { recursive: true, force: true });
}
