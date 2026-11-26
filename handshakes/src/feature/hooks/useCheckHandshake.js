/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

const useCheckHandshake = () => (
    useAuthenticatedMutation({
        mutationFn: ({ filename }) => fetchPost({
            module: 'handshakes',
            action: 'checkHandshake',
            filename,
        }),
        onSuccess: (data) => {
            const handshakes = data?.handshakes ?? 0;
            const pmkid = data?.pmkid ?? 0;
            if (handshakes > 0 || pmkid > 0) {
                toast.success(`Found ${handshakes} handshake(s) and ${pmkid} PMKID(s).`);
            } else {
                toast.warning('No handshake or PMKID in this capture.');
            }
        },
    })
);

export default useCheckHandshake;
