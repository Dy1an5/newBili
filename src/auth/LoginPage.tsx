import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { WebView } from 'react-native-webview';

import AppText from '@/components/AppText';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { hasLoginCookie, saveLoginCookie } from './authCookie';

const BILIBILI_LOGIN_URL = 'https://passport.bilibili.com/login';
const BILIBILI_COOKIE_URL = 'https://www.bilibili.com';

export type LoginPageProps = {
    onLoginSuccess: () => void;
    onCancel?: () => void;
};

export default function LoginPage({
    onLoginSuccess,
    onCancel,
}: LoginPageProps) {
    const [message, setMessage] = useState('请在B站官方页面完成登录');
    const isCheckingCookie = useRef(false);
    const isLoginComplete = useRef(false);

    const checkLoginCookie = useCallback(async () => {
        if (isCheckingCookie.current || isLoginComplete.current) {
            return;
        }

        isCheckingCookie.current = true;

        try {
            const cookie = await CookieManager.getCookieHeader(
                BILIBILI_COOKIE_URL,
                true,
            );

            if (!hasLoginCookie(cookie)) {
                return;
            }

            setMessage('正在安全保存登录信息');
            await saveLoginCookie(cookie);
            isLoginComplete.current = true;
            setMessage('登录成功');
            onLoginSuccess();
        } catch {
            setMessage('读取或保存登录信息失败,请重试');
        } finally {
            isCheckingCookie.current = false;
        }
    }, [onLoginSuccess]);

    return (
        <View style={styles.page}>
            <View style={styles.header}>
                {onCancel ? (
                    <Pressable
                        accessibilityRole='button'
                        onPress={onCancel}
                        style={styles.backButton}
                    >
                        <AppText color={colors.accentForeground} variant='label'>
                            返回
                        </AppText>
                    </Pressable>
                ) : null}
                <AppText numberOfLines={1} style={styles.message} variant='bodySmall'>
                    {message}
                </AppText>
            </View>

            <WebView
                source={{ uri: BILIBILI_LOGIN_URL }}
                style={styles.webView}
                originWhitelist={['https://*']}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                mixedContentMode='never'
                setSupportMultipleWindows={false}
                startInLoadingState
                renderLoading={() => (
                    <View style={styles.loading}>
                        <ActivityIndicator color={colors.accentForeground} size='large' />
                    </View>
                )}
                onLoad={() => {
                    void checkLoginCookie();
                }}
                onError={() => {
                    setMessage('登录页面加载失败,请检查网络后重试');
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    header: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.surfaceBorder,
    },
    backButton: {
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
        marginRight: spacing.sm,
    },
    message: {
        flex: 1,
    },
    webView: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.pageBackground,
    },
});
