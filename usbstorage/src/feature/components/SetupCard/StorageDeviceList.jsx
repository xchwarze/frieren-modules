/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import Alert from 'react-bootstrap/Alert';
import PropTypes from 'prop-types';

export const formatSize = (bytes) => {
    const gib = bytes / (1024 ** 3);
    return `${gib.toLocaleString(undefined, { maximumFractionDigits: 2 })} GiB`;
};

const StorageDeviceList = ({ devices, selectedDevice, disabled, onSelect }) => (
    <Table responsive bordered>
        <thead><tr><th>Device</th><th>Existing partitions and usage</th><th>Availability</th></tr></thead>
        <tbody>
            {devices.map((device) => (
                <tr key={device.id}>
                    <td>
                        <Form.Check
                            type={'radio'}
                            name={'storage-device'}
                            id={`storage-device-${device.id}`}
                            label={device.path}
                            aria-label={`Select ${device.path}`}
                            checked={selectedDevice?.id === device.id}
                            disabled={disabled || !device.eligible}
                            onChange={() => onSelect(device)}
                        />
                        <div>{device.model || 'Unknown model'}</div>
                        <div>{formatSize(device.sizeBytes)}</div>
                        <div>Transport: {device.transport}; connection: {device.connection}</div>
                    </td>
                    <td>
                        {device.partitions.length ? (
                            <ul>{device.partitions.map((partition) => (
                                <li key={partition.path}>{partition.path} ({formatSize(partition.sizeBytes)})</li>
                            ))}</ul>
                        ) : <div>No existing partitions reported.</div>}
                        <div>Mounts: {device.mounts.length ? device.mounts.join(', ') : 'none'}</div>
                        <div>Active swap: {device.swaps.length ? device.swaps.join(', ') : 'none'}</div>
                    </td>
                    <td>
                        <div>{device.eligible ? 'Eligible for explicit selection' : (device.reason || 'Device is not eligible.')}</div>
                        {device.warnings.map((warning) => (
                            <Alert key={warning} variant={'warning'} className={'mb-1'}>{warning}</Alert>
                        ))}
                    </td>
                </tr>
            ))}
        </tbody>
    </Table>
);

StorageDeviceList.propTypes = {
    devices: PropTypes.arrayOf(PropTypes.object).isRequired,
    selectedDevice: PropTypes.object,
    disabled: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
};

export default StorageDeviceList;
