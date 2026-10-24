# AGENTS.md — dsh-client-ui-git

DSH Web GUI 的 Git 可视化插件（侧栏入口 + 抽屉面板）。纯 JS 无构建。
**动手前先读 `HANDOFF.md`**（当前进度/待办）与 `MEMORY.md`（踩坑）。

## 1. 结构

| 路径 | 职责 |
|---|---|
| `lib/git-core.mjs` | 纯函数 git 层（spawn / 解析 / 读写）；另有 MCP 同步副本 |
| `lib/index.js` | host 半 `GitGateway`，26 个方法（含分支管理 / 冲突状态 / 游离提交） |
| `lib/typert.host.js` | 手写 TYPERT manifest（strict zod + `create()`），26 条 invocation |
| `lib/client.js` | 浏览器 bundle：store、入口、抽屉、分支浮层、冲突气泡、回收站、CSS（单文件） |
| `packages/dsh-client-git-remote/` | 独立 client 插件：`ctx.remote.$mount()` 挂 `git` namespace（26 条 descriptor） |
| `cordis.patch.yml` | bundle 层 insert |
| `docs/` | 设计文稿（分支管理与合并冲突：`branch-management-design.md`） |

## 2. 链路

```
GitFooterEntry → useSessions 取 cwd
  → ctx.remote.git.<method>({path}) → api-gateway(严格 parse)
  → TYPERT manifest → GitGateway → git-core.mjs → spawn("git")
```

- `remote.git` 由 git-remote 包先挂载，`inject` 声明依赖顺序。
- client 侧返回 `{ok, value}` / `{ok:false, error}`，不是裸值。
- store 是模块级不可变对象（`setStore` 生成新对象），入口与抽屉共用。

## 3. 契约（0.2.1）

- footer slot owner props 只有 `wide`；`useSessions` / `useWorkspaces` / `t` 是 standard feeds，用前 `typeof === "function"` 判空，hook 无条件调用。
- 当前工作区：`useSessions` 的 `state.current` → `byId[current].cwd`；`useWorkspaces` 只做兜底（无 byId）。
- `exports.inject` 必须含 `["slots", "locale", "remote", "remote.git"]`。
- client 半不得 `require` 其他 Harness Client 包；图标内联。
- `jsx/jsxs` 不保证可用，顶部有 `createElement` shim；无 props 组件传 `{}`。
- 双端 schema 都会被真实 `parse()`：**Host 侧对请求参数严格 decode**（`codec.create().parse`），客户端侧只组装 args、不 parse 请求；请求 schema 必须覆盖面板真实传的字段。
- `engines.dsh` 用 `>=0.2.0-rc.2 <0.3.0`。

## 4. 部署（三步，缺一不可）

1. 工作区 → `G:\DSHDesktopPluginRemove\_stage\pkgs\dsh-client-ui-git`（robocopy `/E`）
2. `_stage` → `C:\Users\13953\.dsh\profiles\desktop\node_modules\@dsh-external\dsh-client-ui-git`
3. `node test-install.mjs` 校验逐文件 SHA256

**host 半（git-core / index / typert / remote）改动必须重启 DSH**；只改 `lib/client.js` 刷新即可。
`git-core.mjs` 有 MCP 副本：`node scripts/sync-git-core.mjs`（`--check` 查漂移）。

## 5. 测试

```powershell
node test-gitcore.mjs        # git-core 读写
node test-gitcore-extended.mjs
node test-mcp-server.mjs     # 真 stdio MCP
node test-host.mjs           # GitGateway 端到端
node test-contract.mjs       # TYPERT ↔ mini-zod 双端
node test-install.mjs        # 安装/漂移
node test-client-offline.mjs # 真 bundle 离线渲染
```

工作区依赖靠 junction（`node_modules/@deepseek-ai`、`zod`），换机器需重建。

## 6. 规矩（老师定）

- 改模块**先开分支**（`fix/…`、`feat/…`），确认可用后才合并 main。
- 交付报告：改了哪些文件、验证结果、是否需重启。
- 改源码只用 read/edit/write 工具，禁用 PowerShell 文本管道（会写坏 UTF-8）。
