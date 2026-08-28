# 视频模块命名表

## 命名原则

- API 原始字段只在对应请求文件的解析函数中使用,字段名保持接口原样.
- 解析后的本地字段使用 TypeScript `camelCase`,不添加 `_local` 后缀.
- URL 字段使用 `Url` 后缀,例如 `coverUrl`、`avatarUrl`.
- 秒数字段使用 `Seconds` 后缀,例如 `durationSeconds`、`progressSeconds`.
- 数量字段使用 `Count` 后缀,例如 `viewCount`、`totalCount`.
- Unix 时间戳使用过去分词加 `At`,例如 `publishedAt`、`favoritedAt`.
- B站标识使用官方名称,例如 `aid`、`bvid`、`cid`、`mid`.
- 不使用含义不确定的公共 `id`. 动态ID使用 `dynamicId`,视频AV号使用 `aid`.
- 分页结果中的视频数组统一命名为 `videos`,不用含义宽泛的 `items`.

## 三个 API 公共字段映射

| 本地字段 | 关注动态 API | 收藏视频 API | 稍后再看 API | 含义 |
|---|---|---|---|---|
| `bvid` | `modules.module_dynamic.major.archive.bvid` | `bvid`或`bv_id` | `bvid` | 视频BV号 |
| `title` | `modules.module_dynamic.major.archive.title` | `title` | `title` | 视频标题 |
| `coverUrl` | `modules.module_dynamic.major.archive.cover` | `cover` | `pic` | 视频封面URL |
| `author.mid` | `modules.module_author.mid` | `upper.mid` | `owner.mid` | UP主MID |
| `author.name` | `modules.module_author.name` | `upper.name` | `owner.name` | UP主名称 |
| `author.avatarUrl` | `modules.module_author.face` | `upper.face` | `owner.face` | UP主头像URL |
| `publishedAt` | `modules.module_author.pub_ts` | `pubtime` | `pubdate` | Unix发布时间戳,单位为秒 |
| `stats.viewCount` | `archive.stat.play` | `cnt_info.play` | `stat.view` | 播放量 |
| `stats.danmakuCount` | `archive.stat.danmaku` | `cnt_info.danmaku` | `stat.danmaku` | 弹幕量 |

## API 专属字段映射

| 本地字段 | 来源 | 所属类型 | 含义 |
|---|---|---|---|
| `dynamicId` | 动态 `id_str` | `FollowingVideo` | 动态ID |
| `durationText` | 动态 `archive.duration_text` | `FollowingVideo` | 接口已格式化的时长文字 |
| `aid` | 收藏 `id` | `FavoriteVideo` | 视频AV号 |
| `durationSeconds` | 收藏 `duration` | `FavoriteVideo` | 视频总时长,单位为秒 |
| `favoritedAt` | 收藏 `fav_time` | `FavoriteVideo` | 收藏时间戳,单位为秒 |
| `aid` | 稍后再看 `aid` | `WatchLaterVideo` | 视频AV号 |
| `cid` | 稍后再看 `cid` | `WatchLaterVideo` | 分P ID,可能不存在 |
| `durationSeconds` | 稍后再看 `duration` | `WatchLaterVideo` | 视频总时长,单位为秒 |
| `progressSeconds` | 稍后再看 `progress` | `WatchLaterVideo` | 已观看进度,单位为秒 |

## 公共类型

| 类型 | 用途 |
|---|---|
| `VideoAuthor` | 三个 API 统一后的UP主信息 |
| `VideoStats` | 三个 API 统一后的播放量和弹幕量 |
| `VideoSummary` | 视频列表共享的最小展示信息 |
| `VideoWithDuration` | 包含秒数时长的视频列表信息 |
| `FollowingVideo` | 关注动态视频及动态专属字段 |
| `FavoriteVideo` | 收藏视频及收藏专属字段 |
| `WatchLaterVideo` | 稍后再看视频及观看进度字段 |
| `VideoPlaybackTarget` | 三个列表页面跳转到统一播放页时使用的最小参数 |

## 播放参数

| 字段 | 必需 | 含义 |
|---|---|---|
| `VideoPlaybackTarget.bvid` | 是 | 获取分P和播放地址使用的视频BV号 |
| `VideoPlaybackTarget.initialCid` | 否 | 默认选中的分P,稍后再看页面优先提供 |
| `VideoPlaybackTarget.title` | 是 | 详情页和播放器元数据使用的标题 |
| `VideoPlaybackTarget.authorName` | 否 | 详情页展示的UP主名称 |

统一转换函数为 `createVideoPlaybackTarget(video, initialCid?)`.

## 方法命名

| 方法 | 所在文件 | 用途 |
|---|---|---|
| `fetchFollowingVideoPage` | `src/page/following/fetchFollowingVideos.ts` | 获取并解析一页关注动态视频 |
| `fetchFavoriteVideoPage` | `src/page/favorites/fetchFavorites.ts` | 获取并解析一页收藏视频 |
| `fetchWatchLaterVideoPage` | `src/page/watchLater/fetchWatchLater.ts` | 获取并解析一页稍后再看视频 |
| `fetchVideoParts` | `src/page/video/fetchVideoPlayback.ts` | 根据 `bvid` 获取分P和 `cid` |
| `fetchVideoPlayback` | `src/page/video/fetchVideoPlayback.ts` | 根据 `bvid + cid` 获取播放地址 |
| `createVideoPlaybackTarget` | `src/page/video/videoPlaybackTarget.ts` | 把任意 `VideoSummary` 转换成播放页参数 |

## 页面位置

| 页面 | 路径 | 输入或输出 |
|---|---|---|
| `FollowingPage` | `src/page/following/FollowingPage.tsx` | 输出 `VideoPlaybackTarget` |
| `FavoriteFoldersPage` | `src/page/favorites/FavoriteFoldersPage.tsx` | 输出 `FavoriteFolder` |
| `FavoriteVideosPage` | `src/page/favorites/FavoriteVideosPage.tsx` | 输入 `FavoriteFolder`,输出 `VideoPlaybackTarget` |
| `WatchLaterPage` | `src/page/watchLater/WatchLaterPage.tsx` | 输出包含可选 `initialCid` 的 `VideoPlaybackTarget` |
| `VideoDetailPage` | `src/page/video/VideoDetailPage.tsx` | 输入 `VideoPlaybackTarget` |

## 本次替换的旧名称

| 旧名称 | 新名称 | 原因 |
|---|---|---|
| `VideoItem` | `VideoSummary` | 表达它是列表共享摘要,不是完整视频对象 |
| `VideoCardItem` | `VideoWithDuration` | 类型不再绑定某个卡片组件 |
| `VideoFollowingItem` | `FollowingVideo` | 使用业务名在前、实体名在后的统一顺序 |
| `fetchVideoFollowingPage` | `fetchFollowingVideoPage` | 与 `FollowingVideo` 的命名顺序一致 |
| `items` | `videos` | 明确数组内容是视频 |
| `total` | `totalCount` | 明确字段表示数量 |
| `cover` | `coverUrl` | 明确值是URL |
| `author.id` | `author.mid` | 使用B站官方用户标识名称 |
| `author.avatar` | `author.avatarUrl` | 明确值是URL |
| `stats.views` | `stats.viewCount` | 明确字段表示数量 |
| `stats.danmaku` | `stats.danmakuCount` | 明确字段表示数量 |
| `favoriteAt` | `favoritedAt` | 使用表示动作完成时间的过去分词 |
| 通用 `id` | `dynamicId`或`aid` | 避免同一个字段在三个 API 中表示不同含义 |
| 导航参数 `video` | `target` | 播放页只接收播放目标,不接收某个 API 的完整对象 |
