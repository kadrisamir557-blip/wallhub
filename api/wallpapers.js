// Lee el canal de Discord y devuelve los wallpapers en JSON.
// Variables necesarias en Vercel: DISCORD_TOKEN y CHANNEL_ID
module.exports = async (req, res) => {
  const token = process.env.DISCORD_TOKEN;
  const channel = process.env.CHANNEL_ID;
  if (!token || !channel) {
    return res.status(500).json({ error: "Faltan DISCORD_TOKEN o CHANNEL_ID en Vercel" });
  }

  try {
    const items = [];
    let before = "";
    // Hasta 3 páginas de 100 mensajes (los 300 más recientes)
    for (let page = 0; page < 3; page++) {
      const url = `https://discord.com/api/v10/channels/${channel}/messages?limit=100${before ? "&before=" + before : ""}`;
      const r = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
      if (!r.ok) {
        const txt = await r.text();
        return res.status(502).json({ error: "Discord respondió " + r.status, detail: txt.slice(0, 200) });
      }
      const msgs = await r.json();
      if (!msgs.length) break;

      for (const m of msgs) {
        for (const a of m.attachments || []) {
          if (!a.content_type || !a.content_type.startsWith("image/") || !a.width || !a.height) continue;
          const text = (m.content || "").trim();
          const tag = (text.match(/#([\p{L}\d_-]+)/u) || [])[1];
          const cleanText = text.replace(/#[\p{L}\d_-]+/gu, "").trim();
          const fallback = a.filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
          items.push({
            id: a.id,
            title: (cleanText || fallback).slice(0, 60),
            author: m.author.global_name || m.author.username,
            cat: tag ? tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase() : "General",
            dev: a.height > a.width ? "movil" : "pc",
            res: `${a.width}×${a.height}`,
            w: a.width,
            h: a.height,
            src: a.url,
          });
        }
      }
      before = msgs[msgs.length - 1].id;
      if (msgs.length < 100) break;
    }

    // Los enlaces de Discord caducan, por eso la caché es corta y se renueva sola
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(items);
  } catch (e) {
    return res.status(500).json({ error: "Error inesperado", detail: String(e).slice(0, 200) });
  }
};
