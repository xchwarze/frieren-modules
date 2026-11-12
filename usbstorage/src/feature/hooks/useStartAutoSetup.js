/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';

import { sleep } from '@src/helpers/actionsHelper.js';
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import isRunningSetupAtom from '@module/feature/atoms/isRunningSetupAtom.js';
import { USB_STORAGE_GET_AUTO_SETUP_STATUS } from '@module/feature/helpers/queryKeys.js';

const useStartAutoSetup = () => {
    const setIsRunning = useSetAtom(isRunningSetupAtom);
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ deviceId, identity, confirmation }) => fetchPost({
            module: 'usbstorage',
            action: 'startAutoSetup',
            deviceId,
            identity,
            confirmation,
        }),
        retry: false,
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: [USB_STORAGE_GET_AUTO_SETUP_STATUS] });
            // Reserve this browser's slot until an authoritative status response.
            setIsRunning(true);
        },
        onSuccess: async () => {
            // BackgroundTaskHelper creates its task log asynchronously.
            await sleep(600);
            setIsRunning(true);
        },
        onError: () => {}, // The card displays the rejection without a generic toast.
        onSettled: () => queryClient.invalidateQueries({ queryKey: [USB_STORAGE_GET_AUTO_SETUP_STATUS] }),
    });
};

export default useStartAutoSetup;
