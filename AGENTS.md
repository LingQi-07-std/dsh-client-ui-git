# AGENTS.md — dsh-client-ui-git

DSH Web GUI 的 Git 可视化插件（侧栏入口 + 抽屉面板）。纯 JS 无构建。
**动手前先读 `MEMORY.md`（踩坑）与第 7 节「当前进度与待办」。**

## 1. 结构

| 路径 | 职责 |
|---|---|
| `lib/git-core.mjs` | 纯函数 git 层（spawn / 解析 / 读写）；另有 MCP 同步副本 |
| `lib/index.js` | host 半 `GitGateway`，28 个方法（含分支管理 / 冲突状态 / 游离提交 / 插件状态） |
| `lib/typert.host.js` | 手写 TYPERT manifest（strict zod + `create()`），28 条 invocation |
| `lib/state.mjs` | 插件内持久化（`.data/state.json`，host 侧读写，卸载即清） |
| `lib/client.js` | 浏览器 bundle：store、入口、抽屉、分支浮层、冲突气泡、回收站、CSS（单文件） |
| `packages/dsh-client-git-remote/` | 独立 client 插件：`ctx.remote.$mount()` 挂 `git` namespace（28 条 descriptor） |
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

## 4. 部署（四步，缺一不可）

1. UI 包：工作区 → `G:\DSHDesktopPluginRemove\_stage\pkgs\dsh-client-ui-git`（robocopy `/E`）
2. **独立 remote 包：工作区 `packages\dsh-client-git-remote` → `_stage\pkgs\dsh-client-git-remote`**（漏了这一步，面板调用新方法会报 `ctx.remote.git[method] is not a function`）
3. `_stage` 的两个包 → `C:\Users\13953\.dsh\profiles\desktop\node_modules\@dsh-external\` 下各自目录
4. `node test-install.mjs` 校验逐文件 SHA256，并抽查 remote bundle 的 `descrip` 数量（28）与 `lib/client.js` 哈希

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

### 7.2 关键实现位置

| 想改什么 | 去哪 |
|---|---|
| 分支 / 冲突 / 游离 git 逻辑 | `lib/git-core.mjs` 末尾「branch management / merge-conflict state」段 |
| 新方法契约 | `lib/typert.host.js` 的 `reqShaped` / invocations；remote 包 `descrip` |
| 分支浮层 | `lib/client.js` 的 `BranchPopover` |
| 冲突气泡 / 列表 / 详情 | `ConflictBanner` / `ConflictTree` / `ConflictView` |
| 回收站 | `RecycleBin` + `refreshOrphans` |
| 弹窗分支 | `ActionModal` 的 `deleteBranch / renameBranch / merge / abortOperation / recoverCommit` |
| 工作区点击分发 | `openPreview`（冲突文件 → 冲突详情，普通文件 → workDiff） |
| 样式 | `lib/client.js` css 数组末尾新段 |

### 7.3 待办

1. **stash**（下一个功能）：core 已有 `stashAction`，UI 未接，建议放「更多」菜单。
2. 远程分支展示：`branchDetails` 已返回 `upstream`，浮层暂不显示。
3. 冲突状态自动刷新：目前靠手动/操作后刷新，想做到编辑器保存后自动更新需要轮询或文件监听。
4. 侧栏入口的冲突红点提示。
5. 分支浮层的「已删除分支」分组。
6. 快速合并的预检（分叉时提前禁用），目前靠 git 返回 `not-fast-forward`。
7. `PANEL_VERSION` 仍为 0.1.4，未随本次功能升版。
