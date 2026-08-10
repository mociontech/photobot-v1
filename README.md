# Photobot v1

Webapp para iPad/tablet que toma una foto, genera una ilustración con IA y permite guardar solo el resultado procesado.

## Requisitos

- Node.js 18 o superior
- Token de Replicate
- Para uso final en iPad: hosting con HTTPS

## Configuración

```bash
npm install
copy .env.example .env
```

Edita `.env` y coloca tu token:

```bash
REPLICATE_API_TOKEN=r8_tu_token_real
REPLICATE_MODEL=google/gemini-2.5-flash-image
PORT=3000
```

## Probar en la computadora

```bash
npm run dev
```

Abre:

```bash
http://localhost:3000
```

## Probar en iPad por IP local

La computadora y el iPad deben estar en la misma red Wi-Fi.

En Windows, busca tu IP local:

```bash
ipconfig
```

En el iPad abre:

```bash
http://TU-IP-LOCAL:3000
```

Ejemplo:

```bash
http://192.168.1.50:3000
```

Nota: algunos navegadores en iPad restringen cámara o descargas cuando no hay HTTPS. Si pasa eso, la app puede estar bien y el siguiente paso sería probar con HTTPS mediante Netlify, Vercel o un túnel local.

## Flujo actual

- La app intenta mostrar la cámara activa en el panel izquierdo.
- Si el navegador bloquea la cámara activa por permisos o falta de HTTPS, el botón `Tomar foto` abre la cámara nativa del iPad.
- La foto original se usa temporalmente para procesar la imagen.
- No se guarda la foto original.
- El resultado IA se muestra en el panel derecho.

## Diseño para tablet

- Dos paneles grandes en la misma pantalla: cámara a la izquierda y resultado a la derecha.
- Botón principal debajo de los paneles.
- En iPad horizontal está pensado para no requerir scroll.
- En pantallas angostas o verticales, el layout se adapta para mantener todo usable.

## Estilo IA

- Retrato ilustrado tipo cómic deportivo.
- Misma persona, rostro, cabello, pose y expresión.
- Fondo blanco puro, sin sombra ni silueta detrás.
- Sin splash de colores, grunge, texto ni logos.
- Silueta negra plana detrás de la persona.
