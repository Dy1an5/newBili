import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { ScrollHandlerProcessed } from 'react-native-reanimated';

export type CollapsiblePageScrollHandle = {
    scrollToOffset: (offset: number, animated?: boolean) => void;
};

export type CollapsiblePageScrollProps = {
    headerSpacerHeight: number;
    minimumContentHeight: number;
    onScroll: ScrollHandlerProcessed<Record<string, unknown>>;
    onScrollEnd: (
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => void;
};
