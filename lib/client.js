// @dsh-external/dsh-client-ui-git — browser half
// Git visualizer panel: a sidebar-footer action opens a drawer with the
// current session workspace's branch, working-tree status, commit graph, and
// per-commit diff browser. All git facts come from the host `git` Remote
// service (read-only). Ships as a self-contained __ModuleLoader__ bundle.
window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-git",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");

		// DSH 0.2.0 migration: `react/jsx-runtime` no longer resolves to the React
		// factory in this module table (its `jsx`/`jsxs` come back undefined), and
		// rendering an element built from an undefined factory is React error #130
		// ("element type is invalid"). Rebuild both factories on top of
		// `react.createElement`, which IS available, keeping the automatic-runtime
		// call shape used throughout this bundle: (type, props) => element.
		if (typeof react_jsx_runtime.jsx !== "function" || typeof react_jsx_runtime.jsxs !== "function") {
			const normalize = (type, props) => {
				if (props === null || props === void 0) return [type, null, null];
				const { children, ...rest } = props;
				const meaningful = Object.keys(rest).length > 0 ? rest : null;
				return [type, meaningful, children];
			};
			react_jsx_runtime = {
				...react_jsx_runtime,
				jsx: (type, props) => {
					const [t, p, c] = normalize(type, props);
					return react.createElement(t, p, c === void 0 ? null : c);
				},
				jsxs: (type, props) => {
					const [t, p, c] = normalize(type, props);
					if (Array.isArray(c)) return react.createElement(t, p, ...c);
					return react.createElement(t, p, c === void 0 ? null : c);
				},
				Fragment: react_jsx_runtime.Fragment ?? react.Fragment,
			};
		}

		// Pinpoint the exact element type when the tree builds an invalid element:
		// React #130 only says "element type is invalid" and hides which component
		// came back undefined.
		const __jsx = react_jsx_runtime.jsx;
		const __jsxs = react_jsx_runtime.jsxs;
		const guardType = (type) => {
			if (type === void 0 || type === null) {
				console.error("[git 面板] jsx() got an undefined element type; stack:", new Error("invalid element type").stack);
			}
			return type;
		};
		react_jsx_runtime = {
			...react_jsx_runtime,
			// NEVER forward `undefined` as props: React 18's jsx runtime reads
			// `config.key` without a null guard, so `jsx(type, undefined)` throws
			// "Cannot read properties of undefined (reading 'key')".
			jsx: (type, props) => __jsx(guardType(type), props ?? {}),
			jsxs: (type, props) => __jsxs(guardType(type), props ?? {}),
		};

		//#region styles
		const css = [
			".dshg-root{--dshg-border:var(--dsw-alias-border-l2);--dshg-muted:var(--dsw-alias-label-tertiary);--dshg-text:var(--dsw-alias-label-primary);--dshg-sub:var(--dsw-alias-label-secondary);--dshg-hover:var(--dsw-alias-interactive-bg-hover);--dshg-danger:var(--dsw-alias-state-error-primary,#d5482f);--dshg-ok:var(--dsw-alias-state-success-primary,#1e8e5a);--dshg-warn:var(--dsw-alias-state-warning-primary,#c98a1b);box-sizing:border-box;font-family:var(--dsw-font-ui,inherit);font-size:13px;line-height:18px}",
			".dshg-overlay{position:fixed;inset:var(--dshg-bar-height,40px) 0 0 0;background:var(--dsw-alias-bg-mask-1);z-index:900;animation:dshg-fade .15s ease-out}",
			"@keyframes dshg-fade{from{opacity:0}}",
			".dshg-drawer{position:fixed;top:var(--dshg-bar-height,40px);right:0;bottom:0;width:min(440px,100vw - 32px);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));border-left:1px solid var(--dshg-border);z-index:901;display:flex;flex-direction:column;box-shadow:var(--dsw-shadow-lv3,none);animation:dshg-slide .18s var(--ds-ease-in-out, ease-out)}",
			"@keyframes dshg-slide{from{transform:translateX(24px);opacity:0}}",
			".dshg-header{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dshg-border);flex:none}",
			".dshg-title{font-size:14px;font-weight:600;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}",
			".dshg-badge{display:inline-flex;align-items:center;gap:4px;max-width:140px;padding:1px 8px;border-radius:999px;font-family:var(--dsw-font-mono,monospace);font-size:11px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--dsw-alias-fill-l2);color:var(--dshg-sub);border:1px solid var(--dshg-border);flex:none}",
			".dshg-badgeOk{color:var(--dshg-ok)}",
			".dshg-badgeWarn{color:var(--dshg-warn)}",
			".dshg-iconButton{cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:8px;background:transparent;color:var(--dshg-sub);flex:none;padding:0}",
			".dshg-iconButton:hover{background:var(--dshg-hover);color:var(--dshg-text)}",
			".dshg-body{flex:1;min-height:0;overflow:hidden;padding:10px 14px 16px;display:flex;flex-direction:column;gap:10px}",
			".dshg-summary{display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
			".dshg-chip{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:6px;font-size:11px;line-height:18px;background:var(--dsw-alias-fill-l2);color:var(--dshg-sub);flex:none}",
			".dshg-chipB{color:var(--dshg-text)}",
			".dshg-chipA{color:var(--dshg-ok)}",
			".dshg-chipM{color:var(--dshg-warn)}",
			".dshg-chipD{color:var(--dshg-danger)}",
			".dshg-section{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--dshg-muted);margin:4px 0 2px}",
			".dshg-empty{color:var(--dshg-muted);font-size:12px;padding:8px 2px}",
			".dshg-fileRow{display:flex;align-items:center;gap:8px;padding:3px 4px;border-radius:6px;min-width:0}",
			".dshg-fileRow:hover{background:var(--dshg-hover)}",
			".dshg-fileStatus{flex:none;width:18px;text-align:center;font-family:var(--dsw-font-mono,monospace);font-size:11px;font-weight:700}",
			".dshg-filePath{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dshg-text);font-family:var(--dsw-font-mono,monospace);font-size:12px}",
			".dshg-groupRow{display:flex;align-items:center;gap:6px;padding:4px 4px;border-radius:6px;cursor:pointer;color:var(--dshg-sub);min-width:0}",
			// Unified, always-visible custom scrollbars for the three panes so a
			// vertical bar never silently vanishes (browser overlay scrollbars
			// hide themselves; ::-webkit-scrollbar renders deterministically).
			// Keep the thumb a plain solid rounded bar — a transparent border +
			// background-clip trick makes short thumbs nearly invisible (you can
			// still drag an invisible thumb; that matched the reported bug).
			".dshg-statusPane,.dshg-timeline,.dshg-diffPane{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2,#c2ccd9) transparent}",
			".dshg-statusPane::-webkit-scrollbar,.dshg-timeline::-webkit-scrollbar,.dshg-diffPane::-webkit-scrollbar{width:8px;height:8px}",
			".dshg-statusPane::-webkit-scrollbar-thumb,.dshg-timeline::-webkit-scrollbar-thumb,.dshg-diffPane::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,#c2ccd9);border-radius:4px;min-height:24px}",
			".dshg-statusPane::-webkit-scrollbar-thumb:hover,.dshg-timeline::-webkit-scrollbar-thumb:hover,.dshg-diffPane::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2,#9aa8b8);min-height:24px}",
			".dshg-statusPane::-webkit-scrollbar-track,.dshg-timeline::-webkit-scrollbar-track,.dshg-diffPane::-webkit-scrollbar-track{background:transparent}",
			".dshg-groupCaret{flex:none;width:12px;text-align:center;font-size:10px;color:var(--dshg-muted);transition:transform .12s var(--ds-ease-in-out,ease-out)}",
			".dshg-groupCaretOpen{transform:rotate(90deg)}",
			".dshg-groupIcon{flex:none;color:var(--dshg-sub)}",
			".dshg-groupName{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-mono,monospace);font-size:12px;color:var(--dshg-sub)}",
			".dshg-groupCount{flex:none;color:var(--dshg-muted);font-size:11px}",
			".dshg-groupFiles{padding-left:22px}",
			// Content-driven panes. The "feature" pane (working tree when idle,
			// diff when a commit is selected) NEVER shrinks: it renders at its
			// natural height and only starts scrolling once THAT pane's own
			// content exceeds its cap (70% / 60%). The timeline instead carries
			// all shrink/grow — it fills whatever remains and scrolls freely,
			// so it may never be the reason a compact status list scrolls.
			".dshg-statusPane{flex:0 0 auto;min-height:0;max-height:70%;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px;border-bottom:1px solid var(--dshg-border)}",
			".dshg-timeline{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding-right:2px}",
			".dshg-diffPane{display:none}",
			".dshg-mode-detail .dshg-statusPane{display:none}",
			".dshg-mode-detail .dshg-timeline{flex:1 1 auto;min-height:0;overflow-y:auto}",
			".dshg-mode-detail .dshg-diffPane{flex:0 0 auto;min-height:0;max-height:60%;overflow-y:auto;border-top:1px solid var(--dshg-border);padding-top:8px;display:flex;flex-direction:column;gap:6px}",
			".dshg-diffHint{color:var(--dshg-muted);font-size:12px;text-align:center;padding:24px 8px}",
			".dshg-ops{display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex:none}",
			".dshg-op{cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:7px;border:1px solid var(--dshg-border);background:transparent;color:var(--dshg-sub);font-size:12px;line-height:18px;flex:none}",
			".dshg-op:hover{background:var(--dshg-hover);color:var(--dshg-text)}",
			".dshg-opDisabled{opacity:.5;cursor:not-allowed}",
			".dshg-opPrimary{background:var(--dsw-alias-accent-bg,transparent);color:var(--dsw-alias-accent,#3b82f6);border-color:var(--dsw-alias-accent-border,transparent)}",
			".dshg-opDanger{color:var(--dshg-danger);border-color:var(--dshg-danger)}",
			".dshg-opDanger:hover{background:color-mix(in srgb,var(--dshg-danger) 12%,transparent);color:var(--dshg-danger)}",
			".dshg-busy{width:12px;height:12px;border-radius:50%;border:2px solid var(--dshg-border);border-top-color:var(--dshg-sub);animation:dshg-spin .7s linear infinite;flex:none;display:inline-block;vertical-align:-2px}",
			".dshg-opMsg{padding:6px 10px;border-radius:7px;font-size:12px;line-height:18px;flex:none;max-width:100%;max-height:72px;overflow-y:auto;white-space:pre-wrap;word-break:break-word}",
			".dshg-opMsgOk{color:var(--dshg-ok);background:color-mix(in srgb,var(--dshg-ok) 10%,transparent)}",
			".dshg-opMsgErr{color:var(--dshg-danger);background:color-mix(in srgb,var(--dshg-danger) 10%,transparent)}",
			".dshg-modal{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:950;background:var(--dsw-alias-bg-mask-2,transparent)}",
			".dshg-modalCard{width:min(360px,90vw);max-height:80vh;overflow-y:auto;background:var(--dsw-specific-menu,#fff);border:1px solid var(--dshg-border);border-radius:12px;padding:16px;box-shadow:var(--dsw-shadow-lv3,none);display:flex;flex-direction:column;gap:10px}",
			".dshg-modalTitle{font-size:14px;font-weight:600;color:var(--dshg-text)}",
			".dshg-modalDesc{font-size:12px;line-height:20px;color:var(--dshg-sub)}",
			".dshg-modalList{max-height:140px;overflow-y:auto;border:1px solid var(--dshg-border);border-radius:7px;padding:4px;font-family:var(--dsw-font-mono,monospace);font-size:11px;color:var(--dshg-sub);display:flex;flex-direction:column;gap:2px}",
			".dshg-input{box-sizing:border-box;width:100%;padding:6px 9px;border-radius:7px;border:1px solid var(--dshg-border);background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dshg-text);font-size:12px;font-family:var(--dsw-font-ui,inherit)}",
			".dshg-input:focus{outline:none;border-color:var(--dshg-sub)}",
			".dshg-modalActions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}",
			".dshg-notRepo{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--dshg-muted);text-align:center;padding:24px;min-height:0}",
			".dshg-notRepoIcon{color:var(--dshg-border);flex:none}",
			".dshg-notRepoTitle{font-size:14px;font-weight:600;color:var(--dshg-sub)}",
			".dshg-notRepoDesc{font-size:12px;line-height:20px;max-width:280px}",
			".dshg-commitRow{display:flex;gap:8px;border-radius:8px;cursor:pointer;padding:5px 6px;min-width:0}",
			".dshg-commitRow:hover{background:var(--dshg-hover)}",
			".dshg-commitRowSel{background:var(--dshg-hover)}",
			".dshg-graph{flex:none;width:22px;display:flex;flex-direction:column;align-items:center;position:relative}",
			".dshg-graphLine{flex:1;width:2px;background:var(--dshg-border);min-height:8px}",
			".dshg-graphDot{width:10px;height:10px;border-radius:50%;margin:2px 0;border:2px solid var(--dsw-alias-bg-layer-2,var(--dsw-specific-menu));flex:none;box-sizing:border-box}",
			".dshg-dotHead{background:var(--dshg-text)}",
			".dshg-dotBranch{background:var(--dshg-ok)}",
			".dshg-dotMerge{background:var(--dshg-warn)}",
			".dshg-dotPlain{background:var(--dsw-alias-fill-l3,#a7b3c6)}",
			".dshg-commitMain{flex:1;min-width:0}",
			".dshg-commitSubject{color:var(--dshg-text);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-commitMeta{color:var(--dshg-muted);font-size:11px;display:flex;gap:6px;align-items:center;margin-top:1px;white-space:nowrap;overflow:hidden}",
			".dshg-refs{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px}",
			".dshg-ref{font-size:10px;line-height:16px;padding:0 5px;border-radius:4px;background:var(--dsw-alias-fill-l2);color:var(--dshg-sub);font-family:var(--dsw-font-mono,monospace);max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-refHead{color:var(--dshg-text);border:1px solid var(--dshg-border)}",
			".dshg-diffFiles{margin-top:2px}",
			".dshg-diffFileRow{display:flex;align-items:center;gap:8px;padding:2px 4px;border-radius:6px}",
			".dshg-num{flex:none;min-width:30px;text-align:right;font-family:var(--dsw-font-mono,monospace);font-size:11px}",
			".dshg-numAdd{color:var(--dshg-ok)}",
			".dshg-numDel{color:var(--dshg-danger)}",
			".dshg-patch{margin:6px 0 2px;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dshg-border);overflow:auto;max-height:280px}",
			".dshg-patch pre{margin:0;font-family:var(--dsw-font-mono,monospace);font-size:11px;line-height:16px;color:var(--dshg-sub);white-space:pre}",
			".dshg-error{color:var(--dshg-danger);font-size:12px;padding:6px 2px}",
			".dshg-loading{color:var(--dshg-muted);font-size:12px;padding:8px 2px;display:flex;align-items:center;gap:8px}",
			".dshg-spinner{width:12px;height:12px;border-radius:50%;border:2px solid var(--dshg-border);border-top-color:var(--dshg-sub);animation:dshg-spin .7s linear infinite;flex:none}",
			"@keyframes dshg-spin{to{transform:rotate(360deg)}}",
			".dshg-footerBtn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:none;background:transparent;border-radius:50%;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;margin:8px 0 10px}",
			".dshg-footerBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dshg-footerBadge{position:absolute;top:-2px;right:-2px;min-width:14px;height:14px;padding:0 3px;border-radius:999px;background:var(--dshg-warn);color:#fff;font-size:9px;line-height:14px;text-align:center;font-weight:700;box-sizing:border-box}",
			".dshg-footerBranch{max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-mono,monospace);font-size:12px;color:var(--dsw-alias-label-tertiary)}",
			".dshg-footerLabel{position:relative;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;width:calc(100% + 8px);height:34px;margin:4px -4px;padding:6px 2px 6px 10px;border-radius:12px;cursor:pointer;color:var(--dsw-alias-label-primary);background:transparent;border:none;font-family:inherit;font-size:14px;line-height:22px;min-width:0;overflow:hidden}",
			".dshg-footerLabel:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			// The Arona theme's `[class*='footer']{background:transparent !important}`
			// also matches these git button classes (ids contain "footer"), which
			// would kill the hover highlight. Re-assert with a more specific rule.
			"body[data-arona-theme] :is([data-pane='sidebar'],[class*='sidebarCol']) .dshg-footerLabel:hover,body[data-arona-theme] :is([data-pane='sidebar'],[class*='sidebarCol']) .dshg-footerBtn:hover{background:var(--dsw-alias-interactive-bg-hover) !important;color:var(--dsw-alias-label-primary) !important}",
			".dshg-detached{color:var(--dshg-muted);font-size:12px}",
			".dshg-trunc{color:var(--dshg-muted);font-size:11px;margin-top:2px}",
			// --- worktree sections / timeline / detail (2026-10-21 UI rebuild) ---
			".dshg-body{position:relative}",
			".dshg-opsBar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex:none;padding:8px 12px;border-bottom:1px solid var(--dshg-border)}",
			".dshg-main{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:8px 12px 12px}",
			".dshg-clean{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 16px;color:var(--dshg-muted)}",
			".dshg-cleanText{font-size:13px;color:var(--dshg-sub)}",
			".dshg-sec{border:1px solid var(--dshg-border);border-radius:10px;overflow:hidden;flex:none}",
			".dshg-secHead{display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--dsw-alias-fill-l2);cursor:pointer;user-select:none}",
			".dshg-secTitle{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dshg-sub);flex:1}",
			".dshg-secCount{font-size:11px;color:var(--dshg-muted);flex:none}",
			".dshg-check{width:14px;height:14px;flex:none;box-sizing:border-box;border:1px solid var(--dshg-border);border-radius:4px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px;line-height:1;cursor:pointer}",
			".dshg-checkOn{background:var(--dsw-alias-accent,#3b82f6);border-color:transparent}",
			".dshg-row{display:flex;align-items:center;gap:8px;padding:3px 8px;min-width:0;cursor:pointer;user-select:none;border-radius:6px}",
			".dshg-row:hover{background:var(--dshg-hover)}",
			".dshg-rowSel{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 12%,transparent)}",
			".dshg-letter{flex:none;width:14px;text-align:center;font-family:var(--dsw-font-mono,monospace);font-size:11px;font-weight:700}",
			".dshg-path{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-mono,monospace);font-size:12px}",
			".dshg-green{color:var(--dshg-ok)}",
			".dshg-yellow{color:var(--dshg-warn)}",
			".dshg-orange{color:#e0813c}",
			".dshg-red{color:var(--dshg-danger)}",
			".dshg-dirRow{display:flex;align-items:center;gap:6px;padding:3px 8px;user-select:none;color:var(--dshg-sub);border-radius:6px}",
			".dshg-dirRow:hover{background:var(--dshg-hover)}",
			".dshg-caret{flex:none;width:10px;text-align:center;font-size:9px;color:var(--dshg-muted);transition:transform .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-caretOpen{transform:rotate(90deg)}",
			".dshg-caretUp{font-size:9px;color:var(--dshg-muted)}",
			".dshg-dirName{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--dsw-font-mono,monospace);font-size:12px;color:var(--dshg-sub)}",
			".dshg-timeline{display:flex;flex-direction:column;gap:4px;flex:none;padding-top:2px}",
			".dshg-commit{display:flex;flex-direction:column;border:1px solid transparent;border-radius:10px;overflow:hidden;transition:border-color .18s,background .18s}",
			".dshg-commitOpen{border-color:var(--dshg-border);background:var(--dsw-alias-fill-l2)}",
			".dshg-commitHead{display:flex;gap:8px;align-items:flex-start;padding:6px;cursor:pointer;min-width:0}",
			".dshg-commitBody{max-height:0;opacity:0;transition:max-height .22s var(--ds-ease-in-out,ease-out),opacity .18s var(--ds-ease-in-out,ease-out);overflow:hidden}",
			".dshg-commitBodyOpen{max-height:240px;opacity:1}",
			".dshg-commitMsg{font-size:12px;line-height:18px;color:var(--dshg-sub);white-space:pre-wrap;word-break:break-word;padding:0 10px 6px}",
			".dshg-commitActions{display:flex;align-items:center;gap:6px;padding:0 10px 8px;flex-wrap:wrap}",
			".dshg-commitActionsRight{margin-left:auto;display:flex;align-items:center;gap:2px}",
			".dshg-opDetail{display:inline-flex;align-items:center;gap:4px}",
			".dshg-detail{position:absolute;left:0;right:0;bottom:0;max-height:60%;display:flex;flex-direction:column;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));border-top:1px solid var(--dshg-border);box-shadow:var(--dsw-shadow-lv3,none);transform:translateY(100%);opacity:0;transition:transform .22s var(--ds-ease-in-out,ease-out),opacity .16s var(--ds-ease-in-out,ease-out);pointer-events:none;z-index:3}",
			".dshg-detailOpen{transform:none;opacity:1;pointer-events:auto}",
			".dshg-detailHead{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dshg-border);flex:none}",
			".dshg-detailTitle{flex:1;min-width:0;font-size:12px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-detailList{flex:1 1 auto;min-height:0;overflow-y:auto;padding:4px 8px 8px}",
			".dshg-groupTitle{font-size:11px;font-weight:600;color:var(--dshg-muted);padding:6px 4px 2px;letter-spacing:.04em}",
			".dshg-diffNums{flex:none;display:flex;gap:6px;font-family:var(--dsw-font-mono,monospace);font-size:11px}",
			".dshg-numAdd{color:var(--dshg-ok)}",
			".dshg-numDel{color:var(--dshg-danger)}",
			".dshg-fileDiff{flex:none;max-height:280px;overflow:auto;border-top:1px solid var(--dshg-border);padding:8px 12px;background:var(--dsw-alias-bg-layer-1)}",
			".dshg-fileDiffHead{display:flex;align-items:center;gap:8px;margin-bottom:4px}",
			".dshg-fileDiffTitle{flex:1;min-width:0;font-size:11px;font-family:var(--dsw-font-mono,monospace);color:var(--dshg-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-fileDiff pre{margin:0;font-family:var(--dsw-font-mono,monospace);font-size:11px;line-height:16px;color:var(--dshg-sub);white-space:pre}",
			"@media (prefers-reduced-motion:reduce){.dshg-commitBody,.dshg-detail,.dshg-caret{transition:none}}",
			// --- one merged list, continuous graph, detail polish (2026-10-21 r2) ---
			".dshg-fileList{display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:45%;flex:none}",
			".dshg-group{border:1px solid var(--dshg-border);border-radius:10px;overflow:hidden;flex:none}",
			".dshg-groupFiles{padding:2px 0}",
			".dshg-warnDot{flex:none;width:14px;height:14px;border-radius:50%;background:var(--dshg-warn,#d19a12);color:#2c2100;font-size:10px;font-weight:800;line-height:14px;text-align:center;box-sizing:border-box}",
			".dshg-timeline{position:relative;display:flex;flex-direction:column;gap:4px;flex:none;padding:2px 0 2px 20px}",
			".dshg-timeline::before{content:'';position:absolute;left:9px;top:8px;bottom:8px;width:2px;background:var(--dshg-border);border-radius:1px}",
			".dshg-commit{position:relative;display:flex;flex-direction:column;border:1px solid transparent;border-radius:10px;overflow:hidden;transition:border-color .15s var(--ds-ease-in-out,ease-out),background .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-commit:hover{background:var(--dshg-hover)}",
			".dshg-commitOpen{border-color:var(--dshg-border);background:var(--dsw-alias-fill-l2)}",
			".dshg-nodeWrap{position:absolute;left:-20px;top:10px;width:20px;display:flex;justify-content:center;pointer-events:none}",
			".dshg-node{width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:2px solid var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));position:relative;z-index:1;transition:box-shadow .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-commit:hover .dshg-node{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 40%,transparent)}",
			".dshg-commitBody{max-height:0;opacity:0;overflow:hidden;transition:max-height .2s var(--ds-ease-in-out,ease-out),opacity .2s var(--ds-ease-in-out,ease-out)}",
			".dshg-commitBodyOpen{max-height:240px;opacity:1}",
			".dshg-fileDiff{flex:none;max-height:none;overflow:auto;border-top:1px solid var(--dshg-border);padding:8px 12px;background:var(--dsw-alias-bg-layer-1);transition:height .2s var(--ds-ease-in-out,ease-out)}",
			".dshg-patchLines{font-family:var(--dsw-font-mono,monospace);font-size:11px;line-height:16px;white-space:pre}",
			".dshg-pl{white-space:pre}",
			".dshg-add{color:var(--dshg-ok)}",
			".dshg-del{color:var(--dshg-danger)}",
			".dshg-hunk{color:var(--dshg-muted)}",
			".dshg-ctx{color:var(--dshg-sub)}",
			".dshg-footerCount{margin-left:auto;flex:none;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dshg-warn,#d19a12);color:#fff;font-size:10px;line-height:16px;text-align:center;font-weight:700;box-sizing:border-box}",
			".dshg-commit{overflow:visible}",
			".dshg-commitOpen{border-radius:10px}",
			// --- tree layout, blue selection, grid-animated rows (2026-10-21 r3) ---
			".dshg-tree{display:flex;flex-direction:column;gap:1px;flex:none;overflow-y:auto;max-height:45%;padding:2px 0}",
			".dshg-dir{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:6px;cursor:pointer;user-select:none}",
			".dshg-dir:hover{background:var(--dshg-hover)}",
			".dshg-row{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:6px;cursor:pointer;user-select:none;min-width:0}",
			".dshg-rowSel{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 28%,transparent)}",
			".dshg-rowSel .dshg-path,.dshg-rowSel .dshg-letter,.dshg-rowSel .dshg-warnDot{color:#fff}",
			".dshg-plain{color:var(--dshg-text)}",
			".dshg-commit{border:none;background:transparent;border-radius:8px;overflow:visible}",
			".dshg-commit:hover{background:var(--dshg-hover)}",
			".dshg-commitOpen{background:var(--dsw-alias-fill-l2);border:1px solid var(--dshg-border)}",
			".dshg-commitOpen:hover{background:var(--dsw-alias-fill-l2)}",
			".dshg-commitSubject{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-commitSubjectOpen{white-space:normal;overflow:visible;text-overflow:clip}",
			".dshg-commitBody{display:grid;grid-template-rows:0fr;opacity:0;max-height:none;overflow:visible;transition:grid-template-rows .22s var(--ds-ease-in-out,ease-out),opacity .22s var(--ds-ease-in-out,ease-out)}",
			".dshg-commitBodyOpen{grid-template-rows:1fr;opacity:1;max-height:none}",
			".dshg-commitBodyInner{overflow:hidden;min-height:0}",
			".dshg-opDetail{border:none;background:transparent;padding:2px 4px}",
			".dshg-opDetail:hover{background:var(--dshg-hover)}",
			// --- fixed letter colours, folder selection, marquee (2026-10-21 r4) ---
			".dshg-muted{color:var(--dshg-muted)}",
			".dshg-warnDot{width:11px;height:11px;line-height:11px;font-size:8px}",
			".dshg-dirPartial{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 12%,transparent)}",
			".dshg-dirAll{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 26%,transparent)}",
			".dshg-selCount{flex:none;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-accent,#3b82f6);color:#fff;font-size:10px;line-height:16px;text-align:center;font-weight:700;box-sizing:border-box}",
			".dshg-nodeActive{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 55%,transparent)}",
			".dshg-op{border:1px solid var(--dshg-border)}",
			".dshg-opPrimary{border-color:var(--dsw-alias-accent,#3b82f6)}",
			".dshg-commitMain{overflow:hidden;min-width:0}",
			"@keyframes dshg-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
			".dshg-marquee{animation:dshg-marquee 3.2s ease-in-out infinite alternate}",
			// --- open-row highlight, borderless detail, exact marquee (2026-10-21 r5) ---
			".dshg-commitOpen{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 16%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 45%,transparent)}",
			".dshg-commitOpen:hover{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 16%,transparent)}",
			".dshg-opDetail{border:none;background:transparent}",
			".dshg-opDetail:hover{background:var(--dshg-hover)}",
			"@keyframes dshg-marquee{0%{transform:translateX(0)}25%{transform:translateX(var(--dshg-shift,0px))}50%{transform:translateX(var(--dshg-shift,0px))}75%{transform:translateX(0)}100%{transform:translateX(0)}}",
			".dshg-marquee{animation:dshg-marquee 6s linear infinite;text-overflow:clip}",
			".dshg-timeline::before{top:15px;bottom:15px}",
			// --- graph endpoints, inline detail pane, marquee takeover (2026-10-21 r6) ---
			".dshg-timeline{gap:0}",
			".dshg-timeline::before{display:none}",
			".dshg-commit::before{content:'';position:absolute;left:-11px;top:0;bottom:0;width:2px;background:var(--dshg-border);border-radius:1px}",
			".dshg-commit:first-child::before{top:15px}",
			".dshg-commit:last-child::before{bottom:auto;height:15px}",
			".dshg-main{overflow-y:auto}",
			".dshg-detail{position:static;max-height:none;transform:none;opacity:1;box-shadow:none;pointer-events:auto;z-index:auto;display:grid;grid-template-rows:0fr;border-top:1px solid transparent;transition:grid-template-rows .22s var(--ds-ease-in-out,ease-out),border-color .22s var(--ds-ease-in-out,ease-out)}",
			".dshg-detailOpen{grid-template-rows:1fr;border-top-color:var(--dshg-border)}",
			".dshg-detailInner{overflow:hidden;min-height:0;display:flex;flex-direction:column}",
			".dshg-fileDiffClosed{opacity:0;border-top-color:transparent;padding-top:0;padding-bottom:0}",
			".dshg-marquee{animation:none;text-overflow:clip}",
			// --- sticky rounded detail pane, stable graph gutter, first-commit chip (2026-10-21 r7) ---
			".dshg-detail{position:sticky;bottom:0;border-radius:12px;border:1px solid transparent;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));box-shadow:0 -8px 24px rgba(0,0,0,.18);z-index:2;margin-top:6px}",
			".dshg-detailOpen{border-color:var(--dshg-border)}",
			".dshg-commit{border:1px solid transparent}",
			".dshg-commitOpen{border-color:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 45%,transparent)}",
			// --- seamless graph, natural detail height, stable gutter (2026-10-21 r8) ---
			".dshg-commit::before{top:-1px;bottom:-1px}",
			".dshg-commit:first-child::before{top:14px}",
			".dshg-commit:last-child::before{height:16px}",
			".dshg-detailInner{display:block;overflow:hidden;border-radius:11px}",
			".dshg-detailList{flex:none;max-height:none;overflow:visible}",
			".dshg-main{scrollbar-gutter:stable}",
			".dshg-diag{flex:none;font-size:10px;line-height:14px;color:var(--dshg-muted);padding:4px 10px 6px;white-space:normal;word-break:break-all;border-top:1px dashed var(--dshg-border)}",
			// --- selection legibility + theme-aware hover (2026-10-21 r9) ---
			// Hover mixes the THEME TEXT colour, so light mode darkens and dark mode
			// lightens by the same small amount without ever hurting contrast.
			".dshg-row:hover{background:color-mix(in srgb,var(--dshg-text) 8%,transparent)}",
			".dshg-dir:hover{background:color-mix(in srgb,var(--dshg-text) 8%,transparent)}",
			".dshg-rowSel{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 26%,transparent)}",
			".dshg-rowSel:hover{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 34%,transparent)}",
			".dshg-rowSel .dshg-path,.dshg-rowSel .dshg-letter{color:var(--dshg-text)}",
			".dshg-rowSel .dshg-warnDot{color:#2c2100}",
			// --- no text selection while clicking a commit card (2026-10-21 r10) ---
			".dshg-commit{user-select:none;-webkit-user-select:none}",
			".dshg-commitMsg{user-select:text;-webkit-user-select:text}",
			// --- no divider line on the detail container (2026-10-21 r11) ---
			".dshg-detail{border:none}",
			".dshg-detailOpen{border:none}",
		].join("");
		const cssTagId = "@dsh-external/dsh-client-ui-git/main.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-external/dsh-client-ui-git";
			tag.dataset.pluginCss = cssTagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region shared panel store
		// Module-level store so the footer badge and the drawer share one fact
		// source without crossing cordis scopes. IMMUTABLE updates (new object
		// identity per setStore) so react useSyncExternalStore sees real changes —
		// mutating in place would make every snapshot compare equal and the UI
		// would never refresh.
		// Dev diagnostics (the bottom strip that prints how the workspace was
		// resolved). OFF by default; a future settings page flips it through
		// `window.__dshGitDev.set(true)` and the choice is persisted locally.
		const DEV_STORAGE_KEY = "dsh-git-dev-mode";
		function readDevMode() {
			try {
				if (typeof window !== "undefined" && window.localStorage !== void 0 && window.localStorage !== null) {
					return window.localStorage.getItem(DEV_STORAGE_KEY) === "1";
				}
			} catch (error) {
				// Storage can be unavailable (private mode / sandbox); stay off.
			}
			return false;
		}
		let storeBase = {
			cwd: null,
			snapshot: null,
			log: null,
			status: null,
			branch: null,
			// Commit detail (files + statuses for the drawer's detail page).
			detail: null,
			detailHash: null,
			detailError: null,
			detailLoading: false,
			// One file's patch inside the open detail page.
			fileDiff: null,
			fileDiffKey: null,
			fileDiffError: null,
			fileDiffLoading: false,
			error: null,
			clientError: null,
			working: false,
			opMessage: null,
			loading: false,
			devMode: readDevMode(),
			version: 0
		};
		let store = storeBase;
		const listeners = new Set();
		function subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
		function getSnapshot() {
			return store;
		}
		function setStore(patch) {
			const version = store.version + 1;
			store = { ...store, ...patch, version };
			for (const listener of [...listeners]) {
				try {
					listener();
				} catch (error) {
					console.error("[ui-git] store listener threw:", error);
				}
			}
		}
		function storeFace() {
			return { subscribe, getSnapshot };
		}
		/**
		 * Toggle the dev diagnostics strip. This is the hook a settings page will
		 * call; it also persists the choice so it survives a reload.
		 */
		function setDevMode(enabled) {
			const value = enabled === true;
			setStore({ devMode: value });
			try {
				if (typeof window !== "undefined" && window.localStorage !== void 0 && window.localStorage !== null) {
					window.localStorage.setItem(DEV_STORAGE_KEY, value ? "1" : "0");
				}
			} catch (error) {
				// Non-fatal: the in-memory flag still controls this session.
			}
			return value;
		}
		// Guard rails: capture uncaught runtime errors so a bad render never
		// silently takes the whole slot down; the message is shown in the
		// footer/tooltip so it is reportable instead of invisible.
		if (typeof window !== "undefined") {
			window.addEventListener("error", (event) => {
				setStore({ clientError: (event?.error?.message ?? event?.message) || "uncaught error" });
			});
			window.addEventListener("unhandledrejection", (event) => {
				setStore({ clientError: event?.reason?.message || String(event?.reason ?? "unhandled rejection") });
			});
		}
		/**
		* Local error boundary so a crash inside a git component degrades to a
		* visible fallback instead of abdicating the whole slot entry forever.
		*/
		function Safeguard({ fallback, children }) {
			return (0, react_jsx_runtime.jsx)(SafeguardBoundary, { fallback, children });
		}
		class SafeguardBoundary extends react.Component {
			constructor(props) {
				super(props);
				this.state = { failed: null };
			}
			static getDerivedStateFromError(error) {
				return { failed: error };
			}
			componentDidCatch(error) {
				console.error("[ui-git] component crashed:", error);
				setStore({ clientError: error?.message || String(error) });
			}
			render() {
				if (this.state.failed !== null) {
					if (typeof this.props.fallback === "function") return this.props.fallback(this.state.failed);
					return this.props.fallback ?? null;
				}
				return this.props.children;
			}
		}
		//#endregion

		//#region icons
		function GitIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M21.2 11.4 12.6 2.8c-.5-.5-1.3-.5-1.8 0L9 4.6l2.3 2.3c.5-.2 1.1-.1 1.5.3.4.4.5 1 .3 1.5l2.2 2.2c.5-.2 1.1-.1 1.5.3.6.6.6 1.5 0 2.1-.6.6-1.5.6-2.1 0-.4-.4-.5-1-.3-1.5l-2-2v5.1c.4.2.7.6.7 1.1 0 .7-.6 1.3-1.3 1.3s-1.3-.6-1.3-1.3c0-.5.2-.9.6-1.1V9.7c-.4-.2-.6-.6-.6-1.1 0-.4.2-.8.5-1L9.8 5.2 2.8 12.2c-.5.5-.5 1.3 0 1.8l8.6 8.6c.5.5 1.3.5 1.8 0l8-8c.5-.5.5-1.3 0-1.8Z",
					fill: "currentColor"
				})
			});
		}
		function CloseIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M4 4l8 8M12 4l-8 8",
					stroke: "currentColor",
					strokeWidth: 1.6,
					strokeLinecap: "round"
				})
			});
		}
		function ArrowUpIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M3.8 7.7L8 3.5l4.2 4.2",
					stroke: "currentColor",
					strokeWidth: 1.6,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function RefreshIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3",
					stroke: "currentColor",
					strokeWidth: 1.5,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function FolderIcon({ size = 14 }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.5 2H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V4Z",
					stroke: "currentColor",
					strokeWidth: 1.3,
					strokeLinejoin: "round"
				})
			});
		}
		//#endregion

		//#region helpers
		/** "2026-01-05T03:04:05+08:00" -> "1月5日" / "3分钟前"-style label. */
		function formatDate(iso, t) {
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return iso;
			const diff = Date.now() - date.getTime();
			const minutes = Math.floor(diff / 60000);
			if (minutes < 1) return t("time.now");
			if (minutes < 60) return t("time.minutes", { n: minutes });
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return t("time.hours", { n: hours });
			const days = Math.floor(hours / 24);
			if (days < 7) return t("time.days", { n: days });
			return `${date.getMonth() + 1}月${date.getDate()}日`;
		}
		function basename(path) {
			if (typeof path !== "string") return "";
			const parts = path.split(/[\\/]/).filter((part) => part.length > 0);
			return parts.length > 0 ? parts[parts.length - 1] : path;
		}
		const STATUS_LABEL = { M: "M", A: "A", D: "D", R: "R", C: "C", U: "U", "?": "?" };
		function statusClass(x, y) {
			if (x === "?" || y === "?") return "dshg-chipB";
			if (x === "D" || y === "D") return "dshg-chipD";
			if (x === "A" || x === "R" || x === "C" || y === "A" || y === "R") return "dshg-chipA";
			if (x !== " " || y !== " ") return "dshg-chipM";
			return "";
		}
		/** Group status entries by directory; "" key = repo root. Defensive: no
		 * iterator-based loops so malformed payloads degrade instead of throwing. */
		function groupEntries(entries) {
			const result = [];
			const filesByDir = new Map();
			if (!Array.isArray(entries)) return result;
			for (let i = 0; i < entries.length; i += 1) {
				const entry = entries[i];
				if (entry === null || typeof entry !== "object" || typeof entry.path !== "string") continue;
				const parts = entry.path.split(/[\\/]/);
				const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
				let list = filesByDir.get(dir);
				if (list === void 0) {
					list = [];
					filesByDir.set(dir, list);
					result.push({ dir, items: list });
				}
				list.push(entry);
			}
			return result;
		}
		/** Defensive status label + color for one entry (never throws). */
		function fileLabel(entry) {
			const x = typeof entry?.x === "string" ? entry.x : "";
			const y = typeof entry?.y === "string" ? entry.y : "";
			return `${STATUS_LABEL[x] ?? x}${STATUS_LABEL[y] ?? y}`.trim();
		}
		//#endregion

		//#region refresh pipeline
		/** Fetch snapshot+log+status for a cwd; safe to call concurrently. */
		async function refreshAll(ctx, cwd) {
			if (typeof cwd !== "string" || cwd.length === 0) {
				setStore({ snapshot: null, log: null, status: null, error: null, loading: false, cwd: null });
				return;
			}
			// A refresh of the SAME workspace must keep the selected commit's diff:
			// the panel's own mount refresh and the footer badge refresh race with
			// the user clicking a commit, and clearing diffHash here used to wipe
			// the diff that had just loaded (the pane fell back to "loading").
			const sameWorkspace = store.cwd === cwd;
			setStore({ loading: true, error: null, cwd });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const snapshot = await run("snapshot", { path: cwd });
				// Non-repository directories: log/status/branch would fail inside
				// git, so only query them when snapshot proved a work tree.
				const [log, status, branch] = snapshot.repo === true
					? await Promise.all([
						run("log", { path: cwd, limit: 60 }),
						run("status", { path: cwd }),
						run("branch", { path: cwd })
					])
					: [{ commits: [] }, { clean: true, entries: [] }, { branches: [] }];
				setStore({
					snapshot,
					log,
					status,
					branch,
					loading: false,
					error: null,
					...(sameWorkspace ? null : { detail: null, detailHash: null, detailError: null, fileDiff: null, fileDiffKey: null, fileDiffError: null })
				});
			} catch (error) {
				setStore({ loading: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
		/**
		 * Run one write action through ctx.remote.git, refresh after success, and
		 * surface the outcome in store.opMessage. Never throws.
		 */
		async function runAction(ctx, cwd, method, args) {
			setStore({ working: true, opMessage: null });
			try {
				const result = await ctx.remote.git[method]({ path: cwd, ...args });
				if (result.ok === false || result.ok === void 0) {
					const err = result?.error?.message || result?.error || "操作失败";
					setStore({ working: false, opMessage: { type: "error", text: err } });
					return result;
				}
				setStore({ working: false, opMessage: { type: "ok", text: result.value?.message || "操作成功" } });
				refreshAll(ctx, cwd);
				return result;
			} catch (error) {
				setStore({ working: false, opMessage: { type: "error", text: error instanceof Error ? error.message : String(error) } });
				return { ok: false };
			}
		}
		/** Fetch one commit's file list; keeps the previous list until it lands. */
		async function refreshDetail(ctx, cwd, hash) {
			// Keep the previous detail visible while loading so the slide-up pane
			// keeps its height instead of collapsing to a spinner and jumping.
			setStore({ detailHash: hash, detailError: null, detailLoading: true, fileDiff: null, fileDiffKey: null, fileDiffError: null });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const detail = await run("diff", { path: cwd, commit: hash, stat: true });
				setStore({ detail, detailError: null, detailLoading: false });
			} catch (error) {
				setStore({ detailError: error instanceof Error ? error.message : String(error), detailLoading: false });
			}
		}
		/** Fetch one file's patch inside the open commit detail. */
		async function refreshFileDiff(ctx, cwd, hash, path) {
			const key = `${hash}:${path}`;
			if (store.fileDiffKey === key && store.fileDiff !== null) return;
			// Same policy as the detail list: hold the previous patch (and its
			// height) until the new one arrives.
			setStore({ fileDiffKey: key, fileDiffError: null, fileDiffLoading: true });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const fileDiff = await run("diff", { path: cwd, commit: hash, paths: [path] });
				setStore({ fileDiff, fileDiffError: null, fileDiffLoading: false });
			} catch (error) {
				setStore({ fileDiff: null, fileDiffError: error instanceof Error ? error.message : String(error), fileDiffLoading: false });
			}
		}
		//#endregion

		//#region GitPanel
		const h = react_jsx_runtime.jsx;
		const hs = react_jsx_runtime.jsxs;

		/**
		 * Merge porcelain entries into ONE row per path. The working-tree side
		 * wins for colouring and the warning dot (it is the side needing action).
		 */
		function mergeEntries(entries) {
			const map = new Map();
			if (!Array.isArray(entries)) return [];
			for (let i = 0; i < entries.length; i += 1) {
				const entry = entries[i];
				if (entry === null || typeof entry !== "object" || typeof entry.path !== "string") continue;
				const x = typeof entry.x === "string" ? entry.x : " ";
				const y = typeof entry.y === "string" ? entry.y : " ";
				let row = map.get(entry.path);
				if (row === void 0) { row = { path: entry.path, x: " ", y: " " }; map.set(entry.path, row); }
				if (x !== " ") row.x = x;
				if (y !== " ") row.y = y;
			}
			const rows = [];
			for (const row of map.values()) {
				const untracked = row.x === "?" || row.y === "?";
				const working = untracked || row.y !== " ";
				const staged = !untracked && row.x !== " ";
				const letter = untracked ? "?" : working ? row.y : row.x;
				rows.push({ path: row.path, x: row.x, y: row.y, letter, working, staged });
			}
			return rows;
		}

		/** Staged: add green / delete red / others plain. Working: yellow, delete orange. */
		function toneOf(row) {
			if (row.working) {
				if (row.letter === "U") return "dshg-red";
				return row.letter === "D" ? "dshg-orange" : "dshg-yellow";
			}
			if (row.letter === "U") return "dshg-red";
			if (row.letter === "A") return "dshg-green";
			if (row.letter === "D") return "dshg-red";
			return "dshg-plain";
		}

		/** The status letter keeps a fixed colour, independent of staging. */
		function letterTone(letter) {
			if (letter === "A") return "dshg-green";
			if (letter === "D" || letter === "U") return "dshg-red";
			if (letter === "?") return "dshg-muted";
			return "dshg-yellow";
		}

		/** Every file path below one tree node. */
		function collectPaths(node, out = []) {
			for (let i = 0; i < node.files.length; i += 1) out.push(node.files[i].path);
			for (const child of node.children.values()) collectPaths(child, out);
			return out;
		}

		/** Build a directory tree (nested folders, no boxes). */
		function buildTree(rows) {
			const root = { name: "", path: "", children: new Map(), files: [] };
			for (let i = 0; i < rows.length; i += 1) {
				const row = rows[i];
				const parts = row.path.split(/[\\/]/);
				let node = root;
				for (let p = 0; p < parts.length - 1; p += 1) {
					const name = parts[p];
					let child = node.children.get(name);
					if (child === void 0) {
						child = { name, path: node.path === "" ? name : `${node.path}/${name}`, children: new Map(), files: [] };
						node.children.set(name, child);
					}
					node = child;
				}
				node.files.push(row);
			}
			return root;
		}

		/** Collapse single-child directory chains into one label. */
		function compactNode(node) {
			let current = node;
			let label = node.name;
			while (current.files.length === 0 && current.children.size === 1) {
				current = current.children.values().next().value;
				label = `${label}/${current.name}`;
			}
			return { label, target: current };
		}

		/** Any working-tree row anywhere below this node? */
		function subtreeHasWorking(node) {
			for (let i = 0; i < node.files.length; i += 1) if (node.files[i].working) return true;
			for (const child of node.children.values()) if (subtreeHasWorking(child)) return true;
			return false;
		}

		/** Total file count below this node. */
		function subtreeCount(node) {
			let total = node.files.length;
			for (const child of node.children.values()) total += subtreeCount(child);
			return total;
		}

		/** Small yellow circle with an exclamation mark. */
		function WarnDot() {
			return h("span", { key: "warnDot", className: "dshg-warnDot", title: "有未暂存的改动", children: "!" });
		}

		/** One file row: status letter + warning dot + name (no checkbox). */
		function FileRow({ row, level, selected, onDown, onEnter }) {
			const key = `file:${row.path}`;
			const picked = selected[key] === true;
			const tone = toneOf(row);
			return hs("div", {
				key: row.path,
				className: `dshg-row${picked ? " dshg-rowSel" : ""}`,
				style: { paddingLeft: `${6 + level * 14}px` },
				onMouseDown: (event) => { if (event.button === 0) onDown(row.path); },
				onMouseEnter: () => onEnter(row.path),
				children: [
					h("span", { className: `dshg-letter ${letterTone(row.letter)}`, children: row.letter }),
					row.working ? h(WarnDot, {}) : null,
					h("span", { className: `dshg-path ${tone}`, title: row.path, children: row.path.split(/[\\/]/).pop() })
				]
			});
		}

		/** Recursive directory rendering (indent = level). */
		function TreeNodes({ node, level, collapsed, selected, onToggle, onDown, onEnter }) {
			return h("div", {
				children: Array.from(node.children.values()).map((child) => {
					const compacted = compactNode(child);
					const target = compacted.target;
					const hasWorking = subtreeHasWorking(target);
					const isCollapsed = collapsed[target.path] === true;
					const paths = collectPaths(target);
					const selectedCount = paths.filter((path) => selected[`file:${path}`] === true).length;
					const partial = selectedCount > 0 && selectedCount < paths.length;
					const allSelected = selectedCount > 0 && selectedCount === paths.length;
					return h("div", {
						key: target.path,
						children: [
							hs("div", {
								className: `dshg-dir${partial ? " dshg-dirPartial" : ""}${allSelected ? " dshg-dirAll" : ""}`,
								style: { paddingLeft: `${6 + level * 14}px` },
								onClick: () => onToggle(target.path),
								children: [
									h("span", { className: `dshg-caret${isCollapsed ? "" : " dshg-caretOpen"}`, children: "▶" }),
									h("span", { className: "dshg-groupIcon", children: h(FolderIcon, { size: 12 }) }),
									hasWorking ? h(WarnDot, {}) : null,
									h("span", { className: `dshg-dirName${hasWorking ? " dshg-yellow" : ""}`, title: target.path, children: compacted.label }),
									selectedCount > 0 ? h("span", { className: "dshg-selCount", children: selectedCount }) : null,
									h("span", { className: "dshg-secCount", children: `${subtreeCount(target)}` })
								]
							}),
							isCollapsed ? null : h("div", {
								children: [
									target.files.map((row) => h(FileRow, { key: row.path, row, level: level + 1, selected, onDown, onEnter })),
									h(TreeNodes, { node: target, level: level + 1, collapsed, selected, onToggle, onDown, onEnter })
								]
							})
						]
					});
				})
			});
		}

		/** Timeline row: click expands, double click opens the detail pane. */
		function CommitRow({ commit, index, expanded, detailOpen, isFirst, onToggle, onOpenDetail, onAction }) {
			const isMerge = Array.isArray(commit.parents) && commit.parents.length > 1;
			const dot = index === 0 ? "dshg-dotHead" : isMerge ? "dshg-dotMerge" : index % 3 === 0 ? "dshg-dotBranch" : "dshg-dotPlain";
			const subjectRef = (0, react.useRef)(null);
			const [marquee, setMarquee] = (0, react.useState)(false);
			const marqueeAnim = (0, react.useRef)(null);
			const hoverRef = (0, react.useRef)(false);
			const startMarquee = () => {
				// Only a collapsed row marquees, and it moves by the exact overflow
				// so the whole subject becomes visible.
				if (expanded) return;
				const el = subjectRef.current;
				if (el === null || el === void 0) return;
				// Measure in the natural (clipped) state; a previous run may have
				// left width:max-content behind and would report zero overflow.
				el.style.width = "";
				el.style.overflow = "hidden";
				const overflow = el.scrollWidth - el.clientWidth;
				if (overflow <= 2) return;
				// Let the text escape its own ellipsis box, otherwise the scroll
				// only slides a clipped window and the tail stays hidden.
				el.style.textOverflow = "clip";
				el.style.overflow = "visible";
				el.style.width = "max-content";
				if (typeof el.animate === "function") {
					// Constant speed (~70px/s): time scales with the distance, so a
					// longer subject takes longer instead of moving faster.
					const moveMs = Math.max(500, Math.round((overflow / 70) * 1000));
					const holdMs = 1500;
					const total = moveMs * 2 + holdMs * 2;
					const travel = moveMs / total;
					const hold = (moveMs + holdMs) / total;
					const back = (moveMs * 2 + holdMs) / total;
					marqueeAnim.current = el.animate([
						{ transform: "translateX(0)", offset: 0 },
						{ transform: `translateX(${-overflow}px)`, offset: travel },
						{ transform: `translateX(${-overflow}px)`, offset: hold },
						{ transform: "translateX(0)", offset: back },
						{ transform: "translateX(0)", offset: 1 }
					], { duration: total, iterations: Infinity, easing: "linear" });
				}
				setMarquee(true);
			};
			const stopMarquee = () => {
				const el = subjectRef.current;
				if (marqueeAnim.current !== null) { marqueeAnim.current.cancel(); marqueeAnim.current = null; }
				if (el !== null && el !== void 0) {
					el.style.textOverflow = "";
					el.style.overflow = "";
					el.style.width = "";
					el.style.transform = "";
				}
				setMarquee(false);
			};
			// Expanding drops the banner; collapsing brings it back while hovered.
			(0, react.useEffect)(() => {
				if (expanded === true) {
					if (marqueeAnim.current !== null) {
						marqueeAnim.current.cancel();
						marqueeAnim.current = null;
						const el = subjectRef.current;
						if (el !== null && el !== void 0) {
							el.style.textOverflow = "";
							el.style.overflow = "";
							el.style.width = "";
							el.style.transform = "";
						}
						setMarquee(false);
					}
					return;
				}
				if (hoverRef.current === true) startMarquee();
			}, [expanded]);
			return hs("div", {
				key: commit.hash,
				className: `dshg-commit${expanded ? " dshg-commitOpen" : ""}`,
				// The whole card is the click target (head AND expanded body); inner
				// buttons stop propagation themselves.
				onClick: (event) => { if ((event?.detail ?? 0) > 1) return; onToggle(); },
				onDoubleClick: (event) => { event.stopPropagation(); if (isFirst === true) return; onOpenDetail(commit.hash); },
				children: [
					h("span", { className: "dshg-nodeWrap", children: h("span", { className: `dshg-node ${dot}${expanded || detailOpen ? " dshg-nodeActive" : ""}` }) }),
					hs("div", {
						className: "dshg-commitHead",
						onMouseEnter: () => { hoverRef.current = true; startMarquee(); },
						onMouseLeave: () => { hoverRef.current = false; stopMarquee(); },
						children: h("div", {
							className: "dshg-commitMain",
							children: [
								h("div", {
									ref: subjectRef,
									className: `dshg-commitSubject${expanded ? " dshg-commitSubjectOpen" : ""}${!expanded && marquee ? " dshg-marquee" : ""}`,
									title: commit.subject,
									children: commit.subject
								}),
								hs("div", {
									className: "dshg-commitMeta",
									children: [
										h("span", { children: commit.short }),
										h("span", { children: commit.author }),
										h("span", { children: formatDate(commit.date, translate) }),
										isMerge ? h("span", { className: "dshg-detached", children: "合并" }) : null
									]
								}),
								Array.isArray(commit.refs) && commit.refs.length > 0 ? h("div", {
									className: "dshg-refs",
									children: commit.refs.slice(0, 4).map((ref) => h("span", { key: ref, className: `dshg-ref${ref === "HEAD" ? " dshg-refHead" : ""}`, children: ref }))
								}) : null
							]
						})
					}),
					h("div", {
						className: `dshg-commitBody${expanded ? " dshg-commitBodyOpen" : ""}`,
						children: hs("div", {
							className: "dshg-commitBodyInner",
							children: [
								commit.body ? h("div", { className: "dshg-commitMsg", children: commit.body }) : null,
								hs("div", {
									className: "dshg-commitActions",
									children: [
										h("button", { type: "button", className: "dshg-op", onClick: (event) => { event.stopPropagation(); onAction("checkout", commit.hash); }, children: "回退到此" }),
										h("button", { type: "button", className: "dshg-op", onClick: (event) => { event.stopPropagation(); onAction("revert", commit.hash); }, children: "还原提交" }),
										h("button", { type: "button", className: "dshg-op dshg-opDanger", onClick: (event) => { event.stopPropagation(); onAction("reset", commit.hash); }, children: "强制回退" }),
										h("div", {
											className: "dshg-commitActionsRight",
											children: isFirst === true
												? h("button", {
													type: "button",
													className: "dshg-op dshg-opDetail dshg-opDisabled",
													disabled: true,
													title: "这是仓库的首次提交，没有可展开的改动",
													children: h("span", { children: "首次提交" })
												})
												: h("button", {
													type: "button",
													className: "dshg-op dshg-opDetail",
													onClick: (event) => { event.stopPropagation(); onOpenDetail(commit.hash); },
													children: h("span", { children: detailOpen ? "收起详细" : "展开详细" })
												})
										})
									]
								})
							]
						})
					})
				]
			});
		}

		/** Render a patch as coloured lines (+ green, - red, @@ muted). */
		function PatchLines({ patch }) {
			const text = typeof patch === "string" ? patch : "";
			if (text === "") return h("div", { className: "dshg-empty", children: "（没有文本改动）" });
			return h("div", {
				className: "dshg-patchLines",
				children: text.split("\n").map((line, index) => {
					const isAdd = line.startsWith("+") && !line.startsWith("+++");
					const isDel = line.startsWith("-") && !line.startsWith("---");
					const isHunk = line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++");
					const cls = isAdd ? "dshg-add" : isDel ? "dshg-del" : isHunk ? "dshg-hunk" : "dshg-ctx";
					return h("div", { key: index, className: `dshg-pl ${cls}`, children: line === "" ? " " : line });
				})
			});
		}

		/** Slide-up commit detail: grouped files + one file's patch. */
		function DetailPane({ open, detailHash, detail, detailError, detailLoading, filePath, fileDiff, fileDiffError, fileDiffLoading, onClose, onPickFile, onCloseFile }) {
			const files = Array.isArray(detail?.files) ? detail.files : [];
			const added = files.filter((file) => file.status === "A");
			const deleted = files.filter((file) => file.status === "D");
			const modified = files.filter((file) => file.status !== "A" && file.status !== "D");
			const groups = [
				{ key: "A", label: "新增", rows: added },
				{ key: "M", label: "修改", rows: modified },
				{ key: "D", label: "删除", rows: deleted }
			];
			const lastBox = (0, react.useRef)(0);
			// Closing the pane resets the remembered patch height, otherwise the
			// next open first animates to the stale size and then jumps.
			(0, react.useEffect)(() => { if (open !== true) lastBox.current = 0; }, [open]);
			const patch = typeof fileDiff?.patch === "string" ? fileDiff.patch : "";
			const patchReady = patch !== "" || (fileDiff !== null && fileDiff !== void 0 && fileDiffLoading !== true);
			let boxHeight = lastBox.current;
			if (patchReady) {
				const lines = patch === "" ? 1 : patch.split("\n").length;
				boxHeight = Math.min(280, Math.max(56, lines * 16 + 34));
				lastBox.current = boxHeight;
			}
			if (boxHeight === 0) boxHeight = 120;
			return hs("div", {
				className: `dshg-detail${open ? " dshg-detailOpen" : ""}`,
				children: hs("div", {
					className: "dshg-detailInner",
					children: [
					hs("div", {
						className: "dshg-detailHead",
						children: [
							h("span", {
								className: "dshg-detailTitle",
								children: detailHash === null ? "" : `提交 ${String(detailHash).slice(0, 8)} 的改动`
							}),
							detailLoading === true ? h("span", { className: "dshg-spinner" }) : null,
							h("button", { type: "button", className: "dshg-iconButton", onClick: onClose, children: h(CloseIcon, { size: 12 }) })
						]
					}),
					detailError !== null && detailError !== void 0 ? h("div", { className: "dshg-error", children: detailError }) : null,
					detailError !== null && detailError !== void 0 ? null : h("div", {
						className: "dshg-detailList",
						children: detail === null
							? hs("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取提交内容…"] })
							: groups.map((group) => {
								if (group.rows.length === 0) return null;
								return hs("div", {
									key: group.key,
									children: [
										h("div", { className: "dshg-groupTitle", children: `${group.label}（${group.rows.length}）` }),
										group.rows.map((file) => hs("div", {
											key: file.path,
											className: `dshg-row${filePath === file.path ? " dshg-rowSel" : ""}`,
											onClick: () => onPickFile(file.path),
											children: [
												h("span", { className: `dshg-letter ${letterTone(file.status)}`, children: file.status }),
												h("span", { className: "dshg-path", title: file.path, children: file.path }),
												h("span", {
													className: "dshg-diffNums",
													children: [
														h("span", { className: "dshg-numAdd", children: file.binary ? "bin" : `+${file.added ?? 0}` }),
														h("span", { className: "dshg-numDel", children: file.binary ? "" : `-${file.removed ?? 0}` })
													]
												})
											]
										}))
									]
								});
							})
					}),
					hs("div", {
						className: `dshg-fileDiff${filePath === null ? " dshg-fileDiffClosed" : ""}`,
						style: { height: `${filePath === null ? 0 : boxHeight}px` },
						children: [
							hs("div", {
								className: "dshg-fileDiffHead",
								children: [
									h("span", { className: "dshg-fileDiffTitle", title: filePath ?? "", children: filePath ?? "" }),
									fileDiffLoading === true ? h("span", { className: "dshg-spinner" }) : null,
									h("button", { type: "button", className: "dshg-iconButton", title: "收起文件改动", onClick: onCloseFile, children: h(ArrowUpIcon, { size: 12 }) })
								]
							}),
							fileDiffError !== null && fileDiffError !== void 0
								? h("div", { className: "dshg-error", children: fileDiffError })
								: h(PatchLines, { patch })
						]
					})
					]
				})
			});
		}

		/** The drawer. */
		function GitPanel({ cwd, t, git, onClose, source, version, diag, devMode }) {
			const state = (0, react.useSyncExternalStore)(storeFace().subscribe, storeFace().getSnapshot);
			const [modal, setModal] = (0, react.useState)(null);
			const [commitMsg, setCommitMsg] = (0, react.useState)("");
			const [mergeTarget, setMergeTarget] = (0, react.useState)("");
			const [newBranchName, setNewBranchName] = (0, react.useState)("");
			const [switchTarget, setSwitchTarget] = (0, react.useState)("");
			const [selected, setSelected] = (0, react.useState)({});
			const [collapsedDirs, setCollapsedDirs] = (0, react.useState)({});
			const [expandedHash, setExpandedHash] = (0, react.useState)(null);
			const [detailHash, setDetailHash] = (0, react.useState)(null);
			const [filePath, setFilePath] = (0, react.useState)(null);
			const dragRef = (0, react.useRef)(null);
			const treeRef = (0, react.useRef)(null);
			const mainRef = (0, react.useRef)(null);
			const autoCollapsed = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				setExpandedHash(null);
				setDetailHash(null);
				setFilePath(null);
				setSelected({});
				git.refresh(cwd);
			}, [cwd, git]);
			(0, react.useEffect)(() => {
				const onUp = () => { dragRef.current = null; };
				document.addEventListener("mouseup", onUp);
				return () => document.removeEventListener("mouseup", onUp);
			}, []);
			(0, react.useEffect)(() => {
				if (state.opMessage === null || state.opMessage === void 0) return void 0;
				const timer = window.setTimeout(() => { setStore({ opMessage: null }); }, 5000);
				return () => window.clearTimeout(timer);
			}, [state.opMessage]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") {
						if (modal !== null) setModal(null);
						else if (filePath !== null) setFilePath(null);
						else if (detailHash !== null) setDetailHash(null);
						else onClose();
					}
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [modal, filePath, detailHash, onClose]);

			const snapshot = state.snapshot;
			const repo = snapshot?.repo === true;
			const loading = state.loading && !repo;
			const rows = mergeEntries(state.status?.entries);
			const hasWork = rows.some((row) => row.working);
			const hasStaged = rows.some((row) => row.staged);
			const clean = repo && rows.length === 0 && snapshot?.clean !== false;
			const tree = buildTree(rows);
			const selectedPaths = Object.keys(selected).filter((key) => key.startsWith("file:"))
				.map((key) => key.slice(5))
				.filter((path) => rows.some((row) => row.path === path));
			const selectedWork = selectedPaths.filter((path) => rows.some((row) => row.path === path && row.working));
			const selectedStaged = selectedPaths.filter((path) => rows.some((row) => row.path === path && row.staged && !row.working));
			(0, react.useEffect)(() => {
				const el = treeRef.current;
				if (el === null || el === void 0) return;
				if (autoCollapsed.current) return;
				if (el.scrollHeight > el.clientHeight + 8) {
					autoCollapsed.current = true;
					const next = {};
					for (const row of rows) {
						const parts = row.path.split(/[\\/]/);
						for (let i = 1; i < parts.length; i += 1) next[parts.slice(0, i).join("/")] = true;
					}
					setCollapsedDirs(next);
				}
			}, [rows.length]);
			const pickOne = (path, value) => {
				const key = `file:${path}`;
				setSelected((previous) => {
					if ((previous[key] === true) === value) return previous;
					const next = { ...previous };
					if (value) next[key] = true;
					else delete next[key];
					return next;
				});
			};
			const onRowDown = (path) => {
				const key = `file:${path}`;
				const value = selected[key] !== true;
				dragRef.current = { value };
				pickOne(path, value);
			};
			const onRowEnter = (path) => {
				const current = dragRef.current;
				if (current === null) return;
				pickOne(path, current.value);
			};
			const doAction = (method, args) => {
				git.run(method, cwd, args ?? {});
				setModal(null);
				setSelected({});
			};
			/** Double click / the 详细 button: expand THIS row and open the pane. */
			const openDetail = (hash) => {
				if (detailHash === hash) { setDetailHash(null); setFilePath(null); return; }
				setExpandedHash(hash);
				setDetailHash(hash);
				setFilePath(null);
				git.refreshDetail(cwd, hash);
			};
			/** Single click: switching rows closes the pane unless it is the same row. */
			const toggleRow = (hash) => {
				if (expandedHash === hash) {
					setExpandedHash(null);
					if (detailHash === hash) { setDetailHash(null); setFilePath(null); }
					return;
				}
				if (detailHash !== null && detailHash !== hash) { setDetailHash(null); setFilePath(null); }
				setExpandedHash(hash);
			};
			const branches = (state.branch?.branches ?? []).filter((name) => !/^remotes\//.test(name) && !/ -> HEAD/.test(name));
			const filesNow = rows.filter((row) => row.staged).map((row) => row.path);
			const opButton = (label, onClick, options = {}) => h("button", {
				type: "button",
				key: options.key ?? label,
				className: `dshg-op${options.danger ? " dshg-opDanger" : ""}${options.primary ? " dshg-opPrimary" : ""}${options.disabled ? " dshg-opDisabled" : ""}`,
				disabled: options.disabled === true,
				onClick,
				children: label
			});
			const ops = [];
			if (hasWork) {
				ops.push(opButton(
					selectedWork.length > 0 ? `加入暂存 (${selectedWork.length})` : "全部暂存",
					() => {
						git.run("add", cwd, { paths: selectedWork.length > 0 ? selectedWork : rows.filter((row) => row.working).map((row) => row.path) });
						setSelected({});
					},
					{ key: "stage", primary: true, disabled: state.working }
				));
			}
			if (selectedStaged.length > 0) {
				ops.push(opButton(
					`取消暂存 (${selectedStaged.length})`,
					() => { git.run("unstage", cwd, { paths: selectedStaged }); setSelected({}); },
					{ key: "unstage", disabled: state.working }
				));
			}
			if (selectedPaths.length > 0) {
				ops.push(opButton("选中提交", () => setModal({ kind: "commit", paths: selectedPaths }), { key: "commitSel", primary: true, disabled: state.working }));
			} else if (hasStaged) {
				ops.push(opButton("提交存档", () => setModal({ kind: "commit" }), { key: "commit", primary: true, disabled: state.working }));
			}
			if (hasStaged) {
				ops.push(opButton("新建分支", () => setModal({ kind: "createBranch" }), { key: "createBranch", disabled: state.working }));
				ops.push(opButton("切换分支", () => setModal({ kind: "switch" }), { key: "switch", disabled: state.working }));
				ops.push(opButton("合并分支", () => setModal({ kind: "merge" }), { key: "merge", disabled: state.working }));
			}
			if (hasWork) {
				ops.push(opButton("丢弃改动", () => setModal({ kind: "restore" }), { key: "restore", danger: true, disabled: state.working }));
			}
			const timeline = state.log?.commits ?? [];
			return hs("div", {
				className: "dshg-root",
				children: [
					h("div", { className: "dshg-overlay", onClick: onClose }),
					hs("div", {
						className: "dshg-drawer",
						role: "dialog",
						"aria-label": "Git 面板",
						children: [
							hs("div", {
								className: "dshg-header",
								children: [
									h(GitIcon, { size: 16 }),
									h("span", { className: "dshg-title", children: repo ? basename(snapshot?.root) : "Git 面板" }),
									repo ? h("span", {
										className: snapshot?.clean ? "dshg-badge dshg-badgeOk" : "dshg-badge dshg-badgeWarn",
										title: snapshot?.root ?? "",
										children: snapshot?.clean ? "干净" : `${Number(snapshot?.changes?.total) || 0} 处改动`
									}) : null,
									repo ? h("span", { className: "dshg-badge", children: snapshot?.branch ?? "" }) : null,
									h("button", {
										type: "button",
										className: "dshg-iconButton",
										title: "刷新",
										disabled: state.loading,
										onClick: () => { setExpandedHash(null); git.refresh(cwd); },
										children: h(RefreshIcon, {})
									}),
									h("button", { type: "button", className: "dshg-iconButton", title: "关闭", onClick: onClose, children: h(CloseIcon, {}) })
								]
							}),
							state.error !== null && state.error !== void 0 ? h("div", { className: "dshg-error", children: state.error }) : null,
							loading ? hs("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取 git 状态…"] }) : null,
							!loading && !repo ? hs("div", {
								className: "dshg-notRepo",
								children: [
									h("div", { className: "dshg-notRepoIcon", children: h(GitIcon, { size: 40 }) }),
									h("div", { className: "dshg-notRepoTitle", children: "这里还不是 git 仓库" }),
									h("div", { className: "dshg-notRepoDesc", children: "在当前工作区运行 git init 初始化后，就能在这里看到分支、提交历史和改动记录了" }),
									devMode === true ? h("div", { className: "dshg-notRepoDesc", children: `当前路径：${cwd}（来源：${source ?? "?"}，v${version ?? "?"}）` }) : null,
									devMode === true ? h("div", { className: "dshg-notRepoDesc", children: `诊断：${diag ?? "?"}` }) : null,
									h("button", { type: "button", className: "dshg-op dshg-opPrimary", disabled: state.working, onClick: () => setModal({ kind: "init" }), children: "初始化仓库" })
								]
							}) : null,
							repo && !loading ? hs(react.Fragment, {
								children: [
									ops.length > 0 ? h("div", { className: "dshg-opsBar", children: ops }) : null,
									state.opMessage !== null && state.opMessage !== void 0 ? h("div", {
										className: `dshg-opMsg ${state.opMessage.type === "ok" ? "dshg-opMsgOk" : "dshg-opMsgErr"}`,
										children: state.opMessage.text
									}) : null,
									hs("div", {
										className: "dshg-main",
										ref: mainRef,
										children: [
											clean ? hs("div", {
												className: "dshg-clean",
												children: [h("div", { className: "dshg-notRepoIcon", children: h(GitIcon, { size: 34 }) }), h("div", { className: "dshg-cleanText", children: "干净" })]
											}) : null,
											clean ? null : h(Safeguard, {
												fallback: (error) => h("div", {
													className: "dshg-error",
													children: `文件列表渲染出错：${error?.message ?? "unknown"}${error?.stack ? ` | ${String(error.stack).split("\n").slice(1, 4).join(" | ")}` : ""}`
												}),
												children: hs("div", {
													className: "dshg-tree",
													ref: treeRef,
													children: [
														tree.files.map((row) => h(FileRow, { key: row.path, row, level: 0, selected, onDown: onRowDown, onEnter: onRowEnter })),
														h(TreeNodes, {
															node: tree,
															level: 0,
															collapsed: collapsedDirs,
															selected,
															onToggle: (path) => setCollapsedDirs((previous) => ({ ...previous, [path]: !previous[path] })),
															onDown: onRowDown,
															onEnter: onRowEnter
														})
													]
												})
											}),
											h(Safeguard, {
												fallback: (error) => h("div", { className: "dshg-error", children: `时间线渲染出错：${error?.message ?? "unknown"}` }),
												children: h("div", {
													className: "dshg-timeline",
													children: timeline.length === 0
														? h("div", { className: "dshg-empty", children: "仓库还没有提交" })
														: timeline.map((commit, index) => h(CommitRow, {
															key: commit.hash,
															commit,
															index,
															expanded: expandedHash === commit.hash,
															detailOpen: detailHash === commit.hash,
															isFirst: index === timeline.length - 1,
															onToggle: () => toggleRow(commit.hash),
															onOpenDetail: openDetail,
															onAction: (kind, hash) => setModal({ kind, hash })
														}))
												})
											}),
											// The detail pane lives INSIDE the scrolling main column, so
											// opening it pushes content down and produces a real scrollbar
											// instead of floating over the list.
											h(Safeguard, {
												fallback: (error) => h("div", { className: "dshg-error", children: `详情渲染出错：${error?.message ?? "unknown"}` }),
												children: h(DetailPane, {
													open: detailHash !== null,
													detailHash,
													detail: state.detail,
													detailError: state.detailError,
													detailLoading: state.detailLoading,
													filePath,
													fileDiff: state.fileDiff,
													fileDiffError: state.fileDiffError,
													fileDiffLoading: state.fileDiffLoading,
													onClose: () => { setDetailHash(null); setFilePath(null); },
													onPickFile: (path) => {
														if (filePath === path) { setFilePath(null); return; }
														setFilePath(path);
														git.refreshFileDiff(cwd, detailHash, path);
													},
													onCloseFile: () => setFilePath(null)
												})
											})
										]
									}),
									devMode === true ? h("div", { className: "dshg-diag", title: diag, children: diag }) : null
								]
							}) : null,
							modal !== null ? h(ActionModal, {
								modal,
								t,
								doAction,
								commitMsg,
								setCommitMsg,
								mergeTarget,
								setMergeTarget,
								newBranchName,
								setNewBranchName,
								switchTarget,
								setSwitchTarget,
								currentBranch: snapshot?.branch ?? "",
								files: filesNow,
								branches,
								onClose: () => setModal(null)
							}) : null
						]
					})
				]
			});
		}

		/** Reusable confirm/modal for every git action. */
		function ActionModal({ modal, t, onClose, doAction, commitMsg, setCommitMsg, mergeTarget, setMergeTarget, newBranchName, setNewBranchName, switchTarget, setSwitchTarget, currentBranch, files, branches }) {
			const kind = modal.kind;
			const cancel = () => onClose();
			const inputCls = "dshg-input";
			const localBranches = branches.length ? branches.filter((name) => !/^remotes\//.test(name)) : branches;
			let title = "";
			let body = null;
			let confirmLabel = "";
			let danger = false;
			let onOk = () => {};
			if (kind === "init") {
				title = "初始化 git 仓库";
				body = h("div", { className: "dshg-modalDesc", children: "在当前工作区执行 git init。之后就能开始存档和回档了。" });
				confirmLabel = "初始化仓库";
				onOk = () => doAction("init", {});
			} else if (kind === "createBranch") {
				title = "新建分支";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: "从当前 HEAD 创建一个新分支：" }),
						h("input", {
							className: inputCls,
							value: newBranchName,
							placeholder: "输入新分支名",
							onChange: (event) => setNewBranchName(event.target.value),
							autoFocus: true
						})
					]
				});
				confirmLabel = "新建分支";
				onOk = () => doAction("createBranch", { name: newBranchName.trim() });
			} else if (kind === "switch") {
				title = "切换分支";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: "选择要切换到的本地分支（切换后工作区将更新为该分支内容）：" }),
						h("select", {
							className: inputCls,
							value: switchTarget,
							onChange: (event) => setSwitchTarget(event.target.value),
							children: [
								h("option", { key: "", value: "", disabled: true, children: "选择分支" }),
								localBranches.map((name) => h("option", { value: name, children: name === currentBranch ? `${name}（当前）` : name }, name))
							]
						})
					]
				});
				confirmLabel = "切换分支";
				onOk = () => doAction("checkout", { target: switchTarget.trim() });
			} else if (kind === "commit") {
				const picked = Array.isArray(modal.paths) ? modal.paths : [];
				title = picked.length > 0 ? "选中提交" : "提交存档";
				body = hs(react.Fragment, {
					children: [
						h("div", {
							className: "dshg-modalDesc",
							children: picked.length > 0
								? `提交选中的 ${picked.length} 个文件（未暂存的会自动暂存后一起提交）：`
								: "提交暂存区中的所有文件（未暂存的内容不会进入这次提交）："
						}),
						h("input", {
							className: inputCls,
							value: commitMsg,
							placeholder: "输入提交说明（必填）",
							onChange: (event) => setCommitMsg(event.target.value),
							autoFocus: true
						}),
						(picked.length > 0 ? picked : files).length > 0
							? h("div", {
								className: "dshg-modalList",
								children: (picked.length > 0 ? picked : files).slice(0, 40).map((path, index) => h("span", { key: index, children: path }))
							})
							: h("div", { className: "dshg-modalDesc", children: "没有可提交的文件" })
					]
				});
				confirmLabel = picked.length > 0 ? "选中提交" : "提交存档";
				onOk = () => doAction("commit", picked.length > 0
					? { message: commitMsg.trim(), paths: picked }
					: { message: commitMsg.trim(), stagedOnly: true });
			} else if (kind === "merge") {
				title = "合并分支";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: "选择要合并进当前分支的目标分支：" }),
						h("select", {
							className: inputCls,
							value: mergeTarget,
							onChange: (event) => setMergeTarget(event.target.value),
							children: [
								h("option", { key: "", value: "", disabled: true, children: "选择目标分支" }),
								branches.map((name) => h("option", { value: name, children: name }, name))
							]
						})
					]
				});
				confirmLabel = "合并分支";
				onOk = () => doAction("merge", { target: mergeTarget.trim() });
			} else if (kind === "checkout") {
				title = "回退到此提交";
				body = h("div", { className: "dshg-modalDesc", children: `工作区将切换到 ${String(modal.hash).slice(0, 8)}。未提交改动若冲突会被 git 阻止，不会丢失。` });
				confirmLabel = "回退到此";
				onOk = () => doAction("checkout", { target: modal.hash });
			} else if (kind === "revert") {
				title = "还原提交";
				body = h("div", { className: "dshg-modalDesc", children: `为 ${String(modal.hash).slice(0, 8)} 生成一个反向提交，撤销那次改动但保留完整历史（推荐的安全做法）。` });
				confirmLabel = "还原提交";
				onOk = () => doAction("revert", { commit: modal.hash });
			} else if (kind === "reset") {
				title = "强制回退";
				body = h("div", { className: "dshg-modalDesc", children: `危险操作：把分支指针直接强制移到 ${String(modal.hash).slice(0, 8)}，之后的提交与改动都会消失（仅限本地未推送时）。确定继续？` });
				confirmLabel = "强制回退";
				danger = true;
				onOk = () => doAction("reset", { commit: modal.hash });
			} else if (kind === "restore") {
				title = "丢弃未提交改动";
				body = h("div", { className: "dshg-modalDesc", children: "危险操作：将丢弃当前所有未暂存的工作区改动（无法恢复）。确定继续？" });
				confirmLabel = "丢弃改动";
				danger = true;
				onOk = () => doAction("restore", {});
			}
			return hs("div", {
				className: "dshg-modal",
				children: hs("div", {
					className: "dshg-modalCard",
					children: [
						h("div", { className: "dshg-modalTitle", children: title }),
						body,
						hs("div", {
							className: "dshg-modalActions",
							children: [
								h("button", { type: "button", className: "dshg-op", onClick: cancel, children: "取消" }),
								h("button", {
									type: "button",
									className: `dshg-op${danger ? " dshg-opDanger" : " dshg-opPrimary"}`,
									onClick: onOk,
									children: confirmLabel
								})
							]
						})
					]
				})
			});
		}
		//#endregion

		//#region locales
		const zh = {
			"action.aria": "Git 面板",
			"action.title": "Git 可视化面板",
			"action.refresh": "刷新",
			"action.close": "关闭",
			"action.branch.unknown": "git",
			"panel.aria": "Git 可视化面板",
			"panel.title": "Git 面板",
			"state.clean": "干净",
			"state.changes": "处改动",
			"state.staged": "已暂存",
			"state.unstaged": "未暂存",
			"state.untracked": "未跟踪",
			"state.loading": "读取 git 状态…",
			"state.notRepo": "当前工作区不是 git 仓库：{path}",
			"state.noCommits": "仓库还没有提交",
			"state.noFiles": "此提交没有文件变更",
			"state.merge": "合并",
			"state.truncated": "（补丁过大已截断）",
			"state.notRepoTitle": "这里还不是 git 仓库",
			"state.notRepoDesc": "在当前工作区运行 git init 初始化后，就能在这里看到分支、提交历史和改动记录了",
			"state.selectHint": "点击上方时间线中的提交，这里会显示它改动了哪些文件",
			"state.root": "（根目录）",
			"state.noChanges": "没有待提交的改动",
			"action.cancel": "取消",
			"op.init": "初始化仓库",
			"op.commit": "提交存档",
			"op.merge": "合并分支",
			"op.restore": "丢弃改动",
			"op.checkoutHere": "回退到此",
			"op.revert": "还原提交",
			"op.reset": "强制回退",
			"op.createBranch": "新建分支",
			"op.switch": "切换分支",
			"modal.createBranch.title": "新建分支",
			"modal.createBranch.desc": "从当前 HEAD 创建一个新分支：",
			"modal.createBranch.placeholder": "输入新分支名",
			"modal.switch.title": "切换分支",
			"modal.switch.desc": "选择要切换到的本地分支（切换后工作区将更新为该分支内容）：",
			"modal.switch.placeholder": "选择分支",
			"modal.init.title": "初始化 git 仓库",
			"modal.init.desc": "在当前工作区执行 git init。之后就能开始存档和回档了。",
			"modal.commit.title": "提交存档",
			"modal.commit.desc": "将暂存全部改动并创建一次提交（包含以下文件）：",
			"modal.commit.placeholder": "输入提交说明（必填）",
			"modal.merge.title": "合并分支",
			"modal.merge.desc": "选择要合并进当前分支的目标分支：",
			"modal.merge.placeholder": "选择目标分支",
			"modal.checkout.title": "回退到此提交",
			"modal.checkout.desc": "工作区将切换到 {target}。未提交改动若冲突会被 git 阻止，不会丢失。",
			"modal.revert.title": "还原提交",
			"modal.revert.desc": "为 {target} 生成一个反向提交，撤销那次改动但保留完整历史（推荐的安全做法）。",
			"modal.reset.title": "强制回退",
			"modal.reset.desc": "危险操作：把分支指针直接强制移到 {target}，之后的提交与改动都会消失（仅限本地未推送时）。确定继续？",
			"modal.restore.title": "丢弃未提交改动",
			"modal.restore.desc": "危险操作：将丢弃当前所有未提交的改动（无法恢复）。确定继续？",
			"section.status": "工作区状态",
			"section.commits": "提交历史",
			"section.diff": "提交差异",
			"time.now": "刚刚",
			"time.minutes": "{n}分钟前",
			"time.hours": "{n}小时前",
			"time.days": "{n}天前"
		};
		const en = {
			"action.aria": "Git panel",
			"action.title": "Git visualizer",
			"action.refresh": "Refresh",
			"action.close": "Close",
			"action.branch.unknown": "git",
			"panel.aria": "Git visualizer",
			"panel.title": "Git",
			"state.clean": "clean",
			"state.changes": "changes",
			"state.staged": "staged",
			"state.unstaged": "unstaged",
			"state.untracked": "untracked",
			"state.loading": "Reading git state…",
			"state.notRepo": "This workspace is not a git repository: {path}",
			"state.noCommits": "No commits yet",
			"state.noFiles": "No file changes in this commit",
			"state.merge": "merge",
			"state.truncated": "(patch truncated)",
			"state.notRepoTitle": "Not a git repository yet",
			"state.notRepoDesc": "Run git init in this workspace to see branches, history and changes here",
			"state.selectHint": "Select a commit above to see what it changed",
			"state.root": "(root)",
			"state.noChanges": "Nothing to commit",
			"action.cancel": "Cancel",
			"op.init": "Init repo",
			"op.commit": "Commit",
			"op.merge": "Merge",
			"op.restore": "Discard changes",
			"op.checkoutHere": "Checkout here",
			"op.revert": "Revert",
			"op.reset": "Force reset",
			"op.createBranch": "New branch",
			"op.switch": "Switch branch",
			"modal.createBranch.title": "New branch",
			"modal.createBranch.desc": "Create a branch from the current HEAD:",
			"modal.createBranch.placeholder": "Branch name",
			"modal.switch.title": "Switch branch",
			"modal.switch.desc": "Pick a local branch to switch to (working tree updates to that branch):",
			"modal.switch.placeholder": "Select branch",
			"modal.init.title": "Initialize git repository",
			"modal.init.desc": "Runs git init in this workspace so you can start committing and rolling back.",
			"modal.commit.title": "Commit changes",
			"modal.commit.desc": "Stage all changes and create one commit (includes):",
			"modal.commit.placeholder": "Commit message (required)",
			"modal.merge.title": "Merge branch",
			"modal.merge.desc": "Pick the branch to merge into the current one:",
			"modal.merge.placeholder": "Select target branch",
			"modal.checkout.title": "Checkout this commit",
			"modal.checkout.desc": "Switch the workspace to {target}. Conflicting uncommitted changes are blocked by git, not lost.",
			"modal.revert.title": "Revert this commit",
			"modal.revert.desc": "Create an inverse commit for {target} (keeps history — the safe rollback).",
			"modal.reset.title": "Hard reset",
			"modal.reset.desc": "DANGER: hard-resets HEAD to {target} and discards everything after (local & unpushed only). Continue?",
			"modal.restore.title": "Discard uncommitted changes",
			"modal.restore.desc": "DANGER: discards all current uncommitted changes (not recoverable). Continue?",
			"section.status": "Working tree",
			"section.commits": "History",
			"section.diff": "Commit diff",
			"time.now": "just now",
			"time.minutes": "{n}m ago",
			"time.hours": "{n}h ago",
			"time.days": "{n}d ago"
		};
		//#endregion

		//#region plugin body
		const NS = "git";
		/** One-line shape of an unknown value — diagnostics only. */
		// "remote.git" is injected here because cordis resolves nested service
		// access through ctx (ctx.remote.git -> ctx.get("remote.git")), which the
		// injection guard enforces. The namespace is mounted by the separate
		// @dsh-external/dsh-client-git-remote plugin before this one activates.
		const inject = ["slots", "locale", "remote", "remote.git"];
		// DSH 0.2.1 removed the shared `@deepseek-ai/dsh-client-ui-primitives`
		// package from the browser module table (a client half may no longer load
		// another Harness Client package as a module, so that `require` now
		// throws). The one glyph this entry needs is inlined instead of shipped
		// as an optional dependency.
		function BranchGlyph({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					react_jsx_runtime.jsx("circle", { cx: 4.5, cy: 3.5, r: 1.6 }),
					react_jsx_runtime.jsx("circle", { cx: 4.5, cy: 12.5, r: 1.6 }),
					react_jsx_runtime.jsx("circle", { cx: 11.5, cy: 5.2, r: 1.6 }),
					react_jsx_runtime.jsx("path", { d: "M4.5 5.1v5.8M6.1 9.4h2.4a3 3 0 0 0 3-3V6.8" })
				]
			});
		}
		// Sidebar entry, rewritten for DSH 0.2.0 in the same shape as the working
		// usage-stats entry: a small self-contained component (local state, its own
		// hook, no DOM walking, no portals).
		// Mounts the real panel over the sidebar when the entry is open. The panel
		// keeps the bundle's own styles (the CSS layer registers on import) and is
		// positioned by `.dshg-overlay` (position:fixed), so no portal and no DOM
		// walking are needed — both of which the 0.2.0 renderer dislikes.
		function GitPanelHost({ cwd, t, onClose, source, version, diag, devMode }) {
			const [barHeight, setBarHeight] = react.useState(0);
			// GitPanel's mount effect depends on this object, so a fresh instance
			// per render would re-run the refresh on EVERY render. Keep one stable
			// instance for the mount.
			const gitApi = (0, react.useRef)(null);
			if (gitApi.current === null) {
				gitApi.current = {
					refresh: (target) => refreshAll(ctxRef, target),
					refreshDetail: (target, hash) => refreshDetail(ctxRef, target, hash),
					refreshFileDiff: (target, hash, path) => refreshFileDiff(ctxRef, target, hash, path),
					run: (method, target, args) => runAction(ctxRef, target, method, args ?? {})
				};
			}
			// Start the drawer BELOW the shell's window bar so the three window
			// buttons stay on their own surface instead of floating over the panel.
			// The bar is the frame's `::before` band, so it is measured at runtime
			// (its height differs between platforms) and exposed as a variable the
			// stylesheet can use; a failed measurement falls back to the CSS default.
			react.useLayoutEffect(() => {
				try {
					const frame = document.querySelector("[class*='frame']");
					const bar = frame === null ? null : getComputedStyle(frame, "::before");
					const measured = bar === null ? 0 : Number.parseFloat(bar.height);
					if (Number.isFinite(measured) && measured > 0) setBarHeight(Math.round(measured));
				} catch (_) { /* keep the stylesheet default */ }
			}, []);
			return react_jsx_runtime.jsx("div", {
				className: "dshg-overlay",
				style: barHeight > 0 ? { "--dshg-bar-height": `${barHeight}px` } : void 0,
				onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
				children: react_jsx_runtime.jsx(GitPanel, {
					cwd,
					t,
					onClose,
					source,
					version,
					diag,
					devMode: devMode === true,
					git: gitApi.current
				})
			});
		}
		let ctxRef = null;
		// The slot runtime used to bind `t` through a registered locale namespace;
		// this simplified entry no longer registers one, so bind the panel's own
		// dictionary here. `{name}` placeholders are interpolated.
		function translate(key, params) {
			const raw = zh?.[key] ?? en?.[key] ?? key;
			if (params === void 0 || params === null) return raw;
			return String(raw).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
				params[name] === void 0 || params[name] === null ? match : String(params[name]));
		}
		/**
		 * Sidebar entry. The workspace shown is resolved, in order, from:
		 *   1. the sidebar's selected conversation row (DOM) — authoritative,
		 *      because this build never exposes that selection through feeds;
		 *   2. DSH's own recent workspace;
		 *   3. the live selection cell / freshest session row;
		 *   4. the workspace that owns the freshest session.
		 * Feeds are kept as fallbacks: the DOM row can vanish for a frame while
		 * the list re-renders.
		 */
		function GitFooterEntry(props) {
			const { wide, useSessions, useWorkspaces } = props;
			const PANEL_VERSION = "0.1.4";
			const [open, setOpen] = (0, react.useState)(false);
			// The sidebar row is the only place the selected conversation shows up:
			// [data-row-key="session:<id>"][aria-selected="true"].
			const [domSessionId, setDomSessionId] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (typeof document === "undefined") return void 0;
				const read = () => {
					let node = null;
					try {
						node = document.querySelector('[data-row-key^="session:"][aria-selected="true"]');
					} catch (error) {
						node = null;
					}
					if (node === null || node === void 0) return;
					const key = typeof node.getAttribute === "function" ? node.getAttribute("data-row-key") : null;
					if (typeof key !== "string" || key.length === 0) return;
					const raw = key.startsWith("session:") ? key.slice(8) : key;
					setDomSessionId((previous) => (previous === raw ? previous : raw));
				};
				read();
				if (typeof MutationObserver !== "function") return void 0;
				const observer = new MutationObserver(read);
				try {
					observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected", "data-row-key"] });
				} catch (error) {
					return void 0;
				}
				return () => observer.disconnect();
			}, []);
			const state = (0, react.useSyncExternalStore)(storeFace().subscribe, storeFace().getSnapshot);
			const useSessionsSafe = typeof useSessions === "function" ? useSessions : () => void 0;
			const useWorkspacesSafe = typeof useWorkspaces === "function" ? useWorkspaces : () => void 0;
			const currentSessionId = useSessionsSafe((list) => (typeof list?.current === "string" ? list.current : void 0));
			const sessionCount = useSessionsSafe((list) => (Array.isArray(list?.ids) ? list.ids.length : Array.isArray(list?.items) ? list.items.length : -1));
			const workspaceCount = useWorkspacesSafe((list) => (Array.isArray(list?.items) ? list.items.length : -1));
			const latestSessionId = useSessionsSafe((list) => {
				const ids = Array.isArray(list?.ids) ? list.ids : [];
				if (ids.length > 0 && typeof ids[0] === "string") return ids[0];
				const byId = list?.byId;
				if (byId === null || byId === void 0 || typeof byId !== "object") return void 0;
				let bestStamp = -1;
				let bestId;
				for (const id of Object.keys(byId)) {
					const row = byId[id];
					if (row === void 0 || row === null) continue;
					const stamp = Number(row.updatedAt) || 0;
					if (stamp >= bestStamp) {
						bestStamp = stamp;
						bestId = id;
					}
				}
				return bestId;
			});
			const domSessionCwd = useSessionsSafe((list) => {
				if (typeof domSessionId !== "string" || domSessionId.length === 0) return void 0;
				const byId = list?.byId;
				if (byId === null || byId === void 0 || typeof byId !== "object") return void 0;
				const bare = domSessionId.replace(/^session-/, "");
				const candidates = [domSessionId, bare, `session-${bare}`];
				for (const key of candidates) {
					const row = byId[key];
					if (row !== null && row !== void 0 && typeof row.cwd === "string" && row.cwd.length > 0) return row.cwd;
				}
				return void 0;
			});
			const latestSessionCwd = useSessionsSafe((list) => {
				const rows = [];
				const byId = list?.byId;
				if (byId !== null && byId !== void 0 && typeof byId === "object") {
					for (const id of Object.keys(byId)) if (byId[id] !== void 0 && byId[id] !== null) rows.push(byId[id]);
				}
				if (Array.isArray(list?.items)) {
					for (const row of list.items) if (row !== void 0 && row !== null) rows.push(row);
				}
				let bestStamp = -1;
				let bestCwd;
				for (const row of rows) {
					if (typeof row.cwd !== "string" || row.cwd.length === 0) continue;
					const stamp = Number(row.updatedAt ?? row.createdAt ?? row.lastActiveAt) || 0;
					if (stamp >= bestStamp) {
						bestStamp = stamp;
						bestCwd = row.cwd;
					}
				}
				return bestCwd;
			});
			const sessionCwd = useSessionsSafe((list) => {
				const current = list?.current;
				if (typeof current !== "string") return void 0;
				const row = list?.byId?.[current];
				if (row !== void 0 && row !== null && typeof row.cwd === "string" && row.cwd.length > 0) return row.cwd;
				const items = Array.isArray(list?.items) ? list.items : [];
				const found = items.find((item) => item?.id === current || item?.sessionId === current);
				return typeof found?.cwd === "string" && found.cwd.length > 0 ? found.cwd : void 0;
			});
			const ownedWorkspaceCwd = useWorkspacesSafe((list) => {
				const items = Array.isArray(list?.items) ? list.items : [];
				if (items.length === 0 || typeof currentSessionId !== "string") return void 0;
				const owner = items.find((item) => Array.isArray(item?.sessionIds) && item.sessionIds.includes(currentSessionId));
				return typeof owner?.path === "string" && owner.path.length > 0 ? owner.path : void 0;
			});
			const workspaceCwd = useWorkspacesSafe((list) => {
				const items = Array.isArray(list?.items) ? list.items : [];
				if (items.length === 0) return void 0;
				const recentId = list?.recentWorkspaceId;
				// Only a real id: falling back to items[0] used to pin the panel to
				// the first workspace (often a non-repo) after a switch.
				if (typeof recentId !== "string") return void 0;
				const picked = items.find((item) => item?.workspaceId === recentId || item?.id === recentId);
				return typeof picked?.path === "string" && picked.path.length > 0 ? picked.path : void 0;
			});
			const latestOwnedWorkspaceCwd = useWorkspacesSafe((list) => {
				const items = Array.isArray(list?.items) ? list.items : [];
				if (items.length === 0 || typeof latestSessionId !== "string") return void 0;
				const owner = items.find((item) => Array.isArray(item?.sessionIds) && item.sessionIds.includes(latestSessionId));
				return typeof owner?.path === "string" && owner.path.length > 0 ? owner.path : void 0;
			});
			const resolvedCwd = typeof domSessionCwd === "string"
				? domSessionCwd
				: typeof workspaceCwd === "string"
					? workspaceCwd
					: typeof sessionCwd === "string"
						? sessionCwd
						: typeof latestSessionCwd === "string"
							? latestSessionCwd
							: typeof latestOwnedWorkspaceCwd === "string"
								? latestOwnedWorkspaceCwd
								: ownedWorkspaceCwd;
			// The feeds can blink empty while the store republishes; keeping the last
			// path prevents the slot entry from unmounting (which is permanent).
			const cwdCache = (0, react.useRef)(null);
			if (typeof resolvedCwd === "string" && resolvedCwd.length > 0) cwdCache.current = resolvedCwd;
			const cwd = typeof resolvedCwd === "string" && resolvedCwd.length > 0 ? resolvedCwd : cwdCache.current;
			const cwdSource = typeof domSessionCwd === "string"
				? "dom-selection"
				: typeof workspaceCwd === "string"
					? "recent-workspace"
					: typeof sessionCwd === "string"
						? "session"
						: typeof latestSessionCwd === "string"
							? "active-session"
							: typeof latestOwnedWorkspaceCwd === "string"
								? "active-workspace"
								: typeof ownedWorkspaceCwd === "string" ? "workspace" : "none";
			const diag = `source=${cwdSource} · cwd=${typeof cwd === "string" ? cwd : "none"} · domSid=${typeof domSessionId === "string" ? domSessionId.slice(-8) : "none"} · domCwd=${typeof domSessionCwd === "string" ? domSessionCwd : "none"} · ids0Cwd=${typeof latestSessionCwd === "string" ? latestSessionCwd : "none"} · recent=${typeof workspaceCwd === "string" ? workspaceCwd : "none"} · sessions=${sessionCount} · ws=${workspaceCount}`;
			(0, react.useEffect)(() => {
				if (typeof cwd !== "string" || cwd.length === 0) return;
				if (ctxRef === null) return;
				refreshAll(ctxRef, cwd);
			}, [cwd]);
			if (typeof cwd !== "string" || cwd.length === 0) {
				return react_jsx_runtime.jsx("button", {
					type: "button",
					className: wide === true ? "dshg-footerLabel" : "dshg-footerBtn",
					title: "Git 面板：当前没有可用的工作区",
					"aria-label": "Git 面板",
					disabled: true,
					children: react_jsx_runtime.jsx(BranchGlyph, { size: wide === true ? 14 : 16 })
				});
			}
			// Only trust a snapshot produced for THIS workspace; a stale one would
			// mislabel the branch (or the dirty count) right after a switch.
			const fresh = state.cwd === cwd ? state.snapshot : null;
			const isRepo = fresh?.repo === true;
			const branch = isRepo && typeof fresh.branch === "string" && fresh.branch.length > 0 ? fresh.branch : void 0;
			const count = isRepo && fresh.clean === false ? Number(fresh.changes?.total) || 0 : 0;
			const title = branch === void 0
				? `Git 面板 v${PANEL_VERSION}（${cwdSource}）：${cwd}`
				: `Git 面板 v${PANEL_VERSION}（${cwdSource}）：${cwd} — ${branch}${count > 0 ? `，${count} 处改动` : ""}`;
			const glyph = react_jsx_runtime.jsx(BranchGlyph, { size: wide === true ? 14 : 16 });
			// Wide row: the count sits on the right, in line with the branch name.
			const inlineCount = count > 0 ? react_jsx_runtime.jsx("span", {
				className: "dshg-footerCount",
				children: count > 99 ? "99+" : count
			}) : null;
			// Rail: no room for a row, keep the corner badge.
			const cornerBadge = count > 0 ? react_jsx_runtime.jsx("span", {
				className: "dshg-footerBadge",
				children: count > 99 ? "99+" : count
			}) : null;
			const button = wide === true
				? react_jsx_runtime.jsxs("button", {
					type: "button",
					className: "dshg-footerLabel",
					title,
					onClick: () => setOpen((value) => !value),
					children: [glyph, react_jsx_runtime.jsx("span", { className: "dshg-footerBranch", children: branch ?? "git" }), inlineCount]
				})
				: react_jsx_runtime.jsxs("button", {
					type: "button",
					className: "dshg-footerBtn",
					title,
					"aria-label": "Git 面板",
					onClick: () => setOpen((value) => !value),
					children: [glyph, cornerBadge]
				});
			if (!open) return button;
			// The drawer is wrapped in an error boundary: a crash inside the panel
			// must degrade to a visible button, never unmount the sidebar entry
			// (DSH's SlotErrorBoundary would abdicate the slot permanently).
			const fallback = react_jsx_runtime.jsxs("button", {
				type: "button",
				className: "dshg-footerBtn",
				title: `Git 面板渲染出错：${state.clientError ?? "unknown"}`,
				"aria-label": "Git 面板（渲染出错）",
				onClick: () => setOpen(true),
				children: [react_jsx_runtime.jsx(BranchGlyph, { size: 16 }), react_jsx_runtime.jsx("span", { className: "dshg-footerBadge", children: "!" })]
			});
			return react_jsx_runtime.jsx(Safeguard, {
				fallback,
				children: react_jsx_runtime.jsxs(react.Fragment, {
					children: [button, react_jsx_runtime.jsx(GitPanelHost, {
						cwd,
						t: translate,
						source: cwdSource,
						version: PANEL_VERSION,
						diag,
						devMode: state.devMode === true,
						onClose: () => setOpen(false)
					})]
				})
			});
		}

		function apply(ctx) {
			ctxRef = ctx;
			// Dev-mode switch, reserved for the future settings panel:
			//   window.__dshGitDev.set(true)  /  window.__dshGitDev.get()
			try {
				if (typeof window !== "undefined") {
					window.__dshGitDev = {
						set: setDevMode,
						get: () => store.devMode === true
					};
				}
			} catch (error) {
				// A locked-down window object must not break activation.
			}
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "git-panel",
				order: 5
			}, GitFooterEntry));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
