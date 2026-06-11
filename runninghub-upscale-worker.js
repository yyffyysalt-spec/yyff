const RUNNINGHUB_BASE_URL = "https://www.runninghub.ai";
const DEFAULT_WORKFLOW_ID = "1962513607676309506";
const MAX_FILE_SIZE = 3 * 1024 * 1024;
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
      return await handleUpscale(request, env);
    } catch (error) {
      return errorResponse(
        error.stage || "config",
        error.message || "RunningHub 高清增强失败",
        error.detail || "",
        error.status || 500,
      );
    }
  },
};

async function handleUpscale(request, env) {
  logStage("received_request", { method: request.method });
  const config = validateConfig(env);
  const { apiKey, workflowId, imageNodeId, imageFieldName } = config;
  const form = await request.formData();
  const image = form.get("image") || form.get("file");
  const scale = Number(form.get("scale") || 2);

  if (!(image instanceof File)) {
    throw stageError("config", "请上传需要高清增强的图片", "表单字段 image 或 file 不是文件。", 400);
  }
  if (image.size > MAX_FILE_SIZE) {
    throw stageError("config", "图片超过 3MB，请先压缩后再使用 AI 高清增强", `当前大小：${image.size} bytes`, 413);
  }
  if (![2, 4].includes(scale)) {
    throw stageError("config", "RunningHub 高清增强仅支持 2x 或 4x", `收到的 scale：${scale}`, 400);
  }

  logStage("upload_resource_start", { fileSize: image.size, fileType: image.type || "unknown", scale });
  const uploadedFilename = await uploadResource(image, apiKey);
  logStage("upload_resource_done", { filename: uploadedFilename });

  logStage("create_task_start", {
    workflowId,
    imageNodeId,
    imageFieldName,
    hasScaleNode: Boolean(env.RUNNINGHUB_SCALE_NODE_ID && env.RUNNINGHUB_SCALE_FIELD_NAME),
  });
  const taskId = await createTask({
    apiKey,
    workflowId,
    imageNodeId,
    imageFieldName,
    uploadedFilename,
    scale,
    env,
  });
  logStage("create_task_done", { taskId });

  logStage("poll_task_start", { taskId });
  const fileUrl = await waitForOutput(apiKey, taskId);
  logStage("output_found", { taskId, hasFileUrl: Boolean(fileUrl) });

  const output = await fetch(fileUrl);
  if (!output.ok) {
    throw stageError("download_result", "RunningHub 输出图片下载失败", `HTTP ${output.status} ${output.statusText}`, 502);
  }
  logStage("download_result_done", {
    status: output.status,
    contentType: output.headers.get("Content-Type") || "unknown",
  });

  return new Response(output.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": output.headers.get("Content-Type") || "image/png",
      "Cache-Control": "no-store",
    },
  });
}

function validateConfig(env) {
  const apiKey = env.RUNNINGHUB_API_KEY;
  const workflowId = env.RUNNINGHUB_WORKFLOW_ID;
  const imageNodeId = env.RUNNINGHUB_IMAGE_NODE_ID;
  const imageFieldName = env.RUNNINGHUB_IMAGE_FIELD_NAME;

  if (!apiKey) throw stageError("config", "RunningHub API Key 缺失", "请在 Cloudflare Worker 环境变量中配置 RUNNINGHUB_API_KEY。");
  if (!workflowId) {
    throw stageError(
      "config",
      "RunningHub workflowId 缺失",
      `请配置 RUNNINGHUB_WORKFLOW_ID，当前工作流应为 ${DEFAULT_WORKFLOW_ID}。`,
    );
  }
  if (!imageNodeId) {
    throw stageError("config", "RunningHub image node 未配置", "请从 RunningHub API JSON 或 API 详情页确认 RUNNINGHUB_IMAGE_NODE_ID。");
  }
  if (!imageFieldName) {
    throw stageError("config", "RunningHub image field 未配置", "请配置 RUNNINGHUB_IMAGE_FIELD_NAME，通常为 image。");
  }

  return { apiKey, workflowId, imageNodeId, imageFieldName };
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

async function createTask({ apiKey, workflowId, imageNodeId, imageFieldName, uploadedFilename, scale, env }) {
  const nodeInfoList = [
    {
      nodeId: String(imageNodeId),
      fieldName: imageFieldName,
      fieldValue: uploadedFilename,
    },
  ];

  if (env.RUNNINGHUB_SCALE_NODE_ID && env.RUNNINGHUB_SCALE_FIELD_NAME) {
    nodeInfoList.push({
      nodeId: String(env.RUNNINGHUB_SCALE_NODE_ID),
      fieldName: env.RUNNINGHUB_SCALE_FIELD_NAME,
      fieldValue: String(scale),
    });
  }

  const response = await fetch(`${RUNNINGHUB_BASE_URL}/task/openapi/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey,
      workflowId,
      nodeInfoList,
      addMetadata: false,
    }),
  });
  const data = await readRunningHubJson(response, "create_task", "RunningHub 创建任务失败");
  const taskId = data?.data?.taskId || data?.data?.task_id || data?.data?.id;

  if (!taskId) throw stageError("create_task", "RunningHub 创建任务成功但没有返回 taskId", summarizeData(data));
  return taskId;
}

async function waitForOutput(apiKey, taskId) {
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
    const fileUrl = extractFileUrl(data);

    if (fileUrl) return fileUrl;
    if (hasOutputWithoutFileUrl(data)) {
      throw stageError("fetch_output", "RunningHub 没有返回输出图片", summarizeData(data), 502);
    }
    if (isRunningHubFailure(data)) {
      throw stageError("poll_task", getRunningHubMessage(data) || "RunningHub 任务失败", summarizeData(data), 502);
    }
  }

  throw stageError("poll_task", "RunningHub 任务超时", `轮询 ${POLL_ATTEMPTS} 次仍未拿到 fileUrl。`, 504);
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

function extractFileUrl(data) {
  const output = Array.isArray(data?.data) ? data.data : [];
  const file = output.find((item) => item?.fileUrl || item?.url);
  return file?.fileUrl || file?.url || "";
}

function isRunningHubFailure(data) {
  if (isRunningHubSuccess(data)) return false;
  const message = getRunningHubMessage(data);
  return !/running|processing|queue|pending|not.*finish|排队|运行|处理中|未完成/i.test(message);
}

function hasOutputWithoutFileUrl(data) {
  return Array.isArray(data?.data) && data.data.length > 0 && !extractFileUrl(data);
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
  console.error("[RunningHub Worker]", { stage, message, detail });
  return error;
}

function errorResponse(stage, message, detail = "", status = 500) {
  console.error("[RunningHub Worker error_response]", { stage, message, detail, status });
  return jsonResponse(
    {
      ok: false,
      stage,
      message,
      detail,
    },
    status,
  );
}

function logStage(stage, detail = {}) {
  console.log("[RunningHub Worker]", { stage, ...detail });
}

function summarizeData(data) {
  try {
    return JSON.stringify(data).slice(0, 1200);
  } catch (error) {
    return String(data);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
