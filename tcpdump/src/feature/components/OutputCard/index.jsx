/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect, useRef } from 'react';
import Form from 'react-bootstrap/Form';

import PanelCard from '@src/components/PanelCard';
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
            query={query}
            className={'mt-3'}
        >
            <Form.Group className={'mb-3'}>
                <Form.Control
                    ref={textareaRef}
                    as={'textarea'}
                    rows={6}
                    readOnly={true}
                    value={resume}
                    className={'text-muted'}
                />
            </Form.Group>
            <div className={'d-flex justify-content-end'}>
                <Button
                    label={'Download'}
                    icon={'download'}
                    variant={'secondary'}
                    disabled={logContent === undefined}
                    loading={downloadCaptureRunning}
                    onClick={downloadCapture}
                />
            </div>
        </PanelCard>
    );
};

export default OutputCard;
