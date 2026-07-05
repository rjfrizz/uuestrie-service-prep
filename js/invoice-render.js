// =============================================================================
// Pure invoice rendering (no DOM). Given a data object, returns the invoice
// HTML string. Kept separate from invoice.js so it can be tested in isolation.
// =============================================================================

const SYM = (typeof CONFIG !== "undefined" && CONFIG.currencySymbol) || "$";

function money(n) {
  const v = typeof n === "number" ? n : parseFloat(n);
  const num = isFinite(v) ? v : 0;
  return SYM + num.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escMulti(s) { return esc(s).replace(/\n/g, "<br>"); }

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA",
    { year: "numeric", month: "long", day: "numeric" });
}

function renderInvoice(data) {
  // The "from" block is fixed to the church; fall back to config if not supplied.
  const cf = (typeof CONFIG !== "undefined" && CONFIG.invoiceFrom) || {};
  const fromName = data.fromName || cf.name || "";
  const fromAddress = data.fromAddress || (cf.addressLines || []).join("\n");
  const fromEmail = data.fromEmail || cf.email || "";
  const fromPhone = data.fromPhone || cf.phone || "";

  const items = (data.items || []).filter((it) => it.desc || it.qty || it.price);
  let total = 0;
  const rows = items.map((it) => {
    const qty = parseFloat(it.qty) || 0;
    const price = parseFloat(it.price) || 0;
    const line = qty * price;
    total += line;
    return `<tr>
      <td class="d">${escMulti(it.desc)}</td>
      <td class="q">${it.qty ? esc(it.qty) : ""}</td>
      <td class="p">${it.price ? money(price) : ""}</td>
      <td class="a">${money(line)}</td>
    </tr>`;
  }).join("");

  const due = data.dueDate
    ? `<div><span class="lbl">Due:</span> ${esc(formatDate(data.dueDate))}</div>` : "";

  return `
    <div class="doc invoice-doc">
      <div class="inv-top">
        <div class="inv-from">
          <div class="inv-from-name">${esc(fromName)}</div>
          <div class="inv-from-lines">${escMulti(fromAddress)}</div>
          ${fromEmail ? `<div>${esc(fromEmail)}</div>` : ""}
          ${fromPhone ? `<div>${esc(fromPhone)}</div>` : ""}
        </div>
        <div class="inv-meta">
          <div class="inv-title">INVOICE</div>
          <div><span class="lbl">No.:</span> ${esc(data.invoiceNumber)}</div>
          <div><span class="lbl">Date:</span> ${esc(formatDate(data.invoiceDate))}</div>
          ${due}
        </div>
      </div>

      <div class="inv-billto">
        <div class="lbl">Bill to</div>
        <div class="inv-billto-name">${esc(data.billToName)}</div>
        <div>${escMulti(data.billToAddress)}</div>
      </div>

      <table class="inv-table">
        <thead>
          <tr><th class="d">Description</th><th class="q">Qty</th>
              <th class="p">Unit price</th><th class="a">Amount</th></tr>
        </thead>
        <tbody>${rows || `<tr><td class="d" colspan="4">(no line items)</td></tr>`}</tbody>
        <tfoot>
          <tr><td colspan="3" class="total-lbl">Total</td>
              <td class="a total-amt">${money(total)}</td></tr>
        </tfoot>
      </table>

      ${data.notes ? `<div class="inv-notes">${escMulti(data.notes)}</div>` : ""}
    </div>`;
}
