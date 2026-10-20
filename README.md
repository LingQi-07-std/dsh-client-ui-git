# dsh-client-ui-git — DSH Git 可视化插件

在 DeepSeek Harness Web GUI 的侧边栏底部提供一个 Git 按钮（分支名 + 未提交改动徽标），点击打开只读 Git 面板：当前会话工作区的仓库概览、工作区状态、提交历史图（commit graph）与单提交 diff 浏览。

- 语言/框架：纯 JS（无构建步骤），host 半 ESM（cordis 插件），client 半 `__ModuleLoader__` bundle
- 依赖：host 半仅需 `@deepseek-ai/dsh-typert-protocol`（运行时）；client 半无外部依赖（内联 mini-zod）
- 只读：绝不执行任何会修改仓库的 git 命令

## 结构

| 文件 | 职责 |
|---|---|
| `lib/index.js` | host 半：`GitGateway`（`git` Remote 服务），用 `child_process.spawn` 跑只读 git 命令 |
| `lib/typert.host.js` | host 半 TYPERT manifest（`exports["./typert"]`），由 `dsh-typert-loader` 自动注册 |
| `lib/client.js` | client 半：内联 mini-zod + remote contribution + 侧边栏按钮/抽屉面板 |
| `package.json` | `dsh.client: {platform: "web"}` 声明 client bundle |

## Remote 服务（namespace `git`）

| 方法 | 请求 | 返回 |
|---|---|---|
| `snapshot` | `{path}` | `{repo, path, root?, branch?, head?, clean?, changes?, ahead?, behind?}` |
| `log` | `{path, limit?}` | `{commits: [{hash, short, parents[], refs[], author, email, date, subject}]}` |
| `status` | `{path}` | `{clean, entries: [{x, y, path}]}`（porcelain 语义） |
| `diff` | `{path, commit}` | `{commit, files: [{path, added, removed, binary}], patch, truncated}` |

调用示例（浏览器）：
```js
const result = await ctx.remote.git.snapshot({ path: "G:/repo" });
if (result.ok) console.log(result.value.branch);
```

## UI

- 挂载点：`sidebar.footer.action`（侧边栏底部），撑开模式显示分支名，收起模式仅图标
- 面板：右侧抽屉（`min(440px, 100vw-32px)`），含工作区状态列表、提交图（第一父链+merge 标记）、每提交 diff（numstat + 截断 patch）
- 样式全部走 DSH alias-token CSS 变量（`--dsw-alias-*`），light/dark 与阿罗娜主题自动适配

## 安装与启用（web profile）

```bash
# 1. 包放入 profile node_modules
#    profiles/node_modules/@dsh-external/dsh-client-ui-git/  (lib/ + package.json)

# 2. profiles/web/cordis.patch.yml 追加：
# - insert:
#     - id: ui-git
#       name: '@dsh-external/dsh-client-ui-git'
```

- host 半由 cordis loader 实例化（Service 类），manifest 由 typert-loader 注册
- client 半由 client-modules 扫描 `dsh.client` 注入 boot；之后重启 dsh web 生效

## 开发/验证

```bash
node test-host.mjs       # host 半 git 解析逻辑（临时仓库端到端）
node test-contract.mjs   # TYPERT schema 与返回值的契约（含 client mini-zod 镜像）
node test-install.mjs    # 从 profile node_modules 按 loader 规则解析校验
```

注意：
- host 半不能用原生 decorator 语法（`@Remote`），strict 路径由 manifest 提供，类方法普通实现即可
- client 半**不要** inject `"remote.git"`（`$mount` 是 apply 内异步完成，注入会导致激活死锁）；在 apply 闭包里直接使用
- client 半 schema 会被 api-gateway 真实 `parse()`（参数与结果都校验），mini-zod 必须返回真值