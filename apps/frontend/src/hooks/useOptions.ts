import { useEffect, useEffectEvent, useState } from 'react'

/**
 * Loads select options once. Returns null while loading or when the user cannot read them (e.g. 403),
 * so the filter is simply hidden instead of breaking the report.
 */
export function useOptions<T>(load: () => Promise<T[]>): T[] | null {
  const [options, setOptions] = useState<T[] | null>(null)
  const runLoad = useEffectEvent(load)

  useEffect(() => {
    let active = true
    runLoad().then((data) => { if (active) setOptions(data) }).catch(() => { if (active) setOptions(null) })
    return () => { active = false }
  }, [])

  return options
}
