// =============================================================================
// Shared site header + navigation.
// Add a new tool by adding one entry to TOOLS below and creating its HTML page.
// Each page just needs:  <div id="site-nav"></div>  and  <script src="js/nav.js">
// =============================================================================

const SITE_NAME = "UU Estrie";
const SITE_TAGLINE = "of North Hatley, QC";

// file: page filename (relative). title: menu/label. home: shown as the brand link.
const TOOLS = [
  { file: "index.html", title: "Home", home: true },
  { file: "service-prep.html", title: "Service Prep" },
  { file: "reimbursement.html", title: "Reimbursement" },
  { file: "invoice.html", title: "Invoice" },
];

(function renderNav() {
  // Which page are we on? (last path segment; treat "" and "/" as index.html)
  let here = location.pathname.split("/").pop() || "index.html";
  if (here === "") here = "index.html";

  const links = TOOLS.filter((t) => !t.home || true) // keep all, incl. Home
    .map((t) => {
      const current = t.file === here ? ' aria-current="page" class="current"' : "";
      return `<a href="${t.file}"${current}>${t.title}</a>`;
    })
    .join("");

  const html = `
    <header class="site-header">
      <div class="wrap header-inner">
        <a class="brand" href="index.html">
          <span class="brand-name">${SITE_NAME}</span>
          <span class="brand-tagline">${SITE_TAGLINE}</span>
        </a>
        <button class="nav-toggle" aria-label="Menu" aria-expanded="false">☰</button>
        <nav class="site-nav">${links}</nav>
      </div>
    </header>`;

  const mount = document.getElementById("site-nav");
  if (mount) mount.outerHTML = html;

  // Mobile menu toggle.
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
})();
