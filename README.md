# UU Estrie — Service Preparation

A shareable web form for the week's **service leader**. They answer questions
about their service, and the page produces two ready-to-print PDFs (via the
browser's print dialog → "Save as PDF"):

- **Service Script** — the full spoken-word script, filled in.
- **Order of Service** — the bilingual insert, laid out **twice on one
  landscape page** so it can be printed and **cut in half**.

PDFs are generated with the browser's native print engine, so they have
selectable text and reliable pagination with no extra libraries.

Progress **auto-saves in the leader's browser**, so they can close the page and
come back later on the same device. No login or password.

On submit, the answers are also recorded in a **Google Sheet**, and an email
with the **date and chosen hymns** is sent to the musicians
(`rjfrizz@gmail.com`) — both handled by the included Google Apps Script
(optional; the PDFs work without it).

## Files

```
index.html            The form
css/styles.css         Styling (form + the two documents)
js/config.js           ← edit church defaults + the Sheet URL here
js/templates.js        Renders the Script & Order of Service from the answers
js/app.js              Auto-save, print-to-PDF, submission
apps-script/Code.gs    Google Apps Script for the Sheet (copy-paste)
docs/                  The original source templates
```

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

## Connect the Google Sheet + hymn email (optional)

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

Each submission appends a row (a header row is created automatically) **and**
emails the date + opening/closing hymn choices to the address in `NOTIFY_EMAIL`
at the top of `Code.gs` (currently `rjfrizz@gmail.com`). Hymns left to the
musicians show as "Musicians' choice".

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
