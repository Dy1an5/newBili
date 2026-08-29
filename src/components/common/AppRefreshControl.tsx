import {
    RefreshControl,
    type RefreshControlProps,
} from 'react-native';

import { colors } from '@/theme/colors';

type Props = Omit<
    RefreshControlProps,
    'colors' | 'progressBackgroundColor' | 'tintColor'
> & {
    refreshing: boolean;
    onRefresh: () => void;
};

export default function AppRefreshControl({
    refreshing,
    onRefresh,
    ...refreshControlProps
}: Props) {
    return (
        <RefreshControl
            {...refreshControlProps}
            colors={[colors.primary]}
            onRefresh={onRefresh}
            progressBackgroundColor={colors.primarySoft}
            refreshing={refreshing}
            tintColor={colors.primary}
        />
    );
}
