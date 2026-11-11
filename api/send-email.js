
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  // Ne jamais exposer une fonction d'envoi librement sur Internet.
  const auth = req.headers.authorization;
  const secret = process.env.EMAIL_TEST_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Postmark-Server-Token": process.env.POSTMARK_SERVER_TOKEN
      },
      body: JSON.stringify({
        From: "leina@leina-sensei.fr",
        To: "leina@leina-sensei.fr",
        Subject: "Test Postmark - Léïna Sensei",
        TextBody: "Bravo ! Ton site Vercel est connecté à Postmark.",
        MessageStream: "outbound"
      })
    });

    const result = await response.json();

    return res.status(response.ok ? 200 : 502).json({
      success: response.ok,
      message: response.ok ? "Email test envoyé" : "Échec de l'envoi",
      postmarkError: response.ok ? undefined : result.Message
    });
  } catch {
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
