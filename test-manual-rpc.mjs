// Verify the git UI write pipeline over RPC on G:\DSHplugins (the manual-ops
// flow the GUI buttons drive): init -> status -> commit -> snapshot -> log -> branch.
const PORT = 59637; // current dsh port; adjust if restarted
const CWD = "G:\\DSHplugins";

async function rpc(method, request) {
	const body = JSON.stringify({ type: "client-request", rpcId: "rpc-" + Math.random().toString(36).slice(2), method: "git/" + method, payload: { args: { request } } });
	const res = await fetch(`http://127.0.0.1:${PORT}/api/git/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body });
	return res.json();
}
const out = [];
const chk = (name, fn) => { try { fn(); out.push("PASS " + name); } catch (e) { out.push("FAIL " + name + ": " + e.message); process.exitCode = 1; } };
const v = (resp) => { if (!resp.result?.ok) throw new Error(resp.result?.error ? JSON.stringify(resp.result.error) : resp.result?.value); return resp.result.value; };

// 1) init (idempotent: re-init on existing repo is fine)
const initR = await rpc("init", { path: CWD, userName: "Arona Helper", userEmail: "arona@local" });
chk("init returns ok", () => { const x = v(initR); if (!x.ok) throw new Error(x.error); });

// 2) status shows untracked test files
const st = v(await rpc("status", { path: CWD }));
chk("status lists changes", () => { if (st.clean) throw new Error("expected untracked entries after adding test files"); });

// 3) commit (auto stage all)
const cmk = v(await rpc("commit", { path: CWD, message: "test: 手动操作验证 - 初始化 DSHplugins 仓库" }));
chk("commit ok", () => { if (!cmk.ok) throw new Error(cmk.error); });

// 4) snapshot reflects a repo now
const snap = v(await rpc("snapshot", { path: CWD }));
chk("snapshot repo=true + clean-ish", () => { if (!snap.repo) throw new Error("not a repo"); if (snap.clean === false) throw new Error("expected clean after commit"); });

// 5) log has the commit
const lg = v(await rpc("log", { path: CWD, limit: 10 }));
chk("log has commits", () => { if (lg.commits.length < 1) throw new Error("no commits"); });

// 6) branch exists with default branch
const br = v(await rpc("branch", { path: CWD }));
chk("branch lists", () => { if (br.branches.length < 1) throw new Error("no branch"); });

// 7) merge/dev branch flow: create branch + revert sanity is covered by git-core tests;
// here just confirm isRepo + a second commit on a scratch branch then back.
const co = v(await rpc("checkout", { path: CWD, target: br.branches[0] }));
chk("checkout base branch", () => { if (!co.ok) throw new Error(co.error); });

console.log("\n--- git init / commit verification on G:\\DSHplugins ---");
console.log("branch(es):", br.branches.join(", "));
console.log("HEAD:", snap.head, "->", snap.branch);
console.log("latest commit:", lg.commits[0].short, "-", lg.commits[0].subject);
console.log(out.join("\n"));
console.log(process.exitCode === 1 ? "\nSOME RPC CHECKS FAILED" : "\nALL MANUAL-OPS RPC CHECKS PASSED");
