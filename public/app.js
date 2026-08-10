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
