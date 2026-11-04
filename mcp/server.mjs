#!/usr/bin/env node
// Arona Git MCP Server — LOCAL git tools only.
// Read-only queries + safe writes + the two dangerous operations (restore /
// reset) that stay OFF by default and are enabled later from a settings page.
// Network features (remote/fetch/pull/push) are deliberately out of scope.
//
// Source of truth: this file lives in the plugin repo (mcp/server.mjs) and is
// deployed to $DSH_HOME/mcp-git/server.mjs by `node scripts/sync-mcp.mjs`.
// Its sibling git-core.mjs is synced from ../lib/git-core.mjs.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as git from './git-core.mjs'
import * as githubAuth from './github-auth.mjs'

const SERVER_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * Dangerous tools are opt-in. The settings page (future) only has to write
 * `{ "allowDangerousTools": true }` to config.json — no server edit needed.
 * The environment variable exists for one-off/test runs.
 */
function dangerousToolsEnabled() {
	if (process.env.DSH_GIT_ALLOW_DANGEROUS === '1') return true
	try {
		const config = JSON.parse(readFileSync(join(SERVER_DIR, 'config.json'), 'utf8'))
		return config?.allowDangerousTools === true
	} catch {
		return false
	}
}

const server = new McpServer({ name: 'git', version: '0.2.0' })

const wrap = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] })
const fail = (error) => ({
	content: [{
		type: 'text',
		text: JSON.stringify({
			ok: false,
			error: error instanceof Error ? error.message : String(error),
			errorCode: error instanceof Error ? (error.code ?? null) : null,
			timedOut: error instanceof Error ? error.timedOut === true : false
		}, null, 2)
	}]
})

const pathDesc = '目标 git 仓库目录（绝对路径，须是已存在目录）'
const pathsDesc = '可选：限定仓库内相对路径（数组）'

// ---- read-only -------------------------------------------------------------

server.tool('snapshot', '仓库概览：是否 git 仓库、仓库根、当前分支、HEAD、改动统计（暂存/未暂存/未跟踪）、领先/落后远程。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.snapshot(git.requireDir(path))) } catch (e) { return fail(e) }
})

server.tool('log', '提交历史（新→旧），可按路径/作者/时间/信息过滤。含短哈希、父提交、分支/标签引用、作者、时间、提交信息。', {
	path: z.string().describe(pathDesc),
	limit: z.number().int().min(1).max(500).optional().describe('返回条数，默认 60'),
	paths: z.array(z.string()).optional().describe(pathsDesc),
	author: z.string().optional().describe('按作者过滤（子串匹配）'),
	since: z.string().optional().describe('起始时间，如 2026-10-01 或 2.weeks'),
	grep: z.string().optional().describe('按提交信息过滤（不区分大小写）')
}, async ({ path, limit, paths, author, since, grep }) => {
	try { return wrap(await git.log(git.requireDir(path), limit, { paths, author, since, grep })) } catch (e) { return fail(e) }
})

server.tool('status', '工作区状态条目（porcelain 语义）：M 修改 / A 新增 / D 删除 / ?? 未跟踪，含是否干净。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.status(git.requireDir(path))) } catch (e) { return fail(e) }
})

server.tool('diff', '查看 diff。三种用法：给 commit 看该提交；不给 commit 看工作区改动；staged=true 看已暂存改动。可限定 paths、要 stat 概览、限制 patch 字节数。', {
	path: z.string().describe(pathDesc),
	commit: z.string().optional().describe('提交哈希（可短）；省略则看工作区/暂存区'),
	staged: z.boolean().optional().describe('true = 看已暂存的改动（git diff --cached）'),
	base: z.string().optional().describe('可选的比较基点（分支/提交），与 staged 互斥'),
	paths: z.array(z.string()).optional().describe(pathsDesc),
	stat: z.boolean().optional().describe('只返回 --stat 概览而不是完整 patch'),
	maxBytes: z.number().int().min(1024).max(16 * 1024 * 1024).optional().describe('patch 上限字节，默认 8MB')
}, async ({ path, commit, staged, base, paths, stat, maxBytes }) => {
	try {
		return wrap(await git.diff(git.requireDir(path), commit, { staged, base, paths, stat, maxBytes }))
	} catch (e) { return fail(e) }
})

server.tool('show_file', '读取某个提交里某一文件的内容（git show <commit>:<path>）。', {
	path: z.string().describe(pathDesc),
	commit: z.string().describe('提交哈希或分支名'),
	file: z.string().describe('仓库内相对路径')
}, async ({ path, commit, file }) => {
	try { return wrap(await git.showFile(git.requireDir(path), commit, file)) } catch (e) { return fail(e) }
})

server.tool('branch', '本地与远程分支列表。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.branch(git.requireDir(path))) } catch (e) { return fail(e) }
})

server.tool('is_repo', '轻量判断目录是否在 git 工作树内（不拉取完整快照）。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap({ repo: await git.isRepo(git.requireDir(path)) }) } catch (e) { return fail(e) }
})

server.tool('blame', '按行追溯某文件的提交来源（默认前 200 行）。', {
	path: z.string().describe(pathDesc),
	file: z.string().describe('仓库内相对路径'),
	rev: z.string().optional().describe('可选：在哪个版本上 blame'),
	start: z.number().int().min(1).optional().describe('起始行（默认 1）'),
	end: z.number().int().min(1).optional().describe('结束行（默认 start+199）')
}, async ({ path, file, rev, start, end }) => {
	try { return wrap(await git.blame(git.requireDir(path), file, { rev, start, end })) } catch (e) { return fail(e) }
})

server.tool('reflog', '最近的操作记录（误删分支/误 reset 后的恢复线索）。', {
	path: z.string().describe(pathDesc),
	limit: z.number().int().min(1).max(200).optional().describe('条数，默认 30')
}, async ({ path, limit }) => {
	try { return wrap(await git.reflog(git.requireDir(path), limit)) } catch (e) { return fail(e) }
})

// ---- safe write set --------------------------------------------------------

server.tool('init', '在目录初始化 git 仓库（不自动 commit）。可顺带设置 user.name/user.email 身份。', {
	path: z.string().describe(pathDesc),
	userName: z.string().optional().describe('可选：设置 user.name'),
	userEmail: z.string().optional().describe('可选：设置 user.email')
}, async ({ path, userName, userEmail }) => {
	try { return wrap(await git.init(git.requireDir(path), { userName, userEmail })) } catch (e) { return fail(e) }
})

/** MCP-only commit identity (config.json mcpUserName / mcpUserEmail). */
function mcpIdentity() {
	try {
		const config = JSON.parse(readFileSync(join(SERVER_DIR, 'config.json'), 'utf8'))
		const name = typeof config?.mcpUserName === 'string' ? config.mcpUserName.trim() : ''
		const email = typeof config?.mcpUserEmail === 'string' ? config.mcpUserEmail.trim() : ''
		return name.length > 0 || email.length > 0 ? { name, email } : undefined
	} catch {
		return undefined
	}
}

server.tool('commit', '提交。默认自动暂存全部改动（git add -A）；stagedOnly=true 时只提交已暂存内容。提交前建议先 status 确认。', {
	path: z.string().describe(pathDesc),
	message: z.string().describe('提交信息（必填，非空）'),
	stagedOnly: z.boolean().optional().describe('true = 只提交已暂存的改动')
}, async ({ path, message, stagedOnly }) => {
	try {
		return wrap(await git.commit(git.requireDir(path), message, { stagedOnly: stagedOnly === true, identity: mcpIdentity() }))
	} catch (e) { return fail(e) }
})

server.tool('add', '暂存指定路径（可多选）。不传路径不会执行，避免误把全部改动加进索引。', {
	path: z.string().describe(pathDesc),
	paths: z.array(z.string()).describe('要暂存的仓库内相对路径')
}, async ({ path, paths }) => {
	try { return wrap(await git.addPaths(git.requireDir(path), paths)) } catch (e) { return fail(e) }
})

server.tool('unstage', '取消暂存指定路径（工作区改动保留）。', {
	path: z.string().describe(pathDesc),
	paths: z.array(z.string()).describe('要取消暂存的仓库内相对路径')
}, async ({ path, paths }) => {
	try { return wrap(await git.unstagePaths(git.requireDir(path), paths)) } catch (e) { return fail(e) }
})

server.tool('create_branch', '新建一个本地分支（默认从当前 HEAD 创建；可用 from 指定基点为某分支/提交）。安全，不存在破坏性。', {
	path: z.string().describe(pathDesc),
	name: z.string().describe('新分支名（不能含空格或 git 保留字符）'),
	from: z.string().optional().describe('可选：基点（分支名或提交哈希），默认当前 HEAD')
}, async ({ path, name, from }) => {
	try { return wrap(await git.createBranch(git.requireDir(path), name, from)) } catch (e) { return fail(e) }
})

server.tool('branch_admin', '分支管理：rename（改名）或 delete（删除）。delete 默认 -d（未合并会拒绝），force=true 用 -D。', {
	path: z.string().describe(pathDesc),
	action: z.enum(['rename', 'delete']).describe('rename 或 delete'),
	from: z.string().optional().describe('rename 的原分支名'),
	to: z.string().optional().describe('rename 的新分支名'),
	name: z.string().optional().describe('delete 的分支名'),
	force: z.boolean().optional().describe('rename 用 -M、delete 用 -D 强制')
}, async ({ path, action, from, to, name, force }) => {
	try {
		const dir = git.requireDir(path)
		if (action === 'rename') return wrap(await git.renameBranch(dir, from, to, { force: force === true }))
		return wrap(await git.deleteBranch(dir, name, { force: force === true }))
	} catch (e) { return fail(e) }
})

server.tool('checkout', '切换/回退到指定分支或某个提交（commit 时进入游离 HEAD，安全，不丢未提交改动）。', {
	path: z.string().describe(pathDesc),
	target: z.string().describe('分支名或提交哈希')
}, async ({ path, target }) => {
	try { return wrap(await git.checkout(git.requireDir(path), target)) } catch (e) { return fail(e) }
})

server.tool('revert', '安全回退：为指定提交生成一个反向提交（保留历史，不丢改动）。推荐的回档方式。', {
	path: z.string().describe(pathDesc),
	commit: z.string().describe('要还原的提交哈希（可短）')
}, async ({ path, commit }) => {
	try { return wrap(await git.revert(git.requireDir(path), commit)) } catch (e) { return fail(e) }
})

server.tool('merge', '把目标分支合并进当前分支。冲突时不自动解决，返回未合并的冲突文件列表（可用 abort 撤销）。', {
	path: z.string().describe(pathDesc),
	target: z.string().describe('要合并进来的分支名')
}, async ({ path, target }) => {
	try { return wrap(await git.merge(git.requireDir(path), target)) } catch (e) { return fail(e) }
})

server.tool('reset_soft', '软回退：把 HEAD 移到某提交，改动全部保留在暂存区（撤销提交但不丢工作，安全）。', {
	path: z.string().describe(pathDesc),
	commit: z.string().describe('目标提交（如 HEAD~1）')
}, async ({ path, commit }) => {
	try { return wrap(await git.resetSoft(git.requireDir(path), commit)) } catch (e) { return fail(e) }
})

server.tool('abort', '中止进行中的操作（冲突后脱身）：merge / revert / cherry-pick。', {
	path: z.string().describe(pathDesc),
	kind: z.enum(['merge', 'revert', 'cherry-pick']).describe('要中止的操作类型')
}, async ({ path, kind }) => {
	try { return wrap(await git.abortOperation(git.requireDir(path), kind)) } catch (e) { return fail(e) }
})

server.tool('stash', '暂存架：push（保存改动）/ pop / apply / drop / list / show。切分支前保存未提交改动用 push。', {
	path: z.string().describe(pathDesc),
	action: z.enum(['push', 'pop', 'apply', 'drop', 'list', 'show']).describe('要执行的 stash 动作'),
	message: z.string().optional().describe('push 时的说明'),
	ref: z.string().optional().describe('pop/apply/drop/show 的目标，如 stash@{0}'),
	includeUntracked: z.boolean().optional().describe('push 时一并保存未跟踪文件（-u）'),
	paths: z.array(z.string()).optional().describe('push 时只保存这些路径')
}, async ({ path, action, message, ref, includeUntracked, paths }) => {
	try {
		return wrap(await git.stashAction(git.requireDir(path), { action, message, ref, includeUntracked, paths }))
	} catch (e) { return fail(e) }
})

server.tool('tag', '标签管理：list（默认）/ create / delete。仅本地操作，不推送。', {
	path: z.string().describe(pathDesc),
	action: z.enum(['list', 'create', 'delete']).optional().describe('默认 list'),
	name: z.string().optional().describe('create/delete 的标签名'),
	message: z.string().optional().describe('create 时给注解标签的说明'),
	commit: z.string().optional().describe('create 时指定目标提交'),
	pattern: z.string().optional().describe('list 时的匹配模式')
}, async ({ path, action, name, message, commit, pattern }) => {
	try {
		const dir = git.requireDir(path)
		const kind = action ?? 'list'
		if (kind === 'create') return wrap(await git.tagCreate(dir, name, { message, commit }))
		if (kind === 'delete') return wrap(await git.tagDelete(dir, name))
		return wrap(await git.tagList(dir, pattern))
	} catch (e) { return fail(e) }
})

// ---- remote sync -----------------------------------------------------------

server.tool('fetch', '拉取远程引用（不合并）：更新远端跟踪分支，不改工作区。', {
	path: z.string().describe(pathDesc),
	remote: z.string().optional().describe('远程名，默认 origin'),
	account: z.string().optional().describe('指定 GitHub 账户（凭据）')
}, async ({ path, remote, account }) => {
	try { return wrap(await git.fetchRemote(git.requireDir(path), remote ?? '', account)) } catch (e) { return fail(e) }
})

server.tool('pull', '拉取远程分支并合并进当前分支（--no-rebase）。', {
	path: z.string().describe(pathDesc),
	remote: z.string().optional().describe('远程名，默认 origin'),
	branch: z.string().optional().describe('远程分支名，省略则用当前分支'),
	account: z.string().optional().describe('指定 GitHub 账户（凭据）')
}, async ({ path, remote, branch, account }) => {
	try { return wrap(await git.pullRemote(git.requireDir(path), remote ?? '', branch ?? '', account)) } catch (e) { return fail(e) }
})

server.tool('push', '推送当前分支。force=true 会改写远程历史，需要开启危险工具开关。', {
	path: z.string().describe(pathDesc),
	remote: z.string().optional().describe('远程名，默认 origin'),
	branch: z.string().optional().describe('分支名，省略则用当前分支'),
	setUpstream: z.boolean().optional().describe('同时设置上游（-u）'),
	force: z.boolean().optional().describe('危险：--force-with-lease，仅危险开关开启时可用'),
	account: z.string().optional().describe('指定 GitHub 账户（凭据）')
}, async ({ path, remote, branch, setUpstream, force, account }) => {
	try {
		if (force === true && !dangerousToolsEnabled()) {
			return fail(new Error('force 推送属于危险操作：需要在 config.json 打开 allowDangerousTools'))
		}
		return wrap(await git.pushRemote(git.requireDir(path), remote ?? '', branch ?? '', { force: force === true, setUpstream: setUpstream === true, account }))
	} catch (e) { return fail(e) }
})

server.tool('sync_status', '与上游的差异：ahead/behind 提交列表（含短哈希、作者、标题）与涉及文件。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.syncCommits(git.requireDir(path))) } catch (e) { return fail(e) }
})

server.tool('remote_branches', '远程分支列表（含对应本地分支、是否被跟踪）。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.remoteBranches(git.requireDir(path))) } catch (e) { return fail(e) }
})

server.tool('remote_info', '远程配置：名称、URL、是否 GitHub、owner/repo、默认分支。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.remoteInfo(git.requireDir(path))) } catch (e) { return fail(e) }
})

server.tool('add_remote', '给仓库添加远程（git remote add）。', {
	path: z.string().describe(pathDesc),
	url: z.string().describe('远程 URL'),
	name: z.string().optional().describe('远程名，默认 origin')
}, async ({ path, url, name }) => {
	try { return wrap(await git.addRemote(git.requireDir(path), url, name ?? 'origin')) } catch (e) { return fail(e) }
})

server.tool('remove_remote', '移除远程（git remote remove）。只改本地配置，不删远程仓库。', {
	path: z.string().describe(pathDesc),
	name: z.string().describe('要移除的远程名')
}, async ({ path, name }) => {
	try { return wrap(await git.removeRemote(git.requireDir(path), name)) } catch (e) { return fail(e) }
})

server.tool('link_upstream', '把本地分支关联到已存在的远程分支（git branch --set-upstream-to）。', {
	path: z.string().describe(pathDesc),
	branch: z.string().describe('本地分支名'),
	upstream: z.string().describe('远程分支（如 origin/main）')
}, async ({ path, branch, upstream }) => {
	try { return wrap(await git.linkUpstream(git.requireDir(path), branch, upstream)) } catch (e) { return fail(e) }
})

// ---- history rewrite / operations -----------------------------------------

server.tool('rebase', '把当前分支变基到指定上游（会重写本分支提交，之后推送需要 force）。', {
	path: z.string().describe(pathDesc),
	upstream: z.string().describe('目标上游（分支或提交）'),
	source: z.string().optional().describe('可选：先切换到这个分支再变基')
}, async ({ path, upstream, source }) => {
	try { return wrap(await git.rebase(git.requireDir(path), upstream, source)) } catch (e) { return fail(e) }
})

server.tool('rebase_skip', '变基冲突时跳过当前提交。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.rebaseSkip(git.requireDir(path))) } catch (e) { return fail(e) }
})

server.tool('operation_continue', '冲突解决后继续进行中的操作（merge / rebase / cherry-pick / squash）。', {
	path: z.string().describe(pathDesc),
	kind: z.enum(['merge', 'rebase', 'cherry-pick', 'revert', 'squash']).describe('进行中的操作类型')
}, async ({ path, kind }) => {
	try { return wrap(await git.operationContinue(git.requireDir(path), kind)) } catch (e) { return fail(e) }
})

server.tool('merge_preview', '合并预检：ff-only 是否可行、将会冲突的文件。', {
	path: z.string().describe(pathDesc),
	target: z.string().describe('目标分支'),
	source: z.string().describe('要合并进来的分支')
}, async ({ path, target, source }) => {
	try { return wrap(await git.mergePreview(git.requireDir(path), target, source)) } catch (e) { return fail(e) }
})

server.tool('branch_details', '分支详情：上游、最近提交、创建信息。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.branchDetails(git.requireDir(path))) } catch (e) { return fail(e) }
})

server.tool('orphaned_commits', '回收站：不在任何分支上的游离提交（误操作后可找回）。', {
	path: z.string().describe(pathDesc),
	limit: z.number().optional().describe('最多返回条数，默认 50')
}, async ({ path, limit }) => {
	try { return wrap(await git.orphanedCommits(git.requireDir(path), limit ?? 50)) } catch (e) { return fail(e) }
})

server.tool('conflict_file', '读取冲突文件里的冲突块内容。', {
	path: z.string().describe(pathDesc),
	file: z.string().describe('仓库内相对路径')
}, async ({ path, file }) => {
	try { return wrap(await git.conflictFile(git.requireDir(path), file)) } catch (e) { return fail(e) }
})

server.tool('range_diff', '两个提交区间的 diff（提交之间的整体改动）。', {
	path: z.string().describe(pathDesc),
	from: z.string().describe('区间起点提交'),
	to: z.string().describe('区间终点提交'),
	paths: z.array(z.string()).optional().describe('限定路径')
}, async ({ path, from, to, paths }) => {
	try { return wrap(await git.rangeDiff(git.requireDir(path), from, to, paths)) } catch (e) { return fail(e) }
})

server.tool('reflog_events', 'reflog 事件（分支创建、合并、检出等，供时间线补全）。', {
	path: z.string().describe(pathDesc)
}, async ({ path }) => {
	try { return wrap(await git.reflogEvents(git.requireDir(path))) } catch (e) { return fail(e) }
})

// ---- GitHub: accounts / PRs -------------------------------------------------

function createRepoAllowed() {
	if (process.env.DSH_GIT_ALLOW_CREATE_REPO === '1') return true
	try {
		const config = JSON.parse(readFileSync(join(SERVER_DIR, 'config.json'), 'utf8'))
		return config?.allowCreateRepo === true
	} catch { return false }
}

/** Fill owner/repo from the repository's remote when the caller omitted them. */
async function resolveRepo(dir, owner, repo) {
	if (typeof owner === 'string' && owner.length > 0 && typeof repo === 'string' && repo.length > 0) {
		return { owner, repo }
	}
	const info = await git.remoteInfo(dir)
	return { owner: info.owner ?? '', repo: info.repo ?? '' }
}

server.tool('github_accounts', 'Git Credential Manager 中已登录的 GitHub 账户列表。', {}, async () => {
	try { return wrap(await githubAuth.listAccounts()) } catch (e) { return fail(e) }
})

server.tool('github_user', '某个账户对应的 GitHub 用户（登录名、头像地址）。', {
	account: z.string().optional().describe('账户名，省略则用默认账户')
}, async ({ account }) => {
	try { return wrap(await githubAuth.githubUser(account)) } catch (e) { return fail(e) }
})

server.tool('repo_permission', '当前账户对仓库的推送权限（canPush / reason）。', {
	path: z.string().describe(pathDesc),
	owner: z.string().optional().describe('仓库 owner，省略则从远程推导'),
	repo: z.string().optional().describe('仓库名，省略则从远程推导'),
	account: z.string().optional().describe('指定账户')
}, async ({ path, owner, repo, account }) => {
	try {
		const dir = git.requireDir(path)
		const resolved = await resolveRepo(dir, owner, repo)
		return wrap(await githubAuth.repoPermission(account, resolved.owner, resolved.repo))
	} catch (e) { return fail(e) }
})

server.tool('repo_info', '仓库信息（fork 关系、父仓库等）。', {
	path: z.string().describe(pathDesc),
	owner: z.string().optional().describe('仓库 owner，省略则从远程推导'),
	repo: z.string().optional().describe('仓库名，省略则从远程推导'),
	account: z.string().optional().describe('指定账户')
}, async ({ path, owner, repo, account }) => {
	try {
		const dir = git.requireDir(path)
		const resolved = await resolveRepo(dir, owner, repo)
		return wrap(await githubAuth.repoInfo(account, resolved.owner, resolved.repo))
	} catch (e) { return fail(e) }
})

server.tool('list_prs', 'PR 列表：给定 branch 查该分支的 PR（含 incoming/outgoing）；否则查全部打开/关闭的 PR。', {
	path: z.string().describe(pathDesc),
	branch: z.string().optional().describe('只看这个分支的 PR'),
	owner: z.string().optional().describe('仓库 owner，省略则从远程推导'),
	repo: z.string().optional().describe('仓库名，省略则从远程推导'),
	account: z.string().optional().describe('指定账户')
}, async ({ path, branch, owner, repo, account }) => {
	try {
		const dir = git.requireDir(path)
		const resolved = await resolveRepo(dir, owner, repo)
		if (typeof branch === 'string' && branch.length > 0) {
			return wrap(await githubAuth.listPullRequests(account, resolved.owner, resolved.repo, branch))
		}
		return wrap(await githubAuth.listAllPullRequests(account, resolved.owner, resolved.repo, branch ?? ''))
	} catch (e) { return fail(e) }
})

server.tool('create_pr', '创建 PR：head/base 必填（head 跨仓库写成 "owner:branch"）。', {
	path: z.string().describe(pathDesc),
	title: z.string().describe('PR 标题'),
	head: z.string().describe('来源分支（跨仓库：owner:branch）'),
	base: z.string().describe('目标分支（如 main）'),
	body: z.string().optional().describe('PR 描述'),
	draft: z.boolean().optional().describe('草稿 PR'),
	owner: z.string().optional().describe('仓库 owner，省略则从远程推导'),
	repo: z.string().optional().describe('仓库名，省略则从远程推导'),
	account: z.string().optional().describe('指定账户')
}, async ({ path, title, head, base, body, draft, owner, repo, account }) => {
	try {
		const dir = git.requireDir(path)
		const resolved = await resolveRepo(dir, owner, repo)
		return wrap(await githubAuth.createPullRequest(account, resolved.owner, resolved.repo, { title, head, base, body, draft: draft === true }))
	} catch (e) { return fail(e) }
})

// Creating a repository is a separate opt-in (config.json allowCreateRepo), on top
// of the dangerous-tool switch — matching the panel's "allow creating repos" setting.
if (createRepoAllowed()) {
	server.tool('create_repo', '创建一个空仓库（需在配置中开启 allowCreateRepo）。', {
		name: z.string().describe('仓库名'),
		description: z.string().optional().describe('仓库描述'),
		private: z.boolean().optional().describe('是否私有，默认 true'),
		account: z.string().optional().describe('指定账户')
	}, async ({ name, description, private: isPrivate, account }) => {
		try {
			return wrap(await githubAuth.createRepo(account, { name, description, private: isPrivate !== false }))
		} catch (e) { return fail(e) }
	})
}

// ---- dangerous set (opt-in only) -------------------------------------------

if (dangerousToolsEnabled()) {
	server.tool('restore', '危险：丢弃未提交的工作区改动（默认不提供；需在配置里显式开启）。', {
		path: z.string().describe(pathDesc),
		paths: z.array(z.string()).optional().describe('限定路径；省略则丢弃全部未提交改动')
	}, async ({ path, paths }) => {
		try { return wrap(await git.restore(git.requireDir(path), paths ?? [])) } catch (e) { return fail(e) }
	})

	server.tool('reset', '危险：硬回退 HEAD 到某提交并丢弃其后的改动（默认不提供；需在配置里显式开启，仅本地未推送时使用）。', {
		path: z.string().describe(pathDesc),
		commit: z.string().describe('目标提交')
	}, async ({ path, commit }) => {
		try { return wrap(await git.reset(git.requireDir(path), commit)) } catch (e) { return fail(e) }
	})
}

await server.connect(new StdioServerTransport())
