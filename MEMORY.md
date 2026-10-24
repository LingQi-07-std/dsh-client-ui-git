# MEMORY.md — 踩坑记录

只记"下次还会踩"的。每条对应一次真实故障。

## 1. footer slot 的 props 与工作区来源

- `sidebar.footer.action` 的 owner props 只有 `wide`；`useSessions` / `useWorkspaces` / `t` 是 standard feeds，用前判 `typeof === "function"`，且 hook 要无条件调用（缺失时退化成空 selector，保持顺序）。
- 工作区路径：`useSessions` 的 `state.current` → `byId[current].cwd`。`useWorkspaces` 只有 `items` / `recentWorkspaceId`，没有 `byId`，只能兜底。

## 2. 面板无限刷新 / diff 被清空

- JSX 里内联 `git: { refresh, ... }` 会让对象每渲染必新 → `useEffect` 依赖爆炸 → 循环刷新。修法：`useRef` 缓存，渲染只传 `.current`。
- `refreshAll` 无条件清 diff 会覆盖用户刚点开的提交。修法：`sameWorkspace = store.cwd === cwd`，同工作区刷新不碰 diff。

## 3. PowerShell 文本管道会写坏 UTF-8

- `Set-Content` / `-replace` 重写中文源码会变成 `提�?`，随后全是语法错误；替换串里的 `$` 还会被解释。
- 规矩：源码只用 read/edit/write 工具。写坏了就删文件（确认绝对路径）再重建。

## 4. 环境

- 活跃 `DSH_HOME=C:\Users\13953\.dsh`，profile 在 `profiles\desktop`。AppData 下那份 harness-home 是旧残留，别用。
- profile 的 `node_modules` 是**复制**不是链接，`_stage` 改了不会自动生效。
- 工作区依赖靠 junction（`node_modules/@deepseek-ai`、`zod`），换机器要重建，否则 test-host/test-contract 报 `ERR_MODULE_NOT_FOUND`。
- DSH 每次重启 Web 端口都变，用户说"打不开/样式没了"先查端口。

## 5. React shim 的坑

- `jsx(type, undefined)` 在 React 18 会崩（读 `config.key`）→ shim 里 `props ?? {}`，无 props 组件写 `h(Comp, {})`。
- 离线测试的 mock 会自己补 `{}`，所以这类问题只有真实运行时才暴露。
- `SlotErrorBoundary` 捕获错误后会永久摘掉该条目，不自愈 —— 元素类型必须保证有定义。

## 6. git 语义（本轮最大的坑）

- **分支只是指针**：提交不属于任何分支，"属于哪个分支"没有唯一答案；能查的只有 `git log %D` 的装饰（**只有尖端有名字**）和 reflog 事件。
- **合并 ≠ 分支结束**：合并后分支可以继续提交；要分支"消失"得手动 `git branch -d`。
- **删除分支没有 reflog**：只能通过"创建过但当前 refs 里没有"推断，且推断不出删除时刻。
- **`branch: Created from X` 记录的是创建时指向的提交**，不是分支当前尖端；算分叉点要用当前 tip（refs 里指向该分支的提交）。
- **reflog 会重复**：HEAD 与分支 reflog 各记一次同一操作，按 `旧hash|新hash|时间戳|消息` 去重。
- **空操作要过滤**：`reset: moving to HEAD`（取消暂存）、`merge x: updating HEAD`（已是最新），`oldHash === newHash` 全是空操作。
- **logs 目录要递归读**：分支名带斜杠（`feat/x`）时日志在 `logs/refs/heads/feat/x`。
- reflog 只存在本地、默认 90 天过期、每个 worktree 独立；`git fsck --unreachable` 能补对象但给不出时间/原因。

## 7. 需要"未合并的提交"时别信日志顺序

- `git log --all` 是拓扑序：**分支顶端可能排在分叉点上方**，相邻行判断分叉/合并会判错。必须用 `parents` 关系（`next.parents.includes(hash)` / `parents[0]`）验证。
- `%D` 里的 `HEAD -> main` 记得剥掉前缀，否则会被当成一个叫 "HEAD -> main" 的分支。

## 8. 其它

- git 的 "nothing to commit" 在中文环境是中文，别用 stderr 正则判错误类型；先用 `git diff --cached --quiet` 预检。
- `commit(stagedOnly)` 无暂存时曾报成 `git-exit`，同上。
- 离线渲染测试用 `vm.runInNewContext` 跑真 bundle：hook 槽位按组件用 WeakMap 隔离，`useState` setter 要捕获自己的 slots，`useEffect` 要比较 deps。
- `plugin_manager list_bundles` 的 `source` 才是真实安装位置；`enabled: true` 不代表文件最新。

## 9. squash 合并不是普通 merge（2026-10-24 实测）

- `git merge --squash` 冲突时：**没有 `MERGE_HEAD`**，只有 `SQUASH_MSG`（`MERGE_MSG` 也会写）；`git status` 仍是 `UU`。
- 解决后的「继续」是 `git commit --no-edit`（用 SQUASH_MSG 当消息），不是 `merge --continue`。
- 中止：`merge --abort` 不认（没有 MERGE_HEAD），只能 `reset --hard HEAD`，会丢解决进度，必须二次确认。
- 所以进行中操作的探测顺序必须是 rebase 目录 → MERGE_HEAD → CHERRY_PICK_HEAD → REVERT_HEAD → SQUASH_MSG，不能只看 MERGE_HEAD。

## 10. 冲突期间的 git 允许/禁止（实测）

- 未解决（索引有 unmerged）：commit / merge / checkout 其他分支 / stash 全部拒绝；`add` 允许；tag、branch 改名、删除其他分支允许。
- 全部 add 后（索引干净、MERGE_HEAD 还在）：commit 允许（等于完成合并）；merge 仍拒绝（not concluded）；checkout 仍拒绝（本地改动会被覆盖）。
- `git checkout -b` 在冲突中允许，会把冲突状态带过去 —— 面板新建分支只调 `git branch`，绝不切换。

## 11. 请求 schema 必须与实际调用一致（本轮两个真 bug）

- Host 侧对请求参数是严格 `decode`（`dsh-api-gateway/lib/index.js` 的 `validateArguments` → `codec.create().parse`），客户端侧不 parse 请求（`prepareInvocation` 只组装 args）。所以客户端 schema 宽松也救不了 Host。
- `restore` 原本用 `reqWithCommit`（要求 commit），面板调用只传 `{path}` → 必然 `gateway/arguments-invalid`；改成 `{path, paths?}`。
- `commit` 的 gateway 曾硬编码 `stagedOnly: false`，弹窗说「只提交暂存」实际 `add -A`；现在按请求透传。
- 新增方法时，请求 schema 必须覆盖面板真实字段（如 `deleteBranch` 的 `name/force`、`renameBranch` 的 `from/to`、`operationContinue` 的 `kind`）。

## 12. 分支 API 细节

- `git for-each-ref --format=%(refname:short)` 对远程分支输出的是 `origin/main`，**不是** `remotes/origin/main`；用 `/^remotes\//` 过滤远程分支无效。
- 「已合并进当前 HEAD」用 `git for-each-ref --merged=HEAD`，不要自己数祖先。
- 删除前预览游离提交：`git rev-list <branch> --not <其余所有 ref>`；删除后它们只在 reflog 保留期内可恢复。
- 分支创建记录只有 `checkout -b` 会写 `branch: Created from X`；`git branch x` 的记录可能是 `Created from HEAD`，UI 要能接受 "HEAD"。
