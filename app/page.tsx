"use client"

import type React from "react"

import { useState } from "react"
import { Search, Filter } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"
// Eliminadas las importaciones de Select que ya no se utilizan
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"

interface Channel {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  subscriberCount: number
  videoCount: number
  viewCount: number
}

// Lista de países para regionCode
const countries = [
  { code: "", name: "Global (Sin filtro)" },
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "España" },
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "BR", name: "Brasil" },
  { code: "CA", name: "Canadá" },
  { code: "GB", name: "Reino Unido" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "JP", name: "Japón" },
  { code: "KR", name: "Corea del Sur" },
  { code: "RU", name: "Rusia" },
  { code: "IN", name: "India" },
  { code: "AU", name: "Australia" },
].sort((a, b) => a.name.localeCompare(b.name))

// Lista de opciones de orden
const orderOptions = [
  { value: "relevance", label: "Relevancia" },
  { value: "date", label: "Fecha" },
  { value: "rating", label: "Calificación" },
  { value: "title", label: "Título" },
  { value: "videoCount", label: "Cantidad de videos" },
  { value: "viewCount", label: "Cantidad de vistas" },
]

// Lista de idiomas para relevanceLanguage
const languages = [
  { code: "", name: "Todos los idiomas" },
  { code: "es", name: "Español" },
  { code: "en", name: "Inglés" },
  { code: "pt", name: "Portugués" },
  { code: "fr", name: "Francés" },
  { code: "de", name: "Alemán" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "Japonés" },
  { code: "ko", name: "Coreano" },
  { code: "ru", name: "Ruso" },
  { code: "zh", name: "Chino" },
  { code: "ar", name: "Árabe" },
].sort((a, b) => a.name.localeCompare(b.name))

export default function ChannelSearch() {
  const [keyword, setKeyword] = useState("")
  const [minSubscribers, setMinSubscribers] = useState(0)
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const { toast } = useToast()
  const [maxResults, setMaxResults] = useState(50)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [totalResults, setTotalResults] = useState(0)
  const [showFilters, setShowFilters] = useState(false)

  // Nuevos filtros
  const [regionCode, setRegionCode] = useState("")
  const [order, setOrder] = useState("relevance")
  const [relevanceLanguage, setRelevanceLanguage] = useState("")

  const searchChannels = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!keyword.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa una palabra clave para buscar",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setLoadingProgress(0)
    setChannels([])

    try {
      // Construir la URL con todos los parámetros
      let searchUrl = `/api/youtube-search?keyword=${encodeURIComponent(keyword)}&maxResults=${maxResults}`

      // Añadir parámetros opcionales si están definidos
      if (regionCode) searchUrl += `&regionCode=${regionCode}`
      if (order) searchUrl += `&order=${order}`
      if (relevanceLanguage) searchUrl += `&relevanceLanguage=${relevanceLanguage}`

      const response = await fetch(searchUrl)

      if (!response.ok) {
        throw new Error("Error al buscar canales")
      }

      const data = await response.json()
      setChannels(data.channels)
      setTotalResults(data.totalResults || data.channels.length)

      // Si hay un evento de progreso, actualizar la barra de progreso
      if (data.progress) {
        setLoadingProgress(100) // Completado
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al buscar canales de YouTube",
        variant: "destructive",
      })
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Escuchar eventos de progreso desde el servidor
  // const listenForProgress = () => {
  //   const eventSource = new EventSource(`/api/youtube-search/progress`)

  //   eventSource.onmessage = (event) => {
  //     const data = JSON.parse(event.data)
  //     setLoadingProgress(data.progress)

  //     if (data.progress >= 100) {
  //       eventSource.close()
  //     }
  //   }

  //   eventSource.onerror = () => {
  //     eventSource.close()
  //   }

  //   return () => {
  //     eventSource.close()
  //   }
  // }

  const filteredChannels = channels.filter((channel) => channel.subscriberCount >= minSubscribers)

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Buscador de Canales de YouTube</h1>

      <form onSubmit={searchChannels} className="mb-8">
        <div className="flex flex-col gap-4 max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Buscar canales por palabra clave..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="relative w-24">
              <Input
                type="number"
                min="1"
                max="500"
                placeholder="Cantidad"
                value={maxResults}
                onChange={(e) => setMaxResults(Number.parseInt(e.target.value) || 50)}
                className="w-full"
                title="Número de canales a recuperar (puede requerir múltiples solicitudes)"
              />
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <span className="animate-spin mr-2">⏳</span> : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </div>

          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 p-4 border rounded-md bg-muted/20">
                <div className="space-y-2">
                  <label className="text-sm font-medium">País/Región</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={regionCode}
                    onChange={(e) => setRegionCode(e.target.value)}
                  >
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ordenar por</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                  >
                    {orderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Idioma</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={relevanceLanguage}
                    onChange={(e) => setRelevanceLanguage(e.target.value)}
                  >
                    {languages.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </form>

      {loading && (
        <div className="mb-8 max-w-xl mx-auto">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span>Cargando canales...</span>
              <span>{Math.round(loadingProgress)}%</span>
            </div>
            <Progress value={loadingProgress} className="h-2" />
          </div>
        </div>
      )}

      {channels.length > 0 && (
        <div className="mb-8 max-w-xl mx-auto">
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex justify-between">
              <label className="text-sm font-medium">
                Filtrar por suscriptores mínimos: {minSubscribers.toLocaleString()}
              </label>
              <span className="text-sm text-muted-foreground">
                {filteredChannels.length} de {channels.length} canales
              </span>
            </div>
            <Slider
              value={[minSubscribers]}
              min={0}
              max={Math.max(...channels.map((c) => c.subscriberCount), 1000000)}
              step={1000}
              onValueChange={(value) => setMinSubscribers(value[0])}
            />
          </div>

          {totalResults > channels.length && (
            <div className="text-sm text-muted-foreground text-center mb-4">
              Mostrando {channels.length} de {totalResults.toLocaleString()} resultados totales
            </div>
          )}
        </div>
      )}

      {loading && channels.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin text-4xl mb-4">🔍</div>
          <p>Buscando canales de YouTube...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChannels.map((channel) => (
            <Card key={channel.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Image
                    src={channel.thumbnailUrl || "/placeholder.svg?height=80&width=80"}
                    alt={channel.title}
                    width={80}
                    height={80}
                    className="rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`https://youtube.com/channel/${channel.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold hover:text-primary line-clamp-1"
                    >
                      {channel.title}
                    </Link>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {channel.description || "Sin descripción"}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="font-semibold">{channel.subscriberCount.toLocaleString()}</p>
                        <p className="text-muted-foreground">Suscriptores</p>
                      </div>
                      <div>
                        <p className="font-semibold">{channel.videoCount.toLocaleString()}</p>
                        <p className="text-muted-foreground">Videos</p>
                      </div>
                      <div>
                        <p className="font-semibold">{channel.viewCount.toLocaleString()}</p>
                        <p className="text-muted-foreground">Vistas</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredChannels.length === 0 && channels.length > 0 && (
        <div className="text-center py-12">
          <p>No se encontraron canales con {minSubscribers.toLocaleString()} o más suscriptores.</p>
        </div>
      )}

      {!loading && channels.length === 0 && keyword && (
        <div className="text-center py-12">
          <p>No se encontraron canales para "{keyword}".</p>
        </div>
      )}
    </div>
  )
}

