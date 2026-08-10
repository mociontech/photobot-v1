import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDownloadURL, getStorage, ref, uploadString } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const camera = document.querySelector("#camera");
const snapshot = document.querySelector("#snapshot");
const preview = document.querySelector("#preview");
const cameraFallback = document.querySelector("#cameraFallback");
const result = document.querySelector("#result");
const placeholder = document.querySelector("#placeholder");
const status = document.querySelector("#status");

const takePhotoButton = document.querySelector("#takePhoto");
const retakeButton = document.querySelector("#retake");
const fileInput = document.querySelector("#fileInput");

let currentImage = "";
let mediaStream;
let isInlineCameraReady = false;

const firebaseConfig = {
  apiKey: "AIzaSyAd32fjHVssRxIzHijkeWd37MamHWzCajM",
  authDomain: "f1-sap.firebaseapp.com",
  databaseURL: "https://f1-sap-default-rtdb.firebaseio.com",
  projectId: "f1-sap",
  storageBucket: "f1-sap.appspot.com",
  messagingSenderId: "1043864334257",
  appId: "1:1043864334257:web:bcc854d01f1c12fa415790"
};

const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

const stylePrompt = [
  "Transform this photo into a full-frame POP COMIC / GRAPHIC NOVEL + STREET ART portrait illustration.",
  "Preserve the exact same person and identity from the reference photo.",
  "Keep the exact same canvas aspect ratio, framing, crop, subject size, subject position, and image dimensions as the input photo.",
  "Keep the original face proportions, hairstyle, pose, expression, eyebrows, gaze direction, clothing, and visible body crop.",
  "Preserve the person's real eye color, eye shape, eyelid shape, eye size, and spacing exactly.",
  "Do not invent bright blue, green, anime, enlarged, or more symmetrical eyes.",
  "Do not add eyeglasses, sunglasses, lenses, or frames unless they are clearly visible in the reference photo.",
  "Use bold black ink outlines, graphic-novel shading, pop-comic contrast, street-art marker texture, warm natural skin tones, realistic detailed eyes, and glossy hair.",
  "Make it look like the full original photo was redrawn by AI, not like a sticker or cutout.",
  "The person must fill the frame similarly to the input photo, reaching a similar crop near the edges when applicable.",
  "Remove the original background completely and replace it with flat pure white background only, #ffffff.",
  "No sticker effect, no sticker border, no white cutout outline, no isolated floating head, no tiny centered character, and no extra white margins.",
  "No beige, gray, cream, colored, gradient, textured, halftone, splash paint, scenery, shadows, logos, text, or background graphics.",
  "High detail, no extra people, no distorted face, no changed identity."
].join(" ");

takePhotoButton.addEventListener("click", takePhoto);
retakeButton.addEventListener("click", resetFlow);

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setStatus("El archivo debe ser una imagen.");
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    setPreview(reader.result);
    generateImage();
  });
  reader.readAsDataURL(file);
});

startInlineCamera();

async function startInlineCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraFallback("Tu navegador no permite cámara activa aquí. Usa el botón para abrir la cámara nativa.");
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1600 },
        height: { ideal: 1200 }
      },
      audio: false
    });

    camera.srcObject = mediaStream;
    isInlineCameraReady = true;
    camera.hidden = false;
    cameraFallback.hidden = true;
    setStatus("Cámara lista. Toca “Tomar foto”.");
  } catch (error) {
    showCameraFallback("La cámara activa requiere permisos o HTTPS. El botón abrirá la cámara nativa.");
    console.info("No se pudo iniciar cámara activa:", error);
  }
}

function takePhoto() {
  if (isInlineCameraReady && camera.videoWidth) {
    captureInlinePhoto();
    return;
  }

  fileInput.click();
}

function captureInlinePhoto() {
  const sourceWidth = camera.videoWidth;
  const sourceHeight = camera.videoHeight;
  const scale = Math.min(1, 1200 / Math.max(sourceWidth, sourceHeight));

  snapshot.width = Math.round(sourceWidth * scale);
  snapshot.height = Math.round(sourceHeight * scale);

  const context = snapshot.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.translate(snapshot.width, 0);
  context.scale(-1, 1);
  context.drawImage(camera, 0, 0, sourceWidth, sourceHeight, 0, 0, snapshot.width, snapshot.height);

  setPreview(snapshot.toDataURL("image/jpeg", 0.86));
  generateImage();
}

async function generateImage() {
  if (!currentImage) {
    setStatus("Primero toma una foto.");
    return;
  }

  setLoading(true);
  clearResult();
  setStatus("Procesando con IA… espera unos segundos.");

  try {
    const response = await fetch("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: currentImage,
        stylePrompt
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Error desconocido al generar.");
    }

    const resultImage = payload.imageDataUrl || payload.imageUrl;
    showResult(resultImage);
    setStatus("Guardando resultado...");
    await saveGeneratedPhoto(resultImage);
    currentImage = "";
    fileInput.value = "";
    setStatus("Listo. Resultado generado y guardado.");
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

function setPreview(dataUrl) {
  currentImage = dataUrl;
  preview.src = dataUrl;
  preview.hidden = false;
  camera.hidden = true;
  cameraFallback.hidden = true;
  retakeButton.hidden = false;
}

function showResult(imageSource) {
  result.src = imageSource;
  result.hidden = false;
  placeholder.hidden = true;
}

async function saveGeneratedPhoto(imageSource) {
  if (!imageSource?.startsWith("data:image/")) {
    console.warn("No se guardo en Firebase porque el resultado no es data URL.");
    return "";
  }

  const fileName = `photobot-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
  const imageRef = ref(storage, `Filtro Diego/${fileName}`);

  await uploadString(imageRef, imageSource, "data_url", {
    contentType: "image/jpeg",
    customMetadata: {
      app: "photobot-v1"
    }
  });

  return getDownloadURL(imageRef);
}

function resetFlow() {
  currentImage = "";
  fileInput.value = "";
  preview.removeAttribute("src");
  result.removeAttribute("src");
  preview.hidden = true;
  result.hidden = true;
  placeholder.hidden = false;
  retakeButton.hidden = true;

  if (isInlineCameraReady) {
    camera.hidden = false;
    cameraFallback.hidden = true;
    setStatus("Cámara lista. Toca “Tomar foto”.");
  } else {
    showCameraFallback("La cámara activa requiere permisos o HTTPS. El botón abrirá la cámara nativa.");
  }
}

function clearResult() {
  result.removeAttribute("src");
  result.hidden = true;
  placeholder.hidden = false;
}

function showCameraFallback(message) {
  isInlineCameraReady = false;
  camera.hidden = true;
  cameraFallback.textContent = message;
  cameraFallback.hidden = false;
  setStatus(message);
}

function setStatus(message) {
  status.textContent = message;
}

function setLoading(isLoading) {
  takePhotoButton.disabled = isLoading;
  takePhotoButton.textContent = isLoading ? "Generando…" : "Tomar foto";
}
