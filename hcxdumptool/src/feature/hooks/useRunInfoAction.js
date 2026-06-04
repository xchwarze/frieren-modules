/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

const useRunInfoAction = () => (
    useAuthenticatedMutation({
        mutationFn: ({ action, interface: iface }) => fetchPost({
            module: 'hcxdumptool',
            action,
            interface: iface,
        }),
    })
);

export default useRunInfoAction;
