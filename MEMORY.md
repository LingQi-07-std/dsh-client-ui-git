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

## 16. 设置面板（2026-11-01 实测）

- 插件页两个注册点 key 写错**不会报错**，面板只是永远不出现：`plugins.bundle.config` 用包名，`plugins.row.config` 用 `<包名>#<cordis.patch.yml 行 id>`（本插件行 id = `ui-git`）。
- `plugins.bundle.config` 的 renderSlot 只传 `{ view }`，**没有 `form`**；`props.form.mutate(...)` 会直接 TypeError。本插件改成两个页面都从宿主读值，`form` 只做尽力同步。
- 行配置的 `form.mutate` **不保证**写进 profile patch（主题插件的开关「弹回」就是这么来的），所以设置的唯一真源放在 `.data/state.json` 的 `settings` 键；`Config` 只提供默认值与行页 form 的投影。
- `Config` 的命名空间是**行 id**，不是包名；cordis 校验读 `runtime.Config`，而 runtime 可能是模块命名空间也可能是构造函数，所以 `export const Config` 之外还要 `GitGateway.Config = Config`。
- 设置类方法的请求里**不要带 `path`**：面板在没仓库时也要能读，`reqShaped` 强制 `path: z.string()` 会逼客户端传假路径。加 `reqBare`。
- `settings.section` 的注册必须用 `ctx.slots.inject` 包住，且 `inject` 的返回值才是能销毁注册的 disposer（不是 `register` 的返回值）；测试桩里把 `inject` 写成「调完 factory 就返回空函数」会让开关「关不掉」。
- `apply` 里别裸用 `ctx.effect`：离线测试桩没有它，一次抛错会让整个 apply 中断（后续注册全丢）。要么判空，要么给桩补上。
- 离线测试的 `slots.register` 若只记最后一个组件，后注册的 `plugins.*.config` 会把侧栏入口覆盖掉——按 `name#key` 存表。

## 17. PowerShell 写文件会毁 UTF-8（2026-11-01）

- `Out-File -Encoding utf8NoBOM` 在 Windows PowerShell 5.1 直接报参数校验失败；`Set-Content` 走默认编码，会把 `—`（E2 80 94）写成 `E2 80 3F`，文件随后**不是合法 UTF-8**，`read` 工具直接拒绝读取。
- 症状：`read` 报 `invalid UTF-8 text`；node 用 utf8 解码得到 `\uFFFD`。
- 修复：node 按字节把 `E2 80 3F` 换回 `E2 80 94`（顺带补回被吞掉的空格），再用 `TextDecoder('utf-8',{fatal:true})` 验证。
- 结论：改任何源码/文档只用 read/edit/write 工具，PowerShell 只用来跑命令和 robocopy。

## 18. 把「挂载插件」并进主插件（2026-11-01）

- 原来的 `dsh-client-git-remote` 只做一件事：`ctx.remote.$mount(TYPERT_REMOTE)`。合并进主 bundle 后，`apply` 必须是 `async`，且 `await $mount` 要放在**任何** `ctx.remote.git` 读取之前。
- 关键陷阱：`exports.inject`（外层 fiber）必须把 `"remote.git"` 删掉，只留 `["remote"]`。留着会变成「等自己提供的服务」，cordis 永远等不到，插件不激活（表现是侧栏入口消失 / 插件页报 `cannot get property "remote.git" without inject`）。UI 放进子 fiber `GitUiPlugin`，由它 inject `remote.git`，详见 18.1。
- descriptor 的 `id` 原本就用主包名（`${PKG}#git/<method>`），所以合并时只需把 `TYPERT_REMOTE.package` 从 remote 包名改成 `PKG`；不动 id，host manifest 那边零改动。
- remote 包自带一份极简 zod（`parse` 语义，不 require 任何模块），整段搬进来即可，不必让主 bundle 去 require `zod`。
- 挂载失败不要中断激活：`catch` 里写 `store.clientError` 再继续注册 UI，否则一次挂载异常会让整个面板静默消失。
- 清理清单（漏一处就会留下孤儿）：profile `package.json` 的 `dependencies`、`dsh.profile.bundles`、`node_modules/@dsh-external/<包>`、`_stage/pkgs/<包>`、工作区 `packages/<包>`。
- 测试桩要跟着改：假 `ctx.remote` 要有 `$mount`（记录 spec），`apply` 要 `await`；否则断言跑在注册之前，或者直接 `ctx.remote.$mount is not a function`。
- 合并后 `apply` 是 async，**所有**调用点（含离线测试）都要 await，否则后续断言看到的是「还没注册」。

### 18.1 真正的坑：`remote.git` 是嵌套服务，必须两级 fiber（2026-11-01 实测）

- 现象：重启后插件页报 `cannot get property "remote.git" without inject`，侧栏 Git 入口也不工作。
- 根因：cordis 的 ctx proxy 把 `ctx.remote.git` 当**嵌套服务**解析（等价 `ctx.get("remote.git")`），只有 inject 过它的 fiber 才能读；而「提供它的 fiber」不能 inject 自己，否则永远等不到自己。这正是当初拆成两个包的真正原因，不是代码组织偏好。
- 正确写法（单包也能做到）：
  ```js
  async function apply(ctx) {          // 外层：只挂载，inject 只写 ["remote"]
    await ctx.remote.$mount(TYPERT_REMOTE);
    await ctx.plugin(GitUiPlugin);     // 子 fiber：UI 全在这
  }
  GitUiPlugin.inject = ["slots", "locale", "remote.git"];
  function GitUiPlugin(ctx) { /* 所有 slot 注册、store 副作用、设置面板 */ }
  ```
- `ctxRef` 要指向子 ctx，否则 UI 里的 `ctx.remote.git` 还是会撞守卫。
- 离线测试桩：`plugin: async (fn) => { fn(fakeCtx); }`，`fakeCtx.remote.git` 用现成桩即可。

## 19. GitHub 登录：GCM 能做与不能做（2026-11-01 实测）

- 本机有 **Git Credential Manager 2.9.0**（`F:\Git\mingw64\bin\git-credential-manager.exe`，PATH 里有），命令齐全：
  `github list` / `github login [--browser|--device|--pat <t>|--force]` / `github logout <account>`，都能加 `--no-ui`。
- **`--device` 在本插件里不可用**：`--device --no-ui` 从子进程（无 tty）启动时**完全不输出验证码**，stdout/stderr 全空，连 HTTP 请求都没发出（`GCM_TRACE=1 GCM_TRACE_HTTP=1` 也只看到 "Creating new HTTP client"）。用户拿不到码 = 流程走不下去。别在这上面浪费时间。
- **`--browser` 可用**：它 `shell-execute` 打开系统浏览器到 `github.com/login/oauth/authorize`（GCM 内置 client_id `0120e057bd645470c1ed`，PKCE，scope `repo gist workflow`），同时监听 `127.0.0.1:<随机端口>` 等回调，**不需要终端**。
- `github list --no-ui` 输出就是纯文本，一行一个账号名（如 `LingQi-07-std`），没有 JSON；解析时过滤空行和 `info:`/`warn:` 开头。
- 凭据落在 **Windows 凭据管理器**（DPAPI），`git push` 自动复用；插件这边不需要也不应该保存 token。
- `--pat <token>` 是 GCM 唯一的 token 入口，token 会出现在**进程命令行**里（同机可见），GCM 没有 stdin 方式；这是它的限制，不是实现偷懒。
- 浏览器登录是**长活**：`login` 会一直挂着等回调。做成「start 起子进程 + 返回会话 id + 每 2 秒 poll + 3 分钟超时 kill」，不要把 host 方法写成同步 await，否则一次调用能挂两分钟。
- 失败时 GCM 把原因写在 **stderr**，还混着 trace 行；取第一行非 `HH:MM:SS`、非 `trace:`/`[RunInternalAsync]`/`[CreateClient]` 的行当错误文案。

## 20. `h` 是 jsx，不是 createElement（2026-11-02 血泪）

- 本 bundle 顶部：`const h = react_jsx_runtime.jsx;`、`const hs = react_jsx_runtime.jsxs;`。
- `jsx(type, props)` **只接受两个参数**。写成 `h("div", { className }, [children])` 时，**第三个参数被静默丢弃**。
- 症状极其迷惑：容器元素正常渲染（能查到 `.dshg-bubbles`、`data-*` 属性都在），但 `children.length === 0`，页面上什么都不显示，且**没有报错**。
- 正确写法：`h("div", { className, children: [...] })`；多个 children 时用 `hs` 或直接塞 `children` 数组。
- 排查手法：给容器加 `data-ahead="2"` 这类诊断属性，F12 里 `document.querySelector('.dshg-bubbles').dataset` 一看就知道「数据到了但子元素没渲染」，直接锁定是 children 丢失而不是数据问题。
- 写新组件时，检查一遍别用三参数：`grep '^\t\+}, \[$'` 无匹配即安全。

## 21. DetailPane 加新模式：两处必改（2026-11-02 第二次踩）

`DetailPane` 的高度动画靠一个 `useLayoutEffect` + ResizeObserver 驱动，加第四种模式（`range`）时漏了两处，症状是「点了不展开 / 展开后不跟着内容变高」。

**必须同时改两个地方：**

1. **`useLayoutEffect` 的依赖数组**：加上该模式的 `xxxLoading`（ready 标志）。高度只在 effect 运行时重算，漏掉依赖 → loading 结束后 effect 不跑 → 面板永远停在占位高度，只有点别的模式（`contentKey` 变了）才被动展开。
2. **占位高度的判断**：`if (el.style.height === "")` 要改成 `if (el.style.height === "" || el.style.height === "0px")`。**关闭过的面板留下的是内联 `"0px"` 而不是空串**，只判空串 → 再次打开时高度保持 0，看起来就是「点击没反应」。

排查口诀：**「点击没反应」先看 height 是不是 0px；「内容变了面板不变高」先看 deps 漏没漏。**
