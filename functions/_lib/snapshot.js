import { recordClassA, setSnapshotBytes } from "./usage.js";

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

function buildImageUrls(baseUrl, keys) {
  if (!keys.length) {
    return [];
  }
  if (!baseUrl) {
    return keys;
  }
  const cleanBase = baseUrl.replace(/\/$/, "");
  return keys.map((key) => `${cleanBase}/${key}`);
}

export async function buildPublicSnapshot(env) {
  const now = nowSeconds();
  const result = await env.DB.prepare(
    "SELECT listing_id, created_at, expires_at, rank, price_sek, brand, type, condition, wheel_size_in, features_json, faults_json, location, description, delivery_possible, delivery_price_sek, contact_mode, public_email, public_phone, image_keys_json FROM listings WHERE status = 'active' AND expires_at >= ?"
  )
    .bind(now)
    .all();

  const baseUrl = env.PUBLIC_R2_BASE_URL || "";
  const listings = (result.results || []).map((row) => {
    const images = parseJsonArray(row.image_keys_json);
    const features = parseJsonArray(row.features_json);
    const faults = parseJsonArray(row.faults_json);
    return {
      listing_id: row.listing_id,
      created_at: row.created_at,
      expires_at: row.expires_at,
      rank: row.rank,
      price_sek: row.price_sek,
      brand: row.brand,
      type: row.type,
      condition: row.condition,
      wheel_size_in: row.wheel_size_in,
      features,
      faults,
      location: row.location,
      description: row.description,
      delivery_possible: row.delivery_possible ? 1 : 0,
      delivery_price_sek: row.delivery_price_sek,
      contact_mode: row.contact_mode,
      public_email: row.contact_mode === "public_contact" ? row.public_email : null,
      public_phone: row.contact_mode === "public_contact" ? row.public_phone : null,
      image_urls: buildImageUrls(baseUrl, images)
    };
  });

  const payload = JSON.stringify({ generated_at: now, listings });
  const payloadBytes = new TextEncoder().encode(payload).length;
  await env.PUBLIC_BUCKET.put("snapshots/listings.json", payload, {
    httpMetadata: {
      contentType: "application/json",
      cacheControl: "public, max-age=60"
    }
  });
  await recordClassA(env, 1);
  await setSnapshotBytes(env, payloadBytes);
}
