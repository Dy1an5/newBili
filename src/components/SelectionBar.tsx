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

type SelectionValue = string | number | null;

export type SelectionOption<Value extends SelectionValue = SelectionValue> = {
    value: Value;
    label: string;
    accessibilityLabel: string;
};

type Props<Value extends SelectionValue> = {
    options: SelectionOption<Value>[];
    selectedValue: Value;
    isLoading: boolean;
    errorMessage: string | null;
    onSelect: (value: Value) => void;
    onRetry: () => void;
};

export default function SelectionBar<Value extends SelectionValue>({
    options,
    selectedValue,
    isLoading,
    errorMessage,
    onSelect,
    onRetry,
}: Props<Value>) {
    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.options}
                horizontal
                showsHorizontalScrollIndicator={false}
            >
                {options.map((option) => {
                    const isSelected = option.value === selectedValue;

                    return (
                        <Pressable
                            accessibilityLabel={option.accessibilityLabel}
                            accessibilityRole='button'
                            accessibilityState={{ selected: isSelected }}
                            key={`${typeof option.value}:${String(option.value)}`}
                            onPress={() => onSelect(option.value)}
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
                        </Pressable>
                    );
                })}

                {isLoading ? (
                    <ActivityIndicator
                        color={colors.accentForeground}
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
        backgroundColor: colors.pageBackground,
        borderBottomColor: colors.surfaceBorder,
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
        borderColor: colors.surfaceBorder,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceBackground,
    },
    selectedOption: {
        borderColor: colors.accentForeground,
        backgroundColor: colors.accentBackground,
    },
    pressedOption: {
        opacity: 0.75,
    },
    optionText: {
        flexShrink: 1,
        color: colors.secondaryText,
        fontSize: 14,
        fontWeight: '600',
    },
    selectedOptionText: {
        color: colors.accentForeground,
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
        color: colors.mutedText,
        fontSize: 12,
    },
    retryButton: {
        marginLeft: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    retryText: {
        color: colors.accentForeground,
        fontSize: 13,
        fontWeight: '600',
    },
});
