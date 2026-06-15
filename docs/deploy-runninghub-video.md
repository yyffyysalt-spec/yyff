# RunningHub 视频处理 Worker 部署

本项目的视频处理包含两个独立 Cloudflare Worker：

- `runninghub-video-upscale-worker.js`：视频高清放大
- `runninghub-video-chroma-worker.js`：视频抠绿幕

两个 Worker 都不在前端保存 RunningHub API Key。API Key 只通过 Cloudflare Worker Secret 配置。

## 1. 准备 RunningHub 参数

在 RunningHub 对应视频工作流的 API 调用页面复制：

- workflowId
- 视频输入节点 nodeId
- 视频输入字段 fieldName
- 输出节点 nodeId

视频高清放大写入 `wrangler.video-upscale.toml`：

```toml
RUNNINGHUB_VIDEO_UPSCALE_WORKFLOW_ID = "你的 workflowId"
RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID = "视频输入 nodeId"
RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME = "视频输入 fieldName"
RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_NODE_ID = "输出 nodeId"
```

视频抠绿幕写入 `wrangler.video-chroma.toml`：

```toml
RUNNINGHUB_VIDEO_CHROMA_WORKFLOW_ID = "你的 workflowId"
RUNNINGHUB_VIDEO_CHROMA_INPUT_NODE_ID = "视频输入 nodeId"
RUNNINGHUB_VIDEO_CHROMA_INPUT_FIELD_NAME = "视频输入 fieldName"
RUNNINGHUB_VIDEO_CHROMA_OUTPUT_NODE_ID = "输出 nodeId"
```

如果绿幕工作流支持绿幕颜色、容差、羽化和去绿边参数，可以继续在 Worker 中补充对应节点映射；当前前端已经展示这些参数，Worker 只会传已经配置的工作流核心输入。

## 2. 设置 RunningHub API Key

```bash
npx wrangler secret put RUNNINGHUB_API_KEY --config wrangler.video-upscale.toml
npx wrangler secret put RUNNINGHUB_API_KEY --config wrangler.video-chroma.toml
```

不要把 API Key 写进 `config.js`、`wrangler.*.toml` 或仓库。

## 3. 部署 Worker

```bash
npm run deploy:video-upscale-worker
npm run deploy:video-chroma-worker
```

部署完成后复制两个 Worker URL。

## 4. 配置前端 URL

编辑 `config.js`：

```js
VIDEO_UPSCALE_PROXY_URL: "https://runninghub-video-upscale-worker.xxx.workers.dev",
VIDEO_CHROMA_PROXY_URL: "https://runninghub-video-chroma-worker.xxx.workers.dev",
```

## 5. 验证 health

```bash
npm run verify:video-workers
```

每个 Worker 的 `?health=1` 应返回：

```json
{
  "ok": true,
  "hasApiKey": true,
  "configReady": true
}
```

如果 `configReady` 是 `false`，说明 workflowId 或节点参数还没有补齐。

## 6. 前端测试

1. 打开网页。
2. 左侧切换到 `视频处理`。
3. 上传 MP4、MOV 或 WEBM。
4. 选择 `只放大视频`、`只抠绿幕` 或 `抠绿幕 + 放大`。
5. 点击 `开始处理视频`。
6. 任务卡片应显示 `taskId`、轮询状态、耗时。
7. 完成后可预览和下载视频。

如果 Worker URL 或工作流参数未配置，页面会显示明确错误，不会只显示 `Failed to fetch`。
