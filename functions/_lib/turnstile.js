export async function verifyTurnstile(token, env, remoteIp) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return true;
  }
  if (!token) {
    return false;
  }
  const formData = new URLSearchParams();
  formData.append("secret", env.TURNSTILE_SECRET_KEY);
  formData.append("response", token);
  if (remoteIp) {
    formData.append("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData
  });
  const payload = await response.json();
  return Boolean(payload.success);
}
