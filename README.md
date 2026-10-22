# orbit

一个使用 Expo 和 React Native 开发的 Android B站第三方客户端, 以学习和渐进实现为目标. iOS 暂不在支持范围内.

当前已具备登录, 关注动态, 收藏, 稍后再看, 视频播放和单分P AI 总结的最小可用链路.

## 功能

- **登录**: WebView 登录B站, Cookie 判断后存入 Expo SecureStore.
- **关注动态**: 关注分组, 视频动态和图文动态, 支持图文动态评论.
- **收藏夹**: 收藏夹列表和收藏视频.
- **稍后再看**: 列表展示和排序.
- **视频播放**: 视频详情, 分P选择和播放, 适配底部小白条.
- **AI 总结**: 获取视频字幕, 调用 DeepSeek 生成单分P总结, 结果缓存到 SQLite.

## 技术栈

- [Expo SDK 57](https://expo.dev) + React Native 0.86 + TypeScript
- expo-video 视频播放, react-native-webview 登录
- expo-secure-store 凭据存储, expo-sqlite 业务数据存储
- React Navigation (Bottom Tabs + Native Stack)
- pnpm (通过 Corepack 执行)

## 目录结构

```
src/
├── agent/        # 字幕获取, DeepSeek Provider, 提示词, 输出校验, 总结界面和 SQLite 缓存
├── auth/         # WebView 登录, Cookie 判断和 SecureStore 存储
├── components/   # 已被多个页面复用的通用组件
├── main/         # 应用入口和根组件
├── navigation/   # 登录后的 Bottom Tab 和功能页面导航
├── page/         # 各功能页面
│   ├── following/  # 关注动态
│   ├── favorites/  # 收藏夹
│   ├── watchLater/ # 稍后再看
│   └── video/      # 视频详情和播放
├── theme/        # 颜色, 间距, 圆角等主题常量
└── tool/         # WBI 签名等独立工具
```

## 开发

### 环境要求

- Node.js 和 Corepack
- Android SDK 和 JDK (本地 Gradle 构建)
- Android 设备 (adb 实机调试)

### 安装依赖

```bash
corepack pnpm install
```

### 构建 development client

项目使用 `expo-dev-client`. 首次构建, 或者修改了 `app.json`/`app.config.js` 的插件, 应用名, 包名和图标后, 先同步原生工程:

```bash
corepack pnpm exec expo prebuild --platform android
```

仅在需要完整重建原生工程时使用 `--clean`,执行前检查本地原生改动.

在项目根目录构建 debug APK:

```bash
corepack pnpm android:build
```

连接真机后构建并安装:

```bash
corepack pnpm android:build :app:installDebug
```

入口脚本要求 Linux systemd 用户会话和 `taskset`.构建进程树的内存硬上限为 6GiB,5GiB 后开始回收,使用 1 个逻辑 CPU 和 1 个 Gradle worker.Gradle Java 堆上限为 1536MiB,Kotlin 编译在 Gradle 进程内执行,仅编译 arm64-v8a.这些设置位于受版本控制的脚本中,prebuild 不会清除它们.如果资源限制无法生效,脚本直接失败.

release 构建使用 `corepack pnpm android:build :app:assembleRelease`.APK 仅适用于 arm64-v8a 设备.

`prebuild --clean` 会删掉 `android/local.properties`. 如果构建报 `SDK location not found`, 在 `android/local.properties` 写入本机 SDK 路径:

```properties
sdk.dir=/path/to/Android/Sdk
```

APK 包名是 `com.dylan.orbit`.

### 启动开发服务

设备安装好 development build 后, 连接设备并启动:

```bash
corepack pnpm dev
```

### 类型检查

```bash
corepack pnpm typecheck
```

## 参考项目

- [PiliPlus](https://github.com/bggRGjQaUbCoE/PiliPlus): 结构和实现参考.
