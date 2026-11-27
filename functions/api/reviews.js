import { json } from "./_db.js";

export async function onRequestGet({ env, request }) {
  const pid = new URL(request.url).searchParams.get("product_id");
  if (!pid) return json({ error: "product_id required" }, 400);
  const { results } = await env.DB.prepare("SELECT name, rating, txt, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 30").bind(pid).all();
  return json({ reviews: results });
}

export async function onRequestPost({ env, request }) {
  let b; try { b = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const { product_id, name, rating, txt } = b || {};
  if (!product_id || !name || !txt || !(rating >= 1 && rating <= 5)) return json({ error: "missing fields" }, 400);
  await env.DB.prepare("INSERT INTO reviews (product_id,name,rating,txt,created_at) VALUES (?,?,?,?,?)")
    .bind(product_id, String(name).slice(0, 60), rating, String(txt).slice(0, 500), Date.now()).run();
  await env.DB.prepare(`UPDATE products SET rc = rc + 1,
    rating = ROUND((rating * (rc - 1) + ?) / rc, 1) WHERE id = ?`).bind(rating, product_id).run();
  return json({ ok: true });
}
