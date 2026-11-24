// Proxy same-origin ke NexaDev supaya tidak kena CORS di browser.
module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || "").slice(0, 4000);
  if (!q.trim()) return res.status(400).json({ status: false, error: "q kosong" });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch("https://api.nexadev.my.id/ai/gpt4?q=" + encodeURIComponent(q), { signal: ctrl.signal });
    const body = await r.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ status: false, error: "upstream gagal" });
  } finally { clearTimeout(timer); }
};
