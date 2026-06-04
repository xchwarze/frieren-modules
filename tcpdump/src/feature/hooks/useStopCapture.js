/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import { TCP_DUMP_GET_CAPTURE_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useStopCapture = () => {
    const setIsRunning = useSetAtom(isRunningAtom);
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'tcpdump',
            action: 'stopCapture',
        }),
        onSuccess: () => {
            setIsRunning(false);
            queryClient.invalidateQueries({
                queryKey: [TCP_DUMP_GET_CAPTURE_HISTORY]
            });
        }
    });
};

export default useStopCapture;
