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
import type { VideoCardItem } from '@/types/video';

type Props = {
    video: VideoCardItem;
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

export default function FavoriteVideoCard({
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
                <Image source={{ uri: video.cover }} resizeMode='cover' style={styles.cover} />
                {duration ? (
                    <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{duration}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.videoInfo}>
                <Text numberOfLines={2} style={styles.videoTitle}>{video.title}</Text>
                <View style={styles.authorRow}>
                    <Image source={{ uri: video.author.avatar }} style={styles.avatar} />
                    <Text numberOfLines={1} style={styles.authorName}>{video.author.name}</Text>
                </View>
                {metaText ? (
                    <Text style={styles.metaText}>{metaText}</Text>
                ) : null}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    videoCard: {
        flexDirection: 'row',
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        elevation: 1,
        shadowColor: colors.shadow,
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: spacing.xs,
    },
    videoCardPressed: {
        opacity: 0.8,
    },
    coverContainer: {
        width: 132,
        aspectRatio: 16 / 10,
        overflow: 'hidden',
        borderRadius: radius.sm,
        backgroundColor: colors.background,
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
        backgroundColor: 'rgba(0,0,0,0.68)',
    },
    durationText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    videoInfo: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
    },
    videoTitle: {
        color: colors.textPrimary,
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
        width: 22,
        height: 22,
        marginRight: spacing.xs,
        borderRadius: radius.full,
        backgroundColor: colors.background,
    },
    authorName: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: 12,
    },
    metaText: {
        marginTop: spacing.xs,
        color: colors.textMuted,
        fontSize: 11,
    },
});
