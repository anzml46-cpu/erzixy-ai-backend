export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, attachment } = req.body || {};

    if (typeof message !== "string" || message.length > 10000) {
      return res.status(400).json({ error: "Pesan tidak valid" });
    }

    const content = [];

    if (attachment) {
      const { type, filename, mimeType, data } = attachment;

      if (
        typeof filename !== "string" ||
        typeof mimeType !== "string" ||
        typeof data !== "string" ||
        data.length > 3500000
      ) {
        return res.status(400).json({ error: "Lampiran tidak valid atau terlalu besar" });
      }

      const fileData = `data:${mimeType};base64,${data}`;

      if (type === "image" && mimeType.startsWith("image/")) {
        content.push({
          type: "input_image",
          image_url: fileData,
          detail: "auto"
        });
      } else if (
        type === "file" &&
        mimeType === "application/pdf" &&
        filename.toLowerCase().endsWith(".pdf")
      ) {
        content.push({
          type: "input_file",
          filename,
          file_data: fileData
        });
      } else if (
        type === "file" &&
        mimeType === "text/plain" &&
        filename.toLowerCase().endsWith(".txt")
      ) {
        const text = Buffer.from(data, "base64").toString("utf8");
        content.push({
          type: "input_text",
          text: `Isi dokumen ${filename}:\n${text}`
        });
      } else {
        return res.status(400).json({
          error: "Format lampiran tidak didukung"
        });
      }
    }

    if (message.trim()) {
      content.push({
        type: "input_text",
        text: message
      });
    }

    if (content.length === 0) {
      return res.status(400).json({
        error: "Pesan atau lampiran harus diisi"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-6-luna",
          instructions: `Kamu adalah Erzixy AI, asisten yang ramah, pintar, dan membantu.
Jawab menggunakan bahasa pengguna.
Jika pengguna mengirim gambar atau dokumen, analisis isinya.

FITUR PEMBUATAN FILE:
Jika pengguna meminta dibuatkan file, jangan hanya memberikan kode.
Buat isi file secara lengkap dan gunakan format khusus berikut:

[[ERZIXY_FILE filename="index.html" mime="text/html"]]
ISI FILE LENGKAP DI SINI
[[/ERZIXY_FILE]]

Aturan:
- Ganti filename dengan nama file yang sesuai.
- Gunakan MIME type yang sesuai.
- Isi di antara tag harus merupakan isi file asli, bukan penjelasan.
- Jangan gunakan Markdown code fence di dalam tag.
- Bisa membuat lebih dari satu file.
- Setelah tag file, berikan penjelasan singkat kepada pengguna.
- Jika tidak diminta membuat file, jawab seperti biasa.
- Jangan mengaku file berhasil dibuat jika tag file tidak disertakan.`,
          input: [
            {
              role: "user",
              content
            }
          ]
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.error?.message || "Gagal menghubungi AI"
      });
    }

    const answer = (result.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n");

    const files = [];
    const filePattern =
      /\[\[ERZIXY_FILE filename="([^"]+)" mime="([^"]+)"\]\]\s*([\s\S]*?)\s*\[\[\/ERZIXY_FILE\]\]/g;

    const reply = answer.replace(
      filePattern,
      (match, filename, mimeType, fileContent) => {
        const buffer = Buffer.from(fileContent, "utf8");

        if (buffer.length > 1500000) {
          return `\nFile ${filename} terlalu besar untuk dikirim.\n`;
        }

        files.push({
          filename,
          mimeType,
          data: buffer.toString("base64")
        });

        return `\nFile berhasil disiapkan: ${filename}\n`;
      }
    );

    return res.status(200).json({
      reply: reply || "AI belum memberikan jawaban.",
      files
    });

  } catch (error) {
    console.error("Erzixy backend error:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan server."
    });
  }
}
