import { memo } from 'react';
import {
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';

import AppText from '@/components/AppText';
import BilibiliImage from '@/components/BilibiliImage';
import UserAvatar from '@/components/UserAvatar';
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
    const { width: windowWidth } = useWindowDimensions();
    const coverWidth = Math.max(
        1,
        windowWidth - spacing.lg * 2 - spacing.md * 2 - 2,
    );

    return (
        <Pressable
            accessibilityLabel={`${title}, ${authorName}`}
            accessibilityRole='button'
            onPress={onPress}
            style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
            ]}
        >
            <AppText numberOfLines={2} style={styles.title} variant='title'>
                {title}
            </AppText>

            <View style={styles.coverContainer}>
                <BilibiliImage
                    style={styles.cover}
                    thumbnailSize={{
                        width: coverWidth,
                        height: coverWidth * 9 / 16,
                    }}
                    uri={coverUrl}
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

                    <AppText
                        color={colors.secondaryText}
                        numberOfLines={1}
                        style={styles.author}
                        variant='titleSmall'
                    >
                        {authorName}
                    </AppText>
                </View>

                <AppText color={colors.mutedText} variant='caption'>
                    {publishedTimeText}
                </AppText>
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
    },
    title: {
        marginBottom: spacing.md,
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
    },
});
