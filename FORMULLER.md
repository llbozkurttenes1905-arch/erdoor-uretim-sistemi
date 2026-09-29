# Verimlilik Sekmesinde Kullanılan Formüller

Bu formüller `App.jsx` içinde `VerimlilikPanel` fonksiyonunda uygulanmıştır. Hepsi gerçek verinizden (siparişler, aşamalar, log kayıtları) hesaplanır — örnek/sahte veri kullanılmaz.

## 1. Darboğaz (Bottleneck)

Her makine için, o makinede bekleyen (henüz tamamlanmamış) toplam iş miktarı:

```
Makine X'in bekleyen işi =
  Σ (sipariş.miktar − aşama.cikan)
  — durumu "bekliyor" olan tüm siparişlerin, o makinedeki ve henüz "tamamlandı" olmayan aşamaları için
```

En yüksek değere sahip makine, o anki gerçek darboğazdır (Kısıtlar Teorisi / Theory of Constraints mantığı).

## 2. Duruş Nedenleri Pareto Analizi

Her duruş kaydının süresi toplanır, nedene göre gruplanır, büyükten küçüğe sıralanır:

```
Neden X'in toplam süresi = Σ (o nedenle kapatılan tüm duruşların süresi)
Kümülatif % = (o ana kadarki toplam süre) / (tüm duruşların toplam süresi) × 100
```

**Not**: Duruş süresi, bir makine durdurulduğu andan (`confirmStop`) duruş nedeninin seçildiği ana kadar geçen süredir. Bu ölçüm bu güncellemeyle eklendi — yani **bu güncellemeden sonra oluşan duruşlar** için doğru çalışır; geçmiş (eski) duruş kayıtlarında süre bilgisi olmadığı için Pareto'ya dahil edilmez.

## 3. Termin Riski (Gereken Hız vs Gerçek Hız)

Her aktif sipariş için:

```
Kalan Adet = Sipariş Miktarı − (son aşamanın ürettiği adet)
Kalan Gün = (Teslim Tarihi − Bugün) / 1 gün

Gereken Hız (adet/gün) = Kalan Adet / Kalan Gün

Gerçek Hız (adet/gün) =
  (Bu siparişle ilgili tüm üretim kayıtlarının toplam adedi)
  / (Bu siparişle ilgili tüm üretim kayıtlarının toplam süresi, gün cinsinden)
```

- **Gerçek Hız ≥ Gereken Hız** → "YETİŞİYOR"
- **Gerçek Hız < Gereken Hız** → "RİSKLİ"
- Bu sipariş için henüz hiç üretim durdurma kaydı yoksa → "henüz üretim kaydı yok" gösterilir (tahmin yürütülmez)
- Kalan gün negatifse → "TESLİM TARİHİ GEÇTİ"

## Henüz Eklenmeyenler (yeni veri girişi gerektirir)

Daha önce konuştuğumuz OEE, FPY (İlk Seferde Doğru Üretim), Önleyici Bakım Takibi ve WIP Limiti gibi metrikler bu güncellemede **yok** — çünkü bunlar için sistemde henüz toplanmayan veriler gerekiyor (örn. ıskarta adedi, bakım geçmişi, ideal çevrim süresi, WIP tavanı tanımı). İstersen bir sonraki adımda bu veri alanlarını ekleyip bu metrikleri de gerçek hale getirebiliriz.


---

# Eylül Ayı İstasyon & Hat Takip Formülleri (Beyaz Tahta Entegrasyonu)

Bu formüller, fabrikadaki üretim beyaz tahtasında **Kırmızı** ve **Mavi** renkli kalemlerle belirlenen standart parametrelerin dijital matematiksel modelidir:

## 1. Bütün İstasyonlar İçin Birim Zaman (Kırmızı Kalem)
Her istasyonda parçanın işlenme çevrim süresi:
```
Birim Zaman (dk/adet) = Toplam İstasyon Süresi / Üretim Adedi
```

## 2. EPS Dolum ve Primer Sarfiyatı (Kırmızı Kalem)
- **Kullanılan Primer Miktarı:** `45 gr / kapı` (standart karkas püskürtme)
- **EPS Blok Hacmi:** `0.042 m³ / kapı`
- **EPS Firesi:** `EPS Sarfiyatı × Fire Oranı (%)`

## 3. EPS CNC Modelleme (Kırmızı Kalem)
- **Kritik Kural:** "Zaman çok önemli" — darboğaz analizi için çevrim süresi sürekli izlenir.
- **Kapasite (adet/saat):** `60 / Birim Süre (dk)`

## 4. Vakum Tezgahı & Ölçü Firesi (Kırmızı & Mavi Kalem)
- **Sabit Ölçü Firesi:** `94 cm sabit` en firesi.
- **Tutkal Tüketimi:** `Kapı Yüzey Alanı (m²) × 120 gr/m²` (Kleiberit / Dorus tutkal modeli).
- **Model Isı Kataloğu:**
  - Ahşap Seren: `135 °C` (90 sn)
  - Köpük Dolgulu (ER600): `125 °C` (75 sn)
  - Okal Dolgulu (ER1004): `140 °C` (110 sn)
  - Melamin (ER2000): `130 °C` (85 sn)

## 5. Pres Hattı Kapasitesi (14 Adet Pres) (Kırmızı & Mavi Kalem)
- **Makine Sayısı:** 14 Pres
- **Çalışma Basıncı:** 100 Bar
- **Baskı Süresi:** 35 Dakika
- **Baskı Başına Kapı:** `14 Pres × 2 Kapı = 28 Kapı / Baskı`
- **Vardiya Kapasitesi:** `(Vardiya Dakikası / 35 dk) × 28 Kapı`

## 6. Dopper & Tıraşlama Bıçak Ömrü Takibi (Mavi Kalem)
- **Formül:** `Kalan Kapı Sayısı = Bıçak Ömrü (5.000 kapı) − İşlenen Kapı Sayısı`
- Hedef limite ulaşıldığında sistem bıçak değişim uyarısı verir.

## 7. Kilit Açma & Delik Eksenleri (Mavi Kalem)
- **Teknik Çizim Eksenleri:** Kol ekseni `122 cm`, Kilit ekseni `114 cm`.
- **Kilit Kanadı Firesi:** Açılan kilit yuvası hatası sonucu hurdaya ayrılan kanat adedi ve fire oranı.

## 8. Paketleme & Palet Metrikleri (Mavi Kalem)
- **Kalite Kontrol Onayı:** Onaylayan yetkili personelin kaydedilmesi.
- **Palet Başına Adet:** Standart `25 adet kapı / palet`.
- **Palet Hacmi:** `(En × Boy × Yükseklik) / 1.000.000 = 2.86 m³`.
- **Palet Ağırlığı:** `Adet × Ortalama Kapı Ağırlığı (25 kg) = 625 kg`.
