# HANDOFF — 交接给下一个对话

最后更新：2026-10-24，对应提交 `010c2d8 添加reflog引入，更新git轴样式与卡片类型`。

## 1. 项目是什么

`G:\DSH Plugins\dsh-client-ui-git` —— DSH Web GUI 的 Git 可视化插件（侧栏入口 + 抽屉面板）。
纯 JS 无构建：host 半（`lib/git-core.mjs` / `lib/index.js` / `lib/typert.host.js`）+ 浏览器 bundle（`lib/client.js`）+ 独立 remote 包（`packages/dsh-client-git-remote/`）。

## 2. 本轮做了什么（已完成并提交）

### 2.1 reflog 引入（host 侧）

- `git-core.mjs` 新增 `reflogEvents(dir)`：**直接读 `.git/logs/HEAD` 和 `.git/logs/refs/heads/**`（递归）**，不 spawn git、无行数上限。
- 过滤规则：只保留 `branch:` / `merge` / `reset:` / `rebase` / `cherry-pick` / `clone:` / `pull`；**checkout 被刻意排除**（每次切分支都记，噪声大）。
- 两条额外过滤：`oldHash === newHash` 的空操作全部丢弃（`reset: moving to HEAD`、`merge x: updating HEAD`）；按 `旧hash|新hash|时间戳|消息` 去重（HEAD 与分支 reflog 会重复记同一次操作）。
- 返回字段：`ref / oldHash / newHash / actor / date / message / action`，按时间倒序。
- host 接线：`lib/index.js` 加 `reflogEvents` 方法，`lib/typert.host.js` 加 `GitReflogResult` schema，remote 包加对应 `descrip`。**invocation 数 16 → 17**，三个测试的硬编码已同步。

### 2.2 单轴设计（前端）

- 放弃双轴（多样式轨道）设计：存档在分支 **`archive/dual-track`**（commit `f16f92f`，含 `RAIL_CASES`/`assignLanes`/九种样式 demo）。
- 现在的 `lib/client.js` 回到**单轴**：`.dshg-commit::before` 一条竖线 + 提交点。
- `reflogEvents` 与 `log` **并行请求**（`Promise.all`），都到齐再渲染。

### 2.3 事件卡片

- **创建分支卡片**（`BranchEventRow`）：绿点（点内 `+`）+ 两行文本。
  - 行1：`创建分支 <分支名>`（分支名着色）
  - 行2：`基于 <源分支>（<创建时提交短hash>） <源分支>分支 · <操作人> · <时间>`
- **快进合并卡片**（`MergeEventRow`）：黄点（点内 `⇄`），**不可展开**。
  - 行1：`快进合并 <源分支> → <目标分支>`
  - 行2：`<旧hash> → <新hash> · <操作人> · <时间>`
- **真正的合并提交**：就是 commit 行本身（有合并提交），可展开/双击；`meta` 行显示 `合并 <源分支> → <目标分支>`；点内画 SVG 图标（左竖线 + 右斜线汇入）。
- 事件点/提交点尺寸：事件点 **14px**，普通提交点 **10px**，合并提交点 **14px**。
- 图标颜色自适应：`branchIconColor()` 按分支色亮度选深色/白色图标。
- 分支色：`branchColor(name)` = `hsl(hash(name) % 360, 62%, 52%)`，同一分支的点/箭头/胶囊/名字一致。

### 2.4 其他细节

- 分支尖端提交：点左侧有**彩色三角箭头**（`dshg-branchArrow`，`left:-8px`，timeline `padding-left:28px` 防裁剪）。
- 分支名胶囊：有分支色底色，**展开提交时才显示**（`dshg-refsShow`），`max-width:180px`。
- 展开/收起动画：标题换行 + 胶囊用 `max-height` 裁剪过渡，不在动画中途撑开/收缩。
- 最新一行的点贴顶（`.dshg-timeline > :first-child .dshg-nodeWrap{top:4px}`）。
- 亮色模式分支名加淡阴影、暗色模式加 1.2px 白色描边、事件点边框暗色下为白色。

## 3. 关键实现位置速查

| 想改什么 | 去哪 |
|---|---|
| reflog 读取/过滤 | `lib/git-core.mjs` 的 `reflogEvents()`（约 600 行后） |
| 事件卡片渲染 | `lib/client.js` 的 `BranchEventRow` / `MergeEventRow`（约 3000 行） |
| 提交行/点/合并图标 | `lib/client.js` 的 `CommitRow`（约 3090 行） |
| 分支色/图标色 | `lib/client.js` 的 `branchColor` / `branchIconColor` |
| 事件分组逻辑 | `lib/client.js` GitPanel 里 `branchRows / mergeRows / eventsByHash` 三张表 |
| 样式 | `lib/client.js` 末尾 CSS 数组（后写的覆盖前面的） |

## 4. 还没做 / 待确认

1. **合并卡片的双击统计**：老师要求「双击 → `git diff --stat 第一父..合并提交` 的改动统计，点某个文件看该文件 diff」。目前快进卡片不可展开、双击未接；true merge 的提交行双击是现有 commit 行为（打开 detail），但**统计范围是相对第一父**这一点没验证过。
2. **幽灵行**：reflog 里存在但任何 ref 都不可达的提交（被 reset 丢弃的），双轴版本有对应列表（`dshg-ghosts`），单轴重写时**没有移植**。
3. **事件卡片排版**：老师多次说「和 commit 不一样」，已按 padding 6px / 标题 13px / meta 10px 调过，但可能仍有细节偏差。
4. **分支面板**（讨论过未做）：列当前分支、已合并、已删除（reflog 创建过但 refs 已无）。
5. **子按钮**：合并卡片左下角/右下角的操作按钮（老师说过「先不弄按钮，只保留右下角展开收起」，后来改成快进不可展开）。

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

当前全绿。`test-rails.mjs`（双轴自查脚本）已随双轴一起删除，存档在 `archive/dual-track`。
