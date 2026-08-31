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

import AppButton from '@/components/AppButton';
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
                        placeholderTextColor={colors.mutedText}
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

                        <AppButton
                            disabled={!isApiKeyValid}
                            onPress={handleConfirm}
                            style={styles.confirmButtonLayout}
                            title='确定'
                        />
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
        backgroundColor: colors.modalBackdrop,
    },
    dialog: {
        width: '100%',
        maxWidth: 440,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceBackground,
    },
    title: {
        color: colors.primaryText,
        fontSize: 19,
        fontWeight: '700',
    },
    description: {
        marginTop: spacing.sm,
        color: colors.secondaryText,
        fontSize: 13,
        lineHeight: 20,
    },
    input: {
        marginTop: spacing.lg,
        height: 48,
        paddingHorizontal: spacing.md,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.sm,
        color: colors.primaryText,
        backgroundColor: colors.pageBackground,
        fontSize: 15,
    },
    validationText: {
        marginTop: spacing.sm,
        color: colors.alertText,
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
        color: colors.alertText,
        fontSize: 14,
        fontWeight: '600',
    },
    cancelText: {
        color: colors.secondaryText,
        fontSize: 14,
        fontWeight: '600',
    },
    confirmButtonLayout: {
        marginLeft: spacing.sm,
    },
    pressed: {
        opacity: 0.7,
    },
});
