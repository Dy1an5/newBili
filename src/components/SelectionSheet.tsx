import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
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

import AppText from '@/components/AppText';
import { colors } from '@/theme/colors';
import { duration, spring, timingConfig } from '@/theme/motion';
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
            progress.value = withSpring(1, spring.sheet);
            return;
        }

        progress.value = withTiming(0, timingConfig(duration.quick), (finished) => {
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
                    <AppText
                        color={colors.mutedText}
                        numberOfLines={1}
                        style={styles.title}
                        variant='micro'
                    >
                        {title}
                    </AppText>

                    {errorMessage ? (
                        <View style={styles.errorBox}>
                            <AppText
                                color={colors.alertText}
                                numberOfLines={2}
                                variant='caption'
                            >
                                {errorMessage}
                            </AppText>

                            {onRetry ? (
                                <Pressable
                                    accessibilityRole='button'
                                    onPress={onRetry}
                                    style={({ pressed }) => [
                                        styles.retryButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <AppText color={colors.accentForeground} variant='label'>
                                        重试
                                    </AppText>
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
                                <AppText
                                    color={colors.mutedText}
                                    style={styles.emptyText}
                                    variant='caption'
                                >
                                    暂无可选项
                                </AppText>
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
                                        <AppText
                                            color={isSelected ? colors.accentForeground : colors.secondaryText}
                                            numberOfLines={1}
                                            style={styles.optionText}
                                            variant='titleSmall'
                                        >
                                            {option.label}
                                        </AppText>

                                        {isSelected ? (
                                            <AppText
                                                color={colors.accentForeground}
                                                style={styles.checkMark}
                                                variant='label'
                                            >
                                                ✓
                                            </AppText>
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
        elevation: 6,
        shadowColor: colors.shadow,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        transformOrigin: 'bottom',
    },
    title: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xs,
    },
    errorBox: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    retryButton: {
        minHeight: 48,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.xs,
        justifyContent: 'center',
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
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.sm,
    },
    selectedOption: {
        backgroundColor: colors.accentBackground,
    },
    optionText: {
        flexShrink: 1,
    },
    checkMark: {
        marginLeft: spacing.xs,
    },
    emptyText: {
        paddingVertical: spacing.md,
        textAlign: 'center',
    },
    pressed: {
        opacity: 0.75,
    },
});
