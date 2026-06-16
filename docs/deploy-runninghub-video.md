# RunningHub 视频 Worker 一键部署

视频模块现在使用固定 RunningHub AI App 接入，不再需要手动填写 workflowId、input nodeId、output nodeId。

- 视频抠像 AI App：`/run/ai-app/1893587363086417921`
- 视频高清放大 AI App：`/run/ai-app/2033815457634983938`

RunningHub API Key 只能保存到 Cloudflare Worker Secret，不要写进 `config.js`、`app.js`、`index.html`、`wrangler.*.toml` 或任何仓库文件。

## 一键部署

运行：

```bash
npm run deploy:video-all
```

脚本会提示：

```text
请输入 RunningHub API Key：
```

粘贴 API Key 后回车。脚本会自动完成：

1. 检查项目文件和固定 AI App 配置。
2. 给视频抠像 Worker 写入 `RUNNINGHUB_API_KEY` Secret。
3. 给视频高清放大 Worker 写入同一个 `RUNNINGHUB_API_KEY` Secret。
4. 部署 `runninghub-video-chroma-worker`。
5. 部署 `runninghub-video-upscale-worker`。
6. 自动读取部署后的两个 Worker URL。
7. 写入 `config.js`：
   - `VIDEO_CHROMA_PROXY_URL`
   - `VIDEO_UPSCALE_PROXY_URL`
8. 执行：
   - `npm run check`
   - `npm run verify:video-workers`
9. 最后询问是否提交并推送。

## 固定 AI App 配置

`wrangler.video-chroma.toml`：

```toml
RUNNINGHUB_VIDEO_CHROMA_APP_ID = "1893587363086417921"
RUNNINGHUB_VIDEO_CHROMA_CREATE_ENDPOINT = "https://www.runninghub.cn/openapi/v2/run/ai-app/1893587363086417921"
```

`wrangler.video-upscale.toml`：

```toml
RUNNINGHUB_VIDEO_UPSCALE_APP_ID = "2033815457634983938"
RUNNINGHUB_VIDEO_UPSCALE_CREATE_ENDPOINT = "https://www.runninghub.cn/openapi/v2/run/ai-app/2033815457634983938"
```

这两个文件不保存 API Key。

## Worker 工作方式

两个 Worker 都是两阶段异步模式：

1. 前端上传视频给 Worker。
2. Worker 上传视频到 RunningHub。
3. Worker 自动读取 RunningHub AI App 的 API 调用示例，提取 `nodeInfoList`，把视频上传节点替换为上传后的文件名。
4. Worker 调用固定 AI App create endpoint 创建任务，并立即返回 `taskId`。
5. 前端每隔几秒请求 Worker 查询状态。
6. Worker 每次 status 请求只查询 RunningHub 一次，不在 Worker 内部长轮询。
7. RunningHub 完成后，Worker 扫描所有可下载视频输出，返回 `resultUrl` 给前端。
8. 前端下载视频结果并显示在任务卡片里。

## Health 检查

运行：

```bash
npm run verify:video-workers
```

配置完成时，两个 Worker health 会返回类似：

```json
{
  "ok": true,
  "worker": "runninghub-video-chroma-worker",
  "mode": "ai-app",
  "appId": "1893587363086417921",
  "hasApiKey": true,
  "configReady": true,
  "missing": []
}
```

如果 `configReady` 是 `false`，请查看 `missing` 字段。常见原因是 Worker Secret 里还没有 `RUNNINGHUB_API_KEY`。

## 查看日志

视频高清放大：

```bash
npm run tail:video-upscale-worker
```

视频抠像：

```bash
npm run tail:video-chroma-worker
```

日志会看到：

- `upload_resource_start`
- `upload_resource_done`
- `create_task_payload_summary`
- `create_task_done`
- `status_check`
- `output_candidates`

日志不会输出 RunningHub API Key。

## 网页测试

1. 打开 `https://yyffyysalt-spec.github.io/yyff/`。
2. `Command + Shift + R` 强制刷新。
3. 进入 `视频处理`。
4. 上传一个 MP4、MOV 或 WEBM。
5. 选择 `只抠绿幕`，点击 `开始处理视频`。
6. 再选择 `高清放大` 单独测试一次。

当前 `抠绿幕 + 放大` 组合链路仍保持提示：

```text
组合处理正在接入中，请先分别使用只抠绿幕或高清放大。
```

## 常见问题

### Worker URL 未配置

运行 `npm run deploy:video-all`，脚本会自动把两个 Worker URL 写入 `config.js`。

### RunningHub API Key 缺失

重新运行：

```bash
npm run deploy:video-all
```

并按提示输入 API Key。Key 只会写入 Cloudflare Worker Secret。

### 创建任务成功但没拿到 taskId

Worker 已兼容 `taskId`、`data.taskId`、`result.taskId`、`raw.taskId` 以及 `detail` JSON 字符串中的 taskId。如果仍失败，请查看任务卡片错误里的 `appId`、`endpoint` 和 RunningHub 原始响应摘要。

### 没有视频输出

Worker 会递归扫描 `resultUrl`、`fileUrl`、`outputUrl`、`downloadUrl`、`results`、`outputs`、`data` 等字段里的视频链接。如果 RunningHub 后台有结果但网页没识别，请用 `taskId` 对照 Worker 日志排查。
