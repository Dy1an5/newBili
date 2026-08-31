import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurTargetView } from 'expo-blur';
import {
    createContext,
    type RefObject,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';
import { StyleSheet, type View } from 'react-native';

import { useAgentSession } from '@/agent/session/AgentSessionContext';
import ApiKeyInputModal from '@/agent/ui/ApiKeyInputModal';
import FloatingTabBar from '@/navigation/FloatingTabBar';
import FavoriteFoldersPage from '@/page/favorites/FavoriteFoldersPage';
import FollowingPage from '@/page/following/FollowingPage';
import VideoDetailPage from '@/page/video/VideoDetailPage';
import WatchLaterPage from '@/page/watchLater/WatchLaterPage';
import type { VideoPlaybackTarget } from '@/types/video';

type HomeStackParamList = {
    Home: undefined;
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

type FavoritesStackParamList = {
    FavoriteFolders: undefined;
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

function useBlurTarget(tabName: keyof MainTabParamList) {
    const blurTargets = useContext(BlurTargetsContext);

    if (!blurTargets) {
        throw new Error('底部导航模糊目标不存在');
    }

    return blurTargets[tabName];
}

function HomeScreen({
    navigation,
}: NativeStackScreenProps<HomeStackParamList, 'Home'>) {
    return (
        <FollowingPage
            onVideoPress={(target) => {
                navigation.navigate('VideoDetail', { target });
            }}
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

function HomeNavigator() {
    const blurTarget = useBlurTarget('HomeTab');

    return (
        <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
            <HomeStack.Navigator screenOptions={{ headerShown: false }}>
                <HomeStack.Screen name='Home' component={HomeScreen} />
                <HomeStack.Screen name='VideoDetail' component={VideoDetailScreen} />
            </HomeStack.Navigator>
        </BlurTargetView>
    );
}

function FavoriteFoldersScreen({
    navigation,
}: NativeStackScreenProps<FavoritesStackParamList, 'FavoriteFolders'>) {
    return (
        <FavoriteFoldersPage
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

function FavoritesNavigator() {
    const blurTarget = useBlurTarget('FavoritesTab');

    return (
        <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
            <FavoritesStack.Navigator screenOptions={{ headerShown: false }}>
                <FavoritesStack.Screen name='FavoriteFolders' component={FavoriteFoldersScreen} />
                <FavoritesStack.Screen name='VideoDetail' component={FavoriteVideoDetailScreen} />
            </FavoritesStack.Navigator>
        </BlurTargetView>
    );
}

function WatchLaterListScreen({
    navigation,
}: NativeStackScreenProps<WatchLaterStackParamList, 'WatchLaterList'>) {
    return (
        <WatchLaterPage
            onVideoPress={(target) => {
                navigation.navigate('VideoDetail', { target });
            }}
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

function WatchLaterNavigator() {
    const blurTarget = useBlurTarget('WatchLaterTab');

    return (
        <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
            <WatchLaterStack.Navigator screenOptions={{ headerShown: false }}>
                <WatchLaterStack.Screen
                    name='WatchLaterList'
                    component={WatchLaterListScreen}
                />
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

    return (
        <BlurTargetsContext.Provider value={blurTargets}>
            <Tab.Navigator
                tabBar={(props) => {
                    const activeRoute = props.state.routes[props.state.index];
                    const nestedRouteName = getFocusedRouteNameFromRoute(activeRoute);

                    if (nestedRouteName === 'VideoDetail') {
                        return null;
                    }

                    const routeName = activeRoute.name as keyof MainTabParamList;

                    return (
                        <FloatingTabBar
                            {...props}
                            blurTarget={blurTargets[routeName]}
                            hasDeepSeekApiKey={deepSeekApiKey !== null}
                            onAgentConfigPress={() => setIsApiKeyModalVisible(true)}
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
