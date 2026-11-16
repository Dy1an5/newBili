import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

export const duration = {
    instant: 100,
    quick: 150,
    standard: 250,
    emphasized: 350,
    slow: 500,
} as const;

export const easing = {
    standard: [0.2, 0, 0, 1],
    decelerate: [0, 0, 0, 1],
    accelerate: [0.3, 0, 1, 1],
} as const;

export function timingConfig(ms: number = duration.standard): WithTimingConfig {
    return {
        duration: ms,
        easing: Easing.bezier(...easing.standard),
    };
}

// Reanimated 4 的时长弹簧按感知时长配置, 实际时长约为 1.5 倍.
export const spring = {
    press: { duration: 120, dampingRatio: 1 },
    enter: { duration: 200, dampingRatio: 0.85 },
    move: { duration: 200, dampingRatio: 1 },
    sheet: { duration: 200, dampingRatio: 0.9 },
} satisfies Record<string, WithSpringConfig>;
