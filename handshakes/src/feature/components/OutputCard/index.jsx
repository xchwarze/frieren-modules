/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useAtomValue } from 'jotai';

import PanelCard from '@src/components/PanelCard';
import LogView from '@src/components/LogView';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useGetLogContent from '@module/feature/hooks/useGetLogContent.js';
import useCaptureStatus from '@module/feature/hooks/useCaptureStatus.js';

const OutputCard = () => {
    const query = useGetLogContent();
    const isRunning = useAtomValue(isRunningAtom);
    const { chunk = '' } = query?.data ?? {};

    // Side-effect: keeps the running state in sync with the device while capturing.
    useCaptureStatus();

    return (
        <PanelCard
            title={'Output'}
            icon={'terminal'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            <LogView chunk={chunk} tick={query.dataUpdatedAt} clearSignal={isRunning} />
        </PanelCard>
    );
};

export default OutputCard;
