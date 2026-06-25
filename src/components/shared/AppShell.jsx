import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, Bell,
  LogOut, Moon, Sun, Menu, X, ChevronDown, Award, MessageSquare,
  BarChart2, FileText, UserPlus, Layers, Library, CalendarCheck, Briefcase,
} from "lucide-react"
import Logo from "./Logo"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "../ui/dropdown-menu"
import { ScrollArea } from "../ui/scroll-area"
import { cn } from "../../lib/utils"
import CreateAccount from "../../pages/trainer/CreateAccount"

const trainerNav = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/trainer" },
  { label: "Intern Queue", icon: Users, href: "/trainer/interns" },
  { label: "Programs", icon: Layers, href: "/trainer/cohorts" },
  { label: "Plan Templates", icon: BookOpen, href: "/trainer/plans" },
  { label: "Review Queue", icon: ClipboardList, href: "/trainer/reviews", badge: true },
  { label: "Attendance", icon: CalendarCheck, href: "/trainer/attendance" },
  { label: "Announcements", icon: Bell, href: "/trainer/announcements" },
  { label: "Library & Settings", icon: Library, href: "/trainer/task-library" },
]

const internNav = [
  { label: "Home", icon: LayoutDashboard, href: "/intern" },
  { label: "My Plan", icon: BookOpen, href: "/intern/plan" },
  { label: "My Tasks", icon: Briefcase, href: "/intern/my-tasks" },
  { label: "Check In", icon: CalendarCheck, href: "/intern/checkin" },
  { label: "Discussions", icon: MessageSquare, href: "/intern/discussions" },
  { label: "Achievements", icon: Award, href: "/intern/achievements" },
]

const managementNav = [
  { label: "Overview", icon: BarChart2, href: "/management" },
  { label: "Program Reports", icon: FileText, href: "/management/reports" },
]

const navByRole = { trainer: trainerNav, intern: internNav, management: managementNav }
const roleLabels = { trainer: "Trainer", intern: "Intern", management: "Management" }
const roleColors = {
  trainer: "from-violet-500 to-indigo-600",
  intern: "from-blue-500 to-indigo-600",
  management: "from-emerald-500 to-teal-600",
}


export default function AppShell({ children }) {
  const { user, userDoc, role, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [createAccountOpen, setCreateAccountOpen] = useState(false)

  const navItems = navByRole[role] || []
  const initials = userDoc?.name
    ? userDoc.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?"

  const avatarGradient = roleColors[role] || "from-violet-500 to-indigo-600"

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        "bg-sidebar text-sidebar-foreground",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl overflow-hidden">
            <Logo className="h-14 w-14 object-cover" />
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden rounded-md h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* User mini-card */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-sidebar-accent border border-sidebar-border">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-border text-sidebar-accent-foreground text-xs font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-tight text-sidebar-accent-foreground">
                {userDoc?.name || user?.email}
              </p>
              <p className="text-xs text-sidebar-foreground/50 capitalize leading-tight">
                {roleLabels[role] || "User"}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const active = location.pathname === item.href ||
                (!item.dialog && item.href !== "/trainer" && item.href !== "/intern" && item.href !== "/management" &&
                  location.pathname.startsWith(item.href))

              if (item.dialog) {
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    onClick={() => { setCreateAccountOpen(true); setSidebarOpen(false) }}
                    className={cn(
                      "w-full justify-start gap-3 rounded-lg px-3 py-2.5 h-auto text-sm font-medium transition-all",
                      "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Button>
                )
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge className="h-5 px-1.5 text-xs" variant="destructive">3</Badge>
                  )}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Bottom */}
        <div className="border-t border-sidebar-border p-3 space-y-0.5">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-lg px-3 py-2.5 h-auto text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
            onClick={toggleTheme}
          >
            {theme === "dark"
              ? <Sun className="h-4 w-4 shrink-0" />
              : <Moon className="h-4 w-4 shrink-0" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-lg px-3 py-2.5 h-auto text-sm font-medium text-sidebar-foreground/60 hover:bg-destructive/15 hover:text-destructive transition-all"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-3 bg-background/95 backdrop-blur-sm px-4 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden rounded-md h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 rounded-xl h-9 px-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground text-xs font-bold">
                  {initials}
                </div>
                <span className="hidden sm:inline text-sm font-medium">
                  {userDoc?.name || user?.email}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuLabel className="font-normal px-3 py-2">
                <p className="text-sm font-semibold">{userDoc?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleTheme} className="rounded-lg">
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                Toggle theme
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive rounded-lg focus:text-destructive">
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

      {/* Create Account Dialog (trainer only) */}
      {role === "trainer" && (
        <CreateAccount
          open={createAccountOpen}
          onOpenChange={setCreateAccountOpen}
        />
      )}
    </div>
  )
}
