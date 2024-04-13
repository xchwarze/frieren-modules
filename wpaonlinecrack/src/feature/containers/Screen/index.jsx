/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import Tab from 'react-bootstrap/Tab';

import DependenciesAlert from '@src/components/DependenciesAlert';
import PanelTabs from '@src/components/Tabs/PanelTabs';
import TabTitle from '@src/components/Tabs/TabTitle';
import ConditionalTabContent from '@src/components/Tabs/ConditionalTabContent';
import { WPA_ONLINE_CRACK_CHECK_MODULE_DEPENDENCIES } from '@module/feature/helpers/queryKeys.js';
import useModuleStatus from '@module/feature/hooks/useCheckModuleDependencies.js';
import CapturesCard from '@module/feature/components/CapturesCard';
import SettingsCard from '@module/feature/components/SettingsCard';

const Screen = () => {
    const statusQuery = useModuleStatus();
    const { hasDependencies, message, internalAvailable, SDAvailable } = statusQuery?.data ?? {};

    return (
        <>
            {typeof hasDependencies === 'boolean' && hasDependencies === false && (
                <DependenciesAlert
                    module={'wpaonlinecrack'}
                    dependenciesQueryKey={WPA_ONLINE_CRACK_CHECK_MODULE_DEPENDENCIES}
                    show={!hasDependencies}
                    message={message}
                    internalAvailable={internalAvailable}
                    SDAvailable={SDAvailable}
                />
            )}

            <PanelTabs id={'wpaonlinecrack'} defaultTab={'captures'}>
                <Tab eventKey={'captures'} title={<TabTitle title={'Captures'} icon={'file'} />}>
                    <ConditionalTabContent id={'wpaonlinecrack'} eventKey={'captures'}>
                        <CapturesCard />
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'settings'} title={<TabTitle title={'Settings'} icon={'settings'} />}>
                    <ConditionalTabContent id={'wpaonlinecrack'} eventKey={'settings'}>
                        <SettingsCard />
                    </ConditionalTabContent>
                </Tab>
            </PanelTabs>
        </>
    );
};

export default Screen;
