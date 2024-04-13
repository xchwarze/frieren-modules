/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useQueryClient } from '@tanstack/react-query';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { WPA_ONLINE_CRACK_GET_SETTINGS } from '@module/feature/helpers/queryKeys.js';

const useSetSettings = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ wpaSecKey, onlinehashcrackEmail }) => fetchPost({
            module: 'wpaonlinecrack',
            action: 'setSettings',
            'wpaSecKey': wpaSecKey,
            'onlinehashcrackEmail': onlinehashcrackEmail,
        }),
        onSuccess: async () => {
            queryClient.invalidateQueries({
                queryKey: [WPA_ONLINE_CRACK_GET_SETTINGS],
            });
        },
    });
};

export default useSetSettings;
