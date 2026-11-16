import { memo } from 'react';
import {
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

import AppText from '@/components/AppText';
import BilibiliImage from '@/components/BilibiliImage';
import UserAvatar from '@/components/UserAvatar';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

const COVER_WIDTH = 132;
const COVER_HEIGHT = COVER_WIDTH * 10 / 16;

type VideoListItem = {
    title: string;
    coverUrl: string;
    durationSeconds: number;
    author: {
        name: string;
        avatarUrl: string;
    };
};

type Props = {
    video: VideoListItem;
    metaText?: string;
    onPress: () => void;
};

function formatDuration(durationSeconds: number): string {
    if (durationSeconds <= 0) {
        return '';
    }

    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = Math.floor(durationSeconds % 60);

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function VideoListCard({
    video,
    metaText,
    onPress,
}: Props) {
    const duration = formatDuration(video.durationSeconds);

    return (
        <Pressable
            accessibilityLabel={`${video.title}, ${video.author.name}`}
            accessibilityRole='button'
            onPress={onPress}
            style={({ pressed }) => [
                styles.videoCard,
                pressed && styles.videoCardPressed,
            ]}
        >
            <View style={styles.coverContainer}>
                <BilibiliImage
                    style={styles.cover}
                    thumbnailSize={{
                        width: COVER_WIDTH,
                        height: COVER_HEIGHT,
                    }}
                    uri={video.coverUrl}
                />
                {duration ? (
                    <View style={styles.durationBadge}>
                        <AppText color={colors.mediaForeground} variant='micro'>
                            {duration}
                        </AppText>
                    </View>
                ) : null}
            </View>

            <View style={styles.videoInfo}>
                <AppText numberOfLines={2} variant='titleSmall'>
                    {video.title}
                </AppText>
                <View style={styles.authorRow}>
                    <UserAvatar
                        name={video.author.name}
                        size={22}
                        style={styles.avatar}
                        uri={video.author.avatarUrl}
                    />
                    <AppText
                        color={colors.secondaryText}
                        numberOfLines={1}
                        style={styles.authorName}
                        variant='caption'
                    >
                        {video.author.name}
                    </AppText>
                </View>
                {metaText ? (
                    <AppText
                        color={colors.mutedText}
                        style={styles.metaText}
                        variant='micro'
                    >
                        {metaText}
                    </AppText>
                ) : null}
            </View>
        </Pressable>
    );
}

export default memo(VideoListCard);

const styles = StyleSheet.create({
    videoCard: {
        flexDirection: 'row',
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceBackground,
    },
    videoCardPressed: {
        opacity: 0.8,
    },
    coverContainer: {
        width: COVER_WIDTH,
        aspectRatio: 16 / 10,
        overflow: 'hidden',
        borderRadius: radius.sm,
        backgroundColor: colors.pageBackground,
    },
    cover: {
        width: '100%',
        height: '100%',
    },
    durationBadge: {
        position: 'absolute',
        right: spacing.xs,
        bottom: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        borderRadius: radius.xs,
        backgroundColor: colors.mediaOverlayBackground,
    },
    videoInfo: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    avatar: {
        marginRight: spacing.xs,
    },
    authorName: {
        flex: 1,
    },
    metaText: {
        marginTop: spacing.xs,
    },
});
