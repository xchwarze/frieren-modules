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
import TextAreaField from '@src/components/Form/TextAreaField';
import SubmitButton from '@src/components/Form/SubmitButton';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useStartCapture from '@module/feature/hooks/useStartCapture.js';
import useStopCapture from '@module/feature/hooks/useStopCapture.js';
import useGetPresets from '@module/feature/hooks/useGetPresets.js';
import useSavePreset from '@module/feature/hooks/useSavePreset.js';
import useDeletePreset from '@module/feature/hooks/useDeletePreset.js';
import { DEFAULT_PRESETS } from '@module/feature/helpers/presets.js';

const hcxdumptoolSettingsSchema = yup.object({
    interface: yup.string().required('Interface is mandatory'),
}).required();

// Tool-version branch. The 6.3.0 rewrite changed roughly half the CLI, so the
// builder + visible fields are version-specific. Default is taken from the
// detected binary (moduleStatus.toolBranch); the operator can override to build a
// command for the other branch.
const TOOL_VERSION_OPTIONS = [
    { value: '6.3', label: 'hcxdumptool 6.3.x' },
    { value: '6.2', label: 'hcxdumptool 6.2.x' },
];

// 6.2.x only — --enable_status real-time-display bitmask (summed). Removed in 6.3.x.
const STATUS_FLAGS = [
    { name: 'statusEapol', value: 1, label: 'EAPOL (1)' },
    { name: 'statusAssociation', value: 2, label: 'Association (2)' },
    { name: 'statusAuthentication', value: 4, label: 'Authentication (4)' },
    { name: 'statusBeacon', value: 8, label: 'Beacon / ProbeResponse (8)' },
    { name: 'statusRogueAp', value: 16, label: 'Rogue AP (16)' },
    { name: 'statusGps', value: 32, label: 'GPS (32)' },
    { name: 'statusInternal', value: 64, label: 'Internal (64)' },
    { name: 'statusEap', value: 512, label: 'EAP (512)' },
];

// 6.2.x predefined scan lists (-s). Removed in 6.3.x (use -c band-suffixed channels).
const SCANLIST_OPTIONS = [
    { value: '', label: 'Default' },
    { value: '0', label: '0 - Auto' },
    { value: '1', label: '1 - Optimized 2.4 GHz' },
    { value: '2', label: '2 - Standard 2.4 GHz (1-13)' },
    { value: '3', label: '3 - Standard 5 GHz' },
    { value: '4', label: '4 - Combined 2.4 + 5 GHz' },
    { value: '5', label: '5 - 6 GHz' },
];

// 6.2.x soft filter mode (--filtermode). Removed in 6.3.x (BPF only).
const FILTERMODE_OPTIONS = [
    { value: '', label: 'None' },
    { value: '0', label: '0 - Ignore' },
    { value: '1', label: '1 - Protection (exclude filtered)' },
    { value: '2', label: '2 - Target (only filtered)' },
];

// 6.3.x radio-channel-assignment scan (--rcascan). Replaces 6.2.x --do_rcascan.
const RCASCAN_OPTIONS = [
    { value: '', label: 'Off' },
    { value: 'p', label: 'Passive (p)' },
    { value: 'a', label: 'Active (a)' },
];

const DEFAULT_VALUES = {
    interface: '',
    minStayTime: '',
    tot: '',
    essidList: '',
    extraFlags: '',
    // 6.2.x status display bitmask
    statusEapol: true,
    statusAssociation: true,
    statusAuthentication: false,
    statusBeacon: false,
    statusRogueAp: false,
    statusGps: false,
    statusInternal: false,
    statusEap: false,
    // 6.2.x core / attacks / filtering / timing / gps
    scanlist: '',
    channel: '',
    disableClientAttacks: false,
    disableApAttacks: false,
    stopApAttacks: '',
    stopClientAttacks: '',
    silent: false,
    activeBeacon: false,
    filtermode: '',
    filterlistAp: '',
    filterlistClient: '',
    eapoltimeout: '',
    useGpsd: false,
    nmea: '',
    doRcascan: false,
    // 6.3.x core / attacks / filtering / timing / gps
    singleFrequency: '',
    allFrequencies: false,
    attemptApMax: '',
    attemptClientMax: '',
    disableBeacon: false,
    rcascan: '',
    rdsSort: false,
    watchdogmax: '',
    gpsd: false,
    bpf: '',
    nmeaOut: '',
};

// 6.2.x command builder. Flag set verified against hcxdumptool.c @ tag 6.2.4.
const buildCommand62 = (data) => {
    const statusBitmask = STATUS_FLAGS.reduce(
        (sum, flag) => (data[flag.name] ? sum + flag.value : sum),
        0
    );

    const parts = [];
    if (statusBitmask > 0) {
        parts.push(`--enable_status=${statusBitmask}`);
    }
    parts.push(`-i ${data.interface}`);

    if (data.scanlist !== '') {
        parts.push(`-s ${data.scanlist}`);
    }
    if (data.channel) {
        parts.push(`-c ${data.channel}`);
    }
    if (data.minStayTime) {
        parts.push(`-t ${data.minStayTime}`);
    }
    if (data.disableClientAttacks) {
        parts.push('--disable_client_attacks');
    }
    if (data.disableApAttacks) {
        parts.push('--disable_ap_attacks');
    }
    if (data.stopApAttacks) {
        parts.push(`--stop_ap_attacks=${data.stopApAttacks}`);
    }
    if (data.stopClientAttacks) {
        parts.push(`--stop_client_m2_attacks=${data.stopClientAttacks}`);
    }
    if (data.silent) {
        parts.push('--silent');
    }
    if (data.activeBeacon) {
        parts.push('--active_beacon');
    }
    if (data.filtermode !== '') {
        parts.push(`--filtermode=${data.filtermode}`);
    }
    if (data.tot) {
        parts.push(`--tot=${data.tot}`);
    }
    if (data.eapoltimeout) {
        parts.push(`--eapoltimeout=${data.eapoltimeout}`);
    }
    if (data.useGpsd) {
        parts.push('--use_gpsd');
    }
    if (data.nmea) {
        parts.push(`--nmea=${data.nmea}`);
    }
    if (data.doRcascan) {
        parts.push('--do_rcascan');
    }
    if (data.extraFlags) {
        parts.push(data.extraFlags);
    }

    return parts.join(' ');
};

// 6.3.x command builder. Flag set verified against hcxdumptool.c @ tag 6.3.4.
const buildCommand63 = (data) => {
    const parts = [`-i ${data.interface}`];

    if (data.rdsSort) {
        parts.push('--rds=1');
    }
    if (data.channel) {
        parts.push(`-c ${data.channel}`);
    }
    if (data.singleFrequency) {
        parts.push(`-f ${data.singleFrequency}`);
    }
    if (data.allFrequencies) {
        parts.push('-F');
    }
    if (data.minStayTime) {
        parts.push(`-t ${data.minStayTime}`);
    }
    // Empty = leave default; 0 = disable that attack class (must still be emitted).
    if (data.attemptApMax !== '') {
        parts.push(`--attemptapmax=${data.attemptApMax}`);
    }
    if (data.attemptClientMax !== '') {
        parts.push(`--attemptclientmax=${data.attemptClientMax}`);
    }
    if (data.disableBeacon) {
        parts.push('--disable_beacon');
    }
    if (data.rcascan) {
        parts.push(`--rcascan=${data.rcascan}`);
    }
    if (data.tot) {
        parts.push(`--tot=${data.tot}`);
    }
    if (data.watchdogmax) {
        parts.push(`--watchdogmax=${data.watchdogmax}`);
    }
    if (data.gpsd) {
        parts.push('--gpsd');
    }
    if (data.nmeaOut) {
        parts.push(`--nmea_out=${data.nmeaOut}`);
    }
    if (data.extraFlags) {
        parts.push(data.extraFlags);
    }

    return parts.join(' ');
};

const buildCommand = (isLegacyCli, data) => (
    isLegacyCli ? buildCommand62(data) : buildCommand63(data)
);

/**
 * Live, read-only preview of the assembled hcxdumptool command. Watches the form
 * so it updates as fields change. The output file (-w) and the file-backed
 * --essidlist/--filterlist/--bpf flags are appended by the backend, so they are
 * noted but not shown here.
 */
const CommandPreview = ({ isLegacyCli }) => {
    const watched = useWatch() ?? {};
    const data = { ...DEFAULT_VALUES, ...watched };
    const command = `hcxdumptool ${buildCommand(isLegacyCli, data)}`;

    return (
        <Form.Group className={'mt-4'}>
            <Form.Label>Command preview</Form.Label>
            <Form.Control
                as={'textarea'}
                rows={2}
                readOnly={true}
                value={command}
                className={'text-body-secondary font-monospace'}
            />
            <Form.Text className={'text-body-secondary'}>
                Output file (<code>-w</code>) and ESSID/BPF lists are appended automatically on capture.
            </Form.Text>
        </Form.Group>
    );
};

CommandPreview.propTypes = {
    isLegacyCli: PropTypes.bool.isRequired,
};

const presetKey = (preset) => `${preset.builtin ? 'b' : 'u'}:${preset.name}`;
const PRESET_NAME_REGEX = /^[A-Za-z0-9 ._+()-]{1,40}$/;

/**
 * Preset bar: load a built-in or saved capture preset (resets the form + tool
 * version, preserving the chosen interface), or save the current settings as a
 * named device-persistent preset. Lives inside FormProvider for form access.
 */
const PresetBar = ({ toolVersion, onToolVersionChange }) => {
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
        onToolVersionChange(preset.toolVersion ?? '6.3');
        // Merge over defaults so unset fields reset; keep the operator's interface.
        reset({ ...DEFAULT_VALUES, ...(preset.values ?? {}), interface: getValues('interface') });
        setName(preset.builtin ? '' : preset.name);
    };

    const handleSave = () => {
        savePreset(
            { name: name.trim(), toolVersion, values: getValues() },
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

PresetBar.propTypes = {
    toolVersion: PropTypes.string.isRequired,
    onToolVersionChange: PropTypes.func.isRequired,
};

const SettingsCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startCapture } = useStartCapture();
    const { mutate: stopCapture, isPending: stopCaptureRunning } = useStopCapture();
    const { interfaces, toolBranch, toolVersion: detectedVersion } = statusQuery?.data ?? {};

    // The branch the binary actually is (or '6.3' baseline when undetected).
    const installedBranch = toolBranch === '6.2' ? '6.2' : '6.3';
    const [toolVersion, setToolVersion] = useState(installedBranch);
    // 6.2.x is the classic pre-6.3.0-rewrite CLI; 6.3.x is the rewrite.
    const isLegacyCli = toolVersion === '6.2';

    const interfaceOptions = (interfaces ?? []).map((iface) => ({
        value: iface,
        label: iface,
    }));

    const handleSubmit = (data) => {
        startCapture({
            command: buildCommand(isLegacyCli, data),
            toolVersion,
            essidList: data.essidList,
            // 6.2.x soft filter lists; 6.3.x BPF. The backend appends only the
            // flags valid for `toolVersion`, so sending all is safe.
            filterlistAp: data.filterlistAp,
            filterlistClient: data.filterlistClient,
            bpf: data.bpf,
        });
    };

    return (
        <PanelCard
            title={'Capture Settings'}
            icon={'crosshair'}
            refetch={statusQuery.refetch}
            isFetching={statusQuery.isFetching}
        >
            <Row className={'mb-3'}>
                <Col xs={12} sm={6} md={4}>
                    <Form.Group>
                        <Form.Label>Tool version</Form.Label>
                        <Form.Select
                            value={toolVersion}
                            onChange={(event) => setToolVersion(event.target.value)}
                        >
                            {TOOL_VERSION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Text className={'text-body-secondary'}>
                            The 6.3.0 rewrite changed the CLI; pick the branch that matches the installed binary.
                        </Form.Text>
                    </Form.Group>
                </Col>
            </Row>

            {toolBranch && toolVersion !== installedBranch && (
                <Alert variant={'warning'} className={'py-2'}>
                    Detected hcxdumptool <strong>{detectedVersion ?? installedBranch}</strong> on the device,
                    but you are building a <strong>{toolVersion}.x</strong> command — it may abort on the
                    installed binary.
                </Alert>
            )}

            <FormProvider schema={hcxdumptoolSettingsSchema} onSubmit={handleSubmit} defaultValues={DEFAULT_VALUES}>
                <PresetBar toolVersion={toolVersion} onToolVersionChange={setToolVersion} />

                <Accordion defaultActiveKey={'core'} alwaysOpen={true}>
                    <Accordion.Item eventKey={'core'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'sliders'} /></span>Core</Accordion.Header>
                        <Accordion.Body>
                            <Row className={'g-3'}>
                                <Col md={6}>
                                    <SelectField
                                        name={'interface'}
                                        label={'Interface'}
                                        options={[{ value: '', label: 'Select one...' }, ...interfaceOptions]}
                                    />
                                </Col>
                                {isLegacyCli ? (
                                    <>
                                        <Col md={6}>
                                            <SelectField name={'scanlist'} label={'Scan list (-s)'} options={SCANLIST_OPTIONS} />
                                        </Col>
                                        <Col md={6}>
                                            <InputField name={'channel'} label={'Channel (-c)'} placeholder={'e.g. 1,6,11'} />
                                        </Col>
                                    </>
                                ) : (
                                    <>
                                        <Col md={6}>
                                            <InputField name={'channel'} label={'Channels (-c, band-suffixed)'} placeholder={'e.g. 1a,6a,11a'} />
                                        </Col>
                                        <Col md={6}>
                                            <InputField name={'singleFrequency'} label={'Single frequency MHz (-f)'} placeholder={'e.g. 2412'} />
                                        </Col>
                                        <Col md={6}>
                                            <SwitchField name={'allFrequencies'} label={'Use all frequencies (-F)'} />
                                        </Col>
                                    </>
                                )}
                                <Col md={6}>
                                    <InputField name={'minStayTime'} label={'Min stay per channel sec (-t)'} placeholder={'Seconds'} />
                                </Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'display'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'monitor'} /></span>{isLegacyCli ? 'Status Display' : 'Real-time Display'}</Accordion.Header>
                        <Accordion.Body>
                            {isLegacyCli ? (
                                <Row className={'g-3'}>
                                    {STATUS_FLAGS.map((flag) => (
                                        <Col md={6} key={flag.name}>
                                            <SwitchField name={flag.name} label={flag.label} />
                                        </Col>
                                    ))}
                                </Row>
                            ) : (
                                <SwitchField name={'rdsSort'} label={'Sort display by status (--rds=1)'} />
                            )}
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'attacks'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'zap'} /></span>Attack Control</Accordion.Header>
                        <Accordion.Body>
                            {isLegacyCli ? (
                                <Row className={'g-3'}>
                                    <Col md={6}><SwitchField name={'disableClientAttacks'} label={'Disable client attacks'} /></Col>
                                    <Col md={6}><SwitchField name={'disableApAttacks'} label={'Disable AP attacks'} /></Col>
                                    <Col md={6}><SwitchField name={'silent'} label={'Silent / passive (--silent)'} /></Col>
                                    <Col md={6}><SwitchField name={'activeBeacon'} label={'Active beacon (--active_beacon)'} /></Col>
                                    <Col md={6}><InputField name={'stopApAttacks'} label={'Stop AP attacks after N (--stop_ap_attacks)'} placeholder={'Beacons'} /></Col>
                                    <Col md={6}><InputField name={'stopClientAttacks'} label={'Stop client after N M2 (--stop_client_m2_attacks)'} placeholder={'M2 frames'} /></Col>
                                </Row>
                            ) : (
                                <Row className={'g-3'}>
                                    <Col md={6}><InputField name={'attemptApMax'} label={'Max beacons before AP attack (--attemptapmax, 0=off)'} placeholder={'Default ~4'} /></Col>
                                    <Col md={6}><InputField name={'attemptClientMax'} label={'Max EAPOL M2 requests (--attemptclientmax, 0=off)'} placeholder={'Default 10'} /></Col>
                                    <Col md={6}><SwitchField name={'disableBeacon'} label={'Disable internal beacon (--disable_beacon)'} /></Col>
                                    <Col md={6}><SelectField name={'rcascan'} label={'RCA scan only (--rcascan)'} options={RCASCAN_OPTIONS} /></Col>
                                </Row>
                            )}
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'filtering'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'filter'} /></span>Filtering</Accordion.Header>
                        <Accordion.Body>
                            {isLegacyCli ? (
                                <>
                                    <SelectField name={'filtermode'} label={'Filter Mode (--filtermode)'} options={FILTERMODE_OPTIONS} />
                                    <TextAreaField name={'filterlistAp'} label={'AP MAC filter list (one per line, aabbccddeeff)'} rows={3} placeholder={'aabbccddeeff'} />
                                    <TextAreaField name={'filterlistClient'} label={'Client MAC filter list (one per line, aabbccddeeff)'} rows={3} placeholder={'aabbccddeeff'} />
                                </>
                            ) : (
                                <TextAreaField name={'bpf'} label={'BPF filter (--bpf, tcpdump -ddd decimal format)'} rows={4} placeholder={'Paste compiled BPF: first line = count, then "n n n n" per line'} />
                            )}
                            <TextAreaField
                                name={'essidList'}
                                label={isLegacyCli
                                    ? 'ESSID list (--essidlist: transmit beacons, one per line)'
                                    : 'ESSID list (--essidlist: seed ESSID ring buffer, one per line)'}
                                rows={3}
                                placeholder={'MyNetwork'}
                            />
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'timing'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'clock'} /></span>Timing</Accordion.Header>
                        <Accordion.Body>
                            <Row className={'g-3'}>
                                <Col md={6}><InputField name={'tot'} label={'Capture timeout minutes (--tot, min: 2)'} placeholder={'Minutes'} /></Col>
                                {isLegacyCli ? (
                                    <Col md={6}><InputField name={'eapoltimeout'} label={'EAPOL timeout usec (--eapoltimeout)'} placeholder={'Microseconds'} /></Col>
                                ) : (
                                    <Col md={6}><InputField name={'watchdogmax'} label={'Watchdog max sec (--watchdogmax)'} placeholder={'Seconds'} /></Col>
                                )}
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'other'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'map-pin'} /></span>GPS / Other</Accordion.Header>
                        <Accordion.Body>
                            <Row className={'g-3'}>
                                {isLegacyCli ? (
                                    <>
                                        <Col md={6}><SwitchField name={'useGpsd'} label={'Use gpsd (--use_gpsd)'} /></Col>
                                        <Col md={6}><InputField name={'nmea'} label={'NMEA output file (--nmea)'} placeholder={'/path/to/file.nmea'} /></Col>
                                        <Col md={6}><SwitchField name={'doRcascan'} label={'RCA scan (--do_rcascan)'} /></Col>
                                    </>
                                ) : (
                                    <>
                                        <Col md={6}><SwitchField name={'gpsd'} label={'Use gpsd (--gpsd)'} /></Col>
                                        <Col md={6}><InputField name={'nmeaOut'} label={'NMEA output file (--nmea_out)'} placeholder={'/path/to/file.nmea'} /></Col>
                                    </>
                                )}
                                <Col md={12}><InputField name={'extraFlags'} label={'Extra Flags'} placeholder={'Additional hcxdumptool flags'} /></Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>

                <CommandPreview isLegacyCli={isLegacyCli} />

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
};

export default SettingsCard;
