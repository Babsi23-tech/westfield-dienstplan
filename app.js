// ==========================================================
// SCS TEAM – APP.JS
// ==========================================================

const API_URL =
  'https://script.google.com/macros/s/AKfycbxL-vdBIT5xLORL2k8xdNJXC4bRWt97X-QcvWQ5_bB1xXz083yntxCwimdaiqkoPMKBbg/exec';

const SESSION_KEY =
  'scs_team_session';

let aktuellerBenutzer = '';
let aktuellerAdmin = false;

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

    installiereMeineAnfragenNeu();
    installiereAdminBereichNeu();

    await starteApp();

    setTimeout(
      function() {
        aktualisiereAnfragenBadgeNeu();
      },
      150
    );

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

  const abwesenheitenListe =
    document.getElementById(
      'abwesenheitenListe'
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


    const adminNav =
      document.getElementById(
        'adminNav'
      );


    if (adminNav) {

      adminNav.style.display =
        aktuellerAdmin
          ? 'flex'
          : 'none';
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


    rendereDienstplan(
      Array.isArray(
        result.dienstplan
      )
        ? result.dienstplan
        : []
    );


    rendereAbwesenheiten(
      Array.isArray(
        result.abwesenheiten
      )
        ? result.abwesenheiten
        : []
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


    if (abwesenheitenListe) {

      abwesenheitenListe.innerHTML =
        '<div class="empty-state">Abwesenheiten konnten nicht geladen werden.</div>';
    }
  }
}


// ==========================================================
// DIENSTPLAN RENDERN
// ==========================================================

function rendereDienstplan(plan) {

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

    liste.innerHTML = `
      <div class="empty-state">
        Keine Dienste vorhanden.
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


      // ====================================================
      // GARDEN PLAZA FRÜH
      // ====================================================

      if (z.gpFrueh) {

        dienste.push({

          typ:
            'gp',

          symbol:
            '🌞',

          name:
            'Garden Plaza – Früh',

          code:
            'GP_FRUEH',

          zeit:
            zeitFruehNeu(
              z.tag
            ),

          tauschbar:
            true
        });
      }


      // ====================================================
      // GARDEN PLAZA SPÄT
      // ====================================================

      if (z.gpSpaet) {

        dienste.push({

          typ:
            'gp',

          symbol:
            '🌙',

          name:
            'Garden Plaza – Spät',

          code:
            'GP_SPAET',

          zeit:
            zeitSpaetNeu(
              z.tag
            ),

          tauschbar:
            true
        });
      }


      // ====================================================
      // WATER PLAZA
      // FRÜH + SPÄT = GANZTAG
      // ====================================================

      if (
        z.wpFrueh &&
        z.wpSpaet
      ) {

        dienste.push({

          typ:
            'wp',

          symbol:
            '🔵',

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

            typ:
              'wp',

            symbol:
              '🌞',

            name:
              'Water Plaza – Früh',

            code:
              'WP_FRUEH',

            zeit:
              zeitFruehNeu(
                z.tag
              ),

            tauschbar:
              true
          });
        }


        if (z.wpSpaet) {

          dienste.push({

            typ:
              'wp',

            symbol:
              '🌙',

            name:
              'Water Plaza – Spät',

            code:
              'WP_SPAET',

            zeit:
              zeitSpaetNeu(
                z.tag
              ),

            tauschbar:
              true
          });
        }
      }


      // ====================================================
      // GP PAUSENABLÖSE
      // ====================================================

      if (z.gpAbloese) {

        dienste.push({

          typ:
            'abloese',

          symbol:
            '🕒',

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


      // ====================================================
      // WP PAUSENABLÖSE
      //
      // Bei GP Spät gehört die WP-Pausenablöse automatisch
      // zum Spätdienst und bekommt keinen eigenen Tauschbutton.
      // ====================================================

      if (
        z.wpAbloese &&
        !z.gpSpaet
      ) {

        dienste.push({

          typ:
            'abloese',

          symbol:
            '🕒',

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


      // ====================================================
      // TAGSKARTE
      // ====================================================

      html += `
        <div
          class="panel"
          style="
            padding:18px;
            margin-bottom:12px;
          "
        >

          <div
            style="
              margin-bottom:10px;
            "
          >

            <strong
              style="
                font-size:17px;
              "
            >
              ${escapeHtmlNeu(
                z.tag || ''
              )},
              ${escapeHtmlNeu(
                z.datum || ''
              )}
            </strong>

            <div
              style="
                color:#666;
                font-size:13px;
                margin-top:4px;
              "
            >
              KW ${escapeHtmlNeu(
                z.kw || ''
              )}
            </div>

          </div>
      `;


      // ====================================================
      // DIENSTE
      // ====================================================

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

                  <div
                    style="
                      font-weight:700;
                    "
                  >
                    ${dienst.symbol}
                    ${escapeHtmlNeu(
                      dienst.name
                    )}
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
                          ${escapeHtmlNeu(
                            dienst.zeit
                          )}
                        </div>
                      `
                      : ''
                  }


                  ${
                    dienst.code ===
                      'GP_SPAET' &&
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
                            z.wpAbloesezeit ||
                            '30 Minuten'
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
                          ${JSON.stringify(
                            String(
                              z.datum || ''
                            )
                          )},
                          ${JSON.stringify(
                            String(
                              z.tag || ''
                            )
                          )},
                          ${JSON.stringify(
                            String(
                              z.kw || ''
                            )
                          )},
                          ${JSON.stringify(
                            String(
                              dienst.code || ''
                            )
                          )},
                          ${JSON.stringify(
                            String(
                              dienst.name || ''
                            )
                          )},
                          ${JSON.stringify(
                            String(
                              dienst.zeit || ''
                            )
                          )}
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


      // ====================================================
      // NOTIZ
      // ====================================================

      if (z.notiz) {

        html += `
          <div
            style="
              margin-top:10px;
              color:#666;
              font-size:14px;
            "
          >
            📝
            ${escapeHtmlNeu(
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
// ABWESENHEITEN RENDERN
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
            ${escapeHtmlNeu(
              status
            )}
          </strong>

          <div
            style="
              color:#666;
              margin-top:6px;
            "
          >
            ${escapeHtmlNeu(
              a.von || ''
            )}

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
        ${escapeHtmlNeu(
          tauschDatum
        )}
      </strong>

      <span>
        (${escapeHtmlNeu(
          tauschTag
        )})
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

      <div
        class="dienst-mini"
      >

        <div
          class="dienst-links"
        >

          <span
            class="
              punkt
              ${
                tauschDienstCode
                  .startsWith('GP')
                  ? 'gruen'
                  : 'blau'
              }
            "
          ></span>

          <span>
            ${escapeHtmlNeu(
              tauschDienstText
            )}
          </span>

        </div>

        <strong
          class="
            ${
              tauschDienstCode
                .startsWith('GP')
                ? 'gruen-text'
                : 'blau-text'
            }
          "
        >
          ${escapeHtmlNeu(
            aktuellerBenutzer
          )}
        </strong>

      </div>


      ${
        tauschDienstCode ===
        'GP_SPAET'
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
      tauschDienstCode
        .startsWith(
          'GP'
        );


    let symbol =
      '🔵';


    if (
      tauschDienstCode
        .includes(
          'FRUEH'
        )
    ) {

      symbol =
        '☀';
    }


    if (
      tauschDienstCode
        .includes(
          'SPAET'
        )
    ) {

      symbol =
        '☾';
    }


    dienstAuswahl.innerHTML = `
      <button
        class="
          dienst-option
          ausgewaehlt
        "
        type="button"
      >

        <span
          class="
            radio
            aktiv
          "
        ></span>

        <div
          class="dienst-symbol"
        >
          ${symbol}
        </div>

        <div
          class="dienst-option-text"
        >

          <strong
            class="
              ${
                istGp
                  ? 'gruen-text'
                  : 'blau-text'
              }
            "
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
            class="
              status-chip
              ${
                istGp
                  ? 'gruen-chip'
                  : 'blau-chip'
              }
            "
          >
            Du bist eingetragen
          </small>

        </div>

      </button>
    `;
  }


  const buttons =
    ansicht.querySelectorAll(
      'button'
    );


  buttons.forEach(
    function(button) {

      const text =
        String(
          button.textContent || ''
        )
          .toLowerCase();


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

    kollegenBereich
      .classList
      .add(
        'versteckt'
      );


    kollegenBereich.innerHTML =
      '';
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
      ${escapeHtmlNeu(
        tauschDatum
      )}
      werden geladen …
    </p>
  `;


  bereich.scrollIntoView({
    behavior:
      'smooth'
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
      kandidaten.filter(
        function(k) {

          return (
            String(
              k.mitarbeiter || ''
            ).trim()
            !==
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
          Für diesen Tag wurden
          keine anderen tauschbaren
          Dienste gefunden.
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
              .toLowerCase()
            ===
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
              .toLowerCase()
            ===
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
              .trim()
              .toLowerCase()
            ===
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
              .trim()
              .toLowerCase();


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
        Mit wem möchtest du
        deinen Dienst tauschen?
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


    html += `
      </div>


      <div
        id="tauschSchritt4"
        style="
          display:none;
          margin-top:24px;
          padding-top:20px;
          border-top:1px solid #e0e0e0;
        "
      >

        <h2>
          4. Anfrage senden
        </h2>


        <p class="beschreibung">
          Prüfe den Tausch und sende
          anschließend die Anfrage
          an deinen Kollegen.
        </p>


        <div
          id="tauschZusammenfassung"
          style="
            background:#f7f7f8;
            border:1px solid #e1e4e8;
            border-radius:10px;
            padding:15px;
            margin-top:14px;
          "
        ></div>


        <div
          style="
            margin-top:16px;
          "
        >

          <label
            for="tauschNachricht"
            style="
              display:block;
              font-weight:700;
              margin-bottom:7px;
            "
          >
            Nachricht

            <span
              style="
                font-weight:400;
                color:#777;
              "
            >
              (optional)
            </span>
          </label>


          <textarea
            id="tauschNachricht"
            maxlength="500"
            placeholder="Zum Beispiel: Kannst du meinen Dienst übernehmen?"
            style="
              width:100%;
              box-sizing:border-box;
              min-height:90px;
              resize:vertical;
              border:1px solid #ccd0d5;
              border-radius:8px;
              padding:10px;
              font-family:inherit;
              font-size:14px;
            "
          ></textarea>

        </div>


        <div
          id="tauschSendenMeldung"
          style="
            display:none;
            margin-top:14px;
            padding:11px 12px;
            border-radius:8px;
          "
        ></div>


        <button
          id="tauschSendenButton"
          type="button"
          onclick="sendeTauschAnfrageNeu()"
          style="
            margin-top:16px;
            border:0;
            background:#e30613;
            color:#ffffff;
            border-radius:8px;
            padding:11px 16px;
            font-weight:700;
            cursor:pointer;
          "
        >
          📤 Tauschanfrage senden
        </button>

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
        style="
          color:#b00020;
        "
      >
        ❌
        ${escapeHtmlNeu(
          error.message
        )}
      </p>
    `;
  }
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
      class="
        kollegen-box
        ${escapeHtmlNeu(
          klasse
        )}
      "
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
        <label
          class="kollege"
        >

          <input
            type="radio"
            name="kollege"

            value="${escapeHtmlNeu(
              code
            )}"

            data-name="${escapeHtmlNeu(
              name
            )}"

            data-dienst="${escapeHtmlNeu(
              dienst
            )}"

            onchange="waehleTauschpartnerNeu(this)"
          >


          <span>
            ${escapeHtmlNeu(
              name
            )}
          </span>


          <strong>
            ${escapeHtmlNeu(
              dienst
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
// TAUSCHPARTNER AUSWÄHLEN
// ==========================================================

function waehleTauschpartnerNeu(
  radio
) {

  if (!radio) {
    return;
  }


  const schritt4 =
    document.getElementById(
      'tauschSchritt4'
    );


  const zusammenfassung =
    document.getElementById(
      'tauschZusammenfassung'
    );


  const meldung =
    document.getElementById(
      'tauschSendenMeldung'
    );


  if (!schritt4) {
    return;
  }


  const partnerName =
    String(
      radio.dataset.name || ''
    ).trim();


  const partnerDienst =
    String(
      radio.dataset.dienst || ''
    ).trim();


  schritt4.style.display =
    'block';


  if (meldung) {

    meldung.style.display =
      'none';

    meldung.textContent =
      '';
  }


  if (zusammenfassung) {

    zusammenfassung.innerHTML = `

      <div
        style="
          margin-bottom:10px;
        "
      >
        <strong>
          📅 Datum:
        </strong>

        ${escapeHtmlNeu(
          tauschDatum
        )}

        (${escapeHtmlNeu(
          tauschTag
        )})
      </div>


      <div
        style="
          margin-bottom:10px;
        "
      >
        <strong>
          Dein Dienst:
        </strong>

        ${escapeHtmlNeu(
          tauschDienstText
        )}
      </div>


      <div
        style="
          margin-bottom:10px;
        "
      >
        <strong>
          Tauschpartner:
        </strong>

        ${escapeHtmlNeu(
          partnerName
        )}
      </div>


      <div>
        <strong>
          Dienst des Kollegen:
        </strong>

        ${escapeHtmlNeu(
          partnerDienst
        )}
      </div>


      ${
        tauschDienstCode ===
        'GP_SPAET'
          ? `
            <div
              style="
                margin-top:12px;
                color:#8a5a00;
                font-size:13px;
              "
            >
              ☕ Die WP-Pausenablöse
              des GP-Spätdienstes wird
              bei der endgültigen
              Genehmigung automatisch
              mitgeführt.
            </div>
          `
          : ''
      }
    `;
  }


  schritt4.scrollIntoView({
    behavior:
      'smooth',

    block:
      'start'
  });
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


  const nachrichtElement =
    document.getElementById(
      'tauschNachricht'
    );


  if (!ausgewaehlt) {

    zeigeTauschSendenMeldung(
      'Bitte zuerst einen Kollegen auswählen.',
      false
    );

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


  const token =
    localStorage.getItem(
      SESSION_KEY
    );


  if (!token) {

    zeigeTauschSendenMeldung(
      'Deine Anmeldung ist abgelaufen. Bitte neu anmelden.',
      false
    );

    return;
  }


  if (
    !tauschDatum ||
    !tauschDienstCode ||
    !partnerName ||
    !partnerDienstCode
  ) {

    zeigeTauschSendenMeldung(
      'Die Tauschanfrage ist unvollständig.',
      false
    );

    return;
  }


  if (button) {

    button.disabled =
      true;

    button.textContent =
      '⏳ Anfrage wird gesendet …';

    button.style.opacity =
      '0.7';

    button.style.cursor =
      'wait';
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


    if (
      !result ||
      !result.ok
    ) {

      throw new Error(
        result?.message ||
        'Die Tauschanfrage konnte nicht gespeichert werden.'
      );
    }


    zeigeTauschSendenMeldung(
      result.message ||
      (
        'Die Tauschanfrage wurde an ' +
        partnerName +
        ' gesendet.'
      ),
      true
    );


    document
      .querySelectorAll(
        'input[name="kollege"]'
      )
      .forEach(
        function(radio) {

          radio.disabled =
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

      button.textContent =
        '✅ Tauschanfrage gesendet';

      button.style.opacity =
        '1';

      button.style.cursor =
        'default';
    }


    await aktualisiereAnfragenBadgeNeu();


  } catch (error) {

    console.error(
      'Tauschanfrage senden:',
      error
    );


    zeigeTauschSendenMeldung(
      '❌ ' +
      error.message,
      false
    );


    if (button) {

      button.disabled =
        false;

      button.textContent =
        '📤 Tauschanfrage senden';

      button.style.opacity =
        '1';

      button.style.cursor =
        'pointer';
    }
  }
}


// ==========================================================
// MELDUNG BEIM SENDEN
// ==========================================================

function zeigeTauschSendenMeldung(
  text,
  erfolg
) {

  const meldung =
    document.getElementById(
      'tauschSendenMeldung'
    );


  if (!meldung) {

    alert(
      text
    );

    return;
  }


  meldung.style.display =
    'block';


  meldung.textContent =
    text;


  if (erfolg) {

    meldung.style.background =
      '#eaf7ee';

    meldung.style.border =
      '1px solid #9bd3aa';

    meldung.style.color =
      '#176b2c';

  } else {

    meldung.style.background =
      '#fff0f0';

    meldung.style.border =
      '1px solid #e3aaaa';

    meldung.style.color =
      '#a00000';
  }
}


// ==========================================================
// SEITE "MEINE ANFRAGEN" ERZEUGEN
// ==========================================================

function installiereMeineAnfragenNeu() {

  const content =
    document.querySelector(
      'main.content'
    );


  if (
    content &&
    !document.getElementById(
      'anfragenAnsicht'
    )
  ) {

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
            Hier siehst du deine
            gesendeten und erhaltenen
            Tauschanfragen.
          </p>

        </div>

      </div>


      <div
        id="anfragenMeldungNeu"
        style="
          display:none;
          margin-bottom:14px;
          padding:12px 14px;
          border-radius:9px;
        "
      ></div>


      <div
        id="anfragenLadenNeu"
        style="
          color:#666;
          padding:12px 0;
        "
      ></div>


      <div
        id="anfragenListeNeu"
      ></div>
    `;


    content.appendChild(
      section
    );
  }
}


// ==========================================================
// MEINE TAUSCHANFRAGEN LADEN
// ==========================================================

async function ladeMeineTauschAnfragenNeu() {

  const token =
    localStorage.getItem(
      SESSION_KEY
    );


  const laden =
    document.getElementById(
      'anfragenLadenNeu'
    );


  const liste =
    document.getElementById(
      'anfragenListeNeu'
    );


  if (!token) {

    await logoutAusfuehren();

    return;
  }


  if (laden) {

    laden.style.display =
      'block';

    laden.style.color =
      '#666';

    laden.textContent =
      'Anfragen werden geladen …';
  }


  if (liste) {

    liste.innerHTML =
      '';
  }


  try {

    const result =
      await apiPost(
        'tauschAnfragen',
        {
          token:
            token
        }
      );


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


    if (
      !result ||
      !result.ok
    ) {

      throw new Error(
        result?.message ||
        'Die Tauschanfragen konnten nicht geladen werden.'
      );
    }


    rendereMeineTauschAnfragenNeu(
      result
    );


    if (laden) {

      laden.style.display =
        'none';
    }


    await aktualisiereAnfragenBadgeNeu();


  } catch (error) {

    console.error(
      'Meine Tauschanfragen:',
      error
    );


    if (laden) {

      laden.style.display =
        'block';

      laden.style.color =
        '#b00020';

      laden.textContent =
        '❌ ' +
        error.message;
    }
  }
}


// ==========================================================
// MEINE TAUSCHANFRAGEN ANZEIGEN
// ==========================================================

function rendereMeineTauschAnfragenNeu(
  result
) {

  const liste =
    document.getElementById(
      'anfragenListeNeu'
    );


  if (!liste) {
    return;
  }


  const erhalten =
    Array.isArray(
      result.erhalten
    )
      ? result.erhalten
      : [];


  const gesendet =
    Array.isArray(
      result.gesendet
    )
      ? result.gesendet
      : [];


  let html =
    '';


  // ========================================================
  // ERHALTENE
  // ========================================================

  html += `
    <div
      class="panel"
      style="
        padding:18px;
        margin-bottom:18px;
      "
    >

      <h2
        style="
          margin-top:0;
          margin-bottom:6px;
        "
      >
        📥 Erhaltene Tauschanfragen
      </h2>

      <p
        style="
          color:#666;
          margin-top:0;
        "
      >
        Hier kannst du Anfragen
        annehmen oder ablehnen.
      </p>
  `;


  if (
    erhalten.length === 0
  ) {

    html += `
      <div
        style="
          background:#f7f7f8;
          border-radius:9px;
          padding:14px;
          color:#666;
        "
      >
        Du hast aktuell keine
        erhaltenen Tauschanfragen.
      </div>
    `;

  } else {

    erhalten.forEach(
      function(anfrage) {

        html +=
          baueTauschAnfrageKarteNeu(
            anfrage,
            true
          );
      }
    );
  }


  html +=
    '</div>';


  // ========================================================
  // GESENDETE
  // ========================================================

  html += `
    <div
      class="panel"
      style="
        padding:18px;
        margin-bottom:18px;
      "
    >

      <h2
        style="
          margin-top:0;
          margin-bottom:6px;
        "
      >
        📤 Gesendete Tauschanfragen
      </h2>

      <p
        style="
          color:#666;
          margin-top:0;
        "
      >
        Hier siehst du den aktuellen
        Stand deiner Anfragen.
      </p>
  `;


  if (
    gesendet.length === 0
  ) {

    html += `
      <div
        style="
          background:#f7f7f8;
          border-radius:9px;
          padding:14px;
          color:#666;
        "
      >
        Du hast noch keine
        Tauschanfrage gesendet.
      </div>
    `;

  } else {

    gesendet.forEach(
      function(anfrage) {

        html +=
          baueTauschAnfrageKarteNeu(
            anfrage,
            false
          );
      }
    );
  }


  html +=
    '</div>';


  liste.innerHTML =
    html;
}


// ==========================================================
// TAUSCHANFRAGE-KARTE
// ==========================================================

function baueTauschAnfrageKarteNeu(
  anfrage,
  istErhalten
) {

  const gesamtstatus =
    String(
      anfrage.gesamtstatus || ''
    )
      .trim()
      .toUpperCase();


  const mitarbeiterStatus =
    String(
      anfrage.mitarbeiterStatus || ''
    )
      .trim()
      .toUpperCase();


  const status =
    statusTauschAnfrageNeu(
      anfrage
    );


  const offenFuerKollegen =
    istErhalten &&
    mitarbeiterStatus === 'OFFEN' &&
    gesamtstatus === 'WARTET_AUF_KOLLEGEN';


  let html = `
    <div
      style="
        border:1px solid #e0e3e7;
        border-radius:11px;
        padding:15px;
        margin-top:12px;
        background:#ffffff;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:10px;
          flex-wrap:wrap;
        "
      >

        <strong>
          📅
          ${escapeHtmlNeu(
            anfrage.datum || ''
          )}

          ${
            anfrage.kw
              ? ' · KW ' +
                escapeHtmlNeu(
                  anfrage.kw
                )
              : ''
          }
        </strong>


        <div
          style="
            padding:5px 9px;
            border-radius:999px;
            font-size:12px;
            font-weight:700;
            background:${status.hintergrund};
            color:${status.farbe};
          "
        >
          ${status.text}
        </div>

      </div>


      <div
        style="
          margin-top:12px;
        "
      >
  `;


  if (istErhalten) {

    html += `
      <div>
        <strong>
          👤 Von:
        </strong>

        ${escapeHtmlNeu(
          anfrage.anfragender || ''
        )}
      </div>


      <div
        style="
          margin-top:10px;
          background:#f7f7f8;
          border-radius:9px;
          padding:12px;
        "
      >

        <div>
          <strong>
            Dein Dienst:
          </strong>

          <br>

          ${escapeHtmlNeu(
            entferneDienstSymbol(
              anfrage.partnerDienst || ''
            )
          )}
        </div>


        <div
          style="
            margin-top:8px;
          "
        >
          <strong>
            Dienst von
            ${escapeHtmlNeu(
              anfrage.anfragender || ''
            )}:
          </strong>

          <br>

          ${escapeHtmlNeu(
            entferneDienstSymbol(
              anfrage.eigenerDienst || ''
            )
          )}
        </div>

      </div>
    `;

  } else {

    html += `
      <div>
        <strong>
          👤 An:
        </strong>

        ${escapeHtmlNeu(
          anfrage.partner || ''
        )}
      </div>


      <div
        style="
          margin-top:10px;
          background:#f7f7f8;
          border-radius:9px;
          padding:12px;
        "
      >

        <div>
          <strong>
            Dein Dienst:
          </strong>

          <br>

          ${escapeHtmlNeu(
            entferneDienstSymbol(
              anfrage.eigenerDienst || ''
            )
          )}
        </div>


        <div
          style="
            margin-top:8px;
          "
        >
          <strong>
            Dienst von
            ${escapeHtmlNeu(
              anfrage.partner || ''
            )}:
          </strong>

          <br>

          ${escapeHtmlNeu(
            entferneDienstSymbol(
              anfrage.partnerDienst || ''
            )
          )}
        </div>

      </div>
    `;
  }


  if (
    String(
      anfrage.nachricht || ''
    ).trim()
  ) {

    html += `
      <div
        style="
          border-left:4px solid #e30613;
          padding:8px 11px;
          background:#fffafa;
          border-radius:0 8px 8px 0;
          margin-top:10px;
        "
      >
        <strong>
          💬 Nachricht
        </strong>

        <div
          style="
            margin-top:5px;
          "
        >
          ${escapeHtmlNeu(
            anfrage.nachricht
          )}
        </div>
      </div>
    `;
  }


  if (
    anfrage.zeitstempel
  ) {

    html += `
      <div
        style="
          color:#888;
          font-size:12px;
          margin-top:10px;
        "
      >
        Gesendet:
        ${escapeHtmlNeu(
          anfrage.zeitstempel
        )}
      </div>
    `;
  }


  html +=
    '</div>';


  if (
    offenFuerKollegen
  ) {

    html += `
      <div
        style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:15px;
        "
      >

        <button
          id="tauschAnnehmen_${Number(
            anfrage.zeile
          )}"
          type="button"

          onclick="bearbeiteTauschAnfrageNeu(
            ${Number(
              anfrage.zeile
            )},
            true
          )"

          style="
            border:0;
            background:#188038;
            color:#ffffff;
            border-radius:8px;
            padding:10px 15px;
            font-weight:700;
            cursor:pointer;
          "
        >
          ✅ Annehmen
        </button>


        <button
          id="tauschAblehnen_${Number(
            anfrage.zeile
          )}"
          type="button"

          onclick="bearbeiteTauschAnfrageNeu(
            ${Number(
              anfrage.zeile
            )},
            false
          )"

          style="
            border:1px solid #d93025;
            background:#ffffff;
            color:#d93025;
            border-radius:8px;
            padding:10px 15px;
            font-weight:700;
            cursor:pointer;
          "
        >
          ❌ Ablehnen
        </button>

      </div>
    `;
  }


  html +=
    '</div>';


  return html;
}


// ==========================================================
// STATUS
// ==========================================================

function statusTauschAnfrageNeu(
  anfrage
) {

  const gesamtstatus =
    String(
      anfrage.gesamtstatus || ''
    )
      .trim()
      .toUpperCase();


  const mitarbeiterStatus =
    String(
      anfrage.mitarbeiterStatus || ''
    )
      .trim()
      .toUpperCase();


  const adminStatus =
    String(
      anfrage.adminStatus || ''
    )
      .trim()
      .toUpperCase();


  if (
    gesamtstatus ===
    'WARTET_AUF_KOLLEGEN'
  ) {

    return {
      text:
        '🟡 Wartet auf Antwort',

      hintergrund:
        '#fff4ce',

      farbe:
        '#7a4f00'
    };
  }


  if (
    gesamtstatus ===
    'WARTET_AUF_ADMIN'
  ) {

    return {
      text:
        '🟠 Wartet auf Babsi',

      hintergrund:
        '#fff0dc',

      farbe:
        '#8a4b00'
    };
  }


  if (
    gesamtstatus === 'ABGELEHNT' ||
    mitarbeiterStatus === 'ABGELEHNT' ||
    adminStatus === 'ABGELEHNT'
  ) {

    return {
      text:
        '🔴 Abgelehnt',

      hintergrund:
        '#fdecec',

      farbe:
        '#b00020'
    };
  }


  if (
    gesamtstatus === 'GENEHMIGT' ||
    adminStatus === 'GENEHMIGT'
  ) {

    return {
      text:
        '🟢 Genehmigt',

      hintergrund:
        '#e7f6ec',

      farbe:
        '#176b2c'
    };
  }


  if (
    mitarbeiterStatus ===
    'ZUGESTIMMT'
  ) {

    return {
      text:
        '🟠 Kollege hat zugestimmt',

      hintergrund:
        '#fff0dc',

      farbe:
        '#8a4b00'
    };
  }


  return {
    text:
      '⚪ In Bearbeitung',

    hintergrund:
      '#f1f3f4',

    farbe:
      '#555555'
  };
}


// ==========================================================
// ANNEHMEN / ABLEHNEN
// ==========================================================

async function bearbeiteTauschAnfrageNeu(
  zeile,
  genehmigen
) {

  zeile =
    Number(
      zeile
    );


  if (!zeile) {
    return;
  }


  const token =
    localStorage.getItem(
      SESSION_KEY
    );


  if (!token) {

    await logoutAusfuehren();

    return;
  }


  const annehmenButton =
    document.getElementById(
      'tauschAnnehmen_' +
      zeile
    );


  const ablehnenButton =
    document.getElementById(
      'tauschAblehnen_' +
      zeile
    );


  if (annehmenButton) {

    annehmenButton.disabled =
      true;
  }


  if (ablehnenButton) {

    ablehnenButton.disabled =
      true;
  }


  try {

    const result =
      await apiPost(
        'tauschAnfrageBearbeiten',
        {
          token:
            token,

          zeile:
            zeile,

          genehmigen:
            genehmigen === true
        }
      );


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


    if (
      !result ||
      !result.ok
    ) {

      throw new Error(
        result?.message ||
        'Die Tauschanfrage konnte nicht bearbeitet werden.'
      );
    }


    zeigeAnfragenMeldungNeu(
      '✅ ' +
      (
        result.message ||
        (
          genehmigen
            ? 'Tauschanfrage angenommen.'
            : 'Tauschanfrage abgelehnt.'
        )
      ),
      true
    );


    await ladeMeineTauschAnfragenNeu();


  } catch (error) {

    console.error(
      'Tauschanfrage bearbeiten:',
      error
    );


    zeigeAnfragenMeldungNeu(
      '❌ ' +
      error.message,
      false
    );


    if (annehmenButton) {

      annehmenButton.disabled =
        false;

      annehmenButton.textContent =
        '✅ Annehmen';
    }


    if (ablehnenButton) {

      ablehnenButton.disabled =
        false;

      ablehnenButton.textContent =
        '❌ Ablehnen';
    }
  }
}


// ==========================================================
// MELDUNG "MEINE ANFRAGEN"
// ==========================================================

function zeigeAnfragenMeldungNeu(
  text,
  erfolg
) {

  const meldung =
    document.getElementById(
      'anfragenMeldungNeu'
    );


  if (!meldung) {
    return;
  }


  meldung.style.display =
    'block';


  meldung.textContent =
    text;


  if (erfolg) {

    meldung.style.background =
      '#eaf7ee';

    meldung.style.border =
      '1px solid #9bd3aa';

    meldung.style.color =
      '#176b2c';

  } else {

    meldung.style.background =
      '#fff0f0';

    meldung.style.border =
      '1px solid #e3aaaa';

    meldung.style.color =
      '#a00000';
  }
}


// ==========================================================
// BADGE "MEINE ANFRAGEN"
// ==========================================================

async function aktualisiereAnfragenBadgeNeu() {

  const token =
    localStorage.getItem(
      SESSION_KEY
    );


  const badge =
    document.getElementById(
      'anfragenBadge'
    );


  if (
    !token ||
    !badge
  ) {

    return;
  }


  try {

    const result =
      await apiPost(
        'tauschAnfragen',
        {
          token:
            token
        }
      );


    if (
      !result ||
      !result.ok
    ) {

      return;
    }


    const erhalten =
      Array.isArray(
        result.erhalten
      )
        ? result.erhalten
        : [];


    const offen =
      erhalten.filter(
        function(a) {

          return (
            String(
              a.mitarbeiterStatus || ''
            )
              .trim()
              .toUpperCase()
            ===
            'OFFEN'
            &&
            String(
              a.gesamtstatus || ''
            )
              .trim()
              .toUpperCase()
            ===
            'WARTET_AUF_KOLLEGEN'
          );
        }
      ).length;


    if (
      offen > 0
    ) {

      badge.textContent =
        String(
          offen
        );


      badge.style.display =
        'inline-flex';

    } else {

      badge.textContent =
        '0';


      badge.style.display =
        'none';
    }


  } catch (error) {

    console.error(
      'Anfragen-Badge:',
      error
    );
  }
}

// ==========================================================
// ADMIN-BEREICH ERZEUGEN
// ==========================================================

function installiereAdminBereichNeu() {

  const content =
    document.querySelector(
      'main.content'
    );


  if (
    content &&
    !document.getElementById(
      'adminAnsicht'
    )
  ) {

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
            🛡 Admin-Bereich
          </h1>

          <p>
            Hier genehmigt oder lehnt
            Babsi Tauschanfragen endgültig ab.
          </p>

        </div>

      </div>


      <div
        id="adminMeldungNeu"
        style="
          display:none;
          margin-bottom:14px;
          padding:12px 14px;
          border-radius:9px;
        "
      ></div>


      <div
        id="adminLadenNeu"
        style="
          color:#666;
          padding:12px 0;
        "
      ></div>


      <div
        id="adminListeNeu"
      ></div>
    `;


    content.appendChild(
      section
    );
  }


  // ========================================================
  // ADMIN-BADGE
  // ========================================================

  const adminNav =
    document.getElementById(
      'adminNav'
    );


  if (
    adminNav &&
    !document.getElementById(
      'adminBadgeNeu'
    )
  ) {

    const badge =
      document.createElement(
        'span'
      );


    badge.id =
      'adminBadgeNeu';


    badge.className =
      'badge';


    badge.style.display =
      'none';


    badge.textContent =
      '0';


    adminNav.appendChild(
      badge
    );
  }


  // ========================================================
  // BESTEHENDE NAVIGATION ERWEITERN
  // ========================================================

  const bisherigeZeigeSeite =
    typeof window.zeigeSeite ===
      'function'
      ? window.zeigeSeite
      : null;


  window.zeigeSeite =
    function(seite) {

      const anfragen =
        document.getElementById(
          'anfragenAnsicht'
        );


      const admin =
        document.getElementById(
          'adminAnsicht'
        );


      // ====================================================
      // MEINE ANFRAGEN
      // ====================================================

      if (
        seite === 'anfragen'
      ) {

        versteckeStandardAnsichtenNeu();


        if (admin) {

          admin.style.display =
            'none';
        }


        if (anfragen) {

          anfragen.style.display =
            'block';
        }


        markiereNavigationNeu(
          'anfragen'
        );


        ladeMeineTauschAnfragenNeu();


        schliesseMobileNavigationNeu();


        return;
      }


      // ====================================================
      // ADMIN
      // ====================================================

      if (
        seite === 'admin'
      ) {

        versteckeStandardAnsichtenNeu();


        if (anfragen) {

          anfragen.style.display =
            'none';
        }


        if (admin) {

          admin.style.display =
            'block';
        }


        markiereNavigationNeu(
          'admin'
        );


        if (
          !aktuellerAdmin
        ) {

          const laden =
            document.getElementById(
              'adminLadenNeu'
            );


          const liste =
            document.getElementById(
              'adminListeNeu'
            );


          if (laden) {

            laden.style.display =
              'block';

            laden.style.color =
              '#b00020';

            laden.textContent =
              '❌ Keine Admin-Berechtigung.';
          }


          if (liste) {

            liste.innerHTML =
              '';
          }

        } else {

          ladeAdminTauschAnfragenNeu();
        }


        schliesseMobileNavigationNeu();


        return;
      }


      // ====================================================
      // DYNAMISCHE SEITEN AUSBLENDEN
      // ====================================================

      if (anfragen) {

        anfragen.style.display =
          'none';
      }


      if (admin) {

        admin.style.display =
          'none';
      }


      // Alte Navigation weiterverwenden
      if (
        bisherigeZeigeSeite
      ) {

        bisherigeZeigeSeite(
          seite
        );
      }
    };
}


// ==========================================================
// STANDARD-ANSICHTEN AUSBLENDEN
// ==========================================================

function versteckeStandardAnsichtenNeu() {

  const dienstplan =
    document.getElementById(
      'dienstplanAnsicht'
    );


  const tausch =
    document.getElementById(
      'tauschAnsicht'
    );


  if (dienstplan) {

    dienstplan.style.display =
      'none';
  }


  if (tausch) {

    tausch.style.display =
      'none';
  }
}


// ==========================================================
// NAVIGATION MARKIEREN
// ==========================================================

function markiereNavigationNeu(
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


  const button =
    document.querySelector(
      `[onclick="zeigeSeite('${seite}')"]`
    );


  if (button) {

    button.classList.add(
      'aktiv'
    );
  }
}


// ==========================================================
// MOBILE NAVIGATION SCHLIESSEN
// ==========================================================

function schliesseMobileNavigationNeu() {

  if (
    window.innerWidth <= 900
  ) {

    const sidebar =
      document.getElementById(
        'sidebar'
      );


    if (sidebar) {

      sidebar.classList.remove(
        'mobile-offen'
      );
    }
  }
}


// ==========================================================
// ADMIN-TAUSCHANFRAGEN LADEN
// ==========================================================

async function ladeAdminTauschAnfragenNeu() {

  const token =
    localStorage.getItem(
      SESSION_KEY
    );


  const laden =
    document.getElementById(
      'adminLadenNeu'
    );


  const liste =
    document.getElementById(
      'adminListeNeu'
    );


  if (!token) {

    await logoutAusfuehren();

    return;
  }


  if (laden) {

    laden.style.display =
      'block';

    laden.style.color =
      '#666';

    laden.textContent =
      'Offene Tauschanfragen werden geladen …';
  }


  if (liste) {

    liste.innerHTML =
      '';
  }


  try {

    const result =
      await apiPost(
        'adminTauschAnfragen',
        {
          token:
            token
        }
      );


    if (
      !result ||
      !result.ok
    ) {

      throw new Error(
        result?.message ||
        'Admin-Tauschanfragen konnten nicht geladen werden.'
      );
    }


    const anfragen =
      Array.isArray(
        result.anfragen
      )
        ? result.anfragen
        : [];


    rendereAdminTauschAnfragenNeu(
      anfragen
    );


    setzeAdminBadgeNeu(
      anfragen.length
    );


    if (laden) {

      laden.style.display =
        'none';
    }


  } catch (error) {

    console.error(
      'Admin-Tauschanfragen:',
      error
    );


    if (laden) {

      laden.style.display =
        'block';

      laden.style.color =
        '#b00020';

      laden.textContent =
        '❌ ' +
        error.message;
    }
  }
}


// ==========================================================
// ADMIN-ANFRAGEN ANZEIGEN
// ==========================================================

function rendereAdminTauschAnfragenNeu(
  anfragen
) {

  const liste =
    document.getElementById(
      'adminListeNeu'
    );


  if (!liste) {
    return;
  }


  let html = `

    <div
      class="panel"
      style="
        padding:18px;
        margin-bottom:18px;
      "
    >

      <h2
        style="
          margin-top:0;
          margin-bottom:6px;
        "
      >
        🔄 Offene Diensttausche
      </h2>


      <p
        style="
          color:#666;
          margin-top:0;
          margin-bottom:16px;
        "
      >
        Diese Tausche wurden bereits
        vom Tauschpartner bestätigt
        und warten auf deine endgültige
        Entscheidung.
      </p>
  `;


  if (
    !anfragen ||
    anfragen.length === 0
  ) {

    html += `

      <div
        style="
          background:#f7f7f8;
          border-radius:9px;
          padding:14px;
          color:#666;
        "
      >
        ✅ Aktuell wartet keine
        Tauschanfrage auf deine Freigabe.
      </div>
    `;

  } else {

    anfragen.forEach(
      function(anfrage) {

        html +=
          baueAdminTauschKarteNeu(
            anfrage
          );
      }
    );
  }


  html +=
    '</div>';


  liste.innerHTML =
    html;
}


// ==========================================================
// ADMIN-TAUSCHKARTE
// ==========================================================

function baueAdminTauschKarteNeu(
  anfrage
) {

  const zeile =
    Number(
      anfrage.zeile || 0
    );


  return `

    <div
      style="
        border:1px solid #e0e3e7;
        border-radius:11px;
        padding:15px;
        margin-top:12px;
        background:#ffffff;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:10px;
          flex-wrap:wrap;
        "
      >

        <strong>
          📅
          ${escapeHtmlNeu(
            anfrage.datum || ''
          )}

          ${
            anfrage.kw
              ? ' · KW ' +
                escapeHtmlNeu(
                  anfrage.kw
                )
              : ''
          }
        </strong>


        <div
          style="
            padding:5px 9px;
            border-radius:999px;
            font-size:12px;
            font-weight:700;
            background:#fff0dc;
            color:#8a4b00;
          "
        >
          🟠 Wartet auf Babsi
        </div>

      </div>


      <div
        style="
          margin-top:13px;
        "
      >
        <strong>
          👥 Tausch:
        </strong>

        ${escapeHtmlNeu(
          anfrage.anfragender || ''
        )}

        ↔

        ${escapeHtmlNeu(
          anfrage.partner || ''
        )}
      </div>


      <div
        style="
          margin-top:10px;
          background:#f7f7f8;
          border-radius:9px;
          padding:12px;
        "
      >

        <div>

          <strong>
            ${escapeHtmlNeu(
              anfrage.anfragender || ''
            )}:
          </strong>

          <br>

          ${escapeHtmlNeu(
            entferneDienstSymbol(
              anfrage.eigenerDienst || ''
            )
          )}

        </div>


        <div
          style="
            margin-top:9px;
          "
        >

          <strong>
            ${escapeHtmlNeu(
              anfrage.partner || ''
            )}:
          </strong>

          <br>

          ${escapeHtmlNeu(
            entferneDienstSymbol(
              anfrage.partnerDienst || ''
            )
          )}

        </div>

      </div>


      ${
        String(
          anfrage.nachricht || ''
        ).trim()
          ? `

            <div
              style="
                border-left:4px solid #e30613;
                padding:8px 11px;
                background:#fffafa;
                border-radius:0 8px 8px 0;
                margin-top:10px;
              "
            >

              <strong>
                💬 Nachricht
              </strong>

              <div
                style="
                  margin-top:5px;
                "
              >
                ${escapeHtmlNeu(
                  anfrage.nachricht || ''
                )}
              </div>

            </div>
          `
          : ''
      }


      <div
        style="
          margin-top:12px;
          color:#666;
          font-size:13px;
        "
      >
        ℹ️ Erst mit deiner Genehmigung
        wird der Dienstplan tatsächlich
        geändert.
      </div>


      <div
        style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:15px;
        "
      >

        <button
          id="adminGenehmigen_${zeile}"
          type="button"

          onclick="bearbeiteAdminTauschNeu(
            ${zeile},
            true
          )"

          style="
            border:0;
            background:#188038;
            color:#ffffff;
            border-radius:8px;
            padding:10px 15px;
            font-weight:700;
            cursor:pointer;
          "
        >
          ✅ Tausch genehmigen
        </button>


        <button
          id="adminAblehnen_${zeile}"
          type="button"

          onclick="bearbeiteAdminTauschNeu(
            ${zeile},
            false
          )"

          style="
            border:1px solid #d93025;
            background:#ffffff;
            color:#d93025;
            border-radius:8px;
            padding:10px 15px;
            font-weight:700;
            cursor:pointer;
          "
        >
          ❌ Tausch ablehnen
        </button>

      </div>

    </div>
  `;
}


// ==========================================================
// ADMIN GENEHMIGT / LEHNT AB
// ==========================================================

async function bearbeiteAdminTauschNeu(
  zeile,
  genehmigen
) {

  zeile =
    Number(
      zeile
    );


  if (!zeile) {
    return;
  }


  const token =
    localStorage.getItem(
      SESSION_KEY
    );


  if (!token) {

    await logoutAusfuehren();

    return;
  }


  const genehmigenButton =
    document.getElementById(
      'adminGenehmigen_' +
      zeile
    );


  const ablehnenButton =
    document.getElementById(
      'adminAblehnen_' +
      zeile
    );


  if (genehmigenButton) {

    genehmigenButton.disabled =
      true;
  }


  if (ablehnenButton) {

    ablehnenButton.disabled =
      true;
  }


  if (
    genehmigen &&
    genehmigenButton
  ) {

    genehmigenButton.textContent =
      '⏳ Wird genehmigt …';
  }


  if (
    !genehmigen &&
    ablehnenButton
  ) {

    ablehnenButton.textContent =
      '⏳ Wird abgelehnt …';
  }


  try {

    const result =
      await apiPost(
        'adminTauschAnfrageBearbeiten',
        {
          token:
            token,

          zeile:
            zeile,

          genehmigen:
            genehmigen === true
        }
      );


    if (
      !result ||
      !result.ok
    ) {

      throw new Error(
        result?.message ||
        'Die Admin-Entscheidung konnte nicht gespeichert werden.'
      );
    }


    zeigeAdminMeldungNeu(
      '✅ ' +
      (
        result.message ||
        (
          genehmigen
            ? 'Der Diensttausch wurde genehmigt.'
            : 'Der Diensttausch wurde abgelehnt.'
        )
      ),
      true
    );


    await ladeAdminTauschAnfragenNeu();


  } catch (error) {

    console.error(
      'Admin-Tausch bearbeiten:',
      error
    );


    zeigeAdminMeldungNeu(
      '❌ ' +
      error.message,
      false
    );


    if (genehmigenButton) {

      genehmigenButton.disabled =
        false;

      genehmigenButton.textContent =
        '✅ Tausch genehmigen';
    }


    if (ablehnenButton) {

      ablehnenButton.disabled =
        false;

      ablehnenButton.textContent =
        '❌ Tausch ablehnen';
    }
  }
}


// ==========================================================
// ADMIN-MELDUNG
// ==========================================================

function zeigeAdminMeldungNeu(
  text,
  erfolg
) {

  const meldung =
    document.getElementById(
      'adminMeldungNeu'
    );


  if (!meldung) {
    return;
  }


  meldung.style.display =
    'block';


  meldung.textContent =
    text;


  if (erfolg) {

    meldung.style.background =
      '#eaf7ee';

    meldung.style.border =
      '1px solid #9bd3aa';

    meldung.style.color =
      '#176b2c';

  } else {

    meldung.style.background =
      '#fff0f0';

    meldung.style.border =
      '1px solid #e3aaaa';

    meldung.style.color =
      '#a00000';
  }
}


// ==========================================================
// ADMIN-BADGE
// ==========================================================

function setzeAdminBadgeNeu(
  anzahl
) {

  const badge =
    document.getElementById(
      'adminBadgeNeu'
    );


  if (!badge) {
    return;
  }


  anzahl =
    Number(
      anzahl || 0
    );


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
      '0';


    badge.style.display =
      'none';
  }
}


// ==========================================================
// DIENSTSYMBOL ENTFERNEN
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


  const anfragenBadge =
    document.getElementById(
      'anfragenBadge'
    );


  if (anfragenBadge) {

    anfragenBadge.style.display =
      'none';


    anfragenBadge.textContent =
      '0';
  }


  setzeAdminBadgeNeu(
    0
  );


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
    'Die PIN-vergessen-Funktion verbinden wir später.',
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
// DIENST AUSWÄHLEN
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
// FALLS INDEX.HTML NOCH zeigeKollegen() VERWENDET
// ==========================================================

async function zeigeKollegen() {

  await ladeEchteTauschpartner();
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
