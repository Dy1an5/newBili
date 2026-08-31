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
- 本项目以用户学习为主要目标.除非用户针对某一步明确要求代为修改,助手不直接修改源代码文件.
- 助手每次只讲解并安排一个足够小的步骤,说明为什么修改,数据如何流动,以及涉及哪些 TypeScript 或 React 概念.
- 代码默认由用户亲自输入或修改,助手负责提供示例,检查结果,解释错误和建议下一步.
- 不一次生成完整模块,不跨越尚未理解的阶段,不提前引入复杂框架.
- 安装依赖前先学习它的用途,运行环境,原生代码影响和替代方案,再由用户决定是否安装.
- 计划中的 Agent,数据库和总结能力不得写入"当前已实现的项目操作逻辑",只有真实完成并在 Android 开发构建中验证后才能更新该章节.

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

## 本地Agent学习方向

本项目的长期方向是在现有B站客户端中加入本地 Agent 编排能力,逐步实现视频总结,基于收藏的推荐和智能搜索.这里的"本地 Agent"指任务编排,提示词构造,数据读取,输出校验和结果存储运行在手机中,模型推理仍由用户配置的远程大模型 API 完成.

### 1. 技术选型

- Agent 使用 TypeScript 编写,放在 `src/agent` 中并跟随 Expo 应用打包.
- `src/agent/core` 保持平台无关,不导入 React Native,Expo,页面组件或B站请求模块.
- 第一版自行实现轻量的 `Provider + PromptSpec + TaskRunner`,不引入 Python,LangChain 或 `pi-agent-core`.
- 视频总结首先作为确定性工作流实现:获取详情 -> 获取字幕 -> 调用模型 -> 校验输出 -> 保存结果.
- Agent 核心先在 Node 控制台使用 fake provider 验证,再在 Node 控制台验证真实 Provider,最后才接入 Expo 页面.
- 当未来出现需要模型自主选择并连续调用多个工具的功能时,再评估 Agent loop 框架.
- 采用 Agent 框架前必须先验证 Metro production bundle,Android Hermes,流式响应,`AbortSignal`,Node API 依赖和包体变化.
- 首批模型接口为 OpenAI,Anthropic,Gemini 和 OpenAI-compatible.
- 首版优先使用 React Native 现有的 `fetch`,不为每个 Provider 安装官方 SDK.

### 2. 视频唯一标识

B站 UGC 视频需要区分"视频稿件"和"实际分P内容":

```text
视频: bilibili:video:{bvid}
分P: bilibili:video:{bvid}:part:{cid}
```

- `bvid` 是当前 UGC 视频稿件的主标识.
- `cid` 标识具体的播放内容和字幕,单P视频也保存 `cid`.
- 视频详情和整部视频总结以 `bvid` 关联.
- 分P,字幕和分P总结以 `bvid + cid` 关联.
- `aid` 只作为可选别名,不作为本地主键.
- 不使用动态ID,收藏记录ID或稍后再看记录ID标识视频.
- 外部数字ID在领域类型和数据库中优先作为字符串保存,避免 JavaScript 数字精度问题.
- 未来支持番剧时单独设计 `seasonId + epId` 标识,不强行复用 UGC 视频标识.

### 3. 视频数据与总结关系

- 视频列表只保存展示需要的预览数据,不作为 Agent 的完整输入.
- 总结前使用 `bvid` 获取视频详情和分P,再使用 `bvid + cid` 获取当前分P字幕.
- Agent 总结输入包含视频标题,简介,UP主,分区,标签,分P信息和带时间范围的字幕.
- 总结输入不包含 Cookie,API key,播放URL,评论,弹幕或其他模型生成的总结.
- 没有字幕时不调用模型,不使用标题和简介伪造内容总结.
- 字幕内容经过标准化后生成 `sourceHash`,用于判断总结依赖的字幕版本.
- 每次 Agent 运行使用独立的 `runId`,并记录功能类型,视频标识,Provider,模型,prompt版本,`sourceHash`,状态和结构化输出.
- 同一分P可以保留不同 Provider,模型,提示词和字幕版本生成的多份总结.
- 整部视频总结由已验证的各分P总结聚合,不在一次请求中无限追加所有原始字幕.

### 4. 提示词与输出规则

- 不同功能使用独立且带版本号的 `PromptSpec`,不使用一段不断追加条件的巨大提示词.
- 第一批提示词为 `video_part_summary@1` 和 `video_aggregate_summary@1`.
- 未来的收藏兴趣提取,推荐解释,搜索改写和搜索排序分别使用独立提示词.
- system约束和结构化输出不允许用户覆盖,用户只能提供长度受限的附加关注要求.
- 字幕作为不可信引用数据,字幕中的指令不得覆盖 system prompt.
- 模型输出必须符合固定 JSON schema,并经过本地类型,字段,数量和时间范围校验后才能保存为有效总结.
- 格式错误时最多发起一次修复请求,修复后仍不合法则保存失败状态,不无限重试.
- 总结重点和章节应关联原始字幕时间范围,并记录无法确定的信息.

### 5. Provider与安全边界

- Provider 的非敏感配置可以保存到 SQLite,API key 只保存到 Expo SecureStore.
- 官方 Provider 使用固定 base URL,OpenAI-compatible 允许用户配置 HTTPS base URL 和 model ID.
- 不在 APK 中包含开发者共享密钥或默认密钥.
- 不记录请求体,Authorization header,API key,完整字幕或模型原始错误响应.
- 删除 Provider 配置时同步删除 SecureStore 中对应的密钥.
- 首版面向个人或小范围侧载,用户需要知道 API key 会由本机应用直接发送给所选 Provider.
- 如果未来公开发布,需要重新评估服务端轻量代理,密钥风险提示和日志审计.

### 6. 学习式实施顺序

1. 理解 `bvid`,`aid`,`cid` 和现有 `VideoPlaybackTarget` 的调用关系.
2. 定义 `VideoIdentity`,`VideoPartIdentity` 和本地 `entityKey`.
3. 从视频详情接口解析完整视频和分P数据.
4. 学习 SQLite 表,主键,联合主键和迁移,再保存视频详情.
5. 获取当前分P的字幕轨道和字幕 JSON.
6. 将字幕转换为带时间范围的 `SubtitleCue[]`.
7. 在 Node 控制台使用 fake provider 学习 Agent 输入,输出和错误处理,暂不调用真实模型.
8. 编写并理解 `video_part_summary@1` 提示词和输出解析器.
9. 接入第一个真实 Provider,由用户在 Node 控制台输入密钥并验证最小请求.
10. 保存 Agent 运行记录,总结内容和历史版本.
11. 在视频详情页加入手动生成总结的最小入口.
12. 依次增加其他 Provider.
13. 实现多分P总结和整部视频聚合.
14. 数据稳定后再实现收藏推荐和智能搜索.
15. 真正出现自主多步工具调用需求后,再引入 Agent loop.

每个阶段继续使用以下学习闭环:

```text
讲清概念和目标
    ↓
确认输入,输出和数据流
    ↓
只给出一个小改动
    ↓
用户亲自修改
    ↓
运行TypeScript检查
    ↓
如果是Agent核心,先在Node控制台验证
    ↓
用户在Android验证
    ↓
一起阅读结果和错误
    ↓
确认理解后进入下一步
```

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
- `VideoPlaybackTarget`: 只包含 `bvid`、可选 `initialCid`、`title`、可选 `authorName` 和可选 `authorAvatarUrl`。

`src/components/video/VideoListCard.tsx` 使用通用 `VideoWithDuration`,供收藏和稍后再看页面复用。卡片只处理标题、封面、UP主和时长等共享展示;收藏时间或发布时间由各页面通过可选 `metaText` 传入。动态页面分别使用 `src/components/following/FollowingVideoCard.tsx` 和 `src/components/following/FollowingPictureCard.tsx`。

API 原始字段只在各模块解析函数中读取,解析后的字段使用本地 `camelCase` 语义名称,不添加 `_local` 后缀。

### 8. 视频详情与播放

1. 三个列表页点击卡片时调用 `createVideoPlaybackTarget()`,只把 `VideoPlaybackTarget` 交给导航和 `VideoDetailPage`。
2. 动态和收藏不提供 `initialCid`;稍后再看在有效 `cid` 存在时把它作为 `initialCid`。
3. `fetchVideoParts()` 使用 `target.bvid` 请求 `x/web-interface/view`,读取视频分P列表、`cid` 和画面尺寸。
4. 如果 `initialCid` 能在分P列表中找到,页面优先选中对应分P;否则默认选中第一P。用户切换分P后重新请求该P的播放地址。
5. `fetchVideoPlayback()` 使用 `bvid + cid` 请求 `x/player/wbi/playurl`。
6. 播放地址请求通过WBI签名,当前请求单文件渐进式视频流;接口只返回DASH且没有可用单文件地址时显示错误。
7. `expo-video` 的 `useVideoPlayer` 创建播放器并自动播放,`VideoView` 提供原生控制和横屏全屏。
8. 播放源携带必要的 `Referer` 和 `User-Agent`,不把 Cookie 传给媒体地址。
9. 详情页不显示顶部标题栏和底部主导航,返回交给 Native Stack 处理Android系统返回手势和返回键。
10. 播放器按当前分P画面比例分级调整高度:横屏按原比例、接近方形时最多占屏幕高度的42%、竖屏固定占48%;标题默认显示2行并可展开,UP主区域展示头像。
11. 播放器固定在页面上方,标题、UP主和分P选择位于有分隔线的独立纵向滚动区域。

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
