import Replicate from "replicate";

const model = process.env.REPLICATE_MODEL || "google/gemini-2.5-flash-image";

const defaultPrompt = [
  "Transform this photo into a POP COMIC / GRAPHIC NOVEL + STREET ART + STICKER PORTRAIT illustration.",
  "Preserve the exact same person and identity from the reference photo.",
  "Keep the exact same canvas aspect ratio, framing, crop, subject size, subject position, and image dimensions as the input photo.",
  "Keep the original face proportions, hairstyle, pose, expression, eyebrows, gaze direction, clothing, and visible body crop.",
  "Preserve the person's real eye color, eye shape, eyelid shape, eye size, and spacing exactly.",
  "Do not invent bright blue, green, anime, enlarged, or more symmetrical eyes.",
  "Do not add eyeglasses, sunglasses, lenses, or frames unless they are clearly visible in the reference photo.",
  "Use bold black ink outlines, graphic-novel shading, pop-comic contrast, street-art marker texture, warm natural skin tones, realistic detailed eyes, and glossy hair.",
  "Make the person look like a full-frame sticker portrait: add a clean white sticker cutout border around the body with a thin black ink edge.",
  "The person must fill the frame similarly to the input photo; do not shrink the portrait, do not create a tiny sticker floating in the center, and do not add extra white margins.",
  "Remove the original background completely and replace it with flat pure white background only, #ffffff.",
  "No beige, gray, cream, colored, gradient, textured, halftone, splash paint, scenery, shadows, logos, text, or background graphics.",
  "High detail, no extra people, no distorted face, no changed identity."
].join(" ");

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Metodo no permitido." });
  }

  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return jsonResponse(500, {
        error: "Falta REPLICATE_API_TOKEN en las variables de entorno de Netlify."
      });
    }

    const { image, stylePrompt } = JSON.parse(event.body || "{}");

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return jsonResponse(400, {
        error: "Envia una imagen valida en formato data URL."
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
        timeout: 55
      }
    });

    const imageUrl = await normalizeOutput(output);
    const imageDataUrl = await fetchImageAsDataUrl(imageUrl);

    return jsonResponse(200, {
      imageUrl,
      imageDataUrl
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(500, {
      error: error.message || "No se pudo procesar la imagen."
    });
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

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
