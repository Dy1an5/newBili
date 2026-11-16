import { Text, type TextProps } from 'react-native';

import { colors } from '@/theme/colors';
import { typography, type TypographyRole } from '@/theme/typography';

type Props = TextProps & {
    variant?: TypographyRole;
    color?: string;
};

export default function AppText({
    variant = 'body',
    color = colors.primaryText,
    maxFontSizeMultiplier = 2,
    style,
    ...rest
}: Props) {
    return (
        <Text
            {...rest}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            style={[typography[variant], { color }, style]}
        />
    );
}
