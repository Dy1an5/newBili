import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type SelectionValue = string | number | boolean | null;

export type SelectorAnchor = {
    x: number;
    width: number;
};

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
    anchor?: SelectorAnchor | null;
    isLoading?: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onRetry?: () => void;
    onSelect: (value: Value) => void;
};

const SHEET_WIDTH = 160;

export default function SelectionSheet<Value extends SelectionValue>({
    visible,
    title,
    options,
    selectedValue,
    anchor = null,
    isLoading = false,
    errorMessage = null,
    onClose,
    onRetry,
    onSelect,
}: Props<Value>) {
    const bottomTabBarHeight = useBottomTabBarHeight();
    const { width: windowWidth } = useWindowDimensions();
    const [isMounted, setIsMounted] = useState(visible);
    const progress = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            progress.value = withSpring(1, {
                damping: 22,
                stiffness: 280,
                mass: 0.7,
            });
            return;
        }

        progress.value = withTiming(0, { duration: 130 }, (finished) => {
            if (finished) {
                runOnJS(setIsMounted)(false);
            }
        });
    }, [progress, visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [
            { translateY: (1 - progress.value) * 10 },
            { scale: 0.94 + progress.value * 0.06 },
        ],
    }));

    const anchorCenterX = anchor === null
        ? windowWidth / 2
        : anchor.x + anchor.width / 2;
    const left = Math.min(
        Math.max(anchorCenterX - SHEET_WIDTH / 2, spacing.md),
        Math.max(windowWidth - SHEET_WIDTH - spacing.md, spacing.md),
    );

    return (
        <Modal
            animationType='none'
            onRequestClose={onClose}
            transparent
            visible={isMounted}
        >
            <View style={styles.overlay}>
                <Pressable
                    accessibilityLabel='关闭选择框'
                    onPress={onClose}
                    style={StyleSheet.absoluteFill}
                />

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            left,
                            bottom: bottomTabBarHeight + spacing.xs,
                        },
                        animatedStyle,
                    ]}
                >
                    <Text numberOfLines={1} style={styles.title}>
                        {title}
                    </Text>

                    {errorMessage ? (
                        <View style={styles.errorBox}>
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
                        <View style={styles.loading}>
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
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },
    sheet: {
        position: 'absolute',
        width: SHEET_WIDTH,
        maxHeight: '60%',
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceBackground,
        elevation: 12,
        shadowColor: colors.pageBackground,
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.5,
        shadowRadius: 14,
        transformOrigin: 'bottom',
    },
    title: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xs,
        color: colors.mutedText,
        fontSize: 11,
        fontWeight: '600',
    },
    errorBox: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    errorText: {
        color: colors.mutedText,
        fontSize: 12,
        lineHeight: 17,
    },
    retryButton: {
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
    },
    retryText: {
        color: colors.accentForeground,
        fontSize: 12,
        fontWeight: '600',
    },
    loading: {
        minHeight: 72,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionScroll: {
        flexShrink: 1,
    },
    options: {
        paddingHorizontal: spacing.xs,
        paddingBottom: spacing.xs,
    },
    option: {
        minHeight: 38,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.sm,
    },
    selectedOption: {
        backgroundColor: colors.accentBackground,
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
    checkMark: {
        marginLeft: spacing.xs,
        color: colors.accentForeground,
        fontSize: 13,
        fontWeight: '700',
    },
    emptyText: {
        paddingVertical: spacing.md,
        color: colors.mutedText,
        fontSize: 12,
        textAlign: 'center',
    },
    pressed: {
        opacity: 0.75,
    },
});
