/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useAtomValue } from 'jotai';
import * as yup from 'yup';
import PropTypes from 'prop-types';

import PanelCard from '@src/components/PanelCard';
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

const hcxdumptoolSettingsSchema = yup.object({
    interface: yup.string().required('Interface is mandatory'),
    scanlist: yup.string(),
    extraFlags: yup.string(),
}).required();

// --enable_status bitmask flags
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

const SettingsCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startCapture } = useStartCapture();
    const { mutate: stopCapture, isPending: stopCaptureRunning } = useStopCapture();
    const { interfaces } = statusQuery?.data ?? {};

    const interfaceOptions = (interfaces ?? []).map((iface) => ({
        value: iface,
        label: iface,
    }));

    const defaultValues = {
        interface: '',
        scanlist: '',
        singleFrequency: '',
        allFrequencies: false,
        minStayTime: '',
        // status display (defaults to EAPOL + Association = 3)
        statusEapol: true,
        statusAssociation: true,
        statusAuthentication: false,
        statusBeacon: false,
        statusRogueAp: false,
        statusGps: false,
        statusInternal: false,
        statusEap: false,
        // attack control
        disableClientAttacks: false,
        disableApAttacks: false,
        stopApAttacks: '',
        stopClientAttacks: '',
        passive: false,
        activeBeacon: false,
        // filtering
        filtermode: '',
        filterlistAp: '',
        filterlistClient: '',
        essidList: '',
        // timing
        tot: '',
        eapoltimeout: '',
        watchdogmax: '',
        // other
        macAp: '',
        macClient: '',
        gpsd: false,
        nmea: '',
        doRcascan: false,
        extraFlags: '',
    };

    const handleSubmit = (data) => {
        // Build the --enable_status bitmask by summing the selected flags.
        const statusBitmask = STATUS_FLAGS.reduce(
            (sum, flag) => (data[flag.name] ? sum + flag.value : sum),
            0
        );

        const parts = [`--enable_status=${statusBitmask}`, `-i ${data.interface}`];

        // Core
        if (data.scanlist !== '') {
            parts.push(`-s ${data.scanlist}`);
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

        // Attack control
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
            parts.push(`--stop_client_attacks=${data.stopClientAttacks}`);
        }
        if (data.passive) {
            parts.push('--passive');
        }
        if (data.activeBeacon) {
            parts.push('--active_beacon');
        }

        // Filtering (MAC/ESSID lists are sent as raw text and written to files by the backend)
        if (data.filtermode !== '') {
            parts.push(`--filtermode=${data.filtermode}`);
        }

        // Timing
        if (data.tot) {
            parts.push(`--tot=${data.tot}`);
        }
        if (data.eapoltimeout) {
            parts.push(`--eapoltimeout=${data.eapoltimeout}`);
        }
        if (data.watchdogmax) {
            parts.push(`--watchdogmax=${data.watchdogmax}`);
        }

        // Other
        if (data.macAp) {
            parts.push(`--mac_ap=${data.macAp}`);
        }
        if (data.macClient) {
            parts.push(`--mac_client=${data.macClient}`);
        }
        if (data.gpsd) {
            parts.push('--gpsd');
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

        startCapture({
            command: parts.join(' '),
            filterlistAp: data.filterlistAp,
            filterlistClient: data.filterlistClient,
            essidList: data.essidList,
        });
    };

    return (
        <PanelCard
            title={'Capture Settings'}
            query={statusQuery}
        >
            <FormProvider schema={hcxdumptoolSettingsSchema} onSubmit={handleSubmit} defaultValues={defaultValues}>
                <Row className={'g-4'}>
                    <Col md={6} className={'mt-4'}>
                        <p className={'fw-bold fs-5 mb-3'}>Core</p>
                        <SelectField
                            name={'interface'}
                            label={'Interface'}
                            options={[
                                { value: '', label: 'Select one...' },
                                ...interfaceOptions,
                            ]}
                        />
                        <SelectField
                            name={'scanlist'}
                            label={'Scan list (-s)'}
                            options={[
                                { value: '', label: 'Default' },
                                { value: '0', label: '0 - Auto' },
                                { value: '1', label: '1 - Optimized 2.4 GHz' },
                                { value: '2', label: '2 - Standard 2.4 GHz (1-13)' },
                                { value: '3', label: '3 - Standard 5 GHz' },
                                { value: '4', label: '4 - Combined 2.4 + 5 GHz' },
                                { value: '5', label: '5 - 6 GHz' },
                            ]}
                        />
                        <InputField
                            name={'singleFrequency'}
                            label={'Single frequency MHz (-f)'}
                            placeholder={'e.g. 2412'}
                        />
                        <SwitchField
                            name={'allFrequencies'}
                            label={'Use all frequencies (-F)'}
                        />
                        <InputField
                            name={'minStayTime'}
                            label={'Min stay per channel sec (-t)'}
                            placeholder={'Seconds'}
                        />

                        <p className={'fw-bold fs-5 mb-3 mt-4'}>Filtering</p>
                        <SelectField
                            name={'filtermode'}
                            label={'Filter Mode (--filtermode)'}
                            options={[
                                { value: '', label: 'None' },
                                { value: '0', label: '0 - Ignore' },
                                { value: '1', label: '1 - Protection (exclude filtered)' },
                                { value: '2', label: '2 - Target (only filtered)' },
                            ]}
                        />
                        <TextAreaField
                            name={'filterlistAp'}
                            label={'AP MAC filter list (one per line, aabbccddeeff)'}
                            rows={3}
                            placeholder={'aabbccddeeff'}
                        />
                        <TextAreaField
                            name={'filterlistClient'}
                            label={'Client MAC filter list (one per line, aabbccddeeff)'}
                            rows={3}
                            placeholder={'aabbccddeeff'}
                        />
                        <TextAreaField
                            name={'essidList'}
                            label={'ESSID list (--essidlist, one per line)'}
                            rows={3}
                            placeholder={'MyNetwork'}
                        />

                        <p className={'fw-bold fs-5 mb-3 mt-4'}>Timing</p>
                        <InputField
                            name={'tot'}
                            label={'Capture timeout minutes (--tot, min: 2)'}
                            placeholder={'Minutes'}
                        />
                        <InputField
                            name={'eapoltimeout'}
                            label={'EAPOL timeout usec (--eapoltimeout)'}
                            placeholder={'Microseconds'}
                        />
                        <InputField
                            name={'watchdogmax'}
                            label={'Watchdog max sec (--watchdogmax)'}
                            placeholder={'Seconds'}
                        />
                    </Col>

                    <Col md={6} className={'mt-4'}>
                        <p className={'fw-bold fs-5 mb-3'}>Status Display (--enable_status)</p>
                        {STATUS_FLAGS.map((flag) => (
                            <SwitchField
                                key={flag.name}
                                name={flag.name}
                                label={flag.label}
                            />
                        ))}

                        <p className={'fw-bold fs-5 mb-3 mt-4'}>Attack Control</p>
                        <SwitchField
                            name={'disableClientAttacks'}
                            label={'Disable client attacks'}
                        />
                        <SwitchField
                            name={'disableApAttacks'}
                            label={'Disable AP attacks'}
                        />
                        <SwitchField
                            name={'passive'}
                            label={'Passive mode (no injection)'}
                        />
                        <SwitchField
                            name={'activeBeacon'}
                            label={'Active beacon (transmit every 200ms)'}
                        />
                        <InputField
                            name={'stopApAttacks'}
                            label={'Stop AP attacks after N frames (--stop_ap_attacks)'}
                            placeholder={'Number of frames'}
                        />
                        <InputField
                            name={'stopClientAttacks'}
                            label={'Stop client attacks after N frames (--stop_client_attacks)'}
                            placeholder={'Number of frames'}
                        />

                        <p className={'fw-bold fs-5 mb-3 mt-4'}>Other</p>
                        <InputField
                            name={'macAp'}
                            label={'AP MAC (--mac_ap, hex)'}
                            placeholder={'aabbccddeeff'}
                        />
                        <InputField
                            name={'macClient'}
                            label={'Client MAC (--mac_client, hex)'}
                            placeholder={'aabbccddeeff'}
                        />
                        <SwitchField
                            name={'gpsd'}
                            label={'Use gpsd (--gpsd)'}
                        />
                        <InputField
                            name={'nmea'}
                            label={'NMEA output file (--nmea)'}
                            placeholder={'/path/to/file.nmea'}
                        />
                        <SwitchField
                            name={'doRcascan'}
                            label={'RCA scan (--do_rcascan)'}
                        />
                        <InputField
                            name={'extraFlags'}
                            label={'Extra Flags'}
                            placeholder={'Additional hcxdumptool flags (e.g. --bpf=...)'}
                        />
                    </Col>
                </Row>

                <div className={'d-flex justify-content-end'}>
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
                        className={'ms-2'}
                    />
                </div>
            </FormProvider>
        </PanelCard>
    );
};

SettingsCard.propTypes = {
    statusQuery: PropTypes.object.isRequired,
}

export default SettingsCard;
