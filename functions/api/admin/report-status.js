import { cleanup } from "../../_lib/cleanup.js";
import { readJson } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";
import { recordApiRequest } from "../../_lib/usage.js";

const allowedStatuses = ["under_review", "done"];

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

  if (!payload.report_id || !allowedStatuses.includes(payload.status)) {
    return fail(400, "Invalid status.");
  }

  const report = await env.DB.prepare("SELECT status FROM reports WHERE report_id = ?")
    .bind(payload.report_id)
    .first();

  if (!report) {
    return fail(404, "Report not found.");
  }

  if (report.status === payload.status) {
    return ok({ no_change: true });
  }

  const now = Math.floor(Date.now() / 1000);
  let query = "UPDATE reports SET status = ? WHERE report_id = ?";
  let params = [payload.status, payload.report_id];

  if (payload.status === "under_review") {
    query = "UPDATE reports SET status = ?, seen_at = ? WHERE report_id = ?";
    params = [payload.status, now, payload.report_id];
  }
  if (payload.status === "done") {
    query = "UPDATE reports SET status = ?, done_at = ? WHERE report_id = ?";
    params = [payload.status, now, payload.report_id];
  }

  await env.DB.prepare(query).bind(...params).run();

  return ok();
}
