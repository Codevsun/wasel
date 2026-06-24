import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { useTheme } from "../contexts/ThemeContext"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Moon, Sun, AlertCircle } from "lucide-react"
import Logo from "../components/shared/Logo"

const roleRedirects = {
  trainer: "/trainer",
  intern: "/intern",
  management: "/management",
}

export default function Login() {
  const { login, user, role, loading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user && role) {
      navigate(roleRedirects[role] || "/", { replace: true })
    }
  }, [user, role, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await login(email, password)
    } catch {
      setError("Invalid email or password. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-violet-50 via-background to-indigo-50/60 dark:from-violet-950/20 dark:via-background dark:to-indigo-950/20">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-violet-200/30 blur-3xl dark:bg-violet-900/20" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-900/20" />

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 rounded-xl p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10 backdrop-blur-sm border border-border/50 transition-all"
        onClick={toggleTheme}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-md shadow-xl shadow-violet-100/50 dark:shadow-violet-950/30 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <Logo className="h-14 w-14 mb-4" />
            <h1 className="text-2xl font-bold tracking-tight">Wasel</h1>
            <p className="text-muted-foreground text-sm mt-0.5">وصل — Internship Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 rounded-xl bg-background/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 rounded-xl bg-background/60"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 border-0 shadow-md shadow-violet-200 dark:shadow-violet-900/40 transition-all"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in…
                </span>
              ) : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            No self-signup — contact your trainer to get an account.
          </p>
        </div>
      </div>
    </div>
  )
}
