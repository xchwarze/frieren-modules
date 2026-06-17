# Demo Module

A smoke-test and reference implementation for the Frieren module ecosystem. The Demo module exercises every UMD window dependency exposed by the Frieren frontend framework — React Query, react-hook-form, yup, Jotai, and Wouter — within a single, production-style module. Its backend exposes a real API endpoint that reads live system statistics from the OpenWrt device via `ubus`.

## Features

- **System statistics card** — fetches and displays CPU usage, memory consumption, swap usage, and uptime via `ubus call system info`; renders skeleton placeholders while the query is loading
- **Form validation demo** — a react-hook-form form with yup schema validation and toast feedback on submission
- **State management demo** — two Jotai atoms: an ephemeral in-memory counter and a `localStorage`-persisted value that survives page reload
- **Routing demo** — displays the current Wouter location to confirm router integration inside the UMD bundle
- **UMD bundle validation** — loads as a standard Frieren module, confirming the full build pipeline works end-to-end

## Use Cases

- **Verify framework integration** after upgrading the Frieren core or panel; a working Demo module confirms all shared dependencies resolve correctly at runtime
- **Smoke-test new device deployments** to validate that `ubus`, PHP, and the module API gateway are responding before deploying operational modules
- **Reference implementation for module authors** — the Demo module illustrates the canonical patterns for queries, mutations, atoms, form validation, and skeleton loading states; copy any component as a starting point
- **Build-pipeline validation** — confirms that the Vite UMD build, the module manifest, and the panel loader all work together correctly

## Requirements

| Requirement | Notes |
|-------------|-------|
| OpenWrt with `ubus` | System info endpoint |
| `/proc/stat` | CPU core count |
| No opkg packages | No additional packages required |

## Architecture

```
Frontend (UMD bundle)          Backend (PHP)
─────────────────────          ─────────────────
SystemStatsCard                DemoController
  └─ useSystemStats ──────────▶ getSystemStats
       (React Query, 0s)          └─ ubus call system info
                                  └─ /proc/stat (core count)
FormDemoCard
  └─ react-hook-form + yup

StateDemoCard
  └─ Jotai atoms (counter + persisted)
  └─ Wouter (location display)
```

The single backend endpoint calculates CPU load from the 1-minute load average (`load[0] / 65536 / cores`), memory used excluding buffers and cache, and formats uptime from raw seconds.

## License

LGPL-3.0-or-later
