import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import LoginPage from './auth/LoginPage';
import { getLoginCookie } from './auth/authCookie';
import FollowingPage from './following/FollowingPage';
import type { VideoFollowingItem } from './types/following';
import VideoDetailPage from './video/VideoDetailPage';

type AppScreen = 'checking' | 'loggedOut' | 'login' | 'home' | 'video';

export default function App() {
    const [screen, setScreen] = useState<AppScreen>('checking');
    const [selectedVideo, setSelectedVideo] = useState<VideoFollowingItem | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkLoginState = async () => {
            try {
                const cookie = await getLoginCookie();

                if (isMounted) {
                    setScreen(cookie === null ? 'loggedOut' : 'home');
                }
            } catch {
                if (isMounted) {
                    setScreen('loggedOut');
                }
            }
        };

        void checkLoginState();

        return () => {
            isMounted = false;
        };
    }, []);

    if (screen === 'checking') {
        return (
            <View style={styles.loadingPage}>
                <ActivityIndicator size='large' />
            </View>
        );
    }

    if (screen === 'loggedOut') {
        return (
            <View style={styles.loggedOutPage}>
                <Pressable
                    accessibilityRole='button'
                    onPress={() => {
                        setScreen('login');
                    }}
                    style={styles.loginButton}
                >
                    <Text style={styles.loginButtonText}>登录</Text>
                </Pressable>
            </View>
        );
    }

    if (screen === 'login') {
        return (
            <LoginPage
                onLoginSuccess={() => {
                    setScreen('home');
                }}
                onCancel={() => {
                    setScreen('loggedOut');
                }}
            />
        );
    }

    if (screen === 'video' && selectedVideo) {
        return (
            <VideoDetailPage
                video={selectedVideo}
                onBack={() => {
                    setSelectedVideo(null);
                    setScreen('home');
                }}
            />
        );
    }

    return (
        <View style={styles.homePage}>
            <FollowingPage
                onVideoPress={(video) => {
                    setSelectedVideo(video);
                    setScreen('video');
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    loadingPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    loggedOutPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    loginButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#333',
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    homePage: {
        flex: 1,
        backgroundColor: '#fff',
    },
});
