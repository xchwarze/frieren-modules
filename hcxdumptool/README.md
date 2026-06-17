# hcxdumptool Module

A web UI for capturing WiFi handshakes and PMKIDs passively using [hcxdumptool](https://github.com/ZerBea/hcxdumptool). The hcxdumptool module supports both the 6.2.x and 6.3.x CLI branches, provides capture presets for common scenarios, exposes diagnostic commands for hardware validation, and produces `.pcapng` capture files compatible with hashcat and wpaonlinecrack.

## Features

- **Version-aware CLI** — detects the installed hcxdumptool version (`--version`) and adapts the command builder to the 6.2.x or 6.3.x CLI; the appropriate flag set is selected automatically
- **Graphical command builder** — configure interface, channel, channel width, scan mode, and all relevant capture flags without memorizing the CLI
- **Capture presets** — built-in presets for common scenarios; operators can create, name, and save up to 50 custom presets stored in the module's own directory
- **Filter list support** — provide ESSID filter lists and (on 6.2.x) separate AP and client MAC filter lists to focus captures on specific targets; 6.3.x uses a compiled BPF expression instead
- **Asynchronous capture** — hcxdumptool runs as a background process; the module uses a launcher script to keep captures running independently of the browser session
- **Live log streaming** — output is polled every 5 seconds using a drain-and-truncate strategy: each poll reads the log then truncates it, keeping the in-RAM tmpfs file tiny even when `--rds` mode repaints continuously
- **Stop capture** — terminate a running capture at any time with SIGKILL
- **Timestamped capture history** — all captures are saved as `.pcapng` files under `/root/.hcxdumptool/`; browse and download from the History tab
- **Delete captures** — remove individual captures or clear the entire history
- **Diagnostic commands** — run `-L` (channel list), `-C` (channel details), `-I` (interface info), and `--check_driver` as background tasks with progress polling; useful for confirming hardware compatibility before capturing
- **Dependency management** — detects hcxdumptool binary presence and provides opkg install with destination selection (internal/SD)

## Use Cases

- **WPA/WPA2 handshake capture** — passively capture WPA handshakes from clients connecting to nearby access points for offline cracking with hashcat or via the WPA Online Crack module
- **PMKID capture** — capture PMKID frames without requiring a client to be present, enabling faster passive WiFi auditing
- **Wireless reconnaissance** — scan the RF environment to enumerate nearby access points, clients, and their associations without injecting traffic
- **Hardware validation** — use the diagnostic commands (`-L`, `-I`, `--check_driver`) to confirm the wireless adapter supports monitor mode and injection before starting a capture session
- **Targeted capture** — use ESSID filter lists or BPF expressions to restrict captures to specific networks and reduce noise in high-density environments
- **Capture file generation for downstream tools** — produce `.pcapng` files for submission to wpa-sec.stanev.org (via WPA Online Crack) or direct conversion with hcxtools for hashcat input

## Requirements

| Requirement | Notes |
|-------------|-------|
| `hcxdumptool` | Installed via opkg; compatible with 6.2.x and 6.3.x |
| Monitor-mode capable wireless adapter | Required for packet capture |
| `/root/.hcxdumptool/` | Auto-created on first use (0755) |
| No UCI config | Module is stateless |

## Architecture

```
Frontend                          Backend (PHP)
────────────────────              ──────────────────────────────
CommandBuilder (form)             HcxdumptoolController
  └─ version-aware flags           moduleStatus    → commandExists + version + interfaces
  └─ ESSID / filter lists          startCapture    → write list files + launcher script
  └─ BPF textarea (6.3.x)                            execBackground(sh launcher)
  └─ Preset selector               stopCapture     → killall -9 hcxdumptool
OutputCard (xterm) ◀──────────── getLogContent    → drain /tmp/fm-hcxdumptool.log (5s poll)
HistoryCard                       getCaptureHistory → list /root/.hcxdumptool/
  └─ Download / Delete             getCaptureOutput → streamFile (pcapng download)
DiagnosticsPanel                  deleteCapture / deleteAll
  └─ Background tasks              listInterfaces / showChannels / interfaceInfo / checkDriver
     (poll getInfoStatus)          getInfoStatus / stopInfo → BackgroundTaskHelper
PresetsPanel                      getPresets / savePreset / deletePreset → presets.json
```

The capture launcher script (`/tmp/fm-hcxdumptool-run.sh`) runs hcxdumptool with `>>` append mode so that each `getLogContent` drain (read + truncate) lets the tool resume writing at offset 0 without leaving sparse gaps in the log file.

## License

LGPL-3.0-or-later
