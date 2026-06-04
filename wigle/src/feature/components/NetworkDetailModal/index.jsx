/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import PropTypes from 'prop-types';

const NetworkDetailModal = ({ show, onHide, netid, data, loading }) => {
    const results = data?.results;
    const detail = Array.isArray(results) ? results[0] : results;

    return (
        <Modal show={show} onHide={onHide} size={'lg'} centered scrollable>
            <Modal.Header closeButton>
                <Modal.Title>
                    Network Detail{netid ? <> — <code>{netid}</code></> : ''}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {loading && (
                    <div className={'d-flex justify-content-center py-4'}>
                        <Spinner animation={'border'} />
                    </div>
                )}

                {!loading && !detail && (
                    <p className={'text-muted mb-0'}>No detail available for this network.</p>
                )}

                {!loading && detail && (
                    <Table striped hover responsive>
                        <tbody>
                            {Object.entries(detail).map(([key, value]) => (
                                <tr key={key}>
                                    <td className={'fw-bold'}>{key}</td>
                                    <td>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Modal.Body>
        </Modal>
    );
};

NetworkDetailModal.propTypes = {
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
    netid: PropTypes.string,
    data: PropTypes.object,
    loading: PropTypes.bool,
};

export default NetworkDetailModal;
