/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useQueryClient } from '@tanstack/react-query';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { PROXYHELPER_GET_BACKUPS } from '@module/feature/helpers/queryKeys.js';

const useDeleteBackup = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ filename }) => fetchPost({
            module: 'proxyhelper',
            action: 'deleteBackup',
            filename,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [PROXYHELPER_GET_BACKUPS],
            });
        },
    });
};

export default useDeleteBackup;
