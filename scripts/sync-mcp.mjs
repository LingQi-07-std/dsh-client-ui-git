// Deploy the MCP server: the plugin repo is the source of truth, the running
// copy lives in $DSH_HOME/mcp-git (it owns node_modules + its own process).
//
//   node scripts/sync-mcp.mjs            # back up + deploy server.mjs and git-core.mjs
//   node scripts/sync-mcp.mjs --check    # verify only, exit 1 on drift
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const targetDir = process.env.DSH_MCP_GIT_DIR ?? join(process.env.DSH_HOME ?? "C:/Users/13953/.dsh", "mcp-git");
const checkOnly = process.argv.includes("--check");
const normalize = (value) => value.replace(/\r\n/g, "\n").trimEnd();

const pairs = [
	[join(root, "mcp", "server.mjs"), join(targetDir, "server.mjs")],
	[join(root, "lib", "git-core.mjs"), join(targetDir, "git-core.mjs")]
];

if (!existsSync(targetDir)) {
	console.error(`target dir missing: ${targetDir}`);
	process.exit(2);
}

let drift = 0;
for (const [source, target] of pairs) {
	if (!existsSync(source)) {
		console.error(`source missing: ${source}`);
		process.exit(2);
	}
	if (!existsSync(target)) {
		console.error(`target missing: ${target}`);
		drift += 1;
		continue;
	}
	if (normalize(readFileSync(source, "utf8")) === normalize(readFileSync(target, "utf8"))) {
		console.log(`in sync: ${target}`);
	} else {
		drift += 1;
		console.log(`differs: ${target}`);
	}
}

if (checkOnly) {
	process.exit(drift === 0 ? 0 : 1);
}

if (drift === 0) {
	console.log("nothing to deploy");
	process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const [source, target] of pairs) {
	if (!existsSync(target)) continue;
	if (normalize(readFileSync(source, "utf8")) === normalize(readFileSync(target, "utf8"))) continue;
	copyFileSync(target, `${target}.bak-${stamp}`);
	copyFileSync(source, target);
	console.log(`deployed: ${source} -> ${target} (backup .bak-${stamp})`);
}
