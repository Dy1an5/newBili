import { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import BilibiliImage from '@/components/BilibiliImage';
import { colors } from '@/theme/colors';

type Props = {
    uri?: string;
    name?: string;
    size: number;
    style?: StyleProp<ViewStyle>;
    transition?: number;
};

export default function UserAvatar({
    uri,
    name,
    size,
    style,
    transition,
}: Props) {
    const [failedUri, setFailedUri] = useState<string | null>(null);
    const normalizedUri = uri?.trim() ?? '';
    const shouldShowImage = normalizedUri.length > 0 && failedUri !== normalizedUri;
    const placeholder = name?.trim().slice(0, 1) || '?';

    return (
        <View
            accessibilityLabel={name ? `${name}头像` : '用户头像'}
            accessibilityRole='image'
            style={[
                style,
                styles.container,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
            ]}
        >
            {shouldShowImage ? (
                <BilibiliImage
                    onError={() => setFailedUri(normalizedUri)}
                    style={styles.image}
                    thumbnailSize={{ width: size, height: size }}
                    transition={transition}
                    uri={normalizedUri}
                />
            ) : (
                <Text style={[styles.placeholder, { fontSize: Math.max(11, size * 0.38) }]}>
                    {placeholder}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: colors.surfaceBackground,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        color: colors.secondaryText,
        fontWeight: '600',
    },
});
