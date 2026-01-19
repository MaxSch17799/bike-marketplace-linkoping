const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashWithSalt(value, salt) {
  if (!salt) {
    return null;
  }
  const data = encoder.encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

export async function hashToken(token, salt) {
  return hashWithSalt(token, salt);
}

export async function hashIp(ip, salt) {
  return hashWithSalt(ip, salt);
}

export function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
}

export function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    ""
  );
}

export function isAdminRequest(request, env) {
  const adminList = env.ADMIN_EMAILS ? env.ADMIN_EMAILS.split(",").map((item) => item.trim()) : [];
  if (!adminList.length) {
    return true;
  }
  const email =
    request.headers.get("CF-Access-Authenticated-User-Email") ||
    request.headers.get("cf-access-authenticated-user-email") ||
    "";
  return adminList.includes(email);
}
