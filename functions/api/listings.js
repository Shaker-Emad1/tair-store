import { json, row, ADMIN_KEY } from "./_db.js";

export async function onRequestPost({ env, request }) {
  let b; try { b = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const { title, cat, price, sizes, cond, img, name, phone } = b || {};
  if (!title || !/^01\d{9}$/.test(phone || "") || !name || !price || !cat)
    return json({ error: "missing fields" }, 400);
  const id = "l" + Date.now().toString(36);
  const sizeArr = String(sizes || "").split(/[,،\s]+/).filter(Boolean).map(s => ({ s, stock: 2 }));
  await env.DB.prepare(`INSERT INTO products (id,name_ar,name_en,brand,cat,price,old,img,badge,rating,rc,sizes,seller_name,seller_phone,official,status,cond,history,desc_ar,views,created_at)
    VALUES (?,?,?,?,?,?,NULL,?,NULL,4.2,0,?,?,?,0,'pending',?,?,?,0,?)`)
    .bind(id, title, title, "بائع طاير", cat, +price, img || "assets/p1.webp", JSON.stringify(sizeArr), name, phone, cond || "new", JSON.stringify([+price]), "إعلان بائع على طاير، مراجع من الفريق قبل النشر.", Date.now()).run();
  return json({ ok: true, id, status: "pending" });
}

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url);
  const phone = u.searchParams.get("phone");
  const key = u.searchParams.get("key");
  if (key === ADMIN_KEY) {
    const { results } = await env.DB.prepare("SELECT * FROM products WHERE status = 'pending' ORDER BY created_at DESC").all();
    return json({ pending: results.map(row) });
  }
  if (!/^01\d{9}$/.test(phone || "")) return json({ error: "phone required" }, 400);
  const { results } = await env.DB.prepare("SELECT * FROM products WHERE seller_phone = ? AND official = 0 ORDER BY created_at DESC").bind(phone).all();
  return json({ listings: results.map(row) });
}

export async function onRequestPut({ env, request }) {
  let b; try { b = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  if (b.key !== ADMIN_KEY) return json({ error: "bad key" }, 403);
  if (!b.id || !["active", "rejected"].includes(b.status)) return json({ error: "bad input" }, 400);
  await env.DB.prepare("UPDATE products SET status = ? WHERE id = ?").bind(b.status, b.id).run();
  return json({ ok: true });
}
