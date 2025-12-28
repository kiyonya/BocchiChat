import { createTool } from "../core/entry.ts";
import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs'

const execAsync = promisify(exec);

export interface ExecuteCommandParams {
    command: string;
    args?: string[];
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
    shell?: boolean;
}

export interface CommandResult {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    pid?: number;
    duration?: number;
}

export interface ShellOutputParams {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
}

export default class ToolShell {

    public static readonly executeShellCommand = createTool<ShellOutputParams, { output: string }>(
        'tool_shell_executeShellCommand',
        async (params) => {
            const { command, cwd = process.cwd(), env } = params;

            try {
                const result = await execAsync(command, {
                    cwd,
                    timeout:3000,
                    env: { ...process.env, ...env },
                    encoding: 'utf-8'
                });

                return { output: result.stdout.trim() };
            } catch (error: any) {
                if (error.stdout) {
                    return { output: error.stdout.trim() };
                }
                throw error;
            }
        }, {
        parameters: [{
            name: 'command',
            type: 'string',
            required: true,
            description: "要执行的完整shell命令字符串"
        }, {
            name: 'cwd',
            type: 'string',
            required: false,
            description: "执行命令的工作目录"
        }, {
            name: 'env',
            type: 'object',
            required: false,
            description: "自定义环境变量"
        }],
        description: "执行简单的shell命令并返回输出，适用于单行命令,请不要使用&&执行多行命令，你需要分多次执行多行命令"
    });

    public static readonly getCwd = createTool(
        'tool_shell_getCwd',
        async () => {
            return { cwd: process.cwd() };
        }, {
        parameters: [],
        description: "获取当前工作目录"
    });

    public static readonly chdir = createTool<{ directory: string }, { success: boolean, newCwd: string }>(
        'tool_shell_changeDirectory',
        async (params) => {
            try {
                await fs.promises.access(params.directory);
                process.chdir(params.directory);
                return {
                    success: true,
                    newCwd: process.cwd()
                };
            } catch (error) {
                return {
                    success: false,
                    newCwd: process.cwd()
                };
            }
        }, {
        parameters: [{
            name: 'directory',
            type: 'string',
            required: true,
            description: "要切换到的目标目录路径"
        }],
        description: "更改当前工作目录"
    });

    public static readonly listEnv = createTool(
        'tool_shell_listEnv',
        async () => {
            return { env: process.env };
        }, {
        parameters: [],
        description: "列出所有环境变量"
    });

   
}