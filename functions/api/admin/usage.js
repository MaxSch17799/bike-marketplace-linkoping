import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";
import { getUsageSummary, recordApiRequest } from "../../_lib/usage.js";

export async function onRequestGet({ request, env }) {
  await recordApiRequest(env);
  if (!isAdminRequest(request, env)) {
    return fail(403, "Forbidden.");
  }

  const summary = await getUsageSummary(env);
  return ok(summary);
}
