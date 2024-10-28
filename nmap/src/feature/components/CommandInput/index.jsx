/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import InputField from '@src/components/Form/InputField';
import useGenerateCommand from '@module/feature/hooks/generateCommand.js';

const CommandInput = ({ ...rest}) => {
    useGenerateCommand();

    return (
        <InputField
            name={'command'}
            {...rest}
        />
    );
};

export default CommandInput;