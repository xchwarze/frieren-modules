/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useAtomValue } from 'jotai';

import PanelCard from '@src/components/PanelCard';
import FormActions from '@common/components/FormActions';
import Button from '@src/components/Button';
import LogView from '@src/components/LogView';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useGetLogContent from '@module/feature/hooks/useGetLogContent.js';
import useDownloadCaptureOutput from '@module/feature/hooks/useDownloadCaptureOutput.js';

const OutputCard = () => {
    const query = useGetLogContent();
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: downloadCapture, isPending: downloadCaptureRunning } = useDownloadCaptureOutput();
    const { chunk = '' } = query?.data ?? {};

    return (
        <PanelCard
            title={'Output'}
            icon={'terminal'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            <LogView chunk={chunk} tick={query.dataUpdatedAt} clearSignal={isRunning} />
            <FormActions>
                <Button
                    label={'Download'}
                    icon={'download'}
                    variant={'secondary'}
                    disabled={!query.isSuccess}
                    loading={downloadCaptureRunning}
                    onClick={downloadCapture}
                />
            </FormActions>
        </PanelCard>
    );
};

export default OutputCard;
