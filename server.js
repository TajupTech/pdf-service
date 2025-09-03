import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import puppeteer from "puppeteer-core";   // 👈 or puppeteer if you installed full
import chromium from "@sparticuz/chromium"; // 👈 for Render/Lambda compatible Chromium
import axios from "axios";

const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json({ limit: "20mb" }));

const API_KEY = process.env.API_KEY;

app.post("/generate-pdf", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!API_KEY || apiKey !== API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { html, fileName = "document.pdf", uploadUrl, uploadToken } = req.body;
    if (!html || !uploadUrl || !uploadToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🟢 Launch Chromium (Render requires @sparticuz/chromium)
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60000 });

    // 🟢 Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      printBackground: true,
    });

    await browser.close();

    // 🟢 Upload to Wix (Tus protocol requires PUT finalize)
    await axios.post(uploadUrl, pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Upload-Token": uploadToken, // required by Wix
      },
      maxBodyLength: Infinity,
    });

    // Finalize upload
    const finalize = await axios.put(
      `${uploadUrl}/${uploadToken}`,
      {},
      { params: { filename: fileName } }
    );

    // 🟢 Respond with Wix file URL
    res.json({ url: finalize.data.file.url });
  } catch (err) {
    console.error("PDF generation/upload error:", err);
    res.status(500).json({ error: "Failed to generate and upload PDF" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF service running on port ${PORT}`));
