import { cleanup } from "../../_lib/cleanup.js";
import { buildPublicSnapshot } from "../../_lib/snapshot.js";
import { LIMITS, TTL } from "../../_lib/constants.js";
import { getIpContext, isBlocked } from "../../_lib/blocklist.js";
import { readForm } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { verifyTurnstile } from "../../_lib/turnstile.js";
import { createSeller, findSellerByToken } from "../../_lib/sellers.js";
import { parseJsonArray, validateListingFields } from "../../_lib/validation.js";
import {
  adjustStorageBytes,
  enforceUsageLimits,
  recordApiRequest,
  recordClassA
} from "../../_lib/usage.js";

function fileExtension(type) {
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/jpeg") {
    return "jpg";
  }
  return "webp";
}

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

  const limitCheck = await enforceUsageLimits(env);
  if (!limitCheck.ok) {
    return fail(429, limitCheck.error);
  }

  const turnstileToken = formData.get("cf_turnstile_response");
  const turnstileOk = await verifyTurnstile(turnstileToken, env, ip);
  if (!turnstileOk) {
    return fail(400, "Turnstile verification failed.");
  }

  const features = parseJsonArray(formData.get("features_json"));
  const faults = parseJsonArray(formData.get("faults_json"));
  const paymentMethods = parseJsonArray(formData.get("payment_methods_json"));
  const publicPhoneMethods = parseJsonArray(formData.get("public_phone_methods_json"));

  const validation = validateListingFields({
    price_sek: formData.get("price_sek"),
    brand: formData.get("brand"),
    type: formData.get("type"),
    condition: formData.get("condition"),
    wheel_size_in: formData.get("wheel_size_in"),
    location: formData.get("location"),
    currency_mode: formData.get("currency_mode"),
    payment_methods: paymentMethods,
    description: formData.get("description"),
    delivery_possible: formData.get("delivery_possible"),
    delivery_price_sek: formData.get("delivery_price_sek"),
    contact_mode: formData.get("contact_mode"),
    public_email: formData.get("public_email"),
    public_phone: formData.get("public_phone"),
    public_phone_methods: publicPhoneMethods,
    features,
    faults
  });

  if (!validation.ok) {
    return fail(400, validation.error);
  }

  const listingId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TTL.listingDays * 86400;

  let sellerId = null;
  let newToken = null;
  const sellerToken = formData.get("seller_token");
  if (sellerToken) {
    const seller = await findSellerByToken(env, sellerToken);
    if (!seller) {
      return fail(401, "Invalid seller token.");
    }
    sellerId = seller.seller_id;
  } else {
    const seller = await createSeller(env);
    sellerId = seller.seller_id;
    newToken = seller.seller_token;
  }

  const files = formData
    .getAll("images")
    .filter((file) => file instanceof File && file.size);
  if (files.length > LIMITS.maxImages) {
    return fail(400, "Too many images.");
  }

  let totalSize = 0;
  const imageKeys = [];
  const imageSizes = [];
  for (const file of files) {
    totalSize += file.size;
    if (file.size > LIMITS.maxImageBytes) {
      return fail(400, "Image is too large.");
    }
    if (totalSize > LIMITS.maxTotalUploadBytes) {
      return fail(400, "Total upload is too large.");
    }
    if (!["image/webp", "image/jpeg", "image/png"].includes(file.type)) {
      return fail(400, "Invalid image type.");
    }
    const key = `img/listings/${listingId}/${crypto.randomUUID()}.${fileExtension(file.type)}`;
    await env.PUBLIC_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });
    await recordClassA(env, 1);
    await adjustStorageBytes(env, file.size);
    imageKeys.push(key);
    imageSizes.push(file.size);
  }

  const insert = env.DB.prepare(
    "INSERT INTO listings (listing_id, seller_id, created_at, expires_at, rank, price_sek, brand, type, condition, wheel_size_in, features_json, faults_json, location, currency_mode, payment_methods_json, description, delivery_possible, delivery_price_sek, contact_mode, public_email, public_phone, public_phone_methods_json, image_keys_json, image_sizes_json, status, ip_hash, ip_stored_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)"
  );

  await insert
    .bind(
      listingId,
      sellerId,
      now,
      expiresAt,
      0,
      validation.value.price_sek,
      validation.value.brand,
      validation.value.type,
      validation.value.condition,
      validation.value.wheel_size_in,
      JSON.stringify(validation.value.features),
      JSON.stringify(validation.value.faults),
      validation.value.location,
      validation.value.currency_mode,
      JSON.stringify(validation.value.payment_methods),
      validation.value.description,
      validation.value.delivery_possible,
      validation.value.delivery_price_sek,
      validation.value.contact_mode,
      validation.value.public_email,
      validation.value.public_phone,
      JSON.stringify(validation.value.public_phone_methods),
      JSON.stringify(imageKeys),
      JSON.stringify(imageSizes),
      ipHash,
      ipHash ? now : null
    )
    .run();

  await buildPublicSnapshot(env);

  return ok({ listing_id: listingId, seller_token: newToken });
}
