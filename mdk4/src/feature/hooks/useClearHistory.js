/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useQueryClient } from '@tanstack/react-query';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { MDK4_GET_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useClearHistory = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'mdk4',
            action: 'clearHistory',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [MDK4_GET_HISTORY]
            });
        },
    })
};

export default useClearHistory;
