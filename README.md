# Utopía - Red Social

Una red social moderna construida con Astro, React, y Supabase.

## 🚀 Características

- **Autenticación OAuth** - Google y Facebook
- **Feed de publicaciones** - Comparte textos, imágenes y videos
- **Perfiles de usuario** - Personaliza tu perfil
- **Sistema de amistades** - Conecta con otros usuarios
- **Mensajería en tiempo real** - Chat privado
- **Radio en vivo** - Transmite música y voz en tiempo real con WebRTC
- **Mapa interactivo** - Visualiza alertas cercanas
- **Reels** - Videos cortos

## 🛠️ Tecnologías

- **Frontend**: Astro + React + Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Tiempo real**: WebRTC para transmisión de voz
- **Deploy**: Vercel

## 📦 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/eduardlon/Utopia.git
cd Utopia
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env
```

4. Edita `.env` con tus credenciales de Supabase:
```
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

5. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## 🚀 Despliegue en Vercel

### Opción 1: Desde la CLI de Vercel

1. Instala Vercel CLI:
```bash
npm i -g vercel
```

2. Despliega:
```bash
vercel
```

### Opción 2: Desde el Dashboard de Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en "New Project"
3. Importa el repositorio `eduardlon/Utopia`
4. Configura las variables de entorno:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
5. Haz clic en "Deploy"

## ⚙️ Configuración de Supabase

### Tablas necesarias

El proyecto requiere las siguientes tablas en Supabase:
- `profiles` - Perfiles de usuario
- `posts` - Publicaciones
- `comments` - Comentarios
- `likes` - Me gusta
- `friends` - Relaciones de amistad
- `messages` - Mensajes privados
- `radio_channels` - Canales de radio
- `radio_tracks` - Pistas de radio
- `radio_messages` - Mensajes de radio
- `alerts` - Alertas del mapa

Las migraciones están en la carpeta `supabase/migrations/`

### Configuración OAuth

1. Ve a Authentication > Providers en Supabase
2. Habilita Google y/o Facebook
3. Configura las credenciales OAuth de cada proveedor
4. En Authentication > URL Configuration:
   - Site URL: `https://tu-proyecto.vercel.app`
   - Redirect URLs: `https://tu-proyecto.vercel.app/*`

## 📝 Licencia

MIT

## 👤 Autor

@eduardlon
