# AGENTS.md — dsh-client-ui-git

DSH Web GUI 的 Git 可视化插件（侧栏入口 + 抽屉面板）。纯 JS 无构建。
**动手前先读 `MEMORY.md`（踩坑）与第 7 节「当前进度与待办」。**

## 1. 结构

| 路径 | 职责 |
|---|---|
| `lib/git-core.mjs` | 纯函数 git 层（spawn / 解析 / 读写）；另有 MCP 同步副本 |
| `lib/index.js` | host 半 `GitGateway`，51 个方法（含远程同步 / 冲突状态 / 游离提交 / 插件状态 / 设置 / GitHub 认证） |
| `lib/typert.host.js` | 手写 TYPERT manifest（strict zod + `create()`），51 条 invocation |
| `lib/state.mjs` | 插件内持久化（`.data/state.json`，host 侧读写，卸载即清） |
| `lib/github-auth.mjs` | GitHub 认证：封装 Git Credential Manager（list / browser login / token login / logout） |
| `lib/client.js` | 浏览器 bundle：store、入口、抽屉、分支浮层、冲突气泡、回收站、`remote.git` 挂载（51 条 descriptor）、设置面板、CSS（单文件） |
| `cordis.patch.yml` | bundle 层 insert（单行 `ui-git`，自包含） |
| `docs/` | 设计文稿（分支管理与合并冲突：`branch-management-design.md`） |

## 2. 链路

```
GitFooterEntry → useSessions 取 cwd
  → ctx.remote.git.<method>({path}) → api-gateway(严格 parse)
  → TYPERT manifest → GitGateway → git-core.mjs → spawn("git")
```

- `remote.git` 由**本包 client 半**挂载（2026-11-01 合并了原来的 `dsh-client-git-remote` 独立包）：外层 `apply` 先 `await ctx.remote.$mount(TYPERT_REMOTE)`，再把 UI 交给子 fiber `GitUiPlugin`（它 inject `remote.git`）。外层绝不能 inject `remote.git`（会等自己提供的服务）。
- client 侧返回 `{ok, value}` / `{ok:false, error}`，不是裸值。
- store 是模块级不可变对象（`setStore` 生成新对象），入口与抽屉共用。

## 3. 契约（0.2.1）

- footer slot owner props 只有 `wide`；`useSessions` / `useWorkspaces` / `t` 是 standard feeds，用前 `typeof === "function"` 判空，hook 无条件调用。
- 当前工作区：`useSessions` 的 `state.current` → `byId[current].cwd`；`useWorkspaces` 只做兜底（无 byId）。
- `exports.inject`（外层）只有 `["remote"]`；`remote.git` 由子 fiber `GitUiPlugin` 声明（`["slots", "locale", "remote.git"]`）。**外层绝不能写 `remote.git`**。
- client 半不得 `require` 其他 Harness Client 包；图标内联。
- `jsx/jsxs` 不保证可用，顶部有 `createElement` shim；无 props 组件传 `{}`。
- 双端 schema 都会被真实 `parse()`：**Host 侧对请求参数严格 decode**（`codec.create().parse`），客户端侧只组装 args、不 parse 请求；请求 schema 必须覆盖面板真实传的字段。
- `engines.dsh` 用 `>=0.2.0-rc.2 <0.3.0`。

## 4. 部署（两步，缺一不可）

1. 工作区 → `G:\DSHDesktopPluginRemove\_stage\pkgs\dsh-client-ui-git`（robocopy `/E`）
2. `_stage` 的包 → `C:\Users\13953\.dsh\profiles\desktop\node_modules\@dsh-external\dsh-client-ui-git`
3. `node test-install.mjs` 校验逐文件 SHA256，并抽查 `lib/client.js` 里 `descrip("` 的数量（51）

> 2026-11-01 起只有一个包：原来的 `dsh-client-git-remote` 已并入本包，profile 的 `dependencies` 与 `dsh.profile.bundles` 里都不要再出现它。

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

- **老师明确要求提交之前，不要执行任何 `git commit`**（2026-10-24 新增）。
- 改模块**先开分支**（`fix/…`、`feat/…`），确认可用后才合并 main。
- 交付报告：改了哪些文件、验证结果、是否需重启。
- 改源码只用 read/edit/write 工具，禁用 PowerShell 文本管道（会写坏 UTF-8）。

## 7. 当前进度与待办

设计文稿：`docs/branch-management-design.md`；冲突气泡原型：`shots/mockup-conflict.html`。

### 7.1 已完成（2026-10-24，分支 `feat/branch-management`）

- 分支浮层（`BranchPopover`）：本地分支列表、最后提交时间、切换、展开最后提交 + 创建信息（可跳时间线节点）、重命名（左下）、删除（含彻底删除与游离预览）、合并（三种方式）。
- 合并：`merge(dir, target, {mode})` 支持 `ff-only` / `no-ff` / `squash`；squash 成功后自动 commit。
- 冲突流程：`repoOperation` 探测 + `ConflictBanner` + 冲突文件树 + `ConflictView`（标记行着色）+ 继续/中止；冲突块归零显示「（解决）」，继续时统一 add；状态在 `.git`，重开面板自动恢复。
- 回收站：`orphanedCommits` + 更多菜单；游离 HEAD 徽标。
- 宿主方法 17 → 26；remote 包 26 条 descriptor；测试全绿。

### 7.1.1 2026-10-24 后续调整（未提交，等老师点名）

- 操作条改为三个常驻按钮：`全部提交 / 全部暂存 / 回退修改`，干净时灰显；选中文件时切换为 `选中提交 / 选中暂存 / 选中回退` 并带数量圆圈。
- 删除分支弹窗同时提供「安全删除（-d）」与「彻底删除（-D，带游离预览）」两个按钮。
- 分支排序：当前分支 → `main`/`master` → 最后提交时间倒序；主分支创建时间回退到根提交（`from: "仓库初始"`），查不到时显示「创建时间大于 30 天」。
- 「跳到创建节点」滚动到正中并让卡片闪烁，直到鼠标悬停。
- 分支行 / 分支浮层 / 更多菜单的展开收起都加了过渡动画。
- 操作条下方的分界线已去掉（操作条本身固定在抽屉顶部，不随内容滚动）。

### 7.1.2 2026-10-24 晚：分支筛选与插件内持久化

- 分支圆点可点：空心（2px 边框）/ 实心（选中）切换，带填充过渡；至少保留一个分支，全选等于不过滤。
- 时间线按选中分支过滤：祖先提交、任一方选中的合并事件 / 合并提交、选中分支的创建卡；三角箭头与分支胶囊同步隐藏。
- 筛选状态持久化到插件目录的 `.data/state.json`（`readPluginState` / `writePluginState`），按仓库 root 分键；卸载插件即清除，不碰工作区。
- 方法数 26 → 28（remote 包 descriptor 同步）。

### 7.1.3 2026-11-01：设置面板（插件页 + DSH 设置页）

- host 半导出 `Config`（schemastery，命名空间 = 行 id `ui-git`）：`userName` / `userEmail` / `reflogBackup` / `showDshSettings` / `modalAnchor`；同时挂到 `GitGateway.Config` 静态属性上（cordis 用 `runtime.Config` 校验，两种取法都成立）。
- 面板写入落 `.data/state.json` 的 `settings` 键（`pluginSettingsUpdate`），**不依赖** 行配置 `form.mutate`：外部插件的 `mutate` 不保证写进 profile patch（主题插件踩过，开关会「弹回」）。`form.mutate` 只做尽力同步。
- 读取走 `pluginSettings`：`默认值 <- 行 config <- 面板写入的 store`，三层合并。
- 两个新方法都是 `reqBare`（请求里没有 `path`）——设置是插件级的，调用时还没有仓库。
- 插件页两个注册点：`plugins.bundle.config`（key = 包名）与 `plugins.row.config`（key = `<包名>#ui-git`）；`view === "summary"` 只返回一句纯文本。
- DSH 设置页：`settings.section` 的注册由 store 订阅驱动，`showDshSettings` 一开就注册、一关就 dispose，不用刷新页面；`ctx.effect` 缺失时降级为不清理，不能让 apply 崩掉。
- 提交身份只补空缺：`identityArgs(dir, override)` 仍先查仓库/全局配置，只在为空时用面板值（默认回退 `DSH` / `dsh@local`）。
- 方法数 35 → 37（remote 包 descriptor 同步）；`test-host.mjs` 覆盖设置读写 + 部分写入不清空 + 身份生效；`test-client-offline.mjs` 覆盖注册 key、summary 纯文本、三个分区、开关联动 section。

### 7.1.4 2026-11-01：合并 remote 包 + devMode 进设置

- 原来的 `@dsh-external/dsh-client-git-remote`（纯挂载插件）并入本包：descriptor 表与极简 zod 一起搬进 `lib/client.js` 的 `#region typert remote contribution`。
- **激活分两级 fiber**（关键，详见 MEMORY.md 18.1）：`remote.git` 是嵌套服务，提供它的 fiber 不能 inject 它。外层 `apply` 只做 `await ctx.remote.$mount(TYPERT_REMOTE)` 然后 `await ctx.plugin(GitUiPlugin)`；所有 UI 注册都在子 fiber `GitUiPlugin` 里，它 inject `["slots", "locale", "remote.git"]`。
- `exports.inject`（外层）只有 `["remote"]`；`ctxRef` 指向子 ctx。
- `TYPERT_REMOTE.package` 改成 `PKG`（descriptor id 本来就是主包名）。
- 挂载失败时写 `store.clientError` 并 `return`（不注册 UI，控制台说明原因）。
- profile 侧清理：`package.json` 的 `dependencies` 与 `dsh.profile.bundles` 都移除该包，`node_modules` / `_stage` / 工作区 `packages/` 三处目录已删除。
- `devMode`（底部诊断条）从「只有 localStorage + `window.__dshGitDev`」升级为设置字段：`Config.devMode`，面板「面板与集成」区新增开关，读设置时同步写回 localStorage，`window.__dshGitDev` 保留兼容。

### 7.1.5 2026-11-01：GitHub 身份验证（封装 Git Credential Manager）

- 新增 `lib/github-auth.mjs`，**不自己存 token**：GCM 把凭据放在 Windows 凭据管理器（DPAPI 加密），`git push` / `fetch` 直接复用。本插件全程不落盘任何凭据。
- 两个登录入口：`github login --browser --no-ui`（打开系统浏览器走 OAuth，本地回环回调）与 `github login --pat <token> --no-ui`（粘贴 PAT）。
- **设备码流程不可用**：`--device --no-ui` 在无 tty 的子进程里从不打印验证码（实测 stdout/stderr 全空，HTTP 请求都没发出），用户会拿不到码。改用 `--browser`，它不需要终端输出。
- 浏览器登录是长活：`githubLoginStart` 起子进程并返回会话 id，面板每 2 秒 `githubLoginPoll`，3 分钟超时自动 kill；`githubLoginCancel` 手动取消。
- 6 个新方法（`githubAccounts` / `githubLoginStart` / `githubLoginPoll` / `githubLoginCancel` / `githubLoginToken` / `githubLogout`），全部 `reqBare`（无 path）。方法数 37 → 43。
- 设置面板新增「GitHub」分区：账号列表（来自 `github list`）+ 登出、浏览器登录（带等待/取消状态）、Token 登录（password 输入，登录成功后清空草稿）。
- 测试：`test-host.mjs` 只做形状断言（没有 GCM 的机器 `ok:false` 不算失败），并验证空 Token 被拒；`test-client-offline.mjs` 断言四个分区、账号行、登录按钮。

### 7.2 关键实现位置

| 想改什么 | 去哪 |
|---|---|
| 分支 / 冲突 / 游离 git 逻辑 | `lib/git-core.mjs` 末尾「branch management / merge-conflict state」段 |
| 新方法契约 | `lib/typert.host.js` 的 `reqShaped` / invocations；`lib/client.js` 的 `descrip` |
| 分支浮层 | `lib/client.js` 的 `BranchPopover` |
| 冲突气泡 / 列表 / 详情 | `ConflictBanner` / `ConflictTree` / `ConflictView` |
| 回收站 | `RecycleBin` + `refreshOrphans` |
| 弹窗分支 | `ActionModal` 的 `deleteBranch / renameBranch / merge / abortOperation / recoverCommit` |
| 工作区点击分发 | `openPreview`（冲突文件 → 冲突详情，普通文件 → workDiff） |
| 设置面板（插件页 / DSH 设置页） | `lib/client.js` 的 `GitSettingsPanel`，注册在 `apply` 末尾；host `Config` 在 `lib/index.js` 顶部 |
| 设置读写契约 | `reqBare` + `pluginSettings` / `pluginSettingsUpdate`；`lib/client.js` 同名 `descrip` |
| GitHub 认证 | `lib/github-auth.mjs`（GCM 封装）；面板「GitHub」分区在 `GitSettingsPanel` 末尾 |
| 样式 | `lib/client.js` css 数组末尾新段 |

### 7.3 待办

1. 远程分支展示：`branchDetails` 已返回 `upstream`，浮层暂不显示。
2. 冲突状态自动刷新：目前靠手动/操作后刷新，想做到编辑器保存后自动更新需要轮询或文件监听。
3. 侧栏入口的冲突红点提示。
4. 分支浮层的「已删除分支」分组。
5. `PANEL_VERSION` 已随设置面板升到 0.1.5（`package.json` 同步）。
6. GitHub 登录入口已完成（见 7.1.5）；下一步是远程操作本身：remote 列表、fetch/pull/push、远程分支、ahead/behind（`docs/github-remote-design.md`）。
