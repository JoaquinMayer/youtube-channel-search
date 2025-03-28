import { NextResponse } from "next/server"

// Verificar que la API key de Gemini esté configurada
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

interface ChannelData {
  title: string
  description: string
  subscriberCount: number
}

interface RequestBody {
  channels: ChannelData[]
  sourceKeyword: string
}

export async function POST(request: Request) {
  // Verificar si la API key está configurada
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini API key no configurada" }, { status: 500 })
  }

  try {
    const body: RequestBody = await request.json()
    const { channels, sourceKeyword } = body

    if (!channels || channels.length === 0) {
      return NextResponse.json({ error: "No se proporcionaron datos de canales" }, { status: 400 })
    }

    // Preparar los datos para enviar a Gemini
    const channelDescriptions = channels
      .map(
        (channel, index) =>
          `Canal ${index + 1}: "${channel.title}" (${channel.subscriberCount.toLocaleString()} suscriptores) - ${
            channel.description.substring(0, 200) + (channel.description.length > 200 ? "..." : "")
          }`,
      )
      .join("\n\n")

    // Construir el prompt para Gemini
    const prompt = `
    Eres un experto en marketing de YouTube y SEO. Analiza los siguientes canales de YouTube y genera 10 keywords o frases de búsqueda relevantes que podrían usarse para encontrar canales similares.
    
    Palabra clave original o canal de referencia: "${sourceKeyword}"
    
    Datos de los canales:
    ${channelDescriptions}
    
    Para cada keyword sugerida, proporciona:
    1. La keyword o frase exacta
    2. Una calificación de relevancia (Alta, Media, Baja)
    3. Una breve explicación de por qué esta keyword es relevante (máximo 100 caracteres)
    
    Responde en formato JSON con este esquema exacto:
    {
      "keywords": [
        {
          "keyword": "keyword sugerida",
          "relevance": "Alta/Media/Baja",
          "description": "Breve explicación"
        }
      ]
    }
    
    Asegúrate de que las keywords sean variadas y específicas para el nicho de estos canales. No incluyas keywords genéricas como "YouTube" o "canal".
    `

    // Llamar a la API de Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Error en la API de Gemini: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    // Extraer el texto generado
    const generatedText = data.candidates[0].content.parts[0].text

    // Extraer el JSON de la respuesta
    const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/) || generatedText.match(/{[\s\S]*}/)
    let jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : generatedText

    // Limpiar el string para asegurar que es JSON válido
    jsonString = jsonString
      .replace(/^```json/, "")
      .replace(/```$/, "")
      .trim()

    // Parsear el JSON
    let parsedData
    try {
      parsedData = JSON.parse(jsonString)
    } catch (e) {
      console.error("Error al parsear JSON:", e)
      console.log("JSON string:", jsonString)

      // Intento de recuperación: buscar el objeto JSON en el texto
      const regex = /{[\s\S]*"keywords"[\s\S]*}/g
      const match = generatedText.match(regex)
      if (match) {
        try {
          parsedData = JSON.parse(match[0])
        } catch (e2) {
          throw new Error("No se pudo extraer un JSON válido de la respuesta de Gemini")
        }
      } else {
        throw new Error("No se pudo extraer un JSON válido de la respuesta de Gemini")
      }
    }

    return NextResponse.json(parsedData)
  } catch (error) {
    console.error("Error al generar keywords:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al generar keywords con Gemini" },
      { status: 500 },
    )
  }
}

