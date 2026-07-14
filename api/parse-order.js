// api/parse-order.js
//
// Vercel serverless function — WhatsApp'tan gelen sipariş fotoğrafını
// veya PDF'ini Google Gemini (görüntü anlama) ile okuyup App.jsx'teki
// sipariş formunun beklediği yapıya çevirir.
//
// ÖNEMLİ — GÜVENLİK:
//   Gemini anahtarınızı ASLA frontend (App.jsx, src/*) içine yazmayın.
//   Bu dosya sunucuda çalışır, anahtar tarayıcıya hiç gönderilmez.
//   Vercel Dashboard > Project > Settings > Environment Variables:
//     GEMINI_API_KEY -> Google AI Studio'dan aldığınız anahtar
//   Sohbette bir kere paylaştığınız anahtarı Google AI Studio'dan iptal
//   edip yeni bir tane oluşturmanızı öneririm; sadece buraya yeni anahtarı yazın.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Sen bir üretim/sipariş asistanısın. Sana WhatsApp üzerinden gelmiş bir
sipariş formu görüntüsü veya PDF'i verilecek (fotoğraf, ekran görüntüsü ya da taranmış form
olabilir). Görevin içindeki bilgileri çıkarıp SADECE aşağıdaki JSON şemasına uygun bir nesne
döndürmek. Başka hiçbir metin, açıklama veya markdown ekleme.

Şema:
{
  "musteri": string | null,        // müşteri/firma adı
  "teslimTarihi": string | null,   // YYYY-MM-DD formatında; "10 gün içinde" gibi göreli ifadeleri
                                     // bugünün tarihine göre hesapla
  "kalemler": [                     // görüntüdeki her sipariş satırı için bir öğe
    { "urun": string, "miktar": number, "birim": string }  // birim: "adet", "takım" vb.
  ],
  "eminMi": boolean,                // görüntü gerçekten bir sipariş formu/mesajı mı
  "belirsizAlanlar": string[]       // emin olamadığın alanların listesi (kullanıcıya sorulacak)
}

Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}
Sayılarda binlik ayraç kullanma. Emin olmadığın alanı null bırak, uydurma.
Görüntüde birden fazla ürün kalemi varsa hepsini "kalemler" dizisine ekle.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY tanımlı değil (Vercel env vars)" });

  const { imageBase64, mimeType, message } = req.body || {};
  if (!imageBase64 && !message) {
    return res.status(400).json({ error: "imageBase64 veya message alanlarından biri zorunlu" });
  }

  try {
    const parts = [];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } });
    }
    if (message) {
      parts.push({ text: message });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error", errText);
      return res.status(502).json({ error: "AI servisi yanıt vermedi" });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: "AI yanıtı boş döndü" });

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "AI yanıtı JSON olarak okunamadı" });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("parse-order error", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
}
