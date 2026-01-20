import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";
import { recordApiRequest } from "../../_lib/usage.js";

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
  const cleanBase = baseUrl ? baseUrl.replace(/\/$/, "") : "";
  return keys
    .map((key) => {
      if (!key) {
        return null;
      }
      const trimmed = String(key).trim();
      if (!trimmed) {
        return null;
      }
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
      const cleanKey = trimmed.replace(/^\/+/, "");
      if (!cleanBase) {
        return cleanKey;
      }
      return `${cleanBase}/${cleanKey}`;
    })
    .filter(Boolean);
}

export async function onRequestGet({ request, env }) {
  await recordApiRequest(env);
  if (!isAdminRequest(request, env)) {
    return fail(403, "Forbidden.");
  }

  const listingsResult = await env.DB.prepare(
    "SELECT listing_id, seller_id, created_at, expires_at, rank, price_sek, brand, type, condition, wheel_size_in, features_json, faults_json, location, currency_mode, payment_methods_json, description, delivery_possible, delivery_price_sek, contact_mode, public_email, public_phone, public_phone_methods_json, image_keys_json, status, ip_hash FROM listings ORDER BY created_at DESC"
  ).all();

  const baseUrl = env.PUBLIC_R2_BASE_URL || "";
  const listings = (listingsResult.results || []).map((row) => ({
    listing_id: row.listing_id,
    seller_id: row.seller_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    rank: row.rank,
    price_sek: row.price_sek,
    brand: row.brand,
    type: row.type,
    condition: row.condition,
    wheel_size_in: row.wheel_size_in,
    features: parseJsonArray(row.features_json),
    faults: parseJsonArray(row.faults_json),
    location: row.location,
    currency_mode: row.currency_mode,
    payment_methods: parseJsonArray(row.payment_methods_json),
    description: row.description,
    delivery_possible: row.delivery_possible ? 1 : 0,
    delivery_price_sek: row.delivery_price_sek,
    contact_mode: row.contact_mode,
    public_email: row.public_email,
    public_phone: row.public_phone,
    public_phone_methods: parseJsonArray(row.public_phone_methods_json),
    image_urls: buildImageUrls(baseUrl, parseJsonArray(row.image_keys_json)),
    status: row.status,
    ip_hash: row.ip_hash
  }));

  const contactsResult = await env.DB.prepare(
    "SELECT contact_id, listing_id, created_at, buyer_email, buyer_phone, buyer_phone_methods_json, message, ip_hash FROM buyer_contacts ORDER BY created_at DESC"
  ).all();

  const contacts = (contactsResult.results || []).map((contact) => ({
    ...contact,
    buyer_phone_methods: parseJsonArray(contact.buyer_phone_methods_json)
  }));

  const reportsResult = await env.DB.prepare(
    "SELECT report_id, listing_id, created_at, reason, details, status, ip_hash FROM reports ORDER BY created_at DESC"
  ).all();

  return ok({
    listings,
    contacts,
    reports: reportsResult.results || []
  });
}
