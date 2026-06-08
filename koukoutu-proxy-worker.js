const KOUKOUTU_CREATE_URL = "https://sync.koukoutu.com/v1/create";
const KOUKOUTU_SCORE_URL = "https://async.koukoutu.com/v1/score";

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-API-Key,Authorization",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "*";
    const corsHeaders = {
      ...CORS_HEADERS,
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      if (url.pathname === "/score") {
        return addCorsHeaders(await handleScore(request), corsHeaders);
      }
      if (url.pathname === "/remove-background" || url.pathname === "/") {
        return addCorsHeaders(await handleRemoveBackground(request), corsHeaders);
      }
      return jsonResponse({ message: "Not found" }, 404, corsHeaders);
    } catch (error) {
      return jsonResponse({ message: error.message || "Proxy request failed" }, 500, corsHeaders);
    }
  },
};

async function handleScore(request) {
  const apiKey = getApiKey(request);
  if (!apiKey) return jsonResponse({ message: "Missing X-API-Key" }, 401);

  return fetch(KOUKOUTU_SCORE_URL, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });
}

async function handleRemoveBackground(request) {
  if (request.method !== "POST") return jsonResponse({ message: "Use POST" }, 405);

  const apiKey = getApiKey(request);
  if (!apiKey) return jsonResponse({ message: "Missing X-API-Key" }, 401);

  const formData = await request.formData();
  return fetch(KOUKOUTU_CREATE_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: formData,
  });
}

function getApiKey(request) {
  const headerKey = request.headers.get("X-API-Key");
  if (headerKey) return headerKey.trim();

  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function addCorsHeaders(response, corsHeaders) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}
