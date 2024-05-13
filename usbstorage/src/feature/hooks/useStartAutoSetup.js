/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useSetAtom } from 'jotai';

import { sleep } from '@src/helpers/actionsHelper.js';
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningSetupAtom from '@module/feature/atoms/isRunningSetupAtom.js';

const useStartAutoSetup = () => {
    const setIsRunning = useSetAtom(isRunningSetupAtom);

    return useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'usbstorage',
            action: 'startAutoSetup',
        }),
        onSuccess: async () => {
            await sleep(600);
            setIsRunning(true);
        },
    });
};

export default useStartAutoSetup;
