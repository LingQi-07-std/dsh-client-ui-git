// One-shot GitHub API request, executed in a CHILD process.
//
// Why a child process: the host process (started by the harness) cannot be
// launched with `--use-system-ca`, and this machine needs the system CA store to
// verify api.github.com (plain Node fetch fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE).
// Running the request here lets us pass that flag without touching the host.
//
// Contract: read { url, token, method?, body?, headers? } as JSON on stdin,
// write { ok, status, json } (or { ok:false, status:0, reason, error }) on stdout.
import { readFileSync } from "node:fs";

async function main() {
	const raw = readFileSync(0, "utf8");
	const input = JSON.parse(raw);
	const headers = {
		Authorization: `Bearer ${input.token}`,
		Accept: "application/vnd.github+json",
		"User-Agent": "dsh-git-panel",
		...(input.headers ?? {})
	};
	const res = await fetch(input.url, {
		method: typeof input.method === "string" && input.method.length > 0 ? input.method : "GET",
		headers,
		body: typeof input.body === "string" && input.body.length > 0 ? input.body : undefined
	});
	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch (error) {
		json = null;
	}
	process.stdout.write(JSON.stringify({ ok: res.ok, status: res.status, json }));
}

main().catch((error) => {
	process.stdout.write(JSON.stringify({
		ok: false,
		status: 0,
		reason: "network",
		error: String(error?.message ?? error),
		json: null
	}));
});
