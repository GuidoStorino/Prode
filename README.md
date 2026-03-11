# 🏆 Prode - Votos en Secreto

App de prode multijugador en tiempo real. Los jugadores votan en secreto y los resultados se revelan todos juntos con un código compartido.

## Stack
- **React + Vite** — frontend
- **Firebase Firestore** — base de datos en tiempo real
- **Firebase Auth anónima** — identificación de jugadores sin registro

---

## Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Correr en desarrollo

```bash
npm run dev
```

La app estará en `http://localhost:5173`

---

## Flujo de juego

### Crear una partida
1. Entrá a la app → tab **"Crear sala"**
2. Ingresá tu nombre
3. Agregá los eventos (preguntas + opciones)
4. Definí un **código de revelación** secreto (ej: `FINALCOPA`)
5. Compartí el **código de sala** (4 letras) con los demás jugadores

### Unirse a la partida
1. Entrá a la app → tab **"Unirse"**
2. Ingresá tu nombre y el código de sala
3. Votá en secreto cada evento

### Revelar los votos
1. Cuando estén listos, cualquier jugador va a **"Revelar"**
2. Ingresa el código de revelación
3. Todos los votos aparecen simultáneamente en todos los dispositivos

### Scoreboard
1. Después de revelar, cualquier jugador puede cargar los **resultados reales**
2. La app calcula automáticamente quién acertó más

---

## Build para producción

```bash
npm run build
```

Los archivos quedan en `/dist` listos para deployar en Vercel, Netlify, Firebase Hosting, etc.

---

## Deploy en Vercel (recomendado)

```bash
npx vercel
```

O conectá el repo en [vercel.com](https://vercel.com) con un click.

---

## Seguridad (importante antes de producción)

Las reglas de Firestore están abiertas para desarrollo. Antes de compartir públicamente, actualizalas en Firebase Console → Firestore → Reglas para restringir acceso por sala y usuario.
