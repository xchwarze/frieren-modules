/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';

import useBackgroundTask from '@src/hooks/useBackgroundTask.js';
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { HCXDUMPTOOL_GET_INFO_STATUS } from '@module/feature/helpers/queryKeys.js';

// Diagnostic commands (-C / --check_driver) probe hardware and can hang, so they
// run as a background task and we poll getInfoStatus. The 12h safety ceiling just
// stops the poll from giving up on a genuinely long op; normal commands finish in
// seconds. (The shared useBackgroundTask default is 1h.)
const SAFETY_TIMEOUT_MS = 12 * 60 * 60 * 1000;

/**
 * Runs an hcxdumptool info/diagnostic action as a background task and polls for
 * its output.
 *
 * @return {Object} { run, isPending, isRunning, output }
 */
const useRunInfoAction = () => {
    const [output, setOutput] = useState('');

    const task = useBackgroundTask({
        queryKey: HCXDUMPTOOL_GET_INFO_STATUS,
        module: 'hcxdumptool',
        action: 'getInfoStatus',
        timeout: SAFETY_TIMEOUT_MS,
        onCompleted: (data) => setOutput(data?.output ?? ''),
    });

    const mutation = useAuthenticatedMutation({
        mutationFn: ({ action, interface: iface }) => fetchPost({
            module: 'hcxdumptool',
            action,
            interface: iface,
        }),
        // The start action returns immediately ({started:true}); begin polling.
        // A version-gate rejection (e.g. -C on 6.3.x) comes back as an error — show it.
        onSuccess: () => {
            setOutput('');
            task.start();
        },
        onError: (error) => setOutput(error?.message ?? 'Error running command.'),
    });

    return {
        run: mutation.mutate,
        isPending: mutation.isPending,
        isRunning: task.isRunning,
        output,
    };
};

export default useRunInfoAction;
