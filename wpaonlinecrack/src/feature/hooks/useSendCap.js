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
import { WPA_ONLINE_CRACK_GET_CAP_FILES } from '@module/feature/helpers/queryKeys.js';

const useSendCap = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ captures }) => fetchPost({
            module: 'wpaonlinecrack',
            action: 'sendCap',
            captures,
        }),
        onSuccess: (data) => {
            const { submitted, skipped, failed } = data;
            const parts = [];
            if (submitted > 0) {
                parts.push(`${submitted} submitted`);
            }
            if (skipped > 0) {
                parts.push(`${skipped} already submitted`);
            }
            if (failed > 0) {
                parts.push(`${failed} failed`);
            }

            if (failed > 0 && submitted === 0) {
                toast.error(parts.join(', '));
            } else {
                toast.success(parts.length > 0 ? parts.join(', ') : 'No captures to submit');
            }

            queryClient.invalidateQueries({
                queryKey: [WPA_ONLINE_CRACK_GET_CAP_FILES],
            });
        },
    });
};

export default useSendCap;
