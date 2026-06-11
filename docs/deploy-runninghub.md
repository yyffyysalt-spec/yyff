# RunningHub AI 高清增强部署说明

这份文档用于把当前网站的“AI 高清增强（实验）”接到 RunningHub 工作流，并通过 Cloudflare Worker 安全中转。

## 当前工作流配置

公开配置可以写进仓库：

```text
RUNNINGHUB_WORKFLOW_ID=1962513607676309506
RUNNINGHUB_IMAGE_NODE_ID=1076
RUNNINGHUB_IMAGE_FIELD_NAME=image
```

私密配置不能写进仓库：

```text
RUNNINGHUB_API_KEY
CLOUDFLARE_API_TOKEN
```

## 获取 RunningHub API Key

1. 登录 RunningHub。
2. 打开账号或 API 管理页面。
3. 创建或复制 API Key。
4. 只把它配置到 Cloudflare Worker Secret 或 GitHub Secret，不要写进 `app.js`、`index.html`、`config.js` 或 `wrangler.toml`。

## 确认 workflowId 和节点

当前使用：

```text
workflowId=1962513607676309506
image nodeId=1076
image fieldName=image
```

以后如果更换 RunningHub 工作流，需要在 RunningHub 的 API JSON 或 API 详情页确认：

```text
RUNNINGHUB_WORKFLOW_ID
RUNNINGHUB_IMAGE_NODE_ID
RUNNINGHUB_IMAGE_FIELD_NAME
```

如果工作流还有分辨率或放大倍数节点，可以额外配置：

```text
RUNNINGHUB_RESOLUTION_NODE_ID
RUNNINGHUB_RESOLUTION_FIELD_NAME
```

## 登录 Cloudflare

本地部署需要安装 Node.js 和 npm，然后安装依赖：

```bash
npm install
```

登录 Cloudflare：

```bash
npx wrangler login
```

## 部署 Worker

项目已包含 `wrangler.toml`：

```toml
name = "runninghub-upscale-worker"
main = "runninghub-upscale-worker.js"
```

先运行检查：

```bash
npm run check
```

部署 Worker：

```bash
npm run deploy:worker
```

## 设置 Worker Secret

把 RunningHub API Key 设置为 Worker Secret：

```bash
npx wrangler secret put RUNNINGHUB_API_KEY
```

命令提示输入时，粘贴 RunningHub API Key。

再部署一次 Worker：

```bash
npm run deploy:worker
```

## 配置前端 UPSCALE_PROXY_URL

部署 Worker 后，Cloudflare 会给出类似这样的地址：

```text
https://runninghub-upscale-worker.your-subdomain.workers.dev
```

打开 `config.js`，填入 Worker URL：

```js
window.APP_CONFIG = {
  UPSCALE_PROXY_URL: "https://runninghub-upscale-worker.your-subdomain.workers.dev",
};
```

注意：这里只能放公开 Worker 地址，不能放 RunningHub API Key。

## 部署 GitHub Pages

GitHub Pages 使用仓库发布源。修改 `config.js` 后提交并推送：

```bash
git add config.js
git commit -m "Configure RunningHub worker URL"
git push origin main
```

公开页面：

```text
https://yyffyysalt-spec.github.io/yyff/
```

## GitHub Actions 手动部署

项目包含 `.github/workflows/deploy.yml`，可以在 GitHub Actions 页面手动触发。

需要先在 GitHub 仓库 Settings -> Secrets and variables -> Actions 里添加：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
RUNNINGHUB_API_KEY
```

如果 Actions 设置 Worker Secret 失败，可以先本地运行一次：

```bash
npx wrangler secret put RUNNINGHUB_API_KEY
```

## 测试

### 普通放大

1. 打开网页。
2. 上传图片。
3. 放大方式选择“普通放大”。
4. 点击“开始处理”。
5. 结果应正常生成，编辑、预览、下载可用。

### AI 高清增强未配置

1. 保持 `config.js` 里的 `UPSCALE_PROXY_URL` 为空。
2. 放大方式选择“AI 高清增强（实验）”。
3. 点击“开始处理”。
4. 任务卡片应显示：`UPSCALE_PROXY_URL 为空：AI 高清增强服务未配置`。

### AI 高清增强成功

1. `config.js` 填入 Worker URL。
2. Cloudflare Worker 已配置 `RUNNINGHUB_API_KEY`。
3. `wrangler.toml` 已配置：

```text
RUNNINGHUB_WORKFLOW_ID=1962513607676309506
RUNNINGHUB_IMAGE_NODE_ID=1076
RUNNINGHUB_IMAGE_FIELD_NAME=image
```

4. 放大方式选择“AI 高清增强（实验）”。
5. 点击“开始处理”。
6. 结果应由 RunningHub 返回真实图片 Blob 后写入任务卡片。

### RunningHub 失败错误显示

浏览器开发者工具：

1. 打开 Network。
2. 找到 Worker 请求。
3. 查看 Response，错误格式应为：

```json
{
  "ok": false,
  "stage": "create_task",
  "message": "...",
  "detail": "..."
}
```

Cloudflare Logs：

查看日志里的 `stage` 字段：

```text
received_request
upload_resource_start
upload_resource_done
create_task_start
create_task_done
poll_task_start
output_found
download_result_done
```

这些日志不会打印 RunningHub API Key。
