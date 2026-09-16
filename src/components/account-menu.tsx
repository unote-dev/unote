import { Bug, ChevronsUpDown, Languages, LogOut, Moon, Star, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/locale'
import { GITHUB_ISSUE_URL, GITHUB_REPO_URL, openExternal } from '@/lib/github'

export function AccountMenu({ avatarUrl, dark, login, name, onLogout, onToggleDark, pending }: {
  avatarUrl?: string | null
  dark: boolean
  login: string
  name: string
  onLogout: () => void
  onToggleDark: () => void
  pending: boolean
}) {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open)
      return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target))
        setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const logout = () => {
    setOpen(false)
    onLogout()
  }
  const openLink = (url: string) => {
    setOpen(false)
    void openExternal(url)
  }

  return (
    <div className="relative shrink-0 border-t" ref={rootRef}>
      {open && (
        <div className="absolute inset-x-2 bottom-full z-30 mb-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md" role="menu">
          <Button className="w-full justify-start font-normal" onClick={onToggleDark} role="menuitem" variant="ghost">
            {dark ? <Sun /> : <Moon />}
            {dark ? t('lightMode') : t('darkMode')}
          </Button>
          <Button className="w-full justify-start font-normal" onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')} role="menuitem" variant="ghost">
            <Languages />
            {locale === 'zh' ? t('languageEnglish') : t('languageChinese')}
          </Button>
          <Button className="w-full justify-start font-normal" onClick={() => openLink(GITHUB_ISSUE_URL)} role="menuitem" variant="ghost">
            <Bug />
            {t('reportIssue')}
          </Button>
          <Button className="w-full justify-start font-normal" onClick={() => openLink(GITHUB_REPO_URL)} role="menuitem" variant="ghost">
            <Star />
            {t('starOnGitHub')}
          </Button>
          <div className="-mx-1 my-1 h-px bg-border" role="separator" />
          <Button className="w-full justify-start font-normal" disabled={pending} onClick={logout} role="menuitem" variant="ghost">
            <LogOut />
            {t('logOut')}
          </Button>
        </div>
      )}
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('accountMenu')}
        className="flex h-14 w-full items-center gap-2 px-3 text-left hover:bg-accent/60"
        onClick={() => setOpen(value => !value)}
        type="button"
      >
        <Avatar>
          {avatarUrl && <AvatarImage alt={name || login} src={avatarUrl} />}
          <AvatarFallback>{login.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name || login}</p>
          {name && name !== login && <p className="truncate text-xs text-muted-foreground">{login}</p>}
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  )
}
