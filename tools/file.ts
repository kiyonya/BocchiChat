import { createTool } from "../core/entry.ts";
import path from "node:path";
import fsPromise from 'fs/promises';
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

export interface ReaddirReturnItem {
    isFile: boolean, path: string, fullPath: string, size?: number, createTime: string
}

export interface GlobSyncParams {
    pattern: string;
    cwd?: string;
    includeDirs?: boolean;
    includeFiles?: boolean;
}

export default class ToolFile {

    public static readonly mkdir = createTool<FileMkDirParams, FileMkDirReturns>(
        "tool_file_mkdir",
        async (mkdirOptions) => {
            const isRecursive = mkdirOptions?.recursive ? booleanTransfer(mkdirOptions.recursive) : true
            await fsPromise.mkdir(mkdirOptions.destDir, { recursive: isRecursive })
            return true
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

    public static readonly readdir = createTool<FileReadDirParams, ReaddirReturnItem[]>(
        "tool_file_readdir",
        async (readDirOptions) => {
            const stat = await fsPromise.stat(readDirOptions.destDir)
            if (!stat.isDirectory()) {
                throw new Error(`is Not a Directory,reading ${readDirOptions.destDir}`)
            }
            const items = await fsPromise.readdir(readDirOptions.destDir)
            const dirItems = await Promise.all(items.map(async (item) => {
                const fullPath = path.join(readDirOptions.destDir, item)
                const stat = await fsPromise.stat(fullPath)
                const isFile = stat.isFile()
                const returnItem: ReaddirReturnItem = {
                    path: item,
                    fullPath,
                    isFile,
                    createTime: stat.birthtime.toUTCString(),
                }
                if (isFile) {
                    returnItem.size = stat.size
                }
                return returnItem
            }))
            return dirItems
        }, {
        parameters: [{
            name: 'destDir',
            required: true,
            description: "需要读取的目标目录，如果不存在会报错，如果是非目录，同样也会报错",
            type: 'string'
        }],
        description: "读取一个目录下的子目录和文件，返回包含相对路径,绝对路径，创建时间，目录类型以及文件大小的数组"
    })

    public static readonly isExist = createTool<{ destPath: string }, { isExist: boolean }>(
        'tool_file_isExist',
        async (isExistParams) => {
            try {
                await fsPromise.access(isExistParams.destPath)
                return { isExist: true }
            } catch {
                return { isExist: false }
            }
        }, {
        parameters: [{
            name: 'destPath',
            type: 'string',
            description: "需要查看是否存在的文件路径或者目录",
            required: true,
        }],
        description: "检查一个目录或者文件的路径是否存在，返回 {isExist:boolean} "
    })

    public static readonly pathJoin = createTool<{ pathes: string[] }, { fullPath: string }>(
        'tool_file_pathJoin',
        async (joinPathParams) => {
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

    public static readonly writeTextToFile = createTool<{ destFile: string, text: string, flag?: string }, { destFile: string }>(
        'tool_file_writeTextToFile',
        async (writeTextParams) => {
            const dirname = path.dirname(writeTextParams.destFile)
            try {
                await fsPromise.access(dirname)
            } catch {
                await fsPromise.mkdir(dirname, { recursive: true })
            }
            await fsPromise.writeFile(writeTextParams.destFile, writeTextParams.text, { flag: writeTextParams.flag })
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

    public static readonly readTextFromFile = createTool<{ destFile: string, encoding?: BufferEncoding }, { text: string }>(
        'tool_file_readTextFromFile',
        async (readFileParams) => {
            const stat = await fsPromise.stat(readFileParams.destFile)
            if (!stat.isFile()) {
                throw new Error(`is Not a File,reading ${readFileParams.destFile}`)
            }
            const readResult = await fsPromise.readFile(readFileParams.destFile, { encoding: readFileParams.encoding ?? 'utf-8' })
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

    public static readonly rename = createTool<{ destPath: string, newPath: string }, { isSuccessed: boolean, newPath: string }>(
        'tool_file_rename',
        async (renameParams) => {
            await fsPromise.access(renameParams.destPath)
            await fsPromise.rename(renameParams.destPath, renameParams.newPath)
            return {
                isSuccessed: true,
                newPath: renameParams.newPath
            }
        },
        {
            parameters: [{
                name: 'destPath',
                type: 'string',
                description: "需要修改名称的路径"
            },
            {
                name: 'newPath',
                type: 'string',
                description: "修改名称后期望的新路径"
            }],
            description: "修改文件夹或者文件的名字，你需要提供新旧两个目录，返回{isSuccessed:boolean,newPath:string} 修改失败将会抛出错误"
        }
    )

    public static readonly chmod = createTool<{ destFile: string, mode: fs.Mode }, boolean>(
        'tool_file_chmod',
        async (chmodParams) => {
            const stat = await fsPromise.stat(chmodParams.destFile)
            if (!stat.isFile()) {
                throw new Error(`is Not a File,reading ${chmodParams.destFile}`)
            }
            await fsPromise.chmod(chmodParams.destFile, Number(chmodParams.mode))
            return true
        }, {
        parameters: [{
            name: 'destFile',
            type: 'string',
            description: "需要修改权限的目标文件路径",
            required: true
        }, {
            name: 'mode',
            type: 'number',
            description: "权限标识符",
            required: true
        }],
        description: "修改一个文件的访问权限,返回布尔值表示是否成功"
    })

    public static readonly copy = createTool<{ srcPath: string; destPath: string; overwrite?: boolean; }, { isSuccessed: boolean, destPath: string }>(
        'tool_file_copyFile',
        async (copyParams) => {
            const srcStat = await fsPromise.stat(copyParams.srcPath);

            if (srcStat.isDirectory()) {
                await this.copyDirectory(copyParams.srcPath, copyParams.destPath, copyParams.overwrite ?? false);
            } else {
                await fsPromise.copyFile(copyParams.srcPath, copyParams.destPath);
            }

            return {
                isSuccessed: true,
                destPath: copyParams.destPath
            };
        }, {
        parameters: [{
            name: 'srcPath',
            type: 'string',
            required: true,
            description: "源文件或目录路径"
        }, {
            name: 'destPath',
            type: 'string',
            required: true,
            description: "目标文件或目录路径"
        }, {
            name: 'overwrite',
            type: 'boolean',
            required: false,
            enum: [true, false],
            description: "是否覆盖已存在的目标文件，默认为false"
        }],
        description: "复制文件或目录到指定位置，支持文件夹递归复制,返回 {isSuccessed:boolean,destPath:string} 复制出错会报错"
    });

    public static readonly glob = createTool<GlobSyncParams, { matches: string[] }>(
        'tool_file_glob',
        async (globParams,undefined) => {
            const cwd = globParams.cwd || process.cwd();
            const pattern = globParams.pattern;
            const includeDirs = globParams.includeDirs ?? true;
            const includeFiles = globParams.includeFiles ?? true;

            const matches: string[] = [];

            function matchPattern(filename: string): boolean {
                // 通配符
                const regexPattern = pattern
                    .replace(/\./g, '\\.')
                    .replace(/\*/g, '.*')
                    .replace(/\?/g, '.');
                const regex = new RegExp(`^${regexPattern}$`);
                return regex.test(filename);
            }

            function scanDirectory(dirPath: string): void {
                const items = fs.readdirSync(dirPath);

                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const relativePath = path.relative(cwd, fullPath);
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        if (includeDirs && matchPattern(item)) {
                            matches.push(relativePath);
                        }
                        scanDirectory(fullPath);
                    } else if (stat.isFile() && includeFiles && matchPattern(item)) {
                        matches.push(relativePath);
                    }
                }
            }

            scanDirectory(cwd);

            return { matches };
        }, {
        parameters: [{
            name: 'pattern',
            type: 'string',
            required: true,
            description: "通配符模式，支持 * 和 ? 匹配符"
        }, {
            name: 'cwd',
            type: 'string',
            required: false,
            description: "搜索的起始目录，默认为当前工作目录"
        }, {
            name: 'includeDirs',
            type: 'boolean',
            required: false,
            description: "是否包含目录，默认为true"
        }, {
            name: 'includeFiles',
            type: 'boolean',
            required: false,
            description: "是否包含文件，默认为true"
        }],
        description: "使用同步方式根据通配符模式搜索文件和目录"
    });

    private static async copyDirectory(srcDir: string, destDir: string, overwrite: boolean): Promise<void> {
        await fsPromise.mkdir(destDir, { recursive: true });

        const items = await fsPromise.readdir(srcDir);

        await Promise.all(items.map(async (item) => {
            const srcPath = path.join(srcDir, item);
            const destPath = path.join(destDir, item);

            const stat = await fsPromise.stat(srcPath);

            if (stat.isDirectory()) {
                await this.copyDirectory(srcPath, destPath, overwrite);
            } else {
                await fsPromise.copyFile(srcPath, destPath);
            }
        }));
    }

}
