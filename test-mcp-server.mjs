// MCP server contract test: boots the real stdio server, lists its tools, and
// verifies that the dangerous set (restore / reset) is absent by default but
// appears when the opt-in switch is on.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = process.env.DSH_MCP_GIT_DIR ?? join(process.env.DSH_HOME ?? "C:/Users/13953/.dsh", "mcp-git");
const serverFile = join(serverDir, "server.mjs");
const results = [];
let failed = 0;
const check = (name, fn) => {
	try {
		fn();
		results.push(`PASS ${name}`);
	} catch (error) {
		results.push(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
		failed += 1;
	}
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

/** Start the server, complete the MCP handshake, and return the tool names. */
function listTools(extraEnv = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [serverFile], {
			cwd: serverDir,
			env: { ...process.env, ...extraEnv },
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true
		});
		let buffer = "";
		let stderr = "";
		let pending = null;
		const timer = setTimeout(() => {
			child.kill();
			reject(new Error(`timeout while listing tools (stderr: ${stderr.slice(0, 300)})`));
		}, 15_000);
		const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`);
		const finish = () => {
			clearTimeout(timer);
			child.kill();
		};
		child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
		child.stdout.on("data", (chunk) => {
			buffer += chunk.toString("utf8");
			let index = buffer.indexOf("\n");
			while (index >= 0) {
				const line = buffer.slice(0, index).trim();
				buffer = buffer.slice(index + 1);
				index = buffer.indexOf("\n");
				if (line.length === 0) continue;
				let message = null;
				try { message = JSON.parse(line); } catch { continue; }
				if (message.id === 2 && pending === "list") {
					const tools = message.result?.tools ?? [];
					pending = null;
					finish();
					resolve(tools.map((tool) => tool.name));
					return;
				}
				if (message.id === 1) {
					send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
					pending = "list";
					send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
				}
			}
		});
		child.on("error", (error) => { clearTimeout(timer); reject(error); });
		child.on("exit", (code) => {
			if (pending === "list") {
				clearTimeout(timer);
				reject(new Error(`server exited (${code}) before answering: ${stderr.slice(0, 300)}`));
			}
		});
		send({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "dsh-git-test", version: "1.0.0" }
			}
		});
	});
}

const expected = [
	"snapshot", "log", "status", "diff", "show_file", "branch", "is_repo", "blame", "reflog",
	"init", "commit", "add", "unstage", "create_branch", "branch_admin", "checkout", "revert",
	"merge", "reset_soft", "abort", "stash", "tag"
];

/** Boot the server, run one tool call, and return its parsed JSON payload. */
function callTool(name, args = {}, extraEnv = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [serverFile], {
			cwd: serverDir,
			env: { ...process.env, ...extraEnv },
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true
		});
		let buffer = "";
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill();
			reject(new Error(`timeout while calling ${name} (stderr: ${stderr.slice(0, 300)})`));
		}, 20_000);
		const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`);
		const finish = (error, value) => {
			clearTimeout(timer);
			child.kill();
			if (error) reject(error);
			else resolve(value);
		};
		child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
		child.stdout.on("data", (chunk) => {
			buffer += chunk.toString("utf8");
			let index = buffer.indexOf("\n");
			while (index >= 0) {
				const line = buffer.slice(0, index).trim();
				buffer = buffer.slice(index + 1);
				index = buffer.indexOf("\n");
				if (line.length === 0) continue;
				let message = null;
				try { message = JSON.parse(line); } catch { continue; }
				if (message.id === 1) {
					send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
					send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } });
					continue;
				}
				if (message.id === 2) {
					if (message.error) { finish(new Error(JSON.stringify(message.error))); return; }
					const text = message.result?.content?.find((part) => part.type === "text")?.text ?? "{}";
					try { finish(null, JSON.parse(text)); } catch { finish(new Error(`non-JSON tool output: ${text.slice(0, 200)}`)); }
					return;
				}
			}
		});
		child.on("error", (error) => { clearTimeout(timer); reject(error); });
		child.on("exit", (code) => {
			if (code !== 0 && code !== null) {
				clearTimeout(timer);
				reject(new Error(`server exited (${code}) during ${name}: ${stderr.slice(0, 300)}`));
			}
		});
		send({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2024-11-05",
				capabilities: {},
				clientInfo: { name: "dsh-git-test", version: "1.0.0" }
			}
		});
	});
}

const defaultTools = await listTools();
check("server lists the local tool set", () => {
	for (const name of expected) assert(defaultTools.includes(name), `missing tool: ${name}`);
});
check("dangerous tools are NOT exposed by default", () => {
	assert(!defaultTools.includes("restore"), "restore leaked into the default surface");
	assert(!defaultTools.includes("reset"), "reset leaked into the default surface");
});
check("no network tools are exposed", () => {
	for (const name of ["fetch", "pull", "push", "remote"]) {
		assert(!defaultTools.includes(name), `${name} should not exist yet`);
	}
});

const optInTools = await listTools({ DSH_GIT_ALLOW_DANGEROUS: "1" });
check("opt-in switch enables restore/reset", () => {
	assert(optInTools.includes("restore"), "restore missing after opt-in");
	assert(optInTools.includes("reset"), "reset missing after opt-in");
});
check("opt-in keeps the default surface intact", () => {
	for (const name of expected) assert(optInTools.includes(name), `opt-in dropped tool: ${name}`);
});

const workspace = join(here);
const snapshot = await callTool("snapshot", { path: workspace });
check("tools/call reaches the git layer", () => {
	assert(snapshot.repo === true, `snapshot failed: ${JSON.stringify(snapshot).slice(0, 200)}`);
	assert(typeof snapshot.branch === "string", "branch missing");
});

const working = await callTool("diff", { path: workspace });
check("working-tree diff call answers", () => {
	assert(Array.isArray(working.files), `diff failed: ${JSON.stringify(working).slice(0, 200)}`);
});

const badCall = await callTool("snapshot", { path: join(here, "does-not-exist") });
check("bad path returns a structured error", () => {
	assert(badCall.ok === false, "expected a failure payload");
	assert(typeof badCall.error === "string" && badCall.error.length > 0, "error text missing");
});

console.log(results.join("\n"));
console.log(`default tools: ${defaultTools.length} · opt-in tools: ${optInTools.length}`);
process.exitCode = failed > 0 ? 1 : 0;
console.log(process.exitCode === 1 ? "\nSOME MCP SERVER CHECKS FAILED" : "\nALL MCP SERVER CHECKS PASSED");
