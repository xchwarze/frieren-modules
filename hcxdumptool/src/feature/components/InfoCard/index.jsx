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
import useStopInfo from '@module/feature/hooks/useStopInfo.js';

const InfoCard = ({ statusQuery }) => {
    const { interfaces, toolBranch } = statusQuery?.data ?? {};
    // Info actions run against the installed binary, so the available commands
    // follow the DETECTED version: 6.3.x dropped -C (Show Channels) and
    // --check_driver and added per-interface -I; 6.2.x has -C/--check_driver but
    // its -I is the no-arg interface list (covered by "List Interfaces").
    const is62 = toolBranch === '6.2';
    const { run, isPending, isRunning, output } = useRunInfoAction();
    const { mutate: stopInfo, isPending: stopping } = useStopInfo();
    const [selectedInterface, setSelectedInterface] = useState('');
    const [activeAction, setActiveAction] = useState('');

    // Diagnostics share one background slot — block new runs while one is in flight.
    const busy = isPending || isRunning;

    const handleRun = (action) => {
        setActiveAction(action);
        run({ action, interface: selectedInterface });
    };

    return (
        <PanelCard
            title={'Tool Info'}
            icon={'info'}
            showRefresh={false}
        >
            <Row className={'g-3 align-items-end mb-3'}>
                <Col xs={12} sm={4} md={3}>
                    <Form.Group>
                        <Form.Label>Interface</Form.Label>
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
                <Col xs={12} sm={'auto'}>
                    <div className={'d-flex flex-wrap gap-2'}>
                        <Button
                            label={is62 ? 'List Interfaces (-I)' : 'List Interfaces (-L)'}
                            icon={'wifi'}
                            variant={'secondary'}
                            disabled={busy}
                            loading={busy && activeAction === 'listInterfaces'}
                            onClick={() => handleRun('listInterfaces')}
                        />
                        {is62 ? (
                            <>
                                <Button
                                    label={'Show Channels (-C)'}
                                    icon={'radio'}
                                    variant={'secondary'}
                                    disabled={busy}
                                    loading={busy && activeAction === 'showChannels'}
                                    onClick={() => handleRun('showChannels')}
                                />
                                <Button
                                    label={'Check Driver'}
                                    icon={'check-circle'}
                                    variant={'secondary'}
                                    disabled={busy}
                                    loading={busy && activeAction === 'checkDriver'}
                                    onClick={() => handleRun('checkDriver')}
                                />
                            </>
                        ) : (
                            <Button
                                label={'Interface Info (-I)'}
                                icon={'info'}
                                variant={'secondary'}
                                disabled={busy || !selectedInterface}
                                loading={busy && activeAction === 'interfaceInfo'}
                                onClick={() => handleRun('interfaceInfo')}
                            />
                        )}
                        <Button
                            label={'Stop'}
                            icon={'square'}
                            variant={'danger'}
                            disabled={!isRunning}
                            loading={stopping}
                            onClick={() => stopInfo()}
                        />
                    </div>
                </Col>
            </Row>

            <Form.Group className={'mb-3'}>
                <Form.Control
                    as={'textarea'}
                    rows={8}
                    readOnly={true}
                    value={output || (isRunning ? 'Running…' : 'Run a command to see its output.')}
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
