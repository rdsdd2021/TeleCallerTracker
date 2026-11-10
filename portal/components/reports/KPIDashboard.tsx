'use client'

import { TrendingUp, TrendingDown, Minus, Phone, Clock, Users, Target, Award, Activity, PhoneCall, Timer, UserCheck } from 'lucide-react'

export interface KPIData {
  totalCalls: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  connectedCalls: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  connectionRate: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  avgCallDuration: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  totalTalkTime: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  activeEmployees: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  uniqueClients: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  peakHourCalls: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  firstCallResolution: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  avgResponseTime: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  employeeEfficiency: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  callsPerEmployee: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
}

interface KPIDashboardProps {
  data: KPIData
  isLoading?: boolean
}

interface KPICardProps {
  title: string
  value: string | number
  change: number
  trend: 'up' | 'down' | 'neutral'
  icon: React.ReactNode
  description: string
  color: string
  format?: 'number' | 'percentage' | 'duration' | 'time'
}

function KPICard({ title, value, change, trend, icon, description, color, format = 'number' }: KPICardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val
    
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`
      case 'duration':
        const hours = Math.floor(val / 3600)
        const minutes = Math.floor((val % 3600) / 60)
        const seconds = val % 60
        if (hours > 0) return `${hours}h ${minutes}m`
        if (minutes > 0) return `${minutes}m ${seconds}s`
        return `${seconds}s`
      case 'time':
        const mins = Math.floor(val / 60)
        const secs = val % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
      default:
        return val.toLocaleString()
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${color}`}>
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600">{title}</h3>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {formatValue(value)}
            </div>
            
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className={`text-sm font-medium ${getTrendColor()}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">vs last period</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function KPIDashboard({ data, isLoading = false }: KPIDashboardProps) {
  if (isLoading) {
    return <LoadingSkeleton />
  }

  const kpiCards = [
    {
      title: 'Total Calls',
      value: data.totalCalls.value,
      change: data.totalCalls.change,
      trend: data.totalCalls.trend,
      icon: <Phone className="h-5 w-5 text-blue-600" />,
      description: 'All calls made and received',
      color: 'bg-blue-100',
    },
    {
      title: 'Connected Calls',
      value: data.connectedCalls.value,
      change: data.connectedCalls.change,
      trend: data.connectedCalls.trend,
      icon: <PhoneCall className="h-5 w-5 text-green-600" />,
      description: 'Successfully connected calls',
      color: 'bg-green-100',
    },
    {
      title: 'Connection Rate',
      value: data.connectionRate.value,
      change: data.connectionRate.change,
      trend: data.connectionRate.trend,
      icon: <Target className="h-5 w-5 text-purple-600" />,
      description: 'Percentage of successful connections',
      color: 'bg-purple-100',
      format: 'percentage' as const,
    },
    {
      title: 'Avg Call Duration',
      value: data.avgCallDuration.value,
      change: data.avgCallDuration.change,
      trend: data.avgCallDuration.trend,
      icon: <Timer className="h-5 w-5 text-orange-600" />,
      description: 'Average duration per call',
      color: 'bg-orange-100',
      format: 'time' as const,
    },
    {
      title: 'Total Talk Time',
      value: data.totalTalkTime.value,
      change: data.totalTalkTime.change,
      trend: data.totalTalkTime.trend,
      icon: <Clock className="h-5 w-5 text-indigo-600" />,
      description: 'Total time spent on calls',
      color: 'bg-indigo-100',
      format: 'duration' as const,
    },
    {
      title: 'Active Employees',
      value: data.activeEmployees.value,
      change: data.activeEmployees.change,
      trend: data.activeEmployees.trend,
      icon: <Users className="h-5 w-5 text-cyan-600" />,
      description: 'Employees who made calls',
      color: 'bg-cyan-100',
    },
    {
      title: 'Unique Clients',
      value: data.uniqueClients.value,
      change: data.uniqueClients.change,
      trend: data.uniqueClients.trend,
      icon: <UserCheck className="h-5 w-5 text-pink-600" />,
      description: 'Distinct clients contacted',
      color: 'bg-pink-100',
    },
    {
      title: 'Peak Hour Calls',
      value: data.peakHourCalls.value,
      change: data.peakHourCalls.change,
      trend: data.peakHourCalls.trend,
      icon: <Activity className="h-5 w-5 text-red-600" />,
      description: 'Calls during busiest hour',
      color: 'bg-red-100',
    },
    {
      title: 'First Call Resolution',
      value: data.firstCallResolution.value,
      change: data.firstCallResolution.change,
      trend: data.firstCallResolution.trend,
      icon: <Award className="h-5 w-5 text-yellow-600" />,
      description: 'Issues resolved on first call',
      color: 'bg-yellow-100',
      format: 'percentage' as const,
    },
    {
      title: 'Avg Response Time',
      value: data.avgResponseTime.value,
      change: data.avgResponseTime.change,
      trend: data.avgResponseTime.trend,
      icon: <Clock className="h-5 w-5 text-teal-600" />,
      description: 'Time to answer incoming calls',
      color: 'bg-teal-100',
      format: 'time' as const,
    },
    {
      title: 'Employee Efficiency',
      value: data.employeeEfficiency.value,
      change: data.employeeEfficiency.change,
      trend: data.employeeEfficiency.trend,
      icon: <Target className="h-5 w-5 text-emerald-600" />,
      description: 'Overall team performance score',
      color: 'bg-emerald-100',
      format: 'percentage' as const,
    },
    {
      title: 'Calls per Employee',
      value: data.callsPerEmployee.value,
      change: data.callsPerEmployee.change,
      trend: data.callsPerEmployee.trend,
      icon: <Users className="h-5 w-5 text-violet-600" />,
      description: 'Average calls per team member',
      color: 'bg-violet-100',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Key Performance Indicators</h2>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive overview of your call center performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span>Improved</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-600" />
            <span>Declined</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="h-3 w-3 text-gray-400" />
            <span>No Change</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {kpiCards.map((card, index) => (
          <KPICard
            key={index}
            title={card.title}
            value={card.value}
            change={card.change}
            trend={card.trend}
            icon={card.icon}
            description={card.description}
            color={card.color}
            format={card.format}
          />
        ))}
      </div>
    </div>
  )
}