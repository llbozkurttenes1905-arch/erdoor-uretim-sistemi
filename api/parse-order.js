// api/parse-order.js
// -----------------------------------------------------------------
// Vercel Serverless Function — WhatsApp sipariş formu OCR/okuma.
//
// Frontend (App.jsx) buraya şunu gönderiyor:
//   POST /api/parse-order
//   { imageBase64: "<base64>", mimeType: "image/jpeg" | "application/pdf" | ... }
//
// Bu fonksiyon görseli/PDF'i Google Gemini'ye gönderip, siparişi şu
// biçimde JSON olarak geri döndürür:
//   { musteri, teslimTarihi, kalemler: [{ urun, miktar, birim }] }
//
// GEREKLİ AYAR (Vercel):
//   Project Settings → Environment Variables → GEMINI_API_KEY
//   Değeri: https://aistudio.google.com/apikey adresinden alınan anahtar
// -----------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Sadece POST istekleri desteklenir" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("parse-order: GEMINI_API_KEY tanımlı değil");
    return res.status(500).json({ error: "Sunucu yapılandırma hatası: GEMINI_API_KEY eksik" });
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 alanı zorunlu" });
  }

  const prompt = `Bu görsel/PDF, WhatsApp üzerinden gelen elle yazılmış veya
yazılı bir sipariş formudur. Görüntüyü dikkatlice oku ve içeriğini SADECE
aşağıdaki JSON şemasına uygun, başka hiçbir metin eklemeden döndür:

{
  "musteri": "müşteri/firma adı (bulunamazsa boş string)",
  "teslimTarihi": "YYYY-MM-DD formatında teslim/termin tarihi (bulunamazsa boş string)",
  "kalemler": [
    { "urun": "ürün/model adı", "miktar": sayı, "birim": "adet" }
  ]
}

Kurallar:
- Sadece geçerli JSON döndür, markdown code fence (\`\`\`) kullanma, açıklama ekleme.
- Tarihi anlayabildiğin her formattan (gg.aa.yyyy, gg/aa/yyyy, vb.) YYYY-MM-DD'ye çevir.
- Miktarı sayıya çevir (virgül/nokta temizle).
- Birim belirtilmemişse "adet" kullan.
- Emin olmadığın alanları boş bırak, uydurma bilgi ekleme.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s zaman aşımı

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );
    clearTimeout(timeout);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("parse-order: Gemini API hatası", geminiRes.status, errText);
      return res.status(502).json({ error: `AI servisi hata döndü (${geminiRes.status})` });
    }

    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error("parse-order: Gemini yanıtında metin yok", JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: "AI servisi boş yanıt döndürdü" });
    }

    let parsed;
    try {
      // Gemini bazen kod bloğu içine sarabiliyor; temizleyip parse et.
      const cleaned = rawText.trim().replace(/^```json\s*|```$/g, "");
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("parse-order: JSON parse hatası", rawText.slice(0, 500));
      return res.status(502).json({ error: "AI yanıtı okunamadı (geçersiz JSON)" });
    }

    return res.status(200).json({
      musteri: parsed.musteri || "",
      teslimTarihi: parsed.teslimTarihi || "",
      kalemler: Array.isArray(parsed.kalemler) ? parsed.kalemler : [],
    });
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("parse-order: zaman aşımı");
      return res.status(504).json({ error: "AI servisi zamanında yanıt vermedi" });
    }
    console.error("parse-order: beklenmeyen hata", err);
    return res.status(500).json({ error: "Sunucu hatası: " + (err.message || "bilinmeyen hata") });
  }
}
