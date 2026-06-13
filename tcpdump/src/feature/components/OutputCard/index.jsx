/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect, useRef } from 'react';
import Form from 'react-bootstrap/Form';

import PanelCard from '@src/components/PanelCard';
import FormActions from '@common/components/FormActions';
import Button from '@src/components/Button';
import useGetLogContent from '@module/feature/hooks/useGetLogContent.js';
import useDownloadCaptureOutput from "@module/feature/hooks/useDownloadCaptureOutput.js";

const OutputCard = () => {
    const query = useGetLogContent();
    const { mutate: downloadCapture, isPending: downloadCaptureRunning } = useDownloadCaptureOutput();
    const { logContent } = query?.data ?? {};
    const resume = logContent ?? 'No capture output to display.';

    const textareaRef = useRef(null);
    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.scrollTop = textarea.scrollHeight;
        }
    }, [resume]);

    return (
        <PanelCard
            title={'Output'}
            icon={'terminal'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            <Form.Control
                ref={textareaRef}
                as={'textarea'}
                rows={6}
                readOnly={true}
                value={resume}
                className={'text-body-secondary'}
            />
            <FormActions>
                <Button
                    label={'Download'}
                    icon={'download'}
                    variant={'secondary'}
                    disabled={logContent === undefined}
                    loading={downloadCaptureRunning}
                    onClick={downloadCapture}
                />
            </FormActions>
        </PanelCard>
    );
};

export default OutputCard;
