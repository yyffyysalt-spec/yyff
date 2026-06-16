# RunningHub 视频处理 Worker 部署说明

这个项目的视频处理分成两个独立的 Cloudflare Worker：

- `runninghub-video-upscale-worker.js`：视频高清放大
- `runninghub-video-chroma-worker.js`：视频抠绿幕

RunningHub API Key 只能放在 Cloudflare Worker Secret 里，不要写进 `config.js`、`app.js`、`index.html` 或任何仓库文件。

## 1. 需要准备的 RunningHub 参数

在 RunningHub 的视频工作流 API 调用页面里，分别找到以下参数。

### 视频高清放大

填写到 `wrangler.video-upscale.toml`：

```toml
RUNNINGHUB_VIDEO_UPSCALE_WORKFLOW_ID = "你的 workflowId"
RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID = "视频输入节点 nodeId"
RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME = "视频输入字段 fieldName"
RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_NODE_ID = "视频输出节点 nodeId"
RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_FIELD_NAME = "视频输出字段 fieldName"
```

如果你的 RunningHub 视频高清放大是 AI App，不是 workflow，可以先填写：

```toml
RUNNINGHUB_VIDEO_UPSCALE_APP_ID = "你的 appId"
RUNNINGHUB_VIDEO_UPSCALE_CREATE_ENDPOINT = "RunningHub AI App 创建任务接口"
RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID = "视频输入节点 nodeId"
RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME = "视频输入字段 fieldName"
```

### 视频抠绿幕

填写到 `wrangler.video-chroma.toml`：

```toml
RUNNINGHUB_VIDEO_CHROMA_WORKFLOW_ID = "你的 workflowId"
RUNNINGHUB_VIDEO_CHROMA_INPUT_NODE_ID = "视频输入节点 nodeId"
RUNNINGHUB_VIDEO_CHROMA_INPUT_FIELD_NAME = "视频输入字段 fieldName"
RUNNINGHUB_VIDEO_CHROMA_OUTPUT_NODE_ID = "视频输出节点 nodeId"
RUNNINGHUB_VIDEO_CHROMA_OUTPUT_FIELD_NAME = "视频输出字段 fieldName"
```

如果工作流支持绿幕颜色、容差、边缘羽化、去绿边参数，可以继续填写这些可选节点。没有对应节点就保持空字符串，Worker 不会强行传：

```toml
RUNNINGHUB_VIDEO_CHROMA_KEY_COLOR_NODE_ID = ""
RUNNINGHUB_VIDEO_CHROMA_KEY_COLOR_FIELD_NAME = ""
RUNNINGHUB_VIDEO_CHROMA_TOLERANCE_NODE_ID = ""
RUNNINGHUB_VIDEO_CHROMA_TOLERANCE_FIELD_NAME = ""
RUNNINGHUB_VIDEO_CHROMA_FEATHER_NODE_ID = ""
RUNNINGHUB_VIDEO_CHROMA_FEATHER_FIELD_NAME = ""
RUNNINGHUB_VIDEO_CHROMA_SPILL_NODE_ID = ""
RUNNINGHUB_VIDEO_CHROMA_SPILL_FIELD_NAME = ""
```

## 2. 设置 RunningHub API Key

分别给两个 Worker 设置 Secret：

```bash
npx wrangler secret put RUNNINGHUB_API_KEY --config wrangler.video-upscale.toml
npx wrangler secret put RUNNINGHUB_API_KEY --config wrangler.video-chroma.toml
```

终端会让你粘贴 RunningHub API Key。粘贴后回车即可。这个 Key 不会写入仓库文件。

## 3. 部署两个 Worker

```bash
npm run deploy:video-upscale-worker
npm run deploy:video-chroma-worker
```

部署成功后，终端会显示类似：

```text
https://runninghub-video-upscale-worker.xxx.workers.dev
https://runninghub-video-chroma-worker.xxx.workers.dev
```

复制这两个地址。

## 4. 写入前端 config.js

打开 `config.js`，填入两个 Worker URL：

```js
VIDEO_UPSCALE_PROXY_URL: "https://runninghub-video-upscale-worker.xxx.workers.dev",
VIDEO_CHROMA_PROXY_URL: "https://runninghub-video-chroma-worker.xxx.workers.dev",
```

如果 URL 为空，网页不会崩溃，但点击处理时会提示：

```text
视频 Worker URL 未配置，请先部署 RunningHub 视频 Worker。
```

## 5. 验证 Worker health

运行：

```bash
npm run verify:video-workers
```

配置完整时，health 会返回：

```json
{
  "ok": true,
  "worker": "runninghub-video-upscale-worker",
  "hasApiKey": true,
  "configReady": true,
  "missing": [],
  "version": "..."
}
```

如果 `configReady` 是 `false`，请查看 `missing` 里列出的缺失参数。

## 6. 查看 Worker 日志

高清放大日志：

```bash
npm run tail:video-upscale-worker
```

抠绿幕日志：

```bash
npm run tail:video-chroma-worker
```

日志会看到：

- `upload_resource_start`
- `upload_resource_done`
- `create_task_payload_summary`
- `create_task_done`
- `status_check`
- `selected_output`

日志不会输出 RunningHub API Key。

## 7. 网页测试

1. 打开网页。
2. 进入 `视频处理`。
3. 上传一个 MP4、MOV 或 WEBM。
4. 选择 `只抠绿幕`，点击 `开始处理视频`。
5. 任务卡片应显示 taskId 和轮询状态。
6. 完成后可以点击 `查看` 预览，也可以下载。
7. 再选择 `高清放大` 单独测试一次。

当前 `抠绿幕 + 放大` 组合链路还在接入中。点击时会提示：

```text
组合处理正在接入中，请先分别使用只抠绿幕或高清放大。
```

## 8. 常见问题

### Worker URL 未配置

请先部署 Worker，并把 Worker URL 写入 `config.js`。

### RunningHub 视频工作流未配置

说明 `wrangler.video-*.toml` 里缺少 workflowId、输入节点或输出节点参数。补齐后重新部署 Worker。

### 当前网络未连接

RunningHub 视频处理必须联网。恢复网络后重试。

### RunningHub 任务失败

任务卡片会显示 RunningHub 返回的错误、详情和 taskId。用 taskId 去 RunningHub 后台查看任务记录。
