const WORKER_NAME = "runninghub-video-chroma-worker";
const VERSION = "2026-06-16-video-ai-app-1";
const RUNNINGHUB_BASE_URL = "https://www.runninghub.cn";
const DEFAULT_APP_ID = "1893587363086417921";
const DEFAULT_CREATE_ENDPOINT = "https://www.runninghub.cn/openapi/v2/run/ai-app/1893587363086417921";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (new URL(request.url).searchParams.get("health") === "1") return healthResponse(env);
    if (request.method !== "POST") return errorResponse("config", "Method not allowed", `当前请求方法为 ${request.method}`, 405, undefined, getHealthConfig(env));

    const config = getHealthConfig(env);
    try {
      ensureConfig(env, config);
      const payload = await readPayload(request);
      console.log(`[${WORKER_NAME}] received_request`, { action: payload.action || "create", mode: "ai-app", appId: config.appId });
      if (payload.action === "create") return createVideoTask(payload, env.RUNNINGHUB_API_KEY, config);
      if (payload.action === "status") return checkVideoTask(payload.taskId, env.RUNNINGHUB_API_KEY, config);
      throw stageError("config", "不支持的 action", `当前 action：${payload.action || "(empty)"}`, 400, undefined, config);
    } catch (error) {
      return errorResponse(
        error.stage || "worker",
        error.message || "RunningHub 视频抠像失败",
        error.detail || "",
        error.status || 500,
        error.raw,
        error.context || config,
      );
    }
  },
};

function getHealthConfig(env) {
  return {
    mode: "ai-app",
    appId: env.RUNNINGHUB_VIDEO_CHROMA_APP_ID || DEFAULT_APP_ID,
    createEndpoint: env.RUNNINGHUB_VIDEO_CHROMA_CREATE_ENDPOINT || DEFAULT_CREATE_ENDPOINT,
    apiDemoEndpoint: env.RUNNINGHUB_VIDEO_CHROMA_API_DEMO_ENDPOINT || `${RUNNINGHUB_BASE_URL}/api/webapp/apiCallDemo`,
  };
}

function ensureConfig(env, config) {
  const missing = getMissingConfig(env, config);
  if (missing.length) {
    throw stageError("config", "RunningHub 视频抠像 AI App 未配置完整", `缺少 ${missing.join(" / ")}。`, 501, { missing }, config);
  }
}

function getMissingConfig(env, config) {
  const missing = [];
  if (!config.appId) missing.push("RUNNINGHUB_VIDEO_CHROMA_APP_ID");
  if (!config.createEndpoint) missing.push("RUNNINGHUB_VIDEO_CHROMA_CREATE_ENDPOINT");
  if (!env.RUNNINGHUB_API_KEY) missing.push("RUNNINGHUB_API_KEY");
  return missing;
}

async function createVideoTask(payload, apiKey, config) {
  const file = payload.file;
  if (!(file instanceof File)) throw stageError("config", "请上传视频文件", "表单字段 file 不是文件。", 400, undefined, config);

  console.log(`[${WORKER_NAME}] upload_resource_start`, { input_file_size: file.size, type: file.type || "unknown", appId: config.appId });
  const uploaded = await uploadResource(file, apiKey, config);
  console.log(`[${WORKER_NAME}] upload_resource_done`, {
    uploadedFilename: uploaded.filename,
    hasFileId: Boolean(uploaded.fileId),
    hasResourceId: Boolean(uploaded.resourceId),
  });

  const nodeInfoList = await buildNodeInfoListFromAiAppDemo(apiKey, config, uploaded);
  const createBody = {
    apiKey,
    webappId: String(config.appId),
    nodeInfoList,
    addMetadata: false,
  };
  console.log(`[${WORKER_NAME}] create_task_payload_summary`, {
    mode: config.mode,
    appId: config.appId,
    endpoint: config.createEndpoint,
    nodeInfoList: nodeInfoList.map((node) => ({
      nodeId: node.nodeId,
      fieldName: node.fieldName,
      fieldValue: abbreviate(node.fieldValue, 96),
    })),
  });

  const response = await fetch(config.createEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  const data = await readRunningHubJson(response, "create_task", config);
  const taskId = extractTaskId(data);
  console.log(`[${WORKER_NAME}] create_task_done`, {
    responseOk: response.ok,
    taskId,
    responseKeys: Object.keys(data || {}),
  });
  if (!response.ok || !taskId) {
    throw stageError("create_task", "RunningHub 视频抠像任务创建失败", summarizeData(data), 502, data, config);
  }
  return jsonResponse({
    ok: true,
    status: "pending",
    stage: "create_task_done",
    taskId,
    appId: config.appId,
    endpoint: config.createEndpoint,
    message: "视频抠像任务已创建",
  });
}

async function checkVideoTask(taskId, apiKey, config) {
  if (!taskId) throw stageError("config", "taskId 缺失", "status 请求需要 taskId。", 400, undefined, config);
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, taskId }),
  });
  const data = await readRunningHubJson(response, "runninghub_status", config);
  const selected = selectVideoOutput(data);
  console.log(`[${WORKER_NAME}] status_check`, {
    taskId,
    appId: config.appId,
    runninghub_status: getStatus(data),
    runninghub_code: data?.code || data?.errorCode || "",
    runninghub_message: getMessage(data),
    output_candidates: selected?.debug?.candidateCount || 0,
    selected_output: selected?.url || "",
  });

  if (selected) {
    return jsonResponse({
      ok: true,
      status: "done",
      stage: "download_result_done",
      taskId,
      appId: config.appId,
      endpoint: config.createEndpoint,
      resultUrl: selected.url,
      mimeType: selected.mimeType || "video/mp4",
      filename: selected.filename || `runninghub-video-chroma-${taskId}.mp4`,
      message: "视频抠像已完成",
    });
  }

  if (isFailure(data)) {
    throw stageError("runninghub_status", getMessage(data) || "RunningHub 视频抠像任务失败", summarizeData(data), 502, data, config);
  }
  return jsonResponse({
    ok: true,
    status: "running",
    stage: "runninghub_status",
    taskId,
    appId: config.appId,
    endpoint: config.createEndpoint,
    message: "RunningHub 正在处理视频抠像",
    raw: summarizeStatus(data),
  });
}

async function uploadResource(file, apiKey, config) {
  const form = new FormData();
  form.set("file", file, file.name || "input.mp4");
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const data = await readRunningHubJson(response, "upload_resource", config);
  const info = extractUploadInfo(data);
  if (!response.ok || !info.filename) {
    throw stageError("upload_resource", "RunningHub 视频上传失败", summarizeData(data), 502, data, config);
  }
  return info;
}

async function buildNodeInfoListFromAiAppDemo(apiKey, config, uploaded) {
  const demoUrl = `${config.apiDemoEndpoint}?apiKey=${encodeURIComponent(apiKey)}&webappId=${encodeURIComponent(config.appId)}`;
  const response = await fetch(demoUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await readRunningHubJson(response, "ai_app_demo", config);
  const nodeInfoList = extractNodeInfoListFromDemo(data);
  if (!response.ok || !nodeInfoList.length) {
    throw stageError("ai_app_demo", "无法读取 RunningHub 视频抠像 AI App 调用参数", summarizeData(data), 502, data, config);
  }

  const mediaNode = findMediaInputNode(nodeInfoList);
  if (!mediaNode) {
    throw stageError("ai_app_demo", "RunningHub 视频抠像 AI App 没有找到视频上传节点", summarizeData({ nodeInfoList }), 502, data, config);
  }

  return nodeInfoList
    .filter((node) => node && node.nodeId && node.fieldName)
    .map((node) => ({
      nodeId: String(node.nodeId),
      fieldName: String(node.fieldName),
      fieldValue: isSameNode(node, mediaNode) ? uploaded.filename : String(node.fieldValue ?? ""),
    }));
}

function extractUploadInfo(data) {
  const candidates = [];
  walkOutput(data, [], null, (value, path) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const filename = value.filename || value.fileName || value.name || value.path || value.filePath;
      if (filename) {
        candidates.push({
          filename: String(filename),
          fileId: value.fileId || value.id || "",
          resourceId: value.resourceId || value.resource_id || "",
          path: path.join("."),
        });
      }
    }
  });
  const first = candidates[0];
  if (first) return first;
  return {
    filename: data?.data?.filename || data?.data?.fileName || data?.data?.name || data?.filename || data?.fileName || "",
    fileId: data?.data?.fileId || data?.fileId || "",
    resourceId: data?.data?.resourceId || data?.resourceId || "",
  };
}

function extractNodeInfoListFromDemo(data) {
  const direct = findFirst(data, (value) => Array.isArray(value?.nodeInfoList) && value.nodeInfoList.length)?.nodeInfoList;
  if (direct) return normalizeNodeInfoList(direct);

  const strings = [];
  walkOutput(data, [], null, (value) => {
    if (typeof value === "string" && value.includes("nodeInfoList")) strings.push(value);
  });

  for (const text of strings) {
    const parsed = parseJsonFromText(text);
    const nodeInfoList = findFirst(parsed, (value) => Array.isArray(value?.nodeInfoList) && value.nodeInfoList.length)?.nodeInfoList;
    if (nodeInfoList) return normalizeNodeInfoList(nodeInfoList);
  }

  return [];
}

function parseJsonFromText(text) {
  const trimmed = String(text || "");
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  const candidate = trimmed.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeNodeInfoList(list) {
  return list
    .filter((node) => node && typeof node === "object")
    .map((node) => ({
      nodeId: String(node.nodeId || node.node_id || ""),
      fieldName: String(node.fieldName || node.field_name || ""),
      fieldValue: node.fieldValue ?? node.field_value ?? "",
      fieldType: String(node.fieldType || node.field_type || ""),
      description: String(node.description || ""),
      nodeName: String(node.nodeName || node.node_name || ""),
    }))
    .filter((node) => node.nodeId && node.fieldName);
}

function findMediaInputNode(nodeInfoList) {
  const scored = nodeInfoList.map((node) => {
    const text = `${node.fieldName} ${node.fieldType} ${node.description} ${node.nodeName}`.toLowerCase();
    let score = 0;
    if (/video|mp4|mov|webm|视频/.test(text)) score += 8;
    if (/upload|上传|file|media|input|输入/.test(text)) score += 4;
    if (/image|图像|图片/.test(text)) score += 1;
    if (/prompt|text|model|ratio|style|seed|scale|颜色|容差|prompt/.test(text)) score -= 4;
    return { node, score };
  }).sort((a, b) => b.score - a.score);
  return scored.find((item) => item.score > 0)?.node || null;
}

function selectVideoOutput(data) {
  const candidates = [];
  walkOutput(data, [], null, (value, path, parent) => {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return;
    const parentText = stringifySafe(parent).toLowerCase();
    const pathText = path.join(".").toLowerCase();
    const looksVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(value) || /video|mp4|mov|webm|m4v|download|result|output/.test(`${parentText} ${pathText}`);
    if (!looksVideo) return;
    candidates.push({
      url: value,
      filename: getFilename(value, parent),
      mimeType: getMimeType(value, parent),
      path: path.join("."),
    });
  });
  const selected = candidates.find((candidate) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(candidate.url)) || candidates[0] || null;
  if (selected) selected.debug = { candidateCount: candidates.length };
  console.log(`[${WORKER_NAME}] output_candidates`, candidates.map((item) => ({ url: item.url, path: item.path, filename: item.filename })).slice(0, 12));
  return selected;
}

function walkOutput(value, path, parent, visit) {
  visit(value, path, parent);
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) value.forEach((item, index) => walkOutput(item, [...path, String(index)], value, visit));
  else Object.entries(value).forEach(([key, item]) => walkOutput(item, [...path, key], value, visit));
}

function findFirst(value, predicate) {
  if (predicate(value)) return value;
  if (!value || typeof value !== "object") return null;
  const entries = Array.isArray(value) ? value : Object.values(value);
  for (const item of entries) {
    const found = findFirst(item, predicate);
    if (found) return found;
  }
  return null;
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
  return {
    action: form.get("action") || "create",
    taskId: form.get("taskId") || "",
    file: form.get("file"),
    keyColor: form.get("keyColor") || "",
    tolerance: form.get("tolerance") || "",
    edgeFeather: form.get("edgeFeather") || "",
    spillSuppression: form.get("spillSuppression") || "",
  };
}

async function readRunningHubJson(response, stage, config) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw stageError(stage, "RunningHub 返回非 JSON", text.slice(0, 1000), 502, undefined, config); }
}

function isFailure(data) {
  const status = getStatus(data).toLowerCase();
  const code = Number(data?.code || data?.errorCode || data?.data?.code || 0);
  if (code === 804 || /running|queue|pending|processing/.test(status)) return false;
  return /fail|error|cancel|reject/.test(status) || code >= 900;
}

function getStatus(data) {
  return String(data?.status || data?.data?.status || data?.taskStatus || data?.data?.taskStatus || data?.state || "");
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

function isSameNode(a, b) {
  return String(a.nodeId) === String(b.nodeId) && String(a.fieldName) === String(b.fieldName);
}

function summarizeData(data) {
  try { return JSON.stringify(data).slice(0, 2200); } catch { return String(data); }
}

function summarizeStatus(data) {
  return {
    code: data?.code || data?.errorCode || "",
    message: getMessage(data),
    status: getStatus(data),
    keys: Object.keys(data || {}).slice(0, 20),
  };
}

function stringifySafe(data) {
  try { return JSON.stringify(data || {}); } catch { return ""; }
}

function abbreviate(value, limit) {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function stageError(stage, message, detail = "", status = 500, raw = undefined, context = undefined) {
  const error = new Error(message);
  error.stage = stage;
  error.detail = detail;
  error.status = status;
  error.raw = raw;
  error.context = context;
  return error;
}

function errorResponse(stage, message, detail = "", status = 500, raw = undefined, context = undefined) {
  return jsonResponse({
    ok: false,
    status: "failed",
    stage,
    message,
    detail,
    taskId: extractTaskId(raw),
    appId: context?.appId || "",
    endpoint: context?.createEndpoint || "",
    raw,
  }, status);
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
    mode: config.mode,
    appId: config.appId,
    endpoint: config.createEndpoint,
    hasApiKey: Boolean(env.RUNNINGHUB_API_KEY),
    configReady: missing.length === 0,
    missing,
    version: VERSION,
  });
}
