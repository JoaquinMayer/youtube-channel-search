import { NextResponse } from "next/server"

// Verificar que la API key de YouTube esté configurada
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

// Modificar la función extractChannelId para soportar el formato @username
function extractChannelId(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // Formato: youtube.com/channel/UC...
    if (urlObj.pathname.includes("/channel/")) {
      const parts = urlObj.pathname.split("/")
      const index = parts.indexOf("channel")
      if (index !== -1 && index < parts.length - 1) {
        return parts[index + 1]
      }
    }

    // Formato: youtube.com/@username
    if (urlObj.pathname.startsWith("/@")) {
      return urlObj.pathname.substring(2) // Devolver el username sin el @
    }

    return null
  } catch (error) {
    // Si la URL no es válida
    return null
  }
}

// Modificar la función principal GET para manejar el formato @username
export async function GET(request: Request) {
  // Verificar si la API key está configurada
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "YouTube API key no configurada" }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const channelUrl = searchParams.get("channelUrl")
  const maxResults = Number.parseInt(searchParams.get("maxResults") || "20")

  if (!channelUrl) {
    return NextResponse.json({ error: "Se requiere una URL de canal" }, { status: 400 })
  }

  try {
    // Extraer el ID o username del canal de la URL
    const channelIdOrUsername = extractChannelId(channelUrl)

    if (!channelIdOrUsername) {
      return NextResponse.json(
        {
          error: "URL de canal inválida",
          details:
            "El formato de URL no es reconocido. Formatos soportados: youtube.com/channel/ID o youtube.com/@username",
        },
        { status: 400 },
      )
    }

    let channelId = channelIdOrUsername
    let isUsername = false

    // Si la URL es del formato @username, necesitamos obtener el ID real
    if (!channelIdOrUsername.startsWith("UC")) {
      isUsername = true
      // Buscar el canal por username
      const usernameSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent("@" + channelIdOrUsername)}&type=channel&maxResults=1&key=${YOUTUBE_API_KEY}`

      const usernameResponse = await fetch(usernameSearchUrl)

      if (!usernameResponse.ok) {
        const errorData = await usernameResponse.json()

        // Detectar específicamente errores de cuota excedida
        if (
          usernameResponse.status === 403 &&
          (errorData.error?.errors?.some(
            (e: any) => e.reason === "quotaExceeded" || e.reason === "dailyLimitExceeded",
          ) ||
            errorData.error?.message?.includes("quota") ||
            errorData.error?.message?.includes("Quota"))
        ) {
          return NextResponse.json(
            {
              error: "Límite de cuota diaria excedido",
              quotaExceeded: true,
            },
            { status: 429 },
          )
        }

        throw new Error(`Error en la API de YouTube: ${JSON.stringify(errorData)}`)
      }

      const usernameData = await usernameResponse.json()

      if (!usernameData.items || usernameData.items.length === 0) {
        return NextResponse.json(
          {
            error: "Canal no encontrado",
            details: `No se encontró ningún canal con el nombre de usuario @${channelIdOrUsername}`,
          },
          { status: 404 },
        )
      }

      // Obtener el ID real del canal
      channelId = usernameData.items[0].id.channelId
    }

    // Obtener información del canal original
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`,
    )

    if (!channelResponse.ok) {
      const errorData = await channelResponse.json()

      // Detectar específicamente errores de cuota excedida
      if (
        channelResponse.status === 403 &&
        (errorData.error?.errors?.some((e: any) => e.reason === "quotaExceeded" || e.reason === "dailyLimitExceeded") ||
          errorData.error?.message?.includes("quota") ||
          errorData.error?.message?.includes("Quota"))
      ) {
        return NextResponse.json(
          {
            error: "Límite de cuota diaria excedido",
            quotaExceeded: true,
          },
          { status: 429 },
        )
      }

      throw new Error(`Error en la API de YouTube: ${JSON.stringify(errorData)}`)
    }

    const channelData = await channelResponse.json()

    if (!channelData.items || channelData.items.length === 0) {
      return NextResponse.json(
        {
          error: "Canal no encontrado",
          details: isUsername
            ? `No se encontró ningún canal con el nombre de usuario @${channelIdOrUsername}`
            : "El ID de canal proporcionado no existe",
        },
        { status: 404 },
      )
    }

    const channel = channelData.items[0]
    const channelTitle = channel.snippet.title
    const channelDescription = channel.snippet.description

    // Extraer palabras clave del título y descripción del canal
    const keywords = extractKeywords(channelTitle, channelDescription)

    if (keywords.length === 0) {
      return NextResponse.json({ error: "No se pudieron extraer palabras clave del canal" }, { status: 400 })
    }

    // Buscar canales relacionados usando las palabras clave
    const keywordQuery = keywords.slice(0, 3).join(" ")

    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keywordQuery)}&type=channel&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`,
    )

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json()

      // Detectar específicamente errores de cuota excedida
      if (
        searchResponse.status === 403 &&
        (errorData.error?.errors?.some((e: any) => e.reason === "quotaExceeded" || e.reason === "dailyLimitExceeded") ||
          errorData.error?.message?.includes("quota") ||
          errorData.error?.message?.includes("Quota"))
      ) {
        return NextResponse.json(
          {
            error: "Límite de cuota diaria excedido",
            quotaExceeded: true,
          },
          { status: 429 },
        )
      }

      throw new Error(`Error en la API de YouTube: ${JSON.stringify(errorData)}`)
    }

    const searchData = await searchResponse.json()

    // Filtrar el canal original de los resultados
    const relatedChannelItems = searchData.items?.filter((item: any) => item.id.channelId !== channelId) || []

    if (relatedChannelItems.length === 0) {
      return NextResponse.json({
        channels: [],
        originalChannel: {
          id: channelId,
          title: channelTitle,
          keywords,
        },
      })
    }

    // Obtener detalles completos de los canales relacionados
    const relatedChannelIds = relatedChannelItems.map((item: any) => item.id.channelId)

    const channelsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${relatedChannelIds.join(",")}&key=${YOUTUBE_API_KEY}`,
    )

    if (!channelsResponse.ok) {
      const errorData = await channelsResponse.json()

      // Detectar específicamente errores de cuota excedida
      if (
        channelsResponse.status === 403 &&
        (errorData.error?.errors?.some((e: any) => e.reason === "quotaExceeded" || e.reason === "dailyLimitExceeded") ||
          errorData.error?.message?.includes("quota") ||
          errorData.error?.message?.includes("Quota"))
      ) {
        return NextResponse.json(
          {
            error: "Límite de cuota diaria excedido",
            quotaExceeded: true,
          },
          { status: 429 },
        )
      }

      throw new Error(`Error en la API de YouTube: ${JSON.stringify(errorData)}`)
    }

    const channelsData = await channelsResponse.json()

    // Formatear los datos de los canales
    const relatedChannels =
      channelsData.items?.map((channel: any) => ({
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnailUrl: channel.snippet.thumbnails.medium.url,
        subscriberCount: Number.parseInt(channel.statistics.subscriberCount) || 0,
        videoCount: Number.parseInt(channel.statistics.videoCount) || 0,
        viewCount: Number.parseInt(channel.statistics.viewCount) || 0,
        lastVideoDate: null, // No obtenemos esta información para ahorrar cuota
      })) || []

    return NextResponse.json({
      channels: relatedChannels,
      originalChannel: {
        id: channelId,
        title: channelTitle,
        keywords,
      },
    })
  } catch (error) {
    console.error("Error al buscar canales relacionados:", error)
    return NextResponse.json({ error: "Error al buscar canales relacionados" }, { status: 500 })
  }
}

// Función para extraer palabras clave relevantes del título y descripción
function extractKeywords(title: string, description: string): string[] {
  // Combinar título y descripción
  const text = `${title} ${description}`.toLowerCase()

  // Dividir en palabras
  const words = text.split(/\s+/)

  // Filtrar palabras comunes y cortas
  const commonWords = new Set([
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
    "y",
    "o",
    "pero",
    "porque",
    "que",
    "de",
    "en",
    "a",
    "con",
    "por",
    "para",
    "como",
    "se",
    "su",
    "sus",
    "mi",
    "mis",
    "tu",
    "tus",
    "es",
    "son",
    "al",
    "del",
    "lo",
    "he",
    "ha",
    "han",
    "este",
    "esta",
    "estos",
    "estas",
    "ese",
    "esa",
    "esos",
    "esas",
    "the",
    "of",
    "and",
    "to",
    "in",
    "is",
    "it",
    "you",
    "that",
    "was",
    "for",
    "on",
    "are",
    "with",
    "as",
    "at",
    "be",
    "this",
    "have",
    "from",
    "or",
    "had",
    "by",
    "not",
    "but",
    "what",
    "all",
    "were",
    "when",
    "we",
    "there",
    "can",
    "an",
    "your",
    "which",
    "their",
    "if",
    "will",
    "one",
    "about",
    "how",
    "up",
    "them",
  ])

  const filteredWords = words.filter((word) => {
    // Eliminar caracteres especiales
    const cleanWord = word.replace(/[^\w\sáéíóúüñ]/g, "")
    // Filtrar palabras comunes y palabras muy cortas
    return cleanWord.length > 3 && !commonWords.has(cleanWord)
  })

  // Contar frecuencia de palabras
  const wordCount: Record<string, number> = {}
  filteredWords.forEach((word) => {
    wordCount[word] = (wordCount[word] || 0) + 1
  })

  // Ordenar por frecuencia y obtener las más comunes
  const sortedWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0])

  // Devolver las palabras más relevantes (máximo 5)
  return sortedWords.slice(0, 5)
}

