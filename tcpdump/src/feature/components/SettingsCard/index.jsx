/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import Accordion from 'react-bootstrap/Accordion';
import { useWatch, useFormContext } from 'react-hook-form';
import { useAtomValue } from 'jotai';
import * as yup from 'yup';
import PropTypes from 'prop-types';

import PanelCard from '@src/components/PanelCard';
import Icon from '@src/components/Icon';
import FormActions from '@common/components/FormActions';
import Button from '@src/components/Button';
import FormProvider from '@src/components/Form/FormProvider';
import InputField from '@src/components/Form/InputField';
import SelectField from '@src/components/Form/SelectField';
import SwitchField from '@src/components/Form/SwitchField';
import SubmitButton from '@src/components/Form/SubmitButton';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useStartCapture from '@module/feature/hooks/useStartCapture.js';
import useStopCapture from '@module/feature/hooks/useStopCapture.js';
import useGenerateCommand from '@module/feature/hooks/useGenerateCommand.js';
import useGetPresets from '@module/feature/hooks/useGetPresets.js';
import useSavePreset from '@module/feature/hooks/useSavePreset.js';
import useDeletePreset from '@module/feature/hooks/useDeletePreset.js';
import FilterInput from '@module/feature/components/FilterInput';
import { DEFAULT_PRESETS } from '@module/feature/helpers/presets.js';

const tcpDumpSettingsSchema = yup.object({
    command: yup.string().required('Command is mandatory'),
    interface: yup.string().required('Interface is mandatory'),
}).required();

const DEFAULT_VALUES = {
    // commands (command is derived by useGenerateCommand and shown read-only)
    command: '',
    interface: '',
    verbose: '',
    resolve: '',
    timestamp: '',
    packetCount: '',
    snaplen: '',

    // filters (filter is derived by useGenerateFilter from the builder fields)
    filter: '',
    filterType: '',
    filterDir: '',
    filterProtocol: '',
    filterLength: '',
    filterKind: '',
    filterOperator: '',

    // options
    dontPrintHostName: false,
    showHexAndASCII: false,
    printAscii: false,
    printAbsoluteNumbers: false,
    getEthernetHeaders: false,
    noPromiscuous: false,
    lessProtocolInfo: false,
    monitorMode: false,
    extraFlags: '',
};

const presetKey = (preset) => `${preset.builtin ? 'b' : 'u'}:${preset.name}`;
const PRESET_NAME_REGEX = /^[A-Za-z0-9 ._+()-]{1,40}$/;

/**
 * Live, read-only preview of the assembled tcpdump command. useGenerateCommand
 * keeps the `command` field in sync with the option fields; this just renders it.
 * The output file (-w) is appended by the backend, so it is noted but not shown.
 */
const CommandPreview = () => {
    useGenerateCommand();
    const command = useWatch({ name: 'command' }) ?? '';

    return (
        <Form.Group className={'mt-4'}>
            <Form.Label>Command preview</Form.Label>
            <Form.Control
                as={'textarea'}
                rows={2}
                readOnly={true}
                value={`tcpdump ${command}`.trim()}
                className={'text-body-secondary font-monospace'}
            />
            <Form.Text className={'text-body-secondary'}>
                The output file (<code>-w</code>) is appended automatically on capture.
            </Form.Text>
        </Form.Group>
    );
};

/**
 * Preset bar: load a built-in or saved capture preset (resets the form, preserving
 * the chosen interface), or save the current option set as a named device-persistent
 * preset. The derived command/filter strings are not stored — the generators rebuild
 * them from the source fields after a preset loads. Lives inside FormProvider.
 */
const PresetBar = () => {
    const { reset, getValues } = useFormContext();
    const presetsQuery = useGetPresets();
    const { mutate: savePreset, isPending: saving } = useSavePreset();
    const { mutate: deletePreset, isPending: deleting } = useDeletePreset();
    const [selected, setSelected] = useState('');
    const [name, setName] = useState('');

    const userPresets = (presetsQuery.data?.presets ?? []).map((preset) => ({ ...preset, builtin: false }));
    const all = [...DEFAULT_PRESETS, ...userPresets];
    const current = all.find((preset) => presetKey(preset) === selected);

    const handleSelect = (key) => {
        setSelected(key);
        const preset = all.find((item) => presetKey(item) === key);
        if (!preset) {
            return;
        }
        // Merge over defaults so unset fields reset; keep the operator's interface and
        // let the generators recompute the derived command/filter strings.
        reset({
            ...DEFAULT_VALUES,
            ...(preset.values ?? {}),
            interface: getValues('interface'),
            command: '',
            filter: '',
        });
        setName(preset.builtin ? '' : preset.name);
    };

    const handleSave = () => {
        // Store source fields only; command/filter are derived, interface is operator-local.
        const values = { ...getValues() };
        delete values.command;
        delete values.filter;
        delete values.interface;
        savePreset(
            { name: name.trim(), values },
            { onSuccess: () => presetsQuery.refetch() }
        );
    };

    const handleDelete = () => {
        if (!current || current.builtin) {
            return;
        }
        deletePreset(
            { name: current.name },
            { onSuccess: () => { presetsQuery.refetch(); setSelected(''); } }
        );
    };

    return (
        <Row className={'g-3 align-items-end mb-4'}>
            <Col xs={12} sm={5} md={4}>
                <Form.Group>
                    <Form.Label><span className={'me-1'}><Icon name={'bookmark'} /></span>Preset</Form.Label>
                    <Form.Select value={selected} onChange={(event) => handleSelect(event.target.value)}>
                        <option value={''}>Select a preset…</option>
                        <optgroup label={'Built-in'}>
                            {DEFAULT_PRESETS.map((preset) => (
                                <option key={presetKey(preset)} value={presetKey(preset)}>{preset.name}</option>
                            ))}
                        </optgroup>
                        {userPresets.length > 0 && (
                            <optgroup label={'Saved'}>
                                {userPresets.map((preset) => (
                                    <option key={presetKey(preset)} value={presetKey(preset)}>{preset.name}</option>
                                ))}
                            </optgroup>
                        )}
                    </Form.Select>
                </Form.Group>
            </Col>
            <Col xs={'auto'}>
                <Button
                    label={'Delete'}
                    icon={'trash-2'}
                    variant={'outline-danger'}
                    disabled={!current || current.builtin || deleting}
                    loading={deleting}
                    onClick={handleDelete}
                />
            </Col>
            <Col xs={12} sm={4} md={4}>
                <Form.Group>
                    <Form.Label><span className={'me-1'}><Icon name={'save'} /></span>Save as</Form.Label>
                    <Form.Control
                        value={name}
                        placeholder={'Preset name'}
                        onChange={(event) => setName(event.target.value)}
                    />
                </Form.Group>
            </Col>
            <Col xs={'auto'}>
                <Button
                    label={'Save'}
                    icon={'save'}
                    variant={'outline-primary'}
                    disabled={!PRESET_NAME_REGEX.test(name.trim()) || saving}
                    loading={saving}
                    onClick={handleSave}
                />
            </Col>
        </Row>
    );
};

const SettingsCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startCapture } = useStartCapture();
    const { mutate: stopCapture, isPending: stopCaptureRunning } = useStopCapture();
    const { interfaces, toolVariant } = statusQuery?.data ?? {};

    return (
        <PanelCard
            title={'Capture Settings'}
            icon={'crosshair'}
            refetch={statusQuery.refetch}
            isFetching={statusQuery.isFetching}
        >
            {toolVariant === 'mini' && (
                <Alert variant={'info'} className={'py-2'}>
                    <strong>tcpdump-mini</strong> is installed — capture and all builder flags work,
                    but verbose output has reduced protocol decoding. Install the full
                    {' '}<code>tcpdump</code> package for complete dissection.
                </Alert>
            )}

            <FormProvider schema={tcpDumpSettingsSchema} onSubmit={startCapture} defaultValues={DEFAULT_VALUES}>
                <PresetBar />

                <Accordion defaultActiveKey={'basic'} alwaysOpen={true}>
                    <Accordion.Item eventKey={'basic'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'sliders'} /></span>Basic Options</Accordion.Header>
                        <Accordion.Body>
                            <Row className={'g-3'}>
                                <Col md={6}>
                                    <SelectField
                                        name={'interface'}
                                        label={'Interface'}
                                        options={interfaces ?? []}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SelectField
                                        name={'verbose'}
                                        label={'Verbose'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: '-v', label: 'Verbose'},
                                            {value: '-vv', label: 'Very verbose'},
                                            {value: '-vvv', label: 'Very very verbose'}
                                        ]}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SelectField
                                        name={'resolve'}
                                        label={'Resolve'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: '-n', label: 'Don\'t resolve hostnames'},
                                            {value: '-nn', label: 'Don\'t resolve hostnames or port names'},
                                        ]}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SelectField
                                        name={'timestamp'}
                                        label={'Timestamp'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: '-t', label: 'Don\'t print a timestamp on each dump line'},
                                            {value: '-tt', label: 'Print an unformatted timestamp on each dump line'},
                                            {value: '-ttt', label: 'Print a delta (micro-second resolution) between current and previous line'},
                                            {value: '-tttt', label: 'Print a timestamp in default format proceeded by date'},
                                            {value: '-ttttt', label: 'Print a delta (micro-second resolution) between current and first line'},
                                        ]}
                                    />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'packetCount'} label={'Packet count (-c)'} type={'number'} placeholder={'Stop after N packets'} />
                                </Col>
                                <Col md={6}>
                                    <InputField name={'snaplen'} label={'Snap length (-s, 0 = full)'} type={'number'} placeholder={'Bytes per packet'} />
                                </Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'filters'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'filter'} /></span>Filters</Accordion.Header>
                        <Accordion.Body>
                            <FilterInput
                                label={'Filter'}
                                placeholder={'Enter filter expression'}
                            />
                            <Row className={'g-3'}>
                                <Col md={6}>
                                    <SelectField
                                        name={'filterType'}
                                        label={'Type'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: 'host', label: 'Host'},
                                            {value: 'net', label: 'Net'},
                                            {value: 'portrange', label: 'Port Range'},
                                            {value: 'port', label: 'Port'},
                                            {value: 'gateway', label: 'Gateway'},
                                            {value: 'mask', label: 'Mask'},
                                        ]}
                                    />
                                    <SelectField
                                        name={'filterProtocol'}
                                        label={'Protocol'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: 'ip', label: 'IP'},
                                            {value: 'icmp', label: 'ICMP'},
                                            {value: 'tcp', label: 'TCP'},
                                            {value: 'udp', label: 'UDP'},
                                            {value: 'arp', label: 'ARP'},
                                            {value: 'ether', label: 'Ethernet'},
                                            {value: 'http', label: 'HTTP'},
                                            {value: 'ftp', label: 'FTP'},
                                            {value: 'smtp', label: 'SMTP'},
                                        ]}
                                    />
                                    <SelectField
                                        name={'filterKind'}
                                        label={'Kind'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: 'broadcast', label: 'Broadcast'},
                                            {value: 'multicast', label: 'Multicast'},
                                        ]}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SelectField
                                        name={'filterDir'}
                                        label={'Direction'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: 'src', label: 'Source'},
                                            {value: 'dst', label: 'Destination'},
                                            {value: 'src or dst', label: 'Source or Destination'},
                                            {value: 'src and dst', label: 'Source and Destination'},
                                        ]}
                                    />
                                    <SelectField
                                        name={'filterLength'}
                                        label={'Length'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: 'less', label: 'Less than'},
                                            {value: 'greater', label: 'Greater than'},
                                        ]}
                                    />
                                    <SelectField
                                        name={'filterOperator'}
                                        label={'Operator'}
                                        options={[
                                            {value: '', label: 'Select one...'},
                                            {value: 'not', label: 'NOT'},
                                            {value: 'and', label: 'AND'},
                                            {value: 'or', label: 'OR'},
                                            {value: '(', label: 'Open Parenthesis'},
                                            {value: ')', label: 'Close Parenthesis'},
                                        ]}
                                    />
                                </Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'advanced'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'tool'} /></span>Advanced</Accordion.Header>
                        <Accordion.Body>
                            <Row className={'g-3'}>
                                <Col md={6}><SwitchField name={'dontPrintHostName'} label={'Don\'t print domain name qualification of host names (-N)'} /></Col>
                                <Col md={6}><SwitchField name={'showHexAndASCII'} label={'Show packet contents in hex and ASCII (-X)'} /></Col>
                                <Col md={6}><SwitchField name={'printAscii'} label={'Print payload in ASCII (-A)'} /></Col>
                                <Col md={6}><SwitchField name={'printAbsoluteNumbers'} label={'Print absolute sequence numbers (-S)'} /></Col>
                                <Col md={6}><SwitchField name={'getEthernetHeaders'} label={'Get the ethernet header as well (-e)'} /></Col>
                                <Col md={6}><SwitchField name={'noPromiscuous'} label={'Don\'t put interface in promiscuous mode (-p)'} /></Col>
                                <Col md={6}><SwitchField name={'lessProtocolInfo'} label={'Show less protocol information (-q)'} /></Col>
                                <Col md={6}><SwitchField name={'monitorMode'} label={'Monitor mode (-I)'} /></Col>
                                <Col md={12}><InputField name={'extraFlags'} label={'Extra Flags'} placeholder={'Additional tcpdump flags'} /></Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>

                <CommandPreview />

                <FormActions>
                    <SubmitButton
                        label={'Capture'}
                        icon={'play'}
                        loading={isRunning}
                    />
                    <Button
                        label={'Stop'}
                        icon={'square'}
                        variant={'danger'}
                        onClick={stopCapture}
                        loading={stopCaptureRunning}
                        disabled={!isRunning}
                    />
                </FormActions>
            </FormProvider>
        </PanelCard>
    );
};

SettingsCard.propTypes = {
    statusQuery: PropTypes.object.isRequired,
}

export default SettingsCard;
