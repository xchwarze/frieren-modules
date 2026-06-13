/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

/**
 * Saves (upserts) an operator capture preset on the device.
 *
 * @return {Object} The mutation object. mutate({ name, values }).
 */
const useSavePreset = () => (
    useAuthenticatedMutation({
        mutationFn: ({ name, values }) => fetchPost({
            module: 'tcpdump',
            action: 'savePreset',
            name,
            values,
        }),
    })
);

export default useSavePreset;
