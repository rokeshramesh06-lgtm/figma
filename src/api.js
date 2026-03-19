import { buildServerUrl } from "./config.js";

function createApiError(message, status, requestUrl) {
  const error = new Error(message);
  error.status = status;
  error.requestUrl = requestUrl;
  return error;
}

export async function apiRequest(path, options = {}) {
  const { token, method = "GET", body, headers = {} } = options;
  let response;
  const requestUrl = buildServerUrl(path);

  if (!requestUrl) {
    throw createApiError("This deployment is not connected to its shared chat backend yet.", 0, requestUrl);
  }

  try {
    response = await fetch(requestUrl, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw createApiError(
      `Cannot reach the chat server at ${requestUrl}. Check the deployment's shared backend configuration.`,
      0,
      requestUrl,
    );
  }

  const payload = await response
    .json()
    .catch(() => ({ error: "Unexpected response from the server." }));

  if (!response.ok) {
    if (response.status === 404) {
      throw createApiError(
        `The configured chat backend at ${requestUrl} returned 404. Check the deployment's shared backend configuration.`,
        response.status,
        requestUrl,
      );
    }

    throw createApiError(payload.error || "Request failed.", response.status, requestUrl);
  }

  return payload;
}
