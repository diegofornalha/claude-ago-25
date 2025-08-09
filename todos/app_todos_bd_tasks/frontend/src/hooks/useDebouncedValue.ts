import { useState, useEffect } from 'react'

/**
 * Hook para debounce de valores
 * Útil para evitar chamadas excessivas em inputs de busca
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    // Configurar o timer
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    // Limpar o timer se o valor mudar antes do delay
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}