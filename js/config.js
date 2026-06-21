// =============================================================================
// UU Estrie Service Prep — Configuration
// Edit the values in this file to change defaults. No other file needs editing.
// =============================================================================

const CONFIG = {
  // -- Google Sheet submission ------------------------------------------------
  // Paste the Web App URL you get from deploying apps-script/Code.gs here.
  // Leave it as "" to disable Sheet submission (the form still makes PDFs).
  sheetEndpoint: "https://script.google.com/macros/s/AKfycbwkRu6cxFFrkldfM9m6ar85uPBzdBYOeuOKKxPNb27Lbc-mONlCnnsn52jZ8g9rluj2Hw/exec",

  // Shared token sent with each submission. Must match SHARED_TOKEN in
  // apps-script/Code.gs. It deters drive-by bots hitting the endpoint; it is
  // not a real secret (it ships in this public file), so keep the server-side
  // validation/limits in Code.gs too.
  submitToken: "uuestrie-56fd9b823b2ef86f2d44d0c0e53511b2",

  // -- Congregation defaults --------------------------------------------------
  congregationName: "UU Estrie of North Hatley, QC",
  defaultLocation: "UU Estrie of North Hatley, QC",
  defaultTime: "10:30 a.m.",
  defaultMusicians: "Ryan Frizzell, Aaron Ricker, Brian Herring",

  // Prefilled "Materials Needed" list (editable per service in the form).
  defaultMaterials:
    "Usual Items: fresh candles, matches, candle extinguisher, " +
    "glass of water for guest speaker, basket for offertory",
};
