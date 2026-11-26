/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useAtomValue } from 'jotai';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { useWatch } from 'react-hook-form';
import * as yup from 'yup';
import PropTypes from 'prop-types';

import PanelCard from '@src/components/PanelCard';
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

const BAND_OPTIONS = [
    { value: 'bg', label: '2.4 GHz (bg)' },
    { value: 'a', label: '5 GHz (a)' },
    { value: 'abg', label: '2.4 + 5 GHz (abg)' },
];

const captureSchema = yup.object({
    interface: yup.string().required('Interface is mandatory'),
    channel: yup.string().matches(/^\d*$/, 'Numbers only').max(3, 'Invalid channel'),
    bssid: yup.string().matches(/^$|^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/, 'Format aa:bb:cc:dd:ee:ff'),
    deauthCount: yup.string().matches(/^\d*$/, 'Numbers only'),
}).required();

const DEFAULT_VALUES = {
    interface: '',
    channel: '',
    band: 'bg',
    bssid: '',
    deauth: false,
    deauthCount: '5',
};

/**
 * Live, read-only preview of the assembled airodump-ng invocation. Channel and
 * deauth require a locked channel, so band is only used when no channel is set.
 */
const CommandPreview = () => {
    const watched = useWatch() ?? {};
    const data = { ...DEFAULT_VALUES, ...watched };

    const parts = ['airodump-ng', '--output-format pcap,csv', '-w <storage>/<timestamp>'];
    if (data.channel) {
        parts.push(`-c ${data.channel}`);
    } else if (data.band) {
        parts.push(`--band ${data.band}`);
    }
    if (data.bssid) {
        parts.push(`--bssid ${data.bssid}`);
    }
    parts.push(data.interface ? `${data.interface} (monitor)` : '<interface>');

    return (
        <Form.Group className={'mt-4'}>
            <Form.Label>Command preview</Form.Label>
            <Form.Control
                as={'textarea'}
                rows={2}
                readOnly={true}
                value={parts.join(' ')}
                className={'text-body-secondary font-monospace'}
            />
            <Form.Text className={'text-body-secondary'}>
                Output file (<code>-w</code>) and the monitor interface are resolved on the device.
            </Form.Text>
        </Form.Group>
    );
};

const CaptureCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startCapture } = useStartCapture();
    const { mutate: stopCapture, isPending: stopCaptureRunning } = useStopCapture();
    const { interfaces, monitors } = statusQuery?.data ?? {};

    const interfaceOptions = [
        { value: '', label: 'Select one...' },
        ...(interfaces ?? []).map((iface) => ({
            value: iface,
            label: (monitors ?? []).includes(iface) ? `${iface} (monitor)` : iface,
        })),
    ];

    const handleSubmit = (data) => {
        startCapture({
            interface: data.interface,
            channel: data.channel,
            band: data.band,
            bssid: data.bssid,
            deauthCount: data.deauth ? data.deauthCount : 0,
        });
    };

    return (
        <PanelCard
            title={'Capture'}
            icon={'target'}
            refetch={statusQuery.refetch}
            isFetching={statusQuery.isFetching}
        >
            <FormProvider schema={captureSchema} onSubmit={handleSubmit} defaultValues={DEFAULT_VALUES}>
                <Row className={'g-3'}>
                    <Col md={6}>
                        <SelectField name={'interface'} label={'Capture interface'} options={interfaceOptions} />
                    </Col>
                    <Col md={6}>
                        <InputField name={'channel'} label={'Channel (optional)'} placeholder={'e.g. 6'} />
                    </Col>
                    <Col md={6}>
                        <SelectField name={'band'} label={'Band (used when no channel)'} options={BAND_OPTIONS} />
                    </Col>
                    <Col md={6}>
                        <InputField name={'bssid'} label={'Target BSSID (optional)'} placeholder={'aa:bb:cc:dd:ee:ff'} />
                    </Col>
                    <Col md={6}>
                        <SwitchField name={'deauth'} label={'Active deauth (requires channel + BSSID)'} />
                    </Col>
                    <Col md={6}>
                        <InputField name={'deauthCount'} label={'Deauth frames'} placeholder={'e.g. 5'} />
                    </Col>
                </Row>

                <CommandPreview />

                <FormActions>
                    <SubmitButton
                        label={'Start capture'}
                        icon={'play'}
                        loading={isRunning}
                    />
                    <Button
                        label={'Stop'}
                        icon={'square'}
                        variant={'danger'}
                        onClick={() => stopCapture()}
                        loading={stopCaptureRunning}
                        disabled={!isRunning}
                    />
                </FormActions>
            </FormProvider>
        </PanelCard>
    );
};

CaptureCard.propTypes = {
    statusQuery: PropTypes.object.isRequired,
};

export default CaptureCard;
