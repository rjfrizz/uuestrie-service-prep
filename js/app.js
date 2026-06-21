// =============================================================================
// App logic: defaults, auto-save/restore, conditional fields, PDF export, submit
// =============================================================================

const STORAGE_KEY = "uuestrie-service-prep-v1";
const form = document.getElementById("service-form");
const saveStatus = document.getElementById("save-status");
const submitStatus = document.getElementById("submit-status");

// Fields whose default comes from CONFIG when the form is empty.
const DEFAULTS = {
  serviceTime: CONFIG.defaultTime,
  location: CONFIG.defaultLocation,
  musicians: CONFIG.defaultMusicians,
};

// ---- Read / write the form as a plain object ------------------------------
// Only string values are collected — file inputs are handled separately so a
// large image is never written to localStorage.
function getData() {
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (typeof v === "string") data[k] = v;
  });
  return data;
}

function setData(data) {
  Object.entries(data).forEach(([k, v]) => {
    const el = form.elements[k];
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = v;
  });
}

// ---- Auto-save -------------------------------------------------------------
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
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {
    saved = {};
  }
  // Apply CONFIG defaults first, then anything previously saved overrides them.
  setData({ ...DEFAULTS, ...saved });
  if (Object.keys(saved).length) {
    saveStatus.textContent = "Restored your saved progress";
    saveStatus.classList.add("saved");
  }
  updateConditionalFields();
  updateHymnFields();
}

// ---- Conditional fields (speaker name/bio depend on service type) ----------
function updateConditionalFields() {
  const type = form.elements["serviceType"].value;
  document.querySelectorAll("[data-show-for]").forEach((el) => {
    const types = el.getAttribute("data-show-for").split(/\s+/);
    el.style.display = types.includes(type) ? "" : "none";
  });
}

// ---- Omit / "musicians choose" interactions --------------------------------
// Hymns: Omit wins over "musicians choose" wins over a typed title.
// Words: Omit dims the textarea.
function updateHymnFields() {
  [
    ["openingSong", "openingSongByMusicians", "omitOpeningSong"],
    ["closingSong", "closingSongByMusicians", "omitClosingSong"],
  ].forEach(([inputName, byName, omitName]) => {
    const omit = form.elements[omitName].checked;
    const by = form.elements[byName].checked;
    const input = form.elements[inputName];
    const byEl = form.elements[byName];

    // Omit greys out the "musicians choose" option entirely.
    byEl.disabled = omit;
    byEl.closest(".check").style.opacity = omit ? 0.5 : "";

    input.readOnly = omit || by; // readOnly (not disabled) so its value still saves
    input.classList.toggle("muted-input", omit || by);
    input.placeholder = omit
      ? "Omitted"
      : by
      ? "Musicians' choice"
      : "Title (and number, if known)";
  });

  [
    ["openingWords", "omitOpeningWords"],
    ["closingWords", "omitClosingWords"],
  ].forEach(([inputName, omitName]) => {
    const omit = form.elements[omitName].checked;
    const input = form.elements[inputName];
    input.readOnly = omit;
    input.classList.toggle("muted-input", omit);
  });
}

// ---- PDF generation (native browser print → "Save as PDF") -----------------
// We render each document into a hidden, isolated iframe with its own @page
// rule, then call print(). This gives crisp vector PDFs with selectable text
// and reliable pagination across all browsers (no canvas-size limits).

let cssCache = null;
function loadCss() {
  if (cssCache != null) return Promise.resolve(cssCache);
  return fetch("css/styles.css")
    .then((r) => r.text())
    .then((t) => (cssCache = t))
    .catch(() => (cssCache = ""));
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
    doc.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
        title +
        "</title><style>" +
        css +
        "\n.render-target{position:static;left:auto;}" +
        "\n@page{" + pageCss + "}" +
        "\nhtml,body{margin:0;background:#fff}</style></head><body>" +
        html +
        "</body></html>"
    );
    doc.close();

    const win = iframe.contentWindow;
    win.onafterprint = function () {
      setTimeout(function () { iframe.remove(); }, 200);
    };
    // Let layout settle (fonts/widths) before opening the print dialog.
    setTimeout(function () {
      win.focus();
      win.print();
      // Safety net if onafterprint never fires (some browsers).
      setTimeout(function () {
        if (document.body.contains(iframe)) iframe.remove();
      }, 60000);
    }, 350);
  });
}

function fileBase(data) {
  const d = (data.date || "").trim();
  const t = (data.serviceTitle || "service").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-");
  return (d ? d + "_" : "") + (t || "service");
}

function requireBasics(data) {
  if (!data.serviceTitle || !data.serviceLeader || !data.date) {
    alert("Please fill in at least the service title, date, and service leader first.");
    return false;
  }
  return true;
}

document.getElementById("btn-script").addEventListener("click", () => {
  const data = getData();
  if (!requireBasics(data)) return;
  printDoc(
    renderScript(data),
    "size: letter portrait; margin: 0.6in 0.7in;",
    fileBase(data) + "_script"
  );
});

document.getElementById("btn-oos").addEventListener("click", () => {
  const data = getData();
  if (!requireBasics(data)) return;
  printDoc(
    renderOrderOfService(data),
    "size: letter landscape; margin: 0.4in;",
    fileBase(data) + "_order-of-service"
  );
});

// ---- Submit to Google Sheet ------------------------------------------------
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("could not read the image file"));
    reader.readAsDataURL(file);
  });
}

document.getElementById("btn-submit").addEventListener("click", async () => {
  const data = getData();
  if (!requireBasics(data)) return;

  if (!CONFIG.sheetEndpoint) {
    submitStatus.textContent =
      "Submission isn't configured yet, but your PDFs still work. (Set CONFIG.sheetEndpoint to enable.)";
    submitStatus.className = "submit-status warn";
    return;
  }

  submitStatus.textContent = "Sending…";
  submitStatus.className = "submit-status";

  const payload = {
    ...data,
    token: CONFIG.submitToken,
    submittedAt: new Date().toISOString(),
  };

  // Attach an uploaded promotional image, if one was chosen.
  const fileInput = form.elements["promoImageFile"];
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (file) {
    if (file.size > MAX_IMAGE_BYTES) {
      submitStatus.textContent =
        "That image is larger than 10 MB. Please upload a smaller file, or paste a link instead.";
      submitStatus.className = "submit-status warn";
      return;
    }
    try {
      payload.promoImageData = await readFileAsDataURL(file); // data: URL
      payload.promoImageName = file.name;
    } catch (e) {
      submitStatus.textContent = "Couldn't read the image (" + e.message + ").";
      submitStatus.className = "submit-status warn";
      return;
    }
  }

  // Apps Script web apps accept a simple (no-preflight) POST.
  fetch(CONFIG.sheetEndpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json().catch(() => ({ ok: r.ok })))
    .then((res) => {
      if (res && res.ok !== false) {
        submitStatus.textContent = "Thank you! Your service details were sent to the Programme Team.";
        submitStatus.className = "submit-status ok";
      } else {
        throw new Error(res && res.error ? res.error : "Unknown error");
      }
    })
    .catch((err) => {
      submitStatus.textContent =
        "Couldn't send (" + err.message + "). Your answers are still saved in this browser — try again later.";
      submitStatus.className = "submit-status warn";
    });
});

// ---- Clear -----------------------------------------------------------------
document.getElementById("btn-clear").addEventListener("click", () => {
  if (!confirm("Clear the form and your saved progress in this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  form.reset();
  setData(DEFAULTS);
  updateConditionalFields();
  updateHymnFields();
  saveStatus.textContent = "Cleared";
  saveStatus.classList.remove("saved");
  submitStatus.textContent = "";
});

// ---- Wire up ---------------------------------------------------------------
form.addEventListener("input", () => {
  scheduleSave();
  updateConditionalFields();
  updateHymnFields();
});
form.addEventListener("change", () => {
  scheduleSave();
  updateConditionalFields();
  updateHymnFields();
});

restore();
