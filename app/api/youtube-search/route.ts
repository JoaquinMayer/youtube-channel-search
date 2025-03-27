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
        throw new Error(`Error en la API de YouTube: ${JSON.stringify(errorData)}`)
      }

      const channelsData = await channelsResponse.json()
      allChannelDetails = [...allChannelDetails, ...(channelsData.items || [])]
    }

    // Formatear los datos de los canales
    const channels = allChannelDetails.map((channel: any) => ({
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnailUrl: channel.snippet.thumbnails.medium.url,
      subscriberCount: Number.parseInt(channel.statistics.subscriberCount) || 0,
      videoCount: Number.parseInt(channel.statistics.videoCount) || 0,
      viewCount: Number.parseInt(channel.statistics.viewCount) || 0,
    }))

    return NextResponse.json({
      channels,
      totalResults,
      progress: 100,
    })
  } catch (error) {
    console.error("Error al buscar canales:", error)
    return NextResponse.json({ error: "Error al buscar canales de YouTube" }, { status: 500 })
  }
}

