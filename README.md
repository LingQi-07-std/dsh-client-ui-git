# dsh-client-ui-git — DSH Git 可视化插件

在 DeepSeek Harness Web GUI 的侧边栏底部放一个 Git 按钮（当前分支 + 未提交改动徽标），点开右侧抽屉即可查看并操作当前会话工作区的仓库：提交图、工作区状态、单提交 diff、分支、暂存（stash）、合并冲突、远程同步，以及仓库级设置。

## 功能

- **提交时间线**：`git log --all` 的提交图，含合并节点、分支/远程胶囊、reflog 事件（建分支、合并、reset）卡片、stash 卡片与回收站（游离提交）；支持双击查看、分支筛选（按圆点勾选，可保存到插件内存储）。
- **工作区**：按目录分组的未跟踪/修改/暂存文件树，可逐文件或整组提交、暂存、回退。
- **提交详情**：选中提交后查看其文件列表（增删行数）与 patch，支持检出、还原（生成反向提交）、硬回退（仅已提交且未推送）。
- **分支管理**：分支浮层显示本地分支的上游/领先落后、最后提交与创建信息；支持新建、切换、重命名、删除（含彻底删除与游离预览）、合并（ff-only / no-ff / squash）。
- **合并冲突**：冲突状态下显示进度条、冲突文件树与冲突块着色，支持继续/中止，状态在 `.git` 里，重开面板可恢复。
- **暂存与回收站**：stash 的列出、应用、弹出、开分支、删除；回收站列出不在任何分支上的游离提交并可恢复。
- **远程同步**：关联/更改/移除远程、fetch、pull、push（force-with-lease）、ahead/behind 气泡、PR 列表与创建（GitHub）。
- **仓库设置**：仓库级 `user.name` / `user.email`、固定凭据账户、`.gitignore` 规则编辑（规则列表 + 忽略文件清单 + 白名单模式提示 + 检查器）、打开仓库页面。
- **MCP 工具**：同仓库内的 `mcp/server.mjs` 提供一套 Git MCP 工具（46 个默认工具 + 按需开启的危险工具），源与运行副本用 `node scripts/sync-mcp.mjs` 同步。

## 安装

从 GitHub 安装（需要 DSH `>=0.2.0-rc.2 <0.3.0`）：

```sh
dsh plugin add https://github.com/LingQi-07-std/dsh-client-ui-git
```

本地开发时也可以把工作区目录加进 profile 的 `dependencies`（`file:` 路径）后重启 DSH。

## 配置

- **插件设置页**（DSH 设置 → 插件）与面板内设置：
  - 提交身份：`user.name` / `user.email`（仅补空缺，不覆盖已有仓库/全局配置）；
  - 当前账户：GitHub 凭据账户（空则交给 Git Credential Manager）；
  - 分支隐藏提示、PR 收入更多栏、背景 fetch 超时等开关。
- **仓库设置**（面板「更多」菜单）：仓库级身份、固定凭据账户、`.gitignore` 编辑。
- **MCP**：危险工具（`restore`、`reset`）默认关闭，在设置里开启后会写入 `$DSH_HOME/mcp-git/config.json`，下次启动 MCP 服务生效。

## 结构

| 文件 | 职责 |
|---|---|
| `lib/index.js` | host 半：`GitGateway`（`git` Remote 服务），用 `child_process.spawn` 跑 git |
| `lib/git-core.mjs` | 纯函数层：命令封装、porcelain 解析、读写实现 |
| `lib/typert.host.js` | host 半 TYPERT manifest |
| `lib/client.js` | client 半：store、侧边栏入口、抽屉面板、分支浮层、冲突视图、设置页（含 CSS） |
| `mcp/server.mjs` | 独立 MCP 服务（stdio），通过 GCM 复用凭据 |
| `locale/{zh,en}.json` | 插件页显示名称与描述 |

`remote.git` 由本包的 client 半自己挂载（外层 `apply` 先 `$mount`，UI 注册在子 fiber 里）。

## 开发与验证

```powershell
node test-gitcore.mjs         # git-core 读写全流程（临时仓库）
node test-gitcore-extended.mjs
node test-host.mjs            # GitGateway 端到端
node test-contract.mjs        # TYPERT 与 client mini-zod 双端契约
node test-client-offline.mjs  # 真 bundle 离线渲染
node test-install.mjs         # 安装校验与部署漂移（逐文件 SHA256）
```

host 半（`lib/index.js`、`lib/typert.host.js`、`lib/git-core.mjs`）改动需要重启 DSH；只改 `lib/client.js` 刷新页面即可。

## 说明

- 所有写操作都在 UI 里二次确认；悬停元素 + 修饰键（Alt/Ctrl/Shift，可配置）可把文件、提交、分支等引用插入对话输入框。
- 依赖官方 `@deepseek-ai/*` 包声明为 `peerDependencies`。
