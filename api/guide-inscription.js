
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  // Endpoint privé pour les tests.
  const secret = process.env.EMAIL_TEST_SECRET;

  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({
      error: "Non autorisé"
    });
  }

  const { prenom, email } = req.body || {};

  if (
    typeof prenom !== "string" ||
    typeof email !== "string" ||
    !prenom.trim() ||
    prenom.trim().length > 100 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return res.status(400).json({
      error: "Prénom ou email invalide"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Configuration Supabase manquante"
    });
  }

  const cleanPrenom = prenom.trim();
  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Enregistrer le contact dans Supabase.
    const response = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/guide_inscriptions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          prenom: cleanPrenom,
          email: cleanEmail
        })
      }
    );

    if (!response.ok) {
      console.error(
        "Erreur Supabase",
        response.status,
        await response.text()
      );

      return res.status(502).json({
        error: "Enregistrement impossible"
      });
    }

    // 2. Préparer l'email de bienvenue.
    // Désactivé jusqu'à l'approbation de Postmark.
    const emailEnabled =
      process.env.WELCOME_EMAIL_ENABLED === "true";

    if (!emailEnabled) {
      return res.status(200).json({
        success: true,
        message: "Inscription enregistrée",
        emailStatus: "disabled"
      });
    }

    const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;

    if (!postmarkToken) {
      console.error("Configuration Postmark manquante");

      return res.status(200).json({
        success: true,
        message: "Inscription enregistrée",
        emailStatus: "not_configured"
      });
    }

    // 3. Envoyer le modèle Postmark.
    const emailResponse = await fetch(
      "https://api.postmarkapp.com/email/withTemplate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Postmark-Server-Token": postmarkToken
        },
        body: JSON.stringify({
          From: "leina@leina-sensei.fr",
          To: cleanEmail,
          ReplyTo: "leina@leina-sensei.fr",
          TemplateAlias: "bienvenue-guide-japonais",
          TemplateModel: {
            prenom: cleanPrenom
          },
          MessageStream: "outbound"
        })
      }
    );

    if (!emailResponse.ok) {
      console.error(
        "Erreur Postmark",
        emailResponse.status,
        await emailResponse.text()
      );

      return res.status(200).json({
        success: true,
        message: "Inscription enregistrée",
        emailStatus: "failed"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Inscription enregistrée",
      emailStatus: "sent"
    });

  } catch (error) {
    console.error("Erreur serveur", error);

    return res.status(500).json({
      error: "Erreur serveur"
    });
  }
}
