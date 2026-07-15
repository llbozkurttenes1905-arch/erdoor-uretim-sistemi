import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import {
  Play, Square, AlertTriangle, Wrench, Zap, Package, Clock,
  ChevronLeft, Check, RefreshCw, Users, Monitor, Settings, Plus, Trash2, X, Download,
  Menu, QrCode, BarChart3,
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
  // ERDOOR marka kırmızısı — logo/başlık/vurgu için (durum renklerinden ayrı tutulur)
  brand: "#D70E16", brandDim: "#2E1114",
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
  productModels: { tr: "Ürün Modelleri", en: "Product Models", ar: "موديلات المنتج" },
  productModelsNote: { tr: "Hangi ER kodu hangi dolgu tipinde — üretim rotasını bu belirler. Bu liste salt okunur; değiştirmek için bana söyleyin.", en: "Which ER code belongs to which fill type — this determines the production route. Read-only; ask me to change it.", ar: "أي رمز ER ينتمي إلى أي نوع حشو — هذا يحدد مسار الإنتاج. للقراءة فقط؛ اطلب منا التغيير." },
  modelsCount: { tr: "model", en: "models", ar: "موديل" },
  todaysPlan: { tr: "Bugünün Planı", en: "Today's Plan", ar: "خطة اليوم" },
  noPlanToday: { tr: "Bugün için bu makineye planlanmış bir iş yok. Yöneticiye sorun.", en: "No work planned for this machine today. Ask your manager.", ar: "لا يوجد عمل مخطط لهذه الماكينة اليوم. اسأل المدير." },
  startProduction: { tr: "Üretimi Başlat", en: "Start Production", ar: "بدء الإنتاج" },
  producingProfile: { tr: "Üretilen Profil", en: "Profile Being Produced", ar: "الملف الشخصي قيد الإنتاج" },
  productionPlan: { tr: "Üretim Planı", en: "Production Plan", ar: "خطة الإنتاج" },
  holiday: { tr: "TATİL", en: "HOLIDAY", ar: "عطلة" },
  planSavedMsg: { tr: "Plan güncellendi", en: "Plan updated", ar: "تم تحديث الخطة" },
  addWeek: { tr: "+1 Hafta Göster", en: "Show +1 Week", ar: "إظهار +أسبوع" },
  planNote: { tr: "Her hücreye o gün o makinede üretilecek profil/iş tipini seçin. Seçim otomatik kaydedilir.", en: "Select the profile/job for that machine on that day in each cell. Saves automatically.", ar: "اختر نوع الملف الشخصي/العمل لتلك الماكينة في ذلك اليوم في كل خلية. يُحفظ تلقائيًا." },
  departmentMachines: { tr: "Makineler", en: "Machines", ar: "الماكينات" },
  departmentProducts: { tr: "Ürün/Profil Listesi", en: "Product/Profile List", ar: "قائمة المنتجات/الملفات" },
  newProductPlaceholder: { tr: "Yeni ürün/profil adı", en: "New product/profile name", ar: "اسم منتج/ملف جديد" },
  orders: { tr: "Siparişler", en: "Orders", ar: "الطلبات" },
  orderProduct: { tr: "Ürün", en: "Product", ar: "المنتج" },
  orderCustomer: { tr: "Müşteri", en: "Customer", ar: "العميل" },
  orderQty: { tr: "Miktar", en: "Quantity", ar: "الكمية" },
  orderDue: { tr: "Teslim Tarihi", en: "Due Date", ar: "تاريخ التسليم" },
  orderStatus: { tr: "Durum", en: "Status", ar: "الحالة" },
  orderPending: { tr: "Bekliyor", en: "Pending", ar: "قيد الانتظار" },
  orderDelivered: { tr: "Teslim Edildi", en: "Delivered", ar: "تم التسليم" },
  markDelivered: { tr: "Teslim Edildi İşaretle", en: "Mark as Delivered", ar: "وضع علامة تم التسليم" },
  newOrderProduct: { tr: "Ürün seçin", en: "Select product", ar: "اختر المنتج" },
  selectProduct: { tr: "Ürün seçin...", en: "Select a product...", ar: "اختر منتجًا..." },
  linkToOrder: { tr: "Hangi sipariş için? (opsiyonel)", en: "For which order? (optional)", ar: "لأي طلب؟ (اختياري)" },
  noOrderLink: { tr: "Sipariş bağlama (genel üretim)", en: "No order link (general production)", ar: "بدون ربط بطلب (إنتاج عام)" },
  noMatchingOrders: { tr: "Bu ürün için bekleyen sipariş yok. Önce Tanımlar'dan sipariş ekleyin.", en: "No pending orders for this product. Add one from Settings first.", ar: "لا توجد طلبات معلقة لهذا المنتج. أضف طلبًا من الإعدادات أولاً." },
  producingForOrder: { tr: "Sipariş için üretiliyor", en: "Producing for order", ar: "قيد الإنتاج للطلب" },
  stages: { tr: "Üretim Aşamaları", en: "Production Stages", ar: "مراحل الإنتاج" },
  addStage: { tr: "Aşama Ekle", en: "Add Stage", ar: "إضافة مرحلة" },
  stagePickMachine: { tr: "Makine seçin...", en: "Select machine...", ar: "اختر ماكينة..." },
  stageWaiting: { tr: "Bekliyor", en: "Waiting", ar: "قيد الانتظار" },
  stageRunning: { tr: "Üretimde", en: "In Production", ar: "قيد الإنتاج" },
  stageDone: { tr: "Tamamlandı", en: "Completed", ar: "مكتمل" },
  stageOutputQty: { tr: "Çıkan adet", en: "Output qty", ar: "الكمية المنتجة" },
  noStagesYet: { tr: "Henüz aşama eklenmedi — aşağıdan makine seçip ekleyin", en: "No stages yet — add a machine below", ar: "لم تُضف مراحل بعد — أضف ماكينة أدناه" },
  currentStageLabel: { tr: "Şu an", en: "Currently at", ar: "حاليًا في" },
  allStagesDoneLabel: { tr: "Tüm aşamalar tamamlandı", en: "All stages completed", ar: "اكتملت جميع المراحل" },
  stageOf: { tr: "aşama", en: "of stages", ar: "مرحلة" },
  myOrdersOnMachine: { tr: "Bu Makinede Sıradaki Siparişler", en: "Orders Queued on This Machine", ar: "الطلبات في الانتظار على هذه الماكينة" },
  noOrdersOnMachine: { tr: "Bu makine için sırada bekleyen sipariş yok. Genel üretim planına bakılıyor.", en: "No orders queued for this machine. Falling back to the general production plan.", ar: "لا توجد طلبات في الانتظار لهذه الماكينة. يتم عرض خطة الإنتاج العامة." },
  stageProgress: { tr: "aşama", en: "stage", ar: "مرحلة" },
  workingOnOrder: { tr: "Çalışılan Sipariş", en: "Working On Order", ar: "الطلب قيد العمل" },
  outOf: { tr: "/", en: "of", ar: "من" },

  // ---- Giriş / Güvenlik ----
  loginTitle: { tr: "Giriş Yap", en: "Sign In", ar: "تسجيل الدخول" },
  email: { tr: "E-posta", en: "Email", ar: "البريد الإلكتروني" },
  password: { tr: "Şifre", en: "Password", ar: "كلمة المرور" },
  fullName: { tr: "Ad Soyad", en: "Full Name", ar: "الاسم الكامل" },
  signIn: { tr: "Giriş Yap", en: "Sign In", ar: "دخول" },
  signUp: { tr: "Hesap Oluştur", en: "Create Account", ar: "إنشاء حساب" },
  noAccountYet: { tr: "Hesabın yok mu? Kayıt ol", en: "No account? Sign up", ar: "ليس لديك حساب؟ سجل" },
  haveAccount: { tr: "Zaten hesabın var mı? Giriş yap", en: "Already have an account? Sign in", ar: "لديك حساب بالفعل؟ سجل الدخول" },
  signOut: { tr: "Çıkış Yap", en: "Sign Out", ar: "تسجيل الخروج" },
  loginError: { tr: "Giriş başarısız — e-posta/şifreyi kontrol edin", en: "Sign in failed — check email/password", ar: "فشل تسجيل الدخول — تحقق من البريد/كلمة المرور" },
  signUpSuccess: { tr: "Hesap oluşturuldu. Şimdi giriş yapabilirsin.", en: "Account created. You can sign in now.", ar: "تم إنشاء الحساب. يمكنك تسجيل الدخول الآن." },
  noManagerAccess: { tr: "Bu hesabın yönetici yetkisi yok. Erişim için yöneticinize başvurun.", en: "This account doesn't have manager access. Ask your admin.", ar: "لا يملك هذا الحساب صلاحية المدير." },
  signedInAs: { tr: "Giriş yapan", en: "Signed in as", ar: "تم تسجيل الدخول باسم" },
  authenticating: { tr: "Kontrol ediliyor…", en: "Checking…", ar: "جارٍ التحقق…" },

  // ---- Stok / Hammadde ----
  stok: { tr: "Stok", en: "Stock", ar: "المخزون" },
  stockItems: { tr: "Hammadde / Stok Kalemleri", en: "Raw Materials / Stock Items", ar: "المواد الخام / عناصر المخزون" },
  stockItemName: { tr: "Malzeme adı", en: "Material name", ar: "اسم المادة" },
  stockUnit: { tr: "Birim", en: "Unit", ar: "الوحدة" },
  stockQty: { tr: "Mevcut Miktar", en: "Current Quantity", ar: "الكمية الحالية" },
  stockCritical: { tr: "Kritik Seviye", en: "Critical Level", ar: "المستوى الحرج" },
  stockLow: { tr: "KRİTİK SEVİYE ALTINDA", en: "BELOW CRITICAL LEVEL", ar: "أقل من المستوى الحرج" },
  addStockItem: { tr: "Malzeme Ekle", en: "Add Material", ar: "إضافة مادة" },
  adjustStock: { tr: "Miktar Güncelle", en: "Adjust Quantity", ar: "تعديل الكمية" },
  stockIn: { tr: "Giriş", en: "In", ar: "دخول" },
  stockOut: { tr: "Çıkış", en: "Out", ar: "خروج" },
  noStockItems: { tr: "Henüz stok kalemi eklenmedi", en: "No stock items yet", ar: "لم تُضف عناصر مخزون بعد" },
  stockMovements: { tr: "Son Stok Hareketleri", en: "Recent Stock Movements", ar: "آخر حركات المخزون" },

  // ---- Satın Alma ----
  purchasing: { tr: "Satın Alma", en: "Purchasing", ar: "المشتريات" },
  purchaseRequestsTitle: { tr: "Satın Alma Talepleri", en: "Purchase Requests", ar: "طلبات الشراء" },
  newPurchaseRequest: { tr: "Yeni Talep", en: "New Request", ar: "طلب جديد" },
  purchaseItem: { tr: "Malzeme", en: "Material", ar: "المادة" },
  purchaseQty: { tr: "Talep Edilen Miktar", en: "Requested Quantity", ar: "الكمية المطلوبة" },
  purchaseNote: { tr: "Not (opsiyonel)", en: "Note (optional)", ar: "ملاحظة (اختياري)" },
  purchaseStatusPending: { tr: "Bekliyor", en: "Pending", ar: "قيد الانتظار" },
  purchaseStatusApproved: { tr: "Onaylandı", en: "Approved", ar: "موافق عليه" },
  purchaseStatusOrdered: { tr: "Sipariş Verildi", en: "Ordered", ar: "تم الطلب" },
  purchaseStatusReceived: { tr: "Teslim Alındı", en: "Received", ar: "تم الاستلام" },
  approve: { tr: "Onayla", en: "Approve", ar: "موافقة" },
  markOrdered: { tr: "Sipariş Verildi İşaretle", en: "Mark as Ordered", ar: "وضع علامة تم الطلب" },
  markReceived: { tr: "Teslim Alındı İşaretle", en: "Mark as Received", ar: "وضع علامة تم الاستلام" },
  noPurchaseRequests: { tr: "Henüz talep yok", en: "No requests yet", ar: "لا توجد طلبات بعد" },
  requestedBy: { tr: "Talep eden", en: "Requested by", ar: "طلب بواسطة" },
  del: { tr: "Sil", en: "Delete", ar: "حذف" },
  selectStockItem: { tr: "Malzeme seçin...", en: "Select material...", ar: "اختر المادة..." },
  autoRequestBadge: { tr: "Otomatik (Kritik Seviye)", en: "Automatic (Critical Level)", ar: "تلقائي (المستوى الحرج)" },

  // ---- Ürün Rotaları / Reçeteleri ----
  routes: { tr: "Rota / Reçete", en: "Routes / Recipes", ar: "المسارات / الوصفات" },
  routesDesc: { tr: "Her ürünün hangi makinelerden sırayla geçtiğini ve hangi malzemeleri tükettiğini burada bir kere tanımlayın. Yeni sipariş oluşturduğunuzda aşamalar otomatik gelir.", en: "Define once which machines each product passes through and which materials it consumes. New orders will auto-fill their stages from this.", ar: "حدد هنا مرة واحدة المسار والمواد لكل منتج." },
  routeProduct: { tr: "Ürün", en: "Product", ar: "المنتج" },
  routeStagesTitle: { tr: "Makine Sırası (Rota)", en: "Machine Sequence (Route)", ar: "تسلسل الآلات" },
  routeConsumablesTitle: { tr: "Aşama Başına Tüketilen Malzeme", en: "Material Consumed Per Stage", ar: "المواد المستهلكة لكل مرحلة" },
  addConsumable: { tr: "Malzeme Ekle", en: "Add Material", ar: "إضافة مادة" },
  qtyPerUnit: { tr: "Birim başına miktar", en: "Qty per unit", ar: "الكمية لكل وحدة" },
  saveRoute: { tr: "Rotayı Kaydet", en: "Save Route", ar: "حفظ المسار" },
  noRoutes: { tr: "Henüz rota tanımlanmadı", en: "No routes defined yet", ar: "لم يتم تحديد مسارات بعد" },
  selectMachine: { tr: "Makine seçin...", en: "Select machine...", ar: "اختر الآلة..." },

  // ---- Sevkiyat ----
  shipment: { tr: "Sevkiyat", en: "Shipment", ar: "الشحن" },
  inProductionSection: { tr: "Üretimde", en: "In Production", ar: "قيد الإنتاج" },
  readyToShipSection: { tr: "Sevkiyata Hazır", en: "Ready to Ship", ar: "جاهز للشحن" },
  currentLocation: { tr: "Şu an", en: "Currently at", ar: "حاليًا في" },
  markShipped: { tr: "Teslim Edildi Olarak İşaretle", en: "Mark as Delivered", ar: "وضع علامة تم التسليم" },
  noOrdersInProduction: { tr: "Üretimde sipariş yok", en: "No orders in production", ar: "لا توجد طلبات قيد الإنتاج" },
  noOrdersReady: { tr: "Sevkiyata hazır sipariş yok", en: "No orders ready to ship", ar: "لا توجد طلبات جاهزة للشحن" },
  readyBadge: { tr: "SEVKİYATA HAZIR", en: "READY TO SHIP", ar: "جاهز للشحن" },

  // ---- Verimlilik (gerçek hesaplamalar) ----
  efficiency: { tr: "Verimlilik", en: "Efficiency", ar: "الكفاءة" },
  efficiencyDesc: { tr: "Aşağıdaki hesaplamalar gerçek üretim/duruş/sipariş verinizden anlık olarak hesaplanır — örnek veri değildir.", en: "The calculations below are computed live from your real production/downtime/order data — not sample data.", ar: "الحسابات أدناه محسوبة مباشرة من بياناتك الحقيقية." },
  bottleneckTitle: { tr: "Darboğaz — Makine Başına Bekleyen İş", en: "Bottleneck — Pending Work per Machine", ar: "عنق الزجاجة" },
  bottleneckDesc: { tr: "Her makinenin önünde, henüz tamamlanmamış aşamalardaki toplam bekleyen adet. En yüksek olan, hattın gerçek kısıtıdır.", en: "Total pending units across incomplete stages for each machine. The highest is the real constraint of the line.", ar: "إجمالي العمل المعلق لكل آلة." },
  noBottleneckData: { tr: "Henüz aktif sipariş aşaması yok", en: "No active order stages yet", ar: "لا توجد مراحل نشطة بعد" },
  terminPanelTab: { tr: "Termin Hesaplama", en: "Due Date Calc", ar: "حساب الموعد" },
  terminPanelDesc: { tr: "Smart production and logistics management dashboard", en: "Smart production and logistics management dashboard", ar: "لوحة إدارة الإنتاج والخدمات اللوجستية الذكية" },
  terminRemainingStages: { tr: "Kalan Aşamalar", en: "Remaining Stages", ar: "المراحل المتبقية" },
  terminTotalRemaining: { tr: "Toplam kalan süre", en: "Total remaining time", ar: "الوقت المتبقي الإجمالي" },
  terminNoOrders: { tr: "Bekleyen sipariş yok", en: "No pending orders", ar: "لا توجد طلبات معلقة" },
  terminAllDone: { tr: "Tüm aşamalar tamamlandı", en: "All stages completed", ar: "اكتملت جميع المراحل" },
  terminCapacityTitle: { tr: "Kapasite / Hat Durumu", en: "Capacity / Line Status", ar: "السعة / حالة الخط" },
  liveStatus: { tr: "Live Status", en: "Live Status", ar: "الحالة المباشرة" },
  downtimeParetoTitle: { tr: "Duruş Nedenleri — Pareto", en: "Downtime Reasons — Pareto", ar: "أسباب التوقف — باريتو" },
  downtimeParetoDesc: { tr: "Kayıtlı duruşların toplam süresine göre sıralanmış nedenler (sadece süresi kaydedilen duruşlar dahildir).", en: "Downtime reasons ranked by total recorded duration.", ar: "أسباب التوقف مرتبة حسب المدة الإجمالية." },
  noDowntimeData: { tr: "Henüz süresi kaydedilmiş duruş yok", en: "No downtime with recorded duration yet", ar: "لا توجد بيانات توقف بعد" },
  riskTitle: { tr: "Termin Riski — Gereken Hız vs Gerçek Hız", en: "Delivery Risk — Required vs Actual Rate", ar: "خطر التسليم" },
  riskDesc: { tr: "Kalan adet / kalan iş günü = gereken hız. Tatil ve mesai istisnaları (Takvim sekmesi) hesaba katılır. Bu siparişe ait geçmiş üretim kayıtlarından hesaplanan gerçek hızla karşılaştırılır.", en: "Remaining qty / remaining working days = required rate (calendar exceptions are taken into account), compared with the actual rate from this order's production logs.", ar: "الكمية المتبقية / أيام العمل المتبقية." },
  noRiskData: { tr: "Aktif sipariş yok", en: "No active orders", ar: "لا توجد طلبات نشطة" },
  requiredRate: { tr: "Gereken Hız", en: "Required Rate", ar: "المعدل المطلوب" },
  actualRate: { tr: "Gerçek Hız", en: "Actual Rate", ar: "المعدل الفعلي" },
  perDay: { tr: "adet/iş günü", en: "units/workday", ar: "وحدة/يوم عمل" },
  noProductionLogYet: { tr: "Bu sipariş için henüz üretim kaydı yok", en: "No production log for this order yet", ar: "لا يوجد سجل إنتاج لهذا الطلب بعد" },
  onTrack: { tr: "YETİŞİYOR", en: "ON TRACK", ar: "على المسار" },
  atRisk: { tr: "RİSKLİ", en: "AT RISK", ar: "في خطر" },
  daysLeft: { tr: "iş günü kaldı", en: "working days left", ar: "أيام عمل متبقية" },
  overdue: { tr: "TESLİM TARİHİ GEÇTİ", en: "OVERDUE", ar: "متأخر" },

  // ---- QR İzlenebilirlik ----
  qrTitle: { tr: "Ürün İzlenebilirlik QR", en: "Product Traceability QR", ar: "رمز QR للتتبع" },
  qrGenerate: { tr: "QR Oluştur", en: "Generate QR", ar: "إنشاء QR" },
  qrHint: { tr: "Etiket yazıcısından bastırıp ürüne/palete yapıştırın. Okutulduğunda bu sayfanın izlenebilirlik görünümü açılır (giriş yapmış olmanız gerekir).", en: "Print and attach to the product/pallet. Scanning opens this order's traceability view (login required).", ar: "اطبع والصق على المنتج." },
  qrClose: { tr: "Kapat", en: "Close", ar: "إغلاق" },
  traceTitle: { tr: "Üretim Geçmişi", en: "Production History", ar: "سجل الإنتاج" },
  traceVerified: { tr: "Sistem Tarafından Doğrulandı", en: "Verified by System", ar: "موثق من النظام" },
  traceBack: { tr: "Geri Dön", en: "Go Back", ar: "رجوع" },
  traceEmptyHistory: { tr: "Henüz üretim kaydı yok", en: "No production records yet", ar: "لا توجد سجلات إنتاج بعد" },

  // ---- Sipariş Tamamlama Onayı ----
  completeAndApprove: { tr: "Siparişi Onayla ve Gönder", en: "Approve & Send Order", ar: "الموافقة وإرسال الطلب" },
  confirmCompleteTitle: { tr: "Sipariş Tamamlandı", en: "Order Complete", ar: "اكتمل الطلب" },
  confirmCompleteDesc: { tr: "için hedef miktara ulaşıldı:", en: "reached its target quantity:", ar: "وصل إلى الكمية المستهدفة:" },
  confirmCompleteNext: { tr: "Onaylarsanız bu aşama tamamlanmış sayılır ve sipariş rotadaki bir sonraki makineye geçer.", en: "Approving marks this stage complete and moves the order to the next machine in its route.", ar: "الموافقة تنهي هذه المرحلة وتنقل الطلب للمرحلة التالية." },
  orderCompletedToast: { tr: "Sipariş onaylandı, sonraki makineye gönderildi", en: "Order approved and sent to the next machine", ar: "تمت الموافقة على الطلب وإرساله" },
  orderQtyReached: { tr: "Hedef miktara ulaşıldı — onaylayıp sonraki makineye gönderin", en: "Target quantity reached — approve to send to the next machine", ar: "تم الوصول إلى الكمية المستهدفة" },
  stageStatusReadOnlyHint: { tr: "Durum, üretilen adetten otomatik hesaplanır (Usta Modu'ndan veya yandaki adet alanından değiştirin)", en: "Status is derived automatically from produced quantity (change it via Usta Mode or the quantity field)", ar: "تُحسب الحالة تلقائيًا من الكمية المنتجة" },
  stageManualEditHint: { tr: "Adet alanını elle değiştirmek gerçek bir düzeltmedir: stok tüketimini ve durumu da otomatik günceller.", en: "Manually editing the quantity is a real correction: it also updates stock consumption and status automatically.", ar: "تعديل الكمية يدويًا تصحيح حقيقي: يحدّث استهلاك المخزون والحالة تلقائيًا." },

  // ---- Çok Kalemli Sipariş Formu ----
  newOrderForm: { tr: "Yeni Sipariş Formu", en: "New Order Form", ar: "نموذج طلب جديد" },
  formNo: { tr: "Form No (opsiyonel)", en: "Form No (optional)", ar: "رقم النموذج (اختياري)" },
  formDate: { tr: "Form Tarihi", en: "Form Date", ar: "تاريخ النموذج" },
  orderDueDate: { tr: "Teslim Tarihi", en: "Due Date", ar: "تاريخ التسليم" },
  formItemsTitle: { tr: "Kalemler (Modeller)", en: "Line Items (Models)", ar: "البنود (الموديلات)" },
  addLineItem: { tr: "Kalem Ekle", en: "Add Line Item", ar: "إضافة بند" },
  createOrderForm: { tr: "Siparişi Oluştur", en: "Create Order", ar: "إنشاء الطلب" },
  formLabel: { tr: "Form:", en: "Form:", ar: "نموذج:" },

  // ---- Kanban ----
  kanbanTitle: { tr: "Kanban", en: "Kanban", ar: "كانبان" },
  kanbanDesc: { tr: "Her sipariş, o an aktif olduğu departmanın sütununda görünür. Bir karta tıklayarak izlenebilirlik sayfasını açabilirsiniz.", en: "Each order appears in the column of its currently active department. Click a card to open its traceability page.", ar: "يظهر كل طلب في عمود القسم النشط حاليًا." },
  kanbanEmptyColumn: { tr: "Bu departmanda bekleyen sipariş yok", en: "No pending orders in this department", ar: "لا توجد طلبات معلقة في هذا القسم" },

  // ---- Çalışma Takvimi ----
  calendarTitle: { tr: "Çalışma Takvimi", en: "Work Calendar", ar: "تقويم العمل" },
  calendarDesc: { tr: "Hafta sonu mesaisi veya hafta içi resmi tatil gibi istisnai günleri burada tanımlayın. Termin Riski hesaplaması bu günleri otomatik dikkate alır.", en: "Define exceptional days here, like weekend shifts or weekday holidays. Delivery risk calculations automatically account for these.", ar: "حدد الأيام الاستثنائية هنا." },
  exceptionDate: { tr: "Tarih", en: "Date", ar: "التاريخ" },
  exceptionType: { tr: "Gün Türü", en: "Day Type", ar: "نوع اليوم" },
  workingDay: { tr: "Mesai Günü (çalışılıyor)", en: "Working Day", ar: "يوم عمل" },
  nonWorkingDay: { tr: "Tatil (çalışılmıyor)", en: "Holiday (not working)", ar: "عطلة" },
  exceptionDesc: { tr: "Açıklama (opsiyonel)", en: "Description (optional)", ar: "الوصف (اختياري)" },
  addException: { tr: "Ekle", en: "Add", ar: "إضافة" },
  noExceptions: { tr: "Henüz istisnai gün tanımlanmadı — varsayılan olarak hafta içi çalışılır, hafta sonu tatildir.", en: "No exceptions defined yet — by default weekdays are working days and weekends are holidays.", ar: "لم يتم تحديد استثناءات بعد." },

  // ---- Sevkiyat / Lojistik ----
  shipOutTitle: { tr: "Sevkiyat Çıkışı Yap", en: "Process Shipment", ar: "معالجة الشحنة" },
  logisticsCompany: { tr: "Lojistik Firması", en: "Logistics Company", ar: "شركة الخدمات اللوجستية" },
  vehiclePlate: { tr: "Araç Plakası", en: "Vehicle Plate", ar: "لوحة المركبة" },
  driverName: { tr: "Şoför Adı Soyadı", en: "Driver Name", ar: "اسم السائق" },
  driverPhone: { tr: "Şoför Telefonu", en: "Driver Phone", ar: "هاتف السائق" },
  waybillNo: { tr: "İrsaliye No", en: "Waybill No", ar: "رقم بوليصة الشحن" },
  shippedQty: { tr: "Gönderilen Miktar", en: "Shipped Quantity", ar: "الكمية المشحونة" },
  confirmShipment: { tr: "Sevkiyatı Onayla", en: "Confirm Shipment", ar: "تأكيد الشحنة" },
  shipmentRecords: { tr: "Sevkiyat Kayıtları", en: "Shipment Records", ar: "سجلات الشحن" },
  searchShipments: { tr: "Plaka veya şoför adına göre ara...", en: "Search by plate or driver name...", ar: "بحث بلوحة المركبة أو اسم السائق..." },
  noShipments: { tr: "Henüz sevkiyat kaydı yok", en: "No shipment records yet", ar: "لا توجد سجلات شحن بعد" },
  exportShipments: { tr: "Excel'e Aktar", en: "Export to Excel", ar: "تصدير إلى Excel" },
  requiredField: { tr: "Bu alan zorunlu", en: "This field is required", ar: "هذا الحقل مطلوب" },

  // ---- Yönetici Geri Al (Undo) ----
  undoTitle: { tr: "Son İşlemler / Geri Al", en: "Recent Actions / Undo", ar: "الإجراءات الأخيرة / تراجع" },
  undoDesc: { tr: "Ustaların üretim/aşama girişlerinde hata olduysa, sadece yönetici burada geri alabilir. Geri alma, tüketilen stoğu da geri yükler.", en: "If there was an error in a foreman's production entry, only a manager can undo it here. Undoing also restores any consumed stock.", ar: "يمكن للمدير فقط التراجع هنا." },
  noUndoEntries: { tr: "Geri alınabilecek yakın zamanlı bir işlem yok", en: "No recent actions to undo", ar: "لا توجد إجراءات حديثة للتراجع" },
  undoButton: { tr: "Geri Al", en: "Undo", ar: "تراجع" },
  undoConfirm: { tr: "Bu işlemi geri almak istediğinizden emin misiniz?", en: "Are you sure you want to undo this action?", ar: "هل أنت متأكد من التراجع؟" },
  undoneToast: { tr: "İşlem geri alındı", en: "Action undone", ar: "تم التراجع عن الإجراء" },

  navGroupProduction: { tr: "Üretim", en: "Production", ar: "الإنتاج" },
  navGroupMaterial: { tr: "Malzeme", en: "Materials", ar: "المواد" },
  navGroupAnalysis: { tr: "Analiz", en: "Analysis", ar: "التحليل" },
  navGroupSystem: { tr: "Sistem", en: "System", ar: "النظام" },

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
// KİMLİK DOĞRULAMA (Supabase Auth)
// Roller: "operator" (varsayılan, yeni kayıt olan herkes), "usta",
// "yonetici", "admin". Yönetici Modu'na sadece yonetici/admin girebilir.
// Yeni kullanıcı rolünü değiştirmek için Supabase Dashboard > Table
// Editor > profiles tablosundan "role" alanını elle güncelleyin
// (ör. "yonetici" veya "admin" yazın).
// =================================================================
const MANAGER_ROLES = ["yonetici", "admin"];

function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = henüz kontrol edilmedi
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session) { setProfile(null); return; }
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) { setProfile(data); setProfileLoading(false); }
      });
    return () => { cancelled = true; };
  }, [session]);

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }
  async function signUp(email, password, fullName) {
    return supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  }
  async function signOut() {
    await supabase.auth.signOut();
  }

  return {
    session, profile, signIn, signUp, signOut,
    loading: session === undefined || (!!session && profileLoading && profile === null),
  };
}

function AuthTextField({ label, type = "text", value, onChange }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, borderRadius: 10,
          padding: "11px 12px", color: COLORS.text, fontFamily: "'Inter', sans-serif", fontSize: 14,
          outline: "none",
        }}
      />
    </div>
  );
}

function LoginScreen({ lang, dir, setLang, onSignIn, onSignUp }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    try {
      if (isSignUp) {
        const { error: err } = await onSignUp(email, password, fullName);
        if (err) setError(err.message);
        else { setInfo(t("signUpSuccess", lang)); setIsSignUp(false); }
      } else {
        const { error: err } = await onSignIn(email, password);
        if (err) setError(t("loginError", lang));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={dir} style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <FontImports />
      <div style={{ width: "100%", maxWidth: 380 }}>
        <ErdoorLogo height={52} style={{ marginBottom: 22 }} />
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 26 }}>
          {LANGUAGES.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} style={{
              padding: "7px 14px", borderRadius: 99, cursor: "pointer",
              border: `1px solid ${lang === l.code ? COLORS.brand : COLORS.border}`,
              background: lang === l.code ? COLORS.brandDim : "transparent",
              color: lang === l.code ? COLORS.brand : COLORS.textDim,
              fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600,
            }}>
              {l.label}
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textFaint, letterSpacing: 3, textTransform: "uppercase" }}>
            {t("appTitle", lang)}
          </div>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 24, color: COLORS.text, marginTop: 6 }}>
            {isSignUp ? t("signUp", lang) : t("loginTitle", lang)}
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {isSignUp && <AuthTextField label={t("fullName", lang)} value={fullName} onChange={setFullName} />}
          <AuthTextField label={t("email", lang)} type="email" value={email} onChange={setEmail} />
          <AuthTextField label={t("password", lang)} type="password" value={password} onChange={setPassword} />
          {error && <div style={{ color: COLORS.accentStop, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{error}</div>}
          {info && <div style={{ color: COLORS.accentRun, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{info}</div>}
          <BigButton variant="brand" disabled={busy} style={{ padding: "14px 20px", justifyContent: "center" }}>
            {isSignUp ? t("signUp", lang) : t("signIn", lang)}
          </BigButton>
        </form>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            onClick={() => { setIsSignUp((v) => !v); setError(null); setInfo(null); }}
            style={{ background: "none", border: "none", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
          >
            {isSignUp ? t("haveAccount", lang) : t("noAccountYet", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// ERDOOR AHŞAP KOMPOZİT KAPI — gerçek üretim akışı
// Kaynak: ERDOOR Üretim Prosesi ve Teknik Bilgiler sunumu + gerçek
// extruder planlama tablosu. Üç bölüm var: Extruder, Laminasyon, Deck.
// Her bölümün kendi makineleri ve kendi ürün/profil kataloğu var.
// Her makine için günlük takvim (hangi makine bugün ne üretiyor)
// tutulur. Ayrıca ayrı bir Sipariş takibi vardır (müşteri, miktar,
// teslim tarihi, teslim durumu) — bu, takvimden bağımsız çalışır.
// =================================================================

const DEFAULT_DEPARTMENTS = [
  {
    id: "extruder",
    name: "Extruder (Kompozit Profil)",
    machines: [
      { code: "MK-EX1", name: "1 Nolu Extruder" },
      { code: "MK-EX2", name: "2 Nolu Extruder" },
      { code: "MK-EX3", name: "3 Nolu Extruder" },
      { code: "MK-EX4", name: "4 Nolu Extruder" },
      { code: "MK-EX5", name: "5 Nolu Extruder" },
      { code: "MK-EX6", name: "6 Nolu Extruder" },
      { code: "MK-EX7", name: "7 Nolu Extruder" },
      { code: "MK-EX8", name: "8 Nolu Extruder" },
      { code: "MK-EX9", name: "9 Nolu Extruder" },
    ],
    products: [
      "PERVAZ 35*80", "PERVAZ 50*80", "PERVAZ 80*80", "PERVAZ 35*100", "PERVAZ 35*150",
      "KASA 70 mm", "KASA 100 mm", "KASA 120 mm", "KASA 140 mm", "KASA 160 mm", "KASA 200 mm", "KASA 220 mm",
      "K.SEREN", "KOMPOZİT U PROFİLİ", "CAM ÇITASI", "BİNİ ÇITASI",
    ],
  },
  {
    id: "laminasyon",
    name: "Laminasyon (Kasa/Pervaz Kaplama)",
    machines: [
      { code: "MK-FOL", name: "Folyo Dilimleme" },
      { code: "MK-LAM1", name: "Laminasyon Hattı 1" },
      { code: "MK-LAM2", name: "Laminasyon Hattı 2" },
      { code: "MK-KE", name: "Kasa Ebatlama (45° Kesim)" },
    ],
    products: [
      "PERVAZ 35*80", "PERVAZ 50*80", "PERVAZ 80*80", "PERVAZ 35*100", "PERVAZ 35*150",
      "KASA 70 mm", "KASA 100 mm", "KASA 120 mm", "KASA 140 mm", "KASA 160 mm", "KASA 200 mm", "KASA 220 mm",
    ],
  },
  {
    id: "deck",
    name: "Deck (Zemin Döşeme Profili)",
    machines: [
      { code: "MK-DECK1", name: "Deck Extruder Hattı 1" },
      { code: "MK-DECK2", name: "Deck Extruder Hattı 2" },
      { code: "MK-DECKFIR", name: "Deck Fırçalama" },
      { code: "MK-DECKKES", name: "Deck Boy Kesim" },
    ],
    products: [
      "DECK 140x26 Fındık Kahve", "DECK 140x26 Antrasit", "DECK 140x26 Krem",
      "DECK 145x22 Fındık Kahve", "DECK 145x22 Antrasit", "DECK 145x22 Krem",
    ],
  },
];

// Kanat (kapı) üretim bölümü — Excel'e Aktar ve makine durumu için
// hâlâ izlenir ama günlük profil takvimine bağlı değil, sipariş bazlı
// kalıyor (kapı modelleri burada işlenir).
const KANAT_MACHINES = [
  { code: "MK-RC", name: "Geri Dönüşüm (Kırma/Öğütme)" },
  { code: "MK-MX", name: "Mikser (Hammadde Karışım)" },
  { code: "MK-KUR", name: "Kereste Kurutma Fırını" },
  { code: "MK-DIL", name: "Çoklu Dilimleme / Budak Kesme" },
  { code: "MK-FJ", name: "Fingerjoint Hattı" },
  { code: "MK-RAB", name: "Rabıta Makinesi (Seren Bitirme)" },
  { code: "MK-SER", name: "Seren Çakım (Kanat İskelet)" },
  { code: "MK-PVC", name: "PVC Levha Vakum Presi" },
  { code: "MK-CNC", name: "CNC (Model/Cam Yeri İşleme)" },
  { code: "MK-SP", name: "Soğuk Pres Hattı (9 pres)" },
  { code: "MK-HP", name: "Sıcak Pres" },
  { code: "MK-EB", name: "Ebatlama Makinesi" },
  { code: "MK-KB", name: "Kenar Bantlama Hattı" },
  { code: "MK-KIL", name: "Kilit/Rozet Delme İstasyonu" },
  { code: "MK-KAL", name: "Kalite Kontrol & Paketleme" },
];

// Tüm makineler tek bir düz liste olarak da gerekiyor (Usta Modu makine
// seçimi, anlık durum ekranı, Excel raporu — departman ayrımına
// bakmadan tüm fabrikayı gösterir).
function allMachinesFrom(departments) {
  return [
    ...departments.flatMap((d) => d.machines.map((m) => ({ ...m, departmentId: d.id }))),
    ...KANAT_MACHINES.map((m) => ({ ...m, departmentId: "kanat" })),
  ];
}

const DEFAULT_MACHINES = allMachinesFrom(DEFAULT_DEPARTMENTS);

// ER Serisi kapı model kataloğu — Kanat üretiminde kullanılan modeller,
// dolgu tipine göre referans gruplaması (Tanımlar sayfasında gösterilir).
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

// Tüm bölümlerin tüm ürünleri tek listede — sipariş girerken "hangi
// ürün" seçimi buradan yapılır (Extruder/Laminasyon/Deck profilleri +
// Kanat'taki ER kapı modelleri).
function allProductsFrom(departments) {
  const fromDepts = departments.flatMap((d) => d.products);
  const erModels = Object.values(ER_MODEL_CATALOG).flat();
  return [...new Set([...fromDepts, ...erModels])];
}

// Sipariş durumu sabitleri
// PENDING: üretimde, DELIVERED: sevk edildi/kapandı,
// READY: tüm aşamalar bitti, sevkiyat bekliyor (otomatik olarak buraya düşer)
const ORDER_STATUS = { PENDING: "bekliyor", READY: "sevkiyata_hazir", DELIVERED: "teslim_edildi" };

const STAGE_STATUS = { WAITING: "bekliyor", RUNNING: "uretimde", DONE: "tamamlandi" };

// Bir siparişin "şu an sırada olan" aşaması: ilk tamamlanmamış aşama.
// Usta Modu'nda bir makine seçildiğinde, o makineye sırası gelmiş siparişler
// bu fonksiyonla bulunur (önceki aşamalar bitmeden sıradaki aşama gösterilmez).
function currentOrderStage(order) {
  return (order.asamalar || []).find((s) => s.durum !== STAGE_STATUS.DONE) || null;
}

const DEFAULT_ORDERS = [
  {
    id: "SIP-101", urun: "ER100", musteri: "Akpınar İnşaat", miktar: 240, teslimTarihi: "2026-06-29", durum: ORDER_STATUS.PENDING,
    asamalar: [
      { id: "AS1", makine: "MK-RC", durum: STAGE_STATUS.DONE, cikan: 240 },
      { id: "AS2", makine: "MK-MX", durum: STAGE_STATUS.DONE, cikan: 240 },
      { id: "AS3", makine: "MK-KUR", durum: STAGE_STATUS.DONE, cikan: 240 },
      { id: "AS4", makine: "MK-SER", durum: STAGE_STATUS.RUNNING, cikan: 150 },
      { id: "AS5", makine: "MK-CNC", durum: STAGE_STATUS.WAITING, cikan: 0 },
      { id: "AS6", makine: "MK-KAL", durum: STAGE_STATUS.WAITING, cikan: 0 },
    ],
  },
  {
    id: "SIP-102", urun: "KASA 100 mm", musteri: "Boran Yapı Market", miktar: 500, teslimTarihi: "2026-06-26", durum: ORDER_STATUS.PENDING,
    asamalar: [
      { id: "AS1", makine: "MK-EX2", durum: STAGE_STATUS.DONE, cikan: 500 },
      { id: "AS2", makine: "MK-FOL", durum: STAGE_STATUS.DONE, cikan: 500 },
      { id: "AS3", makine: "MK-LAM1", durum: STAGE_STATUS.RUNNING, cikan: 320 },
      { id: "AS4", makine: "MK-KE", durum: STAGE_STATUS.WAITING, cikan: 0 },
    ],
  },
  {
    id: "SIP-103", urun: "DECK 140x26 Antrasit", musteri: "Meriç AVM Projesi", miktar: 300, teslimTarihi: "2026-07-03", durum: ORDER_STATUS.PENDING,
    asamalar: [
      { id: "AS1", makine: "MK-DECK1", durum: STAGE_STATUS.DONE, cikan: 300 },
      { id: "AS2", makine: "MK-DECKFIR", durum: STAGE_STATUS.RUNNING, cikan: 180 },
      { id: "AS3", makine: "MK-DECKKES", durum: STAGE_STATUS.WAITING, cikan: 0 },
    ],
  },
];

// =================================================================
// STOK / HAMMADDE + SATIN ALMA — varsayılan veriler ve durum sabitleri
// =================================================================
const DEFAULT_STOCK = [
  { id: "STK-001", name: "PVC Granül", unit: "kg", qty: 2400, criticalLevel: 500 },
  { id: "STK-002", name: "Cam (4mm Temperli)", unit: "m2", qty: 180, criticalLevel: 50 },
  { id: "STK-003", name: "Menteşe Seti", unit: "adet", qty: 640, criticalLevel: 100 },
  { id: "STK-004", name: "Conta (EPDM)", unit: "m", qty: 900, criticalLevel: 200 },
  { id: "STK-005", name: "Tutkal", unit: "kg", qty: 320, criticalLevel: 80 },
];

// Ürün Rotaları / Reçeteleri: her ürünün hangi makinelerden sırayla geçtiği
// ve her aşamada hangi malzemeden ne kadar tükettiği. Yönetici tarafından
// "Rota / Reçete" sekmesinden tanımlanır. Yapı:
// { id, productName, stages: [ { machine: "MK-EX2", consumables: [{ stockItemId, qtyPerUnit }] } ] }
const DEFAULT_PRODUCT_ROUTES = [];

const PURCHASE_STATUS = {
  PENDING: "bekliyor",
  APPROVED: "onaylandi",
  ORDERED: "siparis_verildi",
  RECEIVED: "teslim_alindi",
};
const PURCHASE_STATUS_ORDER = [PURCHASE_STATUS.PENDING, PURCHASE_STATUS.APPROVED, PURCHASE_STATUS.ORDERED, PURCHASE_STATUS.RECEIVED];
function purchaseStatusLabel(status, lang) {
  const key = {
    [PURCHASE_STATUS.PENDING]: "purchaseStatusPending",
    [PURCHASE_STATUS.APPROVED]: "purchaseStatusApproved",
    [PURCHASE_STATUS.ORDERED]: "purchaseStatusOrdered",
    [PURCHASE_STATUS.RECEIVED]: "purchaseStatusReceived",
  }[status];
  return key ? t(key, lang) : status;
}

// Usta Modu makine seçim ekranında bölüm başlıkları için.
const DEPARTMENT_GROUPS = [
  { id: "extruder", label: (lang) => ({ tr: "Extruder", en: "Extruder", ar: "البثق" }[lang] || "Extruder") },
  { id: "laminasyon", label: (lang) => ({ tr: "Laminasyon", en: "Lamination", ar: "التصفيح" }[lang] || "Laminasyon") },
  { id: "deck", label: (lang) => ({ tr: "Deck", en: "Deck", ar: "ديك" }[lang] || "Deck") },
  { id: "kanat", label: (lang) => ({ tr: "Kanat (Kapı) Üretimi", en: "Door Leaf Production", ar: "إنتاج ورقة الباب" }[lang] || "Kanat Üretimi") },
];

// ---------------- Takvim/Plan yardımcıları ----------------
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function isWeekend(d) {
  const dow = new Date(d).getDay();
  return dow === 0 || dow === 6;
}
// Takvim istisnalarını (tatil/mesai) hesaba katarak iki tarih arasındaki
// GERÇEK çalışma günü sayısını hesaplar. exceptions: { "YYYY-MM-DD": {isWorkingDay, description} }
function workingDaysBetween(fromDate, toDate, exceptions) {
  if (toDate <= fromDate) return 0;
  let count = 0;
  const cur = new Date(fromDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    const iso = isoDate(cur);
    const exc = exceptions?.[iso];
    const isWorking = exc ? exc.isWorkingDay : !isWeekend(cur);
    if (isWorking) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function fmtPlanDate(iso, lang) {
  const d = new Date(iso + "T00:00:00");
  const locale = lang === "ar" ? "ar" : lang === "en" ? "en-US" : "tr-TR";
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", weekday: "short" });
}
// Plan key formatı: "plan:YYYY-MM-DD:MAKINEKODU" -> { profile: string }
function planKey(dateIso, machineCode) {
  return `plan:${dateIso}:${machineCode}`;
}
// Hücre değeri eski formatta düz string (sadece profil) olabilir veya
// yeni formatta {profile, orderId} objesi olabilir — ikisini de okur.
function normalizeCell(cell) {
  if (!cell) return null;
  if (typeof cell === "string") return { profile: cell, orderId: null };
  return cell;
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
    brand: { background: COLORS.brand, borderColor: COLORS.brand, color: "#fff" },
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

// ERDOOR marka logosu — dosya, projenin `public/` klasöründe `logo.png`
// olarak durmalı (Vite statik dosyaları oradan `/logo.png` yoluyla sunar).
function ErdoorLogo({ height = 40, style }) {
  return (
    <img
      src="/logo.png"
      alt="ERDOOR"
      style={{ height, display: "block", margin: "0 auto", ...style }}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}

function FontImports() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body { margin: 0; padding: 0; height: 100%; background: ${COLORS.bg}; overscroll-behavior-y: none; }
      #root { min-height: 100%; background: ${COLORS.bg}; }
    `}</style>
  );
}

// =================================================================
// VERİ KATMANI — tüm uygulamanın paylaştığı state
// Storage keys: "machines", "plan" (tüm takvim tek nesnede), 
// "machine-state:<code>", "log"
// =================================================================

function useSharedData() {
  const [departments, setDepartments] = useState(null);
  const [machines, setMachines] = useState(null); // derived flat list, kept for backward-compat use sites
  const [orders, setOrders] = useState(null);
  const [plan, setPlanState] = useState({}); // { "YYYY-MM-DD": { MAKINEKODU: "profil" } }
  const [machineStates, setMachineStates] = useState({});
  const [log, setLog] = useState([]);
  const [stock, setStockState] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [purchaseRequests, setPurchaseRequestsState] = useState(null);
  const [productRoutes, setProductRoutesState] = useState(null);
  const [shipments, setShipmentsState] = useState(null);
  const [calendarExceptions, setCalendarExceptionsState] = useState(null);
  const [undoLog, setUndoLogState] = useState([]);
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
      const [dep, ord, p, l, sk, skMoves, pr, routes, ships, calExc, undo] = await Promise.all([
        loadShared("departments", DEFAULT_DEPARTMENTS),
        loadShared("orders", DEFAULT_ORDERS),
        loadShared("plan", {}),
        loadShared("log", []),
        loadShared("stock", DEFAULT_STOCK),
        loadShared("stock-movements", []),
        loadShared("purchase-requests", []),
        loadShared("product-routes", DEFAULT_PRODUCT_ROUTES),
        loadShared("shipments", []),
        loadShared("calendar-exceptions", {}),
        loadShared("undo-log", []),
      ]);
      const m = allMachinesFrom(dep);
      const stateEntries = await Promise.all(
        m.map((mach) => loadShared(`machine-state:${mach.code}`, { status: "idle" }).then((s) => [mach.code, s]))
      );
      const states = Object.fromEntries(stateEntries);

      setDepartments(dep);
      setMachines(m);
      setOrders(ord);
      setPlanState(p);
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
      setStockState(sk);
      setStockMovements((prev) => (prev.length >= skMoves.length ? prev : skMoves));
      setPurchaseRequestsState(pr);
      setProductRoutesState(routes);
      setShipmentsState(ships);
      setCalendarExceptionsState(calExc);
      setUndoLogState(undo);
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

  // Bölüm + makine listesini güncelle (ekleme/çıkarma dahil).
  async function updateDepartments(newDepartments) {
    setDepartments(newDepartments);
    setMachines(allMachinesFrom(newDepartments));
    await saveShared("departments", newDepartments);
  }

  const ordersRef = useRef(orders);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  async function updateOrders(newOrders) {
    ordersRef.current = newOrders;
    setOrders(newOrders);
    await saveShared("orders", newOrders);
  }
  async function addOrder(order) {
    const newOrders = [...(ordersRef.current || []), order];
    await updateOrders(newOrders);
  }
  async function removeOrder(orderId) {
    const newOrders = (ordersRef.current || []).filter((o) => o.id !== orderId);
    await updateOrders(newOrders);
  }
  async function markOrderDelivered(orderId, delivered) {
    const newOrders = (ordersRef.current || []).map((o) => {
      if (o.id !== orderId) return o;
      if (delivered) return { ...o, durum: ORDER_STATUS.DELIVERED };
      const stages = o.asamalar || [];
      const allDone = stages.length > 0 && stages.every((s) => s.durum === STAGE_STATUS.DONE);
      return { ...o, durum: allDone ? ORDER_STATUS.READY : ORDER_STATUS.PENDING };
    });
    await updateOrders(newOrders);
  }
  async function addOrderStage(orderId, machineCode) {
    if (!machineCode) return;
    const newOrders = (ordersRef.current || []).map((o) => {
      if (o.id !== orderId) return o;
      const stages = o.asamalar || [];
      const newStage = { id: `AS${Date.now().toString().slice(-6)}`, makine: machineCode, durum: STAGE_STATUS.WAITING, cikan: 0 };
      return { ...o, asamalar: [...stages, newStage] };
    });
    await updateOrders(newOrders);
  }
  async function removeOrderStage(orderId, stageId) {
    const newOrders = (ordersRef.current || []).map((o) =>
      o.id === orderId ? { ...o, asamalar: (o.asamalar || []).filter((s) => s.id !== stageId) } : o
    );
    await updateOrders(newOrders);
  }
  // Bir aşamanın üretilen adedini/durumunu günceller. cikan değiştiğinde:
  // 1) Aşama durumu otomatik türetilir (0 -> bekliyor, miktar'a ulaşınca -> tamamlandı)
  // 2) Ürünün rotasında bu makine için tanımlı malzemeler otomatik stoktan düşer
  // 3) Siparişin TÜM aşamaları tamamlandıysa, sipariş otomatik "sevkiyata hazır" olur
  async function updateOrderStage(orderId, stageId, patch) {
    const order = (ordersRef.current || []).find((o) => o.id === orderId);
    if (!order) return;
    const stage = (order.asamalar || []).find((s) => s.id === stageId);
    if (!stage) return;

    const prevCikan = stage.cikan || 0;
    const prevDurum = stage.durum;
    let merged = { ...stage, ...patch };
    let consumedForUndo = [];

    if (patch.cikan !== undefined) {
      const newCikan = Math.max(0, patch.cikan);
      merged.cikan = newCikan;
      merged.durum = newCikan <= 0 ? STAGE_STATUS.WAITING
        : newCikan >= (order.miktar || 0) ? STAGE_STATUS.DONE
        : STAGE_STATUS.RUNNING;

      const delta = newCikan - prevCikan;
      if (delta > 0) {
        const route = (routesRef.current || []).find((r) => r.productName === order.urun);
        const routeStage = route?.stages?.find((rs) => rs.machine === stage.makine);
        if (routeStage?.consumables?.length) {
          for (const c of routeStage.consumables) {
            const qty = Number(c.qtyPerUnit) || 0;
            if (qty > 0) {
              await adjustStockQty(c.stockItemId, -qty * delta, `Otomatik tüketim: ${order.urun} — ${stage.makine} (${order.id})`);
              consumedForUndo.push({ stockItemId: c.stockItemId, qty: qty * delta });
            }
          }
        }
      }
      // Yönetici "Geri Al" panelinde görünecek kayıt — bu değişikliği
      // öncekine döndürebilmek için gereken tüm bilgiyi tutar.
      await pushUndoEntry({
        id: `UNDO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
        time: Date.now(), orderId, stageId, urun: order.urun, machine: stage.makine,
        prevCikan, prevDurum, newCikan, newDurum: merged.durum, consumed: consumedForUndo,
      });
    }

    const newOrders = (ordersRef.current || []).map((o) => {
      if (o.id !== orderId) return o;
      const stages = (o.asamalar || []).map((s) => (s.id === stageId ? merged : s));
      const allDone = stages.length > 0 && stages.every((s) => s.durum === STAGE_STATUS.DONE);
      const durum = allDone && o.durum === ORDER_STATUS.PENDING ? ORDER_STATUS.READY : o.durum;
      return { ...o, asamalar: stages, durum };
    });
    await updateOrders(newOrders);
  }

  const planRef = useRef(plan);
  useEffect(() => { planRef.current = plan; }, [plan]);

  // Tek bir gün/makine hücresini günceller (Yönetici takvimde bir hücre düzenlediğinde).
  // cellValue: null/"" -> hücreyi temizle, ya da { profile, orderId } objesi.
  async function setPlanCell(dateIso, machineCode, cellValue) {
    const day = { ...(planRef.current[dateIso] || {}) };
    if (cellValue && cellValue.profile) day[machineCode] = cellValue;
    else delete day[machineCode];
    const newPlan = { ...planRef.current, [dateIso]: day };
    planRef.current = newPlan;
    setPlanState(newPlan);
    await saveShared("plan", newPlan);
  }

  // ---------------- Stok / Hammadde ----------------
  const stockRef = useRef(stock);
  useEffect(() => { stockRef.current = stock; }, [stock]);
  const movesRef = useRef(stockMovements);
  useEffect(() => { movesRef.current = stockMovements; }, [stockMovements]);

  async function appendStockMovement(entry) {
    const newMoves = [entry, ...movesRef.current].slice(0, 200);
    movesRef.current = newMoves;
    setStockMovements(newMoves);
    await saveShared("stock-movements", newMoves);
  }

  async function updateStock(newStock) {
    stockRef.current = newStock;
    setStockState(newStock);
    await saveShared("stock", newStock);
  }
  async function addStockItem(item) {
    const newStock = [...(stockRef.current || []), item];
    await updateStock(newStock);
  }
  async function removeStockItem(id) {
    const newStock = (stockRef.current || []).filter((s) => s.id !== id);
    await updateStock(newStock);
  }
  // delta pozitifse giriş, negatifse çıkış. Her ayarlama hareket kaydı bırakır.
  //
  // NOT — EŞZAMANLILIK (RACE CONDITION) SINIRI:
  // Bu fonksiyon "oku → hesapla → yaz" şeklinde çalışıyor. İki kullanıcı
  // AYNI ANDA aynı malzemeyi güncellerse (örn. iki usta aynı saniyede
  // üretimi bitirirse), teorik olarak biri diğerinin güncellemesinin
  // üzerine yazabilir (lost update). Küçük/orta trafik için risk düşüktür
  // ama tamamen ortadan kaldırmak için atomik bir Postgres RPC fonksiyonu
  // gerekir. Bunun hazır bir şablonu `supabase_migration_v3_race_condition_
  // template.sql` dosyasında duruyor — devreye almak isterseniz bu
  // fonksiyonun içini `supabase.rpc('adjust_stock_atomic', { item_id: id, delta })`
  // çağrısıyla değiştirmemiz yeterli (şu an bağlı değil, bilinçli olarak).
  async function adjustStockQty(id, delta, reason) {
    const current = (stockRef.current || []).find((s) => s.id === id);
    if (!current) return;
    const newQty = Math.max(0, (current.qty || 0) + delta);
    const newStock = (stockRef.current || []).map((s) => (s.id === id ? { ...s, qty: newQty } : s));
    await updateStock(newStock);
    await appendStockMovement({
      time: new Date().toISOString(), itemId: id, itemName: current.name,
      delta, reason: reason || "", resultingQty: newQty,
    });

    // Kritik seviyenin altına düştüyse ve bu malzeme için zaten açık (teslim
    // alınmamış) bir talep yoksa, otomatik bir satın alma talebi oluştur.
    const critical = current.criticalLevel || 0;
    if (newQty <= critical) {
      const hasOpenRequest = (purchaseRef.current || []).some(
        (r) => r.stockItemId === id && r.status !== PURCHASE_STATUS.RECEIVED
      );
      if (!hasOpenRequest) {
        const suggestedQty = Math.max(critical * 2 - newQty, critical || 10, 10);
        await addPurchaseRequest({
          id: `PO-${Date.now().toString().slice(-6)}`,
          stockItemId: id, itemName: current.name, unit: current.unit,
          qty: Math.round(suggestedQty),
          note: "Kritik seviyenin altına düşüldüğü için otomatik oluşturuldu.",
          status: PURCHASE_STATUS.PENDING,
          requestedBy: "Sistem (Otomatik)",
          date: new Date().toISOString(),
          auto: true,
        });
      }
    }
  }

  // ---------------- Satın Alma ----------------
  const purchaseRef = useRef(purchaseRequests);
  useEffect(() => { purchaseRef.current = purchaseRequests; }, [purchaseRequests]);

  async function updatePurchaseRequests(newList) {
    purchaseRef.current = newList;
    setPurchaseRequestsState(newList);
    await saveShared("purchase-requests", newList);
  }
  async function addPurchaseRequest(reqItem) {
    const newList = [reqItem, ...(purchaseRef.current || [])];
    await updatePurchaseRequests(newList);
  }
  async function removePurchaseRequest(id) {
    const newList = (purchaseRef.current || []).filter((r) => r.id !== id);
    await updatePurchaseRequests(newList);
  }
  // Durumu ilerletir; "teslim_alindi" durumuna geçince ilgili stok kalemine
  // otomatik giriş yapar (stok kaydı varsa).
  async function advancePurchaseStatus(id, newStatus) {
    const reqItem = (purchaseRef.current || []).find((r) => r.id === id);
    if (!reqItem) return;
    const newList = (purchaseRef.current || []).map((r) => (r.id === id ? { ...r, status: newStatus } : r));
    await updatePurchaseRequests(newList);
    if (newStatus === PURCHASE_STATUS.RECEIVED && reqItem.stockItemId) {
      await adjustStockQty(reqItem.stockItemId, Number(reqItem.qty) || 0, `Satın alma teslim alındı (${reqItem.id})`);
    }
  }

  // ---------------- Ürün Rotaları / Reçeteleri ----------------
  const routesRef = useRef(productRoutes);
  useEffect(() => { routesRef.current = productRoutes; }, [productRoutes]);

  async function updateProductRoutes(newRoutes) {
    routesRef.current = newRoutes;
    setProductRoutesState(newRoutes);
    await saveShared("product-routes", newRoutes);
  }
  async function addProductRoute(route) {
    const withoutSameProduct = (routesRef.current || []).filter((r) => r.productName !== route.productName);
    await updateProductRoutes([...withoutSameProduct, route]);
  }
  async function removeProductRoute(id) {
    const newRoutes = (routesRef.current || []).filter((r) => r.id !== id);
    await updateProductRoutes(newRoutes);
  }

  // ---------------- Sevkiyat / Lojistik ----------------
  const shipmentsRef = useRef(shipments);
  useEffect(() => { shipmentsRef.current = shipments; }, [shipments]);

  async function updateShipments(newList) {
    shipmentsRef.current = newList;
    setShipmentsState(newList);
    await saveShared("shipments", newList);
  }
  async function addShipment(shipment) {
    await updateShipments([shipment, ...(shipmentsRef.current || [])]);
  }
  async function removeShipment(id) {
    await updateShipments((shipmentsRef.current || []).filter((s) => s.id !== id));
  }

  // ---------------- Dinamik Çalışma / Tatil Takvimi ----------------
  const calendarRef = useRef(calendarExceptions);
  useEffect(() => { calendarRef.current = calendarExceptions; }, [calendarExceptions]);

  async function updateCalendarExceptions(newMap) {
    calendarRef.current = newMap;
    setCalendarExceptionsState(newMap);
    await saveShared("calendar-exceptions", newMap);
  }
  // isWorkingDay=true  -> istisnai mesai günü (örn. hafta sonu çalışılıyor)
  // isWorkingDay=false -> istisnai tatil günü (örn. hafta içi resmi tatil)
  async function setCalendarException(dateIso, isWorkingDay, description) {
    const newMap = { ...(calendarRef.current || {}), [dateIso]: { isWorkingDay, description: description || "" } };
    await updateCalendarExceptions(newMap);
  }
  async function removeCalendarException(dateIso) {
    const newMap = { ...(calendarRef.current || {}) };
    delete newMap[dateIso];
    await updateCalendarExceptions(newMap);
  }

  // ---------------- Yönetici "Geri Al" (Undo) günlüğü ----------------
  const undoLogRef = useRef(undoLog);
  useEffect(() => { undoLogRef.current = undoLog; }, [undoLog]);

  async function pushUndoEntry(entry) {
    const newLog = [entry, ...(undoLogRef.current || [])].slice(0, 25);
    undoLogRef.current = newLog;
    setUndoLogState(newLog);
    await saveShared("undo-log", newLog);
  }
  // Sadece Yönetici Modu'ndan çağrılır (bkz. UndoPanel). Aşamayı ve varsa
  // o an tüketilen stok miktarlarını geri yükler; sipariş kademesini
  // (READY/PENDING) yeniden hesaplar.
  async function undoAction(entryId) {
    const entry = (undoLogRef.current || []).find((e) => e.id === entryId);
    if (!entry) return;
    const order = (ordersRef.current || []).find((o) => o.id === entry.orderId);
    if (order) {
      const stages = (order.asamalar || []).map((s) =>
        s.id === entry.stageId ? { ...s, cikan: entry.prevCikan, durum: entry.prevDurum } : s
      );
      const allDone = stages.length > 0 && stages.every((s) => s.durum === STAGE_STATUS.DONE);
      const durum = order.durum === ORDER_STATUS.READY && !allDone ? ORDER_STATUS.PENDING : order.durum;
      const newOrders = (ordersRef.current || []).map((o) => (o.id === order.id ? { ...o, asamalar: stages, durum } : o));
      await updateOrders(newOrders);
    }
    // Bu işlemle tüketilen malzemeleri geri yükle (varsa)
    for (const c of entry.consumed || []) {
      await adjustStockQty(c.stockItemId, c.qty, `Geri alma (${entry.id}) — ${entry.orderId}`);
    }
    const newLog = (undoLogRef.current || []).filter((e) => e.id !== entryId);
    undoLogRef.current = newLog;
    setUndoLogState(newLog);
    await saveShared("undo-log", newLog);
  }

  return {
    departments, machines, orders, plan, machineStates, log, loading,
    stock, stockMovements, purchaseRequests, productRoutes,
    shipments, calendarExceptions, undoLog,
    refresh, setMachineState, appendLog, updateDepartments, setPlanCell, setPolling,
    addOrder, removeOrder, markOrderDelivered, addOrderStage, removeOrderStage, updateOrderStage, updateOrders,
    addStockItem, removeStockItem, adjustStockQty,
    addPurchaseRequest, removePurchaseRequest, advancePurchaseStatus,
    addProductRoute, removeProductRoute,
    addShipment, removeShipment,
    setCalendarException, removeCalendarException,
    undoAction,
  };
}

// =================================================================
// USTA MODU
// =================================================================

function UstaMode({ data, onBack, lang, dir }) {
  const now = useNow();
  const { machines, plan, machineStates, setMachineState, appendLog, setPolling, orders, updateOrderStage } = data;
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
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
  // Şu an üretilen sipariş ve "sipariş miktarına ulaşıldı mı" kontrolü —
  // ulaşıldıysa normal "durdur" akışı yerine usta onayı istenir.
  const runningOrder = state?.orderId ? (orders || []).find((o) => o.id === state.orderId) : null;
  const orderComplete = !!(runningOrder && (state?.produced || 0) >= (runningOrder.miktar || Infinity));
  const backIcon = dir === "rtl" ? { transform: "rotate(180deg)" } : {};
  const todayIso = isoDate(now);
  const todaysCell = selectedMachine ? normalizeCell((plan[todayIso] || {})[selectedMachine.code]) : null;
  const linkedOrder = todaysCell?.orderId ? (data.orders || []).find((o) => o.id === todaysCell.orderId) : null;

  // Bu makinede sırası gelmiş (bir önceki aşamaları tamamlanmış, bu makinedeki
  // aşaması henüz bitmemiş) siparişler — usta birden çok sipariş arasından seçer.
  const machineOrders = selectedMachine
    ? (orders || [])
        .filter((o) => o.durum !== ORDER_STATUS.DELIVERED)
        .map((o) => ({ order: o, stage: currentOrderStage(o) }))
        .filter((x) => x.stage && x.stage.makine === selectedMachine.code)
    : [];
  const selectedEntry = selectedOrderId ? machineOrders.find((x) => x.order.id === selectedOrderId) : null;

  async function pickMachine(m) {
    setSelectedMachine(m);
    setSelectedOrderId(null);
  }

  async function startProduction() {
    const newState = {
      status: "run", profile: todaysCell?.profile || "—", orderId: todaysCell?.orderId || null, stageId: null,
      startedAt: Date.now(), produced: 0,
    };
    await setMachineState(selectedMachine.code, newState);
  }

  async function startProductionForOrder() {
    if (!selectedEntry) return;
    const { order, stage } = selectedEntry;
    const newState = {
      status: "run", profile: order.urun, orderId: order.id, stageId: stage.id,
      startedAt: Date.now(), produced: stage.cikan || 0,
    };
    await setMachineState(selectedMachine.code, newState);
    if (stage.durum !== STAGE_STATUS.RUNNING) {
      await updateOrderStage(order.id, stage.id, { durum: STAGE_STATUS.RUNNING });
    }
  }

  async function adjustProduced(delta) {
    const cap = runningOrder ? (runningOrder.miktar || Infinity) : Infinity;
    const newProduced = Math.min(cap, Math.max(0, (state.produced || 0) + delta));
    const newState = { ...state, produced: newProduced };
    await setMachineState(selectedMachine.code, newState);
  }

  // Sipariş miktarı tamamlandığında (örn. 500/500) çağrılır. Bu bir "duruş"
  // değildir — makine boşta kalır ve sipariş, rotaya göre bir sonraki
  // makinenin kuyruğuna otomatik düşer (updateOrderStage zaten bunu yapıyor).
  async function completeOrderNow() {
    await appendLog({
      time: Date.now(), type: "üretim", machine: selectedMachine.code,
      label: `${state.produced} adet · ${state.profile} · ${state.orderId} (tamamlandı, onaylandı)`,
      detail: { qty: state.produced, profile: state.profile, orderId: state.orderId || null, stageId: state.stageId || null, durationMs: Date.now() - state.startedAt },
    });
    if (state.orderId && state.stageId) {
      await updateOrderStage(state.orderId, state.stageId, { cikan: state.produced });
    }
    await setMachineState(selectedMachine.code, { status: "idle" });
    setConfirmingStop(false);
    setSelectedOrderId(null);
    showToast(t("orderCompletedToast", lang));
  }

  async function confirmStop() {
    await appendLog({
      time: Date.now(), type: "üretim", machine: selectedMachine.code,
      label: state.orderId ? `${state.produced} adet · ${state.profile} · ${state.orderId}` : `${state.produced} adet · ${state.profile}`,
      detail: { qty: state.produced, profile: state.profile, orderId: state.orderId || null, stageId: state.stageId || null, durationMs: Date.now() - state.startedAt },
    });
    if (state.orderId && state.stageId) {
      await updateOrderStage(state.orderId, state.stageId, { cikan: state.produced });
    }
    await setMachineState(selectedMachine.code, { status: "down_pending", prevProfile: state.profile, prevProduced: state.produced, startedAt: Date.now() });
    setConfirmingStop(false);
    setSelectedOrderId(null);
    showToast(`${state.produced} ${t("unitsSaved", lang)}`);
  }

  async function pickDowntimeReason(reason) {
    // Canonical label stored is always Turkish; UI resolves translation by id.
    // Duruşun ne zaman başladığı machine state'teki startedAt alanında tutuluyor
    // (confirmStop / önceki duruş anında set edilir) — süreyi buradan hesaplıyoruz.
    const downtimeMs = state?.startedAt ? Date.now() - state.startedAt : null;
    await appendLog({
      time: Date.now(), type: "duruş", machine: selectedMachine.code, label: reason.label,
      detail: { reason: reason.label, durationMs: downtimeMs },
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
          onClick={() => {
            if (selectedOrderId) { setSelectedOrderId(null); return; }
            if (selectedMachine) { setSelectedMachine(null); return; }
            onBack();
          }}
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
          {DEPARTMENT_GROUPS.map((group) => {
            const groupMachines = machines.filter((m) => m.departmentId === group.id);
            if (groupMachines.length === 0) return null;
            return (
              <div key={group.id} style={{ marginBottom: 22 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
                  {group.label(lang)}
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {groupMachines.map((m) => {
                    const st = machineStates[m.code] || { status: "idle" };
                    const dot = st.status === "run" ? COLORS.accentRun : st.status === "down_pending" ? COLORS.accentWarn : COLORS.accentIdle;
                    const profileToday = normalizeCell((plan[todayIso] || {})[m.code])?.profile;
                    const pendingCount = (orders || [])
                      .filter((o) => o.durum !== ORDER_STATUS.DELIVERED)
                      .map((o) => currentOrderStage(o))
                      .filter((s) => s && s.makine === m.code).length;
                    return (
                      <BigButton key={m.code} onClick={() => pickMachine(m)} style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 99, background: dot, flexShrink: 0 }} />
                          <span style={{ display: "flex", flexDirection: "column", alignItems: dir === "rtl" ? "flex-end" : "flex-start" }}>
                            <span style={{ fontFamily: "'Archivo', sans-serif", fontSize: 18 }}>{m.code}</span>
                            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: COLORS.textDim }}>{m.name}</span>
                            {pendingCount > 0 ? (
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.accentRun, marginTop: 2 }}>{pendingCount} {t("orders", lang)}</span>
                            ) : profileToday && (
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.accentWarn, marginTop: 2 }}>{profileToday}</span>
                            )}
                          </span>
                        </span>
                        <ChevronLeft size={20} style={{ transform: dir === "rtl" ? "none" : "rotate(180deg)", color: COLORS.textDim }} />
                      </BigButton>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedMachine && state.status === "idle" && machineOrders.length > 0 && !selectedEntry && (
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 22, color: COLORS.text, marginBottom: 18 }}>
            {t("myOrdersOnMachine", lang)}
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {machineOrders.map(({ order, stage }) => {
              const stageIdx = (order.asamalar || []).findIndex((s) => s.id === stage.id);
              return (
                <BigButton key={order.id} onClick={() => setSelectedOrderId(order.id)} style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: dir === "rtl" ? "flex-end" : "flex-start", gap: 3 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.accentWarn }}>{order.id}</span>
                      <span style={{ fontFamily: "'Archivo', sans-serif", fontSize: 17 }}>{order.urun}</span>
                    </span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12.5, color: COLORS.textDim }}>
                      {order.musteri} · {stageIdx + 1}/{(order.asamalar || []).length} {t("stageProgress", lang)} · {stage.cikan}/{order.miktar} {t("units", lang)}
                      {order.teslimTarihi && ` · ${t("due", lang)} ${fmtDateShort(order.teslimTarihi)}`}
                    </span>
                  </span>
                  <ChevronLeft size={20} style={{ transform: dir === "rtl" ? "none" : "rotate(180deg)", color: COLORS.textDim, flexShrink: 0 }} />
                </BigButton>
              );
            })}
          </div>
        </div>
      )}

      {selectedMachine && state.status === "idle" && selectedEntry && (
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 22, color: COLORS.text, marginBottom: 18 }}>
            {t("workingOnOrder", lang)}
          </div>
          <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.accentWarn }}>{selectedEntry.order.id}</span>
              <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 22, color: COLORS.text }}>{selectedEntry.order.urun}</span>
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, marginTop: 6 }}>
              {selectedEntry.order.musteri} · {selectedEntry.order.miktar} {t("units", lang)}
              {selectedEntry.order.teslimTarihi && ` · ${t("due", lang)} ${fmtDateShort(selectedEntry.order.teslimTarihi)}`}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.text, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
              {((order) => {
                const idx = (order.asamalar || []).findIndex((s) => s.id === selectedEntry.stage.id);
                return `${idx + 1}/${(order.asamalar || []).length} ${t("stageProgress", lang)}`;
              })(selectedEntry.order)} · <span style={{ color: COLORS.accentWarn, fontWeight: 700 }}>{selectedEntry.stage.cikan}/{selectedEntry.order.miktar} {t("units", lang)}</span>
            </div>
          </div>
          <BigButton onClick={startProductionForOrder} variant="run" style={{ padding: "20px 0", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Play size={20} fill="currentColor" /> {t("startProduction", lang)}
          </BigButton>
        </div>
      )}

      {selectedMachine && state.status === "idle" && machineOrders.length === 0 && (
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 22, color: COLORS.text, marginBottom: 18 }}>
            {t("todaysPlan", lang)}
          </div>
          <div style={{ background: COLORS.accentStopDim, border: `1px solid ${COLORS.accentStop}30`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>
            {t("noOrdersOnMachine", lang)}
          </div>
          {todaysCell ? (
            <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22, marginBottom: 18 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textFaint, marginBottom: 4 }}>{fmtPlanDate(todayIso, lang)}</div>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 22, color: COLORS.accentWarn }}>{todaysCell.profile}</div>
              {linkedOrder && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, marginTop: 8 }}>
                  {t("producingForOrder", lang)}: <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.text }}>{linkedOrder.id}</span> · {linkedOrder.musteri} · {linkedOrder.miktar} {t("units", lang)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: COLORS.accentStopDim, border: `1px solid ${COLORS.accentStop}40`, borderRadius: 16, padding: 22, marginBottom: 18 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.text }}>{t("noPlanToday", lang)}</div>
            </div>
          )}
          <BigButton onClick={startProduction} variant="run" style={{ padding: "20px 0", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Play size={20} fill="currentColor" /> {t("startProduction", lang)}
          </BigButton>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textDim }}>{t("producingProfile", lang)}</div>
              {state.orderId && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.accentWarn }}>{state.orderId}</span>
              )}
            </div>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text }}>
              {state.profile}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.textDim }}>{t("producedQty", lang)}</div>
              {runningOrder && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: orderComplete ? COLORS.accentRun : COLORS.textFaint }}>
                  {state.produced} / {runningOrder.miktar}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <BigButton onClick={() => adjustProduced(-1)} style={{ width: 56, height: 56, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>−</BigButton>
              <div style={{
                flex: 1, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 36, fontWeight: 700, color: COLORS.text,
                background: COLORS.bgPanel, border: `1px solid ${orderComplete ? COLORS.accentRun : COLORS.border}`, borderRadius: 14, padding: "10px 0",
              }}>
                {state.produced}
              </div>
              <BigButton onClick={() => adjustProduced(1)} variant="run" disabled={orderComplete} style={{ width: 56, height: 56, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center", opacity: orderComplete ? 0.4 : 1 }}>+</BigButton>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[10, 25, 50].map((n) => (
                <BigButton key={n} onClick={() => adjustProduced(n)} disabled={orderComplete} style={{ flex: 1, padding: "10px 0", fontSize: 14, opacity: orderComplete ? 0.4 : 1 }}>+{n}</BigButton>
              ))}
            </div>
            {orderComplete && (
              <div style={{ marginTop: 10, fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.accentRun, textAlign: "center" }}>
                {t("orderQtyReached", lang)}
              </div>
            )}
          </div>

          <BigButton onClick={() => setConfirmingStop(true)} variant={orderComplete ? "run" : "stop"} style={{ padding: "20px 0", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {orderComplete ? <Check size={20} /> : <Square size={20} fill="currentColor" />}
            {orderComplete ? t("completeAndApprove", lang) : t("stopProduction", lang)}
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
              {orderComplete ? t("confirmCompleteTitle", lang) : t("confirmStopTitle", lang)}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.textDim, marginBottom: 18 }}>
              {orderComplete ? (
                <>{state.profile} {t("confirmCompleteDesc", lang)} <strong style={{ color: COLORS.text }}>{state.produced} {t("units", lang)}</strong>. {t("confirmCompleteNext", lang)}</>
              ) : (
                <>{state.profile} {t("confirmStopFor", lang)} <strong style={{ color: COLORS.text }}>{state.produced} {t("units", lang)}</strong> {t("unitsWillBeSaved", lang)}</>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <BigButton onClick={() => setConfirmingStop(false)} variant="ghost" style={{ flex: 1, padding: "16px 0" }}>{t("cancel", lang)}</BigButton>
              <BigButton onClick={orderComplete ? completeOrderNow : confirmStop} variant={orderComplete ? "run" : "stop"} style={{ flex: 1, padding: "16px 0" }}>
                {orderComplete ? t("approve", lang) : t("stop", lang)}
              </BigButton>
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

function exportToExcel({ machines, plan, machineStates, log, orders }) {
  const wb = XLSX.utils.book_new();
  const now = new Date();
  const todayIso = isoDate(now);

  // Sayfa 1: Anlık Makine Durumu
  const statusRows = machines.map((m) => {
    const st = machineStates[m.code] || { status: "idle" };
    const elapsedMin = st.startedAt ? Math.round((Date.now() - st.startedAt) / 60000) : "";
    return {
      "Makine Kodu": m.code,
      "Makine Adı": m.name,
      "Durum": st.status === "run" ? "Üretimde" : st.status === "down_pending" ? "Duruşta" : "Boşta",
      "Bugünkü Plan": (plan[todayIso] || {})[m.code] || "",
      "Üretilen Adet": st.status === "run" ? (st.produced || 0) : "",
      "Geçen Süre (dk)": elapsedMin,
    };
  });
  const wsStatus = XLSX.utils.json_to_sheet(statusRows);
  wsStatus["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsStatus, "Anlık Durum");

  // Sayfa 2: Üretim Planı (Takvim) — tarih satırları, makine sütunları,
  // tıpkı gerçek extruder planlama tablonuzdaki format.
  const planDates = Object.keys(plan).sort();
  const planRows = planDates.map((dateIso) => {
    const row = { "Tarih": new Date(dateIso + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" }) };
    const isHoliday = isWeekend(dateIso);
    machines.forEach((m) => {
      row[m.code] = isHoliday ? "TATİL" : (plan[dateIso][m.code] || "");
    });
    return row;
  });
  const wsPlan = XLSX.utils.json_to_sheet(planRows);
  wsPlan["!cols"] = [{ wch: 28 }, ...machines.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, wsPlan, "Üretim Planı");

  // Sayfa 3: Siparişler
  const orderRows = (orders || []).map((o) => {
    const stages = o.asamalar || [];
    const doneCount = stages.filter((s) => s.durum === STAGE_STATUS.DONE).length;
    const active = stages.find((s) => s.durum === STAGE_STATUS.RUNNING) || stages.find((s) => s.durum === STAGE_STATUS.WAITING);
    return {
      "Sipariş No": o.id, "Ürün": o.urun, "Müşteri": o.musteri,
      "Miktar": o.miktar, "Teslim Tarihi": o.teslimTarihi,
      "Aşama İlerlemesi": stages.length ? `${doneCount}/${stages.length}` : "",
      "Şu Anki Aşama": active ? active.makine : (stages.length ? "Tamamlandı" : ""),
      "Durum": o.durum === ORDER_STATUS.DELIVERED ? "Teslim Edildi" : "Bekliyor",
    };
  });
  const wsOrders = XLSX.utils.json_to_sheet(orderRows);
  wsOrders["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsOrders, "Siparişler");

  // Sayfa 3b: Sipariş Aşamaları (detay) — her siparişin her aşaması ayrı satır.
  const stageRows = (orders || []).flatMap((o) =>
    (o.asamalar || []).map((s, idx) => {
      const mach = machines.find((m) => m.code === s.makine);
      return {
        "Sipariş No": o.id, "Ürün": o.urun, "Aşama Sırası": idx + 1,
        "Makine Kodu": s.makine, "Makine Adı": mach ? mach.name : "",
        "Durum": s.durum === STAGE_STATUS.DONE ? "Tamamlandı" : s.durum === STAGE_STATUS.RUNNING ? "Üretimde" : "Bekliyor",
        "Çıkan Adet": s.cikan, "Sipariş Miktarı": o.miktar,
      };
    })
  );
  const wsStages = XLSX.utils.json_to_sheet(stageRows);
  wsStages["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsStages, "Sipariş Aşamaları");

  // Sayfa 4: Makineler
  const machineRows = machines.map((m) => ({ "Makine Kodu": m.code, "Makine Adı": m.name }));
  const wsMachines = XLSX.utils.json_to_sheet(machineRows);
  wsMachines["!cols"] = [{ wch: 12 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsMachines, "Makineler");

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

function MachineCard({ machine, state, profileToday, now, onClick, lang, dir }) {
  const meta = statusMeta(state.status, lang);
  const elapsed = state.startedAt ? now - state.startedAt : null;

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

      {state.status === "run" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: COLORS.text }}>{state.profile}</span>
            {state.orderId && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.accentWarn }}>{state.orderId}</span>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: COLORS.accentRun }}>{state.produced || 0} {t("units", lang)}</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint }}>
              {fmtDurationShort(elapsed)} {t("workingFor", lang)}
            </span>
          </div>
        </>
      )}

      {state.status === "down_pending" && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: COLORS.accentStop }}>
          {fmtDurationShort(elapsed)} {t("waitingFor", lang)} · {t("reasonPending", lang)}
        </div>
      )}

      {state.status === "idle" && (
        profileToday ? (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim }}>
            <span style={{ color: COLORS.textFaint }}>{t("todaysPlan", lang)}: </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.accentWarn }}>{profileToday}</span>
          </div>
        ) : (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textFaint }}>{t("noAssignedOrder", lang)}</div>
        )
      )}
    </button>
  );
}

function YoneticiMode({ data, onBack, lang, dir, profile }) {
  const now = useNow(2000);
  const { machines, plan, machineStates, log, refresh, orders, setPolling } = data;
  const [tab, setTab] = useState("durum");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openNavGroups, setOpenNavGroups] = useState({ uretim: true, malzeme: true, analiz: true, sistem: true });
  const todayIso = isoDate(now);

  // Sekmeler tek düz liste yerine anlamlı 4 gruba ayrılmış: Üretim, Malzeme,
  // Analiz, Sistem. Her grup açılır/kapanır; aktif sekmenin grubu her zaman
  // açık başlar (bkz. useEffect aşağıda).
  const NAV_GROUPS = [
    { id: "uretim", labelKey: "navGroupProduction", tabs: [
      { id: "durum", labelKey: "status" },
      { id: "kanban", labelKey: "kanbanTitle" },
      { id: "plan", labelKey: "productionPlan" },
      { id: "takvim", labelKey: "calendarTitle" },
    ]},
    { id: "malzeme", labelKey: "navGroupMaterial", tabs: [
      { id: "stok", labelKey: "stok" },
      { id: "satinalma", labelKey: "purchasing" },
      { id: "rota", labelKey: "routes" },
    ]},
    { id: "analiz", labelKey: "navGroupAnalysis", tabs: [
      { id: "termin", labelKey: "terminPanelTab" },
      { id: "verimlilik", labelKey: "efficiency" },
      { id: "sevkiyat", labelKey: "shipment" },
    ]},
    { id: "sistem", labelKey: "navGroupSystem", tabs: [
      { id: "geri-al", labelKey: "undoTitle" },
      { id: "ayarlar", labelKey: "settings" },
    ]},
  ];

  // Tanımlar ve Plan sekmelerinde form/girdi düzenlemesi var; arka plan
  // yenilemesi (4s) bu sekmelerde yerel state'i ezip yazılanı kaybettirebilir.
  // Sadece "durum" salt-okunur olduğu için orada canlı kalmasında sakınca yok.
  useEffect(() => {
    setPolling(tab === "durum");
    return () => setPolling(true);
  }, [tab, setPolling]);

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
            onClick={() => setSidebarOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, color: COLORS.text, cursor: "pointer", padding: "8px 10px", borderRadius: 10 }}
          >
            <Menu size={15} />
          </button>
          <button
            onClick={() => exportToExcel({ machines, plan, machineStates, log, orders })}
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

      {/* Sol taraftan açılan gizli menü */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 30 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "absolute", top: 0, [dir === "rtl" ? "right" : "left"]: 0, height: "100%", width: 250,
            background: COLORS.bgPanel, borderRight: dir === "rtl" ? "none" : `1px solid ${COLORS.border}`,
            borderLeft: dir === "rtl" ? `1px solid ${COLORS.border}` : "none",
            padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 16px" }}>
              <ErdoorLogo height={22} style={{ margin: 0 }} />
              <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            {NAV_GROUPS.map((group) => {
              const isOpen = !!openNavGroups[group.id];
              return (
                <div key={group.id} style={{ marginBottom: 2 }}>
                  <button
                    onClick={() => setOpenNavGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "none", border: "none", cursor: "pointer", padding: "9px 8px",
                      fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 11,
                      letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.textFaint,
                    }}
                  >
                    <span>{t(group.labelKey, lang)}</span>
                    <ChevronLeft size={12} style={{
                      transform: isOpen ? "rotate(-90deg)" : (dir === "rtl" ? "rotate(180deg)" : "rotate(0deg)"),
                      transition: "transform 0.18s ease", color: COLORS.textFaint,
                    }} />
                  </button>
                  {isOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {group.tabs.map((tabItem) => (
                        <button key={tabItem.id} onClick={() => { setTab(tabItem.id); setSidebarOpen(false); }} style={{
                          textAlign: dir === "rtl" ? "right" : "left", padding: "9px 12px 9px 16px", borderRadius: 9,
                          border: `1px solid ${tab === tabItem.id ? COLORS.accentRun : "transparent"}`,
                          background: tab === tabItem.id ? COLORS.accentRunDim : "transparent",
                          color: tab === tabItem.id ? COLORS.accentRun : COLORS.textDim,
                          fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                        }}>
                          {t(tabItem.labelKey, lang)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              {t("machines", lang)}
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
              {machines.map((m) => {
                const st = machineStates[m.code] || { status: "idle" };
                const profileToday = normalizeCell((plan[todayIso] || {})[m.code])?.profile;
                return <MachineCard key={m.code} machine={m} state={st} profileToday={profileToday} now={now} onClick={() => {}} lang={lang} dir={dir} />;
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

      {tab === "kanban" && <KanbanPanel data={data} lang={lang} dir={dir} />}

      {tab === "plan" && <PlanTakvimi data={data} lang={lang} dir={dir} />}

      {tab === "stok" && <StokPanel data={data} lang={lang} dir={dir} />}

      {tab === "satinalma" && <SatinAlmaPanel data={data} lang={lang} dir={dir} profile={profile} />}

      {tab === "rota" && <RotaPanel data={data} lang={lang} dir={dir} />}

      {tab === "termin" && <TerminPanel data={data} lang={lang} dir={dir} />}

      {tab === "sevkiyat" && <SevkiyatPanel data={data} lang={lang} dir={dir} />}

      {tab === "takvim" && <CalendarPanel data={data} lang={lang} dir={dir} />}

      {tab === "geri-al" && <UndoPanel data={data} lang={lang} dir={dir} />}

      {tab === "verimlilik" && <VerimlilikPanel data={data} lang={lang} dir={dir} />}

      {tab === "ayarlar" && <TanimlarPanel data={data} lang={lang} dir={dir} />}
    </div>
  );
}

function PlanTakvimi({ data, lang, dir }) {
  const { departments, plan, setPlanCell, orders, setPolling } = data;
  const [activeDept, setActiveDept] = useState(departments?.[0]?.id || "extruder");
  const [daysToShow, setDaysToShow] = useState(14);
  const [savedMsg, setSavedMsg] = useState(null);
  const [editingCell, setEditingCell] = useState(null); // { dateIso, machine }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Hücre düzenleme modalı açıkken arka plan yenilemesi durur — aksi halde
  // 4 saniyelik otomatik yenileme, seçim yapılırken ekranı eski veriyle ezebilir.
  useEffect(() => {
    setPolling(!editingCell);
    return () => setPolling(true);
  }, [editingCell, setPolling]);

  if (!departments) return null;
  const dept = departments.find((d) => d.id === activeDept) || departments[0];
  const dates = Array.from({ length: daysToShow }, (_, i) => isoDate(addDays(today, i)));

  async function handleCellSave(dateIso, machineCode, cellValue) {
    await setPlanCell(dateIso, machineCode, cellValue);
    setSavedMsg(t("planSavedMsg", lang));
    setTimeout(() => setSavedMsg(null), 1200);
    setEditingCell(null);
  }

  return (
    <div style={{ padding: "18px 20px 60px" }}>
      <SavedToast text={savedMsg} />
      <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text, marginBottom: 4 }}>
        {t("productionPlan", lang)}
      </div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>
        {t("planNote", lang)}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {departments.map((d) => (
          <button key={d.id} onClick={() => setActiveDept(d.id)} style={{
            padding: "7px 14px", borderRadius: 10, border: `1px solid ${activeDept === d.id ? COLORS.accentRun : COLORS.border}`,
            background: activeDept === d.id ? COLORS.accentRunDim : "transparent",
            color: activeDept === d.id ? COLORS.accentRun : COLORS.textDim,
            fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}>
            {d.name}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "'Inter', sans-serif", fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{
                position: "sticky", left: 0, background: COLORS.bgPanel, color: COLORS.textDim,
                padding: "10px 14px", textAlign: dir === "rtl" ? "right" : "left", borderBottom: `1px solid ${COLORS.border}`,
                borderRight: `1px solid ${COLORS.border}`, whiteSpace: "nowrap", zIndex: 2,
              }}>
                {/* date column header */}
              </th>
              {dept.machines.map((m) => (
                <th key={m.code} style={{
                  background: COLORS.bgPanel, color: COLORS.text, padding: "10px 10px",
                  borderBottom: `1px solid ${COLORS.border}`, fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11.5, whiteSpace: "nowrap", minWidth: 140,
                }}>
                  {m.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((dateIso) => {
              const holiday = isWeekend(dateIso);
              const isToday = dateIso === isoDate(today);
              return (
                <tr key={dateIso} style={{ background: isToday ? COLORS.accentRunDim : "transparent" }}>
                  <td style={{
                    position: "sticky", left: 0, background: holiday ? "#26241c" : (isToday ? COLORS.accentRunDim : COLORS.bgPanel),
                    color: holiday ? COLORS.accentWarn : COLORS.textDim, padding: "8px 14px", whiteSpace: "nowrap",
                    borderBottom: `1px solid ${COLORS.border}`, borderRight: `1px solid ${COLORS.border}`,
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, zIndex: 1,
                  }}>
                    {fmtPlanDate(dateIso, lang)}
                  </td>
                  {dept.machines.map((m) => {
                    const cell = normalizeCell((plan[dateIso] || {})[m.code]);
                    const linkedOrder = cell?.orderId ? (orders || []).find((o) => o.id === cell.orderId) : null;
                    return (
                      <td key={m.code} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: 2 }}>
                        {holiday ? (
                          <div style={{ textAlign: "center", color: COLORS.accentWarn, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, padding: "8px 0" }}>
                            {t("holiday", lang)}
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCell({ dateIso, machine: m })}
                            style={{
                              width: "100%", background: "transparent", border: "none", outline: "none",
                              color: cell ? COLORS.text : COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 12,
                              padding: "8px 6px", textAlign: "center", cursor: "pointer", display: "flex",
                              flexDirection: "column", alignItems: "center", gap: 2,
                            }}
                          >
                            <span>{cell?.profile || "—"}</span>
                            {linkedOrder && (
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.accentWarn }}>
                                {linkedOrder.id}
                              </span>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setDaysToShow((d) => d + 7)}
        style={{
          marginTop: 14, display: "flex", alignItems: "center", gap: 6, background: COLORS.bgRaised,
          border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: "9px 14px", borderRadius: 10,
          fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer",
        }}
      >
        <Plus size={14} /> {t("addWeek", lang)}
      </button>

      {editingCell && (
        <PlanCellEditor
          dept={dept}
          dateIso={editingCell.dateIso}
          machine={editingCell.machine}
          currentCell={normalizeCell((plan[editingCell.dateIso] || {})[editingCell.machine.code])}
          orders={orders || []}
          lang={lang}
          onSave={(cellValue) => handleCellSave(editingCell.dateIso, editingCell.machine.code, cellValue)}
          onClose={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}

function PlanCellEditor({ dept, dateIso, machine, currentCell, orders, lang, onSave, onClose }) {
  const [profile, setProfile] = useState(currentCell?.profile || "");
  const [orderId, setOrderId] = useState(currentCell?.orderId || "");

  // Sadece bu ürüne uygun ve henüz teslim edilmemiş siparişler önerilir.
  const matchingOrders = orders.filter((o) => o.urun === profile && o.durum !== ORDER_STATUS.DELIVERED);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: COLORS.bgPanel, borderTop: `1px solid ${COLORS.border}`, borderRadius: "20px 20px 0 0",
        padding: "24px 22px 30px", width: "100%", maxWidth: 480,
      }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 18, color: COLORS.text, marginBottom: 4 }}>
          {machine.code} · {fmtPlanDate(dateIso, lang)}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textFaint, marginBottom: 18 }}>
          {machine.name}
        </div>

        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, marginBottom: 8 }}>
          {t("departmentProducts", lang)}
        </div>
        <select
          value={profile}
          onChange={(e) => { setProfile(e.target.value); setOrderId(""); }}
          style={{ ...inputStyle, marginBottom: 18, padding: "12px 10px" }}
        >
          <option value="">—</option>
          {dept.products.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {profile && (
          <>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, marginBottom: 8 }}>
              {t("linkToOrder", lang)}
            </div>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)} style={{ ...inputStyle, marginBottom: 18, padding: "12px 10px" }}>
              <option value="">{t("noOrderLink", lang)}</option>
              {matchingOrders.map((o) => (
                <option key={o.id} value={o.id}>{o.id} · {o.musteri} · {o.miktar} {t("units", lang)}</option>
              ))}
            </select>
            {matchingOrders.length === 0 && (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint, marginTop: -10, marginBottom: 18 }}>
                {t("noMatchingOrders", lang)}
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <BigButton onClick={onClose} variant="ghost" style={{ flex: 1, padding: "14px 0" }}>{t("cancel", lang)}</BigButton>
          <BigButton onClick={() => onSave(profile ? { profile, orderId: orderId || null } : null)} variant="run" style={{ flex: 1, padding: "14px 0" }}>{t("saved", lang)}</BigButton>
        </div>
      </div>
    </div>
  );
}


function TanimlarPanel({ data, lang, dir }) {
  const { departments, updateDepartments, orders, addOrder, removeOrder, markOrderDelivered, addOrderStage, removeOrderStage, updateOrderStage, productRoutes } = data;
  const [localDepartments, setLocalDepartments] = useState(departments);
  const [activeDept, setActiveDept] = useState(departments?.[0]?.id || "extruder");
  const [savedMsg, setSavedMsg] = useState(null);
  const [newProductText, setNewProductText] = useState("");
  const [orderForm, setOrderForm] = useState({ formNo: "", tarih: "", musteri: "", teslimTarihi: "" });
  const [formItems, setFormItems] = useState([{ urun: "", miktar: "", birim: "adet" }]);
  const [stagePickers, setStagePickers] = useState({}); // orderId -> selected machine code (draft, before "Ekle")

  useEffect(() => { setLocalDepartments(departments); }, [departments]);

  function flashSaved() {
    setSavedMsg(t("saved", lang));
    setTimeout(() => setSavedMsg(null), 1500);
  }

  async function saveDepartments(list) {
    setLocalDepartments(list);
    await updateDepartments(list);
    flashSaved();
  }

  if (!localDepartments) return null;
  const dept = localDepartments.find((d) => d.id === activeDept) || localDepartments[0];
  const deptIndex = localDepartments.findIndex((d) => d.id === dept.id);

  function updateDeptField(updater) {
    const list = [...localDepartments];
    list[deptIndex] = updater(list[deptIndex]);
    saveDepartments(list);
  }

  function addMachine() {
    updateDeptField((d) => ({
      ...d,
      machines: [...d.machines, { code: `MK-${d.id.toUpperCase().slice(0, 3)}${d.machines.length + 1}`, name: t("newMachine", lang) }],
    }));
  }
  function removeMachine(idx) {
    updateDeptField((d) => ({ ...d, machines: d.machines.filter((_, i) => i !== idx) }));
  }
  function editMachine(idx, field, value) {
    const list = [...localDepartments];
    const machines = [...list[deptIndex].machines];
    machines[idx] = { ...machines[idx], [field]: value };
    list[deptIndex] = { ...list[deptIndex], machines };
    setLocalDepartments(list); // local only while typing
  }
  function commitMachine() {
    saveDepartments(localDepartments);
  }

  function addProduct() {
    const name = newProductText.trim();
    if (!name) return;
    updateDeptField((d) => ({ ...d, products: [...d.products, name] }));
    setNewProductText("");
  }
  function removeProduct(product) {
    updateDeptField((d) => ({ ...d, products: d.products.filter((p) => p !== product) }));
  }

  // Sipariş ürün seçenekleri: tüm bölümlerin ürünleri + ER kapı modelleri.
  const allOrderProducts = allProductsFrom(localDepartments);
  // Sipariş makine seçenekleri: tüm bölümlerin makineleri + Kanat makineleri.
  const allOrderMachines = allMachinesFrom(localDepartments);

  // Gerçek sipariş formlarında (fotoğraftaki gibi) tek bir form numarası
  // altında birden fazla kalem (model/miktar/birim) olabiliyor. Her kalem,
  // kendi rotasında ayrı bir "sipariş" olarak izlenir ama hepsi aynı
  // formNo ile etiketlenip birlikte gruplanır.
  function addFormItemRow() {
    setFormItems([...formItems, { urun: "", miktar: "", birim: "adet" }]);
  }
  function removeFormItemRow(idx) {
    setFormItems(formItems.length > 1 ? formItems.filter((_, i) => i !== idx) : formItems);
  }
  function updateFormItemRow(idx, patch) {
    setFormItems(formItems.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  async function submitOrderForm() {
    const validItems = formItems.filter((it) => it.urun && it.miktar);
    if (validItems.length === 0) return;
    const sharedFormNo = orderForm.formNo || `FRM-${Date.now().toString().slice(-6)}`;
    for (const item of validItems) {
      const id = `SIP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
      const route = (productRoutes || []).find((r) => r.productName === item.urun);
      const asamalar = route
        ? route.stages.map((s, i) => ({ id: `AS${Date.now().toString().slice(-6)}${i}${Math.floor(Math.random() * 90)}`, makine: s.machine, durum: STAGE_STATUS.WAITING, cikan: 0 }))
        : [];
      await addOrder({
        id, urun: item.urun, musteri: orderForm.musteri || "—",
        miktar: parseInt(item.miktar) || 0, birim: item.birim || "adet",
        teslimTarihi: orderForm.teslimTarihi || "",
        formNo: sharedFormNo, formTarihi: orderForm.tarih || "",
        durum: ORDER_STATUS.PENDING, asamalar,
      });
    }
    setOrderForm({ formNo: "", tarih: "", musteri: "", teslimTarihi: "" });
    setFormItems([{ urun: "", miktar: "", birim: "adet" }]);
  }

  // NOT: Eskiden burada aşama durumunu doğrudan değiştiren (cikan'a
  // dokunmadan) bir "cycleStageStatus" fonksiyonu vardı. Bu, stok tüketimini,
  // usta onay akışını ve sipariş kademesini (READY) atlayarak veri
  // tutarsızlığına yol açıyordu. Kaldırıldı — durum artık SADECE aşağıdaki
  // "üretilen adet" alanı üzerinden (updateOrderStage → cikan) değişebilir,
  // bu da otomatik tüketim + doğru durum türetimini garanti eder.

  return (
    <div dir={dir} style={{ maxWidth: 900, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 32 }}>
      <SavedToast text={savedMsg} />

      {/* ---- Bölüm sekmeleri: Makineler + Ürünler ---- */}
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {localDepartments.map((d) => (
            <button key={d.id} onClick={() => setActiveDept(d.id)} style={{
              padding: "7px 14px", borderRadius: 10, border: `1px solid ${activeDept === d.id ? COLORS.accentRun : COLORS.border}`,
              background: activeDept === d.id ? COLORS.accentRunDim : "transparent",
              color: activeDept === d.id ? COLORS.accentRun : COLORS.textDim,
              fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}>
              {d.name}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Makineler */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 14, color: COLORS.text }}>{t("departmentMachines", lang)}</div>
              <button onClick={addMachine} style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: "6px 10px", borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 12, cursor: "pointer" }}>
                <Plus size={12} /> {t("add", lang)}
              </button>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {dept.machines.map((m, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 30px", gap: 6, alignItems: "center", background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 8 }}>
                  <input value={m.code} onChange={(e) => editMachine(i, "code", e.target.value)} onBlur={commitMachine} style={{ ...inputStyle, fontSize: 11.5 }} />
                  <input value={m.name} onChange={(e) => editMachine(i, "name", e.target.value)} onBlur={commitMachine} style={{ ...inputStyle, fontSize: 12 }} />
                  <button onClick={() => removeMachine(i)} style={{ background: "none", border: "none", color: COLORS.accentStop, cursor: "pointer", display: "flex", justifyContent: "center" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Ürün/Profil Listesi */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 14, color: COLORS.text }}>{t("departmentProducts", lang)}</div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input
                value={newProductText} onChange={(e) => setNewProductText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addProduct(); }}
                placeholder={t("newProductPlaceholder", lang)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addProduct} style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.accentRunDim, border: `1px solid ${COLORS.accentRun}50`, color: COLORS.accentRun, padding: "0 12px", borderRadius: 8, cursor: "pointer" }}>
                <Plus size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 280, overflowY: "auto" }}>
              {dept.products.map((p) => (
                <span key={p} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.textDim,
                  background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, padding: "4px 6px 4px 9px", borderRadius: 7,
                }}>
                  {p}
                  <button onClick={() => removeProduct(p)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", display: "flex", padding: 0 }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Siparişler ---- */}
      <div>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text, marginBottom: 12 }}>
          {t("orders", lang)}
        </div>

        <div style={{ background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: COLORS.textFaint, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            {t("newOrderForm", lang)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr 1fr", gap: 8, marginBottom: 12 }}>
            <input value={orderForm.formNo} onChange={(e) => setOrderForm({ ...orderForm, formNo: e.target.value })} placeholder={t("formNo", lang)} style={inputStyle} />
            <input type="date" value={orderForm.tarih} onChange={(e) => setOrderForm({ ...orderForm, tarih: e.target.value })} style={inputStyle} title={t("formDate", lang)} />
            <input value={orderForm.musteri} onChange={(e) => setOrderForm({ ...orderForm, musteri: e.target.value })} placeholder={t("orderCustomer", lang)} style={inputStyle} />
            <input type="date" value={orderForm.teslimTarihi} onChange={(e) => setOrderForm({ ...orderForm, teslimTarihi: e.target.value })} style={inputStyle} title={t("orderDueDate", lang)} />
          </div>

          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: COLORS.textFaint, marginBottom: 6 }}>{t("formItemsTitle", lang)}</div>
          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
            {formItems.map((row, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 0.8fr 32px", gap: 8 }}>
                <select value={row.urun} onChange={(e) => updateFormItemRow(idx, { urun: e.target.value })} style={inputStyle}>
                  <option value="">{t("selectProduct", lang)}</option>
                  {allOrderProducts.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="number" value={row.miktar} onChange={(e) => updateFormItemRow(idx, { miktar: e.target.value })} placeholder={t("orderQty", lang)} style={inputStyle} />
                <select value={row.birim} onChange={(e) => updateFormItemRow(idx, { birim: e.target.value })} style={inputStyle}>
                  <option value="adet">ADET</option>
                  <option value="takım">TAKIM</option>
                  <option value="m2">M²</option>
                  <option value="kg">KG</option>
                </select>
                <button onClick={() => removeFormItemRow(idx)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.textFaint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addFormItemRow} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={13} /> {t("addLineItem", lang)}
            </button>
            <button onClick={submitOrderForm} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.accentRun}50`, background: COLORS.accentRunDim, color: COLORS.accentRun, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {t("createOrderForm", lang)}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {(orders || []).map((o) => {
            const delivered = o.durum === ORDER_STATUS.DELIVERED;
            const stages = o.asamalar || [];
            const doneCount = stages.filter((s) => s.durum === STAGE_STATUS.DONE).length;
            const activeStage = stages.find((s) => s.durum === STAGE_STATUS.RUNNING) || stages.find((s) => s.durum === STAGE_STATUS.WAITING);
            const activeMachine = activeStage ? allOrderMachines.find((m) => m.code === activeStage.makine) : null;
            const draftMachine = stagePickers[o.id] || "";
            return (
              <div key={o.id} style={{
                background: COLORS.bgPanel, border: `1px solid ${delivered ? COLORS.accentRun + "40" : COLORS.border}`,
                borderRadius: 12, padding: "12px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.accentWarn }}>{o.id}</span>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 600, color: COLORS.text }}>{o.urun}</span>
                      {o.formNo && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textFaint, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "2px 6px" }}>
                          {t("formLabel", lang)} {o.formNo}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>
                      {o.musteri} · {o.miktar} {o.birim ? o.birim.toUpperCase() : t("units", lang)} {o.teslimTarihi && `· ${t("due", lang)} ${fmtDateShort(o.teslimTarihi)}`}
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
                      {stages.length === 0
                        ? t("noStagesYet", lang)
                        : activeStage
                        ? <>{doneCount}/{stages.length} {t("stageOf", lang)} · <span style={{ color: COLORS.accentWarn }}>{t("currentStageLabel", lang)}</span> {activeStage.makine} {activeMachine ? `(${activeMachine.name})` : ""} · {activeStage.cikan}/{o.miktar} {t("units", lang)}</>
                        : <span style={{ color: COLORS.accentRun }}>{t("allStagesDoneLabel", lang)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => markOrderDelivered(o.id, !delivered)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                        border: `1px solid ${delivered ? COLORS.accentRun : COLORS.border}`,
                        background: delivered ? COLORS.accentRunDim : "transparent",
                        color: delivered ? COLORS.accentRun : COLORS.textDim,
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {delivered && <Check size={12} />}
                      {delivered ? t("orderDelivered", lang) : t("orderPending", lang)}
                    </button>
                    <button onClick={() => removeOrder(o.id)} style={{ background: "none", border: "none", color: COLORS.accentStop, cursor: "pointer", display: "flex" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* ---- Aşama takibi ---- */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
                  {stages.length > 0 && (
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: COLORS.textFaint, marginBottom: 6 }}>
                      {t("stageManualEditHint", lang)}
                    </div>
                  )}
                  {stages.length > 0 && (
                    <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                      {stages.map((s, idx) => {
                        const mach = allOrderMachines.find((m) => m.code === s.makine);
                        const statusColor = s.durum === STAGE_STATUS.DONE ? COLORS.accentRun : s.durum === STAGE_STATUS.RUNNING ? COLORS.accentWarn : COLORS.textFaint;
                        const statusLabel = s.durum === STAGE_STATUS.DONE ? t("stageDone", lang) : s.durum === STAGE_STATUS.RUNNING ? t("stageRunning", lang) : t("stageWaiting", lang);
                        return (
                          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr 100px 90px 24px", gap: 8, alignItems: "center" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: COLORS.textFaint, textAlign: "center" }}>{idx + 1}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.text }}>
                              {s.makine} <span style={{ color: COLORS.textFaint }}>{mach ? `· ${mach.name}` : ""}</span>
                            </span>
                            <span
                              style={{
                                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700,
                                border: `1px solid ${statusColor}50`, background: statusColor + "20", color: statusColor,
                                borderRadius: 6, padding: "3px 6px", textAlign: "center",
                              }}
                              title={t("stageStatusReadOnlyHint", lang)}
                            >
                              {statusLabel}
                            </span>
                            <input
                              type="number" value={s.cikan}
                              onChange={(e) => updateOrderStage(o.id, s.id, { cikan: Math.max(0, parseInt(e.target.value) || 0) })}
                              placeholder={t("stageOutputQty", lang)}
                              style={{ ...inputStyle, fontSize: 11, padding: "4px 6px" }}
                            />
                            <button onClick={() => removeOrderStage(o.id, s.id)} style={{ background: "none", border: "none", color: COLORS.accentStop, cursor: "pointer", display: "flex", justifyContent: "center" }}>
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      value={draftMachine}
                      onChange={(e) => setStagePickers({ ...stagePickers, [o.id]: e.target.value })}
                      style={{ ...inputStyle, fontSize: 11.5, flex: 1 }}
                    >
                      <option value="">{t("stagePickMachine", lang)}</option>
                      {DEPARTMENT_GROUPS.map((grp) => {
                        const opts = allOrderMachines.filter((m) => m.departmentId === grp.id);
                        if (opts.length === 0) return null;
                        return (
                          <optgroup key={grp.id} label={grp.label(lang)}>
                            {opts.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
                          </optgroup>
                        );
                      })}
                    </select>
                    <button
                      onClick={() => { if (draftMachine) { addOrderStage(o.id, draftMachine); setStagePickers({ ...stagePickers, [o.id]: "" }); } }}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.accentRunDim, border: `1px solid ${COLORS.accentRun}50`, color: COLORS.accentRun, padding: "0 12px", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 600 }}
                    >
                      <Plus size={12} /> {t("addStage", lang)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- ER Kapı Model Kataloğu (referans) ---- */}
      <div>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text, marginBottom: 6 }}>
          {t("productModels", lang)}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>
          {t("productModelsNote", lang)}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {Object.entries(ER_MODEL_CATALOG).map(([type, models]) => (
            <div key={type} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>
                  {DOLGU_LABELS[type]}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint }}>
                  {models.length} {t("modelsCount", lang)}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {models.map((m) => (
                  <span key={m} style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.textDim,
                    background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, padding: "4px 9px", borderRadius: 7,
                  }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, borderRadius: 8,
  color: COLORS.text, fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "8px 10px", width: "100%", outline: "none",
};

// =================================================================
// STOK / HAMMADDE PANELİ
// =================================================================
function StokPanel({ data, lang, dir }) {
  const { stock, stockMovements, addStockItem, removeStockItem, adjustStockQty } = data;
  const [newItem, setNewItem] = useState({ name: "", unit: "", qty: "", criticalLevel: "" });
  const [adjusting, setAdjusting] = useState(null); // { id, sign }
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  if (!stock) return <LoadingScreen lang={lang} />;

  function handleAdd() {
    if (!newItem.name.trim()) return;
    addStockItem({
      id: `STK-${Date.now().toString().slice(-6)}`,
      name: newItem.name.trim(),
      unit: newItem.unit.trim() || "adet",
      qty: Number(newItem.qty) || 0,
      criticalLevel: Number(newItem.criticalLevel) || 0,
    });
    setNewItem({ name: "", unit: "", qty: "", criticalLevel: "" });
  }

  function handleConfirmAdjust() {
    const amount = Number(adjustAmount);
    if (!adjusting || !amount) return;
    adjustStockQty(adjusting.id, adjusting.sign * Math.abs(amount), adjustReason);
    setAdjusting(null); setAdjustAmount(""); setAdjustReason("");
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 22 }}>
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
          {t("stockItems", lang)}
        </div>
        {stock.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noStockItems", lang)}</div>}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {stock.map((s) => {
            const low = s.qty <= s.criticalLevel;
            return (
              <div key={s.id} style={{
                background: COLORS.bgPanel, border: `1px solid ${low ? COLORS.accentStop + "60" : COLORS.border}`,
                borderRadius: 14, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 14.5, color: COLORS.text }}>{s.name}</div>
                  <button onClick={() => removeStockItem(s.id)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", padding: 0 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700, color: low ? COLORS.accentStop : COLORS.text }}>{s.qty}</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>{s.unit}</span>
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint, marginTop: 2 }}>
                  {t("stockCritical", lang)}: {s.criticalLevel} {s.unit}
                </div>
                {low && (
                  <div style={{ marginTop: 6, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.accentStop, display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertTriangle size={12} /> {t("stockLow", lang)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => setAdjusting({ id: s.id, sign: 1 })} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${COLORS.accentRun}50`,
                    background: COLORS.accentRunDim, color: COLORS.accentRun, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    + {t("stockIn", lang)}
                  </button>
                  <button onClick={() => setAdjusting({ id: s.id, sign: -1 })} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${COLORS.accentStop}50`,
                    background: COLORS.accentStopDim, color: COLORS.accentStop, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    − {t("stockOut", lang)}
                  </button>
                </div>
                {adjusting?.id === s.id && (
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    <input style={inputStyle} type="number" placeholder={t("stockQty", lang)} value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                    <input style={inputStyle} placeholder={t("purchaseNote", lang)} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={handleConfirmAdjust} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: COLORS.accentRun, color: "#0C1A10", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("saved", lang) === "Kaydedildi" ? t("add", lang) : t("add", lang)}</button>
                      <button onClick={() => setAdjusting(null)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>{t("cancel", lang)}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>{t("addStockItem", lang)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <input style={inputStyle} placeholder={t("stockItemName", lang)} value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
          <input style={inputStyle} placeholder={t("stockUnit", lang)} value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
          <input style={inputStyle} type="number" placeholder={t("stockQty", lang)} value={newItem.qty} onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })} />
          <input style={inputStyle} type="number" placeholder={t("stockCritical", lang)} value={newItem.criticalLevel} onChange={(e) => setNewItem({ ...newItem, criticalLevel: e.target.value })} />
        </div>
        <button onClick={handleAdd} style={{ marginTop: 12, padding: "9px 16px", borderRadius: 9, border: "none", background: COLORS.accentRun, color: "#0C1A10", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {t("add", lang)}
        </button>
      </div>

      {stockMovements.length > 0 && (
        <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>{t("stockMovements", lang)}</div>
          <div style={{ display: "grid", gap: 4 }}>
            {stockMovements.slice(0, 10).map((mv, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < Math.min(stockMovements.length, 10) - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.textFaint, width: 42, flexShrink: 0 }}>{fmtClock(mv.time)}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: mv.delta > 0 ? COLORS.accentRun : COLORS.accentStop, width: 60, flexShrink: 0 }}>{mv.delta > 0 ? "+" : ""}{mv.delta}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>{mv.itemName} {mv.reason ? `— ${mv.reason}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// SATIN ALMA PANELİ
// =================================================================
function SatinAlmaPanel({ data, lang, dir, profile }) {
  const { stock, purchaseRequests, addPurchaseRequest, removePurchaseRequest, advancePurchaseStatus } = data;
  const [form, setForm] = useState({ stockItemId: "", qty: "", note: "" });

  if (!purchaseRequests || !stock) return <LoadingScreen lang={lang} />;

  function handleCreate() {
    const item = stock.find((s) => s.id === form.stockItemId);
    if (!item || !form.qty) return;
    addPurchaseRequest({
      id: `PO-${Date.now().toString().slice(-6)}`,
      stockItemId: item.id,
      itemName: item.name,
      unit: item.unit,
      qty: form.qty,
      note: form.note,
      status: PURCHASE_STATUS.PENDING,
      requestedBy: profile?.full_name || profile?.id || "—",
      date: new Date().toISOString(),
    });
    setForm({ stockItemId: "", qty: "", note: "" });
  }

  function nextStatusAction(reqItem) {
    const idx = PURCHASE_STATUS_ORDER.indexOf(reqItem.status);
    if (idx === -1 || idx === PURCHASE_STATUS_ORDER.length - 1) return null;
    const next = PURCHASE_STATUS_ORDER[idx + 1];
    const labelKey = next === PURCHASE_STATUS.APPROVED ? "approve" : next === PURCHASE_STATUS.ORDERED ? "markOrdered" : "markReceived";
    return { next, label: t(labelKey, lang) };
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 22 }}>
      <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>{t("newPurchaseRequest", lang)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <select style={inputStyle} value={form.stockItemId} onChange={(e) => setForm({ ...form, stockItemId: e.target.value })}>
            <option value="">{t("selectStockItem", lang)}</option>
            {stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
          </select>
          <input style={inputStyle} type="number" placeholder={t("purchaseQty", lang)} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          <input style={inputStyle} placeholder={t("purchaseNote", lang)} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <button onClick={handleCreate} style={{ marginTop: 12, padding: "9px 16px", borderRadius: 9, border: "none", background: COLORS.accentRun, color: "#0C1A10", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {t("add", lang)}
        </button>
      </div>

      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
          {t("purchaseRequestsTitle", lang)}
        </div>
        {purchaseRequests.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noPurchaseRequests", lang)}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {purchaseRequests.map((r) => {
            const action = nextStatusAction(r);
            const statusColor = r.status === PURCHASE_STATUS.RECEIVED ? COLORS.accentRun : r.status === PURCHASE_STATUS.PENDING ? COLORS.accentWarn : "#3DA5E8";
            return (
              <div key={r.id} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 14.5, color: COLORS.text }}>
                    {r.itemName} — {r.qty} {r.unit}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>
                    {t("requestedBy", lang)}: {r.requestedBy} {r.note ? `· ${r.note}` : ""}
                    {r.auto && (
                      <span style={{ marginLeft: 8, color: COLORS.accentWarn, fontWeight: 700, fontSize: 10.5 }}>
                        · {t("autoRequestBadge", lang)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 700, color: statusColor,
                    border: `1px solid ${statusColor}50`, borderRadius: 99, padding: "4px 10px",
                  }}>
                    {purchaseStatusLabel(r.status, lang)}
                  </span>
                  {action && (
                    <button onClick={() => advancePurchaseStatus(r.id, action.next)} style={{
                      padding: "7px 12px", borderRadius: 8, border: `1px solid ${COLORS.accentRun}50`,
                      background: COLORS.accentRunDim, color: COLORS.accentRun, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>
                      {action.label}
                    </button>
                  )}
                  <button onClick={() => removePurchaseRequest(r.id)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", padding: 0 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// ROTA / REÇETE PANELİ
// Her ürün için: hangi makinelerden sırayla geçtiği + hangi malzemeden
// ne kadar tükettiği burada bir kere tanımlanır. Yeni sipariş açılırken
// bu rota otomatik olarak aşamalara dönüştürülür.
// =================================================================
// =================================================================
// TERMİN HESAPLAMA PANELİ
// Her bekleyen siparişin kalan aşamalarını, o makinenin GEÇMİŞ log
// kayıtlarından çıkardığı gerçek üretim hızına göre günceller ve
// tahmini bitiş tarihini + teslim tarihine göre risk durumunu
// (UYGUN / SINIRDA / GECİKME) hesaplar. Veri geçmişi yoksa varsayılan
// bir hıza (saatte 15 adet) düşer.
// =================================================================
const TERMIN_DEFAULT_RATE_PER_HOUR = 15;
const TERMIN_WORK_HOURS_PER_DAY = 8;
const TERMIN_DEPT_COLOR = { extruder: "#E8C93D", laminasyon: "#3DA5E8", deck: "#5FB87A", kanat: "#E8533D" };

function terminMachineRate(machineCode, log) {
  const entries = (log || []).filter(
    (e) => e.type === "üretim" && e.machine === machineCode && e.detail?.qty > 0 && e.detail?.durationMs > 0
  );
  if (entries.length === 0) return TERMIN_DEFAULT_RATE_PER_HOUR;
  const totalQty = entries.reduce((s, e) => s + e.detail.qty, 0);
  const totalHours = entries.reduce((s, e) => s + e.detail.durationMs / 3600000, 0);
  return totalHours > 0 ? Math.max(0.1, totalQty / totalHours) : TERMIN_DEFAULT_RATE_PER_HOUR;
}

function terminAddWorkDays(startDate, decimalDays) {
  let remaining = decimalDays;
  let d = new Date(startDate);
  while (remaining > 0) {
    d = new Date(d.getTime() + 24 * 3600000);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    remaining -= 1;
  }
  return d;
}

function terminDaysBetween(a, b) {
  const x = new Date(a); const y = new Date(b);
  x.setHours(0, 0, 0, 0); y.setHours(0, 0, 0, 0);
  return Math.round((y - x) / 86400000);
}

function calcOrderTermin(order, machines, log) {
  const stages = (order.asamalar || []).filter((s) => s.durum !== STAGE_STATUS.DONE);
  const segments = stages.map((stage) => {
    const remainingQty = Math.max(0, (order.miktar || 0) - (stage.cikan || 0));
    const rate = terminMachineRate(stage.makine, log);
    const days = Math.max(0.15, remainingQty / rate / TERMIN_WORK_HOURS_PER_DAY);
    const machine = (machines || []).find((m) => m.code === stage.makine);
    return { stageId: stage.id, machine: stage.makine, departmentId: machine?.departmentId || "kanat", days, running: stage.durum === STAGE_STATUS.RUNNING };
  });
  const totalDays = segments.reduce((s, x) => s + x.days, 0);
  const eta = segments.length ? terminAddWorkDays(new Date(), totalDays) : new Date();
  const bottleneck = segments.reduce((max, x) => (!max || x.days > max.days ? x : max), null);
  let riskStatus = "uygun";
  if (order.teslimTarihi) {
    const margin = terminDaysBetween(eta, new Date(order.teslimTarihi + "T00:00:00"));
    if (margin < 0) riskStatus = "gecikme"; else if (margin <= 2) riskStatus = "sinirda";
  }
  return { segments, totalDays, eta, bottleneck, riskStatus };
}

const TERMIN_RISK_STYLE = {
  uygun: { colorKey: "accentRun" },
  sinirda: { colorKey: "accentWarn" },
  gecikme: { colorKey: "accentStop" },
};

function terminFmtGun(n) { return n < 1 ? `${Math.round(n * 24)} sa` : `${n.toFixed(1)} gün`; }
function terminFmtTarih(d, lang) {
  const locale = lang === "ar" ? "ar" : lang === "en" ? "en-US" : "tr-TR";
  return new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
}

function TerminGanttBar({ segments, lang }) {
  const total = segments.reduce((s, x) => s + x.days, 0) || 1;
  if (segments.length === 0) {
    return (
      <div style={{ height: 34, borderRadius: 8, border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint }}>{t("terminAllDone", lang)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", height: 34, borderRadius: 8, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
      {segments.map((seg, i) => {
        const pct = (seg.days / total) * 100;
        const color = TERMIN_DEPT_COLOR[seg.departmentId] || COLORS.accentIdle;
        return (
          <div key={seg.stageId || i} title={`${seg.machine} · ${terminFmtGun(seg.days)}`}
            style={{ width: `${pct}%`, minWidth: 34, background: color, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", opacity: seg.running ? 1 : 0.75 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: "#14161A" }}>{terminFmtGun(seg.days)}</span>
            {seg.running && <span style={{ position: "absolute", top: 3, right: 4, width: 6, height: 6, borderRadius: 99, background: "#14161A" }} />}
          </div>
        );
      })}
    </div>
  );
}

function TerminCapacityGauge({ pct, label }) {
  const color = pct >= 85 ? COLORS.accentStop : pct >= 60 ? COLORS.accentWarn : COLORS.accentRun;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>{label}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: COLORS.bgRaised, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

function TerminPanel({ data, lang, dir }) {
  const { orders, machines, departments, log, machineStates } = data;
  const [selectedId, setSelectedId] = useState(null);

  if (!orders || !machines) return <LoadingScreen lang={lang} />;

  const pending = orders.filter((o) => o.durum !== ORDER_STATUS.DELIVERED);
  const computed = pending.map((o) => ({ order: o, termin: calcOrderTermin(o, machines, log) }));
  const selected = selectedId ? computed.find((c) => c.order.id === selectedId) : computed[0];

  const capacityByDept = (departments || []).map((dept) => {
    const total = dept.machines.length || 1;
    const running = dept.machines.filter((m) => (machineStates[m.code] || {}).status === "run").length;
    return { id: dept.id, name: dept.name, pct: Math.min(100, Math.round((running / total) * 100)) };
  });

  return (
    <div dir={dir} style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 20px 60px" }}>
      <div style={{ background: COLORS.bg, borderRadius: 18, border: `1px solid ${COLORS.border}`, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 20, color: COLORS.text }}>{t("terminPanelTab", lang)}</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim, marginTop: 2 }}>{t("terminPanelDesc", lang)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.accentRunDim, border: `1px solid ${COLORS.accentRun}40`, borderRadius: 99, padding: "6px 14px" }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: COLORS.accentRun, boxShadow: `0 0 0 3px ${COLORS.accentRun}30` }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.accentRun, fontWeight: 700 }}>{t("liveStatus", lang)}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: capacityByDept.length ? "1fr 260px" : "1fr", gap: 20 }}>
          <div>
            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {computed.map(({ order, termin }) => {
                const risk = TERMIN_RISK_STYLE[termin.riskStatus];
                const riskColor = COLORS[risk.colorKey];
                const isSelected = selected?.order.id === order.id;
                return (
                  <button key={order.id} onClick={() => setSelectedId(order.id)} style={{
                    textAlign: dir === "rtl" ? "right" : "left", cursor: "pointer",
                    border: `1px solid ${isSelected ? riskColor + "60" : COLORS.border}`,
                    background: isSelected ? COLORS.bgRaised : COLORS.bgPanel, borderRadius: 14, padding: "14px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.accentWarn }}>{order.id}</span>
                        <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text }}>{order.urun}</span>
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textDim, marginTop: 2 }}>
                        {order.musteri} · {t("due", lang)}: {order.teslimTarihi ? terminFmtTarih(order.teslimTarihi + "T00:00:00", lang) : "—"}
                      </div>
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, color: riskColor, border: `1px solid ${riskColor}50`, borderRadius: 8, padding: "4px 8px", whiteSpace: "nowrap" }}>
                      {t(termin.riskStatus, lang)}
                    </span>
                  </button>
                );
              })}
              {computed.length === 0 && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textFaint, padding: 20, textAlign: "center" }}>{t("terminNoOrders", lang)}</div>
              )}
            </div>

            {selected && (
              <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text }}>
                    {selected.order.id} — {t("terminRemainingStages", lang)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.textDim, fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
                    <Clock size={13} /> {t("estFinish", lang)}: <span style={{ color: COLORS.text, fontWeight: 600 }}>{terminFmtTarih(selected.termin.eta, lang)}</span>
                  </div>
                </div>

                <TerminGanttBar segments={selected.termin.segments} lang={lang} />

                <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>
                    {t("terminTotalRemaining", lang)}: <b style={{ color: COLORS.text }}>{terminFmtGun(selected.termin.totalDays)}</b>
                  </span>
                  {selected.termin.bottleneck && (
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>
                      {t("bottleneck", lang)}: <b style={{ color: COLORS.accentWarn }}>{selected.termin.bottleneck.machine}</b>
                    </span>
                  )}
                </div>

                {selected.order.teslimTarihi && (() => {
                  const risk = TERMIN_RISK_STYLE[selected.termin.riskStatus];
                  const riskColor = COLORS[risk.colorKey];
                  const margin = terminDaysBetween(selected.termin.eta, new Date(selected.order.teslimTarihi + "T00:00:00"));
                  return (
                    <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: riskColor + "18", border: `1px solid ${riskColor}40`, fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.text }}>
                      {margin >= 0 ? t("daysMargin", lang, { n: margin }) : t("daysOverdue", lang, { n: Math.abs(margin) })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {capacityByDept.length > 0 && (
            <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: COLORS.textFaint, textTransform: "uppercase" }}>
                {t("terminCapacityTitle", lang)}
              </div>
              {capacityByDept.map((d) => <TerminCapacityGauge key={d.id} pct={d.pct} label={d.name} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RotaPanel({ data, lang, dir }) {
  const { departments, stock, productRoutes, addProductRoute, removeProductRoute } = data;
  const allProducts = departments ? allProductsFrom(departments) : [];
  const allMachines = departments ? allMachinesFrom(departments) : [];

  const [productName, setProductName] = useState("");
  const [stageMachines, setStageMachines] = useState([]); // ["MK-EX2", "MK-FOL", ...]
  const [machinePicker, setMachinePicker] = useState("");
  const [consumables, setConsumables] = useState([]); // [{ machine, stockItemId, qtyPerUnit }]
  const [cMachine, setCMachine] = useState("");
  const [cStock, setCStock] = useState("");
  const [cQty, setCQty] = useState("");

  if (!productRoutes || !stock) return <LoadingScreen lang={lang} />;

  function addStageToDraft() {
    if (!machinePicker) return;
    setStageMachines([...stageMachines, machinePicker]);
    setMachinePicker("");
  }
  function removeStageFromDraft(idx) {
    setStageMachines(stageMachines.filter((_, i) => i !== idx));
  }
  function addConsumableToDraft() {
    if (!cMachine || !cStock || !cQty) return;
    setConsumables([...consumables, { machine: cMachine, stockItemId: cStock, qtyPerUnit: Number(cQty) }]);
    setCMachine(""); setCStock(""); setCQty("");
  }
  function removeConsumableFromDraft(idx) {
    setConsumables(consumables.filter((_, i) => i !== idx));
  }

  function saveRoute() {
    if (!productName || stageMachines.length === 0) return;
    const stages = stageMachines.map((machine) => ({
      machine,
      consumables: consumables.filter((c) => c.machine === machine).map(({ stockItemId, qtyPerUnit }) => ({ stockItemId, qtyPerUnit })),
    }));
    addProductRoute({ id: `RT-${Date.now().toString().slice(-6)}`, productName, stages });
    setProductName(""); setStageMachines([]); setConsumables([]);
  }

  function machineName(code) {
    return allMachines.find((m) => m.code === code)?.name || code;
  }
  function stockName(id) {
    return stock.find((s) => s.id === id)?.name || id;
  }

  return (
    <div dir={dir} style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 22 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 }}>
        {t("routesDesc", lang)}
      </div>

      {/* Mevcut rotalar */}
      <div>
        {(productRoutes || []).length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noRoutes", lang)}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {(productRoutes || []).map((r) => (
            <div key={r.id} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text }}>{r.productName}</div>
                <button onClick={() => removeProductRoute(r.id)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer" }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {r.stages.map((s, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.text,
                      background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, padding: "4px 9px", borderRadius: 7,
                    }}>
                      {machineName(s.machine)}
                      {s.consumables?.length > 0 && (
                        <span style={{ color: COLORS.accentWarn, marginLeft: 6 }}>({s.consumables.length})</span>
                      )}
                    </span>
                    {i < r.stages.length - 1 && <span style={{ color: COLORS.textFaint }}>→</span>}
                  </span>
                ))}
              </div>
              {consumablesSummary(r) && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint, marginTop: 8 }}>
                  {consumablesSummary(r)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Yeni rota oluştur */}
      <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18, display: "grid", gap: 18 }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text }}>{t("routes", lang)}</div>

        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>{t("routeProduct", lang)}</div>
          <select value={productName} onChange={(e) => setProductName(e.target.value)} style={inputStyle}>
            <option value="">{t("selectProduct", lang)}</option>
            {allProducts.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>{t("routeStagesTitle", lang)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {stageMachines.map((m, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.text, background: COLORS.bgRaised, border: `1px solid ${COLORS.border}`, padding: "4px 6px 4px 9px", borderRadius: 7 }}>
                {i + 1}. {machineName(m)}
                <button onClick={() => removeStageFromDraft(i)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", display: "flex", padding: 0 }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={machinePicker} onChange={(e) => setMachinePicker(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">{t("selectMachine", lang)}</option>
              {allMachines.map((m) => <option key={m.code} value={m.code}>{m.name} ({m.code})</option>)}
            </select>
            <button onClick={addStageToDraft} style={{ padding: "0 16px", borderRadius: 8, border: `1px solid ${COLORS.accentRun}50`, background: COLORS.accentRunDim, color: COLORS.accentRun, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {t("addStage", lang)}
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>{t("routeConsumablesTitle", lang)}</div>
          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
            {consumables.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>
                <span style={{ flex: 1 }}>{machineName(c.machine)} → {stockName(c.stockItemId)} × {c.qtyPerUnit}</span>
                <button onClick={() => removeConsumableFromDraft(i)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.8fr auto", gap: 8 }}>
            <select value={cMachine} onChange={(e) => setCMachine(e.target.value)} style={inputStyle}>
              <option value="">{t("selectMachine", lang)}</option>
              {stageMachines.map((m) => <option key={m} value={m}>{machineName(m)}</option>)}
            </select>
            <select value={cStock} onChange={(e) => setCStock(e.target.value)} style={inputStyle}>
              <option value="">{t("selectStockItem", lang)}</option>
              {stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
            </select>
            <input type="number" placeholder={t("qtyPerUnit", lang)} value={cQty} onChange={(e) => setCQty(e.target.value)} style={inputStyle} />
            <button onClick={addConsumableToDraft} style={{ padding: "0 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 12, cursor: "pointer" }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <button onClick={saveRoute} style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: COLORS.accentRun, color: "#0C1A10", fontWeight: 700, fontSize: 13.5, cursor: "pointer", justifySelf: "start" }}>
          {t("saveRoute", lang)}
        </button>
      </div>
    </div>
  );
}
function consumablesSummary(route) {
  const total = (route.stages || []).reduce((sum, s) => sum + (s.consumables?.length || 0), 0);
  return total > 0 ? `${total} malzeme tüketim kuralı tanımlı` : "";
}

// =================================================================
// SEVKİYAT PANELİ
// Hangi siparişin hangi makinede olduğunu ve hangilerinin tamamen
// bitip sevkiyata hazır olduğunu tek ekrandan gösterir.
// =================================================================
function SevkiyatPanel({ data, lang, dir }) {
  const { orders, departments, markOrderDelivered, shipments, addShipment } = data;
  const allMachines = departments ? allMachinesFrom(departments) : [];
  const [qrOrder, setQrOrder] = useState(null);
  const [shipOrder, setShipOrder] = useState(null);
  const [search, setSearch] = useState("");

  function machineName(code) {
    return allMachines.find((m) => m.code === code)?.name || code;
  }

  const inProduction = (orders || []).filter((o) => o.durum === ORDER_STATUS.PENDING);
  const ready = (orders || []).filter((o) => o.durum === ORDER_STATUS.READY);

  const filteredShipments = (shipments || []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.vehiclePlate || "").toLowerCase().includes(q) || (s.driverName || "").toLowerCase().includes(q) || (s.waybillNo || "").toLowerCase().includes(q);
  });

  function handleExportShipments() {
    const rows = (shipments || []).map((s) => ({
      "Sipariş No": s.orderId, "Ürün": s.urun, "Müşteri": s.musteri,
      "Lojistik Firması": s.logisticsCompany, "Araç Plakası": s.vehiclePlate,
      "Şoför": s.driverName, "Şoför Telefonu": s.driverPhone,
      "İrsaliye No": s.waybillNo, "Gönderilen Miktar": s.shippedQuantity,
      "Tarih": new Date(s.shippedAt).toLocaleString("tr-TR"),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Sevkiyatlar");
    XLSX.writeFile(wb, `Sevkiyat_Kayitlari_${isoDate(new Date())}.xlsx`);
  }

  return (
    <div dir={dir} style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 26 }}>
      {qrOrder && <QrModal order={qrOrder} lang={lang} onClose={() => setQrOrder(null)} />}
      {shipOrder && (
        <ShipmentModal
          order={shipOrder} lang={lang}
          onClose={() => setShipOrder(null)}
          onConfirm={async (details) => {
            await addShipment({
              id: `SHP-${Date.now().toString().slice(-6)}`,
              orderId: shipOrder.id, urun: shipOrder.urun, musteri: shipOrder.musteri,
              ...details, shippedAt: new Date().toISOString(), status: "en_route",
            });
            await markOrderDelivered(shipOrder.id, true);
            setShipOrder(null);
          }}
        />
      )}

      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
          {t("readyToShipSection", lang)} ({ready.length})
        </div>
        {ready.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noOrdersReady", lang)}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {ready.map((o) => (
            <div key={o.id} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.accentRun}50`, borderRadius: 14, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 14.5, color: COLORS.text }}>
                  {o.urun} — {o.miktar} {o.birim ? o.birim.toUpperCase() : t("units", lang)}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>
                  {o.musteri} · {o.id} {o.formNo && `· ${t("formLabel", lang)} ${o.formNo}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.accentRun, border: `1px solid ${COLORS.accentRun}50`, borderRadius: 99, padding: "4px 10px" }}>
                  {t("readyBadge", lang)}
                </span>
                <button onClick={() => setQrOrder(o)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  <QrCode size={13} /> QR
                </button>
                <button onClick={() => setShipOrder(o)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${COLORS.accentRun}50`, background: COLORS.accentRunDim, color: COLORS.accentRun, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  {t("shipOutTitle", lang)}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
          {t("inProductionSection", lang)} ({inProduction.length})
        </div>
        {inProduction.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noOrdersInProduction", lang)}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {inProduction.map((o) => {
            const stage = currentOrderStage(o);
            const doneCount = (o.asamalar || []).filter((s) => s.durum === STAGE_STATUS.DONE).length;
            return (
              <div key={o.id} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 14.5, color: COLORS.text }}>
                      {o.urun} — {o.miktar} {o.birim ? o.birim.toUpperCase() : t("units", lang)}
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>
                      {o.musteri} · {o.id} {o.formNo && `· ${t("formLabel", lang)} ${o.formNo}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.text }}>
                      {stage ? (
                        <>{t("currentLocation", lang)}: <span style={{ color: COLORS.accentWarn, fontWeight: 700 }}>{machineName(stage.makine)}</span> · {stage.cikan}/{o.miktar}</>
                      ) : (
                        <span style={{ color: COLORS.textFaint }}>—</span>
                      )}
                    </div>
                    <button onClick={() => setQrOrder(o)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      <QrCode size={12} /> QR
                    </button>
                  </div>
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint, marginTop: 8 }}>
                  {doneCount}/{(o.asamalar || []).length} {t("stageOf", lang)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {t("shipmentRecords", lang)} ({(shipments || []).length})
          </div>
          <button onClick={handleExportShipments} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Download size={13} /> {t("exportShipments", lang)}
          </button>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchShipments", lang)} style={{ ...inputStyle, marginBottom: 10 }} />
        {filteredShipments.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noShipments", lang)}</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {filteredShipments.map((s) => (
            <div key={s.id} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 13, color: COLORS.text }}>{s.urun} · {s.orderId}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint }}>{new Date(s.shippedAt).toLocaleDateString("tr-TR")}</div>
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textDim, marginTop: 6 }}>
                {s.logisticsCompany} · {s.vehiclePlate} · {s.driverName} ({s.driverPhone}) · {t("waybillNo", lang)}: {s.waybillNo} · {s.shippedQuantity} {t("units", lang)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// SEVKİYAT ÇIKIŞ FORMU — lojistik firması, plaka, şoför, irsaliye no
// zorunlu alanlar. Onaylanınca hem shipments kaydı oluşur hem de
// sipariş "Teslim Edildi" olarak işaretlenir.
// =================================================================
function ShipmentModal({ order, lang, onClose, onConfirm }) {
  const [form, setForm] = useState({
    logisticsCompany: "", vehiclePlate: "", driverName: "", driverPhone: "",
    waybillNo: "", shippedQuantity: order.miktar,
  });
  const [error, setError] = useState(null);

  function handleConfirm() {
    if (!form.logisticsCompany || !form.vehiclePlate || !form.driverName || !form.waybillNo) {
      setError(t("requiredField", lang));
      return;
    }
    onConfirm(form);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 26, maxWidth: 440, width: "100%" }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 17, color: COLORS.text, marginBottom: 2 }}>{t("shipOutTitle", lang)}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.textFaint, marginBottom: 16 }}>{order.urun} · {order.id} · {order.musteri}</div>
        <div style={{ display: "grid", gap: 10 }}>
          <input value={form.logisticsCompany} onChange={(e) => setForm({ ...form, logisticsCompany: e.target.value })} placeholder={t("logisticsCompany", lang)} style={inputStyle} />
          <input value={form.vehiclePlate} onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })} placeholder={t("vehiclePlate", lang) + " (örn. 38 AB 123)"} style={inputStyle} />
          <input value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} placeholder={t("driverName", lang)} style={inputStyle} />
          <input value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} placeholder={t("driverPhone", lang)} style={inputStyle} />
          <input value={form.waybillNo} onChange={(e) => setForm({ ...form, waybillNo: e.target.value })} placeholder={t("waybillNo", lang)} style={inputStyle} />
          <input type="number" value={form.shippedQuantity} onChange={(e) => setForm({ ...form, shippedQuantity: e.target.value })} placeholder={t("shippedQty", lang)} style={inputStyle} />
        </div>
        {error && <div style={{ color: COLORS.accentStop, fontSize: 12.5, marginTop: 10, fontFamily: "'Inter', sans-serif" }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer" }}>{t("cancel", lang)}</button>
          <button onClick={handleConfirm} style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none", background: COLORS.accentRun, color: "#0C1A10", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("confirmShipment", lang)}</button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// VERİMLİLİK PANELİ — gerçek verilerden hesaplanan 3 metrik:
// 1) Darboğaz: makine başına bekleyen iş (siparişlerin aşamalarından)
// 2) Duruş Pareto: kayıtlı duruş sürelerinden (log)
// 3) Termin Riski: gereken hız vs bu siparişin gerçek üretim hızı (log)
// Örnek/sahte veri YOKTUR — hepsi data.orders, data.log, data.departments'tan türetilir.
// =================================================================
function VerimlilikPanel({ data, lang, dir }) {
  const { orders, log, departments, calendarExceptions } = data;
  if (!orders || !log || !departments) return <LoadingScreen lang={lang} />;
  const allMachines = allMachinesFrom(departments);
  function machineName(code) { return allMachines.find((m) => m.code === code)?.name || code; }

  // ---- 1) Darboğaz: aktif (PENDING) siparişlerin tamamlanmamış aşamalarında bekleyen adet, makineye göre toplanır ----
  const bottleneckMap = {};
  orders.filter((o) => o.durum === ORDER_STATUS.PENDING).forEach((o) => {
    (o.asamalar || []).forEach((s) => {
      if (s.durum === STAGE_STATUS.DONE) return;
      const remaining = Math.max(0, (o.miktar || 0) - (s.cikan || 0));
      bottleneckMap[s.makine] = (bottleneckMap[s.makine] || 0) + remaining;
    });
  });
  const bottleneckList = Object.entries(bottleneckMap).sort((a, b) => b[1] - a[1]);
  const bottleneckMax = bottleneckList[0]?.[1] || 1;

  // ---- 2) Duruş Pareto: sadece durationMs kaydedilmiş "duruş" logları ----
  const downtimeMap = {};
  log.filter((l) => l.type === "duruş" && l.detail?.durationMs > 0).forEach((l) => {
    const id = downtimeIdFromTrLabel(l.label) || l.label;
    downtimeMap[id] = (downtimeMap[id] || 0) + l.detail.durationMs;
  });
  const downtimeList = Object.entries(downtimeMap).sort((a, b) => b[1] - a[1]);
  const downtimeTotal = downtimeList.reduce((sum, [, ms]) => sum + ms, 0) || 1;
  let cumMs = 0;

  // ---- 3) Termin Riski: gereken hız (kalan/gün) vs bu siparişin log'lardan hesaplanan gerçek hızı ----
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const riskList = orders.filter((o) => o.durum === ORDER_STATUS.PENDING && o.teslimTarihi).map((o) => {
    const stages = o.asamalar || [];
    const lastStage = stages[stages.length - 1];
    const completed = lastStage ? (lastStage.cikan || 0) : 0;
    const remaining = Math.max(0, (o.miktar || 0) - completed);
    const due = new Date(o.teslimTarihi + "T00:00:00");
    // Takvim istisnalarını (tatil/mesai) hesaba katan gerçek iş günü sayısı —
    // ham takvim günü farkı değil.
    const daysLeft = workingDaysBetween(today, due, calendarExceptions);

    const relevantLogs = log.filter((l) => l.type === "üretim" && l.detail?.orderId === o.id && l.detail?.durationMs > 0);
    let actualRate = null;
    if (relevantLogs.length > 0) {
      const totalQty = relevantLogs.reduce((s, l) => s + (l.detail.qty || 0), 0);
      const totalMs = relevantLogs.reduce((s, l) => s + (l.detail.durationMs || 0), 0);
      if (totalMs > 0) actualRate = totalQty / (totalMs / 86400000);
    }
    const requiredRate = remaining / Math.max(daysLeft, 0.1);
    return { order: o, remaining, daysLeft, requiredRate, actualRate };
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div dir={dir} style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 22 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 }}>
        {t("efficiencyDesc", lang)}
      </div>

      {/* Darboğaz */}
      <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 4 }}>{t("bottleneckTitle", lang)}</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>{t("bottleneckDesc", lang)}</div>
        {bottleneckList.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noBottleneckData", lang)}</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {bottleneckList.map(([machine, qty], i) => (
            <div key={machine} className="browlike" style={{ display: "grid", gridTemplateColumns: "150px 1fr 70px", alignItems: "center", gap: 12 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textDim }}>{machineName(machine)}</div>
              <div style={{ height: 14, background: COLORS.bgRaised, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round((qty / bottleneckMax) * 100)}%`, background: i === 0 ? COLORS.accentStop : COLORS.accentRun, borderRadius: 6 }} />
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, textAlign: "right", color: COLORS.text }}>{qty}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Duruş Pareto */}
      <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 4 }}>{t("downtimeParetoTitle", lang)}</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>{t("downtimeParetoDesc", lang)}</div>
        {downtimeList.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noDowntimeData", lang)}</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {downtimeList.map(([reasonId, ms]) => {
            cumMs += ms;
            const pct = Math.round((ms / downtimeTotal) * 100);
            const cumPct = Math.round((cumMs / downtimeTotal) * 100);
            const meta = DOWNTIME_REASONS.find((r) => r.id === reasonId);
            const minutes = Math.round(ms / 60000);
            return (
              <div key={reasonId} style={{ display: "grid", gridTemplateColumns: "150px 1fr 60px 70px", alignItems: "center", gap: 12 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textDim }}>{meta ? downtimeLabel(meta.id, lang) : reasonId}</div>
                <div style={{ height: 14, background: COLORS.bgRaised, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: COLORS.accentStop, borderRadius: 6 }} />
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, textAlign: "right", color: COLORS.text }}>{minutes} dk</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textAlign: "right", color: COLORS.textFaint }}>Σ %{cumPct}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Termin Riski */}
      <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 4 }}>{t("riskTitle", lang)}</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>{t("riskDesc", lang)}</div>
        {riskList.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noRiskData", lang)}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {riskList.map(({ order, remaining, daysLeft, requiredRate, actualRate }) => {
            const overdue = daysLeft < 0;
            const onTrack = actualRate !== null && actualRate >= requiredRate;
            return (
              <div key={order.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 13.5, color: COLORS.text }}>{order.urun} · {order.id}</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint, marginTop: 2 }}>
                      {remaining} {t("units", lang)} {overdue ? "" : `· ${Math.ceil(daysLeft)} ${t("daysLeft", lang)}`}
                    </div>
                  </div>
                  <span style={{
                    fontFamily: "'Inter', sans-serif", fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 99,
                    color: overdue ? COLORS.accentStop : actualRate === null ? COLORS.textFaint : onTrack ? COLORS.accentRun : COLORS.accentStop,
                    background: overdue ? COLORS.accentStopDim : actualRate === null ? COLORS.bgRaised : onTrack ? COLORS.accentRunDim : COLORS.accentStopDim,
                    border: `1px solid ${overdue || (!onTrack && actualRate !== null) ? COLORS.accentStop + "50" : actualRate === null ? COLORS.border : COLORS.accentRun + "50"}`,
                  }}>
                    {overdue ? t("overdue", lang) : actualRate === null ? t("noProductionLogYet", lang) : onTrack ? t("onTrack", lang) : t("atRisk", lang)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 22, marginTop: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                  <div><span style={{ color: COLORS.textFaint }}>{t("requiredRate", lang)}: </span><span style={{ color: COLORS.text }}>{requiredRate.toFixed(1)} {t("perDay", lang)}</span></div>
                  {actualRate !== null && (
                    <div><span style={{ color: COLORS.textFaint }}>{t("actualRate", lang)}: </span><span style={{ color: onTrack ? COLORS.accentRun : COLORS.accentStop }}>{actualRate.toFixed(1)} {t("perDay", lang)}</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// QR MODAL — sipariş için gerçek bir QR kod üretir (qrcode kütüphanesi).
// QR, uygulama içi #/urun/<id> adresine gider; okutulduğunda (ya da
// tıklanınca) giriş yapmış kullanıcıya o siparişin izlenebilirlik
// sayfasını açar.
// =================================================================
function QrModal({ order, lang, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const traceUrl = `${window.location.origin}${window.location.pathname}#/urun/${order.id}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(traceUrl, { width: 220, margin: 1, color: { dark: "#15171A", light: "#FFFFFF" } })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [traceUrl]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 28, maxWidth: 340, width: "100%", textAlign: "center" }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text, marginBottom: 2 }}>{order.urun}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.textFaint, marginBottom: 18 }}>{order.id} · {order.musteri}</div>
        <div style={{ background: "#fff", padding: 14, borderRadius: 12, display: "inline-block", marginBottom: 18 }}>
          {dataUrl ? <img src={dataUrl} alt="QR" width={188} height={188} /> : <div style={{ width: 188, height: 188 }} />}
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.textFaint, lineHeight: 1.5, marginBottom: 18 }}>{t("qrHint", lang)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            {t("qrClose", lang)}
          </button>
          <button onClick={() => { window.location.hash = `/urun/${order.id}`; }} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${COLORS.accentRun}50`, background: COLORS.accentRunDim, color: COLORS.accentRun, fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            {t("traceTitle", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// İZLENEBİLİRLİK SAYFASI — QR okutulunca (veya #/urun/<id> hash'iyle)
// açılan, salt-okunur üretim geçmişi görünümü. Sipariş verisinden ve
// (varsa) ürün rotasının reçetesinden otomatik oluşur.
// =================================================================
function TraceView({ orderId, data, lang, dir, onBack }) {
  const { orders, departments, productRoutes, stock } = data;
  const order = (orders || []).find((o) => o.id === orderId);
  const allMachines = departments ? allMachinesFrom(departments) : [];
  function machineName(code) { return allMachines.find((m) => m.code === code)?.name || code; }

  if (!orders) return <LoadingScreen lang={lang} />;
  if (!order) {
    return (
      <div dir={dir} style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 14, marginBottom: 14 }}>Sipariş bulunamadı: {orderId}</div>
          <button onClick={onBack} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, cursor: "pointer" }}>{t("traceBack", lang)}</button>
        </div>
      </div>
    );
  }

  const route = (productRoutes || []).find((r) => r.productName === order.urun);
  // Reçeteye göre kullanılan toplam malzeme: her aşamanın kendi cikan'ı × birim başına miktar
  const materialTotals = {};
  (order.asamalar || []).forEach((s) => {
    const routeStage = route?.stages?.find((rs) => rs.machine === s.makine);
    routeStage?.consumables?.forEach((c) => {
      materialTotals[c.stockItemId] = (materialTotals[c.stockItemId] || 0) + (c.qtyPerUnit || 0) * (s.cikan || 0);
    });
  });
  const materialRows = Object.entries(materialTotals).map(([stockItemId, total]) => {
    const item = (stock || []).find((s) => s.id === stockItemId);
    return { name: item?.name || stockItemId, unit: item?.unit || "", total };
  });

  return (
    <div dir={dir} style={{ minHeight: "100vh", background: COLORS.bg, padding: "28px 20px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, padding: "9px 14px", borderRadius: 9, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontFamily: "'Inter', sans-serif", fontSize: 12.5, cursor: "pointer" }}>
          <ChevronLeft size={14} /> {t("traceBack", lang)}
        </button>

        <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 26, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 18, marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 20, color: COLORS.text }}>{order.urun}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textFaint, marginTop: 4 }}>{order.id} · {order.musteri} · {order.miktar} {t("units", lang)}</div>
            </div>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: COLORS.accentRun, background: COLORS.accentRunDim, border: `1px solid ${COLORS.accentRun}50`, padding: "5px 11px", borderRadius: 99 }}>
              <Check size={12} /> {t("traceVerified", lang)}
            </span>
          </div>

          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.textFaint, marginBottom: 14 }}>{t("traceTitle", lang)}</div>
          {(order.asamalar || []).length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("traceEmptyHistory", lang)}</div>}
          <div style={{ position: "relative", paddingLeft: 26 }}>
            {(order.asamalar || []).length > 1 && (
              <div style={{ position: "absolute", left: 8, top: 6, bottom: 6, width: 1.5, background: COLORS.border }} />
            )}
            {(order.asamalar || []).map((s, i) => (
              <div key={s.id} style={{ position: "relative", paddingBottom: i === (order.asamalar.length - 1) ? 0 : 22 }}>
                <div style={{
                  position: "absolute", left: -26, top: 2, width: 10, height: 10, borderRadius: "50%",
                  background: s.durum === STAGE_STATUS.DONE ? COLORS.accentRun : s.durum === STAGE_STATUS.RUNNING ? COLORS.accentWarn : COLORS.accentIdle,
                  boxShadow: `0 0 0 3px ${s.durum === STAGE_STATUS.DONE ? COLORS.accentRunDim : s.durum === STAGE_STATUS.RUNNING ? COLORS.accentWarnDim : COLORS.bgRaised}`,
                }} />
                <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 13.5, color: COLORS.text }}>{machineName(s.makine)}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: COLORS.textFaint, marginTop: 3 }}>
                  {s.cikan || 0} / {order.miktar} {t("units", lang)} · {s.durum === STAGE_STATUS.DONE ? t("stageDone", lang) : s.durum === STAGE_STATUS.RUNNING ? t("stageRunning", lang) : t("stageWaiting", lang)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {materialRows.length > 0 && (
          <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 26, marginBottom: 18 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.textFaint, marginBottom: 14 }}>
              {t("stockItems", lang)}
            </div>
            {materialRows.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < materialRows.length - 1 ? `1px solid ${COLORS.border}` : "none", fontSize: 13 }}>
                <span style={{ color: COLORS.textDim }}>{m.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.text }}>{m.total.toFixed(2)} {m.unit}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11, color: COLORS.textFaint, lineHeight: 1.6 }}>
          Bu sayfa üretim verisinden otomatik oluşturulur ve elle düzenlenemez.
        </div>
      </div>
    </div>
  );
}

// =================================================================
// KANBAN PANOSU — siparişlerin gerçek departmanlar arasındaki akışını
// gösterir. Sütunlar sabit değil, sistemdeki gerçek departmanlardan
// (Extruder / Laminasyon / Deck / Kanat Üretimi) + son sütun olarak
// Sevkiyat'tan otomatik oluşur. Bir siparişin hangi sütunda göründüğü,
// o an aktif olan aşamanın makinesinin departmanına göre belirlenir.
// =================================================================
// =================================================================
// ÇALIŞMA TAKVİMİ — hafta sonu mesaisi / hafta içi resmi tatil gibi
// istisnaları yönetir. Verimlilik sekmesindeki Termin Riski hesabı
// bu istisnaları otomatik olarak dikkate alır (workingDaysBetween).
// =================================================================
function CalendarPanel({ data, lang, dir }) {
  const { calendarExceptions, setCalendarException, removeCalendarException } = data;
  const [date, setDate] = useState("");
  const [isWorking, setIsWorking] = useState(true);
  const [desc, setDesc] = useState("");

  if (!calendarExceptions) return <LoadingScreen lang={lang} />;
  const rows = Object.entries(calendarExceptions).sort((a, b) => (a[0] < b[0] ? -1 : 1));

  function handleAdd() {
    if (!date) return;
    setCalendarException(date, isWorking, desc);
    setDate(""); setDesc(""); setIsWorking(true);
  }

  return (
    <div dir={dir} style={{ maxWidth: 800, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 20 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 }}>
        {t("calendarDesc", lang)}
      </div>

      <div style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 10, marginBottom: 10 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <select value={isWorking ? "1" : "0"} onChange={(e) => setIsWorking(e.target.value === "1")} style={inputStyle}>
            <option value="1">{t("workingDay", lang)}</option>
            <option value="0">{t("nonWorkingDay", lang)}</option>
          </select>
        </div>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("exceptionDesc", lang)} style={{ ...inputStyle, marginBottom: 10 }} />
        <button onClick={handleAdd} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: COLORS.accentRun, color: "#0C1A10", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {t("addException", lang)}
        </button>
      </div>

      {rows.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noExceptions", lang)}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map(([iso, exc]) => (
          <div key={iso} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px" }}>
            <div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: COLORS.text }}>{fmtDateShort(iso)}</span>
              <span style={{
                marginLeft: 10, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700,
                color: exc.isWorkingDay ? COLORS.accentRun : COLORS.accentStop,
              }}>
                {exc.isWorkingDay ? t("workingDay", lang) : t("nonWorkingDay", lang)}
              </span>
              {exc.description && <span style={{ marginLeft: 10, fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textFaint }}>{exc.description}</span>}
            </div>
            <button onClick={() => removeCalendarException(iso)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer" }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =================================================================
// YÖNETİCİ "GERİ AL" PANELİ — sadece Yönetici Modu içinde erişilebilir
// (mevcut mod ayrımıyla aynı güvenlik modeli). Son 25 üretim/aşama
// güncellemesini listeler, geri alınca stok da otomatik geri yüklenir.
// =================================================================
function UndoPanel({ data, lang, dir }) {
  const { undoLog, undoAction } = data;
  const [confirmingId, setConfirmingId] = useState(null);

  if (!undoLog) return <LoadingScreen lang={lang} />;

  return (
    <div dir={dir} style={{ maxWidth: 800, margin: "0 auto", padding: "18px 20px 60px", display: "grid", gap: 16 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 }}>
        {t("undoDesc", lang)}
      </div>
      {undoLog.length === 0 && <div style={{ color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{t("noUndoEntries", lang)}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {undoLog.map((entry) => (
          <div key={entry.id} style={{ background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 13, color: COLORS.text }}>
                {entry.urun} · {entry.machine}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textFaint, marginTop: 2 }}>
                {entry.orderId} · {new Date(entry.time).toLocaleString("tr-TR")} · {entry.prevCikan} → {entry.newCikan}
              </div>
            </div>
            {confirmingId === entry.id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: COLORS.textDim }}>{t("undoConfirm", lang)}</span>
                <button onClick={() => setConfirmingId(null)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>{t("cancel", lang)}</button>
                <button onClick={() => { undoAction(entry.id); setConfirmingId(null); }} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${COLORS.accentStop}50`, background: COLORS.accentStopDim, color: COLORS.accentStop, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("undoButton", lang)}</button>
              </div>
            ) : (
              <button onClick={() => setConfirmingId(entry.id)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${COLORS.accentStop}50`, background: "transparent", color: COLORS.accentStop, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                {t("undoButton", lang)}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanPanel({ data, lang, dir }) {
  const { orders, departments } = data;
  if (!orders || !departments) return <LoadingScreen lang={lang} />;
  const allMachines = allMachinesFrom(departments);
  function departmentOf(machineCode) {
    return allMachines.find((m) => m.code === machineCode)?.departmentId || null;
  }

  const columns = [...DEPARTMENT_GROUPS.map((g) => ({ id: g.id, label: g.label(lang) })), { id: "sevkiyat", label: t("shipment", lang) }];

  const byColumn = {};
  columns.forEach((c) => { byColumn[c.id] = []; });

  orders.forEach((o) => {
    if (o.durum === ORDER_STATUS.DELIVERED) return; // teslim edilmiş siparişler panoda gösterilmez
    if (o.durum === ORDER_STATUS.READY) {
      byColumn.sevkiyat.push(o);
      return;
    }
    const stage = currentOrderStage(o);
    const deptId = stage ? departmentOf(stage.makine) : null;
    if (deptId && byColumn[deptId]) byColumn[deptId].push(o);
  });

  function openTrace(orderId) {
    window.location.hash = `/urun/${orderId}`;
  }

  return (
    <div dir={dir} style={{ padding: "18px 20px 60px" }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.textDim, marginBottom: 18 }}>
        {t("kanbanDesc", lang)}
      </div>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
        {columns.map((col) => (
          <div key={col.id} style={{ minWidth: 270, flex: "0 0 270px" }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
              color: COLORS.textFaint, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>{col.label}</span>
              <span style={{
                background: COLORS.bgRaised, color: COLORS.textDim, borderRadius: 99, padding: "1px 8px", fontSize: 10.5,
              }}>
                {byColumn[col.id].length}
              </span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {byColumn[col.id].length === 0 && (
                <div style={{ border: `1px dashed ${COLORS.border}`, borderRadius: 12, padding: "18px 12px", textAlign: "center", color: COLORS.textFaint, fontSize: 11.5, fontFamily: "'Inter', sans-serif" }}>
                  {t("kanbanEmptyColumn", lang)}
                </div>
              )}
              {byColumn[col.id].map((o) => {
                const stages = o.asamalar || [];
                const stage = currentOrderStage(o);
                return (
                  <div
                    key={o.id}
                    onClick={() => openTrace(o.id)}
                    style={{
                      background: COLORS.bgPanel, border: `1px solid ${COLORS.border}`, borderRadius: 12,
                      padding: "12px 14px", cursor: "pointer",
                    }}
                  >
                    <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 13, color: COLORS.text }}>{o.urun}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: COLORS.textFaint, marginTop: 2 }}>
                      {o.id} · {o.musteri}
                    </div>
                    {/* İlerleme çubuğu — her aşama için küçük bir nokta */}
                    <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
                      {stages.map((s) => (
                        <div key={s.id} style={{
                          flex: 1, height: 5, borderRadius: 3,
                          background: s.durum === STAGE_STATUS.DONE ? COLORS.accentRun : s.durum === STAGE_STATUS.RUNNING ? COLORS.accentWarn : COLORS.bgRaised,
                        }} />
                      ))}
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: COLORS.textDim, marginTop: 8 }}>
                      {stage ? `${stage.cikan}/${o.miktar} ${o.birim ? o.birim.toUpperCase() : t("units", lang)}` : `${o.miktar} ${o.birim ? o.birim.toUpperCase() : t("units", lang)} · ${t("readyBadge", lang)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

function ModeSelect({ onSelect, lang, setLang, dir, profile, onSignOut }) {
  const isManager = MANAGER_ROLES.includes(profile?.role);
  return (
    <div dir={dir} style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <ErdoorLogo height={56} style={{ marginBottom: 24 }} />
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 26 }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              style={{
                padding: "7px 14px", borderRadius: 99, cursor: "pointer",
                border: `1px solid ${lang === l.code ? COLORS.brand : COLORS.border}`,
                background: lang === l.code ? COLORS.brandDim : "transparent",
                color: lang === l.code ? COLORS.brand : COLORS.textDim,
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
          {profile && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.textFaint, marginTop: 8 }}>
              {t("signedInAs", lang)}: {profile.full_name || profile.id}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <BigButton onClick={() => onSelect("usta")} style={{ padding: "26px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <Users size={28} color={COLORS.accentRun} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: dir === "rtl" ? "flex-end" : "flex-start" }}>
              <span style={{ fontSize: 18 }}>{t("operatorMode", lang)}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: COLORS.textDim }}>{t("operatorModeDesc", lang)}</span>
            </span>
          </BigButton>
          <BigButton
            onClick={() => isManager && onSelect("yonetici")}
            disabled={!isManager}
            style={{ padding: "26px 20px", display: "flex", alignItems: "center", gap: 16 }}
          >
            <Monitor size={28} color={COLORS.accentWarn} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: dir === "rtl" ? "flex-end" : "flex-start" }}>
              <span style={{ fontSize: 18 }}>{t("managerMode", lang)}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: COLORS.textDim }}>
                {isManager ? t("managerModeDesc", lang) : t("noManagerAccess", lang)}
              </span>
            </span>
          </BigButton>
        </div>
        <div style={{ textAlign: "center", marginTop: 22, fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.textFaint }}>
          {t("sharedNote", lang)}
        </div>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            onClick={onSignOut}
            style={{ background: "none", border: "none", color: COLORS.textFaint, fontFamily: "'Inter', sans-serif", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}
          >
            {t("signOut", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// ANA UYGULAMA
// =================================================================

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  // "#/urun/SIP-102" -> "SIP-102"
  const match = hash.match(/^#\/urun\/(.+)$/);
  return { traceOrderId: match ? decodeURIComponent(match[1]) : null };
}

export default function App() {
  const [mode, setMode] = useState(null);
  const data = useSharedData();
  const { lang, setLang, dir, ready } = useLanguage();
  const auth = useAuth();
  const { traceOrderId } = useHashRoute();

  if (!ready || auth.loading) return <LoadingScreen lang={lang} />;
  if (!auth.session) {
    return <LoginScreen lang={lang} dir={dir} setLang={setLang} onSignIn={auth.signIn} onSignUp={auth.signUp} />;
  }

  // QR kod / doğrudan link ile gelinen izlenebilirlik sayfası — giriş
  // yapmış herhangi bir kullanıcı görebilir, mod seçiminden bağımsızdır.
  if (traceOrderId) {
    return (
      <>
        <FontImports />
        <TraceView orderId={traceOrderId} data={data} lang={lang} dir={dir} onBack={() => { window.location.hash = ""; }} />
      </>
    );
  }

  return (
    <>
      <FontImports />
      {mode === null && (
        <ModeSelect onSelect={setMode} lang={lang} setLang={setLang} dir={dir} profile={auth.profile} onSignOut={auth.signOut} />
      )}
      {mode === "usta" && <UstaMode data={data} onBack={() => setMode(null)} lang={lang} dir={dir} />}
      {mode === "yonetici" && <YoneticiMode data={data} onBack={() => setMode(null)} lang={lang} dir={dir} profile={auth.profile} />}
    </>
  );
}
