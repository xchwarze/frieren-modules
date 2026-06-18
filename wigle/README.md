# WiGLE Module

A module for querying the [WiGLE.net](https://wigle.net) wireless network geolocation database from the OpenWrt device. The WiGLE module provides search interfaces for WiFi networks, Bluetooth/BLE devices, and cellular towers, with pagination, configurable result counts, and network detail lookup — all authenticated via a stored API token.

## Features

- **WiFi network search** — search by SSID (exact or wildcard), MAC/BSSID, country, city, encryption type (none/WEP/WPA/WPA2/WPA3), and optional advanced filters: region, postal code, channel, frequency, geographic bounding box, date range, and onlymine/freenet/paynet toggles
- **Bluetooth/BLE device search** — search by device name, MAC, country, and city
- **Cell tower search** — search by MCC, MNC, LAC, cell ID, country, and city; covers GSM, CDMA, LTE, and 5G towers
- **Network detail** — fetch full WiGLE metadata for a specific network by its BSSID; accessible by clicking any result's MAC address
- **User statistics** — display WiGLE account stats (discovered networks, Bluetooth devices, cells) to validate the stored API token
- **Pagination** — "Load More" appends the next page of results using WiGLE's `searchAfter` cursor; no page reloads
- **Configurable page size** — choose 10, 25, 50, or 100 results per query
- **Token storage** — API token is stored in UCI config and retrieved automatically for all requests

## Use Cases

- **Wireless reconnaissance** — look up known SSIDs or BSSIDs to determine the approximate geographic location of a target network as part of an authorized assessment
- **Historical BSSID lookup** — find when and where a specific MAC address was last seen to build a timeline or correlate with other intelligence
- **Infrastructure research** — enumerate WiFi networks in a target area by country or city to understand the wireless landscape before an engagement
- **Token validation** — confirm a newly obtained WiGLE API token is working correctly by checking user stats before running searches
- **Cell tower mapping** — identify cell towers in an area by MCC/MNC to support cellular network analysis or OSINT investigations

## Requirements

| Requirement | Notes |
|-------------|-------|
| `curl` | Used for all WiGLE API requests; installed via opkg if missing |
| WiGLE account + API token | Register at [wigle.net](https://wigle.net/account) and copy the "Encoded for Use" token |

## Configuration

| UCI Key | Description |
|---------|-------------|
| `apiToken` | WiGLE "Encoded for Use" token (Base64 of `API_NAME:API_TOKEN`) |

Config stored at `/etc/config/fmod_wigle`. The token is obtained from the WiGLE account page under "API Token" → "Encoded for Use".

## Architecture

```
Frontend                          Backend (PHP)
────────────────────              ─────────────────────────
SearchCard (WiFi) ─────────────▶  search          → GET /api/v2/network/search
BluetoothCard ─────────────────▶  searchBluetooth → GET /api/v2/bluetooth/search
CellCard ──────────────────────▶  searchCell      → GET /api/v2/cell/search
NetworkDetailModal ─────────────▶  networkDetail   → GET /api/v2/network/detail
StatsCard ─────────────────────▶  userStats       → GET /api/v2/stats/user
SettingsCard                       getSettings / setSettings → UCI

All API calls share wigleApiGet($endpoint, $params):
  curl -s --connect-timeout 10 --max-time 20 -H "Authorization: Basic <token>" "https://api.wigle.net{endpoint}?{params}"
```

All five search/stats tabs are fully implemented. The WiFi search results table renders each MAC as a link that opens the Network Detail modal. Frontend validates MAC format and country code (2-letter ISO) via yup before submitting.

## License

LGPL-3.0-or-later
