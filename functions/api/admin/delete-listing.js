import { cleanup } from "../../_lib/cleanup.js";
import { buildPublicSnapshot } from "../../_lib/snapshot.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";
import { adjustStorageBytes, recordApiRequest, recordClassA } from "../../_lib/usage.js";

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

  const listing = await env.DB.prepare(
    "SELECT listing_id, image_keys_json, image_sizes_json FROM listings WHERE listing_id = ?"
  )
    .bind(payload.listing_id)
    .first();

  if (!listing) {
    return fail(404, "Listing not found.");
  }

  const imageKeys = parseJsonArray(listing.image_keys_json);
  const imageSizes = parseJsonArray(listing.image_sizes_json);
  if (imageKeys.length) {
    await env.PUBLIC_BUCKET.delete(imageKeys);
    await recordClassA(env, imageKeys.length);
    const totalBytes = imageSizes.reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (totalBytes > 0) {
      await adjustStorageBytes(env, -totalBytes);
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
