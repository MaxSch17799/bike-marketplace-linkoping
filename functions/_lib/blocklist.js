import { getClientIp, hashIp } from "./security.js";

export async function getIpContext(request, env) {
  const ip = getClientIp(request);
  const ipHash = ip ? await hashIp(ip, env.IP_HASH_SALT) : null;
  return { ip, ipHash };
}

export async function isBlocked(env, ipHash) {
  if (!ipHash) {
    return false;
  }
  const row = await env.DB.prepare("SELECT ip_hash FROM blocked_ips WHERE ip_hash = ?")
    .bind(ipHash)
    .first();
  return Boolean(row);
}
