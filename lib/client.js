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
			jsx: (type, props) => __jsx(guardType(type), props),
			jsxs: (type, props) => __jsxs(guardType(type), props),
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
			".dshg-trunc{color:var(--dshg-muted);font-size:11px;margin-top:2px}"
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
		let storeBase = {
			cwd: null,
			snapshot: null,
			log: null,
			status: null,
			branch: null,
			diff: null,
			diffHash: null,
			diffError: null,
			error: null,
			clientError: null,
			working: false,
			opMessage: null,
			loading: false,
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
					...(sameWorkspace ? null : { diff: null, diffHash: null, diffError: null })
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
		/** Fetch one commit's diff into the store. */
		async function refreshDiff(ctx, cwd, hash) {
			setStore({ diff: null, diffHash: hash, diffError: null, loading: false });
			const run = async (method, request) => {
				const result = await ctx.remote.git[method](request);
				if (!result.ok) throw new Error(`${method} failed: ${result.error?.code ?? "?"}: ${result.error?.message ?? "unknown"}`);
				return result.value;
			};
			try {
				const diff = await run("diff", { path: cwd, commit: hash });
				setStore({ diff, diffError: null });
			} catch (error) {
				setStore({ diff: null, diffHash: null, diffError: error instanceof Error ? error.message : String(error) });
			}
		}
		//#endregion

		//#region GitFooterAction
		/** Sidebar footer action: git button with a dirty-count badge. */
		function GitFooterAction({ wide, useSessions, t, git }) {
			const state = (0, react.useSyncExternalStore)(storeFace().subscribe, storeFace().getSnapshot);
			const current = useSessions((s) => s.current);
			const cwd = useSessions((s) => (current !== void 0 ? s.byId[current]?.cwd : void 0));
			const [open, setOpen] = (0, react.useState)(false);
			// Auto-refresh whenever the active session's workspace changes, so
			// the badge (and the drawer when open) always describe the current
			// workspace. Stale data is cleared first to avoid mislabeling.
			(0, react.useEffect)(() => {
				if (typeof cwd !== "string" || cwd.length === 0) {
					setStore({ snapshot: null, log: null, status: null, error: null, loading: false, cwd: null });
					return;
				}
				setStore({ snapshot: null, log: null, status: null, diff: null, diffHash: null, error: null });
				git.refresh(cwd);
			}, [cwd, git]);
			if (cwd === void 0) return null;
			// Defensive snapshot reads: never crash a render on a malformed payload.
			const snapshot = state.snapshot;
			const changesTotal = snapshot && typeof snapshot.changes === "object" && snapshot.changes !== null ? Number(snapshot.changes.total) || 0 : 0;
			const isRepo = snapshot?.repo === true;
			const count = isRepo && snapshot.clean === false ? changesTotal : 0;
			const title = state.clientError !== null && state.clientError !== void 0
				? `${t("action.title")}（错误：${state.clientError}）`
				: t("action.title");
			return (0, react_jsx_runtime.jsx)(Safeguard, {
				fallback: (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dshg-footerBtn",
					"aria-label": t("action.aria"),
					title: `${t("action.title")}（渲染出错：${state.clientError ?? "unknown"}）`,
					onClick: () => setOpen(true),
					children: [
						(0, react_jsx_runtime.jsx)(GitIcon, { size: 16 }),
						(0, react_jsx_runtime.jsx)("span", { className: "dshg-footerBadge", children: "!" })
					]
				}),
				children: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
					children: [
						wide === true
							? (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "dshg-footerLabel",
								"aria-label": t("action.aria"),
								title,
								onClick: () => setOpen(true),
								children: [
									(0, react_jsx_runtime.jsx)(GitIcon, { size: 14 }),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dshg-footerBranch",
										children: isRepo ? snapshot.branch : t("action.branch.unknown")
									}),
									count > 0 ? (0, react_jsx_runtime.jsx)("span", {
										className: "dshg-footerBadge",
										children: count > 99 ? "99+" : count
									}) : null
								]
							})
							: (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "dshg-footerBtn",
								"aria-label": t("action.aria"),
								title,
								onClick: () => setOpen(true),
								children: [
									(0, react_jsx_runtime.jsx)(GitIcon, { size: 16 }),
									count > 0 ? (0, react_jsx_runtime.jsx)("span", {
										className: "dshg-footerBadge",
										children: count > 99 ? "99+" : count
									}) : null
								]
							}),
						open ? (0, react_jsx_runtime.jsx)(Safeguard, {
							fallback: (0, react_jsx_runtime.jsxs)("div", {
								className: "dshg-root",
								children: [
									(0, react_jsx_runtime.jsx)("div", { className: "dshg-overlay", onClick: () => setOpen(false) }),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dshg-drawer",
										role: "dialog",
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												className: "dshg-header",
												children: [
													(0, react_jsx_runtime.jsx)(GitIcon, { size: 16 }),
													(0, react_jsx_runtime.jsx)("span", {
														className: "dshg-title",
														children: t("panel.title")
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dshg-iconButton",
														"aria-label": t("action.close"),
														title: t("action.close"),
														onClick: () => setOpen(false),
														children: (0, react_jsx_runtime.jsx)(CloseIcon, {})
													})
												]
											}),
											(0, react_jsx_runtime.jsx)("div", {
												className: "dshg-body",
												children: (0, react_jsx_runtime.jsx)("div", {
													className: "dshg-error",
													children: `面板渲染出错（请把这段文字告诉阿罗娜）：${state.clientError ?? "unknown"}`
												})
											})
										]
									})
								]
							}),
							children: (0, react_jsx_runtime.jsx)(GitPanel, {
								cwd,
								t,
								git,
								onClose: () => setOpen(false)
							})
						}) : null
					]
				})
			});
		}
		//#endregion

		//#region GitPanel
		/** The drawer: header, summary, status list, commit graph, diff view. */
		function GitPanel({ cwd, t, git, onClose, source, version, diag }) {
			const state = (0, react.useSyncExternalStore)(storeFace().subscribe, storeFace().getSnapshot);
			const [selectedHash, setSelectedHash] = (0, react.useState)(null);
			const [modal, setModal] = (0, react.useState)(null);
			const [commitMsg, setCommitMsg] = (0, react.useState)("");
			const [mergeTarget, setMergeTarget] = (0, react.useState)("");
			const [newBranchName, setNewBranchName] = (0, react.useState)("");
			const [switchTarget, setSwitchTarget] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				setSelectedHash(null);
				setModal(null);
				git.refresh(cwd);
			}, [cwd, git]);
			// Transient op-result toast: auto-dismiss after a few seconds so long
			// logs never pile up and squeeze the drawer's layout (#23).
			(0, react.useEffect)(() => {
				if (state.opMessage === null || state.opMessage === void 0) return void 0;
				const timer = window.setTimeout(() => {
					setStore({ opMessage: null });
				}, 5000);
				return () => window.clearTimeout(timer);
			}, [state.opMessage]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") {
						if (modal !== null) setModal(null);
						else onClose();
					}
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [modal, onClose]);
			const snapshot = state.snapshot;
			const repo = snapshot?.repo === true;
			const loading = state.loading && !repo;
			// Clicking the already-open commit collapses the detail back to the
			// 70/30 overview; selecting another commit loads its diff.
			const onSelect = (hash) => {
				const next = selectedHash === hash ? null : hash;
				setSelectedHash(next);
				if (next !== null && next !== selectedHash) git.refreshDiff(cwd, hash);
			};
			// Generic action runner: execute, close any modal, then refresh.
			const doAction = (method, args) => {
				git.run(method, cwd, args ?? {});
				setModal(null);
			};
			// Working-tree files currently staged for the commit confirmation list.
			const filesNow = (state.status?.entries ?? []).map((e) => e.path);
			const branches = (state.branch?.branches ?? [])
				.filter((b) => !/^remotes\//.test(b) && !/ -> HEAD/.test(b));
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dshg-root",
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: "dshg-overlay",
						onClick: onClose
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshg-drawer",
						role: "dialog",
						"aria-label": t("panel.aria"),
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshg-header",
								children: [
									(0, react_jsx_runtime.jsx)(GitIcon, { size: 16 }),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dshg-title",
										children: repo ? basename(snapshot?.root) : t("panel.title")
									}),
									repo ? (0, react_jsx_runtime.jsx)("span", {
										className: snapshot.clean ? "dshg-badge dshg-badgeOk" : "dshg-badge dshg-badgeWarn",
										title: snapshot?.root ?? "",
										children: snapshot.clean ? t("state.clean") : `${Number(snapshot?.changes?.total) || 0} ${t("state.changes")}`
									}) : null,
									repo ? (0, react_jsx_runtime.jsx)("span", {
										className: "dshg-badge",
										children: snapshot?.branch ?? ""
									}) : null,
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dshg-iconButton",
										"aria-label": t("action.refresh"),
										title: t("action.refresh"),
										disabled: state.loading,
										onClick: () => {
											setSelectedHash(null);
											git.refresh(cwd);
										},
										children: (0, react_jsx_runtime.jsx)(RefreshIcon, {})
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dshg-iconButton",
										"aria-label": t("action.close"),
										title: t("action.close"),
										onClick: onClose,
										children: (0, react_jsx_runtime.jsx)(CloseIcon, {})
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: `dshg-body${selectedHash !== null ? " dshg-mode-detail" : ""}`,
								children: state.error !== null && state.error !== void 0 ? (0, react_jsx_runtime.jsx)("div", {
									className: "dshg-error",
									children: state.error
								}) : loading ? (0, react_jsx_runtime.jsxs)("div", {
									className: "dshg-loading",
									children: [(0, react_jsx_runtime.jsx)("span", { className: "dshg-spinner" }), t("state.loading")]
								}) : !repo ? (0, react_jsx_runtime.jsxs)("div", {
									className: "dshg-notRepo",
									children: [
										(0, react_jsx_runtime.jsx)("div", {
											className: "dshg-notRepoIcon",
											children: (0, react_jsx_runtime.jsx)(GitIcon, { size: 40 })
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: "dshg-notRepoTitle",
											children: t("state.notRepoTitle")
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: "dshg-notRepoDesc",
											children: t("state.notRepoDesc")
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: "dshg-notRepoDesc",
											children: `当前路径：${cwd}（来源：${source ?? "?"}，v${version ?? "?"}）`
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: "dshg-notRepoDesc",
											children: `诊断：${diag ?? "?"}`
										}),
										(0, react_jsx_runtime.jsx)(Safeguard, {
											fallback: null,
											children: (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dshg-op dshg-opPrimary",
												disabled: state.working,
												onClick: () => setModal({ kind: "init" }),
												children: t("op.init")
											})
										})
									]
								}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
									children: [
										(0, react_jsx_runtime.jsx)(Safeguard, {
											fallback: null,
											children: (0, react_jsx_runtime.jsxs)("div", {
												className: "dshg-ops",
												children: [
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dshg-op dshg-opPrimary",
														disabled: state.working,
														onClick: () => setModal({ kind: "commit" }),
														children: t("op.commit")
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dshg-op",
														disabled: state.working,
														onClick: () => setModal({ kind: "createBranch" }),
														children: t("op.createBranch")
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dshg-op",
														disabled: state.working,
														onClick: () => setModal({ kind: "switch" }),
														children: t("op.switch")
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dshg-op",
														disabled: state.working,
														onClick: () => setModal({ kind: "merge" }),
														children: t("op.merge")
													}),
													(0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dshg-op dshg-opDanger",
														disabled: state.working,
														onClick: () => setModal({ kind: "restore" }),
														children: t("op.restore")
													}),
													state.working ? (0, react_jsx_runtime.jsx)("span", { className: "dshg-busy" }) : null,
													state.opMessage !== null && state.opMessage !== void 0 ? (0, react_jsx_runtime.jsx)("span", {
														className: `dshg-opMsg ${state.opMessage.type === "ok" ? "dshg-opMsgOk" : "dshg-opMsgErr"}`,
														children: state.opMessage.text
													}) : null
												]
											})
										}),
										(0, react_jsx_runtime.jsxs)("div", {
											className: "dshg-statusPane",
											children: [
												(0, react_jsx_runtime.jsx)(Safeguard, {
													fallback: (err) => (0, react_jsx_runtime.jsx)("div", { className: "dshg-error", children: `SummaryRow: ${err.message}` }),
													children: (0, react_jsx_runtime.jsx)(SummaryRow, { snapshot, t })
												}),
												(0, react_jsx_runtime.jsx)(Safeguard, {
													fallback: (err) => (0, react_jsx_runtime.jsx)("div", { className: "dshg-error", children: `StatusList: ${err.message}` }),
													children: (0, react_jsx_runtime.jsx)(StatusList, { status: state.status, t })
												})
											]
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: "dshg-timeline",
											children: (0, react_jsx_runtime.jsx)(Safeguard, {
												fallback: (err) => (0, react_jsx_runtime.jsx)("div", { className: "dshg-error", children: `CommitList: ${err.message}` }),
												children: (0, react_jsx_runtime.jsx)(CommitList, {
													log: state.log,
													t,
													selectedHash,
													onSelect
												})
											})
										}),
										(0, react_jsx_runtime.jsxs)("div", {
											className: "dshg-diffPane",
											children: [
												selectedHash !== null ? (0, react_jsx_runtime.jsxs)("div", {
													className: "dshg-ops",
													children: [
														(0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dshg-op",
															disabled: state.working,
															onClick: () => setModal({ kind: "checkout", hash: selectedHash }),
															children: t("op.checkoutHere")
														}),
														(0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dshg-op",
															disabled: state.working,
															onClick: () => setModal({ kind: "revert", hash: selectedHash }),
															children: t("op.revert")
														}),
														(0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dshg-op dshg-opDanger",
															disabled: state.working,
															onClick: () => setModal({ kind: "reset", hash: selectedHash }),
															children: t("op.reset")
														})
													]
												}) : null,
												selectedHash === null ? (0, react_jsx_runtime.jsx)("div", {
													className: "dshg-diffHint",
													children: t("state.selectHint")
												}) : (0, react_jsx_runtime.jsx)(Safeguard, {
													fallback: (err) => (0, react_jsx_runtime.jsx)("div", { className: "dshg-error", children: `DiffView: ${err.message}` }),
													children: (0, react_jsx_runtime.jsx)(DiffView, { diff: state.diff, diffError: state.diffError, hash: selectedHash, t })
												})
											]
										})
									]
								})
							}),
							modal !== null ? (0, react_jsx_runtime.jsx)(ActionModal, {
								modal,
								cwd,
								t,
								git,
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
		/** Reusable confirm/modal for every git action (commit has a message input
		 * and file list; merge selects a branch; reset/restore are danger-styled). */
		function ActionModal({ modal, t, onClose, doAction, commitMsg, setCommitMsg, mergeTarget, setMergeTarget, newBranchName, setNewBranchName, switchTarget, setSwitchTarget, currentBranch, files, branches }) {
			const kind = modal.kind;
			const busy = false;
			const cancel = () => onClose();
			const inputCls = "dshg-input";
			// Local branches only (for the switch picker), current highlighted.
			const localBranches = branches.length ? branches.filter((b) => !/^remotes\//.test(b)) : branches;
			let title = "";
			let body = null;
			let confirmLabel = "";
			let danger = false;
			let onOk = () => {};
			if (kind === "init") {
				title = t("modal.init.title");
				body = (0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.init.desc") });
				confirmLabel = t("op.init");
				onOk = () => doAction("init", {});
			} else if (kind === "createBranch") {
				title = t("modal.createBranch.title");
				body = (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
					children: [
						(0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.createBranch.desc") }),
						(0, react_jsx_runtime.jsx)("input", {
							className: inputCls,
							value: newBranchName,
							placeholder: t("modal.createBranch.placeholder"),
							onChange: (e) => setNewBranchName(e.target.value),
							autoFocus: true
						})
					]
				});
				confirmLabel = t("op.createBranch");
				onOk = () => doAction("createBranch", { name: newBranchName.trim() });
			} else if (kind === "switch") {
				title = t("modal.switch.title");
				body = (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
					children: [
						(0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.switch.desc") }),
						(0, react_jsx_runtime.jsx)("select", {
							className: inputCls,
							value: switchTarget,
							onChange: (e) => setSwitchTarget(e.target.value),
							children: [
								(0, react_jsx_runtime.jsx)("option", { value: "", disabled: true, children: t("modal.switch.placeholder") }, ""),
								localBranches.map((b) => (0, react_jsx_runtime.jsx)("option", { value: b, children: b === currentBranch ? `${b}（当前）` : b }, b))
							]
						})
					]
				});
				confirmLabel = t("op.switch");
				onOk = () => doAction("checkout", { target: switchTarget.trim() });
			} else if (kind === "commit") {
				title = t("modal.commit.title");
				body = (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
					children: [
						(0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.commit.desc") }),
						(0, react_jsx_runtime.jsx)("input", {
							className: inputCls,
							value: commitMsg,
							placeholder: t("modal.commit.placeholder"),
							onChange: (e) => setCommitMsg(e.target.value),
							autoFocus: true
						}),
						files.length > 0
							? (0, react_jsx_runtime.jsx)("div", {
								className: "dshg-modalList",
								children: files.slice(0, 40).map((f, i) => (0, react_jsx_runtime.jsx)("span", { children: f }, i))
							})
							: (0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("state.noChanges") })
					]
				});
				confirmLabel = t("op.commit");
				onOk = () => doAction("commit", { message: commitMsg.trim() });
			} else if (kind === "merge") {
				title = t("modal.merge.title");
				body = (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
					children: [
						(0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.merge.desc") }),
						(0, react_jsx_runtime.jsx)("select", {
							className: inputCls,
							value: mergeTarget,
							onChange: (e) => setMergeTarget(e.target.value),
							children: [
								(0, react_jsx_runtime.jsx)("option", { value: "", disabled: true, children: t("modal.merge.placeholder") }, ""),
								branches.map((b) => (0, react_jsx_runtime.jsx)("option", { value: b, children: b }, b))
							]
						})
					]
				});
				confirmLabel = t("op.merge");
				onOk = () => doAction("merge", { target: mergeTarget.trim() });
			} else if (kind === "checkout") {
				title = t("modal.checkout.title");
				body = (0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.checkout.desc", { target: String(modal.hash).slice(0, 8) }) });
				confirmLabel = t("op.checkoutHere");
				onOk = () => doAction("checkout", { target: modal.hash });
			} else if (kind === "revert") {
				title = t("modal.revert.title");
				body = (0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.revert.desc", { target: String(modal.hash).slice(0, 8) }) });
				confirmLabel = t("op.revert");
				onOk = () => doAction("revert", { commit: modal.hash });
			} else if (kind === "reset") {
				title = t("modal.reset.title");
				body = (0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.reset.desc", { target: String(modal.hash).slice(0, 8) }) });
				confirmLabel = t("op.reset");
				danger = true;
				onOk = () => doAction("reset", { commit: modal.hash });
			} else if (kind === "restore") {
				title = t("modal.restore.title");
				body = (0, react_jsx_runtime.jsx)("div", { className: "dshg-modalDesc", children: t("modal.restore.desc") });
				confirmLabel = t("op.restore");
				danger = true;
				onOk = () => doAction("restore", {});
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dshg-modal",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshg-modalCard",
						children: [
							(0, react_jsx_runtime.jsx)("div", { className: "dshg-modalTitle", children: title }),
							body,
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshg-modalActions",
								children: [
									(0, react_jsx_runtime.jsx)("button", { type: "button", className: "dshg-op", onClick: cancel, children: t("action.cancel") }),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: `dshg-op${danger ? " dshg-opDanger" : " dshg-opPrimary"}`,
										onClick: onOk,
										children: confirmLabel
									})
								]
							})
						]
					})
				]
			});
		}
		/** Change-count summary chips. */
		function SummaryRow({ snapshot, t }) {
			const changes = (snapshot && typeof snapshot.changes === "object" && snapshot.changes !== null ? snapshot.changes : {});
			const staged = Number(changes.staged) || 0;
			const unstaged = Number(changes.unstaged) || 0;
			const untracked = Number(changes.untracked) || 0;
			const total = Number(changes.total) || 0;
			const ahead = Number(snapshot?.ahead) || 0;
			const behind = Number(snapshot?.behind) || 0;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dshg-summary",
				children: [
					staged > 0 ? (0, react_jsx_runtime.jsx)("span", {
						className: "dshg-chip dshg-chipA",
						children: `${t("state.staged")} ${staged}`
					}) : null,
					unstaged > 0 ? (0, react_jsx_runtime.jsx)("span", {
						className: "dshg-chip dshg-chipM",
						children: `${t("state.unstaged")} ${unstaged}`
					}) : null,
					untracked > 0 ? (0, react_jsx_runtime.jsx)("span", {
						className: "dshg-chip dshg-chipB",
						children: `${t("state.untracked")} ${untracked}`
					}) : null,
					ahead > 0 ? (0, react_jsx_runtime.jsx)("span", {
						className: "dshg-chip",
						children: `↑${ahead}`
					}) : null,
					behind > 0 ? (0, react_jsx_runtime.jsx)("span", {
						className: "dshg-chip",
						children: `↓${behind}`
					}) : null,
					total === 0 ? (0, react_jsx_runtime.jsx)("span", {
						className: "dshg-chip dshg-chipB",
						children: t("state.clean")
					}) : null
				]
			});
		}
		/** Working-tree file list, grouped by directory (collapsible). */
		function StatusList({ status, t }) {
			const entries = status?.entries ?? [];
			const [collapsed, setCollapsed] = (0, react.useState)(() => {
				// Fold directories with many entries by default to avoid a wall
				// of rows (e.g. deleting a whole folder); small groups stay open.
				// NOTE: never array-destructure the {dir, items} objects this
				// grouping returns — `for (const [dir, items] of ...)` would try
				// to iterate a plain object and throw "is not iterable".
				const initial = {};
				const startGroups = groupEntries(entries);
				for (let gi = 0; gi < startGroups.length; gi += 1) {
					const group = startGroups[gi];
					if (group.items.length > 4) initial[group.dir] = true;
				}
				return initial;
			});
			if (entries.length === 0) return null;
			const groups = groupEntries(entries);
			const toggle = (dir) => setCollapsed((current) => ({ ...current, [dir]: !current[dir] }));
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: "dshg-section",
						children: t("section.status")
					}),
					(0, react_jsx_runtime.jsx)("div", {
						children: groups.map((group) => {
							const isCollapsed = collapsed[group.dir] === true;
							const dirLabel = group.dir === "" ? t("state.root") : group.dir;
							return (0, react_jsx_runtime.jsxs)("div", {
								children: [
									(0, react_jsx_runtime.jsx)("div", {
										className: "dshg-groupRow",
										onClick: () => toggle(group.dir),
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: `dshg-groupCaret${isCollapsed ? "" : " dshg-groupCaretOpen"}`,
												children: "▶"
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: "dshg-groupIcon",
												children: (0, react_jsx_runtime.jsx)(FolderIcon, { size: 13 })
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: "dshg-groupName",
												title: dirLabel,
												children: dirLabel
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: "dshg-groupCount",
												children: `${group.items.length}`
											})										]
									}),
									isCollapsed ? null : (0, react_jsx_runtime.jsx)("div", {
										className: "dshg-groupFiles",
										children: group.items.map((entry, entryIndex) => {
											const key = `${entryIndex}:${entry?.path ?? ""}`;
											const label = fileLabel(entry);
											const cls = statusClass(entry?.x, entry?.y);
											return (0, react_jsx_runtime.jsxs)("div", {
												className: "dshg-fileRow",
												children: [
													(0, react_jsx_runtime.jsx)("span", {
														className: `dshg-fileStatus ${cls}`,
														children: label
													}),
													(0, react_jsx_runtime.jsx)("span", {
														className: "dshg-filePath",
														title: entry.path,
														children: basename(entry.path)
													})
												]
											}, key);
										})
									})
								]
							}, group.dir);
						})
					})
				]
			});
		}
		/** Commit graph rows. */
		function CommitList({ log, t, selectedHash, onSelect }) {
			const commits = log?.commits ?? [];
			if (commits.length === 0) return (0, react_jsx_runtime.jsx)("div", {
				className: "dshg-empty",
				children: t("state.noCommits")
			});
			return (0, react_jsx_runtime.jsx)("div", {
				children: commits.map((commit, index) => {
					const selected = selectedHash === commit.hash;
					const isHead = index === 0;
					const isMerge = commit.parents.length > 1;
					const dot = isHead ? "dshg-dotHead" : isMerge ? "dshg-dotMerge" : index % 3 === 0 ? "dshg-dotBranch" : "dshg-dotPlain";
					return (0, react_jsx_runtime.jsxs)("div", {
						className: `dshg-commitRow${selected ? " dshg-commitRowSel" : ""}`,
						onClick: () => onSelect(commit.hash),
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshg-graph",
								children: [
									(0, react_jsx_runtime.jsx)("span", { className: "dshg-graphLine" }),
									(0, react_jsx_runtime.jsx)("span", { className: `dshg-graphDot ${dot}` }),
									index === commits.length - 1 ? null : (0, react_jsx_runtime.jsx)("span", { className: "dshg-graphLine" })
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshg-commitMain",
								children: [
									(0, react_jsx_runtime.jsx)("div", {
										className: "dshg-commitSubject",
										title: commit.subject,
										children: commit.subject
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dshg-commitMeta",
										children: [
											(0, react_jsx_runtime.jsx)("span", { children: commit.short }),
											(0, react_jsx_runtime.jsx)("span", { children: commit.author }),
											(0, react_jsx_runtime.jsx)("span", { children: formatDate(commit.date, t) }),
											isMerge ? (0, react_jsx_runtime.jsx)("span", {
												className: "dshg-detached",
												children: t("state.merge")
											}) : null
										]
									}),
									commit.refs.length > 0 ? (0, react_jsx_runtime.jsx)("div", {
										className: "dshg-refs",
										children: commit.refs.slice(0, 4).map((ref) => (0, react_jsx_runtime.jsx)("span", {
											className: `dshg-ref${ref === "HEAD" ? " dshg-refHead" : ""}`,
											children: ref
										}, ref))
									}) : null
								]
							})
						]
					}, commit.hash);
				})
			});
		}
		/** Diff detail for the selected commit. */
		function DiffView({ diff, diffError, hash, t }) {
			if (diffError !== null && diffError !== void 0) return (0, react_jsx_runtime.jsx)("div", {
				className: "dshg-error",
				children: diffError
			});
			if (diff === null || diff === void 0) return (0, react_jsx_runtime.jsxs)("div", {
				className: "dshg-loading",
				children: [(0, react_jsx_runtime.jsx)("span", { className: "dshg-spinner" }), t("state.loading")]
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dshg-diffFiles",
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: "dshg-section",
						children: `${t("section.diff")} ${hash.slice(0, 8)}`
					}),
					diff.files.length === 0 ? (0, react_jsx_runtime.jsx)("div", {
						className: "dshg-empty",
						children: t("state.noFiles")
					}) : diff.files.map((file) => (0, react_jsx_runtime.jsxs)("div", {
						className: "dshg-diffFileRow",
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: "dshg-num dshg-numAdd",
								children: file.binary ? "bin" : `+${file.added ?? 0}`
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: "dshg-num dshg-numDel",
								children: file.binary ? "" : `-${file.removed ?? 0}`
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: "dshg-filePath",
								title: file.path,
								children: file.path
							})
						]
					}, file.path)),
					diff.patch !== "" ? (0, react_jsx_runtime.jsxs)("div", {
						className: "dshg-patch",
						children: [
							(0, react_jsx_runtime.jsx)("pre", { children: diff.patch }),
							diff.truncated ? (0, react_jsx_runtime.jsx)("div", {
								className: "dshg-trunc",
								children: t("state.truncated")
							}) : null
						]
					}) : null
				]
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
			"op.revert": "还原此提交",
			"op.reset": "硬回退",
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
			"modal.revert.title": "还原此提交",
			"modal.revert.desc": "为 {target} 生成一个反向提交（保留历史，推荐的安全回退）。",
			"modal.reset.title": "硬回退",
			"modal.reset.desc": "危险操作：将把 HEAD 硬回退到 {target}，并丢弃之后的所有改动（仅限本地未推送时）。确定继续？",
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
			"op.reset": "Hard reset",
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
		function GitPanelHost({ cwd, t, onClose, source, version, diag }) {
			const [barHeight, setBarHeight] = react.useState(0);
			// GitPanel's mount effect depends on this object, so a fresh instance
			// per render would re-run refreshAll on EVERY render — and refreshAll
			// clears diff/diffHash, which silently wipes the diff of the commit
			// the user is looking at. Keep one stable instance for the mount.
			const gitApi = (0, react.useRef)(null);
			if (gitApi.current === null) {
				gitApi.current = {
					refresh: (target) => refreshAll(ctxRef, target),
					refreshDiff: (target, hash) => refreshDiff(ctxRef, target, hash),
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
		function GitFooterEntry({ wide, useSessions, useWorkspaces }) {
			const [open, setOpen] = react.useState(false);
			const state = (0, react.useSyncExternalStore)(storeFace().subscribe, storeFace().getSnapshot);
			// 0.2.1 standard feeds. Only `useSessions` (SessionListState) carries
			// `current` + `byId[id].cwd`; `useWorkspaces` (WorkspaceListState) has
			// `items` + `recentWorkspaceId` and NO `byId`, so the workspace feed is
			// only a fallback for "no session open". Both hooks are called
			// unconditionally (a missing prop degrades to a no-op selector) to keep
			// the hook order stable across renders.
			const PANEL_VERSION = "0.1.4";
			const useSessionsSafe = typeof useSessions === "function" ? useSessions : () => void 0;
			const useWorkspacesSafe = typeof useWorkspaces === "function" ? useWorkspaces : () => void 0;
			// The session id is read on its own: the workspace fallback below has to
			// find the workspace that actually accounts for this session.
			const currentSessionId = useSessionsSafe((list) => (typeof list?.current === "string" ? list.current : void 0));
			// Diagnosis selectors. They must return plain scalars — returning a
			// fresh object from a useSyncExternalStore selector re-renders forever.
			const sessionCount = useSessionsSafe((list) => (Array.isArray(list?.ids) ? list.ids.length : Array.isArray(list?.items) ? list.items.length : -1));
			const byIdHit = useSessionsSafe((list) => {
				const current = list?.current;
				return typeof current === "string" && list?.byId !== void 0 && list.byId[current] !== void 0 ? 1 : 0;
			});
			const rowCwdHit = useSessionsSafe((list) => {
				const current = list?.current;
				const row = typeof current === "string" ? list?.byId?.[current] : void 0;
				return typeof row?.cwd === "string" && row.cwd.length > 0 ? 1 : 0;
			});
			const workspaceCount = useWorkspacesSafe((list) => (Array.isArray(list?.items) ? list.items.length : -1));
			// This deployment can run with `list.current === undefined` (the
			// selection cell is empty even though sessions are listed). In that
			// case the live session is the one whose row was touched last, so use
			// its recorded cwd before falling back to workspace-level guesses.
			const latestSessionCwd = useSessionsSafe((list) => {
				const byId = list?.byId;
				if (byId === void 0 || byId === null) return void 0;
				let bestStamp = -1;
				let bestCwd;
				for (const id of Object.keys(byId)) {
					const row = byId[id];
					if (row === void 0 || row === null || row.blank === true) continue;
					if (typeof row.cwd !== "string" || row.cwd.length === 0) continue;
					const stamp = Number(row.updatedAt) || 0;
					if (stamp > bestStamp) {
						bestStamp = stamp;
						bestCwd = row.cwd;
					}
				}
				return bestCwd;
			});
			const latestSessionId = useSessionsSafe((list) => {
				const byId = list?.byId;
				if (byId === void 0 || byId === null) return void 0;
				let bestStamp = -1;
				let bestId;
				for (const id of Object.keys(byId)) {
					const row = byId[id];
					if (row === void 0 || row === null || row.blank === true) continue;
					const stamp = Number(row.updatedAt) || 0;
					if (stamp > bestStamp) {
						bestStamp = stamp;
						bestId = id;
					}
				}
				return bestId;
			});
			const sessionCwd = useSessionsSafe((list) => {
				const current = list?.current;
				if (typeof current !== "string") return void 0;
				const row = list?.byId?.[current];
				if (row !== void 0 && typeof row.cwd === "string" && row.cwd.length > 0) return row.cwd;
				// Defensive: some list shapes only carry rows in the items array.
				const items = Array.isArray(list?.items) ? list.items : [];
				const found = items.find((item) => item?.id === current || item?.sessionId === current);
				return typeof found?.cwd === "string" && found.cwd.length > 0 ? found.cwd : void 0;
			});
			// Workspace rows use `workspaceId` (not `id`) and carry `sessionIds`.
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
				const picked = (typeof recentId === "string"
					? items.find((item) => item?.workspaceId === recentId || item?.id === recentId)
					: void 0) ?? items[0];
				return typeof picked?.path === "string" && picked.path.length > 0 ? picked.path : void 0;
			});
			const cwd = typeof sessionCwd === "string"
				? sessionCwd
				: typeof latestSessionCwd === "string"
					? latestSessionCwd
					: typeof ownedWorkspaceCwd === "string"
						? ownedWorkspaceCwd
						: workspaceCwd;
			const cwdSource = typeof sessionCwd === "string"
				? "session"
				: typeof latestSessionCwd === "string"
					? "active-session"
					: typeof ownedWorkspaceCwd === "string"
						? "workspace"
						: typeof workspaceCwd === "string" ? "recent" : "none";
			const diag = `current=${currentSessionId === void 0 ? "none" : currentSessionId.slice(-6)} · latest=${latestSessionId === void 0 ? "none" : latestSessionId.slice(-6)} · byId=${byIdHit} · rowCwd=${rowCwdHit} · sessions=${sessionCount} · ws=${workspaceCount}`;
			// Keep the footer badge truthful: the drawer refreshes while open, so
			// pull the snapshot whenever the active workspace changes.
			(0, react.useEffect)(() => {
				if (typeof cwd !== "string" || cwd.length === 0) return;
				if (ctxRef === null) return;
				refreshAll(ctxRef, cwd);
			}, [cwd]);
			if (typeof cwd !== "string" || cwd.length === 0) return null;
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
			const badge = count > 0 ? react_jsx_runtime.jsx("span", {
				className: "dshg-footerBadge",
				children: count > 99 ? "99+" : count
			}) : null;
			const button = wide === true
				? react_jsx_runtime.jsxs("button", {
					type: "button",
					className: "dshg-footerLabel",
					title,
					onClick: () => setOpen((value) => !value),
					children: [glyph, react_jsx_runtime.jsx("span", { className: "dshg-footerBranch", children: branch ?? "git" }), badge]
				})
				: react_jsx_runtime.jsxs("button", {
					type: "button",
					className: "dshg-footerBtn",
					title,
					"aria-label": "Git 面板",
					onClick: () => setOpen((value) => !value),
					children: [glyph, badge]
				});
			if (!open) return button;
			return react_jsx_runtime.jsxs(react.Fragment, {
				children: [button, react_jsx_runtime.jsx(GitPanelHost, {
					cwd,
					t: translate,
					source: cwdSource,
					version: PANEL_VERSION,
					diag,
					onClose: () => setOpen(false)
				})]
			});
		}
		function apply(ctx) {
			ctxRef = ctx;
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
