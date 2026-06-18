# WPA Online Crack Module

A module for submitting WPA/WPA2 handshake capture files to cloud-based cracking services and retrieving cracked passwords. WPA Online Crack discovers capture files stored on the device, tracks which files have already been submitted, and supports batch submission to [wpa-sec.stanev.org](https://wpa-sec.stanev.org) and/or [api.onlinehashcrack.com](https://api.onlinehashcrack.com) simultaneously.

> This module supersedes the former `wpasec` module, which has been merged here. All WPA-Sec functionality (submission, per-file tracking, results retrieval) is now handled by this module.

## Features

- **Multi-service submission** — submit captures to WPA-Sec and OnlineHashCrack in a single batch; both are tried when both are configured. WPA-Sec receives the raw capture (cap upload); OnlineHashCrack receives mode-22000 hashes extracted from the capture on-device via `hcxpcapngtool`
- **File discovery** — automatically finds `.cap`, `.pcap`, `.pcapng`, and `.hccapx` files under `/root` and any additional operator-configured folders
- **Per-file submission tracking** — a persistent report tracks which files have been submitted; already-submitted files show a "Submitted" badge and are skipped on re-submission
- **Batch selection** — select individual files or use select-all; the Submit button processes all selected files in one request
- **Submission result summary** — reports the count of submitted, skipped (already sent), and failed (missing or rejected) files per batch
- **Cracked results** — retrieves and displays cracked networks from **both** WPA-Sec (BSSID / ESSID / Password) and OnlineHashCrack (via its v2 `list_tasks` API), each with its own button
- **Configurable extra search folders** — add custom absolute paths (e.g., `/mnt/usb/captures`) to scan in addition to `/root`; configured paths are validated as existing directories
- **Dependency management** — checks for `curl` and `hcxtools` (the latter provides `hcxpcapngtool` for hash extraction) and provides opkg install if missing

## Use Cases

- **Offload WPA cracking to cloud services** — after capturing handshakes with hcxdumptool or tcpdump, submit the files to distributed cracking infrastructure without local compute resources
- **Batch process all captures** — select all discovered capture files and submit them in one operation; the module automatically skips files already submitted in previous sessions
- **Retrieve cracked passwords on demand** — check WPA-Sec or OnlineHashCrack results at any time to see which networks have been cracked since the last submission
- **Manage captures across multiple storage locations** — configure additional scan paths (USB drives, custom directories) so all captures are discovered regardless of where they are stored

## Requirements

| Requirement | Notes |
|-------------|-------|
| `curl` | HTTP submission and results retrieval; installed via opkg if missing |
| `hcxtools` | Provides `hcxpcapngtool` for capture → mode-22000 hash extraction (OnlineHashCrack path) |
| WPA-Sec API key | Register at [wpa-sec.stanev.org/?get_key](https://wpa-sec.stanev.org/?get_key) |
| OnlineHashCrack API key | Optional; `sk_...` key from an [onlinehashcrack.com](https://www.onlinehashcrack.com) account |

At least one service credential must be configured for submission. Cracked-results retrieval is per-service: WPA-Sec results need the WPA-Sec key, OnlineHashCrack results need the OnlineHashCrack key.

## Configuration

| UCI Key | Description | Example |
|---------|-------------|---------|
| `wpaSecKey` | WPA-Sec API key (used as a cookie) | `abc123...` |
| `onlinehashcrackApiKey` | OnlineHashCrack v2 API key | `sk_...` |
| `searchPaths` | JSON array of extra scan folders | `["/mnt/usb/caps"]` |

Config stored at `/etc/config/fmod_wpaonlinecrack`. `searchPaths` defaults to empty — only `/root` is scanned when no extra paths are configured.

## Architecture

```
Frontend                          Backend (PHP)
────────────────────              ──────────────────────────────
CapturesCard                      WpaonlinecrackController
  └─ File table + checkboxes       getCapFiles    → find -L /root [paths] -type f (*.cap/.pcap/...)
  └─ Submit Selected ─────────────▶ sendCap       → wpa-sec: curl POST cap upload (cookie key)
     (shows submitted/skipped/                      OHC: hcxpcapngtool cap→22000 hashes → v2 add_tasks
      failed counts)                                per-file report: /tmp/fm-wpaonlinecrack-report.json
ResultsCard
  └─ Check WPA-Sec ──────────────▶ checkResults    → curl GET wpa-sec.stanev.org/?api&dl=1
  └─ Check OnlineHashCrack ──────▶ checkOhcResults → curl POST v2 list_tasks
SettingsCard
  └─ Key + key form                getSettings / setSettings → UCI
  └─ Extra folders list            (useFieldArray, add/remove rows)
```

A file is only recorded as "submitted" when **all** configured services return HTTP 200. Files that fail on any service remain "Pending" and can be re-selected for retry.

The submission report is stored in the module directory (survives reboot). Every curl uses a connect/overall timeout (`--connect-timeout 10 --max-time 30`), and `sendCap` only submits paths that resolve inside a configured scan folder (containment guard against submitting arbitrary readable files).

## License

LGPL-3.0-or-later
