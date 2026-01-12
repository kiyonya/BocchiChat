
import OpenAI from "openai"
import z from "zod";

interface MCPToolIOSchema {
    [x: string]: unknown;
    type: "object";
    properties?: {
        [x: string]: object;
    } | undefined;
    required?: string[] | undefined;
}

export type MCPToolInputSchemaLike = MCPToolIOSchema
export type MCPToolOutputSchemaLike = MCPToolIOSchema
type PermissionChecker = () => boolean | Promise<boolean>
type IPermissions = Record<string,PermissionChecker>

class ToolBase<ToolParams extends Record<string, any> = Record<string, any>, ToolResult = any,Permissions = IPermissions> {
    protected executor: ((params: ToolParams,permission:Permissions) => ToolResult | Promise<ToolResult>) | null = null;
    public toolName: string = '';
    public description: string = '';
}

export class LocalTool<ToolParams extends Record<string, any> = {}, ToolResult = any,Permissions = IPermissions> extends ToolBase<ToolParams, ToolResult,Permissions> {

    protected executor: ((params: ToolParams,permission:Permissions) => ToolResult | Promise<ToolResult>) | null = null;
    public toolName: string = '';
    public description: string = '';
    private paramsSchema: Record<keyof ToolParams, z.ZodTypeAny> | null = null;
    private zodSchema: z.ZodObject<Record<keyof ToolParams, z.ZodTypeAny>> | null = null;
    private returnsSchema?: z.ZodAny

    public permissions:Permissions = {} as Permissions

    

    constructor(toolName: string, description: string, executor: (params: ToolParams,permission:Permissions) => ToolResult | Promise<ToolResult>, paramsSchema: Record<keyof ToolParams, z.ZodTypeAny>, returnsSchema?: z.ZodAny) {
        super()
        this.toolName = toolName;
        this.description = description;
        this.executor = executor;
        this.paramsSchema = paramsSchema;
        this.zodSchema = z.object(paramsSchema);
        this.returnsSchema = returnsSchema
    }

    public setPermission(permission:Permissions){
        this.permissions = permission
    }

    public async execute(params: ToolParams): Promise<ToolResult> {
        if (!this.executor) {
            throw new Error('Executor not initialized');
        }
        if (this.zodSchema) {
            const validatedParams = this.zodSchema.parse(params) as ToolParams;
            return await this.executor(validatedParams,this.permissions);
        }
        return await this.executor(params,this.permissions);
    }

    public toOpenAITool(): OpenAI.Chat.ChatCompletionFunctionTool {
        if (!this.paramsSchema) {
            throw new Error('Params schema not initialized');
        }
        const properties: Record<string, any> = {};
        const required: string[] = [];
        Object.entries(this.paramsSchema).forEach(([key, schema]) => {
            if (schema instanceof z.ZodType) {
                const openAIProps = this.zodTypeToOpenAI(schema);
                properties[key] = openAIProps;
                if (!schema.safeParse(undefined).success && !(schema instanceof z.ZodDefault)) {
                    required.push(key);
                }
            }
        });

        return {
            type: 'function',
            function: {
                name: this.toolName,
                description: this.description,
                parameters: {
                    type: 'object',
                    properties,
                    required,
                },
            },
        };
    }

    private zodTypeToOpenAI(zodSchema: z.ZodTypeAny): Record<string, any> {
        const result: Record<string, any> = {};
        if (zodSchema instanceof z.ZodString) {
            result.type = 'string';
            const checks = (zodSchema as any)._def.checks || [];
            checks.forEach((check: any) => {
                if (check.kind === 'min') {
                    result.minLength = check.value;
                } else if (check.kind === 'max') {
                    result.maxLength = check.value;
                }
            });
        } else if (zodSchema instanceof z.ZodNumber) {
            result.type = 'number';
            const checks = (zodSchema as any)._def.checks || [];
            checks.forEach((check: any) => {
                if (check.kind === 'min') {
                    result.minimum = check.value;
                } else if (check.kind === 'max') {
                    result.maximum = check.value;
                }
            });
        } else if (zodSchema instanceof z.ZodBoolean) {
            result.type = 'boolean';
        } else if (zodSchema instanceof z.ZodArray) {
            result.type = 'array';
            result.items = this.zodTypeToOpenAI((zodSchema as z.ZodArray<any>).element);
        } else if (zodSchema instanceof z.ZodEnum) {
            result.type = 'string';
            result.enum = (zodSchema as z.ZodEnum<any>).options;
        } else if (zodSchema instanceof z.ZodObject) {
            result.type = 'object';
            const shape = (zodSchema as z.ZodObject<any>).shape;
            result.properties = {};
            result.required = [];

            Object.entries(shape).forEach(([key, nestedSchema]) => {
                result.properties[key] = this.zodTypeToOpenAI(nestedSchema as z.ZodTypeAny);
                if (!(nestedSchema as z.ZodTypeAny).safeParse(undefined).success) {
                    result.required.push(key);
                }
            });

        } else if (zodSchema instanceof z.ZodOptional || zodSchema instanceof z.ZodDefault) {
            const innerType = (zodSchema as any)._def.innerType;
            return this.zodTypeToOpenAI(innerType);
        } else if (zodSchema instanceof z.ZodUnion) {
            const options = (zodSchema as z.ZodUnion<any>).options;
            if (options.length > 0) {
                return this.zodTypeToOpenAI(options[0]);
            }
        } else {
            result.type = 'string';
        }

        return result;
    }
}

export class MCPTool<ToolParams extends Record<string, any> = {}, ToolResult = any> extends ToolBase<ToolParams, ToolResult> {

    protected executor: (params: ToolParams) => Promise<ToolResult> | ToolResult;
    public toolName: string
    public description: string = ''
    public inputSchema: MCPToolInputSchemaLike
    public outputSchema?: MCPToolOutputSchemaLike

    constructor(toolName: string, description: string, executor: (params: ToolParams) => Promise<ToolResult> | ToolResult, inputSchema: MCPToolInputSchemaLike, outputSchema?: MCPToolOutputSchemaLike) {
        super()
        this.toolName = toolName
        this.description = description
        this.executor = executor
        this.inputSchema = inputSchema
        this.outputSchema = outputSchema
    }

    public async execute(params: ToolParams): Promise<ToolResult> {
        if (!this.executor) {
            throw new Error('Executor not initialized');
        }
        return await this.executor(params);
    }

    public toOpenAITool(): OpenAI.Chat.ChatCompletionFunctionTool {
        return {
            type: 'function',
            function: {
                name: this.toolName,
                description: this.description,
                parameters: this.inputSchema
            },
        }
    }
}