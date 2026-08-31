import { StyleSheet, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { colors } from '@/theme/colors';

type Props = {
    onLoginPress: () => void;
};

export default function MainPage({ onLoginPress }: Props) {
    return (
        <View style={styles.page}>
            <AppButton
                onPress={onLoginPress}
                title='登录'
            />
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.pageBackground,
    },
});
