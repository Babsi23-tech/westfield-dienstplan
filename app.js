// ==========================================================
// SCS TEAM – VERBINDUNG ZU GOOGLE APPS SCRIPT
// ==========================================================

const API_URL =
  'https://script.google.com/macros/s/AKfycbxL-vdBIT5xLORL2k8xdNJXC4bRWt97X-QcvWQ5_bB1xXz083yntxCwimdaiqkoPMKBbg/exec';

const SESSION_KEY =
  'scs_team_session';


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


  if (!response.ok) {

    throw new Error(
      'Serverfehler: ' + response.status
    );
  }


  return await response.json();
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


  // Vorhandene Anmeldung prüfen
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

        zeigeHauptApp(
          result.name,
          result.admin
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


  // Keine gültige Session
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
      'Die Verbindung zum Dienstplan konnte nicht hergestellt werden.',
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

      if (
        result &&
        result.pinFehlt
      ) {

        zeigeLoginMeldung(
          'Für diesen Mitarbeiter wurde noch kein PIN festgelegt.',
          'fehler'
        );

      } else {

        zeigeLoginMeldung(
          result?.message ||
          'Anmeldung nicht möglich.',
          'fehler'
        );
      }


      return;
    }


    localStorage.setItem(
      SESSION_KEY,
      result.token
    );


    if (pinElement) {

      pinElement.value =
        '';
    }


    zeigeHauptApp(
      result.name,
      result.admin
    );

  } catch (error) {

    console.error(
      error
    );


    zeigeLoginMeldung(
      'Die Verbindung zum Server ist fehlgeschlagen.',
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
