import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ResultsDashboard from '../components/ResultsDashboard'
import QuestionReviewCard from '../components/QuestionReviewCard'
import DownloadButton from '../components/DownloadButton'
import { getResults, downloadResults, triggerOptimization, getFeedbackStats } from '../api'

const FILTERS = ['All', 'Approved', 'Needs Review', 'Rejected', 'Review Failed']

export default function FeedbackPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [results, setResults] = useState(null)
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [optimizing, setOptimizing] = useState(false)
  const [optResult, setOptResult] = useState(null)
  const [feedbackStats, setFeedbackStats] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getResults(jobId)
        setResults(data.results)
      } catch (err) {
        if (err.response?.status === 409) {
          setError('Results not ready yet. Try refreshing.')
        } else {
          setError('Failed to load results.')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
    getFeedbackStats().then(setFeedbackStats).catch(() => {})
  }, [jobId])

  const filtered = results
    ? filter === 'All'
      ? results
      : results.filter((r) => r.Overall_Status === filter)
    : []

  async function handleOptimize() {
    setOptimizing(true)
    try {
      const res = await triggerOptimization()
      setOptResult(res)
    } finally {
      setOptimizing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 bg-brand-600 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-red-600">{error}</p>
        <button onClick={() => navigate('/')} className="text-sm text-brand-600 hover:underline">
          Back to upload
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Review Results</h1>
          <p className="text-sm text-slate-400 mt-0.5">Job: {jobId.slice(0, 8)}...</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            New upload
          </button>
          <DownloadButton
            onClick={() => downloadResults(jobId)}
            label="Download Excel"
          />
        </div>
      </div>

      {results && <ResultsDashboard results={results} />}

      {/* Optimizer Panel — always visible */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">DSPy Prompt Optimizer</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {feedbackStats
                ? (() => {
                    const usable = (feedbackStats.reject || 0) + (feedbackStats.override || 0)
                    const needed = Math.max(0, 3 - usable)
                    if (usable === 0) return 'Submit at least 1 Reject or Override feedback to enable optimization.'
                    if (needed > 0) return `${usable} usable feedback${usable !== 1 ? 's' : ''} collected.`
                    return `${usable} reject/override feedbacks ready for training.`
                  })()
                : 'Loading feedback stats...'}
            </p>
          </div>
          <button
            onClick={handleOptimize}
            disabled={optimizing || !feedbackStats || (feedbackStats.reject + feedbackStats.override) < 1}
            className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {optimizing ? 'Optimizing...' : 'Optimize Prompts'}
          </button>
        </div>

        {/* Progress bar while optimizing */}
        {optimizing && (
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-brand-600 h-1.5 rounded-full animate-pulse w-full" />
          </div>
        )}

        {/* Results after optimization */}
        {optResult && (
          <div className="border-t border-gray-100 pt-3 space-y-1">
            {optResult.results?.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  r.status === 'success' ? 'bg-green-500' :
                  r.status === 'skipped' ? 'bg-yellow-400' : 'bg-red-400'
                }`} />
                <span className="text-slate-600 font-medium">{r.batch || 'All'}</span>
                <span className="text-slate-400">
                  {r.status === 'success'
                    ? `Optimized with ${r.examples_used} examples`
                    : r.reason || r.status}
                </span>
              </div>
            ))}
            {optResult.results?.some(r => r.status === 'success') && (
              <p className="text-xs text-green-600 pt-1 font-medium">
                Optimization saved. Re-upload your file to use improved prompts.
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-600">
            {filtered.length} question{filtered.length !== 1 ? 's' : ''}
            {filter !== 'All' ? ` — ${filter}` : ''}
          </p>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-brand-600 text-white'
                    : 'bg-white border border-gray-200 text-slate-500 hover:bg-gray-50'
                }`}
              >
                {f}
                {f !== 'All' && results && (
                  <span className="ml-1 opacity-70">
                    ({results.filter((r) => r.Overall_Status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((result, i) => (
            <QuestionReviewCard
              key={result['Q. NO'] || result.q_no || i}
              result={result}
              jobId={jobId}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 py-10 text-sm">
              No questions match this filter.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
