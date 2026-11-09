# Atlas Chrome Extension

Atlas is a browser-only Chrome extension that reads miner logs, matches known errors to a troubleshooting library, and displays short, numbered next steps in a Census-style side panel. This repository also contains the independent Vnish-style simulator used to test it.

The extension is version **0.3.0**. It uses **WXT, React, TypeScript, and Tailwind**. It needs no backend, database, AI service, or account. Real Vnish firmware and Census integration are not implemented yet; diagnosis currently supports the hosted and local simulator.

## Which folder contains the app?

The app source is in **[`extension/`](extension/)**. The root `public/` directory is the simulator, not the extension interface. That is why the top-level simulator files still look familiar.

```text
Atlas Chrome Extension/
├── extension/                        Chrome extension project
│   ├── entrypoints/background.ts     Toolbar and background coordination
│   ├── entrypoints/sidepanel/        Atlas interface
│   ├── entrypoints/new/errors.json   Local unknown-error inbox
│   ├── features/                     Diagnosis, log reading, storage, clearing
│   ├── public/                       Shared Atlas mark and Chrome icon assets
│   ├── scripts/generateIcons.ts      Builds PNG icons from the SVG mark
│   ├── wxt.config.ts                 Chrome permissions and build configuration
│   └── .output/chrome-mv3/           Generated extension to load into Chrome
├── public/                           Independent miner simulator
│   ├── index.html                    Simulator dashboard
│   ├── simulator.mjs                 Synthetic miner scenarios and logs
│   └── miner-error-rules.json         Shared troubleshooting knowledge
├── server.mjs                        Local simulator server
├── scripts/build.mjs                 Simulator validation
├── outputs/                          Local packages and screenshots
└── work/                             Local scratch files and test fixtures
```

`.output/` is generated and may be hidden by your editor. Edit the source under `extension/`, then rebuild and reload the extension in Chrome to see changes. Local screenshots, exports, scratch files, and captured logs are not part of the published feature commits.

The configured GitHub repository retains its original simulator name: [miner-dashboard-simulator.](https://github.com/danielfernandez-dc/miner-dashboard-simulator.). The extension and simulator share that repository. The development branch for this work is **`dev_main`**.

## Build and load Atlas

Use a supported Node.js LTS release, preferably Node 24. Run these commands from the repository root:

```sh
npm --prefix extension ci --legacy-peer-deps
npm run extension:build
```

`--legacy-peer-deps` avoids a dependency-resolution crash observed with npm 11.0.0. The extension lockfile records its dependency versions.

1. Open `chrome://extensions` in Chrome 142 or later.
2. Turn on **Developer mode** and choose **Load unpacked**.
3. Select **`extension/.output/chrome-mv3`** in this project.
4. Pin Atlas to the toolbar.
5. Open the [hosted miner simulator](https://miner-dashboard-simulator.vercel.app/) or start the local simulator below.
6. Choose a fault and click Atlas. The panel displays the detected issue, numbered procedure, and expandable log evidence.
7. Use **Read logs again** after changing a scenario. Clicking the toolbar button again closes the panel; clicking once more reopens it.

After changing source files, run `npm run extension:build` and press **Reload** on Atlas's card in `chrome://extensions`. Refreshing a simulator tab resets its in-memory logs, so preserve the test scenario by rebuilding/reloading the extension rather than reloading that tab.

```sh
npm run extension:dev     # WXT development workflow
npm run extension:check   # Type checking and extension tests
npm run extension:build   # Production Chrome extension
npm run extension:zip     # Packaged extension ZIP in extension/.output/
```

## Website data clearing

Every toolbar opening starts clearing the current website's stored data independently of miner diagnosis. Clearing also works on ordinary HTTP(S) websites that are not miner dashboards. It does not reload the page.

Select **Enable complete site clearing** once and approve Chrome's optional website-access permission. This enables access to embedded frames and partitioned third-party cookies. Without that grant, Atlas reports partial clearing.

The cleanup covers:

- HTTP cache and Cache Storage.
- IndexedDB and local storage.
- The current tab's accessible session storage, including embedded frames with permission.
- Website cookies and cookies for detected embedded providers.
- Partitioned cookies associated with the current top-level site and cookie store.
- Service-worker registrations and supported legacy site storage.

This can sign you out and remove website settings. Cookies are shared across domains and services; removing a detected provider's cookies can sign you out of that provider elsewhere. Previously loaded providers absent from the current frame/resource observations cannot reliably be attributed to a page. Atlas reports blocked frames and clearing failures instead of claiming full success. An open website may immediately recreate data.

Atlas's own troubleshooting rules, unknown-error archive, and saved-file connection are separate extension data and are not cleared. Browser history and password-manager entries are not removed. Protected Chrome pages and local file URLs are skipped.

## Rules and unknown errors

The shared knowledge source is **[`public/miner-error-rules.json`](public/miner-error-rules.json)**. The WXT build copies it into the extension's packaged assets. It contains five known simulator faults—missing hashboard, overtemperature, fan failure, pool disconnection, and power supply failure—plus an explicit recovery rule.

Patterns match the parsed message, source, and severity. Named regex captures fill titles, summaries, and steps. Repeated faults are grouped per component. A recovery event clears earlier known faults; accepted shares alone do not establish recovery. Repair procedures remain drafts pending your team's approval.

Unknown warnings and errors are saved automatically in Chrome local storage and deduplicated across overlapping log reads. They are not automatically added to the approved rule library.

To sync them into the local project file:

1. Click **Connect errors.json** in Atlas.
2. Select **`extension/entrypoints/new/errors.json`** and allow writing.
3. Later reads merge newly captured records into that same file. Existing records are preserved.

Chrome must authorize the file selection; the extension cannot silently write into a project folder. If write permission expires, the same button reuses the remembered file handle. Errors stay in Chrome even if file access is unavailable. Keep captured field logs out of Git unless deliberately reviewed for publication.

See the [extension developer guide](extension/README.md) for feature locations, state ownership, permissions, and verification details.

## Run the independent simulator

```sh
npm start
```

Open [localhost:8080](http://localhost:8080). To use another port, run `PORT=8081 npm start`. Use HTTP rather than opening `public/index.html` directly.

Scenarios include healthy mining, overtemperature, fan failure, pool disconnection, missing hashboard, power supply failure, and **Unknown error (Atlas test)**. The last scenario deliberately has no troubleshooting rule and tests the error inbox.

Choosing a scenario immediately appends a synthetic log entry and updates telemetry. **Healthy mining** appends recovery. **Pause** stops new entries, **Clear** empties the buffer, and **Reset** restarts the simulation. Each dashboard tab has its own in-memory session and retains at most 2,000 entries.

The dashboard displays selectable log text in `#log-output`; search, source, and severity filters affect only that view. Atlas requests the full retained buffer through the simulator's existing BroadcastChannel. **Raw log** is a separate HTML page connected to the originating dashboard, not a server-side log endpoint. Keep the dashboard open. **Download** exports `miner.log`.

All miner data is synthetic. This fixture is not an exact Vnish interface, firmware API, or hardware health check.

## Deploy the simulator to Vercel

Deployment serves the simulator website; it does not install or publish the Chrome extension.

1. Import this repository into Vercel with its repository root as **Root Directory**.
2. Use framework preset **Other**, build command **`npm run build`**, and output directory **`public`**.
3. Deploy the selected branch. `vercel.json` supplies the static-site settings.

The static simulator needs no database, API key, environment variables, or backend server. `server.mjs` is only for local preview. Changing `dev_main` does not change GitHub's `main` branch; which branch Vercel deploys depends on its project settings.

## Verify changes

```sh
npm test
npm run build
npm run extension:check
npm run extension:build
```

Version 0.3.0 passed 38 extension tests and five simulator tests, plus type checking and both builds. Tests cover rule matching, recovery, unknown-error capture and deduplication, file merging, toolbar state, deletion scope, embedded-frame sessions, and cookie partitions.

Chrome checks verified live simulator diagnosis/recovery, unknown-error file syncing, toolbar closing/reopening, and the orange icon. A disposable website seeded one item in each of local storage, session storage, cookies, IndexedDB, Cache Storage, and service-worker registrations; opening Atlas reduced all six counts from 1 to 0. Partitioned-cookie boundaries are covered by automated tests; the browser storage smoke test used first-party disposable data.
