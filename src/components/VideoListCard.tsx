import { memo } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

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
                        <Text style={styles.durationText}>{duration}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.videoInfo}>
                <Text numberOfLines={2} style={styles.videoTitle}>{video.title}</Text>
                <View style={styles.authorRow}>
                    <UserAvatar
                        name={video.author.name}
                        size={22}
                        style={styles.avatar}
                        uri={video.author.avatarUrl}
                    />
                    <Text numberOfLines={1} style={styles.authorName}>{video.author.name}</Text>
                </View>
                {metaText ? (
                    <Text style={styles.metaText}>{metaText}</Text>
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
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: colors.mediaOverlayBackground,
    },
    durationText: {
        color: colors.primaryText,
        fontSize: 11,
        fontWeight: '600',
    },
    videoInfo: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
    },
    videoTitle: {
        color: colors.primaryText,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
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
        color: colors.secondaryText,
        fontSize: 12,
    },
    metaText: {
        marginTop: spacing.xs,
        color: colors.mutedText,
        fontSize: 11,
    },
});
