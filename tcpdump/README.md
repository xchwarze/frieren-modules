# TCPDump Module

A web UI for capturing network traffic from OpenWrt device interfaces using tcpdump. The TCPDump module provides a graphical BPF filter builder, asynchronous capture execution with live output streaming, and a capture history for downloading pcap files to external analysis tools like Wireshark.

## Features

- **Interface selection** — choose from all network interfaces detected on the device (`/sys/class/net/`)
- **Capture options** — configure verbosity (`-v`/`-vv`/`-vvv`), hostname resolution (`-n`/`-nn`), timestamp format (`-t` through `-ttttt`), and advanced flags: hex+ASCII output, Ethernet headers, absolute sequence numbers, quiet mode, monitor mode
- **Visual BPF filter builder** — construct Berkeley Packet Filter expressions from dropdowns for type, direction, protocol, length, kind, and logical operators; the resulting filter string is editable before use
- **Live command preview** — shows the complete generated tcpdump command before execution
- **Capture presets** — save the current capture configuration under a name and reload it later; operator presets are stored in the module directory (`presets.json`, up to 50)
- **Asynchronous capture** — captures run as a background process; live stdout/stderr output is streamed to the browser every 5 seconds
- **Stop capture** — terminate a running capture at any time
- **pcap file download** — completed captures are saved as timestamped `.pcap` files; download any capture file directly from the browser for analysis in Wireshark or other tools
- **History management** — list all saved captures; delete individual files or clear the entire history in one click
- **Dependency management** — detects tcpdump (`commandExists` check, compatible with both `tcpdump` and `tcpdump-mini` packages) and provides opkg install

## Use Cases

- **Network traffic analysis** — capture packets on any interface to diagnose connectivity issues, inspect protocols, or monitor for anomalous traffic during authorized assessments
- **Offline Wireshark analysis** — download `.pcap` files and open them in Wireshark for deep packet inspection, protocol dissection, and stream reassembly
- **Protocol troubleshooting** — use BPF filters to isolate specific hosts, ports, or protocols and confirm that traffic is flowing as expected
- **Wireless traffic capture** — capture on a monitor-mode interface (`-I`) to inspect 802.11 management frames or client associations
- **Evidence collection** — maintain a timestamped archive of capture sessions for documentation and reporting in security assessments
- **DNS and ARP monitoring** — quickly filter and inspect DNS queries or ARP traffic to detect poisoning or reconnaissance activity

## Requirements

| Requirement | Notes |
|-------------|-------|
| `tcpdump` or `tcpdump-mini` | Installed via opkg if not present |
| `/root/.tcpdump/` | Auto-created on first use (0755) |
| No UCI config | Module is stateless |

## Architecture

```
Frontend                          Backend (PHP)
────────────────────              ────────────────────────
SettingsCard (3-column form)      TcpdumpController
  └─ generateCommand.js             moduleStatus    → commandExists + interfaces
  └─ generateFilter.js              startCapture    → escapeshellcmd + execBackground
CommandInput (preview)             getLogContent   → /tmp/fm-tcpdump.log (5s poll)
FilterInput (preview)              stopCapture     → killall -9 tcpdump
OutputCard (auto-scroll)  ◀──────  getCaptureHistory → list /root/.tcpdump/
HistoryCard                        getCaptureOutput → streamFile (pcap download)
                                   deleteCapture   → unlink file
                                   deleteAll       → unlink all files
                                   getPresets / savePreset / deletePreset → presets.json
```

Captures are written directly to pcap format via `-w {pcapFilePath}` and simultaneously to `/tmp/fm-tcpdump.log` for live polling. The backend blocks the `-z` postrotate flag (arbitrary command execution) and rejects `-r` reading a savefile outside `/root/.tcpdump/` (arbitrary file read).

## License

LGPL-3.0-or-later
