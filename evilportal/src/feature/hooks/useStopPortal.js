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
import { EVIL_PORTAL_STATUS, EVIL_PORTAL_CLIENTS } from '@module/feature/helpers/queryKeys.js';

const useStopPortal = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'evilportal',
            action: 'stopPortal',
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [EVIL_PORTAL_STATUS] });
            queryClient.invalidateQueries({ queryKey: [EVIL_PORTAL_CLIENTS] });
            toast.success('Portal stopped');
        },
    });
};

export default useStopPortal;
