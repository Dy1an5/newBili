import { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Props = {
    visible: boolean;
    hasApiKey: boolean;
    onCancel: () => void;
    onConfirm: (apiKey: string) => void;
    onClear: () => void;
};

export default function ApiKeyInputModal({
    visible,
    hasApiKey,
    onCancel,
    onConfirm,
    onClear,
}: Props) {
    const [apiKey, setApiKey] = useState('');
    const normalizedApiKey = apiKey.trim();
    const isApiKeyValid = /^[\x21-\x7e]+$/.test(normalizedApiKey);

    useEffect(() => {
        if (!visible) {
            setApiKey('');
        }
    }, [visible]);

    const handleConfirm = () => {
        if (!isApiKeyValid) {
            return;
        }

        onConfirm(normalizedApiKey);
    };

    return (
        <Modal
            animationType='fade'
            onRequestClose={onCancel}
            transparent
            visible={visible}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                <Pressable
                    accessibilityLabel='关闭API key输入框'
                    onPress={onCancel}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.dialog}>
                    <Text style={styles.title}>DeepSeek API key</Text>
                    <Text style={styles.description}>
                        key仅保存在本次应用运行的内存中,不会写入本地存储.
                    </Text>

                    <TextInput
                        autoCapitalize='none'
                        autoCorrect={false}
                        autoFocus
                        onChangeText={setApiKey}
                        onSubmitEditing={handleConfirm}
                        placeholder={hasApiKey ? '已配置,输入新key可替换' : '请输入API key'}
                        placeholderTextColor={colors.textMuted}
                        returnKeyType='done'
                        secureTextEntry
                        style={styles.input}
                        value={apiKey}
                    />

                    {normalizedApiKey && !isApiKeyValid ? (
                        <Text style={styles.validationText}>
                            API key不能包含中文、空格或换行,请只粘贴key本身.
                        </Text>
                    ) : null}

                    <View style={styles.actions}>
                        {hasApiKey ? (
                            <Pressable
                                accessibilityRole='button'
                                onPress={onClear}
                                style={({ pressed }) => [
                                    styles.textButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={styles.clearText}>清除</Text>
                            </Pressable>
                        ) : null}

                        <View style={styles.actionsSpacer} />

                        <Pressable
                            accessibilityRole='button'
                            onPress={onCancel}
                            style={({ pressed }) => [
                                styles.textButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text style={styles.cancelText}>取消</Text>
                        </Pressable>

                        <Pressable
                            accessibilityRole='button'
                            accessibilityState={{ disabled: !isApiKeyValid }}
                            disabled={!isApiKeyValid}
                            onPress={handleConfirm}
                            style={({ pressed }) => [
                                styles.confirmButton,
                                !isApiKeyValid && styles.confirmButtonDisabled,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text style={styles.confirmText}>确定</Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
    },
    dialog: {
        width: '100%',
        maxWidth: 440,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.outline,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceRaised,
    },
    title: {
        color: colors.textPrimary,
        fontSize: 19,
        fontWeight: '700',
    },
    description: {
        marginTop: spacing.sm,
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 20,
    },
    input: {
        marginTop: spacing.lg,
        height: 48,
        paddingHorizontal: spacing.md,
        borderWidth: 1,
        borderColor: colors.outline,
        borderRadius: radius.sm,
        color: colors.textPrimary,
        backgroundColor: colors.background,
        fontSize: 15,
    },
    validationText: {
        marginTop: spacing.sm,
        color: '#FFB86B',
        fontSize: 12,
        lineHeight: 18,
    },
    actions: {
        marginTop: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionsSpacer: {
        flex: 1,
    },
    textButton: {
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
    },
    clearText: {
        color: '#FF7474',
        fontSize: 14,
        fontWeight: '600',
    },
    cancelText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    confirmButton: {
        minHeight: 40,
        justifyContent: 'center',
        marginLeft: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.sm,
        backgroundColor: colors.primary,
    },
    confirmButtonDisabled: {
        opacity: 0.4,
    },
    confirmText: {
        color: colors.textOnPrimary,
        fontSize: 14,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.7,
    },
});
