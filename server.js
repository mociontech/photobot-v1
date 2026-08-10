import "dotenv/config";
import express from "express";
import Replicate from "replicate";

const app = express();
const port = process.env.PORT || 3000;
const model = process.env.REPLICATE_MODEL || "google/gemini-2.5-flash-image";

app.use(express.json({ limit: "15mb" }));
app.use(express.static("public"));

app.post("/api/transform", async (request, response) => {
  try {
    const { image, stylePrompt } = request.body;

    if (!process.env.REPLICATE_API_TOKEN) {
      return response.status(500).json({
        error: "Falta REPLICATE_API_TOKEN en el archivo .env.",
      });
    }

    if (
      !image ||
      typeof image !== "string" ||
      !image.startsWith("data:image/")
    ) {
      return response.status(400).json({
        error: "Envía una imagen válida en formato data URL.",
      });
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const prompt = stylePrompt?.trim() || defaultPrompt;
    const output = await replicate.run(model, {
      input: {
        prompt,
        image_input: [image],
        aspect_ratio: "match_input_image",
        output_format: "jpg",
      },
      wait: {
        mode: "poll",
        interval: 1000,
        timeout: 90,
      },
    });

    const generatedImageUrl = await normalizeOutput(output);

    if (!generatedImageUrl.startsWith("http")) {
      throw new Error("La IA no devolvio una imagen valida.");
    }

    const backgroundFreeOutput = await replicate.run("bria/remove-background", {
      input: {
        image: generatedImageUrl,
        preserve_alpha: true,
        content_moderation: false,
      },
      wait: {
        mode: "poll",
        interval: 1000,
        timeout: 30,
      },
    });

    const imageUrl = await normalizeOutput(backgroundFreeOutput);
    const imageDataUrl = await fetchImageAsDataUrl(imageUrl);

    if (!imageDataUrl) {
      throw new Error("No se pudo preparar la imagen sin fondo.");
    }

    response.json({
      imageUrl,
      imageDataUrl,
      backgroundRemoved: true,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: error.message || "No se pudo procesar la imagen.",
    });
  }
});

app.listen(port, () => {
  console.log(`Filtro IA listo en http://localhost:${port}`);
});

const defaultPrompt = `Transform the uploaded photo into a bold premium comic-style illustration while preserving the person's exact identity, facial structure, hairstyle, expression, pose, clothing, and overall proportions.

Style target: high-contrast graphic novel / pop-comic illustration with strong black ink outlines, varied line weight, crisp line art, clean cel shading, and a polished illustrated finish. The character should clearly look like the same person in the photo, not like a generic face.

Important visual treatment:
- strong expressive black outlines around the face, hair, body, hands, and clothing
- bold comic-style rendering
- clean cel shading
- detailed hair with illustrated depth and definition
- warm, slightly saturated skin tones
- polished comic-book finish, modern and premium
- slightly stylized, but identity must remain recognizable

Facial treatment:
- keep the original comic contrast and overall style
- reduce expression lines slightly
- soften smile lines, forehead lines, under-eye lines, and facial creases just a little
- do not exaggerate wrinkles or skin texture
- do not make the person look older
- do not over-smooth the face
- preserve a flattering, youthful, and recognizable appearance while keeping the comic look

Background:
Use a plain clean white background only. Do not add green details, orange details, halftone bursts, splash graphics, motion lines, or decorative background elements. Keep the background fully white and simple so the focus stays entirely on the character.

Outline:
Add a subtle clean outline around the full silhouette of the person to separate the figure from the white background. Use a very light gray outline instead of pure white, approximately #F2F2F2 or a similar soft off-white/light gray tone. The outline should be visible enough to distinguish the person from the background, but still elegant and subtle.

Composition:
- use a tight close-up bust portrait like the target reference, with the face, head, neck, and shoulders filling most of the canvas
- preserve the camera photo's original proportions, pose, crop, and subject position
- extend the shoulders naturally to the side edges when they do so in the original photo
- keep the person large and visually dominant from side to side and vertically
- never shrink the person into a small centered figure or leave large empty white margins above, below, or around the person
- keep the person integrated naturally in the composition, not as a sticker cutout

Preserve identity strictly:
Do not add glasses, facial hair, piercings, headphones, hats, jewelry, or accessories unless they are actually present in the original photo. Do not change the hairstyle, face shape, gender presentation, body type, clothing, or expression. Do not redesign the face.

Important:
Do not add strong background graphics.
Do not make the person look aged.
Do not exaggerate shadows that create wrinkles.
Keep the same bold comic aesthetic and only make a subtle reduction in facial lines.

Avoid:
exaggerated wrinkles, deep facial folds, harsh aging lines, overly textured skin, flat vector look, overly soft illustration, washed-out colors, sticker effect, cutout effect, green details, graphic background elements, anime style, 3D render look, photorealism, generic facial features, or extra accessories not present in the original photo.

Make the final result look like a high-quality stylized comic illustration with a white background, strong visual character, a subtle light-gray outline, and only a slight softening of facial expression lines.`;

async function normalizeOutput(output) {
  const firstOutput = Array.isArray(output) ? output[0] : output;

  if (typeof firstOutput === "string") {
    return firstOutput;
  }

  if (firstOutput instanceof URL) {
    return firstOutput.toString();
  }

  if (typeof firstOutput?.url === "function") {
    const url = await firstOutput.url();
    return url?.toString() || "";
  }

  if (typeof firstOutput?.url === "string") {
    return firstOutput.url;
  }

  return firstOutput?.toString?.() || "";
}

async function fetchImageAsDataUrl(imageUrl) {
  imageUrl = imageUrl?.toString?.() || "";

  if (!imageUrl || !imageUrl.startsWith("http")) {
    return imageUrl?.startsWith("data:image/") ? imageUrl : "";
  }

  try {
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return "";
    }

    const contentType =
      imageResponse.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.warn("No se pudo convertir el resultado a data URL:", error);
    return "";
  }
}
