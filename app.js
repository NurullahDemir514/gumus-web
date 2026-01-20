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
  const QTY = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 6 });
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
  const fmtSignedPct = (n) => Number.isFinite(n) ? `${sign(n)}%${TL.format(n)}` : "—";
  const HISTORY_KEY = "onur_portfolio_history_v1";
  const HISTORY_SELECT_KEY = "onur_portfolio_history_select_v1";
  const TX_KEY = "gmsweb_tx_v1";
  const TX_SEED_VERSION_KEY = "gmsweb_tx_seed_v1";
  const TX_SEED_VERSION = "2025-11-10-remove-2g";
  const COST_OVERRIDES = { ASELS: 206.73 };
  const MAX_HISTORY = 2000;
  const MAX_CHART_POINTS = 120;
  const DAY_AVG_THRESHOLD = 5;
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
  let historyFilter = "all";
  let txFilter = "all";
  let lastTopProfit = null;
  let selectedHistoryT = null;
  const deleteStack = [];
  let toastTimer = null;
  let historyEventsBound = false;
  let perfLast = performance.now();
  let perfFrames = 0;
  let perfDropped = 0;
  let perfLastStamp = performance.now();
  let perfMaxLong = 0;
  let perfLastEvent = "idle";
  const PERF_LOG_KEY = "onur_portfolio_perf_log_v1";
  const PERF_LOG_MAX = 900;
  const perfLog = [];

  const setPerfEvent = (name) => {
    perfLastEvent = name;
  };

  const setFieldError = (id, msg) => {
    const input = $(id);
    const help = $(`err${id.replace("inp","")}`);
    if (input) input.classList.add("inputInvalid");
    if (help) {
      help.textContent = msg;
      help.classList.add("isError");
    }
  };
  const clearFieldError = (id) => {
    const input = $(id);
    const help = $(`err${id.replace("inp","")}`);
    if (input) input.classList.remove("inputInvalid");
    if (help) {
      help.textContent = "";
      help.classList.remove("isError");
    }
  };
  const setTradeError = (msg) => {
    const help = $("tradeHelp");
    if (help) {
      help.textContent = msg;
      help.classList.add("isError");
    }
  };
  const setTradeHelp = (msg) => {
    const help = $("tradeHelp");
    if (help) {
      help.textContent = msg;
      help.classList.remove("isError");
    }
  };
  const clearTradeError = () => {
    const help = $("tradeHelp");
    if (help) {
      help.textContent = "";
      help.classList.remove("isError");
    }
  };

  const dayKey = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };
  const dayLabel = (ms) => {
    const d = new Date(ms);
    return `${d.getDate()} ${monthsTR[d.getMonth()]} ${d.getFullYear()}`;
  };
  const formatDate = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };
  const formatTime = (ms) => {
    const d = new Date(ms);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const roundTo = (n, digits) => {
    if (!Number.isFinite(n)) return NaN;
    const pow = 10 ** digits;
    return Math.round(n * pow) / pow;
  };
  const fmtQty = (n) => Number.isFinite(n) ? QTY.format(n) : "—";

  const downsampleDaily = (points, { threshold, maxPoints }) => {
    if (!points.length) return [];
    const out = [];
    let i = 0;
    while (i < points.length){
      const key = dayKey(points[i].t);
      const bucket = [];
      while (i < points.length && dayKey(points[i].t) === key){
        bucket.push(points[i]);
        i += 1;
      }
      if (bucket.length <= threshold){
        out.push(...bucket);
      } else {
        const ys = bucket.map(p => p.y);
        const sum = ys.reduce((a,b)=>a+b,0);
        const avgY = sum / bucket.length;
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const lastT = bucket[bucket.length-1].t;
        out.push({
          t: lastT,
          y: avgY,
          meta: {
            n: bucket.length,
            min: minY,
            max: maxY,
            open: bucket[0].y,
            close: bucket[bucket.length-1].y,
            kind: "dayAvg"
          }
        });
      }
    }

    if (out.length <= maxPoints) return out;
    const sampled = [];
    for (let j=0; j<maxPoints; j++){
      const idx = Math.round(j * (out.length - 1) / (maxPoints - 1));
      sampled.push(out[idx]);
    }
    return sampled;
  };

  // Build series with display mode applied before downsampling.
  const buildSeries = (history, field, mode="abs") => {
    const points = history
      .map(h => ({ t: h.t, y: h[field] }))
      .filter(p => Number.isFinite(p.y))
      .sort((a,b)=>a.t-b.t);
    if (!points.length) return [];

    let series = points.map(p => ({ t: p.t, y: p.y, meta: null }));
    if (mode === "delta"){
      series = series.map((p, idx) => {
        if (idx === 0) return { ...p, y: 0 };
        return { ...p, y: p.y - series[idx-1].y };
      });
    } else if (mode === "pct"){
      const base = series[0].y;
      series = series.map((p, idx) => {
        if (idx === 0) return { ...p, y: 0 };
        if (!Number.isFinite(base) || base === 0) return { ...p, y: 0 };
        return { ...p, y: ((p.y - base) / Math.abs(base)) * 100 };
      });
    }

    return downsampleDaily(series, { threshold: DAY_AVG_THRESHOLD, maxPoints: MAX_CHART_POINTS });
  };

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

  // ====== LEDGER ======
  const loadTransactions = () => {
    try {
      const data = JSON.parse(localStorage.getItem(TX_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };
  const saveTransactions = (list) => {
    localStorage.setItem(TX_KEY, JSON.stringify(list));
  };
  const makeId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  };
  const buildHash = (tx) => {
    const dtBucket = Math.floor(tx.dt / 60000);
    const qtyR = roundTo(tx.qty, 6);
    const unitPriceR = roundTo(tx.unitPrice, 6);
    const totalR = roundTo(tx.totalAmount, 2);
    const asset = String(tx.asset || "").toUpperCase();
    const side = String(tx.side || "").toUpperCase();
    return `${dtBucket}|${asset}|${side}|${qtyR}|${unitPriceR}|${totalR}`;
  };
  const mergeTransactions = (incoming) => {
    const existing = loadTransactions();
    const set = new Set(existing.map(t => t.hash));
    const onlyNew = incoming.filter(t => t && t.hash && !set.has(t.hash));
    const merged = [...existing, ...onlyNew].sort((a, b) => a.dt - b.dt);
    saveTransactions(merged);
    return {
      added: onlyNew.length,
      duplicates: Math.max(0, incoming.length - onlyNew.length),
      merged
    };
  };
  const parseCsvRows = (text) => {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "\"") {
        const next = text[i + 1];
        if (inQuotes && next === "\"") {
          cur += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "\n" && !inQuotes) {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }
      if (ch === "\r") continue;
      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  };
  const parseCsv = (text) => {
    const rows = parseCsvRows(text);
    if (!rows.length) {
      return { txs: [], read: 0, errors: 0 };
    }
    const header = rows.shift().map(h => h.trim());
    const txs = [];
    let errors = 0;
    rows.forEach((row) => {
      if (!row.length || row.every(cell => !String(cell || "").trim())) return;
      const obj = {};
      header.forEach((key, idx) => {
        obj[key] = row[idx] != null ? String(row[idx]).trim() : "";
      });
      const date = obj.timestamp_date;
      const time = obj.timestamp_time || "";
      const dt = Date.parse(`${date}T${time || "12:00"}:00`);
      const qty = toNum(obj.qty);
      const unitPrice = toNum(obj.unit_price);
      const totalAmountRaw = toNum(obj.total_amount);
      const totalAmount = Number.isFinite(totalAmountRaw)
        ? totalAmountRaw
        : (Number.isFinite(qty) && Number.isFinite(unitPrice) ? roundTo(qty * unitPrice, 2) : NaN);
      if (!date || !Number.isFinite(dt) || !Number.isFinite(qty) || !Number.isFinite(unitPrice) || !Number.isFinite(totalAmount)) {
        errors += 1;
        return;
      }
      const tx = {
        id: makeId(),
        dt,
        date,
        time: time || "",
        platform: obj.platform || "",
        asset: obj.asset || "",
        assetType: obj.asset_type || "other",
        side: String(obj.side || "").toUpperCase() === "SELL" ? "SELL" : "BUY",
        qty,
        qtyUnit: obj.qty_unit || "",
        unitPrice,
        currency: obj.currency || "TRY",
        totalAmount,
        source: "csv",
        hash: ""
      };
      tx.hash = buildHash(tx);
      txs.push(tx);
    });
    return { txs, read: rows.length, errors };
  };
  const SEED_CSV = `timestamp_date,timestamp_time,platform,asset,asset_type,side,qty,qty_unit,unit_price,currency,total_amount,fee_amount,fee_currency,notes,source_image_index,row_confidence
2025-10-20,,KuveytTurk,ASELS,stock,BUY,100,adet,203.300,TRY,20330.000,,,,"screen_visible_row",1,0.98
2025-10-21,,KuveytTurk,ALTIN,commodity,BUY,50,adet,76.390,TRY,3819.500,,,,"screen_visible_row",1,0.98
2025-10-22,,KuveytTurk,ALTIN,commodity,BUY,1,adet,70.580,TRY,70.580,,,,"screen_visible_row",1,0.98
2025-10-22,,KuveytTurk,ASELS,stock,SELL,100,adet,211.300,TRY,21130.000,,,,"screen_visible_row",1,0.98
2025-10-22,,KuveytTurk,ASELS,stock,BUY,100,adet,211.400,TRY,21140.000,,,,"screen_visible_row",1,0.98
2025-10-23,,KuveytTurk,ALTIN,commodity,BUY,2,adet,67.920,TRY,135.840,,,,"screen_visible_row",1,0.98
2025-11-04,16:54,KuveytTurk,ALT(gr),commodity,BUY,3.00,gr,5419.64073,TRY,16258.92,,,,"screen_visible_row",2,0.95
2025-11-05,,KuveytTurk,ASELS,stock,BUY,4,adet,199.400,TRY,797.600,,,,"screen_visible_row",2,0.98
2025-11-05,,KuveytTurk,ALTIN,commodity,BUY,1,adet,68.370,TRY,68.370,,,,"screen_visible_row",2,0.98
2025-11-10,18:00,KuveytTurk,ALT(gr),commodity,SELL,0.13,gr,5474.47740,TRY,711.68,,,,"screen_visible_row",3,0.92
2025-11-12,,KuveytTurk,ASELS,stock,SELL,4,adet,184.400,TRY,737.600,,,,"screen_visible_row",2,0.98
2025-11-12,,KuveytTurk,ALTIN,commodity,SELL,54,adet,73.110,TRY,3947.940,,,,"screen_visible_row",2,0.98
2025-11-17,,KuveytTurk,ALTIN,commodity,BUY,27,adet,73.280,TRY,1978.560,,,,"screen_visible_row",2,0.98
2025-11-17,,KuveytTurk,ASELS,stock,BUY,13,adet,185.400,TRY,2410.200,,,,"screen_visible_row",2,0.98
2025-11-19,,KuveytTurk,ALTIN,commodity,BUY,28,adet,73.840,TRY,2067.520,,,,"screen_visible_row",4,0.98
2025-11-24,,KuveytTurk,ASELS,stock,BUY,1,adet,183.100,TRY,183.100,,,,"screen_visible_row",4,0.98
2025-11-25,,KuveytTurk,ASELS,stock,BUY,1,adet,180.200,TRY,180.200,,,,"screen_visible_row",4,0.98
2025-11-27,,KuveytTurk,ASELS,stock,BUY,1,adet,184.700,TRY,184.700,,,,"screen_visible_row",4,0.98
2025-12-05,,KuveytTurk,ALTIN,commodity,BUY,2,adet,77.490,TRY,154.980,,,,"screen_visible_row",4,0.98
2025-12-09,,KuveytTurk,ASELS,stock,BUY,11,adet,200.200,TRY,2202.200,,,,"screen_visible_row",5,0.98
2025-12-09,,KuveytTurk,ASELS,stock,SELL,15,adet,200.500,TRY,3007.500,,,,"screen_visible_row",5,0.98
2025-12-11,,KuveytTurk,ALTIN,commodity,SELL,57,adet,78.730,TRY,4487.610,,,,"screen_visible_row",5,0.98
2025-12-15,,KuveytTurk,ASELS,stock,SELL,45,adet,211.700,TRY,9526.500,,,,"screen_visible_row",5,0.98
2025-12-16,09:02,KuveytTurk,GMS,commodity,BUY,1.00,gr,86.82130,TRY,86.82,,,,"screen_visible_row",6,0.96
2025-12-17,09:01,KuveytTurk,GMS,commodity,BUY,1.00,gr,91.70649,TRY,91.71,,,,"screen_visible_row",6,0.96
2025-12-18,09:02,KuveytTurk,GMS,commodity,BUY,1.00,gr,91.83064,TRY,91.83,,,,"screen_visible_row",6,0.96
2025-12-19,09:02,KuveytTurk,GMS,commodity,BUY,1.00,gr,91.16453,TRY,91.16,,,,"screen_visible_row",6,0.96
2025-12-19,14:08,KuveytTurk,GMS,commodity,BUY,200.00,gr,91.30910,TRY,18261.82,,,,"screen_visible_row",6,0.98
2025-12-22,11:11,KuveytTurk,GMS,commodity,BUY,1.00,gr,95.61309,TRY,95.61,,,,"screen_visible_row",6,0.96
2025-12-23,14:05,KuveytTurk,GMS,commodity,BUY,1.00,gr,96.67410,TRY,96.67,,,,"screen_visible_row",7,0.96
2025-12-24,10:58,KuveytTurk,GMS,commodity,BUY,1.00,gr,100.13353,TRY,100.13,,,,"screen_visible_row",7,0.96
2025-12-25,10:06,KuveytTurk,GMS,commodity,BUY,1.00,gr,100.02677,TRY,100.03,,,,"screen_visible_row",7,0.96
2025-12-26,10:26,KuveytTurk,GMS,commodity,BUY,1.00,gr,103.65914,TRY,103.66,,,,"screen_visible_row",7,0.96
2025-12-29,10:15,KuveytTurk,ALT(gr),commodity,SELL,38.00,gr,6102.74051,TRY,231904.14,,,,"screen_visible_row",7,0.98
2025-12-29,13:23,KuveytTurk,GMS,commodity,BUY,1.00,gr,105.04414,TRY,105.04,,,,"screen_visible_row",7,0.96
2025-12-30,14:07,KuveytTurk,GMS,commodity,BUY,1.00,gr,103.91004,TRY,103.91,,,,"screen_visible_row",8,0.96
2025-12-31,10:26,KuveytTurk,GMS,commodity,BUY,5.00,gr,100.50400,TRY,502.52,,,,"screen_visible_row",8,0.96
2026-01-07,16:03,KuveytTurk,GMS,commodity,SELL,6.00,gr,107.93632,TRY,647.62,,,,"screen_visible_row",8,0.96
2026-01-09,14:34,KuveytTurk,GMS,commodity,SELL,28.00,gr,106.83400,TRY,2991.35,,,,"screen_visible_row",8,0.96
2026-01-16,16:27,KuveytTurk,GMS,commodity,SELL,12.00,gr,121.73791,TRY,1460.85,,,,"screen_visible_row",8,0.96
2026-01-19,10:08,KuveytTurk,GMS,commodity,SELL,20.00,gr,128.86040,TRY,2577.21,,,,"screen_visible_row",8,0.96`;


  // ====== CALC ======
  function computeFromLedger(silverPx, asPx, ucPxOpt) {
    const txs = loadTransactions();
    const calcAsset = (asset, price) => {
      const isAsset = (t) => String(t.asset || "").toUpperCase() === asset;
      const buys = txs.filter(t => isAsset(t) && t.side === "BUY");
      const sells = txs.filter(t => isAsset(t) && t.side === "SELL");
      const sumQtyBuy = buys.reduce((acc, t) => acc + t.qty, 0);
      const sumCostBuy = buys.reduce((acc, t) => acc + t.totalAmount, 0);
      const sumQtySell = sells.reduce((acc, t) => acc + t.qty, 0);
      let avgCost = sumQtyBuy > 0 ? (sumCostBuy / sumQtyBuy) : NaN;
      if (Number.isFinite(COST_OVERRIDES[asset])) {
        avgCost = COST_OVERRIDES[asset];
      }
      const remain = sumQtyBuy - sumQtySell;
      const realized = Number.isFinite(avgCost)
        ? sells.reduce((acc, t) => acc + t.qty * (t.unitPrice - avgCost), 0)
        : NaN;
      const costRemain = Number.isFinite(avgCost) ? (remain * avgCost) : NaN;
      const valueRemain = Number.isFinite(price) ? (remain * price) : NaN;
      const unreal = (Number.isFinite(price) && Number.isFinite(avgCost)) ? (remain * (price - avgCost)) : NaN;
      const net = (Number.isFinite(unreal) && Number.isFinite(realized)) ? (unreal + realized) : NaN;
      const netPct = Number.isFinite(costRemain) && costRemain !== 0 ? (net / costRemain * 100) : NaN;
      return {
        sumQtyBuy,
        sumCostBuy,
        sumQtySell,
        avgCost,
        remain,
        realized,
        unreal,
        net,
        netPct,
        costRemain,
        valueRemain
      };
    };

    const silver = calcAsset("GMS", silverPx);
    const aselsan = calcAsset("ASELS", asPx);
    const ucHas = Number.isFinite(ucPxOpt);
    const ucaym = calcAsset("UCAYM", ucHas ? ucPxOpt : NaN);

    const totalProfit = (Number.isFinite(silver.net) ? silver.net : 0)
      + (Number.isFinite(aselsan.net) ? aselsan.net : 0)
      + (ucHas && Number.isFinite(ucaym.net) ? ucaym.net : 0);
    const totalValue = (Number.isFinite(silver.valueRemain) ? silver.valueRemain : 0)
      + (Number.isFinite(aselsan.valueRemain) ? aselsan.valueRemain : 0)
      + (ucHas && Number.isFinite(ucaym.valueRemain) ? ucaym.valueRemain : 0);

    return {
      inputs: { silverPx, asPx, ucPxOpt, ucHas },
      silver: {
        soldG: silver.sumQtySell,
        remainG: silver.remain,
        realized: silver.realized,
        unreal: silver.unreal,
        net: silver.net,
        netPct: silver.netPct,
        avgCost: silver.avgCost,
        costRemain: silver.costRemain,
        valueRemain: silver.valueRemain,
        soldTheo: NaN,
        missed: NaN,
        totalTheo: NaN
      },
      aselsan: {
        qty: aselsan.sumQtyBuy,
        remainQty: aselsan.remain,
        cost: aselsan.avgCost,
        costRemain: aselsan.costRemain,
        value: aselsan.valueRemain,
        profit: aselsan.net,
        pct: aselsan.netPct
      },
      ucaym: {
        qty: ucaym.sumQtyBuy,
        remainQty: ucaym.remain,
        cost: ucaym.avgCost,
        costRemain: ucaym.costRemain,
        value: ucaym.valueRemain,
        profit: ucaym.net,
        has: ucHas
      },
      totals: { totalProfit, totalValue }
    };
  }

  // ====== RENDER ======
  const setText = (id, txt) => {
    const el = $(id);
    if (el) el.textContent = txt;
  };
  const setHtml = (id, html) => {
    const el = $(id);
    if (el) el.innerHTML = html;
  };

  function setTop(calc){
    setText("nowPill", nowTR());
    setText("stampPill", state.cur.stamp ? state.cur.stamp : "—");
    setText("prevTag", state.prev.stamp ? state.prev.stamp : "—");
    setText(
      "quickBadge",
      (Number.isFinite(calc.inputs.silverPx) && Number.isFinite(calc.inputs.asPx))
        ? `Gümüş ${TL4.format(calc.inputs.silverPx)} ₺/g • ASELSAN ${TL.format(calc.inputs.asPx)} ₺`
        : "—"
    );

    const tp = calc.totals.totalProfit;
    const totalEl = $("totalProfit");
    if (totalEl) {
      totalEl.textContent = fmtSignedTL(tp);
      totalEl.classList.remove("pos","neg","muted");
      totalEl.classList.add(clsNum(tp));
      if (Number.isFinite(tp) && lastTopProfit !== null && tp !== lastTopProfit) {
        totalEl.classList.remove("isPulse");
        void totalEl.offsetWidth;
        totalEl.classList.add("isPulse");
      }
    }
    if (Number.isFinite(tp)) lastTopProfit = tp;

    const prevTot = state.prev.totalProfit;
    if (Number.isFinite(prevTot)) {
      const diff = tp - prevTot;
      setHtml(
        "totDiffLine",
        `önceki: <span class="mono">${fmtSignedTL(prevTot)}</span> → <span class="mono ${clsNum(diff)}">${fmtSignedTL(diff)}</span>`
      );
    } else {
      setText("totDiffLine", "önceki: —");
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
  add(tbSilver, "Gümüş ağırlıklı maliyet", Number.isFinite(calc.silver.avgCost) ? `${TL4.format(calc.silver.avgCost)} ₺/g` : "—");
  add(tbSilver, "Gümüş anlık fiyat", `${TL4.format(calc.inputs.silverPx)} ₺/g`);
  add(tbSilver, "Gümüş güncel değer", fmtTL(calc.silver.valueRemain));
  add(tbSilver, "Gümüş net kâr", fmtSignedTL(calc.silver.net), clsNum(calc.silver.net));
  add(tbSilver, "Gümüş net kâr %", fmtPct(calc.silver.netPct), clsNum(calc.silver.netPct));

  // ===== ASELSAN =====
  add(tbAselsan, "ASELSAN miktar", `${calc.aselsan.remainQty} adet`);
  add(tbAselsan, "ASELSAN ağırlıklı maliyet", Number.isFinite(calc.aselsan.cost) ? `${TL.format(calc.aselsan.cost)} ₺` : "—");
  add(tbAselsan, "ASELSAN anlık fiyat", `${TL.format(calc.inputs.asPx)} ₺`);
  add(tbAselsan, "ASELSAN güncel değer", fmtTL(calc.aselsan.value));
  add(tbAselsan, "ASELSAN net kâr", fmtSignedTL(calc.aselsan.profit), clsNum(calc.aselsan.profit));
  add(tbAselsan, "ASELSAN net kâr %", fmtPct(calc.aselsan.pct), clsNum(calc.aselsan.pct));

  // ===== UCAYM =====
  add(tbUcaym, "UCAYM miktar", `${calc.ucaym.remainQty} lot`);
  add(tbUcaym, "UCAYM ağırlıklı maliyet", calc.ucaym.has && Number.isFinite(calc.ucaym.cost) ? `${TL.format(calc.ucaym.cost)} ₺` : "—");
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
  if (document.getElementById("outSummary")) {
    replaceBody("outSummary", tbSummary);
  }
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

  function updateFilterCounts(items, mode, filters){
    if (!filters) return;
    const todayKey = dayKey(Date.now());
    const counts = {
      all: items.length,
      today: mode === "tx"
        ? items.filter(t => dayKey(t.dt) === todayKey).length
        : items.filter(h => dayKey(h.t) === todayKey).length,
      silver: mode === "tx"
        ? items.filter(t => String(t.asset || "").toUpperCase() === "GMS").length
        : items.filter(h => Number.isFinite(h.calc?.inputs?.silverPx)).length,
      stocks: mode === "tx"
        ? items.filter(t => {
          const asset = String(t.asset || "").toUpperCase();
          return asset === "ASELS" || asset === "UCAYM";
        }).length
        : items.filter(h => Number.isFinite(h.calc?.inputs?.asPx) || Number.isFinite(h.calc?.inputs?.ucPxOpt)).length
    };
    filters.querySelectorAll(".chipBtn").forEach((btn) => {
      const key = btn.dataset.filter || "all";
      const countEl = btn.querySelector(".chipCount");
      if (countEl && Object.prototype.hasOwnProperty.call(counts, key)){
        countEl.textContent = String(counts[key]);
      }
    });
  }

  function groupHistoryByDay(entries){
    const groups = [];
    let current = null;
    entries.forEach((item) => {
      const key = dayKey(item.t);
      if (!current || current.dayKey !== key){
        current = {
          dayKey: key,
          dateLabel: dayLabel(item.t),
          items: [],
          min: NaN,
          max: NaN,
          count: 0
        };
        groups.push(current);
      }
      current.items.push(item);
      current.count += 1;
      if (Number.isFinite(item.totalProfit)){
        current.min = Number.isFinite(current.min) ? Math.min(current.min, item.totalProfit) : item.totalProfit;
        current.max = Number.isFinite(current.max) ? Math.max(current.max, item.totalProfit) : item.totalProfit;
      }
    });
    return groups;
  }

  function groupTxByDay(entries){
    const groups = [];
    let current = null;
    entries.forEach((item) => {
      const key = dayKey(item.dt);
      if (!current || current.dayKey !== key){
        current = {
          dayKey: key,
          dateLabel: dayLabel(item.dt),
          items: [],
          count: 0
        };
        groups.push(current);
      }
      current.items.push(item);
      current.count += 1;
    });
    return groups;
  }

  function showUndoToast(){
    const toast = $("historyToast");
    if (!toast || !deleteStack.length) return;
    toast.innerHTML = `
      <div class="toastText">Kayıt silindi</div>
      <button class="toastAction" type="button">Geri al</button>
    `;
    toast.classList.add("isVisible");
    const action = toast.querySelector(".toastAction");
    if (action){
      action.addEventListener("click", () => {
        const item = deleteStack.pop();
        if (!item) return;
        const history = loadHistory();
        history.push(item.entry);
        history.sort((a,b)=>b.t-a.t);
        saveHistory(history);
        renderCharts(lastCalc);
        renderHistoryList();
        toast.classList.remove("isVisible");
      }, { once: true });
    }
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("isVisible");
    }, 5000);
  }

  function applySummarySelection(calc){
    const entry = getSelectedHistoryEntry();
    if (entry && entry.calc) {
      renderOutputTable(entry.calc, entry.stamp || formatStamp(entry.t));
      renderContribution(entry.calc, entry);
      renderSummaryFooter(entry.calc, entry);
      return;
    }
    renderOutputTable(calc);
    renderContribution(calc);
    renderSummaryFooter(calc);
  }

  /* ---------- Premium Canvas Charts (v2) ---------- */
  const ChartsV2 = (() => {
    const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

    const fmtCompactTL = (n) => Number.isFinite(n) ? `${TL.format(n)} ₺` : "—";

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
        const rawMin = min;
        const rawMax = max;
        const range = (max - min) || 1;
        let includeZero = false;

        // includeZeroMode: true | false | "auto"
        const mode = this.opts.includeZeroMode;
        if (mode === true){
          min = Math.min(min, 0);
          max = Math.max(max, 0);
          includeZero = true;
        } else if (mode === "auto") {
          const nearZero = (Math.abs(rawMin) < range*0.25 && Math.abs(rawMax) < range*0.25) || (rawMin < 500 && rawMax < 500);
          if ((rawMin < 0 && rawMax > 0) || nearZero){
            min = Math.min(min, 0);
            max = Math.max(max, 0);
            includeZero = true;
          }
        }

        const pad = range * 0.12;
        return { min: min - pad, max: max + pad, rawMin, rawMax, includeZero };
      }

      _showTip(clientX, clientY, i){
        if (!this.tip) return;
        const p = this.series[i];
        if (!p) return;

        const title = this.opts.title || "—";
        const valFmt = this.opts.valueFmt || ((v)=>fmtCompactTL(v));
        const val = valFmt(p.y);
        const time = fmtTimeTR(p.t);
        const meta = p.meta;
        const extra = (meta && meta.kind === "dayAvg")
          ? `<div class="t3">Bu gün: ${meta.n} kayıt • Ortalama</div>
             <div class="t3">min ${valFmt(meta.min)} • max ${valFmt(meta.max)}</div>
             <div class="t3">açılış ${valFmt(meta.open)} • kapanış ${valFmt(meta.close)}</div>`
          : `<div class="t3">${i+1}/${this.series.length}</div>`;

        this.tip.innerHTML = `
          <div class="t1">${title} • ${time}</div>
          <div class="t2">${val}</div>
          ${extra}
        `;

        this.tip.classList.add("isOn");
        const rect = this.canvas.getBoundingClientRect();
        const offsetX = 12;
        const offsetY = 10;
        const rawX = clientX - rect.left + offsetX;
        const rawY = clientY - rect.top + offsetY;
        const tipRect = this.tip.getBoundingClientRect();
        const maxX = rect.width - tipRect.width - 6;
        const maxY = rect.height - tipRect.height - 6;
        const clampedX = Math.max(6, Math.min(rawX, maxX));
        const clampedY = Math.max(6, Math.min(rawY, maxY));
        this.tip.style.left = `${clampedX}px`;
        this.tip.style.top  = `${clampedY}px`;
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

        const valFmt = this.opts.valueFmt || ((v)=>fmtCompactTL(v));
        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
        const yTop = maxY;
        const yMid = (maxY + minY)/2;
        const yBot = minY;
        ctx.fillText(valFmt(yTop), 8, yScale(yTop)+4);
        ctx.fillText(valFmt(yMid), 8, yScale(yMid)+4);
        ctx.fillText(valFmt(yBot), 8, yScale(yBot)+4);

        if (dom.includeZero){
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
        const baseY = yScale(this.series[0].y);
        ctx.setLineDash([5,6]);
        ctx.strokeStyle = "rgba(255,255,255,.14)";
        ctx.beginPath();
        ctx.moveTo(padL, baseY);
        ctx.lineTo(w-padR, baseY);
        ctx.stroke();
        ctx.setLineDash([]);

        const lastV = this.series[this.series.length-1].y;
        const lineCol = this.opts.dynamicColor
          ? (lastV >= 0 ? "rgba(65,209,125,.95)" : "rgba(255,92,122,.95)")
          : "rgba(106,169,255,.95)";
        const grad = ctx.createLinearGradient(0,padT,0,h-padB);
        if (this.opts.dynamicColor){
          if (lastV >= 0){
            grad.addColorStop(0, "rgba(65,209,125,.20)");
            grad.addColorStop(1, "rgba(65,209,125,.03)");
          } else {
            grad.addColorStop(0, "rgba(255,92,122,.20)");
            grad.addColorStop(1, "rgba(255,92,122,.03)");
          }
        } else {
          grad.addColorStop(0, "rgba(106,169,255,.22)");
          grad.addColorStop(1, "rgba(106,169,255,.02)");
        }

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

        if (pts.length >= 2){
          ctx.save();
          ctx.beginPath();
          if (pts.length === 2){
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
        }

        ctx.strokeStyle = lineCol;
        ctx.lineWidth = 2.25;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        this.series.forEach((p, i) => {
          if (p.meta && p.meta.kind === "dayAvg"){
            const x = pts[i].x;
            const yMin = yScale(p.meta.min);
            const yMax = yScale(p.meta.max);
            ctx.strokeStyle = "rgba(255,255,255,.20)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, yMin);
            ctx.lineTo(x, yMax);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x-4, yMin);
            ctx.lineTo(x+4, yMin);
            ctx.moveTo(x-4, yMax);
            ctx.lineTo(x+4, yMax);
            ctx.stroke();
          }
        });

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

        drawDot(lastI, pts.length === 1 ? 6 : 4, lineCol);
        if (minI !== lastI) drawDot(minI, 3, "rgba(255,255,255,.65)");
        if (maxI !== lastI) drawDot(maxI, 3, "rgba(255,255,255,.65)");

        if (pts.length === 1){
          const txt = valFmt(ys[0]);
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.font = "18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
          const tw = ctx.measureText(txt).width;
          ctx.fillText(txt, (w - tw)/2, h/2 - 6);
          ctx.fillStyle = "rgba(255,255,255,.45)";
          ctx.font = "11px ui-sans-serif, system-ui";
          const help = "Trend için en az 2 kayıt";
          const hw = ctx.measureText(help).width;
          ctx.fillText(help, (w - hw)/2, h/2 + 16);
        }

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

        chip(`son: ${valFmt(ys[lastI])}`, pts[lastI].x, pts[lastI].y, "right");
        if (pts.length >= 3){
          chip(`min: ${valFmt(ys[minI])}`, pts[minI].x, pts[minI].y, "left");
          chip(`max: ${valFmt(ys[maxI])}`, pts[maxI].x, pts[maxI].y, "left");
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
      const rect = this.canvas.getBoundingClientRect();
      const rawX = cx - rect.left + 12;
      const rawY = cy - rect.top + 10;
      const tipRect = this.tip.getBoundingClientRect();
      const maxX = rect.width - tipRect.width - 6;
      const maxY = rect.height - tipRect.height - 6;
      const clampedX = Math.max(6, Math.min(rawX, maxX));
      const clampedY = Math.max(6, Math.min(rawY, maxY));
      this.tip.style.left=`${clampedX}px`;
      this.tip.style.top=`${clampedY}px`;
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
  let _chartProfitV2, _chartValueV2;
  const getRawHistoryPair = (history, field) => {
    const raw = history.map(h => h[field]).filter(Number.isFinite);
    if (!raw.length) return { last: NaN, prev: NaN };
    const last = raw[raw.length-1];
    const prev = raw.length >= 2 ? raw[raw.length-2] : NaN;
    return { last, prev };
  };

  function renderCardsContribution(container, items, prevItems){
    if (!container) return;
    if (!items.length){
      container.innerHTML = "<div class=\"muted\">Veri yok</div>";
      return;
    }
    const sumAbs = items.reduce((acc, it) => acc + Math.abs(it.value), 0) || 1;
    const prevMap = (prevItems || []).reduce((acc, it) => {
      acc[it.label] = it.value;
      return acc;
    }, {});
    container.innerHTML = items.map((it) => {
      const pct = (Math.abs(it.value) / sumAbs) * 100;
      const color = it.value >= 0 ? "var(--good)" : "var(--bad)";
      const prevVal = Number.isFinite(prevMap[it.label]) ? prevMap[it.label] : NaN;
      const diff = Number.isFinite(prevVal) ? (it.value - prevVal) : NaN;
      const diffText = Number.isFinite(diff) ? fmtSignedTL(diff) : "—";
      const isPassive = Math.abs(it.value) < 1e-9;
      return `
        <div class="contribCard${isPassive ? " isPassive" : ""}">
          ${isPassive ? "<div class=\"contribBadge\">Pasif varlık</div>" : ""}
          <div class="lbl">${it.label}</div>
          <div class="val" style="color:${color}">${fmtSignedTL(it.value)}</div>
          <div class="mini">%${TL.format(pct)} pay</div>
          <div class="contribBarWrap">
            ${isPassive
              ? "<div class=\"contribBar--dashed\"></div>"
              : `<div class="contribBar"><span style="width:${pct}%; background:${color};"></span></div>`
            }
            <div class="contribBarTip">%${TL.format(pct)} pay</div>
          </div>
          <div class="contribMeta">
            <div>Toplam kârın %${TL.format(pct)}’u</div>
            <div>Son güncellemeden beri ${diffText}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function getPrevHistoryEntry(entry){
    const history = loadHistory().slice().sort((a,b)=>b.t-a.t);
    if (!history.length) return null;
    if (!entry || !Number.isFinite(entry.t)) return history[0] || null;
    const idx = history.findIndex(h => h.t === entry.t);
    if (idx === -1) return history[0] || null;
    return history[idx + 1] || null;
  }

  function renderContribution(calc, entry){
    if (!calc) return;
    const uc = Number.isFinite(calc.ucaym.profit) ? calc.ucaym.profit : 0;
    const contribItems = [
      { label: "Gümüş", value: calc.silver.net },
      { label: "ASEL",  value: calc.aselsan.profit },
      { label: "UCAYM", value: uc }
    ];
    const prev = getPrevHistoryEntry(entry);
    const prevItems = prev?.calc ? [
      { label: "Gümüş", value: prev.calc.silver.net },
      { label: "ASEL",  value: prev.calc.aselsan.profit },
      { label: "UCAYM", value: Number.isFinite(prev.calc.ucaym.profit) ? prev.calc.ucaym.profit : 0 }
    ] : [];
    renderCardsContribution($("chartCards"), contribItems, prevItems);
  }

  function renderSummaryFooter(calc, entry){
    const footer = $("summaryFooterText");
    const band = $("summaryBand");
    if (!footer || !calc) return;
    const silver = Number.isFinite(calc.silver.net) ? calc.silver.net : 0;
    const asel = Number.isFinite(calc.aselsan.profit) ? calc.aselsan.profit : 0;
    const uc = Number.isFinite(calc.ucaym.profit) ? calc.ucaym.profit : 0;
    const sumAbs = Math.abs(silver) + Math.abs(asel) + Math.abs(uc);
    const prev = getPrevHistoryEntry(entry);
    const prevTot = prev?.calc?.totals ? prev.calc.totals.totalProfit : NaN;
    const diff = Number.isFinite(prevTot) ? (calc.totals.totalProfit - prevTot) : NaN;
    const trendIcon = Number.isFinite(diff) ? (diff > 0 ? "↑" : (diff < 0 ? "↓" : "→")) : "→";
    const trendLine = Number.isFinite(diff)
      ? `Kısa trend: ${trendIcon} ${fmtSignedTL(diff)}`
      : "Kısa trend: —";
    if (sumAbs === 0){
      footer.innerHTML = `<div>${trendLine}</div><div>Portföy kârı şu an nötr, dağılım yorumu için veri yok.</div>`;
      if (band) band.textContent = "Bant: —";
      return;
    }
    const silverAsShare = ((Math.abs(silver) + Math.abs(asel)) / sumAbs) * 100;
    const maxShare = Math.max(Math.abs(silver), Math.abs(asel), Math.abs(uc)) / sumAbs * 100;
    const balanceNote = (maxShare >= 70)
      ? "tek varlıkta yoğunlaşıyor"
      : "dengeli";
    const line2 = `Portföy kârının %${TL.format(silverAsShare)}’u gümüş ve ASELSAN’dan geliyor; dağılım ${balanceNote}.`;
    footer.innerHTML = `<div>${trendLine}</div><div>${line2}</div>`;

    const history = loadHistory();
    const targetDay = entry && Number.isFinite(entry.t) ? dayKey(entry.t) : dayKey(Date.now());
    const dayItems = history.filter(h => dayKey(h.t) === targetDay && Number.isFinite(h.totalProfit));
    const minVal = dayItems.length ? Math.min(...dayItems.map(h => h.totalProfit)) : NaN;
    const maxVal = dayItems.length ? Math.max(...dayItems.map(h => h.totalProfit)) : NaN;
    if (band) {
      band.textContent = Number.isFinite(minVal) && Number.isFinite(maxVal)
        ? `Bant: ${fmtSignedTL(minVal)} - ${fmtSignedTL(maxVal)}`
        : "Bant: —";
    }
  }

  function renderHistoryList(){
    const list = $("historyList");
    if (!list) return;
    const meta = $("historyMeta");
    const summary = $("historySummary");
    const history = loadHistory().slice().sort((a,b)=>b.t-a.t);
    const todayKey = dayKey(Date.now());
    const applyFilter = (h) => {
      if (historyFilter === "today") return dayKey(h.t) === todayKey;
      if (historyFilter === "silver") return Number.isFinite(h.calc?.inputs?.silverPx);
      if (historyFilter === "stocks") {
        return Number.isFinite(h.calc?.inputs?.asPx) || Number.isFinite(h.calc?.inputs?.ucPxOpt);
      }
      return true;
    };
    updateFilterCounts(history, "snapshot", $("historyFilters"));
    const filtered = history.filter(applyFilter);
    const today = history.filter(h => dayKey(h.t) === todayKey);
    if (selectedHistoryT && !filtered.some(h => h.t === selectedHistoryT)){
      selectedHistoryT = null;
    }

    if (meta){
      const lastT = filtered[0]?.t;
      const lastTime = Number.isFinite(lastT) ? `${pad2(new Date(lastT).getHours())}:${pad2(new Date(lastT).getMinutes())}` : "—";
      if (selectedHistoryT){
        const selected = filtered.find(h => h.t === selectedHistoryT);
        const netText = Number.isFinite(selected?.totalProfit) ? fmtSignedTL(selected.totalProfit) : "—";
        meta.textContent = selected
          ? `Seçili: ${selected.stamp || formatStamp(selected.t)} • Net ${netText}`
          : `Bugün: ${today.length} kayıt • Son güncelleme: ${lastTime}`;
      } else {
        meta.textContent = `Bugün: ${today.length} kayıt • Son güncelleme: ${lastTime}`;
      }
    }

    if (!filtered.length){
      list.innerHTML = `
        <div class="historyEmpty">
          <div>Henüz kayıt yok</div>
          <div class="mini">Fiyat girip Hesapla/Kaydet ile kayıt ekle.</div>
        </div>
      `;
      if (summary) summary.style.display = "none";
      return;
    }

    const diffMap = new Map();
    filtered.forEach((item, idx) => {
      const prev = filtered[idx + 1];
      const net = Number.isFinite(item.totalProfit) ? item.totalProfit : NaN;
      const prevNet = Number.isFinite(prev?.totalProfit) ? prev.totalProfit : NaN;
      const diff = Number.isFinite(net) && Number.isFinite(prevNet) ? (net - prevNet) : NaN;
      diffMap.set(item.t, diff);
    });
    const groups = groupHistoryByDay(filtered);
    list.innerHTML = groups.map((group) => {
      const minMax = Number.isFinite(group.min) && Number.isFinite(group.max)
        ? `${fmtSignedTL(group.min)} - ${fmtSignedTL(group.max)}`
        : "—";
      const items = group.items.map((h) => {
        const net = Number.isFinite(h.totalProfit) ? h.totalProfit : NaN;
        const netStr = Number.isFinite(net) ? fmtSignedTL(net) : "Net —";
        const d = new Date(h.t);
        const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        const silver = Number.isFinite(h.calc?.inputs?.silverPx) ? `Gümüş ${TL4.format(h.calc.inputs.silverPx)} ₺/g` : null;
        const asel = Number.isFinite(h.calc?.inputs?.asPx) ? `ASELS ${TL.format(h.calc.inputs.asPx)} ₺` : null;
        const ucaym = Number.isFinite(h.calc?.inputs?.ucPxOpt) ? `UCAYM ${TL.format(h.calc.inputs.ucPxOpt)} ₺` : null;
        const sub = [silver, asel, ucaym].filter(Boolean).join(" • ");
        const diff = diffMap.get(h.t);
        const deltaText = Number.isFinite(diff) ? `Δ ${fmtSignedTL(diff)}` : "Δ —";
        const deltaClass = Number.isFinite(diff) ? clsNum(diff) : "muted";
        const dotColor = Number.isFinite(net) ? (net >= 0 ? "var(--good)" : "var(--bad)") : "var(--muted)";
        const cardClass = Number.isFinite(net) ? (net >= 0 ? "pos" : "neg") : "muted";
        const isSelected = selectedHistoryT === h.t ? "isSelected" : "";
        return `
          <div class="historyItem ${isSelected}" data-id="${h.t}" data-t="${h.t}" tabindex="0">
            <div class="historyDot" style="background:${dotColor}"></div>
            <div class="historyCard">
              <div class="historyTop">
                <div class="historyNet ${cardClass}">Net ${netStr}</div>
              <div class="historyTopRight">
                <div class="historyTime">${time}</div>
                <button class="historyDeleteIcon" type="button" aria-label="Kaydı sil">✕</button>
              </div>
            </div>
            <div class="historySub">${sub || "—"}</div>
            <div class="historyDelta ${deltaClass}">${deltaText}</div>
            <div class="historyConfirmRow" style="display:none">
              <span>Silinsin mi?</span>
              <button class="historyConfirmYes" type="button">Evet</button>
              <button class="historyConfirmNo" type="button">Vazgeç</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
      return `
        <div class="historyDayHeader">
          <div>${group.dateLabel}</div>
          <div class="mini">${group.count} kayıt • ${minMax}</div>
        </div>
        ${items}
      `;
    }).join("");


    if (summary){
      let summaryItems = filtered;
      if (historyFilter === "today"){
        summaryItems = history.filter(h => dayKey(h.t) === todayKey);
      }
      if (selectedHistoryT){
        const selected = history.find(h => h.t === selectedHistoryT);
        if (selected){
          const selectedDay = dayKey(selected.t);
          summaryItems = filtered.filter(h => dayKey(h.t) === selectedDay);
        }
      }
      const summaryNets = summaryItems.map(h => h.totalProfit).filter(Number.isFinite);
      if (!summaryNets.length){
        summary.style.display = "none";
      } else {
        const min = Math.min(...summaryNets);
        const max = Math.max(...summaryNets);
        const diff = max - min;
        const first = summaryItems[summaryItems.length - 1];
        const last = summaryItems[0];
        const trend = (Number.isFinite(first?.totalProfit) && Number.isFinite(last?.totalProfit))
          ? last.totalProfit - first.totalProfit
          : NaN;
        summary.style.display = "grid";
        summary.innerHTML = `
          <div><div class="lbl">Min Net</div><div class="val">${fmtSignedTL(min)}</div></div>
          <div><div class="lbl">Max Net</div><div class="val">${fmtSignedTL(max)}</div></div>
          <div><div class="lbl">Gün içi fark</div><div class="val">${fmtSignedTL(diff)}</div></div>
          <div><div class="lbl">Kayıt sayısı</div><div class="val">${summaryItems.length}</div></div>
          ${Number.isFinite(trend) ? `<div><div class="lbl">Son - İlk</div><div class="val">${fmtSignedTL(trend)}</div></div>` : ""}
        `;
      }
    }
  }

  function renderTxList(){
    const list = $("txList");
    if (!list) return;
    const meta = $("txMeta");
    const txs = loadTransactions().slice().sort((a, b) => b.dt - a.dt);
    const todayKey = dayKey(Date.now());
    const applyFilter = (t) => {
      const asset = String(t.asset || "").toUpperCase();
      if (txFilter === "today") return dayKey(t.dt) === todayKey;
      if (txFilter === "silver") return asset === "GMS";
      if (txFilter === "stocks") return asset === "ASELS" || asset === "UCAYM";
      return true;
    };
    updateFilterCounts(txs, "tx", $("txFilters"));
    const filtered = txs.filter(applyFilter);

    if (meta){
      const lastT = filtered[0]?.dt;
      const lastTime = Number.isFinite(lastT) ? `${pad2(new Date(lastT).getHours())}:${pad2(new Date(lastT).getMinutes())}` : "—";
      meta.textContent = `İşlemler: ${filtered.length} kayıt • Son işlem: ${lastTime}`;
    }

    if (!filtered.length){
      list.innerHTML = `
        <div class="historyEmpty">
          <div>Henüz işlem yok</div>
          <div class="mini">CSV import et veya manuel işlem ekle.</div>
        </div>
      `;
      return;
    }

    const groups = groupTxByDay(filtered);
    list.innerHTML = groups.map((group) => {
      const items = group.items.map((t) => {
        const d = new Date(t.dt);
        const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        const sideClass = t.side === "BUY" ? "pos" : "neg";
        const dotColor = t.side === "BUY" ? "var(--good)" : "var(--bad)";
        const unitPriceStr = t.qtyUnit === "gr"
          ? `${TL4.format(t.unitPrice)} ₺/g`
          : `${TL.format(t.unitPrice)} ₺`;
        const qtyStr = `${fmtQty(t.qty)} ${t.qtyUnit}`;
        const totalStr = fmtTL(t.totalAmount);
        return `
          <div class="historyItem">
            <div class="historyDot" style="background:${dotColor}"></div>
            <div class="historyCard">
              <div class="historyTop">
                <div class="historyNet ${sideClass}">${t.asset} ${t.side}</div>
                <div class="historyTopRight">
                  <div class="historyTime">${time}</div>
                </div>
              </div>
              <div class="historySub">${qtyStr} • ${unitPriceStr}</div>
              <div class="historyDelta">${totalStr}</div>
            </div>
          </div>
        `;
      }).join("");
      return `
        <div class="historyDayHeader">
          <div>${group.dateLabel}</div>
          <div class="mini">${group.count} kayıt</div>
        </div>
        ${items}
      `;
    }).join("");
  }


  function renderCharts(calc){
    const history = loadHistory();

    const profitSeries = buildSeries(history, "totalProfit", "abs");
    const valueSeries = buildSeries(history, "totalValue", "abs");
    const rawProfitCount = history.filter(h => Number.isFinite(h.totalProfit)).length;
    const rawValueCount = history.filter(h => Number.isFinite(h.totalValue)).length;

    if (!_chartProfitV2){
      _chartProfitV2 = new ChartsV2.LineChart($("chartProfit"), $("tipProfit"), {
        title: "Toplam Net Kâr",
        includeZeroMode: "auto",
        dynamicColor: true,
        valueFmt: (v)=>fmtSignedTL(v)
      });
      _chartValueV2 = new ChartsV2.LineChart($("chartValue"), $("tipValue"), {
        title: "Toplam Değer",
        includeZeroMode: "auto",
        dynamicColor: false,
        valueFmt: (v)=>fmtTL(v)
      });
    }

    _chartProfitV2.opts.valueFmt = (v)=>fmtSignedTL(v);
    _chartValueV2.opts.valueFmt = (v)=>fmtTL(v);

    $("chartCountProfit").textContent = `(gösterilen ${profitSeries.length} / ham ${rawProfitCount})`;
    $("chartCountValue").textContent  = `(gösterilen ${valueSeries.length} / ham ${rawValueCount})`;

    const setBadge = (el, field, fmtVal) => {
      if (!el) return;
      const { last, prev } = getRawHistoryPair(history, field);
      if (!Number.isFinite(last)){
        el.textContent = "—";
        return;
      }
      const diff = Number.isFinite(prev) ? (last - prev) : NaN;
      const pct = (Number.isFinite(prev) && prev !== 0) ? (diff / Math.abs(prev) * 100) : NaN;
      const pctStr = Number.isFinite(pct) ? `${pct>=0?"+":""}${TL.format(pct)}%` : "—";
      const diffStr = Number.isFinite(diff) ? `${diff>=0?"+":""}${TL.format(diff)}₺` : "—";
      el.textContent = `${fmtVal(last)} • ${diffStr} • ${pctStr}`;
    };

    setBadge($("chartBadgeProfit"), "totalProfit", (v)=>fmtSignedTL(v));
    setBadge($("chartBadgeValue"),  "totalValue",  (v)=>fmtTL(v));

    _chartProfitV2.setSeries(profitSeries);
    _chartValueV2.setSeries(valueSeries);

    renderContribution(calc);
  }

  function syncAll(calc){
    setTop(calc);
    lastCalc = calc;
    renderHistorySelectOptions();
    applySummarySelection(calc);
    renderCharts(calc);
    renderHistoryList();
    renderTxList();
  }

  // ====== ACTIONS ======
  function calcAndPersist(silent=false){

    // inputları da kaydet
    saveInputs();

    const silverPx = toNum($("inpSilver").value);
    const asPx = toNum($("inpAselsan").value);
    const ucPx = toNum($("inpUcaym").value);

    let hasError = false;
    if (!Number.isFinite(silverPx)) {
      setFieldError("inpSilver", "Gümüş kur zorunlu.");
      hasError = true;
    } else {
      clearFieldError("inpSilver");
    }
    if (!Number.isFinite(asPx)) {
      setFieldError("inpAselsan", "ASELSAN fiyat zorunlu.");
      hasError = true;
    } else {
      clearFieldError("inpAselsan");
    }
    if (hasError) return;

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

    const calc = computeFromLedger(silverPx, asPx, Number.isFinite(ucPx) ? ucPx : NaN);
    state.cur.totalProfit = calc.totals.totalProfit;
    pushHistory(calc);

    save(state);
    syncAll(calc);
  }

  function refreshFromLedger(){
    if (Number.isFinite(state.cur.silverPx) && Number.isFinite(state.cur.asPx)) {
      const calc = computeFromLedger(state.cur.silverPx, state.cur.asPx, Number.isFinite(state.cur.ucPx) ? state.cur.ucPx : NaN);
      state.cur.totalProfit = calc.totals.totalProfit;
      save(state);
      syncAll(calc);
      return;
    }
    renderHistoryList();
    renderTxList();
  }
  function ensureSeededTransactions(){
    const existing = loadTransactions();
    const seededVersion = localStorage.getItem(TX_SEED_VERSION_KEY);
    if (existing.length && seededVersion === TX_SEED_VERSION) return;
    const parsed = parseCsv(SEED_CSV);
    saveTransactions(parsed.txs);
    localStorage.setItem(TX_SEED_VERSION_KEY, TX_SEED_VERSION);
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
      setTradeError("İşlem için miktar + fiyat gir (pozitif sayı).");
      return;
    }
    const assetMap = {
      silver: { code: "GMS", type: "commodity", unit: "gr" },
      aselsan: { code: "ASELS", type: "stock", unit: "adet" },
      ucaym: { code: "UCAYM", type: "other", unit: "lot" }
    };
    const info = assetMap[asset] || assetMap.silver;
    const dt = Date.now();
    const tx = {
      id: makeId(),
      dt,
      date: formatDate(dt),
      time: formatTime(dt),
      platform: "manual",
      asset: info.code,
      assetType: info.type,
      side: type === "sell" ? "SELL" : "BUY",
      qty: q,
      qtyUnit: info.unit,
      unitPrice: px,
      currency: "TRY",
      totalAmount: roundTo(q * px, 2),
      source: "manual",
      hash: ""
    };
    tx.hash = buildHash(tx);
    const merged = mergeTransactions([tx]);

    clearTradeError();
    $("tradeQty").value = "";
    $("tradePx").value = "";

    if (merged.added === 0) {
      setTradeHelp("0 eklendi, 1 duplicate atlandı.");
    } else {
      setTradeHelp("1 eklendi (duplicate ise eklenmedi).");
    }

    if (Number.isFinite(state.cur.silverPx) && Number.isFinite(state.cur.asPx)) {
      const calc = computeFromLedger(state.cur.silverPx, state.cur.asPx, Number.isFinite(state.cur.ucPx) ? state.cur.ucPx : NaN);
      state.cur.totalProfit = calc.totals.totalProfit;
      save(state);
      syncAll(calc);
    } else {
      setTradeHelp("İşlem eklendi. Güncel fiyatları girip hesapla.");
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
    clearFieldError("inpSilver");
    clearFieldError("inpAselsan");
    clearTradeError();
    $("tradeQty").value = "";
    $("tradePx").value = "";
    setText("totalProfit", "—");
    setText("totDiffLine", "önceki: —");
    setText("prevTag", "—");
    setText("stampPill", "—");
    setText("quickBadge", "—");
    setText("nowPill", nowTR());
    const totalEl = $("totalProfit");
    if (totalEl) totalEl.classList.remove("pos","neg","muted");
    ["outSilver","outAselsan","outUcaym","outSummary"].forEach((id) => {
      const tb = $(id);
      if (tb) tb.innerHTML = `<tr><td colspan="2" class="muted">—</td></tr>`;
    });
  }

  // ====== INIT ======
  $("btnCalc").addEventListener("click", calcAndPersist);
  $("btnAddTrade").addEventListener("click", addTrade);
  $("btnReset").addEventListener("click", resetAll);
  ensureSeededTransactions();
  const tradeClear = $("btnTradeClear");
  if (tradeClear) {
    tradeClear.addEventListener("click", () => {
      $("tradeQty").value = "";
      $("tradePx").value = "";
      clearTradeError();
    });
  }
  bindPillGroup("assetGroup");
  bindPillGroup("typeGroup");
  const historySelect = $("summaryHistorySelect");
  if (historySelect) {
    historySelect.addEventListener("change", () => {
      localStorage.setItem(HISTORY_SELECT_KEY, historySelect.value);
      if (lastCalc) applySummarySelection(lastCalc);
    });
  }
  const historyFilters = $("historyFilters");
  if (historyFilters) {
    historyFilters.addEventListener("click", (e) => {
      const btn = e.target.closest(".chipBtn");
      if (!btn || !historyFilters.contains(btn)) return;
      historyFilters.querySelectorAll(".chipBtn").forEach((b) => b.classList.remove("isActive"));
      btn.classList.add("isActive");
      historyFilter = btn.dataset.filter || "all";
      renderHistoryList();
    });
  }
  const txFilters = $("txFilters");
  if (txFilters) {
    txFilters.addEventListener("click", (e) => {
      const btn = e.target.closest(".chipBtn");
      if (!btn || !txFilters.contains(btn)) return;
      txFilters.querySelectorAll(".chipBtn").forEach((b) => b.classList.remove("isActive"));
      btn.classList.add("isActive");
      txFilter = btn.dataset.filter || "all";
      renderTxList();
    });
  }

  function bindHistoryListEventsOnce() {
    if (historyEventsBound) return;
    historyEventsBound = true;

    const list = $("historyList");
    if (!list) return;

    list.addEventListener("pointerdown", (e) => {
      const delBtn = e.target.closest(".historyDeleteIcon");
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const item = delBtn.closest(".historyItem");
        if (!item) return;
        const row = item.querySelector(".historyConfirmRow");
        if (!row) return;
        const willOpen = row.style.display !== "flex";
        list.querySelectorAll(".historyConfirmRow").forEach((r) => { r.style.display = "none"; });
        if (willOpen) row.style.display = "flex";
        return;
      }

      if (e.target.closest(".historyConfirmYes") || e.target.closest(".historyConfirmNo")) {
        e.stopPropagation();
      }
    }, true);

    list.addEventListener("click", (e) => {
      const noBtn = e.target.closest(".historyConfirmNo");
      if (noBtn) {
        e.preventDefault();
        e.stopPropagation();
        const row = noBtn.closest(".historyConfirmRow");
        if (row) row.style.display = "none";
        return;
      }

      const yesBtn = e.target.closest(".historyConfirmYes");
      if (yesBtn) {
        e.preventDefault();
        e.stopPropagation();
        const row = yesBtn.closest(".historyConfirmRow");
        if (row) row.style.display = "none";

        const itemEl = yesBtn.closest(".historyItem");
        if (!itemEl) return;

        const t = Number(itemEl.dataset.t);
        if (!Number.isFinite(t)) return;

        const historyList = loadHistory();
        const idx = historyList.findIndex(h => h.t === t);
        if (idx === -1) return;

        const removed = historyList.splice(idx, 1)[0];
        saveHistory(historyList);

        deleteStack.push({ entry: removed });
        if (deleteStack.length > 3) deleteStack.shift();

        if (lastCalc) renderCharts(lastCalc);
        renderHistoryList();
        showUndoToast();
        return;
      }

      if (e.target.closest(".historyDeleteIcon") || e.target.closest(".historyConfirmRow")) {
        e.stopPropagation();
        return;
      }

      const item = e.target.closest(".historyItem");
      if (item) {
        if (e.target.closest(".historyConfirmRow")) return;
        const openRow = item.querySelector(".historyConfirmRow");
        if (openRow && openRow.style.display === "flex") return;

        const t = Number(item.dataset.t);
        selectedHistoryT = Number.isFinite(t) ? t : null;
        renderHistoryList();
      }
    });

    list.addEventListener("keydown", (e) => {
      const item = e.target.closest(".historyItem");
      if (!item) return;
      if (e.key !== "Enter" && e.key !== " ") return;

      e.preventDefault();
      const t = Number(item.dataset.t);
      selectedHistoryT = Number.isFinite(t) ? t : null;
      renderHistoryList();
    });

  }

  bindHistoryListEventsOnce();



  const stickyBar = $("stickyBar");
  const slider = $("slider");
  const setStickyHeight = () => {
    if (stickyBar) {
      document.documentElement.style.setProperty("--sticky-h", `${stickyBar.offsetHeight}px`);
    }
  };
  const updateStickyShadow = () => {
    if (!stickyBar) return;
    stickyBar.classList.toggle("isScrolled", window.scrollY > 10);
  };
  window.addEventListener("resize", setStickyHeight);
  window.addEventListener("scroll", updateStickyShadow);
  setStickyHeight();
  updateStickyShadow();

  if (slider) {
    const panels = Array.from(slider.querySelectorAll(".panel"));
    let sliderWidth = slider.clientWidth;
    const currentIndex = () => Math.round(slider.scrollLeft / sliderWidth);
    const dotsWrap = $("sliderDots");
    const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll(".dot")) : [];
    let lastActiveIdx = -1;
    let scrollSettleId = 0;
    let isAutoScrolling = false;
    let scrollPauseId = 0;
    const settleToIndex = () => {
      const idx = currentIndex();
      const target = idx * slider.clientWidth;
      if (Math.abs(slider.scrollLeft - target) > 1) {
        slider.scrollTo({ left: target, behavior: "auto" });
      }
      setActiveDot(idx);
      if (scrollPauseId) window.clearTimeout(scrollPauseId);
      document.body.classList.remove("isScrolling");
      if (isAutoScrolling) {
        isAutoScrolling = false;
        slider.classList.remove("isAutoScrolling");
      }
    };
    const setActiveDot = (idx) => {
      if (idx === lastActiveIdx) return;
      lastActiveIdx = idx;
      dots.forEach((dot, i) => {
        const active = i === idx;
        dot.classList.toggle("isActive", active);
        dot.setAttribute("aria-selected", active ? "true" : "false");
      });
    };
    const goTo = (idx) => {
      const clamped = Math.max(0, Math.min(idx, panels.length - 1));
      isAutoScrolling = true;
      slider.classList.add("isAutoScrolling");
      setPerfEvent("dot-nav");
      slider.scrollTo({ left: clamped * sliderWidth, behavior: "smooth" });
      setActiveDot(clamped);
    };
    const prev = $("sliderPrev");
    const next = $("sliderNext");
    if (prev) prev.addEventListener("click", () => goTo(currentIndex() - 1));
    if (next) next.addEventListener("click", () => goTo(currentIndex() + 1));
    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const idx = Number(dot.dataset.index);
        if (Number.isFinite(idx)) goTo(idx);
      });
    });
    setActiveDot(currentIndex());

    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const idx = currentIndex();
        if (idx !== lastActiveIdx) setActiveDot(idx);
      });
      setPerfEvent("scroll");
      document.body.classList.add("isScrolling");
      if (scrollPauseId) window.clearTimeout(scrollPauseId);
      scrollPauseId = window.setTimeout(() => {
        document.body.classList.remove("isScrolling");
      }, 140);
      if ("onscrollend" in window) return;
      if (scrollSettleId) window.clearTimeout(scrollSettleId);
      scrollSettleId = window.setTimeout(settleToIndex, 120);
    };
    slider.addEventListener("scroll", onScroll, { passive: true });
    if ("onscrollend" in window) {
      slider.addEventListener("scrollend", () => {
        setPerfEvent("scrollend");
        settleToIndex();
      }, { passive: true });
    }
    window.addEventListener("resize", () => {
      sliderWidth = slider.clientWidth || sliderWidth;
      settleToIndex();
    });

    slider.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(currentIndex() - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(currentIndex() + 1);
      }
    });

    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let dragRaf = 0;
    let dragDx = 0;
    slider.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".modeBtn")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      isDown = true;
      slider.classList.add("isDragging");
      setPerfEvent("drag-start");
      startX = e.clientX;
      startScroll = slider.scrollLeft;
      slider.setPointerCapture(e.pointerId);
    });
    slider.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      dragDx = e.clientX - startX;
      if (dragRaf) return;
      dragRaf = requestAnimationFrame(() => {
        slider.scrollLeft = startScroll - dragDx;
        dragRaf = 0;
      });
    });
    slider.addEventListener("pointerup", () => {
      isDown = false;
      slider.classList.remove("isDragging");
      setPerfEvent("drag-end");
    });
    slider.addEventListener("pointercancel", () => {
      isDown = false;
      slider.classList.remove("isDragging");
      setPerfEvent("drag-cancel");
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
  const formatInput = (id, fmt) => {
    const el = $(id);
    if (!el) return;
    const n = toNum(el.value);
    if (Number.isFinite(n)) {
      el.value = fmt.format(n);
    }
  };
  // input değişince kaydet
  ["inpSilver","inpAselsan","inpUcaym"].forEach(id => {
    $(id).addEventListener("input", saveInputs);
  });
  ["inpSilver","inpAselsan"].forEach(id => {
    $(id).addEventListener("input", () => clearFieldError(id));
  });
  ["tradeQty","tradePx"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("input", clearTradeError);
  });
  ["inpSilver","inpAselsan","inpUcaym"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("btnCalc").click();
      }
    });
  });
  ["tradeQty","tradePx"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("btnAddTrade").click();
      }
    });
  });
  $("inpSilver").addEventListener("blur", () => formatInput("inpSilver", TL4));
  $("inpAselsan").addEventListener("blur", () => formatInput("inpAselsan", TL));
  $("inpUcaym").addEventListener("blur", () => formatInput("inpUcaym", TL));
  // ilk açılışta yükle
  loadInputs();

  setText("nowPill", nowTR());
  const perfPill = $("perfPill");
  if (perfPill) {
    try {
      const savedPerf = JSON.parse(localStorage.getItem(PERF_LOG_KEY) || "[]");
      if (Array.isArray(savedPerf)) perfLog.push(...savedPerf.slice(-PERF_LOG_MAX));
    } catch {}
    if ("PerformanceObserver" in window) {
      try {
        const obs = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > perfMaxLong) perfMaxLong = entry.duration;
          });
        });
        obs.observe({ type: "longtask", buffered: true });
      } catch {}
    }
    const exportPerfLog = () => {
      const payload = {
        startedAt: new Date().toISOString(),
        entries: perfLog.slice()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `perf-log-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
    perfPill.title = "Tıklayın: Perf log indir";
    perfPill.addEventListener("click", exportPerfLog);
    const tick = (t) => {
      perfFrames += 1;
      const dt = t - perfLast;
      if (dt > 50) perfDropped += 1;
      perfLast = t;
      if (t - perfLastStamp >= 1000) {
        const fps = Math.round((perfFrames * 1000) / (t - perfLastStamp));
        const maxLong = perfMaxLong ? `${Math.round(perfMaxLong)}ms` : "—";
        perfPill.textContent = `Perf: ${fps}fps • jank ${perfDropped} • long ${maxLong}`;
        const isBad = fps < 24 || perfDropped > 5 || perfMaxLong > 120;
        perfPill.classList.toggle("isPerfBad", isBad);
        perfPill.classList.toggle("isPerfGood", !isBad);
        perfLog.push({
          ts: new Date().toISOString(),
          fps,
          jank: perfDropped,
          longTaskMax: Math.round(perfMaxLong || 0),
          event: perfLastEvent,
          isScrolling: document.body.classList.contains("isScrolling"),
          isDragging: slider ? slider.classList.contains("isDragging") : false,
          isAutoScrolling: slider ? slider.classList.contains("isAutoScrolling") : false
        });
        if (perfLog.length > PERF_LOG_MAX) perfLog.shift();
        try { localStorage.setItem(PERF_LOG_KEY, JSON.stringify(perfLog)); } catch {}
        perfFrames = 0;
        perfDropped = 0;
        perfLastStamp = t;
        perfMaxLong = 0;
        perfLastEvent = "idle";
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  setText("stampPill", state.cur.stamp ? state.cur.stamp : "—");
  setText("prevTag", state.prev.stamp ? state.prev.stamp : "—");
  renderHistorySelectOptions();

  // initial render if have prices
  if (Number.isFinite(state.cur.silverPx) && Number.isFinite(state.cur.asPx)) {
    const calc = computeFromLedger(state.cur.silverPx, state.cur.asPx, Number.isFinite(state.cur.ucPx) ? state.cur.ucPx : NaN);
    state.cur.totalProfit = calc.totals.totalProfit;
    save(state);
    syncAll(calc);
  } else {
    // placeholders
    setText("quickBadge", "—");
    setText("totDiffLine", "önceki: —");
    const entry = getSelectedHistoryEntry();
    if (entry && entry.calc) {
      renderOutputTable(entry.calc, entry.stamp || formatStamp(entry.t));
    }
    renderHistoryList();
    renderTxList();
  }
});
