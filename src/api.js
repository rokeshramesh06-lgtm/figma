import { buildServerUrl } from "./config.js";

export async function apiRequest(path, options = {}) {
  const { token, method = "GET", body, headers = {} } = options;
  let response;
  const requestUrl = buildServerUrl(path);

  if (!requestUrl) {
    throw new Error("This deployment is not connected to its shared chat backend yet.");
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
    throw new Error(
      `Cannot reach the chat server at ${requestUrl}. Check the deployment's shared backend configuration.`,
    );
  }

  const payload = await response
    .json()
    .catch(() => ({ error: "Unexpected response from the server." }));

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `The configured chat backend at ${requestUrl} returned 404. Check the deployment's shared backend configuration.`,
      );
    }

    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}
