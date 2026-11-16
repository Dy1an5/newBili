import { Pressable, StyleSheet } from 'react-native';

import AppText from '@/components/AppText';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type Props = {
    label: string;
    accessibilityLabel: string;
    onPress: () => void;
};

export default function SelectionHeader({
    label,
    accessibilityLabel,
    onPress,
}: Props) {
    return (
        <Pressable
            accessibilityLabel={accessibilityLabel}
            accessibilityRole='button'
            onPress={onPress}
            style={({ pressed }) => [
                styles.container,
                pressed && styles.pressed,
            ]}
        >
            <AppText numberOfLines={1} style={styles.label} variant='heading'>
                {label}
            </AppText>
            <AppText color={colors.mutedText} style={styles.chevron} variant='caption'>
                ▾
            </AppText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        borderBottomColor: colors.surfaceBorder,
        borderBottomWidth: StyleSheet.hairlineWidth,
        backgroundColor: colors.pageBackground,
    },
    label: {
        flexShrink: 1,
    },
    chevron: {
        marginLeft: spacing.xs,
    },
    pressed: {
        opacity: 0.75,
    },
});
