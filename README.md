# YouTube Channel Search

Una aplicación web moderna para buscar y explorar canales de YouTube. Construida con Next.js, TypeScript y Tailwind CSS.

## 🎯 Propósito

Esta aplicación te permite descubrir y suscribirte a canales de YouTube especializados en temas específicos. Es perfecta para:

- Encontrar canales expertos en cualquier tema o área de interés
- Mantenerte actualizado con contenido relevante de YouTube
- Organizar tus suscripciones por temas
- Descubrir nuevos creadores de contenido en tu área de interés

## 🚀 Características

- Búsqueda de canales de YouTube
- Interfaz de usuario moderna y responsiva
- Componentes UI reutilizables con Radix UI
- Animaciones suaves
- Diseño optimizado para móviles

## 🛠️ Tecnologías Utilizadas

- [Next.js](https://nextjs.org/) - Framework de React
- [TypeScript](https://www.typescriptlang.org/) - Lenguaje de programación tipado
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS
- [Radix UI](https://www.radix-ui.com/) - Componentes UI accesibles
- [React Hook Form](https://react-hook-form.com/) - Manejo de formularios
- [Zod](https://zod.dev/) - Validación de esquemas

## 📋 Prerrequisitos

- Node.js 18.x o superior
- npm o yarn
- API Key de YouTube Data API v3

## 🔧 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/JoaquinMayer/youtube-channel-search.git
cd youtube-channel-search
```

2. Instala las dependencias:
```bash
npm install
# o
yarn install
```

3. Configura las variables de entorno:

   a. Obtén una API Key de YouTube:
   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Crea un nuevo proyecto o selecciona uno existente
   - Habilita la YouTube Data API v3
   - Ve a "Credenciales" y crea una nueva API Key
   - Restringe la API Key para mayor seguridad (opcional pero recomendado)

   b. Crea un archivo `.env` en la raíz del proyecto:
   ```env
   YOUTUBE_API_KEY=tu_api_key_aqui
   ```

   > ⚠️ **Nota**: La API Key de YouTube tiene cuotas de uso diarias. Para desarrollo, la cuota gratuita debería ser suficiente.
   > Puedes consultar los límites de cuota y el uso actual en la [Consola de Google Cloud](https://console.cloud.google.com/apis/dashboard).
   > La cuota gratuita incluye 10,000 unidades por día, donde cada operación consume un número diferente de unidades.
   > Por ejemplo, una búsqueda de canales consume 100 unidades.

4. Inicia el servidor de desarrollo:
```bash
npm run dev
# o
yarn dev
```

5. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📸 Capturas de Pantalla

[Agregar capturas de pantalla aquí]

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir los cambios que te gustaría hacer.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Autores

- Joaquin Mayer - [@JoaquinMayer](https://github.com/JoaquinMayer)

## 🙏 Agradecimientos

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [YouTube Data API v3](https://developers.google.com/youtube/v3/docs/search/list?hl=es-419) - Documentación oficial de la API 