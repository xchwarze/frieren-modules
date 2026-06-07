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
import { PROXYHELPER_GET_SETTINGS } from '@module/feature/helpers/queryKeys.js';

const useSaveSettings = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ proxyHost, proxyPort, forwardPorts }) => fetchPost({
            module: 'proxyhelper',
            action: 'setSettings',
            proxyHost,
            proxyPort,
            forwardPorts,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [PROXYHELPER_GET_SETTINGS],
            });
            toast.success('Settings saved successfully');
        },
    });
};

export default useSaveSettings;
