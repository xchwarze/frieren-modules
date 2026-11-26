/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useSetAtom } from 'jotai';

import { sleep } from '@src/helpers/actionsHelper.js';
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';

const useStartCapture = () => {
    const setIsRunning = useSetAtom(isRunningAtom);

    return useAuthenticatedMutation({
        mutationFn: ({ interface: iface, channel, band, bssid, deauthCount }) => fetchPost({
            module: 'handshakes',
            action: 'startCapture',
            interface: iface,
            channel,
            band,
            bssid,
            deauthCount,
        }),
        onSuccess: async () => {
            // Give the monitor setup + airodump-ng spawn a moment before the atom
            // starts driving status/log polling.
            await sleep(800);
            setIsRunning(true);
        },
    });
};

export default useStartCapture;
