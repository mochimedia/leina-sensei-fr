
const { readFile } = require("node:fs/promises");
const path = require("node:path");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée"
    });
  }

  const secret = process.env.EMAIL_TEST_SECRET;

  if (
    !secret ||
    req.headers.authorization !== `Bearer ${secret}`
  ) {
    return res.status(401).json({
      error: "Non autorisé"
    });
  }

  if (!process.env.POSTMARK_SERVER_TOKEN) {
    return res.status(500).json({
      error: "Configuration Postmark manquante"
    });
  }

  try {
    const pdf = await readFile(
      path.join(process.cwd(), "guide-japonais.pdf")
    );

    const response = await fetch(
      "https://api.postmarkapp.com/email/withTemplate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Postmark-Server-Token":
            process.env.POSTMARK_SERVER_TOKEN
        },
        body: JSON.stringify({
          From: "leina@leina-sensei.fr",
          To: "leina@leina-sensei.fr",
          TemplateId: 48662971,
          TemplateModel: {
            prenom: "Léïna"
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

    const result = await response.json();

    return res.status(response.ok ? 200 : 502).json({
      success: response.ok,
      message: response.ok
        ? "Email de bienvenue envoyé avec le PDF"
        : "Échec de l'envoi",
      postmarkError: response.ok
        ? undefined
        : result.Message
    });
  } catch (error) {
    console.error("Erreur Postmark :", error.message);

    return res.status(500).json({
      error: "Impossible d'envoyer l'email"
    });
  }
};
