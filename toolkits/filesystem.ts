import z from "zod";
import Toolkit from "../core/toolkit.ts";
import fs from 'node:fs'
import path from 'node:path'
import fse from 'fs-extra'

const fileSystemToolkit = new Toolkit({
    name: "filesystem",
    version: '1.0.1'
}, {
    isPathPermitted: (targetPath: string) => {
        if (!process.env.PATH_PREMISSION) {
            return true
        }
        else {
            if (targetPath.includes(process.env.PATH_PREMISSION)) {
                return true
            }
            return false
        }
    }
})

fileSystemToolkit.tool<{ filePath: string, encoding?: 'utf-8' }>(
    "read_text_file",
    "读取文本文件",
    async (params, perm) => {
        if (!perm.isPathPermitted(params.filePath)) {
            throw new Error("当前路径不允许操作")
        }
        const filePath = params.filePath
        if (!fs.existsSync(filePath)) {
            throw new Error(`no such file ${filePath}`)
        }
        const stats = await fs.promises.stat(filePath)
        if (!stats.isFile()) {
            throw new Error(`${filePath} is not a file`)
        }
        return await fs.promises.readFile(filePath, params.encoding || 'utf-8')
    }, {
    filePath: z.string().describe("文件路径"),
    encoding: z.enum(['utf-8']).optional().describe("文件编码格式")
})

fileSystemToolkit.tool<{ filePath: string, content: string, encoding?: 'utf-8', append?: boolean }>(
    "write_text_file",
    "写入文本到文件,会自动创建目录",
    async (params, perm) => {
        if (!perm.isPathPermitted(params.filePath)) {
            throw new Error("当前路径不允许操作")
        }
        const filePath = params.filePath
        fse.ensureDir(path.dirname(filePath))
        const options = { encoding: params.encoding || 'utf-8' }
        if (params.append) {
            await fs.promises.appendFile(filePath, params.content, options)
        } else {
            await fs.promises.writeFile(filePath, params.content, options)
        }
        return { success: true, filePath }
    }, {
    filePath: z.string().describe("想要写入的文件路径"),
    content: z.string().describe("需要写入的文本内容"),
    encoding: z.enum(['utf-8']).optional().describe("文件编码格式"),
    append: z.boolean().optional().describe("是否追加写入文件")
})

fileSystemToolkit.tool<{ dirPath: string }>(
    "read_directory",
    "读取目录",
    async (params, perm) => {
        if (!perm.isPathPermitted(params.dirPath)) {
            throw new Error("当前路径不允许操作")
        }
        const dirPath = params.dirPath
        if (!fs.existsSync(dirPath)) {
            throw new Error(`no such directory ${dirPath}`)
        }
        const stats = await fs.promises.stat(dirPath)
        if (!stats.isDirectory()) {
            throw new Error(`${dirPath} is not a directory`)
        }
        return await fs.promises.readdir(dirPath)
    }, {
    dirPath: z.string().describe("目录路径")
})

fileSystemToolkit.tool<{ targetPath: string }>(
    "read_path_details",
    "读取路径的详细信息",
    async (params, perm) => {
        if (!perm.isPathPermitted(params.targetPath)) {
            throw new Error("当前路径不允许操作")
        }
        const filePath = params.targetPath
        if (!fs.existsSync(filePath)) {
            throw new Error(`no such file or directory ${filePath}`)
        }
        const stats = await fs.promises.stat(filePath)
        return {
            path: filePath,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            birthtime: stats.birthtime,
            mtime: stats.mtime,
            atime: stats.atime,
            ctime: stats.ctime,
            mode: stats.mode
        }
    }, {
    targetPath: z.string().describe("文件或目录路径")
})

export default fileSystemToolkit