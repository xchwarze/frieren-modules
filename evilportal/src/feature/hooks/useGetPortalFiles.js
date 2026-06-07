/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import useAuthenticatedQuery from '@src/hooks/useAuthenticatedQuery.js';
import { fetchPost } from '@src/services/fetchService.js';
import { EVIL_PORTAL_FILES } from '@module/feature/helpers/queryKeys.js';

const useGetPortalFiles = (portalName) => useAuthenticatedQuery({
    queryKey: [EVIL_PORTAL_FILES, portalName],
    queryFn: () => fetchPost({
        module: 'evilportal',
        action: 'getPortalFiles',
        portal: portalName,
    }),
    enabled: !!portalName,
});

export default useGetPortalFiles;
