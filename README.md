# I|A — Sistema de Gestión Legal
### React + Vite — Dr. Ignacio Arigós

---

## 🚀 Instalación local (primera vez)

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servidor de desarrollo
npm run dev
```

Abrí http://localhost:5173 en el navegador.

---

## ☁️ Deploy en Cloudflare Pages (gratis)

### Paso 1 — Subir a GitHub
```bash
git init
git add .
git commit -m "CRM Legal v1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/crm-legal.git
git push -u origin main
```

### Paso 2 — Conectar con Cloudflare Pages
1. Ir a https://pages.cloudflare.com
2. "Create a project" → "Connect to Git"
3. Seleccionar el repositorio `crm-legal`
4. Configurar el build:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. "Save and Deploy" → listo ✅

Cloudflare te da una URL tipo `crm-legal.pages.dev` gratis.

---

## 📁 Estructura del proyecto

```
crm-legal/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx          ← Entry point
    ├── App.jsx           ← Routing principal
    ├── index.css         ← Todos los estilos
    ├── lib/
    │   ├── supabase.js   ← DB + utilidades
    │   └── store.js      ← Estado global
    ├── components/
    │   ├── Sidebar.jsx   ← Sidebar + calendario
    │   └── Modal.jsx     ← Modal reutilizable
    └── screens/
        ├── Home.jsx
        ├── Tareas.jsx
        ├── Registro.jsx
        ├── Gastos.jsx
        ├── Causas.jsx
        ├── CausaDetail.jsx
        ├── Cobros.jsx      ← ARS + USD
        └── Documentos.jsx  ← IA + Google Drive
```

---

## ✨ Nuevas funcionalidades v2

### Cobros ARS + USD
- Modal con selector de moneda ($ ARS / U$S USD)
- Dashboard con 4 tarjetas: ARS mes, ARS año, USD mes, USD año
- Lista filtrable por moneda (Todos / Solo ARS / Solo USD)
- En detalle de causa: muestra cobrados ARS y USD por separado

### Generador de Documentos con IA
- 7 tipos de documentos: nota simple, escrito de inicio, contrato de honorarios, poder judicial, carta documento, informe de causa, documento libre
- Se autocompeta con datos del expediente seleccionado
- Generado con Claude claude-sonnet-4-20250514 vía API
- Guardado en Google Drive (carpeta automática por cliente)
- Fallback: descarga como archivo .txt si Drive no está disponible

---

## 🔧 Agregar una nueva pantalla

1. Crear `src/screens/MiPantalla.jsx`
2. Importar en `App.jsx`:
   ```jsx
   import MiPantalla from './screens/MiPantalla.jsx'
   // ...
   {screen === 'mipantalla' && <MiPantalla store={store} />}
   ```
3. Agregar en `Sidebar.jsx` el item de navegación:
   ```js
   { id: 'mipantalla', icon: '🆕', label: 'Mi Pantalla' }
   ```

---

## 📦 Build para producción

```bash
npm run build
# Genera la carpeta /dist lista para subir
```
