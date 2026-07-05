// =============================================================================
// Expense reimbursement form: autosave, conditional fields, submit to the
// shared Apps Script web app (formType "reimbursement").
// =============================================================================

const STORAGE_KEY = "uuestrie-reimbursement-v1";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const form = document.getElementById("reimbursement-form");
const saveStatus = document.getElementById("save-status");
const submitStatus = document.getElementById("submit-status");

// ---- Read / write form as a plain object (strings only) --------------------
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
    if (el && el.type !== "file") el.value = v;
  });
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
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {
    saved = {};
  }
  setData(saved);
  if (Object.keys(saved).length) {
    saveStatus.textContent = "Restored your saved progress";
    saveStatus.classList.add("saved");
  }
  updatePaymentFields();
}

// ---- Conditional payment fields --------------------------------------------
function updatePaymentFields() {
  const method = form.elements["paymentMethod"].value;
  document.querySelectorAll("[data-pay-for]").forEach((el) => {
    el.style.display = el.getAttribute("data-pay-for") === method ? "" : "none";
  });
}

// ---- Helpers ---------------------------------------------------------------
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("could not read the file"));
    reader.readAsDataURL(file);
  });
}

function requireBasics(data) {
  if (!data.claimantName || !data.claimantEmail || !data.expenseDate || !data.amount || !data.description) {
    alert("Please fill in your name, email, the date, amount, and what it was for.");
    return false;
  }
  return true;
}

// ---- Submit ----------------------------------------------------------------
document.getElementById("btn-submit").addEventListener("click", async () => {
  const data = getData();
  if (!requireBasics(data)) return;

  if (!CONFIG.sheetEndpoint) {
    submitStatus.textContent = "Submission isn't configured yet (no endpoint set).";
    submitStatus.className = "submit-status warn";
    return;
  }

  submitStatus.textContent = "Sending…";
  submitStatus.className = "submit-status";

  const payload = {
    ...data,
    formType: "reimbursement",
    token: CONFIG.submitToken,
    submittedAt: new Date().toISOString(),
  };

  // Attach an uploaded receipt, if any.
  const fileInput = form.elements["receiptFile"];
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      submitStatus.textContent =
        "That file is larger than 10 MB. Please upload a smaller one, or paste a link instead.";
      submitStatus.className = "submit-status warn";
      return;
    }
    try {
      payload.receiptData = await readFileAsDataURL(file);
      payload.receiptName = file.name;
    } catch (e) {
      submitStatus.textContent = "Couldn't read the file (" + e.message + ").";
      submitStatus.className = "submit-status warn";
      return;
    }
  }

  fetch(CONFIG.sheetEndpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json().catch(() => ({ ok: r.ok })))
    .then((res) => {
      if (res && res.ok !== false) {
        submitStatus.textContent =
          "Thank you! Your reimbursement request was sent to the treasurer.";
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
  updatePaymentFields();
  saveStatus.textContent = "Cleared";
  saveStatus.classList.remove("saved");
  submitStatus.textContent = "";
});

// ---- Wire up ---------------------------------------------------------------
form.addEventListener("input", () => {
  scheduleSave();
  updatePaymentFields();
});
form.addEventListener("change", () => {
  scheduleSave();
  updatePaymentFields();
});

restore();
