import { cleanup } from "../../_lib/cleanup.js";
import { getIpContext, isBlocked } from "../../_lib/blocklist.js";
import { readForm } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { verifyTurnstile } from "../../_lib/turnstile.js";
import { validateReport } from "../../_lib/validation.js";
import { recordApiRequest } from "../../_lib/usage.js";

export async function onRequestPost({ request, env }) {
  await recordApiRequest(env);
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

  const listing = await env.DB.prepare("SELECT listing_id FROM listings WHERE listing_id = ?")
    .bind(listingId)
    .first();
  if (!listing) {
    return fail(404, "Listing not found.");
  }

  const validation = validateReport({
    reason: formData.get("reason"),
    details: formData.get("details")
  });
  if (!validation.ok) {
    return fail(400, validation.error);
  }

  const reportId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    "INSERT INTO reports (report_id, listing_id, created_at, reason, details, status, ip_hash, ip_stored_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)"
  )
    .bind(
      reportId,
      listingId,
      now,
      validation.value.reason,
      validation.value.details,
      ipHash,
      ipHash ? now : null
    )
    .run();

  return ok();
}
