/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useQueryClient } from '@tanstack/react-query';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';
import { HCXDUMPTOOL_GET_CAPTURE_HISTORY } from '@module/feature/helpers/queryKeys.js';

const useDeleteCapture = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ filename }) => fetchPost({
            module: 'hcxdumptool',
            action: 'deleteCapture',
            filename,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [HCXDUMPTOOL_GET_CAPTURE_HISTORY]
            });
        },
    });
};

export default useDeleteCapture;
