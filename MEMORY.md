# MEMORY.md — dsh-client-ui-git 踩坑记录

只记"下次一定还会踩"的东西。每条都对应一次真实故障。

## 1. `sidebar.footer.action` 在 0.2.1 只收到 `wide`

- 组件签名曾写成 `({ wide, useWorkspaces })` 并从 `state.activeId / state.current / state.byId[id].path` 取路径 —— 全部不存在。
- `WorkspaceListState`（`dsh-client-runtime/lib/types/client/workspaces/service.d.ts`）只有
  `items / archivedSessionIds / state / phase / error / baselinesReady / recentWorkspaceId`。
- 正确来源是 `useSessions`（`SessionListState`）：`current` + `byId[current].cwd`。
- `t` / `useSessions` / `useWorkspaces` 都是 standard feeds（不是 owner props），必须 `typeof === "function"` 判空；
  两个 hook 要**无条件调用**（缺失时退化成空 selector），否则 hook 顺序会变。

## 2. 面板每次渲染都重建 git 对象 → 无限刷新 + diff 被清空

- 旧写法在 `GitPanelHost` 的 JSX 里内联 `git: { refresh, refreshDiff, run }`，新对象每渲染一次，
  `GitPanel` 的 `useEffect(..., [cwd, git])` 就重跑一次 → `refreshAll` → 清 diff。
- 修法：`useRef(null)` 缓存一份 `gitApi`，渲染只传 `gitApi.current`。

## 3. `refreshAll` 与用户点提交的竞态

- `refreshAll` 原来无条件 `diff: null, diffHash: null`；打开面板的刷新还没回来时点提交，
  刚加载的 diff 会被这次刷新覆盖成 null（面板一直转圈）。
- 修法：进入函数时记 `sameWorkspace = store.cwd === cwd`，同一工作区的刷新只更新
  snapshot/log/status/branch，**不碰 diff**；只有切工作区才清。

## 4. PowerShell `Set-Content` 会写坏 UTF-8 源码

- 用 `(Get-Content -Raw) -replace ... | Set-Content -NoNewline` 改 `.js/.mjs` 时，中文被写坏成
  `提�?`，随后 `read`/`node` 全部报 invalid UTF-8 / SyntaxError。`-replace` 的替换串里 `$` 还会被当引用解释。
- 规矩：**源码只用 read/edit/write 工具改**，不要用 PowerShell 文本管道。万一写坏：删文件（确认绝对路径）再 write 重建。

## 5. 有两套 DSH_HOME，别用错

- 活跃：`C:\Users\13953\.dsh`（`$env:DSH_HOME` / `DSH_PROFILE_DIR=...\profiles\desktop`）。
- 旧残留：`C:\Users\13953\AppData\Roaming\deepseek-harness-desktop\harness-home`（里面的插件是 0.1.0 旧版）。
- 判断依据永远是环境变量或 `plugin_manager` 的 `source`，不要用文件时间戳猜。
- 部署目标是 `profiles\desktop\node_modules\@dsh-external\...`，那里是**复制**不是链接，改 `_stage` 不会自动生效。

## 6. 工作区的依赖靠 junction

- `node_modules/@deepseek-ai` → harness 的 `resources\harness\node_modules\@deepseek-ai`（profile 里没有内核包）
- `node_modules/zod` → `profiles\desktop\node_modules\zod`
- 换机器或删了 node_modules，`test-host` / `test-contract` / `test-install` 会 `ERR_MODULE_NOT_FOUND`，重建 junction 即可。

## 7. 测试脚本里的历史硬编码

- `test-contract.mjs` 曾读 `../git-remote/lib/client.js`（重构前路径），改为 `./packages/dsh-client-git-remote/lib/client.js`。
- `test-install.mjs` 曾指向 AppData 的 harness-home profile，改为 `DSH_PROFILE_DIR`。
- `test-live.mjs` / `test-manual-rpc.mjs` 端口 56120 / 59637 早已失效；现在从 `DSH_WEB_URL` 取，401 时提示把带 `?token=` 的地址赋给它。

## 8. 离线渲染测试（test-client-offline.mjs）的写法要点

- 用 `vm.runInNewContext` 加载真 bundle，mock `window.__ModuleLoader__`、`react`、`react/jsx-runtime`、`document`。
- hook 槽位必须**按组件**用 WeakMap 隔离，`useState` 的 setter 要捕获自己的 slots 数组（否则点击后回调读到的 `currentSlots` 是 null）。
- `useEffect` 必须比较 deps（真实 React 不会因为无关渲染重跑），否则序列化不出竞态。
- `useSyncExternalStore` 存下 `getSnapshot`，测试里可直接读 store 断言（例如 `store.diffHash` 是否被清）。

## 9. 其它小坑

- DSH 每次重启 Web 端口都变：用户说"打不开/样式没了"先查端口，别先改代码。
- `SlotErrorBoundary` 捕获 React #130 后会**永久 abdicate** 该条目，不会自愈 —— 元素类型必须保证有定义。
- `plugin_manager list_bundles` 里的 `source` 才是真实安装位置；`enabled: true` 不代表文件是最新的。

## 10. MCP 工具面（0.2.0 之后）

- 工具清单在 `mcp/server.mjs`，运行副本 `$DSH_HOME/mcp-git/server.mjs`；**改完必须 sync + 重启 DSH**，否则会话里还是旧工具。
- 危险工具（`restore` / `reset`）用条件注册：`if (dangerousToolsEnabled()) server.tool(...)`。默认不注册，设置页只需写 `$DSH_HOME/mcp-git/config.json` 的 `allowDangerousTools: true`。
- `git-core.mjs` 两份副本：改了插件那份要 `node scripts/sync-git-core.mjs`；`--check` 进 CI/交付自检。
- `tools/call` 的返回是 `content[].text` 里的 JSON 字符串，测试要按行读 stdio、按 id 配对响应。

## 11. 中文/本地化 stderr 不能用来判定错误类型

- Windows 上 git 的 "nothing to commit" 可能是中文，靠 stderr 正则匹配会漏（实测 `commit(stagedOnly)` 也报成 `git-exit`）。
- 修法：先用状态命令预检（`git diff --cached --quiet`，exit 0 = 无暂存），再决定是否调用。
- `errorCodeOf` 里补了 `invalid object name` / `exists on disk, but not in` → `bad-revision`，否则 `show <rev>:<path>` 的错误码会退化成 `git-exit`。

## 12. `jsx(type, undefined)` 在 React 18 会直接崩

- 现象：面板文件列表整块报 `Cannot read properties of undefined (reading 'key')`，而入口按钮因为外层没有错误边界一起被摘掉。
- 原因：`h(WarnDot)` 这种无 props 组件调用，被 shim 原样传给 React 18 的 `jsx`，其内部 `config.key` 没有判空。
- 修法：shim 里 `props ?? {}`，组件调用统一 `h(Comp, {})`。
- 教训：离线测试的 mock `jsx` 会自己补 `{}`，所以这类问题**只有真实运行时才暴露**；新增无 props 组件时务必传空对象。

