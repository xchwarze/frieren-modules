/*
 * Project: Frieren Framework
 * Copyright (C) 2023 DSR! <xchwarze@gmail.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * More info at: https://github.com/xchwarze/frieren
 */
import InputField from '@src/components/Form/InputField';
import useGenerateFilter from '@module/feature/hooks/useGenerateFilter.js';

const FilterInput = ({ ...rest}) => {
    useGenerateFilter();

    return (
        <InputField
            name={'filter'}
            {...rest}
        />
    );
};

export default FilterInput;
