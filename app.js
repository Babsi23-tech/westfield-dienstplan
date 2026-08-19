// ==========================================================
// SCS TEAM – APP.JS
// ==========================================================

const API_URL =
  'https://script.google.com/macros/s/AKfycbxL-vdBIT5xLORL2k8xdNJXC4bRWt97X-QcvWQ5_bB1xXz083yntxCwimdaiqkoPMKBbg/exec';

const SESSION_KEY =
  'scs_team_session';

let aktuellerBenutzer = '';
let aktuellerAdmin = false;

let geladenerDienstplan = [];
let geladeneAbwesenheiten = [];

let verfuegbareKws = [];
let aktuelleKwIndex = 0;

// Direkter Diensttausch
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

      redirect: 'follow'
    }
  );

  const text =
    await response.text();

  console.log(
    'API Antwort:',
    action,
    response.status,
    text
  );

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

    await starteApp();

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

        zeigeSeite(
          'dienstplan'
        );

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
          name: name,
          pin: pin
        }
      );

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

    if (pinElement) {
      pinElement.value =
        '';
    }

    zeigeHauptApp(
      aktuellerBenutzer,
      aktuellerAdmin
    );

    zeigeSeite(
      'dienstplan'
    );

  } catch (error) {

    console.error(error);

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
// HAUPT-APP
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
    login.style.display =
      'none';
  }

  if (app) {
    app.style.display =
      'flex';
  }

  const profilName =
    document.getElementById(
      'profilNameAnzeige'
    );

  if (profilName) {

    profilName.textContent =
      name || 'Mitarbeiter';
  }

  const adminNav =
    document.getElementById(
      'adminNav'
    );

  if (adminNav) {

    adminNav.style.display =
      admin
        ? 'flex'
        : 'none';
  }
}


// ==========================================================
// SEITEN WECHSELN
// ==========================================================

function zeigeSeite(seite) {

  const dienstplan =
    document.getElementById(
      'dienstplanAnsicht'
    );

  const tauschen =
    document.getElementById(
      'tauschAnsicht'
    );

  const anfragen =
    document.getElementById(
      'anfragenAnsicht'
    );

  const pin =
    document.getElementById(
      'pinAnsicht'
    );

  const admin =
    document.getElementById(
      'adminAnsicht'
    );

  [
    dienstplan,
    tauschen,
    anfragen,
    pin,
    admin
  ].forEach(
    function(element) {

      if (element) {
        element.style.display =
          'none';
      }
    }
  );

  if (
    seite === 'dienstplan' &&
    dienstplan
  ) {

    dienstplan.style.display =
      'block';

    ladeMeinDienstplanNeu();
  }

  if (
    seite === 'dienstTauschen' &&
    tauschen
  ) {

    tauschen.style.display =
      'block';
  }

  if (
    seite === 'anfragen' &&
    anfragen
  ) {

    anfragen.style.display =
      'block';
  }

  if (
    seite === 'pin' &&
    pin
  ) {

    pin.style.display =
      'block';
  }

  if (
    seite === 'admin' &&
    admin
  ) {

    admin.style.display =
      'block';
  }

  const sidebar =
    document.getElementById(
      'sidebar'
    );

  if (
    sidebar &&
    window.innerWidth <= 900
  ) {

    sidebar.classList.remove(
      'mobile-offen'
    );
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

    zeigeLogin();

    await ladeMitarbeiter();

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

  if (liste) {
    liste.innerHTML =
      '';
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
      !result ||
      !result.ok
    ) {

      if (
        result &&
        result.sessionExpired
      ) {

        localStorage.removeItem(
          SESSION_KEY
        );

        zeigeLogin();

        await ladeMitarbeiter();

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

    const profilName =
      document.getElementById(
        'profilNameAnzeige'
      );

    if (profilName) {

      profilName.textContent =
        aktuellerBenutzer ||
        'Mitarbeiter';
    }

    if (sollstundenElement) {

      const soll =
        Number(
          result.sollstunden || 0
        );

      sollstundenElement.textContent =
        soll
          .toFixed(1)
          .replace('.', ',') +
        ' Std.';
    }

    geladenerDienstplan =
      Array.isArray(
        result.dienstplan
      )
        ? result.dienstplan
        : [];

    geladeneAbwesenheiten =
      Array.isArray(
        result.abwesenheiten
      )
        ? result.abwesenheiten
        : [];

    baueKwListe();

    aktualisiereWochenAnsicht();

    rendereAbwesenheiten(
      geladeneAbwesenheiten
    );

    setzeAktualisiertZeit();

    if (laden) {
      laden.style.display =
        'none';
    }

  } catch (error) {

    console.error(error);

    if (laden) {

      laden.style.display =
        'block';

      laden.textContent =
        'Fehler beim Laden: ' +
        error.message;
    }
  }
}


// ==========================================================
// KW-LISTE
// ==========================================================

function baueKwListe() {

  const kws = [];

  geladenerDienstplan.forEach(
    function(tag) {

      const kw =
        Number(
          tag.kw
        );

      if (
        Number.isFinite(kw) &&
        kw > 0 &&
        !kws.includes(kw)
      ) {

        kws.push(kw);
      }
    }
  );

  kws.sort(
    function(a, b) {
      return a - b;
    }
  );

  verfuegbareKws =
    kws;

  aktuelleKwIndex =
    0;
}


// ==========================================================
// WOCHE WECHSELN
// ==========================================================

function wechselWoche(
  richtung
) {

  if (
    verfuegbareKws.length === 0
  ) {
    return;
  }

  const neuerIndex =
    aktuelleKwIndex +
    Number(
      richtung || 0
    );

  if (
    neuerIndex < 0 ||
    neuerIndex >=
      verfuegbareKws.length
  ) {
    return;
  }

  aktuelleKwIndex =
    neuerIndex;

  aktualisiereWochenAnsicht();
}


// ==========================================================
// WOCHENANSICHT
// ==========================================================

function aktualisiereWochenAnsicht() {

  const kwAnzeige =
    document.getElementById(
      'kwAnzeige'
    );

  const zurueck =
    document.getElementById(
      'kwZurueck'
    );

  const weiter =
    document.getElementById(
      'kwWeiter'
    );

  if (
    verfuegbareKws.length === 0
  ) {

    if (kwAnzeige) {
      kwAnzeige.textContent =
        'KW —';
    }

    if (zurueck) {
      zurueck.disabled =
        true;
    }

    if (weiter) {
      weiter.disabled =
        true;
    }

    rendereDienstplan([]);

    return;
  }

  const kw =
    verfuegbareKws[
      aktuelleKwIndex
    ];

  if (kwAnzeige) {

    kwAnzeige.textContent =
      'KW ' + kw;
  }

  if (zurueck) {

    zurueck.disabled =
      aktuelleKwIndex === 0;
  }

  if (weiter) {

    weiter.disabled =
      aktuelleKwIndex ===
      verfuegbareKws.length - 1;
  }

  const planDerWoche =
    geladenerDienstplan.filter(
      function(tag) {

        return (
          Number(tag.kw) === kw
        );
      }
    );

  rendereDienstplan(
    planDerWoche
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

  const relevanteTage =
    (plan || []).filter(
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

    liste.innerHTML =
      `
        <div class="empty-state">
          In dieser Woche hast du keine Dienste.
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

      // GP FRÜH
      if (z.gpFrueh) {

        dienste.push({
          typ: 'gp',
          symbol: '🌞',
          name:
            'Garden Plaza – Früh',
          code:
            'GP_FRUEH',
          zeit:
            zeitFruehNeu(z.tag),
          tauschbar:
            true
        });
      }

      // GP SPÄT
      if (z.gpSpaet) {

        dienste.push({
          typ: 'gp',
          symbol: '🌙',
          name:
            'Garden Plaza – Spät',
          code:
            'GP_SPAET',
          zeit:
            zeitSpaetNeu(z.tag),
          tauschbar:
            true
        });
      }

      // WP GANZTAG
      if (
        z.wpFrueh &&
        z.wpSpaet
      ) {

        dienste.push({
          typ: 'wp',
          symbol: '🔵',
          name:
            'Water Plaza – Ganztag',
          code:
            'WP_GANZTAG',
          zeit:
            '09:00 – ' +
            zeitSpaetEndeNeu(
              z.tag
            ),
          tauschbar:
            true
        });

      } else {

        if (z.wpFrueh) {

          dienste.push({
            typ: 'wp',
            symbol: '🌞',
            name:
              'Water Plaza – Früh',
            code:
              'WP_FRUEH',
            zeit:
              zeitFruehNeu(z.tag),
            tauschbar:
              true
          });
        }

        if (z.wpSpaet) {

          dienste.push({
            typ: 'wp',
            symbol: '🌙',
            name:
              'Water Plaza – Spät',
            code:
              'WP_SPAET',
            zeit:
              zeitSpaetNeu(z.tag),
            tauschbar:
              true
          });
        }
      }

      // GP Pausenablöse
      if (z.gpAbloese) {

        dienste.push({
          typ: 'abloese',
          symbol: '🕒',
          name:
            'Garden Plaza – Pausenablöse',
          code:
            '',
          zeit:
            z.gpAbloesezeit || '',
          tauschbar:
            false
        });
      }

      // WP Pausenablöse:
      // Wenn GP Spät vorhanden ist, gehört sie automatisch
      // zu diesem Dienst und bekommt KEINEN eigenen Tauschbutton.
      if (
        z.wpAbloese &&
        !z.gpSpaet
      ) {

        dienste.push({
          typ: 'abloese',
          symbol: '🕒',
          name:
            'Water Plaza – Pausenablöse',
          code:
            '',
          zeit:
            z.wpAbloesezeit || '',
          tauschbar:
            false
        });
      }

      html += `
        <div
          class="panel"
          style="
            padding:18px;
            margin-bottom:12px;
          "
        >

          <div style="margin-bottom:10px;">

            <strong style="font-size:17px;">
              ${escapeHtmlNeu(z.tag || '')},
              ${escapeHtmlNeu(z.datum || '')}
            </strong>

            <div
              style="
                color:#666;
                font-size:13px;
                margin-top:4px;
              "
            >
              KW ${escapeHtmlNeu(z.kw || '')}
            </div>

          </div>
      `;

      dienste.forEach(
        function(dienst) {

          let randfarbe =
            '#999999';

          let hintergrund =
            '#ffffff';

          if (
            dienst.typ === 'gp'
          ) {

            randfarbe =
              '#14943b';

            hintergrund =
              '#f9fffa';
          }

          if (
            dienst.typ === 'wp'
          ) {

            randfarbe =
              '#1754d1';

            hintergrund =
              '#f9fbff';
          }

          if (
            dienst.typ === 'abloese'
          ) {

            randfarbe =
              '#f0a14a';

            hintergrund =
              '#fffdf8';
          }

          html += `
            <div
              style="
                background:${hintergrund};
                border:1px solid #e1e4e8;
                border-left:6px solid ${randfarbe};
                border-radius:10px;
                padding:13px 14px;
                margin-top:9px;
              "
            >

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:flex-start;
                  gap:15px;
                  flex-wrap:wrap;
                "
              >

                <div>

                  <div style="font-weight:700;">
                    ${dienst.symbol}
                    ${escapeHtmlNeu(dienst.name)}
                  </div>

                  ${
                    dienst.zeit
                      ? `
                        <div
                          style="
                            color:#666;
                            margin-top:5px;
                          "
                        >
                          🕒
                          ${escapeHtmlNeu(dienst.zeit)}
                        </div>
                      `
                      : ''
                  }

                  ${
                    dienst.code === 'GP_SPAET' &&
                    z.wpAbloese
                      ? `
                        <div
                          style="
                            color:#8a5a00;
                            margin-top:7px;
                            font-size:13px;
                          "
                        >
                          ☕ WP-Pausenablöse:
                          ${escapeHtmlNeu(
                            z.wpAbloesezeit || '30 Minuten'
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
                        onclick='starteDirektenTausch(
                          ${JSON.stringify(String(z.datum || ''))},
                          ${JSON.stringify(String(z.tag || ''))},
                          ${JSON.stringify(String(z.kw || ''))},
                          ${JSON.stringify(String(dienst.code || ''))},
                          ${JSON.stringify(String(dienst.name || ''))},
                          ${JSON.stringify(String(dienst.zeit || ''))}
                        )'
                        style="
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

      if (z.notiz) {

        html += `
          <div
            style="
              margin-top:10px;
              color:#666;
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
  dienstCode,
  dienstText,
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
      dienstCode || ''
    );

  tauschDienstText =
    String(
      dienstText || ''
    );

  tauschZeit =
    String(
      zeit || ''
    );

  zeigeSeite(
    'dienstTauschen'
  );

  setTimeout(
    function() {

      fuelleTauschAnsicht();

    },
    50
  );
}


// ==========================================================
// TAUSCHANSICHT FÜLLEN
// ==========================================================

function fuelleTauschAnsicht() {

  const ansicht =
    document.getElementById(
      'tauschAnsicht'
    );

  if (!ansicht) {
    return;
  }

  const datumButton =
    ansicht.querySelector(
      '.datum-button'
    );

  if (datumButton) {

    datumButton.innerHTML = `
      <span>📅</span>

      <strong>
        ${escapeHtmlNeu(tauschDatum)}
      </strong>

      <span>
        (${escapeHtmlNeu(tauschTag)})
      </span>
    `;
  }

  const eigeneDienste =
    ansicht.querySelector(
      '.eigene-dienste'
    );

  if (eigeneDienste) {

    eigeneDienste.innerHTML = `
      <h3>
        Dein ausgewählter Dienst
      </h3>

      <div class="dienst-mini">

        <div class="dienst-links">

          <span
            class="punkt ${
              tauschDienstCode.startsWith('GP')
                ? 'gruen'
                : 'blau'
            }"
          ></span>

          <span>
            ${escapeHtmlNeu(
              tauschDienstText
            )}
          </span>

        </div>

        <strong
          class="${
            tauschDienstCode.startsWith('GP')
              ? 'gruen-text'
              : 'blau-text'
          }"
        >
          ${escapeHtmlNeu(
            aktuellerBenutzer
          )}
        </strong>

      </div>

      ${
        tauschDienstCode === 'GP_SPAET'
          ? `
            <div
              style="
                margin-top:10px;
                font-size:13px;
                color:#666;
              "
            >
              ℹ️ Die zugehörige
              WP-Pausenablöse gehört zum
              GP-Spätdienst und wird beim
              genehmigten Tausch automatisch
              mitgeführt.
            </div>
          `
          : ''
      }
    `;
  }

  const dienstAuswahl =
    ansicht.querySelector(
      '.dienst-auswahl'
    );

  if (dienstAuswahl) {

    const istGp =
      tauschDienstCode.startsWith(
        'GP'
      );

    let symbol =
      '🔵';

    if (
      tauschDienstCode.includes(
        'FRUEH'
      )
    ) {
      symbol = '☀';
    }

    if (
      tauschDienstCode.includes(
        'SPAET'
      )
    ) {
      symbol = '☾';
    }

    dienstAuswahl.innerHTML = `
      <button
        class="dienst-option ausgewaehlt"
        type="button"
      >

        <span class="radio aktiv"></span>

        <div class="dienst-symbol">
          ${symbol}
        </div>

        <div class="dienst-option-text">

          <strong
            class="${
              istGp
                ? 'gruen-text'
                : 'blau-text'
            }"
          >
            ${escapeHtmlNeu(
              tauschDienstText
            )}
          </strong>

          <span>
            Dienstzeit:
            ${escapeHtmlNeu(
              tauschZeit
            )}
          </span>

          <small
            class="status-chip ${
              istGp
                ? 'gruen-chip'
                : 'blau-chip'
            }"
          >
            Du bist eingetragen
          </small>

        </div>

      </button>
    `;
  }

  // Vorhandenen Weiter-Button mit unserer
  // echten Server-Abfrage verbinden.
  const buttons =
    ansicht.querySelectorAll(
      'button'
    );

  buttons.forEach(
    function(button) {

      const text =
        String(
          button.textContent || ''
        ).toLowerCase();

      if (
        text.includes(
          'weiter zu schritt 3'
        )
      ) {

        button.onclick =
          ladeEchteTauschpartner;
      }
    }
  );

  const kollegenBereich =
    document.getElementById(
      'kollegenBereich'
    );

  if (kollegenBereich) {

    kollegenBereich.classList.add(
      'versteckt'
    );
  }
}


// ==========================================================
// ECHTE TAUSCHPARTNER LADEN
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
    behavior: 'smooth'
  });

  try {

    const token =
      localStorage.getItem(
        SESSION_KEY
      );

    if (!token) {

      throw new Error(
        'Keine gültige Anmeldung vorhanden.'
      );
    }

    const result =
      await apiPost(
        'tauschMoeglichkeiten',
        {
          token: token,
          datum: tauschDatum
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

        localStorage.removeItem(
          SESSION_KEY
        );

        zeigeLogin();

        await ladeMitarbeiter();

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

    // Eigenen Benutzer sicher entfernen
    kandidaten =
      kandidaten.filter(
        function(k) {

          return (
            String(
              k.mitarbeiter || ''
            ).trim() !==
            String(
              aktuellerBenutzer || ''
            ).trim()
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
          Für diesen Tag wurden keine
          anderen tauschbaren Dienste gefunden.
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
              .toLowerCase()
              .trim() ===
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
              .toLowerCase()
              .trim() ===
            'spät'
          );
        }
      );

    const ganztag =
      kandidaten.filter(
        function(k) {

          return (
            String(
              k.schicht || ''
            )
              .toLowerCase()
              .trim() ===
            'ganztag'
          );
        }
      );

    const sonstige =
      kandidaten.filter(
        function(k) {

          const schicht =
            String(
              k.schicht || ''
            )
              .toLowerCase()
              .trim();

          return (
            schicht !== 'früh' &&
            schicht !== 'spät' &&
            schicht !== 'ganztag'
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
      frueh.length > 0
    ) {

      html +=
        baueKollegenBox(
          '☀️ Frühdienste',
          'frueh',
          frueh
        );
    }

    if (
      spaet.length > 0
    ) {

      html +=
        baueKollegenBox(
          '🌙 Spätdienste',
          'spaet',
          spaet
        );
    }

    if (
      ganztag.length > 0
    ) {

      html +=
        baueKollegenBox(
          '🔵 Ganztagsdienste',
          'ganztag',
          ganztag
        );
    }

    if (
      sonstige.length > 0
    ) {

      html +=
        baueKollegenBox(
          'Weitere Dienste',
          'weitere',
          sonstige
        );
    }

    html +=
      '</div>';

    html += `
      <div
        style="
          margin-top:16px;
          padding:12px;
          border-radius:8px;
          background:#f6f7f8;
          color:#555;
        "
      >
        ℹ️ Wir prüfen hier zuerst nur die
        echten Tauschpartner. Die Anfrage
        wird noch nicht abgeschickt.
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
        ❌ ${escapeHtmlNeu(error.message)}
      </p>
    `;
  }
}


// ==========================================================
// WP FRÜH + WP SPÄT = WP GANZTAG
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
        benutzt.has(index)
      ) {
        return;
      }

      if (
        k.code === 'WP_FRUEH'
      ) {

        const partnerIndex =
          kandidaten.findIndex(
            function(x, i) {

              return (
                i !== index &&
                !benutzt.has(i) &&
                x.code === 'WP_SPAET' &&
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
              'Water Plaza – Ganztag',

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
// KOLLEGENBOX
// ==========================================================

function baueKollegenBox(
  titel,
  klasse,
  kandidaten
) {

  let html = `
    <div
      class="kollegen-box ${escapeHtmlNeu(klasse)}"
    >

      <h3>
        ${titel}
      </h3>
  `;

  kandidaten.forEach(
    function(k) {

      const name =
        String(
          k.mitarbeiter || ''
        ).trim();

      const code =
        String(
          k.code || ''
        ).trim();

      const dienst =
        entferneDienstSymbol(
          k.dienst || ''
        );

      html += `
        <label class="kollege">

          <input
            type="radio"
            name="kollege"
            value="${escapeHtmlNeu(code)}"
            data-name="${escapeHtmlNeu(name)}"
          >

          <span>
            ${escapeHtmlNeu(name)}
          </span>

          <strong>
            ${escapeHtmlNeu(dienst)}
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
// DIENSTSYMBOL AUS TEXT ENTFERNEN
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
// ABWESENHEITEN
// ==========================================================

function rendereAbwesenheiten(
  abwesenheiten
) {

  const liste =
    document.getElementById(
      'abwesenheitenListe'
    );

  if (!liste) {
    return;
  }

  if (
    !abwesenheiten ||
    abwesenheiten.length === 0
  ) {

    liste.innerHTML = `
      <div class="empty-state">
        Keine Abwesenheiten vorhanden.
      </div>
    `;

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
        );

      let symbol =
        '📌';

      let farbe =
        '#666666';

      if (
        status
          .toLowerCase()
          .includes('urlaub')
      ) {

        symbol =
          '🏖️';

        farbe =
          '#14943b';
      }

      if (
        status
          .toLowerCase()
          .includes('krank')
      ) {

        symbol =
          '🤒';

        farbe =
          '#c62828';
      }

      html += `
        <div
          class="panel"
          style="
            padding:16px;
            margin-bottom:10px;
            border-left:6px solid ${farbe};
          "
        >

          <strong>
            ${symbol}
            ${escapeHtmlNeu(status)}
          </strong>

          <div
            style="
              color:#666;
              margin-top:6px;
            "
          >
            ${escapeHtmlNeu(a.von || '')}

            ${
              a.bis
                ? ' – ' +
                  escapeHtmlNeu(a.bis)
                : ''
            }
          </div>

        </div>
      `;
    }
  );

  liste.innerHTML =
    html;
}


// ==========================================================
// AKTUALISIERT-ZEIT
// ==========================================================

function setzeAktualisiertZeit() {

  const element =
    document.getElementById(
      'sidebarAktualisiert'
    ) ||
    document.getElementById(
      'aktualisiertAnzeige'
    ) ||
    document.getElementById(
      'aktualisiertAm'
    );

  if (!element) {
    return;
  }

  const jetzt =
    new Date();

  const datum =
    jetzt.toLocaleDateString(
      'de-AT',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }
    );

  const zeit =
    jetzt.toLocaleTimeString(
      'de-AT',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  element.textContent =
    datum +
    ' · ' +
    zeit;
}


// ==========================================================
// DIENSTZEITEN
// ==========================================================

function zeitFruehNeu(
  tag
) {

  if (
    tag === 'Samstag'
  ) {

    return '09:00 – 18:00';
  }

  return '09:00 – 14:30';
}


function zeitSpaetNeu(
  tag
) {

  if (
    tag === 'Samstag'
  ) {

    return '11:30 – 16:00';
  }

  if (
    tag === 'Donnerstag' ||
    tag === 'Freitag'
  ) {

    return '14:30 – 20:00';
  }

  return '14:30 – 19:00';
}


function zeitSpaetEndeNeu(
  tag
) {

  if (
    tag === 'Samstag'
  ) {

    return '18:00';
  }

  if (
    tag === 'Donnerstag' ||
    tag === 'Freitag'
  ) {

    return '20:00';
  }

  return '19:00';
}


// ==========================================================
// ABMELDEN
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

  geladenerDienstplan =
    [];

  geladeneAbwesenheiten =
    [];

  verfuegbareKws =
    [];

  aktuelleKwIndex =
    0;

  if (token) {

    try {

      await apiPost(
        'logout',
        {
          token: token
        }
      );

    } catch (error) {

      console.error(
        'Logout am Server fehlgeschlagen:',
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

  zeigeLogin();

  await ladeMitarbeiter();
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

  zeigeLoginMeldung(
    'Die PIN-vergessen-Funktion verbinden wir als Nächstes.',
    'erfolg'
  );
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
    text;

  element.className =
    'login-meldung ' +
    (
      typ === 'erfolg'
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
// MOBILE MENÜ
// ==========================================================

function toggleMobileMenue() {

  const sidebar =
    document.getElementById(
      'sidebar'
    );

  if (sidebar) {

    sidebar.classList.toggle(
      'mobile-offen'
    );
  }
}


// ==========================================================
// TAUSCH-UNTERMENÜ
// ==========================================================

function toggleTauschMenue() {

  const menue =
    document.getElementById(
      'tauschUntermenue'
    );

  if (menue) {

    menue.classList.toggle(
      'offen'
    );
  }
}


// ==========================================================
// ALTE HTML-FUNKTION ABFANGEN
// ==========================================================

function waehleDienst(
  button
) {

  document
    .querySelectorAll(
      '.dienst-option'
    )
    .forEach(
      function(element) {

        element.classList.remove(
          'ausgewaehlt'
        );

        const radio =
          element.querySelector(
            '.radio'
          );

        if (radio) {

          radio.classList.remove(
            'aktiv'
          );
        }
      }
    );

  if (!button) {
    return;
  }

  button.classList.add(
    'ausgewaehlt'
  );

  const radio =
    button.querySelector(
      '.radio'
    );

  if (radio) {

    radio.classList.add(
      'aktiv'
    );
  }
}


// ==========================================================
// FALLS INDEX.HTML NOCH zeigeKollegen() AUFRUFT
// ==========================================================

async function zeigeKollegen() {

  await ladeEchteTauschpartner();
}


// ==========================================================
// ENTER BEIM LOGIN
// ==========================================================

document.addEventListener(
  'keydown',
  function(event) {

    if (
      event.key !== 'Enter'
    ) {
      return;
    }

    const login =
      document.getElementById(
        'loginAnsicht'
      );

    if (
      login &&
      login.style.display !== 'none'
    ) {

      loginAusfuehren();
    }
  }
);


// ==========================================================
// HTML SICHER
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
