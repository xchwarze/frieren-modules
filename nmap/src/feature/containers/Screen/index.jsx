/*
 * Project: Frieren Nmap Module
 * Based on Frieren Framework Template Module and other Frieren modules
 * Original Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * Modifications and new code by m5kro <m5kro@proton.me>, 2024
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 *
 * Original code from Frieren Framework is distributed under the terms of the
 * GNU Lesser General Public License (LGPL) version 3 or later. You should have received
 * a copy of the LGPL-3.0-or-later along with this project. If not, see <https://www.gnu.org/licenses>.
 * 
 * Modifications: Modified to use Nmap components.
 */

import Tab from 'react-bootstrap/Tab';

import DependenciesAlert from '@src/components/DependenciesAlert';
import PanelTabs from '@src/components/Tabs/PanelTabs';
import TabTitle from '@src/components/Tabs/TabTitle';
import ConditionalTabContent from '@src/components/Tabs/ConditionalTabContent';
import { NMAP_GET_STATUS } from '@module/feature/helpers/queryKeys.js';
import useGetStatus from '@module/feature/hooks/getStatus.js';
import OptionsCard from '@module/feature/components/OptionsCard';
import OutputCard from '@module/feature/components/OutputCard';
import HistoryCard from '@module/feature/components/HistoryCard';

const Screen = () => {
    const statusQuery = useGetStatus();
    const { hasDependencies, message, internalAvailable, SDAvailable } = statusQuery?.data ?? {};

    return (
        <>
            {typeof hasDependencies === 'boolean' && hasDependencies === false && (
                <DependenciesAlert
                    module={'nmap'}
                    dependenciesQueryKey={NMAP_GET_STATUS}
                    show={!hasDependencies}
                    message={message}
                    internalAvailable={internalAvailable}
                    SDAvailable={SDAvailable}
                />
            )}

            <PanelTabs id={'nmap'} defaultTab={'scan'}>
                <Tab eventKey={'scan'} title={<TabTitle title={'Scan'} icon={'search'} />}>
                    <ConditionalTabContent id={'nmap'} eventKey={'scan'}>
                        <OptionsCard statusQuery={statusQuery} />
                        <OutputCard />
                    </ConditionalTabContent>
                </Tab>
                <Tab eventKey={'history'} title={<TabTitle title={'History'} icon={'file-text'} />}>
                    <ConditionalTabContent id={'nmap'} eventKey={'history'}>
                        <HistoryCard />
                    </ConditionalTabContent>
                </Tab>
            </PanelTabs>
        </>
    );
};

export default Screen;
