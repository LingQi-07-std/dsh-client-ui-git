# Stash 面板设计（完整操作与限制）

> 目标：在 Git 面板里做一块「暂存改动（stash）」面板，视觉与合并冲突卡片一致、改用黄色主题。
> 本文先把 stash 的**全部操作**与**全部限制**列清楚，避免开发到一半才发现边界。

## 1. stash 是什么

- `git stash` 把**工作区 + 索引**的改动打包成一个提交，存进仓库内的 stash 栈，然后让工作区回到 HEAD 的干净状态。
- 栈是**每个仓库一份**（`refs/stash` + reflog），`stash@{0}` 是最新一条，`stash@{1}` 次之。
- stash 是**本地操作**，不会推送、不会进远程。
- stash 可以**跨分支**使用：在 A 分支 stash，切到 B 分支 apply/pop。

## 2. 全部操作（命令级）

### 2.1 保存（push / save）

| 操作 | 说明 | 面板是否要暴露 |
|---|---|---|
| `git stash push` | 默认：stash 已跟踪文件的改动（工作区 + 索引），工作区回到 HEAD | 是（主按钮） |
| `-m <message>` | 自定义说明 | 是（输入框，可选） |
| `-u` / `--include-untracked` | 连同**未跟踪文件**一起 stash（不含 ignored） | 是（勾选） |
| `-a` / `--all` | 连同未跟踪 + ignored 一起 stash | 可选（危险，ignored 可能很大） |
| `--keep-index` | stash 后**保留索引**（工作区回到「已暂存」状态） | 可选 |
| `--staged`（2.35+） | 只 stash 暂存区 | 可选 |
| `--patch` | 交互式挑 hunk | 不做（终端交互，面板不适合） |
| `[--] <pathspec>` | 只 stash 指定路径 | 可选（选中文件时） |
| `git stash save <msg>` | 旧命令（2.16 前），等价 `push -m` | 不做（已弃用） |

### 2.2 查看

| 操作 | 说明 |
|---|---|
| `git stash list` | 列出 `stash@{n}: WIP on <branch>: <hash> <subject>` |
| `git stash list --date=local` | 带本地时间 |
| `git stash show [stash@{n}]` | 默认统计（文件数、增删行） |
| `git stash show -p` | 完整 patch |
| `git stash show -u` | 含未跟踪文件 |

### 2.3 恢复

| 操作 | 说明 |
|---|---|
| `git stash apply [stash@{n}]` | 恢复到工作区，**stash 保留** |
| `git stash pop [stash@{n}]` | apply + 成功则 **drop**；失败时 stash 保留 |
| `--index` | 同时恢复**暂存区**状态（否则暂存内容会回到工作区） |
| `git stash branch <new> [stash@{n}]` | 从 stash 创建新分支并 apply；成功后自动 drop |
| `git stash create` | 创建 stash 提交但**不入栈**（返回 hash，供脚本） |
| `git stash store <commit>` | 把 create 出来的提交入栈 |

### 2.4 删除

| 操作 | 说明 |
|---|---|
| `git stash drop [stash@{n}]` | 删除指定 stash |
| `git stash clear` | **清空整个栈**（不可逆，除非 reflog） |

### 2.5 找回

- drop 掉的 stash 在 **stash ref 的 reflog** 里还有记录（`git reflog stash`），可在 reflog 过期前用 `git stash store <hash>` 找回。
- reflog 过期后（默认 `gc.reflogExpire` 90 天）**无法恢复**。

## 3. 限制与边界（必须知道）

1. **工作区干净时 stash 无意义**：`git stash push` 输出 "No local changes to save"，面板应提示而不是报错。
2. **冲突/合并/变基/摘取进行中不能 stash**：git 会拒绝（`Cannot save the current index state` 等）。面板在 `repoOperation !== null` 时禁用 stash 入口与操作。
3. **默认不含未跟踪文件**：必须 `-u`；ignored 文件要 `-a`。
4. **stash 不包含子模块的未提交改动**（submodule 内部改动不会进 stash）。
5. **apply/pop 冲突不会自动提交**：只把改动放回工作区/索引，冲突标记留在文件里，解决后需要手动 `git add` + commit。面板要能识别并引导到冲突流程。
6. **pop 失败时 stash 保留**：冲突时 pop 不删除 stash；解决后可再 drop。
7. **apply 后 stash 保留**：连续 apply 会重复应用，面板要防重复点击/提示。
8. **索引状态**：默认 `apply` 把 stash 内容恢复到**工作区**（暂存内容也回到工作区），只有 `--index` 才恢复暂存状态。
9. **stash 是全局栈**：跨分支共享；apply 到任意分支都可能。
10. **默认消息**：`WIP on <branch>: <short-hash> <subject>`；空仓库/无分支时为 `WIP on (no branch): ...`。
11. **detached HEAD 可用**（游离 HEAD 上也能 stash）。
12. **空栈**：`list` 为空；`apply/pop/drop` 报 "No stash entries found"，面板要显示空态。
13. **`stash clear` 不可恢复**（除非 reflog），必须二次确认。
14. **stash 不触发 hooks**。
15. **CRLF/autocrlf**：stash 的 diff 可能因换行转换显示差异。
16. **裸仓库不可用**。
17. **sparse-checkout**：部分场景下 stash 行为受限（不在面板支持范围）。
18. **stash 数量无上限**，但栈很大时 list/show 变慢。
19. **`-a` 可能把 ignored 的大文件（node_modules 等）打进 stash**，面板要标注风险。
20. **stash 的 `-u` 会 stash 未跟踪目录**（整个目录），恢复时目录结构保留。

## 4. 面板设计（黄色主题）

### 4.1 入口

- 操作条右侧「回收站」旁加一个 stash 按钮（图标，stash 数量 badge）。
- 或者放进「更多」菜单；考虑到老师要独立面板，建议**操作条右侧独立按钮**。

### 4.2 面板结构（与合并冲突卡片同构，黄色）

- 头部：标题「暂存改动（N）」+ 说明「把工作区改动收进 stash，稍后可以恢复」。
- 列表（可展开卡片）：
  - `stash@{n}` + 消息 + 分支 + 时间 + 文件数/增删行（`show --stat`）。
  - 点击展开：文件列表 + 「查看 diff」。
  - 操作按钮：应用（apply）、弹出（pop）、删除（drop）、创建分支（branch）。
- 底部：清空（clear，二次确认）、刷新、关闭。
- 空态：「没有暂存的改动」。
- 冲突进行中：入口禁用 + 提示「先完成或中止当前合并」。

### 4.3 黄色主题

- 新增 `.dshg-stash*` 样式，主色用 `--dshg-warn`（黄色）。
- 卡片、按钮、badge 与冲突卡片同构（`dshg-conflict` 的布局），只换色。

## 5. 现有 core 与缺口

### 5.1 已有（`lib/git-core.mjs` 的 `stashAction`）

- `list`（ref + message）
- `push`（`-u`、`-m`、paths）
- `pop` / `apply` / `drop`（ref）
- `show -p`（patch）

### 5.2 缺口

- **host 层完全没接**：`lib/index.js`、`lib/typert.host.js`、remote 包都没有 stash 方法 → 面板调不到。
- core 缺：`clear`、`branch`、`--index`、`--staged`、`--keep-index`、`-a`、`show -u`、`list` 带时间/统计。
- 面板 UI 完全没有。

## 6. 实现计划（建议顺序）

1. **core 扩展**：`stashAction` 增加 `clear` / `branch` / `--index` / `--staged` / `--keep-index` / `-a`；`list` 返回 `date`；`show` 返回 `stat`。
2. **host 契约**：`index.js` 加 `stash(request)`；typert 加 schema + invocation；remote 包加 descriptor（方法数 +1）。
3. **client**：stash 面板（黄色）、操作条入口、空态/冲突禁用/二次确认。
4. **测试**：core（push/list/apply/pop/drop/clear/branch）、host 端到端、client 离线渲染（面板结构 + 禁用态）。
5. **文档**：更新 AGENTS.md / MEMORY.md / 本文。

## 7. 面板交互规则（待老师确认）

- stash 时默认只含已跟踪文件，勾选「包含未跟踪」才 `-u`。
- apply 默认不恢复索引（`--index` 作为选项）。
- pop 冲突时提示「已进入冲突处理」，并刷新面板。
- drop/clear 都要二次确认。
- 冲突进行中整个 stash 面板只读。
