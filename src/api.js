import { buildServerUrl } from "./config.js";

export async function apiRequest(path, options = {}) {
  const { token, method = "GET", body, headers = {} } = options;
  let response;

  try {
    response = await fetch(buildServerUrl(path), {
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
      "Cannot reach the chat server. Start the backend on http://127.0.0.1:3001 or set VITE_SERVER_ORIGIN to your deployed API.",
    );
  }

  const payload = await response
    .json()
    .catch(() => ({ error: "Unexpected response from the server." }));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}
