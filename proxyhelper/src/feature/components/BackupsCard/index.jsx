/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import PanelCard from '@src/components/PanelCard';
import PanelTable from '@common/components/PanelTable';
import ActionButtons from '@common/components/ActionButtons';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import Button from '@src/components/Button';
import useGetBackups from '@module/feature/hooks/useGetBackups.js';
import useBackupFirewall from '@module/feature/hooks/useBackupFirewall.js';
import useRestoreFirewall from '@module/feature/hooks/useRestoreFirewall.js';
import useDeleteBackup from '@module/feature/hooks/useDeleteBackup.js';

const BackupsCard = () => {
    const query = useGetBackups();
    const { mutate: backupFirewall, isPending: backupPending } = useBackupFirewall();
    const { mutate: restoreFirewall, isPending: restorePending } = useRestoreFirewall();
    const { mutate: deleteBackup, isPending: deletePending } = useDeleteBackup();
    const { data, isSuccess } = query;

    const handleRestore = (filename) => {
        restoreFirewall({ filename });
    };

    const handleDelete = (filename) => {
        deleteBackup({ filename });
    };

    return (
        <PanelCard
            title={'Firewall Backups'}
            icon={'archive'}
            subtitle={'Create, restore, and manage iptables firewall backups.'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            <div className={'d-flex justify-content-end mb-3'}>
                <Button
                    label={'Backup Now'}
                    icon={'save'}
                    onClick={backupFirewall}
                    loading={backupPending}
                />
            </div>
            {isSuccess ? (
                <PanelTable>
                    <thead>
                    <tr>
                        <th>Backup File</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {data.backups.length > 0 ? (
                        data.backups.map((item) => (
                            <tr key={item}>
                                <td>{item}</td>
                                <td>
                                    <ActionButtons>
                                        <Button
                                            icon={'upload'}
                                            title={'Restore'}
                                            size={'sm'}
                                            loading={restorePending}
                                            onClick={() => handleRestore(item)}
                                        />
                                        <Button
                                            icon={'trash-2'}
                                            title={'Delete'}
                                            variant={'outline-danger'}
                                            size={'sm'}
                                            loading={deletePending}
                                            onClick={() => handleDelete(item)}
                                        />
                                    </ActionButtons>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={2}>No backups available.</td>
                        </tr>
                    )}
                    </tbody>
                </PanelTable>
            ) : (
                <SkeletonTable
                    headers={['Backup File', 'Actions']}
                    widths={[240, 180]}
                    rows={3}
                />
            )}
        </PanelCard>
    );
};

export default BackupsCard;
