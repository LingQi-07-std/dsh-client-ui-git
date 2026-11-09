// Plugin-local persistence.
//
// Data lives OUTSIDE the installed package: pnpm installs replace the whole
// package directory, so a store inside it (the old `<plugin>/.data/state.json`)
// was wiped by any dependency upgrade. The new home is
// `$DSH_HOME/plugin-data/dsh-client-ui-git/state.json`; the old file is migrated
// on first read. The host half is the only writer; the browser talks to it
// through the two Remote methods in ./index.js.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
// Where settings used to live (inside the package, so a reinstall erased them).
const LEGACY_DIR = join(PLUGIN_ROOT, ".data");

function dshHome() {
	const home = process.env.DSH_HOME;
	if (typeof home === "string" && home.length > 0) return home;
	return join(homedir(), ".dsh");
}

// `DSH_GIT_STATE_DIR` lets tests point the store somewhere disposable; the
// production location is always `$DSH_HOME/plugin-data/dsh-client-ui-git`.
function dataDir() {
	const override = process.env.DSH_GIT_STATE_DIR;
	return typeof override === "string" && override.length > 0 ? override : join(dshHome(), "plugin-data", "dsh-client-ui-git");
}
const stateFile = () => join(dataDir(), "state.json");

/** Serialize writes so two panel actions cannot interleave read-modify-write. */
let writeQueue = Promise.resolve();

async function parseFile(file) {
	const text = await readFile(file, "utf8");
	const data = JSON.parse(text);
	return data !== null && typeof data === "object" && Array.isArray(data) === false ? data : null;
}

async function readAll() {
	try {
		const data = await parseFile(stateFile());
		if (data !== null) return data;
	} catch (error) {
		// Missing or corrupt file: fall through to the legacy migration.
	}
	// One-time migration: settings written before the move are copied over so a
	// reinstall after upgrading this plugin does not lose anything.
	try {
		const legacy = await parseFile(join(LEGACY_DIR, "state.json"));
		if (legacy !== null) {
			await writeAll(legacy);
			return legacy;
		}
	} catch (error) {
		// No legacy file, or it was already removed: start empty.
	}
	return {};
}

async function writeAll(data) {
	await mkdir(dataDir(), { recursive: true });
	const temp = `${stateFile()}.tmp`;
	await writeFile(temp, `${JSON.stringify(data, null, "\t")}\n`, "utf8");
	await rename(temp, stateFile());
}

/** Read one key; returns its JSON text, or "null" when unset. */
export async function readState(key) {
	const name = String(key ?? "").trim();
	if (name.length === 0) throw new Error("缺少 key");
	const data = await readAll();
	return Object.prototype.hasOwnProperty.call(data, name) ? JSON.stringify(data[name]) : "null";
}

/** Write one key; `valueText` is JSON text. Serialized through a queue. */
export async function writeState(key, valueText) {
	const name = String(key ?? "").trim();
	if (name.length === 0) throw new Error("缺少 key");
	let value;
	try {
		value = JSON.parse(String(valueText ?? "null"));
	} catch (error) {
		throw new Error("value 不是合法 JSON");
	}
	const run = writeQueue.then(async () => {
		const data = await readAll();
		data[name] = value;
		await writeAll(data);
	});
	writeQueue = run.catch(() => void 0);
	await run;
	return true;
}

export { dataDir, stateFile };
