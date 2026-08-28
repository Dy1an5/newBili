import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';

import FavoriteFoldersPage from '@/page/favorites/FavoriteFoldersPage';
import FavoriteVideosPage from '@/page/favorites/FavoriteVideosPage';
import FollowingPage from '@/page/following/FollowingPage';
import VideoDetailPage from '@/page/video/VideoDetailPage';
import WatchLaterPage from '@/page/watchLater/WatchLaterPage';
import { colors } from '@/theme/colors';
import type { FavoriteFolder } from '@/types/favorites';
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

type FavoritesStackParamList = {
    FavoriteFolders: undefined;
    FavoriteVideos: {
        folder: FavoriteFolder;
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
    navigation,
    route,
}: NativeStackScreenProps<HomeStackParamList, 'VideoDetail'>) {
    return (
        <VideoDetailPage
            target={route.params.target}
            onBack={() => {
                navigation.goBack();
            }}
        />
    );
}

function HomeNavigator() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen name='Home' component={HomeScreen} />
            <HomeStack.Screen name='VideoDetail' component={VideoDetailScreen} />
        </HomeStack.Navigator>
    );
}

function FavoriteFoldersScreen({
    navigation,
}: NativeStackScreenProps<FavoritesStackParamList, 'FavoriteFolders'>) {
    return (
        <FavoriteFoldersPage
            onFolderPress={(folder) => {
                navigation.navigate('FavoriteVideos', { folder });
            }}
        />
    );
}

function FavoriteVideosScreen({
    navigation,
    route,
}: NativeStackScreenProps<FavoritesStackParamList, 'FavoriteVideos'>) {
    return (
        <FavoriteVideosPage
            folder={route.params.folder}
            onBack={() => navigation.goBack()}
            onVideoPress={(target) => navigation.navigate('VideoDetail', { target })}
        />
    );
}

function FavoriteVideoDetailScreen({
    navigation,
    route,
}: NativeStackScreenProps<FavoritesStackParamList, 'VideoDetail'>) {
    return (
        <VideoDetailPage
            target={route.params.target}
            onBack={() => navigation.goBack()}
        />
    );
}

function FavoritesNavigator() {
    return (
        <FavoritesStack.Navigator screenOptions={{ headerShown: false }}>
            <FavoritesStack.Screen name='FavoriteFolders' component={FavoriteFoldersScreen} />
            <FavoritesStack.Screen name='FavoriteVideos' component={FavoriteVideosScreen} />
            <FavoritesStack.Screen name='VideoDetail' component={FavoriteVideoDetailScreen} />
        </FavoritesStack.Navigator>
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
    navigation,
    route,
}: NativeStackScreenProps<WatchLaterStackParamList, 'VideoDetail'>) {
    return (
        <VideoDetailPage
            target={route.params.target}
            onBack={() => navigation.goBack()}
        />
    );
}

function WatchLaterNavigator() {
    return (
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
    );
}

export default function MainTabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarIcon: () => null,
                tabBarIconStyle: styles.tabBarIcon,
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarStyle: styles.tabBar,
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
    );
}

const styles = StyleSheet.create({
    tabBar: {
        borderTopColor: colors.divider,
        backgroundColor: colors.surface,
    },
    tabBarLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    tabBarIcon: {
        display: 'none',
    },
});
