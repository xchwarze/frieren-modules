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
        mutationFn: ({ command, filterlistAp, filterlistClient, essidList }) => fetchPost({
            module: 'hcxdumptool',
            action: 'startCapture',
            command,
            filterlistAp,
            filterlistClient,
            essidList,
        }),
        onSuccess: async () => {
            await sleep(600);
            setIsRunning(true);
        },
    });
};

export default useStartCapture;
