/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useSetAtom } from 'jotai';
import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';

const useStartScan = () => {
    const setIsRunning = useSetAtom(isRunningAtom);

    return useAuthenticatedMutation({
        mutationFn: ({ command }) => fetchPost({
            module: 'nmap',
            action: 'startScan',
            command,
        }),
        onSuccess: () => {
            setIsRunning(true);
        },
        onError: () => {
            setIsRunning(false);
            toast.error('Failed to start scan');
        },
    });
};

export default useStartScan;
