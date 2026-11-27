export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" } });
export const row = r => ({ ...r, sizes: JSON.parse(r.sizes || "[]"), history: JSON.parse(r.history || "[]"), official: !!r.official });
export const ADMIN_KEY = "tair-admin-2026";
