# hcxdumptool Module Specification

> **Version-aware (v1.0.x).** The hcxdumptool **6.3.0 rewrite** changed roughly half
> the CLI (removed `--enable_status`, `-s`, `--filtermode`/`--filterlist_*`,
> `--disable_*_attacks`, `--stop_*_attacks`, `--passive`, `--active_beacon`,
> `--eapoltimeout`, `-C`, `--check_driver`; renamed `--nmea`→`--nmea_out`,
> `--do_rcascan`→`--rcascan=`; changed `-I`/`-L`). The module therefore carries a
> **tool-version selector (6.2.x / 6.3.x)** that switches both the capture-command
> builder and the visible form fields. The flag sets below were verified line-by-line
> against `hcxdumptool.c` at git tags **6.2.4** and **6.3.4**.

## Purpose

Capture WPA/WPA2/WPA3 handshakes and PMKIDs using hcxdumptool on OpenWrt. Manage capture lifecycle (start/stop), configure attack vectors and filtering, view real-time output, and manage capture history (download/delete). The capture form adapts to the installed hcxdumptool generation (auto-detected, operator-overridable).

## Scope

- Check hcxdumptool binary availability (custom dependency check — binary can come from multiple packages)
- List available network interfaces
- Start capture with configurable parameters (interface, channels, attack control, filtering, timing)
- Stop capture (kill process)
- Stream real-time capture log output with auto-refresh
- List capture history (pcapng files)
- Download individual captures
- Delete individual captures or all captures

## Out of Scope

- Post-processing captures (hcxpcapngtool hash extraction — done offline; still not integrated)
- Cracking captured hashes (hashcat — done on external hardware)
- Submitting captures to online services (wpaonlinecrack module's domain)
- Monitor mode management (hcxdumptool manages this internally)
- Setting a custom device MAC — **no such option exists** in 6.2.4 or 6.3.4 (the old `--mac_ap`/`--mac_client` form fields were invalid in both; removed).

Note: GPS (`--nmea`/`--nmea_out`, `--gpsd`/`--use_gpsd`), RCA scan (`--do_rcascan` / `--rcascan=`), and (6.2.x) MAC/ESSID filter lists are exposed in the capture form.

## External Tools / APIs Used

| Tool/API | Usage |
|----------|-------|
| `hcxdumptool` | Core capture binary; declared as opkg dependency |
| `hcxdumptool --version` | Parsed by `moduleStatus` to detect the 6.2.x vs 6.3.x branch |
| `killall` | Stop capture process (`killall -9 hcxdumptool`) |
| `pgrep` (via `OpenWrtHelper::checkRunning`) | Check if hcxdumptool is running |

## Required Configuration / Env Vars

No UCI config used. Most capture flags arrive pre-built in the `command` field; `toolVersion` and the multi-line list/BPF inputs are separate params written to fixed files. The module uses:

| Path | Purpose |
|------|---------|
| `/root/.hcxdumptool/` | Capture file storage directory |
| `/tmp/fm-hcxdumptool.log` | Real-time capture log output |
| `/tmp/fm-hcxdumptool-essidlist.txt` | ESSID list (`--essidlist`, both branches) |
| `/tmp/fm-hcxdumptool-filter-ap.txt` | AP MAC filter list (`--filterlist_ap`, 6.2.x) |
| `/tmp/fm-hcxdumptool-filter-client.txt` | Client MAC filter list (`--filterlist_client`, 6.2.x) |
| `/tmp/fm-hcxdumptool-bpf.txt` | Compiled BPF (`--bpf`, 6.3.x) |
| `/tmp/task-hcxdumptool-info.log` / `.flag` | Diagnostic info background task output + completion flag (`BackgroundTaskHelper`) |
| `<module folder>/presets.json` (`getModulePath()`) | Operator-saved capture presets (JSON, in the plugin's own folder) |

Each list file is written from its textarea (one trimmed entry per line); empty input removes the file and skips the flag.

## Inputs

### API Endpoints (POST `/api/index.php`)

All requests use `{module: "hcxdumptool", action: "<action>", ...params}`.

| Action | Params | Description |
|--------|--------|-------------|
| `moduleStatus` | none | Check deps, running state, interfaces, **detected version + branch** |
| `installModuleDependencies` | `{destination}` | Install hcxdumptool via opkg |
| `getDependencyInstallationStatus` | none | Poll opkg install progress |
| `startCapture` | `{command, toolVersion, essidList?, filterlistAp?, filterlistClient?, bpf?}` | Start hcxdumptool with the version-built flags + file-backed lists |
| `stopCapture` | none | Kill hcxdumptool process |
| `getLogContent` | none | Read capture log + running state |
| `getCaptureHistory` | none | List pcapng files in capture directory |
| `getCaptureOutput` | `{outputFile?: string}` | Download capture file (stream) |
| `deleteCapture` | `{filename: string}` | Delete single capture file |
| `deleteAll` | none | Delete all capture files |
| `listInterfaces` | none | **starts** `-L` (6.3.x) / `-I` (6.2.x) as a background task |
| `showChannels` | `{interface?: string}` | **starts** `[-i iface] -C` (6.2.x only); 6.3.x → 400 "use Interface Info" |
| `interfaceInfo` | `{interface: string}` | **starts** `-I iface` detailed info (6.3.x only); 6.2.x → 400 |
| `checkDriver` | `{interface?: string}` | **starts** `[-i iface] --check_driver` (6.2.x only); 6.3.x → 400 |
| `getInfoStatus` | none | poll the diagnostic task → `{completed, output}` |
| `stopInfo` | none | kill the running diagnostic (`killall -9 hcxdumptool`) |
| `getPresets` | none | list operator-saved capture presets → `{presets:[...]}` |
| `savePreset` | `{name, toolVersion, values}` | upsert a device-persistent preset (name `^[A-Za-z0-9 ._+()-]{1,40}$`, max 50) |
| `deletePreset` | `{name}` | remove a saved preset |

Info actions run as a single background task (`BackgroundTaskHelper`, task `hcxdumptool-info`) because `-C`/`--check_driver` probe hardware and can hang — they no longer block a PHP worker. Each starter returns `{started:true}` immediately; the frontend polls `getInfoStatus`. The flag is resolved from the **installed** binary (`getToolVersion`/`isRewriteCli`), not the UI selector — they run against the real device. Version-gate rejections (e.g. `-C` on 6.3.x) return their 400 immediately, before any task starts.

### Command Construction (Frontend → Backend)

The frontend has two builders selected by the **tool-version selector**. It sends the
built `command`, the chosen `toolVersion` (`6.2`/`6.3`), and the relevant file-backed
textareas. The backend writes those textareas to fixed `/tmp/fm-hcxdumptool-*` files
(one trimmed entry per line; empty → file removed and flag skipped) and appends only the
flags valid for `toolVersion`, then `-w {pcapFilePath}`.

**6.3.x command (default; verified @ 6.3.4):**
```
-i {interface} [--rds=1] [-c 1a,6a,11a] [-f freq] [-F] [-t sec]
  [--attemptapmax=N] [--attemptclientmax=N] [--disable_beacon] [--rcascan=p|a]
  [--tot=N] [--watchdogmax=sec] [--gpsd] [--nmea_out=file] [--bpf={file}] [extraFlags]
```
File-backed (6.3.x): `--essidlist={file}` (seeds ESSID ring buffer), `--bpf={file}` (compiled BPF replaces the removed soft filter lists).

**6.2.x command (verified @ 6.2.4):**
```
[--enable_status={bitmask}] -i {interface} [-s scanlist] [-c channel] [-t sec]
  [--disable_client_attacks] [--disable_ap_attacks] [--stop_ap_attacks=N]
  [--stop_client_m2_attacks=N] [--silent] [--active_beacon] [--filtermode=0|1|2]
  [--tot=N] [--eapoltimeout=usec] [--use_gpsd] [--nmea=file] [--do_rcascan] [extraFlags]
```
File-backed (6.2.x): `--essidlist={file}` (transmit beacons), `--filterlist_ap={file}`, `--filterlist_client={file}`.

### Frontend Form Fields (Capture Settings — version selector + collapsible sections)

Layout: a tool-version selector on top, then a Bootstrap **Accordion** (`alwaysOpen`, **Core** open by default) grouping the fields into **Core / Status (or Real-time) Display / Attack Control / Filtering / Timing / GPS-Other**, then a **live read-only Command preview** textarea, then the Capture/Stop actions. The preview (`CommandPreview`, via `useWatch`) shows `hcxdumptool <built command>` updating as fields change; the output file (`-w`) and file-backed `--essidlist`/`--filterlist`/`--bpf` flags are appended by the backend and noted under it.

**Tool version:** `toolVersion` select (6.3.x / 6.2.x), defaults to `moduleStatus.toolBranch`; a warning shows when the selected branch differs from the detected binary.

**Shared (both):** `interface` (select, required), `minStayTime` (`-t`), `tot` (`--tot`, min 2), `essidList` (textarea), `extraFlags` (escape hatch).

**6.3.x-only:** `channel` (`-c`, band-suffixed `1a,6a,11a`), `singleFrequency` (`-f`), `allFrequencies` (`-F`), `rdsSort` (`--rds=1`), `attemptApMax` (`--attemptapmax`, 0=disable AP attacks), `attemptClientMax` (`--attemptclientmax`, 0=disable client attacks), `disableBeacon` (`--disable_beacon`), `rcascan` (Off/Passive/Active → `--rcascan=p|a`), `watchdogmax` (`--watchdogmax`), `gpsd` (`--gpsd`), `nmeaOut` (`--nmea_out`), `bpf` (textarea → `--bpf`).

**6.2.x-only:** `enable_status` bitmask (8 switches: EAPOL 1, Association 2, Authentication 4, Beacon 8, Rogue AP 16, GPS 32, Internal 64, EAP 512; emitted only when >0), `scanlist` (`-s` 0–5), `channel` (`-c`), `disableClientAttacks`, `disableApAttacks`, `stopApAttacks` (`--stop_ap_attacks`), `stopClientAttacks` (`--stop_client_m2_attacks`), `silent` (`--silent`), `activeBeacon` (`--active_beacon`), `filtermode` + `filterlistAp` + `filterlistClient`, `eapoltimeout` (`--eapoltimeout`), `useGpsd` (`--use_gpsd`), `nmea` (`--nmea`), `doRcascan` (`--do_rcascan`).

**Icons:** card icon `crosshair`; accordion headers carry icons (Core `sliders`, Display `monitor`, Attacks `zap`, Filtering `filter`, Timing `clock`, GPS/Other `map-pin`).

### Capture Presets

A **PresetBar** above the accordion (inside the form, via `useFormContext`) loads and saves capture configurations:
- **Built-in presets** ship in the frontend (`helpers/presets.js` → `DEFAULT_PRESETS`, `builtin:true`, not deletable), each a partial `values` over `DEFAULT_VALUES` + a `toolVersion`. 6.3.x uses `-c` band-suffixed channels (a=2.4GHz, b=5GHz; 5GHz sets use non-DFS UNII channels 36-48/149-161). Current set:
  - 6.3.x: PMKID + Handshake (2.4GHz / 5GHz / 2.4+5GHz), All frequencies sweep (`-F`), Aggressive AP attack (`--attemptapmax=1`), Client-only no-AP-attack (2.4GHz / 5GHz, `--attemptapmax=0`), Passive recon scan (`--rcascan=p`), Active recon scan (`--rcascan=a`).
  - 6.2.x: Handshake capture (5GHz, `-s 3`), Beacon recon (`--do_rcascan`).
- **User presets** are stored in the plugin's own folder (`getPresets`/`savePreset`/`deletePreset` → `getModulePath() . '/presets.json'`). Note: a module reinstall/update that replaces the folder may drop them.
- **Load** (on select) resets the form to `{...DEFAULT_VALUES, ...preset.values}` and switches `toolVersion`, **preserving the currently chosen interface**.
- **Save as** stores the current form values + `toolVersion` under a typed name (upsert by name). **Delete** removes a user preset (built-ins can't be deleted).
- A preset stores `interface` too, but Load ignores it (keeps the operator's current pick).

## Outputs

### `moduleStatus`
```json
{
  "hasDependencies": true,
  "isRunning": false,
  "interfaces": ["wlan0", "wlan1", "eth0", "lo"],
  "toolVersion": "6.3.4",
  "toolBranch": "6.3"
}
```
`toolVersion` is the full parsed version; `toolBranch` is `major.minor` (`"6.2"` or `"6.3"`) used by the frontend to default the tool-version selector. Both are `null` if `--version` could not be parsed.
When dependencies missing:
```json
{
  "hasDependencies": false,
  "message": false,
  "isRunning": false,
  "internalAvailable": true,
  "SDAvailable": false
}
```

### `startCapture`
```json
{"outputFile": "2026-01-15T14-30-00.pcapng"}
```

### `stopCapture`
```json
{"success": false}
```
Note: `success` is `return`ed (the missing-return bug is fixed) and carries the result of `checkRunning('hcxdumptool')` — `false` after a successful kill.

### `getLogContent`
```json
{
  "isRunning": true,
  "logContent": "hcxdumptool output text..."
}
```

### `getCaptureHistory`
```json
{
  "files": ["2026-01-15T14-30-00.pcapng", "2026-01-14T09-00-00.pcapng"]
}
```

### `getCaptureOutput`
Binary file stream (application/octet-stream) — uses `ResponseHandler::streamFile()`.

## Data Models / Contracts

### Capture Files
- Location: `/root/.hcxdumptool/`
- Naming: `{YYYY-MM-DD}T{HH-mm-ss}.pcapng`
- Format: pcapng (hcxdumptool writes pcapng with `-w`; the extension now matches). Pre-existing `.pcap` captures still list/download fine (history is extension-agnostic).
- Created automatically by hcxdumptool during capture
- Directory created by `moduleStatus` if missing (0755 permissions)

### Log File
- Location: `/tmp/fm-hcxdumptool.log`
- Content: hcxdumptool stdout + stderr
- Recreated on each capture start
- Polled every 5 seconds by frontend during capture

### Running State
- Determined by: `file_exists('/tmp/fm-hcxdumptool.log') && OpenWrtHelper::checkRunning($pcapDirectory, true)` — the second arg uses `pgrep -f` to match the capture by its unique `-w /root/.hcxdumptool/…` argv, so background info `hcxdumptool` processes are not mistaken for a capture (was a global `pgrep hcxdumptool`).
- Synced to frontend via Jotai `isRunningAtom`
- Frontend polls `getLogContent` every 5s when running, stops when `isRunning` becomes false

## Execution Flow

### Start Capture
```
1. Validate command param exists → 400 if missing
2. Read toolVersion ('6.2' / '6.3', default '6.3')
3. Write essidList textarea → /tmp file, append --essidlist= (both versions)
4. If 6.2: write filterlistAp/filterlistClient → /tmp files, append --filterlist_ap= / --filterlist_client=
   Else (6.3): write bpf textarea → /tmp file, append --bpf=
   (each only when the textarea is non-empty)
5. Generate filename: date('Y-m-d\TH-i-s') . '.pcapng'
6. Sanitize command via escapeshellcmd()
7. Execute background: hcxdumptool {command}{fileFlags} -w {pcapPath} > /tmp/fm-hcxdumptool.log 2>&1
8. Return {outputFile: filename}
```
The file-backed flags are appended by version so a stale textarea from the other branch never injects a flag that aborts the run.

### Stop Capture
```
1. Execute: killall -9 hcxdumptool
2. return self::setSuccess({success: checkRunning('hcxdumptool')})
```

### Get Log Content
```
1. Check /tmp/fm-hcxdumptool.log exists → 400 if not
2. Read file contents
3. Check isRunning (log exists && process running)
4. Return {isRunning, logContent}
```

### Get Capture Output (Download)
```
1. If outputFile param provided, use it
2. Else, scandir descending (minus '.'/'..'), take index [0] (latest); null if none
3. If still empty → 400 "No capture output available"
4. basename() the name (path-traversal guard), build path under /root/.hcxdumptool/
5. Verify file exists → 400 if not
6. Stream file via ResponseHandler::streamFile()
```

### Module Status
```
1. Create /root/.hcxdumptool/ if missing (0755)
2. Check if hcxdumptool binary exists (OpenWrtHelper::commandExists)
3. If exists: return hasDependencies=true + isRunning + interfaces list
4. If not: return hasDependencies=false + storage availability info
```

### Diagnostics (InfoCard actions) — version-aware, background

`isRewriteCli()` (true when installed ≥ 6.3.0, default true when unparseable) routes each action:
- `listInterfaces`: `-L` on 6.3.x, `-I` on 6.2.x (6.2.4 had no `-L`; its no-arg `-I` is the list).
- `showChannels`: `[-i iface] -C` on 6.2.x; 6.3.x → 400 "Show channels (-C) was removed … Use Interface Info (-I)".
- `interfaceInfo`: `-I <iface>` (detailed) on 6.3.x (requires an interface); 6.2.x → 400 (its `-I` is the list, no per-iface info).
- `checkDriver`: `[-i iface] --check_driver` on 6.2.x; 6.3.x → 400 "removed in 6.3.x".

**Execution:** each action calls `startInfoTask($command)` → `BackgroundTaskHelper::start('hcxdumptool-info', $command)` (nohup, stdout+stderr → task log, completion flag on exit), returns `{started:true}`. The frontend's `useRunInfoAction` polls `getInfoStatus` (`useBackgroundTask`, **12h safety ceiling**) until `{completed:true}`, then shows `output`. `stopInfo` (`killall -9 hcxdumptool`) cancels a hung probe; the wrapper still flags complete so the poll resolves with partial output.

The InfoCard renders buttons for the **detected** branch (6.3.x: List Interfaces + Interface Info; 6.2.x: List Interfaces + Show Channels + Check Driver), all disabled while a task runs, plus a **Stop** button enabled only while running. All interface args escaped via `escapeshellarg`.

> **Capture vs info process disambiguation:** info commands are also `hcxdumptool` processes now, so the capture's running-state check uses `checkRunning($pcapDirectory, true)` = `pgrep -f /root/.hcxdumptool` (only the capture carries `-w /root/.hcxdumptool/…` in its argv), not a global `pgrep hcxdumptool`. This prevents a running diagnostic from falsely showing the capture as active. `stopInfo` and `stopCapture` both `killall hcxdumptool` (the two never run together on one radio).

## Error Handling

| Condition | Response |
|-----------|----------|
| No command param | `400: No command provided` |
| Log file missing | `400: Could not find log output: /tmp/fm-hcxdumptool.log` |
| Capture file missing | `400: Could not find capture output: {path}` |
| File to delete doesn't exist | `400: File does not exist.` |
| hcxdumptool not installed | `moduleStatus` returns `hasDependencies: false` |
| Capture dir missing | Auto-created by `moduleStatus` (0755) |
| No captures for fallback download | `400: No capture output available` (fallback now uses index [0] with a null guard) |
| `interfaceInfo` with no interface | `400: No interface provided` |
| `showChannels` on 6.3.x | `400: Show channels (-C) was removed in hcxdumptool 6.3.x. Use "Interface Info" (-I) instead.` |
| `interfaceInfo` on 6.2.x | `400: Per-interface info (-I <iface>) requires hcxdumptool 6.3.x …` |
| `checkDriver` on 6.3.x | `400: Driver check (--check_driver) was removed in hcxdumptool 6.3.x.` |

## Security Considerations

1. **Command injection via `command` param**: `escapeshellcmd()` sanitizes metacharacters but the input still controls hcxdumptool flags. This is intentional — the frontend constructs the command. However, `extraFlags` is user-typed free text that gets included. `escapeshellcmd()` prevents shell injection but allows arbitrary hcxdumptool flags.
2. **Path traversal in `outputFile` and `filename`**: Fixed — `getCaptureOutput` and `deleteCapture` both apply `basename()` to the user-supplied name before building the path under `$this->pcapDirectory`. The filter/ESSID list files are written to fixed `/tmp/fm-hcxdumptool-*` paths (not user-controlled).
3. **Process kill is not scoped**: `killall -9 hcxdumptool` kills ALL hcxdumptool processes, not just the one started by this module. Acceptable on single-user embedded device.
4. **Root execution**: hcxdumptool requires root. The entire Frieren backend runs as root on OpenWrt.
5. **Capture directory permissions**: Created with 0755.
6. **Signal 9 (SIGKILL)**: No graceful shutdown. hcxdumptool may not flush remaining captured data. Consider SIGTERM first, SIGKILL as fallback.
7. **`command` / `extraFlags` still pass arbitrary hcxdumptool flags**: `escapeshellcmd()` blocks shell metacharacters but the user can supply any hcxdumptool option via the form or Extra Flags (intentional escape hatch).

## Rate Limits / Timeouts / Retries

| Aspect | Value |
|--------|-------|
| Capture timeout | Configurable via `--tot=N` minutes (min: 2). hcxdumptool exits with code 2 on timeout |
| Watchdog timeout | hcxdumptool default: 600s when no packets received |
| EAPOL timeout | hcxdumptool default: 20000 usec |
| Log polling interval | Frontend: 5000ms (every 5s) |
| Startup sleep | Frontend: 600ms delay after startCapture before setting isRunning=true |

## Logging Requirements

- Currently: capture output logged to `/tmp/fm-hcxdumptool.log` (by hcxdumptool itself)
- Module-level logging: none
- Should log: capture start/stop events, parameters used, capture duration
- Use `$this->logger()` for syslog integration

## Test Strategy

| Category | Test |
|----------|------|
| Unit | `moduleStatus` returns correct interface list |
| Unit | `moduleStatus` creates capture directory if missing |
| Unit | `moduleStatus` detects hcxdumptool binary presence |
| Unit | `startCapture` rejects empty command |
| Unit | `startCapture` generates correct filename format |
| Unit | `stopCapture` returns correct running state |
| Unit | `getCaptureHistory` lists only files (not directories) |
| Unit | `deleteCapture` rejects nonexistent files |
| Unit | `deleteAll` removes all files but not directory |
| Integration | Start → poll log → stop → verify capture file exists |
| Integration | Download capture file matches what hcxdumptool wrote |
| Security | Path traversal blocked in outputFile/filename params |
| Security | escapeshellcmd prevents shell injection in command |
| Edge | getCaptureOutput fallback when no outputFile and no captures |
| Edge | Multiple rapid start/stop cycles |
| Edge | stopCapture when not running |

## Acceptance Criteria

1. Module detects hcxdumptool binary presence (from any package)
2. Available network interfaces listed dynamically
3. User can configure: interface, channel band, attack vectors, filtering, timing, extra flags
4. Frontend builds correct hcxdumptool command from form fields
5. Capture runs in background, output streams to log file
6. Real-time log output displayed with 5s auto-refresh
7. Running state reflected in UI (Capture button disabled, Stop button enabled)
8. Capture files listed in history with download and delete actions
9. "Delete All" clears entire capture history
10. Process properly killed on stop

## Implementation Notes

### Current Backend File
`frieren-modules/hcxdumptool/public/HcxdumptoolController.php`

### Current Frontend Files
- `src/feature/containers/Screen/index.jsx` — 2-tab layout (Capture, History)
- `src/feature/components/SettingsCard/index.jsx` — Version selector + dual capture form laid out as a collapsible **Accordion** (Core / Display / Attacks / Filtering / Timing / GPS-Other) with a live `CommandPreview` (via `useWatch`) at the bottom. Two builders `buildCommand62`/`buildCommand63` (shared `buildCommand(isLegacyCli, data)`); `isLegacyCli` (6.2.x) gates which fields render; warns when the selected branch ≠ detected `toolBranch`.
- `src/feature/components/InfoCard/index.jsx` — Diagnostics; version-aware buttons by detected `toolBranch` (6.3.x: List Interfaces + Interface Info; 6.2.x: List Interfaces + Show Channels + Check Driver) + a Stop button. Runs commands as a background task via `useRunInfoAction` (start + poll `getInfoStatus`, 12h ceiling, output on completion) and `useStopInfo`. List-Interfaces button icon is `wifi`.
- `src/feature/components/OutputCard/index.jsx` — Real-time log textarea with auto-scroll
- `src/feature/components/HistoryCard/index.jsx` — Capture file list with download/delete
- `src/feature/atoms/isRunningAtom.js` — Jotai atom for running state
- `src/feature/hooks/useModuleStatus.js` — Polls moduleStatus, syncs isRunning
- `src/feature/hooks/useStartCapture.js` — Mutation; forwards `command, toolVersion, essidList, filterlistAp, filterlistClient, bpf` to the backend; 600ms delay before setting running
- Card titles carry feather icons (Capture Settings `settings`, Output `terminal`, Tool Info `info`, History `clock`); all icon names are validated to exist in `frieren-icons` (`list`/`shield-check` do **not** exist — a frequent gotcha).
- `src/feature/hooks/useStopCapture.js` — Mutation, clears running state
- `src/feature/hooks/useGetLogContent.js` — Query with 5s refetchInterval when running
- `src/feature/hooks/useDownloadCaptureOutput.js` — Uses `fetchPostDownload` for binary download
- `src/feature/hooks/useRunInfoAction.js` — Starts a diagnostic action then polls `getInfoStatus` via `useBackgroundTask` (12h ceiling); exposes `{run, isPending, isRunning, output}`
- `src/feature/hooks/useStopInfo.js` — Mutation calling `stopInfo`
- `src/feature/hooks/useGetPresets.js` / `useSavePreset.js` / `useDeletePreset.js` — Capture preset CRUD
- `src/feature/helpers/presets.js` — `DEFAULT_PRESETS` (built-in, baked-in presets)

### Version Compatibility Matrix (verified against `hcxdumptool.c` @ tags 6.2.4 / 6.3.4)

Per-capability flag by branch. "—" = no equivalent in that branch (field hidden).

| Capability | 6.2.x flag | 6.3.x flag |
|------------|-----------|-----------|
| Interface | `-i` | `-i` |
| Channel / band | `-s` (scanlist 0–5), `-c` (channel #) | `-c` band-suffixed (`1a,6a,11a`) |
| Single frequency MHz | — (`-f` is the frames bitmask in 6.2.x) | `-f` |
| All frequencies | — (auto is default; `-s 4` combined) | `-F` |
| Min stay time | `-t` | `-t` |
| Real-time display | `--enable_status=<bitmask>` (8 bits) | `--rds=<0\|1>` sort mode (single digit, NOT a bitmask) |
| Disable client attacks | `--disable_client_attacks` | `--attemptclientmax=0` |
| Disable AP attacks | `--disable_ap_attacks` | `--attemptapmax=0` |
| Stop AP attacks after N | `--stop_ap_attacks=N` | `--attemptapmax=N` |
| Stop client attacks after N | `--stop_client_m2_attacks=N` | `--attemptclientmax=N` |
| Passive / no transmit | `--silent` | — (use `--rcascan=p` or `--attemptapmax=0 --attemptclientmax=0`) |
| Beacon control | `--active_beacon` | `--disable_beacon` (internal beacon on by default) |
| Soft filter lists | `--filtermode` + `--filterlist_ap` + `--filterlist_client` | — (BPF only: `--bpf`) |
| ESSID list | `--essidlist` (transmit beacons) | `--essidlist` (seed ring buffer) |
| Capture timeout | `--tot` | `--tot` |
| EAPOL timeout | `--eapoltimeout` | — (removed) |
| Watchdog max | — (no watchdog in 6.2.x) | `--watchdogmax` |
| Set device MAC | — (never existed) | — (never existed) |
| gpsd | `--use_gpsd` | `--gpsd` |
| NMEA file | `--nmea` | `--nmea_out` |
| RCA scan | `--do_rcascan` (no-arg) | `--rcascan=p\|a` (requires arg) |
| List interfaces | `-I` (no-arg) | `-L` |
| Show channels | `-C` | — (use `-I <iface>`) |
| Per-interface info | — (`-I` is the list) | `-I <iface>` |
| Check driver | `--check_driver` | — (removed; nl80211 rewrite) |
| BPF filter | `--bpfc` (compile-from-source workflow) | `--bpf=<file>` |
| Extra flags escape hatch | yes | yes |
| hcxpcapngtool post-processing | NO | NO |

**Invalid flags removed from the module** (existed in NEITHER 6.2.4 nor 6.3.4): `--mac_ap`, `--mac_client`. Wrong spellings the old single-version builder emitted: `--stop_client_attacks` (→ `--stop_client_m2_attacks`), `--passive` (→ `--silent`), `--gpsd` on 6.2.x (→ `--use_gpsd`), `-L`/`-F`/`--watchdogmax`/`-f`-as-MHz on 6.2.x (invalid there), `--enable_status` on 6.3.x (removed — was the bug that aborted every capture).

Remaining genuine gaps (both branches): on-device hcxpcapngtool post-processing (captures still downloaded + converted externally); BPF on 6.3.x must be supplied as already-compiled tcpdump `-ddd` decimal format (no in-UI compiler).

### Known Bugs / Notes
1. **6.3.4 CLI breakage** — fixed: the module was written for a 6.2-era CLI and aborted **every** capture on 6.3.x because it unconditionally prepended the removed `--enable_status`. Now version-aware (6.2.x / 6.3.x builders); verified on a 6.3.4 device that the 6.3.x command parses (only a bad interface fails, no "unrecognized option") and that `--enable_status` is rejected.
2. **`stopCapture` return** — fixed: `return self::setSuccess([...])`.
3. **`getCaptureOutput` fallback** — fixed: uses index `[0]` of the descending list with a null guard.
4. **Path traversal** — fixed: `basename()` applied to `outputFile`/`filename`.
5. **`checkModuleDependencies` commented out**: still bypassed in favor of the custom `moduleStatus` (intentional — binary can come from multiple packages).
6. **SIGKILL without SIGTERM**: still a forceful kill; may lose buffered capture data.
7. **File extension** — now `.pcapng` (matches the pcapng content `-w` writes).
8. **6.2.x branch not runtime-tested**: the test device runs 6.3.4. The 6.2.x flag set is verified against `hcxdumptool.c` @ tag 6.2.4 but has no live run. Some 6.2.x flags are also build-gated upstream (`--use_gpsd`/`--nmea` need HCXNMEAOUT).
9. **`--rds`/`--gpsd`/`--nmea_out` (6.3.x) are build-gated** (HCXSTATUSOUT / HCXNMEAOUT): present on the 6.3.4 test binary, but a binary built without those defines would reject them.
10. **Info commands now background** — `-L`/`-C`/`-I`/`--check_driver` run via `BackgroundTaskHelper` (start + poll `getInfoStatus`) instead of a blocking synchronous `exec`, so a slow/hung hardware probe can't pin a PHP worker. Added a Stop button + `stopInfo`. Poll safety ceiling 12h (local override; shared `useBackgroundTask` default is 1h).
11. **Capture/info process collision** — fixed: capture liveness now uses `pgrep -f /root/.hcxdumptool` (capture-specific argv) instead of global `pgrep hcxdumptool`, so a backgrounded info `hcxdumptool` no longer makes the UI show a phantom running capture.

### Legacy Pineapple Module Comparison
The Angular pineapple-modules version used a job-based API (`poll_job`, `start_capture`, `stop_capture`, `startup`, `check_dependencies`, `manage_dependencies`, `list_capture_history`, `delete_capture`, `delete_all`). The Frieren version is a complete rewrite with direct process management instead of the job queue pattern.

## Migration / Backward Compatibility

- Current v1.0.0. No prior versions in Frieren framework.
- Legacy Pineapple module used different API action names and job-based execution — no direct migration path needed.
- Frontend and backend are tightly coupled via the `command` string — any change to command construction in frontend is transparent to backend.

## Open Questions

1. **`.pcap` → `.pcapng`**: done. Confirm the `wpaonlinecrack` module discovers `.pcapng` captures (it shares `/root/.hcxdumptool/`); pre-existing `.pcap` files still list.
2. Should the tool-version selector be **locked** to the detected branch (read-only) instead of overridable? Current: defaults to detected, overridable with a warning.
3. Should hcxpcapngtool integration be added for on-device hash extraction?
4. Should capture settings be persisted to UCI so they survive page reloads?
5. Should there be a graceful stop (SIGTERM → wait → SIGKILL) instead of immediate SIGKILL?
6. Should the 6.3.x BPF field accept a tcpdump-syntax expression and compile it on-device (via `--bpfc`) instead of requiring pre-compiled `-ddd` decimal input?
7. Should the interface list filter to only wireless interfaces? Currently shows all from `/sys/class/net/`.
8. Should build-gated 6.3.x flags (`--rds`/`--gpsd`/`--nmea_out`) be hidden unless detected in the binary's capabilities?
