"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Eye,
  Trash2,
  AlertTriangle,
  History,
  Clock,
  X,
  LinkIcon,
  Sparkles,
  Copy,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Channel {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  subscriberCount: number
  videoCount: number
  viewCount: number
  lastVideoDate: string | null
  lastVideoId?: string
  lastVideoTitle?: string
}

interface SearchParams {
  keyword: string
  regionCode: string
  order: string
  relevanceLanguage: string
  includeLastVideoDate: boolean
  maxResults: number
}

interface SavedSearch {
  id: string
  timestamp: number
  params: SearchParams
  channels: Channel[]
  totalResults: number
}

// Añadir una nueva interfaz para las búsquedas guardadas de canales relacionados
interface SavedRelatedSearch {
  id: string
  timestamp: number
  channelUrl: string
  originalChannel: {
    id: string
    title: string
    keywords: string[]
  }
  channels: Channel[]
}

interface KeywordSuggestion {
  keyword: string
  relevance: string
  description: string
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

// Tipos de ordenamiento local
type SortField = "subscriberCount" | "videoCount" | "viewCount" | "lastVideoDate" | null
type SortDirection = "asc" | "desc"

// Claves para localStorage
const VISITED_CHANNELS_KEY = "youtube-search-visited-channels"
const SAVED_SEARCHES_KEY = "youtube-search-saved-searches"
// Añadir una nueva clave para localStorage
const SAVED_RELATED_SEARCHES_KEY = "youtube-search-related-searches"
// Límite de búsquedas guardadas (para evitar llenar el localStorage)
const MAX_SAVED_SEARCHES = 20

export default function ChannelSearch() {
  const [activeTab, setActiveTab] = useState("search")
  const [keyword, setKeyword] = useState("")
  const [minSubscribers, setMinSubscribers] = useState(0)
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const { toast } = useToast()
  const [maxResults, setMaxResults] = useState(10)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [totalResults, setTotalResults] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [quotaExceeded, setQuotaExceeded] = useState(false)

  // Nuevos filtros
  const [regionCode, setRegionCode] = useState("")
  const [order, setOrder] = useState("relevance")
  const [relevanceLanguage, setRelevanceLanguage] = useState("")
  const [includeLastVideoDate, setIncludeLastVideoDate] = useState(false)
  const [filterInactiveChannels, setFilterInactiveChannels] = useState(false)
  const [maxInactivityMonths, setMaxInactivityMonths] = useState(12) // 12 meses por defecto

  // Estado para ordenamiento local
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Estado para canales visitados
  const [visitedChannels, setVisitedChannels] = useState<Set<string>>(new Set())
  const [hideVisitedChannels, setHideVisitedChannels] = useState(false)

  // Canales filtrados y ordenados
  const [displayedChannels, setDisplayedChannels] = useState<Channel[]>([])

  // Estado para búsquedas guardadas
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [showSavedSearches, setShowSavedSearches] = useState(false)
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null)

  // Añadir nuevos estados para las búsquedas guardadas de canales relacionados
  const [savedRelatedSearches, setSavedRelatedSearches] = useState<SavedRelatedSearch[]>([])
  const [showSavedRelatedSearches, setShowSavedRelatedSearches] = useState(false)
  const [currentRelatedSearchId, setCurrentRelatedSearchId] = useState<string | null>(null)

  // Estado para búsqueda de canales relacionados
  const [channelUrl, setChannelUrl] = useState("")
  const [loadingRelated, setLoadingRelated] = useState(false)
  const [relatedChannels, setRelatedChannels] = useState<Channel[]>([])
  const [originalChannel, setOriginalChannel] = useState<{ id: string; title: string; keywords: string[] } | null>(null)
  const [minRelatedSubscribers, setMinRelatedSubscribers] = useState(0)
  const [displayedRelatedChannels, setDisplayedRelatedChannels] = useState<Channel[]>([])

  // Referencia para saber si es la primera carga
  const isFirstLoad = useRef(true)

  // Estado para el generador de keywords con IA
  const [showKeywordGenerator, setShowKeywordGenerator] = useState(false)
  const [generatingKeywords, setGeneratingKeywords] = useState(false)
  const [suggestedKeywords, setSuggestedKeywords] = useState<KeywordSuggestion[]>([])
  const [keywordSource, setKeywordSource] = useState<"search" | "related">("search")
  const [keywordError, setKeywordError] = useState<string | null>(null)

  // Añadir refs para evitar guardar la misma búsqueda múltiples veces
  const lastSavedSearchRef = useRef<string | null>(null)
  const lastSavedRelatedSearchRef = useRef<string | null>(null)

  // Cargar canales visitados y búsquedas guardadas desde localStorage al iniciar
  useEffect(() => {
    const loadFromLocalStorage = () => {
      try {
        // Cargar canales visitados
        const storedChannels = localStorage.getItem(VISITED_CHANNELS_KEY)
        if (storedChannels) {
          const channelIds = JSON.parse(storedChannels)
          setVisitedChannels(new Set(channelIds))
        }

        // Cargar búsquedas guardadas
        const storedSearches = localStorage.getItem(SAVED_SEARCHES_KEY)
        if (storedSearches) {
          const searches = JSON.parse(storedSearches)
          setSavedSearches(searches)
        }

        // Cargar búsquedas relacionadas guardadas
        const storedRelatedSearches = localStorage.getItem(SAVED_RELATED_SEARCHES_KEY)
        if (storedRelatedSearches) {
          const relatedSearches = JSON.parse(storedRelatedSearches)
          setSavedRelatedSearches(relatedSearches)
        }
      } catch (error) {
        console.error("Error al cargar datos desde localStorage:", error)
      }
    }

    loadFromLocalStorage()
    isFirstLoad.current = false
  }, [])

  // Modificar el efecto para guardar búsquedas normales
  useEffect(() => {
    // No guardar si es la primera carga o si no hay canales o keyword
    if (isFirstLoad.current || channels.length === 0 || !keyword) return

    // Crear un identificador único para esta búsqueda
    const searchIdentifier = `${keyword}_${channels.length}_${Date.now()}`

    // Evitar guardar la misma búsqueda múltiples veces
    if (lastSavedSearchRef.current === searchIdentifier) return

    const saveCurrentSearch = () => {
      try {
        // Crear un ID único para esta búsqueda
        const searchId = `search_${Date.now()}`

        // Crear objeto de búsqueda
        const searchToSave: SavedSearch = {
          id: searchId,
          timestamp: Date.now(),
          params: {
            keyword,
            regionCode,
            order,
            relevanceLanguage,
            includeLastVideoDate,
            maxResults,
          },
          channels,
          totalResults,
        }

        // Actualizar el estado de búsquedas guardadas usando el patrón funcional
        setSavedSearches(prevSearches => {
          const updatedSearches = [searchToSave, ...prevSearches]
          const limitedSearches = updatedSearches.slice(0, MAX_SAVED_SEARCHES)
          
          // Guardar en localStorage
          localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(limitedSearches))
          
          return limitedSearches
        })

        // Actualizar el ref con el identificador actual
        lastSavedSearchRef.current = searchIdentifier
        setCurrentSearchId(searchId)
      } catch (error) {
        console.error("Error al guardar búsqueda:", error)
      }
    }

    saveCurrentSearch()
  }, [channels, keyword, regionCode, order, relevanceLanguage, includeLastVideoDate, maxResults, totalResults])

  // Modificar el efecto para guardar búsquedas relacionadas
  useEffect(() => {
    // No guardar si es la primera carga o si no hay canales o canal original
    if (isFirstLoad.current || relatedChannels.length === 0 || !originalChannel || !channelUrl) return

    // Crear un identificador único para esta búsqueda
    const searchIdentifier = `${channelUrl}_${relatedChannels.length}_${Date.now()}`

    // Evitar guardar la misma búsqueda múltiples veces
    if (lastSavedRelatedSearchRef.current === searchIdentifier) return

    const saveCurrentRelatedSearch = () => {
      try {
        // Crear un ID único para esta búsqueda
        const searchId = `related_search_${Date.now()}`

        // Crear objeto de búsqueda
        const searchToSave: SavedRelatedSearch = {
          id: searchId,
          timestamp: Date.now(),
          channelUrl,
          originalChannel,
          channels: relatedChannels,
        }

        // Actualizar el estado de búsquedas guardadas usando el patrón funcional
        setSavedRelatedSearches(prevSearches => {
          const updatedSearches = [searchToSave, ...prevSearches]
          const limitedSearches = updatedSearches.slice(0, MAX_SAVED_SEARCHES)
          
          // Guardar en localStorage
          localStorage.setItem(SAVED_RELATED_SEARCHES_KEY, JSON.stringify(limitedSearches))
          
          return limitedSearches
        })

        // Actualizar el ref con el identificador actual
        lastSavedRelatedSearchRef.current = searchIdentifier
        setCurrentRelatedSearchId(searchId)
      } catch (error) {
        console.error("Error al guardar búsqueda relacionada:", error)
      }
    }

    saveCurrentRelatedSearch()
  }, [relatedChannels, channelUrl, originalChannel])

  // Modificar el efecto para filtrar canales relacionados por suscriptores
  useEffect(() => {
    // Solo filtrar y ordenar si hay canales relacionados
    if (relatedChannels.length > 0) {
      const filtered = relatedChannels.filter((channel) => channel.subscriberCount >= minRelatedSubscribers)
      setDisplayedRelatedChannels(filtered)
    } else {
      setDisplayedRelatedChannels([])
    }
  }, [relatedChannels, minRelatedSubscribers])

  // También modificar el efecto para aplicar filtros y ordenamiento a los canales normales
  useEffect(() => {
    // Solo proceder si hay canales
    if (channels.length > 0) {
      // Primero filtramos por suscriptores
      let filtered = channels.filter((channel) => channel.subscriberCount >= minSubscribers)

      // Filtrar canales inactivos si está activado
      if (filterInactiveChannels) {
        const cutoffDate = new Date()
        cutoffDate.setMonth(cutoffDate.getMonth() - maxInactivityMonths)

        filtered = filtered.filter((channel) => {
          if (!channel.lastVideoDate) return false // Si no hay fecha, considerarlo inactivo
          const lastVideoDate = new Date(channel.lastVideoDate)
          return lastVideoDate >= cutoffDate
        })
      }

      // Filtrar canales visitados si está activado
      if (hideVisitedChannels) {
        filtered = filtered.filter((channel) => !visitedChannels.has(channel.id))
      }

      // Luego aplicamos el ordenamiento local si está definido
      if (sortField) {
        filtered = [...filtered].sort((a, b) => {
          if (sortField === "lastVideoDate") {
            // Manejar ordenamiento por fecha
            const dateA = a.lastVideoDate ? new Date(a.lastVideoDate).getTime() : 0
            const dateB = b.lastVideoDate ? new Date(b.lastVideoDate).getTime() : 0

            if (sortDirection === "asc") {
              return dateA - dateB
            } else {
              return dateB - dateA
            }
          } else {
            // Ordenamiento numérico para otros campos
            const valueA = a[sortField] || 0
            const valueB = b[sortField] || 0

            if (sortDirection === "asc") {
              return valueA - valueB
            } else {
              return valueB - valueA
            }
          }
        })
      }

      setDisplayedChannels(filtered)
    } else {
      setDisplayedChannels([])
    }
  }, [
    channels,
    minSubscribers,
    sortField,
    sortDirection,
    filterInactiveChannels,
    maxInactivityMonths,
    visitedChannels,
    hideVisitedChannels,
  ])

  // Función para marcar un canal como visitado
  const markChannelAsVisited = (channelId: string) => {
    const updatedVisitedChannels = new Set(visitedChannels)
    updatedVisitedChannels.add(channelId)
    setVisitedChannels(updatedVisitedChannels)

    // Guardar en localStorage
    try {
      localStorage.setItem(VISITED_CHANNELS_KEY, JSON.stringify(Array.from(updatedVisitedChannels)))
    } catch (error) {
      console.error("Error al guardar canales visitados:", error)
    }
  }

  // Función para limpiar todos los canales visitados
  const clearVisitedChannels = () => {
    setVisitedChannels(new Set())
    localStorage.removeItem(VISITED_CHANNELS_KEY)
    toast({
      title: "Historial limpiado",
      description: "Se ha borrado el historial de canales visitados",
    })
  }

  // Función para cargar una búsqueda guardada
  const loadSavedSearch = (search: SavedSearch) => {
    setKeyword(search.params.keyword)
    setRegionCode(search.params.regionCode)
    setOrder(search.params.order)
    setRelevanceLanguage(search.params.relevanceLanguage)
    setIncludeLastVideoDate(search.params.includeLastVideoDate)
    setMaxResults(search.params.maxResults)

    setChannels(search.channels)
    setTotalResults(search.totalResults)
    setCurrentSearchId(search.id)

    // Resetear filtros
    setMinSubscribers(0)
    setSortField(null)
    setSortDirection("desc")
    setFilterInactiveChannels(false)

    setShowSavedSearches(false)
    setActiveTab("search")

    toast({
      title: "Búsqueda cargada",
      description: `Se ha cargado la búsqueda: "${search.params.keyword}"`,
    })
  }

  // Añadir función para cargar una búsqueda relacionada guardada
  const loadSavedRelatedSearch = (search: SavedRelatedSearch) => {
    setChannelUrl(search.channelUrl)
    setRelatedChannels(search.channels)
    setOriginalChannel(search.originalChannel)
    setCurrentRelatedSearchId(search.id)

    // Resetear filtros
    setMinRelatedSubscribers(0)
    setRelatedError(null)

    setShowSavedRelatedSearches(false)

    toast({
      title: "Búsqueda cargada",
      description: `Se ha cargado la búsqueda relacionada para: "${search.originalChannel.title}"`,
    })
  }

  // Función para eliminar una búsqueda guardada
  const deleteSavedSearch = (searchId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation() // Evitar que se active el onClick del padre
    }

    const updatedSearches = savedSearches.filter((search) => search.id !== searchId)
    setSavedSearches(updatedSearches)

    // Guardar en localStorage
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(updatedSearches))

    toast({
      title: "Búsqueda eliminada",
      description: "Se ha eliminado la búsqueda del historial",
    })
  }

  // Añadir función para eliminar una búsqueda relacionada guardada
  const deleteRelatedSavedSearch = (searchId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation() // Evitar que se active el onClick del padre
    }

    const updatedSearches = savedRelatedSearches.filter((search) => search.id !== searchId)
    setSavedRelatedSearches(updatedSearches)

    // Guardar en localStorage
    localStorage.setItem(SAVED_RELATED_SEARCHES_KEY, JSON.stringify(updatedSearches))

    toast({
      title: "Búsqueda eliminada",
      description: "Se ha eliminado la búsqueda relacionada del historial",
    })
  }

  // Función para limpiar todas las búsquedas guardadas
  const clearAllSavedSearches = () => {
    setSavedSearches([])
    localStorage.removeItem(SAVED_SEARCHES_KEY)

    toast({
      title: "Historial limpiado",
      description: "Se han eliminado todas las búsquedas guardadas",
    })
  }

  // Añadir función para limpiar todas las búsquedas relacionadas guardadas
  const clearAllSavedRelatedSearches = () => {
    setSavedRelatedSearches([])
    localStorage.removeItem(SAVED_RELATED_SEARCHES_KEY)

    toast({
      title: "Historial limpiado",
      description: "Se han eliminado todas las búsquedas relacionadas guardadas",
    })
  }

  // Función para buscar canales por palabra clave
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
    setSortField(null) // Resetear ordenamiento al hacer nueva búsqueda
    setQuotaExceeded(false) // Resetear el estado de cuota excedida
    setCurrentSearchId(null) // Resetear el ID de búsqueda actual

    try {
      // Construir la URL con todos los parámetros
      let searchUrl = `/api/youtube-search?keyword=${encodeURIComponent(keyword)}&maxResults=${maxResults}`

      // Añadir parámetros opcionales si están definidos
      if (regionCode) searchUrl += `&regionCode=${regionCode}`
      if (order) searchUrl += `&order=${order}`
      if (relevanceLanguage) searchUrl += `&relevanceLanguage=${relevanceLanguage}`
      if (includeLastVideoDate) searchUrl += `&includeLastVideoDate=true`

      const response = await fetch(searchUrl)
      const data = await response.json()

      if (!response.ok) {
        // Verificar si el error es por cuota excedida
        if (response.status === 429 && data.quotaExceeded) {
          setQuotaExceeded(true)
          throw new Error("Límite de cuota diaria excedido")
        }
        throw new Error(data.error || "Error al buscar canales")
      }

      setChannels(data.channels)
      setTotalResults(data.totalResults || data.channels.length)

      // Si hay un evento de progreso, actualizar la barra de progreso
      if (data.progress) {
        setLoadingProgress(100) // Completado
      }
    } catch (error) {
      // Si ya establecimos quotaExceeded, no mostrar toast adicional
      if (!quotaExceeded) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Ocurrió un error al buscar canales de YouTube",
          variant: "destructive",
        })
      }
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Añadir un nuevo estado para mensajes de error específicos
  const [relatedError, setRelatedError] = useState<{ message: string; details?: string } | null>(null)

  // Modificar la función searchRelatedChannels para manejar errores específicos
  const searchRelatedChannels = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!channelUrl.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa una URL de canal válida",
        variant: "destructive",
      })
      return
    }

    setLoadingRelated(true)
    setRelatedChannels([])
    setOriginalChannel(null)
    setMinRelatedSubscribers(0)
    setRelatedError(null)
    setCurrentRelatedSearchId(null) // Resetear el ID de búsqueda actual

    try {
      const response = await fetch(`/api/related-channels?channelUrl=${encodeURIComponent(channelUrl)}`)
      const data = await response.json()

      if (!response.ok) {
        // Verificar si el error es por cuota excedida
        if (response.status === 429 && data.quotaExceeded) {
          setQuotaExceeded(true)
          throw new Error("Límite de cuota diaria excedido")
        }

        // Manejar errores específicos
        setRelatedError({
          message: data.error || "Error al buscar canales relacionados",
          details: data.details,
        })

        throw new Error(data.error || "Error al buscar canales relacionados")
      }

      setRelatedChannels(data.channels)
      setOriginalChannel(data.originalChannel)
    } catch (error) {
      if (!relatedError) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Ocurrió un error al buscar canales relacionados",
          variant: "destructive",
        })
      }
      console.error(error)
    } finally {
      setLoadingRelated(false)
    }
  }

  // Modificar la función para generar keywords con IA para evitar posibles actualizaciones de estado innecesarias
  const generateKeywords = async (source: "search" | "related") => {
    // Verificar si ya estamos generando keywords para evitar múltiples llamadas
    if (generatingKeywords) return

    // Actualizar estados en un solo batch para evitar múltiples renderizados
    setKeywordSource(source)
    setGeneratingKeywords(true)
    setKeywordError(null)
    setSuggestedKeywords([])
    setShowKeywordGenerator(true)

    // Determinar qué canales usar como fuente
    const sourceChannels = source === "search" ? channels : relatedChannels

    if (sourceChannels.length === 0) {
      setKeywordError("No hay canales disponibles para generar keywords.")
      setGeneratingKeywords(false)
      return
    }

    // Limitar a 10 canales para no sobrecargar la API
    const channelsToAnalyze = sourceChannels.slice(0, 10)

    try {
      // Preparar los datos para enviar a la API
      const channelData = channelsToAnalyze.map((channel) => ({
        title: channel.title,
        description: channel.description || "",
        subscriberCount: channel.subscriberCount,
      }))

      const sourceKeywordValue = source === "search" ? keyword : originalChannel?.title || ""

      // Enviar los datos a nuestra API
      const response = await fetch("/api/generate-keywords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channels: channelData,
          sourceKeyword: sourceKeywordValue,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al generar keywords")
      }

      const data = await response.json()

      // Solo actualizar si tenemos datos válidos
      if (data && data.keywords && Array.isArray(data.keywords)) {
        setSuggestedKeywords(data.keywords)
      } else {
        throw new Error("Formato de respuesta inválido")
      }
    } catch (error) {
      console.error("Error al generar keywords:", error)
      setKeywordError(error instanceof Error ? error.message : "Ocurrió un error al comunicarse con la API de Gemini")
    } finally {
      setGeneratingKeywords(false)
    }
  }

  // Función para cambiar el ordenamiento
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      // Si ya estamos ordenando por este campo, cambiar dirección
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Si es un nuevo campo, establecerlo y usar desc por defecto
      setSortField(field)
      setSortDirection("desc")
    }
  }

  // Función para obtener el icono de ordenamiento
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  // Modificar la función para usar una keyword en la búsqueda
  const useKeywordForSearch = (keywordText: string) => {
    // Cerrar primero el diálogo para evitar actualizaciones de estado mientras está abierto
    setShowKeywordGenerator(false)

    // Usar setTimeout para asegurarnos de que el diálogo se ha cerrado antes de actualizar otros estados
    setTimeout(() => {
      setKeyword(keywordText)
      setActiveTab("search")
      // Desplazar la página hacia arriba para que el usuario vea el campo de búsqueda
      window.scrollTo({ top: 0, behavior: "smooth" })
    }, 100)
  }

  // Función para formatear fecha
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible"
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Función para formatear fecha y hora
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Función para descargar CSV
  const downloadCSV = () => {
    if (displayedChannels.length === 0) {
      toast({
        title: "Error",
        description: "No hay canales para descargar",
        variant: "destructive",
      })
      return
    }

    // Crear cabeceras del CSV
    const headers = [
      "ID",
      "Título",
      "Descripción",
      "URL del Canal",
      "Suscriptores",
      "Videos",
      "Vistas",
      "Fecha Último Video",
      "ID Último Video",
      "Título Último Video",
      "Visitado",
    ]

    // Convertir datos a filas CSV
    const rows = displayedChannels.map((channel) => [
      channel.id,
      `"${channel.title.replace(/"/g, '""')}"`, // Escapar comillas dobles
      `"${(channel.description || "").replace(/"/g, '""')}"`, // Escapar comillas dobles
      `https://youtube.com/channel/${channel.id}`,
      channel.subscriberCount,
      channel.videoCount,
      channel.viewCount,
      channel.lastVideoDate ? `"${formatDate(channel.lastVideoDate)}"` : "",
      channel.lastVideoId ? channel.lastVideoId : "",
      channel.lastVideoTitle ? `"${channel.lastVideoTitle.replace(/"/g, '""')}"` : "",
      visitedChannels.has(channel.id) ? "Sí" : "No",
    ])

    // Combinar cabeceras y filas
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `canales-youtube-${keyword}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Función para descargar CSV de canales relacionados
  const downloadRelatedCSV = () => {
    if (displayedRelatedChannels.length === 0) {
      toast({
        title: "Error",
        description: "No hay canales relacionados para descargar",
        variant: "destructive",
      })
      return
    }

    // Crear cabeceras del CSV
    const headers = ["ID", "Título", "Descripción", "URL del Canal", "Suscriptores", "Videos", "Vistas", "Visitado"]

    // Convertir datos a filas CSV
    const rows = displayedRelatedChannels.map((channel) => [
      channel.id,
      `"${channel.title.replace(/"/g, '""')}"`, // Escapar comillas dobles
      `"${(channel.description || "").replace(/"/g, '""')}"`, // Escapar comillas dobles
      `https://youtube.com/channel/${channel.id}`,
      channel.subscriberCount,
      channel.videoCount,
      channel.viewCount,
      visitedChannels.has(channel.id) ? "Sí" : "No",
    ])

    // Combinar cabeceras y filas
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `canales-relacionados-${originalChannel?.title || "youtube"}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Función para generar keywords con IA

  const copyKeywordToClipboard = (keyword: string) => {
    navigator.clipboard.writeText(keyword)
    toast({
      title: "Keyword copiada",
      description: `Se ha copiado "${keyword}" al portapapeles`,
    })
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Buscador de Canales de YouTube</h1>

      {quotaExceeded && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Límite de cuota diaria excedido</AlertTitle>
          <AlertDescription>
            Has alcanzado el límite diario de solicitudes a la API de YouTube. Este límite se restablece a las 00:00
            horas (hora del Pacífico). Puedes seguir utilizando los resultados ya cargados o cargar búsquedas guardadas
            anteriormente.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-xl mx-auto mb-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search">Buscar por palabra clave</TabsTrigger>
          <TabsTrigger value="related">Buscar canales relacionados</TabsTrigger>
        </TabsList>
        <TabsContent value="search">
          <form onSubmit={searchChannels} className="mb-8">
            <div className="flex flex-col gap-4">
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  title="Mostrar filtros"
                >
                  <Filter className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSavedSearches(true)}
                  title="Historial de búsquedas"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button type="submit" disabled={loading || quotaExceeded}>
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

                    <div className="space-y-2 md:col-span-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeLastVideoDate"
                          checked={includeLastVideoDate}
                          onCheckedChange={(checked) => setIncludeLastVideoDate(checked === true)}
                        />
                        <label
                          htmlFor="includeLastVideoDate"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Obtener fecha del último video (aumenta el tiempo de búsqueda)
                        </label>
                      </div>
                    </div>

                    {includeLastVideoDate && (
                      <div className="space-y-2 md:col-span-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="filterInactiveChannels"
                            checked={filterInactiveChannels}
                            onCheckedChange={(checked) => setFilterInactiveChannels(checked === true)}
                          />
                          <label
                            htmlFor="filterInactiveChannels"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Filtrar canales inactivos
                          </label>
                        </div>

                        {filterInactiveChannels && (
                          <div className="mt-2">
                            <label className="text-sm font-medium">
                              Mostrar solo canales con videos en los últimos {maxInactivityMonths} meses
                            </label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[maxInactivityMonths]}
                                min={1}
                                max={36}
                                step={1}
                                onValueChange={(value) => setMaxInactivityMonths(value[0])}
                                className="flex-1"
                              />
                              <span className="text-sm w-8 text-center">{maxInactivityMonths}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Filtro para canales visitados */}
                    <div className="space-y-2 md:col-span-3 border-t pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="hideVisitedChannels"
                            checked={hideVisitedChannels}
                            onCheckedChange={(checked) => setHideVisitedChannels(checked === true)}
                          />
                          <label
                            htmlFor="hideVisitedChannels"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Ocultar canales visitados ({visitedChannels.size})
                          </label>
                        </div>

                        {visitedChannels.size > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearVisitedChannels}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> Limpiar historial
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </form>

          {loading && (
            <div className="mb-8">
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
            <div className="mb-8">
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">
                    Filtrar por suscriptores mínimos: {minSubscribers.toLocaleString()}
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {displayedChannels.length} de {channels.length} canales
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

              {/* Botones de ordenamiento y descarga */}
              <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort("subscriberCount")}
                    className="flex items-center gap-1"
                  >
                    Suscriptores {getSortIcon("subscriberCount")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort("videoCount")}
                    className="flex items-center gap-1"
                  >
                    Videos {getSortIcon("videoCount")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort("viewCount")}
                    className="flex items-center gap-1"
                  >
                    Vistas {getSortIcon("viewCount")}
                  </Button>
                  {includeLastVideoDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSort("lastVideoDate")}
                      className="flex items-center gap-1"
                    >
                      Último video {getSortIcon("lastVideoDate")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateKeywords("search")}
                    className="flex items-center gap-1"
                    disabled={channels.length === 0}
                  >
                    <Sparkles className="h-4 w-4" /> Generar Keywords
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadCSV}
                  className="flex items-center gap-1"
                  disabled={displayedChannels.length === 0}
                >
                  <Download className="h-4 w-4" /> Descargar CSV
                </Button>
              </div>

              {totalResults > channels.length && (
                <div className="text-sm text-muted-foreground text-center mb-4">
                  Mostrando {channels.length} de {totalResults.toLocaleString()} resultados totales
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="related">
          <form onSubmit={searchRelatedChannels} className="mb-8">
            <div className="flex flex-col gap-4">
              {/* Modificar la sección del formulario de búsqueda de canales relacionados para incluir el botón de historial */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="URL del canal (ej: https://youtube.com/@username)"
                    value={channelUrl}
                    onChange={(e) => setChannelUrl(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSavedRelatedSearches(true)}
                  title="Historial de búsquedas relacionadas"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button type="submit" disabled={loadingRelated || quotaExceeded}>
                  {loadingRelated ? (
                    <span className="animate-spin mr-2">⏳</span>
                  ) : (
                    <LinkIcon className="h-4 w-4 mr-2" />
                  )}
                  Buscar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Ingresa la URL completa de un canal de YouTube para encontrar canales relacionados.
                <br />
                Formatos soportados:
                <br />- https://youtube.com/channel/UC... (ID del canal)
                <br />- https://youtube.com/@username (nombre de usuario)
              </p>
            </div>
          </form>

          {relatedError && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{relatedError.message}</AlertTitle>
              {relatedError.details && <AlertDescription>{relatedError.details}</AlertDescription>}
            </Alert>
          )}

          {loadingRelated && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin text-4xl mb-4">🔍</div>
              <p>Buscando canales relacionados...</p>
            </div>
          )}

          {originalChannel && (
            <div className="mb-6 p-4 border rounded-md bg-muted/10">
              <h3 className="text-lg font-semibold mb-2">Canal original: {originalChannel.title}</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                <p className="text-sm text-muted-foreground">Palabras clave detectadas:</p>
                {originalChannel.keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Mostrando canales relacionados basados en estas palabras clave.
              </p>
            </div>
          )}

          {relatedChannels.length > 0 && (
            <div className="mb-8">
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">
                    Filtrar por suscriptores mínimos: {minRelatedSubscribers.toLocaleString()}
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {displayedRelatedChannels.length} de {relatedChannels.length} canales
                  </span>
                </div>
                <Slider
                  value={[minRelatedSubscribers]}
                  min={0}
                  max={Math.max(...relatedChannels.map((c) => c.subscriberCount), 1000000)}
                  step={1000}
                  onValueChange={(value) => setMinRelatedSubscribers(value[0])}
                />
              </div>

              <div className="flex justify-between items-center mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateKeywords("related")}
                  className="flex items-center gap-1"
                  disabled={relatedChannels.length === 0}
                >
                  <Sparkles className="h-4 w-4" /> Generar Keywords
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadRelatedCSV}
                  className="flex items-center gap-1"
                  disabled={displayedRelatedChannels.length === 0}
                >
                  <Download className="h-4 w-4" /> Descargar CSV
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Resultados de búsqueda por palabra clave */}
      {activeTab === "search" && (
        <>
          {loading && channels.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin text-4xl mb-4">🔍</div>
              <p>Buscando canales de YouTube...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedChannels.map((channel) => (
                <Card key={channel.id} className={visitedChannels.has(channel.id) ? "border-muted bg-muted/10" : ""}>
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
                        <div className="flex items-center gap-2">
                          <Link
                            href={`https://youtube.com/channel/${channel.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold hover:text-primary line-clamp-1"
                            onClick={() => markChannelAsVisited(channel.id)}
                          >
                            {channel.title}
                          </Link>
                          {visitedChannels.has(channel.id) && (
                            <Badge variant="outline" className="flex items-center gap-1 h-5 px-1">
                              <Eye className="h-3 w-3" /> Visitado
                            </Badge>
                          )}
                        </div>
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

                        {channel.lastVideoDate && (
                          <div className="mt-2 text-xs flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Último video: {formatDate(channel.lastVideoDate)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && displayedChannels.length === 0 && channels.length > 0 && (
            <div className="text-center py-12">
              {hideVisitedChannels && visitedChannels.size > 0 ? (
                <div>
                  <p>Todos los canales han sido visitados.</p>
                  <Button variant="outline" size="sm" onClick={() => setHideVisitedChannels(false)} className="mt-4">
                    Mostrar canales visitados
                  </Button>
                </div>
              ) : (
                <p>No se encontraron canales con {minSubscribers.toLocaleString()} o más suscriptores.</p>
              )}
            </div>
          )}

          {!loading && channels.length === 0 && keyword && !quotaExceeded && (
            <div className="text-center py-12">
              <p>No se encontraron canales para "{keyword}".</p>
            </div>
          )}
        </>
      )}

      {/* Resultados de búsqueda de canales relacionados */}
      {activeTab === "related" && !loadingRelated && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedRelatedChannels.map((channel) => (
            <Card key={channel.id} className={visitedChannels.has(channel.id) ? "border-muted bg-muted/10" : ""}>
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
                    <div className="flex items-center gap-2">
                      <Link
                        href={`https://youtube.com/channel/${channel.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold hover:text-primary line-clamp-1"
                        onClick={() => markChannelAsVisited(channel.id)}
                      >
                        {channel.title}
                      </Link>
                      {visitedChannels.has(channel.id) && (
                        <Badge variant="outline" className="flex items-center gap-1 h-5 px-1">
                          <Eye className="h-3 w-3" /> Visitado
                        </Badge>
                      )}
                    </div>
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

      {activeTab === "related" && !loadingRelated && originalChannel && displayedRelatedChannels.length === 0 && (
        <div className="text-center py-12">
          <p>No se encontraron canales relacionados que cumplan con los criterios de filtrado.</p>
        </div>
      )}

      {activeTab === "related" && !loadingRelated && !originalChannel && !channelUrl && (
        <div className="text-center py-12">
          <p>Ingresa la URL de un canal de YouTube para encontrar canales relacionados.</p>
        </div>
      )}

      {/* Diálogo para mostrar búsquedas guardadas */}
      <Dialog open={showSavedSearches} onOpenChange={setShowSavedSearches}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Historial de búsquedas</DialogTitle>
            <DialogDescription>
              Selecciona una búsqueda guardada para cargarla sin necesidad de consultar la API.
            </DialogDescription>
          </DialogHeader>

          {savedSearches.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">No hay búsquedas guardadas.</div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {savedSearches.map((search) => (
                  <div
                    key={search.id}
                    className={`p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                      currentSearchId === search.id ? "border-primary" : ""
                    }`}
                    onClick={() => loadSavedSearch(search)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-medium">{search.params.keyword}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => deleteSavedSearch(search.id, e)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(search.timestamp)}
                      </div>
                      <div className="mt-1">
                        {search.channels.length} canales •
                        {search.params.regionCode
                          ? ` ${
                              countries.find((c) => c.code === search.params.regionCode)?.name ||
                              search.params.regionCode
                            }`
                          : " Global"}{" "}
                        •{search.params.includeLastVideoDate ? " Con fechas de videos" : " Sin fechas de videos"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="flex justify-between items-center">
            {savedSearches.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllSavedSearches} className="flex items-center gap-1">
                <Trash2 className="h-4 w-4" /> Limpiar historial
              </Button>
            )}
            <Button onClick={() => setShowSavedSearches(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Añadir el diálogo para mostrar búsquedas relacionadas guardadas */}
      <Dialog open={showSavedRelatedSearches} onOpenChange={setShowSavedRelatedSearches}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Historial de búsquedas relacionadas</DialogTitle>
            <DialogDescription>
              Selecciona una búsqueda guardada para cargarla sin necesidad de consultar la API.
            </DialogDescription>
          </DialogHeader>

          {savedRelatedSearches.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">No hay búsquedas relacionadas guardadas.</div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {savedRelatedSearches.map((search) => (
                  <div
                    key={search.id}
                    className={`p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                      currentRelatedSearchId === search.id ? "border-primary" : ""
                    }`}
                    onClick={() => loadSavedRelatedSearch(search)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-medium">{search.originalChannel.title}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => deleteRelatedSavedSearch(search.id, e)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(search.timestamp)}
                      </div>
                      <div className="mt-1">
                        {search.channels.length} canales relacionados •
                        <span className="ml-1">
                          Palabras clave: {search.originalChannel.keywords.slice(0, 3).join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="flex justify-between items-center">
            {savedRelatedSearches.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllSavedRelatedSearches}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" /> Limpiar historial
              </Button>
            )}
            <Button onClick={() => setShowSavedRelatedSearches(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para el generador de keywords con IA */}
      <Dialog open={showKeywordGenerator} onOpenChange={setShowKeywordGenerator}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generador de Keywords con IA</DialogTitle>
            <DialogDescription>
              Keywords sugeridas basadas en{" "}
              {keywordSource === "search" ? `la búsqueda "${keyword}"` : `el canal "${originalChannel?.title}"`}
            </DialogDescription>
          </DialogHeader>

          {generatingKeywords ? (
            <div className="py-8 text-center">
              <div className="inline-block animate-spin text-4xl mb-4">✨</div>
              <p>Generando keywords relevantes con IA...</p>
              <p className="text-sm text-muted-foreground mt-2">Esto puede tomar unos segundos</p>
            </div>
          ) : keywordError ? (
            <Alert variant="destructive" className="my-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error al generar keywords</AlertTitle>
              <AlertDescription>{keywordError}</AlertDescription>
            </Alert>
          ) : suggestedKeywords.length > 0 ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {suggestedKeywords.map((suggestion, index) => (
                  <div key={index} className="border rounded-md p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium">{suggestion.keyword}</div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyKeywordToClipboard(suggestion.keyword)}
                          title="Copiar al portapapeles"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-1">
                      <span className="font-medium">Relevancia:</span> {suggestion.relevance}
                    </div>
                    <p className="text-sm">{suggestion.description}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => useKeywordForSearch(suggestion.keyword)}
                    >
                      Usar esta keyword
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              Haz clic en "Generar" para obtener keywords sugeridas basadas en los canales encontrados.
            </div>
          )}

          <DialogFooter>
            {!generatingKeywords && <Button onClick={() => setShowKeywordGenerator(false)}>Cerrar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

