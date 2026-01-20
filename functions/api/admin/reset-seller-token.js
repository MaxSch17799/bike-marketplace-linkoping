import { cleanup } from "../../_lib/cleanup.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";
import { resetSellerToken } from "../../_lib/sellers.js";
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

  let sellerId = payload.seller_id;
  if (!sellerId && payload.listing_id) {
    const listing = await env.DB.prepare("SELECT seller_id FROM listings WHERE listing_id = ?")
      .bind(payload.listing_id)
      .first();
    sellerId = listing?.seller_id || null;
  }

  if (!sellerId) {
    return fail(400, "seller_id or listing_id required.");
  }

  const result = await resetSellerToken(env, sellerId);
  if (!result) {
    return fail(404, "Seller not found.");
  }

  return ok({ seller_id: result.seller_id, seller_token: result.seller_token });
}
