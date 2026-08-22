const API_URL =
  'https://script.google.com/macros/s/AKfycbxL-vdBIT5xLORL2k8xdNJXC4bRWt97X-QcvWQ5_bB1xXz083yntxCwimdaiqkoPMKBbg/exec';

const SESSION_KEY =
  'scs_team_session';

let aktuellerBenutzer =
  '';

let aktuellerAdmin =
  false;

let letzterDienstplan =
  [];

let letzteAbwesenheiten =
  [];

let aktuelleKwNeu =
  1;

let dienstplanInitialisiert =
  false;

let tauschDatum =
  '';

let tauschTag =
  '';

let tauschKw =
  '';

let tauschDienstCode =
  '';

let tauschDienstText =
  '';

let tauschZeit =
  '';


// ==========================================================
// API
// ==========================================================

async function apiPost(
  action,
  daten = {}
) {
  const response =
    await fetch(
      API_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'text/plain;charset=utf-8'
        },

        body:
          JSON.stringify({
            action:
              action,
            ...daten
          }),

        redirect:
          'follow',

        cache:
          'no-store'
      }
    );

  const text =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      'HTTP ' +
      response.status +
      ': ' +
      text.substring(
        0,
        300
      )
    );
  }

  try {
    return JSON.parse(
      text
    );

  } catch (error) {
    throw new Error(
      'Server hat kein gültiges JSON zurückgegeben: ' +
      text.substring(
        0,
        300
      )
    );
  }
}


// ==========================================================
// START
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
            token:
              token
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
    login.style.display =
      'flex';
  }

  if (app) {
    app.style.display =
      'none';
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

  select.disabled =
    true;

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

        option.value =
          name;

        option.textContent =
          name;

        select.appendChild(
          option
        );
      }
    );

    select.disabled =
      false;

    if (
      mitarbeiter.length === 0
    ) {
      zeigeLoginMeldung(
        'Es wurden keine aktiven Mitarbeiter gefunden.',
        'fehler'
      );
    }

  } catch (error) {
    console.error(
      error
    );

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
    !/^\d{4}$/.test(
      pin
    )
  ) {
    zeigeLoginMeldung(
      'Bitte gib deinen 4-stelligen PIN ein.',
      'fehler'
    );

    pinElement?.focus();

    return;
  }

  if (button) {
    button.disabled =
      true;

    button.textContent =
      'Anmeldung läuft …';
  }

  try {
    const result =
      await apiPost(
        'login',
        {
          name:
            name,

          pin:
            pin
        }
      );

    /*
      Wenn Babsi den PIN-Reset genehmigt hat,
      ist der alte PIN gelöscht.

      Das Backend meldet dann pinFehlt=true.
      In diesem Fall darf der Mitarbeiter
      direkt einen neuen PIN festlegen.
    */
    if (
      result &&
      result.pinFehlt === true
    ) {
      if (pinElement) {
        pinElement.value =
          '';
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
      result.name ||
      name;

    aktuellerAdmin =
      result.admin === true;

    dienstplanInitialisiert =
      false;

    if (pinElement) {
      pinElement.value =
        '';
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
    console.error(
      error
    );

    zeigeLoginMeldung(
      'Serverfehler: ' +
      error.message,
      'fehler'
    );

  } finally {
    if (button) {
      button.disabled =
        false;

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
          name:
            name
        }
      );

    /*
      Der PIN wurde bereits von Babsi gelöscht.
      Mitarbeiter darf direkt einen neuen setzen.
    */
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

    /*
      Sonderfall Babsi:
      Sie kann ihren eigenen Reset nicht
      selbst im Admin-Bereich genehmigen.
    */
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
// PIN-FESTLEGEN-DIALOG ANZEIGEN
// ==========================================================

function zeigePinFestlegenDialogNeu(
  name,
  info
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

  const infoElement =
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
      name || '';
  }

  if (infoElement) {
    infoElement.textContent =
      info ||
      'Bitte lege deinen neuen 4-stelligen PIN fest.';
  }

  if (pin1) {
    pin1.value =
      '';
  }

  if (pin2) {
    pin2.value =
      '';
  }

  if (meldung) {
    meldung.textContent =
      '';
  }

  if (overlay) {
    overlay.style.display =
      'flex';
  }

  setTimeout(
    function() {
      pin1?.focus();
    },
    100
  );
}


// ==========================================================
// PIN-FESTLEGEN-DIALOG SCHLIESSEN
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
    !/^\d{4}$/.test(
      pin1
    )
  ) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Der neue PIN muss genau aus 4 Ziffern bestehen.';
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

  if (!name) {
    if (meldung) {
      meldung.style.color =
        '#b00020';

      meldung.textContent =
        'Mitarbeiter konnte nicht bestimmt werden.';
    }

    return;
  }

  if (button) {
    button.disabled =
      true;

    button.textContent =
      'PIN wird gespeichert …';
  }

  try {
    const result =
      await apiPost(
        'pinFestlegen',
        {
          name:
            name,

          pin1:
            pin1,

          pin2:
            pin2
        }
      );

    if (
      !result ||
      !result.ok
    ) {
      throw new Error(
        result?.message ||
        'PIN konnte nicht gespeichert werden.'
      );
    }

    localStorage.setItem(
      SESSION_KEY,
      result.token
    );

    aktuellerBenutzer =
      result.name ||
      name;

    aktuellerAdmin =
      result.admin === true;

    dienstplanInitialisiert =
      false;

    if (meldung) {
      meldung.style.color =
        '#14943b';

      meldung.textContent =
        '✅ Neuer PIN wurde gespeichert.';
    }

    setTimeout(
      function() {
        schliessePinFestlegenDialogNeu();

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
        }
      },
      500
    );

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
      button.disabled =
        false;

      button.textContent =
        '🔐 Neuen PIN speichern';
    }
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

  const profilName =
    document.getElementById(
      'profilNameAnzeige'
    );

  const adminNav =
    document.getElementById(
      'adminNav'
    );

  const adminTitel =
    document.getElementById(
      'adminTitel'
    );

  if (login) {
    login.style.display =
      'none';
  }

  if (app) {
    app.style.display =
      'flex';
  }

  if (profilName) {
    profilName.textContent =
      name ||
      'Mitarbeiter';
  }

  if (adminNav) {
    adminNav.style.display =
      admin
        ? 'flex'
        : 'none';
  }

  if (adminTitel) {
    adminTitel.style.display =
      admin
        ? 'block'
        : 'none';
  }
}


// ==========================================================
// DIENSTPLAN LADEN
// ==========================================================

async function ladeMeinDienstplanNeu() {
  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await logoutAusfuehren();

    return;
  }

  const laden =
    document.getElementById(
      'dienstplanLaden'
    );

  const liste =
    document.getElementById(
      'dienstplanListe'
    );

  const sollstundenElement =
    document.getElementById(
      'dienstplanSollstunden'
    );

  if (laden) {
    laden.style.display =
      'block';

    laden.textContent =
      'Dienstplan wird geladen …';
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

    zeigeHauptApp(
      aktuellerBenutzer,
      aktuellerAdmin
    );

    if (
      !dienstplanInitialisiert
    ) {
      aktuelleKwNeu =
        ermittleStartKwNeu(
          letzterDienstplan
        );

      dienstplanInitialisiert =
        true;
    }

    if (sollstundenElement) {
      const soll =
        Number(
          result.sollstunden || 0
        );

      sollstundenElement.textContent =
        soll
          .toFixed(1)
          .replace(
            '.',
            ','
          ) +
        ' Std.';
    }

    aktualisiereKwAnzeigeNeu();

    rendereDienstplan(
      letzterDienstplan
    );

    rendereAbwesenheiten(
      letzteAbwesenheiten
    );

    if (laden) {
      laden.style.display =
        'none';
    }

  } catch (error) {
    console.error(
      error
    );

    if (laden) {
      laden.style.display =
        'block';

      laden.textContent =
        'Fehler beim Laden: ' +
        error.message;
    }

    if (liste) {
      liste.innerHTML =
        '<div class="empty-state">Dienstplan konnte nicht geladen werden.</div>';
    }
  }
}


// ==========================================================
// START-KW
// ==========================================================

function ermittleStartKwNeu(
  plan
) {
  const kws =
    ermittleVerfuegbareKwsNeu(
      plan
    );

  if (
    !kws.length
  ) {
    return 1;
  }

  const heute =
    new Date();

  const heutigesDatum =
    String(
      heute.getDate()
    ).padStart(
      2,
      '0'
    ) +
    '.' +
    String(
      heute.getMonth() + 1
    ).padStart(
      2,
      '0'
    ) +
    '.' +
    heute.getFullYear();

  const heuteEintrag =
    (plan || []).find(
      function(z) {
        return String(
          z.datum || ''
        ) ===
          heutigesDatum;
      }
    );

  if (
    heuteEintrag &&
    Number(
      heuteEintrag.kw
    )
  ) {
    return Number(
      heuteEintrag.kw
    );
  }

  return kws[0];
}


// ==========================================================
// VERFÜGBARE KW
// ==========================================================

function ermittleVerfuegbareKwsNeu(
  plan
) {
  return Array.from(
    new Set(
      (plan || [])
        .map(
          function(z) {
            return Number(
              z.kw || 0
            );
          }
        )
        .filter(
          function(kw) {
            return (
              Number.isFinite(
                kw
              ) &&
              kw > 0
            );
          }
        )
    )
  ).sort(
    function(a, b) {
      return a - b;
    }
  );
}


// ==========================================================
// WOCHE WECHSELN
// ==========================================================

function wechselWoche(
  richtung
) {
  const kws =
    ermittleVerfuegbareKwsNeu(
      letzterDienstplan
    );

  if (
    !kws.length
  ) {
    aktuelleKwNeu =
      Math.max(
        1,
        aktuelleKwNeu +
        Number(
          richtung || 0
        )
      );

  } else {
    let index =
      kws.indexOf(
        Number(
          aktuelleKwNeu
        )
      );

    if (
      index < 0
    ) {
      index =
        0;
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
      index =
        0;
    }

    aktuelleKwNeu =
      kws[index];
  }

  aktualisiereKwAnzeigeNeu();

  rendereDienstplan(
    letzterDienstplan
  );
}


// ==========================================================
// KW ANZEIGE
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
        Für KW ${escapeHtmlNeu(aktuelleKwNeu)}
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
        In KW ${escapeHtmlNeu(aktuelleKwNeu)}
        hast du keine eingetragenen Dienste.
      </div>
    `;

    return;
  }

  let html =
    '';

  relevanteTage.forEach(
    function(z) {
      const dienste =
        [];

      // ------------------------------------------------------
      // GARDEN PLAZA FRÜH
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
      // GARDEN PLAZA SPÄT
      // ------------------------------------------------------

      if (
        z.gpSpaet
      ) {
        let zusatz =
          '';

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
      // GP PAUSENABLÖSE
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
      // WP PAUSENABLÖSE
      // Nur separat anzeigen, wenn kein GP Spät vorhanden ist.
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
      // TAG-KARTE
      // ------------------------------------------------------

      html += `
        <div
          class="scs-tag-karte"
          style="
            background:#ffffff;
            border:1px solid #dfe3e8;
            border-left:1px solid #dfe3e8;
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
              ${escapeHtmlNeu(z.tag || '')},
              ${escapeHtmlNeu(z.datum || '')}
            </strong>
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

          else if (
            dienst.klasse ===
            'water'
          ) {
            randfarbe =
              '#1754d1';

            hintergrund =
              '#f5f8ff';
          }

          else if (
            dienst.klasse ===
            'abloese'
          ) {
            randfarbe =
              '#d99032';

            hintergrund =
              '#fffaf3';
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
              data-plaza="${escapeHtmlNeu(dienst.klasse)}"
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
                    ${escapeHtmlNeu(dienst.symbol)}
                    ${escapeHtmlNeu(dienst.name)}
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
                          🕒 ${escapeHtmlNeu(dienst.zeit)}
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
                          ☕ ${escapeHtmlNeu(dienst.zusatz)}
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
            📝 ${escapeHtmlNeu(z.notiz)}
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
  const ergebnis =
    [];

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

      // ------------------------------------------------------
      // GARDEN PLAZA FRÜH
      // ------------------------------------------------------

      if (z.gpFrueh) {
        ergebnis.push({
          datum:
            datum,

          tag:
            tag,

          kw:
            kw,

          code:
            'GP_FRUEH',

          text:
            'Garden Plaza – Früh',

          zeit:
            zeitFruehNeu(
              z.tag
            )
        });
      }

      // ------------------------------------------------------
      // GARDEN PLAZA SPÄT
      // ------------------------------------------------------

      if (z.gpSpaet) {
        ergebnis.push({
          datum:
            datum,

          tag:
            tag,

          kw:
            kw,

          code:
            'GP_SPAET',

          text:
            'Garden Plaza – Spät',

          zeit:
            zeitSpaetNeu(
              z.tag
            )
        });
      }

      // ------------------------------------------------------
      // WATER PLAZA GANZTAG
      // ------------------------------------------------------

      if (
        z.wpFrueh &&
        z.wpSpaet
      ) {
        ergebnis.push({
          datum:
            datum,

          tag:
            tag,

          kw:
            kw,

          code:
            'WP_GANZTAG',

          text:
            'Water Plaza – Ganztag',

          zeit:
            '09:00 – ' +
            zeitSpaetEndeNeu(
              z.tag
            )
        });

        return;
      }

      // ------------------------------------------------------
      // WATER PLAZA FRÜH
      // ------------------------------------------------------

      if (z.wpFrueh) {
        ergebnis.push({
          datum:
            datum,

          tag:
            tag,

          kw:
            kw,

          code:
            'WP_FRUEH',

          text:
            'Water Plaza – Früh',

          zeit:
            zeitFruehNeu(
              z.tag
            )
        });
      }

      // ------------------------------------------------------
      // WATER PLAZA SPÄT
      // ------------------------------------------------------

      if (z.wpSpaet) {
        ergebnis.push({
          datum:
            datum,

          tag:
            tag,

          kw:
            kw,

          code:
            'WP_SPAET',

          text:
            'Water Plaza – Spät',

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

  const tage =
    [];

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
    tauschDatum =
      '';

    tauschTag =
      '';

    tauschKw =
      '';

    tauschDienstCode =
      '';

    tauschDienstText =
      '';

    tauschZeit =
      '';

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
// TAUSCHTAG MIT PFEIL WECHSELN
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
    index =
      0;
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
    index =
      0;
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
  // PFEILE INSTALLIEREN
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

  // --------------------------------------------------------
  // KEINE TAUSCHBAREN DIENSTE
  // --------------------------------------------------------

  const eigeneDienste =
    ansicht.querySelector(
      '.eigene-dienste'
    );

  const dienstAuswahl =
    ansicht.querySelector(
      '.dienst-auswahl'
    );

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

    return;
  }

  // --------------------------------------------------------
  // DIENST SICHERSTELLEN
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
    let html =
      '';

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

  bereich.classList.remove(
    'versteckt'
  );

  bereich.innerHTML = `
    <h2>
      3. Kollegen wählen
    </h2>

    <p class="beschreibung">
      Echte Dienste für
      ${escapeHtmlNeu(tauschDatum)}
      werden geladen …
    </p>
  `;

  bereich.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  try {
    const token =
      localStorage.getItem(
        SESSION_KEY
      );

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

    kandidaten =
      kombiniereWpGanztagKandidaten(
        kandidaten
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
          return String(
            k.schicht || ''
          )
            .toLowerCase() ===
            'früh';
        }
      );

    const spaet =
      kandidaten.filter(
        function(k) {
          return String(
            k.schicht || ''
          )
            .toLowerCase() ===
            'spät';
        }
      );

    const ganz =
      kandidaten.filter(
        function(k) {
          return String(
            k.schicht || ''
          )
            .toLowerCase() ===
            'ganztag';
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
            color:#fff;
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
        ❌ ${escapeHtmlNeu(error.message)}
      </p>
    `;
  }
}


// ==========================================================
// WP FRÜH + SPÄT BEI GLEICHER PERSON = GANZTAG
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
                !benutzt.has(i) &&
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
    <div class="kollegen-box ${escapeHtmlNeu(klasse)}">

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
            value="${escapeHtmlNeu(code)}"
            data-name="${escapeHtmlNeu(k.mitarbeiter || '')}"
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
            ${escapeHtmlNeu(k.mitarbeiter || '')}
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
        ${escapeHtmlNeu(tauschDienstText)}
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
        ${escapeHtmlNeu(partnerName)}
        –
        ${escapeHtmlNeu(partnerDienst)}
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
        )
      ]);

    const tauschResult =
      ergebnisse[0];

    const dienstResult =
      ergebnisse[1];

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

    rendereErhalteneTauschAnfragenNeu(
      erhalten
    );

    rendereGesendeteTauschAnfragenNeu(
      gesendet
    );

    rendereMeineDienstAnfragenNeu(
      dienstAnfragen
    );

    aktualisiereAnfragenBadgeNeu(
      erhalten
    );

  } catch (error) {
    console.error(
      'Meine Anfragen:',
      error
    );

    const fehlerHtml = `
      <div
        class="empty-state"
        style="color:#b00020;"
      >
        ❌ ${escapeHtmlNeu(error.message)}
      </div>
    `;

    if (erhaltenListe) {
      erhaltenListe.innerHTML =
        fehlerHtml;
    }

    if (gesendetListe) {
      gesendetListe.innerHTML =
        fehlerHtml;
    }

    if (dienstListe) {
      dienstListe.innerHTML =
        fehlerHtml;
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

  if (
    !anfragen ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Aktuell gibt es keine Tauschanfragen an dich.
      </div>
    `;

    return;
  }

  let html =
    '';

  anfragen.forEach(
    function(a) {
      const mitarbeiterStatus =
        String(
          a.mitarbeiterStatus || ''
        )
          .trim()
          .toUpperCase();

      const gesamtstatus =
        String(
          a.gesamtstatus || ''
        )
          .trim()
          .toUpperCase();

      const istOffen =
        mitarbeiterStatus ===
          'OFFEN' &&
        gesamtstatus ===
          'WARTET_AUF_KOLLEGEN';

      const statusText =
        statusTextTauschNeu(
          a
        );

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:15px;
            margin-bottom:12px;
            background:#fff;
          "
        >
          <strong
            style="
              display:block;
              font-size:16px;
            "
          >
            ${escapeHtmlNeu(a.anfragender || '')}
            möchte mit dir tauschen
          </strong>

          <div
            style="
              margin-top:5px;
              color:#666;
            "
          >
            📅 ${escapeHtmlNeu(a.datum || '')}
            · KW ${escapeHtmlNeu(a.kw || '')}
          </div>

          <div
            style="
              margin-top:12px;
              padding:11px;
              background:#f7f8f9;
              border-radius:8px;
            "
          >
            <div
              style="
                color:#666;
                font-size:13px;
              "
            >
              Du gibst:
            </div>

            <strong>
              ${escapeHtmlNeu(
                entferneDienstSymbol(
                  a.partnerDienst || ''
                )
              )}
            </strong>

            <div
              style="
                margin:8px 0;
                color:#999;
              "
            >
              ↕
            </div>

            <div
              style="
                color:#666;
                font-size:13px;
              "
            >
              Du bekommst:
            </div>

            <strong>
              ${escapeHtmlNeu(
                entferneDienstSymbol(
                  a.eigenerDienst || ''
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
                  "
                >
                  💬 ${escapeHtmlNeu(a.nachricht)}
                </div>
              `
              : ''
          }

          <div
            style="
              margin-top:11px;
            "
          >
            <strong>
              ${escapeHtmlNeu(statusText)}
            </strong>
          </div>

          ${
            istOffen
              ? `
                <div
                  style="
                    display:flex;
                    gap:10px;
                    flex-wrap:wrap;
                    margin-top:14px;
                  "
                >
                  <button
                    type="button"
                    onclick="bearbeiteErhalteneTauschAnfrageNeu(${Number(a.zeile)}, true)"
                    style="
                      border:0;
                      background:#14943b;
                      color:#fff;
                      border-radius:8px;
                      padding:9px 14px;
                      font-weight:700;
                      cursor:pointer;
                    "
                  >
                    ✅ Tausch annehmen
                  </button>

                  <button
                    type="button"
                    onclick="bearbeiteErhalteneTauschAnfrageNeu(${Number(a.zeile)}, false)"
                    style="
                      border:1px solid #c9cdd2;
                      background:#fff;
                      color:#b00020;
                      border-radius:8px;
                      padding:9px 14px;
                      font-weight:700;
                      cursor:pointer;
                    "
                  >
                    ❌ Ablehnen
                  </button>
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
    !anfragen ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Du hast noch keine Tauschanfragen gesendet.
      </div>
    `;

    return;
  }

  let html =
    '';

  anfragen.forEach(
    function(a) {
      const statusText =
        statusTextTauschNeu(
          a
        );

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:15px;
            margin-bottom:12px;
            background:#fff;
          "
        >
          <strong
            style="
              display:block;
              font-size:16px;
            "
          >
            Tausch mit
            ${escapeHtmlNeu(a.partner || '')}
          </strong>

          <div
            style="
              margin-top:5px;
              color:#666;
            "
          >
            📅 ${escapeHtmlNeu(a.datum || '')}
            · KW ${escapeHtmlNeu(a.kw || '')}
          </div>

          <div
            style="
              margin-top:11px;
            "
          >
            ${escapeHtmlNeu(
              entferneDienstSymbol(
                a.eigenerDienst || ''
              )
            )}

            ↔

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
                    margin-top:8px;
                    color:#555;
                  "
                >
                  💬 ${escapeHtmlNeu(a.nachricht)}
                </div>
              `
              : ''
          }

          <div
            style="
              margin-top:10px;
              font-weight:700;
            "
          >
            ${escapeHtmlNeu(statusText)}
          </div>
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// TAUSCHSTATUS ALS TEXT
// ==========================================================

function statusTextTauschNeu(
  anfrage
) {
  const gesamtstatus =
    String(
      anfrage?.gesamtstatus || ''
    )
      .trim()
      .toUpperCase();

  const mitarbeiterStatus =
    String(
      anfrage?.mitarbeiterStatus || ''
    )
      .trim()
      .toUpperCase();

  const adminStatus =
    String(
      anfrage?.adminStatus || ''
    )
      .trim()
      .toUpperCase();

  if (
    gesamtstatus ===
    'GENEHMIGT'
  ) {
    return '✅ Genehmigt';
  }

  if (
    gesamtstatus ===
    'ABGELEHNT'
  ) {
    return '❌ Abgelehnt';
  }

  if (
    gesamtstatus ===
    'WARTET_AUF_ADMIN'
  ) {
    return '🟡 Wartet auf Babsi';
  }

  if (
    gesamtstatus ===
    'WARTET_AUF_KOLLEGEN'
  ) {
    return '🟡 Wartet auf Kollegen';
  }

  if (
    mitarbeiterStatus ===
      'ZUGESTIMMT' &&
    adminStatus ===
      'OFFEN'
  ) {
    return '🟡 Wartet auf Babsi';
  }

  if (
    mitarbeiterStatus ===
    'ABGELEHNT'
  ) {
    return '❌ Abgelehnt';
  }

  return '🟡 Offen';
}


// ==========================================================
// ERHALTENE TAUSCHANFRAGE BEARBEITEN
// ==========================================================

async function bearbeiteErhalteneTauschAnfrageNeu(
  zeile,
  genehmigen
) {
  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!token) {
    await sessionAbgelaufenNeu();

    return;
  }

  const frage =
    genehmigen
      ? 'Möchtest du diesem Diensttausch zustimmen?'
      : 'Möchtest du diese Tauschanfrage wirklich ablehnen?';

  if (
    !window.confirm(
      frage
    )
  ) {
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
      error
    );

    window.alert(
      'Fehler: ' +
      error.message
    );
  }
}


// ==========================================================
// SONSTIGE WÜNSCHE – EIGENE ANZEIGE
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
    !anfragen ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Du hast aktuell keine sonstigen Wünsche.
      </div>
    `;

    return;
  }

  let html =
    '';

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

      if (
        status ===
        'GENEHMIGT'
      ) {
        statusText =
          '✅ Genehmigt';
      }

      else if (
        status ===
        'ABGELEHNT'
      ) {
        statusText =
          '❌ Abgelehnt';
      }

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:11px;
            padding:15px;
            margin-bottom:12px;
            background:#fff;
          "
        >
          <strong
            style="
              display:block;
              font-size:16px;
            "
          >
            ${escapeHtmlNeu(
              a.art ||
              'Sonstiger Wunsch'
            )}
          </strong>

          ${
            a.datum
              ? `
                <div
                  style="
                    margin-top:5px;
                    color:#666;
                  "
                >
                  📅 ${escapeHtmlNeu(a.datum)}

                  ${
                    a.kw
                      ? ' · KW ' +
                        escapeHtmlNeu(a.kw)
                      : ''
                  }
                </div>
              `
              : ''
          }

          ${
            a.dienst
              ? `
                <div
                  style="
                    margin-top:10px;
                    font-weight:700;
                  "
                >
                  ${escapeHtmlNeu(
                    entferneDienstSymbol(
                      a.dienst
                    )
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
                    margin-top:8px;
                    color:#555;
                    white-space:pre-wrap;
                  "
                >
                  💬 ${escapeHtmlNeu(a.nachricht)}
                </div>
              `
              : ''
          }

          <div
            style="
              margin-top:10px;
              font-weight:700;
            "
          >
            ${statusText}
          </div>
        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
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
    (erhalten || []).filter(
      function(a) {
        return (
          String(
            a.mitarbeiterStatus || ''
          )
            .trim()
            .toUpperCase() ===
            'OFFEN' &&

          String(
            a.gesamtstatus || ''
          )
            .trim()
            .toUpperCase() ===
            'WARTET_AUF_KOLLEGEN'
        );
      }
    ).length;

  badge.textContent =
    String(
      anzahl
    );

  badge.style.display =
    anzahl > 0
      ? 'inline-flex'
      : 'none';
}


// ==========================================================
// ABWESENHEITEN – ANSICHT
// ==========================================================

function installiereAbwesenheitenAnsichtNeu() {
  if (
    document.getElementById(
      'abwesenheitenAnsicht'
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
            background:#fff;
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
        'Abwesenheiten konnten nicht geladen werden.'
      );
    }

    letzteAbwesenheiten =
      Array.isArray(
        result.abwesenheiten
      )
        ? result.abwesenheiten
        : [];

    rendereAbwesenheiten(
      letzteAbwesenheiten
    );

  } catch (error) {
    console.error(
      error
    );

    if (liste) {
      liste.innerHTML = `
        <div
          class="empty-state"
          style="color:#b00020;"
        >
          ❌ ${escapeHtmlNeu(error.message)}
        </div>
      `;
    }
  }
}


// ==========================================================
// ABWESENHEITEN RENDERN
// ==========================================================

function rendereAbwesenheiten(
  abwesenheiten
) {
  const listen =
    [
      document.getElementById(
        'abwesenheitenListe'
      ),

      document.getElementById(
        'abwesenheitenListeNeu'
      )
    ].filter(
      function(element) {
        return !!element;
      }
    );

  if (
    listen.length === 0
  ) {
    return;
  }

  if (
    !abwesenheiten ||
    abwesenheiten.length === 0
  ) {
    listen.forEach(
      function(liste) {
        liste.innerHTML = `
          <div class="empty-state">
            Keine Abwesenheiten vorhanden.
          </div>
        `;
      }
    );

    return;
  }

  let html =
    '';

  abwesenheiten.forEach(
    function(a) {
      const status =
        String(
          a.status ||
          'Abwesenheit'
        ).trim();

      html += `
        <div
          style="
            border:1px solid #dde1e5;
            border-radius:10px;
            padding:14px;
            margin-bottom:11px;
            background:#fff;
          "
        >
          <strong
            style="
              display:block;
              font-size:16px;
            "
          >
            📌 ${escapeHtmlNeu(status)}
          </strong>

          <div
            style="
              margin-top:6px;
              color:#666;
            "
          >
            ${escapeHtmlNeu(a.von || '')}

            ${
              a.bis
                ? ' – ' +
                  escapeHtmlNeu(
                    a.bis
                  )
                : ''
            }
          </div>
        </div>
      `;
    }
  );

  listen.forEach(
    function(liste) {
      liste.innerHTML =
        html;
    }
  );
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
        max-width:650px;
        margin-left:auto;
        margin-right:auto;
      "
    >
      <h2 style="margin-top:0;">
        🔐 PIN ändern
      </h2>

      <label
        for="alterPinNeu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:6px;
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
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:11px 12px;
          margin-bottom:16px;
        "
      >

      <label
        for="neuerPin1Neu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:6px;
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
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:11px 12px;
          margin-bottom:16px;
        "
      >

      <label
        for="neuerPin2Neu"
        style="
          display:block;
          font-weight:700;
          margin-bottom:6px;
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
        style="
          width:100%;
          box-sizing:border-box;
          border:1px solid #d7dce1;
          border-radius:9px;
          padding:11px 12px;
          margin-bottom:18px;
        "
      >

      <button
        id="pinAendernButtonNeu"
        type="button"
        onclick="aenderePinNeu()"
        style="
          border:0;
          background:#e30613;
          color:#fff;
          border-radius:9px;
          padding:11px 16px;
          font-weight:700;
          cursor:pointer;
        "
      >
        🔐 PIN ändern
      </button>

      <div
        id="pinMeldungNeu"
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
  const alterPin =
    String(
      document
        .getElementById(
          'alterPinNeu'
        )
        ?.value || ''
    ).trim();

  const neuerPin1 =
    String(
      document
        .getElementById(
          'neuerPin1Neu'
        )
        ?.value || ''
    ).trim();

  const neuerPin2 =
    String(
      document
        .getElementById(
          'neuerPin2Neu'
        )
        ?.value || ''
    ).trim();

  if (
    !/^\d{4}$/.test(
      alterPin
    )
  ) {
    zeigePinMeldungNeu(
      'Bitte gib deinen aktuellen 4-stelligen PIN ein.',
      false
    );

    return;
  }

  if (
    !/^\d{4}$/.test(
      neuerPin1
    )
  ) {
    zeigePinMeldungNeu(
      'Der neue PIN muss genau aus 4 Ziffern bestehen.',
      false
    );

    return;
  }

  if (
    neuerPin1 !==
    neuerPin2
  ) {
    zeigePinMeldungNeu(
      'Die beiden neuen PINs stimmen nicht überein.',
      false
    );

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

  const button =
    document.getElementById(
      'pinAendernButtonNeu'
    );

  if (button) {
    button.disabled =
      true;

    button.textContent =
      'PIN wird geändert …';
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
        'PIN konnte nicht geändert werden.'
      );
    }

    [
      'alterPinNeu',
      'neuerPin1Neu',
      'neuerPin2Neu'
    ].forEach(
      function(id) {
        const feld =
          document.getElementById(
            id
          );

        if (feld) {
          feld.value =
            '';
        }
      }
    );

    zeigePinMeldungNeu(
      '✅ ' +
      (
        result.message ||
        'PIN wurde erfolgreich geändert.'
      ),
      true
    );

  } catch (error) {
    zeigePinMeldungNeu(
      '❌ ' +
      error.message,
      false
    );

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
// PIN-MELDUNG
// ==========================================================

function zeigePinMeldungNeu(
  text,
  erfolgreich
) {
  const element =
    document.getElementById(
      'pinMeldungNeu'
    );

  if (!element) {
    return;
  }

  element.textContent =
    text || '';

  element.style.color =
    erfolgreich
      ? '#14943b'
      : '#b00020';
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
          Hier kannst du offene Anfragen bearbeiten.
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

  const pinListe =
    document.getElementById(
      'adminPinResetListe'
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

    if (pinListe) {
      pinListe.innerHTML =
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

  if (pinListe) {
    pinListe.innerHTML =
      '<div class="empty-state">PIN-Anfragen werden geladen …</div>';
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
          'adminPinResets',
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

    const pinResult =
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
      pinResult &&
      pinResult.sessionExpired
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
      !pinResult ||
      !pinResult.ok
    ) {
      throw new Error(
        pinResult?.message ||
        'PIN-Reset-Anfragen konnten nicht geladen werden.'
      );
    }

    const tauschAnfragen =
      Array.isArray(
        tauschResult.anfragen
      )
        ? tauschResult.anfragen
        : [];

    const dienstAnfragen =
      Array.isArray(
        dienstResult.anfragen
      )
        ? dienstResult.anfragen
        : [];

    const pinAnfragen =
      Array.isArray(
        pinResult.anfragen
      )
        ? pinResult.anfragen
        : [];

    rendereAdminTauschAnfragenNeu(
      tauschAnfragen
    );

    rendereAdminDienstAnfragenNeu(
      dienstAnfragen
    );

    rendereAdminPinResetsNeu(
      pinAnfragen
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
        ❌ ${escapeHtmlNeu(error.message)}
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

    if (pinListe) {
      pinListe.innerHTML =
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
    !anfragen ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine offenen Tauschanfragen.
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
            ${escapeHtmlNeu(a.anfragender || '')}
            ↔
            ${escapeHtmlNeu(a.partner || '')}
          </strong>

          <div
            style="
              margin-top:5px;
              color:#666;
            "
          >
            📅 ${escapeHtmlNeu(a.datum || '')}
            · KW ${escapeHtmlNeu(a.kw || '')}
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

            <span style="margin:0 7px;">
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
                  💬 ${escapeHtmlNeu(a.nachricht)}
                </div>
              `
              : ''
          }

          <div
            style="
              display:flex;
              gap:10px;
              flex-wrap:wrap;
              margin-top:14px;
            "
          >
            <button
              type="button"
              onclick="bearbeiteAdminTauschAnfrageNeu(${Number(a.zeile)}, true)"
              style="
                border:0;
                background:#14943b;
                color:#ffffff;
                border-radius:8px;
                padding:9px 14px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ✅ Genehmigen
            </button>

            <button
              type="button"
              onclick="bearbeiteAdminTauschAnfrageNeu(${Number(a.zeile)}, false)"
              style="
                border:1px solid #c9cdd2;
                background:#ffffff;
                color:#b00020;
                border-radius:8px;
                padding:9px 14px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ❌ Ablehnen
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
// ADMIN – TAUSCH BEARBEITEN
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
      error
    );

    window.alert(
      'Fehler: ' +
      error.message
    );
  }
}


// ==========================================================
// ADMIN – SONSTIGE WÜNSCHE
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

  let html =
    '';

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

      // ------------------------------------------------------
      // WOCHENTAG AUS DATUM ERMITTELN
      // ------------------------------------------------------

      let wochentag =
        '';

      if (
        /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(
          datum
        )
      ) {
        const teile =
          datum.split('.');

        const datumObjekt =
          new Date(
            Number(teile[2]),
            Number(teile[1]) - 1,
            Number(teile[0]),
            12,
            0,
            0
          );

        if (
          !isNaN(
            datumObjekt.getTime()
          )
        ) {
          const tage =
            [
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

      // ------------------------------------------------------
      // DIENST FÜR ADMIN-DARSTELLUNG AUFBEREITEN
      // ------------------------------------------------------

      let plaza =
        '';

      let schicht =
        '';

      let schichtSymbol =
        '';

      if (dienst) {
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
      }

      // ------------------------------------------------------
      // BEZUG ZUM DIENST
      // ------------------------------------------------------

      let dienstBezugHtml =
        '';

      if (
        datum ||
        dienst
      ) {
        const teile =
          [];

        if (datum) {
          let datumText =
            datum;

          if (wochentag) {
            datumText =
              wochentag +
              ', ' +
              datum;
          }

          teile.push(
            escapeHtmlNeu(
              datumText
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
        }

        else if (dienst) {
          teile.push(
            escapeHtmlNeu(
              entferneDienstSymbol(
                dienst
              )
            )
          );
        }

        dienstBezugHtml = `
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

      } else {
        dienstBezugHtml = `
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

      // ------------------------------------------------------
      // WUNSCHKARTE
      // ------------------------------------------------------

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


          ${dienstBezugHtml}


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
              : `
                <div
                  style="
                    margin-top:12px;
                    color:#777777;
                    font-size:14px;
                  "
                >
                  Kein Wunschtext vorhanden.
                </div>
              `
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
    !anfragen ||
    anfragen.length === 0
  ) {
    liste.innerHTML = `
      <div class="empty-state">
        Keine offenen PIN-Reset-Anfragen.
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
                ${escapeHtmlNeu(a.mitarbeiter || '')}
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
                      🕒 ${escapeHtmlNeu(a.zeitstempel)}
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
              display:flex;
              gap:10px;
              flex-wrap:wrap;
              margin-top:14px;
            "
          >
            <button
              type="button"
              onclick="bearbeiteAdminPinResetNeu(${Number(a.zeile)}, true)"
              style="
                border:0;
                background:#14943b;
                color:#ffffff;
                border-radius:8px;
                padding:9px 14px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ✅ Reset genehmigen
            </button>

            <button
              type="button"
              onclick="bearbeiteAdminPinResetNeu(${Number(a.zeile)}, false)"
              style="
                border:1px solid #c9cdd2;
                background:#ffffff;
                color:#b00020;
                border-radius:8px;
                padding:9px 14px;
                font-weight:700;
                cursor:pointer;
              "
            >
              ❌ Ablehnen
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
// DIENSTE FÜR SONSTIGEN WUNSCH
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
// EIGENE DIENSTE ZUSAMMENFASSEN
// ==========================================================

function baueEigeneDienstOptionenNeu(
  plan
) {
  const ergebnis =
    [];

  (plan || []).forEach(
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
    nachricht.length >
    500
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

  let datum =
    '';

  let kw =
    '';

  let dienst =
    '';

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
// DYNAMISCHE ANSICHTEN INSTALLIEREN
// ==========================================================

function installiereDynamischeAnsichtenNeu() {
  installiereAbwesenheitenAnsichtNeu();

  installiereAnfragenAnsichtNeu();

  installierePinAnsichtNeu();

  installiereAdminAnsichtNeu();

  installiereSonstigerWunschAnsichtNeu();
}


// ==========================================================
// ALLE HAUPTANSICHTEN VERSTECKEN
// ==========================================================

function versteckeAlleHauptAnsichtenNeu() {
  const ids =
    [
      'dienstplanAnsicht',
      'tauschAnsicht',
      'abwesenheitenAnsicht',
      'anfragenAnsicht',
      'pinAnsicht',
      'adminAnsicht',
      'sonstigerWunschAnsicht'
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
      'sonstigerWunsch'
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
// SEITENTITEL
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
      'Sonstiger Wunsch'
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
// NAVIGATION INSTALLIEREN
// ==========================================================

function installiereNavigationErweiterungNeu() {
  if (
    window.__scsNavigationInstalliert
  ) {
    return;
  }

  window.__scsNavigationInstalliert =
    true;

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

        await ladeMeinDienstplanNeu();

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
      // ADMIN
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
      // FALLBACK
      // ======================================================

      if (
        basisZeigeSeite
      ) {
        basisZeigeSeite.call(
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
// DIENSTZEITEN
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
// SESSION ABGELAUFEN
// ==========================================================

async function sessionAbgelaufenNeu() {
  localStorage.removeItem(
    SESSION_KEY
  );

  aktuellerBenutzer =
    '';

  aktuellerAdmin =
    false;

  letzterDienstplan =
    [];

  letzteAbwesenheiten =
    [];

  aktuelleKwNeu =
    1;

  dienstplanInitialisiert =
    false;

  zeigeLogin();

  await ladeMitarbeiter();

  zeigeLoginMeldung(
    'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.',
    'fehler'
  );
}


// ==========================================================
// LOGOUT
// ==========================================================

async function logoutAusfuehren() {
  const token =
    localStorage.getItem(
      SESSION_KEY
    );

  localStorage.removeItem(
    SESSION_KEY
  );

  aktuellerBenutzer =
    '';

  aktuellerAdmin =
    false;

  letzterDienstplan =
    [];

  letzteAbwesenheiten =
    [];

  aktuelleKwNeu =
    1;

  dienstplanInitialisiert =
    false;

  if (token) {
    try {
      await apiPost(
        'logout',
        {
          token:
            token
        }
      );

    } catch (error) {
      console.error(
        'Logout:',
        error
      );
    }
  }

  const pin =
    document.getElementById(
      'loginPin'
    );

  if (pin) {
    pin.value =
      '';
  }

  const adminNav =
    document.getElementById(
      'adminNav'
    );

  if (adminNav) {
    adminNav.style.display =
      'none';
  }

  const adminTitel =
    document.getElementById(
      'adminTitel'
    );

  if (adminTitel) {
    adminTitel.style.display =
      'none';
  }

  schliessePinFestlegenDialogNeu();

  zeigeLogin();

  await ladeMitarbeiter();
}


// ==========================================================
// LOGIN-MELDUNG
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
    'login-meldung ' +
    (
      typ ===
      'erfolg'
        ? 'erfolg'
        : 'fehler'
    );
}


function loescheLoginMeldung() {
  const element =
    document.getElementById(
      'loginMeldung'
    );

  if (!element) {
    return;
  }

  element.textContent =
    '';

  element.className =
    'login-meldung';
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
