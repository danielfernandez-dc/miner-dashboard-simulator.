# Miner Lab

A standalone Vnish-style miner dashboard for testing browser extensions against a live website. All hardware, telemetry, and log messages are synthetic. This is an independent test fixture, not an exact VNISH interface or firmware/API implementation.

## Deploy to Vercel

Deploy this repository as the project root.

1. Push the project to a Git repository and import it into Vercel.
2. Leave **Root Directory** at the repository root.
3. Framework preset: **Other**. Build command: `npm run build`. Output directory: `public`. The included `vercel.json` configures these values.
4. Deploy and open the resulting HTTPS URL in Chrome. Enable your extension for that domain.

Alternatively, from this directory with Node.js installed, run `npx vercel` to create a preview deployment, then `npx vercel --prod` for production. These commands require your Vercel account and perform the actual upload; this project has only been prepared locally.

No database, API keys, environment variables, dependency installation, or server functions are needed. Vercel serves the files in `public/` directly. See [Vercel's static project configuration](https://vercel.com/docs/project-configuration/vercel-json).

## Preview locally

```sh
npm start
```

Open http://localhost:8080 in Chrome. To change the port: `PORT=8081 npm start`. Use HTTP rather than opening `index.html` as a local file, because the page imports JavaScript modules.

## Test scenarios

- Healthy mining with accepted shares.
- Overtemperature and thermal shutdown.
- Fan failure with a zero RPM reading.
- Pool timeout and disconnected pool status.
- Missing hashboard and reduced hashrate.
- Power supply fault and standby power.

Select a scenario to immediately append its log message and update telemetry. Select Healthy mining to recover. Random faults can introduce new fault conditions during streaming; they remain active until changed. Pause stops new log generation; session uptime continues. Reset returns the simulator to its initial state. Clear empties the log buffer without changing the scenario.

Logs are ordinary selectable DOM text inside `#log-output`, with `.log-row` elements and `ERROR`/`INFO` levels. Tabs, severity, and search filters affect the dashboard view. Download exports the complete retained buffer as `miner.log`; up to 2,000 lines are retained. Raw log opens a separate HTML page with plain log text in `#raw-log`, connected to the originating dashboard using BroadcastChannel. Keep that dashboard open. It is not a server-side text endpoint.

Each dashboard tab runs its own simulation in browser memory. Reload starts a fresh session. Visitors do not share state. Timers can slow down when the browser backgrounds a tab; this fixture is intended for interactive extension testing, not an always-running remote miner.

## Validation

```sh
npm test
npm run build
```

`build` checks static assets and JavaScript syntax; no compilation is required. `server.mjs` is only a local static preview server and is not deployed as a backend.

Interface references: [VNISH dashboard overview](https://vnish.pro/en/documentation/106-overview-of-the-vnish-interface-dashboard.html) and [VNISH logs guide](https://vnish.pro/en/documentation/94-logs-in-vnish-and-how-to-create-a-diagnostic-report-from-a-miner.html). The simulator's log messages and controls are custom test data.
