/*
 * Project: Frieren Nmap Module
 * Based on Frieren Framework Template Module and other Frieren modules
 * Original Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * Modifications and new code by m5kro <m5kro@proton.me>, 2024
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 *
 * Original code from Frieren Framework is distributed under the terms of the
 * GNU Lesser General Public License (LGPL) version 3 or later. You should have received
 * a copy of the LGPL-3.0-or-later along with this project. If not, see <https://www.gnu.org/licenses>.
 *
 * Modifications: Added options to manage Nmap scans, including Nmap related command options.
 */

import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Accordion from 'react-bootstrap/Accordion';
import { useAtomValue } from 'jotai';
import * as yup from 'yup';
import PropTypes from 'prop-types';

import PanelCard from '@src/components/PanelCard';
import Icon from '@src/components/Icon';
import Button from '@src/components/Button';
import FormActions from '@common/components/FormActions';
import FormProvider from '@src/components/Form/FormProvider';
import SwitchField from '@src/components/Form/SwitchField';
import SelectField from '@src/components/Form/SelectField';
import InputField from '@src/components/Form/InputField';
import SubmitButton from '@src/components/Form/SubmitButton';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useStartScan from '@module/feature/hooks/startScan.js';
import useStopScan from '@module/feature/hooks/stopScan.js';
import CommandInput from '@module/feature/components/CommandInput';

const nmapSettingsSchema = yup.object({
    command: yup.string().required('Command is mandatory'),
    target: yup.string().required('Target is mandatory'),
}).required();

const OptionsCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startScan } = useStartScan();
    const { mutate: stopScan, isPending: stopScanRunning } = useStopScan();

    const defaultValues = {
        command: '',
        target: '',
        verbose: false,
        osDetection: false,
        serviceVersion: false,
        traceroute: false,
        timing: '',
        scanType: '',
        topPorts: '',
        script: '',
        customOptions: '',
    };

    return (
        <PanelCard
            title={'Scan Settings'}
            icon={'target'}
            refetch={statusQuery.refetch}
            isFetching={statusQuery.isFetching}
        >
            <FormProvider schema={nmapSettingsSchema} onSubmit={startScan} defaultValues={defaultValues}>
                <Accordion defaultActiveKey={'basic'} alwaysOpen={true}>
                    <Accordion.Item eventKey={'basic'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'sliders'} /></span>Basic Options</Accordion.Header>
                        <Accordion.Body>
                            <CommandInput label={'Command'} placeholder={'Enter Nmap command'} />
                            <InputField name={'target'} label={'Target'} placeholder={'Enter target'} />
                            <Row className={'g-3'}>
                                <Col md={6}>
                                    <SelectField
                                        name={'scanType'}
                                        label={'Scan Type (-s value)'}
                                        options={[
                                            { value: '', label: 'Default' },
                                            { value: 'S', label: '-sS (TCP SYN)' },
                                            { value: 'T', label: '-sT (TCP Connect)' },
                                            { value: 'U', label: '-sU (UDP)' },
                                            { value: 'A', label: '-sA (TCP ACK)' },
                                            { value: 'W', label: '-sW (TCP Window)' },
                                            { value: 'M', label: '-sM (TCP Maimon)' },
                                            { value: 'N', label: '-sN (TCP Null)' },
                                            { value: 'F', label: '-sF (TCP FIN)' },
                                            { value: 'X', label: '-sX (TCP Xmas)' },
                                            { value: 'n', label: '-sn (Ping scan, no ports)' },
                                        ]}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SelectField
                                        name={'timing'}
                                        label={'Timing (-T value)'}
                                        options={[
                                            { value: '', label: 'Default' },
                                            { value: '0', label: '-T0 (Paranoid)' },
                                            { value: '1', label: '-T1 (Sneaky)' },
                                            { value: '2', label: '-T2 (Polite)' },
                                            { value: '3', label: '-T3 (Normal)' },
                                            { value: '4', label: '-T4 (Aggressive)' },
                                            { value: '5', label: '-T5 (Insane)' },
                                        ]}
                                    />
                                </Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey={'advanced'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'tool'} /></span>Advanced Options</Accordion.Header>
                        <Accordion.Body>
                            <Row className={'g-3'}>
                                <Col md={6}><SwitchField name={'verbose'} label={'Verbose'} /></Col>
                                <Col md={6}><SwitchField name={'osDetection'} label={'OS Detection'} /></Col>
                                <Col md={6}><SwitchField name={'serviceVersion'} label={'Service Version'} /></Col>
                                <Col md={6}><SwitchField name={'traceroute'} label={'Traceroute'} /></Col>
                                <Col md={6}><InputField name={'topPorts'} label={'Top Ports (--top-ports)'} placeholder={'e.g. 100'} /></Col>
                                <Col md={6}><InputField name={'script'} label={'Script (--script=)'} placeholder={'e.g. vuln, default'} /></Col>
                                <Col md={12}><InputField name={'customOptions'} label={'Custom Options'} placeholder={'Extra nmap flags'} /></Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>

                <FormActions>
                    <SubmitButton label={'Start Scan'} icon={'play'} loading={isRunning} />
                    <Button
                        label={'Stop Scan'}
                        icon={'square'}
                        variant={'danger'}
                        onClick={stopScan}
                        loading={stopScanRunning}
                        disabled={!isRunning}
                    />
                </FormActions>
            </FormProvider>
        </PanelCard>
    );
};

OptionsCard.propTypes = {
    statusQuery: PropTypes.object.isRequired,
};

export default OptionsCard;
