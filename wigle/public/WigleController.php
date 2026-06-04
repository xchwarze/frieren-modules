<?php
/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */

namespace frieren\modules\wigle;

class WigleController extends \frieren\core\Controller
{
    protected $endpointRoutes = [
        'checkModuleDependencies' => true,
        'installModuleDependencies' => true,
        'getDependencyInstallationStatus' => true,
        'getSettings' => true,
        'setSettings' => true,
        'search' => true,
        'searchBluetooth' => true,
        'searchCell' => true,
        'networkDetail' => true,
        'userStats' => true,
    ];

    public function getSettings()
    {
        $config = self::getConfig();

        return self::setSuccess([
            'apiToken' => $config['apiToken'] ?? '',
        ]);
    }

    public function setSettings()
    {
        $apiToken = $this->request['apiToken'] ?? '';
        if (empty($apiToken)) {
            return self::setError('API token is required');
        }

        self::setConfig([
            'apiToken' => $apiToken,
        ]);

        return self::setSuccess();
    }

    private function wigleApiGet($endpoint, $params = [])
    {
        $config = self::getConfig();
        $token = $config['apiToken'] ?? '';
        if (empty($token)) {
            return ['error' => 'API token not configured'];
        }

        $queryString = !empty($params) ? '?' . http_build_query($params) : '';
        $url = "https://api.wigle.net{$endpoint}{$queryString}";

        $command = sprintf(
            'curl -s -H %s %s 2>&1',
            escapeshellarg("Authorization: Basic {$token}"),
            escapeshellarg($url)
        );

        $output = self::setupCoreHelper()::exec($command, false);
        $response = json_decode($output, true);

        if (!$response) {
            return ['error' => 'Failed to query WiGLE API'];
        }

        if (isset($response['success']) && !$response['success']) {
            return ['error' => $response['message'] ?? 'WiGLE API error'];
        }

        return $response;
    }

    public function search()
    {
        $config = self::getConfig();
        $token = $config['apiToken'] ?? '';
        if (empty($token)) {
            return self::setError('API token not configured');
        }

        $ssid = $this->request['ssid'] ?? '';
        $mac = $this->request['mac'] ?? '';
        $country = $this->request['country'] ?? '';
        $city = $this->request['city'] ?? '';
        $encryption = $this->request['encryption'] ?? '';
        $resultsPerPage = $this->request['resultsPerPage'] ?? '10';
        $searchAfter = $this->request['searchAfter'] ?? '';
        $ssidlike = $this->request['ssidlike'] ?? '';
        $region = $this->request['region'] ?? '';
        $postalCode = $this->request['postalCode'] ?? '';
        $channel = $this->request['channel'] ?? '';
        $frequency = $this->request['frequency'] ?? '';
        $latrange1 = $this->request['latrange1'] ?? '';
        $latrange2 = $this->request['latrange2'] ?? '';
        $longrange1 = $this->request['longrange1'] ?? '';
        $longrange2 = $this->request['longrange2'] ?? '';
        $closestLat = $this->request['closestLat'] ?? '';
        $closestLong = $this->request['closestLong'] ?? '';
        $lastupdt = $this->request['lastupdt'] ?? '';
        $onlymine = filter_var($this->request['onlymine'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $freenet = filter_var($this->request['freenet'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $paynet = filter_var($this->request['paynet'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (empty($ssid) && empty($mac) && empty($country) && empty($city) && empty($ssidlike)) {
            return self::setError('At least one search parameter is required');
        }

        $params = [
            'onlymine' => $onlymine ? 'true' : 'false',
            'freenet' => $freenet ? 'true' : 'false',
            'paynet' => $paynet ? 'true' : 'false',
            'resultsPerPage' => $resultsPerPage,
        ];
        if (!empty($ssid)) {
            $params['ssid'] = $ssid;
        }
        if (!empty($mac)) {
            $params['netid'] = $mac;
        }
        if (!empty($country)) {
            $params['country'] = $country;
        }
        if (!empty($city)) {
            $params['city'] = $city;
        }
        if (!empty($encryption)) {
            $params['encryption'] = $encryption;
        }
        if (!empty($searchAfter)) {
            $params['searchAfter'] = $searchAfter;
        }
        if (!empty($ssidlike)) {
            $params['ssidlike'] = $ssidlike;
        }
        if (!empty($region)) {
            $params['region'] = $region;
        }
        if (!empty($postalCode)) {
            $params['postalCode'] = $postalCode;
        }
        if (!empty($channel)) {
            $params['channel'] = $channel;
        }
        if (!empty($frequency)) {
            $params['frequency'] = $frequency;
        }
        if (!empty($latrange1)) {
            $params['latrange1'] = $latrange1;
        }
        if (!empty($latrange2)) {
            $params['latrange2'] = $latrange2;
        }
        if (!empty($longrange1)) {
            $params['longrange1'] = $longrange1;
        }
        if (!empty($longrange2)) {
            $params['longrange2'] = $longrange2;
        }
        if (!empty($closestLat)) {
            $params['closestLat'] = $closestLat;
        }
        if (!empty($closestLong)) {
            $params['closestLong'] = $closestLong;
        }
        if (!empty($lastupdt)) {
            $params['lastupdt'] = $lastupdt;
        }

        $response = $this->wigleApiGet('/api/v2/network/search', $params);
        if (isset($response['error'])) {
            return self::setError($response['error']);
        }

        return self::setSuccess([
            'results' => $response['results'] ?? [],
            'totalResults' => $response['totalResults'] ?? 0,
            'searchAfter' => $response['searchAfter'] ?? '',
        ]);
    }

    public function searchBluetooth()
    {
        $params = ['resultsPerPage' => $this->request['resultsPerPage'] ?? '10'];

        $name = $this->request['name'] ?? '';
        $mac = $this->request['mac'] ?? '';
        $country = $this->request['country'] ?? '';
        $city = $this->request['city'] ?? '';
        $searchAfter = $this->request['searchAfter'] ?? '';

        if (empty($name) && empty($mac) && empty($country) && empty($city)) {
            return self::setError('At least one search parameter is required');
        }

        if (!empty($name)) $params['name'] = $name;
        if (!empty($mac)) $params['netid'] = $mac;
        if (!empty($country)) $params['country'] = $country;
        if (!empty($city)) $params['city'] = $city;
        if (!empty($searchAfter)) $params['searchAfter'] = $searchAfter;

        $response = $this->wigleApiGet('/api/v2/bluetooth/search', $params);
        if (isset($response['error'])) {
            return self::setError($response['error']);
        }

        return self::setSuccess([
            'results' => $response['results'] ?? [],
            'totalResults' => $response['totalResults'] ?? 0,
            'searchAfter' => $response['searchAfter'] ?? '',
        ]);
    }

    public function searchCell()
    {
        $params = ['resultsPerPage' => $this->request['resultsPerPage'] ?? '10'];

        $mcc = $this->request['mcc'] ?? '';
        $mnc = $this->request['mnc'] ?? '';
        $lac = $this->request['lac'] ?? '';
        $cid = $this->request['cid'] ?? '';
        $country = $this->request['country'] ?? '';
        $city = $this->request['city'] ?? '';
        $searchAfter = $this->request['searchAfter'] ?? '';

        if (empty($mcc) && empty($country) && empty($city) && empty($lac) && empty($cid)) {
            return self::setError('At least one search parameter is required');
        }

        if (!empty($mcc)) $params['mcc'] = $mcc;
        if (!empty($mnc)) $params['mnc'] = $mnc;
        if (!empty($lac)) $params['lac'] = $lac;
        if (!empty($cid)) $params['cid'] = $cid;
        if (!empty($country)) $params['country'] = $country;
        if (!empty($city)) $params['city'] = $city;
        if (!empty($searchAfter)) $params['searchAfter'] = $searchAfter;

        $response = $this->wigleApiGet('/api/v2/cell/search', $params);
        if (isset($response['error'])) {
            return self::setError($response['error']);
        }

        return self::setSuccess([
            'results' => $response['results'] ?? [],
            'totalResults' => $response['totalResults'] ?? 0,
            'searchAfter' => $response['searchAfter'] ?? '',
        ]);
    }

    public function networkDetail()
    {
        $netid = $this->request['netid'] ?? '';
        if (empty($netid)) {
            return self::setError('Network ID (MAC) is required');
        }

        $response = $this->wigleApiGet('/api/v2/network/detail', ['netid' => $netid]);
        if (isset($response['error'])) {
            return self::setError($response['error']);
        }

        return self::setSuccess([
            'results' => $response['results'] ?? [],
        ]);
    }

    public function userStats()
    {
        $response = $this->wigleApiGet('/api/v2/stats/user');
        if (isset($response['error'])) {
            return self::setError($response['error']);
        }

        return self::setSuccess([
            'statistics' => $response['statistics'] ?? $response,
        ]);
    }
}
