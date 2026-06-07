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
import { EVIL_PORTAL_FILES } from '@module/feature/helpers/queryKeys.js';

const useSavePortalFile = () => {
    const queryClient = useQueryClient();

    return useAuthenticatedMutation({
        mutationFn: ({ portal, filename, content }) => fetchPost({
            module: 'evilportal',
            action: 'savePortalFile',
            portal,
            filename,
            content,
        }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: [EVIL_PORTAL_FILES, variables.portal] });
            toast.success('File saved');
        },
    });
};

export default useSavePortalFile;
