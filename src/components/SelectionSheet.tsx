import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type SelectionValue = string | number | boolean | null;

export type SelectionOption<Value extends SelectionValue = SelectionValue> = {
    value: Value;
    label: string;
    accessibilityLabel: string;
};

type Props<Value extends SelectionValue> = {
    visible: boolean;
    title: string;
    options: SelectionOption<Value>[];
    selectedValue: Value;
    isLoading?: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onRetry?: () => void;
    onSelect: (value: Value) => void;
};

export default function SelectionSheet<Value extends SelectionValue>({
    visible,
    title,
    options,
    selectedValue,
    isLoading = false,
    errorMessage = null,
    onClose,
    onRetry,
    onSelect,
}: Props<Value>) {
    const safeAreaInsets = useSafeAreaInsets();

    return (
        <Modal
            animationType='fade'
            onRequestClose={onClose}
            transparent
            visible={visible}
        >
            <View style={styles.overlay}>
                <Pressable
                    accessibilityLabel='关闭选择框'
                    onPress={onClose}
                    style={StyleSheet.absoluteFill}
                />

                <View
                    style={[
                        styles.sheet,
                        {
                            paddingBottom: Math.max(
                                safeAreaInsets.bottom,
                                spacing.md,
                            ),
                        },
                    ]}
                >
                    <View style={styles.header}>
                        <Text numberOfLines={1} style={styles.title}>
                            {title}
                        </Text>

                        <Pressable
                            accessibilityRole='button'
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.closeButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text style={styles.closeText}>关闭</Text>
                        </Pressable>
                    </View>

                    {errorMessage ? (
                        <View style={styles.errorRow}>
                            <Text numberOfLines={2} style={styles.errorText}>
                                {errorMessage}
                            </Text>

                            {onRetry ? (
                                <Pressable
                                    accessibilityRole='button'
                                    onPress={onRetry}
                                    style={({ pressed }) => [
                                        styles.retryButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.retryText}>重试</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : null}

                    {isLoading ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator
                                color={colors.accentForeground}
                                size='small'
                            />
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.options}
                            style={styles.optionScroll}
                        >
                            {options.length === 0 && !errorMessage ? (
                                <Text style={styles.emptyText}>暂无可选项</Text>
                            ) : null}

                            {options.map((option) => {
                                const isSelected = option.value === selectedValue;

                                return (
                                    <Pressable
                                        accessibilityLabel={option.accessibilityLabel}
                                        accessibilityRole='radio'
                                        accessibilityState={{ selected: isSelected }}
                                        key={`${typeof option.value}:${String(option.value)}`}
                                        onPress={() => {
                                            onSelect(option.value);
                                            onClose();
                                        }}
                                        style={({ pressed }) => [
                                            styles.option,
                                            isSelected && styles.selectedOption,
                                            pressed && styles.pressed,
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

                                        {isSelected ? (
                                            <Text style={styles.checkMark}>✓</Text>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: colors.modalBackdrop,
    },
    sheet: {
        maxHeight: '70%',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderColor: colors.surfaceBorder,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        backgroundColor: colors.surfaceBackground,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    title: {
        flex: 1,
        color: colors.primaryText,
        fontSize: 17,
        fontWeight: '700',
    },
    closeButton: {
        minHeight: 40,
        justifyContent: 'center',
        paddingLeft: spacing.md,
    },
    closeText: {
        color: colors.secondaryText,
        fontSize: 14,
        fontWeight: '600',
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
    },
    errorText: {
        flex: 1,
        color: colors.mutedText,
        fontSize: 13,
    },
    retryButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    retryText: {
        color: colors.accentForeground,
        fontSize: 13,
        fontWeight: '600',
    },
    loadingRow: {
        minHeight: 96,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionScroll: {
        marginTop: spacing.sm,
    },
    options: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    option: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
        paddingHorizontal: spacing.md,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.md,
        backgroundColor: colors.pageBackground,
    },
    selectedOption: {
        borderColor: colors.accentForeground,
        backgroundColor: colors.accentBackground,
    },
    optionText: {
        flexShrink: 1,
        color: colors.secondaryText,
        fontSize: 15,
        fontWeight: '600',
    },
    selectedOptionText: {
        color: colors.accentForeground,
    },
    checkMark: {
        marginLeft: spacing.sm,
        color: colors.accentForeground,
        fontSize: 15,
        fontWeight: '700',
    },
    emptyText: {
        paddingVertical: spacing.lg,
        color: colors.mutedText,
        fontSize: 13,
        textAlign: 'center',
    },
    pressed: {
        opacity: 0.75,
    },
});
