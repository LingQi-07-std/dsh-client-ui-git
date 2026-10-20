# AGENTS.md — dsh-client-ui-git

DSH Web GUI 的 Git 视觉化插件（侧栏入口 + 只读/受限写入面板）。纯 JS，无构建步骤。
本文件记录跨会话必须知道的技术事实；踩坑与排查记录见 `MEMORY.md`。

## 1. 仓库结构

| 路径 | 职责 |
|---|---|
| `lib/git-core.mjs` | 纯函数层：`spawn` 调 git、porcelain 解析、读查询与写操作。被 host 半与 git MCP server 共用（MCP 侧有同步副本，改动要双写） |
| `lib/index.js` | host 半 `GitGateway extends TypertRemoteService(ctx, "git")`，14 个方法（读 / 安全写 / 危险写三档） |
| `lib/typert.host.js` | 手写 TYPERT manifest（`exports["./typert"]`），每方法带 strict zod schema + `create()` |
| `lib/client.js` | 浏览器 bundle（`window.__ModuleLoader__.load`）：mini-zod、store、侧栏入口、抽屉面板、i18n 字典、CSS |
| `packages/dsh-client-git-remote/` | 独立 client 插件：`ctx.remote.$mount()` 把 `git` namespace 挂到客户端 api gateway |
| `locale/{zh,en}.json` | 插件页显示元信息（`meta.title` / `meta.description`） |
| `test-*.mjs` | 测试套件，见 §5 |
| `cordis.patch.yml` | bundle 层：`- insert: - id: ui-git name: '@dsh-external/dsh-client-ui-git'` |

## 2. 运行时链路

```
浏览器                                    宿主
GitFooterEntry (sidebar.footer.action)
  └─ useSessions → 当前会话 cwd
       └─ ctx.remote.git.snapshot/log/status/branch/diff
            └─ api-gateway(严格 parse) → TYPERT manifest → GitGateway
                 └─ git-core.mjs → child_process.spawn("git", ...)
```

- `remote.git` 由 **git-remote 包** 先挂载；ui-git 的 `inject` 声明它，靠 cordis 顺序保证。
- client 侧 `ctx.remote.git.method(req)` 返回 `{ok, value}` 或 `{ok:false, error}`，不是裸值。
- 面板 store 是模块级不可变 store（`setStore` 生成新对象）；footer 入口与抽屉共用同一份事实。

## 3. 关键契约（0.2.1）

- `sidebar.footer.action` 的 owner props 只有 **`wide`**；`useSessions` / `useWorkspaces` / `t` 是渲染器给的 standard feeds，用前判 `typeof === "function"`。
- 当前工作区路径只能从 **`useSessions`** 取：`state.current` → `state.byId[current].cwd`。
  `useWorkspaces` 的 `WorkspaceListState` 只有 `items` / `recentWorkspaceId`（**没有 byId**），只作"没有打开会话"时的兜底。
- `exports.inject` 必须包含 `["slots", "locale", "remote", "remote.git"]`。
- client 半不得 `require` 任何其他 Harness Client 包（0.2.1 起）；图标全部内联。
- `react/jsx-runtime` 的 `jsx/jsxs` 不保证可用，bundle 顶部有 `createElement` 重建 shim。
- host/client 两侧 schema 都会被真实 `parse()`：请求 codec 必须 `.passthrough()`，结果 schema 字段必须完整。
- `engines.dsh` 用区间 `>=0.2.0-rc.2 <0.3.0`，禁止钉精确 rc。

## 4. 环境与部署链路

- `DSH_HOME=C:\Users\13953\.dsh`，活跃 profile = `profiles\desktop`（以 `$env:DSH_PROFILE_DIR` 为准，别用 AppData 下那份 harness-home 旧数据）。
- profile 的 `package.json` 用 `file:G:/DSHDesktopPluginRemove/_stage/pkgs/<pkg>` 声明依赖，**node_modules 里是复制而非链接**。
- 部署三步（缺一不可）：
  1. 工作区 → `_stage\pkgs\dsh-client-ui-git`（robocopy /E）
  2. `_stage` → `profiles\desktop\node_modules\@dsh-external\dsh-client-ui-git`
  3. 重启 DSH：**host 半/manifest 改动必须重启**；仅 client.js 改动可能走 HMR，但不保证，交付时按"需重启"说明。
- 改完用 `node test-install.mjs` 校验"部署副本与工作区逐文件 SHA256 一致"。

## 5. 测试

```powershell
node test-gitcore.mjs          # git-core 读写全流程（临时仓库）
node test-gitcore-extended.mjs # diff/staging/log 过滤/show/blame/reflog/tag/分支/软回退/stash/abort/错误码
node test-mcp-server.mjs       # 真 stdio 起 MCP server：工具清单、危险开关、tools/call
node test-host.mjs             # GitGateway 端到端
node test-contract.mjs         # TYPERT schema 与 mini-zod 双端契约
node test-install.mjs          # profile 安装校验 + 部署漂移（DSH_PROFILE_DIR）
node test-client-offline.mjs   # 真 bundle 离线渲染：入口/抽屉/提交 diff（迷你 React）
```

- 工作区没有真实依赖树：`node_modules/@deepseek-ai` 与 `zod` 是指向 harness/desktop profile 的 junction（`.gitignore` 已排除），换机器要重建。
- `test-live.mjs` / `test-manual-rpc.mjs` 打真实 GUI 的 `/api/git/*`：端口与认证从 `DSH_WEB_URL` 取（可带 `?token=`），缺省 52493。

## 6. MCP 工具（`mcp/server.mjs`）

- 源在仓库 `mcp/server.mjs`，运行副本在 `$DSH_HOME/mcp-git/server.mjs`；**改完必须 `node scripts/sync-mcp.mjs` 再重启 DSH**。
- `git-core.mjs` 两份副本（插件 + MCP）由 `node scripts/sync-git-core.mjs` 同步，`--check` 校验漂移。
- 默认 22 个本地工具；`restore` / `reset` 危险工具**默认不注册**，由 `$DSH_HOME/mcp-git/config.json` 的 `allowDangerousTools: true`（或 `DSH_GIT_ALLOW_DANGEROUS=1`）开启 —— 后续设置页只需写这个配置。
- 联网能力（remote/fetch/pull/push）不在范围内，别顺手加。

## 7. 协作规矩（老师定）

- 任何模块更新都**先开分支**：`fix/…`、`feat/…`。
- 完成并**经老师确认可用**后才合并回 `main`；未确认不合并。
- 提交基线：`main` 上的基线 commit 必须可独立回滚（部署前先备份 profile 副本到工作区外）。
- 部署只按 §4 三步走，改完报告：改了哪些文件、验证结果、是否需重启。
