import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Props = {
    onLoginPress: () => void;
};

export default function MainPage({ onLoginPress }: Props) {
    return (
        <View style={styles.page}>
            <Pressable
                accessibilityRole='button'
                onPress={onLoginPress}
                style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.loginButtonPressed,
                ]}
            >
                <Text style={styles.loginButtonText}>登录</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
    loginButton: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.primary,
    },
    loginButtonPressed: {
        opacity: 0.75,
    },
    loginButtonText: {
        color: colors.surface,
        fontSize: 16,
        fontWeight: '600',
    },
});
