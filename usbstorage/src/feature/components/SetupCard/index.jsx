/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useEffect, useRef } from 'react';
import Form from 'react-bootstrap/Form';
import { useAtomValue } from 'jotai';

import isRunningSetupAtom from '@module/feature/atoms/isRunningSetupAtom.js';
import useStartAutoSetup from '@module/feature/hooks/useStartAutoSetup.js';
import useGetAutoSetupStatus from '@module/feature/hooks/useGetAutoSetupStatus.js';
import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';

const SetupCard = () => {
    const query = useGetAutoSetupStatus();
    const { mutate: startAutoSetup, isPending: startAutoSetupRunning } = useStartAutoSetup();
    const isRunningSetup = useAtomValue(isRunningSetupAtom);

    const { logContent } = query?.data ?? {};
    const resume = logContent ? logContent : 'As soon as you have started the process, the progress of the process will be displayed here.';

    const textareaRef = useRef(null);
    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.scrollTop = textarea.scrollHeight;
        }
    }, [resume]);

    return (
        <PanelCard
            title={'Setup device'}
            subtitle={'If the auto setup process does not work in your case you must use the scripts in the bin folder of this module manually.\n' +
                'Note that your device may need extra drivers to use this functionality and you should install them yourself!'}
            query={query}
        >
            <Form.Group className={'mb-3'}>
                <Form.Control
                    ref={textareaRef}
                    as={'textarea'}
                    rows={20}
                    readOnly={true}
                    value={resume}
                    className={'text-muted'}
                />
            </Form.Group>
            <div className={'d-flex justify-content-end gap-2'}>
                <Button
                    label={'Run auto setup'}
                    icon={'play'}
                    loading={startAutoSetupRunning || isRunningSetup}
                    onClick={startAutoSetup}
                />
            </div>
        </PanelCard>
    );
};

export default SetupCard;
