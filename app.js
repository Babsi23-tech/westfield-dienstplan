const API_URL =
  'https://script.google.com/macros/s/AKfycbxtBr_mx3GW41P-tc7VSZL8c9OeJftrVUUJf6GFuUjvPDHg2oe6kb16Cqkbn0S9im6U_Q/exec';

const SESSION_KEY = 'scs_team_session';

let aktuellerBenutzer = '';
let aktuellerAdmin = false;

let letzterDienstplan = [];
let letzteAbwesenheiten = [];

let aktuelleKwNeu = 1;
let dienstplanInitialisiert = false;

let kalenderHinweiseNeu = [];
let kalenderHinweiseGeladenNeu = false;

// Daten für den direkten Diensttausch
let tauschDatum = '';
let tauschTag = '';
let tauschKw = '';
let tauschDienstCode = '';
let tauschDienstText = '';
let tauschZeit = '';


// ==========================================================
// API
// ==========================================================

async function apiPost(action, daten = {}) {
  const response = await fetch(
    API_URL,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },

      body: JSON.stringify({
        action: action,
        ...daten
      }),

      redirect: 'follow',
      cache: 'no-store'
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      'HTTP ' +
      response.status +
      ': ' +
      text.substring(0, 300)
    );
  }

  try {
    return JSON.parse(text);

  } catch (error) {
    throw new Error(
      'Server hat kein gültiges JSON zurückgegeben: ' +
      text.substring(0, 300)
    );
  }
}


// ==========================================================
// APP START
// ==========================================================

document.addEventListener(
  'DOMContentLoaded',
  async function() {

    installiereDynamischeAnsichtenNeu();

    installiereNavigationErweiterungNeu();

    installierePinFestlegenDialogNeu();

    await starteApp();

    ladeAppInfoNeu();
  }
);


// ==========================================================
// SESSION / START
// ==========================================================

async function starteApp() {
  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (token) {
    try {
      const result =
        await apiPost(
          'session',
          {
            token: token
          }
        );

      if (
        result &&
        result.ok
      ) {
        aktuellerBenutzer =
          result.name || '';

        aktuellerAdmin =
          result.admin === true;

        zeigeHauptApp(
          aktuellerBenutzer,
          aktuellerAdmin
        );

        if (
          typeof window.zeigeSeite ===
          'function'
        ) {
          window.zeigeSeite(
            'dienstplan'
          );

        } else {
          await ladeMeinDienstplanNeu();
        }

        return;
      }

    } catch (error) {
      console.error(
        'Session-Prüfung fehlgeschlagen:',
        error
      );
    }

    localStorage.removeItem(
      SESSION_KEY
    );
  }

  zeigeLogin();

  await ladeMitarbeiter();
}


// ==========================================================
// LOGIN ANZEIGEN
// ==========================================================

function zeigeLogin() {
  const login =
    document.getElementById(
      'loginAnsicht'
    );

  const app =
    document.getElementById(
      'hauptApp'
    );

  if (login) {
    login.style.display = 'flex';
  }

  if (app) {
    app.style.display = 'none';
  }
}


// ==========================================================
// MITARBEITER LADEN
// ==========================================================

async function ladeMitarbeiter() {
  const select =
    document.getElementById(
      'loginName'
    );

  if (!select) {
    return;
  }

  select.disabled = true;

  select.innerHTML =
    '<option value="">Mitarbeiter werden geladen …</option>';

  try {
    const result =
      await apiPost(
        'mitarbeiterListe'
      );

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Mitarbeiter konnten nicht geladen werden.'
      );
    }

    select.innerHTML =
      '<option value="">👤 Mitarbeiter auswählen</option>';

    const mitarbeiter =
      Array.isArray(
        result.mitarbeiter
      )
        ? result.mitarbeiter
        : [];

    mitarbeiter.forEach(
      function(name) {
        const option =
          document.createElement(
            'option'
          );

        option.value = name;
        option.textContent = name;

        select.appendChild(
          option
        );
      }
    );

    select.disabled = false;

    if (
      mitarbeiter.length === 0
    ) {
      zeigeLoginMeldung(
        'Es wurden keine aktiven Mitarbeiter gefunden.',
        'fehler'
      );
    }

  } catch (error) {
    console.error(error);

    select.innerHTML =
      '<option value="">Mitarbeiter konnten nicht geladen werden</option>';

    zeigeLoginMeldung(
      'Fehler beim Laden: ' +
      error.message,
      'fehler'
    );
  }
}


// ==========================================================
// LOGIN
// ==========================================================

async function loginAusfuehren() {
  const nameElement =
    document.getElementById(
      'loginName'
    );

  const pinElement =
    document.getElementById(
      'loginPin'
    );

  const button =
    document.getElementById(
      'loginButton'
    );

  const name =
    String(
      nameElement?.value || ''
    ).trim();

  const pin =
    String(
      pinElement?.value || ''
    ).trim();

  loescheLoginMeldung();

  if (!name) {
    zeigeLoginMeldung(
      'Bitte wähle deinen Namen aus.',
      'fehler'
    );

    return;
  }

  if (
    !/^\d{4}$/.test(pin)
  ) {
    zeigeLoginMeldung(
      'Bitte gib deinen 4-stelligen PIN ein.',
      'fehler'
    );

    pinElement?.focus();

    return;
  }

  if (button) {
    button.disabled = true;

    button.textContent =
      'Anmeldung läuft …';
  }

  try {
    const result =
      await apiPost(
        'login',
        {
          name: name,
          pin: pin
        }
      );

    /*
      Wurde der alte PIN nach einem genehmigten
      PIN-Reset gelöscht, darf der Mitarbeiter
      direkt einen neuen PIN festlegen.
    */
    if (
      result &&
      result.pinFehlt === true
    ) {
      if (pinElement) {
        pinElement.value = '';
      }

      zeigePinFestlegenDialogNeu(
        name,
        result.message ||
        'Bitte lege jetzt einen neuen PIN fest.'
      );

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      zeigeLoginMeldung(
        result?.message ||
        'Anmeldung nicht möglich.',
        'fehler'
      );

      return;
    }

    localStorage.setItem(
      SESSION_KEY,
      result.token
    );

    aktuellerBenutzer =
      result.name || name;

    aktuellerAdmin =
      result.admin === true;

    dienstplanInitialisiert = false;

    if (pinElement) {
      pinElement.value = '';
    }

    zeigeHauptApp(
      aktuellerBenutzer,
      aktuellerAdmin
    );

    if (
      typeof window.zeigeSeite ===
      'function'
    ) {
      window.zeigeSeite(
        'dienstplan'
      );

    } else {
      await ladeMeinDienstplanNeu();
    }

  } catch (error) {
    console.error(error);

    zeigeLoginMeldung(
      'Serverfehler: ' +
      error.message,
      'fehler'
    );

  } finally {
    if (button) {
      button.disabled = false;

      button.textContent =
        '🔐 Anmelden';
    }
  }
}


// ==========================================================
// PIN VERGESSEN
// ==========================================================

async function pinVergessenNeu() {
  const name =
    String(
      document
        .getElementById(
          'loginName'
        )
        ?.value || ''
    ).trim();

  if (!name) {
    zeigeLoginMeldung(
      'Bitte wähle zuerst deinen Namen aus.',
      'fehler'
    );

    return;
  }

  loescheLoginMeldung();

  try {
    const result =
      await apiPost(
        'pinVergessen',
        {
          name: name
        }
      );

    if (
      result &&
      result.pinFehlt === true
    ) {
      zeigePinFestlegenDialogNeu(
        name,
        result.message ||
        'Bitte lege jetzt einen neuen PIN fest.'
      );

      return;
    }

    if (
      result &&
      result.adminReset === true
    ) {
      zeigeLoginMeldung(
        result.message ||
        'Der Admin-PIN muss direkt zurückgesetzt werden.',
        'fehler'
      );

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'PIN-Anfrage konnte nicht gesendet werden.'
      );
    }

    zeigeLoginMeldung(
      '✅ ' +
      (
        result.message ||
        'Die PIN-Anfrage wurde an Babsi geschickt.'
      ),
      'erfolg'
    );

  } catch (error) {
    console.error(
      'PIN vergessen:',
      error
    );

    zeigeLoginMeldung(
      '❌ ' +
      error.message,
      'fehler'
    );
  }
}


// ==========================================================
// LOGIN-MELDUNGEN
// ==========================================================

function zeigeLoginMeldung(
  text,
  typ
) {
  const element =
    document.getElementById(
      'loginMeldung'
    );

  if (!element) {
    return;
  }

  element.textContent =
    text || '';

  element.className =
    'login-meldung';

  if (
    typ === 'erfolg'
  ) {
    element.classList.add(
      'erfolg'
    );

  } else if (
    typ === 'fehler'
  ) {
    element.classList.add(
      'fehler'
    );
  }
}


function loescheLoginMeldung() {
  const element =
    document.getElementById(
      'loginMeldung'
    );

  if (element) {
    element.textContent = '';

    element.className =
      'login-meldung';
  }
}


// ==========================================================
// HAUPT-APP ANZEIGEN
// ==========================================================

function zeigeHauptApp(
  name,
  admin
) {
  const login =
    document.getElementById(
      'loginAnsicht'
    );

  const app =
    document.getElementById(
      'hauptApp'
    );

  if (login) {
    login.style.display = 'none';
  }

  if (app) {
    app.style.display = 'block';
  }

  aktualisiereSidebarNeu(
    name,
    admin
  );
}


// ==========================================================
// LOGOUT
// ==========================================================

async function logoutNeu() {
  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  localStorage.removeItem(
    SESSION_KEY
  );

  aktuellerBenutzer = '';
  aktuellerAdmin = false;

  letzterDienstplan = [];
  letzteAbwesenheiten = [];

  dienstplanInitialisiert = false;

  tauschDatum = '';
  tauschTag = '';
  tauschKw = '';
  tauschDienstCode = '';
  tauschDienstText = '';
  tauschZeit = '';

  try {
    if (token) {
      await apiPost(
        'logout',
        {
          token: token
        }
      );
    }

  } catch (error) {
    console.error(
      'Logout:',
      error
    );
  }

  zeigeLogin();

  await ladeMitarbeiter();
}


// ==========================================================
// SESSION ABGELAUFEN
// ==========================================================

async function sessionAbgelaufenNeu() {
  localStorage.removeItem(
    SESSION_KEY
  );

  aktuellerBenutzer = '';
  aktuellerAdmin = false;

  letzterDienstplan = [];
  letzteAbwesenheiten = [];

  dienstplanInitialisiert = false;

  window.alert(
    'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.'
  );

  zeigeLogin();

  await ladeMitarbeiter();
}

// ==========================================================
// NEUEN PIN FESTLEGEN – DIALOG INSTALLIEREN
// ==========================================================

function installierePinFestlegenDialogNeu() {
  if (
    document.getElementById(
      'pinFestlegenOverlayNeu'
    )
  ) {
    return;
  }

  const overlay =
    document.createElement(
      'div'
    );

  overlay.id =
    'pinFestlegenOverlayNeu';

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:99999;
    display:none;
    align-items:center;
    justify-content:center;
    padding:20px;
    box-sizing:border-box;
    background:rgba(0,0,0,.48);
  `;

  overlay.innerHTML = `
    <div
      style="
        width:100%;
        max-width:430px;
        background:#ffffff;
        border-radius:16px;
        padding:24px;
        box-sizing:border-box;
        box-shadow:
          0 20px 60px
          rgba(0,0,0,.25);
      "
    >
      <div
        style="
          font-size:38px;
          text-align:center;
          margin-bottom:10px;
        "
      >
        🔐
      </div>

      <h2
        style="
          margin:0 0 8px;
          text-align:center;
        "
      >
        Neuen PIN festlegen
      </h2>

      <p
        id="pinFestlegenInfoNeu"
        style="
          margin:0 0 20px;
          color:#666;
          text-align:center;
          line-height:1.5;
        "
      >
        Bitte lege deinen neuen 4-stelligen PIN fest.
      </p>

      <input
        id="pinFestlegenNameNeu"
        type="hidden"
      >

      <label
        for="pinFestlegen1Neu"
        style="
          display:block;
          margin-bottom:6px;
          font-weight:700;
        "
      >
        Neuer PIN
      </label>

      <input
        id="pinFestlegen1Neu"
        type="password"
        inputmode="numeric"
        maxlength="4"
        autocomplete="new-password"
        placeholder="••••"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          margin-bottom:15px;
          font-size:18px;
          letter-spacing:4px;
        "
      >

      <label
        for="pinFestlegen2Neu"
        style="
          display:block;
          margin-bottom:6px;
          font-weight:700;
        "
      >
        PIN wiederholen
      </label>

      <input
        id="pinFestlegen2Neu"
        type="password"
        inputmode="numeric"
        maxlength="4"
        autocomplete="new-password"
        placeholder="••••"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          margin-bottom:18px;
          font-size:18px;
          letter-spacing:4px;
        "
      >

      <button
        id="pinFestlegenButtonNeu"
        type="button"
        onclick="speichereNeuenPinNeu()"
        style="
          width:100%;
          border:0;
          background:#e30613;
          color:#ffffff;
          border-radius:9px;
          padding:12px 16px;
          font-weight:700;
          font-size:15px;
          cursor:pointer;
        "
      >
        🔐 Neuen PIN speichern
      </button>

      <button
        type="button"
        onclick="schliessePinFestlegenDialogNeu()"
        style="
          width:100%;
          margin-top:9px;
          border:1px solid #d7dce1;
          background:#ffffff;
          color:#555;
          border-radius:9px;
          padding:10px 16px;
          font-weight:600;
          cursor:pointer;
        "
      >
        Abbrechen
      </button>

      <div
        id="pinFestlegenMeldungNeu"
        style="
          margin-top:14px;
          min-height:22px;
          text-align:center;
        "
      ></div>
    </div>
  `;

  document.body.appendChild(
    overlay
  );
}


// ==========================================================
// PIN-DIALOG ANZEIGEN
// ==========================================================

function zeigePinFestlegenDialogNeu(
  name,
  infoText
) {
  installierePinFestlegenDialogNeu();

  const overlay =
    document.getElementById(
      'pinFestlegenOverlayNeu'
    );

  const nameElement =
    document.getElementById(
      'pinFestlegenNameNeu'
    );

  const info =
    document.getElementById(
      'pinFestlegenInfoNeu'
    );

  const pin1 =
    document.getElementById(
      'pinFestlegen1Neu'
    );

  const pin2 =
    document.getElementById(
      'pinFestlegen2Neu'
    );

  const meldung =
    document.getElementById(
      'pinFestlegenMeldungNeu'
    );

  if (nameElement) {
    nameElement.value =
      String(
        name || ''
      );
  }

  if (info) {
    info.textContent =
      infoText ||
      'Bitte lege deinen neuen 4-stelligen PIN fest.';
  }

  if (pin1) {
    pin1.value = '';
  }

  if (pin2) {
    pin2.value = '';
  }

  if (meldung) {
    meldung.textContent = '';
  }

  if (overlay) {
    overlay.style.display =
      'flex';
  }

  setTimeout(
    function() {
      pin1?.focus();
    },
    80
  );
}


// ==========================================================
// PIN-DIALOG SCHLIESSEN
// ==========================================================

function schliessePinFestlegenDialogNeu() {
  const overlay =
    document.getElementById(
      'pinFestlegenOverlayNeu'
    );

  if (overlay) {
    overlay.style.display =
      'none';
  }
}


// ==========================================================
// NEUEN PIN SPEICHERN
// ==========================================================

async function speichereNeuenPinNeu() {
  const name =
    String(
      document
        .getElementById(
          'pinFestlegenNameNeu'
        )
        ?.value || ''
    ).trim();

  const pin1 =
    String(
      document
        .getElementById(
          'pinFestlegen1Neu'
        )
        ?.value || ''
    ).trim();

  const pin2 =
    String(
      document
        .getElementById(
          'pinFestlegen2Neu'
        )
        ?.value || ''
    ).trim();

  const button =
    document.getElementById(
      'pinFestlegenButtonNeu'
    );

  const meldung =
    document.getElementById(
      'pinFestlegenMeldungNeu'
    );

  if (
    !/^\d{4}$/.test(pin1)
  ) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Der PIN muss genau 4 Zahlen haben.';
    }

    return;
  }

  if (
    pin1 !== pin2
  ) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Die beiden PINs stimmen nicht überein.';
    }

    return;
  }

  if (button) {
    button.disabled = true;

    button.textContent =
      'PIN wird gespeichert …';
  }

  if (meldung) {
    meldung.textContent = '';
  }

  try {
    const result =
      await apiPost(
        'pinFestlegen',
        {
          name: name,
          pin1: pin1,
          pin2: pin2
        }
      );

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Der PIN konnte nicht gespeichert werden.'
      );
    }

    localStorage.setItem(
      SESSION_KEY,
      result.token
    );

    aktuellerBenutzer =
      result.name || name;

    aktuellerAdmin =
      result.admin === true;

    dienstplanInitialisiert =
      false;

    schliessePinFestlegenDialogNeu();

    zeigeHauptApp(
      aktuellerBenutzer,
      aktuellerAdmin
    );

    if (
      typeof window.zeigeSeite ===
      'function'
    ) {
      await window.zeigeSeite(
        'dienstplan'
      );

    } else {
      await ladeMeinDienstplanNeu();
    }

  } catch (error) {
    console.error(
      'PIN festlegen:',
      error
    );

    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        '❌ ' +
        error.message;
    }

  } finally {
    if (button) {
      button.disabled = false;

      button.textContent =
        '🔐 Neuen PIN speichern';
    }
  }
}



// ==========================================================
// FERIEN / FEIERTAGE / URLAUBSSPERRE AUS GOOGLE SHEETS
// Blatt: "Ferien & Feiertage"
// ==========================================================

function parseDatumHinweisNeu(text) {
  const treffer =
    String(text || '')
      .trim()
      .match(
        /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
      );

  if (!treffer) {
    return null;
  }

  return new Date(
    Number(treffer[3]),
    Number(treffer[2]) - 1,
    Number(treffer[1]),
    12,
    0,
    0
  );
}


async function ladeKalenderHinweiseNeu(
  erzwingen = false
) {
  if (
    kalenderHinweiseGeladenNeu &&
    !erzwingen
  ) {
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    return;
  }

  try {
    const result =
      await apiPost(
        'kalenderHinweise',
        {
          token:
            token
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Kalenderhinweise konnten nicht geladen werden.'
      );
    }

    kalenderHinweiseNeu =
      Array.isArray(
        result.hinweise
      )
        ? result.hinweise
        : [];

    kalenderHinweiseGeladenNeu =
      true;

  } catch (error) {
    console.error(
      'Ferien & Feiertage:',
      error
    );

    kalenderHinweiseNeu =
      [];

    kalenderHinweiseGeladenNeu =
      false;
  }
}


function getKalenderHinweiseFuerDatumNeu(
  datumText
) {
  const datum =
    parseDatumHinweisNeu(
      datumText
    );

  if (!datum) {
    return [];
  }

  const zeit =
    datum.getTime();

  return (
    kalenderHinweiseNeu || []
  ).filter(
    function(hinweis) {
      const von =
        parseDatumHinweisNeu(
          hinweis.von
        );

      const bis =
        parseDatumHinweisNeu(
          hinweis.bis
        );

      if (
        !von ||
        !bis
      ) {
        return false;
      }

      return (
        zeit >= von.getTime() &&
        zeit <= bis.getTime()
      );
    }
  );
}


function kalenderHinweiseHtmlNeu(
  datumText
) {
  const hinweise =
    getKalenderHinweiseFuerDatumNeu(
      datumText
    );

  if (!hinweise.length) {
    return '';
  }

  return hinweise.map(
    function(hinweis) {
      const typ =
        String(
          hinweis.typ || ''
        )
          .trim()
          .toLowerCase();

      let symbol =
        'ℹ️';

      let hintergrund =
        '#f3f4f6';

      let farbe =
        '#444';

      if (
        typ ===
        'feiertag'
      ) {
        symbol =
          '🎉';

        hintergrund =
          '#fff3cd';

        farbe =
          '#765600';
      }

      else if (
        typ ===
        'ferien'
      ) {
        symbol =
          '🏖️';

        hintergrund =
          '#eaf4ff';

        farbe =
          '#174d7a';
      }

      else if (
        typ ===
        'urlaubssperre'
      ) {
        symbol =
          '⛔';

        hintergrund =
          '#fdecec';

        farbe =
          '#a51c2b';
      }

      return `
        <div
          style="
            display:inline-flex;
            align-items:center;
            gap:5px;
            margin-top:6px;
            margin-right:6px;
            padding:5px 9px;
            border-radius:999px;
            background:${hintergrund};
            color:${farbe};
            font-size:12px;
            font-weight:750;
          "
        >
          ${symbol}
          ${escapeHtmlNeu(
            hinweis.bezeichnung || ''
          )}
        </div>
      `;
    }
  ).join('');
}


// ==========================================================
// MEIN DIENSTPLAN LADEN
// ==========================================================

async function ladeMeinDienstplanNeu() {
  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  const liste =
    document.getElementById(
      'dienstplanListe'
    );

  if (
    liste &&
    !dienstplanInitialisiert
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Dienstplan wird geladen …
      </div>
    `;
  }

  try {
    const result =
      await apiPost(
        'meinDienstplan',
        {
          token: token
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Dienstplan konnte nicht geladen werden.'
      );
    }

    aktuellerBenutzer =
      result.name ||
      aktuellerBenutzer;

    aktuellerAdmin =
      result.admin === true;

    letzterDienstplan =
      Array.isArray(
        result.dienstplan
      )
        ? result.dienstplan
        : [];

    letzteAbwesenheiten =
      Array.isArray(
        result.abwesenheiten
      )
        ? result.abwesenheiten
        : [];

    aktualisiereSidebarNeu(
      aktuellerBenutzer,
      aktuellerAdmin
    );

    aktualisiereWochenstundenNeu(
      result.sollstunden
    );

    await ladeKalenderHinweiseNeu();

    if (
      !dienstplanInitialisiert
    ) {
      setzeAktuelleKwNeu();

      dienstplanInitialisiert =
        true;
    }

    rendereDienstplanNeu();

    const laden =
      document.getElementById(
        'dienstplanLaden'
      );

    if (laden) {
      laden.style.display = 'none';
    }

  } catch (error) {
    console.error(
      'Dienstplan:',
      error
    );

    if (liste) {
      liste.innerHTML = `
        <div
          class="empty-state"
          style="color:#b00020;"
        >
          ❌ ${escapeHtmlNeu(
            error.message
          )}
        </div>
      `;
    }
  }
}


// ==========================================================
// SIDEBAR AKTUALISIEREN
// ==========================================================

function aktualisiereSidebarNeu(
  name,
  admin
) {
  const nameElement =
    document.getElementById(
      'sidebarName'
    );

  if (nameElement) {
    nameElement.textContent =
      name || '';
  }

  const rolleElement =
    document.getElementById(
      'sidebarRolle'
    );

  if (rolleElement) {
    rolleElement.textContent =
      admin
        ? 'Admin'
        : 'Mitarbeiter';
  }

  const adminButton =
    document.getElementById(
      'adminNavigationButton'
    );

  if (adminButton) {
    adminButton.style.display =
      admin
        ? ''
        : 'none';
  }

  const adminNav =
    document.getElementById(
      'adminNav'
    );

  if (adminNav) {
    adminNav.style.display =
      admin
        ? ''
        : 'none';
  }

  const adminUntermenue =
    document.getElementById(
      'adminUntermenueNeu'
    );

  if (adminUntermenue) {
    adminUntermenue.style.display =
      admin
        ? 'block'
        : 'none';
  }
}


// ==========================================================
// WOCHENSTUNDEN
// ==========================================================

function aktualisiereWochenstundenNeu(
  sollstunden
) {
  const element =
    document.getElementById(
      'dienstplanSollstunden'
    ) ||
    document.getElementById(
      'sidebarWochenstunden'
    );

  if (!element) {
    return;
  }

  const zahl =
    Number(
      sollstunden || 0
    );

  element.textContent =
    Number.isFinite(zahl)
      ? zahl.toLocaleString(
          'de-DE',
          {
            maximumFractionDigits: 2
          }
        ) +
        ' Std./Woche'
      : '';
}


// ==========================================================
// AKTUELLE KW ERMITTELN
// ==========================================================

function setzeAktuelleKwNeu() {
  const heute =
    new Date();

  const datum =
    new Date(
      Date.UTC(
        heute.getFullYear(),
        heute.getMonth(),
        heute.getDate()
      )
    );

  const tagNummer =
    datum.getUTCDay() || 7;

  datum.setUTCDate(
    datum.getUTCDate() +
    4 -
    tagNummer
  );

  const jahresStart =
    new Date(
      Date.UTC(
        datum.getUTCFullYear(),
        0,
        1
      )
    );

  const kw =
    Math.ceil(
      (
        (
          datum -
          jahresStart
        ) /
        86400000 +
        1
      ) /
      7
    );

  aktuelleKwNeu = kw;

  const vorhandeneKws =
    Array.from(
      new Set(
        letzterDienstplan
          .map(
            function(eintrag) {
              return Number(
                eintrag.kw
              );
            }
          )
          .filter(
            function(kwNummer) {
              return Number.isFinite(
                kwNummer
              );
            }
          )
      )
    )
      .sort(
        function(a, b) {
          return a - b;
        }
      );

  if (
    vorhandeneKws.length > 0 &&
    !vorhandeneKws.includes(
      aktuelleKwNeu
    )
  ) {
    aktuelleKwNeu =
      vorhandeneKws[0];
  }

  aktualisiereKwAnzeigeNeu();
}


// ==========================================================
// KW WECHSELN
// ==========================================================

function wechselKwNeu(
  richtung
) {
  const kws =
    Array.from(
      new Set(
        letzterDienstplan
          .map(
            function(eintrag) {
              return Number(
                eintrag.kw
              );
            }
          )
          .filter(
            function(kwNummer) {
              return Number.isFinite(
                kwNummer
              );
            }
          )
      )
    )
      .sort(
        function(a, b) {
          return a - b;
        }
      );

  if (
    kws.length === 0
  ) {
    return;
  }

  let index =
    kws.indexOf(
      Number(
        aktuelleKwNeu
      )
    );

  if (
    index < 0
  ) {
    index = 0;
  }

  index +=
    Number(
      richtung || 0
    ) < 0
      ? -1
      : 1;

  if (
    index < 0
  ) {
    index =
      kws.length - 1;
  }

  if (
    index >=
    kws.length
  ) {
    index = 0;
  }

  aktuelleKwNeu =
    kws[index];

  aktualisiereKwAnzeigeNeu();

  rendereDienstplanNeu();
}


// ==========================================================
// KW-ANZEIGE
// ==========================================================

function aktualisiereKwAnzeigeNeu() {
  const anzeige =
    document.getElementById(
      'kwAnzeige'
    );

  if (!anzeige) {
    return;
  }

  anzeige.textContent =
    'KW ' +
    String(
      aktuelleKwNeu || 1
    );
}


// ==========================================================
// DIENSTPLAN-RENDERER AUFRUF
// ==========================================================

function rendereDienstplanNeu() {
  rendereDienstplan(
    letzterDienstplan
  );
}

// ==========================================================
// DIENSTPLAN RENDERN
// ==========================================================

function rendereDienstplan(
  plan
) {
  const liste =
    document.getElementById(
      'dienstplanListe'
    );

  if (!liste) {
    return;
  }

  const woche =
    (plan || []).filter(
      function(z) {
        return (
          Number(
            z.kw || 0
          ) ===
          Number(
            aktuelleKwNeu
          )
        );
      }
    );

  if (
    woche.length === 0
  ) {
    liste.innerHTML = `
      <div
        class="empty-state"
        style="
          padding:20px;
          text-align:center;
        "
      >
        Für KW ${escapeHtmlNeu(
          aktuelleKwNeu
        )}
        wurden keine Dienste gefunden.
      </div>
    `;

    return;
  }

  const relevanteTage =
    woche.filter(
      function(z) {
        return (
          z.gpFrueh ||
          z.gpSpaet ||
          z.gpAbloese ||
          z.wpFrueh ||
          z.wpSpaet ||
          z.wpAbloese
        );
      }
    );

  if (
    relevanteTage.length === 0
  ) {
    liste.innerHTML = `
      <div
        class="empty-state"
        style="
          padding:20px;
          text-align:center;
        "
      >
        In KW ${escapeHtmlNeu(
          aktuelleKwNeu
        )}
        hast du keine eingetragenen Dienste.
      </div>
    `;

    return;
  }

  let html = '';

  relevanteTage.forEach(
    function(z) {
      const dienste = [];

      // ------------------------------------------------------
      // GARDEN PLAZA – FRÜH
      // ------------------------------------------------------

      if (
        z.gpFrueh
      ) {
        dienste.push({
          klasse:
            'garden',

          code:
            'GP_FRUEH',

          name:
            'Garden Plaza – Früh',

          symbol:
            '☀️',

          zeit:
            zeitFruehNeu(
              z.tag
            ),

          tauschbar:
            true,

          zusatz:
            ''
        });
      }

      // ------------------------------------------------------
      // GARDEN PLAZA – SPÄT
      // ------------------------------------------------------

      if (
        z.gpSpaet
      ) {
        let zusatz = '';

        /*
          Wenn beim GP-Spätdienst gleichzeitig
          eine WP-Pausenablöse eingetragen ist,
          gehört sie zu diesem Dienst.
        */
        if (
          z.wpAbloese
        ) {
          zusatz =
            'WP-Pausenablöse: ' +
            (
              z.wpAbloesezeit ||
              'Zeit nicht eingetragen'
            );
        }

        dienste.push({
          klasse:
            'garden',

          code:
            'GP_SPAET',

          name:
            'Garden Plaza – Spät',

          symbol:
            '🌙',

          zeit:
            zeitSpaetNeu(
              z.tag
            ),

          tauschbar:
            true,

          zusatz:
            zusatz
        });
      }

      // ------------------------------------------------------
      // WATER PLAZA
      // ------------------------------------------------------

      if (
        z.wpFrueh &&
        z.wpSpaet
      ) {
        dienste.push({
          klasse:
            'water',

          code:
            'WP_GANZTAG',

          name:
            'Water Plaza – Ganztag',

          symbol:
            '🔵',

          zeit:
            '09:00 – ' +
            zeitSpaetEndeNeu(
              z.tag
            ),

          tauschbar:
            true,

          zusatz:
            ''
        });

      } else {

        // ----------------------------------------------------
        // WATER PLAZA – FRÜH
        // ----------------------------------------------------

        if (
          z.wpFrueh
        ) {
          dienste.push({
            klasse:
              'water',

            code:
              'WP_FRUEH',

            name:
              'Water Plaza – Früh',

            symbol:
              '☀️',

            zeit:
              zeitFruehNeu(
                z.tag
              ),

            tauschbar:
              true,

            zusatz:
              ''
          });
        }

        // ----------------------------------------------------
        // WATER PLAZA – SPÄT
        // ----------------------------------------------------

        if (
          z.wpSpaet
        ) {
          dienste.push({
            klasse:
              'water',

            code:
              'WP_SPAET',

            name:
              'Water Plaza – Spät',

            symbol:
              '🌙',

            zeit:
              zeitSpaetNeu(
                z.tag
              ),

            tauschbar:
              true,

            zusatz:
              ''
          });
        }
      }

      // ------------------------------------------------------
      // GARDEN PLAZA – PAUSENABLÖSE
      // ------------------------------------------------------

      if (
        z.gpAbloese
      ) {
        dienste.push({
          klasse:
            'abloese',

          code:
            '',

          name:
            'Garden Plaza – Pausenablöse',

          symbol:
            '☕',

          zeit:
            z.gpAbloesezeit ||
            '',

          tauschbar:
            false,

          zusatz:
            ''
        });
      }

      // ------------------------------------------------------
      // WATER PLAZA – PAUSENABLÖSE
      // ------------------------------------------------------
      // Wenn GP-Spät vorhanden ist, wird WP-Pausenablöse
      // bereits beim GP-Spätdienst angezeigt.
      // ------------------------------------------------------

      if (
        z.wpAbloese &&
        !z.gpSpaet
      ) {
        dienste.push({
          klasse:
            'abloese',

          code:
            '',

          name:
            'Water Plaza – Pausenablöse',

          symbol:
            '☕',

          zeit:
            z.wpAbloesezeit ||
            '',

          tauschbar:
            false,

          zusatz:
            ''
        });
      }

      // ------------------------------------------------------
      // TAGESKARTE
      // ------------------------------------------------------

      html += `
        <div
          class="scs-tag-karte"
          style="
            background:#ffffff;
            border:1px solid #dfe3e8;
            border-radius:13px;
            padding:17px;
            margin-bottom:13px;
            box-shadow:
              0 4px 14px
              rgba(0,0,0,0.035);
          "
        >
          <div
            style="
              margin-bottom:10px;
            "
          >
            <strong
              style="
                display:block;
                color:#111111;
                font-size:17px;
                line-height:1.35;
              "
            >
              ${escapeHtmlNeu(
                z.tag || ''
              )},
              ${escapeHtmlNeu(
                z.datum || ''
              )}
            </strong>

            ${kalenderHinweiseHtmlNeu(
              z.datum || ''
            )}
          </div>
      `;

      // ------------------------------------------------------
      // DIENSTE DES TAGES
      // ------------------------------------------------------

      dienste.forEach(
        function(dienst) {
          let randfarbe =
            '#999999';

          let hintergrund =
            '#ffffff';

          let zusatzFarbe =
            '#777777';

          // Garden Plaza = GRÜN
          if (
            dienst.klasse ===
            'garden'
          ) {
            randfarbe =
              '#14943b';

            hintergrund =
              '#f5fff8';

            zusatzFarbe =
              '#8a5b00';
          }

          // Water Plaza = BLAU
          else if (
            dienst.klasse ===
            'water'
          ) {
            randfarbe =
              '#1754d1';

            hintergrund =
              '#f5f8ff';
          }

          // Pausenablöse = ORANGE/BRAUN
          else if (
            dienst.klasse ===
            'abloese'
          ) {
            randfarbe =
              '#d99032';

            hintergrund =
              '#fffaf3';

            zusatzFarbe =
              '#8a5b00';
          }

          const onclick =
            dienst.tauschbar
              ? `starteDirektenTausch(${JSON.stringify(
                  String(
                    z.datum || ''
                  )
                )},${JSON.stringify(
                  String(
                    z.tag || ''
                  )
                )},${JSON.stringify(
                  String(
                    z.kw || ''
                  )
                )},${JSON.stringify(
                  String(
                    dienst.code || ''
                  )
                )},${JSON.stringify(
                  String(
                    dienst.name || ''
                  )
                )},${JSON.stringify(
                  String(
                    dienst.zeit || ''
                  )
                )})`
              : '';

          html += `
            <div
              class="scs-dienst-karte"
              data-plaza="${escapeHtmlNeu(
                dienst.klasse
              )}"
              style="
                background:${hintergrund};
                border:1px solid #e1e4e8;
                border-left:6px solid ${randfarbe};
                border-radius:10px;
                padding:13px 14px;
                margin-top:9px;
                box-sizing:border-box;
              "
            >
              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  gap:14px;
                  flex-wrap:wrap;
                "
              >
                <div
                  style="
                    min-width:0;
                    flex:1;
                  "
                >
                  <div
                    class="dienstname"
                    style="
                      color:#161616;
                      font-weight:700;
                      line-height:1.35;
                    "
                  >
                    ${escapeHtmlNeu(
                      dienst.symbol
                    )}
                    ${escapeHtmlNeu(
                      dienst.name
                    )}
                  </div>

                  ${
                    dienst.zeit
                      ? `
                        <div
                          style="
                            color:#666666;
                            margin-top:5px;
                            line-height:1.35;
                          "
                        >
                          🕒 ${escapeHtmlNeu(
                            dienst.zeit
                          )}
                        </div>
                      `
                      : ''
                  }

                  ${
                    dienst.zusatz
                      ? `
                        <div
                          style="
                            margin-top:7px;
                            color:${zusatzFarbe};
                            font-size:13px;
                            line-height:1.4;
                            font-weight:500;
                          "
                        >
                          ☕ ${escapeHtmlNeu(
                            dienst.zusatz
                          )}
                        </div>
                      `
                      : ''
                  }
                </div>

                ${
                  dienst.tauschbar
                    ? `
                      <button
                        type="button"
                        onclick='${onclick}'
                        style="
                          flex:0 0 auto;
                          border:1px solid #e30613;
                          background:#ffffff;
                          color:#e30613;
                          border-radius:8px;
                          padding:8px 12px;
                          font-weight:700;
                          cursor:pointer;
                        "
                      >
                        🔄 Dienst tauschen
                      </button>
                    `
                    : ''
                }
              </div>
            </div>
          `;
        }
      );

      // ------------------------------------------------------
      // NOTIZ
      // ------------------------------------------------------

      if (
        z.notiz
      ) {
        html += `
          <div
            style="
              margin-top:10px;
              color:#666666;
              font-size:14px;
            "
          >
            📝 ${escapeHtmlNeu(
              z.notiz
            )}
          </div>
        `;
      }

      html +=
        '</div>';
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// DIREKTEN TAUSCH STARTEN
// ==========================================================

function starteDirektenTausch(
  datum,
  tag,
  kw,
  code,
  text,
  zeit
) {
  tauschDatum =
    String(
      datum || ''
    );

  tauschTag =
    String(
      tag || ''
    );

  tauschKw =
    String(
      kw || ''
    );

  tauschDienstCode =
    String(
      code || ''
    );

  tauschDienstText =
    String(
      text || ''
    );

  tauschZeit =
    String(
      zeit || ''
    );

  if (
    typeof window.zeigeSeite ===
    'function'
  ) {
    window.zeigeSeite(
      'dienstTauschen'
    );
  }

  setTimeout(
    function() {
      fuelleTauschAnsichtNeu();
    },
    80
  );
}


// ==========================================================
// TAUSCHBARE EIGENE DIENSTE SAMMELN
// ==========================================================

function sammleTauschbareEigeneDiensteNeu() {
  const ergebnis = [];

  (
    Array.isArray(
      letzterDienstplan
    )
      ? letzterDienstplan
      : []
  ).forEach(
    function(z) {
      const datum =
        String(
          z.datum || ''
        ).trim();

      const tag =
        String(
          z.tag || ''
        ).trim();

      const kw =
        String(
          z.kw || ''
        ).trim();

      if (!datum) {
        return;
      }

      if (
        z.gpFrueh
      ) {
        ergebnis.push({
          datum: datum,
          tag: tag,
          kw: kw,
          code: 'GP_FRUEH',
          text: 'Garden Plaza – Früh',
          zeit:
            zeitFruehNeu(
              z.tag
            )
        });
      }

      if (
        z.gpSpaet
      ) {
        ergebnis.push({
          datum: datum,
          tag: tag,
          kw: kw,
          code: 'GP_SPAET',
          text: 'Garden Plaza – Spät',
          zeit:
            zeitSpaetNeu(
              z.tag
            )
        });
      }

      /*
        Water Plaza Früh + Spät am selben Tag
        wird als ein Ganztagsdienst behandelt.
      */
      if (
        z.wpFrueh &&
        z.wpSpaet
      ) {
        ergebnis.push({
          datum: datum,
          tag: tag,
          kw: kw,
          code: 'WP_GANZTAG',
          text: 'Water Plaza – Ganztag',
          zeit:
            '09:00 – ' +
            zeitSpaetEndeNeu(
              z.tag
            )
        });

        return;
      }

      if (
        z.wpFrueh
      ) {
        ergebnis.push({
          datum: datum,
          tag: tag,
          kw: kw,
          code: 'WP_FRUEH',
          text: 'Water Plaza – Früh',
          zeit:
            zeitFruehNeu(
              z.tag
            )
        });
      }

      if (
        z.wpSpaet
      ) {
        ergebnis.push({
          datum: datum,
          tag: tag,
          kw: kw,
          code: 'WP_SPAET',
          text: 'Water Plaza – Spät',
          zeit:
            zeitSpaetNeu(
              z.tag
            )
        });
      }
    }
  );

  return ergebnis;
}


// ==========================================================
// TAUSCHTAGE SAMMELN
// ==========================================================

function ermittleTauschTageNeu() {
  const dienste =
    sammleTauschbareEigeneDiensteNeu();

  const tage = [];

  dienste.forEach(
    function(dienst) {
      let tag =
        tage.find(
          function(eintrag) {
            return (
              eintrag.datum ===
              dienst.datum
            );
          }
        );

      if (!tag) {
        tag = {
          datum:
            dienst.datum,

          tag:
            dienst.tag,

          kw:
            dienst.kw,

          dienste:
            []
        };

        tage.push(
          tag
        );
      }

      tag.dienste.push(
        dienst
      );
    }
  );

  return tage;
}


// ==========================================================
// TAUSCHANSICHT INITIALISIEREN
// ==========================================================

async function initialisiereTauschAnsichtNeu() {
  if (
    !Array.isArray(
      letzterDienstplan
    ) ||
    letzterDienstplan.length === 0
  ) {
    await ladeMeinDienstplanNeu();
  }

  const tage =
    ermittleTauschTageNeu();

  if (
    tage.length === 0
  ) {
    tauschDatum = '';
    tauschTag = '';
    tauschKw = '';
    tauschDienstCode = '';
    tauschDienstText = '';
    tauschZeit = '';

    fuelleTauschAnsichtNeu();

    return;
  }

  const aktuellerTag =
    tage.find(
      function(eintrag) {
        return (
          eintrag.datum ===
          tauschDatum
        );
      }
    );

  if (!aktuellerTag) {
    const ersterTag =
      tage[0];

    const ersterDienst =
      ersterTag.dienste[0];

    tauschDatum =
      ersterTag.datum;

    tauschTag =
      ersterTag.tag;

    tauschKw =
      ersterTag.kw;

    tauschDienstCode =
      ersterDienst.code;

    tauschDienstText =
      ersterDienst.text;

    tauschZeit =
      ersterDienst.zeit;
  }

  fuelleTauschAnsichtNeu();
}


// ==========================================================
// TAUSCHTAG MIT ← / → WECHSELN
// ==========================================================

function wechselTauschTagNeu(
  richtung
) {
  const tage =
    ermittleTauschTageNeu();

  if (
    tage.length === 0
  ) {
    return;
  }

  let index =
    tage.findIndex(
      function(eintrag) {
        return (
          eintrag.datum ===
          tauschDatum
        );
      }
    );

  if (
    index < 0
  ) {
    index = 0;
  }

  index +=
    Number(
      richtung || 0
    ) < 0
      ? -1
      : 1;

  if (
    index < 0
  ) {
    index =
      tage.length - 1;
  }

  if (
    index >=
    tage.length
  ) {
    index = 0;
  }

  const neuerTag =
    tage[index];

  const ersterDienst =
    neuerTag.dienste[0];

  tauschDatum =
    neuerTag.datum;

  tauschTag =
    neuerTag.tag;

  tauschKw =
    neuerTag.kw;

  tauschDienstCode =
    ersterDienst.code;

  tauschDienstText =
    ersterDienst.text;

  tauschZeit =
    ersterDienst.zeit;

  fuelleTauschAnsichtNeu();
}


// ==========================================================
// DIENST AM AUSGEWÄHLTEN TAG WÄHLEN
// ==========================================================

function waehleTauschDienstNeu(
  code
) {
  const tage =
    ermittleTauschTageNeu();

  const tag =
    tage.find(
      function(eintrag) {
        return (
          eintrag.datum ===
          tauschDatum
        );
      }
    );

  if (!tag) {
    return;
  }

  const dienst =
    tag.dienste.find(
      function(eintrag) {
        return (
          eintrag.code ===
          String(
            code || ''
          )
        );
      }
    );

  if (!dienst) {
    return;
  }

  tauschDienstCode =
    dienst.code;

  tauschDienstText =
    dienst.text;

  tauschZeit =
    dienst.zeit;

  fuelleTauschAnsichtNeu();
}

// ==========================================================
// TAUSCHANSICHT FÜLLEN
// ==========================================================

function fuelleTauschAnsichtNeu() {
  const ansicht =
    document.getElementById(
      'tauschAnsicht'
    );

  if (!ansicht) {
    return;
  }

  const tage =
    ermittleTauschTageNeu();

  const aktuellerTag =
    tage.find(
      function(eintrag) {
        return (
          eintrag.datum ===
          tauschDatum
        );
      }
    );

  // --------------------------------------------------------
  // PFEILE ← / →
  // --------------------------------------------------------

  const datumNavigation =
    ansicht.querySelector(
      '.datum-navigation'
    );

  if (datumNavigation) {
    const buttons =
      datumNavigation.querySelectorAll(
        'button'
      );

    if (
      buttons.length >= 3
    ) {
      buttons[0].onclick =
        function() {
          wechselTauschTagNeu(
            -1
          );
        };

      buttons[2].onclick =
        function() {
          wechselTauschTagNeu(
            1
          );
        };
    }
  }

  // --------------------------------------------------------
  // DATUM ANZEIGEN
  // --------------------------------------------------------

  const datumButton =
    ansicht.querySelector(
      '.datum-button'
    );

  if (datumButton) {
    if (aktuellerTag) {
      datumButton.innerHTML = `
        <span>📅</span>

        <strong>
          ${escapeHtmlNeu(
            aktuellerTag.datum
          )}
        </strong>

        <span>
          (${escapeHtmlNeu(
            aktuellerTag.tag
          )})
        </span>
      `;

    } else {
      datumButton.innerHTML = `
        <span>📅</span>

        <strong>
          —
        </strong>
      `;
    }
  }

  const eigeneDienste =
    ansicht.querySelector(
      '.eigene-dienste'
    );

  const dienstAuswahl =
    ansicht.querySelector(
      '.dienst-auswahl'
    );

  // --------------------------------------------------------
  // KEINE TAUSCHBAREN DIENSTE
  // --------------------------------------------------------

  if (!aktuellerTag) {
    if (eigeneDienste) {
      eigeneDienste.innerHTML = `
        <h3>
          Deine Dienste an diesem Tag
        </h3>

        <div class="empty-state">
          Du hast aktuell keine tauschbaren Dienste.
        </div>
      `;
    }

    if (dienstAuswahl) {
      dienstAuswahl.innerHTML = `
        <div class="empty-state">
          Keine tauschbaren Dienste vorhanden.
        </div>
      `;
    }

    const kollegenBereich =
      document.getElementById(
        'kollegenBereich'
      );

    if (kollegenBereich) {
      kollegenBereich.classList.add(
        'versteckt'
      );
    }

    return;
  }

  // --------------------------------------------------------
  // AUSGEWÄHLTEN DIENST SICHERSTELLEN
  // --------------------------------------------------------

  let ausgewaehlterDienst =
    aktuellerTag.dienste.find(
      function(dienst) {
        return (
          dienst.code ===
          tauschDienstCode
        );
      }
    );

  if (!ausgewaehlterDienst) {
    ausgewaehlterDienst =
      aktuellerTag.dienste[0];

    tauschDienstCode =
      ausgewaehlterDienst.code;

    tauschDienstText =
      ausgewaehlterDienst.text;

    tauschZeit =
      ausgewaehlterDienst.zeit;
  }

  // --------------------------------------------------------
  // DEINE DIENSTE AN DIESEM TAG
  // --------------------------------------------------------

  if (eigeneDienste) {
    let html = `
      <h3>
        Deine Dienste an diesem Tag
      </h3>
    `;

    aktuellerTag.dienste.forEach(
      function(dienst) {
        const istGarden =
          dienst.code.startsWith(
            'GP'
          );

        html += `
          <div class="dienst-mini">

            <div class="dienst-links">

              <span
                class="punkt ${
                  istGarden
                    ? 'gruen'
                    : 'blau'
                }"
              ></span>

              <span>
                ${escapeHtmlNeu(
                  dienst.text
                )}
              </span>

            </div>

            <strong
              class="${
                istGarden
                  ? 'gruen-text'
                  : 'blau-text'
              }"
            >
              ${escapeHtmlNeu(
                aktuellerBenutzer
              )}
            </strong>

          </div>
        `;
      }
    );

    eigeneDienste.innerHTML =
      html;
  }

  // --------------------------------------------------------
  // SCHRITT 2 – DIENST AUSWÄHLEN
  // --------------------------------------------------------

  if (dienstAuswahl) {
    let html = '';

    aktuellerTag.dienste.forEach(
      function(dienst) {
        const istGarden =
          dienst.code.startsWith(
            'GP'
          );

        const ausgewaehlt =
          dienst.code ===
          tauschDienstCode;

        let symbol =
          '🔵';

        if (
          dienst.code.includes(
            'FRUEH'
          )
        ) {
          symbol =
            '☀️';
        }

        else if (
          dienst.code.includes(
            'SPAET'
          )
        ) {
          symbol =
            '🌙';
        }

        html += `
          <button
            class="dienst-option ${
              ausgewaehlt
                ? 'ausgewaehlt'
                : ''
            }"
            type="button"
            onclick="waehleTauschDienstNeu('${escapeHtmlNeu(
              dienst.code
            )}')"
          >

            <span
              class="radio ${
                ausgewaehlt
                  ? 'aktiv'
                  : ''
              }"
            ></span>

            <div class="dienst-symbol">
              ${symbol}
            </div>

            <div class="dienst-option-text">

              <strong
                class="${
                  istGarden
                    ? 'gruen-text'
                    : 'blau-text'
                }"
              >
                ${escapeHtmlNeu(
                  dienst.text
                )}
              </strong>

              <span>
                Dienstzeit:
                ${escapeHtmlNeu(
                  dienst.zeit
                )}
              </span>

              ${
                ausgewaehlt
                  ? `
                    <small
                      class="status-chip ${
                        istGarden
                          ? 'gruen-chip'
                          : 'blau-chip'
                      }"
                    >
                      Ausgewählt
                    </small>
                  `
                  : ''
              }

            </div>

          </button>
        `;
      }
    );

    dienstAuswahl.innerHTML =
      html;
  }

  // --------------------------------------------------------
  // WEITER-BUTTON
  // --------------------------------------------------------

  const weiterButton =
    ansicht.querySelector(
      '.weiter-button'
    );

  if (weiterButton) {
    weiterButton.onclick =
      ladeEchteTauschpartner;
  }

  // --------------------------------------------------------
  // SCHRITT 3 ZURÜCKSETZEN
  // --------------------------------------------------------

  const kollegenBereich =
    document.getElementById(
      'kollegenBereich'
    );

  if (kollegenBereich) {
    kollegenBereich.classList.add(
      'versteckt'
    );

    kollegenBereich.innerHTML = `
      <h2>
        3. Kollegen wählen
      </h2>

      <p class="beschreibung">
        Mit wem möchtest du deinen Dienst tauschen?
      </p>

      <div class="kollegen-grid">

        <div class="empty-state">
          Klicke auf „Weiter zu Schritt 3“.
        </div>

      </div>
    `;
  }
}


// ==========================================================
// TAUSCHPARTNER LADEN
// ==========================================================

async function ladeEchteTauschpartner() {
  const bereich =
    document.getElementById(
      'kollegenBereich'
    );

  if (!bereich) {
    return;
  }

  if (
    !tauschDatum ||
    !tauschDienstCode
  ) {
    window.alert(
      'Bitte zuerst einen Tag und Dienst auswählen.'
    );

    return;
  }

  bereich.classList.remove(
    'versteckt'
  );

  bereich.innerHTML = `
    <h2>
      3. Kollegen wählen
    </h2>

    <p class="beschreibung">
      Echte Dienste für
      ${escapeHtmlNeu(
        tauschDatum
      )}
      werden geladen …
    </p>
  `;

  bereich.scrollIntoView({
    behavior:
      'smooth',

    block:
      'start'
  });

  try {
    const token =
      localStorage.getItem(
        SESSION_KEY
      );

    if (!token) {
      await sessionAbgelaufenNeu();

      return;
    }

    const result =
      await apiPost(
        'tauschMoeglichkeiten',
        {
          token:
            token,

          datum:
            tauschDatum
        }
      );

    if (
      !result ||
      !result.ok
    ) {
      if (
        result &&
        result.sessionExpired
      ) {
        await sessionAbgelaufenNeu();

        return;
      }

      throw new Error(
        result?.message ||
        'Tauschpartner konnten nicht geladen werden.'
      );
    }

    let kandidaten =
      Array.isArray(
        result.kandidaten
      )
        ? result.kandidaten.slice()
        : [];

    /*
      Falls eine Person bei Water Plaza
      sowohl Früh als auch Spät hat,
      wird daraus ein Ganztagsdienst.
    */
    kandidaten =
      kombiniereWpGanztagKandidaten(
        kandidaten
      );

    /*
      Den eigenen Mitarbeiter aus der Liste entfernen.
    */
    kandidaten =
      kandidaten.filter(
        function(k) {
          return (
            String(
              k.mitarbeiter || ''
            )
              .trim()
              .toLowerCase() !==
            String(
              aktuellerBenutzer || ''
            )
              .trim()
              .toLowerCase()
          );
        }
      );

    if (
      kandidaten.length === 0
    ) {
      bereich.innerHTML = `
        <h2>
          3. Kollegen wählen
        </h2>

        <p class="beschreibung">
          Für diesen Tag wurden keine anderen
          tauschbaren Dienste gefunden.
        </p>
      `;

      return;
    }

    const frueh =
      kandidaten.filter(
        function(k) {
          return (
            String(
              k.schicht || ''
            )
              .trim()
              .toLowerCase() ===
            'früh'
          );
        }
      );

    const spaet =
      kandidaten.filter(
        function(k) {
          return (
            String(
              k.schicht || ''
            )
              .trim()
              .toLowerCase() ===
            'spät'
          );
        }
      );

    const ganz =
      kandidaten.filter(
        function(k) {
          return (
            String(
              k.schicht || ''
            )
              .trim()
              .toLowerCase() ===
            'ganztag'
          );
        }
      );

    let html = `
      <h2>
        3. Kollegen wählen
      </h2>

      <p class="beschreibung">
        Mit wem möchtest du deinen Dienst tauschen?
      </p>

      <div class="kollegen-grid">
    `;

    if (
      frueh.length
    ) {
      html +=
        baueKollegenBox(
          '☀️ Frühdienste',
          'frueh',
          frueh
        );
    }

    if (
      spaet.length
    ) {
      html +=
        baueKollegenBox(
          '🌙 Spätdienste',
          'spaet',
          spaet
        );
    }

    if (
      ganz.length
    ) {
      html +=
        baueKollegenBox(
          '🔵 Ganztagsdienste',
          'ganztag',
          ganz
        );
    }

    html +=
      '</div>';

    html += `
      <div
        id="tauschSchritt4"
        style="
          margin-top:24px;
          padding-top:20px;
          border-top:1px solid #e1e4e8;
        "
      >
        <h2>
          4. Anfrage senden
        </h2>

        <p class="beschreibung">
          Wähle oben einen Kollegen aus.
          Danach kannst du die Tauschanfrage absenden.
        </p>

        <div
          id="tauschAuswahlZusammenfassung"
          style="
            margin:14px 0;
            padding:12px;
            border-radius:8px;
            background:#f6f7f8;
            color:#555;
          "
        >
          Noch kein Tauschpartner ausgewählt.
        </div>

        <label
          for="tauschNachricht"
          style="
            display:block;
            font-weight:700;
            margin-bottom:6px;
          "
        >
          Nachricht (optional)
        </label>

        <textarea
          id="tauschNachricht"
          maxlength="500"
          rows="3"
          placeholder="z. B. Danke fürs Tauschen!"
          style="
            width:100%;
            box-sizing:border-box;
            border:1px solid #d8dde3;
            border-radius:8px;
            padding:10px 12px;
            font:inherit;
            resize:vertical;
          "
        ></textarea>

        <button
          id="tauschSendenButton"
          type="button"
          onclick="sendeTauschAnfrageNeu()"
          disabled
          style="
            margin-top:14px;
            border:0;
            background:#e30613;
            color:#ffffff;
            border-radius:8px;
            padding:11px 16px;
            font-weight:700;
            cursor:pointer;
            opacity:.55;
          "
        >
          📤 Tauschanfrage senden
        </button>

        <div
          id="tauschSendenMeldung"
          style="
            margin-top:12px;
          "
        ></div>
      </div>
    `;

    bereich.innerHTML =
      html;

  } catch (error) {
    console.error(
      'Tauschpartner:',
      error
    );

    bereich.innerHTML = `
      <h2>
        3. Kollegen wählen
      </h2>

      <p
        class="beschreibung"
        style="color:#b00020;"
      >
        ❌ ${escapeHtmlNeu(
          error.message
        )}
      </p>
    `;
  }
}


// ==========================================================
// WATER PLAZA FRÜH + SPÄT = GANZTAG
// ==========================================================

function kombiniereWpGanztagKandidaten(
  kandidaten
) {
  const benutzt =
    new Set();

  const ergebnis =
    [];

  kandidaten.forEach(
    function(k, index) {
      if (
        benutzt.has(
          index
        )
      ) {
        return;
      }

      if (
        k.code ===
        'WP_FRUEH'
      ) {
        const partnerIndex =
          kandidaten.findIndex(
            function(x, i) {
              return (
                i !== index &&
                !benutzt.has(
                  i
                ) &&
                x.code ===
                  'WP_SPAET' &&
                String(
                  x.mitarbeiter || ''
                ).trim() ===
                String(
                  k.mitarbeiter || ''
                ).trim()
              );
            }
          );

        if (
          partnerIndex >= 0
        ) {
          benutzt.add(
            index
          );

          benutzt.add(
            partnerIndex
          );

          ergebnis.push({
            code:
              'WP_GANZTAG',

            dienst:
              '🔵 Water Plaza – Ganztag',

            schicht:
              'Ganztag',

            mitarbeiter:
              k.mitarbeiter
          });

          return;
        }
      }

      benutzt.add(
        index
      );

      ergebnis.push(
        k
      );
    }
  );

  return ergebnis;
}


// ==========================================================
// KOLLEGEN-BOX
// ==========================================================

function baueKollegenBox(
  titel,
  klasse,
  kandidaten
) {
  let html = `
    <div
      class="kollegen-box ${escapeHtmlNeu(
        klasse
      )}"
    >

      <h3>
        ${titel}
      </h3>
  `;

  kandidaten.forEach(
    function(k) {
      const code =
        String(
          k.code || ''
        );

      const istGarden =
        code.startsWith(
          'GP'
        );

      html += `
        <label class="kollege">

          <input
            type="radio"
            name="kollege"
            value="${escapeHtmlNeu(
              code
            )}"
            data-name="${escapeHtmlNeu(
              k.mitarbeiter || ''
            )}"
            data-dienst="${escapeHtmlNeu(
              entferneDienstSymbol(
                k.dienst || ''
              )
            )}"
            onchange="aktualisiereTauschSchritt4()"
          >

          <span
            class="punkt ${
              istGarden
                ? 'gruen'
                : 'blau'
            }"
          ></span>

          <span>
            ${escapeHtmlNeu(
              k.mitarbeiter || ''
            )}
          </span>

          <strong>
            ${escapeHtmlNeu(
              entferneDienstSymbol(
                k.dienst || ''
              )
            )}
          </strong>

        </label>
      `;
    }
  );

  html +=
    '</div>';

  return html;
}


// ==========================================================
// TAUSCH-AUSWAHL AKTUALISIEREN
// ==========================================================

function aktualisiereTauschSchritt4() {
  const ausgewaehlt =
    document.querySelector(
      'input[name="kollege"]:checked'
    );

  const button =
    document.getElementById(
      'tauschSendenButton'
    );

  const zusammenfassung =
    document.getElementById(
      'tauschAuswahlZusammenfassung'
    );

  const meldung =
    document.getElementById(
      'tauschSendenMeldung'
    );

  if (meldung) {
    meldung.textContent =
      '';
  }

  if (!ausgewaehlt) {
    if (button) {
      button.disabled =
        true;

      button.style.opacity =
        '.55';
    }

    if (zusammenfassung) {
      zusammenfassung.textContent =
        'Noch kein Tauschpartner ausgewählt.';
    }

    return;
  }

  const partnerName =
    String(
      ausgewaehlt.dataset.name || ''
    ).trim();

  const partnerDienst =
    String(
      ausgewaehlt.dataset.dienst || ''
    ).trim();

  if (zusammenfassung) {
    zusammenfassung.innerHTML = `
      <strong>
        ${escapeHtmlNeu(
          tauschDienstText
        )}
      </strong>

      <span
        style="
          display:block;
          margin:5px 0;
        "
      >
        ↔
      </span>

      <strong>
        ${escapeHtmlNeu(
          partnerName
        )}
        –
        ${escapeHtmlNeu(
          partnerDienst
        )}
      </strong>
    `;
  }

  if (button) {
    button.disabled =
      false;

    button.style.opacity =
      '1';
  }
}


// ==========================================================
// TAUSCHANFRAGE SENDEN
// ==========================================================

async function sendeTauschAnfrageNeu() {
  const ausgewaehlt =
    document.querySelector(
      'input[name="kollege"]:checked'
    );

  const button =
    document.getElementById(
      'tauschSendenButton'
    );

  const meldung =
    document.getElementById(
      'tauschSendenMeldung'
    );

  const nachrichtElement =
    document.getElementById(
      'tauschNachricht'
    );

  if (!ausgewaehlt) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Bitte zuerst einen Tauschpartner auswählen.';
    }

    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  const partnerName =
    String(
      ausgewaehlt.dataset.name || ''
    ).trim();

  const partnerDienstCode =
    String(
      ausgewaehlt.value || ''
    ).trim();

  const nachricht =
    String(
      nachrichtElement?.value || ''
    ).trim();

  if (button) {
    button.disabled =
      true;

    button.style.opacity =
      '.55';

    button.textContent =
      'Anfrage wird gesendet …';
  }

  if (meldung) {
    meldung.style.color =
      '#555555';

    meldung.textContent =
      '';
  }

  try {
    const result =
      await apiPost(
        'tauschAnfrageSenden',
        {
          token:
            token,

          datum:
            tauschDatum,

          eigenerDienstCode:
            tauschDienstCode,

          partnerName:
            partnerName,

          partnerDienstCode:
            partnerDienstCode,

          nachricht:
            nachricht
        }
      );

    if (
      !result ||
      !result.ok
    ) {
      if (
        result &&
        result.sessionExpired
      ) {
        await sessionAbgelaufenNeu();

        return;
      }

      throw new Error(
        result?.message ||
        'Tauschanfrage konnte nicht gesendet werden.'
      );
    }

    if (meldung) {
      meldung.style.color =
        '#14943b';

      meldung.innerHTML = `
        ✅ ${escapeHtmlNeu(
          result.message ||
          'Tauschanfrage wurde gesendet.'
        )}
      `;
    }

    document
      .querySelectorAll(
        'input[name="kollege"]'
      )
      .forEach(
        function(input) {
          input.disabled =
            true;
        }
      );

    if (nachrichtElement) {
      nachrichtElement.disabled =
        true;
    }

    if (button) {
      button.disabled =
        true;

      button.style.opacity =
        '.75';

      button.textContent =
        '✅ Anfrage gesendet';
    }

    /*
      Badge / Meine Anfragen aktualisieren,
      ohne auf die Seite zu springen.
    */
    await ladeMeineAnfragenNeu(
      false
    );

  } catch (error) {
    console.error(
      'Tauschanfrage senden:',
      error
    );

    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        '❌ ' +
        error.message;
    }

    if (button) {
      button.disabled =
        false;

      button.style.opacity =
        '1';

      button.textContent =
        '📤 Tauschanfrage senden';
    }
  }
}


// ==========================================================
// DIENST-SYMBOL AM ANFANG ENTFERNEN
// ==========================================================

function entferneDienstSymbol(
  text
) {
  return String(
    text || ''
  )
    .replace(
      /^[^A-Za-zÄÖÜäöü]+/,
      ''
    )
    .trim();
}

// ==========================================================
// MEINE ANFRAGEN – ANSICHT
// ==========================================================

function installiereAnfragenAnsichtNeu() {
  if (
    document.getElementById(
      'anfragenAnsicht'
    )
  ) {
    return;
  }

  const main =
    document.querySelector(
      '#hauptApp .content'
    );

  if (!main) {
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'anfragenAnsicht';

  section.style.display =
    'none';

  section.innerHTML = `
    <div class="content-header">
      <div>
        <h1>
          Meine Anfragen
        </h1>

        <p>
          Hier siehst du deine Dienst- und Tauschanfragen.
        </p>
      </div>
    </div>

    <div
      class="panel"
      style="margin-bottom:18px;"
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          flex-wrap:wrap;
        "
      >
        <div>
          <h2 style="margin:0;">
            🔄 Tauschanfragen an mich
          </h2>

          <p
            style="
              margin:5px 0 0;
              color:#666;
            "
          >
            Diese Anfragen kannst du annehmen oder ablehnen.
          </p>
        </div>

        <button
          type="button"
          onclick="ladeMeineAnfragenNeu(true)"
          style="
            border:1px solid #d7dce1;
            background:#ffffff;
            border-radius:8px;
            padding:8px 12px;
            cursor:pointer;
          "
        >
          ↻ Aktualisieren
        </button>
      </div>

      <div
        id="erhalteneTauschAnfragenListe"
        style="margin-top:16px;"
      >
        <div class="empty-state">
          Anfragen werden geladen …
        </div>
      </div>
    </div>

    <div
      class="panel"
      style="margin-bottom:18px;"
    >
      <h2 style="margin-top:0;">
        📤 Von mir gesendete Tauschanfragen
      </h2>

      <div id="gesendeteTauschAnfragenListe">
        <div class="empty-state">
          Anfragen werden geladen …
        </div>
      </div>
    </div>

    <div
      class="panel"
      style="margin-bottom:18px;"
    >
      <h2 style="margin-top:0;">
        🏖️ Meine Urlaubsanträge
      </h2>

      <div id="meineUrlaubsanfragenListeNeu">
        <div class="empty-state">
          Urlaubsanträge werden geladen …
        </div>
      </div>
    </div>

    <div class="panel">
      <h2 style="margin-top:0;">
        💬 Meine sonstigen Wünsche
      </h2>

      <div id="meineDienstAnfragenListe">
        <div class="empty-state">
          Anfragen werden geladen …
        </div>
      </div>
    </div>
  `;

  main.appendChild(
    section
  );
}


// ==========================================================
// MEINE ANFRAGEN LADEN
// ==========================================================

async function ladeMeineAnfragenNeu(
  zeigeLaden = true
) {
  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    return;
  }

  installiereAnfragenAnsichtNeu();

  entferneDoppelteUrlaubsPanelsNeu();

  const erhaltenListe =
    document.getElementById(
      'erhalteneTauschAnfragenListe'
    );

  const gesendetListe =
    document.getElementById(
      'gesendeteTauschAnfragenListe'
    );

  const dienstListe =
    document.getElementById(
      'meineDienstAnfragenListe'
    );

  const urlaubListe =
    document.getElementById(
      'meineUrlaubsanfragenListeNeu'
    );

  if (zeigeLaden) {
    if (erhaltenListe) {
      erhaltenListe.innerHTML =
        '<div class="empty-state">Anfragen werden geladen …</div>';
    }

    if (gesendetListe) {
      gesendetListe.innerHTML =
        '<div class="empty-state">Anfragen werden geladen …</div>';
    }

    if (dienstListe) {
      dienstListe.innerHTML =
        '<div class="empty-state">Anfragen werden geladen …</div>';
    }

    if (urlaubListe) {
      urlaubListe.innerHTML =
        '<div class="empty-state">Urlaubsanträge werden geladen …</div>';
    }
  }

  try {
    const ergebnisse =
      await Promise.all([
        apiPost(
          'tauschAnfragen',
          {
            token:
              token
          }
        ),

        apiPost(
          'meineDienstAnfragen',
          {
            token:
              token
          }
        ),

        apiPost(
          'meineUrlaubsanfragen',
          {
            token:
              token
          }
        )
      ]);

    const tauschResult =
      ergebnisse[0];

    const dienstResult =
      ergebnisse[1];

    const urlaubResult =
      ergebnisse[2];

    if (
      tauschResult &&
      tauschResult.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      dienstResult &&
      dienstResult.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      urlaubResult &&
      urlaubResult.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !tauschResult ||
      !tauschResult.ok
    ) {
      throw new Error(
        tauschResult?.message ||
        'Tauschanfragen konnten nicht geladen werden.'
      );
    }

    if (
      !dienstResult ||
      !dienstResult.ok
    ) {
      throw new Error(
        dienstResult?.message ||
        'Anfragen konnten nicht geladen werden.'
      );
    }

    if (
      !urlaubResult ||
      !urlaubResult.ok
    ) {
      throw new Error(
        urlaubResult?.message ||
        'Urlaubsanträge konnten nicht geladen werden.'
      );
    }

    const erhalten =
      Array.isArray(
        tauschResult.erhalten
      )
        ? tauschResult.erhalten
        : [];

    const gesendet =
      Array.isArray(
        tauschResult.gesendet
      )
        ? tauschResult.gesendet
        : [];

    const dienstAnfragen =
      Array.isArray(
        dienstResult.anfragen
      )
        ? dienstResult.anfragen
        : [];

    const urlaubsAnfragen =
      Array.isArray(
        urlaubResult.anfragen
      )
        ? urlaubResult.anfragen
        : [];

    rendereErhalteneTauschAnfragenNeu(
      erhalten
    );

    rendereGesendeteTauschAnfragenNeu(
      gesendet
    );

    rendereMeineDienstAnfragenNeu(
      dienstAnfragen
    );

    rendereMeineUrlaubsanfragenNeu(
      urlaubsAnfragen
    );

    aktualisiereAnfragenBadgeNeu(
      erhalten
    );

  } catch (error) {
    console.error(
      'Meine Anfragen:',
      error
    );

    const html = `
      <div
        class="empty-state"
        style="color:#b00020;"
      >
        ❌ ${escapeHtmlNeu(
          error.message
        )}
      </div>
    `;

    if (erhaltenListe) {
      erhaltenListe.innerHTML =
        html;
    }

    if (gesendetListe) {
      gesendetListe.innerHTML =
        html;
    }

    if (dienstListe) {
      dienstListe.innerHTML =
        html;
    }

    if (urlaubListe) {
      urlaubListe.innerHTML =
        html;
    }
  }
}


// ==========================================================
// ERHALTENE TAUSCHANFRAGEN
// ==========================================================

function rendereErhalteneTauschAnfragenNeu(
  anfragen
) {
  const liste =
    document.getElementById(
      'erhalteneTauschAnfragenListe'
    );

  if (!liste) {
    return;
  }

  const offen =
    (
      Array.isArray(
        anfragen
      )
        ? anfragen
        : []
    ).filter(
      function(a) {
        return (
          String(
            a.status || 'OFFEN'
          )
            .trim()
            .toUpperCase() ===
          'OFFEN'
        );
      }
    );

  if (
    offen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine offenen Tauschanfragen an dich.
      </div>
    `;

    return;
  }

  let html = '';

  offen.forEach(
    function(a) {
      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:15px;
            margin-bottom:12px;
            background:#ffffff;
          "
        >
          <strong
            style="
              display:block;
              font-size:16px;
            "
          >
            ${escapeHtmlNeu(
              a.anfragender || ''
            )}
          </strong>

          <div
            style="
              margin-top:6px;
              color:#666;
            "
          >
            📅 ${escapeHtmlNeu(
              a.datum || ''
            )}
          </div>

          <div
            style="
              margin-top:10px;
              padding:11px;
              background:#f7f8f9;
              border-radius:8px;
            "
          >
            <strong>
              ${escapeHtmlNeu(
                entferneDienstSymbol(
                  a.eigenerDienst || ''
                )
              )}
            </strong>

            <span
              style="
                display:inline-block;
                margin:0 7px;
              "
            >
              ↔
            </span>

            <strong>
              ${escapeHtmlNeu(
                entferneDienstSymbol(
                  a.partnerDienst || ''
                )
              )}
            </strong>
          </div>

          ${
            a.nachricht
              ? `
                <div
                  style="
                    margin-top:10px;
                    color:#555;
                    white-space:pre-wrap;
                  "
                >
                  💬 ${escapeHtmlNeu(
                    a.nachricht
                  )}
                </div>
              `
              : ''
          }

          <div
            style="
              display:grid;
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
              gap:10px;
              margin-top:14px;
            "
          >
            <button
              type="button"
              onclick="bearbeiteTauschAnfrageMitarbeiterNeu(${Number(
                a.zeile
              )}, false)"
              style="
                width:100%;
                min-height:44px;
                border:1px solid #c9cdd2;
                background:#ffffff;
                color:#b00020;
                border-radius:8px;
                padding:9px 12px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ❌ Ablehnen
            </button>

            <button
              type="button"
              onclick="bearbeiteTauschAnfrageMitarbeiterNeu(${Number(
                a.zeile
              )}, true)"
              style="
                width:100%;
                min-height:44px;
                border:0;
                background:#14943b;
                color:#ffffff;
                border-radius:8px;
                padding:9px 12px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ✅ Annehmen
            </button>
          </div>
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// GESENDETE TAUSCHANFRAGEN
// ==========================================================

function rendereGesendeteTauschAnfragenNeu(
  anfragen
) {
  const liste =
    document.getElementById(
      'gesendeteTauschAnfragenListe'
    );

  if (!liste) {
    return;
  }

  if (
    !Array.isArray(anfragen) ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine gesendeten Tauschanfragen.
      </div>
    `;

    return;
  }

  let html = '';

  anfragen.forEach(
    function(a) {
      const status =
        String(
          a.status || 'OFFEN'
        )
          .trim()
          .toUpperCase();

      let statusText =
        '🟡 Offen';

      let statusFarbe =
        '#8a6500';

      let statusHintergrund =
        '#fff5cf';

      if (
        status ===
        'GENEHMIGT'
      ) {
        statusText =
          '✅ Genehmigt';

        statusFarbe =
          '#176b2c';

        statusHintergrund =
          '#e7f6ec';
      }

      else if (
        status ===
        'ABGELEHNT'
      ) {
        statusText =
          '❌ Abgelehnt';

        statusFarbe =
          '#b00020';

        statusHintergrund =
          '#fdecec';
      }

      else if (
        status ===
        'WARTET_ADMIN'
      ) {
        statusText =
          '🟠 Wartet auf Admin';

        statusFarbe =
          '#8a5200';

        statusHintergrund =
          '#fff0dc';
      }

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:15px;
            margin-bottom:12px;
            background:#ffffff;
          "
        >
          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:12px;
              align-items:flex-start;
              flex-wrap:wrap;
            "
          >
            <div>
              <strong
                style="
                  display:block;
                  font-size:16px;
                "
              >
                Tausch mit
                ${escapeHtmlNeu(
                  a.partner || ''
                )}
              </strong>

              <div
                style="
                  margin-top:6px;
                  color:#666;
                "
              >
                📅 ${escapeHtmlNeu(
                  a.datum || ''
                )}
              </div>
            </div>

            <span
              style="
                padding:6px 9px;
                border-radius:999px;
                background:${statusHintergrund};
                color:${statusFarbe};
                font-size:12px;
                font-weight:700;
              "
            >
              ${statusText}
            </span>
          </div>

          <div
            style="
              margin-top:10px;
              padding:11px;
              background:#f7f8f9;
              border-radius:8px;
            "
          >
            ${escapeHtmlNeu(
              entferneDienstSymbol(
                a.eigenerDienst || ''
              )
            )}

            <span
              style="
                margin:0 7px;
              "
            >
              ↔
            </span>

            ${escapeHtmlNeu(
              entferneDienstSymbol(
                a.partnerDienst || ''
              )
            )}
          </div>

          ${
            a.nachricht
              ? `
                <div
                  style="
                    margin-top:10px;
                    color:#555;
                    white-space:pre-wrap;
                  "
                >
                  💬 ${escapeHtmlNeu(
                    a.nachricht
                  )}
                </div>
              `
              : ''
          }
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}



// ==========================================================
// MEINE URLAUBSANTRÄGE
// ==========================================================

function rendereMeineUrlaubsanfragenNeu(anfragen) {
  const liste =
    document.getElementById(
      'meineUrlaubsanfragenListeNeu'
    );

  if (!liste) return;

  if (!Array.isArray(anfragen) || anfragen.length === 0) {
    liste.innerHTML =
      '<div class="empty-state">Du hast aktuell keine Urlaubsanträge.</div>';
    return;
  }

  let html = '';

  anfragen.forEach(function(a) {
    const status =
      String(a.status || 'OFFEN')
        .trim()
        .toUpperCase();

    let statusText = '🟡 Offen';
    let statusFarbe = '#8a6500';
    let statusHintergrund = '#fff5cf';

    if (status === 'GENEHMIGT') {
      statusText = '✅ Genehmigt';
      statusFarbe = '#176b2c';
      statusHintergrund = '#e7f6ec';
    } else if (status === 'ABGELEHNT') {
      statusText = '❌ Abgelehnt';
      statusFarbe = '#b00020';
      statusHintergrund = '#fdecec';
    }

    html += `
      <div
        style="
          border:1px solid #dde1e5;
          border-radius:11px;
          padding:15px;
          margin-bottom:12px;
          background:#ffffff;
        "
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:12px;
            align-items:flex-start;
            flex-wrap:wrap;
          "
        >
          <strong style="font-size:16px;">
            🏖️ ${escapeHtmlNeu(a.von || '')}
            –
            ${escapeHtmlNeu(a.bis || '')}
          </strong>

          <span
            style="
              padding:6px 9px;
              border-radius:999px;
              background:${statusHintergrund};
              color:${statusFarbe};
              font-size:12px;
              font-weight:800;
            "
          >
            ${statusText}
          </span>
        </div>

        ${
          a.notiz
            ? `
              <div
                style="
                  margin-top:10px;
                  padding:11px;
                  border-radius:8px;
                  background:#f7f8f9;
                  color:#444;
                  white-space:pre-wrap;
                "
              >
                📝 ${escapeHtmlNeu(a.notiz)}
              </div>
            `
            : ''
        }
      </div>
    `;
  });

  liste.innerHTML = html;
}


// ==========================================================
// MEINE SONSTIGEN WÜNSCHE
// ==========================================================

function rendereMeineDienstAnfragenNeu(
  anfragen
) {
  const liste =
    document.getElementById(
      'meineDienstAnfragenListe'
    );

  if (!liste) {
    return;
  }

  if (
    !Array.isArray(anfragen) ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Du hast aktuell keine sonstigen Wünsche.
      </div>
    `;

    return;
  }

  let html = '';

  anfragen.forEach(
    function(a) {
      const status =
        String(
          a.status || 'OFFEN'
        )
          .trim()
          .toUpperCase();

      let statusText =
        '🟡 Offen';

      let statusFarbe =
        '#8a6500';

      let statusHintergrund =
        '#fff5cf';

      if (
        status ===
        'GENEHMIGT'
      ) {
        statusText =
          '✅ Genehmigt';

        statusFarbe =
          '#176b2c';

        statusHintergrund =
          '#e7f6ec';
      }

      else if (
        status ===
        'ABGELEHNT'
      ) {
        statusText =
          '❌ Abgelehnt';

        statusFarbe =
          '#b00020';

        statusHintergrund =
          '#fdecec';
      }

      const teile = [];

      if (
        a.datum
      ) {
        teile.push(
          escapeHtmlNeu(
            a.datum
          )
        );
      }

      if (
        a.dienst
      ) {
        teile.push(
          escapeHtmlNeu(
            entferneDienstSymbol(
              a.dienst
            )
          )
        );
      }

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:15px;
            margin-bottom:12px;
            background:#ffffff;
          "
        >
          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:12px;
              align-items:flex-start;
              flex-wrap:wrap;
            "
          >
            <strong
              style="
                font-size:16px;
              "
            >
              ${
                teile.length
                  ? '💬 Wunsch mit Dienstbezug'
                  : '💬 Allgemeiner Wunsch'
              }
            </strong>

            <span
              style="
                padding:6px 9px;
                border-radius:999px;
                background:${statusHintergrund};
                color:${statusFarbe};
                font-size:12px;
                font-weight:700;
              "
            >
              ${statusText}
            </span>
          </div>

          ${
            teile.length
              ? `
                <div
                  style="
                    margin-top:9px;
                    color:#555;
                    line-height:1.5;
                  "
                >
                  📅 ${teile.join(
                    ' · '
                  )}
                </div>
              `
              : ''
          }

          ${
            a.nachricht
              ? `
                <div
                  style="
                    margin-top:10px;
                    padding:11px;
                    border-radius:8px;
                    background:#f7f8f9;
                    white-space:pre-wrap;
                    color:#444;
                    line-height:1.5;
                  "
                >
                  ${escapeHtmlNeu(
                    a.nachricht
                  )}
                </div>
              `
              : ''
          }

          ${
            a.zeitstempel
              ? `
                <div
                  style="
                    margin-top:8px;
                    font-size:12px;
                    color:#888;
                  "
                >
                  Gesendet:
                  ${escapeHtmlNeu(
                    a.zeitstempel
                  )}
                </div>
              `
              : ''
          }
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// TAUSCHANFRAGE ALS MITARBEITER BEARBEITEN
// ==========================================================

async function bearbeiteTauschAnfrageMitarbeiterNeu(
  zeile,
  genehmigen
) {
  const frage =
    genehmigen
      ? 'Diesen Diensttausch annehmen?'
      : 'Diesen Diensttausch ablehnen?';

  if (
    !window.confirm(
      frage
    )
  ) {
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  try {
    const result =
      await apiPost(
        'tauschAnfrageBearbeiten',
        {
          token:
            token,

          zeile:
            Number(
              zeile
            ),

          genehmigen:
            genehmigen === true
        }
      );

    if (
      !result ||
      !result.ok
    ) {
      if (
        result &&
        result.sessionExpired
      ) {
        await sessionAbgelaufenNeu();

        return;
      }

      throw new Error(
        result?.message ||
        'Tauschanfrage konnte nicht bearbeitet werden.'
      );
    }

    window.alert(
      result.message ||
      'Tauschanfrage wurde bearbeitet.'
    );

    await ladeMeineAnfragenNeu(
      true
    );

  } catch (error) {
    console.error(
      'Tauschanfrage bearbeiten:',
      error
    );

    window.alert(
      'Fehler: ' +
      error.message
    );
  }
}


// ==========================================================
// ANFRAGEN-BADGE
// ==========================================================

function aktualisiereAnfragenBadgeNeu(
  erhalten
) {
  const badge =
    document.getElementById(
      'anfragenBadge'
    );

  if (!badge) {
    return;
  }

  const anzahl =
    (
      Array.isArray(
        erhalten
      )
        ? erhalten
        : []
    ).filter(
      function(a) {
        return (
          String(
            a.status || 'OFFEN'
          )
            .trim()
            .toUpperCase() ===
          'OFFEN'
        );
      }
    ).length;

  if (
    anzahl > 0
  ) {
    badge.textContent =
      String(
        anzahl
      );

    badge.style.display =
      'inline-flex';

  } else {
    badge.textContent =
      '';

    badge.style.display =
      'none';
  }
}

// ==========================================================
// ABWESENHEITEN – ANSICHT
// ==========================================================

function installiereAbwesenheitenAnsichtNeu() {
  const vorhandeneAnsicht =
    document.getElementById(
      'abwesenheitenAnsicht'
    );

  /*
    Falls die Abwesenheiten-Ansicht bereits aus index.html
    oder einer älteren App-Version existiert, nicht einfach
    abbrechen. Das persönliche Urlaubskonto wird dann
    nachträglich direkt vor dem Abwesenheiten-Panel eingefügt.
  */
  if (vorhandeneAnsicht) {
    if (
      !document.getElementById(
        'meinUrlaubskontoNeu'
      )
    ) {
      const kontoPanel =
        document.createElement(
          'div'
        );

      kontoPanel.id =
        'meinUrlaubskontoNeu';

      kontoPanel.className =
        'panel';

      kontoPanel.style.marginBottom =
        '18px';

      kontoPanel.innerHTML =
        '<div class="empty-state">Urlaubskonto wird geladen …</div>';

      const contentHeader =
        vorhandeneAnsicht.querySelector(
          '.content-header'
        );

      const erstesPanel =
        vorhandeneAnsicht.querySelector(
          '.panel'
        );

      if (erstesPanel) {
        vorhandeneAnsicht.insertBefore(
          kontoPanel,
          erstesPanel
        );
      } else if (
        contentHeader &&
        contentHeader.nextSibling
      ) {
        vorhandeneAnsicht.insertBefore(
          kontoPanel,
          contentHeader.nextSibling
        );
      } else {
        vorhandeneAnsicht.appendChild(
          kontoPanel
        );
      }
    }

    return;
  }

  const main =
    document.querySelector(
      '#hauptApp .content'
    );

  if (!main) {
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'abwesenheitenAnsicht';

  section.style.display =
    'none';

  section.innerHTML = `
    <div class="content-header">
      <div>
        <h1>
          Meine Abwesenheiten
        </h1>

        <p>
          Hier siehst du deine eingetragenen Abwesenheiten.
        </p>
      </div>
    </div>

    <div
      id="meinUrlaubskontoNeu"
      class="panel"
      style="margin-bottom:18px;"
    >
      <div class="empty-state">
        Urlaubskonto wird geladen …
      </div>
    </div>

    <div class="panel">
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          flex-wrap:wrap;
          margin-bottom:15px;
        "
      >
        <h2 style="margin:0;">
          🏖️ Abwesenheiten
        </h2>

        <button
          type="button"
          onclick="ladeMeineAbwesenheitenNeu()"
          style="
            border:1px solid #d7dce1;
            background:#ffffff;
            border-radius:8px;
            padding:8px 12px;
            cursor:pointer;
          "
        >
          ↻ Aktualisieren
        </button>
      </div>

      <div id="abwesenheitenListeNeu">
        <div class="empty-state">
          Abwesenheiten werden geladen …
        </div>
      </div>
    </div>
  `;

  main.appendChild(
    section
  );
}


// ==========================================================
// ABWESENHEITEN LADEN
// ==========================================================

async function ladeMeineAbwesenheitenNeu() {
  ladeMeinUrlaubskontoNeu();

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  const liste =
    document.getElementById(
      'abwesenheitenListeNeu'
    );

  if (liste) {
    liste.innerHTML =
      '<div class="empty-state">Abwesenheiten werden geladen …</div>';
  }

  try {
    const result =
      await apiPost(
        'meinDienstplan',
        {
          token:
            token
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Abwesenheiten konnten nicht geladen werden.'
      );
    }

    letzteAbwesenheiten =
      Array.isArray(
        result.abwesenheiten
      )
        ? result.abwesenheiten
        : [];

    rendereAbwesenheitenNeu(
      letzteAbwesenheiten
    );

  } catch (error) {
    console.error(
      'Abwesenheiten:',
      error
    );

    if (liste) {
      liste.innerHTML = `
        <div
          class="empty-state"
          style="color:#b00020;"
        >
          ❌ ${escapeHtmlNeu(
            error.message
          )}
        </div>
      `;
    }
  }
}


// ==========================================================
// ABWESENHEITEN RENDERN
// ==========================================================

function rendereAbwesenheitenNeu(
  abwesenheiten
) {
  const liste =
    document.getElementById(
      'abwesenheitenListeNeu'
    );

  if (!liste) {
    return;
  }

  if (
    !Array.isArray(
      abwesenheiten
    ) ||
    abwesenheiten.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine Abwesenheiten vorhanden.
      </div>
    `;

    return;
  }

  let html = '';

  abwesenheiten.forEach(
    function(a) {
      const titel =
        String(
          a.art ||
          a.status ||
          'Abwesenheit'
        ).trim();

      const von =
        String(
          a.von || ''
        ).trim();

      const bis =
        String(
          a.bis || ''
        ).trim();

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:10px;
            padding:14px;
            margin-bottom:11px;
            background:#ffffff;
          "
        >
          <strong
            style="
              display:block;
              font-size:16px;
            "
          >
            🏖️ ${escapeHtmlNeu(
              titel
            )}
          </strong>

          <div
            style="
              margin-top:7px;
              color:#555;
            "
          >
            📅 ${escapeHtmlNeu(
              von
            )}

            ${
              bis &&
              bis !== von
                ? ' – ' +
                  escapeHtmlNeu(
                    bis
                  )
                : ''
            }
          </div>

          ${
            a.notiz
              ? `
                <div
                  style="
                    margin-top:9px;
                    color:#666;
                    white-space:pre-wrap;
                  "
                >
                  📝 ${escapeHtmlNeu(
                    a.notiz
                  )}
                </div>
              `
              : ''
          }
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// PIN & SICHERHEIT – ANSICHT
// ==========================================================

function installierePinAnsichtNeu() {
  if (
    document.getElementById(
      'pinAnsicht'
    )
  ) {
    return;
  }

  const main =
    document.querySelector(
      '#hauptApp .content'
    );

  if (!main) {
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'pinAnsicht';

  section.style.display =
    'none';

  section.innerHTML = `
    <div class="content-header">
      <div>
        <h1>
          PIN & Sicherheit
        </h1>

        <p>
          Hier kannst du deinen persönlichen PIN ändern.
        </p>
      </div>
    </div>

    <div
      class="panel"
      style="
        max-width:620px;
        margin-left:auto;
        margin-right:auto;
      "
    >
      <h2 style="margin-top:0;">
        🔐 PIN ändern
      </h2>

      <p
        style="
          color:#666;
          line-height:1.5;
          margin-bottom:20px;
        "
      >
        Dein PIN besteht aus genau 4 Zahlen.
      </p>

      <label
        for="alterPinNeu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        "
      >
        Aktueller PIN
      </label>

      <input
        id="alterPinNeu"
        type="password"
        inputmode="numeric"
        maxlength="4"
        autocomplete="current-password"
        placeholder="••••"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          margin-bottom:16px;
          font-size:18px;
          letter-spacing:4px;
        "
      >

      <label
        for="neuerPin1Neu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        "
      >
        Neuer PIN
      </label>

      <input
        id="neuerPin1Neu"
        type="password"
        inputmode="numeric"
        maxlength="4"
        autocomplete="new-password"
        placeholder="••••"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          margin-bottom:16px;
          font-size:18px;
          letter-spacing:4px;
        "
      >

      <label
        for="neuerPin2Neu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        "
      >
        Neuen PIN wiederholen
      </label>

      <input
        id="neuerPin2Neu"
        type="password"
        inputmode="numeric"
        maxlength="4"
        autocomplete="new-password"
        placeholder="••••"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          margin-bottom:18px;
          font-size:18px;
          letter-spacing:4px;
        "
      >

      <button
        id="pinAendernButtonNeu"
        type="button"
        onclick="aenderePinNeu()"
        style="
          border:0;
          background:#e30613;
          color:#ffffff;
          border-radius:9px;
          padding:11px 17px;
          font-weight:700;
          cursor:pointer;
        "
      >
        🔐 PIN ändern
      </button>

      <div
        id="pinAendernMeldungNeu"
        style="
          margin-top:14px;
          min-height:22px;
        "
      ></div>
    </div>
  `;

  main.appendChild(
    section
  );
}


// ==========================================================
// PIN ÄNDERN
// ==========================================================

async function aenderePinNeu() {
  const alterPinElement =
    document.getElementById(
      'alterPinNeu'
    );

  const neuerPin1Element =
    document.getElementById(
      'neuerPin1Neu'
    );

  const neuerPin2Element =
    document.getElementById(
      'neuerPin2Neu'
    );

  const button =
    document.getElementById(
      'pinAendernButtonNeu'
    );

  const meldung =
    document.getElementById(
      'pinAendernMeldungNeu'
    );

  const alterPin =
    String(
      alterPinElement?.value || ''
    ).trim();

  const neuerPin1 =
    String(
      neuerPin1Element?.value || ''
    ).trim();

  const neuerPin2 =
    String(
      neuerPin2Element?.value || ''
    ).trim();

  if (
    !/^\d{4}$/.test(
      alterPin
    )
  ) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Bitte gib deinen aktuellen 4-stelligen PIN ein.';
    }

    return;
  }

  if (
    !/^\d{4}$/.test(
      neuerPin1
    )
  ) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Der neue PIN muss genau 4 Zahlen haben.';
    }

    return;
  }

  if (
    neuerPin1 !==
    neuerPin2
  ) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Die neuen PINs stimmen nicht überein.';
    }

    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  if (button) {
    button.disabled =
      true;

    button.textContent =
      'PIN wird geändert …';
  }

  if (meldung) {
    meldung.textContent =
      '';
  }

  try {
    const result =
      await apiPost(
        'pinAendern',
        {
          token:
            token,

          alterPin:
            alterPin,

          neuerPin1:
            neuerPin1,

          neuerPin2:
            neuerPin2
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Der PIN konnte nicht geändert werden.'
      );
    }

    if (alterPinElement) {
      alterPinElement.value =
        '';
    }

    if (neuerPin1Element) {
      neuerPin1Element.value =
        '';
    }

    if (neuerPin2Element) {
      neuerPin2Element.value =
        '';
    }

    if (meldung) {
      meldung.style.color =
        '#14943b';

      meldung.textContent =
        '✅ ' +
        (
          result.message ||
          'PIN wurde geändert.'
        );
    }

  } catch (error) {
    console.error(
      'PIN ändern:',
      error
    );

    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        '❌ ' +
        error.message;
    }

  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        '🔐 PIN ändern';
    }
  }
}


// ==========================================================
// SONSTIGER WUNSCH – ANSICHT
// ==========================================================

function installiereSonstigerWunschAnsichtNeu() {
  if (
    document.getElementById(
      'sonstigerWunschAnsicht'
    )
  ) {
    return;
  }

  const main =
    document.querySelector(
      '#hauptApp .content'
    );

  if (!main) {
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'sonstigerWunschAnsicht';

  section.style.display =
    'none';

  section.innerHTML = `
    <div class="content-header">
      <div>
        <h1>
          Sonstiger Wunsch
        </h1>

        <p>
          Teile Babsi einen Wunsch zum Dienstplan mit.
        </p>
      </div>
    </div>

    <div
      class="panel"
      style="
        max-width:760px;
        margin-left:auto;
        margin-right:auto;
      "
    >
      <h2 style="margin-top:0;">
        💬 Wunsch senden
      </h2>

      <p
        style="
          color:#666;
          line-height:1.5;
          margin-bottom:20px;
        "
      >
        Du kannst deinen Wunsch allgemein senden
        oder ihn einem deiner Dienste zuordnen.
      </p>

      <label
        for="sonstigerWunschDienst"
        style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        "
      >
        Bezug zu einem Dienst

        <span
          style="
            font-weight:400;
            color:#777;
          "
        >
          (optional)
        </span>
      </label>

      <select
        id="sonstigerWunschDienst"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:11px 12px;
          margin-bottom:20px;
          background:#ffffff;
          font:inherit;
        "
      >
        <option value="">
          Kein bestimmter Dienst
        </option>
      </select>

      <label
        for="sonstigerWunschText"
        style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        "
      >
        Dein Wunsch
      </label>

      <textarea
        id="sonstigerWunschText"
        maxlength="500"
        rows="6"
        placeholder="Zum Beispiel: Ich würde am Freitag gerne früher gehen, wenn es möglich ist."
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          font:inherit;
          resize:vertical;
          min-height:130px;
        "
      ></textarea>

      <div
        style="
          margin-top:7px;
          color:#777;
          font-size:13px;
        "
      >
        Maximal 500 Zeichen.
      </div>

      <div
        style="
          margin-top:16px;
          padding:11px 12px;
          border-radius:8px;
          background:#f6f7f8;
          color:#555;
          font-size:13px;
          line-height:1.45;
        "
      >
        ℹ️ Babsi kann den Wunsch genehmigen oder ablehnen.
        Eine Genehmigung verändert den Dienstplan
        nicht automatisch.
      </div>

      <button
        id="sonstigerWunschSendenButton"
        type="button"
        onclick="sendeSonstigenWunschNeu()"
        style="
          margin-top:18px;
          border:0;
          background:#e30613;
          color:#ffffff;
          border-radius:9px;
          padding:11px 17px;
          font-weight:700;
          cursor:pointer;
        "
      >
        📤 Wunsch senden
      </button>

      <div
        id="sonstigerWunschMeldung"
        style="
          margin-top:14px;
          min-height:22px;
        "
      ></div>
    </div>
  `;

  main.appendChild(
    section
  );
}


// ==========================================================
// DIENSTE FÜR SONSTIGEN WUNSCH LADEN
// ==========================================================

function ladeSonstigerWunschDiensteNeu() {
  const select =
    document.getElementById(
      'sonstigerWunschDienst'
    );

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">
      Kein bestimmter Dienst
    </option>
  `;

  const optionen =
    baueEigeneDienstOptionenNeu(
      letzterDienstplan
    );

  optionen.forEach(
    function(option) {
      const element =
        document.createElement(
          'option'
        );

      element.value =
        JSON.stringify({
          datum:
            option.datum,

          kw:
            option.kw,

          dienst:
            option.dienst
        });

      element.textContent =
        option.label;

      select.appendChild(
        element
      );
    }
  );
}


// ==========================================================
// EIGENE DIENSTE FÜR WUNSCH ZUSAMMENFASSEN
// ==========================================================

function baueEigeneDienstOptionenNeu(
  plan
) {
  const ergebnis = [];

  (
    Array.isArray(
      plan
    )
      ? plan
      : []
  ).forEach(
    function(z) {
      const datum =
        String(
          z.datum || ''
        );

      const tag =
        String(
          z.tag || ''
        );

      const kw =
        String(
          z.kw || ''
        );

      if (
        z.gpFrueh
      ) {
        ergebnis.push({
          datum:
            datum,

          kw:
            kw,

          dienst:
            'Garden Plaza – Früh',

          label:
            datum +
            ' · ' +
            tag +
            ' · Garden Plaza – Früh'
        });
      }

      if (
        z.gpSpaet
      ) {
        ergebnis.push({
          datum:
            datum,

          kw:
            kw,

          dienst:
            'Garden Plaza – Spät',

          label:
            datum +
            ' · ' +
            tag +
            ' · Garden Plaza – Spät'
        });
      }

      if (
        z.wpFrueh &&
        z.wpSpaet
      ) {
        ergebnis.push({
          datum:
            datum,

          kw:
            kw,

          dienst:
            'Water Plaza – Ganztag',

          label:
            datum +
            ' · ' +
            tag +
            ' · Water Plaza – Ganztag'
        });

        return;
      }

      if (
        z.wpFrueh
      ) {
        ergebnis.push({
          datum:
            datum,

          kw:
            kw,

          dienst:
            'Water Plaza – Früh',

          label:
            datum +
            ' · ' +
            tag +
            ' · Water Plaza – Früh'
        });
      }

      if (
        z.wpSpaet
      ) {
        ergebnis.push({
          datum:
            datum,

          kw:
            kw,

          dienst:
            'Water Plaza – Spät',

          label:
            datum +
            ' · ' +
            tag +
            ' · Water Plaza – Spät'
        });
      }
    }
  );

  return ergebnis;
}


// ==========================================================
// SONSTIGEN WUNSCH SENDEN
// ==========================================================

async function sendeSonstigenWunschNeu() {
  const textElement =
    document.getElementById(
      'sonstigerWunschText'
    );

  const dienstElement =
    document.getElementById(
      'sonstigerWunschDienst'
    );

  const button =
    document.getElementById(
      'sonstigerWunschSendenButton'
    );

  const meldung =
    document.getElementById(
      'sonstigerWunschMeldung'
    );

  const nachricht =
    String(
      textElement?.value || ''
    ).trim();

  if (!nachricht) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Bitte schreibe deinen Wunsch in das Textfeld.';
    }

    textElement?.focus();

    return;
  }

  if (
    nachricht.length > 500
  ) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Der Wunsch darf maximal 500 Zeichen lang sein.';
    }

    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  let datum = '';
  let kw = '';
  let dienst = '';

  const auswahl =
    String(
      dienstElement?.value || ''
    ).trim();

  if (auswahl) {
    try {
      const daten =
        JSON.parse(
          auswahl
        );

      datum =
        String(
          daten.datum || ''
        );

      kw =
        String(
          daten.kw || ''
        );

      dienst =
        String(
          daten.dienst || ''
        );

    } catch (error) {
      console.error(
        'Dienst-Auswahl:',
        error
      );

      if (meldung) {
        meldung.style.color =
          '#b00020';

        meldung.textContent =
          'Der ausgewählte Dienst konnte nicht verarbeitet werden.';
      }

      return;
    }
  }

  if (button) {
    button.disabled =
      true;

    button.textContent =
      'Wunsch wird gesendet …';
  }

  if (meldung) {
    meldung.style.color =
      '#555';

    meldung.textContent =
      '';
  }

  try {
    const result =
      await apiPost(
        'dienstAnfrageSenden',
        {
          token:
            token,

          datum:
            datum,

          kw:
            kw,

          dienst:
            dienst,

          art:
            'Sonstiger Wunsch',

          nachricht:
            nachricht
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Der Wunsch konnte nicht gesendet werden.'
      );
    }

    if (textElement) {
      textElement.value =
        '';
    }

    if (dienstElement) {
      dienstElement.value =
        '';
    }

    if (meldung) {
      meldung.style.color =
        '#14943b';

      meldung.textContent =
        '✅ ' +
        (
          result.message ||
          'Dein Wunsch wurde gesendet.'
        );
    }

    await ladeMeineAnfragenNeu(
      false
    );

  } catch (error) {
    console.error(
      'Sonstiger Wunsch:',
      error
    );

    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        '❌ ' +
        error.message;
    }

  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        '📤 Wunsch senden';
    }
  }
}

// ==========================================================
// ADMIN-BEREICH – ANSICHT
// ==========================================================

function installiereAdminAnsichtNeu() {
  if (
    document.getElementById(
      'adminAnsicht'
    )
  ) {
    return;
  }

  const main =
    document.querySelector(
      '#hauptApp .content'
    );

  if (!main) {
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'adminAnsicht';

  section.style.display =
    'none';

  section.innerHTML = `
    <div class="content-header">
      <div>
        <h1>
          Admin-Bereich
        </h1>

        <p>
          Hier kannst du offene Anfragen bearbeiten
          und erledigte Wünsche verwalten.
        </p>
      </div>
    </div>

    <div
      style="
        display:flex;
        justify-content:flex-end;
        margin-bottom:14px;
      "
    >
      <button
        type="button"
        onclick="ladeAdminAnfragenNeu()"
        style="
          border:1px solid #d7dce1;
          background:#ffffff;
          border-radius:8px;
          padding:8px 12px;
          cursor:pointer;
        "
      >
        ↻ Aktualisieren
      </button>
    </div>

    <div
      class="panel"
      style="
        margin-bottom:18px;
      "
    >
      <h2 style="margin-top:0;">
        🔄 Diensttausch
      </h2>

      <p style="color:#666;">
        Hier erscheinen Tauschanfragen,
        denen der Tauschpartner bereits zugestimmt hat.
      </p>

      <div id="adminTauschAnfragenListe">
        <div class="empty-state">
          Anfragen werden geladen …
        </div>
      </div>
    </div>

    <div
      class="panel"
      style="
        margin-bottom:18px;
      "
    >
      <h2 style="margin-top:0;">
        💬 Sonstige Wünsche
      </h2>

      <p style="color:#666;">
        Das Genehmigen oder Ablehnen verändert
        den Dienstplan nicht automatisch.
      </p>

      <div id="adminDienstAnfragenListe">
        <div class="empty-state">
          Wünsche werden geladen …
        </div>
      </div>

      <div
        style="
          margin-top:28px;
          padding-top:22px;
          border-top:1px solid #e1e4e8;
        "
      >
        <h3
          style="
            margin:0 0 7px;
            font-size:18px;
          "
        >
          🗂️ Bearbeitete Wünsche
        </h3>

        <p
          style="
            margin:0 0 14px;
            color:#666666;
            font-size:14px;
            line-height:1.5;
          "
        >
          Genehmigte und abgelehnte Wünsche können
          hier endgültig gelöscht werden.
        </p>

        <div id="adminBearbeiteteDienstAnfragenListe">
          <div class="empty-state">
            Bearbeitete Wünsche werden geladen …
          </div>
        </div>
      </div>
    </div>

    <div
      class="panel"
      style="
        margin-bottom:18px;
      "
    >
      <h2 style="margin-top:0;">
        🏖️ Urlaubsanträge
      </h2>

      <p style="color:#666;">
        Hier kannst du offene Urlaubsanträge
        genehmigen oder ablehnen.
      </p>

      <div id="adminUrlaubsanfragenListeNeu">
        <div class="empty-state">
          Urlaubsanträge werden geladen …
        </div>
      </div>
    </div>

    <div class="panel">
      <h2 style="margin-top:0;">
        🔐 PIN-Reset
      </h2>

      <p style="color:#666;">
        Hier kannst du PIN-Reset-Anfragen
        von Mitarbeitern genehmigen oder ablehnen.
      </p>

      <div
        style="
          margin:12px 0 16px;
          padding:11px 12px;
          border-radius:8px;
          background:#fff8e8;
          color:#6d5500;
          font-size:13px;
          line-height:1.45;
        "
      >
        ℹ️ Bei einer Genehmigung wird der bisherige PIN gelöscht.
        Der Mitarbeiter kann anschließend selbst
        einen neuen 4-stelligen PIN festlegen.
      </div>

      <div id="adminPinResetListe">
        <div class="empty-state">
          PIN-Anfragen werden geladen …
        </div>
      </div>
    </div>
  `;

  main.appendChild(
    section
  );
}


// ==========================================================
// ADMIN-ANFRAGEN LADEN
// ==========================================================

async function ladeAdminAnfragenNeu() {
  installiereAdminAnsichtNeu();

  const tauschListe =
    document.getElementById(
      'adminTauschAnfragenListe'
    );

  const dienstListe =
    document.getElementById(
      'adminDienstAnfragenListe'
    );

  const bearbeiteteListe =
    document.getElementById(
      'adminBearbeiteteDienstAnfragenListe'
    );

  const pinListe =
    document.getElementById(
      'adminPinResetListe'
    );

  const urlaubListe =
    document.getElementById(
      'adminUrlaubsanfragenListeNeu'
    );

  if (
    !aktuellerAdmin
  ) {
    const html = `
      <div
        class="empty-state"
        style="color:#b00020;"
      >
        Keine Admin-Berechtigung.
      </div>
    `;

    if (tauschListe) {
      tauschListe.innerHTML =
        html;
    }

    if (dienstListe) {
      dienstListe.innerHTML =
        html;
    }

    if (bearbeiteteListe) {
      bearbeiteteListe.innerHTML =
        html;
    }

    if (pinListe) {
      pinListe.innerHTML =
        html;
    }

    if (urlaubListe) {
      urlaubListe.innerHTML =
        html;
    }

    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  if (tauschListe) {
    tauschListe.innerHTML =
      '<div class="empty-state">Tauschanfragen werden geladen …</div>';
  }

  if (dienstListe) {
    dienstListe.innerHTML =
      '<div class="empty-state">Wünsche werden geladen …</div>';
  }

  if (bearbeiteteListe) {
    bearbeiteteListe.innerHTML =
      '<div class="empty-state">Bearbeitete Wünsche werden geladen …</div>';
  }

  if (pinListe) {
    pinListe.innerHTML =
      '<div class="empty-state">PIN-Anfragen werden geladen …</div>';
  }

  if (urlaubListe) {
    urlaubListe.innerHTML =
      '<div class="empty-state">Urlaubsanträge werden geladen …</div>';
  }

  try {
    const ergebnisse =
      await Promise.all([
        apiPost(
          'adminTauschAnfragen',
          {
            token:
              token
          }
        ),

        apiPost(
          'adminDienstAnfragen',
          {
            token:
              token
          }
        ),

        apiPost(
          'adminBearbeiteteDienstAnfragen',
          {
            token:
              token
          }
        ),

        apiPost(
          'adminPinResets',
          {
            token:
              token
          }
        ),

        apiPost(
          'adminUrlaubsanfragen',
          {
            token:
              token
          }
        )
      ]);

    const tauschResult =
      ergebnisse[0];

    const dienstResult =
      ergebnisse[1];

    const bearbeitetResult =
      ergebnisse[2];

    const pinResult =
      ergebnisse[3];

    const urlaubResult =
      ergebnisse[4];

    const alleResultate = [
      tauschResult,
      dienstResult,
      bearbeitetResult,
      pinResult,
      urlaubResult
    ];

    for (
      let i = 0;
      i < alleResultate.length;
      i++
    ) {
      if (
        alleResultate[i] &&
        alleResultate[i].sessionExpired
      ) {
        await sessionAbgelaufenNeu();

        return;
      }
    }

    if (
      !tauschResult ||
      !tauschResult.ok
    ) {
      throw new Error(
        tauschResult?.message ||
        'Admin-Tauschanfragen konnten nicht geladen werden.'
      );
    }

    if (
      !dienstResult ||
      !dienstResult.ok
    ) {
      throw new Error(
        dienstResult?.message ||
        'Sonstige Wünsche konnten nicht geladen werden.'
      );
    }

    if (
      !bearbeitetResult ||
      !bearbeitetResult.ok
    ) {
      throw new Error(
        bearbeitetResult?.message ||
        'Bearbeitete Wünsche konnten nicht geladen werden.'
      );
    }

    if (
      !pinResult ||
      !pinResult.ok
    ) {
      throw new Error(
        pinResult?.message ||
        'PIN-Reset-Anfragen konnten nicht geladen werden.'
      );
    }

    if (
      !urlaubResult ||
      !urlaubResult.ok
    ) {
      throw new Error(
        urlaubResult?.message ||
        'Urlaubsanträge konnten nicht geladen werden.'
      );
    }

    aktualisiereAdminBadgeNeu(
      (Array.isArray(tauschResult.anfragen)
        ? tauschResult.anfragen.length
        : 0) +
      (Array.isArray(dienstResult.anfragen)
        ? dienstResult.anfragen.length
        : 0) +
      (Array.isArray(pinResult.anfragen)
        ? pinResult.anfragen.length
        : 0) +
      (Array.isArray(urlaubResult.anfragen)
        ? urlaubResult.anfragen.length
        : 0)
    );

    rendereAdminTauschAnfragenNeu(
      Array.isArray(
        tauschResult.anfragen
      )
        ? tauschResult.anfragen
        : []
    );

    rendereAdminDienstAnfragenNeu(
      Array.isArray(
        dienstResult.anfragen
      )
        ? dienstResult.anfragen
        : []
    );

    rendereAdminBearbeiteteDienstAnfragenNeu(
      Array.isArray(
        bearbeitetResult.anfragen
      )
        ? bearbeitetResult.anfragen
        : []
    );

    rendereAdminPinResetsNeu(
      Array.isArray(
        pinResult.anfragen
      )
        ? pinResult.anfragen
        : []
    );

    rendereAdminUrlaubsanfragenNeu(
      Array.isArray(
        urlaubResult.anfragen
      )
        ? urlaubResult.anfragen
        : []
    );

  } catch (error) {
    console.error(
      'Admin-Anfragen:',
      error
    );

    const html = `
      <div
        class="empty-state"
        style="color:#b00020;"
      >
        ❌ ${escapeHtmlNeu(
          error.message
        )}
      </div>
    `;

    if (tauschListe) {
      tauschListe.innerHTML =
        html;
    }

    if (dienstListe) {
      dienstListe.innerHTML =
        html;
    }

    if (bearbeiteteListe) {
      bearbeiteteListe.innerHTML =
        html;
    }

    if (pinListe) {
      pinListe.innerHTML =
        html;
    }

    if (urlaubListe) {
      urlaubListe.innerHTML =
        html;
    }
  }
}


// ==========================================================
// ADMIN – TAUSCHANFRAGEN
// ==========================================================

function rendereAdminTauschAnfragenNeu(
  anfragen
) {
  const liste =
    document.getElementById(
      'adminTauschAnfragenListe'
    );

  if (!liste) {
    return;
  }

  if (
    !Array.isArray(anfragen) ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine offenen Tauschanfragen.
      </div>
    `;

    return;
  }

  let html = '';

  anfragen.forEach(
    function(a) {
      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:15px;
            margin-bottom:12px;
            background:#ffffff;
          "
        >
          <strong
            style="
              display:block;
              font-size:16px;
            "
          >
            ${escapeHtmlNeu(
              a.anfragender || ''
            )}
            ↔
            ${escapeHtmlNeu(
              a.partner || ''
            )}
          </strong>

          <div
            style="
              margin-top:5px;
              color:#666;
            "
          >
            📅 ${escapeHtmlNeu(
              a.datum || ''
            )}

            ${
              a.kw
                ? ' · KW ' +
                  escapeHtmlNeu(
                    a.kw
                  )
                : ''
            }
          </div>

          <div
            style="
              margin-top:12px;
              padding:11px;
              background:#f7f8f9;
              border-radius:8px;
            "
          >
            <strong>
              ${escapeHtmlNeu(
                entferneDienstSymbol(
                  a.eigenerDienst || ''
                )
              )}
            </strong>

            <span
              style="
                margin:0 7px;
              "
            >
              ↔
            </span>

            <strong>
              ${escapeHtmlNeu(
                entferneDienstSymbol(
                  a.partnerDienst || ''
                )
              )}
            </strong>
          </div>

          ${
            a.nachricht
              ? `
                <div
                  style="
                    margin-top:9px;
                    color:#555;
                    white-space:pre-wrap;
                  "
                >
                  💬 ${escapeHtmlNeu(
                    a.nachricht
                  )}
                </div>
              `
              : ''
          }

          <div
            style="
              display:grid;
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
              gap:10px;
              margin-top:14px;
            "
          >
            <button
              type="button"
              onclick="bearbeiteAdminTauschAnfrageNeu(${Number(
                a.zeile
              )}, false)"
              style="
                width:100%;
                min-height:44px;
                border:1px solid #c9cdd2;
                background:#ffffff;
                color:#b00020;
                border-radius:8px;
                padding:9px 12px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ❌ Ablehnen
            </button>

            <button
              type="button"
              onclick="bearbeiteAdminTauschAnfrageNeu(${Number(
                a.zeile
              )}, true)"
              style="
                width:100%;
                min-height:44px;
                border:0;
                background:#14943b;
                color:#ffffff;
                border-radius:8px;
                padding:9px 12px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ✅ Genehmigen
            </button>
          </div>
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// ADMIN – TAUSCHANFRAGE BEARBEITEN
// ==========================================================

async function bearbeiteAdminTauschAnfrageNeu(
  zeile,
  genehmigen
) {
  const frage =
    genehmigen
      ? 'Diensttausch genehmigen und im Dienstplan durchführen?'
      : 'Diensttausch wirklich ablehnen?';

  if (
    !window.confirm(
      frage
    )
  ) {
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  try {
    const result =
      await apiPost(
        'adminTauschAnfrageBearbeiten',
        {
          token:
            token,

          zeile:
            Number(
              zeile
            ),

          genehmigen:
            genehmigen === true
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Tauschanfrage konnte nicht bearbeitet werden.'
      );
    }

    window.alert(
      result.message ||
      'Anfrage wurde bearbeitet.'
    );

    await ladeAdminAnfragenNeu();

    if (
      genehmigen === true
    ) {
      dienstplanInitialisiert =
        false;

      await ladeMeinDienstplanNeu();
    }

  } catch (error) {
    console.error(
      'Admin-Tausch:',
      error
    );

    window.alert(
      'Fehler: ' +
      error.message
    );
  }
}


// ==========================================================
// ADMIN – OFFENE SONSTIGE WÜNSCHE
// ==========================================================

function rendereAdminDienstAnfragenNeu(
  anfragen
) {
  const liste =
    document.getElementById(
      'adminDienstAnfragenListe'
    );

  if (!liste) {
    return;
  }

  if (
    !Array.isArray(anfragen) ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine offenen sonstigen Wünsche.
      </div>
    `;

    return;
  }

  let html = '';

  anfragen.forEach(
    function(a) {
      const mitarbeiter =
        String(
          a.mitarbeiter || ''
        ).trim();

      const datum =
        String(
          a.datum || ''
        ).trim();

      const dienst =
        String(
          a.dienst || ''
        ).trim();

      const nachricht =
        String(
          a.nachricht || ''
        ).trim();

      const zeile =
        Number(
          a.zeile || 0
        );

      const dienstBezug =
        baueWunschDienstBezugNeu(
          datum,
          dienst
        );

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:13px;
            padding:17px;
            margin-bottom:14px;
            background:#ffffff;
            box-shadow:
              0 3px 12px
              rgba(0,0,0,0.035);
          "
        >
          <div
            style="
              display:flex;
              align-items:center;
              gap:11px;
            "
          >
            <div
              style="
                width:42px;
                height:42px;
                flex:0 0 auto;
                display:flex;
                align-items:center;
                justify-content:center;
                border-radius:50%;
                background:#fff1f2;
                font-size:20px;
              "
            >
              👤
            </div>

            <div
              style="
                min-width:0;
                flex:1;
              "
            >
              <strong
                style="
                  display:block;
                  color:#171717;
                  font-size:17px;
                  line-height:1.35;
                  overflow-wrap:anywhere;
                "
              >
                ${escapeHtmlNeu(
                  mitarbeiter ||
                  'Mitarbeiter'
                )}
              </strong>

              <span
                style="
                  display:block;
                  margin-top:2px;
                  color:#777777;
                  font-size:12px;
                "
              >
                Sonstiger Wunsch
              </span>
            </div>
          </div>

          ${dienstBezug}

          ${
            nachricht
              ? `
                <div
                  style="
                    margin-top:12px;
                    padding:13px 14px;
                    border-left:4px solid #e30613;
                    border-radius:8px;
                    background:#fffafa;
                    color:#333333;
                    font-size:15px;
                    line-height:1.55;
                    white-space:pre-wrap;
                    overflow-wrap:anywhere;
                  "
                >
                  💬 „${escapeHtmlNeu(
                    nachricht
                  )}“
                </div>
              `
              : ''
          }

          <div
            style="
              margin-top:14px;
              padding:10px 12px;
              border-radius:8px;
              background:#fff8e8;
              color:#6d5500;
              font-size:12px;
              line-height:1.45;
            "
          >
            ℹ️ Die Entscheidung verändert den Dienstplan
            nicht automatisch.
          </div>

          <div
            style="
              display:grid;
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
              gap:10px;
              margin-top:15px;
            "
          >
            <button
              type="button"
              onclick="bearbeiteAdminDienstAnfrageNeu(${zeile}, false)"
              style="
                width:100%;
                min-height:46px;
                border:1px solid #d5d8dc;
                background:#ffffff;
                color:#b00020;
                border-radius:9px;
                padding:10px 12px;
                font-weight:700;
                font-size:14px;
                cursor:pointer;
              "
            >
              ❌ Ablehnen
            </button>

            <button
              type="button"
              onclick="bearbeiteAdminDienstAnfrageNeu(${zeile}, true)"
              style="
                width:100%;
                min-height:46px;
                border:0;
                background:#14943b;
                color:#ffffff;
                border-radius:9px;
                padding:10px 12px;
                font-weight:700;
                font-size:14px;
                cursor:pointer;
              "
            >
              ✅ Genehmigen
            </button>
          </div>
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// WUNSCH-DIENSTBEZUG DARSTELLEN
// ==========================================================

function baueWunschDienstBezugNeu(
  datum,
  dienst
) {
  datum =
    String(
      datum || ''
    ).trim();

  dienst =
    String(
      dienst || ''
    ).trim();

  if (
    !datum &&
    !dienst
  ) {
    return `
      <div
        style="
          margin-top:10px;
          color:#555555;
          font-size:14px;
          font-weight:700;
        "
      >
        💬 Allgemeiner Wunsch
      </div>
    `;
  }

  let wochentag = '';

  if (
    /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(
      datum
    )
  ) {
    const teile =
      datum.split('.');

    const datumObjekt =
      new Date(
        Number(
          teile[2]
        ),
        Number(
          teile[1]
        ) - 1,
        Number(
          teile[0]
        ),
        12,
        0,
        0
      );

    if (
      !isNaN(
        datumObjekt.getTime()
      )
    ) {
      const tage = [
        'So',
        'Mo',
        'Di',
        'Mi',
        'Do',
        'Fr',
        'Sa'
      ];

      wochentag =
        tage[
          datumObjekt.getDay()
        ] || '';
    }
  }

  let plaza = '';
  let schicht = '';
  let schichtSymbol = '';

  if (
    /Garden Plaza/i.test(
      dienst
    )
  ) {
    plaza =
      'Garden Plaza';
  }

  else if (
    /Water Plaza/i.test(
      dienst
    )
  ) {
    plaza =
      'Water Plaza';
  }

  if (
    /\bFrüh\b/i.test(
      dienst
    )
  ) {
    schicht =
      'Früh';

    schichtSymbol =
      '☀️';
  }

  else if (
    /\bSpät\b/i.test(
      dienst
    )
  ) {
    schicht =
      'Spät';

    schichtSymbol =
      '🌙';
  }

  else if (
    /\bGanztag\b/i.test(
      dienst
    )
  ) {
    schicht =
      'Ganztag';

    schichtSymbol =
      '🔵';
  }

  else if (
    /Pausenablöse/i.test(
      dienst
    )
  ) {
    schicht =
      'Pausenablöse';

    schichtSymbol =
      '☕';
  }

  const teile = [];

  if (datum) {
    teile.push(
      escapeHtmlNeu(
        wochentag
          ? wochentag +
            ', ' +
            datum
          : datum
      )
    );
  }

  if (plaza) {
    teile.push(
      escapeHtmlNeu(
        plaza
      )
    );
  }

  if (schicht) {
    teile.push(
      escapeHtmlNeu(
        (
          schichtSymbol
            ? schichtSymbol + ' '
            : ''
        ) +
        schicht
      )
    );

  } else if (dienst) {
    teile.push(
      escapeHtmlNeu(
        entferneDienstSymbol(
          dienst
        )
      )
    );
  }

  return `
    <div
      style="
        margin-top:10px;
        padding:11px 13px;
        border-radius:9px;
        background:#f7f8fa;
        color:#444444;
        font-size:14px;
        line-height:1.5;
      "
    >
      📅 ${teile.join(' · ')}
    </div>
  `;
}


// ==========================================================
// ADMIN – SONSTIGEN WUNSCH BEARBEITEN
// ==========================================================

async function bearbeiteAdminDienstAnfrageNeu(
  zeile,
  genehmigen
) {
  const frage =
    genehmigen
      ? 'Diesen Wunsch genehmigen?'
      : 'Diesen Wunsch ablehnen?';

  if (
    !window.confirm(
      frage
    )
  ) {
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  try {
    const result =
      await apiPost(
        'adminDienstAnfrageBearbeiten',
        {
          token:
            token,

          zeile:
            Number(
              zeile
            ),

          genehmigen:
            genehmigen === true
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Wunsch konnte nicht bearbeitet werden.'
      );
    }

    window.alert(
      result.message ||
      'Wunsch wurde bearbeitet.'
    );

    await ladeAdminAnfragenNeu();

  } catch (error) {
    console.error(
      'Wunsch bearbeiten:',
      error
    );

    window.alert(
      'Fehler: ' +
      error.message
    );
  }
}


// ==========================================================
// ADMIN – BEARBEITETE WÜNSCHE
// ==========================================================

function rendereAdminBearbeiteteDienstAnfragenNeu(
  anfragen
) {
  const liste =
    document.getElementById(
      'adminBearbeiteteDienstAnfragenListe'
    );

  if (!liste) {
    return;
  }

  if (
    !Array.isArray(anfragen) ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine bearbeiteten Wünsche vorhanden.
      </div>
    `;

    return;
  }

  let html = '';

  anfragen.forEach(
    function(a) {
      const status =
        String(
          a.status || ''
        )
          .trim()
          .toUpperCase();

      const genehmigt =
        status ===
        'GENEHMIGT';

      const statusText =
        genehmigt
          ? '✅ Genehmigt'
          : '❌ Abgelehnt';

      const statusFarbe =
        genehmigt
          ? '#176b2c'
          : '#b00020';

      const statusHintergrund =
        genehmigt
          ? '#e7f6ec'
          : '#fdecec';

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:14px;
            margin-bottom:11px;
            background:#fafafa;
          "
        >
          <div
            style="
              display:flex;
              align-items:flex-start;
              justify-content:space-between;
              gap:12px;
              flex-wrap:wrap;
            "
          >
            <div
              style="
                min-width:0;
                flex:1;
              "
            >
              <strong
                style="
                  display:block;
                  font-size:16px;
                  overflow-wrap:anywhere;
                "
              >
                ${escapeHtmlNeu(
                  a.mitarbeiter || ''
                )}
              </strong>

              ${baueWunschDienstBezugNeu(
                a.datum || '',
                a.dienst || ''
              )}

              ${
                a.nachricht
                  ? `
                    <div
                      style="
                        margin-top:10px;
                        padding:10px 11px;
                        border-radius:8px;
                        background:#ffffff;
                        color:#444444;
                        line-height:1.5;
                        white-space:pre-wrap;
                        overflow-wrap:anywhere;
                      "
                    >
                      💬 ${escapeHtmlNeu(
                        a.nachricht
                      )}
                    </div>
                  `
                  : ''
              }
            </div>

            <div
              style="
                flex:0 0 auto;
                padding:6px 9px;
                border-radius:999px;
                background:${statusHintergrund};
                color:${statusFarbe};
                font-size:12px;
                font-weight:700;
              "
            >
              ${statusText}
            </div>
          </div>

          ${
            a.bearbeitetAm
              ? `
                <div
                  style="
                    margin-top:9px;
                    color:#777777;
                    font-size:12px;
                  "
                >
                  Bearbeitet:
                  ${escapeHtmlNeu(
                    a.bearbeitetAm
                  )}
                </div>
              `
              : ''
          }

          <div
            style="
              margin-top:12px;
              display:flex;
              justify-content:flex-end;
            "
          >
            <button
              type="button"
              onclick="loescheAdminDienstAnfrageNeu(${Number(
                a.zeile
              )})"
              style="
                min-height:42px;
                border:1px solid #d5d8dc;
                background:#ffffff;
                color:#b00020;
                border-radius:8px;
                padding:9px 13px;
                font-weight:700;
                cursor:pointer;
              "
            >
              🗑️ Löschen
            </button>
          </div>
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// ADMIN – BEARBEITETEN WUNSCH LÖSCHEN
// ==========================================================

async function loescheAdminDienstAnfrageNeu(
  zeile
) {
  const bestaetigt =
    window.confirm(
      'Diesen bearbeiteten Wunsch endgültig löschen?\n\nDer Eintrag wird auch aus „Meine Anfragen“ des Mitarbeiters entfernt.'
    );

  if (!bestaetigt) {
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  try {
    const result =
      await apiPost(
        'adminDienstAnfrageLoeschen',
        {
          token:
            token,

          zeile:
            Number(
              zeile
            )
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Der Wunsch konnte nicht gelöscht werden.'
      );
    }

    window.alert(
      result.message ||
      'Der Wunsch wurde gelöscht.'
    );

    await ladeAdminAnfragenNeu();

  } catch (error) {
    console.error(
      'Wunsch löschen:',
      error
    );

    window.alert(
      'Fehler: ' +
      error.message
    );
  }
}



// ==========================================================
// ADMIN – URLAUBSANTRÄGE
// ==========================================================

function rendereAdminUrlaubsanfragenNeu(
  anfragen
) {
  const liste =
    document.getElementById(
      'adminUrlaubsanfragenListeNeu'
    );

  if (!liste) {
    return;
  }

  if (
    !Array.isArray(anfragen) ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine offenen Urlaubsanträge.
      </div>
    `;

    return;
  }

  let html =
    '';

  anfragen.forEach(
    function(a) {
      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:13px;
            padding:17px;
            margin-bottom:14px;
            background:#ffffff;
            box-shadow:
              0 3px 12px
              rgba(0,0,0,0.035);
          "
        >
          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:flex-start;
              gap:12px;
              flex-wrap:wrap;
            "
          >
            <div>
              <strong
                style="
                  display:block;
                  font-size:17px;
                "
              >
                👤 ${escapeHtmlNeu(
                  a.mitarbeiter || ''
                )}
              </strong>

              <div
                style="
                  margin-top:8px;
                  color:#444;
                  font-weight:700;
                "
              >
                📅 ${escapeHtmlNeu(
                  a.von || ''
                )}
                –
                ${escapeHtmlNeu(
                  a.bis || ''
                )}
              </div>
            </div>

            <span
              style="
                padding:6px 9px;
                border-radius:999px;
                background:#fff5cf;
                color:#8a6500;
                font-size:12px;
                font-weight:800;
              "
            >
              🟡 Offen
            </span>
          </div>

          ${
            a.notiz
              ? `
                <div
                  style="
                    margin-top:12px;
                    padding:11px 12px;
                    border-radius:8px;
                    background:#f7f8f9;
                    color:#444;
                    white-space:pre-wrap;
                    line-height:1.5;
                  "
                >
                  📝 ${escapeHtmlNeu(
                    a.notiz
                  )}
                </div>
              `
              : ''
          }

          <div
            style="
              margin-top:15px;
              display:grid;
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
              gap:10px;
            "
          >
            <button
              type="button"
              onclick="bearbeiteAdminUrlaubsanfrageNeu(${Number(
                a.zeile || 0
              )}, false)"
              style="
                width:100%;
                min-height:46px;
                border:1px solid #d5d8dc;
                background:#ffffff;
                color:#b00020;
                border-radius:9px;
                padding:10px 12px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ❌ Ablehnen
            </button>

            <button
              type="button"
              onclick="bearbeiteAdminUrlaubsanfrageNeu(${Number(
                a.zeile || 0
              )}, true)"
              style="
                width:100%;
                min-height:46px;
                border:0;
                background:#14943b;
                color:#ffffff;
                border-radius:9px;
                padding:10px 12px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ✅ Genehmigen
            </button>
          </div>
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


async function bearbeiteAdminUrlaubsanfrageNeu(
  zeile,
  genehmigen
) {
  const frage =
    genehmigen
      ? 'Diesen Urlaubsantrag genehmigen?'
      : 'Diesen Urlaubsantrag ablehnen?';

  if (
    !window.confirm(
      frage
    )
  ) {
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  try {
    const result =
      await apiPost(
        'adminUrlaubsanfrageBearbeiten',
        {
          token:
            token,

          zeile:
            Number(
              zeile
            ),

          genehmigen:
            genehmigen === true
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Urlaubsantrag konnte nicht bearbeitet werden.'
      );
    }

    window.alert(
      result.message ||
      'Urlaubsantrag wurde bearbeitet.'
    );

    await ladeAdminAnfragenNeu();

  } catch (error) {
    console.error(
      'Urlaubsantrag Admin:',
      error
    );

    window.alert(
      'Fehler: ' +
      error.message
    );
  }
}


// ==========================================================
// ADMIN – PIN-RESET-ANFRAGEN
// ==========================================================

function rendereAdminPinResetsNeu(
  anfragen
) {
  const liste =
    document.getElementById(
      'adminPinResetListe'
    );

  if (!liste) {
    return;
  }

  if (
    !Array.isArray(anfragen) ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine offenen PIN-Reset-Anfragen.
      </div>
    `;

    return;
  }

  let html = '';

  anfragen.forEach(
    function(a) {
      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:15px;
            margin-bottom:12px;
            background:#ffffff;
          "
        >
          <div
            style="
              display:flex;
              align-items:flex-start;
              gap:12px;
            "
          >
            <div
              style="
                width:42px;
                height:42px;
                border-radius:50%;
                background:#f4f5f6;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:21px;
                flex:0 0 auto;
              "
            >
              🔐
            </div>

            <div
              style="
                flex:1;
                min-width:0;
              "
            >
              <strong
                style="
                  display:block;
                  font-size:16px;
                "
              >
                ${escapeHtmlNeu(
                  a.mitarbeiter || ''
                )}
              </strong>

              <div
                style="
                  margin-top:4px;
                  color:#666;
                "
              >
                Möchte den persönlichen PIN zurücksetzen.
              </div>

              ${
                a.zeitstempel
                  ? `
                    <div
                      style="
                        margin-top:6px;
                        color:#888;
                        font-size:13px;
                      "
                    >
                      🕒 ${escapeHtmlNeu(
                        a.zeitstempel
                      )}
                    </div>
                  `
                  : ''
              }
            </div>
          </div>

          <div
            style="
              margin-top:12px;
              padding:10px 11px;
              border-radius:8px;
              background:#fff8e8;
              color:#6d5500;
              font-size:13px;
              line-height:1.45;
            "
          >
            Bei Genehmigung wird nur der bisherige PIN gelöscht.
            Der Mitarbeiter legt danach selbst einen neuen PIN fest.
          </div>

          <div
            style="
              display:grid;
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
              gap:10px;
              margin-top:14px;
            "
          >
            <button
              type="button"
              onclick="bearbeiteAdminPinResetNeu(${Number(
                a.zeile
              )}, false)"
              style="
                width:100%;
                min-height:44px;
                border:1px solid #c9cdd2;
                background:#ffffff;
                color:#b00020;
                border-radius:8px;
                padding:9px 12px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ❌ Ablehnen
            </button>

            <button
              type="button"
              onclick="bearbeiteAdminPinResetNeu(${Number(
                a.zeile
              )}, true)"
              style="
                width:100%;
                min-height:44px;
                border:0;
                background:#14943b;
                color:#ffffff;
                border-radius:8px;
                padding:9px 12px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ✅ Reset genehmigen
            </button>
          </div>
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// ADMIN – PIN RESET BEARBEITEN
// ==========================================================

async function bearbeiteAdminPinResetNeu(
  zeile,
  genehmigen
) {
  const frage =
    genehmigen
      ? 'PIN-Reset wirklich genehmigen? Der bisherige PIN des Mitarbeiters wird gelöscht.'
      : 'PIN-Reset-Anfrage wirklich ablehnen?';

  if (
    !window.confirm(
      frage
    )
  ) {
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  try {
    const result =
      await apiPost(
        'adminPinResetBearbeiten',
        {
          token:
            token,

          zeile:
            Number(
              zeile
            ),

          genehmigen:
            genehmigen === true
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();

      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'PIN-Reset konnte nicht bearbeitet werden.'
      );
    }

    window.alert(
      result.message ||
      'PIN-Anfrage wurde bearbeitet.'
    );

    await ladeAdminAnfragenNeu();

  } catch (error) {
    console.error(
      'PIN Reset Admin:',
      error
    );

    window.alert(
      'Fehler: ' +
      error.message
    );
  }
}


// ==========================================================
// URLAUB BEANTRAGEN – ANSICHT
// ==========================================================

function installiereUrlaubNavigationNeu() {
  const menue =
    document.getElementById(
      'tauschUntermenue'
    );

  if (
    !menue ||
    document.getElementById(
      'urlaubNavNeu'
    )
  ) {
    return;
  }

  const button =
    document.createElement(
      'button'
    );

  button.id =
    'urlaubNavNeu';

  button.type =
    'button';

  button.setAttribute(
    'onclick',
    "zeigeSeite('urlaub')"
  );

  button.textContent =
    '🏖️ Urlaub beantragen';

  menue.appendChild(
    button
  );
}


function installiereUrlaubAnsichtNeu() {
  if (
    document.getElementById(
      'urlaubAnsichtNeu'
    )
  ) {
    return;
  }

  const main =
    document.querySelector(
      '#hauptApp .content'
    );

  if (!main) {
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'urlaubAnsichtNeu';

  section.style.display =
    'none';

  section.innerHTML = `
    <div class="content-header">
      <div>
        <h1>
          🏖️ Urlaub beantragen
        </h1>

        <p>
          Wähle deinen gewünschten Urlaubszeitraum.
          Urlaubssperren werden automatisch geprüft.
        </p>
      </div>
    </div>

    <div
      class="panel"
      style="
        max-width:720px;
        margin-left:auto;
        margin-right:auto;
      "
    >
      <label
        for="urlaubVonNeu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        "
      >
        Von
      </label>

      <input
        id="urlaubVonNeu"
        type="date"
        onchange="pruefeUrlaubssperreLiveNeu()"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          margin-bottom:16px;
          font-size:16px;
        "
      >

      <label
        for="urlaubBisNeu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        "
      >
        Bis
      </label>

      <input
        id="urlaubBisNeu"
        type="date"
        onchange="pruefeUrlaubssperreLiveNeu()"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          margin-bottom:16px;
          font-size:16px;
        "
      >

      <div
        id="urlaubSperreHinweisNeu"
        style="
          display:none;
          margin-bottom:16px;
          padding:12px 13px;
          border-radius:9px;
          background:#fdecec;
          color:#a51c2b;
          font-weight:700;
          line-height:1.45;
        "
      ></div>

      <label
        for="urlaubNotizNeu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        "
      >
        Notiz
        <span
          style="
            color:#888;
            font-weight:400;
          "
        >
          (optional)
        </span>
      </label>

      <textarea
        id="urlaubNotizNeu"
        maxlength="500"
        rows="4"
        placeholder="Optionaler Hinweis …"
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:12px;
          margin-bottom:16px;
          font:inherit;
          resize:vertical;
        "
      ></textarea>

      <div
        id="urlaubMeldungNeu"
        style="
          min-height:22px;
          margin-bottom:12px;
          line-height:1.45;
        "
      ></div>

      <button
        id="urlaubSendenButtonNeu"
        type="button"
        onclick="sendeUrlaubsAnfrageNeu()"
        style="
          width:100%;
          min-height:48px;
          border:0;
          background:#111;
          color:#fff;
          border-radius:9px;
          padding:11px 14px;
          font-weight:800;
          font-size:15px;
          cursor:pointer;
        "
      >
        📤 Urlaubsantrag senden
      </button>
    </div>
  `;

  main.appendChild(
    section
  );
}


function isoZuDatumNeu(
  wert
) {
  const m =
    String(wert || '')
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

  if (!m) {
    return null;
  }

  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12,
    0,
    0
  );
}


function findeUrlaubssperreFrontendNeu(
  vonText,
  bisText
) {
  const von =
    isoZuDatumNeu(
      vonText
    );

  const bis =
    isoZuDatumNeu(
      bisText
    );

  if (
    !von ||
    !bis
  ) {
    return null;
  }

  return (
    kalenderHinweiseNeu || []
  ).find(
    function(hinweis) {
      if (
        String(
          hinweis.typ || ''
        )
          .trim()
          .toLowerCase() !==
        'urlaubssperre'
      ) {
        return false;
      }

      const sperreVon =
        parseDatumHinweisNeu(
          hinweis.von
        );

      const sperreBis =
        parseDatumHinweisNeu(
          hinweis.bis
        );

      if (
        !sperreVon ||
        !sperreBis
      ) {
        return false;
      }

      return (
        von.getTime() <=
          sperreBis.getTime() &&
        bis.getTime() >=
          sperreVon.getTime()
      );
    }
  ) || null;
}


function pruefeUrlaubssperreLiveNeu() {
  const von =
    document.getElementById(
      'urlaubVonNeu'
    );

  const bis =
    document.getElementById(
      'urlaubBisNeu'
    );

  const hinweis =
    document.getElementById(
      'urlaubSperreHinweisNeu'
    );

  const button =
    document.getElementById(
      'urlaubSendenButtonNeu'
    );

  if (
    !von ||
    !bis ||
    !hinweis ||
    !button
  ) {
    return;
  }

  const sperre =
    findeUrlaubssperreFrontendNeu(
      von.value,
      bis.value
    );

  if (sperre) {
    hinweis.style.display =
      'block';

    hinweis.textContent =
      '⛔ Urlaubssperre: ' +
      String(
        sperre.bezeichnung || ''
      ) +
      ' (' +
      String(
        sperre.von || ''
      ) +
      ' – ' +
      String(
        sperre.bis || ''
      ) +
      ')';

    button.disabled =
      true;

    button.style.opacity =
      '.55';

    button.style.cursor =
      'not-allowed';

  } else {
    hinweis.style.display =
      'none';

    hinweis.textContent =
      '';

    button.disabled =
      false;

    button.style.opacity =
      '1';

    button.style.cursor =
      'pointer';
  }
}


async function sendeUrlaubsAnfrageNeu() {
  const von =
    document.getElementById(
      'urlaubVonNeu'
    );

  const bis =
    document.getElementById(
      'urlaubBisNeu'
    );

  const notiz =
    document.getElementById(
      'urlaubNotizNeu'
    );

  const meldung =
    document.getElementById(
      'urlaubMeldungNeu'
    );

  const button =
    document.getElementById(
      'urlaubSendenButtonNeu'
    );

  if (
    !von ||
    !bis ||
    !meldung ||
    !button
  ) {
    return;
  }

  meldung.textContent =
    '';

  if (
    !von.value ||
    !bis.value
  ) {
    meldung.style.color =
      '#b00020';

    meldung.textContent =
      'Bitte wähle Von und Bis aus.';

    return;
  }

  if (
    bis.value <
    von.value
  ) {
    meldung.style.color =
      '#b00020';

    meldung.textContent =
      'Das Bis-Datum darf nicht vor dem Von-Datum liegen.';

    return;
  }

  const sperre =
    findeUrlaubssperreFrontendNeu(
      von.value,
      bis.value
    );

  if (sperre) {
    pruefeUrlaubssperreLiveNeu();
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();
    return;
  }

  button.disabled =
    true;

  button.textContent =
    'Wird gesendet …';

  try {
    const result =
      await apiPost(
        'urlaubAnfrageSenden',
        {
          token:
            token,

          von:
            von.value,

          bis:
            bis.value,

          notiz:
            notiz
              ? notiz.value
              : ''
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();
      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Urlaubsantrag konnte nicht gesendet werden.'
      );
    }

    meldung.style.color =
      '#176b2c';

    meldung.textContent =
      '✅ ' +
      (
        result.message ||
        'Urlaubsantrag wurde gesendet.'
      );

    von.value =
      '';

    bis.value =
      '';

    if (notiz) {
      notiz.value =
        '';
    }

    pruefeUrlaubssperreLiveNeu();

  } catch (error) {
    meldung.style.color =
      '#b00020';

    meldung.textContent =
      '❌ ' +
      error.message;

  } finally {
    button.disabled =
      false;

    button.textContent =
      '📤 Urlaubsantrag senden';

    pruefeUrlaubssperreLiveNeu();
  }
}


// ==========================================================
// DYNAMISCHE ANSICHTEN INSTALLIEREN
// ==========================================================

function installiereDynamischeAnsichtenNeu() {
  installiereAbwesenheitenAnsichtNeu();

  installiereAnfragenAnsichtNeu();

  installierePinAnsichtNeu();

  installiereAdminAnsichtNeu();

  installiereSonstigerWunschAnsichtNeu();

  installiereUrlaubAnsichtNeu();

  installiereUrlaubNavigationNeu();
}


// ==========================================================
// ALLE HAUPTANSICHTEN VERSTECKEN
// ==========================================================

function versteckeAlleHauptAnsichtenNeu() {
  const ids = [
    'dienstplanAnsicht',
    'tauschAnsicht',
    'abwesenheitenAnsicht',
    'anfragenAnsicht',
    'pinAnsicht',
    'adminAnsicht',
    'sonstigerWunschAnsicht',
    'urlaubAnsichtNeu'
  ];

  ids.forEach(
    function(id) {
      const element =
        document.getElementById(
          id
        );

      if (element) {
        element.style.display =
          'none';
      }
    }
  );
}


// ==========================================================
// NAVIGATION AKTIV SETZEN
// ==========================================================

function setzeNavigationAktivNeu(
  seite
) {
  document
    .querySelectorAll(
      '.nav-item'
    )
    .forEach(
      function(button) {
        button.classList.remove(
          'aktiv'
        );
      }
    );

  document
    .querySelectorAll(
      '.nav-untermenue button'
    )
    .forEach(
      function(button) {
        button.classList.remove(
          'aktiv'
        );
      }
    );

  const tauschGruppe =
    document.querySelector(
      '.nav-gruppe'
    );

  if (tauschGruppe) {
    tauschGruppe.classList.remove(
      'aktiv'
    );
  }

  const selector =
    `[onclick="zeigeSeite('${seite}')"]`;

  const button =
    document.querySelector(
      selector
    );

  if (button) {
    button.classList.add(
      'aktiv'
    );
  }

  if (
    seite ===
      'dienstTauschen' ||
    seite ===
      'sonstigerWunsch' ||
    seite ===
      'urlaub'
  ) {
    if (tauschGruppe) {
      tauschGruppe.classList.add(
        'aktiv'
      );
    }

    const untermenue =
      document.getElementById(
        'tauschUntermenue'
      );

    if (untermenue) {
      untermenue.classList.add(
        'offen'
      );
    }
  }
}


// ==========================================================
// SEITENTITEL MOBIL
// ==========================================================

function setzeSeitentitelNeu(
  seite
) {
  const titel =
    document.getElementById(
      'mobileSeitentitel'
    );

  if (!titel) {
    return;
  }

  const texte = {
    dienstplan:
      'Mein Dienstplan',

    abwesenheiten:
      'Meine Abwesenheiten',

    anfragen:
      'Meine Anfragen',

    pin:
      'PIN & Sicherheit',

    admin:
      'Admin-Bereich',

    dienstTauschen:
      'Dienst tauschen',

    sonstigerWunsch:
      'Sonstiger Wunsch',

    urlaub:
      'Urlaub beantragen'
  };

  titel.textContent =
    texte[seite] ||
    'SCS Team';
}


// ==========================================================
// MOBILES MENÜ SCHLIESSEN
// ==========================================================

function schliesseNavigationNeu() {
  const sidebar =
    document.getElementById(
      'sidebar'
    );

  if (sidebar) {
    sidebar.classList.remove(
      'mobile-offen'
    );
  }

  const menuButton =
    document.querySelector(
      '.mobile-menu'
    );

  if (menuButton) {
    menuButton.textContent =
      '☰';

    menuButton.setAttribute(
      'aria-label',
      'Menü öffnen'
    );
  }
}


// ==========================================================
// NAVIGATION ERWEITERN
// ==========================================================

function installiereNavigationErweiterungNeu() {
  if (
    window.__scsNavigationInstalliert
  ) {
    return;
  }

  window.__scsNavigationInstalliert =
    true;

  /*
    Falls in index.html bereits eine ältere
    zeigeSeite()-Funktion vorhanden ist,
    merken wir sie uns als Fallback.
  */
  const basisZeigeSeite =
    typeof window.zeigeSeite ===
      'function'
      ? window.zeigeSeite
      : null;


  window.zeigeSeite =
    async function(seite) {
      seite =
        String(
          seite || ''
        );

      installiereDynamischeAnsichtenNeu();

      setzeSeitentitelNeu(
        seite
      );

      setzeNavigationAktivNeu(
        seite
      );


      // ======================================================
      // MEIN DIENSTPLAN
      // ======================================================

      if (
        seite ===
        'dienstplan'
      ) {
        versteckeAlleHauptAnsichtenNeu();

        const ansicht =
          document.getElementById(
            'dienstplanAnsicht'
          );

        if (ansicht) {
          ansicht.style.display =
            'block';
        }

        schliesseNavigationNeu();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        await ladeMeinDienstplanNeu();

        /*
          Badge im Hintergrund aktualisieren.
        */
        setTimeout(
          function() {
            ladeMeineAnfragenNeu(
              false
            );
          },
          300
        );

        setTimeout(
          function() {
            ladeAppInfoNeu();
          },
          400
        );

        return;
      }


      // ======================================================
      // DIENST TAUSCHEN
      // ======================================================

      if (
        seite ===
        'dienstTauschen'
      ) {
        /*
          Wichtig:
          Wenn Dienst tauschen direkt über das
          Hamburger-Menü geöffnet wird, müssen wir
          zuerst die eigenen Dienste laden und
          automatisch den ersten tauschbaren Tag setzen.
        */
        if (
          !Array.isArray(
            letzterDienstplan
          ) ||
          letzterDienstplan.length === 0
        ) {
          await ladeMeinDienstplanNeu();
        }

        versteckeAlleHauptAnsichtenNeu();

        const ansicht =
          document.getElementById(
            'tauschAnsicht'
          );

        if (ansicht) {
          ansicht.style.display =
            'block';
        }

        /*
          Hier wird Tag + Dienst initialisiert.
          Dadurch funktionieren auch ← und →,
          wenn man über das Menü kommt.
        */
        await initialisiereTauschAnsichtNeu();

        schliesseNavigationNeu();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        return;
      }


      // ======================================================
      // ABWESENHEITEN
      // ======================================================

      if (
        seite ===
        'abwesenheiten'
      ) {
        versteckeAlleHauptAnsichtenNeu();

        const ansicht =
          document.getElementById(
            'abwesenheitenAnsicht'
          );

        if (ansicht) {
          ansicht.style.display =
            'block';
        }

        schliesseNavigationNeu();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        await ladeMeineAbwesenheitenNeu();

        return;
      }


      // ======================================================
      // MEINE ANFRAGEN
      // ======================================================

      if (
        seite ===
        'anfragen'
      ) {
        versteckeAlleHauptAnsichtenNeu();

        const ansicht =
          document.getElementById(
            'anfragenAnsicht'
          );

        if (ansicht) {
          ansicht.style.display =
            'block';
        }

        schliesseNavigationNeu();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        await ladeMeineAnfragenNeu(
          true
        );

        return;
      }


      // ======================================================
      // PIN & SICHERHEIT
      // ======================================================

      if (
        seite ===
        'pin'
      ) {
        versteckeAlleHauptAnsichtenNeu();

        const ansicht =
          document.getElementById(
            'pinAnsicht'
          );

        if (ansicht) {
          ansicht.style.display =
            'block';
        }

        schliesseNavigationNeu();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        return;
      }


      // ======================================================
      // ADMIN-BEREICH
      // ======================================================

      if (
        seite ===
        'admin'
      ) {
        if (
          !aktuellerAdmin
        ) {
          window.alert(
            'Keine Admin-Berechtigung.'
          );

          return;
        }

        versteckeAlleHauptAnsichtenNeu();

        const ansicht =
          document.getElementById(
            'adminAnsicht'
          );

        if (ansicht) {
          ansicht.style.display =
            'block';
        }

        schliesseNavigationNeu();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        await ladeAdminAnfragenNeu();

        return;
      }


      // ======================================================
      // SONSTIGER WUNSCH
      // ======================================================

      if (
        seite ===
        'sonstigerWunsch'
      ) {
        if (
          !Array.isArray(
            letzterDienstplan
          ) ||
          letzterDienstplan.length === 0
        ) {
          await ladeMeinDienstplanNeu();
        }

        versteckeAlleHauptAnsichtenNeu();

        const ansicht =
          document.getElementById(
            'sonstigerWunschAnsicht'
          );

        if (ansicht) {
          ansicht.style.display =
            'block';
        }

        /*
          Eigene Dienste für optionalen
          Dienstbezug eintragen.
        */
        ladeSonstigerWunschDiensteNeu();

        const meldung =
          document.getElementById(
            'sonstigerWunschMeldung'
          );

        if (meldung) {
          meldung.textContent =
            '';
        }

        schliesseNavigationNeu();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        return;
      }


      // ======================================================
      // URLAUB BEANTRAGEN
      // ======================================================

      if (
        seite ===
        'urlaub'
      ) {
        versteckeAlleHauptAnsichtenNeu();

        const ansicht =
          document.getElementById(
            'urlaubAnsichtNeu'
          );

        if (ansicht) {
          ansicht.style.display =
            'block';
        }

        await ladeKalenderHinweiseNeu();

        pruefeUrlaubssperreLiveNeu();

        schliesseNavigationNeu();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        return;
      }


      // ======================================================
      // FALLBACK
      // ======================================================

      if (
        basisZeigeSeite
      ) {
        return basisZeigeSeite.call(
          window,
          seite
        );
      }
    };
}


// ==========================================================
// APP-INFO / AKTUALISIERT AM
// ==========================================================

async function ladeAppInfoNeu() {
  const element =
    document.getElementById(
      'sidebarAktualisiert'
    );

  if (!element) {
    return;
  }

  try {
    const result =
      await apiPost(
        'appInfo'
      );

    if (
      result &&
      result.ok
    ) {
      element.textContent =
        result.aktualisiert ||
        '—';
    }

  } catch (error) {
    console.error(
      'App-Info:',
      error
    );
  }
}


// ==========================================================
// DIENSTZEITEN – FRÜH
// ==========================================================

function zeitFruehNeu(
  tag
) {
  if (
    tag ===
    'Samstag'
  ) {
    return '09:00 – 18:00';
  }

  return '09:00 – 14:30';
}


// ==========================================================
// DIENSTZEITEN – SPÄT
// ==========================================================

function zeitSpaetNeu(
  tag
) {
  if (
    tag ===
    'Samstag'
  ) {
    return '11:30 – 16:00';
  }

  if (
    tag ===
      'Donnerstag' ||
    tag ===
      'Freitag'
  ) {
    return '14:30 – 20:00';
  }

  return '14:30 – 19:00';
}


// ==========================================================
// ENDE FÜR GANZTAGESDIENST
// ==========================================================

function zeitSpaetEndeNeu(
  tag
) {
  if (
    tag ===
    'Samstag'
  ) {
    return '18:00';
  }

  if (
    tag ===
      'Donnerstag' ||
    tag ===
      'Freitag'
  ) {
    return '20:00';
  }

  return '19:00';
}


// ==========================================================
// KOMPATIBILITÄT – LOGOUT
// ==========================================================

/*
  Falls index.html noch logoutAusfuehren()
  aufruft, wird einfach unsere neue
  logoutNeu()-Funktion verwendet.
*/

async function logoutAusfuehren() {
  await logoutNeu();
}


// ==========================================================
// HTML SICHER AUSGEBEN
// ==========================================================

function escapeHtmlNeu(
  text
) {
  return String(
    text ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


// ==========================================================
// ENDE APP.JS
// ==========================================================


// ==========================================================
// FINALER FIX – WOCHENNAVIGATION
// ==========================================================
// Diese Definitionen stehen absichtlich am Ende von app.js.

function wechselKwNeu(richtung) {
  const schritt =
    Number(richtung) < 0
      ? -1
      : 1;

  let kw =
    Number(aktuelleKwNeu) || 1;

  kw += schritt;

  if (kw < 1) {
    kw = 53;
  }

  if (kw > 53) {
    kw = 1;
  }

  aktuelleKwNeu = kw;

  const anzeige =
    document.getElementById(
      'kwAnzeige'
    );

  if (anzeige) {
    anzeige.textContent =
      'KW ' + String(aktuelleKwNeu);
  }

  rendereDienstplanNeu();
}

function wechselWoche(richtung) {
  wechselKwNeu(richtung);
}


// ==========================================================
// AUTOMATISCHE WOCHENSTUNDEN – GEPLANT / SOLL
// ==========================================================

function zeitZuMinutenNeu(text) {
  const m = String(text || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function dauerAusZeitTextNeu(text) {
  const teile = String(text || '').match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (!teile) return 0;

  const start = zeitZuMinutenNeu(teile[1]);
  const ende = zeitZuMinutenNeu(teile[2]);

  if (start == null || ende == null) return 0;

  let minuten = ende - start;
  if (minuten < 0) minuten += 24 * 60;

  return minuten / 60;
}

function berechneGeplanteWochenstundenNeu() {
  const kw = Number(aktuelleKwNeu) || 1;
  let stunden = 0;

  (letzterDienstplan || []).forEach(function(z) {
    if (Number(z.kw || 0) !== kw) {
      return;
    }

    // Nur die echten Hauptdienste zählen.
    // Pausenablösen sind innerhalb des Dienstes Zusatzinfos und werden
    // deshalb nicht noch einmal extra addiert.
    if (z.gpFrueh) {
      stunden += dauerAusZeitTextNeu(
        zeitFruehNeu(z.tag)
      );
    }

    if (z.gpSpaet) {
      stunden += dauerAusZeitTextNeu(
        zeitSpaetNeu(z.tag)
      );
    }

    if (z.wpFrueh) {
      stunden += dauerAusZeitTextNeu(
        zeitFruehNeu(z.tag)
      );
    }

    if (z.wpSpaet) {
      stunden += dauerAusZeitTextNeu(
        zeitSpaetNeu(z.tag)
      );
    }
  });

  return Math.round(stunden * 100) / 100;
}

function formatiereStundenNeu(wert) {
  const n = Number(wert || 0);
  return n.toLocaleString('de-DE', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 1,
    maximumFractionDigits: 2
  });
}

function aktualisiereAutomatischeWochenstundenNeu() {
  const element = document.getElementById('dienstplanSollstunden');
  if (!element) return;

  const geplant = berechneGeplanteWochenstundenNeu();

  let soll = Number(letzteSollstundenNeu);
  if (!Number.isFinite(soll)) {
    const gefunden = String(element.dataset.sollstunden || '').replace(',', '.');
    soll = Number(gefunden);
  }

  if (!Number.isFinite(soll)) {
    soll = 0;
  }

  element.dataset.sollstunden = String(soll);

  element.textContent =
    'Geplant: ' +
    formatiereStundenNeu(geplant) +
    ' Std. / Soll: ' +
    formatiereStundenNeu(soll) +
    ' Std.';
}

// Sollstunden separat merken, damit sie beim KW-Wechsel erhalten bleiben.
let letzteSollstundenNeu = 0;

const alteAktualisiereWochenstundenNeu =
  typeof aktualisiereWochenstundenNeu === 'function'
    ? aktualisiereWochenstundenNeu
    : null;

aktualisiereWochenstundenNeu = function(sollstunden) {
  letzteSollstundenNeu = Number(sollstunden || 0);

  const element = document.getElementById('dienstplanSollstunden');
  if (element) {
    element.dataset.sollstunden = String(letzteSollstundenNeu);
  }

  // Erst nach dem Rendern berechnen.
  window.setTimeout(
    aktualisiereAutomatischeWochenstundenNeu,
    0
  );
};

// Nach jedem Rendern die Stunden für die gerade sichtbare KW neu berechnen.
const alterRendereDienstplanNeu = rendereDienstplanNeu;

rendereDienstplanNeu = function() {
  alterRendereDienstplanNeu();
  window.setTimeout(
    aktualisiereAutomatischeWochenstundenNeu,
    0
  );
};



// ==========================================================
// ADMIN – GESAMTER DIENSTPLAN
// SCHRITT 3: NUR ANZEIGE IM ADMIN-BEREICH
// ==========================================================

let adminGesamtDienstplanNeu = [];
let adminGesamtAbwesenheitenNeu = [];
let adminGesamtKwNeu = null;

function installiereAdminGesamtplanPanelNeu() {
  const ansicht =
    document.getElementById(
      'adminAnsicht'
    );

  if (
    !ansicht ||
    document.getElementById(
      'adminGesamtplanPanelNeu'
    )
  ) {
    return;
  }

  const panel =
    document.createElement(
      'div'
    );

  panel.id =
    'adminGesamtplanPanelNeu';

  panel.className =
    'panel';

  panel.style.marginBottom =
    '18px';

  panel.innerHTML = `
    <h2 style="margin-top:0;">
      📅 Gesamter Dienstplan
    </h2>

    <p style="color:#666;">
      Hier siehst du alle eingetragenen Dienste einer Kalenderwoche.
    </p>

    <div
      style="
        display:flex;
        align-items:center;
        justify-content:center;
        gap:16px;
        margin:16px 0 18px;
      "
    >
      <button
        type="button"
        onclick="wechselAdminGesamtKwNeu(-1)"
        style="
          width:44px;
          height:44px;
          border:1px solid #d7dce1;
          background:#fff;
          border-radius:9px;
          font-size:24px;
          cursor:pointer;
        "
      >
        ‹
      </button>

      <strong
        id="adminGesamtKwAnzeigeNeu"
        style="
          min-width:80px;
          text-align:center;
          font-size:17px;
        "
      >
        KW —
      </strong>

      <button
        type="button"
        onclick="wechselAdminGesamtKwNeu(1)"
        style="
          width:44px;
          height:44px;
          border:1px solid #d7dce1;
          background:#fff;
          border-radius:9px;
          font-size:24px;
          cursor:pointer;
        "
      >
        ›
      </button>
    </div>

    <div id="adminGesamtplanListeNeu">
      <div class="empty-state">
        Gesamtdienstplan wird geladen …
      </div>
    </div>
  `;

  const header =
    ansicht.querySelector(
      '.content-header'
    );

  if (
    header &&
    header.nextSibling
  ) {
    ansicht.insertBefore(
      panel,
      header.nextSibling
    );
  } else {
    ansicht.appendChild(
      panel
    );
  }
}


function ermittleAdminGesamtKwsNeu() {
  return Array.from(
    new Set(
      (adminGesamtDienstplanNeu || [])
        .map(function(eintrag) {
          return Number(
            eintrag.kw || 0
          );
        })
        .filter(function(kw) {
          return (
            Number.isFinite(kw) &&
            kw > 0
          );
        })
    )
  ).sort(function(a, b) {
    return a - b;
  });
}


function setzeAdminGesamtStartKwNeu() {
  const kws =
    ermittleAdminGesamtKwsNeu();

  if (!kws.length) {
    adminGesamtKwNeu = null;
    return;
  }

  // Wichtig:
  // Der Gesamtplan darf NICHT die aktuelle Kalenderwoche
  // des heutigen Jahres (2026) verwenden.
  // Stattdessen starten wir – wie beim persönlichen Dienstplan –
  // mit der ersten tatsächlich im Dienstplan 2027 vorhandenen KW.
  adminGesamtKwNeu =
    kws[0];
}


async function ladeAdminGesamtplanNeu() {
  installiereAdminGesamtplanPanelNeu();

  const liste =
    document.getElementById(
      'adminGesamtplanListeNeu'
    );

  if (!liste) {
    return;
  }

  if (!aktuellerAdmin) {
    liste.innerHTML =
      '<div class="empty-state">Keine Admin-Berechtigung.</div>';
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    return;
  }

  liste.innerHTML =
    '<div class="empty-state">Gesamtdienstplan wird geladen …</div>';

  try {
    const result =
      await apiPost(
        'adminGesamtDienstplan',
        {
          token:
            token
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();
      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Gesamtdienstplan konnte nicht geladen werden.'
      );
    }

    adminGesamtDienstplanNeu =
      Array.isArray(
        result.dienstplan
      )
        ? result.dienstplan
        : [];

    adminGesamtAbwesenheitenNeu =
      Array.isArray(
        result.abwesenheiten
      )
        ? result.abwesenheiten
        : [];

    await ladeKalenderHinweiseNeu();

    if (
      !adminGesamtKwNeu ||
      !ermittleAdminGesamtKwsNeu()
        .includes(
          Number(
            adminGesamtKwNeu
          )
        )
    ) {
      setzeAdminGesamtStartKwNeu();
    }

    rendereAdminGesamtplanNeu();

  } catch (error) {
    liste.innerHTML = `
      <div
        class="empty-state"
        style="color:#b00020;"
      >
        ❌ ${escapeHtmlNeu(
          error.message
        )}
      </div>
    `;
  }
}


function wechselAdminGesamtKwNeu(
  richtung
) {
  const kws =
    ermittleAdminGesamtKwsNeu();

  if (!kws.length) {
    return;
  }

  let index =
    kws.indexOf(
      Number(
        adminGesamtKwNeu
      )
    );

  if (index < 0) {
    index = 0;
  }

  index +=
    Number(
      richtung || 0
    ) < 0
      ? -1
      : 1;

  if (index < 0) {
    index =
      kws.length - 1;
  }

  if (
    index >=
    kws.length
  ) {
    index = 0;
  }

  adminGesamtKwNeu =
    kws[index];

  rendereAdminGesamtplanNeu();
}


function baueAdminDienstEintragNeu(
  titel,
  name,
  zeit
) {
  name =
    String(
      name || ''
    ).trim();

  if (!name) {
    return '';
  }

  return `
    <div
      style="
        padding:8px 0;
        border-top:1px solid #eef0f2;
        line-height:1.45;
      "
    >
      <strong>
        ${escapeHtmlNeu(
          titel
        )}
      </strong>

      <div>
        ${escapeHtmlNeu(
          name
        )}
      </div>

      ${
        zeit
          ? `
            <div
              style="
                margin-top:2px;
                color:#777;
                font-size:12px;
              "
            >
              ${escapeHtmlNeu(
                zeit
              )}
            </div>
          `
          : ''
      }
    </div>
  `;
}



function datumTextZuZeitAdminNeu(
  text
) {
  const m =
    String(
      text || ''
    )
      .trim()
      .match(
        /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
      );

  if (!m) {
    return null;
  }

  return new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    12,
    0,
    0
  ).getTime();
}


function adminAbwesenheitenFuerDatumNeu(
  datumText
) {
  const zeit =
    datumTextZuZeitAdminNeu(
      datumText
    );

  if (zeit === null) {
    return [];
  }

  return (
    adminGesamtAbwesenheitenNeu || []
  ).filter(
    function(a) {
      const von =
        datumTextZuZeitAdminNeu(
          a.von
        );

      const bis =
        datumTextZuZeitAdminNeu(
          a.bis
        );

      return (
        von !== null &&
        bis !== null &&
        zeit >= von &&
        zeit <= bis
      );
    }
  );
}


function adminAbwesenheitenHtmlNeu(
  datumText
) {
  const abwesenheiten =
    adminAbwesenheitenFuerDatumNeu(
      datumText
    );

  if (!abwesenheiten.length) {
    return '';
  }

  const zeilen =
    abwesenheiten.map(
      function(a) {
        const art =
          String(
            a.art || ''
          ).trim();

        const artKlein =
          art.toLowerCase();

        let symbol =
          '📌';

        let hintergrund =
          '#f5f5f5';

        let farbe =
          '#444';

        if (
          artKlein.includes(
            'urlaub'
          )
        ) {
          symbol =
            '🏖️';

          hintergrund =
            '#eaf4ff';

          farbe =
            '#174d7a';
        }

        else if (
          artKlein.includes(
            'krank'
          )
        ) {
          symbol =
            '🤒';

          hintergrund =
            '#fdecec';

          farbe =
            '#a51c2b';
        }

        return `
          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              padding:9px 11px;
              margin-top:7px;
              border-radius:9px;
              background:${hintergrund};
              color:${farbe};
              font-weight:700;
              line-height:1.35;
            "
          >
            <span>${symbol}</span>

            <span>
              ${escapeHtmlNeu(
                a.mitarbeiter || ''
              )}
              ·
              ${escapeHtmlNeu(
                art || 'Abwesend'
              )}
            </span>
          </div>
        `;
      }
    )
    .join('');

  return `
    <div
      style="
        margin-top:12px;
        padding-top:10px;
        border-top:1px solid #eceff2;
      "
    >
      <div
        style="
          font-size:13px;
          font-weight:800;
          color:#555;
          margin-bottom:3px;
        "
      >
        👥 Abwesend
      </div>

      ${zeilen}
    </div>
  `;
}


function rendereAdminGesamtplanNeu() {
  const liste =
    document.getElementById(
      'adminGesamtplanListeNeu'
    );

  const anzeige =
    document.getElementById(
      'adminGesamtKwAnzeigeNeu'
    );

  if (!liste) {
    return;
  }

  if (anzeige) {
    anzeige.textContent =
      adminGesamtKwNeu
        ? 'KW ' +
          String(
            adminGesamtKwNeu
          )
        : 'KW —';
  }

  if (!adminGesamtKwNeu) {
    liste.innerHTML =
      '<div class="empty-state">Keine Dienstplandaten vorhanden.</div>';
    return;
  }

  const tage =
    (adminGesamtDienstplanNeu || [])
      .filter(function(eintrag) {
        return (
          Number(
            eintrag.kw || 0
          ) ===
          Number(
            adminGesamtKwNeu
          )
        );
      });

  if (!tage.length) {
    liste.innerHTML =
      '<div class="empty-state">Für diese Kalenderwoche gibt es keine Einträge.</div>';
    return;
  }

  let html =
    '';

  tage.forEach(
    function(tag) {
      let dienste =
        '';

      dienste +=
        baueAdminDienstEintragNeu(
          '🟢 Garden Plaza – Früh',
          tag.gpFrueh,
          ''
        );

      dienste +=
        baueAdminDienstEintragNeu(
          '🟢 Garden Plaza – Spät',
          tag.gpSpaet,
          ''
        );

      dienste +=
        baueAdminDienstEintragNeu(
          '☕ GP – Pausenablöse',
          tag.gpAbloese,
          tag.gpAbloesezeit
        );

      dienste +=
        baueAdminDienstEintragNeu(
          '🔵 Water Plaza – Früh',
          tag.wpFrueh,
          ''
        );

      dienste +=
        baueAdminDienstEintragNeu(
          '🔵 Water Plaza – Spät',
          tag.wpSpaet,
          ''
        );

      dienste +=
        baueAdminDienstEintragNeu(
          '☕ WP – Pausenablöse',
          tag.wpAbloese,
          tag.wpAbloesezeit
        );

      html += `
        <div
          style="
            border:1px solid #e1e4e8;
            border-radius:10px;
            padding:14px;
            margin-bottom:12px;
            background:#fff;
          "
        >
          <div
            style="
              font-weight:800;
              font-size:16px;
              margin-bottom:8px;
            "
          >
            ${escapeHtmlNeu(
              tag.tag || ''
            )}
            ·
            ${escapeHtmlNeu(
              tag.datum || ''
            )}

            ${kalenderHinweiseHtmlNeu(
              tag.datum || ''
            )}
          </div>

          ${
            dienste ||
            '<div style="color:#777;">Keine Dienste eingetragen.</div>'
          }

          ${adminAbwesenheitenHtmlNeu(
            tag.datum || ''
          )}

          ${
            tag.notiz
              ? `
                <div
                  style="
                    margin-top:10px;
                    padding:9px 10px;
                    border-radius:8px;
                    background:#f7f8f9;
                    color:#555;
                    font-size:13px;
                  "
                >
                  📝 ${escapeHtmlNeu(
                    tag.notiz
                  )}
                </div>
              `
              : ''
          }
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// Bestehendes Admin-Laden nur erweitern.
// Die vorhandenen Admin-Funktionen bleiben unverändert.
const ladeAdminAnfragenBasisNeu =
  ladeAdminAnfragenNeu;

ladeAdminAnfragenNeu =
  async function() {

    installiereAdminGesamtplanPanelNeu();

    await Promise.all([
      ladeAdminAnfragenBasisNeu(),
      ladeAdminGesamtplanNeu()
    ]);
  };



// ==========================================================
// ADMIN – AUFKLAPPBARES UNTERMENÜ
// ==========================================================

function installiereAdminUntermenueNeu() {
  const adminNav =
    document.getElementById(
      'adminNav'
    );

  if (
    !adminNav ||
    document.getElementById(
      'adminUntermenueNeu'
    )
  ) {
    return;
  }

  // Wichtig: Der bestehende Klick-Handler in index.html schließt
  // die mobile Sidebar nach normalen Sidebar-Buttons automatisch.
  // Als nav-hauptpunkt bleibt der Admin-Reiter beim Aufklappen offen.
  adminNav.classList.add(
    'nav-hauptpunkt'
  );

  // Der bisherige Admin-Button wird zum Auf-/Zuklappen verwendet.
  adminNav.removeAttribute(
    'onclick'
  );

  adminNav.setAttribute(
    'onclick',
    'toggleAdminUntermenueNeu()'
  );

  // Pfeil ergänzen.
  const pfeil =
    document.createElement(
      'span'
    );

  pfeil.id =
    'adminUntermenuePfeilNeu';

  pfeil.className =
    'nav-pfeil';

  pfeil.textContent =
    '⌃';

  adminNav.appendChild(
    pfeil
  );

  const untermenue =
    document.createElement(
      'div'
    );

  untermenue.id =
    'adminUntermenueNeu';

  untermenue.className =
    'nav-untermenue';

  untermenue.style.display =
    aktuellerAdmin
      ? 'block'
      : 'none';

  untermenue.innerHTML = `
    <button
      type="button"
      onclick="zeigeAdminGesamtplanSeiteNeu()"
    >
      📅 Gesamter Dienstplan
    </button>

    <button
      type="button"
      onclick="zeigeAdminMitarbeiterSeiteNeu()"
    >
      👥 Mitarbeiterübersicht
    </button>

    <button
      type="button"
      onclick="zeigeAdminAnfragenSeiteNeu()"
    >
      📥 Anfragen bearbeiten
    </button>
  `;

  adminNav.insertAdjacentElement(
    'afterend',
    untermenue
  );
}


function toggleAdminUntermenueNeu() {
  if (!aktuellerAdmin) {
    return;
  }

  const menue =
    document.getElementById(
      'adminUntermenueNeu'
    );

  const pfeil =
    document.getElementById(
      'adminUntermenuePfeilNeu'
    );

  if (!menue) {
    return;
  }

  // Wie bei "Änderung / Tausch":
  // Der Admin-Bereich bleibt geöffnet und klappt
  // beim erneuten Antippen nicht wieder zu.
  menue.style.display =
    'block';

  if (pfeil) {
    pfeil.textContent =
      '⌃';
  }
}


function setzeAdminPanelSichtbarkeitNeu(
  gesamtplan
) {
  const ansicht =
    document.getElementById(
      'adminAnsicht'
    );

  if (!ansicht) {
    return;
  }

  const gesamt =
    document.getElementById(
      'adminGesamtplanPanelNeu'
    );

  const mitarbeiterPanel =
    document.getElementById(
      'adminMitarbeiterPanelNeu'
    );

  const panels =
    Array.from(
      ansicht.querySelectorAll(
        ':scope > .panel'
      )
    );

  panels.forEach(
    function(panel) {
      if (
        panel.id ===
        'adminGesamtplanPanelNeu'
      ) {
        panel.style.display =
          gesamtplan
            ? ''
            : 'none';
      } else if (
        panel.id ===
        'adminMitarbeiterPanelNeu'
      ) {
        panel.style.display =
          'none';
      } else {
        panel.style.display =
          gesamtplan
            ? 'none'
            : '';
      }
    }
  );

  if (gesamt) {
    gesamt.style.display =
      gesamtplan
        ? ''
        : 'none';
  }
}


async function zeigeAdminGesamtplanSeiteNeu() {
  if (
    typeof zeigeSeite ===
    'function'
  ) {
    zeigeSeite(
      'admin'
    );
  }

  installiereAdminGesamtplanPanelNeu();

  setzeAdminPanelSichtbarkeitNeu(
    true
  );

  await ladeAdminGesamtplanNeu();

  const titel =
    document.getElementById(
      'mobileSeitentitel'
    );

  if (titel) {
    titel.textContent =
      'Gesamter Dienstplan';
  }

  schliesseMobileMenue();
}


async function zeigeAdminAnfragenSeiteNeu() {
  if (
    typeof zeigeSeite ===
    'function'
  ) {
    zeigeSeite(
      'admin'
    );
  }

  installiereAdminGesamtplanPanelNeu();

  setzeAdminPanelSichtbarkeitNeu(
    false
  );

  await ladeAdminAnfragenBasisNeu();

  const titel =
    document.getElementById(
      'mobileSeitentitel'
    );

  if (titel) {
    titel.textContent =
      'Anfragen bearbeiten';
  }

  schliesseMobileMenue();
}


// Nach dem Login / Aufbau der Navigation das Admin-Untermenü installieren.
function versucheAdminUntermenueInstallationNeu() {
  installiereAdminUntermenueNeu();

  if (
    !document.getElementById(
      'adminUntermenueNeu'
    )
  ) {
    window.setTimeout(
      versucheAdminUntermenueInstallationNeu,
      300
    );
  }
}

window.setTimeout(
  versucheAdminUntermenueInstallationNeu,
  0
);



// ==========================================================
// ADMIN – ANFRAGEN ÜBERSICHTLICH GLIEDERN
// Nur Darstellung, keine Bearbeitungslogik.
// ==========================================================

function gliedereAdminAnfragenNeu() {
  const ansicht =
    document.getElementById(
      'adminAnsicht'
    );

  if (!ansicht) {
    return;
  }

  const tausch =
    document.getElementById(
      'adminTauschAnfragenListe'
    );

  const wuensche =
    document.getElementById(
      'adminDienstAnfragenListe'
    );

  const pin =
    document.getElementById(
      'adminPinResetListe'
    );

  [
    [tausch, '🔄 Diensttausch'],
    [wuensche, '💬 Sonstige Wünsche'],
    [pin, '🔐 PIN-Reset']
  ].forEach(function(eintrag) {
    const liste = eintrag[0];
    const titel = eintrag[1];

    if (!liste) {
      return;
    }

    const panel =
      liste.closest(
        '.panel'
      );

    if (!panel) {
      return;
    }

    panel.style.marginBottom =
      '18px';

    panel.style.borderRadius =
      '12px';

    panel.style.overflow =
      'hidden';

    const h2 =
      panel.querySelector(
        'h2'
      );

    if (h2) {
      h2.textContent =
        titel;
    }
  });
}


// Bestehende Admin-Seite nach dem Aufbau nur optisch nachbearbeiten.
window.setTimeout(
  gliedereAdminAnfragenNeu,
  0
);



// ==========================================================
// ADMIN – BEARBEITETE WÜNSCHE OPTISCH ABSETZEN
// Nur Darstellung, keine Logik.
// ==========================================================

function styleBearbeiteteWuenscheNeu() {
  const liste =
    document.getElementById(
      'adminDienstAnfragenListe'
    );

  if (!liste) {
    return;
  }

  const panel =
    liste.closest(
      '.panel'
    );

  if (!panel) {
    return;
  }

  // "Bearbeitete Wünsche" innerhalb des Wunsch-Panels suchen.
  const elemente =
    Array.from(
      panel.querySelectorAll(
        'h2, h3, h4, strong, div'
      )
    );

  const titel =
    elemente.find(
      function(el) {
        return (
          el.textContent &&
          el.textContent
            .trim()
            .includes(
              'Bearbeitete Wünsche'
            )
        );
      }
    );

  if (!titel) {
    return;
  }

  // Nur den direkten Bereich optisch hervorheben.
  const bereich =
    titel.parentElement;

  if (!bereich) {
    return;
  }

  bereich.style.marginTop =
    '22px';

  bereich.style.paddingTop =
    '20px';

  bereich.style.borderTop =
    '2px solid #e5e7eb';

  titel.style.color =
    '#555';

  titel.style.fontWeight =
    '800';
}


// Nach dem Laden der Admin-Anfragen anwenden.
const ladeAdminAnfragenDarstellungBasisNeu =
  ladeAdminAnfragenNeu;

ladeAdminAnfragenNeu =
  async function() {

    await ladeAdminAnfragenDarstellungBasisNeu();

    window.setTimeout(
      function() {
        gliedereAdminAnfragenNeu();
        styleBearbeiteteWuenscheNeu();
      },
      0
    );
  };



// ==========================================================
// ADMIN – BADGE FÜR OFFENE ANFRAGEN
// ==========================================================

function aktualisiereAdminBadgeNeu(anzahl) {
  const adminNav =
    document.getElementById(
      'adminNav'
    );

  if (!adminNav) {
    return;
  }

  let badge =
    document.getElementById(
      'adminOffenBadgeNeu'
    );

  const wert =
    Math.max(
      0,
      Number(anzahl || 0)
    );

  if (wert === 0) {
    if (badge) {
      badge.remove();
    }
    return;
  }

  if (!badge) {
    badge =
      document.createElement(
        'span'
      );

    badge.id =
      'adminOffenBadgeNeu';

    badge.style.cssText = `
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:20px;
      height:20px;
      padding:0 6px;
      margin-left:auto;
      border-radius:999px;
      background:#d93025;
      color:#fff;
      font-size:12px;
      font-weight:800;
      line-height:1;
      box-sizing:border-box;
    `;

    const pfeil =
      document.getElementById(
        'adminUntermenuePfeilNeu'
      );

    if (pfeil) {
      adminNav.insertBefore(
        badge,
        pfeil
      );
    } else {
      adminNav.appendChild(
        badge
      );
    }
  }

  badge.textContent =
    wert > 99
      ? '99+'
      : String(wert);
}


// ==========================================================
// MEINE URLAUBSANTRÄGE – DOPPELTE PANELS ENTFERNEN
// ==========================================================

function entferneDoppelteUrlaubsPanelsNeu() {
  const ansicht =
    document.getElementById(
      'anfragenAnsicht'
    );

  if (!ansicht) {
    return;
  }

  const panels =
    Array.from(
      ansicht.querySelectorAll(
        '.panel'
      )
    ).filter(
      function(panel) {
        const titel =
          panel.querySelector(
            'h2'
          );

        return (
          titel &&
          titel.textContent &&
          titel.textContent.includes(
            'Meine Urlaubsanträge'
          )
        );
      }
    );

  if (panels.length <= 1) {
    return;
  }

  for (
    let i = 1;
    i < panels.length;
    i++
  ) {
    panels[i].remove();
  }
}


setTimeout(entferneDoppelteUrlaubsPanelsNeu, 0);


// ==========================================================
// ADMIN – MITARBEITERÜBERSICHT
// Datenquelle: Blatt "Urlaubskonto"
// ==========================================================

let adminMitarbeiterUebersichtNeu = [];

function installiereAdminMitarbeiterPanelNeu() {
  const ansicht =
    document.getElementById(
      'adminAnsicht'
    );

  if (
    !ansicht ||
    document.getElementById(
      'adminMitarbeiterPanelNeu'
    )
  ) {
    return;
  }

  const panel =
    document.createElement(
      'div'
    );

  panel.id =
    'adminMitarbeiterPanelNeu';

  panel.className =
    'panel';

  panel.style.marginBottom =
    '18px';

  panel.style.display =
    'none';

  panel.innerHTML = `
    <div
      style="
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
        flex-wrap:wrap;
      "
    >
      <div>
        <h2 style="margin:0 0 8px;">
          👥 Mitarbeiterübersicht
        </h2>

        <p style="margin:0;color:#666;">
          Urlaubskonto aller Mitarbeiter auf einen Blick.
        </p>
      </div>

      <button
        type="button"
        onclick="ladeAdminMitarbeiterUebersichtNeu()"
        style="
          border:1px solid #d7dce1;
          background:#fff;
          border-radius:9px;
          padding:10px 14px;
          cursor:pointer;
        "
      >
        ↻ Aktualisieren
      </button>
    </div>

    <div
      id="adminMitarbeiterListeNeu"
      style="margin-top:18px;"
    >
      <div class="empty-state">
        Mitarbeiter werden geladen …
      </div>
    </div>
  `;

  const header =
    ansicht.querySelector(
      '.content-header'
    );

  if (
    header &&
    header.nextSibling
  ) {
    ansicht.insertBefore(
      panel,
      header.nextSibling
    );
  } else {
    ansicht.appendChild(
      panel
    );
  }
}


function formatiereUrlaubstageNeu(
  wert
) {
  const zahl =
    Number(
      wert || 0
    );

  if (!Number.isFinite(zahl)) {
    return '0';
  }

  return Number.isInteger(zahl)
    ? String(zahl)
    : String(zahl)
        .replace('.', ',');
}


function rendereAdminMitarbeiterUebersichtNeu() {
  const liste =
    document.getElementById(
      'adminMitarbeiterListeNeu'
    );

  if (!liste) {
    return;
  }

  const daten =
    Array.isArray(
      adminMitarbeiterUebersichtNeu
    )
      ? adminMitarbeiterUebersichtNeu
      : [];

  if (!daten.length) {
    liste.innerHTML =
      '<div class="empty-state">Keine Mitarbeiter im Urlaubskonto gefunden.</div>';
    return;
  }

  liste.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;">' +
    daten.map(
      function(eintrag) {

        const verfuegbar =
          Number(
            eintrag.verfuegbar || 0
          );

        const statusFarbe =
          verfuegbar <= 5
            ? '#b00020'
            : (
                verfuegbar <= 10
                  ? '#8a5a00'
                  : '#176b3a'
              );

        const statusBg =
          verfuegbar <= 5
            ? '#fdecec'
            : (
                verfuegbar <= 10
                  ? '#fff4d6'
                  : '#e8f6ee'
              );

        return `
          <div
            style="
              border:1px solid #dfe3e8;
              border-radius:14px;
              padding:17px;
              background:#fff;
            "
          >
            <div
              style="
                font-size:18px;
                font-weight:800;
                margin-bottom:14px;
              "
            >
              👤 ${escapeHtmlNeu(
                eintrag.name
              )}
            </div>

            <div
              style="
                display:grid;
                grid-template-columns:1fr auto;
                gap:9px 14px;
                align-items:center;
                font-size:14px;
              "
            >
              <span>🏖️ Urlaubsanspruch / Resturlaub</span>
              <strong>
                ${formatiereUrlaubstageNeu(
                  eintrag.resturlaub
                )} Tage
              </strong>

              <span>📅 Aliquoter Resturlaub</span>
              <strong>
                ${formatiereUrlaubstageNeu(
                  eintrag.aliquoterResturlaub
                )} Tage
              </strong>

              <span>✅ Genommen</span>
              <strong>
                ${formatiereUrlaubstageNeu(
                  eintrag.genommen
                )} Tage
              </strong>
            </div>

            <div
              style="
                margin-top:15px;
                padding:11px 13px;
                border-radius:10px;
                background:${statusBg};
                color:${statusFarbe};
                font-weight:800;
                display:flex;
                justify-content:space-between;
                gap:12px;
              "
            >
              <span>Verfügbar</span>
              <span>
                ${formatiereUrlaubstageNeu(
                  eintrag.verfuegbar
                )} Tage
              </span>
            </div>
          </div>
        `;
      }
    ).join('') +
    '</div>';
}


async function ladeAdminMitarbeiterUebersichtNeu() {
  installiereAdminMitarbeiterPanelNeu();

  const liste =
    document.getElementById(
      'adminMitarbeiterListeNeu'
    );

  if (!liste) {
    return;
  }

  if (!aktuellerAdmin) {
    liste.innerHTML =
      '<div class="empty-state">Keine Admin-Berechtigung.</div>';
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    return;
  }

  liste.innerHTML =
    '<div class="empty-state">Mitarbeiter werden geladen …</div>';

  try {
    const result =
      await apiPost(
        'adminMitarbeiterUebersicht',
        {
          token: token
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();
      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Mitarbeiterübersicht konnte nicht geladen werden.'
      );
    }

    adminMitarbeiterUebersichtNeu =
      Array.isArray(
        result.mitarbeiter
      )
        ? result.mitarbeiter
        : [];

    rendereAdminMitarbeiterUebersichtNeu();

  } catch (error) {
    liste.innerHTML = `
      <div
        class="empty-state"
        style="color:#b00020;"
      >
        ❌ ${escapeHtmlNeu(
          error.message
        )}
      </div>
    `;
  }
}


function setzeAdminMitarbeiterPanelSichtbarkeitNeu() {
  const ansicht =
    document.getElementById(
      'adminAnsicht'
    );

  if (!ansicht) {
    return;
  }

  installiereAdminMitarbeiterPanelNeu();
  installiereAdminGesamtplanPanelNeu();

  Array.from(
    ansicht.querySelectorAll(
      ':scope > .panel'
    )
  ).forEach(
    function(panel) {
      panel.style.display =
        panel.id ===
        'adminMitarbeiterPanelNeu'
          ? ''
          : 'none';
    }
  );
}


async function zeigeAdminMitarbeiterSeiteNeu() {
  if (
    typeof zeigeSeite ===
    'function'
  ) {
    await zeigeSeite(
      'admin'
    );
  }

  setzeAdminMitarbeiterPanelSichtbarkeitNeu();

  await ladeAdminMitarbeiterUebersichtNeu();

  const titel =
    document.getElementById(
      'mobileSeitentitel'
    );

  if (titel) {
    titel.textContent =
      'Mitarbeiterübersicht';
  }

  schliesseNavigationNeu();
}


// ==========================================================
// MEIN URLAUBSKONTO
// Persönliche Anzeige – jeder sieht nur seine eigenen Werte.
// ==========================================================

async function ladeMeinUrlaubskontoNeu() {
  const box =
    document.getElementById(
      'meinUrlaubskontoNeu'
    );

  if (!box) {
    return;
  }

  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    return;
  }

  box.innerHTML =
    '<div class="empty-state">Urlaubskonto wird geladen …</div>';

  try {
    const result =
      await apiPost(
        'meinUrlaubskonto',
        {
          token: token
        }
      );

    if (
      result &&
      result.sessionExpired
    ) {
      await sessionAbgelaufenNeu();
      return;
    }

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'Urlaubskonto konnte nicht geladen werden.'
      );
    }

    rendereMeinUrlaubskontoNeu(
      result.urlaubskonto,
      result.jahr
    );

  } catch (error) {
    box.innerHTML = `
      <div
        class="empty-state"
        style="color:#b00020;"
      >
        ❌ ${escapeHtmlNeu(
          error.message
        )}
      </div>
    `;
  }
}


function rendereMeinUrlaubskontoNeu(
  konto,
  jahr
) {
  const box =
    document.getElementById(
      'meinUrlaubskontoNeu'
    );

  if (
    !box ||
    !konto
  ) {
    return;
  }

  const fmt =
    function(wert) {
      const zahl =
        Number(
          wert || 0
        );

      if (!Number.isFinite(zahl)) {
        return '0';
      }

      return Number.isInteger(zahl)
        ? String(zahl)
        : String(zahl).replace('.', ',');
    };

  const verfuegbar =
    Number(
      konto.verfuegbar || 0
    );

  const statusBg =
    verfuegbar <= 5
      ? '#fdecec'
      : (
          verfuegbar <= 10
            ? '#fff4d6'
            : '#e8f6ee'
        );

  const statusFarbe =
    verfuegbar <= 5
      ? '#b00020'
      : (
          verfuegbar <= 10
            ? '#8a5a00'
            : '#176b3a'
        );

  box.innerHTML = `
    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:16px;
      "
    >
      <div>
        <h2 style="margin:0 0 5px;">
          🏖️ Mein Urlaubskonto
        </h2>

        <div style="color:#666;font-size:13px;">
          ${
            jahr
              ? 'Planjahr ' +
                escapeHtmlNeu(
                  String(jahr)
                )
              : ''
          }
        </div>
      </div>

      <button
        type="button"
        onclick="ladeMeinUrlaubskontoNeu()"
        style="
          border:1px solid #d7dce1;
          background:#fff;
          border-radius:8px;
          padding:8px 12px;
          cursor:pointer;
        "
      >
        ↻ Aktualisieren
      </button>
    </div>

    <div
      style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(145px,1fr));
        gap:10px;
      "
    >
      <div
        style="
          border:1px solid #e0e4e8;
          border-radius:10px;
          padding:12px;
        "
      >
        <div style="color:#666;font-size:12px;">
          Urlaubsanspruch / Resturlaub
        </div>
        <strong style="display:block;margin-top:5px;font-size:18px;">
          ${fmt(konto.resturlaub)} Tage
        </strong>
      </div>

      <div
        style="
          border:1px solid #e0e4e8;
          border-radius:10px;
          padding:12px;
        "
      >
        <div style="color:#666;font-size:12px;">
          Aliquoter Resturlaub
        </div>
        <strong style="display:block;margin-top:5px;font-size:18px;">
          ${fmt(konto.aliquoterResturlaub)} Tage
        </strong>
      </div>

      <div
        style="
          border:1px solid #e0e4e8;
          border-radius:10px;
          padding:12px;
        "
      >
        <div style="color:#666;font-size:12px;">
          Genommen
        </div>
        <strong style="display:block;margin-top:5px;font-size:18px;">
          ${fmt(konto.genommen)} Tage
        </strong>
      </div>

      <div
        style="
          border-radius:10px;
          padding:12px;
          background:${statusBg};
          color:${statusFarbe};
        "
      >
        <div style="font-size:12px;">
          Noch verfügbar
        </div>
        <strong style="display:block;margin-top:5px;font-size:18px;">
          ${fmt(konto.verfuegbar)} Tage
        </strong>
      </div>
    </div>
  `;
}
