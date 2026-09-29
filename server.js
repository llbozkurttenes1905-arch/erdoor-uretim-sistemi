import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import parseOrderHandler from "./api/parse-order.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser (50mb limit for PDF and image OCR uploads)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// API route for WhatsApp / OCR order parsing
app.all("/api/parse-order", async (req, res) => {
  try {
    await parseOrderHandler(req, res);
  } catch (err) {
    console.error("API error in parse-order:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Sunucu hatası" });
    }
  }
});

// Serve compiled static files from Vite build (dist)
// Serve public static assets (logo, favicon etc.)
app.use(express.static(path.join(__dirname, "public")));

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback for React routing
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Erdoor Üretim Sistemi sunucusu ${PORT} portunda aktif.`);
});
