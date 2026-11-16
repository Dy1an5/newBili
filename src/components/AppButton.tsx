import {
    Pressable,
    StyleSheet,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import AppText from '@/components/AppText';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Props = Omit<PressableProps, 'children' | 'disabled' | 'style'> & {
    title: string;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
};

export default function AppButton({
    title,
    disabled = false,
    style,
    accessibilityState,
    ...pressableProps
}: Props) {
    return (
        <Pressable
            {...pressableProps}
            accessibilityRole='button'
            accessibilityState={{
                ...accessibilityState,
                disabled,
            }}
            disabled={disabled}
            style={({ pressed }) => [
                style,
                styles.button,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
            ]}
        >
            <AppText color={colors.accentSolidText} variant='label'>
                {title}
            </AppText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        minHeight: 48,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.accentForeground,
        borderRadius: radius.full,
        backgroundColor: colors.accentForeground,
    },
    disabled: {
        opacity: 0.38,
    },
    pressed: {
        opacity: 0.75,
    },
});
