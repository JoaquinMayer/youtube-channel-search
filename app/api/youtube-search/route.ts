import { NextResponse } from "next/server"

// Verificar que la API key de YouTube esté configurada
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

export async function GET(request: Request) {
  // Verificar si la API key está configurada
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "YouTube API key no configurada" }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get("keyword")
  const maxResultsParam = searchParams.get("maxResults") || "50"
  const maxResults = Math.min(Number.parseInt(maxResultsParam), 500) // Limitar a 500 canales máximo para evitar abusos

  // Nuevos parámetros de filtro
  const regionCode = searchParams.get("regionCode") || ""
  const order = searchParams.get("order") || "relevance"
  const relevanceLanguage = searchParams.get("relevanceLanguage") || ""
  const includeLastVideoDate = searchParams.get("includeLastVideoDate") === "true"

  if (!keyword) {
    return NextResponse.json({ error: "Se requiere una palabra clave" }, { status: 400 })
  }

  try {
    // Para solicitudes de más de 50 canales, necesitamos hacer múltiples llamadas
    // ya que la API de YouTube limita a 50 resultados por solicitud
    let allChannels: any[] = []
    let pageToken = ""
    let totalResults = 0

    // Usar un bucle while para obtener todos los resultados necesarios
    while (allChannels.length < maxResults) {
      // Construir la URL con o sin pageToken
      let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        keyword,
      )}&type=channel&maxResults=50&key=${YOUTUBE_API_KEY}`

      // Añadir parámetros opcionales si están definidos
      if (regionCode) searchUrl += `&regionCode=${regionCode}`
      if (order) searchUrl += `&order=${order}`
      if (relevanceLanguage) searchUrl += `&relevanceLanguage=${relevanceLanguage}`

      if (pageToken) {
        searchUrl += `&pageToken=${pageToken}`
      }

      const searchResponse = await fetch(searchUrl)

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json()

        // Detectar específicamente errores de cuota excedida
        if (
          searchResponse.status === 403 &&
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

      const searchData = await searchResponse.json()

      // Guardar el total de resultados disponibles
      if (totalResults === 0) {
        totalResults = searchData.pageInfo?.totalResults || 0
      }

      // Si no hay resultados, salir del bucle
      if (!searchData.items || searchData.items.length === 0) {
        break
      }

      // Guardar los resultados
      allChannels = [...allChannels, ...searchData.items]

      // Guardar el token para la siguiente página si existe y necesitamos más resultados
      pageToken = searchData.nextPageToken

      // Si no hay más páginas o ya tenemos suficientes resultados, salir del bucle
      if (!pageToken || allChannels.length >= maxResults) {
        break
      }
    }

    // Limitar al número máximo solicitado
    allChannels = allChannels.slice(0, maxResults)

    // Si no hay resultados, devolver array vacío
    if (allChannels.length === 0) {
      return NextResponse.json({ channels: [], totalResults: 0 })
    }

    // Obtener IDs de los canales encontrados
    const channelIds = allChannels.map((item: any) => item.id.channelId)

    // Obtener detalles de los canales (incluye estadísticas como suscriptores)
    // La API de canales también tiene un límite, así que podríamos necesitar múltiples solicitudes
    const channelBatches = []
    for (let i = 0; i < channelIds.length; i += 50) {
      const batchIds = channelIds.slice(i, i + 50)
      channelBatches.push(batchIds)
    }

    let allChannelDetails: any[] = []

    for (const batch of channelBatches) {
      const channelsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${batch.join(
          ",",
        )}&key=${YOUTUBE_API_KEY}`,
      )

      if (!channelsResponse.ok) {
        const errorData = await channelsResponse.json()

        // Detectar específicamente errores de cuota excedida
        if (
          channelsResponse.status === 403 &&
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

      const channelsData = await channelsResponse.json()
      allChannelDetails = [...allChannelDetails, ...(channelsData.items || [])]
    }

    // Formatear los datos de los canales
    let channels = allChannelDetails.map((channel: any) => ({
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnailUrl: channel.snippet.thumbnails.medium.url,
      subscriberCount: Number.parseInt(channel.statistics.subscriberCount) || 0,
      videoCount: Number.parseInt(channel.statistics.videoCount) || 0,
      viewCount: Number.parseInt(channel.statistics.viewCount) || 0,
      lastVideoDate: null, // Inicialmente null, se llenará si se solicita
    }))

    // Si se solicita la fecha del último video, obtenerla para cada canal
    if (includeLastVideoDate) {
      // Procesar los canales en lotes para no exceder los límites de la API
      const channelsWithLastVideoDate = await Promise.all(
        channels.map(async (channel) => {
          try {
            // Buscar el video más reciente del canal
            const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${
              channel.id
            }&order=date&maxResults=1&type=video&key=${YOUTUBE_API_KEY}`

            const videosResponse = await fetch(videosUrl)

            if (!videosResponse.ok) {
              // Detectar específicamente errores de cuota excedida
              if (videosResponse.status === 403) {
                const errorData = await videosResponse.json()
                if (
                  errorData.error?.errors?.some(
                    (e: any) => e.reason === "quotaExceeded" || e.reason === "dailyLimitExceeded",
                  ) ||
                  errorData.error?.message?.includes("quota") ||
                  errorData.error?.message?.includes("Quota")
                ) {
                  throw new Error("QUOTA_EXCEEDED")
                }
              }
              return channel // Devolver el canal sin fecha si hay error
            }

            const videosData = await videosResponse.json()

            // Si hay videos, obtener la fecha del más reciente
            if (videosData.items && videosData.items.length > 0) {
              const lastVideoDate = new Date(videosData.items[0].snippet.publishedAt)
              return {
                ...channel,
                lastVideoDate: lastVideoDate.toISOString(),
                lastVideoId: videosData.items[0].id.videoId,
                lastVideoTitle: videosData.items[0].snippet.title,
              }
            }

            return channel // Devolver el canal sin fecha si no hay videos
          } catch (error) {
            // Si el error es por cuota excedida, propagar el error
            if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
              throw error
            }

            console.error(`Error al obtener videos para el canal ${channel.id}:`, error)
            return channel // Devolver el canal sin fecha en caso de error
          }
        }),
      ).catch((error) => {
        // Si el error es por cuota excedida, devolver respuesta de error
        if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
          throw new Error("QUOTA_EXCEEDED")
        }
        throw error
      })

      channels = channelsWithLastVideoDate
    }

    return NextResponse.json({
      channels,
      totalResults,
      progress: 100,
    })
  } catch (error) {
    console.error("Error al buscar canales:", error)

    // Verificar si el error es por cuota excedida
    if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
      return NextResponse.json(
        {
          error: "Límite de cuota diaria excedido",
          quotaExceeded: true,
        },
        { status: 429 },
      )
    }

    return NextResponse.json({ error: "Error al buscar canales de YouTube" }, { status: 500 })
  }
}

