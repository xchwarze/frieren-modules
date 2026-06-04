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
import { WIGLE_GET_SETTINGS } from '@module/feature/helpers/queryKeys.js';

const useSaveSettings = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ apiToken }) => fetchPost({
            module: 'wigle',
            action: 'setSettings',
            apiToken,
        }),
        onSuccess: () => {
            toast.success('Settings saved successfully');
            queryClient.invalidateQueries({
                queryKey: [WIGLE_GET_SETTINGS],
            });
        },
    });
};

export default useSaveSettings;
