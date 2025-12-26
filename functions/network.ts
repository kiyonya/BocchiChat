import axios from "axios";
import { createFunction } from "../core/entry.ts";
import { DownloaderHelper } from "node-downloader-helper";
import fs from 'fs'
import path from "path";

interface RequestURIOptions {
    method: 'get' | 'post',
    url: string,
    headers?: Record<string, string>
}

interface RequestURIResponse {
    code: number,
    body: any,
}

interface NetworkDownloadFileParams {
    url: string,
    destFolder: string,
    fileName?: string
}

interface NetworkDownloadFileReturns {
    downloadedFile: string,
    isSuccessed: boolean

}


export default class LibNetwork {

    public static readonly requestURI = createFunction<RequestURIOptions, RequestURIResponse>("network_requestURI", async (requestURIOptions) => {
        const request = await axios.request({
            method: requestURIOptions.method ?? 'GET',
            url: requestURIOptions.url,
            headers: requestURIOptions.headers,
        })
        return {
            code: request.status,
            body: request.data,
        }
    }, {
        parameters: [{
            name: "method",
            enum: ["get", "post"],
            description: "请求的方法，枚举自get | post,默认为get",
            type: 'string'
        }, {
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
        description: "对一个uri发送http、https网络请求，返回的结果为{data:请求数据,code:请求状态码}"
    })

    public static readonly downloadFile = createFunction<NetworkDownloadFileParams, NetworkDownloadFileReturns>("network_downloadFile", async (downloadFileParams) => {

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
    },{
        parameters:[
            {
                name:"url",
                required:true,
                description:"需要下载的文件的URL地址",
                type:'string'
            },
            {
                name:'destFolder',
                required:true,
                description:"下载文件保存到的目录，目录不存在会自动创建",
                type:'string'
            },
            {
                name:'fileName',
                required:false,
                description:"自定义下载文件保存的文件名",
                type:'string'
            }
        ],
        description:"将URL对应的文件下载到本地的目录，返回{isSuccessed:boolean,downloadedFile:string} isSuccessed表示是否下载成功，downloadedFile表示下载后文件保存的位置"
    })



}