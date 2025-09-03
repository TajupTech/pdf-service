import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer";

const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json({ limit: "15mb" }));

const API_KEY = process.env.API_KEY;

app.post("/generate-pdf", async (req, res) => {
  try {
    // 🔒 API key check
    const apiKey = req.headers["x-api-key"];
    if (!API_KEY || apiKey !== API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { html, fileName = "document.pdf", emulateMedia = "print" } = req.body || {};
    if (!html) return res.status(400).json({ error: "Missing `html`" });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    try { await page.emulateMediaType(emulateMedia); } catch {}

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      printBackground: true,
      preferCSSPageSize: true
    });

    await browser.close();

    res.json({
      fileName,
      pdfBase64: pdfBuffer.toString("base64")
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF service running on port ${PORT}`));
