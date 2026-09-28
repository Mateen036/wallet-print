import { useEffect, useRef, useState, type ReactNode } from "react"

interface RevealProps {
  children: ReactNode

  className?: string
}

export function Reveal({ children, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current

    if (!element || !("IntersectionObserver" in window)) {
      setVisible(true)

      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)

          observer.disconnect()
        }
      },

      { threshold: 0.12 },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal-visible" : ""} ${className}`}
    >
      {children}
    </div>
  )
}
