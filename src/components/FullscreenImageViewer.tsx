import { useEffect, useMemo, useState } from 'react';
import type {
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BilibiliImage from '@/components/BilibiliImage';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

type Props = {
    imageUrls: string[];
    initialIndex: number;
    onClose: () => void;
    visible: boolean;
};

export default function FullscreenImageViewer({
    imageUrls,
    initialIndex,
    onClose,
    visible,
}: Props) {
    const { width: previewWidth } = useWindowDimensions();
    const validImageUrls = useMemo(
        () => imageUrls.filter((imageUrl) => imageUrl.trim().length > 0),
        [imageUrls],
    );
    const clampedInitialIndex = Math.max(
        0,
        Math.min(initialIndex, Math.max(0, validImageUrls.length - 1)),
    );
    const [currentIndex, setCurrentIndex] = useState(clampedInitialIndex);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(clampedInitialIndex);
        }
    }, [clampedInitialIndex, visible]);

    const handleScrollEnd = (
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
        if (previewWidth <= 0 || validImageUrls.length <= 1) {
            return;
        }

        const nextIndex = Math.round(
            event.nativeEvent.contentOffset.x / previewWidth,
        );

        setCurrentIndex(Math.max(
            0,
            Math.min(nextIndex, validImageUrls.length - 1),
        ));
    };

    if (!visible || validImageUrls.length === 0) {
        return null;
    }

    return (
        <Modal
            animationType='fade'
            navigationBarTranslucent
            onRequestClose={onClose}
            statusBarTranslucent
            visible
        >
            <SafeAreaView edges={['top', 'bottom']} style={styles.page}>
                <FlatList
                    data={validImageUrls}
                    horizontal
                    pagingEnabled
                    bounces={false}
                    decelerationRate='fast'
                    getItemLayout={(_, index) => ({
                        index,
                        length: previewWidth,
                        offset: previewWidth * index,
                    })}
                    initialNumToRender={1}
                    initialScrollIndex={clampedInitialIndex}
                    keyExtractor={(imageUrl, index) => `${imageUrl}:${index}`}
                    maxToRenderPerBatch={1}
                    onMomentumScrollEnd={handleScrollEnd}
                    removeClippedSubviews
                    renderItem={({ item: imageUrl, index }) => (
                        <View
                            accessibilityLabel={`图片,第${index + 1}张,共${validImageUrls.length}张`}
                            accessible
                            style={[
                                styles.pictureContainer,
                                { width: previewWidth },
                            ]}
                        >
                            <BilibiliImage
                                contentFit='contain'
                                priority='high'
                                style={styles.picture}
                                uri={imageUrl}
                            />
                        </View>
                    )}
                    scrollEnabled={validImageUrls.length > 1}
                    showsHorizontalScrollIndicator={false}
                    style={styles.list}
                    updateCellsBatchingPeriod={50}
                    windowSize={3}
                />

                <Pressable
                    accessibilityLabel='关闭图片预览'
                    accessibilityRole='button'
                    onPress={onClose}
                    style={({ pressed }) => [
                        styles.closeButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <Text style={styles.closeButtonText}>关闭</Text>
                </Pressable>

                <View pointerEvents='none' style={styles.counter}>
                    <Text style={styles.counterText}>
                        {currentIndex + 1}/{validImageUrls.length}
                    </Text>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: colors.pageBackground,
    },
    list: {
        flex: 1,
    },
    pictureContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    picture: {
        width: '100%',
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.md,
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        backgroundColor: colors.mediaOverlayBackground,
    },
    closeButtonText: {
        color: colors.primaryText,
        fontSize: 14,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.7,
    },
    counter: {
        position: 'absolute',
        bottom: spacing.lg,
        alignSelf: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        backgroundColor: colors.mediaOverlayBackground,
    },
    counterText: {
        color: colors.primaryText,
        fontSize: 13,
        fontWeight: '600',
    },
});
