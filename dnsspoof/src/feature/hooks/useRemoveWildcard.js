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
import { DNS_SPOOF_GET_WILDCARDS } from '@module/feature/helpers/queryKeys.js';

const useRemoveWildcard = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ ip, domain }) => fetchPost({
            module: 'dnsspoof',
            action: 'removeWildcard',
            ip,
            domain,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DNS_SPOOF_GET_WILDCARDS] });
            toast.success('Wildcard removed');
        },
    });
};

export default useRemoveWildcard;
