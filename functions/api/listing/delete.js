import { cleanup } from "../../_lib/cleanup.js";
import { buildPublicSnapshot } from "../../_lib/snapshot.js";
import { getIpContext, isBlocked } from "../../_lib/blocklist.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { findSellerByToken } from "../../_lib/sellers.js";

function parseJsonArray(value) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export async function onRequestPost({ request, env }) {
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

  const seller = await findSellerByToken(env, payload.seller_token);
  if (!seller) {
    return fail(401, "Invalid seller token.");
  }

  const listing = await env.DB.prepare(
    "SELECT listing_id, image_keys_json FROM listings WHERE listing_id = ? AND seller_id = ?"
  )
    .bind(payload.listing_id, seller.seller_id)
    .first();

  if (!listing) {
    return fail(404, "Listing not found.");
  }

  const imageKeys = parseJsonArray(listing.image_keys_json);
  if (imageKeys.length) {
    await env.PUBLIC_BUCKET.delete(imageKeys);
  }

  await env.DB.prepare("DELETE FROM buyer_contacts WHERE listing_id = ?")
    .bind(listing.listing_id)
    .run();
  await env.DB.prepare("DELETE FROM listings WHERE listing_id = ?")
    .bind(listing.listing_id)
    .run();

  await buildPublicSnapshot(env);

  return ok();
}
