const RUNNINGHUB_BASE_URL = "https://www.runninghub.ai";
const DEFAULT_IMAGE_NODE_ID = "3";
const DEFAULT_IMAGE_FIELD_NAME = "image";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const POLL_INTERVAL_MS = 2500;
const POLL_ATTEMPTS = 40;

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
      return await handleRemoveBackground(request, env);
    } catch (error) {
      return errorResponse(
        error.stage || "config",
        error.message || "RunningHub 抠图失败",
        error.detail || "",
        error.status || 500,
      );
    }
  },
};

async function handleRemoveBackground(request, env) {
  logStage("received_request", { method: request.method });
  const config = validateConfig(env);
  const { apiKey, workflowId, imageNodeId, imageFieldName, outputNodeId } = config;
  const form = await request.formData();
  const image = form.get("image") || form.get("file");

  if (!(image instanceof File)) {
    throw stageError("config", "请上传需要抠图的图片", "表单字段 image 或 file 不是文件。", 400);
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
    hasOutputNode: Boolean(outputNodeId),
  });
  const taskId = await createTask({
    apiKey,
    workflowId,
    imageNodeId,
    imageFieldName,
    uploadedFilename,
  });
  logStage("create_task_done", { taskId });

  logStage("poll_task_start", { taskId });
  const fileUrl = await waitForOutput(apiKey, taskId, outputNodeId);
  logStage("output_found", { taskId, hasFileUrl: Boolean(fileUrl) });

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
    },
  });
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

async function waitForOutput(apiKey, taskId, outputNodeId) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(POLL_INTERVAL_MS);

    const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/outputs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ apiKey, taskId }),
    });
    const data = await safeRunningHubJson(response, "poll_task");
    const fileUrl = extractTransparentCutoutUrl(data, outputNodeId);

    if (fileUrl) return fileUrl;
    if (hasOutputWithoutUsableFileUrl(data)) {
      throw stageError("fetch_output", "RunningHub 没有返回透明抠图结果", summarizeData(data), 502);
    }
    if (isRunningHubFailure(data)) {
      throw stageError("poll_task", getRunningHubMessage(data) || "RunningHub 抠图任务失败", summarizeData(data), 502);
    }
  }

  throw stageError("poll_task", "RunningHub 抠图任务超时", `轮询 ${POLL_ATTEMPTS} 次仍未拿到透明抠图输出。`, 504);
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

function extractTransparentCutoutUrl(data, outputNodeId) {
  const outputs = Array.isArray(data?.data) ? data.data : [];
  const candidates = outputs
    .map((item) => {
      const fileUrl = item?.fileUrl || item?.url || "";
      if (!fileUrl) return null;
      return {
        item,
        fileUrl,
        score: scoreOutputCandidate(item, fileUrl, outputNodeId),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return candidates.find((candidate) => candidate.score > -100)?.fileUrl || "";
}

function scoreOutputCandidate(item, fileUrl, outputNodeId) {
  const text = `${fileUrl} ${JSON.stringify(item)}`.toLowerCase();
  let score = 0;

  if (/mask|segmentation|matte/i.test(text)) return -1000;
  if (/white|add_background.*white|background.*white|白底/i.test(text)) return -1000;
  if (outputNodeId && String(item?.nodeId || item?.node_id || item?.id || "") === String(outputNodeId)) score += 120;
  if (/\.png(?:\?|$)/i.test(fileUrl) || /image\/png/i.test(text)) score += 30;
  if (/rembg|removebg|transparent|alpha|none|png/i.test(text)) score += 20;

  return score;
}

function isRunningHubFailure(data) {
  if (isRunningHubSuccess(data)) return false;
  const message = getRunningHubMessage(data);
  return !/running|processing|queue|pending|not.*finish|排队|运行|处理中|未完成/i.test(message);
}

function hasOutputWithoutUsableFileUrl(data) {
  return Array.isArray(data?.data) && data.data.length > 0 && !extractTransparentCutoutUrl(data);
}

function isRunningHubSuccess(data) {
  return data?.code === undefined || data.code === 0 || data.code === 200;
}

function getRunningHubMessage(data) {
  return data?.msg || data?.message || data?.error || "";
}

function stageError(stage, message, detail = "", status = 500) {
  const error = new Error(message);
  error.stage = stage;
  error.detail = detail;
  error.status = status;
  console.error("[RunningHub RemoveBG Worker]", { stage, message, detail });
  return error;
}

function errorResponse(stage, message, detail, status = 500) {
  console.error("[RunningHub RemoveBG Worker error_response]", { stage, message, detail, status });
  return jsonResponse({ ok: false, stage, message, detail }, status);
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

function logStage(stage, detail = {}) {
  console.log("[RunningHub RemoveBG Worker]", { stage, ...detail });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
