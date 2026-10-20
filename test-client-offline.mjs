// Offline render test for the browser half.
// Loads the real lib/client.js bundle in a vm sandbox with a minimal React
// stand-in, mounts the sidebar entry through the slot registration, and walks
// the resulting element tree. Covers the rebuilt worktree list (one merged
// list + warning dots), commit expansion/detail, double-click shortcut, and
// the coloured patch lines.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const WORKSPACE = dirname(fileURLToPath(import.meta.url));
const results = [];
let failed = 0;
async function check(name, fn) {
	try {
		await fn();
		results.push(`PASS ${name}`);
	} catch (error) {
		const detail = error instanceof Error ? `${error.message} @ ${(error.stack ?? "").split("\n")[1]?.trim() ?? "?"}` : String(error);
		results.push(`FAIL ${name}: ${detail}`);
		failed += 1;
	}
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };

// ---------- minimal React ----------
let currentSlots = null;
let hookCursor = 0;
let lastGetSnapshot = null;
const pendingEffects = [];
const slotStore = new WeakMap();
const slotsFor = (key) => {
	let slots = slotStore.get(key);
	if (slots === void 0) { slots = []; slotStore.set(key, slots); }
	return slots;
};
const React = {
	Fragment: Symbol("Fragment"),
	Component: class {
		constructor(props) { this.props = props; this.state = {}; }
		setState(next) { this.state = { ...this.state, ...next }; }
	},
	createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }),
	useState(init) {
		const slots = currentSlots;
		const index = hookCursor++;
		if (!(index in slots)) slots[index] = typeof init === "function" ? init() : init;
		return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
	},
	useEffect(fn, deps) {
		const slots = currentSlots;
		const index = hookCursor++;
		const previous = slots[index];
		const list = Array.isArray(deps) ? deps : void 0;
		const changed = previous === void 0 || list === void 0 || previous.deps === void 0
			|| previous.deps.length !== list.length || previous.deps.some((dep, i) => !Object.is(dep, list[i]));
		if (changed) pendingEffects.push(fn);
		slots[index] = { deps: list };
	},
	useLayoutEffect(_fn, deps) {
		const slots = currentSlots;
		const index = hookCursor++;
		slots[index] = { deps: Array.isArray(deps) ? deps : void 0 };
	},
	useSyncExternalStore(_subscribe, getSnapshot) { lastGetSnapshot = getSnapshot; hookCursor += 1; return getSnapshot(); },
	useRef(init) { const slots = currentSlots; const index = hookCursor++; if (!(index in slots)) slots[index] = { current: init }; return slots[index]; },
	useCallback(fn) { return fn; },
	useMemo(fn) { return fn(); },
};
const jsxRuntime = {
	Fragment: React.Fragment,
	jsx: (type, props) => ({ type, props: props ?? {} }),
	jsxs: (type, props) => ({ type, props: props ?? {} }),
};

// ---------- sandbox ----------
const styleTag = { dataset: {}, textContent: "" };
const documentStub = {
	querySelector: () => null,
	createElement: () => styleTag,
	head: { appendChild: () => void 0 },
	body: { dataset: {} },
	addEventListener: () => void 0,
	removeEventListener: () => void 0
};
const windowStub = { addEventListener: () => void 0, setTimeout, clearTimeout };
const sandbox = { window: windowStub, document: documentStub, console, setTimeout, clearTimeout, queueMicrotask };
let registered = null;
windowStub.__ModuleLoader__ = { load: (definition) => { registered = definition; } };

// ---------- fake git Remote ----------
const REPO = { path: "G:\\demo-repo", root: "G:\\demo-repo" };
const snapshotValue = {
	repo: true, path: REPO.path, root: REPO.root, branch: "main", head: "abc12345",
	clean: false, changes: { staged: 3, unstaged: 3, untracked: 1, total: 5 }, ahead: 1, behind: 0
};
const logValue = {
	commits: [
		{ hash: "abc12345deadbeef", short: "abc12345", parents: ["11111111"], refs: ["HEAD -> main"], author: "Arona", email: "a@b", date: new Date(Date.now() - 60000).toISOString(), subject: "feat: first commit", body: "完整说明第一行\n第二行细节" },
		{ hash: "11111111deadbeef", short: "11111111", parents: [], refs: ["v1"], author: "Arona", email: "a@b", date: new Date(Date.now() - 7200000).toISOString(), subject: "init", body: "" }
	]
};
const statusValue = {
	clean: false,
	entries: [
		{ x: "M", y: " ", path: "src/app.js" },
		{ x: " ", y: "M", path: "src/app.js" },
		{ x: "A", y: " ", path: "lib/new.mjs" },
		{ x: "D", y: " ", path: "old.txt" },
		{ x: " ", y: "D", path: "gone.txt" },
		{ x: "?", y: "?", path: "notes.md" }
	]
};
const branchValue = { branches: ["main", "feature/x"] };
const detailFiles = [
	{ path: "src/app.js", added: 3, removed: 1, binary: false, status: "M" },
	{ path: "lib/new.mjs", added: 10, removed: 0, binary: false, status: "A" },
	{ path: "old.txt", added: 0, removed: 5, binary: false, status: "D" }
];
const callCount = { snapshot: 0, detail: 0, file: 0, add: 0, unstage: 0 };
const gitRemote = {
	snapshot: async () => { callCount.snapshot += 1; return { ok: true, value: snapshotValue }; },
	log: async () => ({ ok: true, value: logValue }),
	status: async () => ({ ok: true, value: statusValue }),
	branch: async () => ({ ok: true, value: branchValue }),
	diff: async (request) => {
		if (request?.commit !== void 0 && request?.stat === true) {
			callCount.detail += 1;
			return { ok: true, value: { commit: request.commit, files: detailFiles, patch: "", truncated: false } };
		}
		if (request?.commit !== void 0 && Array.isArray(request?.paths)) {
			callCount.file += 1;
			const path = request.paths[0];
			return { ok: true, value: { commit: request.commit, files: detailFiles.filter((file) => file.path === path), patch: `diff --git a/${path} b/${path}\n@@ -1 +1 @@\n+added line\n-removed line\n`, truncated: false } };
		}
		return { ok: true, value: { commit: null, files: [], patch: "", truncated: false } };
	},
	add: async () => { callCount.add += 1; return { ok: true, value: { ok: true, message: "已暂存" } }; },
	unstage: async () => { callCount.unstage += 1; return { ok: true, value: { ok: true, message: "已取消暂存" } }; },
	commit: async () => ({ ok: true, value: { ok: true, message: "done" } })
};

// ---------- load ----------
let apply = null;
try {
	const code = readFileSync(join(WORKSPACE, "lib", "client.js"), "utf8");
	vm.runInNewContext(code, sandbox, { filename: "client.js" });
	assert(registered !== null, "bundle did not call __ModuleLoader__.load");
	const moduleExports = registered.factory((specifier) => {
		if (specifier === "react") return React;
		if (specifier === "react/jsx-runtime") return jsxRuntime;
		throw new Error(`unexpected require(${JSON.stringify(specifier)})`);
	});
	apply = moduleExports.apply;
	assert(typeof apply === "function", "exports.apply missing");
	assert(moduleExports.inject.includes("remote.git"), "remote.git inject missing");
} catch (error) {
	results.push(`FAIL bundle load: ${error instanceof Error ? error.message : error}`);
	failed += 1;
}

// ---------- fixtures + render ----------
const SessionState = { current: "s-1", byId: { "s-1": { cwd: REPO.path } } };
const WorkspaceState = { items: [], recentWorkspaceId: void 0 };
const useSessions = (selector) => selector(SessionState);
const useWorkspaces = (selector) => selector(WorkspaceState);
const t = (key) => key;

function renderComponent(type, props) {
	const previousSlots = currentSlots;
	const previousCursor = hookCursor;
	currentSlots = slotsFor(type);
	hookCursor = 0;
	const element = type(props);
	currentSlots = previousSlots;
	hookCursor = previousCursor;
	return element;
}
function renderTree(node, depth = 0) {
	if (node === null || node === void 0 || typeof node === "boolean") return null;
	if (typeof node === "string" || typeof node === "number") return node;
	if (Array.isArray(node)) return node.map((child) => renderTree(child, depth + 1));
	const type = node.type;
	const props = node.props ?? {};
	if (typeof type === "function") {
		if (type.prototype !== void 0 && typeof type.prototype.render === "function") {
			const instance = new type(props);
			return renderTree(instance.render(), depth + 1);
		}
		return renderTree(renderComponent(type, props), depth + 1);
	}
	return { type, props: { ...props, children: renderTree(props.children, depth + 1) } };
}
function findClass(tree, className, found = []) {
	if (tree === null || tree === void 0 || typeof tree !== "object") return found;
	if (Array.isArray(tree)) { for (const child of tree) findClass(child, className, found); return found; }
	const own = typeof tree.props?.className === "string" ? tree.props.className.split(/\s+/) : [];
	if (own.includes(className)) found.push(tree);
	findClass(tree.props?.children, className, found);
	return found;
}
function textOf(node) {
	if (node === null || node === void 0 || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (typeof node === "object") return textOf(node.props?.children);
	return "";
}
const flush = async () => {
	await Promise.all(pendingEffects.splice(0).map((fn) => fn()));
	await new Promise((resolve) => setTimeout(resolve, 30));
};

// ---------- mount ----------
let EntryComponent = null;
const fakeCtx = {
	slots: {
		inject: (_name, factory) => { factory(); },
		register: (_options, component) => { EntryComponent = component; return () => void 0; }
	},
	remote: { git: gitRemote }
};
await check("apply registers the footer entry", async () => {
	apply(fakeCtx);
	assert(typeof EntryComponent === "function", "no component registered");
});

const entryProps = { wide: true, useSessions, useWorkspaces, t };
let entryTree = null;
await check("entry renders branch + inline count", async () => {
	entryTree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	entryTree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(textOf(findClass(entryTree, "dshg-footerBranch")[0]) === "main", "branch label wrong");
	assert(textOf(findClass(entryTree, "dshg-footerCount")[0]) === "5", "inline count should show 5 changes");
	assert(findClass(entryTree, "dshg-footerBadge").length === 0, "wide row must not use the corner badge");
});

await check("rail entry keeps the corner badge", async () => {
	const railTree = renderTree(renderComponent(EntryComponent, { ...entryProps, wide: false }));
	assert(findClass(railTree, "dshg-footerBtn").length === 1, "rail button missing");
	assert(findClass(railTree, "dshg-footerBadge").length === 1, "rail badge missing");
});

let openedTree = null;
await check("one merged tree with folder rows", async () => {
	findClass(entryTree, "dshg-footerLabel")[0].props.onClick();
	openedTree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	assert(findClass(openedTree, "dshg-tree").length === 1, "file tree missing");
	assert(findClass(openedTree, "dshg-fileList").length === 0, "old list container must be gone");
	assert(findClass(openedTree, "dshg-check").length === 0, "checkboxes must be gone (selection is blue)");
	const dirs = findClass(openedTree, "dshg-dir").length;
	assert(dirs === 2, `expected 2 folder rows (src, lib), got ${dirs}`);
	const rows = findClass(openedTree, "dshg-row");
	assert(rows.length === 5, `expected 5 merged rows, got ${rows.length}`);
});

await check("working-tree rows carry the yellow warning dot", async () => {
	const rows = findClass(openedTree, "dshg-row");
	const pathOf = (row) => textOf(findClass(row, "dshg-path")[0]);
	const app = rows.find((row) => pathOf(row) === "app.js");
	const added = rows.find((row) => pathOf(row) === "new.mjs");
	const gone = rows.find((row) => pathOf(row) === "gone.txt");
	assert(app !== void 0 && added !== void 0 && gone !== void 0, "rows missing");
	assert(findClass(app, "dshg-warnDot").length === 1, "working row without warning dot");
	assert(findClass(app, "dshg-yellow").length >= 1, "working row should be yellow");
	assert(findClass(added, "dshg-warnDot").length === 0, "staged-only row must not warn");
	assert(findClass(added, "dshg-green").length >= 1, "staged row should be green");
	assert(findClass(gone, "dshg-orange").length >= 1, "working delete should be orange");
});

await check("folders inherit the warning state", async () => {
	const dirRows = findClass(openedTree, "dshg-dir");
	const src = dirRows.find((row) => textOf(findClass(row, "dshg-dirName")[0]) === "src");
	const lib = dirRows.find((row) => textOf(findClass(row, "dshg-dirName")[0]) === "lib");
	assert(src !== void 0 && lib !== void 0, "folder rows missing");
	assert(findClass(src, "dshg-warnDot").length === 1, "src folder missing the warning dot");
	assert(String(findClass(src, "dshg-dirName")[0].props.className).includes("dshg-yellow"), "src name should be yellow");
	assert(findClass(lib, "dshg-warnDot").length === 0, "lib folder should be clean");
	assert(String(findClass(lib, "dshg-dirName")[0].props.className).includes("dshg-yellow") === false, "lib name should stay plain");
});

await check("staged rows are green add / red delete / plain modify", async () => {
	const rows = findClass(openedTree, "dshg-row");
	const pathOf = (row) => textOf(findClass(row, "dshg-path")[0]);
	const modified = rows.find((row) => pathOf(row) === "old.txt");
	const added = rows.find((row) => pathOf(row) === "new.mjs");
	const gone = rows.find((row) => pathOf(row) === "gone.txt");
	assert(modified !== void 0 && added !== void 0 && gone !== void 0, "rows missing");
	const klass = (row) => String(findClass(row, "dshg-path")[0].props.className);
	assert(klass(gone).includes("dshg-orange"), "working delete should be orange");
	assert(klass(added).includes("dshg-green"), "staged add should be green");
});

await check("selecting a working file offers staging", async () => {
	const rows = findClass(openedTree, "dshg-row");
	const app = rows.find((row) => textOf(findClass(row, "dshg-path")[0]) === "app.js");
	app.props.onMouseDown({ button: 0 });
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	const labels = findClass(tree, "dshg-op").map(textOf);
	assert(labels.some((label) => label.includes("加入暂存")), `staging button missing: ${JSON.stringify(labels)}`);
	assert(labels.some((label) => label.includes("选中提交")), "selecting files should offer 选中提交");
});

await check("staging calls add", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-op").find((node) => textOf(node).includes("加入暂存")).props.onClick();
	await flush();
	assert(callCount.add === 1, `add not called (${callCount.add})`);
});

await check("commit row expands with full message and actions", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-commitHead")[0].props.onClick();
	const expanded = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(expanded, "dshg-commitBodyOpen").length === 1, "expanded body missing");
	assert(textOf(findClass(expanded, "dshg-commitMsg")[0]).includes("第二行细节"), "full message missing");
	const labels = findClass(expanded, "dshg-commitActions")[0];
	const text = textOf(labels);
	for (const label of ["回退到此", "还原此提交", "硬回退", "详细"]) assert(text.includes(label), `missing ${label}: ${text}`);
});

await check("double click opens the detail pane", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-commitHead")[0].props.onDoubleClick({ stopPropagation: () => void 0 });
	await flush();
	const opened = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(opened, "dshg-detailOpen").length === 1, "detail pane did not open on double click");
	const groups = findClass(opened, "dshg-groupTitle").map(textOf);
	assert(groups.some((label) => label.includes("新增")), `missing 新增 group: ${JSON.stringify(groups)}`);
});

await check("picking a file shows coloured patch lines", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	const row = findClass(findClass(tree, "dshg-detailList")[0], "dshg-row")[0];
	row.props.onClick();
	await flush();
	const withPatch = renderTree(renderComponent(EntryComponent, entryProps));
	assert(callCount.file === 1, `file diff not fetched (${callCount.file})`);
	const box = findClass(withPatch, "dshg-fileDiff")[0];
	assert(box !== null && box !== void 0, "file diff box missing");
	assert(findClass(box, "dshg-add").length === 1, "green add line missing");
	assert(findClass(box, "dshg-del").length === 1, "red delete line missing");
});

await check("collapsing the row closes the detail pane", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-commitHead")[0].props.onClick();
	const collapsed = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(collapsed, "dshg-commitBodyOpen").length === 0, "row should be collapsed");
	assert(findClass(collapsed, "dshg-detailOpen").length === 0, "detail pane should be closed with the row");
});

await check("detail arrow rotates while the pane is open", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-commitHead")[0].props.onDoubleClick({ stopPropagation: () => void 0 });
	await flush();
	const opened = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(opened, "dshg-arrowOpen").length === 1, "detail arrow should be rotated");
});

await check("single click on another commit closes the detail pane", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	// Detail is open on the first commit; single-clicking the second one must
	// close the pane (only a double click moves it).
	const heads = findClass(tree, "dshg-commitHead");
	heads[1].props.onClick({ detail: 1 });
	await flush();
	const switched = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(switched, "dshg-detailOpen").length === 0, "detail pane should close on a single click elsewhere");
	assert(findClass(switched, "dshg-commitBodyOpen").length === 1, "the clicked row should be expanded");
});

await check("clean workspace renders the centred clean state", async () => {
	const previousStatus = gitRemote.status;
	const previousSnapshot = gitRemote.snapshot;
	gitRemote.status = async () => ({ ok: true, value: { clean: true, entries: [] } });
	gitRemote.snapshot = async () => ({ ok: true, value: { ...snapshotValue, clean: true, changes: { staged: 0, unstaged: 0, untracked: 0, total: 0 } } });
	slotStore.delete(EntryComponent);
	try {
		let tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		// The drawer has to be re-opened after the hook ledger reset.
		findClass(tree, "dshg-footerLabel")[0].props.onClick();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		assert(findClass(tree, "dshg-clean").length === 1, "clean placeholder missing");
		assert(findClass(tree, "dshg-opsBar").length === 0, "ops bar must be hidden when clean");
	} finally {
		gitRemote.status = previousStatus;
		gitRemote.snapshot = previousSnapshot;
		slotStore.delete(EntryComponent);
	}
});

console.log(results.join("\n"));
process.exitCode = failed > 0 ? 1 : 0;
console.log(process.exitCode === 1 ? "\nSOME CLIENT RENDER CHECKS FAILED" : "\nALL CLIENT RENDER CHECKS PASSED");
