const fs = require("fs");
eval(fs.readFileSync(__dirname + "/../js/data.js", "utf8").replace(/^(const|let) /gm, "globalThis."));
const esc = s => (s == null ? "NULL" : "'" + String(s).replace(/'/g, "''") + "'");
let sql = [];
for (const p of globalThis.PRODUCTS) {
  sql.push(
    `INSERT OR REPLACE INTO products (id,name_ar,name_en,brand,cat,price,old,img,badge,rating,rc,sizes,seller_name,seller_phone,official,status,history,desc_ar,views,created_at) VALUES (` +
    [esc(p.id), esc(p.nameAr), esc(p.nameEn), esc(p.brand), esc(p.cat), p.price, p.old ?? "NULL", esc(p.img), esc(p.badge), p.rating, p.rc,
     esc(JSON.stringify(p.sizes)), esc(p.seller.name), esc(p.seller.phone), p.seller.official ? 1 : 0, "'active'", esc(JSON.stringify(p.history)), esc(p.descAr), Math.floor(Math.random() * 60) + 15, Date.now()].join(",") + `);`
  );
}
for (const [pid, revs] of Object.entries(globalThis.REVIEWS))
  for (const r of revs)
    sql.push(`INSERT INTO reviews (product_id,name,rating,txt,created_at) VALUES (${esc(pid)},${esc(r.n)},${r.r},${esc(r.txt)},${Date.now()});`);
fs.writeFileSync("/tmp/seed.sql", sql.join("\n"));
console.log("seed rows:", sql.length);
