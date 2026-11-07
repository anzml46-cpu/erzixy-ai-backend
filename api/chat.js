export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message, attachment } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Pesan kosong"
      });
    }

    if (message.length > 10000) {
      return res.status(400).json({
        error: "Pesan terlalu panjang"
      });
    }

    const content = [
      {
        type: "input_text",
        text: message
      }
    ];

    if (attachment) {
      const { type, filename, mimeType, data } = attachment;

      if (
        !["image", "file"].includes(type) ||
        typeof filename !== "string" ||
        typeof mimeType !== "string" ||
        typeof data !== "string"
      ) {
        return res.status(400).json({
          error: "Lampiran tidak valid"
        });
      }

      if (data.length > 3500000) {
        return res.status(413).json({
          error: "File terlalu besar"
        });
      }

      const fileData =
        `data:${mimeType};base64,${data}`;

      if (type === "image") {
        if (!mimeType.startsWith("image/")) {
          return res.status(400).json({
            error: "Format gambar tidak valid"
          });
        }

        content.push({
          type: "input_image",
          image_url: fileData,
          detail: "auto"
        });
      } else {
        content.push({
          type: "input_file",
          filename,
          file_data: fileData
        });
      }
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-6-luna",
          instructions:
            "Kamu adalah Erzixy AI, asisten AI yang ramah, pintar, dan membantu. Jawab menggunakan bahasa pengguna.",
          input: [
            {
              role: "user",
              content
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.error?.message ||
          "Gagal menghubungi AI"
      });
    }

    const answer = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n");

    return res.status(200).json({
      reply: answer || "AI belum memberikan jawaban."
    });

  } catch (error) {
    return res.status(500).json({
      error: "Terjadi kesalahan server"
    });
  }
  }
