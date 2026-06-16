const WORKER_NAME = "runninghub-video-upscale-worker";
const VERSION = "2026-06-16-video-async-1";
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
      const config = getConfig(env);
      const payload = await readPayload(request);
      console.log(`[${WORKER_NAME}] received_request`, { action: payload.action || "create" });
      if (payload.action === "create") return createVideoTask(payload.file, env.RUNNINGHUB_API_KEY, config);
      if (payload.action === "status") return checkVideoTask(payload.taskId, env.RUNNINGHUB_API_KEY, config);
      throw stageError("config", "不支持的 action", `当前 action：${payload.action || "(empty)"}`, 400);
    } catch (error) {
      return errorResponse(error.stage || "worker", error.message || "RunningHub 视频高清放大失败", error.detail || "", error.status || 500, error.raw);
    }
  },
};

function getConfig(env) {
  const config = {
    workflowId: env.RUNNINGHUB_VIDEO_UPSCALE_WORKFLOW_ID || "",
    inputNodeId: env.RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID || "",
    inputFieldName: env.RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME || "",
    outputNodeId: env.RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_NODE_ID || "",
    outputFieldName: env.RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_FIELD_NAME || "",
    appId: env.RUNNINGHUB_VIDEO_UPSCALE_APP_ID || "",
    createEndpoint: env.RUNNINGHUB_VIDEO_UPSCALE_CREATE_ENDPOINT || "",
  };
  const missing = getMissingConfig(env, config);
  if (!env.RUNNINGHUB_API_KEY) {
    throw stageError("config", "RunningHub API Key 缺失", "请给 Worker Secret 配置 RUNNINGHUB_API_KEY。", 501);
  }
  if (missing.length) {
    throw stageError("config", "RunningHub 视频高清放大工作流未配置", `缺少 ${missing.join(" / ")} 等参数。`, 501, { missing });
  }
  return config;
}

function getMissingConfig(env, config) {
  const missing = [];
  const usesAiApp = Boolean(config.createEndpoint || config.appId);
  if (usesAiApp) {
    if (!config.createEndpoint) missing.push("RUNNINGHUB_VIDEO_UPSCALE_CREATE_ENDPOINT");
    if (!config.inputNodeId) missing.push("RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID");
    if (!config.inputFieldName) missing.push("RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME");
    return missing;
  }
  if (!config.workflowId) missing.push("RUNNINGHUB_VIDEO_UPSCALE_WORKFLOW_ID");
  if (!config.inputNodeId) missing.push("RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID");
  if (!config.inputFieldName) missing.push("RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME");
  if (!config.outputNodeId) missing.push("RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_NODE_ID");
  if (!config.outputFieldName) missing.push("RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_FIELD_NAME");
  return missing;
}

async function createVideoTask(file, apiKey, config) {
  if (!(file instanceof File)) throw stageError("config", "请上传视频文件", "表单字段 file 不是文件。", 400);
  console.log(`[${WORKER_NAME}] upload_resource_start`, { input_file_size: file.size, type: file.type || "unknown" });
  const uploadedFilename = await uploadResource(file, apiKey);
  console.log(`[${WORKER_NAME}] upload_resource_done`, { uploadedFilename });

  const nodeInfoList = [{ nodeId: String(config.inputNodeId), fieldName: config.inputFieldName, fieldValue: uploadedFilename }];
  const createBody = config.createEndpoint
    ? { apiKey, nodeInfoList, addMetadata: false }
    : { apiKey, workflowId: String(config.workflowId), nodeInfoList, addMetadata: false };
  const createUrl = config.createEndpoint || `${RUNNINGHUB_BASE_URL}/task/openapi/create`;
  console.log(`[${WORKER_NAME}] create_task_payload_summary`, {
    mode: config.createEndpoint ? "ai-app" : "workflow",
    workflowId: config.workflowId || "",
    appId: config.appId || "",
    nodeInfoList,
  });

  const response = await fetch(createUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  const data = await readRunningHubJson(response, "create_task");
  const taskId = extractTaskId(data);
  if (!response.ok || !taskId) throw stageError("create_task", "RunningHub 视频高清放大任务创建失败", summarizeData(data), 502, data);
  console.log(`[${WORKER_NAME}] create_task_done`, { taskId });
  return jsonResponse({ ok: true, status: "pending", stage: "create_task_done", taskId, workflowId: String(config.workflowId || config.appId), message: "视频高清放大任务已创建" });
}

async function checkVideoTask(taskId, apiKey, config) {
  if (!taskId) throw stageError("config", "taskId 缺失", "status 请求需要 taskId。", 400);
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, taskId }),
  });
  const data = await readRunningHubJson(response, "runninghub_status");
  const selected = selectVideoOutput(data, config);
  console.log(`[${WORKER_NAME}] status_check`, {
    taskId,
    runninghub_status: data?.status || data?.data?.status || "",
    output_candidates: selected?.debug?.candidateCount || 0,
    selected_output: selected?.url || "",
  });
  if (selected) {
    return jsonResponse({
      ok: true,
      status: "done",
      stage: "download_result_done",
      taskId,
      resultUrl: selected.url,
      mimeType: selected.mimeType || "video/mp4",
      filename: selected.filename || `runninghub-video-upscaled-${taskId}.mp4`,
      message: "视频高清放大已完成",
    });
  }
  if (isFailure(data)) throw stageError("runninghub_status", getMessage(data) || "RunningHub 视频高清放大任务失败", summarizeData(data), 502, data);
  return jsonResponse({ ok: true, status: "running", stage: "runninghub_status", taskId, message: "RunningHub 正在处理视频高清放大" });
}

async function uploadResource(file, apiKey) {
  const form = new FormData();
  form.set("file", file, file.name || "input.mp4");
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const data = await readRunningHubJson(response, "upload_resource");
  const filename = data?.data?.filename || data?.data?.fileName || data?.data?.name || data?.filename || data?.fileName;
  if (!response.ok || !filename) throw stageError("upload_resource", "RunningHub 视频上传失败", summarizeData(data), 502, data);
  return filename;
}

function selectVideoOutput(data, config) {
  const candidates = [];
  walkOutput(data, [], null, (value, path, parent) => {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return;
    const parentText = stringifySafe(parent).toLowerCase();
    const looksVideo = /\.(mp4|mov|webm)(\?|$)/i.test(value) || /video|mp4|mov|webm/.test(parentText);
    if (!looksVideo) return;
    const filename = getFilename(value, parent);
    candidates.push({
      url: value,
      filename,
      mimeType: getMimeType(value, parent),
      path: path.join("."),
      nodeId: String(parent?.nodeId || parent?.node_id || parent?.outputNodeId || parent?.sourceNodeId || ""),
      fieldName: String(parent?.fieldName || parent?.field_name || path.at(-1) || ""),
    });
  });
  const configuredNodeId = String(config.outputNodeId || "");
  const configuredFieldName = String(config.outputFieldName || "");
  const exact = candidates.find((candidate) => (
    (!configuredNodeId || candidate.nodeId === configuredNodeId) &&
    (!configuredFieldName || candidate.fieldName === configuredFieldName || candidate.path.endsWith(`.${configuredFieldName}`))
  ));
  const byNode = configuredNodeId ? candidates.find((candidate) => candidate.nodeId === configuredNodeId) : null;
  const selected = exact || byNode || candidates[0] || null;
  if (selected) selected.debug = { candidateCount: candidates.length };
  return selected;
}

function walkOutput(value, path, parent, visit) {
  visit(value, path, parent);
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) value.forEach((item, index) => walkOutput(item, [...path, String(index)], value, visit));
  else Object.entries(value).forEach(([key, item]) => walkOutput(item, [...path, key], value, visit));
}

function extractTaskId(value) {
  if (!value) return "";
  if (typeof value === "string") {
    try { return extractTaskId(JSON.parse(value)); } catch {
      return value.match(/"taskId"\s*:\s*"([^"]+)"/)?.[1] || "";
    }
  }
  if (typeof value !== "object") return "";
  const direct = value.taskId || value.task_id || value.taskID;
  if (direct) return String(direct);
  for (const item of Object.values(value)) {
    const found = extractTaskId(item);
    if (found) return found;
  }
  return "";
}

async function readPayload(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    const data = await request.json();
    return { action: data.action || "create", taskId: data.taskId || "" };
  }
  const form = await request.formData();
  return { action: form.get("action") || "create", taskId: form.get("taskId") || "", file: form.get("file") };
}

async function readRunningHubJson(response, stage) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw stageError(stage, "RunningHub 返回非 JSON", text.slice(0, 800), 502); }
}

function isFailure(data) {
  const status = String(data?.status || data?.data?.status || data?.state || "").toLowerCase();
  const code = Number(data?.code || data?.errorCode || 0);
  if (code === 804) return false;
  return /fail|error|cancel/.test(status) || code >= 900;
}

function getMessage(data) {
  return data?.message || data?.msg || data?.errorMessage || data?.data?.message || data?.data?.errorMessage || "";
}

function getFilename(url, parent) {
  const fromParent = parent?.filename || parent?.fileName || parent?.name;
  if (fromParent) return String(fromParent);
  try { return new URL(url).pathname.split("/").pop() || "runninghub-video.mp4"; } catch { return "runninghub-video.mp4"; }
}

function getMimeType(url, parent) {
  const type = parent?.mimeType || parent?.mime || parent?.type || "";
  if (type) return String(type);
  if (/\.webm(\?|$)/i.test(url)) return "video/webm";
  if (/\.mov(\?|$)/i.test(url)) return "video/quicktime";
  return "video/mp4";
}

function summarizeData(data) {
  try { return JSON.stringify(data).slice(0, 1600); } catch { return String(data); }
}

function stringifySafe(data) {
  try { return JSON.stringify(data || {}); } catch { return ""; }
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
  return jsonResponse({ ok: false, status: "failed", stage, message, detail, raw }, status);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function healthResponse(env) {
  const config = getHealthConfig(env);
  const missing = getMissingConfig(env, config);
  return jsonResponse({
    ok: true,
    worker: WORKER_NAME,
    hasApiKey: Boolean(env.RUNNINGHUB_API_KEY),
    configReady: Boolean(env.RUNNINGHUB_API_KEY) && missing.length === 0,
    missing: [...(!env.RUNNINGHUB_API_KEY ? ["RUNNINGHUB_API_KEY"] : []), ...missing],
    version: VERSION,
  });
}

function getHealthConfig(env) {
  return {
    workflowId: env.RUNNINGHUB_VIDEO_UPSCALE_WORKFLOW_ID || "",
    inputNodeId: env.RUNNINGHUB_VIDEO_UPSCALE_INPUT_NODE_ID || "",
    inputFieldName: env.RUNNINGHUB_VIDEO_UPSCALE_INPUT_FIELD_NAME || "",
    outputNodeId: env.RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_NODE_ID || "",
    outputFieldName: env.RUNNINGHUB_VIDEO_UPSCALE_OUTPUT_FIELD_NAME || "",
    appId: env.RUNNINGHUB_VIDEO_UPSCALE_APP_ID || "",
    createEndpoint: env.RUNNINGHUB_VIDEO_UPSCALE_CREATE_ENDPOINT || "",
  };
}
