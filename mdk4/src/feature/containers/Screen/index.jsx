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
import { MDK4_GET_MODULE_STATUS } from '@module/feature/helpers/queryKeys.js';
import useModuleStatus from '@module/feature/hooks/useModuleStatus.js';
import SettingsCard from '@module/feature/components/SettingsCard';
import OutputCard from '@module/feature/components/OutputCard';
import HistoryCard from '@module/feature/components/HistoryCard';

const Screen = () => {
    const statusQuery = useModuleStatus();
    const { hasDependencies, message, internalAvailable, SDAvailable } = statusQuery?.data ?? {};

    return (
        <>
            {typeof hasDependencies === 'boolean' && hasDependencies === false && (
                <DependenciesAlert
                    module={'mdk4'}
                    dependenciesQueryKey={MDK4_GET_MODULE_STATUS}
                    show={!hasDependencies}
                    message={message}
                    internalAvailable={internalAvailable}
                    SDAvailable={SDAvailable}
                />
            )}

            <PanelTabs id={'mdk4'} defaultTab={'attack'}>
                <Tab eventKey={'attack'} title={<TabTitle title={'Attack'} icon={'zap'} />}>
                    <ConditionalTabContent id={'mdk4'} eventKey={'attack'}>
                        <PanelStack>
                            <SettingsCard statusQuery={statusQuery} />
                            <OutputCard />
                        </PanelStack>
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'history'} title={<TabTitle title={'History'} icon={'file-text'} />}>
                    <ConditionalTabContent id={'mdk4'} eventKey={'history'}>
                        <HistoryCard />
                    </ConditionalTabContent>
                </Tab>
            </PanelTabs>
        </>
    );
};

export default Screen;
