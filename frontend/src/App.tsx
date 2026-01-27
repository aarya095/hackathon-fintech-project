import { Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import Landing from "./pages/Landing"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Dashboard from "./pages/Dashboard"
import ArrangementDetail from "./pages/ArrangementDetail"
import Profile from "./pages/Profile"
import Friends from "./pages/Friends"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <Friends />
          </ProtectedRoute>
        }
      />
      <Route
        path="/arrangements/:id"
        element={
          <ProtectedRoute>
            <ArrangementDetail />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
