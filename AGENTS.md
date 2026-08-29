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
3. 首页页面:所有关注up主的动态,当前展示视频动态和图文动态,其他不展示.设计对应的单个动态卡片样式.记录up主id,用于后续分组获取.
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
│  └─ VideoDetail → VideoDetailPage
└─ WatchLaterTab → WatchLaterStack
   ├─ WatchLaterList → WatchLaterPage
   └─ VideoDetail → VideoDetailPage
```

页面组件不直接依赖导航对象。页面通过 `onVideoPress` 和 `onBack` 等普通 Props 回调表达操作,导航包装组件负责调用 `navigate()` 或 `goBack()`。

页面相关功能按模块放在 `src/page` 下:

```text
src/page
├─ following
│  ├─ FollowingPage.tsx
│  └─ fetchFollowing.ts
├─ favorites
│  ├─ FavoriteFoldersPage.tsx
│  └─ fetchFavorites.ts
├─ watchLater
│  ├─ WatchLaterPage.tsx
│  └─ fetchWatchLater.ts
└─ video
   ├─ VideoDetailPage.tsx
   ├─ fetchVideoPlayback.ts
   └─ videoPlaybackTarget.ts
```

三个视频列表页面的 `onVideoPress` 都输出统一的 `VideoPlaybackTarget`,导航层不再传递某个列表 API 的完整视频对象。

### 4. 关注动态页面

1. `FollowingPage` 打开后从 SecureStore 获取 Cookie,分别加载动态首页和关注分组;分组请求失败不影响“全部”动态。
2. `fetchFollowingPage()` 使用 `type=all` 请求 `x/polymer/web-dynamic/v1/feed/all`,当前解析顶层视频和图文动态,不解析转发动态内的 `orig`。首页替换列表,后续页按 `dynamicId` 去重追加。
3. `parseFollowingItem()` 优先按外层 `item.type` 区分 `DYNAMIC_TYPE_AV` 和 `DYNAMIC_TYPE_DRAW`,再使用 `major.type` 验证 `MAJOR_TYPE_ARCHIVE` 或 `MAJOR_TYPE_OPUS`,并转换成 `FollowingItem`。
4. Opus正文依次读取 `module_dynamic.desc.text`、`major.opus.summary.text` 和 `major.opus.title`;图片依次读取 `major.opus.pics[].url` 和 `src`。文本转换时会去除首尾空白和空行,避免空行占用卡片标题行。
5. 页面使用联合类型上的 `kind` 分派视频和图文动态;图文正文默认显示2行,只有实际超过2行时才显示“展开”,展开后可在卡片内“收起”。
6. 图文卡片最多展示9张缩略图:1张使用单列大图,2张或4张使用两列,其他数量使用三列;无图片时不渲染图片区域。点击缩略图会打开黑色全屏预览,可水平切换、关闭或使用 Android 返回键退出。
7. `fetchFollowingGroups()` 请求 `x/relation/tags`,页面在顶部使用可水平滚动的 `FollowingGroupSelector` 展示“全部”、系统分组和自定义分组,默认选中“全部”。
8. 首次选择分组时,`fetchFollowingGroupMemberMids()` 使用 `DedeUserID + tagid` 分页请求 `x/relation/tag`;成员MID按 `tagId` 在内存中缓存,再使用动态的 `author.mid` 本地过滤。
9. 页面通过 `onEndReached`、滚动位置和内容尺寸共同检测列表底部;“全部”每次请求1页,分组动态每次连续扫描最多3页,中途找到匹配动态也会完成本轮扫描。连续3页没有匹配时暂停自动扫描并显示“继续加载”;其他情况下到达底部会自动请求,短列表也会在内容未填满视口时继续加载。
10. 下拉刷新保留当前选择,刷新动态首页和分组列表,清除其他分组成员缓存并重新加载当前分组;当前分组旧缓存会保留到新成员数据返回,避免刷新时清空卡片或显示额外的分组成员加载状态。分组已不存在时回退到“全部”。
11. 页面分别处理动态、分组列表、分组成员和触底分页的加载、空数据与错误状态;切换分组、刷新和卸载时会取消失效请求。
12. 点击视频卡片后,页面通过 `createVideoPlaybackTarget(video)` 输出不含 `initialCid` 的 `VideoPlaybackTarget`,由 `HomeStack` 打开统一的 `VideoDetailPage`。

### 5. 收藏夹与收藏视频

收藏夹与收藏视频在同一页面展示:

1. `FavoriteFoldersPage` 请求当前用户创建的收藏夹,顶部使用可水平滚动的 `FavoriteFolderSelector` 展示收藏夹名称和视频数量,默认选中第一个收藏夹。
2. 页面按选中收藏夹的 `media_id` 分页请求收藏视频;切换收藏夹时取消旧请求、清空旧列表并加载新收藏夹第一页。
3. `parseFavoriteVideo()` 把每条原始收藏数据转换成 `FavoriteVideo`,统一 `bvid`或`bv_id`、`cover`、`upper`、`cnt_info` 和 `fav_time` 等接口字段。
4. 第一页替换列表,后续页追加数据并根据 `bvid` 去重。
5. 下拉刷新同时刷新收藏夹和当前视频列表,保留仍然存在的当前选择;收藏夹已不存在时回退到第一个。
6. 页面分别处理收藏夹与收藏视频的首次加载、错误重试和空状态,并支持触底分页和底部加载状态。
7. 点击收藏视频后通过 `createVideoPlaybackTarget(video)` 输出不含 `initialCid` 的 `VideoPlaybackTarget`,再进入统一的 `VideoDetailPage`。

收藏夹列表接口需要 `DedeUserID` 作为查询参数并携带必要的 `SESSDATA`;收藏视频GET请求只携带必要的 `SESSDATA`,不携带CSRF。

### 6. 稍后再看页面

1. `WatchLaterPage` 打开后调用 `fetchWatchLaterVideoPage(1, cookie, options, signal)`。
2. 请求使用 `x/v2/history/toview/web`,参数包含页码、每页20条、排序和 `web_location`;当前固定请求全部观看状态。
3. 参数通过 `createWbiSignedQuery()` 添加 `wts` 和 `w_rid` 后再发送GET请求。
4. 请求只从完整 Cookie 中提取并携带 `SESSDATA`。
5. `parseWatchLaterVideo()` 把每条原始数据转换成 `WatchLaterVideo`,统一 `pic`、`owner`、`stat`、`pubdate` 等接口字段。
6. `WatchLaterVideo` 主要保存 `bvid`、可选的 `aid` 和 `cid`、`durationSeconds` 和 `progressSeconds`;缺少有效 `cid` 的视频不会仅因此被过滤。
7. 页面与收藏视频共用 `VideoListCard`,通过 `metaText` 显示视频发布时间。
8. 页面顶部使用与动态分组、收藏夹选择条等高的 `WatchLaterToolbar`,左侧直接显示“稍后再看(数量)”,右侧通过分段按钮切换“最近添加/最早添加”;排序会应用到首次请求与后续分页。
9. 页面支持首次加载、错误重试、空列表、下拉刷新、触底分页、按 `bvid` 去重、总数显示和底部加载状态。
10. 切换排序或刷新时会取消旧请求;页面卸载时也会取消当前请求。
11. 点击视频时通过 `createVideoPlaybackTarget(video, video.cid)` 把可用 `cid` 转换成 `initialCid`,再由 `WatchLaterStack` 打开统一的 `VideoDetailPage`。

### 7. 视频基础类型与共享卡片

视频类型按共享程度组织:

```text
VideoSummary
├─ FollowingVideo
└─ VideoWithDuration
   ├─ FavoriteVideo
   └─ WatchLaterVideo

FollowingItem
├─ FollowingVideo
└─ FollowingPicture

FollowingGroup
└─ 关注分组选择和成员MID查询使用的本地类型

VideoPlaybackTarget
└─ 列表页面跳转到VideoDetailPage使用的最小播放参数
```

- `VideoSummary`: `bvid`、`title`、`coverUrl`、`author`、`publishedAt` 和可选 `stats`;不包含含义不确定的公共 `id`。
- `VideoAuthor`: `mid`、`name` 和 `avatarUrl`。
- `VideoStats`: 可选的 `viewCount` 和 `danmakuCount`。
- `FollowingItem`: 关注动态列表使用的 `FollowingVideo | FollowingPicture` 可辨识联合,两者通过 `kind` 区分。
- `FollowingVideo`: 在 `VideoSummary` 上增加 `kind: 'video'`、`dynamicId` 和可选 `durationText`。
- `FollowingPicture`: 保存 `kind: 'picture'`、`dynamicId`、`contentText`、`imageUrls`、`author` 和 `publishedAt`。
- `FollowingGroup`: 保存 `tagId`、`name`、`memberCount` 和可选 `tip`。
- `VideoWithDuration`: 在 `VideoSummary` 上增加秒数形式的 `durationSeconds`。
- `FavoriteVideo`: 增加可选 `aid` 和 `favoritedAt`。
- `WatchLaterVideo`: 增加可选 `aid`、可选 `cid` 和 `progressSeconds`。
- `VideoPlaybackTarget`: 只包含 `bvid`、可选 `initialCid`、`title` 和可选 `authorName`。

`src/components/video/VideoListCard.tsx` 使用通用 `VideoWithDuration`,供收藏和稍后再看页面复用。卡片只处理标题、封面、UP主和时长等共享展示;收藏时间或发布时间由各页面通过可选 `metaText` 传入。动态页面分别使用 `src/components/following/FollowingVideoCard.tsx` 和 `src/components/following/FollowingPictureCard.tsx`。

API 原始字段只在各模块解析函数中读取,解析后的字段使用本地 `camelCase` 语义名称,不添加 `_local` 后缀。

### 8. 视频详情与播放

1. 三个列表页点击卡片时调用 `createVideoPlaybackTarget()`,只把 `VideoPlaybackTarget` 交给导航和 `VideoDetailPage`。
2. 动态和收藏不提供 `initialCid`;稍后再看在有效 `cid` 存在时把它作为 `initialCid`。
3. `fetchVideoParts()` 使用 `target.bvid` 请求 `x/web-interface/view`,读取视频分P列表和 `cid`。
4. 如果 `initialCid` 能在分P列表中找到,页面优先选中对应分P;否则默认选中第一P。用户切换分P后重新请求该P的播放地址。
5. `fetchVideoPlayback()` 使用 `bvid + cid` 请求 `x/player/wbi/playurl`。
6. 播放地址请求通过WBI签名,当前请求单文件渐进式视频流;接口只返回DASH且没有可用单文件地址时显示错误。
7. `expo-video` 的 `useVideoPlayer` 创建播放器并自动播放,`VideoView` 提供原生控制和横屏全屏。
8. 播放源携带必要的 `Referer` 和 `User-Agent`,不把 Cookie 传给媒体地址。
9. 页面支持加载状态、播放错误、重新加载、分P选择、应用内返回和Android硬件返回。

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
- 依赖旧列表追加数据时必须保留最新状态;动态根据 `dynamicId` 去重,收藏和稍后再看列表根据 `bvid` 去重。
- 业务页面通过 Props 回调输出用户操作,导航层负责路由跳转;视频点击统一输出 `VideoPlaybackTarget`。
- GET请求不使用CSRF;未来添加删除、移动、清空等写操作时才读取 `bili_jct` 并携带CSRF。

### 11. 当前功能边界

- 当前已经有登录、视频与图文动态、收藏夹、收藏视频、稍后再看和视频播放的最小可运行链路。
- 当前图文动态只处理顶层 `MAJOR_TYPE_OPUS`,不展示转发内容、其他动态类型和图文详情页。
- 当前已支持读取关注分组并按分组成员MID过滤已加载动态,但不支持创建、修改、删除分组或调整UP主所属分组。
- 当前没有实现退出登录界面、收藏写操作、稍后再看删除或清空、搜索和其他完整客户端功能。
- 当前稍后再看和收藏视频共用卡片展示,但仍保留各自独立的接口类型和页面状态。
- 当前以Android开发构建的真实行为为准;修改接口解析或播放参数后仍需运行 `corepack pnpm exec tsc --noEmit`,再由用户在Android中验证。
