(() => {
"use strict";
const API = "/api/ai";
const KEY = "tracgpt.chats", SKEY = "tracgpt.settings", TIMEOUT = 30000;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const SUGGESTIONS = [
  ["code-2", "Explain programming concepts", "Jelaskan konsep pemrograman berikut dengan sederhana dan beri contoh kode: "],
  ["pen-line", "Write and improve text", "Tolong tulis dan perbaiki teks berikut: "],
  ["lightbulb", "Generate creative ideas", "Berikan 10 ide kreatif tentang: "],
  ["file-text", "Summarize long documents", "Ringkas dokumen berikut menjadi poin-poin utama: "],
  ["languages", "Translate languages", "Terjemahkan teks berikut ke bahasa Inggris: "],
  ["help-circle", "Help me understand something", "Bantu saya memahami hal ini dengan bahasa sederhana: "]
];
const TOOLS = [
  ["file-text", "Text Summarizer", "Ringkas teks berikut secara singkat dan jelas, pertahankan poin utama:"],
  ["repeat", "Text Rewriter", "Tulis ulang teks berikut dengan kata-kata berbeda tanpa mengubah maknanya:"],
  ["spell-check", "Grammar Improvement", "Perbaiki tata bahasa, ejaan, dan tanda baca teks berikut. Tampilkan hasil perbaikan lalu daftar perubahannya:"],
  ["languages", "Text Translator", "Terjemahkan teks berikut ke bahasa Inggris (jika sudah bahasa Inggris, terjemahkan ke bahasa Indonesia):"],
  ["maximize-2", "Paragraph Expander", "Kembangkan teks berikut menjadi paragraf yang lebih panjang dan detail:"],
  ["feather", "Creative Writing", "Buat tulisan kreatif (cerita atau puisi) berdasarkan tema berikut:"],
  ["book-open", "Explain Text", "Jelaskan maksud teks berikut dengan bahasa sederhana:"],
  ["lightbulb", "Generate Ideas", "Berikan 10 ide berdasarkan topik berikut:"]
];

let chats = load(KEY, []);
let settings = Object.assign({ theme: "dark", anim: true }, load(SKEY, {}));
let currentId = null, busy = false, tool = null, ctrl = null;

function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch { toast("Penyimpanan browser penuh"); } }
function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch {} }
const cur = () => chats.find(c => c.id === currentId);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtTime = t => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const icons = () => window.lucide && lucide.createIcons();

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}
function setStatus(state, text) {
  const s = $("#status"); s.className = "status " + state; $("span", s).textContent = text;
}

/* ---------- API ---------- */
async function askAI(question) {
  if (!navigator.onLine) throw new Error("Koneksi internet terputus. Periksa jaringanmu lalu coba lagi.");
  ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), TIMEOUT);
  try {
    let res;
    try { res = await fetch(`${API}?q=${encodeURIComponent(question)}`, { signal: ctrl.signal }); }
    catch (e) {
      if (ctrl.signal.aborted && ctrl.signal.reason === "timeout") throw new Error("Server AI terlalu lama merespons (timeout). Coba lagi.");
      if (ctrl.signal.aborted) throw new Error("Permintaan dibatalkan.");
      throw new Error("API tidak dapat dihubungi. Server mungkin sedang down atau memblokir akses dari browser (CORS).");
    }
    if (res.status === 502 || res.status === 504) throw new Error("Server NexaDev tidak merespons. Coba lagi sebentar lagi.");
    if (!res.ok) throw new Error(`Server AI mengembalikan error (HTTP ${res.status}).`);
    let json;
    try { json = await res.json(); } catch { throw new Error("Respons dari server bukan JSON yang valid."); }
    if (!json || json.status !== true) throw new Error("API mengembalikan status gagal. Coba lagi nanti.");
    const msg = json.data && json.data.message;
    if (typeof msg !== "string" || !msg.trim()) throw new Error("API tidak memberikan jawaban. Coba ubah pertanyaanmu.");
    return msg;
  } finally { clearTimeout(timer); ctrl = null; }
}

/* ---------- Chat ---------- */
function renderMd(el, text) {
  el.innerHTML = DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true }));
  $$("a", el).forEach(a => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
}
function addMsg(m, idx) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (m.role === "user" ? "user" : "ai");
  const b = document.createElement("div");
  b.className = "bubble" + (m.error ? " err" : "");
  if (m.role === "user" || m.error) b.textContent = m.text; else renderMd(b, m.text);
  const meta = document.createElement("div"); meta.className = "meta";
  const time = document.createElement("span"); time.textContent = fmtTime(m.time); meta.append(time);
  if (m.role === "ai" && !m.error) {
    const cp = document.createElement("button");
    cp.innerHTML = '<i data-lucide="copy"></i>Copy';
    cp.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(m.text); toast("Jawaban disalin"); } catch { toast("Gagal menyalin"); }
    });
    meta.append(cp);
  }
  wrap.append(b, meta); $("#messages").append(wrap); icons();
  return wrap;
}
function renderChat() {
  const c = cur(), box = $("#messages"); box.replaceChildren();
  const has = c && c.messages.length > 0;
  $("#hero").classList.toggle("gone", !!has);
  $("#chatActions").hidden = !has;
  if (has) c.messages.forEach(addMsg);
  scrollDown(false);
}
function scrollDown(smooth = true) {
  const s = $("#scroll"); s.style.scrollBehavior = smooth ? "smooth" : "auto"; s.scrollTop = s.scrollHeight;
}
function setBusy(v) {
  busy = v; $("#regen").disabled = v; updateSend(); setStatus(v ? "busy" : "ok", v ? "Thinking…" : "Online");
}
function updateSend() {
  const n = $("#input").value.length;
  $("#count").textContent = `${n} / 4000`;
  $("#send").disabled = busy || !$("#input").value.trim();
}
function typing() {
  const w = document.createElement("div"); w.className = "msg ai";
  w.innerHTML = '<div class="bubble"><div class="dots"><i></i><i></i><i></i></div></div>';
  $("#messages").append(w); scrollDown(); return w;
}
async function ask(text) {
  const c = cur(); setBusy(true);
  const t = typing();
  try {
    const answer = await askAI(text);
    c.messages.push({ role: "ai", text: answer, time: Date.now() });
    setStatus("ok", "Online");
  } catch (e) {
    c.messages.push({ role: "ai", text: e.message || "Terjadi kesalahan tidak dikenal.", time: Date.now(), error: true });
    setStatus("err", "Error");
  }
  t.remove(); save(); setBusy(false); setStatus(c.messages.at(-1).error ? "err" : "ok", c.messages.at(-1).error ? "Error" : "Online");
  if (cur() === c) { renderChat(); scrollDown(); }
}
function send(text) {
  text = (text || "").trim();
  if (!text || busy) return;
  show("chat");
  let c = cur();
  if (!c) { c = { id: uid(), title: text.slice(0, 48), messages: [], created: Date.now() }; chats.unshift(c); currentId = c.id; }
  c.messages.push({ role: "user", text, time: Date.now() });
  save(); renderChat();
  $("#input").value = ""; autoGrow(); updateSend();
  ask(text);
}
function newChat() {
  if (busy && ctrl) ctrl.abort("cancel");
  currentId = null; renderChat(); show("chat"); $("#input").focus(); closeMobile();
}
function regenerate() {
  const c = cur(); if (!c || busy) return;
  while (c.messages.length && c.messages.at(-1).role === "ai") c.messages.pop();
  const last = c.messages.at(-1); if (!last) return;
  renderChat(); ask(last.text);
}

/* ---------- Views ---------- */
const TITLES = { chat: "Chat", tools: "Text Tools", history: "History", settings: "Settings" };
function show(v) {
  $$(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + v));
  $$(".nav").forEach(n => n.classList.toggle("active", n.dataset.view === v));
  $("#pageTitle").textContent = TITLES[v];
  if (v === "history") renderHistory();
  closeMobile();
}
function renderHistory() {
  const box = $("#historyList"); box.replaceChildren();
  if (!chats.length) { box.innerHTML = '<p class="empty">Belum ada percakapan.</p>'; return; }
  chats.forEach(c => {
    const row = document.createElement("div"); row.className = "hitem glass";
    const open = document.createElement("button"); open.className = "hopen";
    const b = document.createElement("b"); b.textContent = c.title;
    const s = document.createElement("small"); s.textContent = `${c.messages.length} pesan · ${new Date(c.created).toLocaleDateString("id-ID")}`;
    open.append(b, s);
    open.addEventListener("click", () => { currentId = c.id; renderChat(); show("chat"); });
    const del = document.createElement("button"); del.className = "icon"; del.setAttribute("aria-label", "Hapus percakapan");
    del.innerHTML = '<i data-lucide="trash-2"></i>';
    del.addEventListener("click", () => {
      chats = chats.filter(x => x.id !== c.id); if (currentId === c.id) { currentId = null; renderChat(); }
      save(); renderHistory(); toast("Percakapan dihapus");
    });
    row.append(open, del); box.append(row);
  });
  icons();
}
function closeMobile() { if (innerWidth <= 860) document.body.classList.add("closed"); }

/* ---------- Settings ---------- */
function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.body.classList.toggle("noanim", !settings.anim);
  $("#swTheme").setAttribute("aria-checked", settings.theme === "dark");
  $("#swAnim").setAttribute("aria-checked", settings.anim);
}
function toggleTheme() { settings.theme = settings.theme === "dark" ? "light" : "dark"; saveSettings(); applySettings(); }

/* ---------- Input ---------- */
function autoGrow() { const t = $("#input"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 180) + "px"; }

function init() {
  // cards
  SUGGESTIONS.forEach(([ic, label, prefix]) => {
    const b = document.createElement("button"); b.className = "card";
    b.innerHTML = `<i data-lucide="${ic}"></i><span></span>`; $("span", b).textContent = label;
    b.addEventListener("click", () => { const i = $("#input"); i.value = prefix; autoGrow(); updateSend(); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
    $("#cards").append(b);
  });
  TOOLS.forEach((t, i) => {
    const b = document.createElement("button"); b.className = "card";
    b.innerHTML = `<i data-lucide="${t[0]}"></i><span></span>`; $("span", b).textContent = t[1];
    b.addEventListener("click", () => {
      tool = i; $$("#toolCards .card").forEach((c, j) => c.classList.toggle("sel", j === i));
      $("#toolLabel").textContent = t[1] + " — tempel teks di bawah"; $("#toolRun").disabled = !$("#toolText").value.trim(); $("#toolText").focus();
    });
    $("#toolCards").append(b);
  });
  $("#toolText").addEventListener("input", () => { $("#toolRun").disabled = tool === null || !$("#toolText").value.trim(); });
  $("#toolRun").addEventListener("click", () => {
    if (tool === null || busy) return;
    const text = $("#toolText").value.trim(); if (!text) return;
    currentId = null; send(`${TOOLS[tool][2]}\n\n${text}`); $("#toolText").value = ""; $("#toolRun").disabled = true;
  });

  $("#input").addEventListener("input", () => { autoGrow(); updateSend(); });
  $("#input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($("#input").value); }
  });
  $("#send").addEventListener("click", () => send($("#input").value));
  $("#regen").addEventListener("click", regenerate);
  $("#clear").addEventListener("click", () => {
    const c = cur(); if (!c) return;
    if (busy && ctrl) ctrl.abort("cancel");
    chats = chats.filter(x => x.id !== c.id); currentId = null; save(); renderChat(); toast("Percakapan dihapus");
  });
  $("#newChat").addEventListener("click", newChat);
  $$("[data-view]").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));
  $("#menuBtn").addEventListener("click", () => document.body.classList.toggle("closed"));
  $("#scrim").addEventListener("click", closeMobile);
  $("#themeBtn").addEventListener("click", toggleTheme);
  $("#swTheme").addEventListener("click", toggleTheme);
  $("#swAnim").addEventListener("click", () => { settings.anim = !settings.anim; saveSettings(); applySettings(); });
  $("#clearAll").addEventListener("click", () => {
    if (!chats.length) return toast("Riwayat sudah kosong");
    if (!confirm("Hapus semua riwayat chat?")) return;
    chats = []; currentId = null; save(); renderChat(); toast("Riwayat dihapus");
  });
  addEventListener("online", () => setStatus("ok", "Online"));
  addEventListener("offline", () => setStatus("err", "Offline"));

  if (innerWidth <= 860) document.body.classList.add("closed");
  applySettings(); renderChat(); updateSend(); icons();
  if (!navigator.onLine) setStatus("err", "Offline");
}
if (!window.marked || !window.DOMPurify) {
  document.addEventListener("DOMContentLoaded", () => { document.body.insertAdjacentHTML("afterbegin", '<p style="padding:20px">Gagal memuat library (Marked/DOMPurify). Periksa koneksi internet lalu muat ulang.</p>'); });
} else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
})();
