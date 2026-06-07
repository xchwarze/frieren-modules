/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { PROXYHELPER_GET_BACKUPS } from '@module/feature/helpers/queryKeys.js';

const useBackupFirewall = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'proxyhelper',
            action: 'backupFirewall',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [PROXYHELPER_GET_BACKUPS],
            });
            toast.success('Firewall backup created successfully');
        },
    });
};

export default useBackupFirewall;
