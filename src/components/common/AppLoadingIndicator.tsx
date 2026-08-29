import {
    ActivityIndicator,
    StyleSheet,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';

type Props = {
    style?: StyleProp<ViewStyle>;
};

export default function AppLoadingIndicator({ style }: Props) {
    return (
        <View style={[styles.container, style]}>
            <ActivityIndicator color={colors.primary} size='small' />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.full,
        backgroundColor: colors.primarySoft,
    },
});
