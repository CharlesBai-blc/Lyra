import { useEffect, useRef } from 'react'

const SPARKLE_CHARS = ['✦', '✧', '★', '✿', '⋆', '♡', '◇', '✺']
const COLORS = ['#f7a8c4', '#c8b4f8', '#7ec8e3', '#d988b9', '#b59fdd', '#f9c4e1', '#ffe4f3']

interface Sparkle {
  id: number
  x: number
  y: number
  char: string
  color: string
  size: number
  life: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
}

export function CursorTrail() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sparkles = useRef<Sparkle[]>([])
  const counter = useRef(0)
  const frameRef = useRef<number>(0)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current!

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      lastPos.current = { x: e.clientX, y: e.clientY }

      // Only spawn if moving enough
      if (dist < 8) return

      const count = Math.floor(dist / 12) + 1
      for (let i = 0; i < Math.min(count, 3); i++) {
        sparkles.current.push({
          id: counter.current++,
          x: e.clientX + (Math.random() - 0.5) * 12,
          y: e.clientY + (Math.random() - 0.5) * 12,
          char: SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)],
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 10 + Math.random() * 14,
          life: 1,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -0.5 - Math.random() * 1.5,
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 8,
        })
      }
    }

    const animate = () => {
      sparkles.current = sparkles.current.filter(s => s.life > 0)

      container.innerHTML = ''
      for (const s of sparkles.current) {
        s.x += s.vx
        s.y += s.vy
        s.vy += 0.04 // gentle gravity
        s.life -= 0.025
        s.rotation += s.rotSpeed

        const el = document.createElement('span')
        el.textContent = s.char
        el.style.cssText = `
          position:fixed;
          left:${s.x}px;
          top:${s.y}px;
          font-size:${s.size}px;
          color:${s.color};
          opacity:${s.life};
          transform:translate(-50%,-50%) rotate(${s.rotation}deg) scale(${0.5 + s.life * 0.5});
          pointer-events:none;
          user-select:none;
          line-height:1;
          text-shadow: 0 0 6px ${s.color};
        `
        container.appendChild(el)
      }

      frameRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', onMouseMove)
    frameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}