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


## Render'a Canlıya Alma (Deployment) Rehberi

Bu proje Render üzerinde iki farklı yöntemle çalışabilir:

### Yöntem 1: Render Web Service (Tavsiye Edilen - Full Stack)
Express sunucusu sayesinde hem React ön yüzünü hem de `/api/parse-order` (WhatsApp sipariş okuma) yapay zeka servisini birlikte çalıştırır.

1. [dashboard.render.com](https://dashboard.render.com) adresine gidin.
2. **New +** butonuna basıp **Web Service** seçin.
3. GitHub deponuzu (`llbozkurttenes1905-arch/erdoor-uretim-sistemi`) bağlayın.
4. Ayarlar:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start` (veya `node server.js`)
   - **Plan:** Free
5. (Opsiyonel) Environment Variables kısmına:
   - `GEMINI_API_KEY`: Google AI Studio API anahtarınızı ekleyin (Sipariş formu OCR için).
6. **Deploy Web Service** butonuna tıklayın.

### Yöntem 2: Render Static Site (Yalnızca Ön Yüz)
1. **New +** -> **Static Site** seçin.
2. **Build Command:** `npm install && npm run build`
3. **Publish Directory:** `dist`
4. **Rewrite Rule:** `/*` -> `/index.html` ekleyin.
