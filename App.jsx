import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import {
  Play, Square, AlertTriangle, Wrench, Zap, Package, Clock,
  ChevronLeft, Check, RefreshCw, Users, Monitor, Settings, Plus, Trash2, X, Download
} from "lucide-react";

// =================================================================
// SUPABASE BAĞLANTISI
// Bu uygulama artık Claude'un dahili window.storage'ı yerine gerçek,
// bağımsız bir Supabase veritabanı kullanıyor. Bu sayede uygulama
// Vercel/Netlify gibi bir yere yayınlandığında da veriler kalıcı kalır.
// =================================================================
const SUPABASE_URL = "https://yowhlislsgqmqrmyxcee.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4yu886uMs-i0Qbp0vyO42Q_2WIDaLfQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// =================================================================
// ÜRETİM TAKİP SİSTEMİ — Usta Modu + Yönetici Modu (tek uygulama)
// Veri katmanı: Supabase (app_data tablosu) — herkes aynı kayıtları görür
// =================================================================

const COLORS = {
  bg: "#15171A", bgPanel: "#1D2024", bgRaised: "#262A2F", border: "#34383E",
  text: "#F2F0EA", textDim: "#9A9D9F", textFaint: "#6B6E70",
  accentRun: "#5FB87A", accentRunDim: "#1A2B20",
  accentStop: "#E8533D", accentStopDim: "#2E1F1C",
  accentWarn: "#E8A33D", accentWarnDim: "#2E2818",
  accentIdle: "#5C6066",
};

const DOWNTIME_REASONS = [
  { id: "ariza", label: "Makine Arızası", icon: Wrench, color: COLORS.accentStop },
  { id: "malzeme", label: "Malzeme Bekleme", icon: Package, color: COLORS.accentWarn },
  { id: "elektrik", label: "Elektrik / Enerji", icon: Zap, color: COLORS.accentStop },
  { id: "kalite", label: "Kalite Kontrol", icon: AlertTriangle, color: COLORS.accentWarn },
  { id: "mola", label: "Planlı Mola", icon: Clock, color: "#3DA5E8" },
  { id: "diger", label: "Diğer", icon: AlertTriangle, color: COLORS.textFaint },
];

// =================================================================
// ÇOK DİLLİ DESTEK (i18n) — tr / en / ar
// Veri (sipariş, makine adları) hep Türkçe girilir; yalnızca arayüz
// metinleri ve duruş nedenleri burada çevriliyor.
// =================================================================

const LANGUAGES = [
  { code: "tr", label: "Türkçe", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

const DOWNTIME_LABELS = {
  ariza: { tr: "Makine Arızası", en: "Machine Breakdown", ar: "عطل الماكينة" },
  malzeme: { tr: "Malzeme Bekleme", en: "Waiting for Material", ar: "انتظار المواد" },
  elektrik: { tr: "Elektrik / Enerji", en: "Power / Energy", ar: "كهرباء / طاقة" },
  kalite: { tr: "Kalite Kontrol", en: "Quality Check", ar: "فحص الجودة" },
  mola: { tr: "Planlı Mola", en: "Scheduled Break", ar: "استراحة مجدولة" },
  diger: { tr: "Diğer", en: "Other", ar: "أخرى" },
};

function downtimeLabel(id, lang) {
  return DOWNTIME_LABELS[id]?.[lang] || DOWNTIME_LABELS[id]?.tr || id;
}
// Reverse lookup: stored log entries keep the Turkish label as the canonical
// value, so we resolve back to an id to translate for display.
function downtimeIdFromTrLabel(trLabel) {
  const entry = Object.entries(DOWNTIME_LABELS).find(([, v]) => v.tr === trLabel);
  return entry ? entry[0] : null;
}

const STRINGS = {
  appTitle: { tr: "Üretim Takip Sistemi", en: "Production Tracking System", ar: "نظام تتبع الإنتاج" },
  chooseLanguage: { tr: "Dil seçin", en: "Choose language", ar: "اختر اللغة" },
  howLogin: { tr: "Nasıl giriş yapmak istersin?", en: "How would you like to sign in?", ar: "كيف تريد تسجيل الدخول؟" },
  operatorMode: { tr: "Usta Modu", en: "Operator Mode", ar: "وضع العامل" },
  operatorModeDesc: { tr: "Üretim başlat, duruş kaydet", en: "Start production, log downtime", ar: "بدء الإنتاج، تسجيل التوقف" },
  managerMode: { tr: "Yönetici Modu", en: "Manager Mode", ar: "وضع المدير" },
  managerModeDesc: { tr: "Canlı durum, raporlar, tanımlar", en: "Live status, reports, settings", ar: "الحالة المباشرة، التقارير، الإعدادات" },
  sharedNote: { tr: "Tüm kayıtlar paylaşılır — herkes aynı veriyi görür", en: "All records are shared — everyone sees the same data", ar: "جميع السجلات مشتركة — يراها الجميع" },
  fieldEntry: { tr: "Saha Vardiya Girişi", en: "Shift Floor Entry", ar: "تسجيل دخول الورشة" },
  whichMachine: { tr: "Hangi makinedesin?", en: "Which machine are you on?", ar: "في أي ماكينة أنت؟" },
  whichOrder: { tr: "Hangi sipariş üzerinde çalışıyorsun?", en: "Which order are you working on?", ar: "على أي طلب تعمل؟" },
  chooseMode: { tr: "Mod Seç", en: "Choose Mode", ar: "اختر الوضع" },
  inProduction: { tr: "Üretimde", en: "In Production", ar: "قيد الإنتاج" },
  inDowntime: { tr: "Duruşta", en: "In Downtime", ar: "متوقف" },
  idle: { tr: "Boşta", en: "Idle", ar: "خامل" },
  producedQty: { tr: "Üretilen adet", en: "Units produced", ar: "الوحدات المصنّعة" },
  stopProduction: { tr: "Üretimi Durdur", en: "Stop Production", ar: "إيقاف الإنتاج" },
  whatReason: { tr: "Duruş nedeni nedir?", en: "What is the downtime reason?", ar: "ما سبب التوقف؟" },
  confirmStopTitle: { tr: "Üretimi durdurmak istediğine eminmisin?", en: "Are you sure you want to stop production?", ar: "هل أنت متأكد من إيقاف الإنتاج؟" },
  confirmStopFor: { tr: "için", en: "for", ar: "لـ" },
  unitsWillBeSaved: { tr: "adet üretildi olarak kaydedilecek.", en: "units will be recorded as produced.", ar: "وحدة سيتم تسجيلها كمُصنّعة." },
  cancel: { tr: "Vazgeç", en: "Cancel", ar: "إلغاء" },
  stop: { tr: "Durdur", en: "Stop", ar: "إيقاف" },
  unitsSaved: { tr: "adet kaydedildi", en: "units saved", ar: "وحدة محفوظة" },
  downtimeSaved: { tr: "Duruş kaydedildi:", en: "Downtime saved:", ar: "تم تسجيل التوقف:" },
  loading: { tr: "Yükleniyor…", en: "Loading…", ar: "جارٍ التحميل…" },
  noAssignedOrder: { tr: "Atanmış iş yok", en: "No order assigned", ar: "لا يوجد عمل مخصص" },
  status: { tr: "Durum", en: "Status", ar: "الحالة" },
  settings: { tr: "Tanımlar", en: "Settings", ar: "الإعدادات" },
  exportExcel: { tr: "Excel'e Aktar", en: "Export to Excel", ar: "تصدير إلى إكسل" },
  machinesDown: { tr: "makine şu anda duruşta", en: "machine(s) currently down", ar: "ماكينة متوقفة الآن" },
  machines: { tr: "Makineler", en: "Machines", ar: "الماكينات" },
  ordersDueStatus: { tr: "Siparişler · Termin Durumu", en: "Orders · Due Date Status", ar: "الطلبات · حالة الموعد" },
  routingMissing: { tr: "Rota tanımı yok", en: "No routing defined", ar: "لا يوجد مسار محدد" },
  estFinish: { tr: "Tahmini bitiş", en: "Est. finish", ar: "الإنهاء المتوقع" },
  bottleneck: { tr: "darboğaz", en: "bottleneck", ar: "عنق الزجاجة" },
  due: { tr: "Termin", en: "Due", ar: "الموعد" },
  units: { tr: "adet", en: "units", ar: "وحدة" },
  downtimeReasonsTotal: { tr: "Duruş Nedenleri (toplam)", en: "Downtime Reasons (total)", ar: "أسباب التوقف (الإجمالي)" },
  noRecordsYet: { tr: "Henüz kayıt yok", en: "No records yet", ar: "لا توجد سجلات بعد" },
  recentActivity: { tr: "Son Hareketler", en: "Recent Activity", ar: "آخر الأنشطة" },
  uygun: { tr: "UYGUN", en: "ON TRACK", ar: "في الموعد" },
  sinirda: { tr: "SINIRDA", en: "AT RISK", ar: "في خطر" },
  gecikme: { tr: "GECİKME RİSKİ", en: "DELAY RISK", ar: "خطر التأخير" },
  workingFor: { tr: "çalışıyor", en: "running", ar: "يعمل منذ" },
  waitingFor: { tr: "duruyor", en: "stopped", ar: "متوقف منذ" },
  reasonPending: { tr: "neden seçimi bekleniyor", en: "reason selection pending", ar: "في انتظار اختيار السبب" },
  saved: { tr: "Kaydedildi", en: "Saved", ar: "تم الحفظ" },
  add: { tr: "Ekle", en: "Add", ar: "إضافة" },
  machineCol: { tr: "Son sütun: net günlük kapasite (saat)", en: "Last column: net daily capacity (hours)", ar: "العمود الأخير: السعة اليومية الصافية (ساعة)" },
  orderCols: { tr: "Kod · Ürün · Müşteri · Miktar · Termin", en: "Code · Product · Customer · Qty · Due Date", ar: "الرمز · المنتج · العميل · الكمية · الموعد" },
  newMachine: { tr: "Yeni Makine", en: "New Machine", ar: "ماكينة جديدة" },
  newProduct: { tr: "Yeni Ürün", en: "New Product", ar: "منتج جديد" },
  customer: { tr: "Müşteri", en: "Customer", ar: "العميل" },
  dueRiskBadge: { tr: "TERMİN RİSKİ", en: "DUE RISK", ar: "خطر الموعد" },
  routingMissingFull: { tr: "Bu ürün için rota/süre tanımı yok — termin hesaplanamıyor (Ürün Süreleri verisine ekleyin)", en: "No routing/timing defined for this product — due date can't be calculated (add it to product routing data)", ar: "لا يوجد مسار/توقيت محدد لهذا المنتج — لا يمكن حساب الموعد (أضفه إلى بيانات المسار)" },
  daysMargin: { tr: "Termine {n} gün payı var", en: "{n} days margin to due date", ar: "هامش {n} يوم حتى الموعد" },
  daysOverdue: { tr: "Termini {n} gün geçiyor", en: "{n} days past due date", ar: "تأخر {n} يوم عن الموعد" },
};

function t(key, lang, vars) {
  let str = STRINGS[key]?.[lang] || STRINGS[key]?.tr || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  }
  return str;
}

function useLanguage() {
  const [lang, setLangState] = useState("tr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ui-lang");
      if (saved && LANGUAGES.some((l) => l.code === saved)) setLangState(saved);
    } catch {}
    setReady(true);
  }, []);

  function setLang(code) {
    setLangState(code);
    try { localStorage.setItem("ui-lang", code); } catch {}
  }

  const dir = LANGUAGES.find((l) => l.code === lang)?.dir || "ltr";
  return { lang, setLang, dir, ready };
}

// =================================================================
// ERDOOR AHŞAP KOMPOZİT KAPI — gerçek üretim akışı
// Kaynak: ERDOOR Üretim Prosesi ve Teknik Bilgiler sunumu
// Üç paralel/ardışık bölüm: (1) Kompozit Profil Üretimi (Geri Dönüşüm
// + Mikser + Extruder), (2) Kereste & Kanat Üretimi, (3) Laminasyon
// & Sevkiyat. Kanat hattı kapıyı oluşturan ana hat olduğu için
// rotalar oradan başlıyor; profil/laminasyon ayrı kapasite havuzları
// olarak da makine listesinde yer alıyor.
// =================================================================

const DEFAULT_MACHINES = [
  // --- Kompozit Profil Üretim Bölümü ---
  { code: "MK-01", name: "Geri Dönüşüm (Kırma/Öğütme)", capacityHrPerDay: 16 },
  { code: "MK-02", name: "Mikser (Hammadde Karışım)", capacityHrPerDay: 16 },
  { code: "MK-03", name: "Extruder Hatları (9 hat toplam)", capacityHrPerDay: 144 }, // 9 hat x 16 saat
  // --- Kereste & Kanat Üretim Bölümü ---
  { code: "MK-04", name: "Kereste Kurutma Fırını", capacityHrPerDay: 24 }, // 7-10 gün süren proses, sürekli çalışır
  { code: "MK-05", name: "Çoklu Dilimleme / Budak Kesme", capacityHrPerDay: 8 },
  { code: "MK-06", name: "Fingerjoint Hattı", capacityHrPerDay: 8 },
  { code: "MK-07", name: "Rabıta Makinesi (Seren Bitirme)", capacityHrPerDay: 8 },
  { code: "MK-08", name: "Seren Çakım (Kanat İskelet)", capacityHrPerDay: 8 },
  { code: "MK-09", name: "PVC Levha Vakum Presi", capacityHrPerDay: 8 },
  { code: "MK-10", name: "CNC (Model/Cam Yeri İşleme)", capacityHrPerDay: 8 },
  { code: "MK-11", name: "Soğuk Pres Hattı (9 pres)", capacityHrPerDay: 8 },
  { code: "MK-12", name: "Sıcak Pres", capacityHrPerDay: 8 },
  { code: "MK-13", name: "Ebatlama Makinesi", capacityHrPerDay: 8 },
  { code: "MK-14", name: "Kenar Bantlama Hattı", capacityHrPerDay: 8 },
  { code: "MK-15", name: "Kilit/Rozet Delme İstasyonu", capacityHrPerDay: 8 },
  // --- Laminasyon & Sevkiyat ---
  { code: "MK-16", name: "Folyo Dilimleme", capacityHrPerDay: 8 },
  { code: "MK-17", name: "Laminasyon Hattı (Kasa/Pervaz Kaplama)", capacityHrPerDay: 8 },
  { code: "MK-18", name: "Kasa Ebatlama (45° Kesim)", capacityHrPerDay: 8 },
  { code: "MK-19", name: "Kalite Kontrol & Paketleme", capacityHrPerDay: 8 },
];

// ER Serisi model kataloğu — dolgu tipine göre 5 üretim grubuna ayrıldı,
// çünkü PDF'deki üretim prosesi de modelleri bu şekilde ayırıyor:
// model kodu görünüm/ölçü farkı yaratıyor, üretim akışını dolgu tipi belirliyor.
const ER_MODEL_CATALOG = {
  petek: ["ER100", "ER101", "ER102", "ER103", "ER200", "ER201", "ER250", "ER260", "ER261",
          "ER280", "ER300", "ER301", "ER330", "ER400", "ER500", "ER510", "ER511", "ER520"],
  kopuk: ["ER600", "ER601", "ER602", "ER610", "ER620", "ER700", "ER800", "ER801", "ER900",
          "ER901", "ER930", "ER931", "ER940", "ER941", "ER950", "ER951", "ER960"],
  okal:  ["ER1004", "ER1005", "ER1006", "ER1007", "ER1008", "ER1012", "ER1014", "ER1014 ÖZEL",
          "EROZL001-ER550", "EROZL009-ER590", "EROZL011-ER540", "EROZL013-ER560", "EROZL017-ER570"],
  melamin: ["ER2000", "ER2001", "ER2002", "ER2003"],
  yangin: ["ER-PWR-1001"],
};

const DOLGU_LABELS = {
  petek: "Ahşap Seren + Petek Dolgulu (Daphne Serisi)",
  kopuk: "Kompozit Seren + Köpük Dolgulu (Daphne Serisi)",
  okal: "Ahşap Seren + Okal Dolgulu (Daphne/Özel Seri)",
  melamin: "Melamin Yüzeyli + Petek Dolgulu (Simon Serisi)",
  yangin: "Yangına Dayanıklı Kapı (30 dk Sertifikalı)",
};

const DEFAULT_ORDERS = [
  { code: "SIP-101", product: "ER100", customer: "Akpınar İnşaat", qty: 240, dueDate: "2026-06-29" },
  { code: "SIP-102", product: "ER600", customer: "Boran Yapı Market", qty: 90, dueDate: "2026-06-26" },
  { code: "SIP-103", product: "ER-PWR-1001", customer: "Meriç AVM Projesi", qty: 60, dueDate: "2026-07-03" },
  { code: "SIP-104", product: "ER1004", customer: "Yıldız Hırdavat", qty: 150, dueDate: "2026-07-05" },
  { code: "SIP-105", product: "ER2000", customer: "Doğa Yapı Market", qty: 35, dueDate: "2026-07-08" },
];

// Dolgu tipine göre rota — kanat üretiminin gerçek akışına dayanır:
// Seren çakım+dolgu → PVC vakum pres → (model ise) CNC → Pres (soğuk/sıcak)
// → Ebatlama → Kenar bantlama → Kilit/rozet delme → Kalite&Paketleme.
// Süreler (dk/adet) PDF'de verilmediği için akışa göre mantıklı tahminlerle
// dolduruldu — gerçek ölçümlerle güncellenmesi önerilir.
function buildRoutingSteps(type) {
  const base = [
    { machine: "MK-08", minutes: 6 },   // Seren çakım + iç dolgu
    { machine: "MK-09", minutes: 10 },  // PVC levha vakum presi
  ];
  if (type !== "okal" && type !== "melamin") {
    base.push({ machine: "MK-10", minutes: 8 }); // CNC model/cam yeri (okal ve melaminde genelde düz model)
  }
  if (type === "yangin") {
    base.push({ machine: "MK-12", minutes: 25 }); // Sıcak pres — yangın kapısı için tercih
  } else {
    base.push({ machine: "MK-11", minutes: 18 }); // Soğuk pres (yaz 3 sa / kış 8 sa bekleme dahil değil, aktif iş yükü)
  }
  base.push({ machine: "MK-13", minutes: 5 });   // Ebatlama
  if (type !== "yangin") {
    base.push({ machine: "MK-14", minutes: 7 }); // Kenar bantlama (yangın kapısında fitil farklı uygulanıyor)
  }
  base.push({ machine: "MK-15", minutes: 4 });   // Kilit/rozet delme
  base.push({ machine: "MK-19", minutes: 6 });   // Kalite kontrol & paketleme
  return base;
}

const DEFAULT_ROUTINGS = Object.entries(ER_MODEL_CATALOG).flatMap(([type, models]) =>
  models.map((product) => ({ product, steps: buildRoutingSteps(type) }))
);

// ---------------- Termin hesaplama (Excel'deki mantığın aynısı) ----------------
// Bir sipariş için: rota üzerindeki her makinede gereken toplam saat hesaplanır.
// En çok zaman alan (darboğaz) makine, günlük net kapasitesiyle birlikte
// gerçek bitiş tarihini belirler (hafta sonları atlanarak iş günü sayılır).
function addWorkdays(startDate, days) {
  const d = new Date(startDate);
  let remaining = Math.ceil(days);
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0 = Pazar, 6 = Cumartesi
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return d;
}

function calcOrderFeasibility(order, routings, machines, startDate = new Date()) {
  const routing = (routings || []).find((r) => r.product === order.product);
  if (!routing || !order.qty) return null;

  let bottleneckDays = 0;
  let bottleneckMachine = null;
  const perMachine = [];

  for (const step of routing.steps) {
    const machine = machines.find((m) => m.code === step.machine);
    const capacity = machine?.capacityHrPerDay || 7; // varsayılan 7 sa/gün
    const totalHours = (order.qty * step.minutes) / 60;
    const daysNeeded = totalHours / capacity;
    perMachine.push({ machine: step.machine, totalHours, daysNeeded });
    if (daysNeeded > bottleneckDays) {
      bottleneckDays = daysNeeded;
      bottleneckMachine = step.machine;
    }
  }

  const finishDate = addWorkdays(startDate, bottleneckDays);
  let status = "uygun";
  let diffDays = null;
  if (order.dueDate) {
    const due = new Date(order.dueDate);
    diffDays = Math.round((due - finishDate) / 86400000);
    if (diffDays < 0) status = "gecikme";
    else if (diffDays <= 2) status = "sinirda";
  }

  return { finishDate, bottleneckMachine, bottleneckDays, diffDays, status, perMachine };
}


// ---------------- Storage helpers (Supabase) ----------------
// Same key/value shape as before (loadShared/saveShared), now backed
// by the app_data table instead of window.storage. Personal vs shared
// no longer matters here — everything in app_data is shared by design,
// except the language preference which we keep purely in localStorage
// equivalent (a per-key prefix) since it's a personal UI setting.
async function loadShared(key, fallback) {
  try {
    const { data, error } = await supabase
      .from("app_data")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return fallback;
    return data.value;
  } catch {
    return fallback;
  }
}
async function saveShared(key, value) {
  try {
    const { error } = await supabase
      .from("app_data")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) console.error("storage set failed", key, error);
  } catch (e) {
    console.error("storage set failed", key, e);
  }
}

// ---------------- Time helpers ----------------
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
function fmtTime(d) { return new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function fmtClock(d) { return new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); }
function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function fmtDurationShort(ms) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} sa ${m % 60} dk` : `${m} dk`;
}
function fmtDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

// ---------------- Shared UI primitives ----------------
function BigButton({ children, onClick, variant = "default", style, disabled }) {
  const variants = {
    run: { background: COLORS.accentRun, borderColor: COLORS.accentRun, color: "#0C1A10" },
    stop: { background: COLORS.accentStop, borderColor: COLORS.accentStop, color: "#fff" },
    ghost: { background: "transparent", borderColor: COLORS.border, color: COLORS.textDim },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `2px solid ${COLORS.border}`, background: COLORS.bgRaised, color: COLORS.text,
        ...(variants[variant] || {}), ...style,
        borderRadius: 14, fontFamily: "'Archivo', sans-serif", fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
        WebkitTapHighlightColor: "transparent", userSelect: "none",
        transition: "transform 0.08s ease, filter 0.08s ease",
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.filter = "brightness(0.92)"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "brightness(1)"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "brightness(1)"; }}
    >
      {children}
    </button>
  );
}

function SavedToast({ text }) {
  if (!text) return null;
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      background: COLORS.bgRaised, border: `1px solid ${COLORS.accentRun}60`, borderRadius: 12,
      padding: "12px 18px", display: "flex", alignItems: "center", gap: 8,
      fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.text, zIndex: 200,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <Check size={16} color={COLORS.accentRun} /> {text}
    </div>
  );
}

function FontImports() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      body { margin: 0; }
    `}</style>
  );
}

// =================================================================
// VERİ KATMANI — tüm uygulamanın paylaştığı state
// Storage keys: "machines", "orders", "machine-state:<code>", "log"
// =================================================================

function useSharedData() {
  const [machines, setMachines] = useState(null);
  const [orders, setOrders] = useState(null);
  const [routings, setRoutings] = useState(null);
  const [machineStates, setMachineStates] = useState({});
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  // Tracks machine codes with a write in flight, plus a version counter,
  // so a slow background refresh() can never overwrite a newer local change.
  const pendingWrites = useRef({}); // code -> version
  const writeVersion = useRef(0);

  const isRefreshing = useRef(false);
  const pollingPaused = useRef(false); // when true, the 4s background poll skips entirely

  const refresh = useCallback(async (opts = {}) => {
    if (isRefreshing.current) return; // skip if a previous refresh is still in flight
    if (pollingPaused.current && !opts.force) return; // skip background polls while paused
    isRefreshing.current = true;
    try {
      const versionAtStart = writeVersion.current;
      const [m, o, rt, l] = await Promise.all([
        loadShared("machines", DEFAULT_MACHINES),
        loadShared("orders", DEFAULT_ORDERS),
        loadShared("routings", DEFAULT_ROUTINGS),
        loadShared("log", []),
      ]);
      const stateEntries = await Promise.all(
        m.map((mach) => loadShared(`machine-state:${mach.code}`, { status: "idle" }).then((s) => [mach.code, s]))
      );
      const states = Object.fromEntries(stateEntries);

      setMachines(m);
      setOrders(o);
      setRoutings(rt);
      // Merge: keep any machine state that changed locally during this refresh
      // (i.e. a write started after we began reading) instead of the stale read.
      setMachineStates((prev) => {
        const merged = { ...states };
        for (const code of Object.keys(pendingWrites.current)) {
          if (pendingWrites.current[code] > versionAtStart && prev[code]) {
            merged[code] = prev[code];
          }
        }
        return merged;
      });
      setLog((prev) => (prev.length >= l.length ? prev : l));
      setLoading(false);
    } finally {
      isRefreshing.current = false;
    }
  }, []);

  useEffect(() => {
    refresh({ force: true });
    const t = setInterval(refresh, 4000); // poll so manager view sees operator updates
    return () => clearInterval(t);
  }, [refresh]);

  function setPolling(enabled) {
    pollingPaused.current = !enabled;
  }

  async function setMachineState(code, state) {
    writeVersion.current += 1;
    pendingWrites.current[code] = writeVersion.current;
    setMachineStates((prev) => ({ ...prev, [code]: state }));
    await saveShared(`machine-state:${code}`, state);
  }

  const logRef = useRef(log);
  useEffect(() => { logRef.current = log; }, [log]);

  async function appendLog(entry) {
    const newLog = [entry, ...logRef.current].slice(0, 100);
    logRef.current = newLog;
    setLog(newLog);
    await saveShared("log", newLog);
  }

  async function updateMachines(newMachines) {
    setMachines(newMachines);
    await saveShared("machines", newMachines);
  }
  async function updateOrders(newOrders) {
    setOrders(newOrders);
    await saveShared("orders", newOrders);
  }

  return { machines, orders, routings, machineStates, log, loading, refresh, setMachineState, appendLog, updateMachines, updateOrders, setPolling };
}

// =================================================================
// USTA MODU
// =================================================================

function UstaMode({ data, onBack, lang, dir }) {
  const now = useNow();
  const { machines, orders, machineStates, setMachineState, appendLog, setPolling } = data;
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // While the operator is on a machine screen, stop the background poll entirely.
  // The operator already sees their own writes instantly via local state, so
  // polling here only risks overwriting the screen with a stale read.
  useEffect(() => {
    setPolling(!selectedMachine);
    return () => setPolling(true);
  }, [selectedMachine, setPolling]);

  function showToast(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  if (!machines) return <LoadingScreen lang={lang} />;

  const state = selectedMachine ? machineStates[selectedMachine.code] || { status: "idle" } : null;
  const backIcon = dir === "rtl" ? { transform: "rotate(180deg)" } : {};

  async function pickMachine(m) {
    setSelectedMachine(m);
  }

  async function pickOrder(order) {
    const newState = { status: "run", orderCode: order.code, startedAt: Date.now(), produced: 0 };
    await setMachineState(selectedMachine.code, newState);
  }

  async function adjustProduced(delta) {
    const newState = { ...state, produced: Math.max(0, (state.produced || 0) + delta) };
    await setMachineState(selectedMachine.code, newState);
  }

  async function confirmStop() {
    const order = orders.find((o) => o.code === state.orderCode);
    await appendLog({
      time: Date.now(), type: "üretim", machine: selectedMachine.code,
      label: `${state.produced} adet · ${state.orderCode}`,
      detail: { qty: state.produced, order: state.orderCode, durationMs: Date.now() - state.startedAt },
    });
    await setMachineState(selectedMachine.code, { status: "down_pending", prevOrder: state.orderCode, prevProduced: state.produced, startedAt: Date.now() });
    setConfirmingStop(false);
    showToast(`${state.produced} ${t("unitsSaved", lang)}`);
  }

  async function pickDowntimeReason(reason) {
    // Canonical label stored is always Turkish; UI resolves translation by id.
    await appendLog({
      time: Date.now(), type: "duruş", machine: selectedMachine.code, label: reason.label,
      detail: { reason: reason.label },
    });
    await setMachineState(selectedMachine.code, { status: "idle" });
    showToast(`${t("downtimeSaved", lang)} ${downtimeLabel(reason.id, lang)}`);
  }

  return (
    <div dir={dir} style={{ minHeight: "100vh", background: COLORS.bg }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 20px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgPanel,
      }}>
        <button
          onClick={() => (selectedMachine ? setSelectedMachine(null) : onBack())}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 14, cursor: "pointer", padding: 0 }}
        >
          <ChevronLeft size={16} style={backIcon} />
          {selectedMachine ? selectedMachine.code : t("chooseMode", lang)}
        </button>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: COLORS.text }}>{fmtTime(now)}</span>
      </div>

      {!selectedMachine && (
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase" }}>
            {t("fieldEntry", lang)}
          </div>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 26, color: COLORS.text, margin: "4px 0 22px" }}>
            {t("whichMachine", lang)}
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {machines.map((m) => {
              const st = machineStates[m.code] || { status: "idle" };
              const dot = st.status === "run" ? COLORS.accentRun : st.status === "down_pending" ? COLORS.accentWarn : COLORS.accentIdle;
              return (
                <BigButton key={m.code} onClick={() => pickMachine(m)} style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: dot, flexShrink: 0 }} />
                    <span style={{ display: "flex", flexDirection: "column", alignItems: dir === "rtl" ? "flex-end" : "flex-start" }}>
                      <span style={{ fontFamily: "'Archivo', sans-serif", fontSize: 18 }}>{m.code}</span>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: COLORS.textDim }}>{m.name}</span>
                    </span>
                  </span>
                  <ChevronLeft size={20} style={{ transform: dir === "rtl" ? "none" : "rotate(180deg)", color: COLORS.textDim }} />
                </BigButton>
              );
            })}
          </div>
        </div>
      )}

      {selectedMachine && state.status === "idle" && (
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 22, color: COLORS.text, marginBottom: 18 }}>
            {t("whichOrder", lang)}
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {orders.map((o) => (
              <BigButton key={o.code} onClick={() => pickOrder(o)} style={{ padding: 20, textAlign: dir === "rtl" ? "right" : "left" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: COLORS.accentWarn, marginBottom: 4 }}>{o.code}</div>
                <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 16, fontWeight: 700 }}>{o.product}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>{o.customer} · {o.qty} {t("units", lang)}</div>
              </BigButton>
            ))}
          </div>
        </div>
      )}

      {selectedMachine && state.status === "run" && (
        <div style={{ padding: "24px 20px", display: "grid", gap: 20 }}>
          <div style={{ background: COLORS.accentRunDim, border: `1px solid ${COLORS.accentRun}40`, borderRadius: 18, padding: 24, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 9, height: 9, borderRadius: 99, background: COLORS.accentRun, boxShadow: `0 0 0 4px ${COLORS.accentRun}30` }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 2, color: COLORS.accentRun, textTransform: "uppercase" }}>{t("inProduction", lang)}</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 44, fontWeight: 600, color: COLORS.text, direction: "ltr" }}>
              {fmtDuration(now - state.startedAt)}
            </div>
          </div>

          <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textDim }}>{state.orderCode}</div>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text }}>
              {orders.find((o) => o.code === state.orderCode)?.product}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.textDim, marginBottom: 10 }}>{t("producedQty", lang)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <BigButton onClick={() => adjustProduced(-1)} style={{ width: 56, height: 56, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>−</BigButton>
              <div style={{ flex: 1, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 36, fontWeight: 700, color: COLORS.text, background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "10px 0" }}>
                {state.produced}
              </div>
              <BigButton onClick={() => adjustProduced(1)} variant="run" style={{ width: 56, height: 56, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>+</BigButton>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[10, 25, 50].map((n) => (
                <BigButton key={n} onClick={() => adjustProduced(n)} style={{ flex: 1, padding: "10px 0", fontSize: 14 }}>+{n}</BigButton>
              ))}
            </div>
          </div>

          <BigButton onClick={() => setConfirmingStop(true)} variant="stop" style={{ padding: "20px 0", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Square size={20} fill="currentColor" /> {t("stopProduction", lang)}
          </BigButton>
        </div>
      )}

      {selectedMachine && state.status === "down_pending" && (
        <div style={{ padding: "24px 20px" }}>
          <div style={{ background: COLORS.accentStopDim, border: `1px solid ${COLORS.accentStop}40`, borderRadius: 18, padding: 22, textAlign: "center", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={16} color={COLORS.accentStop} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: 2, color: COLORS.accentStop, textTransform: "uppercase" }}>{t("inDowntime", lang)}</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 40, fontWeight: 600, color: COLORS.text, direction: "ltr" }}>
              {fmtDuration(now - state.startedAt)}
            </div>
          </div>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 20, color: COLORS.text, marginBottom: 16 }}>
            {t("whatReason", lang)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {DOWNTIME_REASONS.map((r) => {
              const Icon = r.icon;
              return (
                <BigButton key={r.id} onClick={() => pickDowntimeReason(r)} style={{ padding: "22px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <Icon size={28} color={r.color} />
                  <span style={{ textAlign: "center", lineHeight: 1.2 }}>{downtimeLabel(r.id, lang)}</span>
                </BigButton>
              );
            })}
          </div>
        </div>
      )}

      {confirmingStop && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: COLORS.bgPanel, borderTop: `1px solid ${COLORS.border}`, borderRadius: "20px 20px 0 0", padding: "26px 22px 30px", width: "100%", maxWidth: 480 }}>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 20, color: COLORS.text, marginBottom: 6 }}>
              {t("confirmStopTitle", lang)}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.textDim, marginBottom: 18 }}>
              {state.orderCode} {t("confirmStopFor", lang)} <strong style={{ color: COLORS.text }}>{state.produced} {t("units", lang)}</strong> {t("unitsWillBeSaved", lang)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <BigButton onClick={() => setConfirmingStop(false)} variant="ghost" style={{ flex: 1, padding: "16px 0" }}>{t("cancel", lang)}</BigButton>
              <BigButton onClick={confirmStop} variant="stop" style={{ flex: 1, padding: "16px 0" }}>{t("stop", lang)}</BigButton>
            </div>
          </div>
        </div>
      )}

      <SavedToast text={toast} />
    </div>
  );
}

// =================================================================
// EXCEL'E AKTAR — anlık sistem verisini .xlsx rapor olarak indirir
// =================================================================

function exportToExcel({ machines, orders, routings, machineStates, log }) {
  const wb = XLSX.utils.book_new();
  const now = new Date();

  // Sayfa 1: Anlık Makine Durumu
  const statusRows = machines.map((m) => {
    const st = machineStates[m.code] || { status: "idle" };
    const order = st.orderCode ? orders.find((o) => o.code === st.orderCode) : null;
    const elapsedMin = st.startedAt ? Math.round((Date.now() - st.startedAt) / 60000) : "";
    return {
      "Makine Kodu": m.code,
      "Makine Adı": m.name,
      "Net Günlük Kapasite (saat)": m.capacityHrPerDay,
      "Durum": st.status === "run" ? "Üretimde" : st.status === "down_pending" ? "Duruşta" : "Boşta",
      "Sipariş": st.orderCode || "",
      "Ürün": order ? order.product : "",
      "Üretilen Adet": st.status === "run" ? (st.produced || 0) : "",
      "Hedef Adet": order ? order.qty : "",
      "Geçen Süre (dk)": elapsedMin,
      "Termin": order ? order.dueDate : "",
    };
  });
  const wsStatus = XLSX.utils.json_to_sheet(statusRows);
  wsStatus["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsStatus, "Anlık Durum");

  // Sayfa 2: Siparişler (otomatik termin hesabıyla)
  const orderRows = orders.map((o) => {
    const feas = calcOrderFeasibility(o, routings, machines);
    const statusLabel = feas ? { uygun: "Uygun", sinirda: "Sınırda", gecikme: "Gecikme Riski" }[feas.status] : "Rota tanımı yok";
    return {
      "Sipariş No": o.code, "Ürün": o.product, "Müşteri": o.customer,
      "Miktar": o.qty, "Termin": o.dueDate,
      "Tahmini Bitiş (hesaplanan)": feas ? feas.finishDate.toLocaleDateString("tr-TR") : "",
      "Darboğaz Makine": feas ? feas.bottleneckMachine : "",
      "Durum": statusLabel,
    };
  });
  const wsOrders = XLSX.utils.json_to_sheet(orderRows);
  wsOrders["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsOrders, "Siparişler");

  // Sayfa 3: Makineler ve Kapasite
  const machineRows = machines.map((m) => ({
    "Makine Kodu": m.code, "Makine Adı": m.name, "Net Günlük Kapasite (saat)": m.capacityHrPerDay,
  }));
  const wsMachines = XLSX.utils.json_to_sheet(machineRows);
  wsMachines["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsMachines, "Makineler");

  // Sayfa 4: Ürün Rotaları / Süreleri
  const routingRows = [];
  (routings || []).forEach((r) => {
    r.steps.forEach((s, i) => {
      routingRows.push({
        "Ürün": r.product, "Sıra": i + 1, "Makine Kodu": s.machine,
        "Birim Süre (dk/adet)": s.minutes,
      });
    });
  });
  const wsRouting = XLSX.utils.json_to_sheet(routingRows);
  wsRouting["!cols"] = [{ wch: 28 }, { wch: 6 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsRouting, "Ürün Süreleri");

  // Sayfa 5: Hareket Geçmişi (log)
  const logRows = log.map((l) => ({
    "Tarih/Saat": new Date(l.time).toLocaleString("tr-TR"),
    "Tip": l.type === "üretim" ? "Üretim" : "Duruş",
    "Makine": l.machine,
    "Detay": l.label,
  }));
  const wsLog = XLSX.utils.json_to_sheet(logRows);
  wsLog["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsLog, "Hareket Geçmişi");

  const fname = `Uretim_Raporu_${now.toISOString().slice(0, 10)}_${now.getHours()}${now.getMinutes()}.xlsx`;
  XLSX.writeFile(wb, fname);
}



function statusMeta(status, lang) {
  switch (status) {
    case "run": return { label: t("inProduction", lang).toUpperCase(), color: COLORS.accentRun, dim: COLORS.accentRunDim };
    case "down_pending": return { label: t("inDowntime", lang).toUpperCase(), color: COLORS.accentStop, dim: COLORS.accentStopDim };
    default: return { label: t("idle", lang).toUpperCase(), color: COLORS.accentIdle, dim: "#1F2123" };
  }
}

function ProgressBar({ value, max, color, lang }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div style={{ height: 8, background: "#00000040", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textDim }}>{value} / {max} {t("units", lang)}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textFaint }}>%{pct}</span>
      </div>
    </div>
  );
}

function computeRisk(machine, state, order, now, lang) {
  if (state.status !== "run" || !order || !machine.capacityHrPerDay) return null;
  const elapsedHr = (now - state.startedAt) / 3600000;
  if (elapsedHr < 0.05) return null;
  const rate = state.produced / elapsedHr; // units per hour
  if (!rate) return null;
  const remaining = order.qty - state.produced;
  const hoursNeeded = remaining / rate;
  const daysNeeded = hoursNeeded / machine.capacityHrPerDay;
  if (!order.dueDate) return null;
  const daysLeft = (new Date(order.dueDate) - now) / 86400000;
  if (daysNeeded > daysLeft) return { label: t("dueRiskBadge", lang), color: COLORS.accentWarn };
  return null;
}

function MachineCard({ machine, state, order, now, onClick, lang, dir }) {
  const meta = statusMeta(state.status, lang);
  const elapsed = state.startedAt ? now - state.startedAt : null;
  const risk = computeRisk(machine, state, order, now, lang);

  return (
    <button onClick={onClick} style={{
      textAlign: dir === "rtl" ? "right" : "left", width: "100%", border: `1px solid ${state.status === "down_pending" ? COLORS.accentStop + "50" : COLORS.border}`,
      background: COLORS.bgPanel, borderRadius: 16, padding: 18, cursor: "pointer", fontFamily: "inherit", position: "relative",
    }}>
      {state.status === "down_pending" && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: COLORS.accentStop, borderRadius: "16px 16px 0 0" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 19, color: COLORS.text }}>{machine.code}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim }}>{machine.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 99, background: meta.dim }}>
          <div style={{ width: 7, height: 7, borderRadius: 99, background: meta.color }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
        </div>
      </div>

      {state.status === "run" && order && (
        <>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.accentWarn, marginBottom: 3 }}>{order.code}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 12 }}>{order.product}</div>
          <ProgressBar value={state.produced} max={order.qty} color={COLORS.accentRun} lang={lang} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint }}>
              {fmtDurationShort(elapsed)} {t("workingFor", lang)} · {t("due", lang)} {fmtDateShort(order.dueDate)}
            </span>
            {risk && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, color: risk.color, background: COLORS.accentWarnDim, padding: "3px 8px", borderRadius: 6 }}>
                {risk.label}
              </span>
            )}
          </div>
        </>
      )}

      {state.status === "down_pending" && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: COLORS.accentStop }}>
          {fmtDurationShort(elapsed)} {t("waitingFor", lang)} · {t("reasonPending", lang)}
        </div>
      )}

      {state.status === "idle" && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textFaint }}>{t("noAssignedOrder", lang)}</div>
      )}
    </button>
  );
}

function YoneticiMode({ data, onBack, lang, dir }) {
  const now = useNow(2000);
  const { machines, orders, routings, machineStates, log, refresh } = data;
  const [tab, setTab] = useState("durum");

  if (!machines) return <LoadingScreen lang={lang} />;

  const downCount = machines.filter((m) => (machineStates[m.code] || {}).status === "down_pending").length;
  const runCount = machines.filter((m) => (machineStates[m.code] || {}).status === "run").length;
  const idleCount = machines.length - downCount - runCount;

  // Log entries store the canonical Turkish downtime label; resolve to an id
  // so counts can be grouped correctly regardless of display language.
  const reasonCounts = {};
  log.filter((l) => l.type === "duruş").forEach((l) => {
    const id = downtimeIdFromTrLabel(l.label) || l.label;
    reasonCounts[id] = (reasonCounts[id] || 0) + 1;
  });
  const totalReasons = Object.values(reasonCounts).reduce((a, b) => a + b, 0) || 1;
  const backIcon = dir === "rtl" ? { transform: "rotate(180deg)" } : {};

  return (
    <div dir={dir} style={{ minHeight: "100vh", background: COLORS.bg }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 20px 14px", borderBottom: `1px solid ${COLORS.border}`,
        position: "sticky", top: 0, background: COLORS.bg, zIndex: 10,
      }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer", padding: 0 }}>
          <ChevronLeft size={15} style={backIcon} /> {t("chooseMode", lang)}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => exportToExcel({ machines, orders, routings, machineStates, log })}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: COLORS.accentRunDim,
              border: `1px solid ${COLORS.accentRun}50`, color: COLORS.accentRun, cursor: "pointer",
              padding: "7px 12px", borderRadius: 10, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600,
            }}
          >
            <Download size={13} /> {t("exportExcel", lang)}
          </button>
          <button onClick={() => refresh({ force: true })} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", padding: 0, display: "flex" }}>
            <RefreshCw size={14} />
          </button>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: COLORS.text }}>{fmtClock(now)}</span>
        </div>
      </div>

      <div style={{ padding: "16px 20px 0", display: "flex", gap: 8 }}>
        {[
          { id: "durum", label: t("status", lang) },
          { id: "ayarlar", label: t("settings", lang) },
        ].map((tabItem) => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={{
            padding: "8px 14px", borderRadius: 10, border: `1px solid ${tab === tabItem.id ? COLORS.accentRun : COLORS.border}`,
            background: tab === tabItem.id ? COLORS.accentRunDim : "transparent",
            color: tab === tabItem.id ? COLORS.accentRun : COLORS.textDim,
            fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "durum" && (
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 22 }}>
          {downCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.accentStopDim, border: `1px solid ${COLORS.accentStop}40`, borderRadius: 12, padding: "12px 16px" }}>
              <AlertTriangle size={16} color={COLORS.accentStop} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.text }}>
                <strong>{downCount}</strong> {t("machinesDown", lang)}
              </span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[{ label: t("inProduction", lang), value: runCount, color: COLORS.accentRun }, { label: t("inDowntime", lang), value: downCount, color: COLORS.accentStop }, { label: t("idle", lang), value: idleCount, color: COLORS.accentIdle }].map((it) => (
              <div key={it.label} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 700, color: it.color }}>{it.value}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textFaint }}>/ {machines.length}</span>
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>{it.label}</div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
              {t("ordersDueStatus", lang)}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {orders.map((o) => {
                const feas = calcOrderFeasibility(o, routings, machines);
                const hasRouting = !!(routings || []).find((r) => r.product === o.product);
                const meta = feas ? {
                  uygun: { color: COLORS.accentRun, label: t("uygun", lang) },
                  sinirda: { color: COLORS.accentWarn, label: t("sinirda", lang) },
                  gecikme: { color: COLORS.accentStop, label: t("gecikme", lang) },
                }[feas.status] : null;
                return (
                  <div key={o.code} style={{
                    background: COLORS.bgPanel, border: `1px solid ${meta && feas.status === "gecikme" ? COLORS.accentStop + "50" : COLORS.border}`,
                    borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.accentWarn }}>{o.code}</span>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 600, color: COLORS.text }}>{o.product}</span>
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>
                        {o.customer} · {o.qty} {t("units", lang)} · {t("due", lang)} {fmtDateShort(o.dueDate)}
                      </div>
                    </div>
                    {!hasRouting && (
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint }}>{t("routingMissing", lang)}</span>
                    )}
                    {meta && (
                      <div style={{ textAlign: dir === "rtl" ? "left" : "right" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, color: meta.color, background: meta.color + "20", padding: "3px 8px", borderRadius: 6 }}>
                          {meta.label}
                        </span>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint, marginTop: 4 }}>
                          {t("estFinish", lang)} {feas.finishDate.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} · {feas.bottleneckMachine} {t("bottleneck", lang)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
              {t("machines", lang)}
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
              {machines.map((m) => {
                const st = machineStates[m.code] || { status: "idle" };
                const order = st.orderCode ? orders.find((o) => o.code === st.orderCode) : null;
                return <MachineCard key={m.code} machine={m} state={st} order={order} now={now} onClick={() => {}} lang={lang} dir={dir} />;
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>{t("downtimeReasonsTotal", lang)}</div>
              {Object.keys(reasonCounts).length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noRecordsYet", lang)}</div>}
              <div style={{ display: "grid", gap: 10 }}>
                {Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([reasonId, count]) => {
                  const meta = DOWNTIME_REASONS.find((r) => r.id === reasonId) || DOWNTIME_REASONS[5];
                  const Icon = meta.icon;
                  const pct = Math.round((count / totalReasons) * 100);
                  return (
                    <div key={reasonId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon size={15} color={meta.color} style={{ flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, width: 130, flexShrink: 0 }}>{downtimeLabel(meta.id, lang)}</span>
                      <div style={{ flex: 1, height: 6, background: "#00000040", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: meta.color, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textFaint, width: 22, textAlign: "right" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>{t("recentActivity", lang)}</div>
              {log.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noRecordsYet", lang)}</div>}
              <div style={{ display: "grid", gap: 4 }}>
                {log.slice(0, 8).map((l, i) => {
                  const reasonId = l.type === "duruş" ? downtimeIdFromTrLabel(l.label) : null;
                  const displayLabel = reasonId ? downtimeLabel(reasonId, lang) : l.label;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < Math.min(log.length, 8) - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.textFaint, width: 42, flexShrink: 0 }}>{fmtClock(l.time)}</span>
                      <div style={{ width: 6, height: 6, borderRadius: 99, flexShrink: 0, background: l.type === "üretim" ? COLORS.accentRun : COLORS.accentStop }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.accentWarn, width: 44, flexShrink: 0 }}>{l.machine}</span>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>{displayLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "ayarlar" && <TanimlarPanel data={data} lang={lang} dir={dir} />}
    </div>
  );
}

function TanimlarPanel({ data, lang, dir }) {
  const { machines, orders, routings, updateMachines, updateOrders } = data;
  const [localMachines, setLocalMachines] = useState(machines);
  const [localOrders, setLocalOrders] = useState(orders);
  const [savedMsg, setSavedMsg] = useState(null);

  useEffect(() => { setLocalMachines(machines); }, [machines]);
  useEffect(() => { setLocalOrders(orders); }, [orders]);

  function flashSaved() {
    setSavedMsg(t("saved", lang));
    setTimeout(() => setSavedMsg(null), 1500);
  }

  async function saveMachines(list) {
    setLocalMachines(list);
    await updateMachines(list);
    flashSaved();
  }
  async function saveOrders(list) {
    setLocalOrders(list);
    await updateOrders(list);
    flashSaved();
  }

  return (
    <div dir={dir} style={{ maxWidth: 800, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 28 }}>
      <SavedToast text={savedMsg} />

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text }}>{t("machines", lang)}</div>
          <button
            onClick={() => saveMachines([...localMachines, { code: `MK-0${localMachines.length + 1}`, name: t("newMachine", lang), capacityHrPerDay: 7 }])}
            style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: "8px 12px", borderRadius: 10, fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer" }}
          >
            <Plus size={14} /> {t("add", lang)}
          </button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {localMachines.map((m, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px 36px", gap: 8, alignItems: "center", background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 10 }}>
              <input value={m.code} onChange={(e) => { const l = [...localMachines]; l[i] = { ...l[i], code: e.target.value }; setLocalMachines(l); }} onBlur={() => saveMachines(localMachines)} style={inputStyle} />
              <input value={m.name} onChange={(e) => { const l = [...localMachines]; l[i] = { ...l[i], name: e.target.value }; setLocalMachines(l); }} onBlur={() => saveMachines(localMachines)} style={inputStyle} />
              <input type="number" step="0.1" value={m.capacityHrPerDay} onChange={(e) => { const l = [...localMachines]; l[i] = { ...l[i], capacityHrPerDay: parseFloat(e.target.value) || 0 }; setLocalMachines(l); }} onBlur={() => saveMachines(localMachines)} style={inputStyle} title={t("machineCol", lang)} />
              <button onClick={() => saveMachines(localMachines.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: COLORS.accentStop, cursor: "pointer", display: "flex", justifyContent: "center" }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint, marginTop: 6 }}>{t("machineCol", lang)}</div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text }}>{t("ordersDueStatus", lang).split(" ·")[0]}</div>
          <button
            onClick={() => saveOrders([...localOrders, { code: `SIP-00${localOrders.length + 1}`, product: t("newProduct", lang), customer: t("customer", lang), qty: 100, dueDate: "" }])}
            style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: "8px 12px", borderRadius: 10, fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer" }}
          >
            <Plus size={14} /> {t("add", lang)}
          </button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {localOrders.map((o, i) => {
            const feas = calcOrderFeasibility(o, routings, localMachines);
            return (
              <div key={i} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px 70px 110px 36px", gap: 8, alignItems: "center", background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 10 }}>
                  <input value={o.code} onChange={(e) => { const l = [...localOrders]; l[i] = { ...l[i], code: e.target.value }; setLocalOrders(l); }} onBlur={() => saveOrders(localOrders)} style={inputStyle} />
                  <input value={o.product} onChange={(e) => { const l = [...localOrders]; l[i] = { ...l[i], product: e.target.value }; setLocalOrders(l); }} onBlur={() => saveOrders(localOrders)} style={inputStyle} />
                  <input value={o.customer} onChange={(e) => { const l = [...localOrders]; l[i] = { ...l[i], customer: e.target.value }; setLocalOrders(l); }} onBlur={() => saveOrders(localOrders)} style={inputStyle} />
                  <input type="number" value={o.qty} onChange={(e) => { const l = [...localOrders]; l[i] = { ...l[i], qty: parseInt(e.target.value) || 0 }; setLocalOrders(l); }} onBlur={() => saveOrders(localOrders)} style={inputStyle} />
                  <input type="date" value={o.dueDate} onChange={(e) => { const l = [...localOrders]; l[i] = { ...l[i], dueDate: e.target.value }; setLocalOrders(l); }} onBlur={() => saveOrders(localOrders)} style={inputStyle} />
                  <button onClick={() => saveOrders(localOrders.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: COLORS.accentStop, cursor: "pointer", display: "flex", justifyContent: "center" }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <FeasibilityRow feasibility={feas} hasRouting={!!(routings || []).find((r) => r.product === o.product)} lang={lang} />
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint, marginTop: 6 }}>{t("orderCols", lang)}</div>
      </div>
    </div>
  );
}

function FeasibilityRow({ feasibility, hasRouting, lang }) {
  if (!hasRouting) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px 4px", fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint }}>
        <AlertTriangle size={12} /> {t("routingMissingFull", lang)}
      </div>
    );
  }
  if (!feasibility) return null;
  const { finishDate, bottleneckMachine, diffDays, status } = feasibility;
  const meta = {
    uygun: { color: COLORS.accentRun, label: t("uygun", lang) },
    sinirda: { color: COLORS.accentWarn, label: t("sinirda", lang) },
    gecikme: { color: COLORS.accentStop, label: t("gecikme", lang) },
  }[status];
  const finishStr = finishDate.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 4px 4px", flexWrap: "wrap" }}>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, color: meta.color,
        background: meta.color + "20", padding: "3px 8px", borderRadius: 6,
      }}>
        {meta.label}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint }}>
        {t("estFinish", lang)}: <strong style={{ color: COLORS.textDim }}>{finishStr}</strong>
        {" · "}{t("bottleneck", lang)}: <strong style={{ color: COLORS.textDim }}>{bottleneckMachine}</strong>
        {diffDays !== null && (
          <> {" · "}{diffDays >= 0 ? t("daysMargin", lang, { n: diffDays }) : t("daysOverdue", lang, { n: Math.abs(diffDays) })}</>
        )}
      </span>
    </div>
  );
}

const inputStyle = {
  background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, borderRadius: 8,
  color: COLORS.text, fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "8px 10px", width: "100%", outline: "none",
};

function LoadingScreen({ lang = "tr" }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <FontImports />
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
        <RefreshCw size={16} className="spin" /> {t("loading", lang)}
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// =================================================================
// MOD SEÇİM EKRANI
// =================================================================

function ModeSelect({ onSelect, lang, setLang, dir }) {
  return (
    <div dir={dir} style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 26 }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              style={{
                padding: "7px 14px", borderRadius: 99, cursor: "pointer",
                border: `1px solid ${lang === l.code ? COLORS.accentRun : COLORS.border}`,
                background: lang === l.code ? COLORS.accentRunDim : "transparent",
                color: lang === l.code ? COLORS.accentRun : COLORS.textDim,
                fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600,
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textFaint, letterSpacing: 3, textTransform: "uppercase" }}>
            {t("appTitle", lang)}
          </div>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 26, color: COLORS.text, marginTop: 6 }}>
            {t("howLogin", lang)}
          </div>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <BigButton onClick={() => onSelect("usta")} style={{ padding: "26px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <Users size={28} color={COLORS.accentRun} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: dir === "rtl" ? "flex-end" : "flex-start" }}>
              <span style={{ fontSize: 18 }}>{t("operatorMode", lang)}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: COLORS.textDim }}>{t("operatorModeDesc", lang)}</span>
            </span>
          </BigButton>
          <BigButton onClick={() => onSelect("yonetici")} style={{ padding: "26px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <Monitor size={28} color={COLORS.accentWarn} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: dir === "rtl" ? "flex-end" : "flex-start" }}>
              <span style={{ fontSize: 18 }}>{t("managerMode", lang)}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: COLORS.textDim }}>{t("managerModeDesc", lang)}</span>
            </span>
          </BigButton>
        </div>
        <div style={{ textAlign: "center", marginTop: 22, fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint }}>
          {t("sharedNote", lang)}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// ANA UYGULAMA
// =================================================================

export default function App() {
  const [mode, setMode] = useState(null);
  const data = useSharedData();
  const { lang, setLang, dir, ready } = useLanguage();

  if (!ready) return <LoadingScreen lang={lang} />;

  return (
    <>
      <FontImports />
      {mode === null && <ModeSelect onSelect={setMode} lang={lang} setLang={setLang} dir={dir} />}
      {mode === "usta" && <UstaMode data={data} onBack={() => setMode(null)} lang={lang} dir={dir} />}
      {mode === "yonetici" && <YoneticiMode data={data} onBack={() => setMode(null)} lang={lang} dir={dir} />}
    </>
  );
}
