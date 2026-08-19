const API_URL =
  'https://script.google.com/macros/s/AKfycbxL-vdBIT5xLORL2k8xdNJXC4bRWt97X-QcvWQ5_bB1xXz083yntxCwimdaiqkoPMKBbg/exec';


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
// ERSTER TEST
// ==========================================================

async function testeVerbindung() {

  try {

    console.log(
      'Verbindung zu Apps Script wird getestet …'
    );

    const result =
      await apiPost(
        'login',
        {
          name: '',
          pin: ''
        }
      );


    console.log(
      'Antwort vom Server:',
      result
    );


    alert(
      result.message ||
      'Verbindung funktioniert.'
    );

  } catch (error) {

    console.error(
      error
    );

    alert(
      'Verbindung fehlgeschlagen: ' +
      error.message
    );
  }
}
