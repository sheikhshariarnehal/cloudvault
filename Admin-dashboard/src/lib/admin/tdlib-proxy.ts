import "server-only";

const baseUrl = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const apiKey = process.env.TDLIB_SERVICE_API_KEY;

function buildHeaders() {
  if (!apiKey) {
    throw new Error("Missing TDLIB_SERVICE_API_KEY for admin proxy routes.");
  }

  return {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };
}

export async function tdlibGet(path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: buildHeaders(),
    cache: "no-store",
  });

  const payload = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

export async function tdlibPost(path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    cache: "no-store",
  });

  const payload = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}
