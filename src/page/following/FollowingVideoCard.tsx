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
import UserAvatar from '@/components/UserAvatar';
import { BILIBILI_IMAGE_HEADERS } from '@/tool/bilibiliApi';

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
                    source={{
                        uri: coverUrl,
                        headers: BILIBILI_IMAGE_HEADERS,
                    }}
                    style={styles.cover}
                    resizeMode='cover'
                />
            </View>

            <View style={styles.footer}>
                <View style={styles.authorContainer}>
                    <UserAvatar
                        name={authorName}
                        size={34}
                        style={styles.avatar}
                        uri={avatarUrl}
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

        backgroundColor: colors.surfaceBackground,

        borderWidth: 1,
        borderColor: colors.surfaceBorder,
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

        color: colors.primaryText,
    },

    coverContainer: {
        overflow: 'hidden',

        borderRadius: radius.md,

        backgroundColor: colors.pageBackground,
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
        marginRight: spacing.sm,
    },

    author: {
        flex: 1,

        fontSize: 14,
        fontWeight: '600',

        color: colors.secondaryText,
    },

    time: {
        fontSize: 13,

        color: colors.mutedText,
    },
});
