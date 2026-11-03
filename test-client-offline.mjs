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
// Several instances of the SAME component type coexist (four <Presence>
// wrappers, for example). React gives each its own hooks; the stand-in has to
// do the same, or the last instance's state leaks into the next one. Instances
// are told apart by their occurrence order within one render pass.
const passCounts = new Map();
const slotsFor = (key) => {
	let per = slotStore.get(key);
	if (per === void 0) { per = []; slotStore.set(key, per); }
	const occurrence = passCounts.get(key) ?? 0;
	passCounts.set(key, occurrence + 1);
	if (per[occurrence] === void 0) per[occurrence] = [];
	return per[occurrence];
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
	// Presence mounts its children one frame in; without these stubs every
	// modal would throw inside the effect instead of rendering.
	requestAnimationFrame: (fn) => setTimeout(fn, 0),
	cancelAnimationFrame: (handle) => clearTimeout(handle),
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
/** Host-side settings the panel reads; the update call mutates this stub. */
const settingsValue = { userName: "", userEmail: "", reflogBackup: false, showDshSettings: false, modalAnchor: "panel", devMode: false };
const gitRemote = {
	pluginSettings: async () => ({ ok: true, value: { ...settingsValue } }),
	pluginSettingsUpdate: async (request) => {
		for (const key of Object.keys(settingsValue)) if (request?.[key] !== void 0) settingsValue[key] = request[key];
		return { ok: true, value: { ...settingsValue } };
	},
	githubAccounts: async () => ({ ok: true, value: { ok: true, accounts: [{ name: "LingQi-07-std" }] } }),
	githubLoginStart: async () => ({ ok: true, value: { ok: true, id: "gh-1" } }),
	githubLoginPoll: async () => ({ ok: true, value: { ok: true, status: "pending" } }),
	githubLoginCancel: async () => ({ ok: true, value: { ok: true, cancelled: true } }),
	githubLoginToken: async () => ({ ok: true, value: { ok: true, accounts: [{ name: "LingQi-07-std" }] } }),
	githubLogout: async () => ({ ok: true, value: { ok: true, accounts: [] } }),
	githubUser: async () => ({ ok: true, value: { ok: true, login: "LingQi-07-std", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4", reason: "", status: 200 } }),
	repoPermission: async () => ({ ok: true, value: { ok: true, canPush: true, canPull: true, status: 200, reason: "" } }),
	repoInfo: async () => ({ ok: true, value: { ok: true, owner: "o", repo: "r", fork: false, parent: null, defaultBranch: "main", htmlUrl: "https://github.com/o/r" } }),
	listPullRequests: async () => ({ ok: true, value: { ok: true, prs: [] } }),
	listAllPullRequests: async () => ({ ok: true, value: { ok: true, outgoing: [], internal: [], incoming: [] } }),
	createPullRequest: async () => ({ ok: true, value: { ok: true, number: 1, url: "https://github.com/o/r/pull/1" } }),
	createRepo: async () => ({ ok: true, value: { ok: true, owner: "o", fullName: "o/r", cloneUrl: "https://github.com/o/r.git" } }),
	syncCommits: async () => ({
		ok: true,
		value: { ok: true, upstream: "origin/main", ahead: [], behind: [], aheadFiles: [], behindFiles: [], mergeBase: "" }
	}),
	remoteBranches: async () => ({ ok: true, value: { branches: [] } }),
	linkUpstream: async () => ({ ok: true, value: { ok: true, message: "已关联" } }),
	remoteInfo: async () => ({ ok: true, value: { ok: true, name: "origin", url: "https://github.com/o/r.git", host: "github.com", owner: "o", repo: "r", github: true } }),
	fetchRemote: async () => ({ ok: true, value: { ok: true, message: "已更新远程状态" } }),
	pullRemote: async () => ({ ok: true, value: { ok: true, message: "已拉取" } }),
	pushRemote: async () => ({ ok: true, value: { ok: true, message: "已推送" } }),
	rangeDiff: async () => ({ ok: true, value: { ok: true, from: "aaaa", to: "HEAD", files: [], patch: "", truncated: false } }),
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
	// The bundle mounts the namespace itself, so it must inject `remote` but
	// must NOT wait for `remote.git` (that would deadlock on its own mount).
	assert(moduleExports.inject.includes("remote"), "remote inject missing");
	assert(!moduleExports.inject.includes("remote.git"), "remote.git must not be injected any more");
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
	if (depth === 0) passCounts.clear();
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
// Every slot the bundle registers into, keyed by `name#key-or-id`, so the
// settings panels (plugins.*.config) cannot shadow the sidebar entry.
const registeredSlots = new Map();
// The bundle mounts `remote.git` itself now (the separate remote plugin is
// gone), so the fake gateway records what was mounted and exposes it as `git`.
let mountedRemote = null;
const fakeCtx = {
	slots: {
		inject: (_name, factory) => factory(),
		register: (options, component) => {
			const id = `${options.name}#${options.key ?? options.id ?? ""}`;
			registeredSlots.set(id, component);
			if (options.name === "sidebar.footer.action") EntryComponent = component;
			return () => { registeredSlots.delete(id); };
		}
	},
	remote: {
		git: gitRemote,
		$mount: async (spec) => { mountedRemote = spec; }
	},
	// The bundle splits into two fibers: the outer one mounts the namespace, the
	// child `GitUiPlugin` owns the UI with `remote.git` injected. The stub runs
	// the child immediately on the same context (which already carries `git`).
	plugin: async (fn) => { fn(fakeCtx); },
	effect: (fn) => { const disposer = fn(); return () => { if (typeof disposer === "function") disposer(); }; }
};
await check("apply mounts remote.git itself and registers the footer entry", async () => {
	await apply(fakeCtx);
	assert(mountedRemote !== null, "apply must mount the git Remote namespace");
	assert(mountedRemote.package === "@dsh-external/dsh-client-ui-git", "mount must be owned by this package: " + mountedRemote.package);
	assert(Array.isArray(mountedRemote.descriptors) && mountedRemote.descriptors.length === 60, "descriptor count: " + mountedRemote.descriptors?.length);
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
		assert(direct.length === 5, `clean bar should offer 5 remote actions, got ${direct.length}`);
		assert(findClass(opsBar[0], "dshg-moreAction").some((button) => button.props.title === "回收站"), "the recycle-bin entry must stay reachable");
		const labels = direct.map(textOf);
		assert(labels[0] === "推送改动" && labels[1] === "拉取改动" && labels[2].startsWith("同步改动") && labels[3].startsWith("变基推送") && labels[4] === "创建PR", `remote buttons missing: ${JSON.stringify(labels)}`);
		// The stub reports an upstream with nothing pending, so every remote action
		// is correctly disabled (nothing to push, pull, sync or rebase).
		assert(direct[0].props.disabled === true && direct[1].props.disabled === true && direct[2].props.disabled === true && direct[3].props.disabled === true, "remote actions must be disabled when nothing is pending");
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

// ---------- remote manager dialog ----------
// Regression: `Presence` used to call `h(type, props, children)`, but `h` is
// `jsx` and only takes two arguments, so every dialog inside it rendered as an
// empty wrapper (the "远程管理 button does nothing" bug). Assert the dialog's
// own card actually reaches the tree.
await check("remote manager dialog opens from the more bar", async () => {
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const bar = findClass(tree, "dshg-moreBar")[0];
	assert(bar !== void 0, "more bar missing");
	bar.props.onClick({ stopPropagation: () => void 0 });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	const remoteItem = findClass(tree, "dshg-moreAction").find((node) => node.props.title === "远程管理");
	assert(remoteItem !== void 0, "远程管理 entry missing from the more bar");
	remoteItem.props.onClick({ stopPropagation: () => void 0 });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-moreBarOpen").length === 0, "opening a dialog must collapse the more bar");
	const presence = findClass(tree, "dshg-presence");
	assert(presence.length >= 1, "Presence wrapper missing: " + presence.length);
	assert(presence.some((node) => node.props.children !== null && node.props.children !== void 0), "Presence dropped its children");
	assert(findClass(tree, "dshg-remoteCard").length === 1, "remote manager card did not render");
	assert(textOf(tree).includes("远程管理"), "dialog title missing");
	// Linked repo: the card shows the four info rows and the permission result.
	const rows = findClass(tree, "dshg-remoteLabel").map(textOf);
	for (const label of ["远程名称", "仓库地址", "托管平台", "仓库标识"]) assert(rows.includes(label), `missing info row: ${label} (${rows.join(",")})`);
	// No automatic probe any more: the dialog offers a button that runs it.
	const permBtn = findClass(tree, "dshg-op").find((node) => textOf(node) === "检测推送权限");
	assert(permBtn !== void 0, "permission check button missing");
	permBtn.props.onClick();
	await flush();
	const withPerm = renderTree(renderComponent(EntryComponent, entryProps));
	assert(textOf(withPerm).includes("此账户拥有推送权限"), "permission result missing after a manual check");
});

// ---------- more bar collapse ----------
await check("more bar collapses the branch button instead of unmounting it", async () => {
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	// Earlier cases leave the bar expanded; collapse it first through the chevron.
	if (findClass(tree, "dshg-branchSlotOut").length > 0) {
		findClass(tree, "dshg-moreArrow")[0].props.onClick({ stopPropagation: () => void 0 });
		tree = renderTree(renderComponent(EntryComponent, entryProps));
	}
	assert(findClass(tree, "dshg-branchSlot").length === 1, "branch slot missing");
	assert(findClass(tree, "dshg-branchSlotOut").length === 0, "branch slot must be expanded by default");
	findClass(tree, "dshg-moreBar")[0].props.onClick({ stopPropagation: () => void 0 });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	const slots = findClass(tree, "dshg-branchSlot");
	assert(slots.length === 1, "branch slot must stay mounted while the more bar is open");
	assert(String(slots[0].props.className).includes("dshg-branchSlotOut"), "branch slot should collapse with the bar");
	assert(findClass(slots[0], "dshg-opIcon").length === 1, "branch button must survive inside the collapsed slot");
	findClass(tree, "dshg-moreArrow")[0].props.onClick({ stopPropagation: () => void 0 });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(findClass(tree, "dshg-branchSlotOut").length === 0, "branch slot must reopen with the bar");
});

// Regression: the exit state used to carry `transform: translateY(-6px)`, which
// made the wrapper the containing block of the absolutely positioned dialog
// inside it, so dialogs jumped to the bottom of the panel while fading out.
await check("presence exit is opacity-only so dialogs keep their position", async () => {
	const css = String(styleTag.textContent ?? "");
	const rule = css.match(/\.dshg-presenceOut\{[^}]*\}/);
	assert(rule !== null, "presenceOut rule missing from the injected CSS");
	assert(!rule[0].includes("transform"), "presenceOut must not transform: " + rule[0]);
});

// ---------- create PR dialog ----------
await check("PR dialog shows source, target branch, account and unpushed warning", async () => {
	const prevStatus = gitRemote.status;
	const prevSnapshot = gitRemote.snapshot;
	const prevSync = gitRemote.syncCommits;
	const prevCreate = gitRemote.createPullRequest;
	let lastCreate = null;
	gitRemote.status = async () => ({ ok: true, value: { clean: true, entries: [] } });
	gitRemote.snapshot = async () => ({
		ok: true,
		value: { ...snapshotValue, branch: "feat/pr-demo", clean: true, changes: { staged: 0, unstaged: 0, untracked: 0, total: 0 }, ahead: 2, behind: 0 }
	});
	gitRemote.syncCommits = async () => ({
		ok: true,
		value: { ok: true, upstream: "origin/main", ahead: [{ hash: "a" }, { hash: "b" }], behind: [], aheadFiles: [], behindFiles: [], mergeBase: "" }
	});
	gitRemote.createPullRequest = async (request) => {
		lastCreate = request;
		return { ok: true, value: { ok: true, number: 7, url: "https://github.com/o/r/pull/7" } };
	};
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const create = findClass(tree, "dshg-op").find((node) => textOf(node) === "创建PR");
	assert(create !== void 0, "创建PR button missing: " + findClass(tree, "dshg-op").map(textOf).join("|"));
	create.props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	for (let pass = 0; pass < 4; pass += 1) {
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
	}
	const card = findClass(tree, "dshg-prCreateCard")[0];
	assert(card !== void 0, "create PR dialog missing; cards=" + findClass(tree, "dshg-modalCard").map((node) => node.props.className).join(" | "));
	const text = textOf(card);
	for (const label of ["源分支", "目标仓库", "目标分支", "推送账户"]) assert(text.includes(label), `missing field: ${label}`);
	assert(text.includes("feat/pr-demo"), "source branch not shown");
	assert(text.includes("o/r"), "source repo not shown");
	assert(text.includes("2 个提交未推送"), "unpushed warning missing: " + text);
	// Empty title must disable submit.
	const titleInput = findClass(card, "dshg-setInput").find((node) => node.props.placeholder === "标题（必填）");
	assert(titleInput !== void 0, "title input missing");
	titleInput.props.onChange({ target: { value: "" } });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const blocked = findClass(tree, "dshg-op").find((node) => textOf(node) === "创建 PR");
	assert(blocked !== void 0 && blocked.props.disabled === true, "empty title must disable submit (found=" + (blocked === void 0 ? "none" : textOf(blocked) + " disabled=" + blocked.props.disabled) + ", input=" + titleInput.props.placeholder + ")");
	// With a title the request carries owner:branch as head and the chosen base.
	const card2 = findClass(tree, "dshg-prCreateCard")[0];
	const title2 = findClass(card2, "dshg-setInput").find((node) => node.props.placeholder === "标题（必填）");
	title2.props.onChange({ target: { value: "test pr" } });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const submit = findClass(tree, "dshg-op").find((node) => textOf(node) === "创建 PR");
	assert(submit !== void 0 && submit.props.disabled !== true, "submit should be enabled with a title");
	submit.props.onClick();
	await flush();
	assert(lastCreate !== null, "createPullRequest not called");
	assert(lastCreate.options.head === "o:feat/pr-demo", "head must be owner:branch, got " + lastCreate.options.head);
	assert(lastCreate.options.base === "main", "base branch wrong: " + lastCreate.options.base);
	assert(lastCreate.account === "LingQi-07-std", "account not passed: " + lastCreate.account);
	gitRemote.status = prevStatus;
	gitRemote.snapshot = prevSnapshot;
	gitRemote.syncCommits = prevSync;
	gitRemote.createPullRequest = prevCreate;
});

// ---------- push panel ----------
await check("push panel lists commits, probes permission and pushes with the chosen account", async () => {
	const prevStatus = gitRemote.status;
	const prevSnapshot = gitRemote.snapshot;
	const prevSync = gitRemote.syncCommits;
	const prevPush = gitRemote.pushRemote;
	const prevPerm = gitRemote.repoPermission;
	let lastPush = null;
	let permProbes = 0;
	gitRemote.status = async () => ({ ok: true, value: { clean: true, entries: [] } });
	gitRemote.snapshot = async () => ({
		ok: true,
		value: { ...snapshotValue, branch: "feat/push", clean: true, changes: { staged: 0, unstaged: 0, untracked: 0, total: 0 }, ahead: 1, behind: 0 }
	});
	gitRemote.syncCommits = async () => ({
		ok: true,
		value: { ok: true, upstream: "origin/feat/push", ahead: [{ hash: "aaa111", short: "aaa111", subject: "feat: one", author: "Arona" }], behind: [], aheadFiles: [{ path: "a.js" }], behindFiles: [], mergeBase: "" }
	});
	gitRemote.pushRemote = async (request) => { lastPush = request; return { ok: true, value: { ok: true, message: "已推送" } }; };
	gitRemote.repoPermission = async () => { permProbes += 1; return { ok: true, value: { ok: true, canPush: true, canPull: true, status: 200, reason: "" } }; };
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const pushOp = findClass(tree, "dshg-op").find((node) => textOf(node).startsWith("推送改动"));
	assert(pushOp !== void 0, "推送改动 button missing");
	pushOp.props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	for (let pass = 0; pass < 3; pass += 1) {
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
	}
	const card = findClass(tree, "dshg-pushCard")[0];
	assert(card !== void 0, "push panel missing");
	const text = textOf(card);
	assert(text.includes("feat/push"), "branch missing: " + text.slice(0, 120));
	assert(text.includes("feat: one"), "commit list missing");
	assert(text.includes("此账户拥有推送权限"), "automatic permission probe missing");
	assert(permProbes >= 1, "repoPermission not called");
	const select = findClass(card, "dshg-setSelect")[0];
	assert(select !== void 0, "account picker missing");
	select.props.onChange({ target: { value: "Other-Account" } });
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(permProbes >= 2, "switching account must re-check permission");
	const submit = findClass(tree, "dshg-op").find((node) => textOf(node) === "推送");
	assert(submit !== void 0 && submit.props.disabled !== true, "push submit should be enabled");
	submit.props.onClick();
	await flush();
	assert(lastPush !== null, "pushRemote not called");
	assert(lastPush.branch === "feat/push", "branch wrong: " + lastPush.branch);
	assert(lastPush.remote === "origin", "remote wrong: " + lastPush.remote);
	assert(lastPush.account === "Other-Account", "account not passed: " + lastPush.account);
	// Force push colours both text and frame.
	assert(String(styleTag.textContent ?? "").includes(".dshg-opPrimary.dshg-opDanger"), "danger border override missing");
	gitRemote.status = prevStatus;
	gitRemote.snapshot = prevSnapshot;
	gitRemote.syncCommits = prevSync;
	gitRemote.pushRemote = prevPush;
	gitRemote.repoPermission = prevPerm;
});

// ---------- pull dialog ----------
await check("pull dialog lists incoming commits and pulls on confirm", async () => {
	const prevStatus = gitRemote.status;
	const prevSnapshot = gitRemote.snapshot;
	const prevSync = gitRemote.syncCommits;
	const prevPull = gitRemote.pullRemote;
	let pulled = 0;
	gitRemote.status = async () => ({ ok: true, value: { clean: true, entries: [] } });
	gitRemote.snapshot = async () => ({
		ok: true,
		value: { ...snapshotValue, branch: "feat/pull", clean: true, changes: { staged: 0, unstaged: 0, untracked: 0, total: 0 }, ahead: 0, behind: 1 }
	});
	gitRemote.syncCommits = async () => ({
		ok: true,
		value: { ok: true, upstream: "origin/feat/pull", ahead: [], behind: [{ hash: "b111", short: "b111", subject: "fix: incoming", author: "Bob" }], aheadFiles: [], behindFiles: [{ path: "b.js" }], mergeBase: "" }
	});
	gitRemote.pullRemote = async () => { pulled += 1; return { ok: true, value: { ok: true, message: "已拉取" } }; };
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const pullOp = findClass(tree, "dshg-op").find((node) => textOf(node).startsWith("拉取改动"));
	assert(pullOp !== void 0, "拉取改动 button missing");
	pullOp.props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	for (let pass = 0; pass < 3; pass += 1) {
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
	}
	const card = findClass(tree, "dshg-pullCard")[0];
	assert(card !== void 0, "pull dialog missing");
	const text = textOf(card);
	assert(text.includes("fix: incoming"), "incoming commit missing: " + text.slice(0, 120));
	assert(text.includes("即将拉取"), "pull section title missing");
	const confirm = findClass(tree, "dshg-op").find((node) => textOf(node) === "拉取");
	assert(confirm !== void 0 && confirm.props.disabled !== true, "pull confirm missing or disabled");
	confirm.props.onClick();
	await flush();
	assert(pulled === 1, "pullRemote not called");
	gitRemote.status = prevStatus;
	gitRemote.snapshot = prevSnapshot;
	gitRemote.syncCommits = prevSync;
	gitRemote.pullRemote = prevPull;
});

// ---------- sync mode ----------
await check("sync mode shows both sides and pulls before pushing", async () => {
	const prevStatus = gitRemote.status;
	const prevSnapshot = gitRemote.snapshot;
	const prevSync = gitRemote.syncCommits;
	const prevPull = gitRemote.pullRemote;
	const prevPush = gitRemote.pushRemote;
	const order = [];
	gitRemote.status = async () => ({ ok: true, value: { clean: true, entries: [] } });
	gitRemote.snapshot = async () => ({
		ok: true,
		value: { ...snapshotValue, branch: "feat/sync", clean: true, changes: { staged: 0, unstaged: 0, untracked: 0, total: 0 }, ahead: 1, behind: 1 }
	});
	gitRemote.syncCommits = async () => ({
		ok: true,
		value: {
			ok: true,
			upstream: "origin/feat/sync",
			ahead: [{ hash: "c111", short: "c111", subject: "feat: outgoing", author: "Arona" }],
			behind: [{ hash: "d111", short: "d111", subject: "fix: incoming", author: "Bob" }],
			aheadFiles: [{ path: "c.js" }],
			behindFiles: [{ path: "d.js" }],
			mergeBase: ""
		}
	});
	gitRemote.pullRemote = async () => { order.push("pull"); return { ok: true, value: { ok: true, message: "已拉取" } }; };
	gitRemote.pushRemote = async () => { order.push("push"); return { ok: true, value: { ok: true, message: "已推送" } }; };
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const syncOp = findClass(tree, "dshg-op").find((node) => textOf(node).startsWith("同步改动"));
	assert(syncOp !== void 0, "同步改动 button missing");
	syncOp.props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	for (let pass = 0; pass < 3; pass += 1) {
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
	}
	const card = findClass(tree, "dshg-pushCard")[0];
	assert(card !== void 0, "sync dialog missing");
	const text = textOf(card);
	assert(text.includes("同步改动"), "sync title missing");
	assert(text.includes("即将拉取") && text.includes("即将推送"), "both sections expected: " + text.slice(0, 160));
	assert(text.includes("fix: incoming") && text.includes("feat: outgoing"), "both commit lists expected");
	const run = findClass(tree, "dshg-op").find((node) => textOf(node) === "同步");
	assert(run !== void 0 && run.props.disabled !== true, "sync confirm missing or disabled");
	run.props.onClick();
	await flush();
	assert(order.join(",") === "pull,push", "sync order wrong: " + order.join(","));
	gitRemote.status = prevStatus;
	gitRemote.snapshot = prevSnapshot;
	gitRemote.syncCommits = prevSync;
	gitRemote.pullRemote = prevPull;
	gitRemote.pushRemote = prevPush;
});

// ---------- rebase + push ----------
await check("rebase panel backs up, rebases and force-pushes in one go", async () => {
	const prevStatus = gitRemote.status;
	const prevSnapshot = gitRemote.snapshot;
	const prevSync = gitRemote.syncCommits;
	const prevRebase = gitRemote.rebase;
	const prevCreateBranch = gitRemote.createBranch;
	const prevPush = gitRemote.pushRemote;
	const order = [];
	gitRemote.status = async () => ({ ok: true, value: { clean: true, entries: [] } });
	gitRemote.snapshot = async () => ({
		ok: true,
		value: { ...snapshotValue, branch: "feat/rb", clean: true, changes: { staged: 0, unstaged: 0, untracked: 0, total: 0 }, ahead: 1, behind: 1 }
	});
	gitRemote.syncCommits = async () => ({
		ok: true,
		value: {
			ok: true,
			upstream: "origin/main",
			ahead: [{ hash: "e111", short: "e111", subject: "feat: local work", author: "Arona" }],
			behind: [{ hash: "f111", short: "f111", subject: "fix: remote work", author: "Bob" }],
			aheadFiles: [],
			behindFiles: [],
			mergeBase: ""
		}
	});
	gitRemote.createBranch = async (request) => { order.push("backup:" + String(request.name).startsWith("backup/")); return { ok: true, value: { ok: true, message: "created" } }; };
	gitRemote.rebase = async () => { order.push("rebase"); return { ok: true, value: { ok: true, message: "已变基" } }; };
	gitRemote.pushRemote = async (request) => { order.push("push:" + (request.force === true)); return { ok: true, value: { ok: true, message: "已推送" } }; };
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const rbOp = findClass(tree, "dshg-op").find((node) => textOf(node).startsWith("变基推送"));
	assert(rbOp !== void 0, "变基推送 button missing");
	rbOp.props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	for (let pass = 0; pass < 3; pass += 1) {
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
	}
	const card = findClass(tree, "dshg-pushCard")[0];
	assert(card !== void 0, "rebase dialog missing");
	// A sync dialog may still be fading out at an earlier slot; check the whole tree.
	const text = textOf(tree);
	assert(text.includes("将被重写的提交"), "rebase dialog body missing");
	assert(text.includes("feat: local work"), "rewritten commit missing");
	assert(text.includes("--force-with-lease"), "forced push notice missing");
	assert(text.includes("此账户拥有推送权限"), "permission probe missing");
	const go = findClass(tree, "dshg-op").find((node) => textOf(node) === "变基推送");
	assert(go !== void 0 && go.props.disabled !== true, "rebase confirm missing or disabled");
	go.props.onClick();
	await flush();
	assert(order.join(",") === "backup:true,rebase,push:true", "rebase pipeline order wrong: " + order.join(","));
	gitRemote.status = prevStatus;
	gitRemote.snapshot = prevSnapshot;
	gitRemote.syncCommits = prevSync;
	gitRemote.rebase = prevRebase;
	gitRemote.createBranch = prevCreateBranch;
	gitRemote.pushRemote = prevPush;
});

// ---------- force push confirmation ----------
await check("force push asks for confirmation before pushing", async () => {
	const prevStatus = gitRemote.status;
	const prevSnapshot = gitRemote.snapshot;
	const prevSync = gitRemote.syncCommits;
	const prevPush = gitRemote.pushRemote;
	let pushed = 0;
	gitRemote.status = async () => ({ ok: true, value: { clean: true, entries: [] } });
	gitRemote.snapshot = async () => ({
		ok: true,
		value: { ...snapshotValue, branch: "feat/force", clean: true, changes: { staged: 0, unstaged: 0, untracked: 0, total: 0 }, ahead: 1, behind: 0 }
	});
	gitRemote.syncCommits = async () => ({
		ok: true,
		value: { ok: true, upstream: "origin/feat/force", ahead: [{ hash: "g111", short: "g111", subject: "feat: force case", author: "Arona" }], behind: [], aheadFiles: [], behindFiles: [], mergeBase: "" }
	});
	gitRemote.pushRemote = async () => { pushed += 1; return { ok: true, value: { ok: true, message: "已推送" } }; };
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-op").find((node) => textOf(node).startsWith("推送改动")).props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	for (let pass = 0; pass < 3; pass += 1) {
		await flush();
		tree = renderTree(renderComponent(EntryComponent, entryProps));
	}
	const card = findClass(tree, "dshg-pushCard")[0];
	assert(card !== void 0, "push panel missing");
	const check = findClass(card, "dshg-remoteCheck")[0];
	assert(check !== void 0, "force checkbox missing");
	check.props.children[0].props.onChange({ target: { checked: true } });
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	findClass(tree, "dshg-op").find((node) => textOf(node) === "推送").props.onClick();
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	assert(pushed === 0, "force push must not run before confirmation");
	const confirm = findClass(tree, "dshg-confirmCard")[0];
	assert(confirm !== void 0, "confirmation dialog missing");
	const okBtn = findClass(confirm, "dshg-op").find((node) => textOf(node) === "强制推送");
	assert(okBtn !== void 0, "confirm button missing");
	okBtn.props.onClick();
	await flush();
	assert(pushed === 1, "force push not executed after confirmation");
	gitRemote.status = prevStatus;
	gitRemote.snapshot = prevSnapshot;
	gitRemote.syncCommits = prevSync;
	gitRemote.pushRemote = prevPush;
});

// ---------- retired PR row + bare list ----------
await check("clean state owns no PR row, and the bare PR list is not collapsed", async () => {
	const prevStatus = gitRemote.status;
	const prevSnapshot = gitRemote.snapshot;
	gitRemote.status = async () => ({ ok: true, value: { clean: true, entries: [] } });
	gitRemote.snapshot = async () => ({
		ok: true,
		value: { ...snapshotValue, clean: true, changes: { staged: 0, unstaged: 0, untracked: 0, total: 0 }, ahead: 0, behind: 0 }
	});
	slotStore.delete(EntryComponent);
	let tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	findClass(tree, "dshg-footerLabel")[0].props.onClick();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	await flush();
	tree = renderTree(renderComponent(EntryComponent, entryProps));
	const block = findClass(tree, "dshg-cleanBlock")[0];
	assert(block !== void 0, "clean block missing");
	const kids = (Array.isArray(block.props.children) ? block.props.children : [block.props.children]).filter(Boolean);
	assert(kids.length === 1, "clean block must only contain the clean state, got " + kids.length + " children");
	assert(findClass(tree, "dshg-bubblePr").length === 0, "the retired PR row must not come back");
	// Bare mode rides on the collapsed-list class; the 0fr row must be overridden.
	const css = String(styleTag.textContent ?? "");
	const bare = css.match(/\.dshg-prListBodyBare\{[^}]*\}/);
	assert(bare !== null, "bare PR list rule missing");
	assert(bare[0].includes("grid-template-rows:1fr"), "bare PR list must expand its grid row: " + bare[0]);
	gitRemote.status = prevStatus;
	gitRemote.snapshot = prevSnapshot;
});

// ---------- settings panel ----------
const ROW_PANEL_KEY = "plugins.row.config#@dsh-external/dsh-client-ui-git#ui-git";
const BUNDLE_PANEL_KEY = "plugins.bundle.config#@dsh-external/dsh-client-ui-git";

await check("settings panel registers on the plugin page (row + bundle)", async () => {
	assert(typeof registeredSlots.get(ROW_PANEL_KEY) === "function", "plugins.row.config must be registered with the package#row id key");
	assert(typeof registeredSlots.get(BUNDLE_PANEL_KEY) === "function", "plugins.bundle.config must be registered with the package name key");
});

await check("settings panel summary is one plain sentence", async () => {
	const Panel = registeredSlots.get(ROW_PANEL_KEY);
	const tree = renderTree(renderComponent(Panel, { view: "summary" }));
	const summary = textOf(tree);
	assert(summary.includes("reflog 备份"), "summary should mention the reflog switch: " + summary);
	assert(findClass(tree, "dshg-setSwitch").length === 0, "summary must not render controls");
});

await check("settings panel page renders its sections and controls", async () => {
	const Panel = registeredSlots.get(ROW_PANEL_KEY);
	const form = { state: { status: "ready", value: { ...settingsValue }, revision: 3, writable: true }, mutate: async () => true };
	let tree = renderTree(renderComponent(Panel, { view: "page", form }));
	await flush();
	tree = renderTree(renderComponent(Panel, { view: "page", form }));
	const text = textOf(tree);
	for (const title of ["提交身份", "面板与集成", "数据", "GitHub"]) assert(text.includes(title), `missing section: ${title}`);
	assert(findClass(tree, "dshg-setInput").length === 6, "six inputs expected");
	assert(findClass(tree, "dshg-setSwitch").length === 6, "six switches expected (DSH settings, reflog backup, dev strip, remote hint, allow create repo, PR in more)");
	assert(findClass(tree, "dshg-setSelect").length === 1, "dialog-anchor select expected");
	// GitHub section: the account list is collapsed by default; the header must exist
	// and name the active account.
	assert(findClass(tree, "dshg-setAccountsHead").length === 1, "account section header expected");
	assert(text.includes("当前账户："), "account header text expected");
	assert(text.includes("打开浏览器登录"), "browser-login button expected");
});

await check("settings panel toggle persists through the host half", async () => {
	const Panel = registeredSlots.get(ROW_PANEL_KEY);
	const form = { state: { status: "ready", value: { ...settingsValue }, revision: 4, writable: true }, mutate: async () => true };
	let tree = renderTree(renderComponent(Panel, { view: "page", form }));
	await flush();
	tree = renderTree(renderComponent(Panel, { view: "page", form }));
	const switches = findClass(tree, "dshg-setSwitch");
	switches[0].props.onClick();
	await flush();
	assert(settingsValue.showDshSettings === true, "toggle must write showDshSettings through pluginSettingsUpdate");
	assert(registeredSlots.has("settings.section#git-settings"), "DSH settings section must appear once the switch is on");
	// Turning it off again must unregister the section (no orphan nav entry).
	const after = renderTree(renderComponent(Panel, { view: "page", form }));
	const again = findClass(after, "dshg-setSwitch");
	again[0].props.onClick();
	await flush();
	assert(settingsValue.showDshSettings === false, "second toggle must clear showDshSettings");
	assert(!registeredSlots.has("settings.section#git-settings"), "DSH settings section must disappear when the switch is off");
});

console.log(results.join("\n"));
process.exitCode = failed > 0 ? 1 : 0;
console.log(process.exitCode === 1 ? "\nSOME CLIENT RENDER CHECKS FAILED" : "\nALL CLIENT RENDER CHECKS PASSED");
