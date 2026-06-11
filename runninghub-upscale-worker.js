const RUNNINGHUB_BASE_URL = "https://www.runninghub.ai";
const DEFAULT_WORKFLOW_ID = "1962513607676309506";
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const POLL_INTERVAL_MS = 2500;
const POLL_ATTEMPTS = 40;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "POST") return jsonResponse({ message: "Method not allowed" }, 405);

    try {
      return await handleUpscale(request, env);
    } catch (error) {
      return jsonResponse({ message: error.message || "RunningHub 高清增强失败" }, 500);
    }
  },
};

async function handleUpscale(request, env) {
  const apiKey = env.RUNNINGHUB_API_KEY;
  const workflowId = env.RUNNINGHUB_WORKFLOW_ID || DEFAULT_WORKFLOW_ID;
  const imageNodeId = env.RUNNINGHUB_IMAGE_NODE_ID;
  const imageFieldName = env.RUNNINGHUB_IMAGE_FIELD_NAME || "image";

  if (!apiKey) throw new Error("RunningHub API Key 未配置");
  if (!imageNodeId) throw new Error("RunningHub 图片输入节点未配置");

  const form = await request.formData();
  const image = form.get("image") || form.get("file");
  const scale = Number(form.get("scale") || 2);

  if (!(image instanceof File)) throw new Error("请上传需要高清增强的图片");
  if (image.size > MAX_FILE_SIZE) throw new Error("图片超过 3MB，请先压缩后再使用 AI 高清增强");
  if (![2, 4].includes(scale)) throw new Error("RunningHub 高清增强仅支持 2x 或 4x");

  const uploadedFilename = await uploadResource(image, apiKey);
  const taskId = await createTask({
    apiKey,
    workflowId,
    imageNodeId,
    imageFieldName,
    uploadedFilename,
    scale,
    env,
  });
  const fileUrl = await waitForOutput(apiKey, taskId);
  const output = await fetch(fileUrl);

  if (!output.ok) throw new Error("RunningHub 输出图片下载失败");

  return new Response(output.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": output.headers.get("Content-Type") || "image/png",
      "Cache-Control": "no-store",
    },
  });
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
  const data = await readRunningHubJson(response);
  const filename = data?.data?.filename || data?.data?.fileName || data?.data?.name;

  if (!filename) throw new Error("RunningHub 上传成功但没有返回资源文件名");
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
  const data = await readRunningHubJson(response);
  const taskId = data?.data?.taskId || data?.data?.task_id || data?.data?.id;

  if (!taskId) throw new Error("RunningHub 任务创建成功但没有返回 taskId");
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
    const data = await safeRunningHubJson(response);
    const fileUrl = extractFileUrl(data);

    if (fileUrl) return fileUrl;
    if (isRunningHubFailure(data)) throw new Error(getRunningHubMessage(data) || "RunningHub 任务失败");
  }

  throw new Error("RunningHub 任务超时，请稍后重试");
}

async function readRunningHubJson(response) {
  const data = await safeRunningHubJson(response);
  if (!response.ok || !isRunningHubSuccess(data)) {
    throw new Error(getRunningHubMessage(data) || "RunningHub 请求失败");
  }
  return data;
}

async function safeRunningHubJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!response.ok) throw new Error(text || "RunningHub 请求失败");
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

function isRunningHubSuccess(data) {
  return data?.code === undefined || data.code === 0 || data.code === 200;
}

function getRunningHubMessage(data) {
  return data?.msg || data?.message || data?.error || "";
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
