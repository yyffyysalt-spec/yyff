import fs from "node:fs";

const requiredFiles = [
  "config.js",
  "runninghub-video-upscale-worker.js",
  "runninghub-video-chroma-worker.js",
  "wrangler.video-upscale.toml",
  "wrangler.video-chroma.toml",
  "package.json",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`缺少文件：${file}`);
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const scripts = packageJson.scripts || {};
for (const name of [
  "deploy:video-upscale-worker",
  "deploy:video-chroma-worker",
  "tail:video-upscale-worker",
  "tail:video-chroma-worker",
  "verify:video-workers",
]) {
  if (!scripts[name]) throw new Error(`package.json 缺少脚本：${name}`);
}

const upscaleToml = fs.readFileSync("wrangler.video-upscale.toml", "utf8");
const chromaToml = fs.readFileSync("wrangler.video-chroma.toml", "utf8");
for (const key of [
  "RUNNINGHUB_VIDEO_UPSCALE_WORKFLOW_ID",
  "RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID",
  "RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME",
  "RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_NODE_ID",
  "RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_FIELD_NAME",
]) {
  if (!upscaleToml.includes(key)) throw new Error(`wrangler.video-upscale.toml 缺少：${key}`);
}
for (const key of [
  "RUNNINGHUB_VIDEO_CHROMA_WORKFLOW_ID",
  "RUNNINGHUB_VIDEO_CHROMA_INPUT_NODE_ID",
  "RUNNINGHUB_VIDEO_CHROMA_INPUT_FIELD_NAME",
  "RUNNINGHUB_VIDEO_CHROMA_OUTPUT_NODE_ID",
  "RUNNINGHUB_VIDEO_CHROMA_OUTPUT_FIELD_NAME",
]) {
  if (!chromaToml.includes(key)) throw new Error(`wrangler.video-chroma.toml 缺少：${key}`);
}

const configText = fs.readFileSync("config.js", "utf8");
function readConfigUrl(key) {
  const match = configText.match(new RegExp(`${key}\\s*:\\s*["']([^"']*)["']`));
  return match?.[1] || "";
}

const urls = [
  ["VIDEO_UPSCALE_PROXY_URL", readConfigUrl("VIDEO_UPSCALE_PROXY_URL")],
  ["VIDEO_CHROMA_PROXY_URL", readConfigUrl("VIDEO_CHROMA_PROXY_URL")],
];

let checked = 0;
for (const [name, url] of urls) {
  if (!url) {
    console.log(`${name}: 未配置，前端会显示明确提示。`);
    continue;
  }
  checked += 1;
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}health=1`);
  const data = await response.json();
  console.log(`${name}:`, data);
  if (!data.ok) throw new Error(`${name} health 返回失败`);
  if (!data.hasApiKey || !data.configReady) {
    throw new Error(`${name} health 未就绪：${JSON.stringify(data)}`);
  }
}

if (!checked) console.log("视频 Worker URL 暂未配置，跳过远程 health 检查。");
