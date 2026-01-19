import { generateToken, hashToken } from "./security.js";

export async function findSellerByToken(env, token) {
  if (!token) {
    return null;
  }
  const tokenHash = await hashToken(token, env.TOKEN_HASH_SALT);
  if (!tokenHash) {
    return null;
  }
  const seller = await env.DB.prepare(
    "SELECT seller_id, last_login_at FROM sellers WHERE seller_token_hash = ?"
  )
    .bind(tokenHash)
    .first();
  if (!seller) {
    return null;
  }
  return { seller_id: seller.seller_id, last_login_at: seller.last_login_at };
}

export async function createSeller(env) {
  const sellerId = crypto.randomUUID();
  const sellerToken = generateToken();
  const tokenHash = await hashToken(sellerToken, env.TOKEN_HASH_SALT);
  if (!tokenHash) {
    throw new Error("Missing TOKEN_HASH_SALT.");
  }
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO sellers (seller_id, seller_token_hash, created_at) VALUES (?, ?, ?)"
  )
    .bind(sellerId, tokenHash, now)
    .run();
  return { seller_id: sellerId, seller_token: sellerToken };
}
