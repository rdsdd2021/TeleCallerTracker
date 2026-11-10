'use client'

import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadialBarChart, RadialBar, ComposedChart, Area, Line
} from 'recharts'

interface ChartData {
  dailyTrends: Array<{
    date: string
    totalCalls: number
    connectedCalls: number
    missedCalls: number
    avgDuration: number
  }>
  hourlyDistribution: Array<{
    hour: string
    calls: number
    avgDuration: number
    efficiency: number
  }>
  callTypeDistribution: Array<{
    name: string
    value: number
    color: string
  }>
  employeePerformance: Array<{
    name: string
    calls: number
    connected: number
    efficiency: number
    avgDuration: number
  }>
  weeklyComparison: Array<{
    week: string
    thisWeek: number
    lastWeek: number
    growth: number
  }>
  durationAnalysis: Array<{
    range: string
    count: number
    percentage: number
  }>
}

interface PremiumChartsGridProps {
  data: ChartData
  isLoading?: boolean
}

const COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  indigo: '#6366F1',
  teal: '#14B8A6',
}

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

function ChartContainer({ 
  title, 
  description, 
  children, 
  className = "lg:col-span-1" 
}: { 
  title: string
  description: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="h-80">
        {children}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-6" />
            <div className="h-80 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PremiumChartsGrid({ data, isLoading = false }: PremiumChartsGridProps) {
  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">
          Detailed visualizations and trends analysis
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Call Trends */}
        <ChartContainer
          title="Daily Call Trends"
          description="Call volume and success rate over time"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis yAxisId="calls" orientation="left" stroke="#6b7280" fontSize={12} />
              <YAxis yAxisId="duration" orientation="right" stroke="#6b7280" fontSize={12} />
              <Tooltip content={CustomTooltip} />
              <Legend />
              <Area
                yAxisId="calls"
                type="monotone"
                dataKey="totalCalls"
                stackId="1"
                stroke={COLORS.primary}
                fill={COLORS.primary}
                fillOpacity={0.1}
                name="Total Calls"
              />
              <Area
                yAxisId="calls"
                type="monotone"
                dataKey="connectedCalls"
                stackId="2"
                stroke={COLORS.secondary}
                fill={COLORS.secondary}
                fillOpacity={0.3}
                name="Connected Calls"
              />
              <Line
                yAxisId="duration"
                type="monotone"
                dataKey="avgDuration"
                stroke={COLORS.accent}
                strokeWidth={3}
                dot={{ fill: COLORS.accent, strokeWidth: 2, r: 4 }}
                name="Avg Duration (sec)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Call Type Distribution */}
        <ChartContainer
          title="Call Type Distribution"
          description="Breakdown of call types and their proportions"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.callTypeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {data.callTypeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), 'Calls']}
                contentStyle={tooltipStyle}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                // eslint-disable-next-line react/no-unstable-nested-components
                formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Hourly Distribution */}
        <ChartContainer
          title="Hourly Call Distribution"
          description="Call volume and efficiency throughout the day"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.hourlyDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} />
              <YAxis yAxisId="calls" orientation="left" stroke="#6b7280" fontSize={12} />
              <YAxis yAxisId="efficiency" orientation="right" stroke="#6b7280" fontSize={12} />
              <Tooltip content={CustomTooltip} />
              <Legend />
              <Bar
                yAxisId="calls"
                dataKey="calls"
                fill={COLORS.primary}
                radius={[4, 4, 0, 0]}
                name="Calls"
              />
              <Line
                yAxisId="efficiency"
                type="monotone"
                dataKey="efficiency"
                stroke={COLORS.secondary}
                strokeWidth={3}
                dot={{ fill: COLORS.secondary, strokeWidth: 2, r: 4 }}
                name="Efficiency %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Employee Performance */}
        <ChartContainer
          title="Employee Performance Comparison"
          description="Individual employee metrics and rankings"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.employeePerformance} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#6b7280" 
                fontSize={12}
                width={100}
              />
              <Tooltip content={CustomTooltip} />
              <Legend />
              <Bar
                dataKey="calls"
                fill={COLORS.primary}
                radius={[0, 4, 4, 0]}
                name="Total Calls"
              />
              <Bar
                dataKey="connected"
                fill={COLORS.secondary}
                radius={[0, 4, 4, 0]}
                name="Connected Calls"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Weekly Comparison */}
        <ChartContainer
          title="Weekly Performance Comparison"
          description="Current week vs previous week analysis"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weeklyComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip content={CustomTooltip} />
              <Legend />
              <Bar
                dataKey="lastWeek"
                fill={COLORS.accent}
                radius={[4, 4, 0, 0]}
                name="Last Week"
              />
              <Bar
                dataKey="thisWeek"
                fill={COLORS.primary}
                radius={[4, 4, 0, 0]}
                name="This Week"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Duration Analysis */}
        <ChartContainer
          title="Call Duration Analysis"
          description="Distribution of call durations"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="20%" 
              outerRadius="80%" 
              data={data.durationAnalysis}
            >
              <RadialBar
                label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }}
                background
                dataKey="percentage"
                fill={COLORS.purple}
              />
              <Legend 
                iconSize={10}
                layout="vertical"
                verticalAlign="bottom"
                align="center"
                // eslint-disable-next-line react/no-unstable-nested-components
                formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
              />
              <Tooltip 
                formatter={(value: number) => [`${value}%`, 'Percentage']}
                contentStyle={tooltipStyle}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  )
}