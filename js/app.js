/* TAIR app: hash router, views, cart, checkout, try-on, animations. No deps. */
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const fmt = n => n.toLocaleString(LANG === "ar" ? "ar-EG" : "en-EG") + " " + t("gen.egp");
const store = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem("tair-"+k)) ?? d; }catch(e){ return d; } },
  set(k, v){ localStorage.setItem("tair-"+k, JSON.stringify(v)); }
};
let SERVER_PRODUCTS = null;
const api = (p, opt) => fetch("/api" + p, opt).then(r => r.ok ? r.json() : Promise.reject(r.status));
let cart = store.get("cart", []);
let favs = store.get("favs", []);
let myListings = store.get("listings", []);
let myOrders = store.get("orders", []);
let coupon = null;

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pname = p => LANG === "ar" ? p.nameAr : p.nameEn;
const stars = (r, rc) => `<span class="stars">${"★".repeat(Math.round(r))}${"☆".repeat(5-Math.round(r))} <small>${rc||0}</small></span>`;
const priceHtml = p => `<span class="price">${fmt(p.price)}${p.old?`<span class="old">${fmt(p.old)}</span>`:""}</span>`;
const stockOf = p => p.sizes.reduce((a,s)=>a+s.stock,0);
function toast(msg){
  const el = document.createElement("div"); el.className = "toast"; el.textContent = msg;
  $("#toast-root").appendChild(el); setTimeout(()=>{ el.style.opacity=0; setTimeout(()=>el.remove(),400); }, 2200);
}
function allProducts(){ return (SERVER_PRODUCTS || PRODUCTS).concat(myListings.filter(l=>l.status==="active").map(l=>({...l, id:l.id, img:l.img||"assets/p1.webp", rating:4.2, rc:1, history:[l.price], seller:{name:l.sellerName, phone:l.phone}, descAr:l.descAr||"إعلان بائع على طاير."}))); }
const findP = id => allProducts().find(p=>p.id===id);

/* ---------- card ---------- */
function cardHtml(p){
  const out = stockOf(p)===0;
  return `<article class="card reveal" data-id="${p.id}">
    <a class="card-img" href="#/product/${p.id}" aria-label="${esc(pname(p))}">
      ${p.badge?`<span class="badge ${p.old?"sale":""}">${esc(p.badge)}</span>`:""}
      <img src="${p.img}" alt="${esc(pname(p))}" loading="lazy" width="600" height="600">
    </a>
    <button class="fav-btn ${favs.includes(p.id)?"on":""}" data-fav="${p.id}" aria-label="wishlist">${favs.includes(p.id)?"♥":"♡"}</button>
    <div class="card-body">
      <span class="card-cat">${t("cat."+p.cat)} · ${esc(p.brand)}</span>
      <a class="card-name" href="#/product/${p.id}">${esc(pname(p))}</a>
      <div class="card-meta">${priceHtml(p)}${stars(p.rating,p.rc)}</div>
      <button class="add-btn" data-add="${p.id}" ${out?"disabled":""}>${out?t("pd.stockOut"):t("pd.add")}</button>
    </div>
  </article>`;
}
function bindCards(root){
  $$("[data-fav]", root).forEach(b => b.onclick = () => {
    const id = b.dataset.fav;
    favs = favs.includes(id) ? favs.filter(f=>f!==id) : [...favs, id];
    store.set("favs", favs);
    b.classList.toggle("on"); b.textContent = b.classList.contains("on") ? "♥" : "♡";
    toast(t(b.classList.contains("on") ? "gen.fav" : "gen.unfav"));
  });
  $$("[data-add]", root).forEach(b => b.onclick = () => openSizeSheet(b.dataset.add, sz => { addToCart(b.dataset.add, sz); }));
}

/* ---------- size sheet ---------- */
function openSizeSheet(pid, cb){
  const p = findP(pid); if(!p) return;
  const m = modal(`<h3>${esc(pname(p))}</h3><p class="sub">${t("pd.size")}</p>
    <div class="sizes">${p.sizes.map(x=>`<button class="size" data-sz="${x.s}" ${x.stock===0?"disabled":""}>${x.s}</button>`).join("")}</div>`);
  $$(".size", m).forEach(b => b.onclick = () => { closeModal(); cb(b.dataset.sz); });
}

/* ---------- cart ---------- */
function addToCart(pid, size, qty=1){
  const p = findP(pid); const sz = p.sizes.find(s=>s.s===size);
  if(!sz || sz.stock===0) return;
  const ex = cart.find(c=>c.id===pid && c.size===size);
  if(ex) ex.qty = Math.min(ex.qty+qty, sz.stock); else cart.push({id:pid, size, qty});
  store.set("cart", cart); updateCartCount(); renderCart(); toast(t("cart.added")); openCart();
}
function cartLines(){
  const items = cart.map(c=>({...c, p:findP(c.id)})).filter(c=>c.p);
  const sub = items.reduce((a,c)=>a+c.p.price*c.qty,0);
  const disc = coupon ? Math.round(sub*COUPONS[coupon]/100) : 0;
  return {items, sub, disc};
}
function updateCartCount(){
  const n = cart.reduce((a,c)=>a+c.qty,0);
  const el = $("#cart-count"); el.hidden = n===0; el.textContent = n;
}
function renderCart(){
  const {items, sub, disc} = cartLines();
  const d = $("#cart-drawer");
  d.innerHTML = `<div class="cart-head"><h3>${t("cart.title")} (${items.reduce((a,c)=>a+c.qty,0)})</h3>
    <button class="icon-btn" id="cart-close" aria-label="close">✕</button></div>
    <div class="cart-items">${items.length===0 ? `<div class="cart-empty"><span style="font-size:3rem">◈</span><p>${t("cart.empty")}</p><button class="btn btn-volt" id="cart-shop">${t("cart.emptyBtn")}</button></div>` :
    items.map(c=>`<div class="cart-item">
      <img src="${c.p.img}" alt="${esc(pname(c.p))}" width="76" height="76">
      <div><div class="ci-name">${esc(pname(c.p))}</div><div class="ci-size">${t("pd.size")}: ${c.size}</div>
        <div class="qty"><button data-q="-1" data-k="${c.id}|${c.size}">−</button><b>${c.qty}</b><button data-q="1" data-k="${c.id}|${c.size}">＋</button></div></div>
      <div class="ci-side"><span class="price">${fmt(c.p.price*c.qty)}</span><button class="ci-rm" data-rm="${c.id}|${c.size}" aria-label="remove">✕</button></div>
    </div>`).join("")}</div>
    ${items.length?`<div class="cart-foot">
      <div class="cart-line"><span>${t("cart.subtotal")}</span><b>${fmt(sub)}</b></div>
      ${disc?`<div class="cart-line"><span>${t("cart.discount")} (${coupon})</span><b>−${fmt(disc)}</b></div>`:""}
      <div class="cart-line total"><span>${t("cart.total")}</span><b>${fmt(sub-disc)}</b></div>
      <form id="coupon-form" style="display:flex;gap:.5rem"><input name="c" placeholder="${t("cart.coupon")}" style="flex:1"><button class="btn btn-ghost" style="padding:.6rem 1.1rem">${t("cart.apply")}</button></form>
      <button class="btn btn-volt" id="go-checkout" style="justify-content:center">${t("cart.checkout")}</button>
    </div>`:""}`;
  $("#cart-close").onclick = closeCart;
  const cs = $("#cart-shop"); if(cs) cs.onclick = () => { closeCart(); location.hash = "#/shop"; };
  $$("[data-q]", d).forEach(b => b.onclick = () => {
    const [id,size] = b.dataset.k.split("|"); const it = cart.find(c=>c.id===id&&c.size===size);
    const p = findP(id); const max = p.sizes.find(s=>s.s===size).stock;
    it.qty = Math.max(1, Math.min(max, it.qty + (+b.dataset.q)));
    store.set("cart", cart); updateCartCount(); renderCart();
  });
  $$("[data-rm]", d).forEach(b => b.onclick = () => {
    const [id,size] = b.dataset.rm.split("|"); cart = cart.filter(c=>!(c.id===id&&c.size===size));
    store.set("cart", cart); updateCartCount(); renderCart();
  });
  const cf = $("#coupon-form");
  if(cf) cf.onsubmit = e => { e.preventDefault(); const code = cf.c.value.trim().toUpperCase();
    if(COUPONS[code]){ coupon = code; renderCart(); } else { coupon = null; toast(t("cart.badCoupon")); } };
  const gc = $("#go-checkout"); if(gc) gc.onclick = () => { closeCart(); openCheckout(); };
}
function openCart(){ renderCart(); $("#cart-drawer").hidden = false; requestAnimationFrame(()=>{ $("#cart-drawer").classList.add("show"); $("#overlay").hidden = false; $("#overlay").classList.add("show"); }); }
function closeCart(){ $("#cart-drawer").classList.remove("show"); $("#overlay").classList.remove("show"); setTimeout(()=>{ $("#cart-drawer").hidden = true; $("#overlay").hidden = true; }, 450); }

/* ---------- modal ---------- */
function modal(html){
  const bg = document.createElement("div"); bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener("click", e => { if(e.target===bg) closeModal(); });
  $("#modal-root").appendChild(bg);
  requestAnimationFrame(()=>bg.classList.add("show"));
  return bg;
}
function closeModal(){ const bg = $(".modal-bg"); if(bg){ bg.classList.remove("show"); setTimeout(()=>bg.remove(),350); } }

/* ---------- checkout ---------- */
function openCheckout(){
  const {items, sub, disc} = cartLines(); if(!items.length) return;
  let step = 1, info = {};
  const shipCost = () => SHIPPING[info.gov||"cairo"];
  const m = modal(`<h3>${t("co.title")}</h3><p class="sub">${t("co.sub")}</p><div class="steps"><i class="on"></i><i></i><i></i></div><div id="co-body"></div>`);
  const body = $("#co-body", m), bars = $$(".steps i", m);
  function render(){
    bars.forEach((b,i)=>b.classList.toggle("on", i<step));
    if(step===1){
      body.innerHTML = `<form id="co-f" class="form-grid">
        <label class="fl">${t("co.name")}<input name="name" required value="${esc(info.name||"")}"></label>
        <div class="row"><label class="fl">${t("co.phone")}<input name="phone" required inputmode="tel" pattern="01[0-9]{9}" placeholder="01xxxxxxxxx" value="${esc(info.phone||"")}"></label>
        <label class="fl">${t("co.gov")}<select name="gov">${["cairo","giza","alex","other"].map(g=>`<option value="${g}" ${info.gov===g?"selected":""}>${t("gov."+g)}</option>`).join("")}</select></label></div>
        <label class="fl">${t("co.addr")}<input name="addr" required value="${esc(info.addr||"")}"></label>
        <label class="fl">${t("co.notes")}<input name="notes" value="${esc(info.notes||"")}"></label>
        <div class="pay-opts">
          <label class="pay-opt"><input type="radio" name="pay" value="cod" checked><b>${t("co.cod")}</b></label>
          <label class="pay-opt disabled" title="${t("co.cardOff")}"><input type="radio" disabled><b>${t("co.card")}</b><span class="tag">${t("co.cardTag")}</span></label>
        </div>
        <button class="btn btn-volt" style="justify-content:center">${t("co.next")}</button></form>`;
      $("#co-f").onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
        info = {name:f.get("name"), phone:f.get("phone"), gov:f.get("gov"), addr:f.get("addr"), notes:f.get("notes")};
        step = 2; render(); };
    } else if(step===2){
      const total = sub - disc + shipCost();
      body.innerHTML = `<h4 style="margin-bottom:1rem">${t("co.review")}</h4>
        ${items.map(c=>`<div class="cart-line"><span>${esc(pname(c.p))} × ${c.qty} (${c.size})</span><b>${fmt(c.p.price*c.qty)}</b></div>`).join("")}
        <div class="cart-line"><span>${t("cart.subtotal")}</span><b>${fmt(sub)}</b></div>
        ${disc?`<div class="cart-line"><span>${t("cart.discount")}</span><b>−${fmt(disc)}</b></div>`:""}
        <div class="cart-line"><span>${t("cart.shipping")} (${t("gov."+info.gov)})</span><b>${fmt(shipCost())}</b></div>
        <div class="cart-line total"><span>${t("cart.total")}</span><b>${fmt(total)}</b></div>
        <p class="sub" style="margin-top:.6rem">${esc(info.name)} · ${esc(info.phone)} · ${t("gov."+info.gov)} · ${esc(info.addr)}</p>
        <div style="display:flex;gap:.7rem;margin-top:1rem"><button class="btn btn-ghost" id="co-back">${t("co.back")}</button>
        <button class="btn btn-volt" id="co-ok" style="flex:1;justify-content:center">${t("co.confirm")}</button></div>`;
      $("#co-back").onclick = () => { step = 1; render(); };
      $("#co-ok").onclick = () => {
        const btn = $("#co-ok"); btn.disabled = true;
        const payload = {name:info.name, phone:info.phone, gov:info.gov, addr:info.addr, notes:info.notes,
          items:items.map(c=>({id:c.id,size:c.size,qty:c.qty})), coupon};
        api("/orders", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(payload)})
          .then(r => finish(r.code, r.total, true))
          .catch(() => finish("TAIR-" + Math.random().toString(36).slice(2,8).toUpperCase(), total, false));
        function finish(code, tot, onServer){
          myOrders.unshift({code, phone:info.phone, name:info.name, gov:info.gov, addr:info.addr,
            items:items.map(c=>({id:c.id,size:c.size,qty:c.qty,price:c.p.price,name:pname(c.p)})),
            total:tot, status:0, ts:Date.now(), server:onServer});
          store.set("orders", myOrders);
          cart = []; coupon = null; store.set("cart", cart); updateCartCount();
          step = 3; render(code);
        }
      };
    } else {
      body.innerHTML = `<div class="order-ok"><div class="tick">✓</div><h3>${t("co.ok")}</h3>
        <p class="sub">${t("co.okSub")}</p><div class="order-code" dir="ltr">${arguments[0]||""}</div>
        <p class="sub">${t("co.demoNote")}</p>
        <button class="btn btn-volt" id="co-track">${t("co.track")}</button></div>`;
      const code = $(".order-code", body).textContent;
      $("#co-track").onclick = () => { closeModal(); location.hash = "#/track"; setTimeout(()=>{ const i=$("#tr-code"); if(i){ i.value = code; const p=$("#tr-phone"); if(p){p.value=info.phone; p.form?.requestSubmit?.();} } }, 400); };
    }
  }
  render();
}

/* ---------- views ---------- */
function vHome(){
  const fresh = allProducts().slice(0,6);
  return `<section class="hero"><div class="hero-orb"></div>
    <div class="hero-copy">
      <span class="kicker">${t("hero.kicker")}</span>
      <h1><span class="stroke">${t("hero.h1a")}</span><br>${t("hero.h1b")} <span class="volt">${t("hero.h1c")}</span></h1>
      <p class="sub">${t("hero.sub")}</p>
      <div class="cta-row"><a class="btn btn-volt" href="#/shop">${t("hero.cta1")}</a><a class="btn btn-ghost" href="#/sell">${t("hero.cta2")}</a></div>
    </div>
    <div class="hero-visual"><img id="hero-img" src="assets/hero.webp" alt="TAIR sneaker" width="620" height="413" fetchpriority="high"></div>
    <div class="hero-scroll"><i></i>${t("hero.scroll")}</div>
  </section>
  <div class="ticker" aria-hidden="true"><div class="ticker-track"><span>${[1,2,3,4,5].map(i=>`${t("tick."+i)} <b>✦</b>`).join(" ")}</span><span>${[1,2,3,4,5].map(i=>`${t("tick."+i)} <b>✦</b>`).join(" ")}</span></div></div>
  <div class="stats">
    <div class="stat"><b>+120</b><span>${LANG==="ar"?"بائع مسجل":"sellers"}</span></div>
    <div class="stat"><b>+500</b><span>${LANG==="ar"?"قطعة متاحة":"items live"}</span></div>
    <div class="stat"><b>27</b><span>${LANG==="ar"?"محافظة شحن":"governorates"}</span></div>
    <div class="stat"><b>14</b><span>${LANG==="ar"?"يوم إرجاع":"day returns"}</span></div>
  </div>
  <section class="section">
    <div class="sec-head reveal"><h2>${t("sec.new")}<small>${t("sec.newSub")}</small></h2><a class="more" href="#/shop">${t("sec.more")}</a></div>
    <div class="rail" id="rail">${fresh.map(cardHtml).join("")}</div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="sec-head reveal"><h2>${t("sec.cats")}<small>${t("sec.catsSub")}</small></h2></div>
    <div class="cats">
      ${[["sneakers","assets/p2.webp"],["hoodies","assets/p5.webp"],["tees","assets/p8.webp"]].map(([c,img],i)=>`
      <a class="cat-card reveal d${i+1}" href="#/shop?cat=${c}"><img src="${img}" alt="${t("cat."+c)}" loading="lazy" width="600" height="600"><div class="lbl">${t("cat."+c)}<span>←</span></div></a>`).join("")}
    </div>
  </section>
  <section class="section story" style="padding-top:0">
    <div class="story-img reveal"><img src="assets/look1.webp" alt="TAIR street look, Cairo" loading="lazy" width="600" height="800"></div>
    <div class="reveal d1">
      <h2>${t("sec.story")}<br>${t("sec.story2")}</h2>
      <p>${t("story.p")}</p>
      <ul class="checks"><li>${t("story.c1")}</li><li>${t("story.c2")}</li><li>${t("story.c3")}</li></ul>
      <a class="btn btn-ghost" href="#/features">${t("story.cta")}</a>
    </div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="band reveal">
      <div><h2>${t("band.h")}</h2><p>${t("band.p")}</p><a class="btn btn-volt" href="#/sell">${t("band.cta")}</a></div>
      <div><div class="big-num" dir="ltr">${t("band.num")}</div><p style="text-align:center;color:var(--ink2)">${t("band.numLbl")}</p></div>
    </div>
  </section>`;
}

function vShop(params){
  const state = { cat: params.get("cat")||"all", q:"", max:4000, size:"all", sort:"new" };
  const wrap = `<section class="section">
    <div class="sec-head"><h2>${t("shop.title")}</h2></div>
    <div class="toolbar">
      <input type="search" id="f-q" placeholder="${t("shop.search")}" aria-label="search">
      <select id="f-size" aria-label="size"><option value="all">${t("shop.allSizes")}</option>${["40","41","42","43","44","45","S","M","L","XL","XXL"].map(s=>`<option>${s}</option>`).join("")}</select>
      <div class="range-row"><span>${t("shop.maxPrice")}</span><input type="range" id="f-max" min="500" max="4000" step="50" value="4000"><b id="f-max-v">${fmt(4000)}</b></div>
      <select id="f-sort" aria-label="sort"><option value="new">${t("shop.sortNew")}</option><option value="cheap">${t("shop.sortCheap")}</option><option value="exp">${t("shop.sortExpensive")}</option></select>
    </div>
    <div class="chips">${["all",...CATS].map(c=>`<button class="chip ${state.cat===c?"on":""}" data-cat="${c}">${t("cat."+c)}</button>`).join("")}</div>
    <p class="count-line" id="f-count"></p>
    <div class="grid" id="f-grid"></div>
  </section>`;
  queueMicrotask(() => {
    const grid = $("#f-grid");
    function draw(){
      let list = allProducts().filter(p =>
        (state.cat==="all"||p.cat===state.cat) && p.price<=state.max &&
        (state.size==="all"||p.sizes.some(s=>s.s===state.size&&s.stock>0)) &&
        (!state.q || (p.nameAr+p.nameEn+p.brand).toLowerCase().includes(state.q)));
      if(state.sort==="cheap") list.sort((a,b)=>a.price-b.price);
      else if(state.sort==="exp") list.sort((a,b)=>b.price-a.price);
      $("#f-count").textContent = list.length + " " + t("shop.count");
      grid.innerHTML = list.length ? list.map(cardHtml).join("") : `<div class="empty">${t("shop.empty")}</div>`;
      bindCards(grid); revealIn(grid);
    }
    $("#f-q").oninput = e => { state.q = e.target.value.trim().toLowerCase(); draw(); };
    $("#f-size").onchange = e => { state.size = e.target.value; draw(); };
    $("#f-sort").onchange = e => { state.sort = e.target.value; draw(); };
    $("#f-max").oninput = e => { state.max = +e.target.value; $("#f-max-v").textContent = fmt(state.max); draw(); };
    $$(".chip").forEach(c => c.onclick = () => { state.cat = c.dataset.cat; $$(".chip").forEach(x=>x.classList.toggle("on",x===c)); draw(); });
    draw();
  });
  return wrap;
}

function vProduct(id){
  const p = findP(id);
  if(!p) return `<section class="section"><div class="empty">404</div></section>`;
  const stock = stockOf(p);
  const srv = (window.SERVER_REVIEWS||{})[p.id]||[];
  const revs = srv.length ? srv.map(r=>({n:r.name, r:r.rating, txt:r.txt})) : (REVIEWS[p.id]||[]).concat(store.get("rev-"+p.id, []));
  const h = p.history; const min = Math.min(...h), max = Math.max(...h);
  const pts = h.map((v,i)=>`${(i/(h.length-1||1)*100).toFixed(1)},${(30-((v-min)/((max-min)||1))*26).toFixed(1)}`).join(" ");
  queueMicrotask(() => {
    let size = null, rating = 5;
    $$(".size").forEach(b => b.onclick = () => { size = b.dataset.sz; $$(".size").forEach(x=>x.classList.toggle("on",x===b)); });
    const need = () => { if(!size){ toast(t("cart.pickSize")); return true; } return false; };
    $("#pd-add").onclick = () => { if(!need()) addToCart(p.id, size); };
    $("#pd-buy").onclick = () => { if(!need()){ addToCart(p.id, size); openCheckout(); } };
    const sb = $("#size-guide-btn"); if(sb) sb.onclick = () => $("#sg").open = true;
    $$(".rate-input button").forEach(b => b.onclick = e => { e.preventDefault(); rating = +b.dataset.r;
      $$(".rate-input button").forEach(x=>x.classList.toggle("on", +x.dataset.r<=rating)); });
    api("/reviews?product_id=" + p.id).then(r => {
      window.SERVER_REVIEWS = window.SERVER_REVIEWS||{};
      const known = (window.SERVER_REVIEWS[p.id]||[]).length;
      if ((r.reviews||[]).length !== known){ window.SERVER_REVIEWS[p.id] = r.reviews; route(); }
    }).catch(()=>{});
    $("#rev-form").onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
      const save = () => { const mine = store.get("rev-"+p.id, []); mine.push({n:f.get("n"), r:rating, txt:f.get("x")});
        store.set("rev-"+p.id, mine); };
      api("/reviews", {method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({product_id:p.id, name:f.get("n"), rating, txt:f.get("x")})})
        .catch(save).finally(() => { toast(t("rev.done")); route(); }); };
  });
  return `<section class="section pd">
    <div class="pd-gallery reveal"><div class="main-img"><img src="${p.img}" alt="${esc(pname(p))}" width="800" height="800" fetchpriority="high"></div></div>
    <div class="pd-info reveal d1">
      <span class="pd-brand">${esc(p.brand)} · ${t("cat."+p.cat)}</span>
      <h1>${esc(pname(p))}</h1>
      ${stars(p.rating, p.rc)}
      <div class="pd-price">${priceHtml(p)}</div>
      <span class="stock-note ${stock===0?"low":stock<6?"low":"ok"}">${stock===0?t("pd.stockOut"):stock<6?t("pd.stockLow"):t("pd.stockOk")} (${stock})</span>
      <div class="size-label"><span>${t("pd.size")}</span><button id="size-guide-btn">${t("pd.guide")}</button></div>
      <div class="sizes">${p.sizes.map(x=>`<button class="size" data-sz="${x.s}" ${x.stock===0?"disabled":""}>${x.s}</button>`).join("")}</div>
      <div class="pd-actions">
        <button class="btn btn-volt" id="pd-add" ${stock===0?"disabled":""}>${t("pd.add")}</button>
        <button class="btn btn-ghost" id="pd-buy" ${stock===0?"disabled":""}>${t("pd.buy")}</button>
        <a class="btn btn-ghost" href="#/tryon?p=${p.id}">${t("nav.tryon")}</a>
      </div>
      <div class="pd-seller"><span class="ava">${esc((p.seller.name||"ط").slice(0,1))}</span>
        <div><b>${esc(p.seller.name)}</b><small>${p.seller.official?t("pd.verified"):t("pd.verified")}</small></div></div>
      <div class="spark-wrap"><h5>${t("pd.history")}</h5>
        <svg viewBox="0 0 100 32" width="100%" height="40" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--volt)" stroke-width="1.6"/></svg>
        <small dir="ltr">${fmt(min)} → ${fmt(max)}</small></div>
      <div class="acc">
        <details open><summary>${t("pd.desc")}</summary><div class="acc-body">${esc(p.descAr||"")} ${t("pd.descBody")}</div></details>
        <details><summary>${t("pd.ship")}</summary><div class="acc-body">${t("pd.shipBody")}</div></details>
        <details id="sg"><summary>${t("pd.guide")}</summary><div class="acc-body">
          <table class="size-guide"><tr><th>EU</th><th>40</th><th>41</th><th>42</th><th>43</th><th>44</th><th>45</th></tr>
          <tr><td>CM</td><td>25</td><td>26</td><td>26.5</td><td>27.5</td><td>28.5</td><td>29</td></tr></table>
          <table class="size-guide" style="margin-top:.8rem"><tr><th>—</th><th>S</th><th>M</th><th>L</th><th>XL</th><th>XXL</th></tr>
          <tr><td>${LANG==="ar"?"الصدر":"Chest"}</td><td>96</td><td>102</td><td>108</td><td>114</td><td>120</td></tr></table>
        </div></details>
        <details><summary>${t("pd.reviews")} (${revs.length})</summary><div class="acc-body">
          ${revs.map(r=>`<div class="review"><b>${esc(r.n)}</b><span class="stars">${"★".repeat(r.r)}${"☆".repeat(5-r.r)}</span><p>${esc(r.txt)}</p></div>`).join("")}
          <form class="rev-form" id="rev-form"><b>${t("rev.write")}</b>
            <div class="rate-input">${[1,2,3,4,5].map(i=>`<button data-r="${i}" class="${i<=5?"on":""}">★</button>`).join("")}</div>
            <div class="row"><input name="n" required placeholder="${t("rev.name")}"></div>
            <textarea name="x" rows="2" required placeholder="${t("rev.text")}"></textarea>
            <button class="btn btn-ghost">${t("rev.send")}</button></form>
        </div></details>
      </div>
    </div>
  </section>`;
}

function vTrack(){
  queueMicrotask(() => {
    $("#tr-form").onsubmit = e => { e.preventDefault();
      const code = $("#tr-code").value.trim().toUpperCase(), phone = $("#tr-phone").value.trim();
      const box = $("#tr-result");
      const draw = o => { if(!o){ box.innerHTML = `<div class="empty">${t("tr.notFound")}</div>`; return; }
      const steps = ["tr.st1","tr.st2","tr.st3","tr.st4"];
      box.innerHTML = `<div class="panel" style="margin-top:1.4rem">
        <div class="cart-line total"><span>${o.code}</span><b>${fmt(o.total)}</b></div>
        <div class="timeline">${steps.map((s,i)=>`<div class="tl-row ${i<o.status?"done":i===o.status?"now":""}">
          <span class="tl-dot">${i<o.status?"✓":i+1}</span><div><b>${t(s)}</b><small>${i===0?new Date(o.ts).toLocaleString(LANG==="ar"?"ar-EG":"en-EG"):""}</small></div></div>`).join("")}</div>
        <div style="margin-top:1rem">${o.items.map(it=>`<div class="cart-line"><span>${esc(it.name)} × ${it.qty} (${it.size})</span></div>`).join("")}</div>
      </div>`; };
      api(`/orders?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`)
        .then(r => draw(r.order))
        .catch(() => draw(myOrders.find(x=>x.code===code && x.phone===phone)));
    };
  });
  return `<section class="section track-card">
    <div class="sec-head"><h2>${t("tr.title")}<small>${t("tr.sub")}</small></h2></div>
    <form id="tr-form" class="form-grid"><div class="row">
      <input id="tr-code" required placeholder="${t("tr.code")}" dir="ltr" style="text-transform:uppercase">
      <input id="tr-phone" required placeholder="${t("co.phone")}" inputmode="tel"></div>
      <button class="btn btn-volt" style="justify-content:center">${t("tr.btn")}</button></form>
    <div id="tr-result"></div>
  </section>`;
}

function vSell(){
  queueMicrotask(() => {
    let img = "assets/p1.webp";
    $$(".img-pick button").forEach(b => b.onclick = e => { e.preventDefault(); img = b.dataset.img;
      $$(".img-pick button").forEach(x=>x.classList.toggle("on", x===b)); });
    $("#sell-form").onsubmit = e => { e.preventDefault(); const f = new FormData(e.target);
      api("/listings", {method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({title:f.get("title"), cat:f.get("cat"), price:+f.get("price"), sizes:f.get("sizes"), cond:f.get("cond"), img, name:f.get("name"), phone:f.get("phone")})})
        .then(() => { toast(t("sell.done")); location.hash = "#/seller"; })
        .catch(() => sellLocal(f));
    };
    function sellLocal(f){
      const sizes = f.get("sizes").split(/[,،\s]+/).filter(Boolean).map(s=>({s, stock:3}));
      myListings.unshift({ id:"l"+Date.now().toString(36), nameAr:f.get("title"), nameEn:f.get("title"),
        cat:f.get("cat"), price:+f.get("price"), old:null, img, sizes, cond:f.get("cond"),
        sellerName:f.get("name"), phone:f.get("phone"), status:"pending", views:0, ts:Date.now() });
      store.set("listings", myListings); toast(t("sell.done")); location.hash = "#/seller"; }
  });
  return `<section class="section split">
    <div class="reveal">
      <div class="sec-head"><h2>${t("sell.title")}<small>${t("sell.sub")}</small></h2></div>
      <div class="perk"><span class="ic">◈</span><div><b>${t("sell.p1t")}</b><p>${t("sell.p1d")}</p></div></div>
      <div class="perk"><span class="ic">✓</span><div><b>${t("sell.p2t")}</b><p>${t("sell.p2d")}</p></div></div>
      <div class="perk"><span class="ic">٭</span><div><b>${t("sell.p3t")}</b><p>${t("sell.p3d")}</p></div></div>
      <div class="band" style="padding:1.6rem"><div class="big-num" dir="ltr">0%</div><p style="text-align:center;color:var(--ink2)">${t("band.numLbl")}</p></div>
    </div>
    <form id="sell-form" class="panel form-grid reveal d1">
      <label class="fl">${t("sell.fTitle")}<input name="title" required></label>
      <div class="row">
        <label class="fl">${t("sell.fCat")}<select name="cat">${CATS.map(c=>`<option value="${c}">${t("cat."+c)}</option>`).join("")}</select></label>
        <label class="fl">${t("sell.fPrice")}<input name="price" required type="number" min="50" inputmode="numeric"></label>
      </div>
      <div class="row">
        <label class="fl">${t("sell.fSizes")}<input name="sizes" required placeholder="42 43 L" dir="ltr"></label>
        <label class="fl">${t("sell.fCond")}<select name="cond"><option value="new">${t("sell.condNew")}</option><option value="used">${t("sell.condUsed")}</option></select></label>
      </div>
      <label class="fl">${t("sell.fImg")}</label>
      <div class="img-pick">${[1,2,3,4,5,6,7,8].map(i=>`<button data-img="assets/p${i}.webp" class="${i===1?"on":""}"><img src="assets/p${i}.webp" alt="" loading="lazy" width="72" height="72"></button>`).join("")}</div>
      <div class="row">
        <label class="fl">${t("sell.fName")}<input name="name" required></label>
        <label class="fl">${t("sell.fPhone")}<input name="phone" required inputmode="tel" pattern="01[0-9]{9}" placeholder="01xxxxxxxxx"></label>
      </div>
      <button class="btn btn-volt" style="justify-content:center">${t("sell.send")}</button>
      <a href="#/seller" style="color:var(--volt);font-size:.9rem;text-align:center">${t("sell.dashLink")}</a>
    </form>
  </section>`;
}

function vSeller(){
  const phone = store.get("seller-phone", null);
  if(!phone){
    queueMicrotask(() => { $("#dash-login").onsubmit = e => { e.preventDefault();
      store.set("seller-phone", $("#dash-phone").value.trim()); route(); }; });
    return `<section class="section track-card"><div class="sec-head"><h2>${t("dash.title")}<small>${t("dash.loginSub")}</small></h2></div>
      <form id="dash-login" class="form-grid"><input id="dash-phone" required inputmode="tel" pattern="01[0-9]{9}" placeholder="01xxxxxxxxx">
      <button class="btn btn-volt" style="justify-content:center">${t("dash.enter")}</button></form></section>`;
  }
  api("/listings?phone=" + encodeURIComponent(phone)).then(r => {
    let added = 0;
    for (const l of (r.listings||[])) if (!myListings.some(m=>m.id===l.id)) {
      myListings.push({id:l.id, nameAr:l.name_ar, nameEn:l.name_en, cat:l.cat, price:l.price, old:null, img:l.img,
        sizes:l.sizes, cond:l.cond, sellerName:l.seller_name, phone:l.seller_phone, status:l.status, views:l.views, ts:l.created_at});
      added++;
    }
    if (added){ store.set("listings", myListings); route(); }
  }).catch(()=>{});
  const mine = myListings.filter(l=>l.phone===phone);
  const views = mine.reduce((a,l)=>a+(l.views||Math.floor(Math.random()*40)+5),0);
  const sales = mine.filter(l=>l.status==="active").length*2;
  const earn = mine.filter(l=>l.status==="active").reduce((a,l)=>a+l.price*2,0);
  queueMicrotask(() => { $("#dash-out").onclick = () => { localStorage.removeItem("tair-seller-phone"); route(); };
    $$("[data-activate]").forEach(b => b.onclick = () => {
      api("/listings", {method:"PUT", headers:{"content-type":"application/json"}, body:JSON.stringify({id:b.dataset.activate, status:"active", key:"tair-admin-2026"})})
        .catch(()=>{}).finally(() => {
          const l = myListings.find(x=>x.id===b.dataset.activate);
          if(l){ l.status = "active"; store.set("listings", myListings); }
          route(); });
    });
  });
  return `<section class="section">
    <div class="sec-head"><h2>${t("dash.title")}<small dir="ltr">${esc(phone)}</small></h2><button class="btn btn-ghost" id="dash-out">${t("dash.logout")}</button></div>
    <div class="dash-cards">
      <div class="dash-card"><b>${views}</b><span>${t("dash.views")}</span></div>
      <div class="dash-card"><b>${sales}</b><span>${t("dash.sales")}</span></div>
      <div class="dash-card"><b>${earn.toLocaleString(LANG==="ar"?"ar-EG":"en")}</b><span>${t("dash.earn")}</span></div>
    </div>
    <p class="sub" style="color:var(--ink2);font-size:.82rem">${t("dash.demoNote")}</p>
    <h3 style="margin-block:1.4rem .8rem">${t("dash.listings")}</h3>
    ${mine.length===0 ? `<div class="empty">${t("dash.none")}</div>` : mine.map(l=>`
      <div class="listing-row"><img src="${l.img}" alt="" width="56" height="56">
        <div class="grow"><b>${esc(l.nameAr)}</b><br><small style="color:var(--ink2)">${fmt(l.price)} · ${t("cat."+l.cat)}</small></div>
        <span class="status ${l.status}">${l.status==="pending"?"قيد المراجعة":l.status==="active"?"منشور":l.status}</span>
        ${l.status==="pending"?`<button class="btn btn-ghost" style="padding:.4rem 1rem" data-activate="${l.id}">${LANG==="ar"?"نشر (ديمو موافقة)":"Publish (demo approve)"}</button>`:""}
      </div>`).join("")}
  </section>`;
}

function vTryon(params){
  const pid = params.get("p");
  const apparel = allProducts();
  queueMicrotask(() => initTryon(pid));
  return `<section class="section">
    <div class="sec-head"><h2>${t("try.title")}<small>${t("try.sub")}</small></h2></div>
    <div class="tryon-wrap">
      <div class="tryon-stage" id="ty-stage"><div class="tryon-drop" id="ty-drop">
        <span style="font-size:2.6rem">◉</span><p>${t("try.upload")}</p>
        <input type="file" id="ty-file" accept="image/*" hidden>
        <button class="btn btn-volt" id="ty-up">${t("try.upload")}</button>
        <div class="mannies"><span style="align-self:center;color:var(--ink2)">${t("try.or")}:</span>
          <button data-m="m1" class="on">${t("try.m1")}</button><button data-m="m2">${t("try.m2")}</button></div>
      </div></div>
      <div class="tryon-ctrl panel">
        <label>${t("try.product")}<select id="ty-p">${apparel.map(p=>`<option value="${p.id}" ${p.id===pid?"selected":""}>${esc(pname(p))}</option>`).join("")}</select></label>
        <label>${t("try.scale")}<input type="range" id="ty-scale" min="20" max="220" value="100"></label>
        <label>${t("try.rot")}<input type="range" id="ty-rot" min="-45" max="45" value="0"></label>
        <label class="pay-opt" style="cursor:pointer"><input type="checkbox" id="ty-bg" checked><b>${t("try.bg")}</b></label>
        <p style="color:var(--ink2);font-size:.85rem">${t("try.tip")}</p>
        <div class="privacy">🛡 ${t("try.privacy")}</div>
        <div style="display:flex;gap:.7rem"><button class="btn btn-ghost" id="ty-reset">${t("try.reset")}</button>
        <button class="btn btn-volt" id="ty-dl" style="flex:1;justify-content:center">${t("try.dl")}</button></div>
      </div>
    </div>
  </section>`;
}

/* try-on engine: canvas, in-browser only */
function initTryon(pid){
  const stage = $("#ty-stage"), drop = $("#ty-drop");
  let cv, ctx, base = null, prod = null, prodClean = null;
  let tx = 0, ty = 0, ts = 1, rot = 0, dragging = false, dx = 0, dy = 0;
  const mannequin = kind => {
    const c = document.createElement("canvas"); c.width = 600; c.height = 800; const g = c.getContext("2d");
    g.fillStyle = getComputedStyle(document.body).getPropertyValue("--bg2"); g.fillRect(0,0,600,800);
    g.fillStyle = "#8a8a83";
    g.beginPath(); g.ellipse(300,110,52,64,0,0,7); g.fill();           // head
    g.fillRect(278,168,44,30);                                          // neck
    g.beginPath();                                                      // torso
    if(kind==="m1"){ g.moveTo(190,200); g.quadraticCurveTo(300,168,410,200); g.lineTo(430,460); g.quadraticCurveTo(300,500,170,460); g.closePath(); }
    else { g.moveTo(200,200); g.quadraticCurveTo(300,176,400,200); g.lineTo(420,430); g.lineTo(380,520); g.lineTo(220,520); g.lineTo(180,430); g.closePath(); }
    g.fill();
    g.fillRect(200,520,85,240); g.fillRect(315,520,85,240);             // legs
    g.fillStyle = "#77776f"; g.font = "20px sans-serif"; g.textAlign="center";
    g.fillText("TAIR MANNEQUIN", 300, 780);
    return c;
  };
  function removeBg(img){
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img,0,0);
    const d = g.getImageData(0,0,c.width,c.height), px = d.data;
    const rs=[px[0],px[1],px[2]], T = 46;
    const seen = new Uint8Array(c.width*c.height), q = [[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]];
    while(q.length){ const [x,y] = q.pop(); const i = y*c.width+x;
      if(x<0||y<0||x>=c.width||y>=c.height||seen[i]) continue; seen[i]=1;
      const o=i*4, dr=px[o]-rs[0], dg=px[o+1]-rs[1], db=px[o+2]-rs[2];
      if(dr*dr+dg*dg+db*db < T*T*3){ px[o+3]=0; q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); } }
    g.putImageData(d,0,0); return c;
  }
  function draw(){
    if(!cv) return;
    ctx.clearRect(0,0,cv.width,cv.height);
    if(base) ctx.drawImage(base,0,0,cv.width,cv.height);
    if(prod){ const img = $("#ty-bg").checked && prodClean ? prodClean : prod;
      const w = cv.width*0.55*ts, h = w*img.height/img.width;
      ctx.save(); ctx.translate(cv.width/2+tx, cv.height*0.34+ty); ctx.rotate(rot*Math.PI/180);
      ctx.drawImage(img,-w/2,-h/2,w,h); ctx.restore(); }
  }
  function loadBase(src, isUrl){
    const img = new Image();
    img.onload = () => {
      if(!cv){ drop.remove(); cv = document.createElement("canvas"); stage.appendChild(cv); ctx = cv.getContext("2d"); bindDrag(); }
      const max = 900, r = Math.min(1, max/Math.max(img.width,img.height));
      cv.width = img.width*r; cv.height = img.height*r; base = img; draw();
    };
    if(isUrl) img.src = src; else img.src = src;
  }
  function loadProd(id){
    const p = findP(id); if(!p) return; const img = new Image();
    img.onload = () => { prod = img; prodClean = removeBg(img); draw(); };
    img.src = p.img;
  }
  function bindDrag(){
    const pos = e => { const r = cv.getBoundingClientRect(); const pt = e.touches?e.touches[0]:e;
      return [ (pt.clientX-r.left)*(cv.width/r.width), (pt.clientY-r.top)*(cv.height/r.height) ]; };
    const start = e => { dragging = true; [dx,dy] = pos(e); e.preventDefault(); };
    const move = e => { if(!dragging) return; const [x,y] = pos(e); tx += x-dx; ty += y-dy; dx=x; dy=y; draw(); e.preventDefault(); };
    const end = () => dragging = false;
    cv.addEventListener("pointerdown", start); cv.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }
  $("#ty-up").onclick = () => $("#ty-file").click();
  $("#ty-file").onchange = e => { const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader(); rd.onload = () => loadBase(rd.result); rd.readAsDataURL(f); };
  $$(".mannies button").forEach(b => b.onclick = () => {
    $$(".mannies button").forEach(x=>x.classList.toggle("on",x===b));
    loadBase(mannequin(b.dataset.m).toDataURL()); });
  $("#ty-p").onchange = e => loadProd(e.target.value);
  $("#ty-scale").oninput = e => { ts = e.target.value/100; draw(); };
  $("#ty-rot").oninput = e => { rot = +e.target.value; draw(); };
  $("#ty-bg").onchange = draw;
  $("#ty-reset").onclick = () => { tx=ty=0; ts=1; rot=0; $("#ty-scale").value=100; $("#ty-rot").value=0; draw(); };
  $("#ty-dl").onclick = () => { if(!cv) return; const a = document.createElement("a");
    a.download = "tair-tryon.png"; a.href = cv.toDataURL("image/png"); a.click(); };
  loadBase(mannequin("m1").toDataURL());
  loadProd(pid || apparelFirst());
  function apparelFirst(){ const a = allProducts().find(p=>p.cat==="hoodies"); return a?a.id:PRODUCTS[0].id; }
}

function vFeatures(){
  const done = 30;
  return `<section class="section">
    <div class="sec-head"><h2>${t("ft.title")}<small>${t("ft.sub")}</small></h2></div>
    <div class="progress-hero"><b>${done}/30</b><div class="pbar"><i style="width:${done/30*100}%"></i></div><span>${t("ft.done")}</span></div>
    <div class="feat-grid">${FEATURES30.map((f,i)=>`<div class="feat reveal"><span class="num">${String(i+1).padStart(2,"0")}</span>
      ${i<done?`<span class="done">✓</span>`:""}<h4>${f[0]}</h4><p>${f[1]}</p>
      <div class="vs"><b>${t("ft.vsLbl")}</b> ${f[2]}</div></div>`).join("")}</div>
  </section>`;
}

/* ---------- router ---------- */
function route(){
  const hash = location.hash || "#/";
  const [path, qs] = hash.slice(1).split("?");
  const params = new URLSearchParams(qs||"");
  const v = $("#view");
  let html, name = "home";
  if(path === "/" ){ html = vHome(); }
  else if(path === "/shop"){ html = vShop(params); name = "shop"; }
  else if(path.startsWith("/product/")){ html = vProduct(path.split("/")[2]); name = "shop"; }
  else if(path === "/track"){ html = vTrack(); name = "track"; }
  else if(path === "/sell"){ html = vSell(); name = "sell"; }
  else if(path === "/seller"){ html = vSeller(); name = "sell"; }
  else if(path === "/tryon"){ html = vTryon(params); name = "tryon"; }
  else if(path === "/features"){ html = vFeatures(); name = "features"; }
  else { html = `<section class="section"><div class="empty">404</div></section>`; }
  v.className = "view"; v.innerHTML = html;
  window.scrollTo({top:0, behavior:"instant"});
  $$("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav===name));
  revealIn(v); bindCards(v); bindRail(); bindHero();
}
function revealIn(root){
  const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }), {threshold:.12});
  $$(".reveal", root).forEach(el => io.observe(el));
}
function bindRail(){
  const rail = $("#rail"); if(!rail) return;
  let down = false, sx = 0, sl = 0;
  rail.addEventListener("pointerdown", e => { down = true; sx = e.clientX; sl = rail.scrollLeft; rail.classList.add("dragging"); });
  window.addEventListener("pointermove", e => { if(!down) return; rail.scrollLeft = sl - (e.clientX - sx); });
  window.addEventListener("pointerup", () => { down = false; rail.classList.remove("dragging"); });
}
function bindHero(){
  const img = $("#hero-img"); if(!img) return;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let cur = 0, target = 0;
  addEventListener("scroll", () => { target = Math.min(scrollY, 600); }, {passive:true});
  (function loop(){ cur += (target-cur)*.08;
    img.style.transform = `translateY(${cur*.22}px) rotate(${cur*.008}deg)`;
    requestAnimationFrame(loop); })();
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  applyLang();
  $("#lang-btn").onclick = () => { setLang(LANG==="ar"?"en":"ar"); route(); };
  const theme = store.get("theme","dark");
  document.documentElement.dataset.theme = theme;
  $("#theme-btn").textContent = theme==="dark" ? "☾" : "☀";
  $("#theme-btn").onclick = () => {
    const nx = document.documentElement.dataset.theme==="dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nx; store.set("theme", nx);
    $("#theme-btn").textContent = nx==="dark" ? "☾" : "☀";
  };
  $("#cart-btn").onclick = openCart;
  $("#overlay").onclick = closeCart;
  addEventListener("scroll", () => $("#hdr").classList.toggle("scrolled", scrollY>10), {passive:true});
  addEventListener("hashchange", route);
  updateCartCount(); route();
  api("/products").then(r => { if (r.products && r.products.length){ SERVER_PRODUCTS = r.products.map(p => ({
    id:p.id, slug:p.id, nameAr:p.name_ar, nameEn:p.name_en, brand:p.brand, cat:p.cat, price:p.price, old:p.old,
    img:p.img, badge:p.badge, rating:p.rating, rc:p.rc, sizes:p.sizes, history:p.history,
    seller:{name:p.seller_name, phone:p.seller_phone, official:p.official}, descAr:p.desc_ar })); route(); } }).catch(()=>{});
  setTimeout(() => $("#loader").classList.add("done"), 900);
  setTimeout(() => { const l = $("#loader"); if(l) l.style.display = "none"; }, 1600);
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
});
