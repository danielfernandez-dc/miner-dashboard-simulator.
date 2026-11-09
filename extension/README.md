# Atlas Chrome extension

A browser-only troubleshooting side panel built with WXT, React, TypeScript, and Tailwind. The approved panel is the entire extension UI; it does not recreate the miner dashboard. No AI service, server, database, or account is required.

## Build and load in Chrome

From the project root:

```sh
npm --prefix extension ci --legacy-peer-deps
npm run extension:build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `extension/.output/chrome-mv3` inside this project. Pin Atlas from Chrome's extension menu. Open the hosted Miner Lab simulator or `http://localhost:8080`, choose a scenario, and click Atlas's toolbar button. The side panel reads immediately. After changing the scenario, press **Read logs again**. Reload the extension in Chrome after rebuilding it.

`--legacy-peer-deps` works around a peer dependency resolver crash in the installed npm 11.0.0. The lockfile records the installed dependency versions.

Useful commands:

```sh
npm run extension:dev
npm run extension:check
npm run extension:zip
```

The original simulator still runs with `npm start`; its build and tests remain `npm run build` and `npm test`.

## Where to find a feature

- `entrypoints/background.ts` connects the toolbar button to Chrome's side panel.
- `entrypoints/sidepanel/App.tsx` coordinates reading, loading/errors, transient analysis, selection, and explicit preview mode. `style.css` provides the Census-inspired appearance; `preview.ts` holds labeled design fixtures.
- `features/miner/readMiner.ts` checks the active tab URL and temporarily injects the simulator reader. It uses the simulator's existing BroadcastChannel to obtain all retained logs, independent of search/source/severity filters. The dashboard must stay open. There is a bounded response timeout, and no page or cache refresh: reloading this simulator would erase its in-memory logs.
- `features/rules/library.ts` validates the packaged knowledge and reuses a matching copy under `atlasRuleLibrary` in `chrome.storage.local`. Missing, invalid, modified, or outdated caches are replaced. Storage failure uses packaged rules with a visible notice. Logs and findings are never persisted.
- `features/diagnostics/analyze.ts` parses entries in retained log order, matches source and severity, fills named captures, groups repeated faults per component, and applies explicit recovery events. It preserves unknown errors as findings without invented repair steps. A boot marker resets the current run.
- `features/diagnostics/Diagnosis.tsx` renders the issue, ordered steps, draft procedure label, and expandable original log evidence. It never executes repair actions.

The shared source of knowledge is `../public/miner-error-rules.json`. The WXT build copies it into the extension's packaged assets. Edit the shared source, not the generated copy. `rulesVersion` identifies content changes; `schemaVersion` identifies structural changes. Keep patterns small, anchored, and covered by matching and nonmatching examples.

## Permissions and current limits

The manifest requests `sidePanel`, `storage`, `activeTab`, and `scripting`. There are no broad host permissions. A toolbar click grants access to the selected tab; Atlas only accepts the hosted simulator dashboard and local HTTP dashboard pages at localhost/127.0.0.1. It does not support real Vnish firmware yet. The simulator's page is untrusted input; the reader checks payload type and size, and React renders log evidence as text.

This is an on-demand snapshot, not live monitoring. The panel clears its result on tab changes or navigation, so previous advice is not presented as belonging to another page. The read time remains visible. Recovery declarations only clear their named known rules; a generic accepted-share message does not prove recovery, and an unknown fault is retained for review. An empty log or no recognized faults is not a hardware health certification. Repair procedures remain drafts pending your team's review.

The complete retained log is limited by the simulator to 2,000 lines. Events preceding that buffer cannot be inferred. Real hardware support requires a verified adapter and real logs rather than assuming this simulator is an exact firmware implementation. Census integration is outside this first version.

## Verification

`extension:check` type-checks the extension and runs tests for all simulator faults, placeholders, component grouping, recovery/recurrence, unknown faults, boot boundaries, malformed logs, cache initialization/repair/failure, supported URLs, and complete-buffer reading. `extension:build` creates the Manifest V3 package. UI design preview uses explicit local fixtures and is not proof of Chrome permission or toolbar behavior; those require a loaded-extension check in Chrome.
