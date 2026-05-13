import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ResultsDashboard from '../components/ResultsDashboard'
import QuestionReviewCard from '../components/QuestionReviewCard'
import DownloadButton from '../components/DownloadButton'
import { Link } from 'react-router-dom'
import { getResults, downloadResults, downloadResultsFromSheets, exportUpdatedQuestions, triggerOptimization, getFeedbackStats, getJobVerdicts, getOverallStats, getOptimizedPromptPreview } from '../api'

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
  const [verdicts, setVerdicts] = useState({})
  const [overallStats, setOverallStats] = useState(null)
  const [promptPreview, setPromptPreview] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [editedQuestions, setEditedQuestions] = useState({})
  const [exportingUpdated, setExportingUpdated] = useState(false)

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
    getJobVerdicts(jobId).then(setVerdicts).catch(() => {})
    getOverallStats().then(setOverallStats).catch(() => {})
    getOptimizedPromptPreview().then(setPromptPreview).catch(() => {})
  }, [jobId])

  const filtered = results
    ? filter === 'All'
      ? results
      : results.filter((r) => r.Overall_Status === filter)
    : []

  function refreshStats() {
    getFeedbackStats().then(setFeedbackStats).catch(() => {})
    getOverallStats().then(setOverallStats).catch(() => {})
  }

  async function handleOptimize() {
    setOptimizing(true)
    try {
      const res = await triggerOptimization()
      setOptResult(res)
      getOptimizedPromptPreview().then(setPromptPreview).catch(() => {})
    } finally {
      setOptimizing(false)
    }
  }

  function handleEditSave(qNo, fields) {
    setEditedQuestions(prev => ({ ...prev, [qNo]: fields }))
  }

  async function handleExportUpdated() {
    if (!results) return
    setExportingUpdated(true)
    try {
      const questions = results.map(r => {
        const qNo = r['Q. NO'] || r.q_no || ''
        const e = editedQuestions[qNo] || {}
        return {
          'Q. NO': qNo,
          'Question Type': r['Question Type'] || '',
          'Transcript': 'Transcript' in e ? e.Transcript : (r.Corrected_Transcript || r.Transcript || ''),
          'Instructions': 'Instructions' in e ? e.Instructions : (r.Corrected_Instructions || r.Instructions || ''),
          'Question': 'Question' in e ? e.Question : (r.Corrected_Question || r.Question || ''),
          'Options': 'Options' in e ? e.Options : (r.Corrected_Options || r.Options || ''),
          'Correct Answer': 'Correct Answer' in e ? e['Correct Answer'] : (r['Correct Answer'] || ''),
          'Explanation': 'Explanation' in e ? e.Explanation : (r.Corrected_Explanation || r.Explanation || ''),
          'Schema': r.Schema || '',
          'Question Purpose': r['Question Purpose'] || '',
          'Difficulty': r.Difficulty || '',
          'Tags': r.Tags || '',
        }
      })
      await exportUpdatedQuestions(questions)
    } catch {
      // no-op: exportUpdatedQuestions handles errors internally
    } finally {
      setExportingUpdated(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadResults(jobId)
    } catch (err) {
      // Primary download failed (job likely expired from memory) — try Sheets fallback
      try {
        await downloadResultsFromSheets(jobId)
      } catch (err2) {
        setDownloadError('Download failed. The reviewed file may no longer be available on the server.')
      }
    } finally {
      setDownloading(false)
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

  const rv = overallStats?.review
  const ac = overallStats?.accuracy

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Review Results</h1>
          <p className="text-sm text-slate-400 mt-0.5">Job: {jobId.slice(0, 8)}...</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            New upload
          </button>
          <Link
            to={`/dashboard/${jobId}`}
            className="text-sm text-slate-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Job Dashboard
          </Link>
          <button
            onClick={handleExportUpdated}
            disabled={exportingUpdated || !results}
            className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exportingUpdated ? 'Exporting…' : 'Updated Set Questions'}
          </button>
          <DownloadButton
            onClick={handleDownload}
            label={downloading ? 'Downloading…' : 'Download Excel'}
            disabled={downloading}
          />
        </div>
      </div>

      {downloadError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {downloadError}
        </div>
      )}

      {/* ── Review Dashboard (current job) ─────────────────────── */}
      {results && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">This Review</p>
          <ResultsDashboard results={results} />
        </div>
      )}

      {/* Cumulative stats across all uploaded files */}
      {overallStats && rv && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">All-time Review Statistics</p>
            <span className="text-xs text-slate-400">{rv.files} file{rv.files !== 1 ? 's' : ''} · {rv.total} questions total</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{rv.approved_no_changes}</p>
              <p className="text-xs font-semibold text-green-600 mt-0.5">Correct</p>
              <p className="text-[10px] text-green-500 mt-0.5">Approved, no changes</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{rv.approved_with_changes}</p>
              <p className="text-xs font-semibold text-blue-600 mt-0.5">Approved w/ Fixes</p>
              <p className="text-[10px] text-blue-500 mt-0.5">Minor corrections suggested</p>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{rv.needs_review}</p>
              <p className="text-xs font-semibold text-yellow-600 mt-0.5">Needs Revision</p>
              <p className="text-[10px] text-yellow-500 mt-0.5">Major issues found</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{rv.rejected}</p>
              <p className="text-xs font-semibold text-red-600 mt-0.5">Rejected</p>
              <p className="text-[10px] text-red-500 mt-0.5">Must be rewritten</p>
            </div>
          </div>

          {rv.total > 0 && (
            <div>
              <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                {rv.approved_no_changes > 0 && (
                  <div className="bg-green-500" style={{ width: `${(rv.approved_no_changes / rv.total) * 100}%` }} title={`Correct: ${rv.approved_no_changes}`} />
                )}
                {rv.approved_with_changes > 0 && (
                  <div className="bg-blue-400" style={{ width: `${(rv.approved_with_changes / rv.total) * 100}%` }} title={`Approved w/ Fixes: ${rv.approved_with_changes}`} />
                )}
                {rv.needs_review > 0 && (
                  <div className="bg-yellow-400" style={{ width: `${(rv.needs_review / rv.total) * 100}%` }} title={`Needs Revision: ${rv.needs_review}`} />
                )}
                {rv.rejected > 0 && (
                  <div className="bg-red-500" style={{ width: `${(rv.rejected / rv.total) * 100}%` }} title={`Rejected: ${rv.rejected}`} />
                )}
              </div>
              <div className="flex gap-4 mt-1.5">
                {[
                  { label: 'Correct', val: rv.approved_no_changes, color: 'bg-green-500' },
                  { label: 'Approved w/ Fixes', val: rv.approved_with_changes, color: 'bg-blue-400' },
                  { label: 'Needs Revision', val: rv.needs_review, color: 'bg-yellow-400' },
                  { label: 'Rejected', val: rv.rejected, color: 'bg-red-500' },
                ].filter(x => x.val > 0).map(x => (
                  <span key={x.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-sm ${x.color}`} />
                    {x.label}: {Math.round((x.val / rv.total) * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accuracy Report */}
      {ac && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Agent Accuracy Report</p>

          <div className="grid grid-cols-2 gap-4">
            {/* Approved by Agent */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Approved by Agent ({ac.approved_by_agent.total})
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Correct (confirmed by human)
                  </span>
                  <span className="font-semibold text-slate-700">{ac.approved_by_agent.correct}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Incorrect (human found issues)
                  </span>
                  <span className="font-semibold text-slate-700">{ac.approved_by_agent.incorrect}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                    Not yet verified
                  </span>
                  <span>{ac.approved_by_agent.unverified}</span>
                </div>
              </div>
            </div>

            {/* Flagged by Agent */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Flagged by Agent — Needs Revision + Rejected ({ac.flagged_by_agent.total})
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Correctly flagged
                  </span>
                  <span className="font-semibold text-slate-700">{ac.flagged_by_agent.correctly_flagged}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Incorrectly flagged (false positive)
                  </span>
                  <span className="font-semibold text-slate-700">{ac.flagged_by_agent.incorrectly_flagged}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                    Not yet verified
                  </span>
                  <span>{ac.flagged_by_agent.unverified}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 border-t border-gray-100 pt-2">
            Based on Accept / Reject feedback submitted. Questions without feedback are shown as "Not yet verified."
            Submit more feedback to improve accuracy tracking.
          </p>
        </div>
      )}

      {/* Optimizer Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">DSPy Prompt Optimizer</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {feedbackStats
                ? (() => {
                    const usable = (feedbackStats.reject || 0) + (feedbackStats.override || 0)
                    if (usable === 0) return 'Submit at least 1 Reject or Override feedback to enable optimization.'
                    return `${usable} reject/override feedback${usable !== 1 ? 's' : ''} ready for training.`
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

        {optimizing && (
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-brand-600 h-1.5 rounded-full animate-pulse w-full" />
          </div>
        )}

        {optResult && (
          <div className="border-t border-gray-100 pt-3 space-y-4">
            {/* Status row */}
            <div className="space-y-1">
              {optResult.results?.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    r.status === 'success' ? 'bg-green-500' :
                    r.status === 'skipped' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                  <span className="text-slate-600 font-medium">{r.batch || 'All'}</span>
                  <span className="text-slate-400">
                    {r.status === 'success' ? `Optimized with ${r.examples_used} examples` : r.reason || r.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Prompt Diff */}
            {optResult.prompt_diff?.some(b => b.added.length > 0 || b.removed.length > 0) ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Updated Prompt — review changes before re-uploading</p>
                {optResult.prompt_diff.map((b) => {
                  if (b.added.length === 0 && b.removed.length === 0) return null
                  return (
                    <div key={b.batch} className="rounded-lg border border-gray-200 overflow-hidden text-xs">
                      <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-100">
                        <p className="font-semibold text-slate-700">{b.label}</p>
                        <span className="text-slate-400">{b.before_count} → {b.after_count} examples</span>
                      </div>
                      {b.added.map((ex, i) => (
                        <div key={`a${i}`} className="px-3 py-2 bg-green-50 border-b border-green-100 last:border-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">+ NEW</span>
                            <span className="text-green-800 italic">"{ex.question}"</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(ex.scores).map(([k, v]) => (
                              <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                v === 'Pass' ? 'bg-green-100 text-green-700' :
                                v === 'Minor' ? 'bg-yellow-100 text-yellow-700' :
                                v === 'Major' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                              }`}>{k.replace('_score', '')}: {v}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {b.removed.map((ex, i) => (
                        <div key={`r${i}`} className="px-3 py-2 bg-red-50 border-b border-red-100 last:border-0 opacity-70">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">− REMOVED</span>
                            <span className="text-red-800 line-through italic">"{ex.question}"</span>
                          </div>
                        </div>
                      ))}
                      {b.kept.map((ex, i) => (
                        <div key={`k${i}`} className="px-3 py-2 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 bg-gray-100 px-1.5 py-0.5 rounded">unchanged</span>
                            <span className="text-slate-500 italic">"{ex.question}"</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
                <p className="text-xs text-green-600 font-medium">Prompt saved. Re-upload your file to apply these changes.</p>
              </div>
            ) : optResult.prompt_diff ? (
              <p className="text-xs text-slate-400">No prompt changes — same examples as before.</p>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Question-by-Question Review</p>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-600">
            {filtered.length} question{filtered.length !== 1 ? 's' : ''}
            {filter !== 'All' ? ` — ${filter}` : ''}
          </p>
          <div className="flex gap-1 flex-wrap">
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
              onFeedbackSubmitted={refreshStats}
              initialVerdict={verdicts[result['Q. NO'] || result.q_no] || null}
              onEdit={handleEditSave}
              editedData={editedQuestions[result['Q. NO'] || result.q_no] || null}
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
