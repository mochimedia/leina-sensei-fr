
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { prenom, email, website } = req.body || {};

  // Champ invisible anti-spam
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
    return res.status(400).json({ error: "Informations invalides" });
  }

  const url = process.env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Configuration manquante" });
  }

  try {
    const response = await fetch(`${url}/rest/v1/guide_inscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        prenom: prenom.trim(),
        email: email.trim().toLowerCase()
      })
    });

    if (!response.ok) {
      console.error("Erreur Supabase", response.status);
      return res.status(502).json({ error: "Enregistrement impossible" });
    }

    return res.status(200).json({
      success: true,
      message: "Inscription enregistrée"
    });
  } catch (error) {
    console.error("Erreur serveur", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
