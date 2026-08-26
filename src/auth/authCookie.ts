import * as SecureStore from 'expo-secure-store';

const LOGIN_COOKIE_KEY = 'bilibili.login.cookie';
const LOGIN_COOKIE_NAME = 'SESSDATA';

export function hasLoginCookie(cookie: string): boolean {
    return cookie.split(';').some((part) => {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex < 0) {
            return false;
        }

        const name = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();

        return name === LOGIN_COOKIE_NAME && value.length > 0;
    });
}

export async function saveLoginCookie(cookie: string): Promise<void> {
    if (!hasLoginCookie(cookie)) {
        throw new Error('Cookie中没有有效的SESSDATA');
    }

    await SecureStore.setItemAsync(LOGIN_COOKIE_KEY, cookie);
}

export async function getLoginCookie(): Promise<string | null> {
    const cookie = await SecureStore.getItemAsync(LOGIN_COOKIE_KEY);

    if (cookie === null || !hasLoginCookie(cookie)) {
        return null;
    }

    return cookie;
}

export async function clearLoginCookie(): Promise<void> {
    await SecureStore.deleteItemAsync(LOGIN_COOKIE_KEY);
}
