PRAGMA foreign_keys = ON;

CREATE TABLE sellers (
  seller_id TEXT PRIMARY KEY,
  seller_token_hash TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE listings (
  listing_id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  rank INTEGER NOT NULL DEFAULT 0,
  price_sek INTEGER NOT NULL,
  brand TEXT NOT NULL,
  type TEXT NOT NULL,
  condition TEXT NOT NULL,
  wheel_size_in REAL,
  features_json TEXT NOT NULL,
  faults_json TEXT NOT NULL,
  location TEXT NOT NULL,
  contact_mode TEXT NOT NULL,
  public_email TEXT,
  public_phone TEXT,
  image_keys_json TEXT NOT NULL,
  image_sizes_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  ip_hash TEXT,
  ip_stored_at INTEGER,
  FOREIGN KEY (seller_id) REFERENCES sellers(seller_id)
);

CREATE TABLE buyer_contacts (
  contact_id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  buyer_email TEXT,
  buyer_phone TEXT,
  message TEXT NOT NULL,
  ip_hash TEXT,
  ip_stored_at INTEGER,
  FOREIGN KEY (listing_id) REFERENCES listings(listing_id)
);

CREATE TABLE reports (
  report_id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  seen_at INTEGER,
  done_at INTEGER,
  ip_hash TEXT,
  ip_stored_at INTEGER,
  FOREIGN KEY (listing_id) REFERENCES listings(listing_id)
);

CREATE TABLE blocked_ips (
  ip_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  reason TEXT
);

CREATE TABLE admin_actions (
  action_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE usage_monthly (
  period_key TEXT PRIMARY KEY,
  period_start INTEGER NOT NULL,
  class_a_ops INTEGER NOT NULL DEFAULT 0,
  class_b_ops INTEGER NOT NULL DEFAULT 0,
  api_requests INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE usage_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_listings_status_expires ON listings(status, expires_at);
CREATE INDEX idx_listings_rank_created ON listings(rank, created_at);
CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_contacts_expires ON buyer_contacts(expires_at);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_listing ON reports(listing_id);
CREATE INDEX idx_usage_monthly_start ON usage_monthly(period_start);
