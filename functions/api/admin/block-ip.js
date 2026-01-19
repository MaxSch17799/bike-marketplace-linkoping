import { cleanup } from "../../_lib/cleanup.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { hashIp, isAdminRequest } from "../../_lib/security.js";
import { recordApiRequest } from "../../_lib/usage.js";

export async function onRequestPost({ request, env }) {
  await recordApiRequest(env);
  await cleanup(env);

  if (!isAdminRequest(request, env)) {
    return fail(403, "Forbidden.");
  }

  const payloadResult = await readJson(request);
  if (!payloadResult.ok) {
    return fail(400, payloadResult.error);
  }
  const payload = payloadResult.value;

  let ipHash = payload.ip_hash;
  if (!ipHash && payload.ip) {
    ipHash = await hashIp(payload.ip, env.IP_HASH_SALT);
  }

  if (!ipHash) {
    return fail(400, "IP hash required.");
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO blocked_ips (ip_hash, created_at, reason) VALUES (?, ?, ?)"
  )
    .bind(ipHash, now, payload.reason || null)
    .run();

  return ok();
}
