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
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0 bg-background" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%)",
        }}
      />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-primary/[0.07] blur-[100px]" />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative w-full max-w-[380px]">
        {/* Header */}
        <div className="mb-10 text-center">
          <Logo className="mx-auto mb-6 h-28 w-28" />
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Sign in to Wasel
          </p>
        </div>

        {/* Form shell */}
        <div className="rounded-[28px] border border-border/70 bg-card/80 p-7 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 border-border/70 bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 border-border/70 bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="h-11 w-full text-[15px] font-medium"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Signing in…
                </span>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-[13px] leading-relaxed text-muted-foreground">
          No self-signup — contact your trainer for access.
        </p>
      </div>
    </div>
  )
}
