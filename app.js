// ==========================================================
// SCS TEAM – APP.JS
// Stand: 20.08.2026 – bereinigt
// ==========================================================

const API_URL =
  'https://script.google.com/macros/s/AKfycbxL-vdBIT5xLORL2k8xdNJXC4bRWt97X-QcvWQ5_bB1xXz083yntxCwimdaiqkoPMKBbg/exec';

const SESSION_KEY = 'scs_team_session';

let aktuellerBenutzer = '';
let aktuellerAdmin = false;

let letzterDienstplan = [];
let letzteAbwesenheiten = [];
let aktuelleKwNeu = 1;
let dienstplanInitialisiert = false;

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

  const text =
    await response.text();

  if (!response.ok) {

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
// APP START
// ==========================================================

document.addEventListener(
  'DOMContentLoaded',
  async function() {

    installiereDynamischeAnsichtenNeu();

    installiereNavigationErweiterungNeu();

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
// LOGIN
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
      name || 'Mitarbeiter';
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
        ) === heutigesDatum;
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
// DIENSTPLAN RENDERN
//
// Garden Plaza = GRÜN
// Water Plaza  = BLAU
//
// Früh / Spät verändert NICHT die Farbe.
//
// Tageskarte bleibt immer neutral.
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
      //
      // WP-Pausenablöse gehört zu diesem Dienst.
      // Dadurch bleibt die Karte GRÜN.
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
      // WATER PLAZA – GANZTAG
      // Früh + Spät bei derselben Person
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
      }


      else {

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
      // nicht separat tauschbar
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
      //
      // Wenn GP Spät vorhanden ist, NICHT separat anzeigen.
      // Sie steht bereits als Zusatz beim GP-Spätdienst.
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
      //
      // IMMER WEISS / NEUTRAL
      // ------------------------------------------------------

      html += `
        <div
          class="scs-tag-karte"
          style="
            background:#ffffff !important;
            border:1px solid #dfe3e8 !important;
            border-left:1px solid #dfe3e8 !important;
            border-radius:13px;
            padding:17px;
            margin-bottom:13px;
            box-shadow:
              0 4px 14px
              rgba(0,0,0,0.035);
            box-sizing:border-box;
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


      dienste.forEach(
        function(dienst) {

          let randfarbe =
            '#999999';

          let hintergrund =
            '#ffffff';

          let zusatzFarbe =
            '#777777';


          // --------------------------------------------------
          // GARDEN PLAZA = GRÜN
          // --------------------------------------------------

          if (
            dienst.klasse ===
            'garden'
          ) {

            randfarbe =
              '#14943b';

            hintergrund =
              '#f5fff8';

            zusatzFarbe =
              '#6b5800';
          }


          // --------------------------------------------------
          // WATER PLAZA = BLAU
          // --------------------------------------------------

          else if (
            dienst.klasse ===
            'water'
          ) {

            randfarbe =
              '#1754d1';

            hintergrund =
              '#f5f8ff';
          }


          // --------------------------------------------------
          // PAUSENABLÖSE = NEUTRAL / ORANGE
          // --------------------------------------------------

          else if (
            dienst.klasse ===
            'abloese'
          ) {

            randfarbe =
              '#d99032';

            hintergrund =
              '#fffaf3';
          }


          let onclick =
            '';


          if (
            dienst.tauschbar
          ) {

            onclick =
              'starteDirektenTausch(' +
              JSON.stringify(
                String(
                  z.datum || ''
                )
              ) +
              ',' +
              JSON.stringify(
                String(
                  z.tag || ''
                )
              ) +
              ',' +
              JSON.stringify(
                String(
                  z.kw || ''
                )
              ) +
              ',' +
              JSON.stringify(
                String(
                  dienst.code || ''
                )
              ) +
              ',' +
              JSON.stringify(
                String(
                  dienst.name || ''
                )
              ) +
              ',' +
              JSON.stringify(
                String(
                  dienst.zeit || ''
                )
              ) +
              ')';
          }


          html += `
            <div
              class="scs-dienst-karte"
              data-plaza="${escapeHtmlNeu(dienst.klasse)}"
              style="
                background:${hintergrund} !important;
                border:1px solid #e1e4e8 !important;
                border-left:6px solid ${randfarbe} !important;
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
// DIREKTEN DIENSTTAUSCH STARTEN
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
    60
  );
}


// ==========================================================
// TAUSCHANSICHT BEFÜLLEN
// ==========================================================

function fuelleTauschAnsichtNeu() {

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


  const istGarden =
    tauschDienstCode.startsWith(
      'GP'
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
              istGarden
                ? 'gruen'
                : 'blau'
            }"
          ></span>

          <span>
            ${escapeHtmlNeu(tauschDienstText)}
          </span>

        </div>

        <strong
          class="${
            istGarden
              ? 'gruen-text'
              : 'blau-text'
          }"
        >
          ${escapeHtmlNeu(aktuellerBenutzer)}
        </strong>

      </div>

      ${
        tauschDienstCode ===
        'GP_SPAET'
          ? `
            <div
              style="
                margin-top:10px;
                padding:10px 12px;
                border-radius:8px;
                background:#f6f7f8;
                color:#666;
                font-size:13px;
                line-height:1.45;
              "
            >
              ℹ️ Die zugehörige WP-Pausenablöse
              gehört zum GP-Spätdienst und wird
              beim genehmigten Tausch automatisch
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

    let symbol =
      '🔵';


    if (
      tauschDienstCode.includes(
        'FRUEH'
      )
    ) {

      symbol =
        '☀️';
    }


    else if (
      tauschDienstCode.includes(
        'SPAET'
      )
    ) {

      symbol =
        '🌙';
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
              istGarden
                ? 'gruen-text'
                : 'blau-text'
            }"
          >
            ${escapeHtmlNeu(tauschDienstText)}
          </strong>

          <span>
            Dienstzeit:
            ${escapeHtmlNeu(tauschZeit)}
          </span>

          <small
            class="status-chip ${
              istGarden
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


  const weiterButton =
    ansicht.querySelector(
      '.weiter-button'
    );


  if (weiterButton) {

    weiterButton.onclick =
      ladeEchteTauschpartner;
  }


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
// WP FRÜH + SPÄT = GANZTAG
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
// TAUSCH – SCHRITT 4 AKTUALISIEREN
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
          token: token,
          datum: tauschDatum,
          eigenerDienstCode: tauschDienstCode,
          partnerName: partnerName,
          partnerDienstCode: partnerDienstCode,
          nachricht: nachricht
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
// DIENST-SYMBOL ENTFERNEN
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
// MEINE ANFRAGEN – DYNAMISCHE ANSICHT
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
        <h1>Meine Anfragen</h1>
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
        📋 Sonstige Dienstanfragen
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
            token: token
          }
        ),

        apiPost(
          'meineDienstAnfragen',
          {
            token: token
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
        'Dienstanfragen konnten nicht geladen werden.'
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
// TAUSCH-STATUS
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
// TAUSCHANFRAGE ANNEHMEN / ABLEHNEN
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
          token: token,
          zeile: Number(
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
// SONSTIGE DIENSTANFRAGEN
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
        Du hast aktuell keine sonstigen Dienstanfragen.
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
              'Dienstanfrage'
            )}
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
// BADGE
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
// MEINE ABWESENHEITEN
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
        <h1>Meine Abwesenheiten</h1>

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
// PIN & SICHERHEIT
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
          token: token,
          alterPin: alterPin,
          neuerPin1: neuerPin1,
          neuerPin2: neuerPin2
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
// ADMIN-BEREICH
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


    <div class="panel">

      <h2 style="margin-top:0;">
        📋 Sonstige Dienstanfragen
      </h2>


      <p style="color:#666;">
        Das Genehmigen oder Ablehnen ändert hier
        nur den Status der Anfrage.
        Der Dienstplan wird dadurch nicht automatisch geändert.
      </p>


      <div id="adminDienstAnfragenListe">

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
      '<div class="empty-state">Dienstanfragen werden geladen …</div>';
  }


  try {

    const ergebnisse =
      await Promise.all([
        apiPost(
          'adminTauschAnfragen',
          {
            token: token
          }
        ),

        apiPost(
          'adminDienstAnfragen',
          {
            token: token
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
        'Admin-Tauschanfragen konnten nicht geladen werden.'
      );
    }


    if (
      !dienstResult ||
      !dienstResult.ok
    ) {

      throw new Error(
        dienstResult?.message ||
        'Admin-Dienstanfragen konnten nicht geladen werden.'
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


    rendereAdminTauschAnfragenNeu(
      tauschAnfragen
    );


    rendereAdminDienstAnfragenNeu(
      dienstAnfragen
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
          token: token,
          zeile: Number(
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
// ADMIN – SONSTIGE DIENSTANFRAGEN
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
    !anfragen ||
    anfragen.length === 0
  ) {

    liste.innerHTML = `
      <div class="empty-state">
        Keine offenen sonstigen Dienstanfragen.
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
            ${escapeHtmlNeu(a.mitarbeiter || '')}
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
              margin-top:8px;
              font-weight:700;
            "
          >
            ${escapeHtmlNeu(a.art || 'Dienstanfrage')}
          </div>


          ${
            a.dienst
              ? `
                <div
                  style="
                    margin-top:8px;
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
              margin-top:12px;
              padding:10px;
              border-radius:8px;
              background:#fff8e8;
              color:#6d5500;
              font-size:13px;
            "
          >
            ℹ️ Der Dienstplan wird dadurch
            nicht automatisch geändert.
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
              onclick="bearbeiteAdminDienstAnfrageNeu(${Number(a.zeile)}, true)"
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
              onclick="bearbeiteAdminDienstAnfrageNeu(${Number(a.zeile)}, false)"
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
// ADMIN – DIENSTANFRAGE BEARBEITEN
// ==========================================================

async function bearbeiteAdminDienstAnfrageNeu(
  zeile,
  genehmigen
) {

  const frage =
    genehmigen
      ? 'Diese Anfrage genehmigen?'
      : 'Diese Anfrage ablehnen?';


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
          token: token,
          zeile: Number(
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
        'Anfrage konnte nicht bearbeitet werden.'
      );
    }


    window.alert(
      result.message ||
      'Anfrage wurde bearbeitet.'
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
// DYNAMISCHE ANSICHTEN INSTALLIEREN
// ==========================================================

function installiereDynamischeAnsichtenNeu() {

  installiereAbwesenheitenAnsichtNeu();

  installiereAnfragenAnsichtNeu();

  installierePinAnsichtNeu();

  installiereAdminAnsichtNeu();

  installierePlatzhalterAnsichtenNeu();
}


// ==========================================================
// DIENST ÄNDERN / SONSTIGER WUNSCH
//
// Diese zwei Bereiche bleiben vorerst als Platzhalter.
// ==========================================================

function installierePlatzhalterAnsichtenNeu() {

  const main =
    document.querySelector(
      '#hauptApp .content'
    );


  if (!main) {
    return;
  }


  if (
    !document.getElementById(
      'dienstAendernAnsicht'
    )
  ) {

    const section =
      document.createElement(
        'section'
      );


    section.id =
      'dienstAendernAnsicht';


    section.style.display =
      'none';


    section.innerHTML = `
      <div class="content-header">

        <div>

          <h1>
            Dienst ändern
          </h1>

          <p>
            Hier kannst du eine Änderung
            deines Dienstes anfragen.
          </p>

        </div>

      </div>


      <div class="panel">

        <strong>
          🛠️ Dienst ändern
        </strong>

        <p style="color:#666;">
          Dieser Bereich wird im nächsten Schritt
          fertig eingerichtet.
        </p>

      </div>
    `;


    main.appendChild(
      section
    );
  }


  if (
    !document.getElementById(
      'sonstigerWunschAnsicht'
    )
  ) {

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
            Hier kannst du einen sonstigen
            Dienstplan-Wunsch senden.
          </p>

        </div>

      </div>


      <div class="panel">

        <strong>
          💬 Sonstiger Wunsch
        </strong>

        <p style="color:#666;">
          Dieser Bereich wird im nächsten Schritt
          fertig eingerichtet.
        </p>

      </div>
    `;


    main.appendChild(
      section
    );
  }
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
      'dienstAendernAnsicht',
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
      'dienstAendern' ||
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

    dienstAendern:
      'Dienst ändern',

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


      // ------------------------------------------------------
      // MEIN DIENSTPLAN
      // ------------------------------------------------------

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


      // ------------------------------------------------------
      // DIENST TAUSCHEN
      // ------------------------------------------------------

      if (
        seite ===
        'dienstTauschen'
      ) {

        versteckeAlleHauptAnsichtenNeu();


        const ansicht =
          document.getElementById(
            'tauschAnsicht'
          );


        if (ansicht) {

          ansicht.style.display =
            'block';
        }


        setzeNavigationAktivNeu(
          'dienstTauschen'
        );


        schliesseNavigationNeu();


        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });


        return;
      }


      // ------------------------------------------------------
      // ABWESENHEITEN
      // ------------------------------------------------------

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


      // ------------------------------------------------------
      // MEINE ANFRAGEN
      // ------------------------------------------------------

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


      // ------------------------------------------------------
      // PIN
      // ------------------------------------------------------

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


      // ------------------------------------------------------
      // ADMIN
      // ------------------------------------------------------

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


      // ------------------------------------------------------
      // DIENST ÄNDERN
      // ------------------------------------------------------

      if (
        seite ===
        'dienstAendern'
      ) {

        versteckeAlleHauptAnsichtenNeu();


        const ansicht =
          document.getElementById(
            'dienstAendernAnsicht'
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


      // ------------------------------------------------------
      // SONSTIGER WUNSCH
      // ------------------------------------------------------

      if (
        seite ===
        'sonstigerWunsch'
      ) {

        versteckeAlleHauptAnsichtenNeu();


        const ansicht =
          document.getElementById(
            'sonstigerWunschAnsicht'
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


      // ------------------------------------------------------
      // FALLBACK
      // ------------------------------------------------------

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
          token: token
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
    'Bitte wende dich für einen PIN-Reset an Babsi.',
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
