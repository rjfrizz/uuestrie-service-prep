// =============================================================================
// Invoice generator: dynamic line items, live totals, autosave, print-to-PDF.
// No backend — the invoice is produced entirely in the browser.
// =============================================================================

const STORAGE_KEY = "uuestrie-invoice-v1";
const form = document.getElementById("invoice-form");
const saveStatus = document.getElementById("save-status");
const rowsEl = document.getElementById("line-rows");
const grandTotalEl = document.getElementById("grand-total");

// money(), esc(), escMulti(), formatDate(), renderInvoice() come from
// js/invoice-render.js (loaded before this file).

// ---- Formatting helpers (DOM-side) -----------------------------------------
function todayISO() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"),
          String(d.getDate()).padStart(2, "0")].join("-");
}
function defaultInvoiceNumber() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
         String(d.getDate()).padStart(2, "0");
}

// ---- Line item rows --------------------------------------------------------
function addRow(item) {
  item = item || { desc: "", qty: "", price: "" };
  const row = document.createElement("div");
  row.className = "li-row";
  row.innerHTML = `
    <input class="li-desc" type="text" placeholder="Description" />
    <input class="li-qty" type="number" min="0" step="any" placeholder="1" />
    <input class="li-price" type="number" min="0" step="0.01" placeholder="0.00" />
    <span class="li-total">—</span>
    <button type="button" class="li-remove" aria-label="Remove line">×</button>`;
  row.querySelector(".li-desc").value = item.desc || "";
  row.querySelector(".li-qty").value = item.qty || "";
  row.querySelector(".li-price").value = item.price || "";
  row.querySelector(".li-remove").addEventListener("click", () => {
    row.remove();
    if (!rowsEl.children.length) addRow();
    recalc();
    scheduleSave();
  });
  rowsEl.appendChild(row);
}

function readRows() {
  return Array.from(rowsEl.querySelectorAll(".li-row")).map((r) => ({
    desc: r.querySelector(".li-desc").value,
    qty: r.querySelector(".li-qty").value,
    price: r.querySelector(".li-price").value,
  }));
}

function recalc() {
  let total = 0;
  rowsEl.querySelectorAll(".li-row").forEach((r) => {
    const qty = parseFloat(r.querySelector(".li-qty").value) || 0;
    const price = parseFloat(r.querySelector(".li-price").value) || 0;
    const line = qty * price;
    total += line;
    r.querySelector(".li-total").textContent = (qty || price) ? money(line) : "—";
  });
  grandTotalEl.textContent = money(total);
  return total;
}

// ---- Read / write whole form ----------------------------------------------
function getData() {
  const data = {};
  ["billToName", "billToAddress", "invoiceNumber", "invoiceDate", "dueDate", "notes"]
    .forEach((k) => { data[k] = form.elements[k].value; });
  data.items = readRows();

  // The "from" block is fixed (not editable) — comes from config.
  const f = CONFIG.invoiceFrom || {};
  data.fromName = f.name || "";
  data.fromAddress = (f.addressLines || []).join("\n");
  data.fromEmail = f.email || "";
  data.fromPhone = f.phone || "";
  return data;
}

function applyDefaults() {
  form.elements["notes"].value = CONFIG.invoiceNotes || "";
  form.elements["invoiceNumber"].value = defaultInvoiceNumber();
  form.elements["invoiceDate"].value = todayISO();
}

function setData(data) {
  Object.entries(data).forEach(([k, v]) => {
    if (k === "items") return;
    const el = form.elements[k];
    if (el) el.value = v;
  });
  rowsEl.innerHTML = "";
  (data.items && data.items.length ? data.items : [null]).forEach((it) => addRow(it));
}

// ---- Autosave --------------------------------------------------------------
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()));
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    saveStatus.textContent = "Saved in this browser at " + t;
    saveStatus.classList.add("saved");
  } catch (e) {
    saveStatus.textContent = "Could not save (browser storage unavailable)";
  }
}
function restore() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch (e) { saved = null; }

  if (saved && Object.keys(saved).length) {
    applyDefaults();      // ensure any new/empty fields have a sensible base
    setData(saved);
    saveStatus.textContent = "Restored your saved progress";
    saveStatus.classList.add("saved");
  } else {
    applyDefaults();
    addRow();
  }
  recalc();
}

// ---- Print to PDF (native browser print) -----------------------------------
let cssCache = null;
function loadCss() {
  if (cssCache != null) return Promise.resolve(cssCache);
  return fetch("css/styles.css").then((r) => r.text())
    .then((t) => (cssCache = t)).catch(() => (cssCache = ""));
}
function printDoc(html, pageCss, title) {
  loadCss().then((css) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title +
      "</title><style>" + css + "\n@page{" + pageCss + "}\nhtml,body{margin:0;background:#fff}</style></head><body>" +
      html + "</body></html>");
    doc.close();
    const win = iframe.contentWindow;
    win.onafterprint = () => setTimeout(() => iframe.remove(), 200);
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => { if (document.body.contains(iframe)) iframe.remove(); }, 60000);
    }, 350);
  });
}

// ---- Buttons & events ------------------------------------------------------
document.getElementById("btn-add-row").addEventListener("click", () => {
  addRow();
  scheduleSave();
});

document.getElementById("btn-invoice").addEventListener("click", () => {
  try {
    const data = getData();
    if (!data.billToName) {
      alert("Please fill in who the invoice is for (Bill to).");
      return;
    }
    if (typeof renderInvoice !== "function") {
      // Usually a stale cache (invoice-render.js didn't load). Ask for a refresh.
      alert("Something didn't load correctly. Please reload the page (hold Shift while refreshing) and try again.");
      return;
    }
    const base = "invoice_" + (data.invoiceNumber || "draft").replace(/[^\w\-]+/g, "-");
    printDoc(renderInvoice(data), "size: letter portrait; margin: 0.7in;", base);
  } catch (err) {
    alert("Sorry — couldn't build the invoice (" + err.message + "). Try reloading the page.");
  }
});

document.getElementById("btn-clear").addEventListener("click", () => {
  if (!confirm("Clear the invoice and your saved progress in this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  rowsEl.innerHTML = "";
  applyDefaults();
  addRow();
  recalc();
  saveStatus.textContent = "Cleared";
  saveStatus.classList.remove("saved");
});

form.addEventListener("input", () => {
  recalc();
  scheduleSave();
});

restore();
