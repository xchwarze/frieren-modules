/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedMutation from '@src/hooks/useAuthenticatedMutation.js';
import { fetchPost } from '@src/services/fetchService.js';

/**
 * Saves (upserts) an operator capture preset on the device.
 *
 * @return {Object} The mutation object. mutate({ name, toolVersion, values }).
 */
const useSavePreset = () => (
    useAuthenticatedMutation({
        mutationFn: ({ name, toolVersion, values }) => fetchPost({
            module: 'hcxdumptool',
            action: 'savePreset',
            name,
            toolVersion,
            values,
        }),
    })
);

export default useSavePreset;
