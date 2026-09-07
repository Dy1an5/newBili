import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
    SafeAreaProvider,
    SafeAreaView,
} from 'react-native-safe-area-context';

import LoginPage from './auth/LoginPage';
import { AgentSessionProvider } from './agent/session/AgentSessionContext';
import { getLoginCookie } from './auth/authCookie';
import MainPage from './main/MainPage';
import MainTabNavigator from './navigation/MainTabNavigator';
import { colors } from './theme/colors';

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
                <ActivityIndicator color={colors.accentForeground} size='large' />
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
            <AgentSessionProvider>
                <NavigationContainer
                    theme={{
                        ...DarkTheme,
                        colors: {
                            ...DarkTheme.colors,
                            primary: colors.accentForeground,
                            background: colors.pageBackground,
                            card: colors.pageBackground,
                            text: colors.primaryText,
                            border: colors.surfaceBorder,
                        },
                    }}
                >
                    <MainTabNavigator />
                </NavigationContainer>
            </AgentSessionProvider>
        );
    }

    return (
        <GestureHandlerRootView style={styles.appRoot}>
            <SafeAreaProvider>
                <StatusBar barStyle='light-content' backgroundColor={colors.pageBackground} />
                <SafeAreaView edges={['top']} style={styles.safeArea}>
                    {content}
                </SafeAreaView>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    appRoot: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    loadingPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.pageBackground,
    },
});
