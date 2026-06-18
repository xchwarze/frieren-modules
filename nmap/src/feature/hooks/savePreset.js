/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useQueryClient } from '@tanstack/react-query';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { NMAP_GET_PRESETS } from '@module/feature/helpers/queryKeys.js';

const useSavePreset = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ name, values }) => fetchPost({
            module: 'nmap',
            action: 'savePreset',
            name,
            values,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [NMAP_GET_PRESETS] });
        },
    });
};

export default useSavePreset;
