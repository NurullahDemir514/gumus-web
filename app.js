window.addEventListener("DOMContentLoaded", () => {
  // ====== SABITLER (senin portföyün) ======
  const CFG = {
    silver: { totalBuyG: 216, avgCost: 91.8105, defaultSoldG: 66, defaultRealizedProfit: 1609.84 },
    aselsan:{ qty: 67, cost: 206.73 },
    ucaym: { qty: 80, cost: 18.00 }
  };

  // ====== FORMAT ======
  const TL = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const TL4 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const $ = (id) => document.getElementById(id);

/* =========================
   1) BUNU ESKİ toNum() YERİNE KOY
   ========================= */
const toNum = (s) => {
  if (s == null) return NaN;
  let t = String(s).trim();
  if (!t) return NaN;

  // boşlukları temizle
  t = t.replace(/\s+/g, "");

  const hasComma = t.includes(",");
  const hasDot = t.includes(".");

  // 1.234,56 -> 1234.56
  if (hasComma && hasDot) {
    t = t.replace(/\./g, "").replace(",", ".");
  }
  // 123,45 -> 123.45
  else if (hasComma && !hasDot) {
    t = t.replace(",", ".");
  }
  // 1234.56 -> 1234.56 (virgül binlikse temizle)
  else {
    t = t.replace(/,/g, "");
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

  const sign = (n) => (n > 0 ? "+" : (n < 0 ? "" : ""));
  const fmtSignedTL = (n) => Number.isFinite(n) ? `${sign(n)}${TL.format(n)} ₺` : "—";
  const fmtTL = (n) => Number.isFinite(n) ? `${TL.format(n)} ₺` : "—";
  const fmtTLg = (n) => Number.isFinite(n) ? `${TL4.format(n)} ₺/g` : "—";
  const fmtPct = (n) => Number.isFinite(n) ? `%${TL.format(n)}` : "—";
  const HISTORY_KEY = "onur_portfolio_history_v1";
  const HISTORY_SELECT_KEY = "onur_portfolio_history_select_v1";
  const MAX_HISTORY = 100;
  const monthsTR = [
    "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
    "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
  ];
  const pad2 = (x) => String(x).padStart(2,"0");
  const formatStamp = (ms) => {
    if (!Number.isFinite(ms)) return "—";
    const d = new Date(ms);
    return `${d.getDate()} ${monthsTR[d.getMonth()]} ${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const nowTR = () => formatStamp(Date.now());
  const clsNum = (n) => n > 0 ? "pos" : (n < 0 ? "neg" : "muted");

  // ====== STATE ======
  const KEY = "onur_portfolio_v3_single_table_center";
  const defaultState = () => ({
    prev: { silverPx: null, asPx: null, ucPx: null, totalProfit: null, stamp: null },
    cur:  { silverPx: null, asPx: null, ucPx: null, totalProfit: null, stamp: null },
    sales:{
      silver: { soldG: CFG.silver.defaultSoldG, realizedProfit: CFG.silver.defaultRealizedProfit },
      aselsan:{ soldQty: 0, realizedProfit: 0 },
      ucaym: { soldQty: 0, realizedProfit: 0 }
    }
  });

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
  const save = (st) => localStorage.setItem(KEY, JSON.stringify(st));
  const normalizeState = (st) => {
    const base = defaultState();
    if (!st || typeof st !== "object") return base;
    st.sales = st.sales || {};
    if (st.sales.soldG != null || st.sales.realizedProfit != null) {
      st.sales = {
        silver: {
          soldG: Number.isFinite(st.sales.soldG) ? st.sales.soldG : base.sales.silver.soldG,
          realizedProfit: Number.isFinite(st.sales.realizedProfit) ? st.sales.realizedProfit : base.sales.silver.realizedProfit,
        },
        aselsan: base.sales.aselsan,
        ucaym: base.sales.ucaym,
      };
    } else {
      st.sales.silver = st.sales.silver || base.sales.silver;
      st.sales.aselsan = st.sales.aselsan || base.sales.aselsan;
      st.sales.ucaym = st.sales.ucaym || base.sales.ucaym;
    }
    return { ...base, ...st, sales: st.sales };
  };
  let state = normalizeState(load());
  let lastCalc = null;

  // ====== CALC ======
  function compute(silverPx, asPx, ucPxOpt) {
    const soldG = state.sales.silver.soldG;
    const realized = state.sales.silver.realizedProfit;
    const remainG = CFG.silver.totalBuyG - soldG;

    const costRemain = remainG * CFG.silver.avgCost;
    const valueRemain = remainG * silverPx;
    const unreal = valueRemain - costRemain;
    const silverNet = unreal + realized;
    const silverNetPct = (costRemain > 0) ? (silverNet / costRemain * 100) : NaN;

    const soldTheo = soldG * (silverPx - CFG.silver.avgCost); // theor
    const missed = soldTheo - realized;
    const totalTheo = CFG.silver.totalBuyG * (silverPx - CFG.silver.avgCost);

    const asSold = state.sales.aselsan.soldQty;
    const asRealized = state.sales.aselsan.realizedProfit;
    const asRemain = CFG.aselsan.qty - asSold;
    const asCostRemain = asRemain * CFG.aselsan.cost;
    const asValue = asRemain * asPx;
    const asUnreal = asValue - asCostRemain;
    const asNet = asUnreal + asRealized;
    const asPct = (asCostRemain > 0) ? (asNet / asCostRemain * 100) : NaN;

    const ucCostTot = CFG.ucaym.qty * CFG.ucaym.cost;
    const ucHas = Number.isFinite(ucPxOpt);
    const ucSold = state.sales.ucaym.soldQty;
    const ucRealized = state.sales.ucaym.realizedProfit;
    const ucRemain = CFG.ucaym.qty - ucSold;
    const ucCostRemain = ucRemain * CFG.ucaym.cost;
    const ucValue = ucHas ? ucRemain * ucPxOpt : NaN;
    const ucUnreal = ucHas ? (ucValue - ucCostRemain) : NaN;
    const ucNet = ucHas ? (ucUnreal + ucRealized) : NaN;

    const totalProfit = silverNet + asNet + (ucHas ? ucNet : 0);
    const totalValue  = valueRemain + asValue + (ucHas ? ucValue : 0);

    return {
      inputs:{ silverPx, asPx, ucPxOpt, ucHas },
      silver:{ soldG, remainG, realized, unreal, net: silverNet, netPct: silverNetPct, costRemain, valueRemain, soldTheo, missed, totalTheo },
      aselsan:{ qty: CFG.aselsan.qty, remainQty: asRemain, cost: CFG.aselsan.cost, costRemain: asCostRemain, value: asValue, profit: asNet, pct: asPct },
      ucaym:{ qty: CFG.ucaym.qty, remainQty: ucRemain, cost: CFG.ucaym.cost, costRemain: ucCostRemain, value: ucValue, profit: ucNet, has: ucHas },
      totals:{ totalProfit, totalValue }
    };
  }

  // ====== RENDER ======
  function setTop(calc){
    $("nowPill").textContent = nowTR();
    $("stampPill").textContent = state.cur.stamp ? state.cur.stamp : "—";
    $("prevTag").textContent = state.prev.stamp ? state.prev.stamp : "—";
    $("quickBadge").textContent = (Number.isFinite(calc.inputs.silverPx) && Number.isFinite(calc.inputs.asPx))
      ? `Gümüş ${TL4.format(calc.inputs.silverPx)} ₺/g • ASELSAN ${TL.format(calc.inputs.asPx)} ₺`
      : "—";

    const tp = calc.totals.totalProfit;
    $("totalProfit").textContent = fmtSignedTL(tp);
    $("totalProfit").className = "val " + clsNum(tp);

    const prevTot = state.prev.totalProfit;
    if (Number.isFinite(prevTot)) {
      const diff = tp - prevTot;
      $("totDiffLine").innerHTML = `önceki: <span class="mono">${fmtSignedTL(prevTot)}</span> → <span class="mono ${clsNum(diff)}">${fmtSignedTL(diff)}</span>`;
    } else {
      $("totDiffLine").textContent = "önceki: —";
    }
  }

  function addOutRow(section, key, value, valueClass=""){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${key}</td>
      <td class="${valueClass}">${value}</td>
    `;
    return tr;
  }


/* =========================
   2) BUNU ESKİ renderOutputTable(calc) YERİNE KOY
   (tbody'yi iki kez ekleme bug'ını bitirir)
   ========================= */
  function renderOutputTable(calc, stampOverride){
  const prevSilver = state.prev.silverPx;
  const prevAs = state.prev.asPx;
  const prevTot = state.prev.totalProfit;

  const silverDiff = Number.isFinite(prevSilver) ? (calc.inputs.silverPx - prevSilver) : NaN;
  const asDiff     = Number.isFinite(prevAs) ? (calc.inputs.asPx - prevAs) : NaN;
  const totDiff    = Number.isFinite(prevTot) ? (calc.totals.totalProfit - prevTot) : NaN;

  const makeBody = (id) => {
    const tb = document.createElement("tbody");
    tb.id = id;
    return tb;
  };
  const tbSilver = makeBody("outSilver");
  const tbAselsan = makeBody("outAselsan");
  const tbUcaym = makeBody("outUcaym");
  const tbSummary = makeBody("outSummary");

  const add = (tbody, key, value, valueClass="", rowClass="") => {
    const tr = document.createElement("tr");
    if (rowClass) tr.className = rowClass;
    tr.innerHTML = `
      <td>${key}</td>
      <td class="${valueClass}">${value}</td>
    `;
    tbody.appendChild(tr);
  };

  // sınıf
  const clsNum = (n) => n > 0 ? "pos" : (n < 0 ? "neg" : "muted");

  // ===== GÜMÜŞ =====
  add(tbSilver, "Gümüş kalan", `${TL.format(calc.silver.remainG)} g`);
  add(tbSilver, "Gümüş anlık fiyat", `${TL4.format(calc.inputs.silverPx)} ₺/g`);
  add(tbSilver, "Gümüş güncel değer", fmtTL(calc.silver.valueRemain));
  add(tbSilver, "Gümüş net kâr", fmtSignedTL(calc.silver.net), clsNum(calc.silver.net));
  add(tbSilver, "Gümüş net kâr %", fmtPct(calc.silver.netPct), clsNum(calc.silver.netPct));

  // ===== ASELSAN =====
  add(tbAselsan, "ASELSAN miktar", `${calc.aselsan.remainQty} adet`);
  add(tbAselsan, "ASELSAN anlık fiyat", `${TL.format(calc.inputs.asPx)} ₺`);
  add(tbAselsan, "ASELSAN güncel değer", fmtTL(calc.aselsan.value));
  add(tbAselsan, "ASELSAN net kâr", fmtSignedTL(calc.aselsan.profit), clsNum(calc.aselsan.profit));
  add(tbAselsan, "ASELSAN net kâr %", fmtPct(calc.aselsan.pct), clsNum(calc.aselsan.pct));

  // ===== UCAYM =====
  add(tbUcaym, "UCAYM miktar", `${calc.ucaym.remainQty} lot`);
  add(tbUcaym, "UCAYM anlık fiyat", calc.ucaym.has ? `${TL.format(calc.inputs.ucPxOpt)} ₺` : "—");
  add(tbUcaym, "UCAYM güncel değer", calc.ucaym.has ? fmtTL(calc.ucaym.value) : "—");
  add(tbUcaym, "UCAYM net kâr", calc.ucaym.has ? fmtSignedTL(calc.ucaym.profit) : "—", calc.ucaym.has ? clsNum(calc.ucaym.profit) : "");

  // ===== GENEL =====
  const totalProfitStr = fmtSignedTL(calc.totals.totalProfit);
  add(tbSummary, "Toplam değer", fmtTL(calc.totals.totalValue));
  add(tbSummary, "Net kâr", totalProfitStr, clsNum(calc.totals.totalProfit), "netRow");
  const stampText = stampOverride || state.cur.stamp || "—";
  add(tbSummary, "Son güncelleme", stampText);

  // eski tbody varsa replace et; yoksa append et
  const replaceBody = (id, tb) => {
    const old = $(id);
    if (old) old.replaceWith(tb);
  };
  replaceBody("outSilver", tbSilver);
  replaceBody("outAselsan", tbAselsan);
  replaceBody("outUcaym", tbUcaym);
  replaceBody("outSummary", tbSummary);
  }

  function loadHistory(){
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
  }

  function saveHistory(list){
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-MAX_HISTORY)));
  }

  function pushHistory(calc){
    const list = loadHistory();
    list.push({
      t: Date.now(),
      stamp: state.cur.stamp || nowTR(),
      calc,
      totalProfit: calc.totals.totalProfit,
      totalValue: calc.totals.totalValue,
      silverNet: calc.silver.net,
      aselsanNet: calc.aselsan.profit,
      ucaymNet: calc.ucaym.profit,
    });
    saveHistory(list);
  }

  function renderHistorySelectOptions(){
    const sel = $("summaryHistorySelect");
    if (!sel) return;
    const history = loadHistory().slice().sort((a,b)=>b.t-a.t);
    const historyWithCalc = history.filter(h => h && h.calc);
    const saved = localStorage.getItem(HISTORY_SELECT_KEY) || "latest";
    sel.innerHTML = "";
    const optLatest = document.createElement("option");
    optLatest.value = "latest";
    optLatest.textContent = "Güncel";
    sel.appendChild(optLatest);
    historyWithCalc.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = String(h.t);
      opt.textContent = h.stamp || formatStamp(h.t);
      sel.appendChild(opt);
    });
    if (saved !== "latest" && historyWithCalc.some(h => String(h.t) === saved)) {
      sel.value = saved;
    } else {
      sel.value = "latest";
    }
    sel.disabled = historyWithCalc.length === 0;
  }

  function getSelectedHistoryEntry(){
    const sel = $("summaryHistorySelect");
    if (!sel || sel.value === "latest") return null;
    const t = Number(sel.value);
    if (!Number.isFinite(t)) return null;
    const history = loadHistory();
    return history.find(h => h.t === t) || null;
  }

  function applySummarySelection(calc){
    const entry = getSelectedHistoryEntry();
    if (entry && entry.calc) {
      renderOutputTable(entry.calc, entry.stamp || formatStamp(entry.t));
      return;
    }
    renderOutputTable(calc);
  }

  /* ---------- Premium Canvas Charts (v2) ---------- */
  const ChartsV2 = (() => {
    const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

    const fmtCompactTL = (n) => {
      if (!Number.isFinite(n)) return "—";
      const abs = Math.abs(n);
      const nf1 = new Intl.NumberFormat("tr-TR",{maximumFractionDigits:1});
      const nf2 = new Intl.NumberFormat("tr-TR",{maximumFractionDigits:2});
      if (abs >= 1e9)  return `${nf2.format(n/1e9)}B ₺`;
      if (abs >= 1e6)  return `${nf2.format(n/1e6)}M ₺`;
      if (abs >= 1e3)  return `${nf1.format(n/1e3)}K ₺`;
      return `${TL.format(n)} ₺`;
    };

    const fmtTimeTR = (ms) => {
      try{
        return new Intl.DateTimeFormat("tr-TR",{
          day:"2-digit", month:"2-digit",
          hour:"2-digit", minute:"2-digit"
        }).format(new Date(ms));
      }catch{
        return "—";
      }
    };

    function setupHiDPI(canvas){
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(10, Math.floor(rect.width));
      const h = Math.max(10, Math.floor(rect.height));
      canvas.width  = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      return { ctx, w, h, dpr };
    }

    function catmullRomToBezier(points){
      if (points.length < 3) return null;
      const segs = [];
      for (let i=0;i<points.length-1;i++){
        const p0 = points[i-1] || points[i];
        const p1 = points[i];
        const p2 = points[i+1];
        const p3 = points[i+2] || p2;

        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;

        segs.push({ p1, c1:{x:c1x,y:c1y}, c2:{x:c2x,y:c2y}, p2 });
      }
      return segs;
    }

    class LineChart {
      constructor(canvas, tip, opts){
        this.canvas = canvas;
        this.tip = tip;
        this.opts = opts || {};
        this.series = [];
        this.hoverI = -1;
        this._raf = 0;

        this._bind();
        this.draw();
      }

      setSeries(series){
        this.series = (series || []).filter(p => Number.isFinite(p.y));
        this.hoverI = -1;
        this.draw();
      }

      _bind(){
        const onMove = (e) => {
          if (!this.series.length) return;
          const rect = this.canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;

          const { padL, padR } = this._layout(rect.width, rect.height);
          const usableW = rect.width - padL - padR;

          const i = clamp(Math.round(((x - padL) / (usableW || 1)) * (this.series.length - 1)), 0, this.series.length - 1);
          if (i !== this.hoverI){
            this.hoverI = i;
            this._scheduleDraw();
          }
          this._showTip(e.clientX, e.clientY, i);
        };

        const onLeave = () => {
          this.hoverI = -1;
          this._hideTip();
          this.draw();
        };

        this.canvas.addEventListener("mousemove", onMove);
        this.canvas.addEventListener("mouseleave", onLeave);
        window.addEventListener("resize", () => this._scheduleDraw());
      }

      _scheduleDraw(){
        cancelAnimationFrame(this._raf);
        this._raf = requestAnimationFrame(() => this.draw());
      }

      _layout(w,h){
        return {
          padL: 46,
          padR: 16,
          padT: 12,
          padB: 26
        };
      }

      _domain(){
        const ys = this.series.map(p=>p.y);
        let min = Math.min(...ys);
        let max = Math.max(...ys);

        if (this.opts.includeZero){
          min = Math.min(min, 0);
          max = Math.max(max, 0);
        }
        const range = (max - min) || 1;
        const pad = range * 0.12;
        return { min: min - pad, max: max + pad, rawMin: Math.min(...ys), rawMax: Math.max(...ys) };
      }

      _showTip(clientX, clientY, i){
        if (!this.tip) return;
        const p = this.series[i];
        if (!p) return;

        const title = this.opts.title || "—";
        const val = (this.opts.valueFmt || ((v)=>fmtCompactTL(v)))(p.y);
        const time = fmtTimeTR(p.t);

        this.tip.innerHTML = `
          <div class="t1">${title} • ${time}</div>
          <div class="t2">${val}</div>
          <div class="t3">${i+1}/${this.series.length}</div>
        `;

        this.tip.classList.add("isOn");
        this.tip.style.left = `${clientX}px`;
        this.tip.style.top  = `${clientY}px`;
      }

      _hideTip(){
        if (!this.tip) return;
        this.tip.classList.remove("isOn");
      }

      draw(){
        const { ctx, w, h } = setupHiDPI(this.canvas);
        const L = this._layout(w,h);
        const padL=L.padL, padR=L.padR, padT=L.padT, padB=L.padB;

        ctx.clearRect(0,0,w,h);

        if (!this.series.length){
          ctx.fillStyle = "rgba(255,255,255,.45)";
          ctx.font = "12px ui-sans-serif, system-ui";
          ctx.fillText("Veri yok — fiyat girip Hesapla/Kaydet'e bas", padL, h/2);
          return;
        }

        const dom = this._domain();
        const minY = dom.min, maxY = dom.max;

        const xScale = (i) => padL + (i/(Math.max(1,this.series.length-1))) * (w - padL - padR);
        const yScale = (v) => padT + (1 - (v - minY)/((maxY - minY)||1)) * (h - padT - padB);

        ctx.strokeStyle = "rgba(255,255,255,.08)";
        ctx.lineWidth = 1;
        const gridN = 4;
        for(let g=0; g<=gridN; g++){
          const y = padT + (g/gridN)*(h - padT - padB);
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(w - padR, y);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
        const yTop = maxY;
        const yMid = (maxY + minY)/2;
        const yBot = minY;
        ctx.fillText(fmtCompactTL(yTop), 8, yScale(yTop)+4);
        ctx.fillText(fmtCompactTL(yMid), 8, yScale(yMid)+4);
        ctx.fillText(fmtCompactTL(yBot), 8, yScale(yBot)+4);

        if (this.opts.includeZero){
          const y0 = yScale(0);
          ctx.setLineDash([6,6]);
          ctx.strokeStyle = "rgba(255,255,255,.18)";
          ctx.beginPath();
          ctx.moveTo(padL, y0);
          ctx.lineTo(w-padR, y0);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const pts = this.series.map((p,i)=>({ x:xScale(i), y:yScale(p.y), v:p.y, t:p.t }));

        const grad = ctx.createLinearGradient(0,padT,0,h-padB);
        grad.addColorStop(0, "rgba(106,169,255,.22)");
        grad.addColorStop(1, "rgba(106,169,255,.02)");

        const lastV = this.series[this.series.length-1].y;
        const lineCol = this.opts.dynamicColor
          ? (lastV >= 0 ? "rgba(65,209,125,.95)" : "rgba(255,92,122,.95)")
          : "rgba(106,169,255,.95)";

        ctx.beginPath();
        if (pts.length <= 2){
          ctx.moveTo(pts[0].x, pts[0].y);
          if (pts[1]) ctx.lineTo(pts[1].x, pts[1].y);
        } else {
          ctx.moveTo(pts[0].x, pts[0].y);
          const segs = catmullRomToBezier(pts);
          for (const s of segs){
            ctx.bezierCurveTo(s.c1.x,s.c1.y,s.c2.x,s.c2.y,s.p2.x,s.p2.y);
          }
        }

        ctx.save();
        ctx.beginPath();
        if (pts.length === 1){
          ctx.moveTo(pts[0].x, pts[0].y);
        } else if (pts.length === 2){
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(pts[1].x, pts[1].y);
        } else {
          ctx.moveTo(pts[0].x, pts[0].y);
          const segs = catmullRomToBezier(pts);
          for (const s of segs){
            ctx.bezierCurveTo(s.c1.x,s.c1.y,s.c2.x,s.c2.y,s.p2.x,s.p2.y);
          }
        }
        ctx.lineTo(pts[pts.length-1].x, h-padB);
        ctx.lineTo(pts[0].x, h-padB);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = lineCol;
        ctx.lineWidth = 2.25;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        ctx.beginPath();
        if (pts.length <= 2){
          ctx.moveTo(pts[0].x, pts[0].y);
          if (pts[1]) ctx.lineTo(pts[1].x, pts[1].y);
        } else {
          ctx.moveTo(pts[0].x, pts[0].y);
          const segs = catmullRomToBezier(pts);
          for (const s of segs){
            ctx.bezierCurveTo(s.c1.x,s.c1.y,s.c2.x,s.c2.y,s.p2.x,s.p2.y);
          }
        }
        ctx.stroke();

        const ys = this.series.map(p=>p.y);
        const minI = ys.indexOf(Math.min(...ys));
        const maxI = ys.indexOf(Math.max(...ys));
        const lastI = ys.length-1;

        const drawDot = (i, r, fill) => {
          const p = pts[i];
          ctx.beginPath();
          ctx.arc(p.x,p.y,r,0,Math.PI*2);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,.35)";
          ctx.lineWidth = 2;
          ctx.stroke();
        };

        if (this.hoverI >= 0){
          const hp = pts[this.hoverI];
          ctx.strokeStyle = "rgba(255,255,255,.14)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4,6]);
          ctx.beginPath();
          ctx.moveTo(hp.x, padT);
          ctx.lineTo(hp.x, h-padB);
          ctx.stroke();
          ctx.setLineDash([]);
          drawDot(this.hoverI, 4, lineCol);
        }

        drawDot(lastI, 4, lineCol);
        if (minI !== lastI) drawDot(minI, 3, "rgba(255,255,255,.65)");
        if (maxI !== lastI) drawDot(maxI, 3, "rgba(255,255,255,.65)");

        const chip = (text, x, y, align="left") => {
          const padX=8, padY=5;
          ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
          const tw = ctx.measureText(text).width;
          const bw = tw + padX*2;
          const bh = 22;

          let bx = align==="right" ? x - bw : x;
          bx = clamp(bx, 8, w - bw - 8);
          let by = y - bh - 10;
          by = clamp(by, 6, h - bh - 6);

          ctx.fillStyle = "rgba(0,0,0,.55)";
          ctx.strokeStyle = "rgba(255,255,255,.12)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx,by,bw,bh,10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "rgba(255,255,255,.88)";
          ctx.fillText(text, bx+padX, by+15);
        };

        chip(`son: ${fmtCompactTL(ys[lastI])}`, pts[lastI].x, pts[lastI].y, "right");
        if (pts.length >= 3){
          chip(`min: ${fmtCompactTL(ys[minI])}`, pts[minI].x, pts[minI].y, "left");
          chip(`max: ${fmtCompactTL(ys[maxI])}`, pts[maxI].x, pts[maxI].y, "left");
        }

        ctx.fillStyle = "rgba(255,255,255,.45)";
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
        const t0 = this.series[0].t;
        const tL = this.series[lastI].t;
        ctx.fillText(fmtTimeTR(t0), padL, h-8);
        const rightTxt = fmtTimeTR(tL);
        const rightW = ctx.measureText(rightTxt).width;
        ctx.fillText(rightTxt, w - padR - rightW, h-8);
      }
    }

    class BarsChart {
      constructor(canvas, tip){
        this.canvas=canvas;
        this.tip=tip;
        this.bars=[];
        this.hover=-1;
        this._raf=0;
        this._bind();
        this.draw();
      }

      setBars(bars){
        this.bars = (bars||[]).map(b=>({ ...b, value: Number.isFinite(b.value) ? b.value : 0 }));
        this.hover=-1;
        this.draw();
      }

      _bind(){
        const onMove=(e)=>{
          if (!this.bars.length) return;
          const rect=this.canvas.getBoundingClientRect();
          const x=e.clientX-rect.left;
          const y=e.clientY-rect.top;

          const idx = this._hitIndex(x,y,rect.width,rect.height);
          if (idx !== this.hover){
            this.hover=idx;
            this._schedule();
          }
          if (idx>=0) this._showTip(e.clientX,e.clientY,idx);
          else this._hideTip();
        };
        const onLeave=()=>{ this.hover=-1; this._hideTip(); this.draw(); };
        this.canvas.addEventListener("mousemove", onMove);
        this.canvas.addEventListener("mouseleave", onLeave);
        window.addEventListener("resize", ()=>this._schedule());
      }

      _schedule(){
        cancelAnimationFrame(this._raf);
        this._raf=requestAnimationFrame(()=>this.draw());
      }

      _hitIndex(x,y,w,h){
        const padL=70,padR=14,padT=12,padB=28;
        const slot=(w-padL-padR)/this.bars.length;
        for(let i=0;i<this.bars.length;i++){
          const bx=padL+i*slot+10;
          const bw=slot-20;
          const by=padT;
          const bh=h-padT-padB;
          if (x>=bx && x<=bx+bw && y>=by && y<=by+bh) return i;
        }
        return -1;
      }

      _showTip(cx,cy,i){
        if (!this.tip) return;
        const b=this.bars[i];
        this.tip.innerHTML = `
          <div class="t1">Varlık • ${b.label}</div>
          <div class="t2">${fmtCompactTL(b.value)}</div>
          <div class="t3">${b.subtitle || ""}</div>
        `;
        this.tip.classList.add("isOn");
        this.tip.style.left=`${cx}px`;
        this.tip.style.top=`${cy}px`;
      }

      _hideTip(){
        if (!this.tip) return;
        this.tip.classList.remove("isOn");
      }

      draw(){
        const { ctx, w, h } = setupHiDPI(this.canvas);
        ctx.clearRect(0,0,w,h);

        if(!this.bars.length){
          ctx.fillStyle="rgba(255,255,255,.45)";
          ctx.font="12px ui-sans-serif, system-ui";
          ctx.fillText("Veri yok", 16, h/2);
          return;
        }

        const padL=70,padR=14,padT=12,padB=28;
        const maxAbs=Math.max(...this.bars.map(b=>Math.abs(b.value))) || 1;
        const zeroY = padT + (h-padT-padB)/2;

        ctx.strokeStyle="rgba(255,255,255,.16)";
        ctx.lineWidth=1;
        ctx.setLineDash([6,6]);
        ctx.beginPath();
        ctx.moveTo(padL, zeroY);
        ctx.lineTo(w-padR, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle="rgba(255,255,255,.55)";
        ctx.font="11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
        ctx.fillText(fmtCompactTL(maxAbs), 10, padT+10);
        ctx.fillText(fmtCompactTL(-maxAbs), 10, h-padB);

        const slot=(w-padL-padR)/this.bars.length;

        this.bars.forEach((b,i)=>{
          const bx=padL+i*slot+10;
          const bw=slot-20;

          const usable=(h-padT-padB)/2 - 10;
          const bh = (Math.abs(b.value)/maxAbs)*usable;

          const isPos = b.value >= 0;
          const y = isPos ? zeroY - bh : zeroY;
          const col = isPos ? "rgba(65,209,125,.85)" : "rgba(255,92,122,.85)";

          ctx.fillStyle="rgba(106,169,255,.08)";
          ctx.beginPath();
          ctx.roundRect(bx, padT, bw, h-padT-padB, 10);
          ctx.fill();

          ctx.fillStyle=col;
          ctx.beginPath();
          ctx.roundRect(bx, y, bw, bh, 10);
          ctx.fill();

          if (this.hover === i){
            ctx.strokeStyle="rgba(255,255,255,.22)";
            ctx.lineWidth=2;
            ctx.beginPath();
            ctx.roundRect(bx, padT, bw, h-padT-padB, 10);
            ctx.stroke();
          }

          ctx.fillStyle="rgba(255,255,255,.65)";
          ctx.font="11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
          const lbl=b.label;
          const lw=ctx.measureText(lbl).width;
          ctx.fillText(lbl, bx + (bw-lw)/2, h-8);

          ctx.fillStyle="rgba(255,255,255,.9)";
          ctx.font="11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
          const vt = fmtCompactTL(b.value);
          const vw=ctx.measureText(vt).width;
          const vy = isPos ? (y-8) : (y+bh+16);
          ctx.fillText(vt, bx + (bw-vw)/2, clamp(vy, padT+12, h-padB-18));
        });
      }
    }

    return { LineChart, BarsChart };
  })();

  /* ---------- renderCharts (premium) ---------- */
  let _chartProfitV2, _chartValueV2, _chartBarsV2;

  function renderCharts(calc){
    const history = loadHistory();

    const profitSeries = history
      .map(h => ({ t: h.t, y: h.totalProfit }))
      .filter(p => Number.isFinite(p.y));

    const valueSeries = history
      .map(h => ({ t: h.t, y: h.totalValue }))
      .filter(p => Number.isFinite(p.y));

    if (!_chartProfitV2){
      _chartProfitV2 = new ChartsV2.LineChart($("chartProfit"), $("tipProfit"), {
        title: "Toplam Net Kâr",
        includeZero: true,
        dynamicColor: true,
        valueFmt: (v)=>fmtSignedTL(v)
      });
      _chartValueV2 = new ChartsV2.LineChart($("chartValue"), $("tipValue"), {
        title: "Toplam Değer",
        includeZero: false,
        dynamicColor: false,
        valueFmt: (v)=>fmtTL(v)
      });
      _chartBarsV2 = new ChartsV2.BarsChart($("chartBars"), $("tipBars"));
    }

    $("chartCountProfit").textContent = profitSeries.length ? `(${profitSeries.length} veri)` : "(0 veri)";
    $("chartCountValue").textContent  = valueSeries.length ? `(${valueSeries.length} veri)` : "(0 veri)";

    const setBadge = (el, series, fmtVal) => {
      if (!el) return;
      if (!series.length){
        el.textContent = "—";
        return;
      }
      const last = series[series.length-1].y;
      const prev = series.length >= 2 ? series[series.length-2].y : last;
      const diff = last - prev;
      const pct = prev ? (diff / Math.abs(prev) * 100) : 0;
      el.textContent = `${fmtVal(last)} • ${diff>=0?"+":""}${TL.format(diff)}₺ • ${pct>=0?"+":""}${TL.format(pct)}%`;
    };

    setBadge($("chartBadgeProfit"), profitSeries, (v)=>fmtSignedTL(v));
    setBadge($("chartBadgeValue"),  valueSeries,  (v)=>fmtTL(v));

    _chartProfitV2.setSeries(profitSeries);
    _chartValueV2.setSeries(valueSeries);

    const uc = Number.isFinite(calc.ucaym.profit) ? calc.ucaym.profit : 0;
    _chartBarsV2.setBars([
      { label: "Gümüş", value: calc.silver.net, subtitle: "Net kâr katkısı" },
      { label: "ASEL",  value: calc.aselsan.profit, subtitle: "Net kâr katkısı" },
      { label: "UCAYM", value: uc, subtitle: calc.ucaym.has ? "Net kâr katkısı" : "Fiyat yok (0)" }
    ]);
  }

  function syncAll(calc){
    setTop(calc);
    lastCalc = calc;
    renderHistorySelectOptions();
    applySummarySelection(calc);
    renderCharts(calc);
  }

  // ====== ACTIONS ======
  function calcAndPersist(silent=false){

    // inputları da kaydet
    saveInputs();

    const silverPx = toNum($("inpSilver").value);
    const asPx = toNum($("inpAselsan").value);
    const ucPx = toNum($("inpUcaym").value);

    if (!Number.isFinite(silverPx) || !Number.isFinite(asPx)) {
      if (!silent) alert("Gümüş ve ASELSAN zorunlu. Lütfen sayı gir.");
      return;
    }

    // shift current -> prev
    state.prev = {
      silverPx: state.cur.silverPx,
      asPx: state.cur.asPx,
      ucPx: state.cur.ucPx,
      totalProfit: state.cur.totalProfit,
      stamp: state.cur.stamp
    };

    const stamp = nowTR();
    state.cur = { silverPx, asPx, ucPx: Number.isFinite(ucPx) ? ucPx : null, totalProfit: null, stamp };

    const calc = compute(silverPx, asPx, Number.isFinite(ucPx) ? ucPx : NaN);
    state.cur.totalProfit = calc.totals.totalProfit;
    pushHistory(calc);

    save(state);
    syncAll(calc);
  }

  function getActiveValue(groupId, fallback) {
    const group = $(groupId);
    if (!group) return fallback;
    const btn = group.querySelector(".pillBtn.isActive");
    return btn ? btn.dataset.value : fallback;
  }

  function bindPillGroup(groupId){
    const group = $(groupId);
    if (!group) return;
    group.querySelectorAll(".pillBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".pillBtn").forEach((b) => b.classList.remove("isActive"));
        btn.classList.add("isActive");
      });
    });
  }

  function addTrade(){
    const asset = getActiveValue("assetGroup", "silver");
    const type = getActiveValue("typeGroup", "sell"); // buy | sell
    const q = toNum($("tradeQty").value);
    const px = toNum($("tradePx").value);
    if (!Number.isFinite(q) || !Number.isFinite(px) || q <= 0) {
      alert("İşlem için miktar + fiyat gir (pozitif sayı).");
      return;
    }

    const cfgMap = {
      silver: { max: CFG.silver.totalBuyG, cost: CFG.silver.avgCost, unit: "g" },
      aselsan:{ max: CFG.aselsan.qty, cost: CFG.aselsan.cost, unit: "adet" },
      ucaym: { max: CFG.ucaym.qty, cost: CFG.ucaym.cost, unit: "lot" },
    };
    const cfg = cfgMap[asset];
    const saleState = state.sales[asset];
    const sign = type === "sell" ? 1 : -1;
    const nextSold = saleState.soldQty != null
      ? saleState.soldQty + sign * q
      : saleState.soldG + sign * q;

    if (nextSold < 0) {
      alert("Alış, mevcut satışı sıfırın altına indiremez.");
      return;
    }
    if (nextSold > cfg.max) {
      alert(`Maksimum satılabilir: ${TL.format(cfg.max)} ${cfg.unit}`);
      return;
    }

    const addProfit = sign * q * (px - cfg.cost);
    if (saleState.soldQty != null) {
      saleState.soldQty = nextSold;
    } else {
      saleState.soldG = nextSold;
    }
    saleState.realizedProfit += addProfit;

    $("tradeQty").value = "";
    $("tradePx").value = "";
    save(state);

    if (Number.isFinite(state.cur.silverPx) && Number.isFinite(state.cur.asPx)) {
      const calc = compute(state.cur.silverPx, state.cur.asPx, Number.isFinite(state.cur.ucPx) ? state.cur.ucPx : NaN);
      state.cur.totalProfit = calc.totals.totalProfit;
      save(state);
      syncAll(calc);
    } else {
      alert("İşlem eklendi. Güncel fiyatları girip hesapla.");
    }
  }

  function resetAll(){
    if (!confirm("Tüm kayıtlar sıfırlansın mı? (fiyatlar + satışlar)")) return;
    localStorage.removeItem(KEY);
    state = (function(){
      const st = defaultState();
      return st;
    })();
    $("inpSilver").value = "";
    $("inpAselsan").value = "";
    $("inpUcaym").value = "";
    $("tradeQty").value = "";
    $("tradePx").value = "";
    $("totalProfit").textContent = "—";
    $("totDiffLine").textContent = "önceki: —";
    $("prevTag").textContent = "—";
    $("stampPill").textContent = "—";
    $("quickBadge").textContent = "—";
    $("nowPill").textContent = nowTR();
    ["outSilver","outAselsan","outUcaym","outSummary"].forEach((id) => {
      const tb = $(id);
      if (tb) tb.innerHTML = `<tr><td colspan="2" class="muted">—</td></tr>`;
    });
  }

  // ====== INIT ======
  $("btnCalc").addEventListener("click", calcAndPersist);
  $("btnAddTrade").addEventListener("click", addTrade);
  $("btnReset").addEventListener("click", resetAll);
  bindPillGroup("assetGroup");
  bindPillGroup("typeGroup");
  const historySelect = $("summaryHistorySelect");
  if (historySelect) {
    historySelect.addEventListener("change", () => {
      localStorage.setItem(HISTORY_SELECT_KEY, historySelect.value);
      if (lastCalc) applySummarySelection(lastCalc);
    });
  }


  // === INPUTLARDA SON GİRİLENİ KAYDET/YÜKLE ===
  const INPUT_KEY = "onur_portfolio_inputs";
  // inputları kaydet
  function saveInputs() {
    localStorage.setItem(INPUT_KEY, JSON.stringify({
      silver: $("inpSilver").value,
      aselsan: $("inpAselsan").value,
      ucaym: $("inpUcaym").value
    }));
  }
  // inputları yükle
  function loadInputs() {
    try {
      const d = JSON.parse(localStorage.getItem(INPUT_KEY)||"null");
      if (d && typeof d==="object") {
        if (d.silver != null) $("inpSilver").value = d.silver;
        if (d.aselsan != null) $("inpAselsan").value = d.aselsan;
        if (d.ucaym != null) $("inpUcaym").value = d.ucaym;
      }
    } catch {}
  }
  // input değişince kaydet
  ["inpSilver","inpAselsan","inpUcaym"].forEach(id => {
    $(id).addEventListener("input", saveInputs);
  });
  // ilk açılışta yükle
  loadInputs();

  $("nowPill").textContent = nowTR();
  $("stampPill").textContent = state.cur.stamp ? state.cur.stamp : "—";
    $("prevTag").textContent = state.prev.stamp ? state.prev.stamp : "—";
  renderHistorySelectOptions();

  // initial render if have prices
  if (Number.isFinite(state.cur.silverPx) && Number.isFinite(state.cur.asPx)) {
    const calc = compute(state.cur.silverPx, state.cur.asPx, Number.isFinite(state.cur.ucPx) ? state.cur.ucPx : NaN);
    state.cur.totalProfit = calc.totals.totalProfit;
    save(state);
    syncAll(calc);
  } else {
    // placeholders
    $("quickBadge").textContent = "—";
    $("totDiffLine").textContent = "önceki: —";
    const entry = getSelectedHistoryEntry();
    if (entry && entry.calc) {
      renderOutputTable(entry.calc, entry.stamp || formatStamp(entry.t));
    }
  }
});
