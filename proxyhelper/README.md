# Proxy Helper Module

A module for routing network traffic through an external interception proxy — such as Burp Suite or OWASP ZAP — by managing iptables DNAT rules on the OpenWrt device. Proxy Helper stores proxy configuration persistently, provides a one-click toggle to enable or disable traffic redirection, and maintains timestamped firewall backups for safe rollback.

## Features

- **Persistent configuration** — stores proxy host, proxy port, and the list of TCP ports to forward in UCI config; settings survive reboots
- **Routing toggle** — a single button enables or disables IP forwarding and all DNAT rules simultaneously; status is queried from the live iptables state on every page load
- **Per-port management** — add or remove individual DNAT rules without toggling the entire routing setup; idempotent (uses `iptables -C` to avoid duplicate rules)
- **NAT rule viewer** — displays the full raw output of `iptables -t nat -L -n -v` and a parsed list of active forwarded ports with their destinations
- **Scoped, isolated NAT** — the MASQUERADE rule is matched to the proxied destination/port (`-d host -p tcp --dport port`), not applied globally, and lives in a dedicated `FRIEREN_PROXY` nat chain. Disabling routing flushes and removes that chain, so the module's rules are always fully cleaned up — even if the proxy host/port changed between enable and disable (no orphan rules)
- **Firewall backups** — each mutating operation (enable, disable, add port, delete port) auto-creates a timestamped `iptables-save` snapshot before applying changes; the newest 20 are kept (older auto-backups are pruned)
- **Backup management** — list, restore, and delete named backup files from the UI; restore atomically replaces all iptables rules

## Use Cases

- **Web application penetration testing** — transparently redirect HTTP/HTTPS traffic from clients on the local network through Burp Suite for interception and manipulation without modifying client browser settings
- **Mobile application testing** — route traffic from mobile devices connected to the OpenWrt access point through an intercepting proxy, capturing API calls without installing a proxy app on the device
- **Traffic analysis** — redirect specific ports to a local listener to inspect or log raw TCP streams during authorized assessments
- **Safe firewall experimentation** — use the automatic pre-mutation backups to experiment with iptables changes; restore any snapshot to recover a known-good state if something breaks

## Requirements

| Requirement | Notes |
|-------------|-------|
| `iptables` / `iptables-save` / `iptables-restore` | Built into OpenWrt |
| External proxy (Burp Suite, ZAP, etc.) | Runs on a machine reachable from the device |
| No opkg packages | No additional packages required |

## Configuration

| UCI Key | Description | Example |
|---------|-------------|---------|
| `proxyHost` | IP address of the proxy machine | `192.168.1.100` |
| `proxyPort` | Port the proxy listens on | `8080` |
| `forwardPorts` | Comma-separated TCP ports to redirect | `80,443,8080` |

Config stored at `/etc/config/fmod_proxyhelper`.

## Architecture

```
Frontend                          Backend (PHP)
────────────────────              ──────────────────────────
ProxyCard                         ProxyhelperController
  └─ Settings form                  getSettings / setSettings → UCI
  └─ Routing toggle ─────────────▶  toggleRouting  → ip_forward + iptables DNAT
  └─ Status indicator ◀──────────   getRoutingStatus → /proc/sys/net/ipv4/ip_forward + iptables -C
NAT Viewer                          getNatRules    → iptables -t nat -L -n -v
  └─ Port list ◀──────────────────  getForwardedPorts → parse DNAT rules
  └─ Add/Delete port ─────────────▶ addPort / deletePort → idempotent iptables rules
BackupsCard                         getBackups / backupFirewall / restoreFirewall / deleteBackup
```

Traffic flow when routing is enabled:

```
Client → [PREROUTING: DNAT → proxy:8080] → [IP Forward] → [POSTROUTING: MASQUERADE -d proxy --dport 8080] → Proxy
```

Firewall rules are **not persistent across reboots** — the routing toggle reflects the live iptables state on each page load.

## License

LGPL-3.0-or-later
