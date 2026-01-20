import { cleanup } from "../../_lib/cleanup.js";
import { buildPublicSnapshot } from "../../_lib/snapshot.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";
import { recordApiRequest } from "../../_lib/usage.js";

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

  if (!Array.isArray(payload.listing_ids) || !payload.listing_ids.length) {
    return fail(400, "listing_ids array required.");
  }

  const listingIds = Array.from(
    new Set(payload.listing_ids.map((id) => String(id).trim()).filter(Boolean))
  );
  if (!listingIds.length) {
    return fail(400, "listing_ids array required.");
  }

  const total = listingIds.length;
  let changes = 0;
  for (let index = 0; index < total; index += 1) {
    const listingId = listingIds[index];
    const rankValue = total - index;
    const result = await env.DB.prepare("UPDATE listings SET rank = ? WHERE listing_id = ?")
      .bind(rankValue, listingId)
      .run();
    changes += result.changes || 0;
  }

  await buildPublicSnapshot(env);

  return ok({ updated: changes });
}
