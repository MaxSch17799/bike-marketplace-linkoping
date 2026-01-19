import { cleanup } from "../../_lib/cleanup.js";
import { buildPublicSnapshot } from "../../_lib/snapshot.js";
import { getIpContext, isBlocked } from "../../_lib/blocklist.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { findSellerByToken } from "../../_lib/sellers.js";
import { validatePriceUpdate } from "../../_lib/validation.js";
import { enforceUsageLimits, recordApiRequest } from "../../_lib/usage.js";

export async function onRequestPost({ request, env }) {
  await recordApiRequest(env);
  await cleanup(env);

  const payloadResult = await readJson(request);
  if (!payloadResult.ok) {
    return fail(400, payloadResult.error);
  }
  const payload = payloadResult.value;

  const { ipHash } = await getIpContext(request, env);
  if (await isBlocked(env, ipHash)) {
    return fail(403, "Blocked.");
  }

  const limitCheck = await enforceUsageLimits(env);
  if (!limitCheck.ok) {
    return fail(429, limitCheck.error);
  }

  const validation = validatePriceUpdate(payload);
  if (!validation.ok) {
    return fail(400, validation.error);
  }

  const seller = await findSellerByToken(env, payload.seller_token);
  if (!seller) {
    return fail(401, "Invalid seller token.");
  }

  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    "UPDATE listings SET price_sek = ? WHERE listing_id = ? AND seller_id = ? AND status = 'active' AND expires_at >= ?"
  )
    .bind(validation.value.new_price, payload.listing_id, seller.seller_id, now)
    .run();

  if (!result.changes) {
    return fail(404, "Listing not found.");
  }

  await buildPublicSnapshot(env);

  return ok();
}
