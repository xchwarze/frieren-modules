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
