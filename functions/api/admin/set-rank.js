import { cleanup } from "../../_lib/cleanup.js";
import { buildPublicSnapshot } from "../../_lib/snapshot.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";

export async function onRequestPost({ request, env }) {
  await cleanup(env);

  if (!isAdminRequest(request, env)) {
    return fail(403, "Forbidden.");
  }

  const payloadResult = await readJson(request);
  if (!payloadResult.ok) {
    return fail(400, payloadResult.error);
  }
  const payload = payloadResult.value;

  if (payload.rank === undefined || payload.listing_id === undefined) {
    return fail(400, "Missing rank or listing id.");
  }

  const rankValue = Number(payload.rank);
  if (!Number.isFinite(rankValue)) {
    return fail(400, "Invalid rank.");
  }

  const result = await env.DB.prepare("UPDATE listings SET rank = ? WHERE listing_id = ?")
    .bind(rankValue, payload.listing_id)
    .run();

  if (!result.changes) {
    return fail(404, "Listing not found.");
  }

  await buildPublicSnapshot(env);

  return ok();
}
