export const LISTING_TYPES = [
  "City",
  "City (men)",
  "City (women)",
  "Mountain bike",
  "Racer",
  "Fold bike",
  "Other"
];

export const CONDITIONS = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Very poor"
];

export const FEATURES = [
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

export const FAULTS = [
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

export const CONTACT_MODES = ["public_contact", "buyer_message"];

export const REPORT_STATUSES = ["open", "under_review", "done"];

export const LISTING_STATUSES = ["active", "expired", "deleted"];

export const LIMITS = {
  maxLocationLength: 25,
  maxMessageLength: 300,
  maxImages: 2,
  maxImageBytes: 1200000,
  maxTotalUploadBytes: 3000000,
  maxBrandLength: 40
};

export const TTL = {
  listingDays: 39,
  extendDays: 30,
  expiredRetentionDays: 30,
  contactDays: 30,
  ipHashDays: 30,
  reportDays: 365
};

export const BYTES_PER_GB = 1_000_000_000;

export const R2_LIMITS = {
  storageBytes: 10 * BYTES_PER_GB,
  classAOps: 1_000_000,
  classBOps: 10_000_000
};

export const R2_PRICING = {
  storagePerGb: 0.015,
  classAPerMillion: 4.5,
  classBPerMillion: 0.36
};

export const USAGE_CUTOFF_FRACTION = 0.99;
