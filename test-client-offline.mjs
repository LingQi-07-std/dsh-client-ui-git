// Offline render test for the browser half.
// Loads the real lib/client.js bundle in a vm sandbox with a minimal React
// stand-in, mounts the sidebar entry through the slot registration, and walks
// the resulting element tree (entry -> drawer -> panel). This catches the
// failures a browser would show as a blank footer button or React #130:
// undefined cwd, crash in any panel section, missing branch/badge data.
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

// ---------- minimal React (hooks + element factory) ----------
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
		// Dependency-aware like React: an unchanged dep array must not re-fire
		// (a re-run of GitPanel's mount effect would clear the open diff).
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
		// Skipped on purpose (the real one measures the window bar via document);
		// still occupies a hook slot so later indexes stay aligned.
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

// ---------- sandbox (document/window stubs) ----------
const styleTag = { dataset: {}, textContent: "" };
const documentStub = {
	querySelector: () => null,
	createElement: () => styleTag,
	head: { appendChild: () => void 0 },
	body: { dataset: {} },
	addEventListener: () => void 0,
	removeEventListener: () => void 0,
};
const windowStub = { addEventListener: () => void 0, setTimeout: setTimeout, clearTimeout: clearTimeout };
const sandbox = { window: windowStub, document: documentStub, console, setTimeout, clearTimeout, queueMicrotask };
let registered = null;
windowStub.__ModuleLoader__ = { load: (definition) => { registered = definition; } };

// ---------- fake git Remote ----------
const REPO = { path: "G:\\demo-repo", root: "G:\\demo-repo" };
const snapshotValue = {
	repo: true,
	path: REPO.path,
	root: REPO.root,
	branch: "main",
	head: "abc12345",
	clean: false,
	changes: { staged: 1, unstaged: 1, untracked: 1, total: 3 },
	ahead: 1,
	behind: 0
};
const logValue = {
	commits: [
		{ hash: "abc12345deadbeef", short: "abc12345", parents: ["11111111"], refs: ["HEAD -> main"], author: "Arona", email: "a@b", date: new Date(Date.now() - 60000).toISOString(), subject: "feat: first commit" },
		{ hash: "11111111deadbeef", short: "11111111", parents: [], refs: ["v1"], author: "Arona", email: "a@b", date: new Date(Date.now() - 7200000).toISOString(), subject: "init" }
	]
};
const statusValue = { clean: false, entries: [{ x: " ", y: "M", path: "src/app.js" }, { x: "?", y: "?", path: "notes.md" }, { x: "M", y: " ", path: "lib/core.mjs" }] };
const branchValue = { branches: ["main", "feature/x"] };
const diffValue = { commit: "abc12345deadbeef", files: [{ path: "src/app.js", added: 4, removed: 1, binary: false }], patch: "diff --git a/src/app.js\n+hi\n", truncated: false };
const callCount = { snapshot: 0, diff: 0 };
const gitRemote = {
	snapshot: async () => { callCount.snapshot += 1; return { ok: true, value: snapshotValue }; },
	log: async () => ({ ok: true, value: logValue }),
	status: async () => ({ ok: true, value: statusValue }),
	branch: async () => ({ ok: true, value: branchValue }),
	diff: async () => { callCount.diff += 1; return { ok: true, value: diffValue }; },
	commit: async () => ({ ok: true, value: { ok: true, message: "done" } })
};

// ---------- load the bundle ----------
let apply = null;
try {
	const code = readFileSync(join(WORKSPACE, "lib", "client.js"), "utf8");
	vm.runInNewContext(code, sandbox, { filename: "client.js" });
	assert(registered !== null, "bundle did not call __ModuleLoader__.load");
	assert(registered.id === "@dsh-external/dsh-client-ui-git", `unexpected bundle id: ${registered.id}`);
	const moduleExports = registered.factory((specifier) => {
		if (specifier === "react") return React;
		if (specifier === "react/jsx-runtime") return jsxRuntime;
		throw new Error(`unexpected require(${JSON.stringify(specifier)})`);
	});
	apply = moduleExports.apply;
	assert(typeof apply === "function", "exports.apply missing");
	assert(Array.isArray(moduleExports.inject), "exports.inject missing");
	assert(moduleExports.inject.includes("remote.git"), "remote.git inject missing");
} catch (error) {
	results.push(`FAIL bundle load: ${error instanceof Error ? error.message : error}`);
	failed += 1;
}

// ---------- slot registration + render helpers ----------
const SessionState = { current: "s-1", byId: { "s-1": { cwd: REPO.path } } };
const WorkspaceState = { items: [], recentWorkspaceId: void 0 };
const useSessions = (selector) => selector(SessionState);
const useWorkspaces = (selector) => selector(WorkspaceState);
const t = (key, params) => {
	const dict = {
		"action.title": "Git visualizer", "action.branch.unknown": "git", "panel.title": "Git",
		"state.clean": "clean", "state.changes": "changes", "state.staged": "staged", "state.unstaged": "unstaged",
		"state.untracked": "untracked", "state.loading": "loading", "state.selectHint": "select a commit",
		"state.noCommits": "no commits", "state.root": "(root)", "section.status": "Working tree",
		"op.commit": "Commit", "section.diff": "Commit diff"
	};
	const raw = dict[key] ?? key;
	return params === void 0 ? raw : String(raw).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, n) => (params[n] === void 0 ? m : String(params[n])));
};

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

/** Walk an element tree, rendering function and class components. */
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
		const rendered = renderComponent(type, props);
		return renderTree(rendered, depth + 1);
	}
	return { type, props: { ...props, children: renderTree(props.children, depth + 1) } };
}

/** Collect every node carrying one className (space-separated aware). */
function findClass(tree, className, found = []) {
	if (tree === null || tree === void 0 || typeof tree !== "object") return found;
	if (Array.isArray(tree)) { for (const child of tree) findClass(child, className, found); return found; }
	const own = typeof tree.props?.className === "string" ? tree.props.className.split(/\s+/) : [];
	if (own.includes(className)) found.push(tree);
	findClass(tree.props?.children, className, found);
	return found;
}
/** Concatenate all text under a node (buttons render [glyph, label, badge]). */
function textOf(node) {
	if (node === null || node === void 0 || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (typeof node === "object") return textOf(node.props?.children);
	return "";
}

// ---------- mount the entry through the slot ----------
let EntryComponent = null;
const fakeCtx = {
	slots: {
		inject: (_name, factory) => { factory(); },
		register: (_options, component) => { EntryComponent = component; return () => void 0; }
	},
	remote: { git: gitRemote }
};
await check("apply registers the footer entry", async () => {
	assert(typeof apply === "function", "apply unavailable");
	apply(fakeCtx);
	assert(typeof EntryComponent === "function", "no component registered on sidebar.footer.action");
});

// First render fires the effect; flush it so the snapshot lands in the store.
const entryProps = { wide: true, useSessions, useWorkspaces, t };
let entryTree = null;
await check("entry renders wide label + dirty badge", async () => {
	entryTree = renderTree(renderComponent(EntryComponent, entryProps));
	await Promise.all(pendingEffects.splice(0).map((fn) => fn()));
	await new Promise((resolve) => setTimeout(resolve, 50));
	entryTree = renderTree(renderComponent(EntryComponent, entryProps));
	const labels = findClass(entryTree, "dshg-footerBranch");
	assert(labels.length === 1, `expected one branch label, got ${labels.length}`);
	assert(textOf(labels[0]) === "main", `branch label should be "main", got ${JSON.stringify(textOf(labels[0]))}`);
	const badges = findClass(entryTree, "dshg-footerBadge");
	assert(badges.length === 1, `expected a dirty badge, got ${badges.length}`);
	assert(textOf(badges[0]) === "3", `badge should show 3 changes, got ${JSON.stringify(textOf(badges[0]))}`);
	assert(callCount.snapshot >= 1, "entry never pulled the snapshot");
});

await check("rail entry renders icon + badge", async () => {
	const railTree = renderTree(renderComponent(EntryComponent, { ...entryProps, wide: false }));
	const buttons = findClass(railTree, "dshg-footerBtn");
	assert(buttons.length === 1, "rail button missing");
	assert(findClass(railTree, "dshg-footerBranch").length === 0, "rail must not render the branch label");
	assert(findClass(railTree, "dshg-footerBadge").length === 1, "rail badge missing");
});

let openedTree = null;
await check("drawer opens and renders the panel", async () => {
	const entryNode = findClass(entryTree, "dshg-footerLabel")[0];
	assert(entryNode !== null && entryNode !== void 0, "wide entry button missing");
	entryNode.props.onClick();
	openedTree = renderTree(renderComponent(EntryComponent, entryProps));
	await Promise.all(pendingEffects.splice(0).map((fn) => fn()));
	const drawer = findClass(openedTree, "dshg-drawer");
	assert(drawer.length === 1, "drawer did not render");
	const title = findClass(openedTree, "dshg-title")[0];
	assert(title !== null && title !== void 0, "drawer title missing");
	assert(textOf(title) === "demo-repo", `drawer title should be the repo basename, got ${JSON.stringify(textOf(title))}`);
	const badgeTexts = findClass(openedTree, "dshg-badge").map(textOf);
	assert(badgeTexts.some((text) => text.includes("3")), `changes badge wrong: ${JSON.stringify(badgeTexts)}`);
	assert(findClass(openedTree, "dshg-commitSubject").length === 2, "commit rows missing");
	assert(findClass(openedTree, "dshg-fileRow").length === 3, "status file rows missing");
	assert(findClass(openedTree, "dshg-diffHint").length === 1, "diff placeholder missing");
});

await check("selecting a commit renders its diff", async () => {
	const rows = findClass(openedTree, "dshg-commitRow");
	assert(rows.length === 2, "commit rows not found in the opened drawer");
	rows[0].props.onClick();
	await new Promise((resolve) => setTimeout(resolve, 50));
	const detailTree = renderTree(renderComponent(EntryComponent, entryProps));
	const storeNow = typeof lastGetSnapshot === "function" ? lastGetSnapshot() : null;
	const body = findClass(detailTree, "dshg-body")[0];
	assert(body !== null && body !== void 0, "drawer body missing");
	assert(String(body.props.className).includes("dshg-mode-detail"), `body did not enter detail mode: ${JSON.stringify(body.props.className)}`);
	const diffRows = findClass(detailTree, "dshg-diffFileRow");
	assert(diffRows.length === 1, `expected one diff file row, got ${diffRows.length} (diff calls: ${callCount.diff}, patch blocks: ${findClass(detailTree, "dshg-patch").length}, errors: ${findClass(detailTree, "dshg-error").map(textOf).join("/")}, store.diff: ${storeNow?.diff === null ? "null" : typeof storeNow?.diff}, store.diffError: ${String(storeNow?.diffError)}, store.diffHash: ${String(storeNow?.diffHash)})`);
	assert(findClass(detailTree, "dshg-patch").length === 1, "patch block missing");
});

await check("falls back to the owning workspace when the session has no cwd", async () => {
	// A session whose host row carries no cwd must still resolve through the
	// workspace that accounts for it (`sessionIds`), not the first workspace.
	const previousSession = { current: SessionState.current, byId: SessionState.byId };
	const previousWorkspace = { items: WorkspaceState.items, recentWorkspaceId: WorkspaceState.recentWorkspaceId };
	try {
		SessionState.current = "s-2";
		SessionState.byId = { "s-2": {} };
		WorkspaceState.items = [
			{ workspaceId: "w-0", path: "G:\\unrelated-dir", sessionIds: [], title: "unrelated", createdAt: "", updatedAt: "" },
			{ workspaceId: "w-1", path: "G:\\other-repo", sessionIds: ["s-2"], title: "other-repo", createdAt: "", updatedAt: "" }
		];
		WorkspaceState.recentWorkspaceId = "w-0";
		slotStore.delete(EntryComponent);
		renderTree(renderComponent(EntryComponent, entryProps));
		await Promise.all(pendingEffects.splice(0).map((fn) => fn()));
		await new Promise((resolve) => setTimeout(resolve, 30));
		renderTree(renderComponent(EntryComponent, entryProps));
		const storeAfter = typeof lastGetSnapshot === "function" ? lastGetSnapshot() : null;
		assert(storeAfter?.cwd === "G:\\other-repo", `cwd should come from the owning workspace, got ${JSON.stringify(storeAfter?.cwd)}`);
	} finally {
		SessionState.current = previousSession.current;
		SessionState.byId = previousSession.byId;
		WorkspaceState.items = previousWorkspace.items;
		WorkspaceState.recentWorkspaceId = previousWorkspace.recentWorkspaceId;
		slotStore.delete(EntryComponent);
	}
});

await check("uses the most recently active session when none is selected", async () => {
	// Some deployments run with an empty selection cell (`current === undefined`)
	// while the list still holds every session row.
	const previousSession = { current: SessionState.current, byId: SessionState.byId };
	const previousWorkspace = { items: WorkspaceState.items, recentWorkspaceId: WorkspaceState.recentWorkspaceId };
	try {
		SessionState.current = void 0;
		SessionState.byId = {
			"session-old": { cwd: "G:\\old-repo", updatedAt: 100 },
			"session-live": { cwd: "G:\\live-repo", updatedAt: 999999 }
		};
		WorkspaceState.items = [{ workspaceId: "w-9", path: "G:\\fallback-dir", sessionIds: [], title: "fallback", createdAt: "", updatedAt: "" }];
		WorkspaceState.recentWorkspaceId = "w-9";
		slotStore.delete(EntryComponent);
		renderTree(renderComponent(EntryComponent, entryProps));
		await Promise.all(pendingEffects.splice(0).map((fn) => fn()));
		await new Promise((resolve) => setTimeout(resolve, 30));
		renderTree(renderComponent(EntryComponent, entryProps));
		const storeNow = typeof lastGetSnapshot === "function" ? lastGetSnapshot() : null;
		assert(storeNow?.cwd === "G:\\live-repo", `expected the latest session cwd, got ${JSON.stringify(storeNow?.cwd)}`);
	} finally {
		SessionState.current = previousSession.current;
		SessionState.byId = previousSession.byId;
		WorkspaceState.items = previousWorkspace.items;
		WorkspaceState.recentWorkspaceId = previousWorkspace.recentWorkspaceId;
		slotStore.delete(EntryComponent);
	}
});

console.log(results.join("\n"));
process.exitCode = failed > 0 ? 1 : 0;
console.log(process.exitCode === 1 ? "\nSOME CLIENT RENDER CHECKS FAILED" : "\nALL CLIENT RENDER CHECKS PASSED");
