// ==========================================================
// SCS TEAM – APP.JS
// ==========================================================

const API_URL =
  'https://script.google.com/macros/s/AKfycbxL-vdBIT5xLORL2k8xdNJXC4bRWt97X-QcvWQ5_bB1xXz083yntxCwimdaiqkoPMKBbg/exec';

const SESSION_KEY =
  'scs_team_session';


let aktuellerBenutzer =
  '';

let aktuellerAdmin =
  false;


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
        method:
          'POST',

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
          'follow'
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


  if (
    token
  ) {

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


  if (
    login
  ) {

    login.style.display =
      'flex';
  }


  if (
    app
  ) {

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


  if (
    !select
  ) {

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


  if (
    !name
  ) {

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


  if (
    button
  ) {

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


    if (
      pinElement
    ) {

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

    if (
      button
    ) {

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


  if (
    login
  ) {

    login.style.display =
      'none';
  }


  if (
    app
  ) {

    app.style.display =
      'flex';
  }


  const profilName =
    document.getElementById(
      'profilNameAnzeige'
    );


  if (
    profilName
  ) {

    profilName.textContent =
      name || 'Mitarbeiter';
  }


  const adminNav =
    document.getElementById(
      'adminNav'
    );


  if (
    adminNav
  ) {

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


  if (
    !token
  ) {

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


  const abwesenheitenListe =
    document.getElementById(
      'abwesenheitenListe'
    );


  if (
    laden
  ) {

    laden.style.display =
      'block';


    laden.textContent =
      'Dienstplan wird geladen …';
  }


  if (
    liste
  ) {

    liste.innerHTML =
      '';
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


    if (
      profilName
    ) {

      profilName.textContent =
        aktuellerBenutzer ||
        'Mitarbeiter';
    }


    if (
      sollstundenElement
    ) {

      const soll =
        Number(
          result.sollstunden || 0
        );


      sollstundenElement.textContent =
        soll
          .toFixed(
            1
          )
          .replace(
            '.',
            ','
          ) +
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


    if (
      laden
    ) {

      laden.style.display =
        'none';
    }

  } catch (error) {

    console.error(
      error
    );


    if (
      laden
    ) {

      laden.style.display =
        'block';


      laden.textContent =
        'Fehler beim Laden: ' +
        error.message;
    }


    if (
      abwesenheitenListe
    ) {

      abwesenheitenListe.innerHTML =
        '<div class="empty-state">Abwesenheiten konnten nicht geladen werden.</div>';
    }
  }
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


  if (
    !liste
  ) {

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
        <div class="panel">
          Keine Dienste gefunden.
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


      if (
        z.gpFrueh
      ) {

        dienste.push({

          typ:
            'gp',

          name:
            'Garden Plaza – Früh',

          zeit:
            zeitFruehNeu(
              z.tag
            )

        });
      }


      if (
        z.gpSpaet
      ) {

        dienste.push({

          typ:
            'gp',

          name:
            'Garden Plaza – Spät',

          zeit:
            zeitSpaetNeu(
              z.tag
            )

        });
      }


      if (
        z.gpAbloese
      ) {

        dienste.push({

          typ:
            'abloese',

          name:
            'Garden Plaza – Pausenablöse',

          zeit:
            z.gpAbloesezeit || ''

        });
      }


      if (
        z.wpFrueh
      ) {

        dienste.push({

          typ:
            'wp',

          name:
            'Water Plaza – Früh',

          zeit:
            zeitFruehNeu(
              z.tag
            )

        });
      }


      if (
        z.wpSpaet
      ) {

        dienste.push({

          typ:
            'wp',

          name:
            'Water Plaza – Spät',

          zeit:
            zeitSpaetNeu(
              z.tag
            )

        });
      }


      if (
        z.wpAbloese
      ) {

        dienste.push({

          typ:
            'abloese',

          name:
            'Water Plaza – Pausenablöse',

          zeit:
            z.wpAbloesezeit || ''

        });
      }


      html +=
        `
          <div
            style="
              background:#ffffff;
              border:1px solid #e1e4e8;
              border-radius:14px;
              padding:18px;
              margin-bottom:14px;
              box-shadow:0 4px 18px rgba(0,0,0,0.05);
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:15px;
                align-items:flex-start;
              "
            >

              <div>

                <strong
                  style="
                    font-size:18px;
                  "
                >
                  ${escapeHtmlNeu(z.tag || '')},
                  ${escapeHtmlNeu(z.datum || '')}
                </strong>

                <div
                  style="
                    margin-top:4px;
                    color:#666;
                    font-size:13px;
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
            dienst.typ ===
            'gp'
          ) {

            randfarbe =
              '#14943b';


            hintergrund =
              '#f9fffa';
          }


          if (
            dienst.typ ===
            'wp'
          ) {

            randfarbe =
              '#1754d1';


            hintergrund =
              '#f9fbff';
          }


          if (
            dienst.typ ===
            'abloese'
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
                  padding:14px;
                  margin-top:10px;
                "
              >

                <div
                  style="
                    font-weight:700;
                    font-size:16px;
                  "
                >
                  ${escapeHtmlNeu(dienst.name)}
                </div>


                ${
                  dienst.zeit

                    ? `
                      <div
                        style="
                          color:#666;
                          margin-top:6px;
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


      if (
        z.notiz
      ) {

        html +=
          `
            <div
              style="
                margin-top:11px;
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


  if (
    !liste
  ) {

    return;
  }


  if (
    !abwesenheiten ||
    abwesenheiten.length === 0
  ) {

    liste.innerHTML =
      `
        <div
          style="
            color:#666;
            padding:14px 0;
          "
        >
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
          a.status || 'Abwesenheit'
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
            style="
              background:#ffffff;
              border:1px solid #e1e4e8;
              border-left:6px solid ${farbe};
              border-radius:10px;
              padding:14px;
              margin-top:10px;
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


  if (
    token
  ) {

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


  if (
    pin
  ) {

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


  if (
    !name
  ) {

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


  if (
    !element
  ) {

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


  if (
    !element
  ) {

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
