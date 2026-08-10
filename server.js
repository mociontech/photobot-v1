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
  "Transform this photo into a full-frame POP COMIC / GRAPHIC NOVEL + STREET ART portrait illustration.",
  "Preserve the exact same person and identity from the reference photo.",
  "Use the input photo as a strict composition template: keep exactly the same canvas aspect ratio, framing, crop, subject scale, subject position, head size, shoulder width, and visible body area.",
  "Do not zoom in, zoom out, resize, recenter, shrink, enlarge, or recompose the person; every facial and body landmark must remain in the same relative place in the frame as in the input photo.",
  "Keep the original face proportions, hairstyle, pose, expression, eyebrows, gaze direction, clothing, and visible body crop.",
  "Preserve the person's real eye color, eye shape, eyelid shape, eye size, and spacing exactly.",
  "Do not invent bright blue, green, anime, enlarged, or more symmetrical eyes.",
  "Do not add eyeglasses, sunglasses, lenses, or frames unless they are clearly visible in the reference photo.",
  "Use bold black ink outlines, graphic-novel shading, pop-comic contrast, street-art marker texture, warm natural skin tones, realistic detailed eyes, and glossy hair.",
  "Make it look like the full original photo was redrawn by AI at the original scale.",
  "The person must occupy the same percentage of the canvas as in the input photo and reach the same frame edges; never create a small centered portrait or add empty space around the person.",
  "Remove the original background completely and replace it with flat pure white background only, #ffffff.",
  "Add one thin, clean, uniform white silhouette outline that closely follows the person's outer contour without changing the person's size or crop.",
  "No thick sticker border, no isolated floating head, no tiny centered character, no pedestal, and no extra margins.",
  "No beige, gray, cream, colored, gradient, textured, halftone, splash paint, scenery, shadows, logos, text, or background graphics.",
  "High detail, no extra people, no distorted face, no changed identity."
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
