import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'
import { getStatus } from '../api'

export default function ReviewPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState({
    status: 'processing',
    progress: 0,
    current: 0,
    total: location.state?.total || 0,
    current_question: '',
    elapsed_seconds: 0,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const s = await getStatus(jobId)
        if (cancelled) return
        setStatus(s)

        if (s.status === 'done') {
          setTimeout(() => navigate(`/results/${jobId}`), 1200)
          return
        }
        if (s.status === 'failed') {
          return
        }
        setTimeout(poll, 2000)
      } catch {
        if (!cancelled) setTimeout(poll, 3000)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [jobId, navigate])

  const minutes = Math.floor(status.elapsed_seconds / 60)
  const seconds = Math.floor(status.elapsed_seconds % 60)
  const elapsed = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  return (
    <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-slate-800">Reviewing Questions</h1>
        <p className="text-slate-500 text-sm">
          The AI is analysing each question across 11 quality rubrics. Please wait.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        {status.status === 'failed' ? (
          <div className="text-center space-y-3">
            <p className="text-red-600 font-semibold">Review failed</p>
            <p className="text-sm text-slate-400">{status.error || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-brand-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <ProgressBar
              progress={status.progress}
              label={
                status.status === 'done'
                  ? 'Complete!'
                  : status.current_question
                  ? `Reviewing ${status.current_question}`
                  : 'Starting...'
              }
            />

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-gray-50 rounded-lg py-3">
                <p className="font-bold text-slate-700 text-lg">{status.current}</p>
                <p className="text-slate-400 text-xs">of {status.total} done</p>
              </div>
              <div className="bg-gray-50 rounded-lg py-3">
                <p className="font-bold text-slate-700 text-lg">{elapsed}</p>
                <p className="text-slate-400 text-xs">elapsed</p>
              </div>
              <div className="bg-gray-50 rounded-lg py-3">
                <p className="font-bold text-slate-700 text-lg">
                  {status.total > 0 && status.current > 0 && status.current < status.total
                    ? `~${Math.ceil(((status.elapsed_seconds / status.current) * (status.total - status.current)) / 60)}m`
                    : status.status === 'done' ? 'Done' : '—'}
                </p>
                <p className="text-slate-400 text-xs">remaining</p>
              </div>
            </div>

            {status.status === 'done' && (
              <p className="text-center text-sm text-green-600 font-medium">
                All done! Redirecting to results...
              </p>
            )}

            {status.status === 'processing' && (
              <div className="flex justify-center">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-brand-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
