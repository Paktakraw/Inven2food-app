import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { th } from '@/lib/th'

const NAV: { href: string; label: string }[] = [
  { href: '/', label: th.nav.home },
  { href: '/pantry', label: th.nav.pantry },
  { href: '/ingredients', label: th.nav.ingredients },
  { href: '/menus', label: th.nav.menus },
  { href: '/cooking-history', label: th.nav.cookingHistory },
  { href: '/shopping', label: th.nav.shopping },
]

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 p-2">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm hover:bg-muted">
              {item.label}
            </Link>
          ))}
          <form action={signOut} className="ml-auto">
            <Button type="submit" variant="outline" size="sm">{th.common.signOut}</Button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
    </div>
  )
}
