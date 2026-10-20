// Install verification: resolve the plugin from the web profile's node_modules
// the same way dsh-typert-loader / dsh-client-modules do, and run the
// typert-loader manifest validation rules against the installed files.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const PROFILE_NM = "C:/Users/13953/AppData/Roaming/deepseek-harness-desktop/harness-home/profiles/node_modules";
const PKG = "@dsh-external/dsh-client-ui-git";
const require = createRequire(join(PROFILE_NM, "noop.js"));
const results = [];
const check = (name, fn) => { try { fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } };

// 1. package.json resolves and carries the dsh.client declaration
check("package.json resolves from profile", () => {
	const pkgPath = require.resolve(`${PKG}/package.json`);
	if (!pkgPath.includes("profiles")) throw new Error(`resolved outside profile: ${pkgPath}`);
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	if (pkg.name !== PKG) throw new Error("name mismatch");
	if (!pkg.dsh?.client || pkg.dsh.client.platform !== "web") throw new Error("missing dsh.client platform web");
	if (!pkg.exports?.["./client"]) throw new Error("missing ./client export");
	if (!pkg.exports?.["./typert"]) throw new Error("missing ./typert export");
});

// 2. host half imports (its deps resolve from the profile node_modules)
check("host half imports from profile", async () => {
	const mod = await import(pathToFileURL(require.resolve(PKG)).href);
	if (typeof mod.GitGateway !== "function") throw new Error("GitGateway not exported");
	const proto = mod.GitGateway.prototype;
	for (const method of ["snapshot", "log", "status", "diff"]) {
		if (typeof proto[method] !== "function") throw new Error(`missing method ${method}`);
	}
});

// 3. typert manifest loads and passes typert-loader validation rules
check("TYPERT manifest loads and validates", async () => {
	const typertPath = join(dirname(require.resolve(`${PKG}/package.json`)), "lib", "typert.host.js");
	const mod = await import(pathToFileURL(typertPath).href);
	const manifest = mod.TYPERT;
	if (manifest.package !== PKG) throw new Error("manifest package mismatch");
	if (manifest.face !== "host") throw new Error("face must be host");
	if (!Array.isArray(manifest.schemas)) throw new Error("schemas array");
	if (!Array.isArray(manifest.invocations) || manifest.invocations.length !== 14) throw new Error("14 invocations, got " + manifest.invocations?.length);
	if (!manifest.model || !Array.isArray(manifest.model.services) || !Array.isArray(manifest.model.events) || !Array.isArray(manifest.model.objects)) throw new Error("model shape");
	for (const inv of manifest.invocations) {
		if (!inv.id || !inv.service || !inv.namespace || !inv.method) throw new Error(`bad invocation ${inv.id}`);
		if (inv.invocation?.kind !== "direct") throw new Error(`bad receiver ${inv.id}`);
		for (const p of inv.parameters) {
			if (!p.name || !p.wire || !["json", "lookup"].includes(p.source)) throw new Error(`bad parameter ${inv.id}`);
			if (p.codec?.mode !== "strict" || !p.codec.typeSymbol || !p.codec.schema || typeof p.codec.schema.parse !== "function" || !("_zod" in p.codec.schema)) throw new Error(`bad codec ${inv.id}`);
		}
		if (inv.result?.mode !== "strict" || !inv.result.typeSymbol || typeof inv.result.schema?.parse !== "function") throw new Error(`bad result codec ${inv.id}`);
	}
});

// 4. client bundle file exists and is loadable as a module graph row
check("client bundle shape", () => {
	const clientPath = require.resolve(`${PKG}/client`);
	const source = readFileSync(clientPath, "utf8");
	if (!source.includes('window.__ModuleLoader__.load({')) throw new Error("not a ModuleLoader bundle");
	if (!source.includes('"@dsh-external/dsh-client-ui-git"')) throw new Error("missing bundle id");
	if (!source.includes("exports.apply") || !source.includes("exports.inject")) throw new Error("missing apply/inject exports");
});

console.log(results.join("\n"));
console.log(process.exitCode === 1 ? "\nSOME INSTALL CHECKS FAILED" : "\nALL INSTALL CHECKS PASSED");
