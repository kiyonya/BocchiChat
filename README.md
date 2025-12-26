用提示词自定义Bot，并持续对话
仍在尝试开发中

## 使用方法
在项目根目录创建.env文件，字段如下：
``` typescript
APIKEY = 你的APIKey
BASE_URL = 你的模型聊天地址
MODEL_NAME = 你的模型名称
```

创建 index.ts文件

创建bot实例，传入聊天测试函数
``` typescript
const bot = new KomeijiKoishi()
botChatLine(bot)
```
使用node运行你的测试文件
``` bash
node index.ts
```


## 使用协议
本项目使用MIT协议开源，仅作为OpenAI库的封装，不提供AI服务。
