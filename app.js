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
      text
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
