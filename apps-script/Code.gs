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

// Where the notification is sent.
var NOTIFY_EMAIL = 'rjfrizz@gmail.com';

// Drive folder where uploaded promotional images are stored.
var IMAGE_FOLDER = 'UU Estrie Service Prep Images';

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

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // --- Guardrails for a public endpoint ---
    if (SHARED_TOKEN && data.token !== SHARED_TOKEN) {
      return json({ ok: false, error: 'unauthorized' });
    }
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

// Save the image blob to a Drive folder and return a shareable link.
function saveImageToDrive(blob) {
  var folders = DriveApp.getFoldersByName(IMAGE_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(IMAGE_FOLDER);
  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Could not set sharing: ' + e);
  }
  return file.getUrl();
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
