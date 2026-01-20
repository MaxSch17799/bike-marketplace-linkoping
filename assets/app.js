const config = window.APP_CONFIG || {};
const apiBase = (config.apiBase || "").replace(/\/$/, "");
const listingsUrl = config.listingsUrl || "/snapshots/listings.json";
const reportPhone = config.reportPhone || "0700500929";
const maxImageCount = config.maxImageCount || 2;
const maxMessageLength = config.maxMessageLength || 300;

const listingTypes = [
  "City",
  "City (men)",
  "City (women)",
  "Mountain bike",
  "Racer",
  "Fold bike",
  "Other"
];

const conditionOptions = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Very poor"
];

const featureOptions = [
  "Gears",
  "Front light",
  "Rear light",
  "Dynamo lights",
  "Disc brakes",
  "Rim brakes",
  "Front suspension",
  "Rear rack",
  "Basket",
  "Mudguards",
  "Kickstand",
  "Bell",
  "Reflectors",
  "Lock included",
  "Winter tires / studded tires"
];

const faultOptions = [
  "Flat tire",
  "Worn tires",
  "Brakes need adjustment",
  "Chain worn / skipping",
  "Gears not shifting well",
  "Rust on frame",
  "Rust on chain/gears",
  "Wobbly wheel",
  "Bent rim",
  "Broken/weak lights",
  "Seat torn",
  "Missing mudguard",
  "Needs service soon",
  "Creaking bottom bracket",
  "Loose handlebar/stem"
];

const contactMethodOptions = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "phone_call", label: "Phone call" }
];

const currencyModeOptions = [
  { value: "sek_eur", label: "Euro and SEK possible" },
  { value: "sek_only", label: "Only SEK possible" },
  { value: "eur_only", label: "Only Euro possible" }
];

const paymentMethodOptions = [
  { value: "swish", label: "Swish" },
  { value: "paypal", label: "PayPal" },
  { value: "revolut", label: "Revolut" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" }
];

const locationSuggestions = [
  "Ryd",
  "Valla",
  "T1",
  "Lambohov",
  "Vasastaden",
  "Innerstaden",
  "Johannelund",
  "Skaggetorp",
  "Berga",
  "Malmslatt",
  "Tallboda",
  "Ekholmen",
  "Gottfridsberg",
  "Majelden",
  "US",
  "Campus Valla"
];

const state = {
  listings: [],
  listingsById: new Map(),
  listingsLoaded: false,
  listingsError: null
};

const adminState = {
  tab: "overview"
};

const app = document.getElementById("app");

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function formatPrice(value) {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return "-";
  }
  return new Intl.NumberFormat("sv-SE").format(numberValue) + " SEK";
}

function formatDate(seconds) {
  if (!seconds) {
    return "-";
  }
  const date = new Date(seconds * 1000);
  return date.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(seconds) {
  if (!seconds) {
    return "-";
  }
  const date = new Date(seconds * 1000);
  return date.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNumber(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "-";
  }
  return new Intl.NumberFormat("sv-SE").format(numberValue);
}

function formatMoney(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(numberValue);
}

function formatPercent(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "-";
  }
  return `${(numberValue * 100).toFixed(1)}%`;
}

function formatBytes(bytes) {
  const numberValue = Number(bytes);
  if (!Number.isFinite(numberValue)) {
    return "-";
  }
  if (numberValue >= 1_000_000_000) {
    return `${(numberValue / 1_000_000_000).toFixed(2)} GB`;
  }
  if (numberValue >= 1_000_000) {
    return `${(numberValue / 1_000_000).toFixed(2)} MB`;
  }
  if (numberValue >= 1_000) {
    return `${(numberValue / 1_000).toFixed(2)} KB`;
  }
  return `${numberValue} B`;
}

function escapeHtml(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildListingSummary({ type, condition, location, wheelSize, hasLock }) {
  const typeLabel = type || "Bike";
  const conditionLabel = condition || "unknown";
  const locationLabel = location || "-";
  const parts = [
    `A <strong>${typeLabel}</strong> bike in <strong>${conditionLabel}</strong> condition, located in <strong>${locationLabel}</strong>.`
  ];
  if (wheelSize) {
    parts.push(`Has <strong>${wheelSize}</strong> inch wheels.`);
  }
  if (hasLock) {
    parts.push("Includes a lock.");
  }
  return parts.join(" ");
}

function formatContactMethods(methods) {
  if (!Array.isArray(methods) || !methods.length) {
    return "";
  }
  const labels = contactMethodOptions.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {});
  const cleaned = methods.map((method) => labels[method] || method).filter(Boolean);
  return cleaned.join(", ");
}

function formatCurrencyMode(mode) {
  const match = currencyModeOptions.find((option) => option.value === mode);
  return match ? match.label : "";
}

function formatPaymentMethods(methods) {
  if (!Array.isArray(methods) || !methods.length) {
    return "";
  }
  const labels = paymentMethodOptions.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {});
  const cleaned = methods.map((method) => labels[method] || method).filter(Boolean);
  return cleaned.join(", ");
}

function setNotice(target, message, type = "") {
  target.innerHTML = message ? `<div class="notice ${type}">${message}</div>` : "";
}

function formatListingError(message, maxImagesAllowed) {
  if (!message) {
    return "Could not create listing.";
  }
  switch (message) {
    case "Turnstile verification failed.":
      return "Turnstile check failed. Please try again in a few seconds, then press Create listing again.";
    case "Invalid price.":
      return "Price is required and must be a number in SEK.";
    case "Invalid brand.":
      return "Brand is required (max 40 characters).";
    case "Invalid type.":
      return "Please pick a bike type from the list.";
    case "Invalid condition.":
      return "Please pick a condition from the list.";
    case "Wheel size is required.":
      return "Wheel size is required.";
    case "Invalid wheel size.":
      return "Wheel size must be between 10 and 36 inches.";
    case "Invalid location.":
      return "Location is required (max 25 characters).";
    case "Description is too long.":
      return "Description is too long (max 150 characters).";
    case "Public contact requires email or phone.":
      return "Public contact needs at least an email or phone number.";
    case "Invalid public email.":
      return "Invalid public email. Example: name@gmail.com (no spaces).";
    case "Invalid public phone.":
      return "Invalid phone number. Use digits, +, spaces, or hyphens.";
    case "Invalid currency option.":
      return "Please select a currency option.";
    case "Invalid payment method.":
      return "Please select a valid payment method.";
    case "Invalid contact method.":
      return "Please select a valid contact method.";
    case "Delivery price is required.":
      return "If delivery is available, set a delivery price (SEK).";
    case "Too many images.":
      return `You can upload up to ${maxImagesAllowed} images.`;
    case "Image is too large.":
      return "Each image must be under about 1.2 MB.";
    case "Total upload is too large.":
      return "Total upload is too large. Try fewer or smaller images.";
    case "Invalid image type.":
      return "Only JPG, PNG, or WebP images are allowed.";
    case "Invalid seller token.":
      return "That seller token is not recognized. Paste the exact token you got from this site.";
    default:
      return message;
  }
}

function formatContactError(message) {
  if (!message) {
    return "Could not send message.";
  }
  switch (message) {
    case "Provide email or phone.":
      return "Provide at least an email or phone number.";
    case "Invalid email.":
      return "Invalid email. Example: name@gmail.com (no spaces).";
    case "Invalid phone.":
      return "Invalid phone number. Use digits, +, spaces, or hyphens.";
    case "Message is required.":
      return "Message is required (max 300 characters).";
    case "Listing not available.":
      return "This listing is no longer available.";
    case "Listing does not accept buyer messages.":
      return "This listing does not accept buyer messages.";
    case "Please wait before sending another message.":
      return "Please wait 10 minutes before sending another message to this listing.";
    case "Turnstile verification failed.":
      return "Turnstile check failed. Please try again in a few seconds, then press Send message again.";
    case "Invalid contact method.":
      return "Please select valid phone contact methods.";
    default:
      return message;
  }
}

async function loadListings(force = false) {
  if (state.listingsLoaded && !force) {
    return;
  }
  try {
    state.listingsError = null;
    const cacheBust = force ? `${listingsUrl}${listingsUrl.includes("?") ? "&" : "?"}t=${Date.now()}` : listingsUrl;
    const response = await fetch(cacheBust, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load listings");
    }
    const payload = await response.json();
    const listings = Array.isArray(payload.listings) ? payload.listings : [];
    state.listings = listings;
    state.listingsById = new Map(listings.map((item) => [item.listing_id, item]));
    state.listingsLoaded = true;
  } catch (error) {
    state.listingsLoaded = true;
    state.listingsError = error.message || "Could not load listings.";
  }
}

async function refreshListings() {
  state.listingsLoaded = false;
  await loadListings(true);
}

function setActiveNav(path) {
  const nav = document.getElementById("nav");
  if (!nav) {
    return;
  }
  qsa("a", nav).forEach((link) => {
    link.classList.toggle("active", link.getAttribute("data-route") === path);
  });
}

function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") {
    return { name: "home", path };
  }
  if (path === "/sell") {
    return { name: "sell", path };
  }
  if (path === "/about") {
    return { name: "about", path };
  }
  if (path === "/dashboard") {
    return { name: "dashboard", path };
  }
  if (path === "/admin") {
    return { name: "admin", path };
  }
  if (path.startsWith("/listing/")) {
    const id = path.split("/")[2];
    return { name: "listing", path, id };
  }
  return { name: "notfound", path };
}

function navigate(path) {
  if (window.location.pathname === path) {
    return;
  }
  window.history.pushState({}, "", path);
  renderRoute();
}

function attachNavHandler() {
  document.body.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) {
      return;
    }
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("/")) {
      return;
    }
    event.preventDefault();
    navigate(href);
  });
}

function sortListings(listings, sortMode) {
  const sorted = [...listings];
  switch (sortMode) {
    case "newest":
      sorted.sort((a, b) => b.created_at - a.created_at);
      break;
    case "oldest":
      sorted.sort((a, b) => a.created_at - b.created_at);
      break;
    case "cheapest":
      sorted.sort((a, b) => a.price_sek - b.price_sek);
      break;
    case "expensive":
      sorted.sort((a, b) => b.price_sek - a.price_sek);
      break;
    default:
      sorted.sort((a, b) => {
        if (b.rank !== a.rank) {
          return b.rank - a.rank;
        }
        return a.created_at - b.created_at;
      });
  }
  return sorted;
}

function renderHome() {
  setActiveNav("/");
  app.innerHTML = `
      <section class="section">
        <div class="section-header">
          <div class="section-title">Browse bikes</div>
          <label>
            Sort
          <select id="sortSelect">
            <option value="rank">Recommended</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="cheapest">Cheapest</option>
            <option value="expensive">Most expensive</option>
          </select>
          </label>
        </div>
        <div class="helper">Browse local listings in Linköping. Open a bike to see details and contact the seller.</div>
        <div id="homeNotice"></div>
        <div class="card-grid" id="listingGrid"></div>
      </section>
    `;

  const sortSelect = qs("#sortSelect");
  const notice = qs("#homeNotice");
  const grid = qs("#listingGrid");

  if (state.listingsError) {
    setNotice(notice, state.listingsError, "error");
    return;
  }

  const renderCards = () => {
    const sorted = sortListings(state.listings, sortSelect.value);
    if (!sorted.length) {
      grid.innerHTML = `<div class="empty">No listings yet. Be the first to post one.</div>`;
      return;
    }
    grid.innerHTML = sorted
      .map((listing) => {
        const images = Array.isArray(listing.image_urls) ? listing.image_urls : [];
        const imageTag = images.length
          ? `<div class="carousel" data-images='${JSON.stringify(images)}'>
              <img src="${images[0]}" alt="Bike photo" loading="lazy" />
              ${images.length > 1 ? `
                <div class="carousel-controls">
                  <button type="button" data-action="prev">&#8249;</button>
                  <button type="button" data-action="next">&#8250;</button>
                </div>
              ` : ""}
            </div>`
          : `<div class="carousel"><img src="/assets/placeholder.svg" alt="No photo" /></div>`;

        const features = Array.isArray(listing.features) ? listing.features : [];
        const hasLock = features.includes("Lock included");
        const summaryText = buildListingSummary({
          type: listing.type,
          condition: listing.condition,
          location: listing.location,
          wheelSize: listing.wheel_size_in,
          hasLock
        });
        const deliveryText = listing.delivery_possible
          ? `Delivery possible for ${formatPrice(listing.delivery_price_sek)}`
          : "Pickup only";

        return `
          <article class="card">
            ${imageTag}
            <div class="card-header">
              <div class="card-title">${listing.brand || "Bike"}</div>
              <div class="card-price">${formatPrice(listing.price_sek)}</div>
            </div>
            <div class="helper">${summaryText}</div>
            <div class="helper">${deliveryText}</div>
            <div class="helper">Posted ${formatDate(listing.created_at)}</div>
            <div class="inline-actions">
              <button class="button secondary" data-action="view" data-id="${listing.listing_id}">View</button>
            </div>
          </article>
        `;
      })
      .join("");

    qsa("button[data-action='view']", grid).forEach((button) => {
      button.addEventListener("click", () => {
        navigate(`/listing/${button.dataset.id}`);
      });
    });
    setupCarousels(grid);
  };

  sortSelect.addEventListener("change", renderCards);
  renderCards();
}

function renderListingDetail(route) {
  setActiveNav("");
  const listing = state.listingsById.get(route.id);
  if (!listing) {
    app.innerHTML = `<div class="empty">Listing not found. <a href="/">Back to browse</a></div>`;
    return;
  }

  const images = Array.isArray(listing.image_urls) ? listing.image_urls : [];
  const heroImage = images[0] || "/assets/placeholder.svg";

  const features = Array.isArray(listing.features) ? listing.features : [];
  const faults = Array.isArray(listing.faults) ? listing.faults : [];
  const description = listing.description ? listing.description : "";
  const deliveryText = listing.delivery_possible
    ? `Delivery possible for ${formatPrice(listing.delivery_price_sek)}`
    : "Pickup only";
  const currencyLabel = formatCurrencyMode(listing.currency_mode);
  const paymentLabel = formatPaymentMethods(listing.payment_methods || []);
  const paymentParts = [currencyLabel, paymentLabel].filter(Boolean);
  const paymentText = paymentParts.length ? paymentParts.join(" · ") : "";
  const publicContactMethods = formatContactMethods(listing.public_phone_methods || []);
  const preferredParts = [];
  if (publicContactMethods) {
    preferredParts.push(publicContactMethods);
  }
  if (listing.public_email) {
    preferredParts.push(`email ${listing.public_email}`);
  }
  const buyerMessageHint = preferredParts.length
    ? `You can also contact this seller with your contact info. The seller prefers to be contacted via ${preferredParts.join(" and/or ")}.`
    : "You can also contact this seller with your contact info.";

  app.innerHTML = `
    <section class="section">
      <div class="inline-actions">
        <button class="button ghost" data-action="back">Back</button>
        <button class="button ghost" data-action="report">Report</button>
      </div>
      <div class="detail-layout">
        <div>
          <div class="detail-image">
            <img src="${heroImage}" alt="Bike photo" />
          </div>
          ${images.length > 1 ? `
            <div class="tag-list" id="thumbs">
              ${images
                .map((url) => `<img class="thumb" src="${url}" alt="Bike photo" data-thumb="${url}" />`)
                .join("")}
            </div>
          ` : ""}
        </div>
        <div class="detail-panel">
          <div class="card-header">
            <div class="card-title">${listing.brand || "Bike"}</div>
            <div class="card-price">${formatPrice(listing.price_sek)}</div>
          </div>
          <div class="card-meta">
            <span>${listing.type || ""}</span>
            <span>${listing.condition || ""}</span>
            <span>${listing.location || ""}</span>
            ${listing.wheel_size_in ? `<span>${listing.wheel_size_in} in</span>` : ""}
          </div>
          <div class="helper">${deliveryText}</div>
          ${paymentText ? `<div class="helper">Payment: ${paymentText}</div>` : ""}
          <div class="helper">Posted ${formatDate(listing.created_at)} - expires ${formatDate(listing.expires_at)}</div>
          ${description ? `
            <div>
              <div class="helper">Description</div>
              <div>${description}</div>
            </div>
          ` : ""}
          <div>
            <div class="helper">Features</div>
            <div class="tag-list">
              ${features.length ? features.map((item) => `<span class="tag">${item}</span>`).join("") : "<span class='helper'>None listed</span>"}
            </div>
          </div>
          <div>
            <div class="helper">Faults</div>
            <div class="tag-list">
              ${faults.length ? faults.map((item) => `<span class="tag">${item}</span>`).join("") : "<span class='helper'>None listed</span>"}
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="section-title">Contact</div>
        ${listing.contact_mode === "public_contact" ? `
          <div class="notice">
            <div>Email: ${listing.public_email || "-"}</div>
            <div>Phone: ${listing.public_phone || "-"}</div>
            ${publicContactMethods ? `<div class="helper">Preferred contact: ${publicContactMethods}</div>` : ""}
          </div>
          <div class="helper">${buyerMessageHint}</div>
        ` : ""}
        ${listing.contact_mode === "buyer_message" || listing.contact_mode === "public_contact" ? `
          <form class="form" id="contactForm">
            <label>
              Email (optional)
              <input type="email" name="buyer_email" placeholder="you@example.com" />
            </label>
            <label>
              Phone (optional)
              <input type="tel" name="buyer_phone" placeholder="0700..." />
            </label>
            <div id="buyerPhoneMethods" style="display: none;">
              <div class="helper">You can contact me via:</div>
              <div class="tag-list">
                ${contactMethodOptions
                  .map(
                    (option, index) => `
                      <label class="tag">
                        <input type="checkbox" name="buyer_phone_method_${index}" value="${option.value}" /> ${option.label}
                      </label>
                    `
                  )
                  .join("")}
              </div>
            </div>
            <label>
              Message
              <textarea name="message" maxlength="${maxMessageLength}" placeholder="Short message"></textarea>
            </label>
            <div class="helper">Provide email or phone so the seller can reply.</div>
            <div class="turnstile" data-turnstile></div>
            <button class="button" type="submit">Send message</button>
            <div id="contactNotice"></div>
          </form>
        ` : "<div class='helper'>This seller does not accept buyer messages.</div>"}
      </div>
    </section>

    <div class="modal" id="reportModal">
      <div class="modal-card">
        <div class="section-title">Report listing</div>
        <p class="helper">For urgent issues call ${reportPhone}.</p>
        <form class="form" id="reportForm">
          <label>
            Reason
            <select name="reason" required>
              <option value="Scam">Scam</option>
              <option value="Stolen">Stolen bike</option>
              <option value="Duplicate">Duplicate</option>
              <option value="Offensive">Offensive</option>
              <option value="Sold">Sold already</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            Details (optional)
            <textarea name="details" maxlength="300"></textarea>
          </label>
          <div class="helper">Leave your contact info in the details if you want us to reach out.</div>
          <div class="turnstile" data-turnstile></div>
          <div class="inline-actions">
            <button class="button" type="submit">Send report</button>
            <button class="button secondary" type="button" data-action="close-report">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const backButton = qs("button[data-action='back']");
  backButton.addEventListener("click", () => navigate("/"));

  const reportButton = qs("button[data-action='report']");
  const reportModal = qs("#reportModal");
  const reportForm = qs("#reportForm");
  reportButton.addEventListener("click", () => {
    reportModal.classList.add("active");
    setupTurnstile(reportForm);
  });
  qs("button[data-action='close-report']").addEventListener("click", () => reportModal.classList.remove("active"));

  const thumbs = qs("#thumbs");
  if (thumbs) {
    thumbs.addEventListener("click", (event) => {
      const target = event.target.closest("img[data-thumb]");
      if (target) {
        qs(".detail-image img").src = target.dataset.thumb;
      }
    });
  }

  const contactForm = qs("#contactForm");
  if (contactForm) {
    setupTurnstile(contactForm);
    const buyerPhoneInput = qs("input[name='buyer_phone']", contactForm);
    const buyerPhoneMethods = qs("#buyerPhoneMethods", contactForm);
    const toggleBuyerPhoneMethods = () => {
      const hasPhone = buyerPhoneInput && buyerPhoneInput.value.trim().length > 0;
      if (buyerPhoneMethods) {
        buyerPhoneMethods.style.display = hasPhone ? "block" : "none";
        if (!hasPhone) {
          qsa("input[type='checkbox']", buyerPhoneMethods).forEach((input) => {
            input.checked = false;
          });
        }
      }
    };
    if (buyerPhoneInput) {
      buyerPhoneInput.addEventListener("input", toggleBuyerPhoneMethods);
      toggleBuyerPhoneMethods();
    }
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const notice = qs("#contactNotice");
      setNotice(notice, "");
      const formData = new FormData(contactForm);
      const email = String(formData.get("buyer_email") || "").trim().replace(/\s+/g, "");
      const phone = String(formData.get("buyer_phone") || "").trim();
      if (email) {
        formData.set("buyer_email", email);
      }
      if (phone) {
        formData.set("buyer_phone", phone);
      }
      const selectedMethods = [];
      contactMethodOptions.forEach((option, index) => {
        const input = contactForm[`buyer_phone_method_${index}`];
        if (input && input.checked) {
          selectedMethods.push(option.value);
        }
      });
      formData.set("buyer_phone_methods_json", JSON.stringify(selectedMethods));
      formData.append("listing_id", listing.listing_id);
      const token = getTurnstileResponse(contactForm);
      if (token === null) {
        setNotice(notice, "Turnstile is not ready yet. Please wait a moment and try again.", "error");
        return;
      }
      if (token) {
        formData.append("cf_turnstile_response", token);
      }
      const response = await apiPostForm("/api/buyer/contact", formData);
      if (response.ok) {
        setNotice(notice, "Message sent.", "ok");
        contactForm.reset();
        if (buyerPhoneMethods) {
          buyerPhoneMethods.style.display = "none";
        }
      } else {
        setNotice(notice, formatContactError(response.error), "error");
      }
      resetTurnstile(contactForm);
    });
  }

  reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(reportForm);
    formData.append("listing_id", listing.listing_id);
    const token = getTurnstileResponse(reportForm);
    if (token === null) {
      alert("Turnstile is not ready.");
      return;
    }
    if (token) {
      formData.append("cf_turnstile_response", token);
    }
    const response = await apiPostForm("/api/listing/report", formData);
    if (response.ok) {
      reportModal.classList.remove("active");
      reportForm.reset();
      alert("Report sent. Thank you.");
    } else {
      alert(response.error || "Could not send report.");
    }
  });
}

function renderSell() {
  setActiveNav("/sell");
  const savedToken = localStorage.getItem("seller_token") || "";
  app.innerHTML = `
    <section class="section">
      <div class="section-title">Sell a bike</div>
      <div class="helper">Choose the option that fits your situation.</div>
      <div class="card-grid">
        <div class="card">
          <div class="card-title">Guaranteed sale</div>
          <div class="helper">
            We will offer you a low but fair instant quote and pick up your bike on short notice if you are in a pickle.
          </div>
          <div class="inline-actions">
            <a class="button" href="https://webuyyourbike.pages.dev" target="_blank" rel="noopener">Get instant quote</a>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Sell on marketplace</div>
          <div class="helper">
            Create a new listing. No login required. We give you a secret, private key to manage your listing later.
          </div>
          <div class="inline-actions">
            <button class="button secondary" id="toggleSellForm" aria-expanded="false" aria-controls="sellFormSection">
              Create listing
            </button>
          </div>
        </div>
      </div>

      <div class="card" id="sellFormSection" hidden>
        <div class="section-title">Sell on marketplace</div>
        <div class="notice">
          This listing will be deleted within 39 days unless you log in to your dashboard.
        </div>
        <form class="form" id="sellForm">
          <div class="form-row">
            <label>
              Price (SEK)
              <input type="number" name="price_sek" min="0" required />
            </label>
            <label>
              Brand
              <input type="text" name="brand" maxlength="40" required />
            </label>
            <label>
              Type
              <select name="type" required>
                ${listingTypes.map((item) => `<option value="${item}">${item}</option>`).join("")}
              </select>
            </label>
            <label>
              Condition
              <select name="condition" required>
                ${conditionOptions.map((item) => `<option value="${item}">${item}</option>`).join("")}
              </select>
            </label>
          </div>
          <div>
            <div class="helper">Accepted currency</div>
            <div class="tag-list" id="currencyMode">
              ${currencyModeOptions
                .map(
                  (option, index) => `
                    <label class="tag">
                      <input type="radio" name="currency_mode" value="${option.value}" ${index === 1 ? "checked" : ""} />
                      ${option.label}
                    </label>
                  `
                )
                .join("")}
            </div>
          </div>
          <div>
            <div class="helper">Payment methods</div>
            <div class="tag-list" id="paymentMethods">
              ${paymentMethodOptions
                .map(
                  (option, index) => `
                    <label class="tag">
                      <input type="checkbox" name="payment_method_${index}" value="${option.value}" /> ${option.label}
                    </label>
                  `
                )
                .join("")}
            </div>
            <div class="helper">Mention other payment method in description.</div>
          </div>
            <div class="form-row">
              <label>
                Wheel size (inches)
                <input type="number" name="wheel_size_in" min="10" max="36" step="0.5" required />
              </label>
              <label>
                Location (max 25 chars)
                <input type="text" name="location" list="locationList" maxlength="25" required />
                <datalist id="locationList">
                  ${locationSuggestions.map((item) => `<option value="${item}"></option>`).join("")}
                </datalist>
              </label>
            </div>

            <div>
              <div class="helper">Delivery in Linköping</div>
              <div class="tag-list" id="deliveryOptions">
                <label class="tag">
                  <input type="radio" name="delivery_possible" value="no" checked /> No delivery
                </label>
                <label class="tag">
                  <input type="radio" name="delivery_possible" value="yes" /> Delivery available
                </label>
              </div>
              <div id="deliveryPriceFields" style="display: none;">
                <label>
                  Delivery price (SEK)
                  <input type="number" name="delivery_price_sek" min="0" step="1" />
                </label>
              </div>
            </div>

            <label>
              Description (optional, max 150 chars)
              <textarea name="description" maxlength="150" placeholder="Short description"></textarea>
            </label>

          <div>
            <div class="helper">Features</div>
            <div class="tag-list">
              ${featureOptions
                .map(
                  (item, index) => `
                    <label class="tag">
                      <input type="checkbox" name="feature_${index}" value="${item}" /> ${item}
                    </label>
                  `
                )
                .join("")}
            </div>
          </div>

          <div>
            <div class="helper">Faults</div>
            <div class="tag-list">
              ${faultOptions
                .map(
                  (item, index) => `
                    <label class="tag">
                      <input type="checkbox" name="fault_${index}" value="${item}" /> ${item}
                    </label>
                  `
                )
                .join("")}
            </div>
          </div>

            <div>
              <div class="helper">Contact mode</div>
              <div class="tag-list" id="contactMode">
                <label class="tag">
                  <input type="radio" name="contact_mode" value="buyer_message" checked /> Buyer message
                </label>
                <label class="tag">
                  <input type="radio" name="contact_mode" value="public_contact" /> Public contact
                </label>
              </div>
              <div class="helper">
                Buyer message: buyers leave their contact info and you see it in your dashboard.
                Public contact: your email/phone is shown on the listing for faster contact.
              </div>
            </div>

          <div id="publicContactFields" style="display: none;">
            <div class="form-row">
              <label>
                Public email
                <input type="email" name="public_email" placeholder="you@example.com" />
              </label>
              <label>
                Public phone
                <input type="tel" name="public_phone" placeholder="0700..." />
              </label>
            </div>
            <div id="publicPhoneMethods" style="display: none;">
              <div class="helper">You can contact me via:</div>
              <div class="tag-list">
                ${contactMethodOptions
                  .map(
                    (option, index) => `
                      <label class="tag">
                        <input type="checkbox" name="public_phone_method_${index}" value="${option.value}" /> ${option.label}
                      </label>
                    `
                  )
                  .join("")}
              </div>
            </div>
            <div class="helper">Only share contact info you are comfortable showing publicly.</div>
          </div>

            <label>
              Photos (up to ${maxImageCount})
              <input type="file" name="images" accept="image/*" multiple />
            </label>
            <div class="inline-actions">
              <button class="button ghost" id="clearPhotos" type="button">Clear photos</button>
            </div>

            <div class="form-row">
              <label>
                Preexisting seller token
                <input type="text" id="sellerTokenInput" placeholder="Paste your token" value="${savedToken}" />
              </label>
              <div class="inline-actions">
                <button class="button ghost" id="copyToken" type="button">Copy token</button>
                <button class="button ghost" id="clearToken" type="button">Clear token</button>
              </div>
            </div>
            <div class="helper">
              If you already have a token, paste it here so all listings stay under the same dashboard login.
            </div>
            <div class="helper">
              Tokens are generated by the site. Custom tokens are not accepted.
            </div>
            <div class="helper">
              Leave the token blank when creating a listing to receive a new token automatically.
            </div>

            <div class="turnstile" data-turnstile></div>

            <button class="button" type="submit" id="createListingButton">Create listing</button>
            <div class="helper" id="submitCooldownHelp"></div>
            <div id="sellNotice"></div>
        </form>
      </div>
    </section>
  `;

  const toggleButton = qs("#toggleSellForm");
  const sellFormSection = qs("#sellFormSection");
  toggleButton.addEventListener("click", () => {
    const isHidden = sellFormSection.hasAttribute("hidden");
    if (isHidden) {
      sellFormSection.removeAttribute("hidden");
      toggleButton.setAttribute("aria-expanded", "true");
      setupTurnstile(sellFormSection);
      sellFormSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      sellFormSection.setAttribute("hidden", "");
      toggleButton.setAttribute("aria-expanded", "false");
    }
  });

  const notice = qs("#sellNotice");
  const sellForm = qs("#sellForm");
  const tokenInput = qs("#sellerTokenInput");
  const copyTokenButton = qs("#copyToken");
  const createButton = qs("#createListingButton");
  const cooldownHelp = qs("#submitCooldownHelp");
  const clearPhotosButton = qs("#clearPhotos");

  let lastSubmissionSnapshot = null;
  let lastSubmissionHadImages = false;
  let cooldownUntil = 0;
  let cooldownTimer = null;
  const createButtonLabel = createButton.textContent;

  qs("#clearToken").addEventListener("click", () => {
    localStorage.removeItem("seller_token");
    tokenInput.value = "";
    toggleCopyButton();
  });

  const toggleCopyButton = () => {
    copyTokenButton.disabled = !tokenInput.value.trim();
  };
  toggleCopyButton();
  tokenInput.addEventListener("input", toggleCopyButton);
  const copyTokenToClipboard = async (targetNotice) => {
    const tokenValue = tokenInput.value.trim();
    if (!tokenValue) {
      return;
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      if (targetNotice) {
        setNotice(targetNotice, "Clipboard access is not available.", "error");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(tokenValue);
      if (targetNotice) {
        setNotice(targetNotice, "Token copied.", "ok");
      }
    } catch (error) {
      if (targetNotice) {
        setNotice(targetNotice, "Could not copy token.", "error");
      }
    }
  };
  copyTokenButton.addEventListener("click", () => {
    copyTokenToClipboard(notice);
  });

  const contactMode = qs("#contactMode");
  const publicFields = qs("#publicContactFields");
  const publicPhoneMethods = qs("#publicPhoneMethods");
  const publicPhoneInput = qs("input[name='public_phone']", publicFields);
  const togglePublicPhoneMethods = () => {
    const isPublic = qs("input[name='contact_mode']:checked").value === "public_contact";
    const hasPhone = publicPhoneInput && publicPhoneInput.value.trim().length > 0;
    if (publicPhoneMethods) {
      publicPhoneMethods.style.display = isPublic && hasPhone ? "block" : "none";
      if (!hasPhone || !isPublic) {
        qsa("input[type='checkbox']", publicPhoneMethods).forEach((input) => {
          input.checked = false;
        });
      }
    }
  };
  contactMode.addEventListener("change", () => {
    const mode = qs("input[name='contact_mode']:checked").value;
    publicFields.style.display = mode === "public_contact" ? "block" : "none";
    togglePublicPhoneMethods();
  });
  if (publicPhoneInput) {
    publicPhoneInput.addEventListener("input", togglePublicPhoneMethods);
  }
  togglePublicPhoneMethods();

  const deliveryOptions = qs("#deliveryOptions");
  const deliveryPriceFields = qs("#deliveryPriceFields");
  deliveryOptions.addEventListener("change", () => {
    const choice = qs("input[name='delivery_possible']:checked").value;
    if (choice === "yes") {
      deliveryPriceFields.style.display = "block";
    } else {
      deliveryPriceFields.style.display = "none";
      const priceInput = qs("input[name='delivery_price_sek']", deliveryPriceFields);
      if (priceInput) {
        priceInput.value = "";
      }
    }
  });

  clearPhotosButton.addEventListener("click", () => {
    sellForm.images.value = "";
    updateCreateButtonState();
  });

  const snapshotListingForm = () => {
    const data = new FormData(sellForm);
    const entries = [];
    for (const [key, value] of data.entries()) {
      if (key === "images") {
        continue;
      }
      entries.push([key, String(value)]);
    }
    entries.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    return JSON.stringify(entries);
  };

  const canSubmitAgain = () => {
    if (!lastSubmissionSnapshot) {
      return true;
    }
    if (Date.now() < cooldownUntil) {
      return false;
    }
    if (lastSubmissionHadImages) {
      return sellForm.images.files.length === 0;
    }
    return snapshotListingForm() !== lastSubmissionSnapshot;
  };

  const updateCooldownHelp = () => {
    if (!lastSubmissionSnapshot) {
      cooldownHelp.textContent = "";
      return;
    }
    const now = Date.now();
    if (now < cooldownUntil) {
      const seconds = Math.ceil((cooldownUntil - now) / 1000);
      cooldownHelp.textContent = `Please wait ${seconds}s before creating another listing.`;
      return;
    }
    if (lastSubmissionHadImages && sellForm.images.files.length > 0) {
      cooldownHelp.textContent = "Remove uploaded photos to create another listing.";
      return;
    }
    if (!lastSubmissionHadImages && snapshotListingForm() === lastSubmissionSnapshot) {
      cooldownHelp.textContent = "Change at least one detail to create another listing.";
      return;
    }
    cooldownHelp.textContent = "";
  };

  const updateCreateButtonState = () => {
    if (createButton.dataset.loading === "true") {
      updateCooldownHelp();
      return;
    }
    createButton.disabled = !canSubmitAgain();
    updateCooldownHelp();
  };

  const setCreateButtonLoading = (isLoading) => {
    createButton.dataset.loading = isLoading ? "true" : "false";
    createButton.classList.toggle("loading", isLoading);
    createButton.textContent = isLoading ? "Creating..." : createButtonLabel;
    createButton.disabled = isLoading || !canSubmitAgain();
  };

  const startCooldownTimer = () => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
    }
    cooldownTimer = setInterval(() => {
      updateCreateButtonState();
      if (Date.now() >= cooldownUntil) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }, 1000);
  };

  sellForm.addEventListener("input", updateCreateButtonState);
  sellForm.addEventListener("change", updateCreateButtonState);
  updateCreateButtonState();

  sellForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setNotice(notice, "");
    if (!canSubmitAgain()) {
      updateCreateButtonState();
      return;
    }
    setCreateButtonLoading(true);

    const formData = new FormData(sellForm);
    const tokenValue = tokenInput.value.trim();
    if (tokenValue) {
      formData.set("seller_token", tokenValue);
    }
    const publicEmail = String(formData.get("public_email") || "").trim().replace(/\s+/g, "");
    const publicPhone = String(formData.get("public_phone") || "").trim();
    if (publicEmail) {
      formData.set("public_email", publicEmail);
    }
    if (publicPhone) {
      formData.set("public_phone", publicPhone);
    }

    const selectedFeatures = [];
    const selectedFaults = [];
    const selectedPaymentMethods = [];
    const selectedPublicPhoneMethods = [];
    featureOptions.forEach((item, index) => {
      if (sellForm[`feature_${index}`].checked) {
        selectedFeatures.push(item);
      }
    });
    faultOptions.forEach((item, index) => {
      if (sellForm[`fault_${index}`].checked) {
        selectedFaults.push(item);
      }
    });
    paymentMethodOptions.forEach((item, index) => {
      if (sellForm[`payment_method_${index}`].checked) {
        selectedPaymentMethods.push(item.value);
      }
    });
    contactMethodOptions.forEach((item, index) => {
      if (sellForm[`public_phone_method_${index}`] && sellForm[`public_phone_method_${index}`].checked) {
        selectedPublicPhoneMethods.push(item.value);
      }
    });

    formData.set("features_json", JSON.stringify(selectedFeatures));
    formData.set("faults_json", JSON.stringify(selectedFaults));
    formData.set("payment_methods_json", JSON.stringify(selectedPaymentMethods));
    formData.set("public_phone_methods_json", JSON.stringify(selectedPublicPhoneMethods));

    const files = Array.from(sellForm.images.files || []).slice(0, maxImageCount);
    const submissionSnapshot = snapshotListingForm();
    const submissionHadImages = files.length > 0;
    formData.delete("images");

    for (const file of files) {
      const processed = await compressImage(file);
      formData.append("images", processed, processed.name);
    }

    const token = getTurnstileResponse(sellForm);
    if (token === null) {
      setNotice(notice, "Turnstile is not ready yet. Please wait a moment and try again.", "error");
      return;
    }
    if (token) {
      formData.append("cf_turnstile_response", token);
    }

    const response = await apiPostForm("/api/listing/create", formData);
    if (response.ok) {
      if (response.seller_token) {
        localStorage.setItem("seller_token", response.seller_token);
        tokenInput.value = response.seller_token;
        toggleCopyButton();
      }
      const hasLock = selectedFeatures.includes("Lock included");
      const summaryText = buildListingSummary({
        type: formData.get("type"),
        condition: formData.get("condition"),
        location: formData.get("location"),
        wheelSize: formData.get("wheel_size_in"),
        hasLock
      });
      const tokenAvailable = tokenInput.value.trim();
      const copyButtonHtml = tokenAvailable
        ? `<div class="inline-actions"><button class="button secondary" type="button" id="copyTokenInline">Copy token</button></div>`
        : "";
      setNotice(
        notice,
        `Listing created. Do not forget to copy and save your seller token.${copyButtonHtml}<div class="helper">${summaryText}</div>`,
        "ok"
      );
      const inlineCopyButton = qs("#copyTokenInline", notice);
      if (inlineCopyButton) {
        inlineCopyButton.addEventListener("click", () => copyTokenToClipboard(notice));
      }
      lastSubmissionSnapshot = submissionSnapshot;
      lastSubmissionHadImages = submissionHadImages;
      cooldownUntil = Date.now() + 20000;
      startCooldownTimer();
      setTimeout(() => {
        refreshListings().catch(() => {});
      }, 1000);
    } else {
      setNotice(notice, formatListingError(response.error, maxImageCount), "error");
    }
    resetTurnstile(sellForm);
    setCreateButtonLoading(false);
    updateCreateButtonState();
  });
}

async function compressImage(file) {
  try {
    const imageBitmap = await createImageBitmap(file);
    const maxSize = 1600;
    let { width, height } = imageBitmap;
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = Math.round((height / width) * maxSize);
        width = maxSize;
      } else {
        width = Math.round((width / height) * maxSize);
        height = maxSize;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/webp", 0.82)
    );
    if (!blob) {
      return file;
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
  } catch (error) {
    return file;
  }
}

function renderDashboard() {
  setActiveNav("/dashboard");
  const savedToken = localStorage.getItem("seller_token") || "";
  app.innerHTML = `
    <section class="section">
      <div class="section-title">Seller dashboard</div>
      <div class="card">
        <div class="form-row">
          <label>
            Seller token
            <input type="text" id="dashboardToken" value="${savedToken}" />
          </label>
          <div class="inline-actions">
            <button class="button" id="dashboardLoad">Open dashboard</button>
            <button class="button ghost" id="dashboardPaste">Paste token</button>
            <button class="button ghost" id="dashboardClear">Clear token</button>
          </div>
        </div>
        <div class="helper">Logging in extends your listings once per day.</div>
      </div>

      <div id="dashboardNotice"></div>
      <div id="dashboardContent"></div>
    </section>
  `;

  qs("#dashboardLoad").addEventListener("click", () => {
    const token = qs("#dashboardToken").value.trim();
    if (token) {
      localStorage.setItem("seller_token", token);
      loadDashboard(token);
    }
  });

  qs("#dashboardClear").addEventListener("click", () => {
    localStorage.removeItem("seller_token");
    qs("#dashboardToken").value = "";
  });

  qs("#dashboardPaste").addEventListener("click", async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      alert("Clipboard access is not available.");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      qs("#dashboardToken").value = text.trim();
    } catch (error) {
      alert("Could not paste token.");
    }
  });

  if (savedToken) {
    loadDashboard(savedToken);
  }
}

async function loadDashboard(token) {
  const notice = qs("#dashboardNotice");
  const content = qs("#dashboardContent");
  setNotice(notice, "Loading...");
  content.innerHTML = "";

  const response = await apiPostJson("/api/seller/open-dashboard", { seller_token: token });
  if (!response.ok) {
    setNotice(notice, response.error || "Could not open dashboard.", "error");
    return;
  }

  if (response.extension_applied) {
    setNotice(notice, "Listings extended by 30 days.", "ok");
  } else {
    setNotice(notice, "Dashboard loaded.", "ok");
  }

  const listings = response.listings || [];
  const contacts = response.contacts || [];

  if (!listings.length) {
    content.innerHTML = `<div class="empty">No listings yet. Create one from the Sell page.</div>`;
    return;
  }

  const contactMap = new Map();
  contacts.forEach((contact) => {
    if (!contactMap.has(contact.listing_id)) {
      contactMap.set(contact.listing_id, []);
    }
    contactMap.get(contact.listing_id).push(contact);
  });

  content.innerHTML = `
    <div class="card-grid">
      ${listings
        .map((listing) => {
          const listingContacts = contactMap.get(listing.listing_id) || [];
          const isActive = listing.status === "active";
          return `
            <div class="card ${listing.status !== "active" ? "muted" : ""}">
              <div class="card-header">
                <div class="card-title">${listing.brand || "Bike"}</div>
                <div class="card-price">${formatPrice(listing.price_sek)}</div>
              </div>
              <div class="card-meta">
                <span>Status: ${listing.status}</span>
                <span>Expires: ${formatDate(listing.expires_at)}</span>
              </div>
              <label>
                New price (SEK)
                <input type="number" data-price="${listing.listing_id}" value="${listing.price_sek}" ${isActive ? "" : "disabled"} />
              </label>
              <div class="inline-actions">
                <button class="button secondary" data-action="update" data-id="${listing.listing_id}" ${isActive ? "" : "disabled"}>Update price</button>
                <button class="button danger" data-action="delete" data-id="${listing.listing_id}">Delete</button>
              </div>
              ${!isActive ? "<div class='helper'>Price updates are only available for active listings.</div>" : ""}
              <div>
                <div class="helper">Buyer contacts</div>
                ${listingContacts.length
                  ? listingContacts
                      .map(
                        (contact) => `
                          <div class="notice contact-message">
                            <div>${contact.buyer_email || "-"} ${contact.buyer_phone || ""}</div>
                            ${contact.buyer_phone_methods && contact.buyer_phone_methods.length
                              ? `<div class="helper">Preferred contact: ${formatContactMethods(contact.buyer_phone_methods)}</div>`
                              : ""}
                            <div>${contact.message}</div>
                            <div class="helper">${formatDateTime(contact.created_at)}</div>
                          </div>
                        `
                      )
                      .join("")
                  : "<div class='helper'>No contacts yet.</div>"}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  qsa("button[data-action='update']", content).forEach((button) => {
    button.addEventListener("click", async () => {
      const listingId = button.dataset.id;
      const priceInput = qs(`input[data-price='${listingId}']`, content);
      const newPrice = Number(priceInput.value);
      const result = await apiPostJson("/api/listing/update-price", {
        seller_token: token,
        listing_id: listingId,
        new_price: newPrice
      });
      if (result.ok) {
        if (result.no_change) {
          alert("Price unchanged.");
        } else {
          alert("Price updated.");
          await refreshListings();
        }
      } else {
        alert(result.error || "Could not update price.");
      }
    });
  });

  qsa("button[data-action='delete']", content).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this listing?")) {
        return;
      }
      const result = await apiPostJson("/api/listing/delete", {
        seller_token: token,
        listing_id: button.dataset.id
      });
      if (result.ok) {
        if (result.already_deleted) {
          alert("Listing already deleted.");
        } else if (!result.deleted) {
          alert("Listing removed from public view.");
        }
        await refreshListings();
        loadDashboard(token);
      } else {
        alert(result.error || "Could not delete listing.");
      }
    });
  });
}

function renderAdmin() {
  setActiveNav("/admin");
  app.innerHTML = `
    <section class="section">
      <div class="section-title">Admin</div>
      <div class="tab-row">
        <button class="tab ${adminState.tab === "overview" ? "active" : ""}" data-tab="overview">Overview</button>
        <button class="tab ${adminState.tab === "analytics" ? "active" : ""}" data-tab="analytics">Analytics</button>
      </div>
      <div id="adminNotice"></div>
      <div id="adminContent"></div>
    </section>
  `;

  qsa("button[data-tab]", app).forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (tab && tab !== adminState.tab) {
        adminState.tab = tab;
        renderAdmin();
      }
    });
  });

  loadAdminTab(adminState.tab);
}

function loadAdminTab(tab) {
  if (tab === "analytics") {
    loadAdminAnalytics();
  } else {
    loadAdminOverview();
  }
}

async function loadAdminOverview() {
  const notice = qs("#adminNotice");
  const content = qs("#adminContent");
  setNotice(notice, "Loading...");

  const response = await apiGet("/api/admin/overview");
  if (!response.ok) {
    if (response.error === "Forbidden.") {
      setNotice(
        notice,
        "Forbidden. Check that Cloudflare Access protects both `/admin` and `/api/admin/*` for your domain.",
        "error"
      );
    } else {
      setNotice(notice, response.error || "Could not load admin data.", "error");
    }
    return;
  }
  setNotice(notice, "", "");

  const listings = response.listings || [];
  const reports = response.reports || [];
  const contacts = response.contacts || [];
  const sellerContacts = listings.filter(
    (listing) => listing.public_email || listing.public_phone
  );
  const sellerContactCards = sellerContacts
    .map((listing) => {
      const images = Array.isArray(listing.image_urls) ? listing.image_urls : [];
      const imageTag = images.length
        ? `<div class="carousel" data-images='${JSON.stringify(images)}'>
            <img src="${images[0]}" alt="Bike photo" loading="lazy" />
            ${images.length > 1 ? `
              <div class="carousel-controls">
                <button type="button" data-action="prev">&#8249;</button>
                <button type="button" data-action="next">&#8250;</button>
              </div>
            ` : ""}
          </div>`
        : `<div class="carousel"><img src="/assets/placeholder.svg" alt="No photo" /></div>`;

      const features = Array.isArray(listing.features) ? listing.features : [];
      const hasLock = features.includes("Lock included");
      const summaryText = buildListingSummary({
        type: listing.type,
        condition: listing.condition,
        location: listing.location,
        wheelSize: listing.wheel_size_in,
        hasLock
      });
      const deliveryText = listing.delivery_possible
        ? `Delivery possible for ${formatPrice(listing.delivery_price_sek)}`
        : "Pickup only";
      const contactMethods = formatContactMethods(listing.public_phone_methods || []);

      return `
        <article class="card">
          ${imageTag}
          <div class="card-header">
            <div class="card-title">${listing.brand || "Bike"}</div>
            <div class="card-price">${formatPrice(listing.price_sek)}</div>
          </div>
          <div class="helper">${summaryText}</div>
          <div class="helper">${deliveryText}</div>
          <div class="helper">Posted ${formatDate(listing.created_at)}</div>
          <div class="notice">
            <div>Email: ${listing.public_email || "-"}</div>
            <div>Phone: ${listing.public_phone || "-"}</div>
            ${contactMethods ? `<div class="helper">Preferred contact: ${contactMethods}</div>` : ""}
          </div>
          <div class="helper">Listing ID: ${listing.listing_id}</div>
          <div class="inline-actions">
            <button class="button secondary" data-action="view" data-id="${listing.listing_id}">View</button>
          </div>
        </article>
      `;
    })
    .join("");

  content.innerHTML = `
    <div class="section">
      <div class="section-title">Listings</div>
      <div class="helper">Drag and drop to reorder listings. Higher in the list means higher rank.</div>
      <div class="card-grid admin-listings" id="adminListings">
        ${listings
          .map(
            (listing, index) => `
              <div class="card admin-listing ${listing.status !== "active" ? "muted" : ""}" draggable="true" data-listing-card data-id="${listing.listing_id}">
                <div class="card-header">
                  <div class="card-title">${listing.brand || "Bike"}</div>
                  <div class="card-price">${formatPrice(listing.price_sek)}</div>
                </div>
                <div class="card-meta">
                  <span>${listing.status}</span>
                  <span>Position: ${index + 1}</span>
                  <span>Expires: ${formatDate(listing.expires_at)}</span>
                </div>
                <div class="inline-actions">
                  <button class="button secondary" data-action="edit" data-id="${listing.listing_id}">Edit</button>
                  <button class="button danger" data-action="delete" data-id="${listing.listing_id}">Delete</button>
                </div>
                ${listing.ip_hash ? `<button class="button ghost" data-action="block" data-ip="${listing.ip_hash}">Block IP</button>` : ""}
                <div class="drag-handle">Drag to reorder</div>
              </div>
            `
          )
          .join("")}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Reports</div>
      ${reports.length
        ? reports
            .map(
              (report) => `
                <div class="card">
                  <div class="card-header">
                    <div class="card-title">${report.reason}</div>
                    <div class="helper">${report.status}</div>
                  </div>
                  <div class="helper">${formatDateTime(report.created_at)}</div>
                  <div class="inline-actions">
                    <button class="button secondary" data-action="view-report" data-id="${report.report_id}">View</button>
                    <button class="button" data-action="done-report" data-id="${report.report_id}">Done</button>
                  </div>
                </div>
              `
            )
            .join("")
        : `<div class="empty">No reports.</div>`}
    </div>

    <div class="section">
      <div class="section-title">Seller contacts</div>
      <div class="helper">Shown when sellers choose public contact info.</div>
      ${sellerContacts.length
        ? `<div class="card-grid" id="adminSellerContacts">${sellerContactCards}</div>`
        : `<div class="empty">No seller contacts.</div>`}
    </div>

    <div class="section">
      <div class="section-title">Buyer contacts</div>
      ${contacts.length
        ? contacts
            .map(
              (contact) => `
                <div class="card">
                  <div class="card-header">
                    <div class="card-title">Listing ${contact.listing_id}</div>
                    <div class="helper">${formatDateTime(contact.created_at)}</div>
                  </div>
                  <div>${contact.buyer_email || "-"} ${contact.buyer_phone || ""}</div>
                  ${contact.buyer_phone_methods && contact.buyer_phone_methods.length
                    ? `<div class="helper">Preferred contact: ${formatContactMethods(contact.buyer_phone_methods)}</div>`
                    : ""}
                  <div>${contact.message}</div>
                </div>
              `
            )
            .join("")
        : `<div class="empty">No contacts.</div>`}
    </div>

    <div class="modal" id="reportViewModal">
      <div class="modal-card">
        <div class="section-title">Report details</div>
        <div id="reportDetails"></div>
        <div class="inline-actions">
          <button class="button secondary" id="closeReportView">Close</button>
        </div>
      </div>
    </div>

    <div class="modal" id="adminEditModal"></div>
  `;

  const listingById = new Map(listings.map((listing) => [listing.listing_id, listing]));

  const listingGrid = qs("#adminListings", content);
  if (listingGrid) {
    let dragging = null;
    listingGrid.addEventListener("dragstart", (event) => {
      const card = event.target.closest("[data-listing-card]");
      if (!card) {
        return;
      }
      dragging = card;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.id || "");
    });
    listingGrid.addEventListener("dragover", (event) => {
      if (!dragging) {
        return;
      }
      const card = event.target.closest("[data-listing-card]");
      if (!card || card === dragging) {
        return;
      }
      event.preventDefault();
      const rect = card.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      if (after) {
        card.after(dragging);
      } else {
        card.before(dragging);
      }
    });
    listingGrid.addEventListener("dragend", async () => {
      if (!dragging) {
        return;
      }
      dragging.classList.remove("dragging");
      dragging = null;
      const order = Array.from(listingGrid.querySelectorAll("[data-listing-card]")).map(
        (item) => item.dataset.id
      );
      const result = await apiPostJson("/api/admin/reorder-listings", { listing_ids: order });
      if (result.ok) {
        await refreshListings();
        loadAdminOverview();
      } else {
        alert(result.error || "Could not update order.");
      }
    });
  }

  const sellerGrid = qs("#adminSellerContacts", content);
  if (sellerGrid) {
    qsa("button[data-action='view']", sellerGrid).forEach((button) => {
      button.addEventListener("click", () => {
        navigate(`/listing/${button.dataset.id}`);
      });
    });
    setupCarousels(sellerGrid);
  }

  const editModal = qs("#adminEditModal", content);
  const openEditModal = (listing) => {
    if (!editModal) {
      return;
    }

    const features = Array.isArray(listing.features) ? listing.features : [];
    const faults = Array.isArray(listing.faults) ? listing.faults : [];
    const paymentMethods = Array.isArray(listing.payment_methods) ? listing.payment_methods : [];
    const publicPhoneMethodList = Array.isArray(listing.public_phone_methods)
      ? listing.public_phone_methods
      : [];
    const images = Array.isArray(listing.image_urls) ? listing.image_urls : [];
    const isPublicContact = listing.contact_mode === "public_contact";
    const deliveryPossible = Boolean(listing.delivery_possible);
    const currencyMode = listing.currency_mode || "sek_only";

    const priceValue = listing.price_sek === null || listing.price_sek === undefined ? "" : listing.price_sek;
    const brandValue = escapeHtml(listing.brand || "");
    const wheelValue =
      listing.wheel_size_in === null || listing.wheel_size_in === undefined ? "" : listing.wheel_size_in;
    const locationValue = escapeHtml(listing.location || "");
    const descriptionValue = escapeHtml(listing.description || "");
    const publicEmailValue = escapeHtml(listing.public_email || "");
    const publicPhoneValue = escapeHtml(listing.public_phone || "");
    const deliveryPriceValue =
      listing.delivery_price_sek === null || listing.delivery_price_sek === undefined
        ? ""
        : listing.delivery_price_sek;

    const typeOptions = listingTypes
      .map(
        (item) =>
          `<option value="${escapeHtml(item)}" ${item === listing.type ? "selected" : ""}>${escapeHtml(item)}</option>`
      )
      .join("");
    const conditionOptionsHtml = conditionOptions
      .map(
        (item) =>
          `<option value="${escapeHtml(item)}" ${item === listing.condition ? "selected" : ""}>${escapeHtml(item)}</option>`
      )
      .join("");

    const currencyOptionsHtml = currencyModeOptions
      .map(
        (option) => `
          <label class="tag">
            <input type="radio" name="currency_mode" value="${option.value}" ${option.value === currencyMode ? "checked" : ""} />
            ${option.label}
          </label>
        `
      )
      .join("");

    const paymentOptionsHtml = paymentMethodOptions
      .map(
        (option, index) => `
          <label class="tag">
            <input type="checkbox" name="payment_method_${index}" value="${option.value}" ${paymentMethods.includes(option.value) ? "checked" : ""} />
            ${option.label}
          </label>
        `
      )
      .join("");

    const featureOptionsHtml = featureOptions
      .map(
        (item, index) => `
          <label class="tag">
            <input type="checkbox" name="feature_${index}" value="${escapeHtml(item)}" ${features.includes(item) ? "checked" : ""} />
            ${escapeHtml(item)}
          </label>
        `
      )
      .join("");

    const faultOptionsHtml = faultOptions
      .map(
        (item, index) => `
          <label class="tag">
            <input type="checkbox" name="fault_${index}" value="${escapeHtml(item)}" ${faults.includes(item) ? "checked" : ""} />
            ${escapeHtml(item)}
          </label>
        `
      )
      .join("");

    const contactOptionsHtml = contactMethodOptions
      .map(
        (option, index) => `
          <label class="tag">
            <input type="checkbox" name="public_phone_method_${index}" value="${option.value}" ${publicPhoneMethodList.includes(option.value) ? "checked" : ""} />
            ${option.label}
          </label>
        `
      )
      .join("");

    const imagePreview = images.length
      ? images.map((url) => `<img src="${escapeHtml(url)}" alt="Listing photo" />`).join("")
      : `<div class="helper">No images uploaded.</div>`;

    editModal.innerHTML = `
      <div class="modal-card modal-wide">
        <div class="section-title">Edit listing</div>
        <div class="helper">Listing ID: ${listing.listing_id}</div>
        <form class="form" id="adminEditForm">
          <input type="hidden" name="listing_id" value="${escapeHtml(listing.listing_id)}" />
          <div class="form-row">
            <label>
              Price (SEK)
              <input type="number" name="price_sek" min="0" required value="${escapeHtml(priceValue)}" />
            </label>
            <label>
              Brand
              <input type="text" name="brand" maxlength="40" required value="${brandValue}" />
            </label>
            <label>
              Type
              <select name="type" required>
                ${typeOptions}
              </select>
            </label>
            <label>
              Condition
              <select name="condition" required>
                ${conditionOptionsHtml}
              </select>
            </label>
          </div>

          <div>
            <div class="helper">Accepted currency</div>
            <div class="tag-list" id="adminCurrencyMode">
              ${currencyOptionsHtml}
            </div>
          </div>

          <div>
            <div class="helper">Payment methods</div>
            <div class="tag-list" id="adminPaymentMethods">
              ${paymentOptionsHtml}
            </div>
            <div class="helper">Mention other payment method in description.</div>
          </div>

          <div class="form-row">
            <label>
              Wheel size (inches)
              <input type="number" name="wheel_size_in" min="10" max="36" step="0.5" required value="${escapeHtml(wheelValue)}" />
            </label>
            <label>
              Location (max 25 chars)
              <input type="text" name="location" list="adminLocationList" maxlength="25" required value="${locationValue}" />
              <datalist id="adminLocationList">
                ${locationSuggestions.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("")}
              </datalist>
            </label>
          </div>

          <div>
            <div class="helper">Delivery in Linkoping</div>
            <div class="tag-list" id="adminDeliveryOptions">
              <label class="tag">
                <input type="radio" name="delivery_possible" value="no" ${deliveryPossible ? "" : "checked"} /> No delivery
              </label>
              <label class="tag">
                <input type="radio" name="delivery_possible" value="yes" ${deliveryPossible ? "checked" : ""} /> Delivery available
              </label>
            </div>
            <div id="adminDeliveryPriceFields" style="display: ${deliveryPossible ? "block" : "none"};">
              <label>
                Delivery price (SEK)
                <input type="number" name="delivery_price_sek" min="0" step="1" value="${escapeHtml(deliveryPriceValue)}" />
              </label>
            </div>
          </div>

          <label>
            Description (optional, max 150 chars)
            <textarea name="description" maxlength="150">${descriptionValue}</textarea>
          </label>

          <div>
            <div class="helper">Features</div>
            <div class="tag-list">
              ${featureOptionsHtml}
            </div>
          </div>

          <div>
            <div class="helper">Faults</div>
            <div class="tag-list">
              ${faultOptionsHtml}
            </div>
          </div>

          <div>
            <div class="helper">Contact mode</div>
            <div class="tag-list" id="adminContactMode">
              <label class="tag">
                <input type="radio" name="contact_mode" value="buyer_message" ${isPublicContact ? "" : "checked"} /> Buyer message
              </label>
              <label class="tag">
                <input type="radio" name="contact_mode" value="public_contact" ${isPublicContact ? "checked" : ""} /> Public contact
              </label>
            </div>
          </div>

          <div id="adminPublicContactFields" style="display: ${isPublicContact ? "block" : "none"};">
            <div class="form-row">
              <label>
                Public email (optional)
                <input type="email" name="public_email" value="${publicEmailValue}" />
              </label>
              <label>
                Public phone (optional)
                <input type="tel" name="public_phone" value="${publicPhoneValue}" />
              </label>
            </div>
            <div id="adminPublicPhoneMethods" style="display: ${isPublicContact && publicPhoneValue ? "block" : "none"};">
              <div class="helper">Preferred contact</div>
              <div class="tag-list">
                ${contactOptionsHtml}
              </div>
            </div>
          </div>

          <div>
            <div class="helper">Current images</div>
            <div class="admin-image-grid">${imagePreview}</div>
          </div>

          <label>
            Replace images (optional, max ${maxImageCount})
            <input type="file" name="images" accept="image/png,image/jpeg,image/webp" multiple />
          </label>
          <div class="tag-list">
            <label class="tag">
              <input type="checkbox" name="clear_images" value="1" /> Remove existing images
            </label>
          </div>

          <div class="notice">
            <div class="helper">Seller tokens are hashed and cannot be viewed. Generate a new token to log in as the seller.</div>
            <div class="inline-actions">
              <button class="button secondary" type="button" id="adminResetToken">Generate new token</button>
            </div>
            <div id="adminTokenResult"></div>
          </div>

          <div class="inline-actions">
            <button class="button" type="submit" id="adminEditSave">Save changes</button>
            <button class="button secondary" type="button" id="adminEditCancel">Cancel</button>
          </div>
          <div id="adminEditNotice"></div>
        </form>
      </div>
    `;

    editModal.classList.add("active");

    const editForm = qs("#adminEditForm", editModal);
    const editNotice = qs("#adminEditNotice", editModal);
    const cancelButton = qs("#adminEditCancel", editModal);
    const saveButton = qs("#adminEditSave", editModal);
    const tokenResult = qs("#adminTokenResult", editModal);
    const resetTokenButton = qs("#adminResetToken", editModal);

    const closeModal = () => {
      editModal.classList.remove("active");
    };

    cancelButton.addEventListener("click", closeModal);
    editModal.addEventListener("click", (event) => {
      if (event.target === editModal) {
        closeModal();
      }
    });

    const contactMode = qs("#adminContactMode", editModal);
    const publicFields = qs("#adminPublicContactFields", editModal);
    const publicPhoneInput = qs("input[name='public_phone']", editForm);
    const publicPhoneMethods = qs("#adminPublicPhoneMethods", editModal);

    const togglePublicPhoneMethods = () => {
      const mode = qs("input[name='contact_mode']:checked", editForm).value;
      const hasPhone = publicPhoneInput && publicPhoneInput.value.trim().length > 0;
      if (publicFields) {
        publicFields.style.display = mode === "public_contact" ? "block" : "none";
      }
      if (publicPhoneMethods) {
        publicPhoneMethods.style.display = mode === "public_contact" && hasPhone ? "block" : "none";
        if (!hasPhone || mode !== "public_contact") {
          qsa("input[type='checkbox']", publicPhoneMethods).forEach((input) => {
            input.checked = false;
          });
        }
      }
    };

    if (contactMode) {
      contactMode.addEventListener("change", togglePublicPhoneMethods);
    }
    if (publicPhoneInput) {
      publicPhoneInput.addEventListener("input", togglePublicPhoneMethods);
    }
    togglePublicPhoneMethods();

    const deliveryOptions = qs("#adminDeliveryOptions", editModal);
    const deliveryPriceFields = qs("#adminDeliveryPriceFields", editModal);
    if (deliveryOptions && deliveryPriceFields) {
      deliveryOptions.addEventListener("change", () => {
        const choice = qs("input[name='delivery_possible']:checked", editForm).value;
        if (choice === "yes") {
          deliveryPriceFields.style.display = "block";
        } else {
          deliveryPriceFields.style.display = "none";
          const priceInput = qs("input[name='delivery_price_sek']", deliveryPriceFields);
          if (priceInput) {
            priceInput.value = "";
          }
        }
      });
    }

    if (resetTokenButton) {
      resetTokenButton.addEventListener("click", async () => {
        if (!confirm("Generate a new seller token? The old token will stop working.")) {
          return;
        }
        setNotice(tokenResult, "Generating token...");
        const result = await apiPostJson("/api/admin/reset-seller-token", { listing_id: listing.listing_id });
        if (result.ok) {
          const token = result.seller_token;
          tokenResult.innerHTML = `
            <div class="notice ok">
              New token: <strong>${escapeHtml(token)}</strong>
              <div class="inline-actions">
                <button class="button secondary" type="button" id="adminCopyToken">Copy token</button>
              </div>
            </div>
          `;
          const copyButton = qs("#adminCopyToken", tokenResult);
          if (copyButton) {
            copyButton.addEventListener("click", async () => {
              if (!navigator.clipboard || !navigator.clipboard.writeText) {
                setNotice(editNotice, "Clipboard access is not available.", "error");
                return;
              }
              try {
                await navigator.clipboard.writeText(token);
                setNotice(editNotice, "Token copied.", "ok");
              } catch (error) {
                setNotice(editNotice, "Could not copy token.", "error");
              }
            });
          }
        } else {
          setNotice(tokenResult, result.error || "Could not reset token.", "error");
        }
      });
    }

    const setSaving = (isSaving) => {
      saveButton.classList.toggle("loading", isSaving);
      saveButton.disabled = isSaving;
      saveButton.textContent = isSaving ? "Saving..." : "Save changes";
    };

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setNotice(editNotice, "");
      setSaving(true);

      const formData = new FormData(editForm);
      const publicEmail = String(formData.get("public_email") || "").trim().replace(/\s+/g, "");
      const publicPhone = String(formData.get("public_phone") || "").trim();
      if (publicEmail) {
        formData.set("public_email", publicEmail);
      }
      if (publicPhone) {
        formData.set("public_phone", publicPhone);
      }

      const selectedFeatures = [];
      const selectedFaults = [];
      const selectedPaymentMethods = [];
      const selectedPublicPhoneMethods = [];

      featureOptions.forEach((item, index) => {
        if (editForm[`feature_${index}`] && editForm[`feature_${index}`].checked) {
          selectedFeatures.push(item);
        }
      });
      faultOptions.forEach((item, index) => {
        if (editForm[`fault_${index}`] && editForm[`fault_${index}`].checked) {
          selectedFaults.push(item);
        }
      });
      paymentMethodOptions.forEach((item, index) => {
        if (editForm[`payment_method_${index}`] && editForm[`payment_method_${index}`].checked) {
          selectedPaymentMethods.push(item.value);
        }
      });
      contactMethodOptions.forEach((item, index) => {
        if (editForm[`public_phone_method_${index}`] && editForm[`public_phone_method_${index}`].checked) {
          selectedPublicPhoneMethods.push(item.value);
        }
      });

      formData.set("features_json", JSON.stringify(selectedFeatures));
      formData.set("faults_json", JSON.stringify(selectedFaults));
      formData.set("payment_methods_json", JSON.stringify(selectedPaymentMethods));
      formData.set("public_phone_methods_json", JSON.stringify(selectedPublicPhoneMethods));

      const files = Array.from(editForm.images.files || []).slice(0, maxImageCount);
      formData.delete("images");
      for (const file of files) {
        const processed = await compressImage(file);
        formData.append("images", processed, processed.name);
      }

      const response = await apiPostForm("/api/admin/update-listing", formData);
      if (response.ok) {
        setNotice(editNotice, "Listing updated.", "ok");
        await refreshListings();
        loadAdminOverview();
        closeModal();
      } else {
        setNotice(editNotice, formatListingError(response.error, maxImageCount), "error");
      }
      setSaving(false);
    });
  };

  qsa("button[data-action='edit']", content).forEach((button) => {
    button.addEventListener("click", () => {
      const listing = listingById.get(button.dataset.id);
      if (listing) {
        openEditModal(listing);
      }
    });
  });

  qsa("button[data-action='delete']", content).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this listing?")) {
        return;
      }
      const result = await apiPostJson("/api/admin/delete-listing", { listing_id: button.dataset.id });
      if (result.ok) {
        await refreshListings();
        loadAdminOverview();
      } else {
        alert(result.error || "Could not delete listing.");
      }
    });
  });

  qsa("button[data-action='block']", content).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Block this IP hash?")) {
        return;
      }
      const result = await apiPostJson("/api/admin/block-ip", { ip_hash: button.dataset.ip });
      if (result.ok) {
        alert("IP blocked.");
      } else {
        alert(result.error || "Could not block IP.");
      }
    });
  });

  const reportModal = qs("#reportViewModal");
  const reportDetails = qs("#reportDetails");
  const closeReportView = qs("#closeReportView");

  qsa("button[data-action='view-report']", content).forEach((button) => {
    button.addEventListener("click", async () => {
      const reportId = button.dataset.id;
      const report = reports.find((item) => item.report_id === reportId);
      if (!report) {
        return;
      }
      reportDetails.innerHTML = `
        <div class="notice">
          <div><strong>Reason:</strong> ${report.reason}</div>
          <div><strong>Details:</strong> ${report.details || "-"}</div>
          <div><strong>Listing:</strong> ${report.listing_id}</div>
          <div class="helper">${formatDateTime(report.created_at)}</div>
        </div>
      `;
      reportModal.classList.add("active");
      if (report.status === "open") {
        await apiPostJson("/api/admin/report-status", { report_id: reportId, status: "under_review" });
        report.status = "under_review";
      }
    });
  });

  qsa("button[data-action='done-report']", content).forEach((button) => {
    button.addEventListener("click", async () => {
      const reportId = button.dataset.id;
      const result = await apiPostJson("/api/admin/report-status", { report_id: reportId, status: "done" });
      if (result.ok) {
        if (result.no_change) {
          alert("Report already marked as done.");
        }
        loadAdminOverview();
      } else {
        alert(result.error || "Could not mark done.");
      }
    });
  });

  closeReportView.addEventListener("click", () => reportModal.classList.remove("active"));
}

async function loadAdminAnalytics() {
  const notice = qs("#adminNotice");
  const content = qs("#adminContent");
  setNotice(notice, "Loading...");

  const response = await apiGet("/api/admin/usage");
  if (!response.ok) {
    setNotice(notice, response.error || "Could not load analytics.", "error");
    return;
  }
  setNotice(notice, "", "");

  const usage = response.usage || {};
  const limits = response.limits || {};
  const cutoff = response.cutoff || {};
  const estimate = response.estimate || {};

  const classAPercent = limits.class_a_ops ? usage.class_a_ops / limits.class_a_ops : 0;
  const classBPercent = limits.class_b_ops ? usage.class_b_ops / limits.class_b_ops : 0;
  const storagePercent = limits.storage_bytes ? usage.storage_bytes / limits.storage_bytes : 0;
  const totalRequests = (usage.class_a_ops || 0) + (usage.class_b_ops || 0);

  const statusClass = response.blocked && !response.override_enabled ? "error" : "ok";
  const statusText = response.blocked && !response.override_enabled ? "Paused" : "Active";
  const statusDetail = response.override_enabled
    ? "Override enabled"
    : response.blocked
      ? "Limit nearly reached"
      : "Within free tier";

  const resetLabel = response.reset_at ? formatDateTime(response.reset_at) : "-";
  const cutoffPercent = formatPercent(limits.cutoff_fraction ?? 0.99);

  content.innerHTML = `
    <div class="section">
      <div class="card">
        <div class="section-title">Service status</div>
        <div class="helper">Monthly reset: ${resetLabel}</div>
        <div class="notice ${statusClass}">${statusText} - ${statusDetail}</div>
        <div class="inline-actions">
          <button class="button ${response.override_enabled ? "secondary" : ""}" id="usageOverride" data-enabled="${response.override_enabled}">
            ${response.override_enabled ? "Disable override" : "Enable override"}
          </button>
        </div>
        <div class="helper">Cutoff triggers at ${cutoffPercent} of the free tier.</div>
      </div>

      <div class="card-grid">
        <div class="card">
          <div class="card-title">R2 requests this month</div>
          <div>Class A: ${formatNumber(usage.class_a_ops)} / ${formatNumber(limits.class_a_ops)} (${formatPercent(classAPercent)})</div>
          <div>Class B: ${formatNumber(usage.class_b_ops)} / ${formatNumber(limits.class_b_ops)} (${formatPercent(classBPercent)})</div>
          <div>Total: ${formatNumber(totalRequests)}</div>
          <div class="helper">API requests tracked: ${formatNumber(usage.api_requests)}</div>
          <div class="helper">Cutoff: ${formatNumber(cutoff.class_a_ops)} / ${formatNumber(cutoff.class_b_ops)}</div>
        </div>

        <div class="card">
          <div class="card-title">Storage</div>
          <div>Stored: ${formatBytes(usage.storage_bytes)} (${formatPercent(storagePercent)})</div>
          <div>Free tier: ${formatBytes(limits.storage_bytes)}</div>
          <div class="helper">Cutoff: ${formatBytes(cutoff.storage_bytes)}</div>
        </div>

        <div class="card">
          <div class="card-title">Estimated cost (USD)</div>
          <div>Storage: ${formatMoney(estimate.storage_cost)}</div>
          <div>Class A: ${formatMoney(estimate.class_a_cost)}</div>
          <div>Class B: ${formatMoney(estimate.class_b_cost)}</div>
          <div class="card-price">${formatMoney(estimate.total_cost)}</div>
          <div class="helper">Based on Cloudflare R2 pricing.</div>
        </div>
      </div>

      <div class="notice">${response.note || "Estimated usage only."}</div>
    </div>
  `;

  const overrideButton = qs("#usageOverride");
  if (overrideButton) {
    overrideButton.addEventListener("click", async () => {
      overrideButton.disabled = true;
      const nextEnabled = overrideButton.dataset.enabled !== "true";
      const result = await apiPostJson("/api/admin/usage-override", { enabled: nextEnabled });
      if (result.ok) {
        adminState.tab = "analytics";
        renderAdmin();
      } else {
        overrideButton.disabled = false;
        alert(result.error || "Could not update override.");
      }
    });
  }
}

function renderAboutLegacy() {
  setActiveNav("/about");
  app.innerHTML = `
    <section class="section">
      <div class="section-title">About</div>
      <div class="card">
        <div class="card-title">About this marketplace</div>
        <div class="helper">
          This is a simple, local marketplace for bikes in Linköping. Browse listings, open a bike, and contact the seller.
          Sellers can post a listing without creating an account.
        </div>
        <div class="helper">
          Buyers: open a listing and either use the contact form or the public contact details.
          Sellers: create a listing and keep your seller token to manage price or delete the listing later.
        </div>
      </div>
      <div class="card">
        <div class="card-title">About us</div>
        <div class="helper">
          We are locals who want a clean and easy way to buy and sell bikes without noise or paywalls.
        </div>
      </div>
      <div class="card">
        <div class="card-title">Q&A</div>
        <div class="notice">
          <div><strong>Do I need an account?</strong> No. You get a private seller token instead.</div>
          <div><strong>How long does a listing stay?</strong> 39 days by default, extended when you open your dashboard.</div>
          <div><strong>How do I remove a listing?</strong> Use your seller token in the dashboard to delete it.</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">About privacy</div>
        <div class="helper">
          We do not want sensitive personal information posted here. Buyer contact messages and IP hashes are removed after 30 days.
          Please be careful about what you share. Reports are kept up to one year for safety review.
        </div>
      </div>
    </section>
  `;
}

function renderAbout() {
  setActiveNav("/about");
  app.innerHTML = `
    <section class="section">
      <div class="section-title">About</div>
      <div class="card">
        <div class="card-title">About this marketplace</div>
        <div class="helper">
          This is a local bike marketplace for Linköping. Posting and buying are free, and we will do our best to keep it
          that way even if hosting limits grow.
        </div>
        <div class="helper">
          Listings go live instantly. Moderation happens through reports sent to the admins. Bikes only for now.
        </div>
        <div class="helper">
          Buyers browse listings and contact sellers directly. Sellers post without an account and receive a private seller
          token. You can edit price with the token; for other changes, delete the listing and create a new one.
        </div>
        <div class="helper">
          We Buy Your Bike is a separate option under the Sell tab. It gives students a quick quote and pickup at the end
          of the semester, then we repair and resell the bikes to new students.
        </div>
      </div>
      <div class="card">
        <div class="card-title">About us</div>
        <div class="helper">
          We are a small group of students who moved to Linköping for our studies and like working on bikes and solving
          problems. After struggling to find good bikes ourselves, we wanted to make it easier for others here.
        </div>
        <div class="helper">
          We keep the service simple and semi-anonymous. We do not want to collect data on people and only keep what is
          needed to run the marketplace safely.
        </div>
        <div class="helper">Contact: webuyyourbike.linkoping@gmail.com</div>
      </div>
      <div class="card">
        <div class="card-title">Q&A</div>
        <div class="notice">
          <div><strong>Do I need an account?</strong> No. You get a private seller token instead.</div>
          <div><strong>Is it free?</strong> Yes. Posting and buying are free, and we plan to keep it free even if the site grows.</div>
          <div><strong>What can I list?</strong> Bikes only, in Linköping.</div>
          <div><strong>How long does a listing stay?</strong> 39 days by default, extended when you open your dashboard.</div>
          <div><strong>Can I edit a listing?</strong> You can edit the price only. For other changes, delete the listing and create a new one.</div>
          <div><strong>I lost my seller token.</strong> Open the listing, press report, choose "Other", and tell us you lost the token and want it removed.</div>
          <div><strong>How do I remove a listing?</strong> Use your seller token in the dashboard to delete it.</div>
          <div><strong>How do I report a listing?</strong> Open the listing and press the report button. Reports are reviewed by admins.</div>
          <div><strong>Are duplicates allowed?</strong> Please avoid duplicate listings and keep one listing per bike.</div>
          <div><strong>Any safety tips?</strong> Meet in public, bring a friend, and trust your gut if something feels off.</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Contact</div>
        <div class="helper">
          Contact us if you see a suspected stolen bike, harmful content, harassment, or anything that feels unsafe. You
          can also reach out with questions, feedback, or other issues.
        </div>
        <div class="helper">
          For a specific listing, please use the report button on that listing when possible so we can review it faster.
        </div>
        <div class="helper">Email: webuyyourbike.linkoping@gmail.com</div>
      </div>
      <div class="card">
        <div class="card-title">About privacy</div>
        <div class="helper">
          We aim to run the marketplace semi-anonymously and avoid collecting personal data. There are no accounts, and
          sharing contact details is optional. Buyer contact messages and IP hashes are removed after 30 days.
        </div>
        <div class="helper">
          Please be careful about what you share. Reports are kept up to one year for safety review.
        </div>
      </div>
    </section>
  `;
}

function renderNotFound() {
  setActiveNav("");
  app.innerHTML = `<div class="empty">Page not found. <a href="/">Back to browse</a></div>`;
}

async function renderRoute() {
  const route = getRoute();
  if (!state.listingsLoaded) {
    await loadListings();
  }

  switch (route.name) {
    case "home":
      renderHome();
      break;
    case "listing":
      renderListingDetail(route);
      break;
    case "sell":
      renderSell();
      break;
    case "about":
      renderAbout();
      break;
    case "dashboard":
      renderDashboard();
      break;
    case "admin":
      renderAdmin();
      break;
    default:
      renderNotFound();
  }
}

function setupCarousels(root) {
  qsa(".carousel", root).forEach((carousel) => {
    const images = JSON.parse(carousel.dataset.images || "[]");
    if (!images.length) {
      return;
    }
    let index = 0;
    const img = qs("img", carousel);
    const buttons = qsa("button", carousel);
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.action === "prev") {
          index = (index - 1 + images.length) % images.length;
        } else {
          index = (index + 1) % images.length;
        }
        img.src = images[index];
      });
    });
  });
}

let turnstilePromise = null;

function setupTurnstile(root) {
  if (!config.turnstileSiteKey) {
    return;
  }
  const containers = qsa(".turnstile", root);
  if (!containers.length) {
    return;
  }
  loadTurnstileScript().then(() => {
    containers.forEach((container) => {
      if (container.dataset.widgetId) {
        return;
      }
      const widgetId = window.turnstile.render(container, {
        sitekey: config.turnstileSiteKey
      });
      container.dataset.widgetId = String(widgetId);
    });
  });
}

function loadTurnstileScript() {
  if (turnstilePromise) {
    return turnstilePromise;
  }
  turnstilePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });
  return turnstilePromise;
}

function getTurnstileResponse(form) {
  if (!config.turnstileSiteKey) {
    return "";
  }
  const container = form.querySelector(".turnstile");
  if (!container || !container.dataset.widgetId || !window.turnstile) {
    return null;
  }
  return window.turnstile.getResponse(container.dataset.widgetId);
}

function resetTurnstile(form) {
  if (!window.turnstile) {
    return;
  }
  const container = form.querySelector(".turnstile");
  if (container && container.dataset.widgetId) {
    window.turnstile.reset(container.dataset.widgetId);
  }
}

async function apiPostJson(path, payload) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: response.ok ? "Unexpected response from the server." : `Server error (${response.status}).`
    };
  }
}

async function apiPostForm(path, formData) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    body: formData
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: response.ok ? "Unexpected response from the server." : `Server error (${response.status}).`
    };
  }
}

async function apiGet(path) {
  const response = await fetch(`${apiBase}${path}`);
  return response.json();
}

attachNavHandler();
window.addEventListener("popstate", renderRoute);
renderRoute();
