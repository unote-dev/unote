import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/locale'
import { GITHUB_REPO_URL } from '@/lib/github'
import { cn } from '@/lib/utils'

export function LoginScreen({ desktopAvailable, error, onLogin, pending }: { desktopAvailable: boolean, error: string | null, onLogin: () => void, pending: boolean }) {
  const { locale, setLocale, t } = useI18n()
  const privacy = t('loginPrivacy')
  const highlight = t('loginPrivacyHighlight')
  const highlightIndex = privacy.indexOf(highlight)
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-5">
          <div className="mb-4 size-10">
            <UnoteLogo />
          </div>
          <h1 className="text-xl font-semibold">{t('loginTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('loginSubtitle')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button className="w-full justify-start gap-2" disabled={!desktopAvailable || pending} onClick={onLogin}>
            <GiteeIcon />
            {pending ? t('waitingGitee') : t('loginGitee')}
          </Button>
          <Button className="w-full justify-start gap-2" disabled variant="outline">
            <GitHubIcon />
            {t('loginGitHubSoon')}
          </Button>
          <Button className="w-full justify-start gap-2" disabled variant="outline">
            <GitLabIcon />
            {t('loginGitLabSoon')}
          </Button>
        </div>

        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3.5 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          <p>
            {highlightIndex === -1
              ? privacy
              : (
                  <>
                    {privacy.slice(0, highlightIndex)}
                    <b>{highlight}</b>
                    {privacy.slice(highlightIndex + highlight.length)}
                  </>
                )}
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}

        <div className="mt-5 space-y-3 border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-3">
            <button className={cn('hover:text-foreground', locale === 'zh' && 'font-medium text-foreground')} onClick={() => setLocale('zh')} type="button">{t('languageChinese')}</button>
            <button className={cn('hover:text-foreground', locale === 'en' && 'font-medium text-foreground')} onClick={() => setLocale('en')} type="button">{t('languageEnglish')}</button>
          </div>
          <p className="text-center">
            {t('openSource')}
            {' '}
            <a className="underline underline-offset-2" href={GITHUB_REPO_URL} rel="noreferrer" target="_blank">github.com/unote-dev/unote</a>
          </p>
        </div>
      </section>
    </main>
  )
}

function GiteeIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24">
      <path fill="#C71D23" d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m-1.852 4.444a3.704 3.704 0 0 0-3.704 3.704v6.913c0 .273.222.495.494.495h7.285a3.334 3.334 0 0 0 3.333-3.333v-2.84a.494.494 0 0 0-.495-.494h-5.678a.495.495 0 0 0-.494.494v1.234c0 .273.22.494.493.494h3.458c.272 0 .493.221.493.493v.248a1.48 1.48 0 0 1-1.481 1.481H9.16a.494.494 0 0 1-.494-.493v-4.692c0-.818.663-1.48 1.482-1.481h6.913a.495.495 0 0 0 .494-.494V6.938a.493.493 0 0 0-.494-.494z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24">
      <path fill="#24292F" d="M12.001 2c-5.525 0-10 4.475-10 10a9.99 9.99 0 0 0 6.837 9.488c.5.087.688-.213.688-.476c0-.237-.013-1.024-.013-1.862c-2.512.463-3.162-.612-3.362-1.175c-.113-.288-.6-1.175-1.025-1.413c-.35-.187-.85-.65-.013-.662c.788-.013 1.35.725 1.538 1.025c.9 1.512 2.337 1.087 2.912.825c.088-.65.35-1.087.638-1.337c-2.225-.25-4.55-1.113-4.55-4.938c0-1.088.387-1.987 1.025-2.687c-.1-.25-.45-1.275.1-2.65c0 0 .837-.263 2.75 1.024a9.3 9.3 0 0 1 2.5-.337c.85 0 1.7.112 2.5.337c1.913-1.3 2.75-1.024 2.75-1.024c.55 1.375.2 2.4.1 2.65c.637.7 1.025 1.587 1.025 2.687c0 3.838-2.337 4.688-4.562 4.938c.362.312.675.912.675 1.85c0 1.337-.013 2.412-.013 2.75c0 .262.188.574.688.474A10.02 10.02 0 0 0 22 12c0-5.525-4.475-10-10-10" />
    </svg>
  )
}

function GitLabIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24">
      <path fill="#FC6D26" d="m21.663 9.987l-.028-.072l-2.719-7.094a.71.71 0 0 0-.706-.449a.71.71 0 0 0-.654.522L15.72 8.52H8.282L6.443 2.895a.71.71 0 0 0-.652-.524a.72.72 0 0 0-.707.45L2.362 9.925l-.028.07a5.06 5.06 0 0 0 1.674 5.838l.01.007l.024.019l4.147 3.104l2.05 1.553l1.247.944a.84.84 0 0 0 1.016 0l1.247-.944l2.05-1.553l4.172-3.123l.01-.008a5.055 5.055 0 0 0 1.682-5.845" />
    </svg>
  )
}

function UnoteLogo() {
  return (
    <svg className="size-full" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="96" fill="#18181B" />
      <rect x="120" y="68" width="272" height="340" rx="20" fill="white" />
      <path d="M328 68 L392 132 L328 132 Z" fill="#18181B" />
      <rect x="160" y="165" width="160" height="10" rx="5" fill="#18181B" opacity="0.12" />
      <rect x="160" y="195" width="115" height="10" rx="5" fill="#18181B" opacity="0.08" />
      <rect x="160" y="225" width="135" height="10" rx="5" fill="#18181B" opacity="0.08" />
      <path d="M260 310 C262 355, 270 395, 300 430" stroke="#22C55E" strokeWidth="8" strokeLinecap="round" fill="none" />
      <ellipse cx="330" cy="425" rx="36" ry="20" fill="#22C55E" opacity="0.65" transform="rotate(-25, 330, 425)" />
      <ellipse cx="305" cy="455" rx="28" ry="16" fill="#4ADE80" opacity="0.45" transform="rotate(15, 305, 455)" />
      <circle cx="260" cy="310" r="6" fill="#22C55E" opacity="0.5" />
    </svg>
  )
}
