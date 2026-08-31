import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Props = {
    ascending: boolean;
    totalCount: number;
    onSortChange: (ascending: boolean) => void;
};

const SORT_OPTIONS: Array<{
    ascending: boolean;
    label: string;
}> = [
    { ascending: false, label: '最近添加' },
    { ascending: true, label: '最早添加' },
];

export default function WatchLaterToolbar({
    ascending,
    totalCount,
    onSortChange,
}: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.toolbar}>
                <Text numberOfLines={1} style={styles.title}>
                    稍后再看({totalCount})
                </Text>

                <View style={styles.sortControl}>
                    {SORT_OPTIONS.map((option) => {
                        const isSelected = option.ascending === ascending;

                        return (
                            <Pressable
                                accessibilityLabel={`${option.label}优先`}
                                accessibilityRole='button'
                                accessibilityState={{ selected: isSelected }}
                                key={option.label}
                                onPress={() => onSortChange(option.ascending)}
                                style={({ pressed }) => [
                                    styles.sortOption,
                                    isSelected && styles.selectedSortOption,
                                    pressed && styles.pressedOption,
                                ]}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.sortText,
                                        isSelected && styles.selectedSortText,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.pageBackground,
        borderBottomColor: colors.surfaceBorder,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    toolbar: {
        minHeight: 34,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    title: {
        flexShrink: 1,
        marginRight: spacing.md,
        color: colors.primaryText,
        fontSize: 16,
        fontWeight: '600',
    },
    sortControl: {
        minHeight: 34,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceBackground,
        overflow: 'hidden',
    },
    sortOption: {
        minHeight: 32,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.full,
    },
    selectedSortOption: {
        backgroundColor: colors.accentBackground,
    },
    pressedOption: {
        opacity: 0.75,
    },
    sortText: {
        color: colors.secondaryText,
        fontSize: 13,
        fontWeight: '600',
    },
    selectedSortText: {
        color: colors.accentForeground,
    },
});
