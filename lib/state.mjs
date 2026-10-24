// Plugin-local persistence.
//
// Data lives next to the installed plugin (`.data/state.json`), not in the
// workspace and not in browser storage: removing the plugin removes its data,
// and no repository gets polluted. The host half is the only writer; the
// browser talks to it through the two Remote methods in ./index.js.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
// `DSH_GIT_STATE_DIR` lets tests point the store somewhere disposable; the
// production location is always `<plugin>/.data`.
function dataDir() {
	const override = process.env.DSH_GIT_STATE_DIR;
	return typeof override === "string" && override.length > 0 ? override : join(PLUGIN_ROOT, ".data");
}
const stateFile = () => join(dataDir(), "state.json");

/** Serialize writes so two panel actions cannot interleave read-modify-write. */
let writeQueue = Promise.resolve();

async function readAll() {
	try {
		const text = await readFile(stateFile(), "utf8");
		const data = JSON.parse(text);
		return data !== null && typeof data === "object" && Array.isArray(data) === false ? data : {};
	} catch (error) {
		// Missing or corrupt file: start from an empty object.
		return {};
	}
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
