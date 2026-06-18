# DNS Spoof Module

A module for manipulating the OpenWrt device's `/etc/hosts` file to redirect DNS resolution for specific domains to attacker-controlled IP addresses. DNS Spoof provides a web UI for adding host entries, a snapshot/rollback mechanism for safe experimentation, and one-click dnsmasq service restart to apply changes.

## Features

- **View current hosts** — displays the active entries in `/etc/hosts` (first block, up to the first blank line)
- **Add host entries** — maps a domain to an IP address with server-side validation: IP via `FILTER_VALIDATE_IP`, hostname via RFC-1123 regex (≤253 chars, dot-separated alnum/hyphen labels)
- **Delete host entries** — removes an individual `{ip} {domain}` mapping from the managed block, without touching the rest of the file
- **Wildcard spoofing** — maps `*.domain → IP` via a dnsmasq `address=/domain/ip` UCI entry (persists across reboot); add, list, and remove wildcard rules. Covers what `/etc/hosts` (exact match only) cannot. Writes to `/etc/config/dhcp` as a **guarded mutation**: the file is snapshotted before the commit and rolled back if dnsmasq fails to restart, so a bad entry can never leave DNS down for every client
- **Auto-apply** — adding or deleting a host (or wildcard) restarts dnsmasq automatically; the manual **Restart** action remains for explicit re-application
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
Add button ────────────────────▶ addHost        → validates + appends entry (+ auto-restart)
Delete button ─────────────────▶ deleteHost     → removes matching {ip} {domain} (+ auto-restart)
Wildcard add/list/remove ──────▶ addWildcard / fetchWildcards / removeWildcard
                                    → uci dhcp.@dnsmasq[0].address '/domain/ip' (+ auto-restart)
Restart button ────────────────▶ restartService → killall dnsmasq + init start
Snapshot button ────────────────▶ createHostSnapshot → file copy (once)
Rollback button ────────────────▶ rollbackHostsFromSnapshot → restore file
```

Changes to `/etc/hosts` and the wildcard UCI list affect **all** DNS resolution on the device, not individual clients. Adds/deletes auto-restart dnsmasq so they take effect immediately.

## Important Notes

- Modifying `/etc/hosts` affects every client using the device as its DNS server
- Individual entries can be removed with `deleteHost`; rollback is the separate "restore the whole snapshot" path
- A snapshot is only written once; a second `createHostSnapshot` call is a no-op if a snapshot already exists
- Entries are inserted into the first block of the hosts file; the module reads and writes only that block

## License

LGPL-3.0-or-later
