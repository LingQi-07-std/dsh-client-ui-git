// Install + deployment verification.
//  1. the package resolves from the live profile's node_modules (real install)
//  2. the workspace host half imports (deps come from the workspace node_modules
//     junctions — the profile keeps no copy of the Harness packages)
//  3. the TYPERT manifest passes typert-loader's validation rules
//  4. the installed client bundle is a ModuleLoader bundle
//  5. the installed files are byte-identical to the workspace (deploy drift check)
//
// Profile: DSH_PROFILE_DIR (injected by DSH) or the desktop default.
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WORKSPACE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = process.env.DSH_PROFILE_DIR ?? "C:/Users/13953/.dsh/profiles/desktop";
const PROFILE_NM = join(PROFILE_DIR, "node_modules");
const PKG = "@dsh-external/dsh-client-ui-git";
const require = createRequire(join(PROFILE_NM, "noop.js"));
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const results = [];
let failed = 0;

/** Run one named check (sync or async) and record the outcome. */
async function check(name, fn) {
	try {
		await fn();
		results.push(`PASS ${name}`);
	} catch (error) {
		results.push(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
		failed += 1;
	}
}

// 1. package.json resolves and carries the dsh declarations
let installedPkgDir = null;
await check("package.json resolves from profile", () => {
	const pkgPath = require.resolve(`${PKG}/package.json`);
	if (!pkgPath.includes("profiles")) throw new Error(`resolved outside profile: ${pkgPath}`);
	installedPkgDir = dirname(pkgPath);
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	if (pkg.name !== PKG) throw new Error("name mismatch");
	if (pkg.dsh?.client?.platform !== "web") throw new Error("missing dsh.client platform web");
	if (!pkg.dsh?.bundle?.patch) throw new Error("missing dsh.bundle.patch (bundle layer lost)");
	if (!existsSync(join(installedPkgDir, pkg.dsh.bundle.patch))) throw new Error("bundle patch file missing");
	if (!pkg.exports?.["./client"]) throw new Error("missing ./client export");
	if (!pkg.exports?.["./typert"]) throw new Error("missing ./typert export");
	if (!pkg.exports?.["./locale/*.json"]) throw new Error("missing locale export");
	if (!pkg.engines?.dsh) throw new Error("missing engines.dsh (exact pins break on upgrades)");
});

// 2. workspace host half imports (its Harness deps resolve via node_modules junctions)
await check("workspace host half imports", async () => {
	const mod = await import(pathToFileURL(join(WORKSPACE, "lib", "index.js")).href);
	if (typeof mod.GitGateway !== "function") throw new Error("GitGateway not exported");
	for (const method of ["snapshot", "log", "status", "diff", "branch", "commit", "checkout", "restore", "reset"]) {
		if (typeof mod.GitGateway.prototype[method] !== "function") throw new Error(`missing method ${method}`);
	}
});

// 3. typert manifest loads and passes typert-loader validation rules
await check("workspace TYPERT manifest validates", async () => {
	const mod = await import(pathToFileURL(join(WORKSPACE, "lib", "typert.host.js")).href);
	const manifest = mod.TYPERT;
	if (manifest.package !== PKG) throw new Error("manifest package mismatch");
	if (manifest.face !== "host") throw new Error("face must be host");
	if (!Array.isArray(manifest.schemas)) throw new Error("schemas array");
	if (!Array.isArray(manifest.invocations) || manifest.invocations.length !== 14) throw new Error("14 invocations, got " + manifest.invocations?.length);
	if (!manifest.model?.services || !manifest.model?.events || !manifest.model?.objects) throw new Error("model shape");
	for (const inv of manifest.invocations) {
		if (!inv.id || !inv.service || !inv.namespace || !inv.method) throw new Error(`bad invocation ${inv.id}`);
		if (inv.invocation?.kind !== "direct") throw new Error(`bad receiver ${inv.id}`);
		for (const p of inv.parameters) {
			if (!p.name || !p.wire || !["json", "lookup"].includes(p.source)) throw new Error(`bad parameter ${inv.id}`);
			if (p.codec?.mode !== "strict" || !p.codec.typeSymbol || typeof p.codec.schema?.parse !== "function" || !("_zod" in p.codec.schema)) throw new Error(`bad codec ${inv.id}`);
		}
		if (inv.result?.mode !== "strict" || !inv.result.typeSymbol || typeof inv.result.schema?.parse !== "function") throw new Error(`bad result codec ${inv.id}`);
	}
});

// 4. installed client bundle shape
await check("installed client bundle shape", () => {
	const source = readFileSync(require.resolve(`${PKG}/client`), "utf8");
	if (!source.includes("window.__ModuleLoader__.load({")) throw new Error("not a ModuleLoader bundle");
	if (!source.includes(`"${PKG}"`)) throw new Error("missing bundle id");
	if (!source.includes("exports.apply") || !source.includes("exports.inject")) throw new Error("missing apply/inject exports");
	if (!source.includes("sidebar.footer.action")) throw new Error("missing footer slot");
});

// 5. deployed files must equal the workspace files (deploy drift)
await check("deployed files match workspace", () => {
	if (installedPkgDir === null) throw new Error("skip: package did not resolve");
	const files = ["package.json", "cordis.patch.yml", "README.md", "lib/index.js", "lib/client.js", "lib/git-core.mjs", "lib/typert.host.js", "locale/en.json", "locale/zh.json"];
	const drifted = [];
	for (const rel of files) {
		const workspaceFile = join(WORKSPACE, rel);
		const installedFile = join(installedPkgDir, rel);
		if (!existsSync(workspaceFile)) { drifted.push(`${rel} (workspace missing)`); continue; }
		if (!existsSync(installedFile)) { drifted.push(`${rel} (not deployed)`); continue; }
		if (sha(workspaceFile) !== sha(installedFile)) drifted.push(`${rel} (content differs)`);
	}
	if (drifted.length > 0) throw new Error("deploy drift: " + drifted.join(", "));
});

console.log(results.join("\n"));
process.exitCode = failed > 0 ? 1 : 0;
console.log(process.exitCode === 1 ? "\nSOME INSTALL CHECKS FAILED" : "\nALL INSTALL CHECKS PASSED");
