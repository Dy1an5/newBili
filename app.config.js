const appVariant = process.env.APP_VARIANT;

function getAppName() {
    if (appVariant === 'development') {
        return 'newBili Dev';
    }

    if (appVariant === 'preview') {
        return 'newBili Preview';
    }

    return 'newBili';
}

function getAndroidPackage() {
    if (appVariant === 'development') {
        return 'com.dylan.newbili.dev';
    }

    if (appVariant === 'preview') {
        return 'com.dylan.newbili.preview';
    }

    return 'com.dylan.newbili';
}

export default ({ config }) => ({
    ...config,
    name: getAppName(),
    android: {
        ...config.android,
        package: getAndroidPackage(),
    },
});
