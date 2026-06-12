import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const failures = [];
const tips = [];

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function record(ok, passMessage, failMessage, tip = "") {
  checks.push({ ok, message: ok ? passMessage : failMessage });
  if (!ok) {
    failures.push(failMessage);
    if (tip) tips.push(tip);
  }
}

function readTomlString(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m"));
  return match ? match[1].trim() : "";
}

record(
  exists("wrangler.ai-removebg.toml"),
  "wrangler.ai-removebg.toml 已存在",
  "缺少 wrangler.ai-removebg.toml",
  "请先创建 wrangler.ai-removebg.toml。",
);

record(
  exists("runninghub-ai-removebg-worker.js"),
  "runninghub-ai-removebg-worker.js 已存在",
  "缺少 runninghub-ai-removebg-worker.js",
  "请确认 RunningHub AI App 抠图 Worker 文件已提交。",
);

if (exists("wrangler.ai-removebg.toml")) {
  const wrangler = readText("wrangler.ai-removebg.toml");
  const appId = readTomlString(wrangler, "RUNNINGHUB_AI_APP_ID");
  const createEndpoint = readTomlString(wrangler, "RUNNINGHUB_AI_APP_CREATE_ENDPOINT");
  const imageFieldName = readTomlString(wrangler, "RUNNINGHUB_AI_APP_IMAGE_FIELD_NAME");

  record(
    appId === "1950866462321876993",
    "RUNNINGHUB_AI_APP_ID = 1950866462321876993",
    `RUNNINGHUB_AI_APP_ID 应为 1950866462321876993，当前为 ${appId || "未配置"}`,
    "请在 wrangler.ai-removebg.toml 中配置 RUNNINGHUB_AI_APP_ID = \"1950866462321876993\"。",
  );

  if (!createEndpoint) {
    tips.push("AI App create endpoint 尚未配置；Worker 会返回 ai_app_api_not_configured。请从 RunningHub AI App 的 API 调用页面复制 create endpoint 和图片字段名。");
  }

  if (!imageFieldName) {
    tips.push("RUNNINGHUB_AI_APP_IMAGE_FIELD_NAME 未配置时默认使用 image；如果 AI App 页面展示了其它字段名，请写入 wrangler.ai-removebg.toml。");
  }
}

if (exists("config.js")) {
  const config = readText("config.js");
  record(
    /RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL\s*:/.test(config),
    "config.js 已包含 RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL",
    "config.js 缺少 RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL",
    "请在 config.js 的 window.APP_CONFIG 中增加 RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL。",
  );
  record(
    /REMOVE_BG_AI_APPS\s*:/.test(config),
    "config.js 已包含 REMOVE_BG_AI_APPS",
    "config.js 缺少 REMOVE_BG_AI_APPS",
    "请在 config.js 中增加 REMOVE_BG_AI_APPS 配置。",
  );
} else {
  record(false, "", "缺少 config.js", "请先创建 config.js。");
}

if (exists("package.json")) {
  const pkg = readJson("package.json");
  record(
    Boolean(pkg.scripts?.["deploy:ai-removebg-worker"]),
    "package.json 已包含 deploy:ai-removebg-worker",
    "package.json 缺少 deploy:ai-removebg-worker",
    "请在 package.json scripts 中增加 deploy:ai-removebg-worker。",
  );
} else {
  record(false, "", "缺少 package.json", "请先创建 package.json。");
}

console.log("RunningHub AI App 抠图部署检查");
console.log("");
checks.forEach((check) => {
  console.log(`${check.ok ? "OK" : "NEED"}  ${check.message}`);
});

console.log("");
console.log("下一步：");
console.log("1. 配置 Secret：npm run secret:ai-removebg");
console.log("2. 如 AI App 需要特殊 API 参数，请先更新 wrangler.ai-removebg.toml");
console.log("3. 部署 Worker：npm run deploy:ai-removebg-worker");
console.log("4. 写入前端 URL：npm run set:ai-removebg-url -- \"https://runninghub-ai-removebg-worker.xxx.workers.dev\"");

if (tips.length) {
  console.log("");
  console.log("提示：");
  [...new Set(tips)].forEach((tip) => console.log(`- ${tip}`));
}

if (failures.length) {
  process.exitCode = 1;
}
