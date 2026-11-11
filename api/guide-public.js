
const { readFile } = require("node:fs/promises");
const path = require("node:path");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  const { prenom, email, website } = req.body || {};

  // Champ anti-spam invisible
  if (website) {
    return res.status(200).json({ success: true });
  }

  if (
    typeof prenom !== "string" ||
    typeof email !== "string" ||
    !prenom.trim() ||
    prenom.trim().length > 100 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      error: "Informations invalides"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL
    ?.replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "");

  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;

  if (!supabaseUrl || !supabaseKey || !postmarkToken) {
    return res.status(500).json({
      error: "Configuration manquante"
    });
  }

  const cleanPrenom = prenom.trim();
  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Enregistrer l'inscription dans Supabase
    const dbResponse = await fetch(
      `${supabaseUrl}/rest/v1/guide_inscriptions`,
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

    if (!dbResponse.ok) {
      console.error("Erreur Supabase", dbResponse.status);

      return res.status(502).json({
        error: "Inscription impossible"
      });
    }

    // 2. Charger le guide PDF
    const pdf = await readFile(
      path.join(process.cwd(), "guide-japonais.pdf")
    );

    // 3. Envoyer le véritable template Postmark
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
          TemplateId: 48662971,
          TemplateModel: {
            prenom: cleanPrenom
          },
          MessageStream: "outbound",
          Attachments: [
            {
              Name: "Bien-debuter-le-japonais.pdf",
              Content: pdf.toString("base64"),
              ContentType: "application/pdf"
            }
          ]
        })
      }
    );

    if (!emailResponse.ok) {
      const error = await emailResponse.json().catch(() => ({}));

      console.error(
        "Erreur Postmark",
        emailResponse.status,
        error.ErrorCode
      );

      return res.status(502).json({
        success: false,
        saved: true,
        error: "Inscription enregistrée, mais email non envoyé"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Inscription enregistrée et guide envoyé"
    });

  } catch (error) {
    console.error("Erreur inscription :", error.message);

    return res.status(500).json({
      error: "Erreur lors du traitement de l'inscription"
    });
  }
};
