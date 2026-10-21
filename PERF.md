# 性能测量记录

这份文件记录实测数字,不是推测. 每次测量都写明设备、构建方式、场景和原始数据,方便以后重跑对比.

## 2026-10-21 滚动帧时间基线

### 条件

- 设备: vivo V2309A, MediaTek mt6989, 1260x2800 @ 560dpi, 120Hz 显示
- 构建: `android/gradlew :app:assembleRelease`,包名 `com.dylan.newbili`
  - 用 release 而不是 dev 构建,因为 `__DEV__` 开销会让数字失真
- 工具: `adb shell dumpsys gfxinfo com.dylan.newbili`,每轮前 reset
- 场景: 从屏幕下部快速划到上部,重复 10 次,每场景 5 轮
- 120Hz 的帧预算是 8.3ms

### 基线,仓库版本(有 BlurView)

动态页

| 轮次 | 帧数 | p50 | p90 | p95 | p99 | Slow UI | Slow draw |
|---|---|---|---|---|---|---|---|
| 1 | 414 | 9 | 14 | 15 | 26 | 1 | 1 |
| 2 | 436 | 10 | 13 | 19 | 26 | 0 | 0 |
| 3 | 384 | 11 | 14 | 16 | 18 | 0 | 0 |
| 4 | 376 | 11 | 16 | 19 | 34 | 0 | 0 |
| 5 | 380 | 11 | 14 | 16 | 26 | 0 | 0 |

中位数: p50 11ms, p90 14ms, p95 16ms, p99 26ms

评论页

| 轮次 | 帧数 | p50 | p90 | p95 | p99 | Slow UI | Slow draw |
|---|---|---|---|---|---|---|---|
| 1 | 222 | 9 | 13 | 16 | 32 | 1 | 0 |
| 2 | 162 | 9 | 12 | 16 | 32 | 0 | 0 |
| 3 | 212 | 8 | 13 | 15 | 34 | 0 | 0 |
| 4 | 222 | 8 | 12 | 14 | 30 | 0 | 0 |
| 5 | 220 | 8 | 13 | 14 | 19 | 0 | 0 |

中位数: p50 8ms, p90 13ms, p95 15ms, p99 32ms

### A/B,把两个 BlurView 换成纯色 View

只改 `src/navigation/FloatingTabBar.tsx`,其余代码不变,重新构建 release.

动态页

| 轮次 | 帧数 | p50 | p90 | p95 | p99 |
|---|---|---|---|---|---|
| 1 | 372 | 8 | 12 | 12 | 18 |
| 2 | 396 | 8 | 12 | 15 | 19 |
| 3 | 358 | 8 | 12 | 14 | 26 |
| 4 | 160 | 8 | 12 | 12 | 23 |
| 5 | 158 | 7 | 11 | 12 | 13 |

中位数: p50 8ms, p90 12ms, p95 12ms, p99 19ms

评论页

| 轮次 | 帧数 | p50 | p90 | p95 | p99 |
|---|---|---|---|---|---|
| 1 | 226 | 10 | 15 | 18 | 28 |
| 2 | 140 | 10 | 16 | 18 | 34 |
| 3 | 124 | 10 | 13 | 13 | 15 |
| 4 | 90 | 10 | 12 | 13 | 15 |
| 5 | 90 | 10 | 12 | 13 | 14 |

### 结论

**动态页: BlurView 是已测量的瓶颈.**

p50 从 11ms 降到 8ms,跨过 120Hz 的 8.3ms 预算线. p99 从 26ms 降到 19ms.
`Slow UI thread` 和 `Slow issue draw commands` 在两个变体里都接近 0,说明这份开销不在 JS 线程也不在绘制命令,而在原生光栅化.

**评论页: inconclusive,数据作废.**

A 面帧数中位 220, B 面 124. 滚动距离不一致(列表滑到底),两边的帧数不匹配,不能直接比较. 这不是「BlurView 对评论页无效」的证据,只是没测出来.

**其他判读**

- 两个页面的 `Slow UI thread` 和 `Slow issue draw commands` 都接近 0,所以「不跟手」的主因不在页面里的 JS 代码.
- 120Hz 下 `Janky frames` 显示 0%,但 `Janky frames (legacy)` 按 60Hz 阈值算是 39%. 绝大多数帧落在 8.3ms 到 16.7ms 之间,即跑不满 120Hz.
- 视频详情页不显示底部 Tab 栏(`MainTabNavigator` 在该路由返回 null),所以评论页不受 BlurView 影响. 但 `BlurTargetView.dispatchDraw` 会无条件把整个屏幕子树录进 RenderNode,即使没有 BlurView 挂载. 这一条是读源码得出的,未实测.

### 未验证的假设

以下都是读源码得到的机制推断,没有测量支持:

1. `BlurTargetView` 无条件录制整个屏幕,在视频详情页也付这份开销. 验证方法: 把 `BlurTargetView` 换成普通 `View`,和去掉模糊的结果对比,可分离「录制」和「模糊光栅」的成本.
2. 视频详情页的播放器折叠动画在写 `height` 和 `top` 两个布局属性(`VideoDetailPage.tsx`),每帧触发重排. 该动画只在滚动前约 200dp 生效,折叠完成后 `min(offset, collapseDistance)` 饱和,开销归零.
3. 缩小 `blurTarget` 的范围到 Tab 栏区域,可能保留毛玻璃效果同时降低开销. 当前它包住整个导航器.

### 如何重跑

```bash
cd android && ./gradlew :app:assembleRelease --no-daemon
adb install -r app/build/outputs/apk/release/app-release.apk

# 每轮
adb shell dumpsys gfxinfo com.dylan.newbili reset
for i in $(seq 1 10); do adb shell input swipe 630 2200 630 500 80; done
adb shell dumpsys gfxinfo com.dylan.newbili
```

注意 `dumpsys gfxinfo` 的 `Janky frames` 默认按 60Hz 阈值统计,在 120Hz 设备上要同时看 `Janky frames (legacy)` 和百分位数字.
