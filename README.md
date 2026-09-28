# Üretim Sistemi

Bu klasör, Üretim Takip Sistemi'nin bağımsız (Claude.ai dışında çalışan) sürümüdür.
Veriler tarayıcının yerel hafızasında (localStorage) saklanır. Harici bir veritabanı veya sunucu gerektirmez, pasife alınma veya kesinti yaşanmaz.

## Bu proje ne içeriyor?
- `src/App.jsx` — uygulamanın tüm kodu (Usta Modu, Yönetici Modu, Tanımlar, Excel'e Aktar, çok dilli destek)
- `src/main.jsx` — uygulamayı başlatan giriş noktası
- `index.html` — tarayıcının açacağı sayfa
- `package.json` — gerekli kütüphanelerin listesi (React, Supabase client, xlsx, lucide-react)

## Sıradaki adım: Vercel'e yayınlama
Bu klasörü GitHub'a yükleyip Vercel'e bağlayacağız — adımlar ayrıca anlatılacak.

## Yerel olarak çalıştırmak isterseniz (opsiyonel)
```
npm install
npm run dev
```
