import { createFunction } from "../core/entry.ts";

export interface GetDateReturns {
    year: number; month: number; day: number; weekday: string; UNIXTimestamp: number, UTCTimeString: string
}

export default class LibStd {

    public static readonly StringToBase64 = createFunction<{ string: string }, { base64: string }>(
        'LibStd_StringToBase64',
        async (string2b64Params) => {
            const utf8Bytes = new TextEncoder().encode(string2b64Params.string);
            let binary = '';
            const len = utf8Bytes.length;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(utf8Bytes[i]);
            }
            const base64 = btoa(binary);
            return { base64 };
        },
        {
            parameters: [{
                name: 'string',
                type: 'string',
                description: "需要转化为base64的字符串",
                required: true
            }],
            description: "将字符串编码为base64格式，返回{base64:string}"
        }
    )

    public static readonly Base64ToString = createFunction<{ base64: string }, { string: string }>(
        'LibStd_Base64ToString',
        async (base642StringParams) => {
            const binary = atob(base642StringParams.base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const string = new TextDecoder('utf-8').decode(bytes);
            return { string };
        },
        {
            parameters: [{
                name: 'base64',
                type: 'string',
                description: "需要解码的base64字符串",
                required: true
            }],
            description: "将base64字符串解码为原始字符串，返回{string:string}"
        }
    )

    public static readonly GetDate = createFunction<{}, GetDateReturns>(
        'LibStd_GetDate',
        async () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const weekday = weekdays[now.getDay()];
            return { year, month, day, weekday, UNIXTimestamp: now.getTime(), UTCTimeString: now.toUTCString() };
        },
        {
            parameters: [],
            description: "获取当前日期和时间信息，包括年月日、星期、时区、UNIX时间戳和UTC时间戳"
        }
    )

    public static readonly RandomFloat = createFunction<{ min?: number, max?: number }, { random: number }>(
        'LibStd_RandomFloat',
        async (params) => {
            const min = params.min || 0;
            const max = params.max || 1;
            const random = Math.random() * (max - min) + min;
            return { random };
        },
        {
            parameters: [
                {
                    name: 'min',
                    type: 'number',
                    description: "最小值（默认0）",
                    required: false
                },
                {
                    name: 'max',
                    type: 'number',
                    description: "最大值（默认1）",
                    required: false
                }
            ],
            description: "生成指定范围内的随机浮点数"
        }
    )

    public static readonly RandomInt = createFunction<{ min?: number, max?: number }, { random: number }>(
        'LibStd_RandomInt',
        async (params) => {
            const min = params.min || 0;
            const max = params.max || 1;
            const random = Math.floor(Math.random() * (max - min) + min);
            return { random };
        },
        {
            parameters: [
                {
                    name: 'min',
                    type: 'integer',
                    description: "最小值（默认0）",
                    required: false
                },
                {
                    name: 'max',
                    type: 'integer',
                    description: "最大值（默认1）",
                    required: false
                }
            ],
            description: "生成指定范围内的随机整数"
        }
    )
}