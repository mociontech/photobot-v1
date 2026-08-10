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
const switchCameraButton = document.querySelector("#switchCamera");
const downloadButton = document.querySelector("#download");
const retakeButton = document.querySelector("#retake");
const fileInput = document.querySelector("#fileInput");

let currentImage = "";
let currentResult = "";
let mediaStream;
let isInlineCameraReady = false;
let activeFacingMode = "environment";
let hasMultipleCameras = false;

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
- use a distinctly warm color grade with peach, coral, terracotta, amber, and golden highlights
- keep blacks rich and neutral while making skin and midtones feel sunlit and warm
- avoid cold blue, cyan, steel-gray, pale, desaturated, or washed-out color casts
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
Add a clean pure-white silhouette border around the full person. Add only a very thin light-gray outer keyline around that white border so the white silhouette remains visible against the pure-white background.

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

Make the final result look like a high-quality stylized comic illustration with a white background, strong visual character, a clean white silhouette border with a thin light-gray outer keyline, and only a slight softening of facial expression lines.`;

takePhotoButton.addEventListener("click", takePhoto);
switchCameraButton.addEventListener("click", switchCamera);
downloadButton.addEventListener("click", downloadResult);
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

async function startInlineCamera(facingMode = "environment") {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraFallback("Tu navegador no permite cámara activa aquí. Usa el botón para abrir la cámara nativa.");
    return;
  }

  try {
    stopMediaStream();
    mediaStream = await requestCamera(facingMode);

    camera.srcObject = mediaStream;
    const trackFacingMode = mediaStream.getVideoTracks()[0]?.getSettings().facingMode;
    activeFacingMode = trackFacingMode || facingMode;
    camera.classList.toggle("is-mirrored", activeFacingMode === "user");
    isInlineCameraReady = true;
    camera.hidden = false;
    cameraFallback.hidden = true;
    await updateCameraSwitchVisibility();
    setStatus("Cámara lista. Toca “Tomar foto”.");
  } catch (error) {
    showCameraFallback("La cámara activa requiere permisos o HTTPS. El botón abrirá la cámara nativa.");
    console.info("No se pudo iniciar cámara activa:", error);
  }
}

async function requestCamera(facingMode) {
  const dimensions = {
    width: { ideal: 1600 },
    height: { ideal: 1200 }
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        ...dimensions,
        facingMode: { exact: facingMode }
      },
      audio: false
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      video: {
        ...dimensions,
        facingMode: { ideal: facingMode }
      },
      audio: false
    });
  }
}

async function updateCameraSwitchVisibility() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    hasMultipleCameras = devices.filter((device) => device.kind === "videoinput").length > 1;
    switchCameraButton.hidden = !hasMultipleCameras;
  } catch {
    hasMultipleCameras = false;
    switchCameraButton.hidden = true;
  }
}

async function switchCamera() {
  switchCameraButton.disabled = true;
  setStatus("Cambiando cámara...");
  const nextFacingMode = activeFacingMode === "environment" ? "user" : "environment";
  await startInlineCamera(nextFacingMode);
  switchCameraButton.disabled = false;
}

function stopMediaStream() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = undefined;
  camera.srcObject = null;
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

  if (activeFacingMode === "user") {
    context.translate(snapshot.width, 0);
    context.scale(-1, 1);
  }

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
    const sourceImage = currentImage;
    const response = await fetch("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: sourceImage,
        stylePrompt
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Error desconocido al generar.");
    }

    const transparentResult = payload.imageDataUrl || payload.imageUrl;
    setStatus("Ajustando fondo y encuadre...");
    const resultImage = await composePortraitOnWhiteCanvas(transparentResult, sourceImage);
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

async function composePortraitOnWhiteCanvas(subjectSource, cameraSource) {
  const [subjectImage, cameraImage] = await Promise.all([
    loadImage(subjectSource),
    loadImage(cameraSource)
  ]);
  const subjectCanvas = document.createElement("canvas");
  subjectCanvas.width = subjectImage.naturalWidth;
  subjectCanvas.height = subjectImage.naturalHeight;

  const subjectContext = subjectCanvas.getContext("2d", {
    willReadFrequently: true
  });
  subjectContext.drawImage(subjectImage, 0, 0);

  const bounds = findSubjectBounds(
    subjectContext.getImageData(0, 0, subjectCanvas.width, subjectCanvas.height),
    subjectCanvas.width,
    subjectCanvas.height
  );

  if (!bounds) {
    throw new Error("No se detecto la persona en el resultado.");
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = cameraImage.naturalWidth;
  outputCanvas.height = cameraImage.naturalHeight;

  const outputContext = outputCanvas.getContext("2d");
  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";

  const outlineRadius = Math.max(7, Math.round(Math.min(outputCanvas.width, outputCanvas.height) * 0.012));
  const outerRadius = outlineRadius + Math.max(2, Math.round(outlineRadius * 0.3));
  const targetSubjectWidth = outputCanvas.width * 0.98;
  const targetSubjectHeight = outputCanvas.height * 0.94;
  const scale = Math.min(
    Math.max(
      targetSubjectWidth / bounds.width,
      targetSubjectHeight / bounds.height
    ),
    (outputCanvas.height - outerRadius * 2) / bounds.height
  );
  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  const drawX = (outputCanvas.width - drawWidth) / 2;
  const drawY = outputCanvas.height - drawHeight - outerRadius;

  const graySilhouette = createSilhouetteLayer(
    subjectCanvas,
    bounds,
    outputCanvas.width,
    outputCanvas.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    "#d8d8d8"
  );
  const whiteSilhouette = createSilhouetteLayer(
    subjectCanvas,
    bounds,
    outputCanvas.width,
    outputCanvas.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    "#ffffff"
  );

  drawExpandedSilhouette(outputContext, graySilhouette, outerRadius);
  drawExpandedSilhouette(outputContext, whiteSilhouette, outlineRadius);

  outputContext.save();
  outputContext.filter = "saturate(1.12) sepia(0.06) contrast(1.03)";
  outputContext.drawImage(
    subjectCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  outputContext.restore();

  return outputCanvas.toDataURL("image/jpeg", 0.94);
}

function findSubjectBounds(imageData, width, height) {
  const alphaThreshold = 32;
  const whiteThreshold = 248;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const red = imageData.data[pixelIndex];
      const green = imageData.data[pixelIndex + 1];
      const blue = imageData.data[pixelIndex + 2];
      const alpha = imageData.data[pixelIndex + 3];

      if (alpha < alphaThreshold) {
        continue;
      }

      const opacity = alpha / 255;
      const redOnWhite = 255 - (255 - red) * opacity;
      const greenOnWhite = 255 - (255 - green) * opacity;
      const blueOnWhite = 255 - (255 - blue) * opacity;

      if (
        redOnWhite >= whiteThreshold &&
        greenOnWhite >= whiteThreshold &&
        blueOnWhite >= whiteThreshold
      ) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function createSilhouetteLayer(
  subjectCanvas,
  bounds,
  width,
  height,
  drawX,
  drawY,
  drawWidth,
  drawHeight,
  color
) {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;

  const context = layer.getContext("2d");
  context.drawImage(
    subjectCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);

  return layer;
}

function drawExpandedSilhouette(context, silhouette, radius) {
  const steps = 32;

  for (let step = 0; step < steps; step += 1) {
    const angle = (Math.PI * 2 * step) / steps;
    context.drawImage(
      silhouette,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    );
  }
}

function loadImage(imageSource) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error("No se pudo cargar la imagen generada.")),
      { once: true }
    );
    image.src = imageSource;
  });
}

function setPreview(dataUrl) {
  currentImage = dataUrl;
  preview.src = dataUrl;
  preview.hidden = false;
  camera.hidden = true;
  switchCameraButton.hidden = true;
  cameraFallback.hidden = true;
  retakeButton.hidden = false;
}

function showResult(imageSource) {
  currentResult = imageSource;
  result.src = imageSource;
  result.hidden = false;
  placeholder.hidden = true;
  downloadButton.hidden = false;
}

async function downloadResult() {
  if (!currentResult) {
    return;
  }

  const response = await fetch(currentResult);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `photobot-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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
  currentResult = "";
  fileInput.value = "";
  preview.removeAttribute("src");
  result.removeAttribute("src");
  preview.hidden = true;
  result.hidden = true;
  placeholder.hidden = false;
  downloadButton.hidden = true;
  retakeButton.hidden = true;

  if (isInlineCameraReady) {
    camera.hidden = false;
    switchCameraButton.hidden = !hasMultipleCameras;
    cameraFallback.hidden = true;
    setStatus("Cámara lista. Toca “Tomar foto”.");
  } else {
    showCameraFallback("La cámara activa requiere permisos o HTTPS. El botón abrirá la cámara nativa.");
  }
}

function clearResult() {
  currentResult = "";
  result.removeAttribute("src");
  result.hidden = true;
  placeholder.hidden = false;
  downloadButton.hidden = true;
}

function showCameraFallback(message) {
  isInlineCameraReady = false;
  camera.hidden = true;
  switchCameraButton.hidden = true;
  cameraFallback.textContent = message;
  cameraFallback.hidden = false;
  setStatus(message);
}

function setStatus(message) {
  status.textContent = message;
}

function setLoading(isLoading) {
  takePhotoButton.disabled = isLoading;
  switchCameraButton.disabled = isLoading;
  downloadButton.disabled = isLoading;
  takePhotoButton.textContent = isLoading ? "Generando…" : "Tomar foto";
}
