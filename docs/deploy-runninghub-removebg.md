# RunningHub RMBG-2.0 高质量抠图部署说明

这份文档用于把“RMBG-2.0 高质量抠图”接到 RunningHub 抠图工作流，并通过 Cloudflare Worker 安全中转。

## 当前工作流节点

已知节点配置：

```text
RUNNINGHUB_REMOVEBG_IMAGE_NODE_ID=3
RUNNINGHUB_REMOVEBG_IMAGE_FIELD_NAME=image
```

还需要从 RunningHub 工作流详情里确认并填写：

```text
RUNNINGHUB_REMOVEBG_WORKFLOW_ID
```

如果想强制指定透明 PNG 输出节点，可以额外配置：

```text
RUNNINGHUB_REMOVEBG_OUTPUT_NODE_ID
```

默认会避开 mask 输出和白底输出，优先选择透明背景 PNG。

## 不要写进仓库的密钥

不要把这些内容写入 `app.js`、`index.html`、`config.js` 或 `wrangler.removebg.toml`：

```text
RUNNINGHUB_API_KEY
```

## 部署 Worker

先检查代码：

```bash
npm run check
```

部署抠图 Worker：

```bash
npm run deploy:removebg-worker
```

设置 RunningHub API Key：

```bash
npx wrangler secret put RUNNINGHUB_API_KEY --config wrangler.removebg.toml
```

如果 `wrangler.removebg.toml` 里的 `RUNNINGHUB_REMOVEBG_WORKFLOW_ID` 仍为空，请先填入真实工作流 ID 再部署。

## 配置前端

部署 Worker 后，Cloudflare 会给出类似这样的地址：

```text
https://runninghub-removebg-worker.your-subdomain.workers.dev
```

打开 `config.js`，填入公开 Worker URL：

```js
window.APP_CONFIG = {
  REMOVE_BG_PROXY_URL: "https://runninghub-removebg-worker.your-subdomain.workers.dev",
  REMOVE_BG_WORKFLOWS: [
    {
      id: "rmbg20",
      label: "RMBG-2.0 高质量抠图",
      provider: "runninghub",
      default: true,
    },
  ],
};
```

注意：这里只能放公开 Worker 地址和显示名称，不能放 RunningHub API Key。

## 测试

1. 打开网页。
2. 确认“抠图模型”默认选中“RMBG-2.0 高质量抠图”。
3. 上传图片。
4. 点击“开始处理”。
5. Worker 未配置时，任务卡片应显示“RunningHub 抠图服务未配置”。
6. Worker 配置正确时，应返回透明 PNG，编辑、预览、下载和 ZIP 下载正常可用。

