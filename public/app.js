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

const stylePrompt = `Transform the uploaded photo into a bold premium comic-style illustration while preserving the person's exact identity, facial structure, hairstyle, expression, pose, clothing, and overall proportions.

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
