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
import { NMAP_GET_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useDeleteHistory = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ filename }) => fetchPost({
            module: 'nmap',
            action: 'deleteHistory',
            filename,
        }),
        onSuccess: (_, { filename }) => {
            toast.success(`File ${filename} deleted`);
            queryClient.invalidateQueries({
                queryKey: [NMAP_GET_HISTORY],
            });
        },
    });
};

export default useDeleteHistory;
