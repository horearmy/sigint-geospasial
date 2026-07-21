import { useState, useEffect, useRef } from 'react'

export function useAnimatedCounter(target, duration = 1200) {
  const [count, setCount] = useState(0)
  const frameRef = useRef(null)

  useEffect(() => {
    if (target === undefined || target === null) return
    const start = performance.now()
    const from = 0

    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(from + (target - from) * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [target, duration])

  return count
}

export function useStaggerDelay(index, baseDelay = 50) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * baseDelay)
    return () => clearTimeout(timer)
  }, [index, baseDelay])
  return visible
}
