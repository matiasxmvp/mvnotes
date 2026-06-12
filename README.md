# MVNOTES

App de escritorio para Windows que combina **tareas, calendario semanal, notas de estudio, pizarra infinita y pomodoro** — con **captura de tareas por voz** usando Deepgram (transcripción) y Groq (interpretación con IA).

Construida con Tauri 2, React 19, TypeScript y SQLite. Todo se guarda **localmente** en tu equipo.

## Características

- **Dashboard diario**: tareas del día agrupadas por prioridad (`obligatorio` / `importante` / `prescindible`), notas rápidas y bloques de tiempo.
- **Captura por voz**: dictas algo como *"mañana a las 10 estudiar una hora, después caminar 30 minutos"* y la app crea las tareas con fecha, hora y duración. También acepta comandos de pomodoro por voz.
- **Calendario semanal** con franjas horarias y tareas recurrentes (diaria, días hábiles, semanal).
- **Pizarra infinita** (tldraw) con vínculos a tareas.
- **Notas de estudio** con resumen automático vía Groq.
- **Pomodoro** configurable.
- **Captura rápida global**: `Ctrl+Alt+N` abre una ventana flotante desde cualquier parte del sistema.

## Requisitos previos

1. **Windows 10/11**.
2. **Rust** (toolchain MSVC) — instálalo desde [rustup.rs](https://rustup.rs/). Durante la instalación acepta el toolchain por defecto (`stable-x86_64-pc-windows-msvc`).
3. **Microsoft Visual Studio C++ Build Tools** — si no los tienes, rustup te lo indicará. Descárgalos [aquí](https://visualstudio.microsoft.com/visual-cpp-build-tools/) y marca "Desarrollo para el escritorio con C++".
4. **WebView2** — viene preinstalado en Windows 11 y en Windows 10 actualizado. Si falta: [descarga](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
5. **Node.js 20+** — [nodejs.org](https://nodejs.org/).
6. **pnpm** — tras instalar Node:

   ```powershell
   npm install -g pnpm
   ```

## Instalación

```powershell
# 1. Clona el repositorio
git clone https://github.com/<tu-usuario>/mvnotes.git
cd mvnotes

# 2. Instala las dependencias
pnpm install

# 3. Arranca en modo desarrollo (primera compilación de Rust tarda varios minutos)
pnpm tauri dev
```

### Compilar el instalador (.msi / .exe)

```powershell
pnpm tauri build
```

El instalador queda en `src-tauri/target/release/bundle/`.

## Configuración de las API keys

La app funciona sin keys (usa el reconocimiento de voz del navegador), pero la experiencia completa requiere Deepgram y Groq. **Ambos tienen tier gratuito.**

Las keys se guardan **solo en tu equipo**, en una base de datos SQLite local. Nunca salen de tu máquina salvo para llamar a las APIs de Deepgram/Groq.

### 1. Deepgram (transcripción de voz)

1. Crea una cuenta gratuita en [console.deepgram.com](https://console.deepgram.com/) (incluye crédito gratuito generoso).
2. En el panel, ve a **API Keys** → **Create a New API Key**.
3. Dale un nombre (ej. `mvnotes`), permisos **Member** y copia la key generada (solo se muestra una vez).

### 2. Groq (interpretación de tareas y resúmenes)

1. Crea una cuenta gratuita en [console.groq.com](https://console.groq.com/).
2. Ve a **API Keys** → **Create API Key**.
3. Copia la key (empieza por `gsk_...`).

### 3. Pegar las keys en la app

1. Abre MVNOTES y ve a **Ajustes** (icono de engranaje en la barra lateral).
2. En la sección **Inteligencia Artificial**, pega tu key de Groq. El modelo por defecto es `llama-3.3-70b-versatile` (puedes cambiarlo por cualquier modelo disponible en Groq).
3. En la sección **Reconocimiento de voz**, pega tu key de Deepgram.
4. Listo — pulsa el botón de micrófono en el Dashboard (o `Ctrl+Alt+N` desde cualquier app) y dicta tus tareas.

## Uso de la voz

Ejemplos de frases que entiende:

- *"Hoy a las 3 de la tarde reunión de equipo una hora"*
- *"Mañana estudiar matemáticas 2 horas, después descansar 30 minutos"*
- *"Todos los lunes gimnasio a las 7"*
- *"Inicia el pomodoro"* / *"Foco de 50 minutos"*

## Stack

| Capa | Tecnología |
|---|---|
| Shell nativo | Tauri 2 (Rust) |
| UI | React 19 + TypeScript + Tailwind CSS + shadcn/ui |
| Estado | Zustand |
| Base de datos | SQLite (local, vía rusqlite) |
| Pizarra | tldraw |
| Voz | Deepgram nova-2 (es) + Groq |

## Privacidad y seguridad

- Sin telemetría, sin cuentas, sin servidores propios.
- Datos y API keys se almacenan únicamente en SQLite local (`pizarra.db` en el directorio de datos de la app).
- La CSP de Tauri solo permite conexiones a `api.deepgram.com`, `api.groq.com` y `cdn.tldraw.com`.
- El audio se envía a Deepgram solo cuando tú pulsas grabar; el texto transcrito se envía a Groq para extraer las tareas. Nada más sale de tu equipo.

## Licencia

MIT
