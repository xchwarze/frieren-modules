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
import { EVIL_PORTAL_STATUS } from '@module/feature/helpers/queryKeys.js';

const useStartPortal = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ portal }) => fetchPost({
            module: 'evilportal',
            action: 'startPortal',
            portal,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [EVIL_PORTAL_STATUS] });
            toast.success('Portal started');
        },
    });
};

export default useStartPortal;
