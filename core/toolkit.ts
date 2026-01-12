import z from "zod";
import { LocalTool, MCPTool, type MCPToolInputSchemaLike } from "./tool.ts";

export interface ToolGroupCreateOptions {
    name: string,
    version: string
}

type PermissionChecker = (...args:any[]) => boolean | Promise<boolean>;
type ToolkitPermissions = Record<string, PermissionChecker>;

export default class Toolkit<P extends ToolkitPermissions = ToolkitPermissions> {

    public namespace?: string
    public name: string
    public version: string
    public registeredTools: (LocalTool<any, any, any> | MCPTool<any, any>)[] = []

    public globalPermissions: P = {} as P

    constructor(options: ToolGroupCreateOptions, permissions: P = {} as P) {
        this.name = options.name
        this.namespace = options.name
        this.version = options.version
        this.globalPermissions = permissions
    }

    public tool<ToolParams extends Record<string, any> = Record<string, any>, ToolResult = any>(toolName: string, description: string, executor: (params: ToolParams, permissions: this['globalPermissions']) => Promise<ToolResult> | ToolResult, paramsSchema: Record<keyof ToolParams, z.ZodTypeAny>, returnSchema?: z.ZodAny): LocalTool<ToolParams, ToolResult, this['globalPermissions']> {

        const localTool = new LocalTool<ToolParams, ToolResult, this['globalPermissions']>(this.fnameWithNamespace(toolName), description, executor, paramsSchema, returnSchema)
        localTool.setPermission(this.globalPermissions)
        this.registeredTools.push(localTool)
        return localTool
    }

    public mcpTool<ToolParams extends Record<string, any> = Record<string, any>, ToolResult = any>(toolName: string, description: string, executor: (params: ToolParams) => Promise<ToolResult> | ToolResult, inputSchema: MCPToolInputSchemaLike, outputSchema?: any): MCPTool<ToolParams, ToolResult> {
        const mcpTool = new MCPTool<ToolParams, ToolResult>(this.fnameWithNamespace(toolName), description, executor, inputSchema, outputSchema)
        this.registeredTools.push(mcpTool)
        return mcpTool
    }

    private fnameWithNamespace(name: string): string {
        if (this.namespace) {
            return `${this.namespace}_${name}`
        }
        return name
    }

    public toToolList(): (LocalTool<any, any> | MCPTool<any, any>)[] {
        return this.registeredTools
    }


}

