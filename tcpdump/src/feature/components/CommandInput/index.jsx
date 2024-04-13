import InputField from '@src/components/Form/InputField';
import useGenerateCommand from '@module/feature/hooks/useGenerateCommand.js';

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
