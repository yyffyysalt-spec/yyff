#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AI_APP_ID = "1950866462321876993";
const wranglerConfig = "wrangler.ai-removebg.toml";
const workerFile = "runninghub-ai-removebg-worker.js";
const configFile = "config.js";
const packageFile = "package.json";
const deployScriptFile = "scripts/deploy-ai-removebg-all.js";
const deployDocFile = "docs/deploy-runninghub-ai-removebg.md";

function abs(relativePath) {
  return path.join(rootDir, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(abs(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(abs(relativePath), "utf8");
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
  if (!secret) return text;
  return String(text).split(secret).join("[已隐藏]");
}

function runCommand(command, args, options = {}) {
  const { input, secret = "", quiet = false } = options;
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

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
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
  const missing = [];
  if (!exists(packageFile)) missing.push(`缺少 ${packageFile}`);
  if (!exists(workerFile)) missing.push(`缺少 ${workerFile}`);
  if (!exists(wranglerConfig)) missing.push(`缺少 ${wranglerConfig}`);
  if (!exists(configFile)) missing.push(`缺少 ${configFile}`);
  if (missing.length) fail(missing.join("\n"));

  const wrangler = readText(wranglerConfig);
  if (!new RegExp(`RUNNINGHUB_AI_APP_ID\\s*=\\s*"${AI_APP_ID}"`).test(wrangler)) {
    fail(`${wranglerConfig} 缺少 RUNNINGHUB_AI_APP_ID = "${AI_APP_ID}"`);
  }

  const pkg = readJson(packageFile);
  const scripts = pkg.scripts || {};
  if (!scripts["deploy:ai-removebg-worker"]) {
    fail(`${packageFile} 缺少 scripts.deploy:ai-removebg-worker`);
  }
  if (!scripts["set:ai-removebg-url"]) {
    fail(`${packageFile} 缺少 scripts.set:ai-removebg-url`);
  }
}

async function ensureDependencies() {
  if (exists("node_modules")) return;
  console.log("未检测到 node_modules，正在安装依赖...");
  await runCommand("npm", ["install"]);
}

function setSecret(apiKey) {
  return new Promise((resolve, reject) => {
    console.log("正在写入 Cloudflare Worker Secret...");
    const child = spawn("npx", [
      "wrangler",
      "secret",
      "put",
      "RUNNINGHUB_API_KEY",
      "--config",
      wranglerConfig,
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
        const error = new Error(`设置 Worker Secret 失败，退出码 ${code}`);
        error.output = output;
        reject(error);
      }
    });
  });
}

function extractWorkerUrl(output) {
  const matches = [...String(output).matchAll(/https:\/\/[^\s"'()]+\.workers\.dev[^\s"'()]*/gi)];
  if (!matches.length) return "";
  return matches[matches.length - 1][0].replace(/[),.]+$/g, "");
}

async function deployWorker() {
  console.log("");
  console.log("正在部署 RunningHub AI 抠图 Worker...");
  const result = await runCommand("npx", ["wrangler", "deploy", "--config", wranglerConfig]);
  let workerUrl = extractWorkerUrl(result.output);

  if (!workerUrl) {
    console.log("");
    console.log("没有自动识别到 Worker URL。请从上方部署输出中复制 workers.dev 地址。");
    workerUrl = await promptLine("请粘贴 Worker URL：");
  }

  if (!/^https:\/\/[^\s"']+\.workers\.dev\/?$/i.test(workerUrl)) {
    fail("Worker URL 格式不正确", `当前值：${workerUrl}`);
  }

  return workerUrl.replace(/\/$/, "");
}

async function writeConfigUrl(workerUrl) {
  console.log("");
  console.log("正在写入 config.js...");
  await runCommand("npm", ["run", "set:ai-removebg-url", "--", workerUrl]);
}

async function runChecks() {
  console.log("");
  console.log("正在执行项目检查...");
  await runCommand("npm", ["run", "check"]);
}

async function maybeCommitAndPush() {
  const answer = await promptLine("是否提交并推送 config.js 到 GitHub？(y/N) ");
  if (!/^y(es)?$/i.test(answer)) return false;

  const filesToAdd = [configFile, packageFile, deployScriptFile, deployDocFile];
  await runCommand("git", ["add", ...filesToAdd]);

  try {
    await runCommand("git", ["diff", "--cached", "--quiet"], { quiet: true });
    console.log("没有检测到需要提交的变更。");
    return false;
  } catch {
    // git diff --quiet exits with 1 when staged changes exist.
  }

  await runCommand("git", ["commit", "-m", "Add one-click RunningHub AI removebg deployment"]);

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
  console.log("RunningHub AI 抠图一键部署");
  console.log("");

  checkPrerequisites();
  await ensureDependencies();

  const apiKey = await promptSecret("请输入 RunningHub API Key：");
  if (!apiKey) fail("RunningHub API Key 不能为空。");

  await setSecret(apiKey);
  const workerUrl = await deployWorker();
  await writeConfigUrl(workerUrl);
  await runChecks();

  console.log("");
  console.log("✅ RunningHub AI 抠图部署完成");
  console.log("");
  console.log("Worker URL:");
  console.log(workerUrl);
  console.log("");
  console.log("已写入 config.js:");
  console.log("RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL");
  console.log("");
  console.log("下一步测试：");
  console.log("1. 打开 https://yyffyysalt-spec.github.io/yyff/");
  console.log("2. Command + Shift + R 强制刷新");
  console.log("3. 处理模式选择：只抠图");
  console.log("4. 抠图模型选择：RunningHub AI 抠图");
  console.log("5. 上传一张小图");
  console.log("6. 点击开始处理");
  console.log("");
  console.log("如果线上还未更新，请先本地双击 index.html 测试。");
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
