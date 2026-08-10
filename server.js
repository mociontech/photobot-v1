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
        error: "Falta REPLICATE_API_TOKEN en el archivo .env."
      });
    }

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return response.status(400).json({
        error: "Envía una imagen válida en formato data URL."
      });
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    const prompt = stylePrompt?.trim() || defaultPrompt;
    const output = await replicate.run(model, {
      input: {
        prompt,
        image_input: [image],
        aspect_ratio: "match_input_image",
        output_format: "jpg"
      },
      wait: {
        mode: "poll",
        interval: 1000,
        timeout: 90
      }
    });

    const imageUrl = await normalizeOutput(output);
    const imageDataUrl = await fetchImageAsDataUrl(imageUrl);

    response.json({
      imageUrl,
      imageDataUrl
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: error.message || "No se pudo procesar la imagen."
    });
  }
});

app.listen(port, () => {
  console.log(`Filtro IA listo en http://localhost:${port}`);
});

const defaultPrompt = [
  "Redraw the input photo as a polished POP COMIC / GRAPHIC NOVEL + STREET ART portrait, matching the visual finish of a professional comic-book character illustration.",
  "Use bold clean black ink contours, smooth vector-like cel shading, subtle halftone detail on the person and clothing, warm natural skin tones, realistic detailed eyes, glossy illustrated hair, and crisp high-contrast facial features.",
  "Preserve the exact identity, face proportions, hairstyle, pose, expression, gaze, clothing, accessories, and every visible part of the person from the input photo.",
  "The input photo is a locked composition template: preserve its exact aspect ratio, camera framing, crop, subject position, head size, shoulder width, body size, and the percentage of the canvas occupied by the person.",
  "Do not zoom, shrink, enlarge, recenter, reposition, or recompose the person. The illustrated person must have exactly the same scale and crop as the person in the camera photo, including where the body meets the frame edges.",
  "Add a narrow, clean white silhouette keyline directly around the person's outer contour without changing the person's size or creating extra space.",
  "Replace the entire original background with one uninterrupted flat pure white background, #ffffff.",
  "The background must contain no colors, paint splashes, rays, dots, halftone, texture, gradient, scenery, shadows, objects, logos, or text.",
  "Do not create a small centered portrait, floating head, badge, pedestal, thick sticker border, extra margins, extra people, invented glasses, distorted face, or changed identity."
].join(" ");

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

    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.warn("No se pudo convertir el resultado a data URL:", error);
    return "";
  }
}
