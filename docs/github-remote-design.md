# GitHub 远程功能调研（命令 / 用法 / 限制）

> 最后一个功能：把 GitHub 远程操作接进面板。本文先把所有相关命令、用法与限制列清楚，老师确认后再定设计方案。

## 1. remote 管理

| 命令 | 作用 | 说明 |
|---|---|---|
| `git remote` | 列出远程名 | |
| `git remote -v` | 名称 + fetch/push URL | 面板列表用 |
| `git remote add <name> <url>` | 添加远程 | 同名会报错 |
| `git remote remove <name>` | 删除远程 | 同时清掉 `refs/remotes/<name>/*` 跟踪配置 |
| `git remote rename <old> <new>` | 重命名 | 跟踪分支引用一起改 |
| `git remote set-url <name> <url>` | 改 fetch URL | `--push` 只改 push URL |
| `git remote get-url <name>` | 读 URL | |
| `git remote show <name>` | 详情 | fetch/push URL、跟踪分支、远程 HEAD |
| `git remote prune <name>` | 清理已删除的远程分支引用 | 等价 `fetch --prune` |

限制：URL 格式有 HTTPS / SSH / git 三种；`origin` 只是约定名；同名远程不能重复。

## 2. fetch / pull / push

### fetch
- `git fetch <remote>`：只拉取，不合并。
- `--prune`：删掉远程已删除分支的本地引用。
- `--tags` / `--no-tags`。
- `--all`：所有远程。
- `--depth=<n>`：浅拉取。

### pull
- `git pull <remote> <branch>`：fetch + merge（或 rebase，取决于 `pull.rebase`）。
- `--ff-only`：只允许快进。
- `--no-ff`：总是合并提交。
- `--rebase`：变基。
- 冲突 → 进入 merge/rebase 冲突流程（和现有冲突处理一致）。

### push
- `git push <remote> <branch>`。
- `-u` / `--set-upstream`：设置跟踪关系。
- `--force` / `--force-with-lease`：强推（推荐后者，远程有别人更新时会拒绝）。
- `--tags`：推标签。
- `--delete`：删远程分支（`git push origin --delete <branch>`）。
- `--dry-run`：只演练。
- 非 fast-forward 会被拒绝（需要先 pull/merge，或 force）。

限制：
- 网络 / 认证（HTTPS token、SSH key、credential helper）。
- 非 fast-forward 拒绝（保护远程）。
- force push 会覆盖远程（危险，必须二次确认）。
- 大文件 / LFS、仓库大小限制。
- GitHub 分支保护规则会让 push 被拒。
- 权限（只读、无权限）。
- 离线 / 代理。
- `push.default` 配置影响默认推送目标。

## 3. 远程分支与跟踪

| 命令 | 作用 |
|---|---|
| `git branch -r` | 远程分支列表 |
| `git branch -vv` | 本地分支 + 跟踪 + ahead/behind |
| `git branch --set-upstream-to=<remote>/<branch>` | 设置跟踪 |
| `git checkout -b <local> <remote>/<branch>` | 从远程分支建本地分支 |
| `git checkout --track <remote>/<branch>` | 同上（自动同名） |
| `git rev-list --count <remote>/<branch>..HEAD` | 本地领先数 |
| `git rev-list --count HEAD..<remote>/<branch>` | 落后数 |

限制：远程分支是只读引用（不能直接提交）；远程删除后本地引用会残留（需要 prune）；ahead/behind 需要先 fetch。

## 4. clone

- `git clone <url> [<dir>]`。
- `--depth=<n>`：浅克隆。
- `--single-branch` / `--branch <name>`。
- `--recurse-submodules`。

限制：大仓库慢、LFS、网络。

## 5. 认证（GitHub）

### HTTPS
- Personal Access Token（classic / fine-grained），GitHub 已不支持密码认证。
- credential helper：`git config --global credential.helper manager`（Windows 常用）/ `store` / `cache`。
- token 权限：`repo`（读写）、`workflow` 等。

### SSH
- `ssh-keygen -t ed25519` 生成密钥。
- `ssh-add` 加入 agent。
- GitHub 设置里添加公钥。
- `ssh -T git@github.com` 测试。
- `~/.ssh/config` 可配多账号。

### gh CLI（可选）
- `gh auth login` / `gh auth status`。
- `gh repo clone`。
- `gh pr create / list / checkout`。

限制：token 过期 / 权限不足 / 2FA / 企业 SSO / 代理。

## 6. GitHub 特有（可选）

- PR：`gh pr create --base <base> --head <head> --title ... --body ...`。
- PR 列表 / 检出：`gh pr list`、`gh pr checkout <n>`。
- Issues：`gh issue list`（只读）。
- Release：`gh release create`。
- API：`https://api.github.com`（认证 5000 次/小时，未认证 60 次/小时）。
- 企业版：域名不同（`github.example.com`）。

限制：API rate limit、企业域名、权限、PR 需要 gh 或 token。

## 7. 面板设计建议

- **远程管理**：远程列表（名称 / URL / 跟踪分支数），添加、改 URL、删除。
- **同步**：当前分支的 fetch / pull / push，显示 ahead/behind；push 前检查非 fast-forward。
- **远程分支**：列表（远程/分支），检出为本地分支、删除远程分支、prune。
- **认证**：不保存凭据，依赖系统 credential helper / SSH agent；认证失败时提示配置方法。
- **PR（可选）**：依赖 `gh` 或 token，先不做也行。
- **危险操作**：force push、删除远程分支必须二次确认。
- **网络操作**：fetch/push 可能慢，用后台任务 + 超时 + 错误提示。

## 8. 必须处理的限制

1. fetch/push 网络慢或失败 → 超时与错误提示。
2. 认证失败 → 提示配置 token / SSH，面板不收集密码。
3. force push → 二次确认 + 优先 `--force-with-lease`。
4. 分支保护 → push 被拒时显示原因。
5. 大仓库 fetch 慢 → 后台任务 / 进度。
6. 离线 / 代理 → 明确错误。
7. 删除远程分支 → 本地跟踪引用残留（提示 prune）。

## 9. 方法数估算

remote 管理（list / add / remove / set-url）+ sync（fetch / pull / push）+ 远程分支（list / checkout / delete / prune）≈ 新增 6~9 个 host 方法，remote 包 descriptor 同步。
