"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const HeatmapDemo = () => {
  const canvasRef = useRef(null)
  const [chartData, setChartData] = useState([])

  // Generate random data for the chart
  useEffect(() => {
    const data = [
      { name: "Mon", value: Math.floor(Math.random() * 1000) + 500 },
      { name: "Tue", value: Math.floor(Math.random() * 1000) + 500 },
      { name: "Wed", value: Math.floor(Math.random() * 1000) + 500 },
      { name: "Thu", value: Math.floor(Math.random() * 1000) + 500 },
      { name: "Fri", value: Math.floor(Math.random() * 1000) + 500 },
      { name: "Sat", value: Math.floor(Math.random() * 1000) + 500 },
      { name: "Sun", value: Math.floor(Math.random() * 1000) + 500 },
    ]
    setChartData(data)
  }, [])

  // Draw heatmap on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw store outline
    ctx.strokeStyle = "#888"
    ctx.lineWidth = 2
    ctx.strokeRect(50, 50, width - 100, height - 100)

    // Draw shelves/fixtures
    ctx.fillStyle = "#ddd"
    // Left shelves
    ctx.fillRect(80, 100, 60, 150)
    ctx.fillRect(80, 300, 60, 150)
    // Right shelves
    ctx.fillRect(width - 140, 100, 60, 150)
    ctx.fillRect(width - 140, 300, 60, 150)
    // Center display
    ctx.fillRect(width / 2 - 50, height / 2 - 50, 100, 100)

    // Draw heatmap (using gradients)
    const drawHeatPoint = (x, y, radius, intensity) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity})`)
      gradient.addColorStop(1, "rgba(255, 0, 0, 0)")

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw some heat points
    drawHeatPoint(width / 2, height / 2, 80, 0.6) // Center
    drawHeatPoint(150, 150, 60, 0.4) // Top left
    drawHeatPoint(width - 150, 150, 70, 0.5) // Top right
    drawHeatPoint(width - 150, height - 150, 50, 0.3) // Bottom right
    drawHeatPoint(150, height - 150, 40, 0.2) // Bottom left

    // Draw entrance
    ctx.fillStyle = "#333"
    ctx.fillRect(width / 2 - 30, height - 50, 60, 2)
    ctx.fillStyle = "#666"
    ctx.font = "12px Arial"
    ctx.fillText("Entrance", width / 2 - 25, height - 35)
  }, [])

  return (
    <div className="flex flex-col gap-6 w-full max-w-xl">
      <Card className="p-4 shadow-lg">
        <h3 className="text-lg font-medium mb-2">Foot Traffic Heatmap</h3>
        <div className="relative bg-white rounded-md overflow-hidden border">
          <canvas ref={canvasRef} width={500} height={500} className="w-full h-auto" />
        </div>
      </Card>

      <Card className="p-4 shadow-lg">
        <h3 className="text-lg font-medium mb-2">Weekly Visitor Analytics</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

export default HeatmapDemo
