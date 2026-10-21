import { Pressable, StyleSheet, Text } from 'react-native';

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
            <Text numberOfLines={1} style={styles.label}>
                {label}
            </Text>
            <Text style={styles.chevron}>▾</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        borderBottomColor: colors.surfaceBorder,
        borderBottomWidth: StyleSheet.hairlineWidth,
        backgroundColor: colors.pageBackground,
    },
    label: {
        flexShrink: 1,
        color: colors.primaryText,
        fontSize: 16,
        fontWeight: '600',
    },
    chevron: {
        marginLeft: spacing.xs,
        color: colors.mutedText,
        fontSize: 12,
    },
    pressed: {
        opacity: 0.75,
    },
});
