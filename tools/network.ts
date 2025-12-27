import axios from "axios";
import { createTool } from "../core/entry.ts";
import { DownloaderHelper } from "node-downloader-helper";
import fs from 'fs'
import open from "open";

export interface HttpGetRequestParams {
    url: string,
    headers?: Record<string, string>,
}

export interface HttpPostRequestParams {
    url: string,
    headers?: Record<string, string>,
    data: any
}

export interface HttpRequestReturns {
    code: number,
    body: any,
}

interface FileDownloaderParams {
    url: string,
    destFolder: string,
    fileName?: string
}

interface FileDownloaderReturns {
    downloadedFile: string,
    isSuccessed: boolean
}

export default class ToolNetwork {

    private static readonly _DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"

    public static readonly httpGetRequest = createTool<HttpGetRequestParams, HttpRequestReturns>(
        "tool_network_httpGetRequest",
        async (httpGetRequestParams) => {
            const request = await axios.request({
                method: 'GET',
                url: httpGetRequestParams.url,
                headers: {
                    "User-Agent": this._DEFAULT_USER_AGENT,
                    ...(httpGetRequestParams.headers)
                },
            })
            return {
                code: request.status,
                body: request.data,
            }
        }, {
        parameters: [{
            name: 'url',
            description: "请求的URL",
            type: 'string',
            required: true,
        }, {
            name: 'headers',
            description: "请求的请求头，以键值对形式存在",
            type: 'object',
            required: false,
        }],
        description: "对一个url发送http、https的Get网络请求，返回的结果为{data:请求数据,code:请求状态码}"
    })

    public static readonly httpPostRequest = createTool<HttpPostRequestParams, HttpRequestReturns>(
        "tool_network_httpPostRequest",
        async (httpPostRequestParams) => {
            const request = await axios.request({
                method: 'POST',
                url: httpPostRequestParams.url,
                headers: {
                    "User-Agent": this._DEFAULT_USER_AGENT,
                    ...(httpPostRequestParams.headers)
                },
                data: httpPostRequestParams.data
            })
            return {
                code: request.status,
                body: request.data,
            }
        }, {
        parameters: [{
            name: 'url',
            description: "请求的URL",
            type: 'string',
            required: true,
        }, {
            name: 'headers',
            description: "请求的请求头，以键值对形式存在",
            type: 'object',
            required: false,
        },{
            name:'data',
            description:"需要POST的数据,不是必须的",
            type:'string',
            required:false
        }],
        description: "对一个url发送http、https网络Post请求，返回的结果为{data:请求数据,code:请求状态码}"
    })

    public static readonly fileDownloader = createTool<FileDownloaderParams, FileDownloaderReturns>(
        "tool_network_fileDownloader",
        async (downloadFileParams) => {
            if (!fs.existsSync(downloadFileParams.destFolder)) {
                fs.mkdirSync(downloadFileParams.destFolder, { recursive: true })
            }

            let isSuccessed: boolean = false

            const downloadPromise = new Promise<string>((resolve, reject) => {
                const downloader = new DownloaderHelper(downloadFileParams.url, downloadFileParams.destFolder, {
                    fileName: downloadFileParams.fileName,
                    removeOnFail: true,
                    removeOnStop: true,
                    retry: {
                        maxRetries: 10,
                        delay: 500
                    },
                    timeout: 10000
                })

                downloader.once('error', (error) => {
                    isSuccessed = false
                    downloader.removeAllListeners()
                    reject(error)
                })
                downloader.once('timeout', () => {
                    isSuccessed = false
                    downloader.removeAllListeners()
                    reject(new Error("timeout"))
                })
                downloader.start().then(() => {
                    const downloadedFile = downloader.getDownloadPath()
                    isSuccessed = true
                    downloader.removeAllListeners()
                    resolve(downloadedFile)

                }).catch((...args) => {
                    downloader.removeAllListeners()
                    isSuccessed = false
                    reject(...args)
                })
            })

            const downloadedFile: string = await downloadPromise

            return {
                isSuccessed: isSuccessed,
                downloadedFile: downloadedFile
            }
        }, {
        parameters: [
            {
                name: "url",
                required: true,
                description: "需要下载的文件的URL地址",
                type: 'string'
            },
            {
                name: 'destFolder',
                required: true,
                description: "下载文件保存到的目录，目录不存在会自动创建",
                type: 'string'
            },
            {
                name: 'fileName',
                required: false,
                description: "自定义下载文件保存的文件名",
                type: 'string'
            }
        ],
        description: "将URL对应的文件下载到本地的目录，返回{isSuccessed:boolean,downloadedFile:string} isSuccessed表示是否下载成功，downloadedFile表示下载后文件保存的位置"
    })

    public static readonly openBrowser = createTool<{ url: string }, { isSuccessed: boolean }>(
        'tool_network_openBrowser',
        async (openBrowserParams) => {
            const process = await open(openBrowserParams.url)
            if (process && process.pid) {
                return { isSuccessed: true }
            }
            return { isSuccessed: false }
        }, {
        parameters: [{
            name: 'url',
            type: 'string',
            description: "需要打开的网页地址",
            required: true
        }],
        description: "使用默认浏览器打开目标网址，返回{isSuccessed:boolean}"
    })

}