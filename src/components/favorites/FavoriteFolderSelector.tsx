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
import type { FavoriteFolder } from '@/types/favorites';

type Props = {
    folders: FavoriteFolder[];
    selectedFolderId: number | null;
    isLoading: boolean;
    errorMessage: string | null;
    onSelect: (folder: FavoriteFolder) => void;
    onRetry: () => void;
};

export default function FavoriteFolderSelector({
    folders,
    selectedFolderId,
    isLoading,
    errorMessage,
    onSelect,
    onRetry,
}: Props) {
    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.options}
                horizontal
                showsHorizontalScrollIndicator={false}
            >
                {folders.map((folder) => {
                    const isSelected = folder.id === selectedFolderId;

                    return (
                        <Pressable
                            accessibilityLabel={`${folder.title},${folder.mediaCount}个视频`}
                            accessibilityRole='button'
                            accessibilityState={{ selected: isSelected }}
                            key={folder.id}
                            onPress={() => onSelect(folder)}
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
                                {folder.title}({folder.mediaCount})
                            </Text>
                        </Pressable>
                    );
                })}

                {isLoading ? (
                    <ActivityIndicator
                        color={colors.primary}
                        size='small'
                        style={styles.loadingIndicator}
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
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.outline,
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
    loadingIndicator: {
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
