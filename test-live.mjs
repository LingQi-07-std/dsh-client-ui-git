// Diagnostic: simulate the exact client-side call chain against the live host
// git Remote on G:\DSH-PERSONALIZE, then parse the real payloads with the
// git-remote bundle's mini-zod schema (same as the browser does). Any parse
// failure here is a candidate for the client crash.
import { readFileSync } from "node:fs";

// 端口每次重启都会变：从 DSH_WEB_URL 取（可带 GUI 地址栏里的 ?token=…），
// 再不行用当前 GUI 的默认端口。用法：node test-live.mjs [仓库目录]
const BASE_URL = process.env.DSH_WEB_URL ?? "http://127.0.0.1:52493";
const path = process.argv[2] ?? process.cwd();

async function rpc(method, request) {
	const body = JSON.stringify({ type: "client-request", rpcId: "diag-" + Math.random().toString(36).slice(2), method: "git/" + method, payload: { args: { request } } });
	const base = new URL(BASE_URL);
	const url = new URL(`/api/git/${method}`, base);
	url.search = base.search; // 带上 GUI URL 里的认证 query
	const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
	if (res.status === 401) {
		throw new Error("HTTP 401：需要认证。把 GUI 地址栏里的完整 URL（含 ?token=…）赋给 DSH_WEB_URL 再跑。");
	}
	return res.json();
}

// --- mini-zod replica of git-remote bundle (must mirror exactly) ---
function zodFail(message) { const e = new Error(message); e.name = "ZodError"; throw e; }
function zodType(parse) { const s = { parse }; s.passthrough = () => zodType((v) => { const p = parse(v); return p !== void 0 && typeof p === "object" && p !== null ? { ...p, ...v } : p; }); Object.defineProperty(s, "_zod", { value: { traits: new Set() } }); return s; }
const z = {
	string: () => zodType((v) => (typeof v === "string" ? v : zodFail("string"))),
	number: () => zodType((v) => (typeof v === "number" && Number.isFinite(v) ? v : zodFail("number"))),
	boolean: () => zodType((v) => (typeof v === "boolean" ? v : zodFail("boolean"))),
	null: () => zodType((v) => (v === null ? v : zodFail("null"))),
	literal: (value) => zodType((v) => (v === value ? v : zodFail("literal"))),
	union: (options) => zodType((v) => { for (const o of options) { try { return o.parse(v); } catch { } } return zodFail("union"); }),
	array: (el) => zodType((v) => (Array.isArray(v) ? v.map((i) => el.parse(i)) : zodFail("array"))),
	object: (shape) => zodType((v) => { const out = {}; for (const key of Object.keys(shape)) { if (!Object.prototype.hasOwnProperty.call(v, key)) return zodFail("missing " + key); const parsed = shape[key].parse(v[key]); if (parsed !== void 0) out[key] = parsed; } return out; }),
	optional: (s) => zodType((v) => (v === void 0 ? void 0 : s.parse(v))),
	nullable: (s) => zodType((v) => (v === null ? null : s.parse(v)))
};
const gitRequest = z.object({ path: z.string() }).passthrough();
const gitSnapshotResult = z.union([
	z.object({ repo: z.literal(false), path: z.string() }),
	z.object({ repo: z.literal(true), path: z.string(), root: z.string(), branch: z.string(), head: z.union([z.string(), z.null()]), clean: z.boolean(), changes: z.object({ staged: z.number(), unstaged: z.number(), untracked: z.number(), total: z.number() }), ahead: z.number(), behind: z.number() })
]);
const gitCommit = z.object({ hash: z.string(), short: z.string(), parents: z.array(z.string()), refs: z.array(z.string()), author: z.string(), email: z.string(), date: z.string(), subject: z.string() });
const gitLogResult = z.object({ commits: z.array(gitCommit) });
const gitStatusResult = z.object({ clean: z.boolean(), entries: z.array(z.object({ x: z.string(), y: z.string(), path: z.string() })) });
const gitDiffResult = z.object({ commit: z.string(), files: z.array(z.object({ path: z.string(), added: z.union([z.number(), z.null()]), removed: z.union([z.number(), z.null()]), binary: z.boolean() })), patch: z.string(), truncated: z.boolean() });
// --- end mini-zod ---

const results = [];
const check = (name, fn) => { try { fn(); results.push("PASS " + name); } catch (e) { results.push("FAIL " + name + ": " + e.message); process.exitCode = 1; } };

const snapshotResp = await rpc("snapshot", { path });
check("snapshot ok", () => { if (!snapshotResp.result?.ok) throw new Error(JSON.stringify(snapshotResp.result?.error)); });
check("snapshot mini-zod parses + has changes", () => {
	const value = snapshotResp.result.value;
	const parsed = gitSnapshotResult.parse(value);
	if (parsed.changes === void 0 && parsed.repo === true) throw new Error("changes missing after parse");
	if (typeof parsed.changes?.total !== "number") throw new Error("changes.total not number");
});

const logResp = await rpc("log", { path, limit: 60 });
check("log ok", () => { if (!logResp.result?.ok) throw new Error(JSON.stringify(logResp.result?.error)); });
check("log mini-zod parses, every commit shape", () => {
	const value = logResp.result.value;
	const parsed = gitLogResult.parse(value);
	if (parsed.commits.length === 0) throw new Error("no commits");
	for (const c of parsed.commits) {
		if (!Array.isArray(c.parents) || !Array.isArray(c.refs)) throw new Error("bad refs/parents");
		if (typeof c.subject !== "string" || typeof c.date !== "string") throw new Error("bad subject/date");
	}
});

const statusResp = await rpc("status", { path });
check("status ok", () => { if (!statusResp.result?.ok) throw new Error(JSON.stringify(statusResp.result?.error)); });
check("status mini-zod parses", () => { gitStatusResult.parse(statusResp.result.value); });

const diffResp = await rpc("diff", { path, commit: logResp.result.value.commits[0].hash });
check("diff ok", () => { if (!diffResp.result?.ok) throw new Error(JSON.stringify(diffResp.result?.error)); });
check("diff mini-zod parses", () => { gitDiffResult.parse(diffResp.result.value); });

// Director the UI touches: changes.total shown on badge — confirm the exact
// expression GitFooterAction evaluates with real data.
check("badge expression safe", () => {
	const snapshot = snapshotResp.result.value;
	const count = snapshot.repo === true && snapshot.clean === false ? snapshot.changes.total : 0;
	if (typeof count !== "number") throw new Error("badge count not number: " + count);
});

console.log(results.join("\n"));
console.log(process.exitCode === 1 ? "DIAG FAILED" : "ALL DIAG CHECKS PASSED");
