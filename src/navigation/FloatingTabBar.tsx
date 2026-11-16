import {
    BottomTabBarHeightCallbackContext,
    type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type RefObject, useContext, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import AppText from '@/components/AppText';
import type { SelectorAnchor } from '@/components/SelectionSheet';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type TabIconName = 'dynamic' | 'favorites' | 'watchLater';
type Props = BottomTabBarProps & {
    blurTarget: RefObject<View | null>;
    onSearchPress: () => void;
    onTabSelectorRequest: (
        routeName: string,
        anchor: SelectorAnchor | null,
    ) => void;
};

const TAB_BAR_HEIGHT = 64;
const TAB_ITEM_MIN_HEIGHT = 56;
const SEARCH_BUTTON_SIZE = TAB_BAR_HEIGHT;

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

export default function FloatingTabBar({
    descriptors,
    insets,
    navigation,
    state,
    blurTarget,
    onSearchPress,
    onTabSelectorRequest,
}: Props) {
    const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
    const tabItemRefs = useRef<Record<string, View | null>>({});

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
                        intensity={36}
                        style={styles.tabGroupGlass}
                        tint='systemUltraThinMaterialLight'
                    >
                        {state.routes.map((route, index) => {
                            const item = TAB_ITEMS[route.name];

                            if (!item) {
                                return null;
                            }

                            const isFocused = state.index === index;
                            const options = descriptors[route.key].options;
                            const color = isFocused
                                ? colors.accentForeground
                                : colors.secondaryText;

                            const handlePress = () => {
                                const event = navigation.emit({
                                    type: 'tabPress',
                                    target: route.key,
                                    canPreventDefault: true,
                                });

                                if (!isFocused && !event.defaultPrevented) {
                                    navigation.navigate(route.name);
                                }
                            };

                            const handleLongPress = () => {
                                if (!isFocused) {
                                    navigation.navigate(route.name);
                                    return;
                                }

                                const tabItem = tabItemRefs.current[route.key];

                                if (!tabItem) {
                                    onTabSelectorRequest(route.name, null);
                                    return;
                                }

                                tabItem.measureInWindow((x, _y, width) => {
                                    onTabSelectorRequest(route.name, {
                                        x,
                                        width,
                                    });
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
                                    ref={(node) => {
                                        tabItemRefs.current[route.key] = node;
                                    }}
                                    style={({ pressed }) => [
                                        styles.tabItem,
                                        isFocused && styles.tabItemSelected,
                                        pressed && styles.pressed,
                                    ]}
                                    testID={options.tabBarButtonTestID}
                                >
                                    <TabIcon color={color} name={item.icon} />
                                    <AppText
                                        color={color}
                                        maxFontSizeMultiplier={1.5}
                                        numberOfLines={1}
                                        variant='micro'
                                    >
                                        {item.label}
                                    </AppText>
                                </Pressable>
                            );
                        })}
                    </BlurView>
                </View>

                <View style={styles.searchButtonShadow}>
                    <BlurView
                        blurMethod='dimezisBlurViewSdk31Plus'
                        blurReductionFactor={3}
                        blurTarget={blurTarget}
                        intensity={36}
                        style={styles.searchButtonGlass}
                        tint='systemUltraThinMaterialLight'
                    >
                        <Pressable
                            accessibilityLabel='搜索'
                            accessibilityRole='button'
                            onPress={onSearchPress}
                            style={({ pressed }) => [
                                styles.searchButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <MaterialIcons
                                color={colors.accentForeground}
                                name='search'
                                size={24}
                            />
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
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.tabBarTransparent,
    },
    row: {
        minHeight: TAB_BAR_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    tabGroupShadow: {
        flex: 1,
        minHeight: TAB_BAR_HEIGHT,
        borderRadius: radius.full,
        backgroundColor: colors.tabBarShadowBackground,
        elevation: 10,
        shadowColor: colors.shadow,
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.12,
        shadowRadius: 12,
    },
    tabGroupGlass: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xs,
        borderWidth: 1,
        borderColor: colors.tabBarBorder,
        borderRadius: radius.full,
        overflow: 'hidden',
        backgroundColor: colors.tabBarBackground,
    },
    tabItem: {
        flex: 1,
        minWidth: 0,
        minHeight: TAB_ITEM_MIN_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        borderRadius: radius.full,
    },
    tabItemSelected: {
        borderWidth: 1,
        borderColor: colors.tabBarSelectedBorder,
        backgroundColor: colors.tabBarSelectedBackground,
    },
    pressed: {
        opacity: 0.7,
    },
    searchButtonShadow: {
        width: SEARCH_BUTTON_SIZE,
        height: SEARCH_BUTTON_SIZE,
        borderRadius: radius.full,
        backgroundColor: colors.tabBarShadowBackground,
        elevation: 10,
        shadowColor: colors.shadow,
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.12,
        shadowRadius: 12,
    },
    searchButtonGlass: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.tabBarBorder,
        borderRadius: radius.full,
        overflow: 'hidden',
        backgroundColor: colors.tabBarBackground,
    },
    searchButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dynamicIcon: {
        width: 20,
        height: 16,
        justifyContent: 'space-between',
    },
    dynamicIconBar: {
        width: '100%',
        height: 3,
        borderRadius: radius.full,
    },
    favoriteIcon: {
        width: 16,
        height: 18,
        borderWidth: 2,
        borderRadius: radius.xs,
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
        borderLeftColor: colors.tabBarTransparent,
        borderRightColor: colors.tabBarTransparent,
        backgroundColor: colors.pageBackground,
        transform: [{ rotate: '180deg' }],
    },
    watchLaterIcon: {
        width: 19,
        height: 19,
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
});
