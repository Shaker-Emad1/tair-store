import { json, row } from "./_db.js";

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url);
  const cat = u.searchParams.get("cat");
  const q = (u.searchParams.get("q") || "").toLowerCase();
  const max = +u.searchParams.get("max") || 999999;
  const size = u.searchParams.get("size");
  const sort = u.searchParams.get("sort") || "new";
  const admin = u.searchParams.get("key");
  let sql = "SELECT * FROM products WHERE price <= ?";
  const args = [max];
  if (admin !== "tair-admin-2026") { sql += " AND status = 'active'"; }
  if (cat && cat !== "all") { sql += " AND cat = ?"; args.push(cat); }
  sql += sort === "cheap" ? " ORDER BY price ASC" : sort === "exp" ? " ORDER BY price DESC" : " ORDER BY created_at DESC";
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  let list = results.map(row);
  if (size && size !== "all") list = list.filter(p => p.sizes.some(s => s.s === size && s.stock > 0));
  if (q) list = list.filter(p => (p.name_ar + p.name_en + p.brand).toLowerCase().includes(q));
  return json({ products: list });
}
