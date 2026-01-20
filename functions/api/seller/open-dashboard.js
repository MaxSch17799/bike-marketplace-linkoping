import { cleanup } from "../../_lib/cleanup.js";
import { TTL } from "../../_lib/constants.js";
import { getIpContext, isBlocked } from "../../_lib/blocklist.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { findSellerByToken } from "../../_lib/sellers.js";
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

  const seller = await findSellerByToken(env, payload.seller_token);
  if (!seller) {
    return fail(401, "Invalid seller token.");
  }

  const now = Math.floor(Date.now() / 1000);
  let extensionApplied = false;
  if (!seller.last_login_at || now - seller.last_login_at >= 86400) {
    const extendBy = TTL.extendDays * 86400;
    await env.DB.prepare(
      "UPDATE listings SET expires_at = expires_at + ? WHERE seller_id = ? AND status = 'active' AND expires_at >= ?"
    )
      .bind(extendBy, seller.seller_id, now)
      .run();
    await env.DB.prepare("UPDATE sellers SET last_login_at = ? WHERE seller_id = ?")
      .bind(now, seller.seller_id)
      .run();
    extensionApplied = true;
  }

  const listingsResult = await env.DB.prepare(
    "SELECT listing_id, price_sek, brand, type, condition, wheel_size_in, features_json, faults_json, location, contact_mode, public_email, public_phone, created_at, expires_at, status FROM listings WHERE seller_id = ? ORDER BY created_at DESC"
  )
    .bind(seller.seller_id)
    .all();

  const contactsResult = await env.DB.prepare(
    "SELECT buyer_contacts.contact_id, buyer_contacts.listing_id, buyer_contacts.created_at, buyer_contacts.buyer_email, buyer_contacts.buyer_phone, buyer_contacts.buyer_phone_methods_json, buyer_contacts.message FROM buyer_contacts JOIN listings ON buyer_contacts.listing_id = listings.listing_id WHERE listings.seller_id = ? ORDER BY buyer_contacts.created_at DESC"
  )
    .bind(seller.seller_id)
    .all();

  const contacts = (contactsResult.results || []).map((contact) => ({
    ...contact,
    buyer_phone_methods: parseJsonArray(contact.buyer_phone_methods_json)
  }));

  return ok({
    extension_applied: extensionApplied,
    listings: listingsResult.results || [],
    contacts
  });
}
