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

    return JSON.parse(
      text
    );

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
// LOGIN AUSFÜHREN
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
// MEIN DIENSTPLAN LADEN
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
  }
}


// ==========================================================
// VERFÜGBARE WOCHEN ERMITTELN
// ==========================================================

function baueKwListe() {

  const kws =
    [];


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

        kws.push(
          kw
        );
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


  if (
    verfuegbareKws.length === 0
  ) {

    aktuelleKwIndex =
      0;


    return;
  }


  // Beim Neuladen zunächst die erste vorhandene Woche anzeigen.
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
// WOCHEN-ANSICHT AKTUALISIEREN
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


    rendereDienstplan(
      []
    );


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
          Number(
            tag.kw
          ) === kw
        );
      }
    );


  rendereDienstplan(
    planDerWoche
  );
}


// ==========================================================
// DIENSTPLAN ANZEIGEN
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


      if (z.gpFrueh) {

        dienste.push({
          typ: 'gp',
          symbol: '☀️',
          name: 'Garden Plaza – Früh',
          zeit: zeitFruehNeu(z.tag)
        });
      }


      if (z.gpSpaet) {

        dienste.push({
          typ: 'gp',
          symbol: '🌙',
          name: 'Garden Plaza – Spät',
          zeit: zeitSpaetNeu(z.tag)
        });
      }


      if (z.gpAbloese) {

        dienste.push({
          typ: 'abloese',
          symbol: '🕒',
          name: 'Garden Plaza – Pausenablöse',
          zeit: z.gpAbloesezeit || ''
        });
      }


      if (z.wpFrueh) {

        dienste.push({
          typ: 'wp',
          symbol: '☀️',
          name: 'Water Plaza – Früh',
          zeit: zeitFruehNeu(z.tag)
        });
      }


      if (z.wpSpaet) {

        dienste.push({
          typ: 'wp',
          symbol: '🌙',
          name: 'Water Plaza – Spät',
          zeit: zeitSpaetNeu(z.tag)
        });
      }


      if (z.wpAbloese) {

        dienste.push({
          typ: 'abloese',
          symbol: '🕒',
          name: 'Water Plaza – Pausenablöse',
          zeit: z.wpAbloesezeit || ''
        });
      }


      html +=
        `
          <div
            class="panel"
            style="
              padding:18px;
              margin-bottom:12px;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:16px;
                align-items:flex-start;
                margin-bottom:10px;
              "
            >

              <div>

                <strong
                  style="
                    font-size:17px;
                  "
                >
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


          html +=
            `
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
                    font-weight:700;
                  "
                >
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
                        🕒 ${escapeHtmlNeu(dienst.zeit)}
                      </div>
                    `
                    : ''
                }

              </div>
            `;
        }
      );


      if (z.notiz) {

        html +=
          `
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
        `
          </div>
        `;
    }
  );


  liste.innerHTML =
    html;
}


// ==========================================================
// ABWESENHEITEN ANZEIGEN
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

    liste.innerHTML =
      `
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
          .includes(
            'urlaub'
          )
      ) {

        symbol =
          '🏖️';


        farbe =
          '#14943b';
      }


      if (
        status
          .toLowerCase()
          .includes(
            'krank'
          )
      ) {

        symbol =
          '🤒';


        farbe =
          '#c62828';
      }


      html +=
        `
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


  liste.innerHTML =
    html;
}


// ==========================================================
// AKTUALISIERT AM
// ==========================================================

function setzeAktualisiertZeit() {

  /*
    Wir unterstützen mehrere mögliche IDs.
    Dadurch funktioniert es auch, wenn deine index.html
    für die Anzeige einen etwas anderen Namen verwendet.
  */

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

    console.log(
      'Keine Aktualisiert-am-Anzeige gefunden.'
    );


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
// LOGIN MELDUNGEN
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
