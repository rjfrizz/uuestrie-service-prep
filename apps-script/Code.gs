/**
 * UU Estrie Service Prep — Google Sheet receiver + hymn-choice email
 *
 * Deploy this as a Web App (see README) and paste the resulting URL into
 * js/config.js as CONFIG.sheetEndpoint.
 *
 * On each submission it:
 *   1. appends a row to the first sheet (creating a header row the first time)
 *   2. emails the date and the chosen hymns to NOTIFY_EMAIL
 */

// The Google Sheet that receives submissions (the long id from its URL).
// Leave '' to use the sheet this script is bound to instead.
var SPREADSHEET_ID = '1UOYF-oWVP3x3FBgxkgRY4OLEKuJRxMU1fokwknxOH-4';
var TARGET_GID = 0; // which tab to write to (gid from the sheet URL)

// Who is notified about each form. To notify several people, separate the
// addresses with commas, e.g. 'a@example.com, b@example.com'.
//
// Service-prep submissions (hymn choices etc.):
var NOTIFY_EMAIL = 'rjfrizz@gmail.com';
// Reimbursement requests (the treasurer, and anyone else who should see them):
var TREASURER_EMAIL = 'rjfrizz@gmail.com';

// Drive folder where uploaded promotional images are stored.
var IMAGE_FOLDER = 'UU Estrie Service Prep Images';

// Drive folder where uploaded reimbursement receipts are stored.
var RECEIPT_FOLDER = 'UU Estrie Reimbursement Receipts';

// Tab name for reimbursement rows (created if missing).
var REIMB_SHEET_NAME = 'Reimbursements';

// Must match CONFIG.submitToken in js/config.js. Deters drive-by bots.
var SHARED_TOKEN = 'uuestrie-56fd9b823b2ef86f2d44d0c0e53511b2';

// Hard cap on an uploaded image (server-side; the browser also checks 10 MB).
var MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Column order for the sheet (also used as the header row).
var FIELDS = [
  'submittedAt',
  'date',
  'serviceTime',
  'serviceTitle',
  'location',
  'serviceLeader',
  'serviceType',
  'speaker',
  'speakerBio',
  'musicians',
  'openingWords',
  'openingSong',
  'openingSongByMusicians',
  'closingSong',
  'closingSongByMusicians',
  'storyForAllAges',
  'reflectionTopic',
  'closingWords',
  'promoImageUrl',
  'promoImageLink',
  'omitOpeningWords',
  'omitOpeningSong',
  'omitClosingSong',
  'omitClosingWords'
];

// Column order for the Reimbursements tab.
var REIMB_FIELDS = [
  'submittedAt',
  'claimantName',
  'claimantEmail',
  'expenseDate',
  'amount',
  'description',
  'paymentMethod',
  'etransferContact',
  'mailingAddress',
  'receiptUrl',
  'receiptLink'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // --- Guardrails for a public endpoint ---
    if (SHARED_TOKEN && data.token !== SHARED_TOKEN) {
      return json({ ok: false, error: 'unauthorized' });
    }

    if (data.formType === 'reimbursement') {
      return handleReimbursement(data);
    }
    return handleService(data);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// --- Service prep submission ------------------------------------------------
function handleService(data) {
  try {
    // Reject obvious junk: require the core fields the form makes mandatory.
    if (!str(data.serviceTitle) || !str(data.serviceLeader) || !str(data.date)) {
      return json({ ok: false, error: 'missing required fields' });
    }
    // Reject an oversized image before doing any work with it.
    if (data.promoImageData && base64Bytes(data.promoImageData) > MAX_IMAGE_BYTES) {
      return json({ ok: false, error: 'image too large' });
    }

    var sheet = getTargetSheet();

    // Handle an uploaded promotional image (a data: URL). Save it to Drive and
    // record a shareable link; keep the blob to attach to the email as well.
    var imageBlob = data.promoImageData ? dataUrlToBlob(data.promoImageData, data.promoImageName) : null;
    data.promoImageLink = '';
    if (imageBlob) {
      try {
        data.promoImageLink = saveImageToDrive(imageBlob);
      } catch (driveErr) {
        Logger.log('Drive save failed: ' + driveErr);
      }
    }

    // Write header row once.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(FIELDS);
    }

    var row = FIELDS.map(function (f) { return data[f] || ''; });
    sheet.appendRow(row);

    // Email the details. Wrapped separately so a mail hiccup doesn't
    // fail the whole submission.
    try {
      sendHymnEmail(data, imageBlob);
    } catch (mailErr) {
      // Log but still report success for the saved row.
      Logger.log('Email failed: ' + mailErr);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// --- Reimbursement submission -----------------------------------------------
function handleReimbursement(data) {
  try {
    if (!str(data.claimantName) || !str(data.claimantEmail) ||
        !str(data.expenseDate) || !str(data.amount) || !str(data.description)) {
      return json({ ok: false, error: 'missing required fields' });
    }
    if (data.receiptData && base64Bytes(data.receiptData) > MAX_IMAGE_BYTES) {
      return json({ ok: false, error: 'receipt too large' });
    }

    // Save an uploaded receipt (image or PDF) to Drive.
    var receiptBlob = data.receiptData ? dataUrlToBlob(data.receiptData, data.receiptName) : null;
    data.receiptLink = '';
    if (receiptBlob) {
      try {
        data.receiptLink = saveBlobToDrive(receiptBlob, RECEIPT_FOLDER);
      } catch (driveErr) {
        Logger.log('Receipt save failed: ' + driveErr);
      }
    }

    var sheet = getNamedSheet(REIMB_SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(REIMB_FIELDS);
    }
    sheet.appendRow(REIMB_FIELDS.map(function (f) { return data[f] || ''; }));

    try {
      sendReimbursementEmail(data, receiptBlob);
    } catch (mailErr) {
      Logger.log('Email failed: ' + mailErr);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function sendReimbursementEmail(data, receiptBlob) {
  var pay;
  if (data.paymentMethod === 'cheque') {
    pay = 'Cheque to:\n' + (data.mailingAddress || '(no address given)');
  } else if (data.paymentMethod === 'banktransfer') {
    pay = 'Bank transfer (finance convenor to confirm bank details are on file, ' +
      'or reach out to collect them securely)';
  } else {
    pay = 'Interac e-Transfer to: ' + (data.etransferContact || '(none given)');
  }

  var receipt = data.receiptLink || data.receiptUrl ||
    (receiptBlob ? 'attached to this email' : '(none provided)');

  var subject = 'Reimbursement request — ' + (data.claimantName || '') +
    ' — ' + money(data.amount);

  var body = [
    'Claimant: ' + (data.claimantName || '') + ' <' + (data.claimantEmail || '') + '>',
    'Date of expense: ' + (data.expenseDate || ''),
    'Amount: ' + money(data.amount),
    '',
    'For: ' + (data.description || ''),
    '',
    'Pay back via:',
    pay,
    '',
    'Receipt: ' + receipt
  ].join('\n');

  var options = {};
  if (receiptBlob) options.attachments = [receiptBlob];
  MailApp.sendEmail(TREASURER_EMAIL, subject, body, options);
}

function money(amount) {
  var n = parseFloat(amount);
  if (!isFinite(n)) return String(amount || '');
  return '$' + n.toFixed(2);
}

// Get a tab by name from the target spreadsheet, creating it if missing.
function getNamedSheet(name) {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// Resolve the destination sheet: the spreadsheet by id (preferred) or the
// bound spreadsheet, then the tab matching TARGET_GID (falling back to first).
function getTargetSheet() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === TARGET_GID) return sheets[i];
  }
  return sheets[0];
}

function sendHymnEmail(data, imageBlob) {
  var when = prettyDate(data.date) || '(no date given)';
  var opening = hymnText(data.openingSong, data.openingSongByMusicians);
  var closing = hymnText(data.closingSong, data.closingSongByMusicians);

  var subject = 'Hymn choices — ' + when +
    (data.serviceTitle ? ' (' + data.serviceTitle + ')' : '');

  var promoLink = data.promoImageLink || data.promoImageUrl || '';

  var body = [
    'Service: ' + (data.serviceTitle || ''),
    'Date: ' + when,
    '',
    'Opening hymn: ' + opening,
    'Closing hymn: ' + closing,
    '',
    'Service leader: ' + (data.serviceLeader || ''),
    'Musicians: ' + (data.musicians || ''),
    '',
    'Promotional image: ' + (promoLink || (imageBlob ? 'attached to this email' : '(none provided)'))
  ].join('\n');

  var options = {};
  if (imageBlob) options.attachments = [imageBlob];
  MailApp.sendEmail(NOTIFY_EMAIL, subject, body, options);
}

// Trimmed string, or '' for null/undefined.
function str(v) {
  return v == null ? '' : String(v).trim();
}

// Approximate decoded byte size of a "data:...;base64,XXXX" string without
// actually decoding it.
function base64Bytes(dataUrl) {
  var i = String(dataUrl).indexOf(',');
  var b64 = i >= 0 ? dataUrl.substring(i + 1) : dataUrl;
  return Math.floor(b64.length * 3 / 4);
}

// Convert a "data:<type>;base64,<data>" string into a Drive blob.
function dataUrlToBlob(dataUrl, name) {
  var m = String(dataUrl).match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) return null;
  var bytes = Utilities.base64Decode(m[2]);
  return Utilities.newBlob(bytes, m[1], name || ('promo-' + Date.now()));
}

// Save a blob to a named Drive folder and return a shareable link.
function saveBlobToDrive(blob, folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Could not set sharing: ' + e);
  }
  return file.getUrl();
}

// Back-compat wrapper for the service-prep promo image.
function saveImageToDrive(blob) {
  return saveBlobToDrive(blob, IMAGE_FOLDER);
}

// "Musicians' choice" when deferred, otherwise the leader's entry.
function hymnText(val, byMusicians) {
  if (byMusicians) return "Musicians' choice";
  return val ? val : '(not chosen yet)';
}

// Format an ISO date (yyyy-mm-dd) as "Sunday, June 21, 2026".
function prettyDate(iso) {
  if (!iso) return '';
  var p = String(iso).split('-');
  if (p.length !== 3) return iso;
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy');
}

// Lets you open the web app URL in a browser to confirm it's live.
function doGet() {
  return json({ ok: true, message: 'UU Estrie Service Prep endpoint is running.' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
