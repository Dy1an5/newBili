import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

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

    if (screen === 'checking') {
        return (
            <View style={styles.loadingPage}>
                <ActivityIndicator size='large' />
            </View>
        );
    }

    if (screen === 'main') {
        return <MainPage onLoginPress={() => setScreen('login')} />;
    }

    if (screen === 'login') {
        return (
            <LoginPage
                onLoginSuccess={() => {
                    setScreen('authenticated');
                }}
                onCancel={() => {
                    setScreen('main');
                }}
            />
        );
    }

    return (
        <NavigationContainer>
            <MainTabNavigator />
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    loadingPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
});
