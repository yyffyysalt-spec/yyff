# RunningHub AI App 抠图部署说明

本功能用于接入 RunningHub AI App：

- AI App 路径：`/run/ai-app/1950866462321876993`
- AI App ID：`1950866462321876993`
- 前端模型名称：`RunningHub AI 抠图`
- 前端模型 id：`runninghub-ai-removebg`

## 重要说明

这是 RunningHub AI App，不是普通 workflow。AI App 的 API 调用格式可能和 `workflowId + nodeInfoList` 不同，所以项目里新增了独立 Worker：

- `runninghub-ai-removebg-worker.js`
- `wrangler.ai-removebg.toml`

它不会影响现有 `RMBG-2.0 高质量抠图` Worker。

## 需要从 RunningHub 页面复制的参数

请打开 RunningHub AI App 的“API 调用”页面，复制并确认：

1. AI App create endpoint，也就是创建任务的接口地址。
2. 图片输入字段名，例如 `image`、`file`、`input_image` 等。
3. status / outputs 查询接口，如果页面提供专用接口。
4. 输出字段信息，例如透明图、mask、普通图所在字段名。
5. 如果需要额外参数，也要记录参数名和默认值。

如果这些参数没有配置，Worker 会返回：

```json
{
  "ok": false,
  "stage": "ai_app_api_not_configured",
  "message": "RunningHub AI App API 调用格式未配置，请补充 AI App API 请求参数。"
}
```

## 配置 Worker

### 一键部署

如果只想手动输入一次 RunningHub API Key，可以直接运行：

```bash
npm run deploy:ai-removebg-all
```

脚本会自动完成：

1. 检查 `package.json`、`runninghub-ai-removebg-worker.js`、`wrangler.ai-removebg.toml` 和 `config.js`。
2. 如果没有 `node_modules`，自动执行 `npm install`。
3. 提示输入 RunningHub API Key，并通过 Cloudflare Worker Secret 保存为 `RUNNINGHUB_API_KEY`。
4. 部署 `runninghub-ai-removebg-worker`。
5. 自动读取部署后的 Worker URL。
6. 自动写入 `config.js` 的 `RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL`。
7. 自动执行 `npm run check`。
8. 输出最终测试链接和下一步测试说明。

API Key 不会写入 `config.js`、`wrangler.ai-removebg.toml` 或任何源码文件。脚本最后会询问是否提交并推送配置变更到 GitHub，只有输入 `y` 才会执行。

### 手动部署

`wrangler.ai-removebg.toml` 已包含：

```toml
name = "runninghub-ai-removebg-worker"
main = "runninghub-ai-removebg-worker.js"
compatibility_date = "2025-01-01"

[vars]
RUNNINGHUB_AI_APP_ID = "1950866462321876993"
```

拿到 RunningHub AI App API 调用参数后，可以继续增加：

```toml
RUNNINGHUB_AI_APP_CREATE_ENDPOINT = "https://www.runninghub.ai/..."
RUNNINGHUB_AI_APP_STATUS_ENDPOINT = "https://www.runninghub.ai/task/openapi/outputs"
RUNNINGHUB_AI_APP_IMAGE_FIELD_NAME = "image"
```

不要把 `RUNNINGHUB_API_KEY` 写入 toml 或前端。

## 配置 Secret

```bash
npm run secret:ai-removebg
```

按提示粘贴 RunningHub API Key。

## 部署 Worker

```bash
npm run deploy:ai-removebg-worker
```

部署成功后会得到类似：

```text
https://runninghub-ai-removebg-worker.xxx.workers.dev
```

## 写入前端配置

```bash
npm run set:ai-removebg-url -- "https://runninghub-ai-removebg-worker.xxx.workers.dev"
```

这会写入 `config.js`：

```js
RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL: "https://runninghub-ai-removebg-worker.xxx.workers.dev"
```

## 检查

```bash
npm run check:ai-removebg
npm run check
```

## 测试

1. 打开网站。
2. 抠图模型选择 `RunningHub AI 抠图`。
3. 上传图片。
4. 点击开始处理。
5. 如果 Worker URL 为空，应显示“RunningHub AI 抠图服务未配置。”。
6. 如果 Worker 已部署但缺少 AI App create endpoint，应显示 `ai_app_api_not_configured` 诊断。
7. 如果 API 参数完整，任务应创建 taskId 并进入轮询。
8. 返回透明图时直接生成结果。
9. 返回 mask 时使用原图 + mask 合成透明 PNG。
10. 返回普通图片时作为 fallback 结果显示。
