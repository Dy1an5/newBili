export default ({ config }) => ({
    ...config,
    name: 'orbit',
    android: {
        ...config.android,
        package: 'com.dylan.orbit',
    },
});
