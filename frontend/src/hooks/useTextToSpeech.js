import { useState, useRef, useCallback } from 'react'
import { api } from '../api/client'

/**
 * Custom hook for text-to-speech using ElevenLabs via backend proxy.
 *
 * @returns {{ isSpeaking, isLoading, speak, stop, error }}
 */
export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const audioRef = useRef(null)
  const urlRef = useRef(null)

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  const stop = useCallback(() => {
    cleanup()
  }, [cleanup])

  const speak = useCallback(
    async (text) => {
      if (!text?.trim()) return

      // If already speaking, stop first
      cleanup()
      setIsLoading(true)
      setError(null)

      try {
        const res = await api.post('/speech/tts', { text }, {
          responseType: 'blob',
          timeout: 60000,
        })

        const blob = res.data
        const url = URL.createObjectURL(blob)
        urlRef.current = url

        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          setIsSpeaking(false)
          cleanup()
        }

        audio.onerror = () => {
          setError('Audio playback failed')
          setIsSpeaking(false)
          cleanup()
        }

        setIsLoading(false)
        setIsSpeaking(true)
        await audio.play()
      } catch (err) {
        const msg =
          err.response?.data?.detail || err.message || 'Text-to-speech failed'
        setError(msg)
        console.error('[TTS] Error:', msg)
        setIsLoading(false)
        cleanup()
      }
    },
    [cleanup]
  )

  return { isSpeaking, isLoading, speak, stop, error }
}
