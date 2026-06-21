// =============================================================================
// Template renderers
// Each function takes the form `data` object and returns an HTML string that
// reproduces the source document with the leader's answers filled in.
// =============================================================================

// Escape user text for safe HTML insertion.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Escape but turn line breaks into <br> (for multi-line text areas).
function escMulti(s) {
  return esc(s).replace(/\n/g, "<br>");
}

// Format an ISO date (yyyy-mm-dd) as "Sunday, June 21, 2026".
function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Resolve a hymn's text: the leader's choice, or "Musicians' choice" if deferred.
function hymnText(val, byMusicians) {
  return byMusicians ? "Musicians' choice" : (val || "");
}

// Resolve who the "Speaker" is, based on the chosen service type.
function speakerDisplay(data) {
  switch (data.serviceType) {
    case "leader-speaker":
      return data.serviceLeader || "";
    case "sharing":
      return "A Sharing Service";
    case "guest":
    default:
      return data.speaker || "";
  }
}

// -----------------------------------------------------------------------------
// SERVICE SCRIPT
// -----------------------------------------------------------------------------
function renderScript(data) {
  const title = esc(data.serviceTitle) || "&nbsp;";
  const leader = esc(data.serviceLeader) || "&nbsp;";
  const speaker = esc(speakerDisplay(data));
  const dateStr = esc(formatDate(data.date));
  const musicians = esc(data.musicians) || "&nbsp;";

  // The introduction line changes for a sharing service.
  let introLine;
  if (data.serviceType === "sharing") {
    introLine =
      `I am pleased to introduce our service today entitled <strong>${title}</strong>. ` +
      `This is a sharing service, and you are warmly invited to share your own ` +
      `stories and reflections on our theme.`;
  } else {
    introLine =
      `I am pleased to introduce our service today entitled <strong>${title}</strong>` +
      (speaker ? ` led by <strong>${speaker}</strong>.` : ".");
  }

  const bioBlock = data.speakerBio
    ? `<p>${escMulti(data.speakerBio)}</p>`
    : "";

  const openingWordsBlock = data.omitOpeningWords
    ? ""
    : `<h2 class="run-in">Opening Words:</h2>` +
      (data.openingWords
        ? `<p>${escMulti(data.openingWords)}</p>`
        : `<p class="blank">[Opening words]</p>`);

  const openingSongBlock = data.omitOpeningSong
    ? ""
    : `<h2 class="run-in">Opening Song (musicians / congregation):</h2>
       <p>${esc(hymnText(data.openingSong, data.openingSongByMusicians)) || "&nbsp;"}</p>`;

  const storyBlock = data.storyForAllAges
    ? `<h2>Story for All Ages (Service Leader or Speaker):</h2>
       <p>${escMulti(data.storyForAllAges)}</p>`
    : "";

  // Sermon vs. sharing time.
  let reflectionBlock;
  if (data.serviceType === "sharing") {
    reflectionBlock =
      `<h2 class="run-in">Sharing:</h2>
       <p>The congregation is invited to share their stories and reflections on
       our theme${data.reflectionTopic ? ": " + escMulti(data.reflectionTopic) : "."}</p>`;
  } else {
    reflectionBlock =
      `<h2 class="run-in">Sermon / Reflection:</h2>` +
      (data.reflectionTopic ? `<p>${escMulti(data.reflectionTopic)}</p>` : "");
  }

  const closingSongBlock = data.omitClosingSong
    ? ""
    : `<h2 class="run-in">Closing Song (musicians, congregation):</h2>
       <p>${esc(hymnText(data.closingSong, data.closingSongByMusicians)) || "&nbsp;"}</p>`;

  const closingWordsBlock = data.omitClosingWords
    ? ""
    : `<h2 class="run-in">Closing Words:</h2>` +
      (data.closingWords
        ? `<p>${escMulti(data.closingWords)}</p>`
        : `<p class="blank">[Closing words]</p>`);

  const nextWeek = data.nextWeek
    ? escMulti(data.nextWeek)
    : `<span class="blank">[next week's service]</span>`;
  const announcements = data.announcements
    ? `<p>${escMulti(data.announcements)}</p>`
    : "";
  const materials = esc(data.materials || CONFIG.defaultMaterials) || "&nbsp;";

  return `
  <div class="doc script-doc">
    <h1 class="doc-title">${title}</h1>

    <p class="meta">
      <strong>Date:</strong> ${dateStr} &nbsp;&nbsp;
      <strong>Musicians:</strong> ${musicians} &nbsp;&nbsp;
      <strong>Service Leader:</strong> ${leader} &nbsp;&nbsp;
      <strong>Guest Speaker / Lay Leader:</strong> ${data.serviceType === "sharing" ? "&mdash;" : (speaker || "&mdash;")}
    </p>
    <p class="note-small">Note: The Service Leader and Guest Speaker / Lay Leader
      may be the same person who has taken on both roles.</p>

    <p class="materials"><strong>Materials Needed:</strong> ${materials}</p>

    <h2 class="section-head">The Service Script</h2>

    <h2>Gathering Music (Musicians)</h2>
    <p>(Ring UU Estrie Church bell &mdash; volunteer)</p>

    <p><strong>Welcome by Service Leader:</strong></p>
    <p>Bienvenue, welcome. Nous sommes les Unitarian Universalist dans l'Estrie.
      Nous nous réunissons tous les dimanche afin de rassembler les forces
      nécessaires pour bien mener nos vies.</p>
    <p>We are an open and affirming spiritual community without dogma committed to
      honoring the inherent worth and dignity of every person and to enhancing the
      reach of love and care in this world.</p>
    <p>Welcome, bienvenue, to UUEstrie. My name is <strong>${leader}</strong>.</p>
    <p>${introLine}</p>
    ${bioBlock}
    <p>I also would like to give a warm welcome to all of our visitors this
      morning. I hope that you sign our guestbook and join us for conversation
      after the service.</p>
    <p>Une chaleureuse bienvenue à tous nos visiteurs ce matin. Vous êtes invité à
      vous inscrire dans notre livre d'or et restez pour de la bonne conversation.</p>
    <p>Now let us join together in the spirit of worship.</p>
    <p>(Singing bowl strike)</p>

    <p><strong>Prelude (Musicians)</strong></p>

    ${openingWordsBlock}

    <h2>Lighting the Chalice (Service Leader)</h2>
    <p>In the spirit of lighting our chalice, please join us in singing
      <em>Rise up O Flame</em> which can be found in the inside cover of our order
      of service in both English and French.</p>

    ${openingSongBlock}

    <p><strong>Affirmation (Service Leader):</strong></p>
    <p>Please join me in saying the affirmation. The words can be found in the
      inside cover of your order of service.</p>
    <p class="affirmation"><em>Love is the spirit of this community, and to be of
      service is its gift. This is our great covenant: To dwell together in peace,
      to seek the truth in love, and to help one another. L'amour constitue le
      fondement de cette communauté et rendre service est sa mission. Notre
      engagement profond: cheminer ensemble dans la paix, rechercher la
      connaissance dans la liberté et s'entraider.</em></p>

    <p><strong>Joys and Concerns (Service Leader):</strong></p>
    <p>We come to a time-honored tradition in our congregation, where in silence or
      in speech we express any joys you are excited to share or concerns that you
      would like us to be aware of and acknowledge (congregants are led to light a
      candle from the candlestick on the front table).</p>

    ${storyBlock}

    <h2>Offering (Service Leader):</h2>
    <p>We have come to the offering. Without your continuing support, we wouldn't be
      able to keep this community thriving.</p>
    <p>(pass around offering basket, at the end of the service, the treasurer or
      board member safely puts all donations away or they may be put in the locked
      box on the office desk)</p>
    <p>Join me in singing our offering song in our front cover "From You I receive"
      in both English and French:</p>
    <p class="affirmation"><em>From you I receive, to you I give;<br>
      Together we share, and from this we live.<br><br>
      De toi je reçois à toi je donne,<br>
      Ensemble nous partageons et comme ca nous vivons.</em></p>

    ${reflectionBlock}

    ${closingSongBlock}

    ${closingWordsBlock}

    <p><strong>Announcements / Extinguishing Chalice (Service Leader, Congregation):</strong></p>
    <p>At this time, our worship is over and our service has begun. May it be so and
      blessed be. We extinguish this flame, but not the light of truth, the warmth
      of community, or the fire of commitment.</p>
    <p>Next week's service will be: ${nextWeek}</p>
    ${announcements}
    <p>At this time, I welcome any announcements you may have and afterward, I invite
      you to stay for conversation in Avery Booth Hall. If you are visiting for the
      first time, we invite you to sign our guest book on the table near the door.</p>

    <p><strong>Postlude (Musicians) / Extinguish Chalice</strong></p>
  </div>`;
}

// -----------------------------------------------------------------------------
// ORDER OF SERVICE  (landscape Letter, two identical columns to cut in half)
// -----------------------------------------------------------------------------
function orderColumn(data) {
  const title = esc(data.serviceTitle) || "&nbsp;";
  const speaker = esc(speakerDisplay(data));
  const leader = esc(data.serviceLeader) || "&nbsp;";
  const musicians = esc(data.musicians) || "&nbsp;";
  const time = esc(data.serviceTime) || CONFIG.defaultTime;
  const dateStr = esc(formatDate(data.date));
  const openingSong = esc(hymnText(data.openingSong, data.openingSongByMusicians));
  const closingSong = esc(hymnText(data.closingSong, data.closingSongByMusicians));

  // Each row: name of item (with bilingual label) + who is responsible.
  const row = (item, who) =>
    `<div class="oos-row"><span class="oos-item">${item}</span>` +
    `<span class="oos-who">${who}</span></div>`;
  const songLine = (label, val) =>
    val ? `<div class="oos-song">${label}${val}</div>` : "";
  // A fixed song line that always prints (its text is self-contained).
  const fixedSong = (text) => `<div class="oos-song">${text}</div>`;

  return `
    <div class="oos-col">
      <div class="oos-head">
        <div class="oos-cong">${esc(CONFIG.congregationName)}</div>
        <div class="oos-title">${title}</div>
        ${speaker ? `<div class="oos-speaker">${speaker}${data.serviceType === "sharing" ? "" : ", Speaker"}</div>` : ""}
        <div class="oos-date">${dateStr} at ${time}</div>
      </div>

      <div class="oos-leaders">
        <div>Service Leader / Responsable da service: ${leader}</div>
        <div>Musicians / La musique: ${musicians}</div>
      </div>

      <div class="oos-body">
        ${row("Gathering music / Rassemblement", "Musicians")}
        ${row("Welcome / Accueil", "Service Leader")}
        ${row("Bell Sound of Mindfulness / Sonner la cloche", "")}
        ${row("Prelude", "Musicians")}
        ${data.omitOpeningWords ? "" : row("Opening Words / Mots d'ouverture", "Speaker")}
        ${row("Lighting the Chalice / Rite du calice", "")}
        ${fixedSong("Song: Rise Up, O Flame / Brille la flamme*")}
        ${data.omitOpeningSong ? "" : row("Opening Hymn / Hymne d'ouverture", "Musicians, Congregation")}
        ${data.omitOpeningSong ? "" : songLine("Song: ", openingSong)}
        ${row("Joys and Sorrows / Joies et Peines", "Service Leader")}
        ${row("Affirmation*", "Congregation")}
        ${row("Offering / Don", "Musicians, Congregation")}
        ${fixedSong("Song: From You I Receive / De toi je reçois*")}
        ${row("Reflection", "Speaker")}
        ${data.omitClosingSong ? "" : row("Closing Hymn / Hymne de fermeture", "Musicians, Congregation")}
        ${data.omitClosingSong ? "" : songLine("Song: ", closingSong)}
        ${data.omitClosingWords ? "" : row("Closing Words / Mot de la fin", "Speaker")}
        ${row("Extinguishing the Chalice / Éteindre le calice", "Service Leader")}
        ${row("Announcements / Annonces &amp; Postlude", "Congregation, Musicians")}
      </div>
    </div>`;
}

function renderOrderOfService(data) {
  const col = orderColumn(data);
  return `
    <div class="doc oos-doc">
      ${col}
      <div class="oos-cut"></div>
      ${col}
    </div>`;
}
