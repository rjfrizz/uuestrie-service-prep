# UU Estrie — Internal Tools

A small static site of helpers for the congregation. A shared menu (injected by
`js/nav.js`) links between the tools. No login or password; every tool
auto-saves progress in the visitor's browser.

**Tools**

1. **Service Prep** (`service-prep.html`) — the week's service leader answers
   questions and gets two ready-to-print PDFs: the **Service Script** (full
   spoken-word script) and the **Order of Service** (bilingual insert, laid out
   twice on one landscape page to print and cut in half). Optionally submits to
   a Google Sheet and emails the date + chosen hymns to the musicians.
2. **Expense Reimbursement** (`reimbursement.html`) — submit a receipt/invoice
   (with an image or PDF upload) to be paid back; the request is recorded to a
   Google Sheet tab and emailed to the treasurer.
3. **Invoice Generator** (`invoice.html`) — build a simple church invoice from
   line items and print/save it as a PDF. No backend needed.

All PDFs are produced with the browser's native print engine (→ "Save as PDF"),
so they have selectable text and reliable pagination with no extra libraries.

## Files

```
index.html             Home page (cards linking to each tool)
service-prep.html      Service prep form
reimbursement.html     Expense reimbursement form
invoice.html           Invoice generator
css/styles.css         Shared styling (site + forms + printed documents)
js/config.js           ← edit church defaults, emails, and the Sheet URL here
js/nav.js              Shared header/menu (add a tool = one entry in TOOLS)
js/templates.js        Renders the Service Script & Order of Service
js/app.js              Service prep: auto-save, print-to-PDF, submission
js/reimbursement.js    Reimbursement: auto-save, submission
js/invoice-render.js   Pure invoice → HTML rendering
js/invoice.js          Invoice: line items, totals, auto-save, print-to-PDF
apps-script/Code.gs    Google Apps Script (service prep + reimbursement)
docs/                  The original source templates
```

## Adding another tool

1. Create `yourtool.html` (copy an existing page: it needs
   `<div id="site-nav"></div>` and `<script src="js/nav.js"></script>`).
2. Add one entry to `TOOLS` in `js/nav.js`.
3. Add a card for it on `index.html`.

## Run it locally

It's a static site. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Publish on GitHub Pages

1. Create a GitHub repo and push this folder to it.
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**,
   **Branch = main**, folder **/ (root)**, then **Save**.
4. After a minute the page is live at
   `https://<your-username>.github.io/<repo-name>/`. Share that link.

(The included `.nojekyll` file tells Pages to serve the files as-is.)

## Connect the Google Sheet + emails (optional)

One Apps Script deployment serves **both** the Service Prep and Reimbursement
forms (it branches on a `formType` field in the request):

- **Service prep** → the tab set by `TARGET_GID`, emails hymn choices to
  `NOTIFY_EMAIL`.
- **Reimbursement** → a `Reimbursements` tab (created automatically), emails the
  request to `TREASURER_EMAIL`, and saves an uploaded receipt to the
  `UU Estrie Reimbursement Receipts` Drive folder.

Set `NOTIFY_EMAIL` and `TREASURER_EMAIL` at the top of `Code.gs`, and the
matching `CONFIG.treasurerEmail` in `js/config.js`. The **Invoice Generator**
needs no backend.

The destination spreadsheet is already set in `Code.gs` via `SPREADSHEET_ID`
(currently the
[UU Estrie sheet](https://docs.google.com/spreadsheets/d/1UOYF-oWVP3x3FBgxkgRY4OLEKuJRxMU1fokwknxOH-4/edit)).
To use a different sheet, replace that id (the long string in the sheet's URL).

1. Open that spreadsheet, then **Extensions → Apps Script** (or start a standalone
   project at script.google.com — either works, since the script targets the
   sheet by id).
2. Delete the starter code, paste the contents of `apps-script/Code.gs`, and
   **Save**.
3. (Optional) To pin the OAuth scopes explicitly: **Project Settings (gear) →
   check "Show appsscript.json manifest file in editor"**, open `appsscript.json`,
   and replace it with the contents of `apps-script/appsscript.json`, then
   **Save**. (You can skip this — Apps Script auto-detects the same scopes.)
4. **Deploy → New deployment → Type: Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**. When authorizing, approve the **Sheets**, **send email**,
     and **Drive** permissions.
   - Copy the **Web app URL**.
5. Paste that URL into `js/config.js` as `CONFIG.sheetEndpoint`, then push.

Each service-prep submission appends a row (a header row is created
automatically) **and** sends two emails, both set at the top of `Code.gs`:

- **Hymn choices** (concise) to `NOTIFY_EMAIL` — for the musicians. Hymns left to
  the musicians show as "Musicians' choice".
- **Full form details** to `SERVICE_DETAILS_EMAIL` — every field, for
  communications. Omitted items show as "(omitted)".

Each recipient var accepts a comma-separated list for multiple people.

If the leader provides a **promotional image**, a pasted link is recorded in the
Sheet and email; an uploaded file is saved to a Drive folder
(`UU Estrie Service Prep Images`), link-shared, recorded in the Sheet, and also
attached to the email.

> If you ever change `Code.gs`, create a **new deployment** (or "Manage
> deployments → edit → new version") and update the URL if it changes.

### Security of the public endpoint

The Web App is open to "Anyone". What matters for a public endpoint is that
visitors can only invoke `doPost`/`doGet` — they cannot run arbitrary code, so
the script's Drive scope does **not** expose your Drive to the internet. `doPost`
only ever creates a file in one folder, writes a sheet row, and emails you. The
real abuse protections are:

- **Shared token**: requests without the token in `SHARED_TOKEN` (matching
  `CONFIG.submitToken` in `js/config.js`) are rejected. This deters bots; it is
  not a true secret, since it ships in the public page.
- **Server-side checks**: required fields must be present and uploaded images
  over 10 MB are rejected, before any Drive/email work happens.

**On the Drive scope:** the script uses the built-in `DriveApp` service, which
always requests full Drive access (`auth/drive`) — it does not support the narrow
`drive.file`. That broad grant applies to the code, not to public callers, so it
doesn't widen the public attack surface. If you ever want to drop it entirely,
remove the `DriveApp` calls and attach uploaded images to the email instead
(then no Drive scope is needed at all).

After changing `Code.gs`/`appsscript.json`, **re-deploy a new version** and
re-authorize if prompted. To force a fresh consent screen, revoke the project at
[myaccount.google.com → third-party access](https://myaccount.google.com/connections)
and run `doGet` once in the editor.

If you keep `SHARED_TOKEN`/`submitToken` in sync, regenerate the token any time
(any random string) and redeploy.

## Changing defaults

Everything church-specific (congregation name, default musicians, service time,
materials list, the Sheet URL) lives at the top of `js/config.js`. The wording
of the two documents lives in `js/templates.js`.
