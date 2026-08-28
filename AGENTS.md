# 项目指南

## 参考项目

- 原项目:~/home/dylan/Projects/bilidynamic1
- 参考项目:~/home/dylan/Projects/PiliPlus

## 项目目标

- 本项目使用 Expo、React Native 和 TypeScript 开发 Android B站客户端。当前采用学习式渐进开发：先完成能够运行的小模块，理解语法、数据和调用关系，再逐步拆分目录和建立完整架构。现阶段不追求一次实现全部页面
- ios 客户端在考虑中,但先实现原项目的所有功能

## 代码规范

- 采用四个空格缩进、单引号和分号。
- 在输入中文时,符号保持使用英文字符

## 协作与操作原则

- 使用中文交流；文件名、命令、接口字段和代码标识符保留原文。
- 除非用户明确要求，不安装依赖、不生成原生工程、不写入或删除文件。
- 添加依赖前先说明用途、是否包含原生代码、是否需要重新构建。
- 所有 Node 依赖只安装在当前项目，禁止全局安装。统一通过 Corepack 调用仓库指定的 pnpm。
- 修改前读取现有文件，保留用户已有内容；实现后执行与风险相称的检查。
- 添加依赖提供终端命令

## 模块实施顺序

每个功能按照以下顺序推进：

1. 明确当前模块的输入、输出和可观察结果。
2. 检查现有代码与依赖，确认是否能直接实现。
3. 在独立 TypeScript 文件中编写最小业务逻辑。
4. 只在入口文件加入必要的导入和调用，不提前建立复杂分层。
5. 需要使用b站api时,先阅读原项目和参考项目
6. 运行 `corepack pnpm exec tsc --noEmit`。
7. 由用户在 Android 开发构建中验证真实行为，并根据实际 JSON 或错误码继续调整。
8. 模块稳定后再补充类型、错误映射、测试、存储和界面。

## 具体功能模块

并不是要直接实现所有功能,先了解,提前确定需要的环境和依赖,重要的提前安装

1. 主界面:先判断是否有登录信息.如果没有,主界面为空白页面加登录按钮;如果有,跳转到首页.
2. 登录页面:b站官方webview,模仿浏览器端登录后获取cookie.
3. 首页页面:所有关注up主的动态,动态分为视频动态和图文动态,其他不展示.分别设计单个视频动态和单个图文动态卡片的样式.记录up主id,用于后续分组获取.
4. 收藏页面:获取我收藏的视频
5. 稍后再看页面:获取我稍后再看的视频

## 安全要求

不得提交、保存到普通文件、截图或公开输出完整 Cookie、`SESSDATA`、`bili_jct`、签名密钥和 EAS Token。GET 接口只携带必要 Cookie；写操作才使用 CSRF。Cookie 不解码、不重新编码，使用结束后不进入日志。遇到风控错误时先记录错误码，不盲目增加全部 Cookie 或无限重试。

## 当前已实现的项目操作逻辑

本节记录项目当前真实存在的调用关系和行为。后续开发应在这些逻辑上渐进修改,不要把计划中的功能当成已经实现的功能。

### 1. 应用启动与登录状态

1. `src/index.ts` 启动 `App`。
2. `App` 初始状态为 `checking`,通过 `getLoginCookie()` 从 Expo SecureStore 读取登录 Cookie。
3. SecureStore 中没有包含有效 `SESSDATA` 的 Cookie 时,进入 `MainPage`,页面只提供登录入口。
4. 存在有效登录信息时,进入 `NavigationContainer` 和 `MainTabNavigator`。
5. 登录信息读取失败时按未登录处理,不在界面或日志中输出 Cookie。

应用状态流:

```text
checking
├─ 无有效Cookie或读取失败 → main → 点击登录 → login
└─ 有有效Cookie → authenticated → MainTabNavigator

login
├─ 登录成功 → authenticated
└─ 取消登录 → main
```

### 2. WebView登录与Cookie保存

1. `LoginPage` 打开B站官方登录地址 `https://passport.bilibili.com/login`。
2. WebView加载完成后,通过 CookieManager 读取B站域名的 Cookie header。
3. `hasLoginCookie()` 只根据是否存在非空 `SESSDATA` 判断登录是否完成。
4. 登录成功后,完整 Cookie 只保存到 Expo SecureStore,不写入普通文件。
5. `isCheckingCookie` 防止并发检查,`isLoginComplete` 防止登录成功回调重复执行。
6. `clearLoginCookie()` 已提供清除 SecureStore 登录信息的能力,当前页面尚未接入退出登录按钮。

### 3. 主导航结构

登录后的根导航是三个 Bottom Tab,每个需要进入视频详情的 Tab 内部使用独立 Native Stack:

```text
MainTabNavigator
├─ HomeTab → HomeStack
│  ├─ Home → FollowingPage
│  └─ VideoDetail → VideoDetailPage
├─ FavoritesTab → FavoritesStack
│  ├─ FavoriteFolders → FavoriteFoldersPage
│  ├─ FavoriteVideos → FavoriteVideosPage
│  └─ VideoDetail → VideoDetailPage
└─ WatchLaterTab → WatchLaterStack
   ├─ WatchLaterList → WatchLaterPage
   └─ VideoDetail → VideoDetailPage
```

页面组件不直接依赖导航对象。页面通过 `onVideoPress`、`onFolderPress` 和 `onBack` 等普通 Props 回调表达操作,导航包装组件负责调用 `navigate()` 或 `goBack()`。

### 4. 关注动态页面

1. `FollowingPage` 打开后从 SecureStore 获取 Cookie。
2. `fetchVideoFollowingPage()` 请求 `x/polymer/web-dynamic/v1/feed/all`,当前只解析视频动态。
3. 请求函数把不可信 JSON 转换成 `VideoFollowingItem`,无法识别的项目被过滤。
4. 页面使用 `FlatList` 和 `VideoFollowingCard` 展示视频动态,支持首次加载、错误重试、空列表和下拉刷新。
5. 点击视频卡片后,页面调用 `onVideoPress(video)`,由 `HomeStack` 打开统一的 `VideoDetailPage`。
6. 当前关注动态还没有实现图文动态卡片和基于UP主ID的分组功能。

### 5. 收藏夹与收藏视频

收藏功能分为两层:

1. `FavoriteFoldersPage` 请求当前用户创建的收藏夹,使用两列卡片显示收藏夹名称和视频数量。
2. 点击收藏夹后,`FavoritesStack` 把 `FavoriteFolder` 作为参数传给 `FavoriteVideosPage`。
3. `FavoriteVideosPage` 按 `media_id` 分页请求收藏视频。
4. 第一页替换列表,后续页追加数据并根据视频ID去重。
5. 页面支持首次加载、错误重试、空列表、下拉刷新、触底分页和底部加载状态。
6. 点击收藏视频后进入统一的 `VideoDetailPage`。

收藏夹列表接口需要 `DedeUserID` 作为查询参数并携带必要的 `SESSDATA`;收藏视频GET请求只携带必要的 `SESSDATA`,不携带CSRF。

### 6. 稍后再看页面

1. `WatchLaterPage` 打开后调用 `fetchWatchLaterVideoPage(1, cookie, signal)`。
2. 请求使用 `x/v2/history/toview/web`,参数包含页码、每页20条、观看筛选、排序和 `web_location`。
3. 参数通过 `createWbiSignedQuery()` 添加 `wts` 和 `w_rid` 后再发送GET请求。
4. 请求只从完整 Cookie 中提取并携带 `SESSDATA`。
5. 接口项目被转换成 `WatchLaterVideo`,主要保存 `bvid`、`cid`、总时长和观看进度。
6. 页面复用收藏视频卡片,根据进度显示“未观看”、“已看完”或“已观看至mm:ss”。
7. 页面支持首次加载、错误重试、空列表、下拉刷新、触底分页、分页去重、总数显示和底部加载状态。
8. 刷新会取消旧请求;页面卸载时也会取消当前请求。
9. 点击视频后由 `WatchLaterStack` 打开统一的 `VideoDetailPage`。

### 7. 视频基础类型与共享卡片

视频类型按共享程度组织:

```text
VideoItem
├─ VideoFollowingItem
└─ VideoCardItem
   ├─ FavoriteVideo
   └─ WatchLaterVideo
```

- `VideoItem`: `id`、`bvid`、标题、封面、UP主、发布时间和可选统计数据。
- `VideoFollowingItem`: 在基础视频上增加动态接口使用的可选时长文字。
- `VideoCardItem`: 在基础视频上增加秒数形式的 `durationSeconds`。
- `FavoriteVideo`: 增加 `favoriteAt`。
- `WatchLaterVideo`: 增加 `cid` 和 `progressSeconds`。

`src/components/favorites/FavoriteVideoCard.tsx` 虽然保留当前文件名,但 Props 已使用通用 `VideoCardItem`。卡片只处理标题、封面、UP主和时长等共享展示;收藏时间或观看进度由各页面通过可选 `metaText` 传入。

### 8. 视频详情与播放

1. 列表页把包含 `bvid` 的视频对象传给 `VideoDetailPage`。
2. `fetchVideoParts()` 请求 `x/web-interface/view`,读取视频分P列表和 `cid`。
3. 页面默认选中第一P;用户切换分P后重新请求该P的播放地址。
4. `fetchVideoPlayback()` 使用 `bvid + cid` 请求 `x/player/wbi/playurl`。
5. 播放地址请求通过WBI签名,当前请求单文件渐进式视频流;接口只返回DASH且没有可用单文件地址时显示错误。
6. `expo-video` 的 `useVideoPlayer` 创建播放器并自动播放,`VideoView` 提供原生控制和横屏全屏。
7. 播放源携带必要的 `Referer` 和 `User-Agent`,不把 Cookie 传给媒体地址。
8. 页面支持加载状态、播放错误、重新加载、分P选择、应用内返回和Android硬件返回。

### 9. WBI签名逻辑

1. `src/tool/wbi.ts` 请求 `x/web-interface/nav` 获取 `img_key` 和 `sub_key`。
2. 两个key经过混排生成 mixin key,再对排序和编码后的参数计算MD5签名。
3. 签名结果添加 `wts` 和 `w_rid`。
4. mixin key按自然日缓存,并复用正在进行中的key请求,避免重复访问nav接口。
5. 播放接口遇到 `-403` 时清除WBI key缓存,下一次操作重新获取;当前不会无限自动重试。

### 10. 请求、解析与页面状态的通用模式

新增列表模块时优先沿用以下调用顺序:

```text
页面useEffect或用户操作
    ↓
从SecureStore读取Cookie
    ↓
提取接口需要的最少Cookie字段
    ↓
需要时生成WBI签名
    ↓
fetch + AbortSignal
    ↓
检查HTTP状态和B站code
    ↓
把unknown JSON安全转换成项目类型
    ↓
更新loading、error、empty、refresh或pagination状态
```

具体约定:

- 外部 JSON 先按 `unknown` 处理,通过 `asRecord`、`readString`、`readNumber` 和URL标准化函数读取。
- 每个业务请求模块使用自己的错误类并保留可选错误码,例如 `FollowingRequestError`、`FavoritesRequestError`、`WatchLaterRequestError` 和 `VideoPlaybackError`。
- 页面使用 `AbortController` 取消刷新前的旧请求和卸载后的请求。
- 请求控制器保存在 `useRef` 中,加载、错误、刷新和分页等可观察数据保存在 `useState` 中。
- 依赖旧列表追加数据时使用函数式 `setState`,并在分页时根据ID去重。
- 业务页面通过 Props 回调输出用户操作,导航层负责路由跳转。
- GET请求不使用CSRF;未来添加删除、移动、清空等写操作时才读取 `bili_jct` 并携带CSRF。

### 11. 当前功能边界

- 当前已经有登录、视频动态、收藏夹、收藏视频、稍后再看和视频播放的最小可运行链路。
- 当前没有实现图文动态、动态分组、退出登录界面、收藏写操作、稍后再看删除或清空、搜索和其他完整客户端功能。
- 当前稍后再看和收藏视频共用卡片展示,但仍保留各自独立的接口类型和页面状态。
- 当前以Android开发构建的真实行为为准;修改接口解析或播放参数后仍需运行 `corepack pnpm exec tsc --noEmit`,再由用户在Android中验证。
