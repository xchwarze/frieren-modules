/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { toast } from 'react-toastify';

import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

const useCreateHostSnapshot = () => (
    useAuthenticatedMutation({
        mutationFn: () => fetchPost({
            module: 'dnsspoof',
            action: 'createHostSnapshot',
        }),
        onSuccess: () => {
            toast.success('Backup successful');
        }
    })
);

export default useCreateHostSnapshot;
