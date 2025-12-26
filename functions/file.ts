import { createFunction } from "../core/entry.ts";
import path from "node:path";
import fs from 'fs'
import { booleanTransfer } from "../utils/format.ts";

export interface FileMkDirParams {
    destDir: string,
    recursive?: boolean
}
export type FileMkDirReturns = boolean

export interface FileReadDirParams {
    destDir: string,
}

export type FileReadDirReturns = string[] | null

export default class LibFile {

    public static readonly mkdir = createFunction<FileMkDirParams, FileMkDirReturns>("file_mkdir", async (mkdirOptions) => {
        const isRecursive = mkdirOptions?.recursive ? booleanTransfer(mkdirOptions.recursive) : true
        const dir = await fs.promises.mkdir(mkdirOptions.destDir, { recursive: isRecursive })
        if (dir) {
            return true
        }
        return false
    }, {
        parameters: [{
            name: 'destDir',
            type: 'string',
            required: true,
            description: "需要创建的目录路径"
        }, {
            name: 'recursive',
            type: 'boolean',
            required: false,
            enum: [true, false],
            description: "是否迭代创建目录，默认为true"
        }],
        description: "使用文件系统在本地创建指定目录，返回布尔值，为true则创建成功"
    })

    public static readonly readdir = createFunction<FileReadDirParams, FileReadDirReturns>("file_readdir", async (readDirOptions) => {
        const isDirExist = fs.existsSync(readDirOptions.destDir)
        if (!isDirExist) {
            throw new Error(`Not Such File Or Directory,reading ${readDirOptions.destDir}`)
        }
        const stat = await fs.promises.stat(readDirOptions.destDir)
        if (!stat.isDirectory()) {
            throw new Error(`is Not a Directory,reading ${readDirOptions.destDir}`)
        }
        const files = await fs.promises.readdir(readDirOptions.destDir)
        return files
    }, {
        parameters: [{
            name: 'destDir',
            required: true,
            description: "需要读取的目标目录，如果不存在会报错，如果是非目录，同样也会报错",
            type: 'string'
        }],
        description: "读取一个目录下的子目录和文件，返回包含相对路径的数组"
    })

    public static readonly isExist = createFunction<{ destPath: string }, { isExist: boolean }>('file_isExist', async (isExistParams) => {
        return { isExist: fs.existsSync(isExistParams.destPath) }
    }, {
        parameters: [{
            name: 'destPath',
            type: 'string',
            description: "需要查看是否存在的文件路径或者目录",
            required: true,
        }],
        description: "检查一个目录或者文件的路径是否存在，返回 {isExist:boolean} "
    })

    public static readonly pathJoin = createFunction<{ pathes: string[] }, { fullPath: string }>('file_pathJoin', async (joinPathParams) => {
        for (const p of joinPathParams.pathes) {
            if (typeof p !== 'string') {
                throw new Error(`Given path part ${p} is not a string,`)
            }
        }
        const fullPath = path.join(...joinPathParams.pathes)
        return { fullPath }
    }, {
        parameters: [{
            name: 'pathes',
            description: '需要合并的路径数组,每一项都应该是一个字符串，如果存在非字符串的元素将会报错',
            required: true,
            type: 'array'
        }],
        description: "将多个路径进行拼合，拼合成一个完整路径，类似于path.join(),返回{fullPath:string}"
    })

    public static readonly writeTextToFile = createFunction<{ destFile: string, text: string, flag?: string }, { destFile: string }>('file_writeTextToFile', async (writeTextParams) => {
        const dirname = path.dirname(writeTextParams.destFile)
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname, { recursive: true })
        }
        fs.writeFileSync(writeTextParams.destFile, writeTextParams.text, { flag: writeTextParams.flag })
        return { destFile: writeTextParams.destFile }
    }, {
        parameters: [{
            name: 'destFile',
            type: 'string',
            required: true,
            description: "需要写入的目标文件，目标文件的目录和文件本身会自动创建"
        }, {
            name: 'text',
            type: 'string',
            required: true,
            description: "需要写入的文本内容"
        }, {
            name: 'flag',
            type: 'string',
            required: false,
            description: '写入的模式，这不是必须的，默认会创建或覆盖原文件，你可以选择 w w+ a a+',
            enum: ['w', 'w+', 'a', 'a+']
        }],
        description: "将文本写入特定文件，将会返回{destFile:string}为写入后的文件，写入遇到问题会抛出错误"
    })

    public static readonly readFileAsText = createFunction<{ destFile: string, encoding?: BufferEncoding }, { text: string }>('file_readFileAsText', async (readFileParams) => {
        const isFileExist = fs.existsSync(readFileParams.destFile)
        if (!isFileExist) {
            throw new Error(`Not Such File Or Directory,reading ${readFileParams.destFile}`)
        }
        const stat = await fs.promises.stat(readFileParams.destFile)
        if (!stat.isFile()) {
            throw new Error(`is Not a File,reading ${readFileParams.destFile}`)
        }
        const readResult = await fs.promises.readFile(readFileParams.destFile, { encoding: readFileParams.encoding ?? 'utf-8' })
        return {
            text: readResult,
        }
    }, {
        parameters: [{
            name: 'destFile',
            required: true,
            description: "需要读取的目标文件路径,如果不存在会报错，如果不是文件会报错",
            type: 'string'
        }, {
            name: 'encoding',
            required: false,
            description: "文本编码，这不是必须的，默认为utf-8",
            enum: ["ascii", "utf8", "utf-8", "utf16le", "utf-16le", "ucs2", "ucs-2", "base64", "base64url", "latin1", "binary", "hex"],
            type: 'string'
        }],
        description: "将一个本地文件按照特定编码读取为文本，返回{text:string},读取失败会报错"
    })
}