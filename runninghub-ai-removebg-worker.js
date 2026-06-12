const RUNNINGHUB_BASE_URL = "https://www.runninghub.cn";
const DEFAULT_AI_APP_ID = "1950866462321876993";
const DEFAULT_IMAGE_NODE_ID = "64";
const DEFAULT_IMAGE_FIELD_NAME = "image";
const DEFAULT_OUTPUT_TYPE_NODE_ID = "50";
const DEFAULT_OUTPUT_TYPE_FIELD_NAME = "value";
const DEFAULT_OUTPUT_TYPE_VALUE = "0";
const DEFAULT_SUBJECT_NODE_ID = "69";
const DEFAULT_SUBJECT_FIELD_NAME = "text";
const DEFAULT_SUBJECT_VALUE = "主体";
const DEFAULT_OUTPUT_NODE_ID = "";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TRANSPARENT_OUTPUT_NODE_IDS = new Set(["114", "120"]);
const MASK_OUTPUT_NODE_IDS = new Set(["117", "118"]);
const WHITE_OUTPUT_NODE_IDS = new Set(["119"]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "POST") {
      return errorResponse("config", "Method not allowed", `当前请求方法为 ${request.method}`, 405);
    }

    try {
      return await handleAiRemoveBackgroundRequest(request, env);
    } catch (error) {
      return errorResponse(
        error.stage || "config",
        error.message || "RunningHub AI 抠图失败",
        error.detail || "",
        error.status || 500,
        error.raw,
      );
    }
  },
};

async function handleAiRemoveBackgroundRequest(request, env) {
  logStage("received_request", { method: request.method });
  const config = validateConfig(env);
  const { apiKey, appId, createEndpoint, statusEndpoint, outputNodeId, apiBaseUrl, nodeConfig } = config;
  const payload = await readActionPayload(request);
  const action = payload.action || (payload.file ? "create" : "status");
  logStage("action", { action });

  if (action === "create") {
    return createAiRemoveBackgroundTask({
      apiKey,
      appId,
      createEndpoint,
      apiBaseUrl,
      nodeConfig,
      image: payload.file,
    });
  }

  if (action === "status") {
    return checkAiRemoveBackgroundTask({
      apiKey,
      taskId: payload.taskId,
      statusEndpoint,
      outputNodeId,
      apiBaseUrl,
    });
  }

  throw stageError("config", "不支持的 RunningHub AI 抠图 action", `当前 action：${action || "(empty)"}`, 400);
}

async function createAiRemoveBackgroundTask({ apiKey, appId, createEndpoint, apiBaseUrl, nodeConfig, image }) {
  if (!createEndpoint) {
    throw stageError(
      "ai_app_api_not_configured",
      "RunningHub AI App API 调用格式未配置",
      "缺少 createEndpoint 或 AI App 创建任务接口参数",
      501,
      { appId },
    );
  }

  if (!(image instanceof File)) {
    throw stageError("config", "请上传需要抠图的图片", "表单字段 file 或 image 不是文件。", 400);
  }
  if (image.size > MAX_FILE_SIZE) {
    throw stageError("config", "图片超过 5MB，请先压缩后再使用 RunningHub AI 抠图", `当前大小：${image.size} bytes`, 413);
  }

  logStage("upload_resource_start", { input_file_size: image.size, fileType: image.type || "unknown" });
  const uploadedFilename = await uploadResource(image, apiKey, apiBaseUrl);
  logStage("upload_resource_done", { filename: uploadedFilename });

  const nodeInfoList = buildAiAppNodeInfoList(nodeConfig, uploadedFilename);
  logStage("create_task_payload_summary", {
    appId,
    createEndpoint,
    uploadedFilename,
    nodeInfoList,
  });
  const taskId = await createAiAppTask({
    apiKey,
    createEndpoint,
    nodeInfoList,
  });
  logStage("create_task_done", { taskId });

  return jsonResponse({
    ok: true,
    status: "pending",
    taskId,
    appId,
    message: "RunningHub AI 抠图任务已创建",
  });
}

async function checkAiRemoveBackgroundTask({ apiKey, taskId, statusEndpoint, outputNodeId, apiBaseUrl }) {
  if (!taskId) {
    throw stageError("config", "RunningHub AI 抠图 taskId 缺失", "请在 status 请求中传入 taskId。", 400);
  }

  logStage("status_check", { taskId });
  const response = await fetch(statusEndpoint || `${apiBaseUrl}/task/openapi/outputs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey, taskId }),
  });
  const data = await safeRunningHubJson(response, "poll_task");
  if (!response.ok) {
    throw stageError("poll_task", getRunningHubMessage(data) || "RunningHub AI 抠图状态查询失败", `HTTP ${response.status}：${summarizeData(data)}`, 502, data);
  }
  const status = getRunningHubStatus(data);
  const message = getRunningHubMessage(data);
  const selection = selectRunningHubOutput(data, outputNodeId);
  logStage("runninghub_status", {
    taskId,
    status,
    runninghub_code: data?.code ?? data?.data?.code ?? "",
    runninghub_message: message,
    raw_response_top_level_keys: Object.keys(data || {}).slice(0, 40),
    raw_response_data_keys: getRawOutputKeys(data),
    candidateCount: selection.downloadableCandidates.length,
    configured_output_node_id: outputNodeId || DEFAULT_OUTPUT_NODE_ID,
  });

  logStage("all_image_like_candidates", {
    taskId,
    configured_output_node_id: outputNodeId || DEFAULT_OUTPUT_NODE_ID,
    candidates: selection.candidates.map(toCandidateLog),
  });
  logStage("downloadable_candidates", {
    taskId,
    candidates: selection.downloadableCandidates.map(toCandidateLog),
  });
  logStage("mask_candidates", {
    taskId,
    candidates: selection.maskCandidates.map(toCandidateLog),
  });
  logStage("color_candidates", {
    taskId,
    candidates: selection.colorCandidates.map(toCandidateLog),
  });

  if (selection.selected) {
    logStage("selected_output", {
      taskId,
      selected: toCandidateLog(selection.selected),
      selected_output_reason: selection.reason,
    });
    return downloadSelectedOutput(selection.selected, taskId, selection.resultType, selection.reason);
  }

  if (isRunningHubFailure(data)) {
    throw stageError("poll_task", getRunningHubMessage(data) || "RunningHub AI 抠图任务失败", summarizeData(data), 502, data);
  }

  return jsonResponse({
    ok: true,
    status: "running",
    taskId,
    message: isRunningHubSuccess(data) ? "等待 RunningHub 输出图片" : "RunningHub AI 抠图处理中",
  });
}

async function downloadSelectedOutput(candidate, taskId, resultType, reason) {
  const fileUrl = candidate.url;
  logStage("selected_output", { taskId, fileUrl, resultType, selected_output_reason: reason });

  const output = await fetch(fileUrl);
  if (!output.ok) {
    throw stageError("download_result", "RunningHub AI 抠图输出图片下载失败", `HTTP ${output.status} ${output.statusText}`, 502);
  }

  const contentType = output.headers.get("Content-Type") || "image/png";
  if (!/^image\//i.test(contentType)) {
    throw stageError("download_result", "RunningHub AI 抠图输出不是图片", `Content-Type：${contentType}`, 502);
  }

  const buffer = await output.arrayBuffer();
  const inspection = await inspectOutputImage(buffer, contentType, candidate);
  const finalResultType = resolveDetectedResultType(resultType, candidate, inspection);
  logStage("download_result_done", {
    status: output.status,
    contentType,
    selected_output_reason: reason,
    detected_alpha_pixels: inspection.transparentPixelCount,
    detected_transparent_png: inspection.detectedTransparentPng,
    detected_mask_image: inspection.detectedMaskImage,
    resultType: finalResultType,
  });
  return new Response(buffer, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": contentType.includes("png") ? contentType : "image/png",
      "Cache-Control": "no-store",
      "X-RemoveBG-Status": "done",
      "X-RemoveBG-Result-Type": finalResultType,
      "X-RemoveBG-TaskId": taskId,
      "X-RemoveBG-Selected-Reason": reason,
    },
  });
}

async function readActionPayload(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (/application\/json/i.test(contentType)) {
    const data = await request.json();
    return {
      action: String(data?.action || "").trim(),
      taskId: String(data?.taskId || data?.task_id || "").trim(),
      file: null,
    };
  }

  const form = await request.formData();
  return {
    action: String(form.get("action") || "").trim(),
    taskId: String(form.get("taskId") || form.get("task_id") || "").trim(),
    file: form.get("file") || form.get("image"),
  };
}

function validateConfig(env) {
  const apiKey = env.RUNNINGHUB_API_KEY;
  const appId = env.RUNNINGHUB_AI_APP_ID || DEFAULT_AI_APP_ID;
  const imageNodeId = env.RUNNINGHUB_AI_APP_IMAGE_NODE_ID || DEFAULT_IMAGE_NODE_ID;
  const imageFieldName = env.RUNNINGHUB_AI_APP_IMAGE_FIELD_NAME || DEFAULT_IMAGE_FIELD_NAME;
  const createEndpoint = env.RUNNINGHUB_AI_APP_CREATE_ENDPOINT || "";
  const statusEndpoint = env.RUNNINGHUB_AI_APP_STATUS_ENDPOINT || "";
  const outputNodeId = env.RUNNINGHUB_AI_APP_OUTPUT_NODE_ID || DEFAULT_OUTPUT_NODE_ID;
  const outputTypeNodeId = env.RUNNINGHUB_AI_APP_OUTPUT_TYPE_NODE_ID || DEFAULT_OUTPUT_TYPE_NODE_ID;
  const outputTypeFieldName = env.RUNNINGHUB_AI_APP_OUTPUT_TYPE_FIELD_NAME || DEFAULT_OUTPUT_TYPE_FIELD_NAME;
  const outputTypeValue = env.RUNNINGHUB_AI_APP_OUTPUT_TYPE_VALUE || DEFAULT_OUTPUT_TYPE_VALUE;
  const subjectNodeId = env.RUNNINGHUB_AI_APP_SUBJECT_NODE_ID || DEFAULT_SUBJECT_NODE_ID;
  const subjectFieldName = env.RUNNINGHUB_AI_APP_SUBJECT_FIELD_NAME || DEFAULT_SUBJECT_FIELD_NAME;
  const subjectValue = env.RUNNINGHUB_AI_APP_SUBJECT_VALUE || DEFAULT_SUBJECT_VALUE;
  const apiBaseUrl = normalizeBaseUrl(env.RUNNINGHUB_AI_APP_API_BASE_URL || getEndpointOrigin(createEndpoint) || RUNNINGHUB_BASE_URL);

  if (!apiKey) throw stageError("config", "RunningHub API Key 缺失", "请在 Cloudflare Worker Secret 中配置 RUNNINGHUB_API_KEY。");
  if (!appId) {
    throw stageError("config", "RunningHub AI App ID 缺失", "请配置 RUNNINGHUB_AI_APP_ID。");
  }
  if (!imageFieldName) {
    throw stageError("config", "RunningHub AI 抠图图片字段未配置", "请配置 RUNNINGHUB_AI_APP_IMAGE_FIELD_NAME。");
  }

  if (!imageNodeId) throw stageError("config", "RunningHub AI 抠图图片节点未配置", "请配置 RUNNINGHUB_AI_APP_IMAGE_NODE_ID。");
  if (!outputTypeNodeId || !outputTypeFieldName) throw stageError("config", "RunningHub AI 抠图输出类型节点未配置", "请配置 RUNNINGHUB_AI_APP_OUTPUT_TYPE_NODE_ID 和 RUNNINGHUB_AI_APP_OUTPUT_TYPE_FIELD_NAME。");
  if (!subjectNodeId || !subjectFieldName) throw stageError("config", "RunningHub AI 抠图对象节点未配置", "请配置 RUNNINGHUB_AI_APP_SUBJECT_NODE_ID 和 RUNNINGHUB_AI_APP_SUBJECT_FIELD_NAME。");

  return {
    apiKey,
    appId,
    createEndpoint,
    statusEndpoint,
    outputNodeId,
    apiBaseUrl,
    nodeConfig: {
      imageNodeId,
      imageFieldName,
      outputTypeNodeId,
      outputTypeFieldName,
      outputTypeValue,
      subjectNodeId,
      subjectFieldName,
      subjectValue,
    },
  };
}

async function uploadResource(file, apiKey, apiBaseUrl) {
  const form = new FormData();
  form.set("file", file, file.name || "input.png");

  const response = await fetch(`${apiBaseUrl}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  const data = await readRunningHubJson(response, "upload", "上传资源失败");
  const filename = data?.data?.filename || data?.data?.fileName || data?.data?.name;

  if (!filename) {
    throw stageError("upload", "RunningHub 上传成功但没有返回资源文件名", summarizeData(data));
  }
  return filename;
}

function buildAiAppNodeInfoList(nodeConfig, uploadedFilename) {
  return [
    {
      nodeId: String(nodeConfig.imageNodeId),
      fieldName: nodeConfig.imageFieldName,
      fieldValue: uploadedFilename,
    },
    {
      nodeId: String(nodeConfig.outputTypeNodeId),
      fieldName: nodeConfig.outputTypeFieldName,
      fieldValue: String(nodeConfig.outputTypeValue),
    },
    {
      nodeId: String(nodeConfig.subjectNodeId),
      fieldName: nodeConfig.subjectFieldName,
      fieldValue: String(nodeConfig.subjectValue),
    },
  ];
}

async function createAiAppTask({ apiKey, createEndpoint, nodeInfoList }) {
  const response = await fetch(createEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nodeInfoList }),
  });
  const data = await readRunningHubJson(response, "create_task", "RunningHub AI App 创建抠图任务失败");
  const taskIdInfo = extractTaskIdFromCreateResponse(data);
  logStage("create_task_response_summary", {
    create_response_raw_type: Array.isArray(data) ? "array" : typeof data,
    create_response_top_level_keys: data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).slice(0, 40) : [],
    detail_is_json_string: taskIdInfo.detailIsJsonString,
    task_id_candidates: taskIdInfo.candidates,
    extracted_task_id: taskIdInfo.taskId,
  });

  if (!taskIdInfo.taskId) throw stageError("create_task", "RunningHub AI App 创建抠图任务成功但没有返回 taskId", summarizeData(data));
  return taskIdInfo.taskId;
}

function extractTaskIdFromCreateResponse(raw) {
  const state = {
    candidates: [],
    visited: new WeakSet(),
    detailIsJsonString: false,
  };
  const parsedRaw = parseJsonStringIfPossible(raw, "root", state);
  scanTaskIdCandidate(parsedRaw, "$", state);

  const taskFieldCandidate = state.candidates.find((candidate) => candidate.priority === 1);
  const idFallbackCandidate = state.candidates.find((candidate) => candidate.priority === 2);
  const regexCandidate = state.candidates.find((candidate) => candidate.priority === 3);
  const selected = taskFieldCandidate || idFallbackCandidate || regexCandidate;

  return {
    taskId: selected?.value || "",
    candidates: state.candidates.map(({ path, key, value, source }) => ({ path, key, value, source })),
    detailIsJsonString: state.detailIsJsonString,
  };
}

function scanTaskIdCandidate(value, path, state) {
  const parsed = parseJsonStringIfPossible(value, path, state);
  if (parsed !== value) {
    scanTaskIdCandidate(parsed, `${path}{json}`, state);
    return;
  }

  if (typeof value === "string") {
    addRegexTaskIdCandidates(value, path, state);
    return;
  }

  if (!value || typeof value !== "object") return;
  if (state.visited.has(value)) return;
  state.visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanTaskIdCandidate(item, `${path}[${index}]`, state));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (isTaskIdKey(key) && child !== undefined && child !== null && child !== "") {
      state.candidates.push({
        path: `${path}.${key}`,
        key,
        value: String(child),
        source: "task_field",
        priority: 1,
      });
    } else if (key === "id" && child !== undefined && child !== null && child !== "") {
      state.candidates.push({
        path: `${path}.${key}`,
        key,
        value: String(child),
        source: "id_fallback",
        priority: 2,
      });
    }
    scanTaskIdCandidate(child, `${path}.${key}`, state);
  }
}

function isTaskIdKey(key) {
  return ["taskId", "task_id", "taskID"].includes(String(key));
}

function parseJsonStringIfPossible(value, path, state) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!looksLikeJson(text)) {
    addRegexTaskIdCandidates(text, path, state);
    return value;
  }
  try {
    const parsed = JSON.parse(text);
    if (/\.detail$/i.test(path)) state.detailIsJsonString = true;
    return parsed;
  } catch (error) {
    addRegexTaskIdCandidates(text, path, state);
    return value;
  }
}

function looksLikeJson(text) {
  return Boolean(text && ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]")) || (text.startsWith('"') && text.endsWith('"'))));
}

function addRegexTaskIdCandidates(text, path, state) {
  const pattern = /"taskId"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(text))) {
    state.candidates.push({
      path,
      key: "taskId",
      value: match[1],
      source: "regex_fallback",
      priority: 3,
    });
  }
}

function getEndpointOrigin(endpoint) {
  try {
    return new URL(endpoint).origin;
  } catch (error) {
    return "";
  }
}

function normalizeBaseUrl(value) {
  return String(value || RUNNINGHUB_BASE_URL).trim().replace(/\/+$/, "");
}

async function readRunningHubJson(response, stage, fallbackMessage) {
  const data = await safeRunningHubJson(response, stage);
  if (!response.ok || !isRunningHubSuccess(data)) {
    throw stageError(stage, getRunningHubMessage(data) || fallbackMessage, `HTTP ${response.status}：${summarizeData(data)}`, 502);
  }
  return data;
}

async function safeRunningHubJson(response, stage) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!response.ok) {
      throw stageError(stage, "RunningHub 返回非 JSON 错误", `HTTP ${response.status}：${text}`, 502);
    }
    return {};
  }
}

function selectRunningHubOutput(data, outputNodeId) {
  const candidates = collectOutputCandidates(data)
    .map((candidate) => scoreOutputCandidate(candidate, outputNodeId))
    .sort((a, b) => b.score - a.score);
  const downloadableCandidates = candidates.filter((candidate) => candidate.isDownloadable && candidate.isImage);
  const maskCandidates = downloadableCandidates
    .filter((candidate) => candidate.isMask)
    .sort((a, b) => b.score - a.score);
  const transparentCandidates = downloadableCandidates
    .filter((candidate) => !candidate.isMask && !candidate.isWhite && !candidate.isBlack && (candidate.isConfiguredOutput || candidate.isTransparentNode || candidate.isTransparentHint))
    .sort((a, b) => b.score - a.score);
  const colorCandidates = downloadableCandidates
    .filter((candidate) => !candidate.isMask)
    .sort((a, b) => b.score - a.score);

  if (transparentCandidates[0] && (!maskCandidates[0] || transparentCandidates[0].isTransparentHint)) {
    const selected = transparentCandidates[0];
    return {
      candidates,
      downloadableCandidates,
      maskCandidates,
      colorCandidates,
      selected,
      resultType: "transparent",
      reason: selected.isConfiguredOutput ? "configured_output_node" : "transparent_candidate",
    };
  }

  if (maskCandidates[0]) {
    return {
      candidates,
      downloadableCandidates,
      maskCandidates,
      colorCandidates,
      selected: maskCandidates[0],
      resultType: "mask",
      reason: "mask_candidate",
    };
  }

  if (colorCandidates[0]) {
    return {
      candidates,
      downloadableCandidates,
      maskCandidates,
      colorCandidates,
      selected: colorCandidates[0],
      resultType: "fallback_image",
      reason: "fallback_downloadable_candidate",
    };
  }

  return {
    candidates,
    downloadableCandidates,
    maskCandidates,
    colorCandidates,
    selected: null,
    resultType: "",
    reason: "no_downloadable_image",
  };
}

function collectOutputCandidates(data) {
  const candidates = [];
  const seen = new Set();
  const root = data?.data ?? data;

  function visit(value, path = "", inheritedNodeIds = []) {
    if (!value) return;

    if (typeof value === "string") {
      const url = normalizeOutputUrl(value);
      if (url && !seen.has(`${url}:${path}`)) {
        seen.add(`${url}:${path}`);
        candidates.push(createOutputCandidate({ url, item: { value }, path, nodeIds: inheritedNodeIds }));
      }
      return;
    }

    if (typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, inheritedNodeIds));
      return;
    }

    const nodeIds = uniqueStrings([...inheritedNodeIds, ...getOutputNodeIds(value)]);
    const urls = getOutputUrls(value);
    urls.forEach((url) => {
      const key = `${url}:${path}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(createOutputCandidate({ url, item: value, path, nodeIds }));
    });

    const filename = getOutputFilename(value);
    if (filename && !urls.length) {
      const key = `filename:${filename}:${path}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(createOutputCandidate({ url: "", item: value, path, nodeIds, filename }));
      }
    }

    Object.entries(value).forEach(([key, child]) => {
      if (key === "apiKey") return;
      visit(child, path ? `${path}.${key}` : key, nodeIds);
    });
  }

  visit(root);
  return candidates;
}

function createOutputCandidate({ url, item, path, nodeIds, filename = "" }) {
  const outputFilename = filename || getOutputFilename(item) || extractFilenameFromUrl(url);
  const mime = getOutputMime(item);
  const text = `${url} ${outputFilename} ${mime} ${path} ${safeStringify(item)}`.toLowerCase();
  const isMask = nodeIds.some((id) => MASK_OUTPUT_NODE_IDS.has(id)) || /mask|segmentation|matte|alpha/i.test(text);
  const isWhite = nodeIds.some((id) => WHITE_OUTPUT_NODE_IDS.has(id)) || /white|add_background.*white|background.*white|白底/i.test(text);
  const isBlack = /black|add_background.*black|background.*black|黑底/i.test(text);
  return {
    item,
    url,
    filename: outputFilename,
    path,
    nodeIds,
    mime,
    isDownloadable: /^https?:\/\//i.test(url),
    isImage: isImageOutput(item, url, outputFilename, mime),
    isPng: /\.png(?:[?#]|$)/i.test(url) || /\.png$/i.test(outputFilename) || /image\/png/i.test(mime),
    isMask,
    isWhite,
    isBlack,
    isConfiguredOutput: false,
    isTransparentNode: false,
    isTransparentHint: /transparent|removebg|rembg|cutout|alpha|none/i.test(text) && !isMask,
    score: 0,
    reason: "",
  };
}

function getOutputUrls(item) {
  const urls = [
    item?.url,
    item?.fileUrl,
    item?.file_url,
    item?.imageUrl,
    item?.image_url,
    item?.downloadUrl,
    item?.download_url,
    item?.src,
    item?.href,
  ];
  Object.entries(item || {}).forEach(([key, value]) => {
    if (typeof value === "string" && /url|uri|href|path|file|image|download/i.test(key)) urls.push(value);
  });
  return uniqueStrings(urls.map(normalizeOutputUrl).filter(Boolean));
}

function normalizeOutputUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (/^\/\//.test(text)) return `https:${text}`;
  if (/^\//.test(text)) return `${RUNNINGHUB_BASE_URL}${text}`;
  return "";
}

function getOutputFilename(item) {
  return (
    item?.fileName ||
    item?.filename ||
    item?.name ||
    item?.originFilename ||
    item?.origin_filename ||
    item?.path ||
    ""
  ).toString();
}

function getOutputMime(item) {
  return (
    item?.contentType ||
    item?.content_type ||
    item?.mime ||
    item?.mimeType ||
    item?.type ||
    ""
  ).toString();
}

function extractFilenameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  } catch (error) {
    return "";
  }
}

function getOutputNodeIds(item) {
  return [
    item?.nodeId,
    item?.node_id,
    item?.outputNodeId,
    item?.output_node_id,
    item?.sourceNodeId,
    item?.source_node_id,
    item?.originNodeId,
    item?.origin_node_id,
    item?.node?.id,
    item?.node?.nodeId,
    item?.nodeInfo?.nodeId,
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value));
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value)).filter(Boolean))];
}

function isImageOutput(item, url, filename, mime) {
  const text = `${url} ${filename} ${mime} ${safeStringify(item)}`.toLowerCase();
  return /^https?:\/\//i.test(url) && (/image\//i.test(text) || /\.(png|jpe?g|webp)(?:[?#]|$)/i.test(url) || /\.(png|jpe?g|webp)$/i.test(filename));
}

function scoreOutputCandidate(candidate, outputNodeId) {
  const scored = { ...candidate };
  const { item, url, nodeIds } = scored;
  const text = `${url} ${scored.filename} ${scored.mime} ${scored.path} ${safeStringify(item)}`.toLowerCase();
  let score = 0;

  scored.isConfiguredOutput = Boolean(outputNodeId && nodeIds.includes(String(outputNodeId)));
  scored.isTransparentNode = nodeIds.some((id) => TRANSPARENT_OUTPUT_NODE_IDS.has(id));
  scored.isTransparentHint = /transparent|removebg|rembg|cutout|none/i.test(text) && !scored.isMask;
  if (!scored.isDownloadable) score -= 500;
  if (!scored.isImage) score -= 300;
  if (scored.isConfiguredOutput) score += 180;
  if (scored.isTransparentNode) score += 140;
  if (scored.isMask) score += 120;
  if (scored.isPng) score += 30;
  if (/rembg|removebg|transparent|alpha|none|png/i.test(text)) score += 20;
  if (scored.isWhite) score -= 40;
  if (scored.isBlack) score -= 10;
  scored.score = score;
  scored.reason = scored.isMask
    ? "mask_candidate"
    : scored.isConfiguredOutput
      ? "configured_output_node"
      : scored.isTransparentNode
        ? "transparent_output_node"
        : "downloadable_image";
  return scored;
}

async function inspectOutputImage(buffer, contentType, candidate) {
  const fallback = {
    inspectable: false,
    detectedTransparentPng: false,
    detectedMaskImage: false,
    transparentPixelCount: 0,
    transparentPixelRatio: 0,
  };
  const isPng = /image\/png/i.test(contentType || "") || candidate.isPng || hasPngSignature(buffer);
  if (!isPng) return fallback;

  try {
    const png = await inspectPngPixels(buffer);
    return {
      inspectable: true,
      detectedTransparentPng: png.transparentPixelRatio > 0.002,
      detectedMaskImage: !png.hasAlphaTransparency && png.grayPixelRatio > 0.985 && png.blackWhitePixelRatio > 0.88 && png.opaqueAlphaRatio > 0.995,
      transparentPixelCount: png.transparentPixelCount,
      transparentPixelRatio: png.transparentPixelRatio,
    };
  } catch (error) {
    console.warn("[RunningHub AI RemoveBG Worker] inspect_output_image_failed", error?.message || String(error));
    return fallback;
  }
}

function resolveDetectedResultType(resultType, candidate, inspection) {
  if (inspection.detectedTransparentPng) return "transparent";
  if (inspection.detectedMaskImage) return "mask";
  if (candidate.isMask && resultType !== "transparent") return "mask";
  if (resultType === "transparent" && !inspection.inspectable) return "transparent";
  if (resultType === "transparent" && candidate.isTransparentHint && !candidate.isMask) return "transparent";
  return "fallback_image";
}

async function inspectPngPixels(buffer) {
  const bytes = new Uint8Array(buffer);
  if (!hasPngSignature(buffer)) throw new Error("not_png");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts = [];

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = readAscii(bytes, offset + 4, 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.length) break;

    if (type === "IHDR") {
      width = readUint32(bytes, dataStart);
      height = readUint32(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
    } else if (type === "IDAT") {
      idatParts.push(bytes.slice(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8 || !idatParts.length) {
    throw new Error(`unsupported_png width=${width} height=${height} bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const compressed = concatUint8Arrays(idatParts);
  const inflated = await inflateZlibData(compressed);
  const channels = getPngChannels(colorType);
  const bpp = channels;
  const stride = width * bpp;
  const rgbaLike = [0, 2, 4, 6].includes(colorType);
  if (!rgbaLike) throw new Error(`unsupported_color_type ${colorType}`);

  let inputOffset = 0;
  let transparentPixelCount = 0;
  let grayPixelCount = 0;
  let blackWhitePixelCount = 0;
  let opaqueAlphaCount = 0;
  const totalPixels = width * height;
  let previous = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const raw = inflated.slice(inputOffset, inputOffset + stride);
    inputOffset += stride;
    const row = unfilterPngRow(raw, previous, filter, bpp);

    for (let x = 0; x < width; x += 1) {
      const index = x * bpp;
      const r = colorType === 0 || colorType === 4 ? row[index] : row[index];
      const g = colorType === 0 || colorType === 4 ? row[index] : row[index + 1];
      const b = colorType === 0 || colorType === 4 ? row[index] : row[index + 2];
      const alpha = colorType === 6 ? row[index + 3] : colorType === 4 ? row[index + 1] : 255;
      if (alpha < 250) transparentPixelCount += 1;
      if (alpha >= 250) opaqueAlphaCount += 1;
      if (Math.abs(r - g) <= 3 && Math.abs(r - b) <= 3 && Math.abs(g - b) <= 3) grayPixelCount += 1;
      const avg = (r + g + b) / 3;
      if (avg <= 18 || avg >= 237) blackWhitePixelCount += 1;
    }

    previous = row;
  }

  return {
    transparentPixelCount,
    transparentPixelRatio: transparentPixelCount / Math.max(1, totalPixels),
    hasAlphaTransparency: transparentPixelCount > 0,
    grayPixelRatio: grayPixelCount / Math.max(1, totalPixels),
    blackWhitePixelRatio: blackWhitePixelCount / Math.max(1, totalPixels),
    opaqueAlphaRatio: opaqueAlphaCount / Math.max(1, totalPixels),
  };
}

function hasPngSignature(buffer) {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readAscii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function concatUint8Arrays(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

async function inflateZlibData(data) {
  if (typeof DecompressionStream !== "function") throw new Error("decompression_stream_unavailable");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
  const response = new Response(stream);
  return new Uint8Array(await response.arrayBuffer());
}

function getPngChannels(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`unsupported_color_type ${colorType}`);
}

function unfilterPngRow(raw, previous, filter, bpp) {
  const row = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    const left = index >= bpp ? row[index - bpp] : 0;
    const up = previous[index] || 0;
    const upperLeft = index >= bpp ? previous[index - bpp] || 0 : 0;
    let value = raw[index];
    if (filter === 1) value += left;
    else if (filter === 2) value += up;
    else if (filter === 3) value += Math.floor((left + up) / 2);
    else if (filter === 4) value += paethPredictor(left, up, upperLeft);
    else if (filter !== 0) throw new Error(`unsupported_png_filter ${filter}`);
    row[index] = value & 0xff;
  }
  return row;
}

function paethPredictor(left, up, upperLeft) {
  const p = left + up - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upperLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upperLeft;
}

function toCandidateLog(candidate) {
  return {
    nodeIds: candidate.nodeIds,
    url: candidate.url,
    filename: candidate.filename,
    path: candidate.path,
    mime: candidate.mime,
    score: candidate.score,
    isDownloadable: candidate.isDownloadable,
    isImage: candidate.isImage,
    isPng: candidate.isPng,
    isMask: candidate.isMask,
    isWhite: candidate.isWhite,
    isBlack: candidate.isBlack,
    reason: candidate.reason,
  };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, (key, child) => (key === "apiKey" ? "[redacted]" : child)).slice(0, 3000);
  } catch (error) {
    return "";
  }
}

function isRunningHubFailure(data) {
  if (isRunningHubSuccess(data)) return false;
  const message = getRunningHubMessage(data);
  return !/running|processing|queue|pending|not.*finish|排队|运行|处理中|未完成/i.test(message);
}

function isRunningHubSuccess(data) {
  return data?.code === undefined || data.code === 0 || data.code === 200;
}

function getRunningHubMessage(data) {
  return data?.msg || data?.message || data?.error || "";
}

function getRunningHubStatus(data) {
  if (!data) return "no_response";
  const parts = [];
  if (data.code !== undefined) parts.push(`code=${data.code}`);
  const status = data.status || data.state || data.taskStatus || data.task_status || data.data?.status || data.data?.state;
  if (status) parts.push(`status=${status}`);
  const message = getRunningHubMessage(data);
  if (message) parts.push(`message=${message}`);
  return parts.join(" ") || "unknown";
}

function getRawOutputKeys(data) {
  const root = data?.data ?? data;
  if (!root || typeof root !== "object") return [];
  const keys = new Set(Object.keys(root));
  ["outputs", "output", "images", "files", "result", "results"].forEach((key) => {
    if (root?.[key] !== undefined) keys.add(key);
  });
  return [...keys].slice(0, 40);
}

function stageError(stage, message, detail = "", status = 500, raw = undefined) {
  const error = new Error(message);
  error.stage = stage;
  error.detail = detail;
  error.status = status;
  error.raw = raw;
  console.error("[RunningHub AI RemoveBG Worker]", { stage, message, detail, raw: summarizeRaw(raw) });
  return error;
}

function errorResponse(stage, message, detail, status = 500, raw = undefined) {
  console.error("[RunningHub AI AI RemoveBG Worker error_response]", { stage, message, detail, status, raw: summarizeRaw(raw) });
  const payload = { ok: false, stage, message, detail };
  if (raw !== undefined) payload.raw = summarizeRaw(raw);
  return jsonResponse(payload, status);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function summarizeData(data) {
  try {
    return JSON.stringify(data).slice(0, 1200);
  } catch (error) {
    return String(data);
  }
}

function summarizeRaw(data) {
  if (data === undefined) return undefined;
  try {
    const text = JSON.stringify(data, (key, value) => (key === "apiKey" ? "[redacted]" : value));
    if (text.length <= 2000) return JSON.parse(text);
    return `${text.slice(0, 2000)}...`;
  } catch (error) {
    return String(data).slice(0, 2000);
  }
}

function logStage(stage, detail = {}) {
  console.log("[RunningHub AI RemoveBG Worker]", { stage, ...detail });
}
