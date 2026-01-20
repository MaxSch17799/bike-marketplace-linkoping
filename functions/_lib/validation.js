import {
  CONDITIONS,
  CONTACT_METHODS,
  CONTACT_MODES,
  CURRENCY_MODES,
  FEATURES,
  FAULTS,
  LIMITS,
  LISTING_TYPES,
  PAYMENT_METHODS
} from "./constants.js";

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function trimText(value) {
  if (!value) {
    return "";
  }
  return String(value).trim();
}

function isValidEmail(value) {
  if (!value) {
    return false;
  }
  return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value);
}

function isValidPhone(value) {
  if (!value) {
    return false;
  }
  return /^[0-9+()\\s-]{6,}$/.test(value);
}

export function parseJsonArray(value) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export function validateListingFields(fields) {
  const price = toNumber(fields.price_sek);
  if (price === null || price < 0) {
    return { ok: false, error: "Invalid price." };
  }

  const brand = trimText(fields.brand);
  if (!brand || brand.length > LIMITS.maxBrandLength) {
    return { ok: false, error: "Invalid brand." };
  }

  if (!LISTING_TYPES.includes(fields.type)) {
    return { ok: false, error: "Invalid type." };
  }

  if (!CONDITIONS.includes(fields.condition)) {
    return { ok: false, error: "Invalid condition." };
  }

  const wheelSize = toNumber(fields.wheel_size_in);
  if (wheelSize === null) {
    return { ok: false, error: "Wheel size is required." };
  }
  if (wheelSize < 10 || wheelSize > 36) {
    return { ok: false, error: "Invalid wheel size." };
  }

  const location = trimText(fields.location);
  if (!location || location.length > LIMITS.maxLocationLength) {
    return { ok: false, error: "Invalid location." };
  }

  const description = trimText(fields.description);
  if (description.length > LIMITS.maxDescriptionLength) {
    return { ok: false, error: "Description is too long." };
  }

  if (!CONTACT_MODES.includes(fields.contact_mode)) {
    return { ok: false, error: "Invalid contact mode." };
  }

  const features = (fields.features || []).filter((item) => FEATURES.includes(item));
  const faults = (fields.faults || []).filter((item) => FAULTS.includes(item));

  if (features.length !== (fields.features || []).length) {
    return { ok: false, error: "Invalid features." };
  }
  if (faults.length !== (fields.faults || []).length) {
    return { ok: false, error: "Invalid faults." };
  }

  const currencyMode = fields.currency_mode || "sek_only";
  if (!CURRENCY_MODES.includes(currencyMode)) {
    return { ok: false, error: "Invalid currency option." };
  }

  const paymentMethods = (fields.payment_methods || []).filter((item) =>
    PAYMENT_METHODS.includes(item)
  );
  if (paymentMethods.length !== (fields.payment_methods || []).length) {
    return { ok: false, error: "Invalid payment method." };
  }

  const publicPhoneMethods = (fields.public_phone_methods || []).filter((item) =>
    CONTACT_METHODS.includes(item)
  );
  if (publicPhoneMethods.length !== (fields.public_phone_methods || []).length) {
    return { ok: false, error: "Invalid contact method." };
  }

  const publicEmail = trimText(fields.public_email);
  const publicPhone = trimText(fields.public_phone);
  if (fields.contact_mode === "public_contact") {
    if (!publicEmail && !publicPhone) {
      return { ok: false, error: "Public contact requires email or phone." };
    }
    if (publicEmail && !isValidEmail(publicEmail)) {
      return { ok: false, error: "Invalid public email." };
    }
    if (publicPhone && !isValidPhone(publicPhone)) {
      return { ok: false, error: "Invalid public phone." };
    }
  }

  const deliveryFlag = String(fields.delivery_possible || "").toLowerCase();
  const deliveryPossible =
    deliveryFlag === "yes" || deliveryFlag === "true" || deliveryFlag === "1";
  let deliveryPrice = toNumber(fields.delivery_price_sek);
  if (deliveryPossible) {
    if (deliveryPrice === null || deliveryPrice < 0) {
      return { ok: false, error: "Delivery price is required." };
    }
    deliveryPrice = Math.round(deliveryPrice);
  } else {
    deliveryPrice = null;
  }

  return {
    ok: true,
    value: {
      price_sek: Math.round(price),
      brand,
      type: fields.type,
      condition: fields.condition,
      wheel_size_in: wheelSize,
      features,
      faults,
      location,
      description: description || null,
      delivery_possible: deliveryPossible ? 1 : 0,
      delivery_price_sek: deliveryPrice,
      contact_mode: fields.contact_mode,
      public_email: publicEmail || null,
      public_phone: publicPhone || null,
      public_phone_methods: publicPhone ? publicPhoneMethods : [],
      currency_mode: currencyMode,
      payment_methods: paymentMethods
    }
  };
}

export function validateBuyerContact(fields) {
  const buyerEmail = trimText(fields.buyer_email);
  const buyerPhone = trimText(fields.buyer_phone);
  const message = trimText(fields.message);
  const buyerPhoneMethods = (fields.buyer_phone_methods || []).filter((item) =>
    CONTACT_METHODS.includes(item)
  );
  if (buyerPhoneMethods.length !== (fields.buyer_phone_methods || []).length) {
    return { ok: false, error: "Invalid contact method." };
  }

  if (!buyerEmail && !buyerPhone) {
    return { ok: false, error: "Provide email or phone." };
  }
  if (buyerEmail && !isValidEmail(buyerEmail)) {
    return { ok: false, error: "Invalid email." };
  }
  if (buyerPhone && !isValidPhone(buyerPhone)) {
    return { ok: false, error: "Invalid phone." };
  }
  if (!message || message.length > LIMITS.maxMessageLength) {
    return { ok: false, error: "Message is required." };
  }

  return {
    ok: true,
    value: {
      buyer_email: buyerEmail || null,
      buyer_phone: buyerPhone || null,
      message,
      buyer_phone_methods: buyerPhone ? buyerPhoneMethods : []
    }
  };
}

export function validateReport(fields) {
  const reason = trimText(fields.reason);
  const details = trimText(fields.details);
  if (!reason) {
    return { ok: false, error: "Reason is required." };
  }
  if (details.length > 300) {
    return { ok: false, error: "Details too long." };
  }
  return { ok: true, value: { reason, details: details || null } };
}

export function validatePriceUpdate(fields) {
  const price = toNumber(fields.new_price);
  if (price === null || price < 0) {
    return { ok: false, error: "Invalid price." };
  }
  return { ok: true, value: { new_price: Math.round(price) } };
}
