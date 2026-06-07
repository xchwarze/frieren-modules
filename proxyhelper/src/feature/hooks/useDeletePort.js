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
import {
    PROXYHELPER_GET_FORWARDED_PORTS,
    PROXYHELPER_GET_NAT_RULES,
    PROXYHELPER_GET_ROUTING_STATUS,
} from '@module/feature/helpers/queryKeys.js';

const useDeletePort = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ port, destination }) => fetchPost({
            module: 'proxyhelper',
            action: 'deletePort',
            port,
            destination,
        }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [PROXYHELPER_GET_FORWARDED_PORTS] });
            queryClient.invalidateQueries({ queryKey: [PROXYHELPER_GET_NAT_RULES] });
            queryClient.invalidateQueries({ queryKey: [PROXYHELPER_GET_ROUTING_STATUS] });
            toast.success(data?.message ?? 'Port removed');
        },
    });
};

export default useDeletePort;
