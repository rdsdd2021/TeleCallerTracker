import { logoutAction } from '@/app/(auth)/login/actions'

interface HeaderProps {
  orgName: string
}

export function Header({ orgName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
      <h1 className="text-sm font-semibold text-muted-foreground md:hidden">
        {orgName}
      </h1>
      <div className="hidden md:block">
        <span className="text-sm font-semibold">{orgName}</span>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Log out
        </button>
      </form>
    </header>
  )
}
