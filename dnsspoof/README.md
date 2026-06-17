# DNS Spoof Module

A module for manipulating the OpenWrt device's `/etc/hosts` file to redirect DNS resolution for specific domains to attacker-controlled IP addresses. DNS Spoof provides a web UI for adding host entries, a snapshot/rollback mechanism for safe experimentation, and one-click dnsmasq service restart to apply changes.

## Features

- **View current hosts** — displays the active entries in `/etc/hosts` (first block, up to the first blank line)
- **Add host entries** — maps a domain to an IP address with server-side validation: IP via `FILTER_VALIDATE_IP`, hostname via RFC-1123 regex (≤253 chars, dot-separated alnum/hyphen labels)
- **Restart dnsmasq** — applies the modified hosts file by restarting the system DNS resolver
- **Create snapshot** — backs up the current `/etc/hosts` to a persistent file in the module directory (survives reboot); only created once — will not overwrite an existing snapshot
- **Rollback** — restores `/etc/hosts` from the last snapshot, reverting all changes made since the backup was taken

## Use Cases

- **Redirect clients to a captive portal** — point one or more domains to the Evil Portal module's IP so connected clients are intercepted when they browse
- **Simulate DNS poisoning in authorized assessments** — redirect specific hostnames to a controlled server to test how applications behave under DNS manipulation
- **Safe experimentation** — take a snapshot before making changes, add entries, test the behavior, then roll back cleanly to the original state
- **Redirect update/telemetry domains** — force specific IoT device domains to a local server for traffic inspection or to disable cloud callbacks during testing

## Requirements

| Requirement | Notes |
|-------------|-------|
| `dnsmasq` | Built into OpenWrt; reads `/etc/hosts` on restart |
| `/etc/init.d/dnsmasq` | Used to restart the DNS resolver |
| No opkg packages | No additional packages required |

## Architecture

```
Frontend                       Backend (PHP)
────────────────────           ──────────────────────
Hosts textarea (read-only)     DnsspoofController
IP input + Domain input          fetchHosts     → reads /etc/hosts
Add button ────────────────────▶ addHost        → validates + appends entry
Restart button ────────────────▶ restartService → killall dnsmasq + init start
Snapshot button ────────────────▶ createHostSnapshot → file copy (once)
Rollback button ────────────────▶ rollbackHostsFromSnapshot → restore file
```

Changes to `/etc/hosts` affect **all** DNS resolution on the device, not individual clients. A service restart is required after adding entries for them to take effect.

## Important Notes

- Modifying `/etc/hosts` affects every client using the device as its DNS server
- There is no per-entry removal — rollback replaces the entire file
- A snapshot is only written once; a second `createHostSnapshot` call is a no-op if a snapshot already exists
- Entries are inserted into the first block of the hosts file; the module reads and writes only that block

## License

LGPL-3.0-or-later
