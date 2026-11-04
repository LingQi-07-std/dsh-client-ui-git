# dsh-client-ui-git — DSH Git 可视化插件

在 DeepSeek Harness Web GUI 的侧边栏底部提供一个 Git 按钮（当前分支名 + 未提交改动徽标），点击打开右侧抽屉：当前会话工作区的仓库概览、工作区状态、提交历史图，以及单提交的 diff 浏览与安全回退操作。

- 语言/框架：纯 JS（无构建步骤），host 半 ESM（cordis 插件），client 半 `__ModuleLoader__` bundle
- 依赖：host 半仅需 `@deepseek-ai/dsh-typert-protocol`（运行时）；client 半无外部依赖（内联 mini-zod）
- 只读方式：浏览类方法都是只读 git 命令；写入集中在「安全写」（init/commit/checkout/revert/merge）与「危险写」（restore/reset）两档，危险写只出现在 UI 里、必须经确认弹窗

## 结构

| 文件 | 职责 |
|---|---|
| `lib/index.js` | host 半：`GitGateway`（`git` Remote 服务），用 `child_process.spawn` 跑 git 命令 |
| `lib/git-core.mjs` | 纯函数层：命令封装、porcelain 解析、读写实现 |
| `lib/typert.host.js` | host 半 TYPERT manifest（`exports["./typert"]`），由 `dsh-typert-loader` 自动注册 |
| `lib/client.js` | client 半：内联 mini-zod + 侧边栏入口 + 抽屉面板 |
| `packages/dsh-client-git-remote/` | client 半的 `git` namespace 挂载插件（`ctx.remote.$mount`） |
| `locale/{zh,en}.json` | 插件页显示名称与描述 |

## Remote 服务（namespace `git`，共 14 个方法）

| 分组 | 方法 | 请求 | 返回 |
|---|---|---|---|
| 读 | `snapshot` | `{path}` | `{repo, path, root?, branch?, head?, clean?, changes?, ahead?, behind?}` |
| 读 | `log` | `{path, limit?}` | `{commits: [{hash, short, parents[], refs[], author, email, date, subject}]}` |
| 读 | `status` | `{path}` | `{clean, entries: [{x, y, path}]}`（porcelain 语义） |
| 读 | `diff` | `{path, commit}` | `{commit, files: [{path, added, removed, binary}], patch, truncated}` |
| 读 | `branch` | `{path}` | `{branches: string[]}` |
| 读 | `isRepo` | `{path}` | `{repo, error?}` |
| 安全写 | `init` | `{path, userName?, userEmail?}` | `{ok, message}` / `{ok:false, error}` |
| 安全写 | `commit` | `{path, message}` | `{ok, message, id?}`（自动 `add -A`） |
| 安全写 | `createBranch` | `{path, name, from?}` | `{ok, message}` |
| 安全写 | `checkout` | `{path, target}` | `{ok, message}`（非本地分支则游离 HEAD） |
| 安全写 | `revert` | `{path, commit}` | `{ok, message}`（生成反向提交） |
| 安全写 | `merge` | `{path, target}` | `{ok, message}` / `{ok:false, error, conflicts?}` |
| 危险写 | `restore` | `{path, paths?}` | `{ok, message}`（丢弃未提交改动） |
| 危险写 | `reset` | `{path, commit}` | `{ok, message}`（`--hard`，仅本地未推送） |

调用示例（浏览器，返回 `{ok, value}`）：

```js
const result = await ctx.remote.git.snapshot({ path: "G:/repo" });
if (result.ok) console.log(result.value.branch);
```

## MCP 工具（`mcp/server.mjs`，本地能力，不含联网）

源在仓库 `mcp/server.mjs`，运行副本 `$DSH_HOME/mcp-git/server.mjs`（用 `node scripts/sync-mcp.mjs` 部署，改完重启 DSH）。

| 分组 | 工具 |
|---|---|
| 只读 | `snapshot`、`log`（可按 paths/author/since/grep 过滤）、`status`、`diff`（提交 / 工作区 / 暂存区，可限定 paths 或只看 stat）、`show_file`、`branch`、`is_repo`、`blame`、`reflog` |
| 安全写 | `init`、`commit`（`stagedOnly` 可选）、`add`、`unstage`、`create_branch`、`branch_admin`（rename/delete）、`checkout`、`revert`、`merge`、`reset_soft`（撤销提交保留改动）、`abort`（merge/revert/cherry-pick）、`stash`（push/pop/apply/drop/list/show）、`tag`（list/create/delete） |
| 危险（默认关闭） | `restore`（丢弃改动）、`reset`（硬回退） |

危险工具默认**不注册**，开启方式（后续设置页就是写这个配置）：

```json
// $DSH_HOME/mcp-git/config.json
{ "allowDangerousTools": true }
```

或临时用环境变量 `DSH_GIT_ALLOW_DANGEROUS=1`。

## UI

- 挂载点：`sidebar.footer.action`（侧边栏底部，与设置、用量统计同排）
  - 撑开模式：分支图标 + 分支名 + 未提交数徽标；收起模式：图标 + 徽标
  - 工作区由 `useSessions`（当前会话的 `cwd`）决定，切换会话自动刷新；无会话时退到最近工作区
- 抽屉（宽 `min(440px, 100vw-32px)`）：
  - 头部：仓库名、干净/改动徽标、分支徽标、刷新、关闭
  - 操作行：提交存档 / 新建分支 / 切换分支 / 合并分支 / 丢弃改动（全部二次确认）
  - 工作区状态：按目录分组、可折叠，状态字母着色
  - 提交时间线：第一父链 + merge 标记 + refs 标签
  - 选中提交后切到 40/60 详情：该提交的文件 numstat + patch（截断提示）+ 回退/还原/硬回退
- 样式全部走 DSH alias-token CSS 变量（`--dsw-alias-*`），light/dark 与阿罗娜主题自动适配

## 安装与部署

本机链路（`file:` 依赖 + 复制安装）：

1. 工作区 → `G:\DSHDesktopPluginRemove\_stage\pkgs\dsh-client-ui-git`
2. `_stage` → `%DSH_PROFILE_DIR%\node_modules\@dsh-external\dsh-client-ui-git`
3. 重启 DSH（host 半/manifest 改动必须重启；仅 client 改动可先刷新页面试）

profile 的 `package.json` 需要两行：

```json
{
  "dependencies": { "@dsh-external/dsh-client-ui-git": "file:G:/DSHDesktopPluginRemove/_stage/pkgs/dsh-client-ui-git" },
  "dsh": { "profile": { "bundles": ["@dsh-external/dsh-client-git-remote", "@dsh-external/dsh-client-ui-git"] } }
}
```

`cordis.patch.yml` 里插入两行（git-remote 必须先于 ui-git，前者负责挂载 `remote.git`）：

```yaml
- insert:
    - id: git-remote
      name: '@dsh-external/dsh-client-git-remote'
- insert:
    - id: ui-git
      name: '@dsh-external/dsh-client-ui-git'
```

## 开发/验证

```powershell
node test-gitcore.mjs        # git-core 读写全流程（临时仓库）
node test-host.mjs           # GitGateway 端到端
node test-contract.mjs       # TYPERT schema 与 client mini-zod 双端契约
node test-install.mjs        # 安装校验 + 部署漂移（DSH_PROFILE_DIR，逐文件 SHA256）
node test-client-offline.mjs # 真 bundle 离线渲染：入口 / 抽屉 / 提交 diff
node test-live.mjs [dir]     # 打真实 GUI 的 /api/git/*（DSH_WEB_URL，可带 ?token=）
node test-manual-rpc.mjs [dir] # 真实 GUI 上的 init/commit 流程
```

工作区没有真实依赖树：`node_modules/@deepseek-ai`、`node_modules/zod` 是指向 harness / desktop profile 的 junction（已在 `.gitignore`）。

注意：
- host 半不能用原生 decorator 语法（`@Remote`），strict 路径由 manifest 提供，类方法普通实现即可
- client 半**不要** inject `"remote.git"` 之外的挂载逻辑（`$mount` 在 git-remote 的 apply 内），此处只声明注入
- client 半 schema 会被 api-gateway 真实 `parse()`（参数与结果都校验），mini-zod 必须返回真值
- 分支规矩：任何改动先开分支，老师验收通过后再合并 `main`
