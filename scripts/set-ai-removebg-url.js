import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(rootDir, "config.js");
const url = String(process.argv[2] || "").trim();

if (!url) {
  console.error("请传入 Worker URL，例如：");
  console.error('npm run set:ai-removebg-url -- "https://runninghub-ai-removebg-worker.xxx.workers.dev"');
  process.exit(1);
}

if (!/^https:\/\/[^\s"']+$/i.test(url)) {
  console.error("RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL 必须是 https 地址。");
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  console.error("找不到 config.js。");
  process.exit(1);
}

const source = fs.readFileSync(configPath, "utf8");
const pattern = /RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL\s*:\s*"[^"]*"/;

if (!pattern.test(source)) {
  console.error("config.js 中找不到 RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL。");
  process.exit(1);
}

const next = source.replace(pattern, `RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL: "${url}"`);
fs.writeFileSync(configPath, next);
console.log(`已更新 config.js：RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL = ${url}`);
