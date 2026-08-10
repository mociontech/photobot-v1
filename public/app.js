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

const stylePrompt = [
  "Transform this portrait into a polished stylized sports-comic illustration.",
  "Preserve the exact same person and identity from the reference photo.",
  "Keep the original face proportions, hairstyle, pose, expression, eyebrows, glasses, and gaze direction.",
  "Preserve the person's real eye color, eye shape, eyelid shape, eye size, and spacing exactly.",
  "Do not invent bright blue, green, anime, enlarged, or more symmetrical eyes.",
  "Use bold ink outlines, warm natural skin tones, realistic detailed eyes, glossy hair, and a clean editorial look.",
  "Remove the original background completely and replace it with plain pure white.",
  "No shadow, no black silhouette, no drop shadow, no outline shape behind the person.",
  "No colored splash paint, grunge texture, scenery, text, logos, or background graphics.",
  "High detail, centered portrait, no extra people, no distorted face, no changed identity."
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
  const size = Math.min(camera.videoWidth, camera.videoHeight);
  const sourceX = (camera.videoWidth - size) / 2;
  const sourceY = (camera.videoHeight - size) / 2;

  snapshot.width = 900;
  snapshot.height = 900;

  const context = snapshot.getContext("2d");
  context.translate(snapshot.width, 0);
  context.scale(-1, 1);
  context.drawImage(camera, sourceX, sourceY, size, size, 0, 0, snapshot.width, snapshot.height);

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

    showResult(payload.imageDataUrl || payload.imageUrl);
    currentImage = "";
    fileInput.value = "";
    setStatus("Listo. Resultado generado.");
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
