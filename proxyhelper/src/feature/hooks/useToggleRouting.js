/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

const useToggleRouting = () => (
    useAuthenticatedMutation({
        mutationFn: ({ enabled, proxyHost, proxyPort, forwardPorts }) => fetchPost({
            module: 'proxyhelper',
            action: 'toggleRouting',
            enabled,
            proxyHost,
            proxyPort,
            forwardPorts,
        }),
        onSuccess: (data) => {
            toast.success(data?.message ?? 'Routing toggled successfully');
        },
    })
);

export default useToggleRouting;
