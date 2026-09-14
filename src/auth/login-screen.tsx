import { GitBranch } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function LoginScreen({ desktopAvailable, error, onLogin, pending }: { desktopAvailable: boolean, error: string | null, onLogin: () => void, pending: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6">
          <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GitBranch className="size-5" />
          </div>
          <h1 className="text-xl font-semibold">登录 Unote</h1>
          <p className="mt-2 text-sm text-muted-foreground">使用 Gitee 登录后，Unote 会打开或创建你的专用私有仓库。</p>
        </div>
        <Button className="w-full" disabled={!desktopAvailable || pending} onClick={onLogin}>
          {pending ? '等待 Gitee 授权…' : '使用 Gitee 登录'}
        </Button>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      </section>
    </main>
  )
}
