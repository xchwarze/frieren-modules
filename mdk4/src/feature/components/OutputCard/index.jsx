/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect, useRef } from 'react';
import Form from 'react-bootstrap/Form';

import PanelCard from '@common/components/PanelCard';
import FormActions from '@common/components/FormActions';
import Button from '@common/components/Button';
import useGetLogContent from '@module/feature/hooks/useGetLogContent.js';
import useDownloadResult from '@module/feature/hooks/useDownloadResult.js';

const OutputCard = () => {
    const query = useGetLogContent();
    const { mutate: downloadResult, isPending: downloadResultRunning } = useDownloadResult();
    const { logContent } = query?.data ?? {};
    const resume = logContent ?? 'No attack output to display.';

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
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            <Form.Group className={'mb-3'}>
                <Form.Control
                    ref={textareaRef}
                    as={'textarea'}
                    rows={6}
                    readOnly={true}
                    value={resume}
                    className={'text-body-secondary'}
                />
            </Form.Group>
            <FormActions>
                <Button
                    label={'Download'}
                    icon={'download'}
                    variant={'secondary'}
                    disabled={logContent === undefined}
                    loading={downloadResultRunning}
                    onClick={downloadResult}
                />
            </FormActions>
        </PanelCard>
    );
};

export default OutputCard;
