import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export type CollapsiblePageScrollHandle = {
    scrollToOffset: (offset: number, animated?: boolean) => void;
};

export type CollapsiblePageScrollProps = {
    headerSpacerHeight: number;
    minimumContentHeight: number;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};
