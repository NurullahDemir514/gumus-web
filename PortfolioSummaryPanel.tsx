import React, { useMemo, useState } from "react";

type Snapshot = {
  gmsSatRaw: string;
  aselsanRaw: string;
  ucaymRaw: string;
  totalNetTl: number | null;
  timestamp: number;
};

type SubmittedState = {
  submittedAt: number;
  inputs: {
    gms: ParsedInput;
    aselsan: ParsedInput;
    ucaym: ParsedInput;
  };
  output: PortfolioOutput;
};

type ParsedInput = {
  raw: string;
  value: number | null;
  decimals: number;
};

type AssetConfig = {
  code: "GUMUS" | "ASELSAN" | "UCAYM";
  label: "Gümüş" | "ASELSAN" | "UCAYM";
  unit: string;
  totalBought: number;
  avgCost: number;
  soldQty: number;
  soldTotalTl: number;
};

type AssetComputed = AssetConfig & {
  currentPrice: number | null;
  hasPrice: boolean;
  remainingQty: number;
  remainingCost: number;
  currentValue: number | null;
  unrealized: number | null;
  realized: number;
};

type SatmasaydimRow = {
  code: AssetConfig["code"];
  realized: number | null;
  soldTodayTheo: number | null;
  missedExtra: number | null;
  totalTheo: number | null;
};

type PortfolioOutput = {
  assetData: AssetComputed[];
  portfolioCurrentProfit: number;
  portfolioRealizedProfit: number;
  portfolioTotalNetProfit: number;
  satmasaydim: SatmasaydimRow[];
};

const STORAGE_KEY = "portfolio_summary_prev_v1";

const MONTHS_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const ASSETS: AssetConfig[] = [
  {
    code: "GUMUS",
    label: "Gümüş",
    unit: "g",
    totalBought: 216,
    avgCost: 91.8105,
    soldQty: 116,
    soldTotalTl: 647.62 + 2991.35 + 1460.85 + 2577.21 + 6550.5,
  },
  {
    code: "ASELSAN",
    label: "ASELSAN",
    unit: "adet",
    totalBought: 67,
    avgCost: 206.73,
    soldQty: 0,
    soldTotalTl: 0,
  },
  {
    code: "UCAYM",
    label: "UCAYM",
    unit: "lot",
    totalBought: 56,
    avgCost: 18,
    soldQty: 0,
    soldTotalTl: 0,
  },
];

const parseInput = (raw: string): ParsedInput => {
  const trimmed = raw.trim();
  if (!trimmed) return { raw, value: null, decimals: 0 };
  const normalized = trimmed.replace(/\s+/g, "");
  const decimalMatch = normalized.match(/[.,](\d+)$/);
  const decimals = decimalMatch ? decimalMatch[1].length : 0;
  const numeric = normalized.includes(",") && normalized.includes(".")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized.replace(",", ".");
  const value = Number(numeric);
  return {
    raw: trimmed,
    value: Number.isFinite(value) ? value : null,
    decimals,
  };
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatTimestampTR = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
};

const formatNumberTR = (value: number, decimals: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

const formatTL = (value: number) => `${formatNumberTR(value, 2)} TL`;

const formatSignedTL = (value: number) => {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatTL(Math.abs(value))}`;
};

const formatPrice = (value: number, decimals: number) =>
  formatNumberTR(value, decimals);

const formatInputPrice = (input: ParsedInput, type: "silver" | "stock") => {
  if (input.value == null) return "—";
  if (type === "silver") {
    const decimals = Math.max(4, input.decimals);
    return formatPrice(input.value, decimals);
  }
  return formatPrice(input.value, 2);
};

const formatPrevDiff = (
  current: ParsedInput,
  prev: ParsedInput | null,
  type: "silver" | "stock",
  allowMissing: boolean
) => {
  if (allowMissing && current.value == null) {
    return { current: "—", prev: prev?.value != null ? formatInputPrice(prev, type) : "—", diff: "—" };
  }
  if (current.value == null) {
    return { current: "—", prev: "—", diff: "—" };
  }
  const currentFmt = formatInputPrice(current, type);
  const prevFmt = prev?.value != null ? formatInputPrice(prev, type) : "—";
  const diff =
    prev?.value != null ? formatSignedTL(current.value - prev.value) : "—";
  return { current: currentFmt, prev: prevFmt, diff };
};

const readSnapshot = (): Snapshot | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Snapshot;
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
};

const writeSnapshot = (snap: Snapshot) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
};

const computePortfolio = (
  inputs: SubmittedState["inputs"]
): PortfolioOutput | null => {
  const gms = inputs.gms;
  const aselsan = inputs.aselsan;
  const ucaym = inputs.ucaym;

  if (gms.value == null || aselsan.value == null) return null;

  const assetData: AssetComputed[] = ASSETS.map((asset) => {
    const currentPrice =
      asset.code === "GUMUS"
        ? gms.value
        : asset.code === "ASELSAN"
        ? aselsan.value
        : ucaym.value;
    const hasPrice = asset.code === "UCAYM" ? currentPrice != null : true;
    const remainingQty = asset.totalBought - asset.soldQty;
    const remainingCost = remainingQty * asset.avgCost;
    const currentValue = hasPrice ? remainingQty * (currentPrice as number) : null;
    const unrealized =
      hasPrice && currentPrice != null
        ? remainingQty * (currentPrice - asset.avgCost)
        : null;
    const realized =
      asset.soldQty > 0 ? asset.soldTotalTl - asset.soldQty * asset.avgCost : 0;
    return {
      ...asset,
      currentPrice,
      hasPrice,
      remainingQty,
      remainingCost,
      currentValue,
      unrealized,
      realized,
    };
  });

  const portfolioCurrentProfit = assetData.reduce((acc, a) => {
    if (a.unrealized == null) return acc;
    return acc + a.unrealized;
  }, 0);
  const portfolioRealizedProfit = assetData.reduce(
    (acc, a) => acc + a.realized,
    0
  );
  const portfolioTotalNetProfit =
    portfolioCurrentProfit + portfolioRealizedProfit;

  const satmasaydim: SatmasaydimRow[] = assetData.map((asset) => {
    if (!asset.hasPrice || asset.currentPrice == null) {
      return {
        code: asset.code,
        realized: null,
        soldTodayTheo: null,
        missedExtra: null,
        totalTheo: null,
      };
    }
    const soldTodayTheo =
      asset.soldQty * (asset.currentPrice - asset.avgCost);
    const totalTheo =
      asset.totalBought * (asset.currentPrice - asset.avgCost);
    return {
      code: asset.code,
      realized: asset.realized,
      soldTodayTheo,
      missedExtra: soldTodayTheo - asset.realized,
      totalTheo,
    };
  });

  return {
    assetData,
    portfolioCurrentProfit,
    portfolioRealizedProfit,
    portfolioTotalNetProfit,
    satmasaydim,
  };
};

export const PortfolioSummaryPanel: React.FC = () => {
  const [gmsSatRaw, setGmsSatRaw] = useState("");
  const [aselsanRaw, setAselsanRaw] = useState("");
  const [ucaymRaw, setUcaymRaw] = useState("");
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(() =>
    typeof window === "undefined" ? null : readSnapshot()
  );
  const [displayPrevSnapshot, setDisplayPrevSnapshot] =
    useState<Snapshot | null>(prevSnapshot);
  const [submittedState, setSubmittedState] = useState<SubmittedState | null>(
    null
  );

  const parsedInputs = useMemo(() => {
    return {
      gms: parseInput(gmsSatRaw),
      aselsan: parseInput(aselsanRaw),
      ucaym: parseInput(ucaymRaw),
    };
  }, [gmsSatRaw, aselsanRaw, ucaymRaw]);

  const prevParsed = useMemo(() => {
    if (!displayPrevSnapshot) return null;
    return {
      gms: parseInput(displayPrevSnapshot.gmsSatRaw || ""),
      aselsan: parseInput(displayPrevSnapshot.aselsanRaw || ""),
      ucaym: parseInput(displayPrevSnapshot.ucaymRaw || ""),
    };
  }, [displayPrevSnapshot]);

  const output = submittedState?.output ?? null;
  const submittedInputs = submittedState?.inputs ?? parsedInputs;

  const onSubmit = () => {
    const gms = parsedInputs.gms;
    const aselsan = parsedInputs.aselsan;
    if (gms.value == null || aselsan.value == null) return;

    const nextInputs = {
      gms,
      aselsan,
      ucaym: parsedInputs.ucaym,
    };
    const nextOutput = computePortfolio(nextInputs);
    if (!nextOutput) return;

    const submittedAt = Date.now();
    const nextSnapshot: Snapshot = {
      gmsSatRaw,
      aselsanRaw,
      ucaymRaw,
      totalNetTl: nextOutput.portfolioTotalNetProfit,
      timestamp: submittedAt,
    };
    setDisplayPrevSnapshot(prevSnapshot);
    writeSnapshot(nextSnapshot);
    setPrevSnapshot(nextSnapshot);
    setSubmittedState({
      submittedAt,
      inputs: nextInputs,
      output: nextOutput,
    });
  };

  const girdiHeader = submittedState
    ? formatTimestampTR(submittedState.submittedAt)
    : "—";

  const gmsRow = formatPrevDiff(
    submittedInputs.gms,
    prevParsed?.gms ?? null,
    "silver",
    false
  );
  const aselsanRow = formatPrevDiff(
    submittedInputs.aselsan,
    prevParsed?.aselsan ?? null,
    "stock",
    false
  );
  const ucaymRow = formatPrevDiff(
    submittedInputs.ucaym,
    prevParsed?.ucaym ?? null,
    "stock",
    true
  );

  const prevTotal = displayPrevSnapshot?.totalNetTl ?? null;
  const currentTotal = output?.portfolioTotalNetProfit ?? null;
  const totalLine =
    currentTotal == null
      ? "—"
      : `${formatTL(currentTotal)} (önceki: ${
          prevTotal != null ? formatTL(prevTotal) : "—"
        } → ${
          prevTotal != null ? formatSignedTL(currentTotal - prevTotal) : "—"
        })`;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 12, padding: 16, border: "1px solid #d0d5dd", borderRadius: 12 }}>
        <div style={{ fontWeight: 600 }}>Portföy Özeti</div>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Gümüş kur (SAT)</span>
            <input
              value={gmsSatRaw}
              onChange={(e) => setGmsSatRaw(e.target.value)}
              placeholder="örn: 134,7100"
              inputMode="decimal"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>ASELSAN fiyat</span>
            <input
              value={aselsanRaw}
              onChange={(e) => setAselsanRaw(e.target.value)}
              placeholder="örn: 303,00"
              inputMode="decimal"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>UCAYM fiyat (opsiyonel)</span>
            <input
              value={ucaymRaw}
              onChange={(e) => setUcaymRaw(e.target.value)}
              placeholder="örn: 21,78"
              inputMode="decimal"
            />
            <small>UCAYM opsiyonel (işlem görmüyorsa boş bırak)</small>
          </label>
        </div>
        <button onClick={onSubmit} style={{ padding: "10px 16px", borderRadius: 8 }}>
          Hesapla
        </button>
      </div>

      {output && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ fontWeight: 700 }}>📌 GÜNCEL PORTFÖY ÖZETİ (Senin verdiğin fiyatlarla)</div>

          <div style={{ padding: 16, border: "1px solid #d0d5dd", borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Girdi</div>
            <div>Tarih/Saat (TR): {girdiHeader}</div>
            <div>Gümüş kur (SAT): {gmsRow.current} | {gmsRow.prev} | {gmsRow.diff}</div>
            <div>ASELSAN: {aselsanRow.current} | {aselsanRow.prev} | {aselsanRow.diff}</div>
            <div>UCAYM: {ucaymRow.current} | {ucaymRow.prev} | {ucaymRow.diff}</div>
            <div>Toplam portföy anlık net kâr: {totalLine}</div>
          </div>

          <div style={{ padding: 16, border: "1px solid #d0d5dd", borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>1) Varlık Bazlı Durum (Kalan pozisyon kârı)</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Kalem</th>
                  {output.assetData.map((a) => (
                    <th key={a.code} style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}>Kalan miktar</td>
                  {output.assetData.map((a) => (
                    <td key={a.code} style={{ padding: 8 }}>
                      {formatNumberTR(a.remainingQty, 0)} {a.unit}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Ortalama maliyet</td>
                  {output.assetData.map((a) => (
                    <td key={a.code} style={{ padding: 8 }}>
                      {formatPrice(a.avgCost, a.code === "GUMUS" ? 4 : 2)} TL
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Anlık fiyat</td>
                  {output.assetData.map((a) => (
                    <td key={a.code} style={{ padding: 8 }}>
                      {a.code === "GUMUS"
                        ? formatInputPrice(submittedInputs.gms, "silver")
                        : a.code === "ASELSAN"
                        ? formatInputPrice(submittedInputs.aselsan, "stock")
                        : formatInputPrice(submittedInputs.ucaym, "stock")}
                      {a.code === "GUMUS" ? " TL/g" : " TL"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Güncel değer</td>
                  {output.assetData.map((a) => (
                    <td key={a.code} style={{ padding: 8 }}>
                      {a.currentValue == null ? "—" : formatTL(a.currentValue)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Kalan maliyet toplam</td>
                  {output.assetData.map((a) => (
                    <td key={a.code} style={{ padding: 8 }}>
                      {formatTL(a.remainingCost)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>✅ ŞU ANKİ KÂR (kalan pozisyon)</td>
                  {output.assetData.map((a) => (
                    <td key={a.code} style={{ padding: 8 }}>
                      {a.unrealized == null ? "—" : formatTL(a.unrealized)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ padding: 16, border: "1px solid #d0d5dd", borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>2) Satışlardan Elde Edilen Kâr (Realize)</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Kalem</th>
                  {output.assetData.map((a) => (
                    <th key={a.code} style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}>✅ REALİZE KÂR (satışlardan)</td>
                  {output.assetData.map((a) => (
                    <td key={a.code} style={{ padding: 8 }}>
                      {formatTL(a.realized)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ padding: 16, border: "1px solid #d0d5dd", borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>3) Toplamlar</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Kalem</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}>✅ PORTFÖY ŞU ANKİ KÂR (kalan pozisyon)</td>
                  <td style={{ padding: 8 }}>{formatTL(output.portfolioCurrentProfit)}</td>
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>✅ PORTFÖY REALİZE KÂR (satışlardan)</td>
                  <td style={{ padding: 8 }}>{formatTL(output.portfolioRealizedProfit)}</td>
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>✅ PORTFÖY ANLIK TOPLAM NET KÂR (ikisi birlikte)</td>
                  <td style={{ padding: 8 }}>{formatTL(output.portfolioTotalNetProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ padding: 16, border: "1px solid #d0d5dd", borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>4) “Satmasaydım” (TEORİK – realize değil)</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Kalem</th>
                  {output.assetData.map((a) => (
                    <th key={a.code} style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}>Gerçekleşen kâr (satışlardan – realize)</td>
                  {output.assetData.map((a) => {
                    const row = output.satmasaydim.find((s) => s.code === a.code);
                    return (
                      <td key={a.code} style={{ padding: 8 }}>
                        {row?.realized == null ? "—" : formatTL(row.realized)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Satmasaydım: satılan toplam miktarın bugünkü teorik kârı</td>
                  {output.assetData.map((a) => {
                    const row = output.satmasaydim.find((s) => s.code === a.code);
                    return (
                      <td key={a.code} style={{ padding: 8 }}>
                        {row?.soldTodayTheo == null ? "—" : formatTL(row.soldTodayTheo)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Kaçırdığım ek kâr (fırsat maliyeti – teorik)</td>
                  {output.assetData.map((a) => {
                    const row = output.satmasaydim.find((s) => s.code === a.code);
                    return (
                      <td key={a.code} style={{ padding: 8 }}>
                        {row?.missedExtra == null ? "—" : formatTL(row.missedExtra)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Satmasaydım: toplam alınan miktarın bugünkü teorik kârı</td>
                  {output.assetData.map((a) => {
                    const row = output.satmasaydim.find((s) => s.code === a.code);
                    return (
                      <td key={a.code} style={{ padding: 8 }}>
                        {row?.totalTheo == null ? "—" : formatTL(row.totalTheo)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
