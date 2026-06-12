/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { HCXDUMPTOOL_GET_PRESETS } from '@module/feature/helpers/queryKeys.js';

/**
 * Lists the operator-saved capture presets stored on the device.
 *
 * @return {Object} The query result ({ presets: [...] }).
 */
const useGetPresets = () => (
    useAuthenticatedQuery({
        queryKey: [HCXDUMPTOOL_GET_PRESETS],
        queryFn: () => fetchPost({
            module: 'hcxdumptool',
            action: 'getPresets',
        }),
    })
);

export default useGetPresets;
