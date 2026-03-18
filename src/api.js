export async function apiRequest(path, options = {}) {
  const { token, method = "GET", body, headers = {} } = options;

  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response
    .json()
    .catch(() => ({ error: "Unexpected response from the server." }));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

