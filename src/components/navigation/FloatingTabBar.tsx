import {
    BottomTabBarHeightCallbackContext,
    type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { type RefObject, useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type TabIconName = 'dynamic' | 'favorites' | 'watchLater';
type Props = BottomTabBarProps & {
    blurTarget: RefObject<View | null>;
};

const TAB_ITEMS: Record<string, { icon: TabIconName; label: string }> = {
    HomeTab: {
        icon: 'dynamic',
        label: '动态',
    },
    FavoritesTab: {
        icon: 'favorites',
        label: '收藏',
    },
    WatchLaterTab: {
        icon: 'watchLater',
        label: '稍后再看',
    },
};

function TabIcon({
    color,
    name,
}: {
    color: string;
    name: TabIconName;
}) {
    if (name === 'dynamic') {
        return (
            <View style={styles.dynamicIcon}>
                <View style={[styles.dynamicIconBar, { backgroundColor: color }]} />
                <View style={[styles.dynamicIconBar, { backgroundColor: color }]} />
                <View style={[styles.dynamicIconBar, { backgroundColor: color }]} />
            </View>
        );
    }

    if (name === 'favorites') {
        return (
            <View style={[styles.favoriteIcon, { borderColor: color }]}>
                <View style={[styles.favoriteIconFold, { borderTopColor: color }]} />
            </View>
        );
    }

    return (
        <View style={[styles.watchLaterIcon, { borderColor: color }]}>
            <View style={[styles.watchLaterHourHand, { backgroundColor: color }]} />
            <View style={[styles.watchLaterMinuteHand, { backgroundColor: color }]} />
        </View>
    );
}

function PlaceholderIcon() {
    return (
        <View style={styles.placeholderIcon}>
            <View style={styles.placeholderIconCircle} />
            <View style={styles.placeholderIconHandle} />
        </View>
    );
}

export default function FloatingTabBar({
    descriptors,
    insets,
    navigation,
    state,
    blurTarget,
}: Props) {
    const onHeightChange = useContext(BottomTabBarHeightCallbackContext);

    return (
        <View
            onLayout={(event) => {
                onHeightChange?.(event.nativeEvent.layout.height);
            }}
            pointerEvents='box-none'
            style={[
                styles.safeArea,
                {
                    paddingBottom: Math.max(insets.bottom, spacing.sm),
                },
            ]}
        >
            <View style={styles.row}>
                <View style={styles.tabGroupShadow}>
                    <BlurView
                        blurMethod='dimezisBlurViewSdk31Plus'
                        blurReductionFactor={3}
                        blurTarget={blurTarget}
                        intensity={68}
                        style={styles.tabGroupGlass}
                        tint='systemThinMaterialLight'
                    >
                        <View pointerEvents='none' style={styles.glassHighlight} />
                        {state.routes.map((route, index) => {
                            const item = TAB_ITEMS[route.name];

                            if (!item) {
                                return null;
                            }

                            const isFocused = state.index === index;
                            const options = descriptors[route.key].options;
                            const color = isFocused
                                ? colors.primary
                                : colors.textSecondary;

                            const handlePress = () => {
                                const event = navigation.emit({
                                    type: 'tabPress',
                                    target: route.key,
                                    canPreventDefault: true,
                                });

                                if (!isFocused && !event.defaultPrevented) {
                                    navigation.navigate(route.name, route.params);
                                }
                            };

                            const handleLongPress = () => {
                                navigation.emit({
                                    type: 'tabLongPress',
                                    target: route.key,
                                });
                            };

                            return (
                                <Pressable
                                    accessibilityLabel={options.tabBarAccessibilityLabel}
                                    accessibilityRole='tab'
                                    accessibilityState={{ selected: isFocused }}
                                    key={route.key}
                                    onLongPress={handleLongPress}
                                    onPress={handlePress}
                                    style={({ pressed }) => [
                                        styles.tabItem,
                                        isFocused && styles.tabItemSelected,
                                        pressed && styles.pressed,
                                    ]}
                                    testID={options.tabBarButtonTestID}
                                >
                                    <TabIcon color={color} name={item.icon} />
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.tabLabel,
                                            { color },
                                            isFocused && styles.tabLabelSelected,
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </BlurView>
                </View>

                <View style={styles.placeholderShadow}>
                    <BlurView
                        blurMethod='dimezisBlurViewSdk31Plus'
                        blurReductionFactor={3}
                        blurTarget={blurTarget}
                        intensity={68}
                        style={styles.placeholderGlass}
                        tint='systemThinMaterialLight'
                    >
                        <View pointerEvents='none' style={styles.glassHighlight} />
                        <Pressable
                            accessibilityLabel='预留功能'
                            accessibilityRole='button'
                            accessibilityState={{ disabled: true }}
                            disabled
                            style={styles.placeholderButton}
                        >
                            <PlaceholderIcon />
                        </Pressable>
                    </BlurView>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        left: 0,
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: 'transparent',
    },
    row: {
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    tabGroupShadow: {
        flex: 1,
        height: 64,
        borderRadius: radius.full,
        backgroundColor: 'rgba(255, 255, 255, 0.42)',
        elevation: 10,
        shadowColor: colors.shadow,
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.16,
        shadowRadius: 12,
    },
    tabGroupGlass: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xs,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.88)',
        borderRadius: radius.full,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.28)',
    },
    glassHighlight: {
        position: 'absolute',
        top: 1,
        right: spacing.lg,
        left: spacing.lg,
        height: 1,
        borderRadius: radius.full,
        backgroundColor: 'rgba(255, 255, 255, 0.26)',
    },
    tabItem: {
        flex: 1,
        minWidth: 0,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        borderRadius: radius.full,
    },
    tabItemSelected: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.82)',
        backgroundColor: 'rgba(213, 245, 255, 0.76)',
    },
    pressed: {
        opacity: 0.7,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    tabLabelSelected: {
        fontWeight: '700',
    },
    placeholderShadow: {
        width: 64,
        height: 64,
        borderRadius: radius.full,
        backgroundColor: 'rgba(255, 255, 255, 0.42)',
        elevation: 10,
        shadowColor: colors.shadow,
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.16,
        shadowRadius: 12,
    },
    placeholderGlass: {
        flex: 1,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.88)',
        borderRadius: radius.full,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.28)',
    },
    placeholderButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dynamicIcon: {
        width: 22,
        height: 18,
        justifyContent: 'space-between',
    },
    dynamicIconBar: {
        width: '100%',
        height: 3,
        borderRadius: radius.full,
    },
    favoriteIcon: {
        width: 17,
        height: 20,
        borderWidth: 2,
        borderRadius: 3,
    },
    favoriteIconFold: {
        position: 'absolute',
        left: 3,
        bottom: -2,
        width: 7,
        height: 7,
        borderLeftWidth: 4,
        borderRightWidth: 4,
        borderTopWidth: 4,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        backgroundColor: colors.surface,
        transform: [{ rotate: '180deg' }],
    },
    watchLaterIcon: {
        width: 21,
        height: 21,
        borderWidth: 2,
        borderRadius: radius.full,
    },
    watchLaterHourHand: {
        position: 'absolute',
        left: 8,
        top: 4,
        width: 2,
        height: 6,
        borderRadius: radius.full,
    },
    watchLaterMinuteHand: {
        position: 'absolute',
        left: 9,
        top: 9,
        width: 6,
        height: 2,
        borderRadius: radius.full,
        transform: [{ rotate: '30deg' }],
        transformOrigin: 'left center',
    },
    placeholderIcon: {
        width: 28,
        height: 28,
    },
    placeholderIconCircle: {
        width: 21,
        height: 21,
        borderWidth: 3,
        borderColor: colors.textSecondary,
        borderRadius: radius.full,
    },
    placeholderIconHandle: {
        position: 'absolute',
        right: 1,
        bottom: 3,
        width: 10,
        height: 3,
        borderRadius: radius.full,
        backgroundColor: colors.textSecondary,
        transform: [{ rotate: '45deg' }],
    },
});
