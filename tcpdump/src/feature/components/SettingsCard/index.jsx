/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Accordion from 'react-bootstrap/Accordion';
import { useAtomValue } from 'jotai';
import * as yup from 'yup';
import PropTypes from 'prop-types';

import PanelCard from '@src/components/PanelCard';
import Icon from '@src/components/Icon';
import FormActions from '@common/components/FormActions';
import Button from '@src/components/Button';
import FormProvider from '@src/components/Form/FormProvider';
import SelectField from '@src/components/Form/SelectField';
import SwitchField from '@src/components/Form/SwitchField';
import SubmitButton from '@src/components/Form/SubmitButton';
import isRunningAtom from '@module/feature/atoms/isRunningAtom.js';
import useStartCapture from '@module/feature/hooks/useStartCapture.js';
import useStopCapture from '@module/feature/hooks/useStopCapture.js';
import CommandInput from '@module/feature/components/CommandInput';
import FilterInput from '@module/feature/components/FilterInput';

const tcpDumpSettingsSchema = yup.object({
    command: yup.string().required('Command is mandatory'),
    interface: yup.string().required('Interface is mandatory'),
}).required();

const SettingsCard = ({ statusQuery }) => {
    const isRunning = useAtomValue(isRunningAtom);
    const { mutate: startCapture } = useStartCapture();
    const { mutate: stopCapture, isPending: stopCaptureRunning } = useStopCapture();
    const { interfaces } = statusQuery?.data ?? {};

    const defaultValues = {
        // commands
        command: '',
        interface: '',
        verbose: '',
        resolve: '',
        timestamp: '',

        // filters
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
        printAbsoluteNumbers: false,
        getEthernetHeaders: false,
        lessProtocolInfo: false,
        monitorMode: false,
    };

    return (
        <PanelCard
            title={'Capture Settings'}
            icon={'crosshair'}
            refetch={statusQuery.refetch}
            isFetching={statusQuery.isFetching}
        >
            <FormProvider schema={tcpDumpSettingsSchema} onSubmit={startCapture} defaultValues={defaultValues}>
                <Accordion defaultActiveKey={'basic'} alwaysOpen={true}>
                    <Accordion.Item eventKey={'basic'}>
                        <Accordion.Header><span className={'me-2'}><Icon name={'sliders'} /></span>Basic Options</Accordion.Header>
                        <Accordion.Body>
                            <CommandInput
                                label={'Command'}
                                placeholder={'Enter TCPDump command'}
                            />
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
                            </Row>
                            <SelectField
                                name={'resolve'}
                                label={'Resolve'}
                                options={[
                                    {value: '', label: 'Select one...'},
                                    {value: '-n', label: 'Don\'t resolve hostnames'},
                                    {value: '-nn', label: 'Don\'t resolve hostnames or port names'},
                                ]}
                            />
                            <SelectField
                                name={'timestamp'}
                                label={'Timestamp'}
                                options={[
                                    {
                                        value: '',
                                        label: 'Select one...'
                                    },
                                    {
                                        value: '-t',
                                        label: 'Don\'t print a timestamp on each dump line'
                                    },
                                    {
                                        value: '-tt',
                                        label: 'Print an unformatted timestamp on each dump line'
                                    },
                                    {
                                        value: '-ttt',
                                        label: 'Print a delta (micro-second resolution) between current and previous line on each dump line'
                                    },
                                    {
                                        value: '-tttt',
                                        label: 'Print a timestamp in default format proceeded by date on each dump line'
                                    },
                                    {
                                        value: '-ttttt',
                                        label: 'Print a delta (micro-second resolution) between current and first line on each dump line'
                                    },
                                ]}
                            />
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
                                <Col md={6}>
                                    <SwitchField
                                        name={'dontPrintHostName'}
                                        label={'Don\'t print domain name qualification of host names'}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SwitchField
                                        name={'showHexAndASCII'}
                                        label={'Show the packet\'s contents in both hex and ASCII'}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SwitchField
                                        name={'printAbsoluteNumbers'}
                                        label={'Print absolute sequence numbers'}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SwitchField
                                        name={'getEthernetHeaders'}
                                        label={'Get the ethernet header as well'}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SwitchField
                                        name={'lessProtocolInfo'}
                                        label={'Show less protocol information'}
                                    />
                                </Col>
                                <Col md={6}>
                                    <SwitchField
                                        name={'monitorMode'}
                                        label={'Monitor mode'}
                                    />
                                </Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>

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
