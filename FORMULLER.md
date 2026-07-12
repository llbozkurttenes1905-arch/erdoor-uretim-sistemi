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
