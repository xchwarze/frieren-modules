/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

/**
 * Stops a running diagnostic info command (kills hcxdumptool). The background
 * task then flags complete and the poll resolves with whatever output exists.
 *
 * @return {Object} The mutation object.
 */
const useStopInfo = () => (
    useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'hcxdumptool',
            action: 'stopInfo',
        }),
    })
);

export default useStopInfo;
