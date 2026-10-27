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
const localStore = new Map();
const windowStub = {
	addEventListener: () => void 0,
	setTimeout,
	clearTimeout,
	localStorage: {
		getItem: (key) => (localStore.has(key) ? localStore.get(key) : null),
		setItem: (key, value) => { localStore.set(key, String(value)); },
		removeItem: (key) => { localStore.delete(key); }
	}
};
// Prism (inlined) probes DOM globals at load time; give the sandbox harmless stubs.
class ElementStub {}
class NodeStub {}
const sandbox = {
	window: windowStub,
	document: documentStub,
	console,
	setTimeout,
	clearTimeout,
	queueMicrotask,
	Element: ElementStub,
	HTMLElement: ElementStub,
	Node: NodeStub
};
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
	reflogEvents: async () => ({ ok: true, value: { ok: true, events: [] } }),
	branchDetails: async () => ({
		ok: true,
		value: {
			branches: [
				{ name: "main", hash: "abc12345deadbeef", short: "abc12345", upstream: "", date: new Date(Date.now() - 60000).toISOString(), subject: "feat: first commit", current: true, merged: true, created: { date: new Date(Date.now() - 172800000).toISOString(), from: "仓库初始", hash: "abc12345deadbeef" } },
				{ name: "feature/x", hash: "22222222deadbeef", short: "22222222", upstream: "", date: new Date(Date.now() - 3600000).toISOString(), subject: "feature work", current: false, merged: false, created: { date: new Date(Date.now() - 86400000).toISOString(), from: "main", hash: "22222222deadbeef" } }
			]
		}
	}),
	repoOperation: async () => ({ ok: true, value: { operation: null, conflicts: [], resolved: [], total: 0, unresolved: 0 } }),
	conflictFile: async (request) => ({ ok: true, value: { file: request?.file ?? "", worktree: "", ours: "", theirs: "", base: "", binary: false, truncated: false } }),
	orphanedCommits: async () => ({ ok: true, value: { ok: true, commits: [] } }),
	branchExclusiveCommits: async () => ({ ok: true, value: { ok: true, commits: [] } }),
	operationContinue: async () => ({ ok: true, value: { ok: true, message: "已完成" } }),
	operationAbort: async () => ({ ok: true, value: { ok: true, message: "已中止" } }),
	deleteBranch: async () => ({ ok: true, value: { ok: true, message: "已删除" } }),
	renameBranch: async () => ({ ok: true, value: { ok: true, message: "已重命名" } }),
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
	commit: async () => ({ ok: true, value: { ok: true, message: "done" } }),
	readPluginState: async (request) => ({
		ok: true,
		value: { ok: true, value: pluginState.has(request?.key) ? pluginState.get(request.key) : "null" }
	}),
	writePluginState: async (request) => {
		pluginState.set(request?.key, String(request?.value ?? "null"));
		return { ok: true, value: { ok: true } };
	}
};
const pluginState = new Map();

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
	app.props.onMouseDown({ button: 2 });
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	const labels = findClass(tree, "dshg-op").map(textOf);
	assert(labels.some((label) => label.includes("选中暂存")), `staging button missing: ${JSON.stringify(labels)}`);
	assert(labels.some((label) => label.includes("选中提交")), "selecting files should offer 选中提交");
	assert(labels.some((label) => label.includes("选中回退")), "selecting files should offer 选中回退");
});

await check("staging calls add", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-op").find((node) => textOf(node).includes("选中暂存")).props.onClick();
	await flush();
	assert(callCount.add === 1, `add not called (${callCount.add})`);
});

await check("commit row expands with full message and actions", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-commit")[0].props.onMouseDown({ button: 0, detail: 1, target: null });
	// A single press is delayed (140ms) so a double press can cancel it.
	await new Promise((resolve) => setTimeout(resolve, 240));
	const expanded = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(expanded, "dshg-commitBodyOpen").length === 1, "expanded body missing");
	assert(textOf(findClass(expanded, "dshg-commitMsg")[0]).includes("第二行细节"), "full message missing");
	const labels = findClass(expanded, "dshg-commitActions")[0];
	const text = textOf(labels);
	for (const label of ["检出提交", "还原提交", "强制回退", "展开详细"]) assert(text.includes(label), `missing ${label}: ${text}`);
});

await check("double click opens the detail pane", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-commit")[0].props.onMouseDown({ button: 0, detail: 2, target: null });
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
	const patchText = textOf(box);
	assert(!patchText.includes("diff --git"), "git plumbing header must be hidden");
	assert(!patchText.includes("index 0000"), "index line must be hidden");
	assert(patchText.includes("行附近"), "hunk header should read as a human hint");
});

await check("collapsing the row closes the detail pane", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-commit")[0].props.onMouseDown({ button: 0, detail: 1, target: null });
	await new Promise((resolve) => setTimeout(resolve, 240));
	const collapsed = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(collapsed, "dshg-commitBodyOpen").length === 0, "row should be collapsed");
	assert(findClass(collapsed, "dshg-detailOpen").length === 0, "detail pane should be closed with the row");
});

await check("detail button flips its label while the pane is open", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-commit")[0].props.onMouseDown({ button: 0, detail: 2, target: null });
	await flush();
	const opened = renderTree(renderComponent(EntryComponent, entryProps));
	const labels = findClass(opened, "dshg-opDetail").map(textOf);
	assert(labels.some((label) => label.includes("收起详细")), `expected 收起详细, got ${JSON.stringify(labels)}`);
});

await check("single click on another commit closes the detail pane", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	// Detail is open on the first commit; single-clicking the second one must
	// close the pane (only a double click moves it).
	const heads = findClass(tree, "dshg-commit");
	heads[1].props.onMouseDown({ button: 0, detail: 1, target: null });
	await new Promise((resolve) => setTimeout(resolve, 240));
	const switched = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(switched, "dshg-detailOpen").length === 0, "detail pane should close on a single click elsewhere");
	assert(findClass(switched, "dshg-commitBodyOpen").length === 1, "the clicked row should be expanded");
});

await check("the first commit cannot open the detail pane", async () => {
	const tree = renderTree(renderComponent(EntryComponent, entryProps));
	const commits = findClass(tree, "dshg-commit");
	const first = commits[commits.length - 1];
	assert(first !== void 0, "commit rows missing");
	first.props.onMouseDown({ button: 0, detail: 2, target: null });
	await flush();
	const after = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(after, "dshg-detailOpen").length === 0, "the first commit must not open the pane");
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
		const opsBar = findClass(tree, "dshg-opsBar");
		assert(opsBar.length === 1, "branch / more must stay reachable on a clean workspace");
		const left = findClass(opsBar[0], "dshg-opsLeft")[0];
		assert(left !== void 0, "the fixed action group is missing");
		const direct = left.props.children.filter((node) => node !== null && node !== void 0 && node.type === "button");
		assert(direct.length === 5, `clean bar should offer 5 fixed actions, got ${direct.length}`);
		assert(findClass(opsBar[0], "dshg-moreAction").some((button) => button.props.title === "回收站"), "the recycle-bin entry must stay reachable");
		const labels = direct.map(textOf);
		assert(labels[0] === "全部提交" && labels[1] === "全部暂存" && labels[2] === "回退修改" && labels[3] === "全部撤销" && labels[4] === "全部入栈", `fixed buttons missing: ${JSON.stringify(labels)}`);
		assert(direct[0].props.disabled === true && direct[1].props.disabled === true && direct[2].props.disabled === true && direct[3].props.disabled === true && direct[4].props.disabled === true, "fixed buttons must be disabled on a clean tree");
	} finally {
		gitRemote.status = previousStatus;
		gitRemote.snapshot = previousSnapshot;
		slotStore.delete(EntryComponent);
	}
});

await check("follows the active workspace when no session is selected", async () => {
	const prevCurrent = SessionState.current;
	const prevById = SessionState.byId;
	const prevItems = WorkspaceState.items;
	const prevRecent = WorkspaceState.recentWorkspaceId;
	SessionState.current = void 0;
	SessionState.byId = {};
	WorkspaceState.items = [
		{ workspaceId: "w1", path: "G:\\ws-one", sessionIds: [] },
		{ workspaceId: "w2", path: "G:\\ws-two", sessionIds: [] }
	];
	WorkspaceState.recentWorkspaceId = "w1";
	slotStore.delete(EntryComponent);
	try {
		let tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		const titleOf = () => String(findClass(tree, "dshg-footerLabel")[0].props.title);
		assert(titleOf().includes("ws-one"), `expected ws-one, got ${titleOf()}`);
		// Switching the workspace only moves `recentWorkspaceId`.
		WorkspaceState.recentWorkspaceId = "w2";
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		assert(titleOf().includes("ws-two"), `expected ws-two after switch, got ${titleOf()}`);
	} finally {
		SessionState.current = prevCurrent;
		SessionState.byId = prevById;
		WorkspaceState.items = prevItems;
		WorkspaceState.recentWorkspaceId = prevRecent;
		slotStore.delete(EntryComponent);
	}
});

await check("tracks the DOM-selected conversation id", async () => {
	const prevById = SessionState.byId;
	const prevCurrent = SessionState.current;
	const prevQuery = documentStub.querySelector;
	const prevItems = WorkspaceState.items;
	const prevRecent = WorkspaceState.recentWorkspaceId;
	SessionState.byId = { "session-test-1234": { cwd: "G:\\ws-dom", updatedAt: 1 } };
	SessionState.current = void 0;
	WorkspaceState.items = [];
	WorkspaceState.recentWorkspaceId = void 0;
	documentStub.querySelector = (selector) => (selector.includes("data-row-key")
		? { getAttribute: (name) => (name === "data-row-key" ? "session:session-test-1234" : null) }
		: null);
	slotStore.delete(EntryComponent);
	try {
		let tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		const title = String(findClass(tree, "dshg-footerLabel")[0].props.title);
		assert(title.includes("ws-dom"), `expected the DOM-selected cwd, got ${title}`);
	} finally {
		SessionState.byId = prevById;
		SessionState.current = prevCurrent;
		WorkspaceState.items = prevItems;
		WorkspaceState.recentWorkspaceId = prevRecent;
		documentStub.querySelector = prevQuery;
		slotStore.delete(EntryComponent);
	}
});

await check("merge conflict banner shows progress and blocks continue", async () => {
	const previousOperation = gitRemote.repoOperation;
	gitRemote.repoOperation = async () => ({
		ok: true,
		value: {
			operation: { kind: "merge", source: "feature/x", target: "main", message: "Merge branch 'feature/x'", startedAt: "", head: "22222222" },
			conflicts: [
				{ path: "src/app.js", code: "UU", blocks: 3 },
				{ path: "notes.md", code: "UU", blocks: 0 }
			],
			resolved: [],
			total: 2,
			unresolved: 2
		}
	});
	slotStore.delete(EntryComponent);
	try {
		let tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		findClass(tree, "dshg-footerLabel")[0].props.onClick();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		assert(findClass(tree, "dshg-conflict").length === 1, "conflict banner missing");
		const title = textOf(findClass(tree, "dshg-conflictTitle")[0]);
		assert(title.includes("1 个文件"), `banner title should carry the pending count, got ${title}`);
		const sub = textOf(findClass(tree, "dshg-conflictSub")[0]);
		assert(sub.includes("1 已解决"), `banner should count resolved files, got ${sub}`);
		const cont = findClass(tree, "dshg-op").find((button) => textOf(button) === "继续合并");
		assert(cont !== void 0 && cont.props.disabled === true, "continue must stay disabled while markers remain");
		const files = findClass(tree, "dshg-cFile");
		assert(files.length === 2, `expected two conflict files, got ${files.length}`);
		assert(files.some((file) => textOf(file).includes("（解决）")), "a marker-free file should read （解决）");
		// Clicking a conflict file opens the conflict pane.
		files[0].props.onClick();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		assert(findClass(tree, "dshg-detailOpen").length === 1, "conflict pane did not open");
		assert(String(textOf(findClass(tree, "dshg-detailTitle")[0])).includes("冲突文件"), "conflict title missing");
	} finally {
		gitRemote.repoOperation = previousOperation;
		slotStore.delete(EntryComponent);
	}
});

await check("branch popover lists branches and expands creation info", async () => {
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const branchButton = findClass(tree, "dshg-opIcon").find((button) => button.props.title === "分支");
	assert(branchButton !== void 0, "branch tool button missing");
	branchButton.props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const pops = findClass(tree, "dshg-pop").filter((node) => !String(node.props.className).includes("dshg-morePop"));
	assert(pops.length === 1, `branch popover missing (${pops.length})`);
	assert(findClass(tree, "dshg-bBranch").length === 2, "branch rows missing");
	const heads = findClass(tree, "dshg-bHead");
	heads[1].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const body = findClass(tree, "dshg-bBodyOpen");
	assert(body.length === 1, "expanded branch body missing");
	assert(textOf(body[0]).includes("基于 main"), "creation source missing");
	// The primary branch must not show a creation card at all.
	heads[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const mainBody = findClass(tree, "dshg-bBodyOpen");
	assert(mainBody.length === 1, "primary branch body missing");
	assert(!textOf(mainBody[0]).includes("创建节点"), "primary branch must not show a creation card");
});

await check("branch dot filters the timeline and keeps at least one branch", async () => {
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const branchButton = findClass(tree, "dshg-opIcon").find((button) => button.props.title === "分支");
	branchButton.props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-bDot").length === 2, "branch dots missing");
	// All branches selected by default: the full graph shows.
	assert(findClass(tree, "dshg-commit").length === 2, "all branches should show every commit");
	assert(findClass(tree, "dshg-branchArrow").length === 2, "branch tip arrows missing");
	// Toggle main off -> only feature/x stays; its tip is not in the log.
	findClass(tree, "dshg-bDot")[0].props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-commit").length === 0, "filter should hide unrelated commits");
	assert(findClass(tree, "dshg-branchArrow").length === 0, "branch tip arrows must follow the filter");
	// The last selected branch cannot be cleared.
	const remaining = findClass(tree, "dshg-bDot").find((dot) => dot.props["aria-pressed"] === true);
	assert(remaining !== void 0, "one branch must stay selected");
	remaining.props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-commit").length === 0, "the last selected branch must not be cleared");
	// Selecting main again restores the whole graph.
	findClass(tree, "dshg-bDot")[0].props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-commit").length === 2, "selecting every branch restores the full graph");
});

await check("branch filter survives closing and reopening the panel", async () => {
	// Leave only feature/x selected, then simulate closing the drawer.
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const branchButton = findClass(tree, "dshg-opIcon").find((button) => button.props.title === "分支");
	branchButton.props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-bDot")[0].props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-commit").length === 0, "filter should apply before reopening");
	// Reopen from a fresh mount: the stored selection must be restored.
	slotStore.delete(EntryComponent);
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-commit").length === 0, "filter must survive closing the panel");
	// Restore the default (all branches) for later checks.
	branchButton.props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-bDot")[0].props.onClick({ stopPropagation() {} });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-commit").length === 2, "selecting the last branch restores the graph");
});

await check("branch reset reflog rows are not rendered as creation cards", async () => {
	const previous = gitRemote.reflogEvents;
	gitRemote.reflogEvents = async () => ({
		ok: true,
		value: {
			ok: true,
			events: [
				{ ref: "refs/heads/main", oldHash: "a".repeat(40), newHash: "abc12345deadbeef", actor: "Arona <a@b>", date: new Date().toISOString(), message: "branch: Reset to e960a43", action: "branch" }
			]
		}
	});
	slotStore.delete(EntryComponent);
	try {
		let tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		findClass(tree, "dshg-footerLabel")[0].props.onClick();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
		assert(findClass(tree, "dshg-eventRow").length === 0, "reset records must not render a branch card");
	} finally {
		gitRemote.reflogEvents = previous;
		slotStore.delete(EntryComponent);
	}
});

await check("dev diagnostics stay hidden until the switch is flipped", async () => {
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	assert(findClass(tree, "dshg-diag").length === 0, "diag must not render while closed");
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-diag").length === 0, "diag strip must be hidden by default");
	const dev = windowStub.__dshGitDev;
	assert(dev !== void 0 && typeof dev.set === "function", "window.__dshGitDev.set must be exposed");
	dev.set(true);
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-diag").length === 1, "diag strip should appear in dev mode");
	dev.set(false);
});

console.log(results.join("\n"));
process.exitCode = failed > 0 ? 1 : 0;
console.log(process.exitCode === 1 ? "\nSOME CLIENT RENDER CHECKS FAILED" : "\nALL CLIENT RENDER CHECKS PASSED");
