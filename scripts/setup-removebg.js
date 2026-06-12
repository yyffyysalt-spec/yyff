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
  exists("wrangler.removebg.toml"),
  "wrangler.removebg.toml 已存在",
  "缺少 wrangler.removebg.toml",
  "请先创建 wrangler.removebg.toml，或从仓库恢复该文件。",
);

record(
  exists("runninghub-removebg-worker.js"),
  "runninghub-removebg-worker.js 已存在",
  "缺少 runninghub-removebg-worker.js",
  "请先确认 RunningHub 抠图 Worker 文件已提交到项目根目录。",
);

if (exists("wrangler.removebg.toml")) {
  const wrangler = readText("wrangler.removebg.toml");
  const workflowId = readTomlString(wrangler, "RUNNINGHUB_REMOVEBG_WORKFLOW_ID");
  const nodeId = readTomlString(wrangler, "RUNNINGHUB_REMOVEBG_IMAGE_NODE_ID");
  const fieldName = readTomlString(wrangler, "RUNNINGHUB_REMOVEBG_IMAGE_FIELD_NAME");
  const outputNodeId = readTomlString(wrangler, "RUNNINGHUB_REMOVEBG_OUTPUT_NODE_ID");

  record(
    Boolean(workflowId),
    `RUNNINGHUB_REMOVEBG_WORKFLOW_ID 已填写：${workflowId}`,
    "RUNNINGHUB_REMOVEBG_WORKFLOW_ID 为空",
    "请先在 wrangler.removebg.toml 填入 RUNNINGHUB_REMOVEBG_WORKFLOW_ID。",
  );
  record(
    nodeId === "3",
    "RUNNINGHUB_REMOVEBG_IMAGE_NODE_ID = 3",
    `RUNNINGHUB_REMOVEBG_IMAGE_NODE_ID 应为 3，当前为 ${nodeId || "未配置"}`,
    "请把 wrangler.removebg.toml 里的 RUNNINGHUB_REMOVEBG_IMAGE_NODE_ID 设置为 \"3\"。",
  );
  record(
    fieldName === "image",
    "RUNNINGHUB_REMOVEBG_IMAGE_FIELD_NAME = image",
    `RUNNINGHUB_REMOVEBG_IMAGE_FIELD_NAME 应为 image，当前为 ${fieldName || "未配置"}`,
    "请把 wrangler.removebg.toml 里的 RUNNINGHUB_REMOVEBG_IMAGE_FIELD_NAME 设置为 \"image\"。",
  );
  record(
    outputNodeId === "120",
    "RUNNINGHUB_REMOVEBG_OUTPUT_NODE_ID = 120",
    `RUNNINGHUB_REMOVEBG_OUTPUT_NODE_ID 应为 120，当前为 ${outputNodeId || "未配置"}`,
    "请在 wrangler.removebg.toml 中添加 RUNNINGHUB_REMOVEBG_OUTPUT_NODE_ID = \"120\"。",
  );
}

if (exists("config.js")) {
  const config = readText("config.js");
  const hasRemoveBgProxy = /REMOVE_BG_PROXY_URL\s*:/.test(config);
  record(
    hasRemoveBgProxy,
    "config.js 已包含 REMOVE_BG_PROXY_URL",
    "config.js 缺少 REMOVE_BG_PROXY_URL",
    "请在 config.js 的 window.APP_CONFIG 中增加 REMOVE_BG_PROXY_URL。",
  );
} else {
  record(false, "", "缺少 config.js", "请先创建 config.js，并配置 REMOVE_BG_PROXY_URL。");
}

if (exists("package.json")) {
  const pkg = readJson("package.json");
  record(
    Boolean(pkg.scripts?.["deploy:removebg-worker"]),
    "package.json 已包含 deploy:removebg-worker",
    "package.json 缺少 deploy:removebg-worker",
    "请在 package.json scripts 中增加 deploy:removebg-worker。",
  );
} else {
  record(false, "", "缺少 package.json", "请先创建 package.json 并配置部署脚本。");
}

console.log("RunningHub RMBG-2.0 抠图部署检查");
console.log("");
checks.forEach((check) => {
  console.log(`${check.ok ? "OK" : "NEED"}  ${check.message}`);
});

console.log("");
console.log("下一步：");
console.log("1. 请先执行：npm run secret:removebg");
console.log("2. 部署 Worker：npm run deploy:removebg-worker");
console.log("3. 部署成功后复制终端输出的 https://runninghub-removebg-worker.xxx.workers.dev");
console.log("4. 写入前端配置：npm run set:removebg-url -- \"https://runninghub-removebg-worker.xxx.workers.dev\"");
console.log("5. 本地打开 index.html 测试，成功后提交并推送 config.js");

if (tips.length) {
  console.log("");
  console.log("需要先处理：");
  [...new Set(tips)].forEach((tip) => console.log(`- ${tip}`));
}

if (failures.length) {
  process.exitCode = 1;
}
