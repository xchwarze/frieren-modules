/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Form from 'react-bootstrap/Form';

import PanelCard from '@common/components/PanelCard';
import SkeletonTable from '@src/components/SkeletonBar/SkeletonTable';
import useGetNatRules from '@module/feature/hooks/useGetNatRules.js';

const RulesCard = () => {
    const query = useGetNatRules();
    const { isSuccess } = query;
    const rules = query?.data?.rules ?? '';
    const content = rules !== '' ? rules : 'No NAT rules to display.';

    return (
        <PanelCard
            title={'Active NAT Rules'}
            subtitle={'Live output of "iptables -t nat -L -n -v". Use refresh to reload.'}
            refetch={query.refetch}
            isFetching={query.isFetching}
        >
            {isSuccess ? (
                <Form.Group>
                    <Form.Control
                        as={'textarea'}
                        rows={12}
                        readOnly={true}
                        value={content}
                        className={'text-body-secondary font-monospace'}
                    />
                </Form.Group>
            ) : (
                <SkeletonTable
                    widths={[600]}
                    rows={12}
                />
            )}
        </PanelCard>
    );
};

export default RulesCard;
