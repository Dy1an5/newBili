# newBili

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
- Android 设备或模拟器 (已安装 development build)
- EAS 账号 (用于云端构建 development client)

### 安装依赖

```bash
corepack pnpm install
```

### 构建 development client

项目使用 `expo-dev-client`, 首次需要在 EAS 云端构建 APK 并安装到设备:

```bash
corepack pnpm exec eas build --profile development --platform android
```

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
