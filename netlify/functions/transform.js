import Replicate from "replicate";

const model = process.env.REPLICATE_MODEL || "google/gemini-2.5-flash-image";

const defaultPrompt = [
  "Transform this portrait into a polished stylized sports-comic illustration.",
  "Preserve the exact same person and identity from the reference photo.",
  "Keep the original face proportions, hairstyle, pose, expression, eyebrows, glasses, and gaze direction.",
  "Preserve the person's real eye color, eye shape, eyelid shape, eye size, and spacing exactly.",
  "Do not invent bright blue, green, anime, enlarged, or more symmetrical eyes.",
  "Use bold ink outlines, warm natural skin tones, realistic detailed eyes, glossy hair,",
  "and a clean editorial look. Use a pure white background only.",
  "Remove the original background completely and replace it with plain pure white.",
  "No shadow, no black silhouette, no drop shadow, no outline shape behind the person.",
  "No colored splash paint, grunge texture, scenery, text, logos, or background graphics.",
  "High detail, centered portrait, no extra people, no distorted face, no changed identity."
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

    const imageUrl = normalizeOutput(output);
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

function normalizeOutput(output) {
  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    const firstOutput = output[0];
    return typeof firstOutput === "string" ? firstOutput : firstOutput?.url?.() || String(firstOutput);
  }

  return output?.url?.() || String(output);
}

async function fetchImageAsDataUrl(imageUrl) {
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

