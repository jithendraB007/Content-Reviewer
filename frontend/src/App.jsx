import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import ReviewPage from './pages/ReviewPage'
import FeedbackPage from './pages/FeedbackPage'
import JobDashboard from './pages/JobDashboard'
import PerformanceDashboard from './pages/PerformanceDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/review/:jobId" element={<ReviewPage />} />
            <Route path="/results/:jobId" element={<FeedbackPage />} />
            <Route path="/dashboard/:jobId" element={<JobDashboard />} />
            <Route path="/dashboard" element={<PerformanceDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
