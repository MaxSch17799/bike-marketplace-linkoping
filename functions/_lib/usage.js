import { BYTES_PER_GB, R2_LIMITS, R2_PRICING, USAGE_CUTOFF_FRACTION } from "./constants.js";

const STORAGE_KEY = "storage_bytes";
const SNAPSHOT_KEY = "snapshot_bytes";
const OVERRIDE_KEY = "override_enabled";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getPeriodInfo(now) {
  const date = new Date(now * 1000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const start = Math.floor(Date.UTC(year, month, 1) / 1000);
  const reset = Math.floor(Date.UTC(year, month + 1, 1) / 1000);
  return { key, start, reset };
}

function parseNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

async function ensureMonthlyRow(env, now) {
  const period = getPeriodInfo(now);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO usage_monthly (period_key, period_start, class_a_ops, class_b_ops, api_requests, updated_at) VALUES (?, ?, 0, 0, 0, ?)"
  )
    .bind(period.key, period.start, now)
    .run();
  return period;
}

async function getMonthlyUsage(env, now) {
  const period = await ensureMonthlyRow(env, now);
  const row = await env.DB.prepare(
    "SELECT period_key, period_start, class_a_ops, class_b_ops, api_requests FROM usage_monthly WHERE period_key = ?"
  )
    .bind(period.key)
    .first();
  return {
    period_key: period.key,
    period_start: period.start,
    reset_at: period.reset,
    class_a_ops: parseNumber(row?.class_a_ops),
    class_b_ops: parseNumber(row?.class_b_ops),
    api_requests: parseNumber(row?.api_requests)
  };
}

async function setStateValue(env, key, value) {
  const now = nowSeconds();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO usage_state (key, value, updated_at) VALUES (?, ?, ?)"
  )
    .bind(key, String(value), now)
    .run();
}

async function getStateValue(env, key, defaultValue) {
  const now = nowSeconds();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO usage_state (key, value, updated_at) VALUES (?, ?, ?)"
  )
    .bind(key, String(defaultValue), now)
    .run();
  const row = await env.DB.prepare("SELECT value FROM usage_state WHERE key = ?")
    .bind(key)
    .first();
  return row?.value ?? String(defaultValue);
}

async function incrementMonthly(env, now, { classAOps = 0, classBOps = 0, apiRequests = 0 }) {
  if (!classAOps && !classBOps && !apiRequests) {
    return;
  }
  const period = await ensureMonthlyRow(env, now);
  await env.DB.prepare(
    "UPDATE usage_monthly SET class_a_ops = class_a_ops + ?, class_b_ops = class_b_ops + ?, api_requests = api_requests + ?, updated_at = ? WHERE period_key = ?"
  )
    .bind(classAOps, classBOps, apiRequests, now, period.key)
    .run();
}

export async function recordClassA(env, count = 1) {
  const now = nowSeconds();
  await incrementMonthly(env, now, { classAOps: count });
}

export async function recordClassB(env, count = 1) {
  const now = nowSeconds();
  await incrementMonthly(env, now, { classBOps: count });
}

export async function recordApiRequest(env, count = 1) {
  const now = nowSeconds();
  await incrementMonthly(env, now, { apiRequests: count });
}

export async function getStorageBytes(env) {
  const value = await getStateValue(env, STORAGE_KEY, 0);
  return Math.max(0, parseNumber(value));
}

export async function adjustStorageBytes(env, delta) {
  const current = await getStorageBytes(env);
  const next = Math.max(0, current + delta);
  await setStateValue(env, STORAGE_KEY, next);
  return next;
}

export async function setSnapshotBytes(env, bytes) {
  const current = parseNumber(await getStateValue(env, SNAPSHOT_KEY, 0));
  const delta = bytes - current;
  await adjustStorageBytes(env, delta);
  await setStateValue(env, SNAPSHOT_KEY, bytes);
  return bytes;
}

export async function getOverrideEnabled(env) {
  const value = await getStateValue(env, OVERRIDE_KEY, "false");
  return value === "true";
}

export async function setOverrideEnabled(env, enabled) {
  await setStateValue(env, OVERRIDE_KEY, enabled ? "true" : "false");
}

export async function getUsageSummary(env) {
  const now = nowSeconds();
  const monthly = await getMonthlyUsage(env, now);
  const storageBytes = await getStorageBytes(env);
  const overrideEnabled = await getOverrideEnabled(env);

  const cutoff = {
    storage_bytes: Math.floor(R2_LIMITS.storageBytes * USAGE_CUTOFF_FRACTION),
    class_a_ops: Math.floor(R2_LIMITS.classAOps * USAGE_CUTOFF_FRACTION),
    class_b_ops: Math.floor(R2_LIMITS.classBOps * USAGE_CUTOFF_FRACTION)
  };

  let blockReason = null;
  if (!overrideEnabled) {
    if (storageBytes >= cutoff.storage_bytes) {
      blockReason = "storage";
    } else if (monthly.class_a_ops >= cutoff.class_a_ops) {
      blockReason = "class_a";
    } else if (monthly.class_b_ops >= cutoff.class_b_ops) {
      blockReason = "class_b";
    }
  }

  const storageGb = storageBytes / BYTES_PER_GB;
  const billableStorageGb = Math.max(0, storageGb - R2_LIMITS.storageBytes / BYTES_PER_GB);
  const billableClassA = Math.max(0, monthly.class_a_ops - R2_LIMITS.classAOps) / 1_000_000;
  const billableClassB = Math.max(0, monthly.class_b_ops - R2_LIMITS.classBOps) / 1_000_000;

  const costStorage = billableStorageGb * R2_PRICING.storagePerGb;
  const costClassA = billableClassA * R2_PRICING.classAPerMillion;
  const costClassB = billableClassB * R2_PRICING.classBPerMillion;

  return {
    period_key: monthly.period_key,
    period_start: monthly.period_start,
    reset_at: monthly.reset_at,
    usage: {
      class_a_ops: monthly.class_a_ops,
      class_b_ops: monthly.class_b_ops,
      api_requests: monthly.api_requests,
      storage_bytes: storageBytes
    },
    limits: {
      class_a_ops: R2_LIMITS.classAOps,
      class_b_ops: R2_LIMITS.classBOps,
      storage_bytes: R2_LIMITS.storageBytes,
      cutoff_fraction: USAGE_CUTOFF_FRACTION,
      bytes_per_gb: BYTES_PER_GB
    },
    cutoff,
    override_enabled: overrideEnabled,
    blocked: Boolean(blockReason),
    block_reason: blockReason,
    estimate: {
      storage_gb: storageGb,
      billable_storage_gb: billableStorageGb,
      billable_class_a_millions: billableClassA,
      billable_class_b_millions: billableClassB,
      storage_cost: costStorage,
      class_a_cost: costClassA,
      class_b_cost: costClassB,
      total_cost: costStorage + costClassA + costClassB
    },
    pricing: {
      storage_per_gb: R2_PRICING.storagePerGb,
      class_a_per_million: R2_PRICING.classAPerMillion,
      class_b_per_million: R2_PRICING.classBPerMillion
    },
    note:
      "Estimates only. Counts backend-tracked R2 operations and current stored bytes; public R2 reads are not included."
  };
}

export async function enforceUsageLimits(env) {
  const summary = await getUsageSummary(env);
  if (!summary.blocked) {
    return { ok: true, summary };
  }

  let message =
    "Service paused to stay within Cloudflare R2 free limits. Ask the admin to enable override or wait for the monthly reset.";
  if (summary.block_reason === "storage") {
    message =
      "Uploads paused because storage is near the free tier limit. Ask the admin to enable override or wait for reset.";
  } else if (summary.block_reason === "class_a") {
    message =
      "Service paused because write requests are near the free tier limit. Ask the admin to enable override or wait for reset.";
  } else if (summary.block_reason === "class_b") {
    message =
      "Service paused because read requests are near the free tier limit. Ask the admin to enable override or wait for reset.";
  }

  return { ok: false, error: message, summary };
}
