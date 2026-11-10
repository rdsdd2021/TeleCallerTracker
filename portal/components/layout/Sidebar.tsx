'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Plug,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

interface SidebarProps {
  orgName: string
  userName: string
  userRole: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const manageSubLinks = [
  { href: '/manage/employees', label: 'Employees' },
  { href: '/manage/users', label: 'Users' },
  { href: '/manage/exclude-numbers', label: 'Exclude Numbers' },
  { href: '/manage/note-templates', label: 'Note Templates' },
  { href: '/manage/message-templates', label: 'Message Templates' },
  { href: '/manage/recordings', label: 'Call Recordings' },
  { href: '/manage/pinned-logs', label: 'Pinned Logs' },
]

function SidebarContent({
  orgName,
  userName,
  userRole,
  collapsed = false,
  onToggleCollapse,
  onClose,
}: SidebarProps & { onClose?: () => void }) {
  const pathname = usePathname()
  const [manageOpen, setManageOpen] = useState(pathname.startsWith('/manage'))

  const navLinkClass = (href: string, exact = false) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      (exact ? pathname === href : pathname.startsWith(href))
        ? 'bg-accent text-accent-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b min-h-[57px]">
        {!collapsed && (
          <span className="font-semibold text-sm truncate flex-1 mr-2">{orgName}</span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {/* Desktop collapse toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
          {/* Mobile close button */}
          {onClose && (
            <button onClick={onClose} aria-label="Close menu" className="md:hidden">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1" aria-label="Main navigation">
        <Link
          href="/dashboard"
          className={cn(navLinkClass('/dashboard', true), collapsed && 'justify-center px-2')}
          title={collapsed ? 'Dashboard' : undefined}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          {!collapsed && 'Dashboard'}
        </Link>

        {/* Manage (expandable) */}
        <div>
          <button
            onClick={() => !collapsed && setManageOpen((o: boolean) => !o)}
            className={cn(
              'flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
              collapsed ? 'justify-center px-2' : 'justify-between',
              pathname.startsWith('/manage')
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            aria-expanded={!collapsed && manageOpen}
            title={collapsed ? 'Manage' : undefined}
          >
            <span className={cn('flex items-center gap-3', collapsed && 'gap-0')}>
              <Users className="h-4 w-4 shrink-0" />
              {!collapsed && 'Manage'}
            </span>
            {!collapsed && (
              manageOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            )}
          </button>

          {!collapsed && manageOpen && (
            <div className="ml-7 mt-1 space-y-1">
              {manageSubLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={navLinkClass(link.href)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link
          href="/reports"
          className={cn(navLinkClass('/reports'), collapsed && 'justify-center px-2')}
          title={collapsed ? 'Reports' : undefined}
        >
          <BarChart2 className="h-4 w-4 shrink-0" />
          {!collapsed && 'Reports'}
        </Link>

        <Link
          href="/connectors"
          className={cn(navLinkClass('/connectors'), collapsed && 'justify-center px-2')}
          title={collapsed ? 'Connectors' : undefined}
        >
          <Plug className="h-4 w-4 shrink-0" />
          {!collapsed && 'Connectors'}
        </Link>

        <Link
          href="/settings"
          className={cn(navLinkClass('/settings'), collapsed && 'justify-center px-2')}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && 'Settings'}
        </Link>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t px-4 py-3">
          <p className="text-sm font-medium truncate">{userName}</p>
          <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
        </div>
      )}
    </div>
  )
}

export function Sidebar(props: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { collapsed = false, onToggleCollapse } = props

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-md bg-background border shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-background border-r shadow-lg transition-transform md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Sidebar"
      >
        <SidebarContent {...props} onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r bg-background transition-all duration-300',
          collapsed ? 'md:w-14' : 'md:w-64'
        )}
        aria-label="Sidebar"
      >
        <SidebarContent
          {...props}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>
    </>
  )
}
