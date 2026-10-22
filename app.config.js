export default ({ config }) => ({
    ...config,
    name: 'Myfollow',
    android: {
        ...config.android,
        package: 'com.dylan.myfollow',
    },
});
