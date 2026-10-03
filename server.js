// Snap & Explain backend. Node 18+. Run: npm install && npm start
const express = require("express");
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const API_KEY = process.env.FEATHERLESS_API_KEY;
// Must be a vision-capable model available on Featherless. Check their model list and change if needed.
const MODEL = process.env.MODEL || "google/gemma-3-27b-it";

const SYSTEM = `You help people understand medication labels in plain language (6th-grade reading level).
Rules:
- Base everything on text VISIBLE in the photo (drug name, strength, directions, warnings). Do not guess from pill color or shape alone.
- If the photo shows a loose pill with no readable imprint or label, set "identified" to false and tell the user to ask a pharmacist.
- "how_to_take" must restate the label's directions only. Never invent a dose.
- "key_warning" should be the single most important well-known warning for this drug, or one printed on the label.
- If the image is not medication, set "identified" to false.
Reply with ONLY JSON, no markdown:
{"identified":bool,"name":string,"what_it_is":string,"how_to_take":string,"key_warning":string,"confidence":"high"|"medium"|"low","read_from_label":string}`;

app.post("/api/identify", async (req, res) => {
  try {
    const { image } = req.body; // data URL, e.g. data:image/jpeg;base64,...
    if (!image || !image.startsWith("data:image/")) return res.status(400).json({ error: "Send an image." });
    if (!API_KEY) return res.status(500).json({ error: "Server is missing FEATHERLESS_API_KEY." });

    const r = await fetch("https://api.featherless.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: [
            { type: "text", text: "Explain this medication." },
            { type: "image_url", image_url: { url: image } },
          ] },
        ],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `Model error (${r.status}). Check MODEL and your key.` });
    const data = await r.json();
    const text = (data.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
    res.json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: "Couldn't read that photo. Try again with the label in focus." });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("http://localhost:3000"));
