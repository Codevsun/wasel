import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import ProtectedRoute from "./components/shared/ProtectedRoute"
import AppShell from "./components/shared/AppShell"
import Login from "./pages/Login"

// Trainer pages
import TrainerDashboard from "./pages/trainer/Dashboard"
import InternQueue from "./pages/trainer/InternQueue"
import InternDetail from "./pages/trainer/InternDetail"
import CohortBuilder from "./pages/trainer/CohortBuilder"
import PlanBuilder from "./pages/trainer/PlanBuilder"
import ReviewQueue from "./pages/trainer/ReviewQueue"
import ReviewPage from "./pages/trainer/ReviewPage"
import Announcements from "./pages/trainer/Announcements"
import TrainerSettings from "./pages/trainer/Settings"
import TaskLibrary from "./pages/trainer/TaskLibrary"
import TrainerAttendance from "./pages/trainer/Attendance"

// Intern pages
import InternHome from "./pages/intern/Home"
import InternCheckIn from "./pages/intern/CheckIn"
import MyPlan from "./pages/intern/MyPlan"
import TaskPage from "./pages/intern/TaskPage"
import QuizPage from "./pages/intern/QuizPage"
import Discussions from "./pages/intern/Discussions"
import Achievements from "./pages/intern/Achievements"

// Management pages
import ManagementOverview from "./pages/management/Overview"
import ManagementReports from "./pages/management/Reports"

function TrainerLayout({ children }) {
  return (
    <ProtectedRoute allowedRoles={["trainer"]}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

function InternLayout({ children }) {
  return (
    <ProtectedRoute allowedRoles={["intern"]}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

function ManagementLayout({ children }) {
  return (
    <ProtectedRoute allowedRoles={["management"]}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

function RootRedirect() {
  const { user, role, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (role === "trainer") return <Navigate to="/trainer" replace />
  if (role === "intern") return <Navigate to="/intern" replace />
  if (role === "management") return <Navigate to="/management" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />

            {/* Trainer routes */}
            <Route path="/trainer" element={<TrainerLayout><TrainerDashboard /></TrainerLayout>} />
            <Route path="/trainer/create-account" element={<Navigate to="/trainer" replace />} />
            <Route path="/trainer/interns" element={<TrainerLayout><InternQueue /></TrainerLayout>} />
            <Route path="/trainer/interns/:uid" element={<TrainerLayout><InternDetail /></TrainerLayout>} />
            <Route path="/trainer/cohorts" element={<TrainerLayout><CohortBuilder /></TrainerLayout>} />
            <Route path="/trainer/plans" element={<TrainerLayout><PlanBuilder /></TrainerLayout>} />
            <Route path="/trainer/reviews" element={<TrainerLayout><ReviewQueue /></TrainerLayout>} />
            <Route path="/trainer/reviews/:submissionId" element={<TrainerLayout><ReviewPage /></TrainerLayout>} />
            <Route path="/trainer/announcements" element={<TrainerLayout><Announcements /></TrainerLayout>} />
            <Route path="/trainer/settings" element={<TrainerLayout><TaskLibrary /></TrainerLayout>} />
            <Route path="/trainer/task-library" element={<TrainerLayout><TaskLibrary /></TrainerLayout>} />
            <Route path="/trainer/attendance" element={<TrainerLayout><TrainerAttendance /></TrainerLayout>} />

            {/* Intern routes */}
            <Route path="/intern" element={<InternLayout><InternHome /></InternLayout>} />
            <Route path="/intern/checkin" element={<InternLayout><InternCheckIn /></InternLayout>} />
            <Route path="/intern/plan" element={<InternLayout><MyPlan /></InternLayout>} />
            <Route path="/intern/plan/task/:taskId" element={<InternLayout><TaskPage /></InternLayout>} />
            <Route path="/intern/tasks/:taskId" element={<InternLayout><TaskPage /></InternLayout>} />
            <Route path="/intern/plan/quiz/:taskId" element={<InternLayout><QuizPage /></InternLayout>} />
            <Route path="/intern/quiz/:taskId" element={<InternLayout><QuizPage /></InternLayout>} />
            <Route path="/intern/discussions" element={<InternLayout><Discussions /></InternLayout>} />
            <Route path="/intern/achievements" element={<InternLayout><Achievements /></InternLayout>} />

            {/* Management routes */}
            <Route path="/management" element={<ManagementLayout><ManagementOverview /></ManagementLayout>} />
            <Route path="/management/reports" element={<ManagementLayout><ManagementReports /></ManagementLayout>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
