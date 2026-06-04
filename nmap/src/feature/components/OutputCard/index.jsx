/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect, useRef } from 'react';
import Form from 'react-bootstrap/Form';

import PanelCard from '@src/components/PanelCard';
import useGetLog from '@module/feature/hooks/getLog.js';

const OutputCard = () => {
    const query = useGetLog();
    const { logContent } = query?.data ?? {};
    const resume = logContent ?? 'No scan output to display.';

    const textareaRef = useRef(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
    }, [resume]);

    return (
        <PanelCard
            title={'Output'}
            query={query}
            className={'mt-3'}
        >
            <Form.Group>
                <Form.Control
                    ref={textareaRef}
                    as={'textarea'}
                    rows={10}
                    readOnly={true}
                    value={resume}
                    className={'text-muted'}
                />
            </Form.Group>
        </PanelCard>
    );
};

export default OutputCard;
