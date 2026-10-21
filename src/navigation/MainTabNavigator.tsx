import {
    createBottomTabNavigator,
    type BottomTabNavigationProp,
    type BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurTargetView } from 'expo-blur';
import {
    createContext,
    type RefObject,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { StyleSheet, type View } from 'react-native';

import { useAgentSession } from '@/agent/session/AgentSessionContext';
import ApiKeyInputModal from '@/agent/ui/ApiKeyInputModal';
import type { SelectorAnchor } from '@/components/SelectionSheet';
import FloatingTabBar from '@/navigation/FloatingTabBar';
import FavoriteFoldersPage from '@/page/favorites/FavoriteFoldersPage';
import FollowedCollectionDetailPage from '@/page/favorites/FollowedCollectionDetailPage';
import type { FollowedCollection } from '@/page/favorites/fetchFollowedCollections';
import DynamicDetailPage from '@/page/following/DynamicDetailPage';
import FollowingPage from '@/page/following/FollowingPage';
import type { FollowingPicture } from '@/page/following/fetchFollowing';
import VideoDetailPage from '@/page/video/VideoDetailPage';
import type { VideoPlaybackTarget } from '@/page/video/videoPlaybackTarget';
import WatchLaterPage from '@/page/watchLater/WatchLaterPage';

type HomeStackParamList = {
    Home: undefined;
    DynamicDetail: {
        picture: FollowingPicture;
    };
    VideoDetail: {
        target: VideoPlaybackTarget;
    };
};

type MainTabParamList = {
    HomeTab: undefined;
    FavoritesTab: undefined;
    WatchLaterTab: undefined;
};

type BlurTargets = Record<keyof MainTabParamList, RefObject<View | null>>;

type TabPageProps = {
    refreshRequestId: number;
    selectorRequestId: number;
    selectorAnchor: SelectorAnchor | null;
};

type FavoritesStackParamList = {
    FavoritesHome: undefined;
    CollectionDetail: {
        collection: FollowedCollection;
    };
    VideoDetail: {
        target: VideoPlaybackTarget;
    };
};

type WatchLaterStackParamList = {
    WatchLaterList: undefined;
    VideoDetail: {
        target: VideoPlaybackTarget;
    };
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const FavoritesStack = createNativeStackNavigator<FavoritesStackParamList>();
const WatchLaterStack = createNativeStackNavigator<WatchLaterStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const BlurTargetsContext = createContext<BlurTargets | null>(null);
const TabSelectorRequestContext =
    createContext<TabSelectorRequest | null>(null);

type TabSelectorRequest = {
    id: number;
    routeName: string;
    anchor: SelectorAnchor | null;
};

function useTabSelectorRequest(routeName: string) {
    const request = useContext(TabSelectorRequestContext);

    return request?.routeName === routeName ? request : null;
}

function useBlurTarget(tabName: keyof MainTabParamList) {
    const blurTargets = useContext(BlurTargetsContext);

    if (!blurTargets) {
        throw new Error('底部导航模糊目标不存在');
    }

    return blurTargets[tabName];
}

function useTabRefreshRequest(
    navigation: BottomTabNavigationProp<MainTabParamList>,
) {
    const [refreshRequestId, setRefreshRequestId] = useState(0);

    useEffect(() => navigation.addListener('tabPress', () => {
        if (navigation.isFocused()) {
            setRefreshRequestId((currentId) => currentId + 1);
        }
    }), [navigation]);

    return refreshRequestId;
}

function HomeScreen({
    navigation,
    refreshRequestId,
    selectorRequestId,
    selectorAnchor,
}: NativeStackScreenProps<HomeStackParamList, 'Home'> & TabPageProps) {
    return (
        <FollowingPage
            onPicturePress={(picture) => {
                navigation.navigate('DynamicDetail', { picture });
            }}
            onVideoPress={(target) => {
                navigation.navigate('VideoDetail', { target });
            }}
            refreshRequestId={refreshRequestId}
            selectorAnchor={selectorAnchor}
            selectorRequestId={selectorRequestId}
        />
    );
}

function DynamicDetailScreen({
    route,
}: NativeStackScreenProps<HomeStackParamList, 'DynamicDetail'>) {
    return (
        <DynamicDetailPage
            initialPicture={route.params.picture}
        />
    );
}

function VideoDetailScreen({
    route,
}: NativeStackScreenProps<HomeStackParamList, 'VideoDetail'>) {
    const { deepSeekApiKey } = useAgentSession();

    return (
        <VideoDetailPage
            deepSeekApiKey={deepSeekApiKey}
            target={route.params.target}
        />
    );
}

function HomeNavigator({
    navigation,
}: BottomTabScreenProps<MainTabParamList, 'HomeTab'>) {
    const blurTarget = useBlurTarget('HomeTab');
    const refreshRequestId = useTabRefreshRequest(navigation);
    const selectorRequest = useTabSelectorRequest('HomeTab');

    return (
        <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
            <HomeStack.Navigator screenOptions={{ headerShown: false }}>
                <HomeStack.Screen name='Home'>
                    {(props) => (
                        <HomeScreen
                            {...props}
                            refreshRequestId={refreshRequestId}
                            selectorAnchor={selectorRequest?.anchor ?? null}
                            selectorRequestId={selectorRequest?.id ?? 0}
                        />
                    )}
                </HomeStack.Screen>
                <HomeStack.Screen
                    name='DynamicDetail'
                    component={DynamicDetailScreen}
                />
                <HomeStack.Screen name='VideoDetail' component={VideoDetailScreen} />
            </HomeStack.Navigator>
        </BlurTargetView>
    );
}

function FavoritesHomeScreen({
    navigation,
    refreshRequestId,
    selectorRequestId,
    selectorAnchor,
}: NativeStackScreenProps<FavoritesStackParamList, 'FavoritesHome'> & TabPageProps) {
    return (
        <FavoriteFoldersPage
            onCollectionPress={(collection) => {
                navigation.navigate('CollectionDetail', { collection });
            }}
            onVideoPress={(target) => navigation.navigate('VideoDetail', { target })}
            refreshRequestId={refreshRequestId}
            selectorAnchor={selectorAnchor}
            selectorRequestId={selectorRequestId}
        />
    );
}

function FollowedCollectionDetailScreen({
    navigation,
    route,
}: NativeStackScreenProps<FavoritesStackParamList, 'CollectionDetail'>) {
    return (
        <FollowedCollectionDetailPage
            initialCollection={route.params.collection}
            onBack={() => navigation.goBack()}
            onVideoPress={(target) => navigation.navigate('VideoDetail', { target })}
        />
    );
}

function FavoriteVideoDetailScreen({
    route,
}: NativeStackScreenProps<FavoritesStackParamList, 'VideoDetail'>) {
    const { deepSeekApiKey } = useAgentSession();

    return (
        <VideoDetailPage
            deepSeekApiKey={deepSeekApiKey}
            target={route.params.target}
        />
    );
}

function FavoritesNavigator({
    navigation,
}: BottomTabScreenProps<MainTabParamList, 'FavoritesTab'>) {
    const blurTarget = useBlurTarget('FavoritesTab');
    const refreshRequestId = useTabRefreshRequest(navigation);
    const selectorRequest = useTabSelectorRequest('FavoritesTab');

    return (
        <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
            <FavoritesStack.Navigator screenOptions={{ headerShown: false }}>
                <FavoritesStack.Screen name='FavoritesHome'>
                    {(props) => (
                        <FavoritesHomeScreen
                            {...props}
                            refreshRequestId={refreshRequestId}
                            selectorAnchor={selectorRequest?.anchor ?? null}
                            selectorRequestId={selectorRequest?.id ?? 0}
                        />
                    )}
                </FavoritesStack.Screen>
                <FavoritesStack.Screen
                    name='CollectionDetail'
                    component={FollowedCollectionDetailScreen}
                />
                <FavoritesStack.Screen name='VideoDetail' component={FavoriteVideoDetailScreen} />
            </FavoritesStack.Navigator>
        </BlurTargetView>
    );
}

function WatchLaterListScreen({
    navigation,
    refreshRequestId,
    selectorRequestId,
    selectorAnchor,
}: NativeStackScreenProps<WatchLaterStackParamList, 'WatchLaterList'> & TabPageProps) {
    return (
        <WatchLaterPage
            onVideoPress={(target) => {
                navigation.navigate('VideoDetail', { target });
            }}
            refreshRequestId={refreshRequestId}
            selectorAnchor={selectorAnchor}
            selectorRequestId={selectorRequestId}
        />
    );
}

function WatchLaterVideoDetailScreen({
    route,
}: NativeStackScreenProps<WatchLaterStackParamList, 'VideoDetail'>) {
    const { deepSeekApiKey } = useAgentSession();

    return (
        <VideoDetailPage
            deepSeekApiKey={deepSeekApiKey}
            target={route.params.target}
        />
    );
}

function WatchLaterNavigator({
    navigation,
}: BottomTabScreenProps<MainTabParamList, 'WatchLaterTab'>) {
    const blurTarget = useBlurTarget('WatchLaterTab');
    const refreshRequestId = useTabRefreshRequest(navigation);
    const selectorRequest = useTabSelectorRequest('WatchLaterTab');

    return (
        <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
            <WatchLaterStack.Navigator screenOptions={{ headerShown: false }}>
                <WatchLaterStack.Screen name='WatchLaterList'>
                    {(props) => (
                        <WatchLaterListScreen
                            {...props}
                            refreshRequestId={refreshRequestId}
                            selectorAnchor={selectorRequest?.anchor ?? null}
                            selectorRequestId={selectorRequest?.id ?? 0}
                        />
                    )}
                </WatchLaterStack.Screen>
                <WatchLaterStack.Screen
                    name='VideoDetail'
                    component={WatchLaterVideoDetailScreen}
                />
            </WatchLaterStack.Navigator>
        </BlurTargetView>
    );
}

export default function MainTabNavigator() {
    const homeBlurTarget = useRef<View | null>(null);
    const favoritesBlurTarget = useRef<View | null>(null);
    const watchLaterBlurTarget = useRef<View | null>(null);
    const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);
    const [tabSelectorRequest, setTabSelectorRequest] =
        useState<TabSelectorRequest | null>(null);
    const {
        clearDeepSeekApiKey,
        deepSeekApiKey,
        setDeepSeekApiKey,
    } = useAgentSession();
    const blurTargets = useMemo<BlurTargets>(() => ({
        HomeTab: homeBlurTarget,
        FavoritesTab: favoritesBlurTarget,
        WatchLaterTab: watchLaterBlurTarget,
    }), []);
    const handleTabSelectorRequest = useCallback((
        routeName: string,
        anchor: SelectorAnchor | null,
    ) => {
        setTabSelectorRequest((currentRequest) => ({
            id: (currentRequest?.id ?? 0) + 1,
            routeName,
            anchor,
        }));
    }, []);

    return (
        <BlurTargetsContext.Provider value={blurTargets}>
            <TabSelectorRequestContext.Provider value={tabSelectorRequest}>
                <Tab.Navigator
                    tabBar={(props) => {
                        const activeRoute = props.state.routes[props.state.index];
                        const nestedRouteName = getFocusedRouteNameFromRoute(activeRoute);

                        if (
                            nestedRouteName === 'CollectionDetail' ||
                            nestedRouteName === 'DynamicDetail' ||
                            nestedRouteName === 'VideoDetail'
                        ) {
                            return null;
                        }

                        const routeName = activeRoute.name as keyof MainTabParamList;

                        return (
                            <FloatingTabBar
                                {...props}
                                blurTarget={blurTargets[routeName]}
                                hasDeepSeekApiKey={deepSeekApiKey !== null}
                                onAgentConfigPress={() => setIsApiKeyModalVisible(true)}
                                onTabSelectorRequest={handleTabSelectorRequest}
                            />
                        );
                    }}
                    screenOptions={{
                        headerShown: false,
                    }}
                >
                    <Tab.Screen
                        name='HomeTab'
                        component={HomeNavigator}
                        options={{ title: '动态' }}
                    />
                    <Tab.Screen
                        name='FavoritesTab'
                        component={FavoritesNavigator}
                        options={{ title: '收藏' }}
                    />
                    <Tab.Screen
                        name='WatchLaterTab'
                        component={WatchLaterNavigator}
                        options={{ title: '稍后再看' }}
                    />
                </Tab.Navigator>
            </TabSelectorRequestContext.Provider>

            <ApiKeyInputModal
                hasApiKey={deepSeekApiKey !== null}
                visible={isApiKeyModalVisible}
                onCancel={() => setIsApiKeyModalVisible(false)}
                onClear={() => {
                    clearDeepSeekApiKey();
                    setIsApiKeyModalVisible(false);
                }}
                onConfirm={(apiKey) => {
                    setDeepSeekApiKey(apiKey);
                    setIsApiKeyModalVisible(false);
                }}
            />
        </BlurTargetsContext.Provider>
    );
}

const styles = StyleSheet.create({
    blurTarget: {
        flex: 1,
    },
});
