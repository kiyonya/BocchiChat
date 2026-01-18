import z from "zod";
import Toolkit from "../core/toolkit.ts";
import fs from 'node:fs'
import path from 'node:path'
import fse from 'fs-extra'
import windlg from "windlg";

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

        const prom = await windlg.showMessageBox("访问请求", `AI想要读取文件${filePath}`, 'okcancel', 'question')

        if (prom !== 'ok') {
            throw new Error("用户拒绝了你的请求")
        }

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

        const prom = await windlg.showMessageBox("访问请求", `AI想要写入文件${filePath}`, 'okcancel', 'question')

        if (prom !== 'ok') {
            throw new Error("用户拒绝了你的请求")
        }

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

        const prom = await windlg.showMessageBox("访问请求", `AI想要访问文件目录${dirPath}`, 'okcancel', 'question')
        if (prom !== 'ok') {
            throw new Error("用户拒绝了你的请求")
        }

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
        const prom = await windlg.showMessageBox("访问请求", `AI想要获取${filePath}的详细信息`, 'okcancel', 'question')
        if (prom !== 'ok') {
            throw new Error("用户拒绝了你的请求")
        }
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

fileSystemToolkit.tool<{ targetPath: string }>(
    "mkdir",
    "创建文件夹",
    async (params, perm) => {
        if (!perm.isPathPermitted(params.targetPath)) {
            throw new Error("当前路径不允许操作")
        }
        const prom = await windlg.showMessageBox("访问请求", `AI想要创建目录${params.targetPath}`, 'okcancel', 'question')
        if (prom !== 'ok') {
            throw new Error("用户拒绝了你的请求")
        }
        await fse.ensureDir(params.targetPath)
        return params.targetPath
    },
    {
        targetPath: z.string().describe("你希望创建的目录，会自动迭代创建")
    }
)

fileSystemToolkit.tool<{ srcPath: string, targetPath: string }>(
    "copy",
    "拷贝目录或者文件夹",
    async (params, perm) => {

        if (!perm.isPathPermitted(params.srcPath) || !perm.isPathPermitted(params.targetPath)) {
            throw new Error("当前路径不允许操作")
        }
        const prom = await windlg.showMessageBox("访问请求", `AI想要复制${params.srcPath}到${params.targetPath}`, 'okcancel', 'question')
        if (prom !== 'ok') {
            throw new Error("用户拒绝了你的请求")
        }

        if (!params.srcPath || !params.targetPath) {
            throw new Error("srcPath和targetPath不能为空")
        }
        await fse.copy(params.srcPath, params.targetPath)
        return { srcPath: params.srcPath, targetPath: params.targetPath }
    },
    {
        srcPath: z.string().describe("源路径"),
        targetPath: z.string().describe("目标路径")
    }
)

fileSystemToolkit.tool<{ targetPath: string }>(
    "remove",
    "删除文件或者文件夹",
    async (params, perm) => {
        if (!perm.isPathPermitted(params.targetPath)) {
            throw new Error("当前路径不允许操作")
        }
        const prom = await windlg.showMessageBox("访问请求", `AI想要删除${params.targetPath}`, 'okcancel', 'question')
        if (prom !== 'ok') {
            throw new Error("用户拒绝了你的请求")
        }
        if (!params.targetPath) {
            throw new Error("targetPath不能为空")
        }
        await fse.remove(params.targetPath)
        return { targetPath: params.targetPath }
    },
    {
        targetPath: z.string().describe("目标路径")
    }
)

fileSystemToolkit.tool<{ targetPath: string }>(
    "path_exists",
    "检查路径是否存在",
    async (params, perm) => {
        if (!perm.isPathPermitted(params.targetPath)) {
            throw new Error("当前路径不允许操作")
        }
        if (!params.targetPath) {
            throw new Error("targetPath不能为空")
        }
        return fs.existsSync(params.targetPath)
    },
    {
        targetPath: z.string().describe("目标路径")
    }
)

fileSystemToolkit.tool<{ targetPath: string, newName: string }>(
    "rename_path",
    "重命名文件或文件夹",
    async (params, perm) => {
        if (!perm.isPathPermitted(params.targetPath)) {
            throw new Error("当前路径不允许操作")
        }
        const prom = await windlg.showMessageBox("访问请求", `AI想要重命名${params.targetPath}为${params.newName}`, 'okcancel', 'question')
        if (prom !== 'ok') {
            throw new Error("用户拒绝了你的请求")
        }
        if (!params.targetPath || !params.newName) {
            throw new Error("targetPath和newName不能为空")
        }
        const dir = path.dirname(params.targetPath)
        const newPath = path.join(dir, params.newName)
        await fs.promises.rename(params.targetPath, newPath)
        return { oldPath: params.targetPath, newPath }
    },
    {
        targetPath: z.string().describe("目标路径"),
        newName: z.string().describe("新的文件或文件夹名称,不包含路径,文件需要扩展名")
    }
)

export default fileSystemToolkit