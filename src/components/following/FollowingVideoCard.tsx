import { memo } from 'react';
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Props = {
    title: string;
    coverUrl: string;
    avatarUrl: string;
    authorName: string;
    publishedTimeText: string;
    onPress?: () => void;
};

function FollowingVideoCard({
    title,
    coverUrl,
    avatarUrl,
    authorName,
    publishedTimeText,
    onPress,
}: Props) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
            ]}
        >
            <Text
                style={styles.title}
                numberOfLines={2}
            >
                {title}
            </Text>

            <View style={styles.coverContainer}>
                <Image
                    source={{ uri: coverUrl }}
                    style={styles.cover}
                    resizeMode='cover'
                />
            </View>

            <View style={styles.footer}>
                <View style={styles.authorContainer}>
                    <Image
                        source={{ uri: avatarUrl }}
                        style={styles.avatar}
                    />

                    <Text
                        style={styles.author}
                        numberOfLines={1}
                    >
                        {authorName}
                    </Text>
                </View>

                <Text style={styles.time}>
                    {publishedTimeText}
                </Text>
            </View>
        </Pressable>
    );
}

export default memo(FollowingVideoCard);

const styles = StyleSheet.create({
    card: {
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,

        padding: spacing.md,

        backgroundColor: colors.surfaceRaised,

        borderWidth: 1,
        borderColor: colors.outline,
        borderRadius: radius.lg,
    },

    cardPressed: {
        opacity: 0.94,

        transform: [
            {
                scale: 0.995,
            },
        ],
    },

    title: {
        marginBottom: spacing.md,

        fontSize: 18,
        lineHeight: 25,

        fontWeight: '700',

        color: colors.textPrimary,
    },

    coverContainer: {
        overflow: 'hidden',

        borderRadius: radius.md,

        backgroundColor: colors.background,
    },

    cover: {
        width: '100%',
        aspectRatio: 16 / 9,
    },

    footer: {
        marginTop: spacing.md,

        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    authorContainer: {
        flex: 1,

        flexDirection: 'row',
        alignItems: 'center',

        marginRight: spacing.md,
    },

    avatar: {
        width: 34,
        height: 34,

        borderRadius: radius.full,

        marginRight: spacing.sm,

        backgroundColor: colors.background,
    },

    author: {
        flex: 1,

        fontSize: 14,
        fontWeight: '600',

        color: colors.textSecondary,
    },

    time: {
        fontSize: 13,

        color: colors.textMuted,
    },
});
