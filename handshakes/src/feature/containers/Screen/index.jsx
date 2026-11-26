/*
 * Project: Frieren Framework
 * Copyright (C) 2026 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Tab from 'react-bootstrap/Tab';

import DependenciesAlert from '@src/components/DependenciesAlert';
import PanelStack from '@common/components/PanelCard/PanelStack';
import PanelTabs from '@src/components/Tabs/PanelTabs';
import TabTitle from '@src/components/Tabs/TabTitle';
import ConditionalTabContent from '@src/components/Tabs/ConditionalTabContent';
import { HANDSHAKES_GET_MODULE_STATUS } from '@module/feature/helpers/queryKeys.js';
import useModuleStatus from '@module/feature/hooks/useModuleStatus.js';
import CaptureCard from '@module/feature/components/CaptureCard';
import OutputCard from '@module/feature/components/OutputCard';
import HistoryCard from '@module/feature/components/HistoryCard';

const Screen = () => {
    const statusQuery = useModuleStatus();
    const { hasDependencies, message, internalAvailable, SDAvailable } = statusQuery?.data ?? {};

    return (
        <>
            {typeof hasDependencies === 'boolean' && hasDependencies === false && (
                <DependenciesAlert
                    module={'handshakes'}
                    dependenciesQueryKey={HANDSHAKES_GET_MODULE_STATUS}
                    show={!hasDependencies}
                    message={message}
                    internalAvailable={internalAvailable}
                    SDAvailable={SDAvailable}
                />
            )}

            <PanelTabs id={'handshakes'} defaultTab={'capture'}>
                <Tab eventKey={'capture'} title={<TabTitle title={'Capture'} icon={'target'} />}>
                    <ConditionalTabContent id={'handshakes'} eventKey={'capture'}>
                        <PanelStack>
                            <CaptureCard statusQuery={statusQuery} />
                            <OutputCard />
                        </PanelStack>
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'history'} title={<TabTitle title={'History'} icon={'file-text'} />}>
                    <ConditionalTabContent id={'handshakes'} eventKey={'history'}>
                        <HistoryCard />
                    </ConditionalTabContent>
                </Tab>
            </PanelTabs>
        </>
    );
};

export default Screen;
