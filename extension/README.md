# Atlas Chrome extension

A browser-only troubleshooting side panel built with WXT, React, TypeScript, and Tailwind. The approved panel is the entire extension UI; it does not recreate the miner dashboard. No AI service, server, database, or account is required.

## Build and load in Chrome

From the project root:

```sh
npm --prefix extension ci --legacy-peer-deps
npm run extension:build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `extension/.output/chrome-mv3` inside this project. Pin Atlas from Chrome's extension menu. Open the hosted Miner Lab simulator or `http://localhost:8080`, choose a scenario, and click Atlas's toolbar button. The side panel starts reading immediately while clearing the current website’s stored data, cookies, and service workers. Click the toolbar button again to close the panel, and once more to reopen it and clear site data again. After changing the scenario, press **Read logs again**. Reload the extension in Chrome after rebuilding it.

`--legacy-peer-deps` works around a peer dependency resolver crash in the installed npm 11.0.0. The lockfile records the installed dependency versions.

Useful commands:

```sh
npm run extension:dev
npm run extension:check
npm run extension:zip
```

The original simulator still runs with `npm start`; its build and tests remain `npm run build` and `npm test`.

## Where to find a feature

- `entrypoints/background.ts` connects panel messages to website-data clearing and serialized error storage. `features/panel/controller.ts` handles toolbar toggling and Chrome’s open/close events, including worker restarts.
- `features/site-data/clearSiteData.ts` clears HTTP cache, Cache Storage, IndexedDB, localStorage, cookies, service workers, and legacy site files/databases for the clicked HTTP(S) origin and detected embedded frames. Isolated-world injection clears the current tab’s session storage and discovers frame/resource providers. Provider cookies are cleared with separate origin filters; partitioned cookies are removed only from the clicked tab’s top-level site partition and cookie store. No browser-wide deletion call is made. Chrome-internal and file pages are skipped. Clearing is independent of miner diagnosis.
- `features/site-data/ClearingAccess.tsx` requests optional HTTP(S) host access from a direct user click. It is needed for cross-origin sessions and partitioned third-party cookies; until granted, the panel explicitly reports partial clearing.
- `public/atlas-mark.svg` is shared by the panel and Chrome icons. `scripts/generateIcons.ts` renders transparent 16/32/48/128px PNGs from that vector during the WXT build.
- `features/errors/archive.ts` hashes original unmatched entries plus their website origin, deduplicates overlapping reads, and serializes local storage writes in the background. `UnknownErrors.tsx` displays the saved count. `file.ts` keeps a user-authorized file handle in IndexedDB and merges queued entries into `errors.json` under a cross-window Web Lock; file errors never discard Chrome’s saved queue.
- `entrypoints/sidepanel/App.tsx` coordinates reading, loading/errors, transient analysis, selection, and explicit preview mode. `style.css` provides the Census-inspired appearance; `preview.ts` holds labeled design fixtures.
- `features/miner/readMiner.ts` checks the active tab URL and temporarily injects the simulator reader. It uses the simulator's existing BroadcastChannel to obtain all retained logs, independent of search/source/severity filters. The dashboard must stay open. There is a bounded response timeout, and no page reload: reloading this simulator would erase its in-memory logs. Website data is cleared separately without navigating.
- `features/rules/library.ts` validates the packaged knowledge and reuses a matching copy under `atlasRuleLibrary` in `chrome.storage.local`. Missing, invalid, modified, or outdated caches are replaced. Storage failure uses packaged rules with a visible notice. Known diagnostic findings remain temporary. Unrecognized log warnings and errors are saved separately under `atlasUnknownErrors` in Chrome local storage for review.
- `features/diagnostics/analyze.ts` parses entries in retained log order, matches source and severity, fills named captures, groups repeated faults per component, and applies explicit recovery events. It preserves unknown errors as findings without invented repair steps. A boot marker resets the current run.
- `features/diagnostics/Diagnosis.tsx` renders the issue, ordered steps, draft procedure label, and expandable original log evidence. It never executes repair actions.

The shared source of knowledge is `../public/miner-error-rules.json`. The WXT build copies it into the extension's packaged assets. Edit the shared source, not the generated copy. `rulesVersion` identifies content changes; `schemaVersion` identifies structural changes. Keep patterns small, anchored, and covered by matching and nonmatching examples.

## Permissions and current limits

The manifest requests `sidePanel`, `storage`, `activeTab`, `scripting`, `browsingData`, and `cookies`. HTTP(S) host permissions are optional and requested once through Enable complete site clearing. Granting them lets Atlas reach embedded page sessions and partitioned cookie domains; deletion remains limited to the selected page’s detected providers. A toolbar click grants access to the selected tab; Miner diagnosis only accepts the hosted simulator dashboard and local HTTP dashboard pages at localhost/127.0.0.1. It does not support real Vnish firmware yet. The simulator's page is untrusted input; the reader checks payload type and size, and React renders log evidence as text.

Chrome 142 or later is required for explicit panel close events. This is an on-demand snapshot, not live monitoring. The panel clears its result on tab changes or navigation, so previous advice is not presented as belonging to another page. The read time remains visible. Recovery declarations only clear their named known rules; a generic accepted-share message does not prove recovery, and an unknown fault is retained for review. An empty log or no recognized faults is not a hardware health certification. Repair procedures remain drafts pending your team's review.

The complete retained log is limited by the simulator to 2,000 lines. Events preceding that buffer cannot be inferred. Real hardware support requires a verified adapter and real logs rather than assuming this simulator is an exact firmware implementation. Census integration is outside this first version.

## Verification

`extension:check` type-checks the extension and runs tests for all simulator faults, placeholders, component grouping, recovery/recurrence, unknown faults, boot boundaries, malformed logs, cache initialization/repair/failure, supported URLs, and complete-buffer reading. `extension:build` creates the Manifest V3 package. UI design preview uses explicit local fixtures and is not proof of Chrome permission or toolbar behavior; those require a loaded-extension check in Chrome.

Local Chrome verification completed: loaded the unpacked build, opened Atlas through its action button, diagnosed the hosted simulator's missing hashboard, reread after recovery, and confirmed recovery remained recognized with the dashboard filtered to Errors only. The action uses an explicit click listener so Chrome grants temporary page access before the panel reads the selected tab.

## Unknown-error file setup

The initial inbox file is `entrypoints/new/errors.json`, with `{ "schemaVersion": 1, "errors": [] }`. It is separate from `public/miner-error-rules.json`; captured errors are never automatically promoted into repair rules. Select **Connect errors.json** in Atlas and choose that exact file once. Chrome asks for read/write access. The selected handle is remembered, and new unmatched entries are synced automatically while access remains granted. If Chrome revokes the grant after a restart, reconnect the file. The extension cannot silently write into a project folder without this selection.

Chrome storage receives unknown entries before file syncing, even if no file is connected. Existing valid file entries are merged rather than replaced. Repeated reads do not duplicate the same event, while new timestamps and different miners remain distinct records. Invalid file contents are not overwritten. Keep captured field logs out of source-control commits unless they are intentionally reviewed test fixtures.

The local simulator includes **Unknown error (Atlas test)** for testing this workflow without changing approved knowledge. This option is not added to the JSON rule library. The hosted simulator receives it only if you deploy that simulator separately.

Clearing does not reload a website. It now removes cookies and stored settings, so it can sign you out. Cookies are shared at registrable-domain scope; clearing detected provider cookies can also sign you out of that provider elsewhere. Partitioned-cookie removal is constrained to the current top-level site, while unpartitioned third-party cookies are associated using the page’s observed frame/resource origins. Previously loaded providers no longer present in those observations cannot be attributed reliably to this page. Open websites can immediately recreate stored data; completion does not promise that storage remains empty. Atlas’s own extension storage and its saved-error file connection are excluded.

Cache and inbox verification: Chrome displayed a completed origin-scoped cache clear; the toolbar was visually checked closing and reopening Atlas. The selected project inbox received 253 unique simulator entries, then automatically grew to 254 after a new unmatched event. Rereading the paused snapshot retained 254 records. If an unpacked-extension reload revokes file access, Connect errors.json reuses the remembered handle and requests write permission without reopening the picker. Captured logs remain local working data rather than being included in feature commits.

## Version 0.3.0 clearing setup

Select **Enable complete site clearing** once and accept Chrome’s website-access prompt. Every later toolbar opening clears all supported site-data categories, including accessible frame sessions and cookies partitioned under the current site. A blocked frame, rejected storage operation, or unavailable cookie partition produces a partial/failure message rather than a false success. Password-manager entries and browser history are not website storage and are not removed. No cleanup runs for a closing toolbar click.

Version 0.3.0 local Chrome verification: a disposable page seeded one item in each of localStorage, sessionStorage, cookies, IndexedDB, Cache Storage, and service-worker registrations. Reopening Atlas reduced all six counts from 1 to 0, and Chrome showed the new orange icon. Partitioned-cookie scope and embedded-frame session behavior are covered by automated tests; the browser smoke test used first-party disposable data.
