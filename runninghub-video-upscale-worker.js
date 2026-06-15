const WORKER_NAME = "runninghub-video-upscale-worker";
const VERSION = "2026-06-15-video-1";
const RUNNINGHUB_BASE_URL = "https://www.runninghub.cn";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (new URL(request.url).searchParams.get("health") === "1") return healthResponse(env);
    if (request.method !== "POST") return errorResponse("config", "Method not allowed", `当前请求方法为 ${request.method}`, 405);
    try {
      return await handleVideoWorkflow(request, env, {
        worker: WORKER_NAME,
        workflowId: env.RUNNINGHUB_VIDEO_UPSCALE_WORKFLOW_ID,
        inputNodeId: env.RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID,
        inputFieldName: env.RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME,
        outputNodeId: env.RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_NODE_ID,
        notConfiguredMessage: "视频高清放大工作流未配置，请先补充 RunningHub workflowId 和节点参数。",
      });
    } catch (error) {
      return errorResponse(error.stage || "worker", error.message || "视频高清放大失败", error.detail || "", error.status || 500, error.raw);
    }
  },
};

async function handleVideoWorkflow(request, env, config) {
  const apiKey = env.RUNNINGHUB_API_KEY;
  if (!apiKey) throw stageError("config", "RunningHub API Key 缺失", "请给 Worker Secret 配置 RUNNINGHUB_API_KEY。");
  if (!config.workflowId || !config.inputNodeId || !config.inputFieldName) {
    throw stageError("config", config.notConfiguredMessage, "缺少 workflowId、input nodeId 或 input fieldName。", 501);
  }
  const payload = await readPayload(request);
  if (payload.action === "create") return createVideoTask(payload.file, apiKey, config);
  if (payload.action === "status") return checkVideoTask(payload.taskId, apiKey, config);
  throw stageError("config", "不支持的 action", `当前 action：${payload.action || "(empty)"}`, 400);
}

async function createVideoTask(file, apiKey, config) {
  if (!(file instanceof File)) throw stageError("config", "请上传视频文件", "表单字段 file 不是文件。", 400);
  console.log(`[${config.worker}] upload_resource_start`, { size: file.size, type: file.type || "unknown" });
  const uploadedFilename = await uploadResource(file, apiKey);
  console.log(`[${config.worker}] upload_resource_done`, { uploadedFilename });
  const nodeInfoList = [
    { nodeId: String(config.inputNodeId), fieldName: config.inputFieldName, fieldValue: uploadedFilename },
  ];
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, workflowId: String(config.workflowId), nodeInfoList, addMetadata: false }),
  });
  const data = await readRunningHubJson(response, "create_task");
  const taskId = extractTaskId(data);
  if (!response.ok || !taskId) throw stageError("create_task", "RunningHub 视频任务创建失败", summarizeData(data), 502, data);
  console.log(`[${config.worker}] create_task_done`, { taskId });
  return jsonResponse({ ok: true, status: "pending", taskId, workflowId: String(config.workflowId), message: "视频处理任务已创建" });
}

async function checkVideoTask(taskId, apiKey, config) {
  if (!taskId) throw stageError("config", "taskId 缺失", "status 请求需要 taskId。", 400);
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, taskId }),
  });
  const data = await readRunningHubJson(response, "poll_task");
  const selected = selectVideoOutput(data, config.outputNodeId);
  console.log(`[${config.worker}] status_check`, { taskId, outputFound: Boolean(selected), keys: Object.keys(data || {}).slice(0, 20) });
  if (selected) return downloadVideo(selected, taskId);
  if (isFailure(data)) throw stageError("poll_task", getMessage(data) || "RunningHub 视频任务失败", summarizeData(data), 502, data);
  return jsonResponse({ ok: true, status: "running", taskId, message: "RunningHub 正在处理视频" });
}

async function uploadResource(file, apiKey) {
  const form = new FormData();
  form.set("file", file, file.name || "input.mp4");
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const data = await readRunningHubJson(response, "upload");
  const filename = data?.data?.filename || data?.data?.fileName || data?.data?.name;
  if (!response.ok || !filename) throw stageError("upload", "RunningHub 视频上传失败", summarizeData(data), 502, data);
  return filename;
}

async function downloadVideo(candidate, taskId) {
  const output = await fetch(candidate.url);
  if (!output.ok) throw stageError("download_result", "RunningHub 输出视频下载失败", `HTTP ${output.status}`, 502);
  return new Response(output.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": output.headers.get("Content-Type") || "video/mp4",
      "X-Video-Status": "done",
      "X-Video-TaskId": taskId,
      "Cache-Control": "no-store",
    },
  });
}

function selectVideoOutput(data, configuredNodeId = "") {
  const candidates = [];
  walkOutput(data, [], null, (value, path, parent) => {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return;
    if (!/\.(mp4|mov|webm)(\?|$)/i.test(value) && !/video/i.test(JSON.stringify(parent || {}))) return;
    candidates.push({ url: value, path: path.join("."), nodeId: String(parent?.nodeId || parent?.node_id || parent?.outputNodeId || "") });
  });
  if (configuredNodeId) {
    const matched = candidates.find((candidate) => candidate.nodeId === String(configuredNodeId));
    if (matched) return matched;
  }
  return candidates[0] || null;
}

function walkOutput(value, path, parent, visit) {
  visit(value, path, parent);
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkOutput(item, [...path, String(index)], value, visit));
  } else {
    Object.entries(value).forEach(([key, item]) => walkOutput(item, [...path, key], value, visit));
  }
}

function extractTaskId(data) {
  return data?.taskId || data?.data?.taskId || data?.data?.task_id || data?.data?.id || data?.result?.taskId || "";
}

async function readPayload(request) {
  const form = await request.formData();
  return { action: form.get("action") || "create", taskId: form.get("taskId") || "", file: form.get("file") };
}

async function readRunningHubJson(response, stage) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw stageError(stage, "RunningHub 返回非 JSON", text.slice(0, 500), 502); }
}

function isFailure(data) {
  const status = String(data?.status || data?.data?.status || data?.state || "").toLowerCase();
  return /fail|error|cancel/.test(status) || data?.code >= 900;
}

function getMessage(data) {
  return data?.message || data?.msg || data?.errorMessage || data?.data?.message || "";
}

function summarizeData(data) {
  try { return JSON.stringify(data).slice(0, 1200); } catch { return String(data); }
}

function stageError(stage, message, detail = "", status = 500, raw = undefined) {
  const error = new Error(message);
  error.stage = stage;
  error.detail = detail;
  error.status = status;
  error.raw = raw;
  return error;
}

function errorResponse(stage, message, detail = "", status = 500, raw = undefined) {
  return jsonResponse({ ok: false, stage, message, detail, raw }, status);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function healthResponse(env) {
  const configReady = Boolean(env.RUNNINGHUB_VIDEO_UPSCALE_WORKFLOW_ID && env.RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID && env.RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME);
  return jsonResponse({ ok: true, worker: WORKER_NAME, hasApiKey: Boolean(env.RUNNINGHUB_API_KEY), configReady, version: VERSION });
}
