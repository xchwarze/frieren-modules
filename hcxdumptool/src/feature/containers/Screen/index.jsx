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
import { HCXDUMPTOOL_GET_MODULE_STATUS } from '@module/feature/helpers/queryKeys.js';
import useModuleStatus from '@module/feature/hooks/useModuleStatus.js';
import SettingsCard from '@module/feature/components/SettingsCard';
import OutputCard from '@module/feature/components/OutputCard';
import InfoCard from '@module/feature/components/InfoCard';
import HistoryCard from '@module/feature/components/HistoryCard';

const Screen = () => {
    const statusQuery = useModuleStatus();
    const { hasDependencies, message, internalAvailable, SDAvailable } = statusQuery?.data ?? {};

    return (
        <>
            {typeof hasDependencies === 'boolean' && hasDependencies === false && (
                <DependenciesAlert
                    module={'hcxdumptool'}
                    dependenciesQueryKey={HCXDUMPTOOL_GET_MODULE_STATUS}
                    show={!hasDependencies}
                    message={message}
                    internalAvailable={internalAvailable}
                    SDAvailable={SDAvailable}
                />
            )}

            <PanelTabs id={'hcxdumptool'} defaultTab={'capture'}>
                <Tab eventKey={'capture'} title={<TabTitle title={'Capture'} icon={'activity'} />}>
                    <ConditionalTabContent id={'hcxdumptool'} eventKey={'capture'}>
                        <PanelStack>
                            <SettingsCard statusQuery={statusQuery} />
                            <OutputCard />
                            <InfoCard statusQuery={statusQuery} />
                        </PanelStack>
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'history'} title={<TabTitle title={'History'} icon={'file-text'} />}>
                    <ConditionalTabContent id={'hcxdumptool'} eventKey={'history'}>
                        <HistoryCard />
                    </ConditionalTabContent>
                </Tab>
            </PanelTabs>
        </>
    );
};

export default Screen;
