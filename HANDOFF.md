# HANDOFF — 交接给下一个对话

最后更新：2026-10-24，分支 `feat/branch-management`（本轮功能完成，待合并 main）。

## 1. 项目是什么

`G:\DSH Plugins\dsh-client-ui-git` —— DSH Web GUI 的 Git 可视化插件（侧栏入口 + 抽屉面板）。
纯 JS 无构建：host 半（`lib/git-core.mjs` / `lib/index.js` / `lib/typert.host.js`）+ 浏览器 bundle（`lib/client.js`）+ 独立 remote 包（`packages/dsh-client-git-remote/`）。

设计文稿：`docs/branch-management-design.md`（冲突气泡原型：`shots/mockup-conflict.html` / `.png`）。

## 2. 本轮做了什么（分支管理 + 合并冲突）

### 2.1 host 契约：17 → 26 个方法

`lib/git-core.mjs` 新增：

| 函数 | 作用 |
|---|---|
| `branchDetails(dir)` | 本地分支详情：tip、最后提交、上游、是否已合并、reflog 里的创建记录 |
| `repoOperation(dir)` | 探测进行中操作（merge / squash / revert / cherry-pick / rebase）+ 冲突文件、每个文件的冲突块数、已 add 的已解决文件 |
| `conflictFile(dir, file)` | 冲突文件的工作区原文 + 索引三阶段（base / ours / theirs） |
| `orphanedCommits(dir)` | 回收站：reflog 出现过、`rev-list --all` 不可达、对象仍存在的提交 |
| `branchExclusiveCommits(dir, name)` | 删除分支前预览：只有该分支可达的提交 |
| `operationContinue(dir, kind)` | merge/revert/cherry-pick `--continue`；squash 用 `commit --no-edit` |
| `merge(dir, target, {mode})` | 扩展 `ff-only` / `no-ff` / `squash`（squash 成功后自动 commit） |
| `abortOperation` | 扩展 `rebase`，新增 `squash`（`reset --hard HEAD`，因为没有 MERGE_HEAD） |

`lib/index.js` / `lib/typert.host.js` / remote 包同步：新增 `branchDetails`、`branchExclusiveCommits`、`repoOperation`、`conflictFile`、`orphanedCommits`、`deleteBranch`、`renameBranch`、`operationContinue`、`operationAbort` 九条 invocation。
顺手修了两个契约 bug：`restore` 的请求 schema 不再要求 `commit`；`commit` 现在尊重请求里的 `stagedOnly`。

### 2.2 client 工具条

- 去掉「新建分支 / 切换分支 / 合并分支」三个按钮；右侧固定「分支」（BranchGlyph）+「更多」（四个空心方块 `MoreIcon`）。
- 分支浮层（`BranchPopover`）：列出本地分支（色点 / 名称 / 未合并标记 / 最后提交时间 / 切换按钮）；点行展开最后提交与创建信息（可跳到时间线节点）；左下「重命名」，右下「切换 / 删除 / 合并」；顶部「新建分支」。
- 删除弹窗（`ActionModal` kind `deleteBranch`）：已合并走 `-d`；未合并展示 `branchExclusiveCommits` 预览 + 彻底删除 `-D`；当前分支禁用。
- 合并弹窗（kind `merge`）：左上角切「快速 / 三方 / 摘取」，目标分支排除来源，默认当前分支；目标不是当前分支时先 checkout 再 merge。
- 冲突期间分支浮层锁定：切换 / 删除 / 重命名 / 合并禁用，只留查看与新建。

### 2.3 合并冲突流程

- 顶部 `ConflictBanner`（占布局空间）：类型、`source → target`、还剩 N 个、已解决 M 个；「继续合并」（还有冲突标记时禁用）与「中止」（二次确认）。
- 展开后复用工作区文件树（`ConflictTree`）：目录折叠、字母、右侧「N 处冲突」或绿色「（解决）」。
- 点冲突文件 → 底部 `DetailPane` 冲突模式（`ConflictView`）：带 `<<<<<<<` / `=======` / `>>>>>>>` 的全文着色 + 「标记已解决」（执行 `add`）。
- 冲突块计数 = 文件里 `^<<<<<<<` 行数；归零即显示「（解决）」，**不自动 add**；点「继续」时统一 add 所有 0 块文件再 continue（老师确认的口径）。
- 冲突期间「提交」换成「完成合并」；「丢弃改动」禁用；工作区列表里的冲突文件点击也进冲突详情。
- 状态全在 `.git`，每次 `refreshAll` 拉 `repoOperation`，关面板 / 刷新页面 / 重启 DSH 都能恢复。

### 2.4 更多菜单与回收站

- 「更多」→「回收站」（`RecycleBin`）：列出游离提交（短 hash、标题、丢失时间、原因），可「查看」/「切换」（游离 HEAD）/「恢复为分支」（`createBranch` from hash）。
- 游离 HEAD 在 header 显示警告色「游离 HEAD（hash）」徽标。

## 3. 关键实现位置速查

| 想改什么 | 去哪 |
|---|---|
| 分支/冲突/游离的 git 逻辑 | `lib/git-core.mjs` 末尾「branch management / merge-conflict state」段 |
| 新方法契约 | `lib/typert.host.js` 的 `reqShaped` / invocations；remote 包 `descrip` |
| 分支浮层 | `lib/client.js` 的 `BranchPopover` |
| 冲突气泡 | `ConflictBanner` + `ConflictTree` + `ConflictView` |
| 回收站 | `RecycleBin` + `refreshOrphans` |
| 弹窗分支 | `ActionModal` 的 `deleteBranch / renameBranch / merge / abortOperation / recoverCommit` |
| 工作区点击分发 | `openPreview`（冲突文件 → 冲突详情，普通文件 → workDiff） |
| 样式 | `lib/client.js` 的 css 数组末尾「branch popover / conflict banner / recycle bin」段 |

## 4. 还没做 / 下一步

1. **stash**（老师说的下一个功能）：core 已有 `stashAction`，UI 未接；建议放「更多」菜单。
2. 远程分支：`branchDetails` 有 `upstream` 字段，浮层暂不展示。
3. 冲突气泡的「自动刷新」：目前靠手动刷新 / 操作后刷新；想做到编辑器保存后自动更新，需要轮询或文件监听。
4. 侧栏入口的红点提示冲突进行中（设计文稿提过，未做）。
5. 分支浮层的「已删除分支」分组（reflog 创建过、refs 已无）未做。
6. 合并弹窗的快速合并预检（分叉时提前禁用）未做，目前靠 git 返回 `not-fast-forward`。
7. `PANEL_VERSION` 仍是 0.1.4，未随本次功能升版。

## 5. 工作方式（老师定的规矩）

- 改模块**先开分支**，确认可用后再合并回 main。
- 交付时说明：改了哪些文件、怎么验证、是否需要重启。
- 部署三步：工作区 → `_stage\pkgs\...` → `profiles\desktop\node_modules\@dsh-external\...`，然后 `node test-install.mjs`。
- **host 半（git-core / index / typert / remote）改动必须重启 DSH**；只改 `lib/client.js` 刷新页面即可。

## 6. 测试

```powershell
node test-gitcore.mjs
node test-gitcore-extended.mjs
node test-mcp-server.mjs
node test-host.mjs
node test-contract.mjs
node test-install.mjs
node test-client-offline.mjs
```

当前全绿（本轮新增覆盖：branchDetails、三种合并方式、冲突状态/详情/继续、squash 状态与中止、游离提交、删除预览、冲突气泡与分支浮层渲染）。
