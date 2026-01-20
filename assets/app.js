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

function setNotice(target, message, type = "") {
  target.innerHTML = message ? `<div class="notice ${type}">${message}</div>` : "";
}

async function loadListings(force = false) {
  if (state.listingsLoaded && !force) {
    return;
  }
  try {
    state.listingsError = null;
    const response = await fetch(listingsUrl, { cache: "no-store" });
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

        const meta = [
          listing.type,
          listing.condition,
          listing.location,
          listing.wheel_size_in ? `${listing.wheel_size_in} in` : null
        ].filter(Boolean);
        const features = Array.isArray(listing.features) ? listing.features : [];
        const hasLock = features.includes("Lock included");
        const typeLabel = listing.type || "Bike";
        const conditionLabel = listing.condition || "unknown";
        const locationLabel = listing.location || "-";
        const summaryParts = [
          `Type of bike <strong>${typeLabel}</strong> in <strong>${conditionLabel}</strong> condition, located in <strong>${locationLabel}</strong>.`
        ];
        if (listing.wheel_size_in) {
          summaryParts.push(`Has <strong>${listing.wheel_size_in}</strong> inch wheels.`);
        }
        if (hasLock) {
          summaryParts.push("Includes a lock.");
        }
        const summaryText = summaryParts.join(" ");
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
            <div class="card-meta">${meta.map((item) => `<span>${item}</span>`).join("")}</div>
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
        <div id="contactNotice"></div>
        ${listing.contact_mode === "public_contact" ? `
          <div class="notice">
            <div>Email: ${listing.public_email || "-"}</div>
            <div>Phone: ${listing.public_phone || "-"}</div>
          </div>
        ` : `
          <form class="form" id="contactForm">
            <label>
              Email (optional)
              <input type="email" name="buyer_email" placeholder="you@example.com" />
            </label>
            <label>
              Phone (optional)
              <input type="tel" name="buyer_phone" placeholder="0700..." />
            </label>
            <label>
              Message
              <textarea name="message" maxlength="${maxMessageLength}" placeholder="Short message"></textarea>
            </label>
            <div class="helper">Provide email or phone so the seller can reply.</div>
            <div class="turnstile" data-turnstile></div>
            <button class="button" type="submit">Send message</button>
          </form>
        `}
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
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const notice = qs("#contactNotice");
      setNotice(notice, "");
      const formData = new FormData(contactForm);
      formData.append("listing_id", listing.listing_id);
      const token = getTurnstileResponse(contactForm);
      if (token === null) {
        setNotice(notice, "Turnstile is not ready.", "error");
        return;
      }
      if (token) {
        formData.append("cf_turnstile_response", token);
      }
      const response = await apiPostForm("/api/buyer/contact", formData);
      if (response.ok) {
        setNotice(notice, "Message sent.", "ok");
        contactForm.reset();
      } else {
        setNotice(notice, response.error || "Could not send message.", "error");
      }
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

        <div id="sellNotice"></div>
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
            <div class="form-row">
              <label>
                Wheel size (inches)
                <input type="number" name="wheel_size_in" min="10" max="36" step="0.5" />
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

            <div class="helper" id="submitCooldownHelp"></div>
            <button class="button" type="submit" id="createListingButton">Create listing</button>
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
  copyTokenButton.addEventListener("click", async () => {
    const tokenValue = tokenInput.value.trim();
    if (!tokenValue) {
      return;
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      setNotice(notice, "Clipboard access is not available.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(tokenValue);
      setNotice(notice, "Token copied.", "ok");
    } catch (error) {
      setNotice(notice, "Could not copy token.", "error");
    }
  });

  const contactMode = qs("#contactMode");
  const publicFields = qs("#publicContactFields");
  contactMode.addEventListener("change", () => {
    const mode = qs("input[name='contact_mode']:checked").value;
    publicFields.style.display = mode === "public_contact" ? "block" : "none";
  });

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

    const selectedFeatures = [];
    const selectedFaults = [];
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

    formData.set("features_json", JSON.stringify(selectedFeatures));
    formData.set("faults_json", JSON.stringify(selectedFaults));

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
      setNotice(notice, "Turnstile is not ready.", "error");
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
      setNotice(notice, "Listing created. Keep your seller token safe.", "ok");
      lastSubmissionSnapshot = submissionSnapshot;
      lastSubmissionHadImages = submissionHadImages;
      cooldownUntil = Date.now() + 20000;
      startCooldownTimer();
    } else {
      setNotice(notice, response.error || "Could not create listing.", "error");
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
                          <div class="notice">
                            <div>${contact.buyer_email || "-"} ${contact.buyer_phone || ""}</div>
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

  content.innerHTML = `
    <div class="section">
      <div class="section-title">Listings</div>
      <div class="card-grid">
        ${listings
          .map(
            (listing) => `
              <div class="card ${listing.status !== "active" ? "muted" : ""}">
                <div class="card-header">
                  <div class="card-title">${listing.brand || "Bike"}</div>
                  <div class="card-price">${formatPrice(listing.price_sek)}</div>
                </div>
                <div class="card-meta">
                  <span>${listing.status}</span>
                  <span>Rank: ${listing.rank}</span>
                  <span>Expires: ${formatDate(listing.expires_at)}</span>
                </div>
                <label>
                  Rank
                  <input type="number" data-rank="${listing.listing_id}" value="${listing.rank}" />
                </label>
                <div class="inline-actions">
                  <button class="button secondary" data-action="rank" data-id="${listing.listing_id}">Set rank</button>
                  <button class="button danger" data-action="delete" data-id="${listing.listing_id}">Delete</button>
                </div>
                ${listing.ip_hash ? `<button class="button ghost" data-action="block" data-ip="${listing.ip_hash}">Block IP</button>` : ""}
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
  `;

  qsa("button[data-action='rank']", content).forEach((button) => {
    button.addEventListener("click", async () => {
      const listingId = button.dataset.id;
      const rankInput = qs(`input[data-rank='${listingId}']`, content);
      const rankValue = Number(rankInput.value);
      const result = await apiPostJson("/api/admin/set-rank", { listing_id: listingId, rank: rankValue });
      if (result.ok) {
        if (result.no_change) {
          alert("Rank unchanged.");
        } else {
          alert("Rank updated.");
          await refreshListings();
        }
      } else {
        alert(result.error || "Could not update rank.");
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

function renderAbout() {
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
  return response.json();
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
