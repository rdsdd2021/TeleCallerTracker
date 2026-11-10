'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface DashboardShellProps {
  orgName: string
  userName: string
  userRole: string
  children: React.ReactNode
}

export function DashboardShell({ orgName, userName, userRole, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        orgName={orgName}
        userName={userName}
        userRole={userRole}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? 'md:pl-14' : 'md:pl-64'
        }`}
      >
        <Header orgName={orgName} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
