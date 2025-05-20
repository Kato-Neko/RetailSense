"use client"

import { useEffect, useRef } from "react"

const HeatmapVisualizer = () => {
  const canvasRef = useRef(null)

  // Draw heatmap on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    const width = canvas.width
    const height = canvas.height

    // Animation variables
    let animationFrame
    const heatPoints = [
      { x: width / 2, y: height / 2, radius: 80, intensity: 0.6, pulse: 0 }, // Center
      { x: 150, y: 150, radius: 60, intensity: 0.4, pulse: Math.PI / 3 }, // Top left
      { x: width - 150, y: 150, radius: 70, intensity: 0.5, pulse: Math.PI / 2 }, // Top right
      { x: width - 150, y: height - 150, radius: 50, intensity: 0.3, pulse: Math.PI }, // Bottom right
      { x: 150, y: height - 150, radius: 40, intensity: 0.2, pulse: Math.PI * 1.5 }, // Bottom left
    ]

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw store outline
      ctx.strokeStyle = "#334155" // slate-700
      ctx.lineWidth = 2
      ctx.strokeRect(50, 50, width - 100, height - 100)

      // Draw shelves/fixtures
      ctx.fillStyle = "#1e293b" // slate-800
      // Left shelves
      ctx.fillRect(80, 100, 60, 150)
      ctx.fillRect(80, 300, 60, 150)
      // Right shelves
      ctx.fillRect(width - 140, 100, 60, 150)
      ctx.fillRect(width - 140, 300, 60, 150)
      // Center display
      ctx.fillRect(width / 2 - 50, height / 2 - 50, 100, 100)

      // Update and draw heat points with pulsing effect
      heatPoints.forEach((point) => {
        point.pulse = (point.pulse + 0.02) % (Math.PI * 2)
        const pulseIntensity = point.intensity * (0.8 + 0.2 * Math.sin(point.pulse))

        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.radius)
        gradient.addColorStop(0, `rgba(239, 68, 68, ${pulseIntensity})`) // red-500
        gradient.addColorStop(0.6, `rgba(239, 68, 68, ${pulseIntensity * 0.5})`)
        gradient.addColorStop(1, "rgba(239, 68, 68, 0)")

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw entrance
      ctx.fillStyle = "#94a3b8" // slate-400
      ctx.fillRect(width / 2 - 30, height - 50, 60, 2)
      ctx.fillStyle = "#cbd5e1" // slate-300
      ctx.font = "12px Inter, sans-serif"
      ctx.fillText("Entrance", width / 2 - 25, height - 35)

      animationFrame = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <div className="relative bg-slate-950 rounded-md overflow-hidden border border-slate-800">
      <canvas ref={canvasRef} width={500} height={500} className="w-full h-auto" />
    </div>
  )
}

export default HeatmapVisualizer
