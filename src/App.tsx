import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
    SafeAreaProvider,
    SafeAreaView,
} from 'react-native-safe-area-context';

import LoginPage from './auth/LoginPage';
import { getLoginCookie } from './auth/authCookie';
import MainPage from './main/MainPage';
import MainTabNavigator from './navigation/MainTabNavigator';

type AppScreen = 'checking' | 'main' | 'login' | 'authenticated';

export default function App() {
    const [screen, setScreen] = useState<AppScreen>('checking');

    useEffect(() => {
        let isMounted = true;

        const checkLoginState = async () => {
            try {
                const cookie = await getLoginCookie();

                if (isMounted) {
                    setScreen(cookie === null ? 'main' : 'authenticated');
                }
            } catch {
                if (isMounted) {
                    setScreen('main');
                }
            }
        };

        void checkLoginState();

        return () => {
            isMounted = false;
        };
    }, []);

    let content: ReactNode;

    if (screen === 'checking') {
        content = (
            <View style={styles.loadingPage}>
                <ActivityIndicator size='large' />
            </View>
        );
    } else if (screen === 'main') {
        content = <MainPage onLoginPress={() => setScreen('login')} />;
    } else if (screen === 'login') {
        content = (
            <LoginPage
                onLoginSuccess={() => {
                    setScreen('authenticated');
                }}
                onCancel={() => {
                    setScreen('main');
                }}
            />
        );
    } else {
        content = (
            <NavigationContainer>
                <MainTabNavigator />
            </NavigationContainer>
        );
    }

    return (
        <SafeAreaProvider>
            <StatusBar barStyle='dark-content' backgroundColor='#fff' />
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                {content}
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
});
