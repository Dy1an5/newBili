import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import FollowingPage from '@/following/FollowingPage';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { VideoFollowingItem } from '@/types/following';
import VideoDetailPage from '@/video/VideoDetailPage';

type HomeStackParamList = {
    Home: undefined;
    VideoDetail: {
        video: VideoFollowingItem;
    };
};

type MainTabParamList = {
    HomeTab: undefined;
    FavoritesTab: undefined;
    WatchLaterTab: undefined;
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function HomeScreen({
    navigation,
}: NativeStackScreenProps<HomeStackParamList, 'Home'>) {
    return (
        <FollowingPage
            onVideoPress={(video) => {
                navigation.navigate('VideoDetail', { video });
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
            video={route.params.video}
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

function PlaceholderPage({ message }: { message: string }) {
    return (
        <View style={styles.placeholderPage}>
            <Text style={styles.placeholderText}>{message}</Text>
        </View>
    );
}

function FavoritesPage() {
    return <PlaceholderPage message='收藏功能将在后续模块中实现' />;
}

function WatchLaterPage() {
    return <PlaceholderPage message='稍后再看功能将在后续模块中实现' />;
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
                component={FavoritesPage}
                options={{ title: '收藏' }}
            />
            <Tab.Screen
                name='WatchLaterTab'
                component={WatchLaterPage}
                options={{ title: '稍后再看' }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    placeholderPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.background,
    },
    placeholderText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
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
