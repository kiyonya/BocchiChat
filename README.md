# BocchiChat

使用大语言模型，创建会使用工具的角色，让你的AI具有角色模拟、文件读取、网络请求等多种功能

---

## 快速开始

1. 使用npm或者yarn安装需要的第三方库
``` bash
npm install
```
或者
``` bash
yarn install
```
2. 在项目根目录创建.env文件,填写你的调用API信息，字段如下：
``` typescript
APIKEY = 你的APIKey
BASE_URL = 你的模型聊天地址
MODEL_NAME = 你的模型名称
```

3. 创建测试文件 例如 index.ts
``` typescript
import dotenv from 'dotenv'
//引入聊天测试函数
import { botChatLine } from './utils/bot_chat_line.ts'

dotenv.config() // 注册环境变量

process.stdin.resume() // 保持进程活跃

// 导入Bot模型 具体bot模型请看文档
import KirisameMarisa from './bots/tohou/kirisame_marisa.ts' 

// 创建模型实例
const bot = new KirisameMarisa()
botChatLine(bot)
```
4. 使用node运行你的测试文件，如果你的Nodejs版本 > 24,你可以直接运行ts文件，或者你可以使用tsc进行编译后运行
``` bash
node index.ts
```

---

## Bot技能
任何bot都存在方法 defineFunctions，传入你希望这个Bot拥有的技能，这些技能通过模型函数调用实现，请确保你的模型支持function_call或者tool_call
``` typescript
// 创建模型实例
const bot = new KirisameMarisa()

bot.defineFunctions([
    LibNetwork.HttpRequest, //网络请求
    LibNetwork.OpenBrowser, //打开浏览器
    LibFile.ReadDirectory, //读取文件目录
    LibFile.WriteTextToFile, //写入文件
    LibFile.ReadTextFromFile, //读取文件
])

//开启聊天
botChatLine(bot)
```
BocchiChat预设了一些Bot技能

### LibNetwork 
- LibNetwork.HttpRequest - 发送http/https请求
- LibNetwork.OpenBrowser - 打开浏览器
- LibNetWork.FileDownloader - 下载文件到本地

### LibFile
- LibFile.MakeDirectory - 创建目录
- LibFile.ReadDirectory - 读取目录
- LibFile.PathExistCheck - 路径存在检查
- LibFile.JoinPathes - 路径拼接
- LibFile.WriteTextToFile - 写入文本到文件
- LibFile.ReadTextFromFile - 从文件读取文本

### LibOS
- LibOS.GetUserOSInfo - 获取系统信息
- LibOS.GetUserHomeDir - 获取系统用户根目录

### LibStd
- LibStd.StringToBase64 - 转化base64
- LibStd.Base64ToString - base64转字符串
- LibStd.GetDate - 获取详细时间
- LibStd.RandomInt - 随机整数
- LibStd.RandomFloat - 随机浮点数

---

## 自定义Bot技能

### 函数签名

```typescript
function createFunction<P extends Record<string, any>, R>(
    functionName: string,
    executor: (params: P) => Promise<R>,
    options?: CreateFunctionOptions<P>
): FunctionBase<P, R>
```

### 功能描述

`createFunction` 是一个高阶函数，用于创建可配置的、类型安全的函数对象。它封装了函数执行逻辑、参数定义和描述信息，返回一个 `FunctionBase` 实例，适用于构建工具函数库或API接口。

### 参数说明

### 1. `functionName: string`
- **类型**: `string`
- **必填**: 是
- **描述**: 函数的唯一标识名称
- **用途**: 用于区分不同的函数实例，通常作为函数的ID或名称

### 2. `executor: (params: P) => Promise<R>`
- **类型**: 异步函数
- **必填**: 是
- **描述**: 函数的核心执行逻辑
- **参数**: 
  - `params: P` - 符合泛型类型 `P` 的参数对象
- **返回值**: `Promise<R>` - 符合泛型类型 `R` 的异步结果
- **注意**: 如果未提供此参数，函数会抛出错误 `"No Entry Executor"`

### 3. `options?: CreateFunctionOptions<P>`
- **类型**: 配置对象（可选）
- **描述**: 函数的配置选项，用于定义参数规范和描述信息

#### `CreateFunctionOptions<P>` 接口结构：
```typescript
interface CreateFunctionOptions<P extends Record<string, any> = any> {
    parameters?: ToolParameter<P>[];
    description?: string;
}
```

##### `parameters?: ToolParameter<P>[]`
- **类型**: `ToolParameter<P>` 数组（可选）
- **描述**: 函数参数的详细定义
- **用途**: 定义每个参数的名称、类型、是否必需、描述等信息
- **示例**：
```typescript
parameters: [{
    name: 'destDir',
    type: 'string',
    required: true,
    description: "目标目录路径"
}]
```

##### `description?: string`
- **类型**: `string`（可选）
- **描述**: 函数的详细描述信息
- **用途**: 说明函数的功能、用途和使用方式

#### 返回值

- **类型**: `FunctionBase<P, R>`
- **描述**: 返回一个完整的函数对象，包含：
  - 函数名称
  - 执行器（executor）
  - 参数定义（如果有）
  - 描述信息（如果有）

#### 泛型参数

#### `P extends Record<string, any>`
- **约束**: 必须是一个对象类型（键值对）
- **用途**: 定义函数参数的类型
- **示例**: `{ destDir: string, recursive?: boolean }`

#### `R`
- **用途**: 定义函数返回值的类型
- **示例**: `boolean`, `string[]`, `{ isExist: boolean }` 等

**示例创建文件读取函数**

```typescript
interface ReadFileParams {
    filePath: string;
    encoding?: BufferEncoding;
}

const readFile = createFunction<ReadFileParams, string>(
    "ReadFile",
    async (params) => {
        const content = await fs.promises.readFile(
            params.filePath, 
            { encoding: params.encoding ?? 'utf-8' }
        );
        return content;
    },
    {
        parameters: [
            {
                name: 'filePath',
                type: 'string',
                required: true,
                description: "文件路径"
            },
            {
                name: 'encoding',
                type: 'string',
                required: false,
                description: "文件编码格式"
            }
        ],
        description: "读取文件内容并返回字符串"
    }
);
```

---
## 使用协议
本项目使用MIT协议开源
