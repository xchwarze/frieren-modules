/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import PanelCard from '@common/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import ActionButtons from '@common/components/ActionButtons';
import FormActions from '@common/components/FormActions';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import Button from '@common/components/Button';
import useListPortals from '@module/feature/hooks/useListPortals.js';
import useDeletePortal from '@module/feature/hooks/useDeletePortal.js';
import useGetPortalFiles from '@module/feature/hooks/useGetPortalFiles.js';
import useSavePortalFile from '@module/feature/hooks/useSavePortalFile.js';

const PortalsCard = () => {
    const portalsQuery = useListPortals();
    const { mutateAsync: deleteMutation, isPending: deletePending } = useDeletePortal();
    const { mutateAsync: saveMutation, isPending: savePending } = useSavePortalFile();

    const [editingPortal, setEditingPortal] = useState(null);
    const [editingFile, setEditingFile] = useState(null);
    const [fileContent, setFileContent] = useState('');

    const filesQuery = useGetPortalFiles(editingPortal);
    const portals = portalsQuery?.data?.portals ?? [];
    const files = filesQuery?.data?.files ?? [];
    const portalsLoaded = portalsQuery.isSuccess;
    const filesLoaded = filesQuery.isSuccess;

    const handleEdit = (portalName) => {
        setEditingPortal(portalName);
        setEditingFile(null);
        setFileContent('');
    };

    const handleSelectFile = (file) => {
        setEditingFile(file.name);
        setFileContent(file.content);
    };

    const handleSave = () => {
        if (editingPortal && editingFile) {
            saveMutation({ portal: editingPortal, filename: editingFile, content: fileContent });
        }
    };

    if (editingPortal) {
        return (
            <PanelCard
                title={`Editing: ${editingPortal}`}
                subtitle={'Select a file to edit'}
                refetch={filesQuery.refetch}
                isFetching={filesQuery.isFetching}
            >
                <div className={'d-flex gap-2 mb-3'}>
                    <Button
                        label={'Back'}
                        icon={'arrow-left'}
                        variant={'outline-secondary'}
                        onClick={() => setEditingPortal(null)}
                    />
                </div>

                <Row className={'g-3'}>
                    <Col md={3}>
                        {filesLoaded ? (
                            <div className={'list-group'}>
                                {files.map((file) => (
                                    <button
                                        key={file.name}
                                        className={`list-group-item list-group-item-action ${editingFile === file.name ? 'active' : ''}`}
                                        onClick={() => handleSelectFile(file)}
                                    >
                                        {file.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <SkeletonTable
                                widths={[140]}
                                rows={4}
                            />
                        )}
                    </Col>
                    <Col md={9}>
                        {editingFile ? (
                            <>
                                <Form.Label>{editingFile}</Form.Label>
                                <Form.Control
                                    as={'textarea'}
                                    rows={15}
                                    value={fileContent}
                                    onChange={(e) => setFileContent(e.target.value)}
                                    className={'font-monospace'}
                                    style={{ fontSize: '0.85rem' }}
                                />
                                <FormActions>
                                    <Button
                                        label={'Save'}
                                        icon={'save'}
                                        onClick={handleSave}
                                        loading={savePending}
                                    />
                                </FormActions>
                            </>
                        ) : (
                            <p className={'text-body-secondary'}>Select a file from the list</p>
                        )}
                    </Col>
                </Row>
            </PanelCard>
        );
    }

    return (
        <PanelCard
            title={'Portal Manager'}
            subtitle={'Manage installed portals'}
            refetch={portalsQuery.refetch}
            isFetching={portalsQuery.isFetching}
        >
            {portalsLoaded ? (
            <PanelTable size={'sm'}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Author</th>
                        <th style={{ width: '150px' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {portals.map((portal) => (
                        <tr key={portal.name}>
                            <td>{portal.title || portal.name}</td>
                            <td>{portal.description}</td>
                            <td>{portal.author}</td>
                            <td>
                                <ActionButtons>
                                    <Button
                                        label={'Edit'}
                                        icon={'edit'}
                                        variant={'outline-primary'}
                                        size={'sm'}
                                        onClick={() => handleEdit(portal.name)}
                                    />
                                    <Button
                                        label={'Delete'}
                                        icon={'trash-2'}
                                        variant={'outline-danger'}
                                        size={'sm'}
                                        onClick={() => deleteMutation({ portal: portal.name })}
                                        loading={deletePending}
                                    />
                                </ActionButtons>
                            </td>
                        </tr>
                    ))}
                    {portals.length === 0 && (
                        <tr>
                            <td colSpan={4} className={'text-center text-body-secondary'}>
                                No portals installed. Copy portal templates to the portals directory.
                            </td>
                        </tr>
                    )}
                </tbody>
            </PanelTable>
            ) : (
                <SkeletonTable
                    headers={['Name', 'Description', 'Author', 'Actions']}
                    widths={[140, 220, 120, 130]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default PortalsCard;
