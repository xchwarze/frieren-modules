/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import PropTypes from 'prop-types';

import PanelCard from '@src/components/PanelCard';
import Button from '@src/components/Button';
import useRunInfoAction from '@module/feature/hooks/useRunInfoAction.js';

const InfoCard = ({ statusQuery }) => {
    const { interfaces } = statusQuery?.data ?? {};
    const { mutate: runInfoAction, isPending } = useRunInfoAction();
    const [selectedInterface, setSelectedInterface] = useState('');
    const [output, setOutput] = useState('');
    const [activeAction, setActiveAction] = useState('');

    const handleRun = (action) => {
        setActiveAction(action);
        runInfoAction(
            { action, interface: selectedInterface },
            {
                onSuccess: (data) => {
                    setOutput(data?.output ?? '');
                },
                onError: () => {
                    setOutput('Error running command.');
                },
            }
        );
    };

    return (
        <PanelCard
            title={'Tool Info'}
            showRefresh={false}
        >
            <Row className={'g-3'}>
                <Col md={6}>
                    <Form.Group>
                        <Form.Label>Interface (optional)</Form.Label>
                        <Form.Select
                            value={selectedInterface}
                            onChange={(event) => setSelectedInterface(event.target.value)}
                        >
                            <option value={''}>None</option>
                            {(interfaces ?? []).map((iface) => (
                                <option key={iface} value={iface}>{iface}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            <div className={'d-flex flex-wrap gap-2'}>
                <Button
                    label={'List Interfaces (-L)'}
                    icon={'list'}
                    variant={'secondary'}
                    loading={isPending && activeAction === 'listInterfaces'}
                    onClick={() => handleRun('listInterfaces')}
                />
                <Button
                    label={'Show Channels (-C)'}
                    icon={'radio'}
                    variant={'secondary'}
                    loading={isPending && activeAction === 'showChannels'}
                    onClick={() => handleRun('showChannels')}
                />
                <Button
                    label={'Interface Info (-I)'}
                    icon={'info'}
                    variant={'secondary'}
                    disabled={!selectedInterface}
                    loading={isPending && activeAction === 'interfaceInfo'}
                    onClick={() => handleRun('interfaceInfo')}
                />
                <Button
                    label={'Check Driver'}
                    icon={'check-circle'}
                    variant={'secondary'}
                    loading={isPending && activeAction === 'checkDriver'}
                    onClick={() => handleRun('checkDriver')}
                />
            </div>

            <Form.Group>
                <Form.Control
                    as={'textarea'}
                    rows={8}
                    readOnly={true}
                    value={output || 'Run a command to see its output.'}
                    className={'text-body-secondary font-monospace'}
                />
            </Form.Group>
        </PanelCard>
    );
};

InfoCard.propTypes = {
    statusQuery: PropTypes.object.isRequired,
};

export default InfoCard;
