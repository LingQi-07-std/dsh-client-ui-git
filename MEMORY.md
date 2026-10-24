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

## 13. 部署漏 remote 包 → `ctx.remote.git[method] is not a function`（2026-10-24）

- 症状：重启 DSH 后仍报某方法不是函数；host manifest（26 条）和 gateway（26 个）都对，但面板拿到的 `ctx.remote.git` 只有 17 个方法。
- 根因：`dsh-client-git-remote` 是独立包，部署三步只同步了 `dsh-client-ui-git`；`_stage\pkgs\dsh-client-git-remote` 还停在 10/20 的 16 条旧版，profile 里是 17 条。
- 诊断：数三处 `descrip("` 数量（工作区 `packages/` / `_stage\pkgs\` / profile `node_modules\@dsh-external\`），并比对 `lib/client.js` 哈希。
- 修复：remote 包也要走 工作区 → `_stage` → profile 两段 robocopy，然后重启 DSH。
- 推而广之：任何「独立 client 插件包」都有同样的部署要求，`test-install.mjs` 之后要抽查它的 descriptor 数和文件哈希。

## 14. reflog 的 `branch:` 不全是创建（2026-10-24）

- `git branch -f main <hash>` 写 `branch: Reset to <hash>`；`git branch -m` 写 `branch: renamed refs/heads/a to refs/heads/b`；还有 `branch: Set upstream ...`。
- 旧过滤只匹配 `branch:` 前缀，把 `branch: Reset to` 当成创建事件，时间线上冒出假的「创建分支 main · 基于（未知）」卡片。
- 修复：core 的 KEEP 收紧为 `branch: Created from`；client 侧也校验 message 含 `Created from`（兼容已缓存的旧数据）。
- 创建事件只活在 reflog（默认 90 天，不是 30 天），过期后轴线卡片无法恢复；要永久保留只能插件侧另存。

## 15. 插件内持久化（`.data`）

- 数据目录 = 插件安装根下的 `.data/state.json`（`lib/state.mjs`），host 侧读写，客户端经 `readPluginState` / `writePluginState` 访问。
- 为什么不在 localStorage：卸载插件后浏览器里仍有残留、不同浏览器/工作区不统一；为什么不在工作区：会污染仓库。
- 写入用临时文件 + rename，写操作串行排队；失败不污染队列。
- 测试用 `DSH_GIT_STATE_DIR` 指向临时目录，避免测试数据写进插件目录。
