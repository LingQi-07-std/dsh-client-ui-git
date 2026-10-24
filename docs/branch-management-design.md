# 分支管理与合并冲突 · 设计文稿

状态：草案 v0.1（2026-10-24）
范围：分支管理列表、合并三种方式、合并冲突完整流程、硬回退后的游离提交（回收站）、更多菜单。
不在本次：stash、远程分支（预留）、rebase、cherry-pick 入口。

---

## 1. 目标与范围

### 1.1 本次要做

1. **分支列表**：工具条新增「分支」入口，点开是悬浮圆角列表（不占布局空间）。
   - 列出本地分支：名称、最后一次提交时间、右侧切换按钮。
   - 行点击展开：最后提交信息 + 创建信息（时间、根分支），创建信息可跳到时间线上的创建节点。
   - 行操作：右下角切换、删除、合并；左下角重命名。
   - 删除弹窗：安全删除 / 彻底删除，彻底删除前预览会游离的提交。
   - 合并弹窗：选目标分支（排除自己），左上角切换方式：快速 / 三方 / 摘取。
2. **合并冲突流程**：气泡、冲突文件列表、冲突详情、自动检测解决状态、继续/中止、退出不中断。
3. **回收站**：硬回退等操作后不可达的提交，可以从「更多」菜单里查看、恢复成分支、查看 diff、checkout。
4. **更多菜单**：工具条右侧图标（四个空心方块），后续功能（stash 等）都放这里。

### 1.2 复用原则

老师定的：列表和展开详情**直接套用现有逻辑，不随意增删，尽量一致**。

| 要复用的东西 | 现有位置 |
|---|---|
| 工作区文件树（目录折叠、字母、缩进） | `mergeEntries` / `buildTree` / `TreeNodes` / `FileRow` |
| 文件改动详情面板 | `DetailPane` 的 work 模式（`workPath` + `workDiff`） |
| 提交卡展开动画、省略号、元信息排版 | `CommitRow` 的 `dshg-commitOpen` 结构 |
| 分支图标 | `BranchGlyph`（现有 git 图标） |
| 分支色 | `branchColor` / `branchIconColor` |
| 弹窗外壳 | `ActionModal` 的 `dshg-modal` / `dshg-modalCard` |
| 状态横向条 | opsBar 与 `dshg-opMsg` 的现有样式 |

---

## 2. 已实测的 git 语义

以下结论来自真实仓库实测（2026-10-24），不是推断。

### 2.1 冲突期间能做什么

**未解决（索引里有 unmerged 条目）**

| 操作 | 结果 |
|---|---|
| commit | 拒绝：Committing is not possible because you have unmerged files |
| merge 其他分支 | 拒绝：Merging is not possible because you have unmerged files |
| checkout 其他分支 | 拒绝：you need to resolve your current index first |
| checkout -b 新分支 | 允许，但会把冲突状态带过去（面板不这样做） |
| stash | 拒绝：could not write index |
| branch -d 未合并分支 | 拒绝：not fully merged；其他普通分支可删、可改名 |
| add 冲突文件 | 允许（解决冲突的正常动作） |
| tag / log / diff / status | 允许 |

**全部已 add（索引干净，`MERGE_HEAD` 仍在）**

| 操作 | 结果 |
|---|---|
| commit | 允许，直接生成合并提交，`MERGE_HEAD` 消失（等于完成合并） |
| merge 其他分支 | 拒绝：You have not concluded your merge (MERGE_HEAD exists) |
| checkout 其他分支 | 拒绝：local changes would be overwritten |
| stash | 允许（暂存合并结果，不推荐） |

**`reset --hard`**：允许，直接清掉冲突状态与 `MERGE_HEAD`，工作区回到 HEAD。作为「强制脱身」，会丢失解决进度，不在冲突流程里暴露。

### 2.2 三种合并方式

| 方式 | git 命令 | 行为 | 不可用条件 |
|---|---|---|---|
| 快速 | `merge --ff-only <target>` | 只快进，不产生合并提交 | 当前分支不是目标的祖先时拒绝：Diverging branches can't be fast-forwarded |
| 三方 | `merge --no-ff --no-edit <target>` | 总是产生合并提交 | 冲突时进入冲突流程 |
| 摘取 | `merge --squash <target>` + `commit --no-edit` | 目标分支改动压成一个新提交，不保留原提交 | 冲突时进入冲突流程（squash 版） |

### 2.3 squash 冲突的状态文件（和普通 merge 不同）

实测：

- `MERGE_HEAD`：**不存在**
- `SQUASH_MSG`：存在
- `MERGE_MSG`：存在
- `git status`：`UU <file>`
- 解决后 `git commit`：生成**单父提交**（不是合并提交）
- 「继续」= `git commit --no-edit`（使用 `SQUASH_MSG` 作为消息），不是 `merge --continue`

所以进行中操作探测必须区分 `merge` / `squash` / `revert` / `cherry-pick` / `rebase`，不能只看 `MERGE_HEAD`。

### 2.4 删除分支

- `branch -d`：未合并拒绝，提示 not fully merged。
- `branch -D`：强制删除。
- 不能删除当前分支（git 拒绝）。
- 删除后该分支独有提交变成不可达，但 reflog 仍保留一段时间（默认 90 天），期间可恢复。

### 2.5 游离提交的定义

「游离」= 对象还在、任何 ref（heads / remotes / tags）都不可达。来源：

- `reset --hard` 丢掉的原 HEAD
- 删除分支（`-d` / `-D`）后的分支独有提交
- 合并/rebase 后遗留的历史

可恢复性：只要 reflog 还没过期，就能通过 hash 找回；reflog 过期或 gc 后真正消失。

**回收站的数据来源（推荐）**：读 `.git/logs/HEAD` 与 `.git/logs/refs/heads/**` 收集所有出现过的 hash → 与 `git rev-list --all` 的可达集合比对 → 不在集合里且 `git cat-file -e <hash>` 存在的，就是游离提交。每条附带最后一次出现在 reflog 的时间与消息（原因）。

---

## 3. 数据契约（host 新增/扩展方法）

所有方法沿用 `{ path, ... }` 请求，返回 `{ok, value}` / `{ok:false, error}`。新增后 invocation 数 17 → 26。

### 3.1 读

| 方法 | 请求 | 返回 |
|---|---|---|
| `branchDetails` | `{path}` | `{branches:[{name, hash, short, upstream, date, subject, current, merged, created:{date, from, hash}|null}]}` |
| `repoOperation` | `{path}` | `{operation: null \| {kind, source, target, message, startedAt, head}, conflicts:[{path, code, blocks}], resolved:[{path}], total, unresolved}` |
| `conflictFile` | `{path, file}` | `{file, worktree, ours, theirs, base, binary, truncated}` |
| `orphanedCommits` | `{path}` | `{commits:[{hash, short, subject, author, date, lostAt, reason, ref}]}` |

`branchDetails` 字段：

- `name` 短名；`hash` 尖端完整 hash；`short` 8 位。
- `upstream` 上游短名，没有则空串。
- `date` 最后提交时间（committer date，ISO）；`subject` 最后提交标题。
- `current` 是否当前分支。
- `merged` 是否已合并进当前 HEAD（`git branch --merged HEAD`）。
- `created` 从 reflog 的 `branch: Created from <x>` 解析：创建时间取该行时间，`from` 是来源分支名或提交，`hash` 是创建时的新 hash；reflog 找不到则为 `null`。

`repoOperation` 字段：

- `kind`：`merge` / `squash` / `revert` / `cherry-pick` / `rebase`。
- 探测顺序：`rebase-merge`/`rebase-apply` → `MERGE_HEAD` → `CHERRY_PICK_HEAD` → `REVERT_HEAD` → `SQUASH_MSG`（且无 MERGE_HEAD）。
- `source` / `target`：合并时从 `MERGE_HEAD` 反查分支名（匹配 tip），target 为当前分支；squash 时来源取 `SQUASH_MSG`/`MERGE_MSG` 首行推断，取不到就留空。
- `conflicts[].code`：porcelain 冲突码（UU/AA/DD/AU/UA/DU/UD）。
- `conflicts[].blocks`：工作区文件里冲突块数量（`<<<<<<<` 行数）。
- `resolved`：属于本次合并涉及集合、且已暂存（stage 0）的文件。
- `total = resolved.length + conflicts.length`；`unresolved = conflicts.length`。

### 3.2 写

| 方法 | 请求 | 说明 |
|---|---|---|
| `deleteBranch` | `{path, name, force?}` | 复用 core `deleteBranch` |
| `renameBranch` | `{path, from, to, force?}` | 复用 core `renameBranch` |
| `merge` | `{path, target, mode?}` | 扩展 `mode`: `ff-only` / `no-ff` / `squash` / 缺省 |
| `operationContinue` | `{path, kind}` | merge → `merge --continue`；squash → `commit --no-edit`；revert → `revert --continue`；cherry-pick → `cherry-pick --continue`（rebase 不做） |
| `operationAbort` | `{path, kind}` | 复用 `abortOperation`，补 `rebase` 支持 |

注意：`merge` 的请求 schema 在 typert 里已存在（`reqWithTarget`），新增 `mode` 字段即可；`operationContinue` / `operationAbort` 用 `{path, kind}` 新 schema。

### 3.3 复用现有方法

- 从某提交新建分支：`createBranch`（`git branch <name> <from>`）。
- 恢复游离提交：`createBranch`，`from` 传游离 hash。
- 标记冲突文件已解决：`add`。
- 查看提交详情：`diff`（已支持 `commit` + `paths`）。

---

## 4. 分支列表

### 4.1 工具条布局

从右到左：

```
[ 更多 ] [ 分支 ]  ……  [ 提交 ] [ 暂存 ]
```

- 「更多」：四个空心方块图标，无文本。位置最右。
- 「分支」：复用现有 git 图标（`BranchGlyph`），在「更多」左侧。
- 其余操作保持现有顺序与条件显示。
- 原「新建分支 / 切换分支 / 合并分支」三个按钮**移入分支浮层**，opsBar 不再保留（已确认）。

### 4.2 浮层

- 绝对定位，锚定在「分支」按钮下方、右对齐；**不占布局空间**。
- 宽约 300px，最大高度 60vh，内部滚动；圆角 12px、1px 边框、阴影，背景用面板色。
- 打开时按钮高亮；点浮层外部或 Esc 关闭。
- 顶部一行：标题「分支（N）」+ 「新建分支」按钮（见 4.6）。
- 分组顺序：当前分支 → 其他本地分支。远程分支本次不显示（预留字段 `upstream`）。

### 4.3 列表行（收起态）

```
● main          2 小时前   [切换]
  feat/ui       昨天       [切换]
```

- 左：分支色圆点（`branchColor`）+ 分支名；当前分支名加粗、圆点实心，其他空心。
- 中：最后一次提交的相对时间（复用 `formatDate`）。
- 右：切换按钮（小号 ghost 按钮），点击 `checkout`，`stopPropagation`。
- 当前分支的切换按钮改为灰色「当前」标签。
- 未合并分支在名称后加一个小标记（`未合并`），已合并不加。

### 4.4 展开态（点击行）

像 commit 卡一样展开，复用其视觉：

```
● main          2 小时前   [切换]
  ┌─ 最后一次提交 ─────────────────
  │ 更新面板样式与卡片类型
  │ 010c2d8 · Arona · 10月24日   [查看提交]
  ├─ 创建信息 ─────────────────────
  │ 基于 fix/ui（f16f92f）创建 · 3 天前   [跳到创建节点]
  └──────────────────────────────
   [重命名]                [切换] [删除] [合并]
```

- 顶部：最后提交标题、短 hash、作者、时间；「查看提交」点击 → 时间线滚动并高亮该提交（复用 `openDetail` / `data-commit` 定位）。
- 中部：创建信息。`created.from` + 创建时间 + 创建时 hash；点击「跳到创建节点」→ 找到时间线上该分支的 `BranchEventRow`（加 `data-branch-event` 属性）并滚动高亮。
- 按钮行：**左下角「重命名」**，右下角「切换 / 删除 / 合并」。
- 点「重命名」后分支名变行内输入，回车提交 `renameBranch`；Esc 取消。

### 4.5 删除

点「删除」弹出 `ActionModal` 风格弹窗：

- 标题「删除分支 <name>」。
- 若分支已合并：说明「这个分支的提交都已经在 <current> 里，删除不会丢提交」，主按钮「删除」→ `deleteBranch`（-d）。
- 若未合并：说明「有 N 个提交只在这个分支上，安全删除会被 git 拒绝」，并展示 **游离预览**：
  - 用 `git rev-list <branch> --not <其余所有 ref>` 得到独占提交，列出前 5 条（短 hash + 标题）。
  - 主按钮变「彻底删除」→ 二次确认（输入分支名或勾选确认）→ `deleteBranch({force:true})`。
  - 小字提示「删除后这些提交仍可在回收站找回（reflog 保留期内）」。
- 删除当前分支：按钮禁用，提示「先切换到其他分支」。
- 草稿：游离预览如果调用成本高，就在弹窗打开时异步加载，失败则隐藏预览、保留确认。

### 4.6 新建分支

「新建分支」入口**放在分支浮层顶部**，opsBar 不再保留（已确认）。点击弹出输入框，行为不变：`createBranch({name})`，从当前 HEAD 创建，不切换。

### 4.7 合并弹窗

点「合并」：

- 标题「合并分支」。
- 左上角三个切换标签：`快速` / `三方` / `摘取`。
- 目标分支下拉：所有本地分支，**排除当前分支**。
- 说明随方式变化：
  - 快速：只有当前分支是目标的祖先时可用。弹窗打开时预检 `merge-base --is-ancestor <target> HEAD`，不可用则禁用主按钮，提示「两边的提交已经分叉，改用三方或摘取」。
  - 三方：总是生成合并提交；冲突时进入冲突气泡流程。
  - 摘取：把目标分支的改动压成一个提交；冲突时同样进入冲突流程（squash 版）。
- 主按钮「合并」→ `merge({target, mode})`。
- 合并成功：浮层关闭、刷新、顶部提示「已合并 <target>（快速/三方/摘取）」。
- 合并冲突：关闭弹窗，冲突气泡出现（见第 5 节）。
- 冲突进行中：分支浮层里所有合并/切换/删除/重命名禁用，顶部显示「合并进行中，先解决冲突」；当前分支与被合并分支标上「合并中」标记。

### 4.8 互斥规则

| 状态 | 切换 | 删除 | 重命名 | 合并 | 新建 |
|---|---|---|---|---|---|
| 正常 | 可（工作区脏时由 git 拒绝，预检提示） | 可 | 可 | 可 | 可 |
| 冲突进行中 | 禁用 | 禁用 | 禁用 | 禁用 | 可（只建指针，不切换） |
| 冲突全部解决、可继续 | 禁用 | 禁用 | 禁用 | 禁用 | 可 |

---

## 5. 合并冲突流程

### 5.1 冲突气泡

位置：header 下方、操作条上方，正常流（占布局空间），不是浮层。

收起态一行：

```
! 存在未处理的合并冲突
  解决后才能继续合并 · feat/ui → main        [继续合并] [中止] [▾]
```

- 「继续合并」在 `unresolved > 0` 时禁用，title 显示「还剩 N 个冲突」。
- 「中止」始终可用，二次确认（会丢弃解决进度与手改内容）。
- 右侧箭头展开文件列表；箭头旋转 180°。
- 颜色：警告/错误色（红色系），背景透明度低，不抢正文。

### 5.2 冲突文件列表（展开）

复用工作区文件树的渲染：

```
▾ lib/                       2
  U client.js                3 处冲突
  U theme.css                1 处冲突
▾ src/                       1
  M index.js                 （解决）
```

- 目录行：折叠箭头、目录名、文件数；文件行：字母（U 红色 / 已解决 M 绿色）、文件名、右侧冲突处数。
- 冲突处数 = 文件里 `<<<<<<<` 行数（一个冲突块算一处）。
- 已解决的文件：字母变 M、右侧变绿色「（解决）」。
- 点击文件行：打开底部详情面板（见 5.3），当前行高亮。
- 默认**不剔除**：冲突文件同时出现在「工作区改动」列表里（保持现状）。设置面板将来提供开关 `conflictListFilter`（默认关），本次只在 store 预留字段，不做 UI。

### 5.3 冲突详情

复用 `DetailPane` 的 work 模式：

- 头部：「冲突文件：lib/client.js · 3 处冲突」+ 右侧「标记已解决」+ 关闭。
- 内容：工作区文件全文，带 `<<<<<<<` / `=======` / `>>>>>>>` 标记；沿用现有 `PatchLines` 样式，标记行用红色/紫色区分 ours / theirs。
- 「标记已解决」→ `add({paths:[file]})`，成功后该文件从冲突列表移到已解决（刷新后显示「（解决）」）。
- 用户用外部编辑器改完保存：面板刷新时重新读文件数冲突块，归零即显示「（解决）」，**不自动 add**。
- 「（解决）」只代表内容层面没有冲突标记；git 层面仍未标记解决。
- 真正 add 的时机：点「继续合并」时，先把所有 `blocks === 0` 的文件统一 `git add`，再执行 continue。
- 缓存：冲突详情不能沿用 workDiff 的「同 path 不重复请求」策略，每次打开/刷新都重新读，否则看不到刚改的内容。

### 5.4 自动检测

每次 `refreshAll` 拉 `repoOperation`：

- 若 `operation` 非空：显示气泡，按 `conflicts` / `resolved` 渲染。
- 每次重新读每个冲突文件的内容数 `<<<<<<<`，更新 `blocks` 与已解决状态。
- 全部解决（`conflicts.length === 0`）：「继续合并」启用，气泡文案变「冲突已全部解决，可以继续合并」。

### 5.5 继续与中止

- 继续：按 `kind` 调用 `operationContinue`。
  - 调用前先把所有 `blocks === 0` 的冲突文件统一 `git add`（老师确认的口径：检测只看标记，提交时一起 add）。
  - `merge` → `git merge --continue`（`GIT_EDITOR=true`，不弹编辑器）。
  - `squash` → `git commit --no-edit`（消息来自 `SQUASH_MSG`）。
  - `revert` → `git revert --continue`。
  - 成功：气泡消失、刷新、时间线出现新提交（merge 是合并提交，squash 是单父提交）。
  - 失败：错误显示在气泡下方，状态保留。
- 中止：二次确认 → `operationAbort`（`merge --abort` / `revert --abort`；squash 用 `reset --merge` 或 `reset --hard HEAD` 前先确认）→ 刷新，气泡消失。
  - squash 的中止实测：`merge --abort` 不认（没有 MERGE_HEAD），用 `git reset --merge ORIG_HEAD` 或清除索引。设计上先探测，失败时回退到 `reset --hard HEAD` 并明确告知会丢弃解决进度。

### 5.6 退出不中断

状态全在 `.git`，打开面板时 `refreshAll` 重新探测，所以：

- 关抽屉再开：恢复。
- 刷新页面：恢复。
- 重启 DSH：恢复。
- 命令行解决了一半：面板刷新后同步显示剩余冲突与已解决文件。

不需要 localStorage 或额外状态文件。

---

## 6. 更多菜单与回收站

### 6.1 更多菜单

- 图标：四个空心方块（2×2，线框），与现有图标风格一致（16px、currentColor）。
- 点击弹出小菜单（复用分支浮层的位置逻辑，右对齐）。
- 首批菜单项：`回收站`。
- 后续扩展位：stash、标签、设置等（本次不做，但菜单结构预留）。

### 6.2 回收站

点「回收站」打开弹窗或二级浮层：

- 标题「已丢弃的提交（N）」。
- 列表行：短 hash、提交标题、丢弃时间、原因（reset / 删除分支 / 合并后不可达）。
- 行操作：
  - 「恢复为分支」→ 输入分支名 → `createBranch({name, from: hash})`。
  - 「查看」→ `diff` 详情面板。
  - 「切换」→ `checkout({target: hash})`（游离 HEAD，需提示）。
- 空态：「没有找到丢掉的提交。硬回退或删除分支后，丢掉的提交会出现在这里。」
- 提示：这些提交只在 reflog 保留期内可恢复。

### 6.3 游离 HEAD

- `snapshot.branch` 在 detached 时是短 hash；header 显示「游离 HEAD（<hash>）」徽标（替代分支名），颜色警告。
- 回收站或时间线里点「切换」到游离提交时，提示「当前不在任何分支上」。

---

## 7. 交互状态矩阵

| 界面元素 | 正常 | 冲突未解决 | 冲突已全部解决 |
|---|---|---|---|
| 暂存/取消暂存 | 可 | 可用（但不作用于冲突文件） | 可用 |
| 提交 | 可 | 禁用（git 拒绝） | 换成「完成合并」 |
| 分支浮层 | 全可用 | 切换/删除/重命名/合并禁用 | 同左 |
| 冲突气泡 | 隐藏 | 显示，继续禁用 | 显示，继续启用 |
| 文件详情 | 工作区/提交模式 | 冲突模式 + 标记已解决 | 冲突模式，可关闭 |
| 更多菜单 | 可用 | 可用 | 可用 |
| 回收站 | 可用 | 可用（只读 + 恢复） | 可用 |

---

## 8. 实现顺序

1. **host 契约**：core 新函数 + gateway + typert + remote 描述符 + 契约测试。
2. **分支列表**：`branchDetails` 接入，浮层、行展开、切换、重命名。
3. **合并**：三种方式 + 合并弹窗 + 冲突气泡与详情、继续/中止。
4. **回收站**：`orphanedCommits` + 更多菜单。
5. **收尾**：游离 HEAD 徽标、状态矩阵、部署三步、真机验证。

每步一个提交，最后合并回 main。

## 9. 验收标准

1. 分支浮层能列出本地分支、显示时间、切换；点击行展开提交与创建信息，创建信息能跳到时间线节点。
2. 删除未合并分支时安全删除被拒，弹窗展示游离预览，彻底删除成功后分支消失；删除当前分支被禁用。
3. 重命名能改当前分支与其他分支。
4. 合并三种方式：快速在分叉时禁用；三方生成合并提交；摘取生成单父提交。
5. 冲突发生后气泡出现、文件列表带冲突处数、点开看到标记全文、标记已解决后显示「（解决）」、全部解决后继续成功；中止回到合并前。
6. 关闭面板/刷新页面/重启 DSH 后冲突状态仍在。
7. 冲突期间分支浮层的切换/删除/重命名/合并均禁用。
8. 回收站能看到硬回退丢弃的提交，能恢复为分支。
9. 全部测试通过（旧 7 个 + 新增覆盖），部署三步一致。

## 10. 已确认（2026-10-24）

1. 冲突文件不自动 add：检测只看冲突块是否为 0；点继续时统一 add 再 continue。
2. 冲突文件默认不从「工作区改动」列表剔除；设置面板开关预留（store 字段 `conflictListFilter`，默认关）。
3. 重命名放在展开区按钮行左下角。
4. 原 opsBar 的新建/切换/合并移入分支浮层。
5. 新建分支入口放在分支浮层里，opsBar 不再保留。
