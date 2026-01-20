import { cleanup } from "../../_lib/cleanup.js";
import { buildPublicSnapshot } from "../../_lib/snapshot.js";
import { LIMITS } from "../../_lib/constants.js";
import { readForm } from "../../_lib/request.js";
import { ok, fail } from "../../_lib/response.js";
import { isAdminRequest } from "../../_lib/security.js";
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

function normalizeImageKey(value) {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const path = url.pathname.replace(/^\/+/, "");
      return path || null;
    } catch (error) {
      return null;
    }
  }
  return trimmed.replace(/^\/+/, "");
}

function normalizeImageKeys(keys) {
  return (keys || []).map(normalizeImageKey).filter(Boolean);
}

function parseClearFlag(value) {
  const cleaned = String(value || "").trim().toLowerCase();
  return cleaned === "1" || cleaned === "true" || cleaned === "yes" || cleaned === "on";
}

export async function onRequestPost({ request, env }) {
  await recordApiRequest(env);
  await cleanup(env);

  if (!isAdminRequest(request, env)) {
    return fail(403, "Forbidden.");
  }

  const formResult = await readForm(request);
  if (!formResult.ok) {
    return fail(400, formResult.error);
  }
  const formData = formResult.value;

  const listingId = String(formData.get("listing_id") || "").trim();
  if (!listingId) {
    return fail(400, "listing_id is required.");
  }

  const listing = await env.DB.prepare(
    "SELECT listing_id, image_keys_json, image_sizes_json FROM listings WHERE listing_id = ?"
  )
    .bind(listingId)
    .first();

  if (!listing) {
    return fail(404, "Listing not found.");
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

  const clearImages = parseClearFlag(formData.get("clear_images"));
  const files = formData
    .getAll("images")
    .filter((file) => file instanceof File && file.size);

  if (files.length > LIMITS.maxImages) {
    return fail(400, "Too many images.");
  }

  if (files.length) {
    const limitCheck = await enforceUsageLimits(env);
    if (!limitCheck.ok) {
      return fail(429, limitCheck.error);
    }
  }

  const existingKeys = parseJsonArray(listing.image_keys_json);
  const existingSizes = parseJsonArray(listing.image_sizes_json);
  const keysToDelete = normalizeImageKeys(existingKeys);
  const totalExistingBytes = existingSizes.reduce((sum, value) => sum + (Number(value) || 0), 0);

  let imageKeys = existingKeys;
  let imageSizes = existingSizes;

  if (files.length) {
    let totalSize = 0;
    const newKeys = [];
    const newSizes = [];
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
      newKeys.push(key);
      newSizes.push(file.size);
    }
    imageKeys = newKeys;
    imageSizes = newSizes;
  } else if (clearImages) {
    imageKeys = [];
    imageSizes = [];
  }

  if ((files.length || clearImages) && keysToDelete.length) {
    try {
      await env.PUBLIC_BUCKET.delete(keysToDelete);
      await recordClassA(env, keysToDelete.length);
      if (totalExistingBytes > 0) {
        await adjustStorageBytes(env, -totalExistingBytes);
      }
    } catch (error) {
      // Ignore storage deletion errors so the update can continue.
    }
  }

  await env.DB.prepare(
    "UPDATE listings SET price_sek = ?, brand = ?, type = ?, condition = ?, wheel_size_in = ?, features_json = ?, faults_json = ?, location = ?, currency_mode = ?, payment_methods_json = ?, description = ?, delivery_possible = ?, delivery_price_sek = ?, contact_mode = ?, public_email = ?, public_phone = ?, public_phone_methods_json = ?, image_keys_json = ?, image_sizes_json = ? WHERE listing_id = ?"
  )
    .bind(
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
      listingId
    )
    .run();

  await buildPublicSnapshot(env);

  return ok();
}
