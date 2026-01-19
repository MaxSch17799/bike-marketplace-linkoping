import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";
import { getUsageSummary, recordApiRequest, setOverrideEnabled } from "../../_lib/usage.js";

export async function onRequestPost({ request, env }) {
  await recordApiRequest(env);
  if (!isAdminRequest(request, env)) {
    return fail(403, "Forbidden.");
  }

  const payloadResult = await readJson(request);
  if (!payloadResult.ok) {
    return fail(400, payloadResult.error);
  }
  const payload = payloadResult.value;

  if (typeof payload.enabled !== "boolean") {
    return fail(400, "enabled must be true or false.");
  }

  await setOverrideEnabled(env, payload.enabled);
  const summary = await getUsageSummary(env);
  return ok(summary);
}
