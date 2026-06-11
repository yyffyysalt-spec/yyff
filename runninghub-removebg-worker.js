const RUNNINGHUB_BASE_URL = "https://www.runninghub.ai";
const DEFAULT_IMAGE_NODE_ID = "3";
const DEFAULT_IMAGE_FIELD_NAME = "image";
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
      return await handleRemoveBackgroundRequest(request, env);
    } catch (error) {
      return errorResponse(
        error.stage || "config",
        error.message || "RunningHub 抠图失败",
        error.detail || "",
        error.status || 500,
        error.raw,
      );
    }
  },
};

async function handleRemoveBackgroundRequest(request, env) {
  logStage("received_request", { method: request.method });
  const config = validateConfig(env);
  const { apiKey, workflowId, imageNodeId, imageFieldName, outputNodeId } = config;
  const payload = await readActionPayload(request);
  const action = payload.action || (payload.file ? "create" : "status");
  logStage("action", { action });

  if (action === "create") {
    return createRemoveBackgroundTask({
      apiKey,
      workflowId,
      imageNodeId,
      imageFieldName,
      image: payload.file,
    });
  }

  if (action === "status") {
    return checkRemoveBackgroundTask({
      apiKey,
      taskId: payload.taskId,
      outputNodeId,
    });
  }

  throw stageError("config", "不支持的 RunningHub 抠图 action", `当前 action：${action || "(empty)"}`, 400);
}

async function createRemoveBackgroundTask({ apiKey, workflowId, imageNodeId, imageFieldName, image }) {
  if (!(image instanceof File)) {
    throw stageError("config", "请上传需要抠图的图片", "表单字段 file 或 image 不是文件。", 400);
  }
  if (image.size > MAX_FILE_SIZE) {
    throw stageError("config", "图片超过 5MB，请先压缩后再使用 RunningHub 抠图", `当前大小：${image.size} bytes`, 413);
  }

  logStage("upload_resource_start", { fileSize: image.size, fileType: image.type || "unknown" });
  const uploadedFilename = await uploadResource(image, apiKey);
  logStage("upload_resource_done", { filename: uploadedFilename });

  logStage("create_task_start", {
    workflowId,
    imageNodeId,
    imageFieldName,
  });
  const taskId = await createTask({
    apiKey,
    workflowId,
    imageNodeId,
    imageFieldName,
    uploadedFilename,
  });
  logStage("create_task_done", { taskId });

  return jsonResponse({
    ok: true,
    status: "pending",
    taskId,
    workflowId,
    message: "RMBG-2.0 高质量抠图任务已创建",
  });
}

async function checkRemoveBackgroundTask({ apiKey, taskId, outputNodeId }) {
  if (!taskId) {
    throw stageError("config", "RunningHub 抠图 taskId 缺失", "请在 status 请求中传入 taskId。", 400);
  }

  logStage("status_check", { taskId });
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey, taskId }),
  });
  const data = await safeRunningHubJson(response, "poll_task");
  if (!response.ok) {
    throw stageError("poll_task", getRunningHubMessage(data) || "RunningHub 抠图状态查询失败", `HTTP ${response.status}：${summarizeData(data)}`, 502, data);
  }
  const status = getRunningHubStatus(data);
  const selection = selectTransparentCutoutOutput(data, outputNodeId);
  logStage("runninghub_status", {
    taskId,
    status,
    candidateCount: selection.candidates.length,
  });

  if (selection.candidates.length) {
    logStage("output_candidates", {
      taskId,
      candidates: selection.candidates.map(toCandidateLog),
    });
  }

  if (selection.selected) {
    logStage("selected_output", {
      taskId,
      selected: toCandidateLog(selection.selected),
    });
    return downloadSelectedOutput(selection.selected.fileUrl, taskId);
  }

  if (isRunningHubFailure(data)) {
    throw stageError("poll_task", getRunningHubMessage(data) || "RunningHub 抠图任务失败", summarizeData(data), 502, data);
  }

  return jsonResponse({
    ok: true,
    status: "running",
    taskId,
    message: isRunningHubSuccess(data) ? "等待 RunningHub 输出图片" : "RMBG-2.0 高质量抠图处理中",
  });
}

async function downloadSelectedOutput(fileUrl, taskId) {
  logStage("selected_output", { taskId, fileUrl });

  const output = await fetch(fileUrl);
  if (!output.ok) {
    throw stageError("download_result", "RunningHub 抠图输出图片下载失败", `HTTP ${output.status} ${output.statusText}`, 502);
  }

  const contentType = output.headers.get("Content-Type") || "image/png";
  if (!/^image\//i.test(contentType)) {
    throw stageError("download_result", "RunningHub 抠图输出不是图片", `Content-Type：${contentType}`, 502);
  }

  logStage("download_result_done", { status: output.status, contentType });
  return new Response(output.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": contentType.includes("png") ? contentType : "image/png",
      "Cache-Control": "no-store",
      "X-RemoveBG-Status": "done",
      "X-RemoveBG-TaskId": taskId,
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
  const workflowId = env.RUNNINGHUB_REMOVEBG_WORKFLOW_ID;
  const imageNodeId = env.RUNNINGHUB_REMOVEBG_IMAGE_NODE_ID || DEFAULT_IMAGE_NODE_ID;
  const imageFieldName = env.RUNNINGHUB_REMOVEBG_IMAGE_FIELD_NAME || DEFAULT_IMAGE_FIELD_NAME;
  const outputNodeId = env.RUNNINGHUB_REMOVEBG_OUTPUT_NODE_ID || "";

  if (!apiKey) throw stageError("config", "RunningHub API Key 缺失", "请在 Cloudflare Worker Secret 中配置 RUNNINGHUB_API_KEY。");
  if (!workflowId) {
    throw stageError("config", "RunningHub 抠图 workflowId 缺失", "请配置 RUNNINGHUB_REMOVEBG_WORKFLOW_ID。");
  }
  if (!imageNodeId) {
    throw stageError("config", "RunningHub 抠图图片节点未配置", "请配置 RUNNINGHUB_REMOVEBG_IMAGE_NODE_ID，当前工作流应为 3。");
  }
  if (!imageFieldName) {
    throw stageError("config", "RunningHub 抠图图片字段未配置", "请配置 RUNNINGHUB_REMOVEBG_IMAGE_FIELD_NAME，当前工作流应为 image。");
  }

  return { apiKey, workflowId, imageNodeId, imageFieldName, outputNodeId };
}

async function uploadResource(file, apiKey) {
  const form = new FormData();
  form.set("file", file, file.name || "input.png");

  const response = await fetch(`${RUNNINGHUB_BASE_URL}/openapi/v2/media/upload/binary`, {
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

async function createTask({ apiKey, workflowId, imageNodeId, imageFieldName, uploadedFilename }) {
  const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey,
      workflowId,
      nodeInfoList: [
        {
          nodeId: String(imageNodeId),
          fieldName: imageFieldName,
          fieldValue: uploadedFilename,
        },
      ],
      addMetadata: false,
    }),
  });
  const data = await readRunningHubJson(response, "create_task", "RunningHub 创建抠图任务失败");
  const taskId = data?.data?.taskId || data?.data?.task_id || data?.data?.id;

  if (!taskId) throw stageError("create_task", "RunningHub 创建抠图任务成功但没有返回 taskId", summarizeData(data));
  return taskId;
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

function selectTransparentCutoutOutput(data, outputNodeId) {
  const candidates = collectOutputCandidates(data)
    .map((candidate) => {
      const scoredCandidate = { ...candidate };
      scoredCandidate.score = scoreOutputCandidate(scoredCandidate, outputNodeId);
      return scoredCandidate;
    })
    .sort((a, b) => b.score - a.score);
  const usable = candidates.filter((candidate) => !candidate.excluded);

  if (usable.length === 1) return { candidates, selected: usable[0] };
  return {
    candidates,
    selected: usable.find((candidate) => candidate.score >= 0) || null,
  };
}

function collectOutputCandidates(data) {
  const candidates = [];
  const seen = new Set();
  const root = data?.data ?? data;

  function visit(value, path = "", inheritedNodeIds = []) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, inheritedNodeIds));
      return;
    }

    const nodeIds = uniqueStrings([...inheritedNodeIds, ...getOutputNodeIds(value)]);
    const fileUrl = getOutputFileUrl(value);
    if (fileUrl && !seen.has(fileUrl)) {
      seen.add(fileUrl);
      const text = `${fileUrl} ${JSON.stringify(value)}`.toLowerCase();
      candidates.push({
        item: value,
        fileUrl,
        path,
        nodeIds,
        isImage: isImageOutput(value, fileUrl),
        isPng: /\.png(?:[?#]|$)/i.test(fileUrl) || /image\/png/i.test(text),
        isMask: nodeIds.some((id) => MASK_OUTPUT_NODE_IDS.has(id)) || /mask|segmentation|matte/i.test(text),
        isWhite: nodeIds.some((id) => WHITE_OUTPUT_NODE_IDS.has(id)) || /white|add_background.*white|background.*white|白底/i.test(text),
      });
    }

    Object.entries(value).forEach(([key, child]) => {
      if (key === "apiKey") return;
      visit(child, path ? `${path}.${key}` : key, nodeIds);
    });
  }

  visit(root);
  return candidates;
}

function getOutputFileUrl(item) {
  return item?.fileUrl || item?.file_url || item?.url || item?.imageUrl || item?.image_url || "";
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

function isImageOutput(item, fileUrl) {
  const text = `${fileUrl} ${item?.contentType || item?.content_type || item?.mime || item?.mimeType || ""}`.toLowerCase();
  return /^https?:\/\//i.test(fileUrl) && (/image\//i.test(text) || /\.(png|jpe?g|webp)(?:[?#]|$)/i.test(fileUrl));
}

function scoreOutputCandidate(candidate, outputNodeId) {
  const { item, fileUrl, nodeIds } = candidate;
  const text = `${fileUrl} ${JSON.stringify(item)}`.toLowerCase();
  let score = 0;

  candidate.excluded = !candidate.isImage || candidate.isMask || candidate.isWhite;
  if (candidate.excluded) return -1000;
  if (outputNodeId && nodeIds.includes(String(outputNodeId))) score += 180;
  if (nodeIds.some((id) => TRANSPARENT_OUTPUT_NODE_IDS.has(id))) score += 140;
  if (/\.png(?:[?#]|$)/i.test(fileUrl) || /image\/png/i.test(text)) score += 30;
  if (/rembg|removebg|transparent|alpha|none|png/i.test(text)) score += 20;

  return score;
}

function toCandidateLog(candidate) {
  return {
    nodeIds: candidate.nodeIds,
    fileUrl: candidate.fileUrl,
    path: candidate.path,
    score: candidate.score,
    excluded: candidate.excluded,
    isPng: candidate.isPng,
    isMask: candidate.isMask,
    isWhite: candidate.isWhite,
  };
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

function stageError(stage, message, detail = "", status = 500, raw = undefined) {
  const error = new Error(message);
  error.stage = stage;
  error.detail = detail;
  error.status = status;
  error.raw = raw;
  console.error("[RunningHub RemoveBG Worker]", { stage, message, detail, raw: summarizeRaw(raw) });
  return error;
}

function errorResponse(stage, message, detail, status = 500, raw = undefined) {
  console.error("[RunningHub RemoveBG Worker error_response]", { stage, message, detail, status, raw: summarizeRaw(raw) });
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
  console.log("[RunningHub RemoveBG Worker]", { stage, ...detail });
}
