import { cleanup } from "../../_lib/cleanup.js";
import { TTL } from "../../_lib/constants.js";
import { getIpContext, isBlocked } from "../../_lib/blocklist.js";
import { readForm } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { verifyTurnstile } from "../../_lib/turnstile.js";
import { validateBuyerContact } from "../../_lib/validation.js";

export async function onRequestPost({ request, env }) {
  await cleanup(env);

  const formResult = await readForm(request);
  if (!formResult.ok) {
    return fail(400, formResult.error);
  }
  const formData = formResult.value;

  const { ip, ipHash } = await getIpContext(request, env);
  if (await isBlocked(env, ipHash)) {
    return fail(403, "Blocked.");
  }

  const turnstileToken = formData.get("cf_turnstile_response");
  const turnstileOk = await verifyTurnstile(turnstileToken, env, ip);
  if (!turnstileOk) {
    return fail(400, "Turnstile verification failed.");
  }

  const listingId = formData.get("listing_id");
  if (!listingId) {
    return fail(400, "Listing id is required.");
  }

  const validation = validateBuyerContact({
    buyer_email: formData.get("buyer_email"),
    buyer_phone: formData.get("buyer_phone"),
    message: formData.get("message")
  });
  if (!validation.ok) {
    return fail(400, validation.error);
  }

  const now = Math.floor(Date.now() / 1000);
  const listing = await env.DB.prepare(
    "SELECT listing_id, contact_mode, expires_at, status FROM listings WHERE listing_id = ?"
  )
    .bind(listingId)
    .first();
  if (!listing || listing.status !== "active" || listing.expires_at < now) {
    return fail(404, "Listing not available.");
  }
  if (listing.contact_mode !== "buyer_message") {
    return fail(400, "Listing does not accept buyer messages.");
  }

  const contactId = crypto.randomUUID();
  const expiresAt = now + TTL.contactDays * 86400;

  await env.DB.prepare(
    "INSERT INTO buyer_contacts (contact_id, listing_id, created_at, expires_at, buyer_email, buyer_phone, message, ip_hash, ip_stored_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      contactId,
      listingId,
      now,
      expiresAt,
      validation.value.buyer_email,
      validation.value.buyer_phone,
      validation.value.message,
      ipHash,
      ipHash ? now : null
    )
    .run();

  return ok();
}
