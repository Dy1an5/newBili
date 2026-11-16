import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
    SafeAreaProvider,
    SafeAreaView,
} from 'react-native-safe-area-context';

import LoginPage from './auth/LoginPage';
import { clearLoginCookie, getLoginCookie } from './auth/authCookie';
import { setAuthFailureHandler } from './tool/authFailure';
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

    // 服务端已经认定登录态失效时, 删掉本地 cookie 再回到登录入口.
    // 删 cookie 失败不影响切页面, 否则用户会卡在错误页.
    useEffect(() => {
        setAuthFailureHandler(() => {
            setScreen('main');

            void clearLoginCookie().catch(() => undefined);
        });

        return () => {
            setAuthFailureHandler(null);
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
            <NavigationContainer
                theme={{
                    ...DefaultTheme,
                    colors: {
                        ...DefaultTheme.colors,
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
        );
    }

    return (
        <GestureHandlerRootView style={styles.appRoot}>
            <SafeAreaProvider>
                <StatusBar barStyle='dark-content' backgroundColor={colors.pageBackground} />
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
        backgroundColor: colors.pageBackground,
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
