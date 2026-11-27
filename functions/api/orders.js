import { json } from "./_db.js";

const SHIP = { cairo: 40, giza: 40, alex: 60, other: 80 };

export async function onRequestPost({ env, request }) {
  let b; try { b = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const { name, phone, gov, addr, notes, items, coupon } = b || {};
  if (!name || !/^01\d{9}$/.test(phone || "") || !addr || !Array.isArray(items) || !items.length)
    return json({ error: "missing fields" }, 400);
  const ship = SHIP[gov] || SHIP.other;
  let sub = 0;
  for (const it of items) {
    const p = await env.DB.prepare("SELECT * FROM products WHERE id = ? AND status = 'active'").bind(it.id).first();
    if (!p) return json({ error: "product gone: " + it.id }, 409);
    const sizes = JSON.parse(p.sizes);
    const sz = sizes.find(s => s.s === it.size);
    if (!sz || sz.stock < it.qty) return json({ error: "out of stock: " + it.id + " " + it.size }, 409);
    sz.stock -= it.qty;
    sub += p.price * it.qty;
    await env.DB.prepare("UPDATE products SET sizes = ? WHERE id = ?").bind(JSON.stringify(sizes), p.id).run();
    it.price = p.price; it.name = p.name_ar;
  }
  let disc = 0;
  if (coupon) {
    const c = await env.DB.prepare("SELECT pct FROM coupons WHERE code = ?").bind(String(coupon).toUpperCase()).first();
    if (c) disc = Math.round(sub * c.pct / 100);
  }
  const total = sub - disc + ship;
  const code = "TAIR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  await env.DB.prepare("INSERT INTO orders (code,name,phone,gov,addr,notes,items,total,status,created_at) VALUES (?,?,?,?,?,?,?,?,0,?)")
    .bind(code, name, phone, gov || "cairo", addr, notes || "", JSON.stringify(items), total, Date.now()).run();
  return json({ ok: true, code, total });
}

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url);
  const code = (u.searchParams.get("code") || "").toUpperCase();
  const phone = u.searchParams.get("phone") || "";
  if (!code || !phone) return json({ error: "code and phone required" }, 400);
  const o = await env.DB.prepare("SELECT * FROM orders WHERE code = ? AND phone = ?").bind(code, phone).first();
  if (!o) return json({ found: false }, 404);
  return json({ found: true, order: { ...o, items: JSON.parse(o.items) } });
}
