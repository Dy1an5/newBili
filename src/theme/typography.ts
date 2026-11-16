import type { TextStyle } from 'react-native';

// 8 个语义字号覆盖当前界面. 新增字号前先确认现有角色无法表达.
export const typography = {
    title: {
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '700',
    },
    heading: {
        fontSize: 17,
        lineHeight: 24,
        fontWeight: '600',
    },
    titleSmall: {
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '600',
    },
    body: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '400',
    },
    bodySmall: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
    },
    caption: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '400',
    },
    label: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
    micro: {
        fontSize: 11,
        lineHeight: 15,
        fontWeight: '600',
    },
} satisfies Record<string, TextStyle>;

export type TypographyRole = keyof typeof typography;
