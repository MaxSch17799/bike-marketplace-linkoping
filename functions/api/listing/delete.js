import { cleanup } from "../../_lib/cleanup.js";
import { buildPublicSnapshot } from "../../_lib/snapshot.js";
import { getIpContext, isBlocked } from "../../_lib/blocklist.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { findSellerByToken } from "../../_lib/sellers.js";
import { adjustStorageBytes, enforceUsageLimits, recordApiRequest, recordClassA } from "../../_lib/usage.js";

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

function normalizeImageKey(value) {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const path = url.pathname.replace(/^\/+/, "");
      return path || null;
    } catch (error) {
      return null;
    }
  }
  return trimmed.replace(/^\/+/, "");
}

function normalizeImageKeys(keys) {
  return (keys || []).map(normalizeImageKey).filter(Boolean);
}

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

  const seller = await findSellerByToken(env, payload.seller_token);
  if (!seller) {
    return fail(401, "Invalid seller token.");
  }

  const listing = await env.DB.prepare(
    "SELECT listing_id, image_keys_json, image_sizes_json FROM listings WHERE listing_id = ? AND seller_id = ?"
  )
    .bind(payload.listing_id, seller.seller_id)
    .first();

  if (!listing) {
    return fail(404, "Listing not found.");
  }

  const imageKeys = parseJsonArray(listing.image_keys_json);
  const imageSizes = parseJsonArray(listing.image_sizes_json);
  const keysToDelete = normalizeImageKeys(imageKeys);
  if (keysToDelete.length) {
    try {
      await env.PUBLIC_BUCKET.delete(keysToDelete);
      await recordClassA(env, keysToDelete.length);
      const totalBytes = imageSizes.reduce((sum, value) => sum + (Number(value) || 0), 0);
      if (totalBytes > 0) {
        await adjustStorageBytes(env, -totalBytes);
      }
    } catch (error) {
      // Ignore storage deletion errors so DB cleanup can continue.
    }
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
