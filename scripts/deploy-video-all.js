#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const VIDEO_TARGETS = [
  {
    name: "视频抠像",
    config: "wrangler.video-chroma.toml",
    worker: "runninghub-video-chroma-worker.js",
    appId: "1893587363086417921",
    endpoint: "https://www.runninghub.cn/openapi/v2/run/ai-app/1893587363086417921",
    configKey: "VIDEO_CHROMA_PROXY_URL",
  },
  {
    name: "视频高清放大",
    config: "wrangler.video-upscale.toml",
    worker: "runninghub-video-upscale-worker.js",
    appId: "2033815457634983938",
    endpoint: "https://www.runninghub.cn/openapi/v2/run/ai-app/2033815457634983938",
    configKey: "VIDEO_UPSCALE_PROXY_URL",
  },
];

function abs(relativePath) {
  return path.join(rootDir, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(abs(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(abs(relativePath), "utf8");
}

function writeText(relativePath, text) {
  fs.writeFileSync(abs(relativePath), text);
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, detail = "") {
  console.error("");
  console.error(`部署停止：${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function sanitize(text, secret = "") {
  if (!secret) return String(text);
  return String(text).split(secret).join("[已隐藏]");
}

function runCommand(command, args, options = {}) {
  const { input = "", secret = "", quiet = false } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let output = "";

    const handleChunk = (chunk, stream) => {
      const text = sanitize(chunk.toString(), secret);
      output += text;
      if (!quiet) stream.write(text);
    };

    child.stdout.on("data", (chunk) => handleChunk(chunk, process.stdout));
    child.stderr.on("data", (chunk) => handleChunk(chunk, process.stderr));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ output });
      } else {
        const error = new Error(`${command} ${args.join(" ")} 失败，退出码 ${code}`);
        error.output = output;
        reject(error);
      }
    });

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

function promptLine(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptSecret(question) {
  process.stdout.write(question);

  if (!process.stdin.isTTY) {
    return new Promise((resolve) => {
      let value = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        value += chunk;
        if (value.includes("\n")) resolve(value.trim());
      });
    });
  }

  return new Promise((resolve) => {
    let value = "";
    const stdin = process.stdin;
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (buffer) => {
      for (const char of buffer.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (char === "\b" || char === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

function checkPrerequisites() {
  const requiredFiles = [
    "package.json",
    "config.js",
    "docs/deploy-runninghub-video.md",
    ...VIDEO_TARGETS.flatMap((target) => [target.worker, target.config]),
  ];
  const missing = requiredFiles.filter((file) => !exists(file));
  if (missing.length) fail("缺少必要文件", missing.join("\n"));

  const pkg = readJson("package.json");
  const scripts = pkg.scripts || {};
  for (const scriptName of [
    "deploy:video-upscale-worker",
    "deploy:video-chroma-worker",
    "verify:video-workers",
  ]) {
    if (!scripts[scriptName]) fail(`package.json 缺少脚本：${scriptName}`);
  }

  for (const target of VIDEO_TARGETS) {
    const toml = readText(target.config);
    if (!toml.includes(target.appId)) fail(`${target.config} 缺少固定 AI App ID`, target.appId);
    if (!toml.includes(target.endpoint)) fail(`${target.config} 缺少固定 create endpoint`, target.endpoint);
  }
}

async function ensureDependencies() {
  if (exists("node_modules")) return;
  console.log("未检测到 node_modules，正在安装依赖...");
  await runCommand("npm", ["install"]);
}

function setSecret(target, apiKey) {
  return new Promise((resolve, reject) => {
    console.log(`正在写入 ${target.name} Worker Secret...`);
    const child = spawn("npx", [
      "wrangler",
      "secret",
      "put",
      "RUNNINGHUB_API_KEY",
      "--config",
      target.config,
    ], {
      cwd: rootDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let output = "";
    let secretSent = false;
    let createAnswered = false;

    const maybeRespond = (chunk) => {
      const text = chunk.toString();
      const safeText = sanitize(text, apiKey);
      output += safeText;
      process.stdout.write(safeText);

      if (!createAnswered && /(create.+worker|worker.+not.+exist|doesn.t seem to be a worker|create a new worker|would you like to create|do you want to create)/i.test(text)) {
        child.stdin.write("y\n");
        createAnswered = true;
      }

      if (!secretSent && /(enter.+secret|secret.+value|value:|secret:)/i.test(text)) {
        child.stdin.write(`${apiKey}\n`);
        secretSent = true;
      }
    };

    const fallback = setTimeout(() => {
      if (!secretSent) {
        child.stdin.write(`${apiKey}\n`);
        secretSent = true;
      }
    }, 2500);

    child.stdout.on("data", maybeRespond);
    child.stderr.on("data", maybeRespond);
    child.on("error", (error) => {
      clearTimeout(fallback);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(fallback);
      child.stdin.end();
      if (code === 0) {
        resolve({ output });
      } else {
        const error = new Error(`${target.name} Secret 设置失败，退出码 ${code}`);
        error.output = output;
        reject(error);
      }
    });
  });
}

function extractWorkerUrl(output) {
  const matches = [...String(output).matchAll(/https:\/\/[^\s"'()]+\.workers\.dev[^\s"'()]*/gi)];
  if (!matches.length) return "";
  return matches[matches.length - 1][0].replace(/[),.]+$/g, "").replace(/\/$/, "");
}

async function deployWorker(target) {
  console.log("");
  console.log(`正在部署 ${target.name} Worker...`);
  const result = await runCommand("npx", ["wrangler", "deploy", "--config", target.config]);
  let workerUrl = extractWorkerUrl(result.output);

  if (!workerUrl) {
    console.log("");
    console.log(`没有自动识别到 ${target.name} Worker URL。请从上方部署输出中复制 workers.dev 地址。`);
    workerUrl = await promptLine(`请粘贴 ${target.name} Worker URL：`);
  }

  if (!/^https:\/\/[^\s"']+\.workers\.dev\/?$/i.test(workerUrl)) {
    fail(`${target.name} Worker URL 格式不正确`, `当前值：${workerUrl}`);
  }

  return workerUrl.replace(/\/$/, "");
}

function writeConfigUrls(urlsByKey) {
  let configText = readText("config.js");
  for (const [key, url] of Object.entries(urlsByKey)) {
    const pattern = new RegExp(`(${key}\\s*:\\s*)["'][^"']*["']`);
    if (!pattern.test(configText)) fail(`config.js 缺少 ${key}`);
    configText = configText.replace(pattern, `$1"${url}"`);
  }
  writeText("config.js", configText);
}

async function runChecks() {
  console.log("");
  console.log("正在执行项目检查...");
  await runCommand("npm", ["run", "check"]);
  await runCommand("npm", ["run", "verify:video-workers"]);
}

async function maybeCommitAndPush() {
  const answer = await promptLine("是否提交并推送视频 Worker 配置到 GitHub？(y/N) ");
  if (!/^y(es)?$/i.test(answer)) return false;

  const filesToAdd = [
    "config.js",
    "package.json",
    "runninghub-video-chroma-worker.js",
    "runninghub-video-upscale-worker.js",
    "wrangler.video-chroma.toml",
    "wrangler.video-upscale.toml",
    "scripts/deploy-video-all.js",
    "scripts/verify-video-workers.js",
    "docs/deploy-runninghub-video.md",
  ];
  await runCommand("git", ["add", ...filesToAdd]);

  try {
    await runCommand("git", ["diff", "--cached", "--quiet"], { quiet: true });
    console.log("没有检测到需要提交的变更。");
    return false;
  } catch {
    // git diff --quiet exits with 1 when staged changes exist.
  }

  await runCommand("git", ["commit", "-m", "Switch video workers to RunningHub AI apps"]);
  try {
    await runCommand("git", ["push"]);
  } catch (error) {
    console.error("");
    console.error("git push 未完成。");
    console.error("如果提示没有 upstream，请执行：");
    console.error("git push --set-upstream origin main");
    throw error;
  }
  return true;
}

async function main() {
  console.log("RunningHub 视频 Worker 一键部署");
  console.log("");
  checkPrerequisites();
  await ensureDependencies();

  const apiKey = await promptSecret("请输入 RunningHub API Key：");
  if (!apiKey) fail("RunningHub API Key 不能为空。");

  for (const target of VIDEO_TARGETS) {
    await setSecret(target, apiKey);
  }

  const urlsByKey = {};
  for (const target of VIDEO_TARGETS) {
    urlsByKey[target.configKey] = await deployWorker(target);
  }

  console.log("");
  console.log("正在写入 config.js...");
  writeConfigUrls(urlsByKey);

  await runChecks();

  console.log("");
  console.log("✅ RunningHub 视频 Worker 部署完成");
  console.log("");
  for (const target of VIDEO_TARGETS) {
    console.log(`${target.name} Worker URL:`);
    console.log(urlsByKey[target.configKey]);
    console.log(`已写入 config.js: ${target.configKey}`);
    console.log("");
  }
  console.log("下一步测试：");
  console.log("1. 打开 https://yyffyysalt-spec.github.io/yyff/");
  console.log("2. Command + Shift + R 强制刷新");
  console.log("3. 进入视频处理");
  console.log("4. 上传一个 MP4 / MOV / WEBM");
  console.log("5. 分别测试“只抠绿幕”和“高清放大”");
  console.log("");

  await maybeCommitAndPush();
}

main().catch((error) => {
  console.error("");
  console.error("部署失败：");
  console.error(error?.message || error);
  if (error?.output) console.error(error.output);
  process.exit(1);
});
