import fs from "node:fs";

const VIDEO_TARGETS = [
  {
    name: "VIDEO_CHROMA_PROXY_URL",
    toml: "wrangler.video-chroma.toml",
    appId: "1893587363086417921",
    endpoint: "https://www.runninghub.cn/openapi/v2/run/ai-app/1893587363086417921",
  },
  {
    name: "VIDEO_UPSCALE_PROXY_URL",
    toml: "wrangler.video-upscale.toml",
    appId: "2033815457634983938",
    endpoint: "https://www.runninghub.cn/openapi/v2/run/ai-app/2033815457634983938",
  },
];

const requiredFiles = [
  "config.js",
  "runninghub-video-upscale-worker.js",
  "runninghub-video-chroma-worker.js",
  "wrangler.video-upscale.toml",
  "wrangler.video-chroma.toml",
  "scripts/deploy-video-all.js",
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
  "deploy:video-all",
  "tail:video-upscale-worker",
  "tail:video-chroma-worker",
  "verify:video-workers",
]) {
  if (!scripts[name]) throw new Error(`package.json 缺少脚本：${name}`);
}

for (const target of VIDEO_TARGETS) {
  const toml = fs.readFileSync(target.toml, "utf8");
  if (!toml.includes(target.appId)) throw new Error(`${target.toml} 缺少固定 AI App ID：${target.appId}`);
  if (!toml.includes(target.endpoint)) throw new Error(`${target.toml} 缺少固定 create endpoint：${target.endpoint}`);
}

const configText = fs.readFileSync("config.js", "utf8");
function readConfigUrl(key) {
  const match = configText.match(new RegExp(`${key}\\s*:\\s*["']([^"']*)["']`));
  return match?.[1] || "";
}

let checked = 0;
for (const target of VIDEO_TARGETS) {
  const url = readConfigUrl(target.name);
  if (!url) {
    console.log(`${target.name}: 未配置，前端会显示明确提示。`);
    continue;
  }
  checked += 1;
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}health=1`);
  const data = await response.json();
  console.log(`${target.name}:`, data);
  if (!data.ok) throw new Error(`${target.name} health 返回失败`);
  if (data.mode !== "ai-app") throw new Error(`${target.name} health mode 不是 ai-app：${JSON.stringify(data)}`);
  if (String(data.appId) !== target.appId) throw new Error(`${target.name} health appId 不正确：${JSON.stringify(data)}`);
  if (!data.hasApiKey || !data.configReady) {
    throw new Error(`${target.name} health 未就绪：${JSON.stringify(data)}`);
  }
}

if (!checked) console.log("视频 Worker URL 暂未配置，跳过远程 health 检查。");
