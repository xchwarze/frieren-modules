# Handshakes

WPA handshake capture and management module for [Frieren](https://github.com/xchwarze/frieren),
built on `airodump-ng` / `aircrack-ng` (the `aircrack-ng` opkg package).

It brings the classic "handshake manager" workflow to Frieren: pick a radio, start a
capture, optionally fire a bounded deauth burst to force clients to re-handshake, watch
the live airodump-ng output, then inspect, download and delete the captures from the
History tab.

## Features

- **Capture** — start/stop `airodump-ng` on a monitor interface derived from any
  wireless radio (a dedicated `frieren-mon` vif is added on the radio's phy; the
  infrastructure interface itself is never switched to monitor, so the panel AP stays up).
  Lock a channel, target a BSSID, or hop by band.
- **Active deauth** — optional bounded `aireplay-ng --deauth` burst against a target AP
  (requires a channel + BSSID) to accelerate handshake capture. Off by default.
- **Live output** — the airodump-ng TUI is streamed to a resizable xterm pane and drained
  server-side so the tmpfs log never grows unbounded.
- **History** — every capture with the access points seen (parsed from the airodump-ng
  CSV sidecar), size and date. Check a capture with `aircrack-ng` for handshakes/PMKIDs,
  download it, or delete it (single or all).

## Storage

Captures are written to `/sd/handshakes` when an SD card is mounted, and to
`/root/.handshakes` on the internal overlay otherwise. The active path and its free space
are shown in the panel.

## Actions

| Action | Description |
|--------|-------------|
| `moduleStatus` | Dependency/readiness snapshot, wireless interfaces, storage path + free space |
| `startCapture` | Start a capture (`interface`, `channel`, `band`, `bssid`, `deauthCount`) |
| `stopCapture` | Stop the capture and tear down the monitor vif |
| `getCaptureStatus` | Poll a running capture (`completed`, `isRunning`, `output`) |
| `getLogContent` | Drain the live capture log |
| `getCaptureHistory` | Captures with size, mtime, access points |
| `checkHandshake` | Run aircrack-ng on one capture (handshake / PMKID counts) |
| `downloadCapture` | Stream a capture file |
| `deleteCapture` / `deleteAll` | Delete one / all captures |

## Build

```bash
yarn install
yarn build
yarn validate
```

Requires a sibling checkout of the main `frieren` repo (for the shared frontend under
`VITE_COMMON_ALIAS`, set to `../../frieren/frieren-front/src`).

## Notes

Run captures against networks you own or are authorised to test. Deauth frames disrupt
real client traffic.

## License

LGPL-3.0-or-later
