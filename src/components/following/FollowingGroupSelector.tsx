import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import type { FollowingGroup } from '@/types/following';

type Props = {
    groups: FollowingGroup[];
    selectedTagId: number | null;
    isLoading: boolean;
    errorMessage: string | null;
    loadingMemberTagId: number | null;
    onSelect: (tagId: number | null) => void;
    onRetry: () => void;
};

type GroupOption = {
    tagId: number | null;
    label: string;
    accessibilityLabel: string;
};

export default function FollowingGroupSelector({
    groups,
    selectedTagId,
    isLoading,
    errorMessage,
    loadingMemberTagId,
    onSelect,
    onRetry,
}: Props) {
    const options: GroupOption[] = [
        {
            tagId: null,
            label: '全部',
            accessibilityLabel: '全部关注动态',
        },
        ...groups.map((group) => ({
            tagId: group.tagId,
            label: `${group.name}(${group.memberCount})`,
            accessibilityLabel: `${group.name},${group.memberCount}位UP主`,
        })),
    ];

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.options}
                horizontal
                showsHorizontalScrollIndicator={false}
            >
                {options.map((option) => {
                    const isSelected = option.tagId === selectedTagId;
                    const isMemberLoading =
                        option.tagId !== null && option.tagId === loadingMemberTagId;

                    return (
                        <Pressable
                            accessibilityLabel={option.accessibilityLabel}
                            accessibilityRole='button'
                            accessibilityState={{ selected: isSelected }}
                            key={option.tagId ?? 'all'}
                            onPress={() => onSelect(option.tagId)}
                            style={({ pressed }) => [
                                styles.option,
                                isSelected && styles.selectedOption,
                                pressed && styles.pressedOption,
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.optionText,
                                    isSelected && styles.selectedOptionText,
                                ]}
                            >
                                {option.label}
                            </Text>

                            {isMemberLoading ? (
                                <ActivityIndicator
                                    color={colors.primary}
                                    size='small'
                                    style={styles.optionLoading}
                                />
                            ) : null}
                        </Pressable>
                    );
                })}

                {isLoading ? (
                    <ActivityIndicator
                        color={colors.primary}
                        size='small'
                        style={styles.groupsLoading}
                    />
                ) : null}
            </ScrollView>

            {errorMessage ? (
                <View style={styles.errorContainer}>
                    <Text numberOfLines={2} style={styles.errorText}>
                        {errorMessage}
                    </Text>
                    <Pressable onPress={onRetry} style={styles.retryButton}>
                        <Text style={styles.retryText}>重试</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.background,
        borderBottomColor: colors.divider,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    options: {
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    option: {
        minHeight: 34,
        maxWidth: 180,
        marginRight: spacing.sm,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: colors.outline,
        borderWidth: 1,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceRaised,
    },
    selectedOption: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    pressedOption: {
        opacity: 0.75,
    },
    optionText: {
        flexShrink: 1,
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    selectedOptionText: {
        color: colors.primary,
    },
    optionLoading: {
        marginLeft: spacing.xs,
    },
    groupsLoading: {
        marginHorizontal: spacing.sm,
    },
    errorContainer: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {
        flex: 1,
        color: colors.textMuted,
        fontSize: 12,
    },
    retryButton: {
        marginLeft: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    retryText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '600',
    },
});
