/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

/**
 * Deletes an operator capture preset by name.
 *
 * @return {Object} The mutation object. mutate({ name }).
 */
const useDeletePreset = () => (
    useAuthenticatedMutation({
        mutationFn: ({ name }) => fetchPost({
            module: 'tcpdump',
            action: 'deletePreset',
            name,
        }),
    })
);

export default useDeletePreset;
