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
  try {
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
      return ok({ already_deleted: true });
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

    let deleted = false;
    try {
      await env.DB.prepare("DELETE FROM buyer_contacts WHERE listing_id = ?")
        .bind(listing.listing_id)
        .run();
      await env.DB.prepare("DELETE FROM listings WHERE listing_id = ?")
        .bind(listing.listing_id)
        .run();
      deleted = true;
    } catch (error) {
      await env.DB.prepare(
        "UPDATE listings SET status = 'deleted', image_keys_json = '[]', image_sizes_json = '[]' WHERE listing_id = ?"
      )
        .bind(listing.listing_id)
        .run();
    }

    try {
      await buildPublicSnapshot(env);
    } catch (error) {
      return ok({ deleted, snapshot_failed: true });
    }

    return ok({ deleted });
  } catch (error) {
    return fail(500, "Delete failed. Try again.");
  }
}
