import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Renewal from './pages/Renewal'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Renewal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}