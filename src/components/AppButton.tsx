import {
    Pressable,
    StyleSheet,
    Text,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

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
            <Text style={styles.text}>{title}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        minHeight: 40,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.accentForeground,
        borderRadius: radius.full,
        backgroundColor: colors.accentBackground,
    },
    disabled: {
        opacity: 0.4,
    },
    pressed: {
        opacity: 0.75,
    },
    text: {
        color: colors.accentForeground,
        fontSize: 14,
        fontWeight: '600',
    },
});
