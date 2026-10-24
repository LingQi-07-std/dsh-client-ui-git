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
			".dshg-refs{display:flex;gap:4px;flex-wrap:wrap;max-height:0;margin-top:0;overflow:hidden;transition:max-height .22s var(--ds-ease-in-out,ease-out),margin-top .22s var(--ds-ease-in-out,ease-out)}",
			".dshg-refsShow{max-height:96px;margin-top:3px}",
			".dshg-ref{font-size:10px;line-height:16px;padding:0 5px;border-radius:4px;background:var(--dsw-alias-fill-l2);color:var(--dshg-sub);font-family:var(--dsw-font-mono,monospace);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
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
			".dshg-timeline{display:flex;flex-direction:column;gap:4px;flex:none;padding-top:0}",
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
			// Extra left padding gives the branch arrow room to sit outside the dot without
			// being clipped by the scrolling container's edge.
			".dshg-timeline{position:relative;display:flex;flex-direction:column;gap:4px;flex:none;padding:2px 0 2px 28px}",
			".dshg-timeline::before{content:'';position:absolute;left:9px;top:8px;bottom:8px;width:2px;background:var(--dshg-border);border-radius:1px}",
			".dshg-commit{position:relative;display:flex;flex-direction:column;border:1px solid transparent;border-radius:10px;overflow:hidden;transition:border-color .15s var(--ds-ease-in-out,ease-out),background .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-commit:hover{background:var(--dshg-hover)}",
			".dshg-commitOpen{border-color:var(--dshg-border);background:var(--dsw-alias-fill-l2)}",
			".dshg-nodeWrap{position:absolute;left:-20px;top:10px;width:20px;display:flex;justify-content:center;pointer-events:none}",
			".dshg-node{width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:2px solid var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;transition:box-shadow .15s var(--ds-ease-in-out,ease-out)}",
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
			// Collapsed: single line + ellipsis + marquee. Expanded: multi-line, but the
			// switch happens through max-height so the row never jumps.
			".dshg-commitSubject{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-height:1.45em;transition:max-height .22s var(--ds-ease-in-out,ease-out)}",
			".dshg-commitSubjectOpen{white-space:normal;overflow:hidden;text-overflow:clip;max-height:12em}",
			// Keep the subject on ONE line during the expand animation; it switches to
			// multi-line once the row has finished growing (see `wrapped` in CommitRow).
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
			// --- readable diff body: line numbers, no git plumbing headers ---
			".dshg-patchLines{font-family:var(--dsw-font-mono,monospace);font-size:11px;line-height:16px}",
			".dshg-pl{display:flex;gap:4px;align-items:flex-start}",
			".dshg-ln{flex:none;text-align:right;color:var(--dshg-muted);font-size:10px;user-select:none;padding-right:2px}",
			".dshg-sign{flex:none;width:8px;text-align:center;user-select:none}",
			".dshg-code{flex:1;min-width:0;white-space:pre-wrap;word-break:break-all}",
			".dshg-hunkRow{color:var(--dshg-muted);font-size:10px;padding:4px 0 2px;margin-top:4px;border-top:1px dashed var(--dshg-border);user-select:none}",
			// --- diff rows: tinted background, side bar, coloured numbers, Prism tokens ---
			".dshg-add{background:color-mix(in srgb,#2ea043 14%,transparent);box-shadow:inset 2px 0 0 #2ea043}",
			".dshg-del{background:color-mix(in srgb,#d73a49 14%,transparent);box-shadow:inset 2px 0 0 #d73a49}",
			".dshg-add .dshg-ln{color:#2ea043}",
			".dshg-del .dshg-ln{color:#d73a49}",
			".dshg-patchLines .token.comment{color:#8a9aa8;font-style:italic}",
			".dshg-patchLines .token.string{color:#4f9ad6}",
			".dshg-patchLines .token.keyword{color:#a875d8}",
			".dshg-patchLines .token.number{color:#d08a45}",
			".dshg-patchLines .token.function{color:#3f9d9d}",
			".dshg-patchLines .token.operator,.dshg-patchLines .token.punctuation{color:var(--dshg-sub)}",
			// --- working-tree file preview popup ---
			".dshg-previewCard{width:min(920px,94vw);max-height:78vh;display:flex;flex-direction:column}",
			".dshg-previewHead{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dshg-border)}",
			".dshg-previewTitle{flex:1;min-width:0;font-size:12px;font-family:var(--dsw-font-mono,monospace);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dshg-text)}",
			".dshg-detailWork{flex:none;min-height:0;overflow:auto;padding:8px 10px}",
			// --- animate the pane height across mode switches ---
			".dshg-detail{display:block;height:0;overflow:hidden;transition:height .22s var(--ds-ease-in-out,ease-out)}",
			// --- pane expansion: plain max-height (no grid/flex dependence) ---
			".dshg-detail{position:static;flex:none;margin:0 10px 10px;border-radius:12px}",
			// Soft drop shadow instead of a hard edge: the pane floats above the
			// drawer background inside that margin.
			".dshg-detailOpen{box-shadow:0 6px 20px rgba(0,0,0,.14),0 1px 4px rgba(0,0,0,.08)}",
			".dshg-detail{display:block;grid-template-rows:none;max-height:0;overflow:hidden;transition:max-height .22s var(--ds-ease-in-out,ease-out)}",
			// Height is pinned/transitioned by JS across content swaps; the open cap
			// keeps the pane at the same share of the column as the commit pane.
			".dshg-detail{transition:max-height .22s var(--ds-ease-in-out,ease-out),height .22s var(--ds-ease-in-out,ease-out)}",
			// It is a flex child of the scrolling column: without `flex:none` the
			// column squeezes it back down to a couple of rows.
			".dshg-detail{flex:none}",
			".dshg-detailOpen{max-height:56vh;overflow:auto}",
			".dshg-detailWork{max-height:100%;overflow:auto}",
			// Grid-era height rules must not win over the max-height scheme.
			".dshg-detail{height:auto}",
			// --- plain diff text keeps the theme colour; only the sign/number is tinted ---
			".dshg-pl{padding-left:6px}",
			".dshg-add,.dshg-del{color:var(--dshg-text)}",
			".dshg-add .dshg-sign{color:#2ea043}",
			".dshg-del .dshg-sign{color:#d73a49}",
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
			".dshg-fileDiffClosed{display:none}",
			// Fixed height: the patch box must NOT resize when its content loads,
			// otherwise the pane's animated height gets bumped mid-transition.
			".dshg-fileDiff{height:280px;overflow:auto}",
			".dshg-marquee{animation:none;text-overflow:clip}",
			// --- sticky rounded detail pane, stable graph gutter, first-commit chip (2026-10-21 r7) ---
			".dshg-detail{position:sticky;bottom:0;border-radius:12px;border:1px solid transparent;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));box-shadow:0 -8px 24px rgba(0,0,0,.18);z-index:2;margin-top:6px}",
			".dshg-detailOpen{border-color:var(--dshg-border)}",
			".dshg-commit{border:1px solid transparent}",
			".dshg-commitOpen{border-color:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 45%,transparent)}",
			// --- seamless graph, natural detail height, stable gutter (2026-10-21 r8) ---
			".dshg-commit::before{top:-1px;bottom:-1px}",
			".dshg-commit:first-child::before{top:14px}",
			// The newest row's dot sits at the very top of the rail — whichever kind of row
			// it is (commit, branch-created card, merge card).
			".dshg-timeline > :first-child .dshg-nodeWrap{top:4px}",
			".dshg-timeline > :first-child::before{top:14px}",
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
			// --- panel edges readable in BOTH themes (2026-10-21 r12) ---
			// Mixing the THEME TEXT colour lifts the surface in dark mode and sinks
			// it in light mode, so the boundary shows without any hard border. The
			// shadow is centred (no offset) so it spreads on ALL sides.
			".dshg-detail{background:transparent;box-shadow:none}",
			".dshg-detailOpen{background:color-mix(in srgb,var(--dshg-text) 5%,var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2)));box-shadow:0 0 12px 1px rgba(0,0,0,.16),0 0 34px 6px rgba(0,0,0,.10)}",
			".dshg-fileDiff{background:color-mix(in srgb,var(--dshg-text) 10%,var(--dsw-alias-bg-layer-1));padding:8px 8px}",
			// --- AUTHORITATIVE detail-pane rules. MUST stay LAST in this array. ---
			// Earlier batches (r2..r12) redefine .dshg-detail many times; the r6 batch
			// sets `display:grid; grid-template-rows:0fr; max-height:none`, which
			// silently overrode every max-height attempt and made the pane grow to
			// the full column. These final rules win on source order.
			".dshg-detail{display:block;grid-template-rows:none;height:0;max-height:none;overflow:hidden;flex:none;transition:none}",
			// Height is driven entirely by the WAAPI animation (inline px while it
			// runs, settled exact px afterwards); max-height must not cap it, and the
			// old max-height cap rules below are neutralised on purpose.
			".dshg-detailOpen{max-height:none;overflow:auto}",
			".dshg-detailOpen{max-height:none;overflow:auto}",
			".dshg-detailOpen{max-height:none;overflow:auto}",
			// The header stays pinned while the patch scrolls under it.
			".dshg-detailHead{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--dshg-text) 5%,var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2)))}",
			// `sticky` only works if no ancestor clips: the inner wrapper used to set
			// overflow:hidden, which silently disabled the pinned header.
			".dshg-detailInner{overflow:visible}",
			// Absolutely no stroke on the pane or its inner wrapper; the only depth cue
			// is the (soft) drop shadow below.
			".dshg-detail,.dshg-detailOpen,.dshg-detailInner{border:none;outline:none}",
			// Inner scrolling: the header stays put, the file list scrolls on its own,
			// and the patch block only takes the room its content needs (up to a cap).
			".dshg-detailOpen{overflow:hidden}",
			// Back to a content-sized wrapper (flex + max-height:100% broke measurement
			// and collapsed the pane to its header). The list caps itself in viewport
			// units; the patch block grows with its content up to a fixed cap.
			".dshg-detailInner{display:block;max-height:none;min-height:0;overflow:visible}",
			".dshg-detailList{max-height:30vh;overflow:auto}",
			".dshg-fileDiff{height:auto;max-height:280px;overflow:auto}",
			// Mode switches cross-fade the content; the height itself is CSS-capped,
			// so no JS measurement can flicker.
			".dshg-detailInner{animation:dshg-fadeIn .16s var(--ds-ease-in-out,ease-out)}",
			"@keyframes dshg-fadeIn{from{opacity:0}to{opacity:1}}",
			// --- reflog event rows: same geometry as a commit row, coloured dot on the rail ---
			".dshg-eventRow{position:relative;display:flex;gap:8px;align-items:flex-start;padding:6px}",
			".dshg-eventRow::before{content:'';position:absolute;left:-10.3px;top:-1px;bottom:-1px;width:2px;background:var(--dshg-border)}",
			".dshg-eventDot{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:2px solid var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2,#fff));box-sizing:border-box;transition:box-shadow .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-eventIcon{font-size:10px;line-height:1;font-weight:700;pointer-events:none;transform:translate(-0.2px,0.5px)}",
			".dshg-eventIconArrow{font-size:8px;line-height:1;font-weight:700;pointer-events:none;transform:translate(-0.3px,0.3px)}",
			".dshg-eventCard{display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:8px;margin-left:1px;min-width:0}",
			".dshg-nodeMergeIcon{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center}",
			".dshg-eventRow{position:relative;display:flex;gap:8px;align-items:flex-start;padding:6px;border-radius:8px;transition:background .15s var(--ds-ease-in-out,ease-out);user-select:none;-webkit-user-select:none}",
			".dshg-eventCard{display:flex;flex-direction:column;gap:2px;padding:0;border-radius:8px;min-width:0}",
			".dshg-eventTitle{font-size:13px;line-height:1.35;font-weight:600;color:var(--dshg-text)}",
			".dshg-eventMeta{font-size:10px;line-height:1.4;color:var(--dshg-muted)}",
			// Branch name legibility: light mode gets a soft dark halo, dark mode a thin
			// white outline; on dark backgrounds the dot's rim turns white too.
			".dshg-branchName{font-weight:600}",
			"@media (prefers-color-scheme:light){.dshg-branchName{text-shadow:0 0 4px color-mix(in srgb,var(--dshg-text) 35%,transparent)}}",
			"@media (prefers-color-scheme:dark){.dshg-branchName{text-shadow:0 0 1.2px rgba(255,255,255,.65)}.dshg-eventDot{border-color:#fff}}",
			".dshg-eventKind{align-self:flex-start;padding:0 5px;border-radius:4px;font-size:10px;line-height:15px;background:color-mix(in srgb,var(--dshg-warn,#d19a12) 24%,transparent);color:var(--dshg-text)}",
			".dshg-eventSub{font-size:10px;color:var(--dshg-muted)}",
			".dshg-eventMeta{font-size:10px;color:var(--dshg-muted)}",
			".dshg-eventRow{position:relative;display:flex;gap:8px;align-items:flex-start;padding:6px;border-radius:8px;transition:background .15s var(--ds-ease-in-out,ease-out)}",
			".dshg-eventRow:hover{background:var(--dshg-hover)}",
			".dshg-eventDetailBtn{align-self:flex-end;margin-top:2px;padding:0 6px;border-radius:4px;border:1px solid var(--dshg-border);background:transparent;color:var(--dshg-sub);font-size:10px;line-height:16px;cursor:pointer}",
			".dshg-eventDetailBtn:hover{color:var(--dshg-text);border-color:var(--dshg-text)}",
			".dshg-eventRow:hover .dshg-eventDot{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 40%,transparent)}",
			".dshg-eventBodyOpen{max-height:160px}",
			".dshg-eventBodyLine{font-size:10px;color:var(--dshg-muted)}",
			".dshg-eventChevron{position:absolute;right:4px;bottom:2px;font-size:10px;color:var(--dshg-muted);transition:transform .18s var(--ds-ease-in-out,ease-out)}",
			".dshg-eventChevronOpen{transform:rotate(180deg)}",
			".dshg-branchArrow{position:absolute;left:-8px;top:0.5px;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:6px solid var(--dshg-border);pointer-events:none;z-index:30}",
			".dshg-nodeIcon{font-size:9px;line-height:1;color:#fff;font-weight:700;pointer-events:none}",
			".dshg-refEvent{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 12%,transparent)}",
			// --- branch popover / conflict banner / recycle bin (2026-10-24) ---
			".dshg-opsBar{position:relative}",
			".dshg-opIcon{padding:3px 7px}",
			".dshg-opPush{margin-left:auto}",
			".dshg-opActive{border-color:var(--dsw-alias-accent,#3b82f6);color:var(--dshg-text);background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 14%,transparent)}",
			".dshg-opResolve{color:var(--dshg-ok);border-color:color-mix(in srgb,var(--dshg-ok) 35%,transparent)}",
			".dshg-pop{position:absolute;top:calc(100% + 6px);right:0;z-index:60;width:300px;max-height:58vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--dshg-border);border-radius:12px;background:var(--dsw-specific-menu,var(--dshg-panel,#1d1d21));box-shadow:0 14px 34px rgba(0,0,0,.35);padding:8px}",
			".dshg-popHead{display:flex;align-items:center;gap:8px;padding:2px 4px 8px;border-bottom:1px solid var(--dshg-border);flex:none}",
			".dshg-popTitle{flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--dshg-text)}",
			".dshg-popNote{padding:6px 4px 0;font-size:10.5px;color:var(--dshg-warn)}",
			".dshg-popList{margin-top:6px;overflow:auto;min-height:0}",
			".dshg-bBranch{border-radius:8px}",
			".dshg-bBranch:hover{background:var(--dshg-hover)}",
			".dshg-bHead{display:flex;align-items:center;gap:6px;padding:5px 6px;cursor:pointer}",
			".dshg-bDot{width:8px;height:8px;flex:none;border-radius:50%;border:1.5px solid var(--dshg-border)}",
			".dshg-bName{flex:1;min-width:0;font-size:12px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-bCurrent .dshg-bName{font-weight:600}",
			".dshg-bTag{flex:none;font-size:9.5px;line-height:14px;padding:0 4px;border-radius:4px;color:var(--dshg-warn);background:color-mix(in srgb,var(--dshg-warn) 16%,transparent)}",
			".dshg-bTime{flex:none;font-size:10px;color:var(--dshg-muted)}",
			".dshg-bCurrentTag{flex:none;font-size:10px;color:var(--dshg-sub);padding:1px 6px;border:1px solid var(--dshg-border);border-radius:5px}",
			".dshg-bBody{border-top:1px dashed var(--dshg-border);padding:6px 8px 8px;display:flex;flex-direction:column;gap:4px}",
			".dshg-bSubject{font-size:11.5px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-bMeta{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--dshg-muted)}",
			".dshg-bHash{font-family:var(--dsw-font-mono,monospace)}",
			".dshg-bCreated{font-size:10.5px;line-height:1.5;color:var(--dshg-sub)}",
			".dshg-bJump{align-self:flex-start;padding:0 6px}",
			".dshg-bActions{display:flex;align-items:center;margin-top:4px;gap:6px}",
			".dshg-bActionsRight{margin-left:auto;display:flex;gap:6px}",
			".dshg-morePop{width:168px;padding:4px}",
			".dshg-moreItem{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--dshg-text);font:inherit;font-size:12px;padding:7px 9px;border-radius:7px;cursor:pointer}",
			".dshg-moreItem:hover{background:var(--dshg-hover)}",
			".dshg-conflict{margin:8px 12px 0;border:1px solid color-mix(in srgb,var(--dshg-danger) 40%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dshg-danger) 8%,transparent);flex:none",
			".dshg-conflictHead{display:flex;align-items:center;gap:8px;padding:8px 10px}",
			".dshg-conflictIcon{width:19px;height:19px;flex:none;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--dshg-danger) 20%,transparent);color:var(--dshg-danger);font-size:11px;font-weight:700}",
			".dshg-conflictText{flex:1;min-width:0}",
			".dshg-conflictTitle{font-size:12px;font-weight:600;color:var(--dshg-danger)}",
			".dshg-conflictSub{font-size:10.5px;color:var(--dshg-sub);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-conflictCaret{width:24px;height:24px}",
			".dshg-conflictList{border-top:1px solid color-mix(in srgb,var(--dshg-danger) 22%,transparent);padding:4px 0 6px;max-height:220px;overflow:auto}",
			".dshg-conflictTree{display:flex;flex-direction:column}",
			".dshg-conflictEmpty{padding:6px 12px;font-size:11px;color:var(--dshg-ok)}",
			".dshg-cDir{display:flex;align-items:center;gap:5px;padding:3px 10px 3px 6px;font-size:11px;color:var(--dshg-sub)}",
			".dshg-cDirName{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-cDirCount{font-size:10px;color:var(--dshg-muted)}",
			".dshg-cFile{display:flex;align-items:center;gap:7px;padding:3px 10px 3px 20px;cursor:pointer;font-size:11.5px}",
			".dshg-cFile:hover{background:var(--dshg-hover)}",
			".dshg-cFileActive{background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 14%,transparent)}",
			".dshg-cLetter{width:12px;flex:none;font-family:var(--dsw-font-mono,monospace);font-size:10px;font-weight:700;color:var(--dshg-danger);text-align:center}",
			".dshg-cPath{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dshg-text)}",
			".dshg-cCount{flex:none;font-size:10px;color:var(--dshg-danger);font-variant-numeric:tabular-nums}",
			".dshg-cCountOk{color:var(--dshg-ok)}",
			".dshg-conflictView{font-family:var(--dsw-font-mono,monospace);font-size:10.5px;line-height:17px;padding:2px 0 10px}",
			".dshg-cfLine{display:flex;white-space:pre}",
			".dshg-cfNum{width:34px;flex:none;text-align:right;padding-right:9px;color:var(--dshg-muted);user-select:none}",
			".dshg-cfText{flex:1;min-width:0;padding-right:10px;color:var(--dshg-sub)}",
			".dshg-cfOurs .dshg-cfText{color:var(--dshg-danger);font-weight:600}",
			".dshg-cfSep .dshg-cfText{color:var(--dshg-warn);font-weight:600}",
			".dshg-cfTheirs .dshg-cfText{color:var(--dsw-alias-accent,#8b7cf0);font-weight:600}",
			".dshg-mergeModes{display:flex;gap:6px;margin-bottom:10px}",
			".dshg-mergeMode{border:1px solid var(--dshg-border);background:transparent;color:var(--dshg-sub);font:inherit;font-size:11px;padding:2px 10px;border-radius:6px;cursor:pointer}",
			".dshg-mergeModeOn{color:var(--dshg-text);border-color:var(--dsw-alias-accent,#3b82f6);background:color-mix(in srgb,var(--dsw-alias-accent,#3b82f6) 14%,transparent)}",
			".dshg-modalWarn{color:var(--dshg-danger)}",
			".dshg-modalHint{font-size:10.5px;line-height:1.6;color:var(--dshg-muted);margin-top:8px}",
			".dshg-recycleCard{width:min(560px,92vw);max-height:78vh;display:flex;flex-direction:column}",
			".dshg-recycleList{flex:1;min-height:0;overflow:auto;margin-top:8px;display:flex;flex-direction:column;gap:4px}",
			".dshg-recycleRow{display:flex;align-items:center;gap:9px;padding:6px 7px;border-radius:8px}",
			".dshg-recycleRow:hover{background:var(--dshg-hover)}",
			".dshg-recycleHash{flex:none;font-family:var(--dsw-font-mono,monospace);font-size:10px;color:var(--dshg-muted)}",
			".dshg-recycleMain{flex:1;min-width:0}",
			".dshg-recycleSubject{font-size:12px;color:var(--dshg-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-recycleMeta{font-size:10px;color:var(--dshg-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshg-recycleOps{flex:none;display:flex;gap:5px}",
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
			// History-shaping reflog events (branch created / merged / reset); the commit
			// graph cannot express these, so they ride alongside the log.
			reflogEvents: [],
			// Branch panel data (tip, last commit, merged state, creation record).
			branchDetails: null,
			// In-progress merge / squash / revert / cherry-pick and its conflicts.
			repoOperation: null,
			// One conflict file's worktree copy + the three index stages.
			conflictFile: null,
			conflictFileKey: null,
			conflictFileError: null,
			conflictFileLoading: false,
			// Recycle bin: commits no ref reaches any more.
			orphans: null,
			orphansError: null,
			orphansLoading: false,
			// Reserved for the future settings panel: hide conflict files from the
			// working-tree list. OFF by default (the bubble and the tree both list them).
			conflictListFilter: false,
			// Commit detail (files + statuses for the drawer's detail page).
			detail: null,
			detailHash: null,
			// Which commit actually owns the cached detail payload.
			detailLoadedHash: null,
			detailError: null,
			detailLoading: false,
			// One file's patch inside the open detail page.
			fileDiff: null,
			fileDiffKey: null,
			// Which key actually owns the currently cached patch. Rendering checks
			// this so stale data from another commit/file can never flash.
			fileDiffLoadedKey: null,
			fileDiffError: null,
			fileDiffLoading: false,
			// Working-tree file preview popup (opened by left-clicking a file row).
			workDiff: null,
			workDiffPath: null,
			workDiffError: null,
			workDiffLoading: false,
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
				// reflogEvents rides along with the other reads: it supplies the branch
				// creation / merge events that a commit graph cannot express.
				// The branch panel and the conflict bubble ride along with the other
				// reads: both are cheap queries and the panel must be able to show an
				// in-progress operation the moment it is opened.
				const emptyOperation = { operation: null, conflicts: [], resolved: [], total: 0, unresolved: 0 };
				const [log, status, branch, reflog, branchDetails, repoOperation] = snapshot.repo === true
					? await Promise.all([
						run("log", { path: cwd, limit: 60 }),
						run("status", { path: cwd }),
						run("branch", { path: cwd }),
						run("reflogEvents", { path: cwd }),
						run("branchDetails", { path: cwd }),
						run("repoOperation", { path: cwd })
					])
					: [{ commits: [] }, { clean: true, entries: [] }, { branches: [] }, { ok: true, events: [] }, { branches: [] }, emptyOperation];
				setStore({
					snapshot,
					log,
					status,
					branch,
					reflogEvents: Array.isArray(reflog?.events) ? reflog.events : [],
					branchDetails,
					repoOperation,
					loading: false,
					error: null,
					...(sameWorkspace ? null : { detail: null, detailHash: null, detailError: null, fileDiff: null, fileDiffKey: null, fileDiffError: null, conflictFile: null, conflictFileKey: null })
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
				setStore({ detail, detailError: null, detailLoading: false, detailLoadedHash: hash });
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
				setStore({ fileDiff, fileDiffError: null, fileDiffLoading: false, fileDiffLoadedKey: key });
			} catch (error) {
				setStore({ fileDiff: null, fileDiffError: error instanceof Error ? error.message : String(error), fileDiffLoading: false });
			}
		}
		/** Working-tree patch for ONE file (staged + unstaged, compared with HEAD). */
		async function refreshWorkDiff(ctx, cwd, path) {
			if (store.workDiffPath === path && store.workDiff !== null) return;
			// Point the cache at the new path immediately: the previous file's patch
			// must stop counting as "ready" the moment the selection changes, and the
			// pane holds its height until the new data lands.
			setStore({ workDiffPath: path, workDiffError: null, workDiffLoading: true });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const workDiff = await run("diff", { path: cwd, paths: [path], base: "HEAD" });
				setStore({ workDiff, workDiffError: null, workDiffLoading: false });
			} catch (error) {
				setStore({ workDiff: null, workDiffError: error instanceof Error ? error.message : String(error), workDiffLoading: false });
			}
		}
		/** One remote call with the {ok, value} envelope unwrapped. */
		async function callRemote(ctx, method, request) {
			const result = await ctx.remote.git[method](request);
			if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
			return result.value;
		}
		/**
		 * Read one conflict file. No cache short-circuit: the whole point is to see
		 * the markers disappear while the user edits the file outside the panel.
		 */
		async function refreshConflictFile(ctx, cwd, path) {
			const key = `${cwd}:${path}`;
			setStore({ conflictFileKey: key, conflictFileError: null, conflictFileLoading: true });
			try {
				const file = await callRemote(ctx, "conflictFile", { path: cwd, file: path });
				if (store.conflictFileKey !== key) return;
				setStore({ conflictFile: file, conflictFileError: null, conflictFileLoading: false });
			} catch (error) {
				setStore({ conflictFile: null, conflictFileError: error instanceof Error ? error.message : String(error), conflictFileLoading: false });
			}
		}
		/** Load the recycle bin (commits no ref reaches any more). */
		async function refreshOrphans(ctx, cwd) {
			setStore({ orphansLoading: true, orphansError: null });
			try {
				const out = await callRemote(ctx, "orphanedCommits", { path: cwd });
				if (out.ok !== true) throw new Error(out.error ?? "读取回收站失败");
				setStore({ orphans: out.commits, orphansLoading: false });
			} catch (error) {
				setStore({ orphans: [], orphansError: error instanceof Error ? error.message : String(error), orphansLoading: false });
			}
		}
		/**
		 * Continue an in-progress operation. Files whose markers are gone are
		 * staged first (the panel only shows "resolved"; git needs the add), then
		 * the operation's own continue command runs.
		 */
		async function continueOperation(ctx, cwd) {
			const operation = store.repoOperation;
			const kind = operation?.operation?.kind;
			if (typeof kind !== "string") return;
			setStore({ working: true, opMessage: null });
			try {
				const ready = (operation.conflicts ?? []).filter((file) => file.blocks === 0).map((file) => file.path);
				if (ready.length > 0) await callRemote(ctx, "add", { path: cwd, paths: ready });
				const result = await callRemote(ctx, "operationContinue", { path: cwd, kind });
				setStore({ working: false, opMessage: { type: "ok", text: result?.message ?? "已完成" }, conflictFile: null, conflictFileKey: null });
				await refreshAll(ctx, cwd);
			} catch (error) {
				setStore({ working: false, opMessage: { type: "error", text: error instanceof Error ? error.message : String(error) } });
			}
		}
		/** Stage one conflict file (the detail pane's "标记已解决"). */
		async function markResolved(ctx, cwd, path) {
			setStore({ working: true, opMessage: null });
			try {
				await callRemote(ctx, "add", { path: cwd, paths: [path] });
				setStore({ working: false, opMessage: { type: "ok", text: `已标记 ${path}` }, conflictFile: null, conflictFileKey: null });
				await refreshAll(ctx, cwd);
			} catch (error) {
				setStore({ working: false, opMessage: { type: "error", text: error instanceof Error ? error.message : String(error) } });
			}
		}
		//#endregion

		// Prism.js 1.29.0 (MIT) — inlined because a client bundle cannot require
		// npm packages and this app may run offline. `manual` is forced so Prism
		// never auto-highlights the host page; only PatchLines calls it directly.
		const Prism = (function () {
			// Prism's UMD tail does `module.exports = Prism`; shadow `module` here so
			// it cannot hijack this bundle's exports.
			const module = { exports: {} };
			if (typeof window !== "undefined") window.Prism = { manual: true };

/* **********************************************
     Begin prism-core.js
********************************************** */

/// <reference lib="WebWorker"/>

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
			? self // if in worker
			: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 *
 * @license MIT <https://opensource.org/licenses/MIT>
 * @author Lea Verou <https://lea.verou.me>
 * @namespace
 * @public
 */
var Prism = (function (_self) {

	// Private helper vars
	var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
	var uniqueId = 0;

	// The grammar object for plaintext
	var plainTextGrammar = {};


	var _ = {
		/**
		 * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
		 * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
		 * additional languages or plugins yourself.
		 *
		 * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
		 *
		 * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
		 * empty Prism object into the global scope before loading the Prism script like this:
		 *
		 * ```js
		 * window.Prism = window.Prism || {};
		 * Prism.manual = true;
		 * // add a new <script> to load Prism's script
		 * ```
		 *
		 * @default false
		 * @type {boolean}
		 * @memberof Prism
		 * @public
		 */
		manual: _self.Prism && _self.Prism.manual,
		/**
		 * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
		 * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
		 * own worker, you don't want it to do this.
		 *
		 * By setting this value to `true`, Prism will not add its own listeners to the worker.
		 *
		 * You obviously have to change this value before Prism executes. To do this, you can add an
		 * empty Prism object into the global scope before loading the Prism script like this:
		 *
		 * ```js
		 * window.Prism = window.Prism || {};
		 * Prism.disableWorkerMessageHandler = true;
		 * // Load Prism's script
		 * ```
		 *
		 * @default false
		 * @type {boolean}
		 * @memberof Prism
		 * @public
		 */
		disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,

		/**
		 * A namespace for utility methods.
		 *
		 * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
		 * change or disappear at any time.
		 *
		 * @namespace
		 * @memberof Prism
		 */
		util: {
			encode: function encode(tokens) {
				if (tokens instanceof Token) {
					return new Token(tokens.type, encode(tokens.content), tokens.alias);
				} else if (Array.isArray(tokens)) {
					return tokens.map(encode);
				} else {
					return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
				}
			},

			/**
			 * Returns the name of the type of the given value.
			 *
			 * @param {any} o
			 * @returns {string}
			 * @example
			 * type(null)      === 'Null'
			 * type(undefined) === 'Undefined'
			 * type(123)       === 'Number'
			 * type('foo')     === 'String'
			 * type(true)      === 'Boolean'
			 * type([1, 2])    === 'Array'
			 * type({})        === 'Object'
			 * type(String)    === 'Function'
			 * type(/abc+/)    === 'RegExp'
			 */
			type: function (o) {
				return Object.prototype.toString.call(o).slice(8, -1);
			},

			/**
			 * Returns a unique number for the given object. Later calls will still return the same number.
			 *
			 * @param {Object} obj
			 * @returns {number}
			 */
			objId: function (obj) {
				if (!obj['__id']) {
					Object.defineProperty(obj, '__id', { value: ++uniqueId });
				}
				return obj['__id'];
			},

			/**
			 * Creates a deep clone of the given object.
			 *
			 * The main intended use of this function is to clone language definitions.
			 *
			 * @param {T} o
			 * @param {Record<number, any>} [visited]
			 * @returns {T}
			 * @template T
			 */
			clone: function deepClone(o, visited) {
				visited = visited || {};

				var clone; var id;
				switch (_.util.type(o)) {
					case 'Object':
						id = _.util.objId(o);
						if (visited[id]) {
							return visited[id];
						}
						clone = /** @type {Record<string, any>} */ ({});
						visited[id] = clone;

						for (var key in o) {
							if (o.hasOwnProperty(key)) {
								clone[key] = deepClone(o[key], visited);
							}
						}

						return /** @type {any} */ (clone);

					case 'Array':
						id = _.util.objId(o);
						if (visited[id]) {
							return visited[id];
						}
						clone = [];
						visited[id] = clone;

						(/** @type {Array} */(/** @type {any} */(o))).forEach(function (v, i) {
							clone[i] = deepClone(v, visited);
						});

						return /** @type {any} */ (clone);

					default:
						return o;
				}
			},

			/**
			 * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
			 *
			 * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
			 *
			 * @param {Element} element
			 * @returns {string}
			 */
			getLanguage: function (element) {
				while (element) {
					var m = lang.exec(element.className);
					if (m) {
						return m[1].toLowerCase();
					}
					element = element.parentElement;
				}
				return 'none';
			},

			/**
			 * Sets the Prism `language-xxxx` class of the given element.
			 *
			 * @param {Element} element
			 * @param {string} language
			 * @returns {void}
			 */
			setLanguage: function (element, language) {
				// remove all `language-xxxx` classes
				// (this might leave behind a leading space)
				element.className = element.className.replace(RegExp(lang, 'gi'), '');

				// add the new `language-xxxx` class
				// (using `classList` will automatically clean up spaces for us)
				element.classList.add('language-' + language);
			},

			/**
			 * Returns the script element that is currently executing.
			 *
			 * This does __not__ work for line script element.
			 *
			 * @returns {HTMLScriptElement | null}
			 */
			currentScript: function () {
				if (typeof document === 'undefined') {
					return null;
				}
				if ('currentScript' in document && 1 < 2 /* hack to trip TS' flow analysis */) {
					return /** @type {any} */ (document.currentScript);
				}

				// IE11 workaround
				// we'll get the src of the current script by parsing IE11's error stack trace
				// this will not work for inline scripts

				try {
					throw new Error();
				} catch (err) {
					// Get file src url from stack. Specifically works with the format of stack traces in IE.
					// A stack will look like this:
					//
					// Error
					//    at _.util.currentScript (http://localhost/components/prism-core.js:119:5)
					//    at Global code (http://localhost/components/prism-core.js:606:1)

					var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
					if (src) {
						var scripts = document.getElementsByTagName('script');
						for (var i in scripts) {
							if (scripts[i].src == src) {
								return scripts[i];
							}
						}
					}
					return null;
				}
			},

			/**
			 * Returns whether a given class is active for `element`.
			 *
			 * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
			 * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
			 * given class is just the given class with a `no-` prefix.
			 *
			 * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
			 * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
			 * ancestors have the given class or the negated version of it, then the default activation will be returned.
			 *
			 * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
			 * version of it, the class is considered active.
			 *
			 * @param {Element} element
			 * @param {string} className
			 * @param {boolean} [defaultActivation=false]
			 * @returns {boolean}
			 */
			isActive: function (element, className, defaultActivation) {
				var no = 'no-' + className;

				while (element) {
					var classList = element.classList;
					if (classList.contains(className)) {
						return true;
					}
					if (classList.contains(no)) {
						return false;
					}
					element = element.parentElement;
				}
				return !!defaultActivation;
			}
		},

		/**
		 * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
		 *
		 * @namespace
		 * @memberof Prism
		 * @public
		 */
		languages: {
			/**
			 * The grammar for plain, unformatted text.
			 */
			plain: plainTextGrammar,
			plaintext: plainTextGrammar,
			text: plainTextGrammar,
			txt: plainTextGrammar,

			/**
			 * Creates a deep copy of the language with the given id and appends the given tokens.
			 *
			 * If a token in `redef` also appears in the copied language, then the existing token in the copied language
			 * will be overwritten at its original position.
			 *
			 * ## Best practices
			 *
			 * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
			 * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
			 * understand the language definition because, normally, the order of tokens matters in Prism grammars.
			 *
			 * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
			 * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
			 *
			 * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
			 * @param {Grammar} redef The new tokens to append.
			 * @returns {Grammar} The new language created.
			 * @public
			 * @example
			 * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
			 *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
			 *     // at its original position
			 *     'comment': { ... },
			 *     // CSS doesn't have a 'color' token, so this token will be appended
			 *     'color': /\b(?:red|green|blue)\b/
			 * });
			 */
			extend: function (id, redef) {
				var lang = _.util.clone(_.languages[id]);

				for (var key in redef) {
					lang[key] = redef[key];
				}

				return lang;
			},

			/**
			 * Inserts tokens _before_ another token in a language definition or any other grammar.
			 *
			 * ## Usage
			 *
			 * This helper method makes it easy to modify existing languages. For example, the CSS language definition
			 * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
			 * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
			 * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
			 * this:
			 *
			 * ```js
			 * Prism.languages.markup.style = {
			 *     // token
			 * };
			 * ```
			 *
			 * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
			 * before existing tokens. For the CSS example above, you would use it like this:
			 *
			 * ```js
			 * Prism.languages.insertBefore('markup', 'cdata', {
			 *     'style': {
			 *         // token
			 *     }
			 * });
			 * ```
			 *
			 * ## Special cases
			 *
			 * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
			 * will be ignored.
			 *
			 * This behavior can be used to insert tokens after `before`:
			 *
			 * ```js
			 * Prism.languages.insertBefore('markup', 'comment', {
			 *     'comment': Prism.languages.markup.comment,
			 *     // tokens after 'comment'
			 * });
			 * ```
			 *
			 * ## Limitations
			 *
			 * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
			 * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
			 * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
			 * deleting properties which is necessary to insert at arbitrary positions.
			 *
			 * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
			 * Instead, it will create a new object and replace all references to the target object with the new one. This
			 * can be done without temporarily deleting properties, so the iteration order is well-defined.
			 *
			 * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
			 * you hold the target object in a variable, then the value of the variable will not change.
			 *
			 * ```js
			 * var oldMarkup = Prism.languages.markup;
			 * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
			 *
			 * assert(oldMarkup !== Prism.languages.markup);
			 * assert(newMarkup === Prism.languages.markup);
			 * ```
			 *
			 * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
			 * object to be modified.
			 * @param {string} before The key to insert before.
			 * @param {Grammar} insert An object containing the key-value pairs to be inserted.
			 * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
			 * object to be modified.
			 *
			 * Defaults to `Prism.languages`.
			 * @returns {Grammar} The new grammar object.
			 * @public
			 */
			insertBefore: function (inside, before, insert, root) {
				root = root || /** @type {any} */ (_.languages);
				var grammar = root[inside];
				/** @type {Grammar} */
				var ret = {};

				for (var token in grammar) {
					if (grammar.hasOwnProperty(token)) {

						if (token == before) {
							for (var newToken in insert) {
								if (insert.hasOwnProperty(newToken)) {
									ret[newToken] = insert[newToken];
								}
							}
						}

						// Do not insert token which also occur in insert. See #1525
						if (!insert.hasOwnProperty(token)) {
							ret[token] = grammar[token];
						}
					}
				}

				var old = root[inside];
				root[inside] = ret;

				// Update references in other language definitions
				_.languages.DFS(_.languages, function (key, value) {
					if (value === old && key != inside) {
						this[key] = ret;
					}
				});

				return ret;
			},

			// Traverse a language definition with Depth First Search
			DFS: function DFS(o, callback, type, visited) {
				visited = visited || {};

				var objId = _.util.objId;

				for (var i in o) {
					if (o.hasOwnProperty(i)) {
						callback.call(o, i, o[i], type || i);

						var property = o[i];
						var propertyType = _.util.type(property);

						if (propertyType === 'Object' && !visited[objId(property)]) {
							visited[objId(property)] = true;
							DFS(property, callback, null, visited);
						} else if (propertyType === 'Array' && !visited[objId(property)]) {
							visited[objId(property)] = true;
							DFS(property, callback, i, visited);
						}
					}
				}
			}
		},

		plugins: {},

		/**
		 * This is the most high-level function in Prism’s API.
		 * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
		 * each one of them.
		 *
		 * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
		 *
		 * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
		 * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
		 * @memberof Prism
		 * @public
		 */
		highlightAll: function (async, callback) {
			_.highlightAllUnder(document, async, callback);
		},

		/**
		 * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
		 * {@link Prism.highlightElement} on each one of them.
		 *
		 * The following hooks will be run:
		 * 1. `before-highlightall`
		 * 2. `before-all-elements-highlight`
		 * 3. All hooks of {@link Prism.highlightElement} for each element.
		 *
		 * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
		 * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
		 * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
		 * @memberof Prism
		 * @public
		 */
		highlightAllUnder: function (container, async, callback) {
			var env = {
				callback: callback,
				container: container,
				selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
			};

			_.hooks.run('before-highlightall', env);

			env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));

			_.hooks.run('before-all-elements-highlight', env);

			for (var i = 0, element; (element = env.elements[i++]);) {
				_.highlightElement(element, async === true, env.callback);
			}
		},

		/**
		 * Highlights the code inside a single element.
		 *
		 * The following hooks will be run:
		 * 1. `before-sanity-check`
		 * 2. `before-highlight`
		 * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
		 * 4. `before-insert`
		 * 5. `after-highlight`
		 * 6. `complete`
		 *
		 * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
		 * the element's language.
		 *
		 * @param {Element} element The element containing the code.
		 * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
		 * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
		 * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
		 * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
		 *
		 * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
		 * asynchronous highlighting to work. You can build your own bundle on the
		 * [Download page](https://prismjs.com/download.html).
		 * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
		 * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
		 * @memberof Prism
		 * @public
		 */
		highlightElement: function (element, async, callback) {
			// Find language
			var language = _.util.getLanguage(element);
			var grammar = _.languages[language];

			// Set language on the element, if not present
			_.util.setLanguage(element, language);

			// Set language on the parent, for styling
			var parent = element.parentElement;
			if (parent && parent.nodeName.toLowerCase() === 'pre') {
				_.util.setLanguage(parent, language);
			}

			var code = element.textContent;

			var env = {
				element: element,
				language: language,
				grammar: grammar,
				code: code
			};

			function insertHighlightedCode(highlightedCode) {
				env.highlightedCode = highlightedCode;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
				callback && callback.call(env.element);
			}

			_.hooks.run('before-sanity-check', env);

			// plugins may change/add the parent/element
			parent = env.element.parentElement;
			if (parent && parent.nodeName.toLowerCase() === 'pre' && !parent.hasAttribute('tabindex')) {
				parent.setAttribute('tabindex', '0');
			}

			if (!env.code) {
				_.hooks.run('complete', env);
				callback && callback.call(env.element);
				return;
			}

			_.hooks.run('before-highlight', env);

			if (!env.grammar) {
				insertHighlightedCode(_.util.encode(env.code));
				return;
			}

			if (async && _self.Worker) {
				var worker = new Worker(_.filename);

				worker.onmessage = function (evt) {
					insertHighlightedCode(evt.data);
				};

				worker.postMessage(JSON.stringify({
					language: env.language,
					code: env.code,
					immediateClose: true
				}));
			} else {
				insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
			}
		},

		/**
		 * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
		 * and the language definitions to use, and returns a string with the HTML produced.
		 *
		 * The following hooks will be run:
		 * 1. `before-tokenize`
		 * 2. `after-tokenize`
		 * 3. `wrap`: On each {@link Token}.
		 *
		 * @param {string} text A string with the code to be highlighted.
		 * @param {Grammar} grammar An object containing the tokens to use.
		 *
		 * Usually a language definition like `Prism.languages.markup`.
		 * @param {string} language The name of the language definition passed to `grammar`.
		 * @returns {string} The highlighted HTML.
		 * @memberof Prism
		 * @public
		 * @example
		 * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
		 */
		highlight: function (text, grammar, language) {
			var env = {
				code: text,
				grammar: grammar,
				language: language
			};
			_.hooks.run('before-tokenize', env);
			if (!env.grammar) {
				throw new Error('The language "' + env.language + '" has no grammar.');
			}
			env.tokens = _.tokenize(env.code, env.grammar);
			_.hooks.run('after-tokenize', env);
			return Token.stringify(_.util.encode(env.tokens), env.language);
		},

		/**
		 * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
		 * and the language definitions to use, and returns an array with the tokenized code.
		 *
		 * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
		 *
		 * This method could be useful in other contexts as well, as a very crude parser.
		 *
		 * @param {string} text A string with the code to be highlighted.
		 * @param {Grammar} grammar An object containing the tokens to use.
		 *
		 * Usually a language definition like `Prism.languages.markup`.
		 * @returns {TokenStream} An array of strings and tokens, a token stream.
		 * @memberof Prism
		 * @public
		 * @example
		 * let code = `var foo = 0;`;
		 * let tokens = Prism.tokenize(code, Prism.languages.javascript);
		 * tokens.forEach(token => {
		 *     if (token instanceof Prism.Token && token.type === 'number') {
		 *         console.log(`Found numeric literal: ${token.content}`);
		 *     }
		 * });
		 */
		tokenize: function (text, grammar) {
			var rest = grammar.rest;
			if (rest) {
				for (var token in rest) {
					grammar[token] = rest[token];
				}

				delete grammar.rest;
			}

			var tokenList = new LinkedList();
			addAfter(tokenList, tokenList.head, text);

			matchGrammar(text, tokenList, grammar, tokenList.head, 0);

			return toArray(tokenList);
		},

		/**
		 * @namespace
		 * @memberof Prism
		 * @public
		 */
		hooks: {
			all: {},

			/**
			 * Adds the given callback to the list of callbacks for the given hook.
			 *
			 * The callback will be invoked when the hook it is registered for is run.
			 * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
			 *
			 * One callback function can be registered to multiple hooks and the same hook multiple times.
			 *
			 * @param {string} name The name of the hook.
			 * @param {HookCallback} callback The callback function which is given environment variables.
			 * @public
			 */
			add: function (name, callback) {
				var hooks = _.hooks.all;

				hooks[name] = hooks[name] || [];

				hooks[name].push(callback);
			},

			/**
			 * Runs a hook invoking all registered callbacks with the given environment variables.
			 *
			 * Callbacks will be invoked synchronously and in the order in which they were registered.
			 *
			 * @param {string} name The name of the hook.
			 * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
			 * @public
			 */
			run: function (name, env) {
				var callbacks = _.hooks.all[name];

				if (!callbacks || !callbacks.length) {
					return;
				}

				for (var i = 0, callback; (callback = callbacks[i++]);) {
					callback(env);
				}
			}
		},

		Token: Token
	};
	_self.Prism = _;


	// Typescript note:
	// The following can be used to import the Token type in JSDoc:
	//
	//   @typedef {InstanceType<import("./prism-core")["Token"]>} Token

	/**
	 * Creates a new token.
	 *
	 * @param {string} type See {@link Token#type type}
	 * @param {string | TokenStream} content See {@link Token#content content}
	 * @param {string|string[]} [alias] The alias(es) of the token.
	 * @param {string} [matchedStr=""] A copy of the full string this token was created from.
	 * @class
	 * @global
	 * @public
	 */
	function Token(type, content, alias, matchedStr) {
		/**
		 * The type of the token.
		 *
		 * This is usually the key of a pattern in a {@link Grammar}.
		 *
		 * @type {string}
		 * @see GrammarToken
		 * @public
		 */
		this.type = type;
		/**
		 * The strings or tokens contained by this token.
		 *
		 * This will be a token stream if the pattern matched also defined an `inside` grammar.
		 *
		 * @type {string | TokenStream}
		 * @public
		 */
		this.content = content;
		/**
		 * The alias(es) of the token.
		 *
		 * @type {string|string[]}
		 * @see GrammarToken
		 * @public
		 */
		this.alias = alias;
		// Copy of the full string this token was created from
		this.length = (matchedStr || '').length | 0;
	}

	/**
	 * A token stream is an array of strings and {@link Token Token} objects.
	 *
	 * Token streams have to fulfill a few properties that are assumed by most functions (mostly internal ones) that process
	 * them.
	 *
	 * 1. No adjacent strings.
	 * 2. No empty strings.
	 *
	 *    The only exception here is the token stream that only contains the empty string and nothing else.
	 *
	 * @typedef {Array<string | Token>} TokenStream
	 * @global
	 * @public
	 */

	/**
	 * Converts the given token or token stream to an HTML representation.
	 *
	 * The following hooks will be run:
	 * 1. `wrap`: On each {@link Token}.
	 *
	 * @param {string | Token | TokenStream} o The token or token stream to be converted.
	 * @param {string} language The name of current language.
	 * @returns {string} The HTML representation of the token or token stream.
	 * @memberof Token
	 * @static
	 */
	Token.stringify = function stringify(o, language) {
		if (typeof o == 'string') {
			return o;
		}
		if (Array.isArray(o)) {
			var s = '';
			o.forEach(function (e) {
				s += stringify(e, language);
			});
			return s;
		}

		var env = {
			type: o.type,
			content: stringify(o.content, language),
			tag: 'span',
			classes: ['token', o.type],
			attributes: {},
			language: language
		};

		var aliases = o.alias;
		if (aliases) {
			if (Array.isArray(aliases)) {
				Array.prototype.push.apply(env.classes, aliases);
			} else {
				env.classes.push(aliases);
			}
		}

		_.hooks.run('wrap', env);

		var attributes = '';
		for (var name in env.attributes) {
			attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
		}

		return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
	};

	/**
	 * @param {RegExp} pattern
	 * @param {number} pos
	 * @param {string} text
	 * @param {boolean} lookbehind
	 * @returns {RegExpExecArray | null}
	 */
	function matchPattern(pattern, pos, text, lookbehind) {
		pattern.lastIndex = pos;
		var match = pattern.exec(text);
		if (match && lookbehind && match[1]) {
			// change the match to remove the text matched by the Prism lookbehind group
			var lookbehindLength = match[1].length;
			match.index += lookbehindLength;
			match[0] = match[0].slice(lookbehindLength);
		}
		return match;
	}

	/**
	 * @param {string} text
	 * @param {LinkedList<string | Token>} tokenList
	 * @param {any} grammar
	 * @param {LinkedListNode<string | Token>} startNode
	 * @param {number} startPos
	 * @param {RematchOptions} [rematch]
	 * @returns {void}
	 * @private
	 *
	 * @typedef RematchOptions
	 * @property {string} cause
	 * @property {number} reach
	 */
	function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
		for (var token in grammar) {
			if (!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			var patterns = grammar[token];
			patterns = Array.isArray(patterns) ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				if (rematch && rematch.cause == token + ',' + j) {
					return;
				}

				var patternObj = patterns[j];
				var inside = patternObj.inside;
				var lookbehind = !!patternObj.lookbehind;
				var greedy = !!patternObj.greedy;
				var alias = patternObj.alias;

				if (greedy && !patternObj.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
					patternObj.pattern = RegExp(patternObj.pattern.source, flags + 'g');
				}

				/** @type {RegExp} */
				var pattern = patternObj.pattern || patternObj;

				for ( // iterate the token list and keep track of the current token/string position
					var currentNode = startNode.next, pos = startPos;
					currentNode !== tokenList.tail;
					pos += currentNode.value.length, currentNode = currentNode.next
				) {

					if (rematch && pos >= rematch.reach) {
						break;
					}

					var str = currentNode.value;

					if (tokenList.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					var removeCount = 1; // this is the to parameter of removeBetween
					var match;

					if (greedy) {
						match = matchPattern(pattern, pos, text, lookbehind);
						if (!match || match.index >= text.length) {
							break;
						}

						var from = match.index;
						var to = match.index + match[0].length;
						var p = pos;

						// find the node that contains the match
						p += currentNode.value.length;
						while (from >= p) {
							currentNode = currentNode.next;
							p += currentNode.value.length;
						}
						// adjust pos (and p)
						p -= currentNode.value.length;
						pos = p;

						// the current node is a Token, then the match starts inside another Token, which is invalid
						if (currentNode.value instanceof Token) {
							continue;
						}

						// find the last node which is affected by this match
						for (
							var k = currentNode;
							k !== tokenList.tail && (p < to || typeof k.value === 'string');
							k = k.next
						) {
							removeCount++;
							p += k.value.length;
						}
						removeCount--;

						// replace with the new match
						str = text.slice(pos, p);
						match.index -= pos;
					} else {
						match = matchPattern(pattern, 0, str, lookbehind);
						if (!match) {
							continue;
						}
					}

					// eslint-disable-next-line no-redeclare
					var from = match.index;
					var matchStr = match[0];
					var before = str.slice(0, from);
					var after = str.slice(from + matchStr.length);

					var reach = pos + str.length;
					if (rematch && reach > rematch.reach) {
						rematch.reach = reach;
					}

					var removeFrom = currentNode.prev;

					if (before) {
						removeFrom = addAfter(tokenList, removeFrom, before);
						pos += before.length;
					}

					removeRange(tokenList, removeFrom, removeCount);

					var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
					currentNode = addAfter(tokenList, removeFrom, wrapped);

					if (after) {
						addAfter(tokenList, currentNode, after);
					}

					if (removeCount > 1) {
						// at least one Token object was removed, so we have to do some rematching
						// this can only happen if the current pattern is greedy

						/** @type {RematchOptions} */
						var nestedRematch = {
							cause: token + ',' + j,
							reach: reach
						};
						matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);

						// the reach might have been extended because of the rematching
						if (rematch && nestedRematch.reach > rematch.reach) {
							rematch.reach = nestedRematch.reach;
						}
					}
				}
			}
		}
	}

	/**
	 * @typedef LinkedListNode
	 * @property {T} value
	 * @property {LinkedListNode<T> | null} prev The previous node.
	 * @property {LinkedListNode<T> | null} next The next node.
	 * @template T
	 * @private
	 */

	/**
	 * @template T
	 * @private
	 */
	function LinkedList() {
		/** @type {LinkedListNode<T>} */
		var head = { value: null, prev: null, next: null };
		/** @type {LinkedListNode<T>} */
		var tail = { value: null, prev: head, next: null };
		head.next = tail;

		/** @type {LinkedListNode<T>} */
		this.head = head;
		/** @type {LinkedListNode<T>} */
		this.tail = tail;
		this.length = 0;
	}

	/**
	 * Adds a new node with the given value to the list.
	 *
	 * @param {LinkedList<T>} list
	 * @param {LinkedListNode<T>} node
	 * @param {T} value
	 * @returns {LinkedListNode<T>} The added node.
	 * @template T
	 */
	function addAfter(list, node, value) {
		// assumes that node != list.tail && values.length >= 0
		var next = node.next;

		var newNode = { value: value, prev: node, next: next };
		node.next = newNode;
		next.prev = newNode;
		list.length++;

		return newNode;
	}
	/**
	 * Removes `count` nodes after the given node. The given node will not be removed.
	 *
	 * @param {LinkedList<T>} list
	 * @param {LinkedListNode<T>} node
	 * @param {number} count
	 * @template T
	 */
	function removeRange(list, node, count) {
		var next = node.next;
		for (var i = 0; i < count && next !== list.tail; i++) {
			next = next.next;
		}
		node.next = next;
		next.prev = node;
		list.length -= i;
	}
	/**
	 * @param {LinkedList<T>} list
	 * @returns {T[]}
	 * @template T
	 */
	function toArray(list) {
		var array = [];
		var node = list.head.next;
		while (node !== list.tail) {
			array.push(node.value);
			node = node.next;
		}
		return array;
	}


	if (!_self.document) {
		if (!_self.addEventListener) {
			// in Node.js
			return _;
		}

		if (!_.disableWorkerMessageHandler) {
			// In worker
			_self.addEventListener('message', function (evt) {
				var message = JSON.parse(evt.data);
				var lang = message.language;
				var code = message.code;
				var immediateClose = message.immediateClose;

				_self.postMessage(_.highlight(code, _.languages[lang], lang));
				if (immediateClose) {
					_self.close();
				}
			}, false);
		}

		return _;
	}

	// Get current script and highlight
	var script = _.util.currentScript();

	if (script) {
		_.filename = script.src;

		if (script.hasAttribute('data-manual')) {
			_.manual = true;
		}
	}

	function highlightAutomaticallyCallback() {
		if (!_.manual) {
			_.highlightAll();
		}
	}

	if (!_.manual) {
		// If the document state is "loading", then we'll use DOMContentLoaded.
		// If the document state is "interactive" and the prism.js script is deferred, then we'll also use the
		// DOMContentLoaded event because there might be some plugins or languages which have also been deferred and they
		// might take longer one animation frame to execute which can create a race condition where only some plugins have
		// been loaded when Prism.highlightAll() is executed, depending on how fast resources are loaded.
		// See https://github.com/PrismJS/prism/issues/2102
		var readyState = document.readyState;
		if (readyState === 'loading' || readyState === 'interactive' && script && script.defer) {
			document.addEventListener('DOMContentLoaded', highlightAutomaticallyCallback);
		} else {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(highlightAutomaticallyCallback);
			} else {
				window.setTimeout(highlightAutomaticallyCallback, 16);
			}
		}
	}

	return _;

}(_self));

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}

// some additional documentation/types

/**
 * The expansion of a simple `RegExp` literal to support additional properties.
 *
 * @typedef GrammarToken
 * @property {RegExp} pattern The regular expression of the token.
 * @property {boolean} [lookbehind=false] If `true`, then the first capturing group of `pattern` will (effectively)
 * behave as a lookbehind group meaning that the captured text will not be part of the matched text of the new token.
 * @property {boolean} [greedy=false] Whether the token is greedy.
 * @property {string|string[]} [alias] An optional alias or list of aliases.
 * @property {Grammar} [inside] The nested grammar of this token.
 *
 * The `inside` grammar will be used to tokenize the text value of each token of this kind.
 *
 * This can be used to make nested and even recursive language definitions.
 *
 * Note: This can cause infinite recursion. Be careful when you embed different languages or even the same language into
 * each another.
 * @global
 * @public
 */

/**
 * @typedef Grammar
 * @type {Object<string, RegExp | GrammarToken | Array<RegExp | GrammarToken>>}
 * @property {Grammar} [rest] An optional grammar object that will be appended to this grammar.
 * @global
 * @public
 */

/**
 * A function which will invoked after an element was successfully highlighted.
 *
 * @callback HighlightCallback
 * @param {Element} element The element successfully highlighted.
 * @returns {void}
 * @global
 * @public
 */

/**
 * @callback HookCallback
 * @param {Object<string, any>} env The environment variables of the hook.
 * @returns {void}
 * @global
 * @public
 */


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': {
		pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
		greedy: true
	},
	'prolog': {
		pattern: /<\?[\s\S]+?\?>/,
		greedy: true
	},
	'doctype': {
		// https://www.w3.org/TR/xml/#NT-doctypedecl
		pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
		greedy: true,
		inside: {
			'internal-subset': {
				pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
				lookbehind: true,
				greedy: true,
				inside: null // see below
			},
			'string': {
				pattern: /"[^"]*"|'[^']*'/,
				greedy: true
			},
			'punctuation': /^<!|>$|[[\]]/,
			'doctype-tag': /^DOCTYPE/i,
			'name': /[^\s<>'"]+/
		}
	},
	'cdata': {
		pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
		greedy: true
	},
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
		greedy: true,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'special-attr': [],
			'attr-value': {
				pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
				inside: {
					'punctuation': [
						{
							pattern: /^=/,
							alias: 'attr-equals'
						},
						{
							pattern: /^(\s*)["']|["']$/,
							lookbehind: true
						}
					]
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': [
		{
			pattern: /&[\da-z]{1,8};/i,
			alias: 'named-entity'
		},
		/&#x?[\da-f]{1,8};/i
	]
};

Prism.languages.markup['tag'].inside['attr-value'].inside['entity'] =
	Prism.languages.markup['entity'];
Prism.languages.markup['doctype'].inside['internal-subset'].inside = Prism.languages.markup;

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function (env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Object.defineProperty(Prism.languages.markup.tag, 'addInlined', {
	/**
	 * Adds an inlined language to markup.
	 *
	 * An example of an inlined language is CSS with `<style>` tags.
	 *
	 * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
	 * case insensitive.
	 * @param {string} lang The language key.
	 * @example
	 * addInlined('style', 'css');
	 */
	value: function addInlined(tagName, lang) {
		var includedCdataInside = {};
		includedCdataInside['language-' + lang] = {
			pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
			lookbehind: true,
			inside: Prism.languages[lang]
		};
		includedCdataInside['cdata'] = /^<!\[CDATA\[|\]\]>$/i;

		var inside = {
			'included-cdata': {
				pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
				inside: includedCdataInside
			}
		};
		inside['language-' + lang] = {
			pattern: /[\s\S]+/,
			inside: Prism.languages[lang]
		};

		var def = {};
		def[tagName] = {
			pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function () { return tagName; }), 'i'),
			lookbehind: true,
			greedy: true,
			inside: inside
		};

		Prism.languages.insertBefore('markup', 'cdata', def);
	}
});
Object.defineProperty(Prism.languages.markup.tag, 'addAttribute', {
	/**
	 * Adds an pattern to highlight languages embedded in HTML attributes.
	 *
	 * An example of an inlined language is CSS with `style` attributes.
	 *
	 * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
	 * case insensitive.
	 * @param {string} lang The language key.
	 * @example
	 * addAttribute('style', 'css');
	 */
	value: function (attrName, lang) {
		Prism.languages.markup.tag.inside['special-attr'].push({
			pattern: RegExp(
				/(^|["'\s])/.source + '(?:' + attrName + ')' + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
				'i'
			),
			lookbehind: true,
			inside: {
				'attr-name': /^[^\s=]+/,
				'attr-value': {
					pattern: /=[\s\S]+/,
					inside: {
						'value': {
							pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
							lookbehind: true,
							alias: [lang, 'language-' + lang],
							inside: Prism.languages[lang]
						},
						'punctuation': [
							{
								pattern: /^=/,
								alias: 'attr-equals'
							},
							/"|'/
						]
					}
				}
			}
		});
	}
});

Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;

Prism.languages.xml = Prism.languages.extend('markup', {});
Prism.languages.ssml = Prism.languages.xml;
Prism.languages.atom = Prism.languages.xml;
Prism.languages.rss = Prism.languages.xml;


/* **********************************************
     Begin prism-css.js
********************************************** */

(function (Prism) {

	var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;

	Prism.languages.css = {
		'comment': /\/\*[\s\S]*?\*\//,
		'atrule': {
			pattern: RegExp('@[\\w-](?:' + /[^;{\s"']|\s+(?!\s)/.source + '|' + string.source + ')*?' + /(?:;|(?=\s*\{))/.source),
			inside: {
				'rule': /^@[\w-]+/,
				'selector-function-argument': {
					pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
					lookbehind: true,
					alias: 'selector'
				},
				'keyword': {
					pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
					lookbehind: true
				}
				// See rest below
			}
		},
		'url': {
			// https://drafts.csswg.org/css-values-3/#urls
			pattern: RegExp('\\burl\\((?:' + string.source + '|' + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ')\\)', 'i'),
			greedy: true,
			inside: {
				'function': /^url/i,
				'punctuation': /^\(|\)$/,
				'string': {
					pattern: RegExp('^' + string.source + '$'),
					alias: 'url'
				}
			}
		},
		'selector': {
			pattern: RegExp('(^|[{}\\s])[^{}\\s](?:[^{};"\'\\s]|\\s+(?![\\s{])|' + string.source + ')*(?=\\s*\\{)'),
			lookbehind: true
		},
		'string': {
			pattern: string,
			greedy: true
		},
		'property': {
			pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
			lookbehind: true
		},
		'important': /!important\b/i,
		'function': {
			pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
			lookbehind: true
		},
		'punctuation': /[(){};:,]/
	};

	Prism.languages.css['atrule'].inside.rest = Prism.languages.css;

	var markup = Prism.languages.markup;
	if (markup) {
		markup.tag.addInlined('style', 'css');
		markup.tag.addAttribute('style', 'css');
	}

}(Prism));


/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
			lookbehind: true,
			greedy: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true,
			greedy: true
		}
	],
	'string': {
		pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
		lookbehind: true,
		inside: {
			'punctuation': /[.\\]/
		}
	},
	'keyword': /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
	'boolean': /\b(?:false|true)\b/,
	'function': /\b\w+(?=\()/,
	'number': /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
	'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'class-name': [
		Prism.languages.clike['class-name'],
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
			lookbehind: true
		}
	],
	'keyword': [
		{
			pattern: /((?:^|\})\s*)catch\b/,
			lookbehind: true
		},
		{
			pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
			lookbehind: true
		},
	],
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
	'number': {
		pattern: RegExp(
			/(^|[^\w$])/.source +
			'(?:' +
			(
				// constant
				/NaN|Infinity/.source +
				'|' +
				// binary integer
				/0[bB][01]+(?:_[01]+)*n?/.source +
				'|' +
				// octal integer
				/0[oO][0-7]+(?:_[0-7]+)*n?/.source +
				'|' +
				// hexadecimal integer
				/0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source +
				'|' +
				// decimal bigint
				/\d+(?:_\d+)*n/.source +
				'|' +
				// decimal number (integer or float) but no bigint
				/(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source
			) +
			')' +
			/(?![\w$])/.source
		),
		lookbehind: true
	},
	'operator': /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
});

Prism.languages.javascript['class-name'][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: RegExp(
			// lookbehind
			// eslint-disable-next-line regexp/no-dupe-characters-character-class
			/((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source +
			// Regex pattern:
			// There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
			// classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
			// with the only syntax, so we have to define 2 different regex patterns.
			/\//.source +
			'(?:' +
			/(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source +
			'|' +
			// `v` flag syntax. This supports 3 levels of nested character classes.
			/(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source +
			')' +
			// lookahead
			/(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
		),
		lookbehind: true,
		greedy: true,
		inside: {
			'regex-source': {
				pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
				lookbehind: true,
				alias: 'language-regex',
				inside: Prism.languages.regex
			},
			'regex-delimiter': /^\/|\/$/,
			'regex-flags': /^[a-z]+$/,
		}
	},
	// This must be declared before keyword because we use "function" inside the look-forward
	'function-variable': {
		pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
		alias: 'function'
	},
	'parameter': [
		{
			pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		}
	],
	'constant': /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});

Prism.languages.insertBefore('javascript', 'string', {
	'hashbang': {
		pattern: /^#!.*/,
		greedy: true,
		alias: 'comment'
	},
	'template-string': {
		pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
		greedy: true,
		inside: {
			'template-punctuation': {
				pattern: /^`|`$/,
				alias: 'string'
			},
			'interpolation': {
				pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
				lookbehind: true,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	},
	'string-property': {
		pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
		lookbehind: true,
		greedy: true,
		alias: 'property'
	}
});

Prism.languages.insertBefore('javascript', 'operator', {
	'literal-property': {
		pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
		lookbehind: true,
		alias: 'property'
	},
});

if (Prism.languages.markup) {
	Prism.languages.markup.tag.addInlined('script', 'javascript');

	// add attribute support for all DOM events.
	// https://developer.mozilla.org/en-US/docs/Web/Events#Standard_events
	Prism.languages.markup.tag.addAttribute(
		/on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
		'javascript'
	);
}

Prism.languages.js = Prism.languages.javascript;


/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {

	if (typeof Prism === 'undefined' || typeof document === 'undefined') {
		return;
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
	if (!Element.prototype.matches) {
		Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
	}

	var LOADING_MESSAGE = 'Loading…';
	var FAILURE_MESSAGE = function (status, message) {
		return '✖ Error ' + status + ' while fetching file: ' + message;
	};
	var FAILURE_EMPTY_MESSAGE = '✖ Error: File does not exist or is empty';

	var EXTENSIONS = {
		'js': 'javascript',
		'py': 'python',
		'rb': 'ruby',
		'ps1': 'powershell',
		'psm1': 'powershell',
		'sh': 'bash',
		'bat': 'batch',
		'h': 'c',
		'tex': 'latex'
	};

	var STATUS_ATTR = 'data-src-status';
	var STATUS_LOADING = 'loading';
	var STATUS_LOADED = 'loaded';
	var STATUS_FAILED = 'failed';

	var SELECTOR = 'pre[data-src]:not([' + STATUS_ATTR + '="' + STATUS_LOADED + '"])'
		+ ':not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';

	/**
	 * Loads the given file.
	 *
	 * @param {string} src The URL or path of the source file to load.
	 * @param {(result: string) => void} success
	 * @param {(reason: string) => void} error
	 */
	function loadFile(src, success, error) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', src, true);
		xhr.onreadystatechange = function () {
			if (xhr.readyState == 4) {
				if (xhr.status < 400 && xhr.responseText) {
					success(xhr.responseText);
				} else {
					if (xhr.status >= 400) {
						error(FAILURE_MESSAGE(xhr.status, xhr.statusText));
					} else {
						error(FAILURE_EMPTY_MESSAGE);
					}
				}
			}
		};
		xhr.send(null);
	}

	/**
	 * Parses the given range.
	 *
	 * This returns a range with inclusive ends.
	 *
	 * @param {string | null | undefined} range
	 * @returns {[number, number | undefined] | undefined}
	 */
	function parseRange(range) {
		var m = /^\s*(\d+)\s*(?:(,)\s*(?:(\d+)\s*)?)?$/.exec(range || '');
		if (m) {
			var start = Number(m[1]);
			var comma = m[2];
			var end = m[3];

			if (!comma) {
				return [start, start];
			}
			if (!end) {
				return [start, undefined];
			}
			return [start, Number(end)];
		}
		return undefined;
	}

	Prism.hooks.add('before-highlightall', function (env) {
		env.selector += ', ' + SELECTOR;
	});

	Prism.hooks.add('before-sanity-check', function (env) {
		var pre = /** @type {HTMLPreElement} */ (env.element);
		if (pre.matches(SELECTOR)) {
			env.code = ''; // fast-path the whole thing and go to complete

			pre.setAttribute(STATUS_ATTR, STATUS_LOADING); // mark as loading

			// add code element with loading message
			var code = pre.appendChild(document.createElement('CODE'));
			code.textContent = LOADING_MESSAGE;

			var src = pre.getAttribute('data-src');

			var language = env.language;
			if (language === 'none') {
				// the language might be 'none' because there is no language set;
				// in this case, we want to use the extension as the language
				var extension = (/\.(\w+)$/.exec(src) || [, 'none'])[1];
				language = EXTENSIONS[extension] || extension;
			}

			// set language classes
			Prism.util.setLanguage(code, language);
			Prism.util.setLanguage(pre, language);

			// preload the language
			var autoloader = Prism.plugins.autoloader;
			if (autoloader) {
				autoloader.loadLanguages(language);
			}

			// load file
			loadFile(
				src,
				function (text) {
					// mark as loaded
					pre.setAttribute(STATUS_ATTR, STATUS_LOADED);

					// handle data-range
					var range = parseRange(pre.getAttribute('data-range'));
					if (range) {
						var lines = text.split(/\r\n?|\n/g);

						// the range is one-based and inclusive on both ends
						var start = range[0];
						var end = range[1] == null ? lines.length : range[1];

						if (start < 0) { start += lines.length; }
						start = Math.max(0, Math.min(start - 1, lines.length));
						if (end < 0) { end += lines.length; }
						end = Math.max(0, Math.min(end, lines.length));

						text = lines.slice(start, end).join('\n');

						// add data-start for line numbers
						if (!pre.hasAttribute('data-start')) {
							pre.setAttribute('data-start', String(start + 1));
						}
					}

					// highlight code
					code.textContent = text;
					Prism.highlightElement(code);
				},
				function (error) {
					// mark as failed
					pre.setAttribute(STATUS_ATTR, STATUS_FAILED);

					code.textContent = error;
				}
			);
		}
	});

	Prism.plugins.fileHighlight = {
		/**
		 * Executes the File Highlight plugin for all matching `pre` elements under the given container.
		 *
		 * Note: Elements which are already loaded or currently loading will not be touched by this method.
		 *
		 * @param {ParentNode} [container=document]
		 */
		highlight: function highlight(container) {
			var elements = (container || document).querySelectorAll(SELECTOR);

			for (var i = 0, element; (element = elements[i++]);) {
				Prism.highlightElement(element);
			}
		}
	};

	var logged = false;
	/** @deprecated Use `Prism.plugins.fileHighlight.highlight` instead. */
	Prism.fileHighlight = function () {
		if (!logged) {
			console.warn('Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.');
			logged = true;
		}
		Prism.plugins.fileHighlight.highlight.apply(this, arguments);
	};

}());
			const prismLocal = Prism;
			if (typeof window !== "undefined") { try { delete window.Prism; } catch (error) { window.Prism = void 0; } }
			return prismLocal;
		})();

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
		function FileRow({ row, level, selected, onDown, onEnter, onPreview }) {
			const key = `file:${row.path}`;
			const picked = selected[key] === true;
			const tone = toneOf(row);
			return hs("div", {
				key: row.path,
				className: `dshg-row${picked ? " dshg-rowSel" : ""}`,
				style: { paddingLeft: `${6 + level * 14}px` },
				// Right button selects (and starts drag-select); left button opens the
				// file's change preview.
				onMouseDown: (event) => { if (event.button === 2) onDown(row.path); },
				onMouseEnter: () => onEnter(row.path),
				onContextMenu: (event) => { event.preventDefault(); },
				onClick: () => { if (typeof onPreview === "function") onPreview(row.path); },
				children: [
					h("span", { className: `dshg-letter ${letterTone(row.letter)}`, children: row.letter }),
					row.working ? h(WarnDot, {}) : null,
					h("span", { className: `dshg-path ${tone}`, title: row.path, children: basename(row.path) })
				]
			});
		}

		/** Recursive directory rendering (indent = level). */
		function TreeNodes({ node, level, collapsed, selected, onToggle, onDown, onEnter, onGroupToggle, onPreview }) {
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
								// Right click toggles the whole folder's selection.
								onContextMenu: (event) => {
									event.preventDefault();
									if (typeof onGroupToggle === "function") onGroupToggle(paths, !allSelected);
								},
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
									target.files.map((row) => h(FileRow, { key: row.path, row, level: level + 1, selected, onDown, onEnter, onPreview })),
									h(TreeNodes, { node: target, level: level + 1, collapsed, selected, onToggle, onDown, onEnter, onGroupToggle, onPreview })
								]
							})
						]
					});
				})
			});
		}

		/** Timeline row: click expands, double click opens the detail pane. */
		/**
		 * Branch creation as its own timeline row. A commit graph cannot express it, so it
		 * gets a green dot on the single track plus a card.
		 */
		/** Stable per-branch colour derived from its name (same branch => same colour). */
		function branchHue(name) {
			let hash = 0;
			for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
			return hash % 360;
		}

		function branchColor(name) {
			return `hsl(${branchHue(name)} 62% 52%)`;
		}

		/** Icon colour that stays readable on top of the branch colour. */
		function branchIconColor(name) {
			// hsl(h, 62%, 52%) -> rough relative luminance; light hues get a dark glyph.
			const hue = branchHue(name) / 360;
			const channel = (offset) => {
				const k = (offset + hue * 12) % 12;
				const a = 0.62 * Math.min(0.52, 1 - 0.52);
				return 0.52 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
			};
			const luminance = 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
			return luminance > 0.42 ? "#10202e" : "#ffffff";
		}

		/** Reflog actors are stored as "Name <email>"; show just the name. */
		function actorName(actor) {
			return String(actor ?? "").replace(/\s*<[^>]*>\s*/g, "").trim() || "（未知）";
		}

		/**
		 * Branch creation as its own timeline row (a commit graph cannot express it).
		 * Collapsed it is two lines; the detail line stays a single row.
		 */
		function BranchEventRow({ events }) {
			const first = events[0];
			const name = first.ref.replace(/^refs\/heads\//, "") || "（未知分支）";
			const base = /Created from\s+(.+)$/i.exec(first.message)?.[1]?.trim() ?? "";
			const color = branchColor(name);
			const baseLabel = base.length > 0 ? base : "（未知）";
			return h("div", {
				className: "dshg-eventRow",
				title: first.message,
				children: [
					h("span", {
						className: "dshg-nodeWrap",
						children: h("span", {
							className: "dshg-eventDot",
							style: { background: color },
							children: h("span", { className: "dshg-eventIcon", style: { color: branchIconColor(name) }, children: "+" })
						})
					}),
					h("div", {
						className: "dshg-eventCard",
						children: [
							h("span", { className: "dshg-eventTitle", children: ["创建分支 ", h("span", { className: "dshg-branchName", style: { color }, children: name })] }),
							h("span", {
								className: "dshg-eventMeta",
								children: `基于 ${baseLabel}（${first.newHash.slice(0, 8)}） ${baseLabel}分支 · ${actorName(first.actor)} · ${formatDate(first.date, translate)}`
							})
						]
					})
				]
			});
		}

		/**
		 * A merge that produced no commit (fast-forward): nothing to expand, so it is a
		 * plain row. Title reads "快进合并 <branch> → <target>".
		 */
		function MergeEventRow({ events }) {
			const first = events[0];
			const branch = first.message.replace(/^merge\s+/i, "").split(":")[0].trim() || first.ref.replace(/^refs\/heads\//, "");
			const target = first.ref.replace(/^refs\/heads\//, "") || "（未知）";
			const kind = /fast-forward/i.test(first.message) ? "快进" : "";
			const color = branchColor(branch);
			return h("div", {
				className: "dshg-eventRow",
				title: first.message,
				children: [
					h("span", {
						className: "dshg-nodeWrap",
						children: h("span", {
							className: "dshg-eventDot",
							style: { background: color },
							children: h("span", { className: "dshg-eventIconArrow", style: { color: branchIconColor(branch) }, children: "⇄" })
						})
					}),
					h("div", {
						className: "dshg-eventCard",
						children: [
							h("span", {
								className: "dshg-eventTitle",
								children: [
									kind.length > 0 ? `${kind}合并 ` : "合并 ",
									h("span", { className: "dshg-branchName", style: { color }, children: branch }),
									" → ",
									h("span", { children: target })
								]
							}),
							h("span", {
								className: "dshg-eventMeta",
								children: `${first.oldHash.slice(0, 8)} → ${first.newHash.slice(0, 8)} · ${actorName(first.actor)} · ${formatDate(first.date, translate)}`
							})
						]
					})
				]
			});
		}

		function CommitRow({ commit, index, reflog, expanded, detailOpen, isFirst, isNewest, onToggle, onOpenDetail, onAction }) {
			const isMerge = Array.isArray(commit.parents) && commit.parents.length > 1;
			// Direction of a merge commit: "<source> → <target>", recovered from the merge
			// reflog event that produced it.
			const mergeEvent = (Array.isArray(reflog) ? reflog : []).find((item) => item.action.startsWith("merge"));
			const mergeSourceName = mergeEvent === void 0
				? "merge"
				: mergeEvent.action.replace(/^merge\s+/i, "").split(":")[0].trim();
			const mergeIconColor = branchIconColor(mergeSourceName);
			const mergeLabel = isMerge === false
				? "合并"
				: mergeEvent === void 0
					? "合并"
					: `合并 ${mergeSourceName} → ${(Array.isArray(commit.refs) && commit.refs.length > 0 ? commit.refs[0] : "main")}`;
			// A merge commit is still a commit: same dot colour as any other commit.
			const dot = "dshg-dotPlain";
			const subjectRef = (0, react.useRef)(null);
			const [marquee, setMarquee] = (0, react.useState)(false);
			const marqueeAnim = (0, react.useRef)(null);
			const hoverRef = (0, react.useRef)(false);
			// Single-click delay, so a double click can cancel it.
			const clickTimer = (0, react.useRef)(null);
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
				"data-commit": commit.hash,
				className: `dshg-commit${expanded ? " dshg-commitOpen" : ""}${isNewest ? " dshg-commitFirst" : ""}`,
				// The whole card is the click target (head AND expanded body). Detection
				// happens on MOUSE DOWN so the second press of a double click reacts
				// immediately; inner buttons are skipped explicitly.
				onMouseDown: (event) => {
					if (event.button !== 0) return;
					const target = event.target;
					if (target !== null && target !== void 0 && typeof target.closest === "function" && target.closest("button") !== null) return;
					if ((event.detail ?? 0) >= 2) {
						if (clickTimer.current !== null) {
							clearTimeout(clickTimer.current);
							clickTimer.current = null;
						}
						if (isFirst !== true) onOpenDetail(commit.hash);
						return;
					}
					if (clickTimer.current !== null) clearTimeout(clickTimer.current);
					clickTimer.current = window.setTimeout(() => {
						clickTimer.current = null;
						onToggle();
					}, 200);
				},
				children: [
					h("span", {
						className: "dshg-nodeWrap",
						children: [
							// Branch tips get a coloured triangle pointing at the dot from the left.
							Array.isArray(commit.refs) && commit.refs.some((ref) => ref !== "HEAD")
								? h("span", {
									className: "dshg-branchArrow",
									style: {
										borderLeftColor: branchColor(commit.refs.find((ref) => ref !== "HEAD").replace(/^HEAD -> /, ""))
									}
								})
								: null,
							h("span", {
								className: `dshg-node ${dot}${expanded || detailOpen ? " dshg-nodeActive" : ""}${isMerge ? " dshg-nodeMergeIcon" : ""}`,
								style: isMerge === true ? { background: branchColor(mergeSourceName) } : void 0,
								// Merge glyph: the left line stays put, the right one slants INTO it
								// from below (branch merging upward into the main line).
								children: isMerge === true ? h("svg", {
									width: 8,
									height: 8,
									viewBox: "0 0 8 8",
									style: { transform: "translate(-0.5px, 0.5px)" },
									children: [
										h("path", { d: "M 2.2 1 L 2.2 7", stroke: mergeIconColor, strokeWidth: 1.4, fill: "none", strokeLinecap: "round" }),
										// Diagonal straight line merging up into the left rail.
										h("path", { d: "M 5.8 7 L 2.2 3.4", stroke: mergeIconColor, strokeWidth: 1.4, fill: "none", strokeLinecap: "round" })
									]
								}) : null
							})
						]
					}),
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
										isMerge ? h("span", { className: "dshg-detached", children: mergeLabel }) : null
									]
								}),
								Array.isArray(commit.refs) && commit.refs.length > 0 ? h("div", {
									className: `dshg-refs${expanded ? " dshg-refsShow" : ""}`,
									children: commit.refs.slice(0, 4).map((ref) => {
										const isHead = ref === "HEAD";
										const name = ref.replace(/^HEAD -> /, "");
										const color = isHead ? void 0 : branchColor(name);
										return h("span", {
											key: ref,
											className: `dshg-ref${isHead ? " dshg-refHead" : ""}`,
											style: color === void 0 ? void 0 : { background: `color-mix(in srgb, ${color} 22%, transparent)`, color },
											children: ref
										});
									})
								}) : null,
								// Reflog events that belong to this commit but have no dedicated row
								// (merge of a real merge commit, reset, ...).
								(Array.isArray(reflog) ? reflog : []).length > 0 ? h("div", {
									className: `dshg-refs${expanded ? " dshg-refsShow" : ""}`,
									children: (Array.isArray(reflog) ? reflog : []).slice(0, 3).map((event, i) => h("span", {
										key: `${event.action}-${i}`,
										className: "dshg-ref dshg-refEvent",
										title: `${event.message} · ${event.actor}`,
										children: event.action
									}))
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

		/** Pick a Prism grammar from the file extension. */
		function languageOf(path) {
			const ext = String(path ?? "").toLowerCase().split(".").pop();
			if (ext === "json") return "json";
			if (ext === "css" || ext === "scss" || ext === "less") return "css";
			if (ext === "html" || ext === "htm" || ext === "xml" || ext === "svg" || ext === "md") return "markup";
			return "javascript";
		}

		/** Prism highlight with a hard fallback: highlighting must never break a row. */
		function highlightPatchLine(code, language) {
			if (code === "") return null;
			if (typeof Prism === "undefined" || Prism === null || typeof Prism.highlight !== "function") return null;
			const grammar = (Prism.languages !== void 0 && Prism.languages !== null)
				? (Prism.languages[language] ?? Prism.languages.javascript)
				: void 0;
			if (grammar === void 0) return null;
			try {
				return Prism.highlight(code, grammar, Prism.languages[language] !== void 0 ? language : "javascript");
			} catch (error) {
				return null;
			}
		}

		/** Render a patch as coloured lines (+ green, - red, @@ muted). */
		/**
		 * Render a patch as coloured lines with line numbers.
		 * Memoised on (patch, language): without it every parent re-render re-ran
		 * Prism over the entire diff, which is what made large diffs feel laggy.
		 * Very long diffs are capped and fall back to plain text.
		 */
		function PatchLines({ patch, language }) {
			const text = typeof patch === "string" ? patch : "";
			const rows = (0, react.useMemo)(() => {
				if (text === "") return null;
				const all = text.split("\n");
				const MAX_LINES = 1500;
				// Past this size, skip syntax highlighting entirely: it is the
				// expensive part and costs far more than it adds on huge diffs.
				const plain = all.length > 400;
				const lines = all.length > MAX_LINES ? all.slice(0, MAX_LINES) : all;
				let scanOld = 0;
				let scanNew = 0;
				let maxNo = 0;
				for (const line of lines) {
					if (line.startsWith("@@")) {
						const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
						if (match !== null) {
							scanOld = Number(match[1]);
							scanNew = Number(match[2]);
							maxNo = Math.max(maxNo, scanOld, scanNew);
						}
					} else if (line.startsWith("+")) {
						scanNew += 1;
						maxNo = Math.max(maxNo, scanNew);
					} else if (line.startsWith("-")) {
						scanOld += 1;
						maxNo = Math.max(maxNo, scanOld);
					} else if (line.length > 0 && !line.startsWith("diff ") && !line.startsWith("index ") && !line.startsWith("--- ") && !line.startsWith("+++ ")) {
						scanOld += 1;
						scanNew += 1;
						maxNo = Math.max(maxNo, scanOld, scanNew);
					}
				}
				const digits = Math.max(2, String(maxNo).length);
				const lnStyle = { width: `${digits}ch` };
				const out = [];
				let oldNo = 0;
				let newNo = 0;
				for (let index = 0; index < lines.length; index += 1) {
					const line = lines[index];
					// Git plumbing headers: the file name is already the pane's title.
					if (
						line.startsWith("diff --git") ||
						line.startsWith("index ") ||
						line.startsWith("new file mode") ||
						line.startsWith("deleted file mode") ||
						line.startsWith("old mode") ||
						line.startsWith("new mode") ||
						line.startsWith("similarity index") ||
						line.startsWith("rename from") ||
						line.startsWith("rename to") ||
						line.startsWith("--- ") ||
						line.startsWith("+++ ")
					) continue;
					if (line.startsWith("@@")) {
						const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
						if (match !== null) {
							oldNo = Number(match[1]);
							newNo = Number(match[2]);
						}
						out.push(h("div", {
							key: index,
							className: "dshg-hunkRow",
							children: match === null ? line : `⋯ 第 ${newNo} 行附近 ⋯`
						}));
						continue;
					}
					if (line === "\\ No newline at end of file") {
						out.push(h("div", { key: index, className: "dshg-hunkRow", children: "（文件末尾没有换行）" }));
						continue;
					}
					const isAdd = line.startsWith("+");
					const isDel = line.startsWith("-");
					const content = line.length > 0 ? line.slice(1) : "";
					const oldShown = isAdd ? "" : String(oldNo);
					const newShown = isDel ? "" : String(newNo);
					if (!isAdd) oldNo += 1;
					if (!isDel) newNo += 1;
					const highlighted = plain ? null : highlightPatchLine(content, language ?? "javascript");
					out.push(h("div", {
						key: index,
						className: `dshg-pl ${isAdd ? "dshg-add" : isDel ? "dshg-del" : "dshg-ctx"}`,
						children: [
							h("span", { className: "dshg-ln", style: lnStyle, children: oldShown }),
							h("span", { className: "dshg-ln", style: lnStyle, children: newShown }),
							h("span", { className: "dshg-sign", children: isAdd ? "+" : isDel ? "-" : "\u00a0" }),
							h("span", highlighted === null
								? { className: "dshg-code", children: content === "" ? "\u00a0" : content }
								: { className: "dshg-code", dangerouslySetInnerHTML: { __html: highlighted } })
						]
					}));
				}
				if (all.length > MAX_LINES) {
					out.push(h("div", { key: "truncated", className: "dshg-hunkRow", children: `⋯ 改动过长，仅显示前 ${MAX_LINES} 行（共 ${all.length} 行）` }));
				}
				return out;
			}, [text, language]);
			if (rows === null) return h("div", { className: "dshg-empty", children: "（没有文本改动）" });
			return h("div", { className: "dshg-patchLines", children: rows });
		}

		/** Slide-up commit detail: grouped files + one file's patch. */
		function DetailPane({ open, detailHash, detail, detailError, detailLoading, detailReady, filePath, fileDiff, fileDiffError, fileDiffLoading, fileDiffReady, workPath, workDiff, workDiffLoading, workDiffError, workDiffReady, conflictPath, conflictFile, conflictFileError, conflictFileLoading, onClose, onPickFile, onCloseFile, onCloseWork, onCloseConflict, onMarkResolved }) {
			// Only render payloads that belong to the current selection; anything else
			// is stale cache from the previous commit/file and must not flash.
			const detailReadyNow = detailReady === true;
			const fileDiffReadyNow = fileDiffReady === true;
			const files = detailReadyNow === true && Array.isArray(detail?.files) ? detail.files : [];
			const added = files.filter((file) => file.status === "A");
			const deleted = files.filter((file) => file.status === "D");
			const modified = files.filter((file) => file.status !== "A" && file.status !== "D");
			const groups = [
				{ key: "A", label: "新增", rows: added },
				{ key: "M", label: "修改", rows: modified },
				{ key: "D", label: "删除", rows: deleted }
			];
			// Working mode: the same bottom pane shows one working-tree file's patch.
			const isWork = typeof workPath === "string" && workPath.length > 0;
			// Conflict mode: the file's worktree copy with its markers.
			const isConflict = typeof conflictPath === "string" && conflictPath.length > 0;
			// Height motion: FLIP via WAAPI, driven by a ResizeObserver on the INNER
			// element. The observer is what keeps the animation in sync with the real
			// content: a mode switch renders twice (loading state, then the patch), and
			// an update only observed at contentKey time would animate to the loading
			// height and then jump.
			// NOTE: the key deliberately EXCLUDES filePath — expanding a file's patch
			// inside a commit must not resize the whole pane; that patch scrolls
			// inside it instead.
			const contentKey = isConflict ? `conflict:${conflictPath}` : isWork ? `work:${workPath}` : `commit:${detailHash ?? ""}`;
			const paneRef = (0, react.useRef)(null);
			const paneLast = (0, react.useRef)(0);
			const paneAnim = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				const el = paneRef.current;
				if (el === null || el === void 0) return void 0;
				const inner = el.firstElementChild;
				if (inner === null || inner === void 0) return void 0;
				const viewHeight = () => (typeof window !== "undefined" && Number.isFinite(window.innerHeight) ? window.innerHeight : 800);
				// Cap the pane at 56% of the viewport AND half of the drawer: with many
				// changed files the list scrolls inside the pane instead of eating the
				// whole sidebar, so the timeline above always keeps at least half.
				const capHeight = () => {
					let cap = viewHeight() * 0.56;
					const parent = el.parentElement;
					if (parent !== null && parent !== void 0 && Number.isFinite(parent.clientHeight) && parent.clientHeight > 0) {
						cap = Math.min(cap, parent.clientHeight * 0.5);
					}
					return cap;
				};
				const apply = () => {
					// Give the patch block priority: before measuring the pane, cap the file
					// list to whatever space is left after the header and the patch.
					if (open === true) {
						const listEl = el.querySelector(".dshg-detailList");
						const patchEl = el.querySelector(".dshg-fileDiff");
						if (listEl !== null && listEl !== void 0 && patchEl !== null && patchEl !== void 0) {
							const headEl = el.querySelector(".dshg-detailHead");
							const headH = headEl !== null && headEl !== void 0 ? headEl.offsetHeight : 0;
							const patchH = patchEl.offsetHeight;
							const natural = listEl.scrollHeight;
							const available = Math.max(72, capHeight() - headH - patchH - 14);
							listEl.style.maxHeight = `${Math.round(Math.min(natural, available))}px`;
						}
					}
					// Hold the current height until the payload that belongs to the current
					// selection has arrived: the placeholder content is empty, and measuring
					// it would shrink the pane before the real content lands.
					if (open === true) {
						const ready = isConflict === true
							? conflictFileLoading !== true
							: isWork === true
								? workDiffReady === true
								: detailReady === true && (filePath === null || fileDiffReady === true);
						if (ready !== true) {
							// Keep a small, stable placeholder instead of letting the CSS
							// fall back to `height:auto` (which made the pane fill the sidebar
							// while the first payload was still loading).
							if (el.style.height === "") el.style.height = `${paneLast.current > 0 ? paneLast.current : 120}px`;
							return;
						}
					}
					const target = open === true
						? Math.round(Math.min(inner.getBoundingClientRect().height, capHeight()))
						: 0;
					const previous = paneLast.current;
					paneLast.current = target;
					if (typeof el.animate !== "function") {
						el.style.height = `${target}px`;
						return;
					}
					// Animate in BOTH directions: grow (open / bigger content) and
					// shrink (mode switch / collapse). The inline height always ends at
					// the exact target, so nothing stale survives.
					if (Math.abs(target - previous) <= 1 && el.style.height !== "") return;
					if (paneAnim.current !== null) {
						try { paneAnim.current.cancel(); } catch (error) { /* already gone */ }
						paneAnim.current = null;
					}
					el.style.height = `${previous}px`;
					const anim = el.animate(
						[{ height: `${previous}px` }, { height: `${target}px` }],
						{ duration: 220, easing: "cubic-bezier(.4, 0, .2, 1)" }
					);
					paneAnim.current = anim;
					anim.finished.then(() => {
						if (paneAnim.current === anim) {
							paneAnim.current = null;
							el.style.height = `${target}px`;
						}
					}).catch(() => { /* cancelled */ });
				};
				apply();
				if (typeof ResizeObserver !== "function") return void 0;
				const observer = new ResizeObserver(apply);
				observer.observe(inner);
				return () => observer.disconnect();
			}, [contentKey, open, workDiffReady, detailReady, conflictFileLoading]);
			const patch = fileDiffReadyNow === true && typeof fileDiff?.patch === "string" ? fileDiff.patch : "";
			const workPatch = typeof workDiff?.patch === "string" ? workDiff.patch : "";
			// Only trust the cached patch when it belongs to THIS file: after A -> commit
			// -> B the store still held A's patch, and rendering it flashed A's diff.
			const showWorkPatch = workDiffReady === true ? workPatch : "";
			return hs("div", {
				className: `dshg-detail${open ? " dshg-detailOpen" : ""}`,
				ref: paneRef,
				children: hs("div", {
					// A new key remounts the content on a mode switch, which replays
					// the fade-in animation (the height itself is capped by CSS).
					key: isConflict ? "conflict" : isWork ? "work" : "commit",
					className: "dshg-detailInner",
					children: [
						hs("div", {
							className: "dshg-detailHead",
							children: [
								h("span", {
									className: "dshg-detailTitle",
									children: isConflict
										? `冲突文件：${basename(conflictPath)}`
										: isWork
											? `工作区改动：${basename(workPath)}`
											: detailHash === null ? "" : `提交 ${String(detailHash).slice(0, 8)} 的改动`
								}),
								isConflict ? h("button", {
									type: "button",
									className: "dshg-op dshg-opResolve",
									disabled: conflictFileLoading === true,
									onClick: () => onMarkResolved(conflictPath),
									children: "标记已解决"
								}) : null,
								(isConflict ? conflictFileLoading === true : isWork ? workDiffLoading === true : detailLoading === true) ? h("span", { className: "dshg-spinner" }) : null,
								h("button", {
									type: "button",
									className: "dshg-iconButton",
									onClick: isConflict ? onCloseConflict : isWork ? onCloseWork : onClose,
									children: h(CloseIcon, { size: 12 })
								})
							]
						}),
						isConflict
							? h(ConflictView, {
								file: conflictFile,
								loading: conflictFileLoading === true,
								error: conflictFileError
							})
							: isWork
							? h("div", {
								className: "dshg-detailWork",
								children: workDiffError !== null && workDiffError !== void 0
									? h("div", { className: "dshg-error", children: workDiffError })
									: h(PatchLines, { patch: showWorkPatch, language: languageOf(workPath) })
							})
							: h(react.Fragment, {
								children: [
									detailError !== null && detailError !== void 0 ? h("div", { className: "dshg-error", children: detailError }) : null,
									detailError !== null && detailError !== void 0 ? null : h("div", {
										className: "dshg-detailList",
										children: detailReadyNow === true && detail !== null
											? groups.map((group) => {
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
											: hs("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取提交内容…"] })
									}),
									hs("div", {
										className: `dshg-fileDiff${filePath === null ? " dshg-fileDiffClosed" : ""}`,
										children: [
											fileDiffError !== null && fileDiffError !== void 0
												? h("div", { className: "dshg-error", children: fileDiffError })
												: h(PatchLines, { patch, language: languageOf(filePath) })
										]
									})
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
			// Working-tree file preview popup (opened by left-clicking a file row).
			const [previewPath, setPreviewPath] = (0, react.useState)(null);
			// Branch popover / more menu / recycle bin / conflict pane.
			const [branchOpen, setBranchOpen] = (0, react.useState)(false);
			const [moreOpen, setMoreOpen] = (0, react.useState)(false);
			const [recycleOpen, setRecycleOpen] = (0, react.useState)(false);
			const [conflictOpen, setConflictOpen] = (0, react.useState)(true);
			const [conflictPath, setConflictPath] = (0, react.useState)(null);
			const dragRef = (0, react.useRef)(null);
			// Timestamp of the last finished drag, used to swallow the contextmenu
			// that a right-drag fires over whatever row it ended on.
			const dragEndAt = (0, react.useRef)(0);
			const treeRef = (0, react.useRef)(null);
			const mainRef = (0, react.useRef)(null);
			const autoCollapsed = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				setExpandedHash(null);
				setDetailHash(null);
				setFilePath(null);
				setPreviewPath(null);
				setConflictPath(null);
				setSelected({});
				git.refresh(cwd);
			}, [cwd, git]);
			(0, react.useEffect)(() => {
				const onUp = () => {
					// Remember when a real drag ended: the contextmenu that follows a
					// right-drag must not select a folder it merely passed over.
					if (dragRef.current !== null) dragEndAt.current = Date.now();
					dragRef.current = null;
				};
				document.addEventListener("mouseup", onUp);
				return () => document.removeEventListener("mouseup", onUp);
			}, []);
			(0, react.useEffect)(() => {
				if (state.opMessage === null || state.opMessage === void 0) return void 0;
				const timer = window.setTimeout(() => { setStore({ opMessage: null }); }, 5000);
				return () => window.clearTimeout(timer);
			}, [state.opMessage]);
			(0, react.useEffect)(() => {
				if (branchOpen !== true && moreOpen !== true) return void 0;
				const onDown = (event) => {
					const target = event.target;
					if (target === null || target === void 0 || typeof target.closest !== "function") return;
					if (target.closest(".dshg-pop") !== null) return;
					if (target.closest(".dshg-opsBar") !== null) return;
					setBranchOpen(false);
					setMoreOpen(false);
				};
				document.addEventListener("mousedown", onDown);
				return () => document.removeEventListener("mousedown", onDown);
			}, [branchOpen, moreOpen]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") {
						if (modal !== null) setModal(null);
						else if (recycleOpen === true) setRecycleOpen(false);
						else if (branchOpen === true) setBranchOpen(false);
						else if (moreOpen === true) setMoreOpen(false);
						else if (conflictPath !== null) setConflictPath(null);
						else if (filePath !== null) setFilePath(null);
						else if (detailHash !== null) setDetailHash(null);
						else onClose();
					}
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [modal, filePath, detailHash, onClose, recycleOpen, branchOpen, moreOpen, conflictPath]);

			const snapshot = state.snapshot;
			const repo = snapshot?.repo === true;
			const detached = repo && /^[0-9a-f]{7,40}$/i.test(snapshot?.branch ?? "");
			const operation = state.repoOperation?.operation ?? null;
			const conflicts = Array.isArray(state.repoOperation?.conflicts) ? state.repoOperation.conflicts : [];
			const resolvedFiles = Array.isArray(state.repoOperation?.resolved) ? state.repoOperation.resolved : [];
			const branchList = Array.isArray(state.branchDetails?.branches) ? state.branchDetails.branches : [];
			// The merge modal's target options: detail rows when available, the bare
			// name list as a fallback (older host without branchDetails).
			const branches = branchList.length > 0
				? branchList.map((branch) => branch.name)
				: (state.branch?.branches ?? []).filter((name) => !/^remotes\//.test(name) && !/ -> HEAD/.test(name));
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
			/** Right-click on a folder: select or clear every file below it. */
			const onGroupToggle = (paths, value) => {
				// Only a real right-CLICK on a folder toggles its selection. A right
				// drag that happens to pass over the folder must not.
				if (dragRef.current !== null) return;
				if (Date.now() - dragEndAt.current < 350) return;
				setSelected((previous) => {
					const next = { ...previous };
					for (const path of paths) {
						const key = `file:${path}`;
						if (value === true) next[key] = true;
						else delete next[key];
					}
					return next;
				});
			};
			const doAction = (method, args) => {
				if (method === "merge") {
					const source = args?.source;
					const target = args?.target;
					const mode = args?.mode;
					if (typeof source === "string" && source.length > 0) {
						if (typeof target === "string" && target.length > 0 && target !== (snapshot?.branch ?? "")) {
							// Merge into another branch: switch there first, then merge the source in.
							git.run("checkout", cwd, { target }).then(() => git.run("merge", cwd, { target: source, mode }));
						} else {
							git.run("merge", cwd, { target: source, mode });
						}
					}
				} else if (method === "deleteBranch") {
					git.run("deleteBranch", cwd, { name: args?.name, force: args?.force === true });
				} else if (method === "renameBranch") {
					git.run("renameBranch", cwd, { from: args?.from, to: args?.to });
				} else if (method === "operationAbort") {
					git.run("operationAbort", cwd, { kind: args?.kind });
				} else {
					git.run(method, cwd, args ?? {});
				}
				setModal(null);
				setSelected({});
			};
			const conflictSet = new Set(conflicts.map((file) => file.path));
			/** Left-click on a file: conflict files open the conflict pane instead. */
			const openPreview = (path) => {
				setDetailHash(null);
				setFilePath(null);
				setExpandedHash(null);
				if (conflictSet.has(path)) {
					setPreviewPath(null);
					setConflictPath(path);
					git.refreshConflict(cwd, path);
					return;
				}
				setConflictPath(null);
				setPreviewPath(path);
				git.refreshWorkDiff(cwd, path);
			};
			/** Double click / the 详细 button: expand THIS row and open the pane. */
			const openDetail = (hash) => {
				if (detailHash === hash) { setDetailHash(null); setFilePath(null); return; }
				setExpandedHash(hash);
				setDetailHash(hash);
				setFilePath(null);
				// The two pane modes are exclusive.
				setPreviewPath(null);
				git.refreshDetail(cwd, hash);
				// After the pane opens, bring the selected commit's dot above the pane
				// so its action buttons stay reachable.
				const revealCommit = () => {
					const main = mainRef.current;
					if (main === null || main === void 0) return;
					const row = main.querySelector(`[data-commit="${hash}"]`);
					const pane = main.parentElement ? main.parentElement.querySelector(".dshg-detail") : null;
					if (row === null || row === void 0 || pane === null || pane === void 0) return;
					const paneTop = pane.getBoundingClientRect().top;
					const margin = 24;
					// Use the row's BOTTOM so the expanded action buttons clear the pane.
					const overflowBy = row.getBoundingClientRect().bottom - (paneTop - margin);
					if (overflowBy > 0) {
						if (typeof main.scrollTo === "function") main.scrollTo({ top: main.scrollTop + overflowBy, behavior: "smooth" });
						else main.scrollTop += overflowBy;
					}
				};
				window.setTimeout(revealCommit, 300);
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
			const filesNow = rows.filter((row) => row.staged).map((row) => row.path);
			const opButton = (label, onClick, options = {}) => h("button", {
				type: "button",
				key: options.key ?? label,
				className: `dshg-op${options.danger ? " dshg-opDanger" : ""}${options.primary ? " dshg-opPrimary" : ""}${options.disabled ? " dshg-opDisabled" : ""}${options.active ? " dshg-opActive" : ""}${options.extra ? ` ${options.extra}` : ""}`,
				disabled: options.disabled === true,
				title: options.title,
				onClick,
				children: options.icon ?? label
			});
			const conflictPending = operation !== null ? conflicts.filter((file) => file.blocks > 0).length : 0;
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
			if (operation !== null) {
				// While a merge is in progress git refuses a plain commit; the only
				// meaningful write is "finish it", and only once no markers remain.
				ops.push(opButton(
					conflictPending > 0 ? `完成合并（还剩 ${conflictPending}）` : "完成合并",
					() => git.continueOperation(cwd),
					{ key: "continueOp", primary: true, disabled: state.working || conflictPending > 0 }
				));
			} else if (selectedPaths.length > 0) {
				ops.push(opButton("选中提交", () => setModal({ kind: "commit", paths: selectedPaths }), { key: "commitSel", primary: true, disabled: state.working }));
			} else if (hasStaged) {
				ops.push(opButton("提交存档", () => setModal({ kind: "commit" }), { key: "commit", primary: true, disabled: state.working }));
			}
			if (hasWork) {
				ops.push(opButton("丢弃改动", () => setModal({ kind: "restore" }), { key: "restore", danger: true, disabled: state.working || operation !== null }));
			}
			// Branch + more sit at the right edge of the bar. The branch popover now
			// owns create / switch / merge / rename / delete, so those three old
			// buttons are gone (design doc 4.1).
			ops.push(opButton("", () => {
				setBranchOpen((value) => value !== true);
				setMoreOpen(false);
			}, { key: "branch", icon: h(BranchGlyph, { size: 14 }), title: "分支", extra: "dshg-opIcon dshg-opPush", active: branchOpen }));
			ops.push(opButton("", () => {
				setMoreOpen((value) => value !== true);
				setBranchOpen(false);
			}, { key: "more", icon: h(MoreIcon, { size: 15 }), title: "更多", extra: "dshg-opIcon", active: moreOpen }));
			const timeline = state.log?.commits ?? [];
			// Reflog events split into two buckets:
			//   branch  -> its own row (a commit graph cannot show branch creation)
			//   merge   -> own row ONLY when no merge commit was produced (fast-forward);
			//              a real merge renders as its commit row, so the event becomes a tag.
			const reflogEvents = Array.isArray(state.reflogEvents) ? state.reflogEvents : [];
			const branchRows = new Map();
			const mergeRows = new Map();
			const eventsByHash = new Map();
			for (const event of reflogEvents) {
				if (typeof event?.newHash !== "string" || event.newHash.startsWith("0000000")) continue;
				if (event.action.startsWith("branch")) {
					const list = branchRows.get(event.newHash) ?? [];
					list.push(event);
					branchRows.set(event.newHash, list);
					continue;
				}
				if (event.action.startsWith("merge")) {
					const target = timeline.find((commit) => commit.hash === event.newHash);
					const realMerge = target !== void 0 && Array.isArray(target.parents) && target.parents.length > 1;
					const bucket = realMerge === true ? eventsByHash : mergeRows;
					const list = bucket.get(event.newHash) ?? [];
					list.push(event);
					bucket.set(event.newHash, list);
					continue;
				}
				const others = eventsByHash.get(event.newHash) ?? [];
				others.push(event);
				eventsByHash.set(event.newHash, others);
			}
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
									repo ? h("span", {
										className: detached ? "dshg-badge dshg-badgeWarn" : "dshg-badge",
										title: detached ? "游离 HEAD：当前不在任何分支上" : (snapshot?.branch ?? ""),
										children: detached ? `游离 HEAD（${String(snapshot?.branch ?? "").slice(0, 8)}）` : (snapshot?.branch ?? "")
									}) : null,
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
									h("div", {
										className: "dshg-opsBar",
										children: [
											...ops,
											branchOpen === true ? h(BranchPopover, {
												branches: branchList,
												operation,
												busy: state.working,
												onClose: () => setBranchOpen(false),
												onSwitch: (name) => { setBranchOpen(false); git.run("checkout", cwd, { target: name }); },
												onCreate: () => { setBranchOpen(false); setNewBranchName(""); setModal({ kind: "createBranch" }); },
												onRename: (from) => { setBranchOpen(false); setModal({ kind: "renameBranch", from }); },
												onDelete: (branch) => {
													setBranchOpen(false);
													setModal({ kind: "deleteBranch", name: branch.name, merged: branch.merged, current: branch.current });
												},
												onMerge: (source) => { setBranchOpen(false); setMergeTarget(snapshot?.branch ?? ""); setModal({ kind: "merge", source }); },
												onJumpCommit: (hash) => {
													setBranchOpen(false);
													setExpandedHash(hash);
													const main = mainRef.current;
													const row = main === null || main === void 0 ? null : main.querySelector(`[data-commit="${hash}"]`);
													if (row !== null && row !== void 0 && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "center", behavior: "smooth" });
												},
												onJumpEvent: (hash) => {
													setBranchOpen(false);
													const main = mainRef.current;
													const node = main === null || main === void 0 ? null : main.querySelector(`[data-branch-event="${hash}"]`);
													if (node !== null && node !== void 0 && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "center", behavior: "smooth" });
												}
											}) : null,
											moreOpen === true ? h(MoreMenu, {
												onClose: () => setMoreOpen(false),
												onRecycle: () => { setMoreOpen(false); setRecycleOpen(true); git.refreshOrphans(cwd); }
											}) : null
										]
									}),
									operation !== null ? h(ConflictBanner, {
										operation,
										conflicts,
										resolved: resolvedFiles,
										open: conflictOpen,
										busy: state.working,
										onToggle: () => setConflictOpen((value) => value !== true),
										onContinue: () => git.continueOperation(cwd),
										onAbort: () => setModal({ kind: "abortOperation", kindName: operation.kind }),
										onOpenFile: (path) => {
											setConflictPath(path);
											setDetailHash(null);
											setFilePath(null);
											setPreviewPath(null);
											setExpandedHash(null);
											git.refreshConflict(cwd, path);
										},
										activePath: conflictPath
									}) : null,
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
														tree.files.map((row) => h(FileRow, {
															key: row.path,
															row,
															level: 0,
															selected,
															onDown: onRowDown,
															onEnter: onRowEnter,
															onPreview: openPreview
														})),
														h(TreeNodes, {
															node: tree,
															level: 0,
															collapsed: collapsedDirs,
															selected,
															onToggle: (path) => setCollapsedDirs((previous) => ({ ...previous, [path]: !previous[path] })),
															onDown: onRowDown,
															onEnter: onRowEnter,
															onGroupToggle,
															onPreview: openPreview
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
														: timeline.flatMap((commit, index) => {
															const rows = [];
															const branchHere = branchRows.get(commit.hash) ?? [];
															if (branchHere.length > 0) rows.push(h(BranchEventRow, { key: `branch-${commit.hash}`, events: branchHere }));
															const mergeHere = mergeRows.get(commit.hash) ?? [];
															if (mergeHere.length > 0) rows.push(h(MergeEventRow, { key: `merge-${commit.hash}`, events: mergeHere, onOpenDetail: openDetail }));
															rows.push(h(CommitRow, {
																key: commit.hash,
																commit,
																index,
																reflog: eventsByHash.get(commit.hash) ?? [],
																expanded: expandedHash === commit.hash,
																detailOpen: detailHash === commit.hash,
																isFirst: index === timeline.length - 1,
																isNewest: index === 0,
																onToggle: () => toggleRow(commit.hash),
																onOpenDetail: openDetail,
																onAction: (kind, hash) => setModal({ kind, hash })
															}));
															return rows;
														})
												})
											})
										]
									}),
									// The pane is a flex child of the drawer (not of the scrolling
									// column), so it is pinned to the sidebar's bottom edge and
									// expands upward from there.
									h(Safeguard, {
										fallback: (error) => h("div", { className: "dshg-error", children: `详情渲染出错：${error?.message ?? "unknown"}` }),
										children: h(DetailPane, {
											open: detailHash !== null || previewPath !== null || conflictPath !== null,
											detailHash,
											detail: state.detail,
											detailError: state.detailError,
											detailLoading: state.detailLoading,
											detailReady: state.detailLoadedHash === detailHash,
											filePath,
											fileDiff: state.fileDiff,
											fileDiffError: state.fileDiffError,
											fileDiffLoading: state.fileDiffLoading,
											fileDiffReady: state.fileDiffLoadedKey === `${detailHash}:${filePath}`,
											workPath: previewPath,
											workDiff: state.workDiff,
											// Ready only when the cached patch belongs to this path AND no
											// request is in flight — otherwise the previous file's patch
											// flashes while the new one loads.
											workDiffReady: state.workDiffPath === previewPath && state.workDiffLoading !== true,
											workDiffLoading: state.workDiffLoading,
											workDiffError: state.workDiffError,
											conflictPath,
											conflictFile: state.conflictFile,
											conflictFileError: state.conflictFileError,
											conflictFileLoading: state.conflictFileLoading,
											onClose: () => { setDetailHash(null); setFilePath(null); },
											onPickFile: (path) => {
												if (filePath === path) { setFilePath(null); return; }
												setFilePath(path);
												git.refreshFileDiff(cwd, detailHash, path);
											},
											onCloseFile: () => setFilePath(null),
											onCloseWork: () => setPreviewPath(null),
											onCloseConflict: () => setConflictPath(null),
											onMarkResolved: (path) => { git.markResolved(cwd, path); setConflictPath(null); }
										})
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
								loadExclusive: (name) => git.exclusive(cwd, name),
								onClose: () => setModal(null)
							}) : null,
							recycleOpen === true ? h(RecycleBin, {
								cwd,
								orphans: state.orphans,
								loading: state.orphansLoading,
								error: state.orphansError,
								onClose: () => setRecycleOpen(false),
								onRefresh: () => git.refreshOrphans(cwd),
								onRestore: (hash) => { setRecycleOpen(false); setModal({ kind: "recoverCommit", hash }); },
								onView: (hash) => { setRecycleOpen(false); setDetailHash(hash); setPreviewPath(null); setConflictPath(null); git.refreshDetail(cwd, hash); },
								onCheckout: (hash) => { setRecycleOpen(false); setModal({ kind: "checkout", hash }); }
							}) : null
						]
					})
				]
			});
		}

		/** Reusable confirm/modal for every git action. */
		function ActionModal({ modal, t, onClose, doAction, commitMsg, setCommitMsg, mergeTarget, setMergeTarget, newBranchName, setNewBranchName, switchTarget, setSwitchTarget, currentBranch, files, branches, loadExclusive }) {
			const [mergeMode, setMergeMode] = (0, react.useState)("no-ff");
			const [renameName, setRenameName] = (0, react.useState)("");
			const [recoverName, setRecoverName] = (0, react.useState)("");
			const [exclusive, setExclusive] = (0, react.useState)(null);
			const [exclusiveLoading, setExclusiveLoading] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (modal.kind !== "deleteBranch" || modal.current === true) return void 0;
				let alive = true;
				setExclusive(null);
				setExclusiveLoading(true);
				Promise.resolve(typeof loadExclusive === "function" ? loadExclusive(modal.name) : null)
					.then((out) => {
						if (alive === false) return;
						setExclusive(Array.isArray(out?.commits) ? out.commits : []);
						setExclusiveLoading(false);
					})
					.catch(() => { if (alive === true) setExclusiveLoading(false); });
				return () => { alive = false; };
			}, [modal.kind, modal.name, loadExclusive]);
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
				const source = typeof modal.source === "string" && modal.source.length > 0 ? modal.source : null;
				const targets = branches.filter((name) => name !== source);
				const target = mergeTarget.trim().length > 0 ? mergeTarget.trim() : (targets.includes(currentBranch) ? currentBranch : targets[0] ?? "");
				title = source === null ? "合并分支" : `合并 ${source}`;
				body = hs(react.Fragment, {
					children: [
						h("div", {
							className: "dshg-mergeModes",
							children: [
								["ff-only", "快速"],
								["no-ff", "三方"],
								["squash", "摘取"]
							].map(([value, label]) => h("button", {
								key: value,
								type: "button",
								className: `dshg-mergeMode${mergeMode === value ? " dshg-mergeModeOn" : ""}`,
								onClick: () => setMergeMode(value),
								children: label
							}))
						}),
						h("div", { className: "dshg-modalDesc", children: "选择要把这个分支合并进的目标分支：" }),
						h("select", {
							className: inputCls,
							value: target,
							onChange: (event) => setMergeTarget(event.target.value),
							children: targets.map((name) => h("option", { value: name, children: name === currentBranch ? `${name}（当前）` : name }, name))
						}),
						h("div", {
							className: "dshg-modalHint",
							children: mergeMode === "ff-only"
								? "快速：只快进，不产生合并提交；两边的提交已经分叉时会被拒绝。"
								: mergeMode === "squash"
									? "摘取：把该分支的改动压成一个新提交，不保留它的提交历史。"
									: "三方：总是生成一个合并提交；有冲突时进入冲突处理。"
						})
					]
				});
				confirmLabel = "合并";
				onOk = () => doAction("merge", { source, target, mode: mergeMode });
			} else if (kind === "deleteBranch") {
				const name = String(modal.name ?? "");
				const isCurrent = modal.current === true;
				const merged = modal.merged === true;
				const list = Array.isArray(exclusive) ? exclusive : [];
				title = `删除分支 ${name}`;
				body = hs(react.Fragment, {
					children: [
						isCurrent
							? h("div", { className: "dshg-modalDesc dshg-modalWarn", children: "这是当前分支。先切换到其他分支再删除。" })
							: merged
								? h("div", { className: "dshg-modalDesc", children: "这个分支的提交都已经并进当前分支，删除不会丢提交。" })
								: hs(react.Fragment, {
									children: [
										h("div", { className: "dshg-modalDesc dshg-modalWarn", children: "这个分支有提交只在这里，安全删除会被 git 拒绝。彻底删除后它们会变成游离提交：" }),
										exclusiveLoading === true ? h("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "统计游离提交…"] }) : null,
										list.length > 0 ? h("div", {
											className: "dshg-modalList",
											children: list.slice(0, 6).map((commit) => h("span", { key: commit.hash, children: `${commit.short} ${commit.subject}` }))
										}) : null,
										h("div", { className: "dshg-modalHint", children: "删除后仍可在「更多 → 回收站」里找回（reflog 保留期内）。" })
									]
								})
					]
				});
				if (isCurrent) {
					confirmLabel = "无法删除";
					onOk = () => {};
					danger = true;
				} else if (merged) {
					confirmLabel = "删除";
					danger = true;
					onOk = () => doAction("deleteBranch", { name });
				} else {
					confirmLabel = "彻底删除";
					danger = true;
					onOk = () => doAction("deleteBranch", { name, force: true });
				}
			} else if (kind === "renameBranch") {
				title = `重命名分支 ${modal.from}`;
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: "输入新的分支名：" }),
						h("input", {
							className: inputCls,
							value: renameName,
							placeholder: "新分支名",
							onChange: (event) => setRenameName(event.target.value),
							autoFocus: true
						})
					]
				});
				confirmLabel = "重命名";
				onOk = () => doAction("renameBranch", { from: modal.from, to: renameName.trim() });
			} else if (kind === "abortOperation") {
				const label = modal.kindName === "squash" ? "摘取合并" : modal.kindName === "revert" ? "还原" : modal.kindName === "rebase" ? "变基" : "合并";
				title = "中止进行中的操作";
				body = h("div", { className: "dshg-modalDesc dshg-modalWarn", children: `中止这次${label}？已解决的进度和你手动改过的冲突文件内容都会被还原。` });
				confirmLabel = "中止";
				danger = true;
				onOk = () => doAction("operationAbort", { kind: modal.kindName });
			} else if (kind === "recoverCommit") {
				title = "恢复为分支";
				body = hs(react.Fragment, {
					children: [
						h("div", { className: "dshg-modalDesc", children: `从这个提交（${String(modal.hash).slice(0, 8)}）新建一个分支：` }),
						h("input", {
							className: inputCls,
							value: recoverName,
							placeholder: "新分支名",
							onChange: (event) => setRecoverName(event.target.value),
							autoFocus: true
						})
					]
				});
				confirmLabel = "创建分支";
				onOk = () => doAction("createBranch", { name: recoverName.trim(), from: modal.hash });
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
									disabled: kind === "deleteBranch" && modal.current === true,
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
		/** Four hollow squares: the "more" tool glyph (design doc 4.1). */
		function MoreIcon({ size }) {
			return react_jsx_runtime.jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				children: [
					react_jsx_runtime.jsx("rect", { x: 2.2, y: 2.2, width: 4.6, height: 4.6, rx: 1 }),
					react_jsx_runtime.jsx("rect", { x: 9.2, y: 2.2, width: 4.6, height: 4.6, rx: 1 }),
					react_jsx_runtime.jsx("rect", { x: 2.2, y: 9.2, width: 4.6, height: 4.6, rx: 1 }),
					react_jsx_runtime.jsx("rect", { x: 9.2, y: 9.2, width: 4.6, height: 4.6, rx: 1 })
				]
			});
		}

		/** Conflict file body: plain text with the three marker lines coloured. */
		function ConflictView({ file, loading, error }) {
			if (loading === true) return h("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取冲突文件…"] });
			if (error !== null && error !== void 0) return h("div", { className: "dshg-error", children: error });
			const text = typeof file?.worktree === "string" ? file.worktree : "";
			if (text.length === 0) return h("div", { className: "dshg-empty", children: "文件为空或已在合并中被删除" });
			const lines = text.split("\n");
			return h("div", {
				className: "dshg-detailWork",
				children: h("div", {
					className: "dshg-conflictView",
					children: lines.map((line, index) => {
						let tone = "";
						if (/^<{7}/.test(line)) tone = " dshg-cfOurs";
						else if (/^={7}/.test(line)) tone = " dshg-cfSep";
						else if (/^>{7}/.test(line)) tone = " dshg-cfTheirs";
						return h("div", {
							key: index,
							className: `dshg-cfLine${tone}`,
							children: [
								h("span", { className: "dshg-cfNum", children: index + 1 }),
								h("span", { className: "dshg-cfText", children: line.length === 0 ? " " : line })
							]
						});
					})
				})
			});
		}

		/** Conflict files as the same directory tree the working-tree list uses. */
		function ConflictTree({ files, activePath, onOpen }) {
			const tree = buildTree(files.map((file) => ({ path: file.path, blocks: file.blocks, code: file.code })));
			const renderNode = (node, level) => [
				...Array.from(node.children.values()).map((child) => {
					const compacted = compactNode(child);
					const target = compacted.target;
					return h("div", {
						key: target.path,
						children: [
							h("div", {
								className: "dshg-cDir",
								style: { paddingLeft: `${6 + level * 14}px` },
								children: [
									h("span", { className: "dshg-caret dshg-caretOpen", children: "▶" }),
									h("span", { className: "dshg-cDirName", title: target.path, children: compacted.label }),
									h("span", { className: "dshg-cDirCount", children: subtreeCount(target) })
								]
							}),
							...renderNode(target, level + 1)
						]
					});
				}),
				...node.files.map((file) => h("div", {
					key: file.path,
					className: `dshg-cFile${activePath === file.path ? " dshg-cFileActive" : ""}`,
					style: { paddingLeft: `${20 + level * 14}px` },
					onClick: () => onOpen(file.path),
					children: [
						h("span", { className: "dshg-cLetter", children: file.code === "UU" ? "U" : String(file.code ?? "U").charAt(0) }),
						h("span", { className: "dshg-cPath", title: file.path, children: basename(file.path) }),
						h("span", {
							className: `dshg-cCount${file.blocks === 0 ? " dshg-cCountOk" : ""}`,
							children: file.blocks === 0 ? "（解决）" : `${file.blocks} 处冲突`
						})
					]
				}))
			];
			return h("div", { className: "dshg-conflictTree", children: renderNode(tree, 0) });
		}

		/** Top banner shown while a merge/squash/revert is in progress. */
		function ConflictBanner({ operation, conflicts, resolved, open, busy, onToggle, onContinue, onAbort, onOpenFile, activePath }) {
			const kindLabel = operation.kind === "squash" ? "摘取合并"
				: operation.kind === "revert" ? "还原"
					: operation.kind === "rebase" ? "变基"
						: operation.kind === "cherry-pick" ? "摘取提交"
							: "合并";
			const source = operation.source.length > 0 ? operation.source : "?";
			const target = operation.target.length > 0 ? operation.target : "?";
			// A file whose markers are gone counts as resolved even before `git add`
			// (the panel only stages them when "继续" runs) — teacher-confirmed rule.
			const pending = conflicts.filter((file) => file.blocks > 0).length;
			const done = (conflicts.length - pending) + resolved.length;
			return h("div", {
				className: "dshg-conflict",
				children: [
					h("div", {
						className: "dshg-conflictHead",
						children: [
							h("span", { className: "dshg-conflictIcon", children: "!" }),
							h("div", {
								className: "dshg-conflictText",
								children: [
									h("div", { className: "dshg-conflictTitle", children: pending > 0 ? "存在未处理的合并冲突" : "冲突已全部解决" }),
									h("div", {
										className: "dshg-conflictSub",
										children: `${kindLabel}中 · ${source} → ${target} · 还剩 ${pending} 个文件 · 已解决 ${done} 个`
									})
								]
							}),
							h("button", {
								type: "button",
								className: "dshg-op",
								disabled: busy === true || pending > 0,
								title: pending > 0 ? `还剩 ${pending} 个冲突` : "继续",
								onClick: onContinue,
								children: "继续合并"
							}),
							h("button", {
								type: "button",
								className: "dshg-op dshg-opDanger",
								disabled: busy === true,
								onClick: onAbort,
								children: "中止"
							}),
							h("button", {
								type: "button",
								className: "dshg-iconButton dshg-conflictCaret",
								title: open === true ? "收起冲突文件" : "展开冲突文件",
								onClick: onToggle,
								children: open === true ? "▴" : "▾"
							})
						]
					}),
					open === true ? h("div", {
						className: "dshg-conflictList",
						children: conflicts.length === 0
							? h("div", { className: "dshg-conflictEmpty", children: "冲突已全部解决，可以继续合并" })
							: h(ConflictTree, { files: conflicts, activePath, onOpen: onOpenFile })
					}) : null
				]
			});
		}

		/** Floating branch list (design doc section 4). */
		function BranchPopover({ branches, operation, busy, onClose, onSwitch, onCreate, onRename, onDelete, onMerge, onJumpCommit, onJumpEvent }) {
			const [expanded, setExpanded] = (0, react.useState)(null);
			const locked = operation !== null;
			return h("div", {
				className: "dshg-pop",
				onClick: (event) => event.stopPropagation(),
				children: [
					h("div", {
						className: "dshg-popHead",
						children: [
							h("span", { className: "dshg-popTitle", children: `分支（${branches.length}）` }),
							h("button", { type: "button", className: "dshg-op", disabled: busy === true, onClick: onCreate, children: "新建分支" })
						]
					}),
					locked ? h("div", { className: "dshg-popNote", children: "合并进行中，先解决冲突或中止" }) : null,
					h("div", {
						className: "dshg-popList",
						children: branches.map((branch) => {
							const open = expanded === branch.name;
							return h("div", {
								key: branch.name,
								className: `dshg-bBranch${branch.current ? " dshg-bCurrent" : ""}`,
								children: [
									h("div", {
										className: "dshg-bHead",
										onClick: () => setExpanded(open ? null : branch.name),
										children: [
											h("span", {
												className: "dshg-bDot",
												style: {
													background: branch.current ? branchColor(branch.name) : "transparent",
													borderColor: branchColor(branch.name)
												}
											}),
											h("span", { className: "dshg-bName", title: branch.name, children: branch.name }),
											branch.merged !== true ? h("span", { className: "dshg-bTag", children: "未合并" }) : null,
											h("span", { className: "dshg-bTime", children: formatDate(branch.date, translate) }),
											branch.current
												? h("span", { className: "dshg-bCurrentTag", children: "当前" })
												: h("button", {
													type: "button",
													className: "dshg-op dshg-opTiny",
													disabled: busy === true || locked,
													onClick: (event) => { event.stopPropagation(); onSwitch(branch.name); },
													children: "切换"
												})
										]
									}),
									open ? h("div", {
										className: "dshg-bBody",
										children: [
											h("div", {
												className: "dshg-bSubject",
												title: branch.subject,
												children: branch.subject.length > 0 ? branch.subject : "（无提交信息）"
											}),
											h("div", {
												className: "dshg-bMeta",
												children: [
													h("span", { className: "dshg-bHash", children: branch.short }),
													h("button", {
														type: "button",
														className: "dshg-op dshg-opTiny",
														onClick: () => onJumpCommit(branch.hash),
														children: "查看提交"
													})
												]
											}),
											h("div", {
												className: "dshg-bCreated",
												children: branch.created === null
													? "创建信息不可用（reflog 已过期）"
													: `基于 ${branch.created.from === "HEAD" || branch.created.from.length === 0 ? "当前分支" : branch.created.from}（${String(branch.created.hash).slice(0, 8)}）创建 · ${formatDate(branch.created.date, translate)}`
											}),
											branch.created !== null ? h("button", {
												type: "button",
												className: "dshg-op dshg-opTiny dshg-bJump",
												onClick: () => onJumpEvent(branch.created.hash),
												children: "跳到创建节点"
											}) : null,
											h("div", {
												className: "dshg-bActions",
												children: [
													h("button", {
														type: "button",
														className: "dshg-op",
														disabled: busy === true || locked || branch.current === true,
														onClick: () => onRename(branch.name),
														children: "重命名"
													}),
													h("div", {
														className: "dshg-bActionsRight",
														children: [
															h("button", {
																type: "button",
																className: "dshg-op",
																disabled: busy === true || locked || branch.current === true,
																onClick: () => onSwitch(branch.name),
																children: "切换"
															}),
															h("button", {
																type: "button",
																className: "dshg-op dshg-opDanger",
																disabled: busy === true || locked || branch.current === true,
																onClick: () => onDelete(branch),
																children: "删除"
															}),
															h("button", {
																type: "button",
																className: "dshg-op",
																disabled: busy === true || locked || branch.current === true,
																onClick: () => onMerge(branch.name),
																children: "合并"
															})
														]
													})
												]
											})
										]
									}) : null
								]
							});
						})
					})
				]
			});
		}

		/** The "more" menu: a home for later features (stash, tags, ...). */
		function MoreMenu({ onClose, onRecycle }) {
			return h("div", {
				className: "dshg-pop dshg-morePop",
				onClick: (event) => event.stopPropagation(),
				children: h("div", {
					className: "dshg-popList",
					children: [
						h("button", {
							type: "button",
							className: "dshg-moreItem",
							onClick: () => { onRecycle(); onClose(); },
							children: "回收站"
						})
					]
				})
			});
		}

		/** Recycle bin: commits no ref reaches any more. */
		function RecycleBin({ cwd, orphans, loading, error, onClose, onRefresh, onRestore, onView, onCheckout }) {
			const commits = Array.isArray(orphans) ? orphans : [];
			return hs("div", {
				className: "dshg-modal",
				onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
				children: hs("div", {
					className: "dshg-modalCard dshg-recycleCard",
					children: [
						h("div", { className: "dshg-modalTitle", children: `已丢弃的提交（${commits.length}）` }),
						h("div", { className: "dshg-modalDesc", children: "硬回退或删除分支后不再被任何分支引用的提交。只在 reflog 保留期内可以通过这里找回。" }),
						loading === true ? h("div", { className: "dshg-loading", children: [h("span", { className: "dshg-spinner" }), "读取…"] }) : null,
						error !== null && error !== void 0 ? h("div", { className: "dshg-error", children: error }) : null,
						loading !== true && commits.length === 0 ? h("div", { className: "dshg-empty", children: "没有找到丢掉的提交。" }) : null,
						h("div", {
							className: "dshg-recycleList",
							children: commits.map((commit) => hs("div", {
								key: commit.hash,
								className: "dshg-recycleRow",
								children: [
									h("span", { className: "dshg-recycleHash", children: commit.short }),
									h("div", {
										className: "dshg-recycleMain",
										children: [
											h("div", { className: "dshg-recycleSubject", title: commit.subject, children: commit.subject.length > 0 ? commit.subject : "（无提交信息）" }),
											h("div", { className: "dshg-recycleMeta", children: `${formatDate(commit.lostAt, translate)} · ${String(commit.reason ?? "").slice(0, 60)}` })
										]
									}),
									h("div", {
										className: "dshg-recycleOps",
										children: [
											h("button", { type: "button", className: "dshg-op dshg-opTiny", onClick: () => onView(commit.hash), children: "查看" }),
											h("button", { type: "button", className: "dshg-op dshg-opTiny", onClick: () => onCheckout(commit.hash), children: "切换" }),
											h("button", { type: "button", className: "dshg-op dshg-opTiny dshg-opPrimary", onClick: () => onRestore(commit.hash), children: "恢复为分支" })
										]
									})
								]
							}))
						}),
						hs("div", {
							className: "dshg-modalActions",
							children: [
								h("button", { type: "button", className: "dshg-op", onClick: onRefresh, children: "刷新" }),
								h("button", { type: "button", className: "dshg-op", onClick: onClose, children: "关闭" })
							]
						})
					]
				})
			});
		}

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
					refreshWorkDiff: (target, path) => refreshWorkDiff(ctxRef, target, path),
					refreshConflict: (target, path) => refreshConflictFile(ctxRef, target, path),
					refreshOrphans: (target) => refreshOrphans(ctxRef, target),
					continueOperation: (target) => continueOperation(ctxRef, target),
					markResolved: (target, path) => markResolved(ctxRef, target, path),
					exclusive: (target, name) => callRemote(ctxRef, "branchExclusiveCommits", { path: target, name }),
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
