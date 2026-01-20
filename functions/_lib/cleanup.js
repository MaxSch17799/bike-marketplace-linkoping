import { TTL } from "./constants.js";
import { adjustStorageBytes, recordClassA } from "./usage.js";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

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

function sumNumberArray(values) {
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
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

async function deleteListingImages(env, imageKeys, imageSizes) {
  const keysToDelete = normalizeImageKeys(imageKeys);
  if (!keysToDelete.length) {
    return;
  }
  try {
    await env.PUBLIC_BUCKET.delete(keysToDelete);
    await recordClassA(env, keysToDelete.length);
    const totalBytes = sumNumberArray(imageSizes);
    if (totalBytes > 0) {
      await adjustStorageBytes(env, -totalBytes);
    }
  } catch (error) {
    // Ignore storage deletion errors so DB cleanup can continue.
  }
}

async function expireListings(env, now) {
  const expired = await env.DB.prepare(
    "SELECT listing_id, image_keys_json, image_sizes_json FROM listings WHERE status = 'active' AND expires_at < ?"
  )
    .bind(now)
    .all();

  for (const listing of expired.results || []) {
    const imageKeys = parseJsonArray(listing.image_keys_json);
    const imageSizes = parseJsonArray(listing.image_sizes_json);
    if (imageKeys.length) {
      await deleteListingImages(env, imageKeys, imageSizes);
    }
    await env.DB.prepare(
      "UPDATE listings SET status = 'expired', image_keys_json = '[]', image_sizes_json = '[]' WHERE listing_id = ?"
    )
      .bind(listing.listing_id)
      .run();
  }
}

async function deleteExpiredListings(env, now) {
  const cutoff = now - TTL.expiredRetentionDays * 86400;
  const expired = await env.DB.prepare(
    "SELECT listing_id FROM listings WHERE status = 'expired' AND expires_at < ?"
  )
    .bind(cutoff)
    .all();

  for (const listing of expired.results || []) {
    await env.DB.prepare("DELETE FROM buyer_contacts WHERE listing_id = ?")
      .bind(listing.listing_id)
      .run();
    await env.DB.prepare("DELETE FROM listings WHERE listing_id = ?")
      .bind(listing.listing_id)
      .run();
  }
}

async function deleteExpiredContacts(env, now) {
  await env.DB.prepare("DELETE FROM buyer_contacts WHERE expires_at < ?")
    .bind(now)
    .run();
}

async function scrubOldIpHashes(env, now) {
  const cutoff = now - TTL.ipHashDays * 86400;
  await env.DB.prepare(
    "UPDATE listings SET ip_hash = NULL, ip_stored_at = NULL WHERE ip_stored_at < ?"
  )
    .bind(cutoff)
    .run();
  await env.DB.prepare(
    "UPDATE buyer_contacts SET ip_hash = NULL, ip_stored_at = NULL WHERE ip_stored_at < ?"
  )
    .bind(cutoff)
    .run();
  await env.DB.prepare(
    "UPDATE reports SET ip_hash = NULL, ip_stored_at = NULL WHERE ip_stored_at < ?"
  )
    .bind(cutoff)
    .run();
}

async function deleteOldReports(env, now) {
  const cutoff = now - TTL.reportDays * 86400;
  await env.DB.prepare("DELETE FROM reports WHERE created_at < ?")
    .bind(cutoff)
    .run();
}

export async function cleanup(env) {
  const now = nowSeconds();
  await expireListings(env, now);
  await deleteExpiredListings(env, now);
  await deleteExpiredContacts(env, now);
  await scrubOldIpHashes(env, now);
  await deleteOldReports(env, now);
}
