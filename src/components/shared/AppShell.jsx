import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, Bell, Settings,
  LogOut, Moon, Sun, Menu, X, ChevronDown, Award, MessageSquare,
  BarChart2, FileText, UserPlus, Layers, GraduationCap
} from "lucide-react"
import { Button } from "../ui/button"
import { Avatar, AvatarFallback } from "../ui/avatar"
import { Badge } from "../ui/badge"
import { Separator } from "../ui/separator"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "../ui/dropdown-menu"
import { ScrollArea } from "../ui/scroll-area"
import { cn } from "../../lib/utils"

const trainerNav = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/trainer" },
  { label: "Intern Queue", icon: Users, href: "/trainer/interns" },
  { label: "Create Account", icon: UserPlus, href: "/trainer/create-account" },
  { label: "Cohort Builder", icon: Layers, href: "/trainer/cohorts" },
  { label: "Plan Builder", icon: BookOpen, href: "/trainer/plans" },
  { label: "Review Queue", icon: ClipboardList, href: "/trainer/reviews", badge: true },
  { label: "Announcements", icon: Bell, href: "/trainer/announcements" },
]

const internNav = [
  { label: "Home", icon: LayoutDashboard, href: "/intern" },
  { label: "My Plan", icon: BookOpen, href: "/intern/plan" },
  { label: "Discussions", icon: MessageSquare, href: "/intern/discussions" },
  { label: "Achievements", icon: Award, href: "/intern/achievements" },
]

const managementNav = [
  { label: "Overview", icon: BarChart2, href: "/management" },
  { label: "Program Reports", icon: FileText, href: "/management/reports" },
]

const navByRole = {
  trainer: trainerNav,
  intern: internNav,
  management: managementNav,
}

const roleLabels = {
  trainer: "Trainer",
  intern: "Intern",
  management: "Management",
}

export default function AppShell({ children }) {
  const { user, userDoc, role, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = navByRole[role] || []
  const initials = userDoc?.name
    ? userDoc.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?"

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">وصل Wasel</span>
          <button
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-6 py-3">
          <Badge variant="secondary" className="text-xs">
            {roleLabels[role] || "Unknown"}
          </Badge>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 px-3">
          <nav className="space-y-1 py-2">
            {navItems.map((item) => {
              const active = location.pathname === item.href ||
                (item.href !== "/trainer" && item.href !== "/intern" && item.href !== "/management" &&
                  location.pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {item.badge && (
                    <Badge className="ml-auto h-5 px-1.5 text-xs" variant="destructive">3</Badge>
                  )}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Bottom */}
        <div className="border-t border-border p-3 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 shrink-0">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">
                  {userDoc?.name || user?.email}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{userDoc?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                Toggle theme
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
