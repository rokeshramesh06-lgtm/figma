import { buildServerUrl } from "./config.js";

export async function apiRequest(path, options = {}) {
  const { token, method = "GET", body, headers = {} } = options;
  let response;
  const requestUrl = buildServerUrl(path);

  if (!requestUrl) {
    throw new Error("Set the backend URL on the sign-in screen before making requests.");
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
      `Cannot reach the chat server at ${requestUrl}. Start the backend there, or update the backend URL on the sign-in screen.`,
    );
  }

  const payload = await response
    .json()
    .catch(() => ({ error: "Unexpected response from the server." }));

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `The server at ${requestUrl} returned 404. Check the backend URL on the sign-in screen, or make sure the backend is running there.`,
      );
    }

    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}
