// Keep the two git-core copies in step: the workspace copy is the source of
// truth, the MCP server runs its own copy under $DSH_HOME/mcp-git so it stays
// standalone (no cross-directory import at runtime).
//
//   node scripts/sync-git-core.mjs          # workspace -> MCP copy
//   node scripts/sync-git-core.mjs --check  # verify only, exit 1 on drift
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "lib", "git-core.mjs");
const target = process.env.DSH_GIT_CORE_TARGET ?? join(process.env.DSH_HOME ?? "C:/Users/13953/.dsh", "mcp-git", "git-core.mjs");
const checkOnly = process.argv.includes("--check");
const normalize = (text) => text.replace(/\r\n/g, "\n").trimEnd();

if (!existsSync(source)) {
	console.error(`source missing: ${source}`);
	process.exit(2);
}
if (!existsSync(target)) {
	console.error(`target missing: ${target} (is the git MCP server installed?)`);
	process.exit(2);
}

const from = normalize(readFileSync(source, "utf8"));
const to = normalize(readFileSync(target, "utf8"));

if (checkOnly) {
	if (from === to) {
		console.log(`git-core in sync: ${target}`);
	} else {
		console.error(`git-core DRIFT: ${target} differs from ${source}`);
		process.exit(1);
	}
} else if (from === to) {
	console.log("git-core already in sync");
} else {
	writeFileSync(target, from + "\n", "utf8");
	console.log(`git-core synced -> ${target}`);
}
