/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { USB_STORAGE_GET_FSTAB_CONFIG } from '@module/feature/helpers/queryKeys.js';

const useSaveFstabConfig = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ config }) => fetchPost({
            module: 'usbstorage',
            action: 'saveFstabConfig',
            config,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [USB_STORAGE_GET_FSTAB_CONFIG]
            });
            toast.success('Successfully saved fstab config');
        },
    });
}

export default useSaveFstabConfig;
