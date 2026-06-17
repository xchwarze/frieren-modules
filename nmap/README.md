# Nmap Module

A web UI for running Nmap network scans directly from the OpenWrt device. The Nmap module lets you build scan commands from a graphical form, execute them asynchronously, stream live output to the browser, and maintain a searchable history of past scan results — all without touching a terminal.

## Features

- **GUI command builder** — configure target, scan type (`-sS`, `-sT`, `-sU`, `-sA`, `-sP`), timing template (`-T0`–`-T5`), verbosity, OS detection (`-O`), service version detection (`-sV`), traceroute, top-ports, NSE scripts, and raw custom options
- **Live command preview** — the generated nmap command is displayed and editable before execution
- **Asynchronous execution** — scans run as a background process; the HTTP request returns immediately
- **Real-time output streaming** — output is polled every 2 seconds and appended to an auto-scrolling terminal view
- **Stop scan** — kill a running scan at any time with a single button click
- **Timestamped history** — each completed scan is saved as a `.log` file under `/root/.nmap/`; the History tab lists all past scans
- **View and delete history** — open any historical scan in the UI or delete individual files
- **Dependency management** — detects whether nmap is installed and provides a one-click opkg install if not

## Use Cases

- **Network host discovery** — quickly identify live hosts on a subnet (`-sP 192.168.1.0/24`) from the device without needing a separate machine
- **Port enumeration** — enumerate open ports on a specific target during a penetration test or internal network audit
- **Service and version detection** — identify running services and their versions (`-sV`) to find unpatched software
- **OS fingerprinting** — determine operating system of targets (`-O`) to tailor exploitation or hardening efforts
- **NSE script execution** — run Nmap Scripting Engine scripts (e.g., `--script=vuln`, `--script=http-title`) for automated vulnerability assessment
- **Persistent scan record-keeping** — retain a timestamped archive of all scans for reporting or comparison across time

## Requirements

| Requirement | Notes |
|-------------|-------|
| `nmap` | Installed via opkg if not present |
| `/root/.nmap/` | Auto-created on first use |
| No UCI config | Module is stateless |

## Architecture

```
Frontend                          Backend (PHP)
────────────────────              ─────────────────────
OptionsCard (form)                NmapController
  └─ generateCommand.js             moduleStatus     → check nmap, storage
CommandInput (preview)             startScan        → escapeshellcmd + execBackground
OutputCard (auto-scroll)  ◀──────  getLogContent    → read /tmp/nmap.log (2s poll)
HistoryCard                        stopScan         → killall -9 nmap
                                   getHistory       → list /root/.nmap/
                                   getHistoryContent→ read file by name
                                   deleteHistory    → unlink file
```

The backend appends `-oN {logfile}` to every scan command, saving results to `/root/.nmap/{datetime}.log` while simultaneously redirecting stdout/stderr to `/tmp/nmap.log` for live polling.

## License

LGPL-3.0-or-later
