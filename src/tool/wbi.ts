import {
    asRecord,
    BILIBILI_REFERER,
    BILIBILI_USER_AGENT as USER_AGENT,
    readNonEmptyString as readString,
    readNumber,
    type JsonRecord,
} from '@/tool/bilibiliApi';
import { createRequestCancelledError } from '@/tool/requestCancellation';
import { createGetSessdataPair } from '@/tool/sessdata';

const WBI_NAV_URL = 'https://api.bilibili.com/x/web-interface/nav';
const FORBIDDEN_VALUE_CHARACTERS = /[!'()*]/g;
const MIXIN_KEY_ENCODE_TABLE = [
    46, 47, 18, 2, 53, 8, 23, 32,
    15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19,
    29, 28, 14, 39, 12, 38, 41, 13,
] as const;
const MD5_SHIFT_AMOUNTS = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
] as const;
const MD5_CONSTANTS = Array.from(
    { length: 64 },
    (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0,
);

type WbiParameterValue = string | number | boolean | null | undefined;

export type WbiParameters = Record<string, WbiParameterValue>;

type CachedMixinKey = {
    day: string;
    value: string;
};

export class WbiSigningError extends Error {
    readonly code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'WbiSigningError';
        this.code = code;
    }
}

let cachedMixinKey: CachedMixinKey | null = null;
let pendingMixinKeyRequest: Promise<string> | null = null;

const getSessdataPair = createGetSessdataPair(
    WbiSigningError,
    '登录信息中没有有效的 SESSDATA',
);

function getFileNameWithoutExtension(url: string): string | null {
    const path = url.split(/[?#]/, 1)[0];
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    const extensionIndex = fileName.lastIndexOf('.');

    if (extensionIndex <= 0) {
        return null;
    }

    return fileName.slice(0, extensionIndex);
}

function createMixinKey(imgKey: string, subKey: string): string {
    const source = imgKey + subKey;

    if (MIXIN_KEY_ENCODE_TABLE.some((index) => index >= source.length)) {
        throw new WbiSigningError('WBI密钥长度不正确');
    }

    return MIXIN_KEY_ENCODE_TABLE.map((index) => source[index]).join('');
}

function encodeUtf8(value: string): number[] {
    const bytes: number[] = [];

    for (const character of value) {
        const codePoint = character.codePointAt(0);

        if (codePoint === undefined) {
            continue;
        }

        if (codePoint <= 0x7f) {
            bytes.push(codePoint);
        } else if (codePoint <= 0x7ff) {
            bytes.push(
                0xc0 | (codePoint >>> 6),
                0x80 | (codePoint & 0x3f),
            );
        } else if (codePoint <= 0xffff) {
            bytes.push(
                0xe0 | (codePoint >>> 12),
                0x80 | ((codePoint >>> 6) & 0x3f),
                0x80 | (codePoint & 0x3f),
            );
        } else {
            bytes.push(
                0xf0 | (codePoint >>> 18),
                0x80 | ((codePoint >>> 12) & 0x3f),
                0x80 | ((codePoint >>> 6) & 0x3f),
                0x80 | (codePoint & 0x3f),
            );
        }
    }

    return bytes;
}

function rotateLeft(value: number, amount: number): number {
    return ((value << amount) | (value >>> (32 - amount))) >>> 0;
}

function wordToLittleEndianHex(value: number): string {
    let result = '';

    for (let index = 0; index < 4; index += 1) {
        result += ((value >>> (index * 8)) & 0xff).toString(16).padStart(2, '0');
    }

    return result;
}

function md5(value: string): string {
    const bytes = encodeUtf8(value);
    const bitLength = bytes.length * 8;
    bytes.push(0x80);

    while (bytes.length % 64 !== 56) {
        bytes.push(0);
    }

    for (let index = 0; index < 8; index += 1) {
        bytes.push(Math.floor(bitLength / 2 ** (index * 8)) & 0xff);
    }

    let stateA = 0x67452301;
    let stateB = 0xefcdab89;
    let stateC = 0x98badcfe;
    let stateD = 0x10325476;

    for (let offset = 0; offset < bytes.length; offset += 64) {
        const words = Array.from({ length: 16 }, (_, index) => {
            const wordOffset = offset + index * 4;

            return (
                bytes[wordOffset] |
                (bytes[wordOffset + 1] << 8) |
                (bytes[wordOffset + 2] << 16) |
                (bytes[wordOffset + 3] << 24)
            ) >>> 0;
        });
        let a = stateA;
        let b = stateB;
        let c = stateC;
        let d = stateD;

        for (let index = 0; index < 64; index += 1) {
            let calculation: number;
            let wordIndex: number;

            if (index < 16) {
                calculation = (b & c) | (~b & d);
                wordIndex = index;
            } else if (index < 32) {
                calculation = (d & b) | (~d & c);
                wordIndex = (5 * index + 1) % 16;
            } else if (index < 48) {
                calculation = b ^ c ^ d;
                wordIndex = (3 * index + 5) % 16;
            } else {
                calculation = c ^ (b | ~d);
                wordIndex = (7 * index) % 16;
            }

            const nextD = d;
            d = c;
            c = b;
            b = (
                b +
                rotateLeft(
                    (a + calculation + MD5_CONSTANTS[index] + words[wordIndex]) >>> 0,
                    MD5_SHIFT_AMOUNTS[index],
                )
            ) >>> 0;
            a = nextD;
        }

        stateA = (stateA + a) >>> 0;
        stateB = (stateB + b) >>> 0;
        stateC = (stateC + c) >>> 0;
        stateD = (stateD + d) >>> 0;
    }

    return [stateA, stateB, stateC, stateD]
        .map(wordToLittleEndianHex)
        .join('');
}

async function requestMixinKey(cookie: string): Promise<string> {
    const sessdata = getSessdataPair(cookie);
    const response = await fetch(WBI_NAV_URL, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Cookie: sessdata,
            Referer: BILIBILI_REFERER,
            'User-Agent': USER_AGENT,
        },
    });

    if (!response.ok) {
        throw new WbiSigningError(`WBI密钥请求失败,HTTP ${response.status}`);
    }

    const body = asRecord(await response.json());
    const code = readNumber(body?.code);

    if (!body || code === null) {
        throw new WbiSigningError('WBI密钥接口返回格式不正确');
    }

    if (code !== 0) {
        const message = readString(body.message) ?? '未知错误';
        throw new WbiSigningError(`WBI密钥接口错误 ${code}:${message}`, code);
    }

    const data = asRecord(body.data);
    const wbiImage = asRecord(data?.wbi_img);
    const imgUrl = readString(wbiImage?.img_url);
    const subUrl = readString(wbiImage?.sub_url);

    if (!imgUrl || !subUrl) {
        throw new WbiSigningError('WBI密钥接口缺少wbi_img');
    }

    const imgKey = getFileNameWithoutExtension(imgUrl);
    const subKey = getFileNameWithoutExtension(subUrl);

    if (!imgKey || !subKey) {
        throw new WbiSigningError('WBI密钥地址格式不正确');
    }

    return createMixinKey(imgKey, subKey);
}

async function getMixinKey(cookie: string, signal?: AbortSignal): Promise<string> {
    const currentDay = new Date().toDateString();

    if (cachedMixinKey?.day === currentDay) {
        return cachedMixinKey.value;
    }

    if (!pendingMixinKeyRequest) {
        // 这个请求幂等, 只用来填当天的密钥缓存, 不能绑定任何单个调用者的 signal:
        // 一个调用者取消会连带让其他仍在挂载的调用者一起失败.
        pendingMixinKeyRequest = requestMixinKey(cookie)
            .then((value) => {
                cachedMixinKey = {
                    day: currentDay,
                    value,
                };
                return value;
            })
            .finally(() => {
                pendingMixinKeyRequest = null;
            });
    }

    const value = await pendingMixinKeyRequest;

    if (signal?.aborted) {
        throw createRequestCancelledError();
    }

    return value;
}

export function signWbiParameters(
    parameters: WbiParameters,
    mixinKey: string,
    timestamp = Math.floor(Date.now() / 1000),
): string {
    const entries = Object.entries(parameters)
        .filter(([, value]) => value !== null && value !== undefined)
        .filter(([key]) => key !== 'w_rid' && key !== 'wts')
        .map(([key, value]) => [key, String(value)] as const);

    entries.push(['wts', String(timestamp)]);
    entries.sort(([leftKey], [rightKey]) => {
        if (leftKey < rightKey) {
            return -1;
        }

        if (leftKey > rightKey) {
            return 1;
        }

        return 0;
    });

    const query = entries
        .map(([key, value]) => {
            const filteredValue = value.replace(FORBIDDEN_VALUE_CHARACTERS, '');
            return `${encodeURIComponent(key)}=${encodeURIComponent(filteredValue)}`;
        })
        .join('&');
    const signature = md5(query + mixinKey);

    return `${query}&w_rid=${signature}`;
}

export async function createWbiSignedQuery(
    parameters: WbiParameters,
    cookie: string,
    signal?: AbortSignal,
): Promise<string> {
    const mixinKey = await getMixinKey(cookie, signal);
    return signWbiParameters(parameters, mixinKey);
}

export function clearWbiKeyCache(): void {
    cachedMixinKey = null;
}
