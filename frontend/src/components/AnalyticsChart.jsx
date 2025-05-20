"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts"

const AnalyticsChart = () => {
  const [activeTab, setActiveTab] = useState("weekly")
  const [chartData, setChartData] = useState([])
  const [comparisonData, setComparisonData] = useState([])

  // Generate random data for the chart
  useEffect(() => {
    // Weekly data
    const weeklyData = [
      { name: "Mon", current: Math.floor(Math.random() * 800) + 500, previous: Math.floor(Math.random() * 700) + 400 },
      { name: "Tue", current: Math.floor(Math.random() * 800) + 500, previous: Math.floor(Math.random() * 700) + 400 },
      { name: "Wed", current: Math.floor(Math.random() * 800) + 500, previous: Math.floor(Math.random() * 700) + 400 },
      { name: "Thu", current: Math.floor(Math.random() * 800) + 500, previous: Math.floor(Math.random() * 700) + 400 },
      { name: "Fri", current: Math.floor(Math.random() * 800) + 500, previous: Math.floor(Math.random() * 700) + 400 },
      {
        name: "Sat",
        current: Math.floor(Math.random() * 1200) + 800,
        previous: Math.floor(Math.random() * 1100) + 700,
      },
      { name: "Sun", current: Math.floor(Math.random() * 1000) + 600, previous: Math.floor(Math.random() * 900) + 500 },
    ]

    // Hourly data for the current day
    const hourlyData = Array.from({ length: 12 }, (_, i) => {
      const hour = i + 9 // Start from 9 AM
      return {
        name: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "PM" : "AM"}`,
        visitors: Math.floor(Math.random() * 100) + 20,
        conversion: Math.floor(Math.random() * 30) + 5,
      }
    })

    if (activeTab === "weekly") {
      setChartData(weeklyData)
    } else {
      setChartData(hourlyData)
    }

    // Comparison data for the line chart
    const comparisonData = Array.from({ length: 30 }, (_, i) => {
      return {
        day: i + 1,
        thisMonth: Math.floor(Math.random() * 1000) + 500,
        lastMonth: Math.floor(Math.random() * 900) + 400,
      }
    })
    setComparisonData(comparisonData)
  }, [activeTab])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab("weekly")}
            className={`px-3 py-1 text-xs rounded-full ${
              activeTab === "weekly" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setActiveTab("hourly")}
            className={`px-3 py-1 text-xs rounded-full ${
              activeTab === "hourly" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Today
          </button>
        </div>
        <div className="text-xs text-slate-400">Last updated: 5 mins ago</div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === "weekly" ? (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "0.375rem",
                }}
                itemStyle={{ color: "#e2e8f0" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend />
              <Bar name="Current Week" dataKey="current" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar name="Previous Week" dataKey="previous" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "0.375rem",
                }}
                itemStyle={{ color: "#e2e8f0" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Legend />
              <Line
                type="monotone"
                name="Visitors"
                dataKey="visitors"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                name="Conversions"
                dataKey="conversion"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="pt-4 border-t border-slate-800">
        <h4 className="text-sm font-medium text-white mb-3">Monthly Comparison</h4>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="day" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "0.375rem",
                }}
                itemStyle={{ color: "#e2e8f0" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Line
                type="monotone"
                name="This Month"
                dataKey="thisMonth"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                name="Last Month"
                dataKey="lastMonth"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsChart
