import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getResults, getResultsFromSheets } from '../api'

// ── Constants ─────────────────────────────────────────────────────────────────

const RUBRIC_COLS = [
  { key: 'R1_Grammatical_Accuracy',           short: 'R1', label: 'R1 — Grammatical Accuracy' },
  { key: 'R2_Spelling',                       short: 'R2', label: 'R2 — Spelling' },
  { key: 'R3_Ambiguity',                      short: 'R3', label: 'R3 — Ambiguity' },
  { key: 'R4_Functionality_Alignment',        short: 'R4', label: 'R4 — Functionality Alignment' },
  { key: 'R5_Instruction_Clarity',            short: 'R5', label: 'R5 — Instruction Clarity' },
  { key: 'R6_Academic_Language',              short: 'R6', label: 'R6 — Academic Language' },
  { key: 'R7_Option_Explanation_Consistency', short: 'R7', label: 'R7 — Option/Explanation' },
  { key: 'R8_Readability',                    short: 'R8', label: 'R8 — Readability' },
  { key: 'R9_Formatting_Spacing',             short: 'R9', label: 'R9 — Formatting & Spacing' },
  { key: 'R10_Punctuation',                   short: 'R10', label: 'R10 — Punctuation' },
  { key: 'R11_EN_Consistency',                short: 'R11', label: 'R11 — EN Consistency' },
]

const TYPE_COLORS = [
  'bg-indigo-400', 'bg-sky-400', 'bg-teal-400',
  'bg-violet-400', 'bg-pink-400', 'bg-amber-400', 'bg-lime-500',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0 }
function pctf(n, d) { return d > 0 ? ((n / d) * 100).toFixed(1) : '0.0' }

function computeStats(results) {
  const total       = results.length
  const approved    = results.filter(r => r.Overall_Status === 'Approved').length
  const needsReview = results.filter(r => r.Overall_Status === 'Needs Review').length
  const rejected    = results.filter(r => r.Overall_Status === 'Rejected').length
  const failed      = results.filter(r => r.Overall_Status === 'Review Failed').length

  const approvedClean = results.filter(r =>
    r.Overall_Status === 'Approved' && !RUBRIC_COLS.some(c => r[c.key] === 'Minor')
  ).length
  const approvedMinor = approved - approvedClean

  const questionsWithIssues = results.filter(r =>
    RUBRIC_COLS.some(c => ['Minor','Major','Critical'].includes(r[c.key]))
  ).length

  const rubrics = RUBRIC_COLS.map(({ key, short, label }) => {
    const pass     = results.filter(r => r[key] === 'Pass').length
    const minor    = results.filter(r => r[key] === 'Minor').length
    const major    = results.filter(r => r[key] === 'Major').length
    const critical = results.filter(r => r[key] === 'Critical').length
    const na       = results.filter(r => r[key] === 'N/A').length
    const app      = results.filter(r => r[key] && r[key] !== 'N/A').length
    const issues   = minor + major + critical
    return { key, short, label, pass, minor, major, critical, na, app, issues }
  }).sort((a, b) => b.issues - a.issues)

  const typeCounts = {}
  for (const r of results) {
    const t = r['Question Type'] || r.question_type || 'Unknown'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }

  // Auto-insights
  const insights = []
  const flagRate = pct(needsReview + rejected, total)
  const topRubrics = rubrics.filter(r => r.issues > 0).slice(0, 2)

  if (total === 0) {
    insights.push({ icon: 'i', cls: 'bg-blue-50 border-blue-200 text-blue-800', text: 'No questions in this review job.' })
  } else {
    if (rejected === 0 && needsReview === 0) {
      insights.push({ icon: '✓', cls: 'bg-green-50 border-green-200 text-green-800', text: 'All questions passed review — no flags or rejections in this batch.' })
    }
    if (approvedClean === total) {
      insights.push({ icon: '✓', cls: 'bg-green-50 border-green-200 text-green-800', text: 'Perfect batch — every question was approved with zero corrections needed.' })
    }
    if (rejected > 0) {
      insights.push({ icon: '!', cls: 'bg-red-50 border-red-200 text-red-800', text: `${rejected} question${rejected > 1 ? 's were' : ' was'} rejected due to critical issues and must be rewritten.` })
    }
    if (needsReview > 0) {
      insights.push({ icon: '⚠', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800', text: `${needsReview} question${needsReview > 1 ? 's need' : ' needs'} revision — major issues were found.` })
    }
    if (approvedMinor > 0) {
      insights.push({ icon: 'i', cls: 'bg-blue-50 border-blue-200 text-blue-800', text: `${approvedMinor} question${approvedMinor > 1 ? 's were' : ' was'} approved with minor corrections — check the Excel for the suggested edits.` })
    }
    if (topRubrics.length > 0) {
      const names = topRubrics.map(r => r.label.replace(/^R\d+ — /, '')).join(' and ')
      insights.push({ icon: 'i', cls: 'bg-slate-50 border-slate-200 text-slate-700', text: `Most common issue areas: ${names}.` })
    }
    if (flagRate > 30) {
      insights.push({ icon: '⚠', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800', text: `High flag rate (${flagRate}%) — consider reviewing the question format guidelines before the next upload.` })
    }
  }

  return {
    total, approved, approvedClean, approvedMinor,
    needsReview, rejected, failed, questionsWithIssues,
    rubrics, typeCounts, insights,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, suffix = '', desc, good, warn }) {
  const num = parseFloat(value)
  const color = good(num) ? 'green' : warn(num) ? 'yellow' : 'red'
  const cls = {
    green:  { card: 'bg-green-50 border-green-200',   val: 'text-green-700',  badge: 'bg-green-100 text-green-800' },
    yellow: { card: 'bg-yellow-50 border-yellow-200', val: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
    red:    { card: 'bg-red-50 border-red-200',       val: 'text-red-700',    badge: 'bg-red-100 text-red-800' },
  }[color]
  const rating = color === 'green' ? 'Good' : color === 'yellow' ? 'Fair' : 'Needs Work'
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${cls.card}`}>
      <span className={`self-end text-xs font-semibold px-2 py-0.5 rounded-full ${cls.badge}`}>{rating}</span>
      <div className={`text-3xl font-bold ${cls.val}`}>{value}{suffix}</div>
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <div className="text-xs text-slate-400 leading-relaxed">{desc}</div>
    </div>
  )
}

function StatusBar({ stats }) {
  const { total, approvedClean, approvedMinor, needsReview, rejected, failed } = stats
  const bars = [
    { v: approvedClean, c: 'bg-green-500' },
    { v: approvedMinor, c: 'bg-blue-400' },
    { v: needsReview,   c: 'bg-yellow-400' },
    { v: rejected,      c: 'bg-red-500' },
    { v: failed,        c: 'bg-gray-400' },
  ]
  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-px bg-gray-100">
      {bars.map(({ v, c }, i) => v > 0 && (
        <div key={i} className={`${c}`} style={{ width: `${pct(v, total)}%` }} />
      ))}
    </div>
  )
}

function StatusCards({ stats }) {
  const { total, approvedClean, approvedMinor, needsReview, rejected, failed } = stats
  const cards = [
    { label: 'Total Questions',          value: total,         sub: 'in this review',            bg: 'bg-white border-gray-200',          val: 'text-slate-800' },
    { label: 'Approved — No Issues',     value: approvedClean, sub: `${pct(approvedClean,total)}% of total`,  bg: 'bg-green-50 border-green-200',      val: 'text-green-700' },
    { label: 'Approved — Minor Fixes',   value: approvedMinor, sub: 'small corrections applied',  bg: 'bg-blue-50 border-blue-200',        val: 'text-blue-700' },
    { label: 'Needs Revision',           value: needsReview,   sub: 'major issues — send back',   bg: 'bg-yellow-50 border-yellow-200',    val: 'text-yellow-700' },
    { label: 'Rejected',                 value: rejected,      sub: 'critical — must rewrite',    bg: 'bg-red-50 border-red-200',          val: 'text-red-700' },
  ]
  if (failed > 0) cards.push({ label: 'Review Failed', value: failed, sub: 'API error', bg: 'bg-gray-50 border-gray-200', val: 'text-gray-500' })
  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${failed > 0 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-5'}`}>
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
            <div className={`text-2xl font-bold ${c.val}`}>{c.value}</div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5 leading-tight">{c.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>
      <StatusBar stats={stats} />
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Approved (clean)',    color: 'bg-green-500',  count: approvedClean },
          { label: 'Approved (minor)',    color: 'bg-blue-400',   count: approvedMinor },
          { label: 'Needs Revision',      color: 'bg-yellow-400', count: needsReview },
          { label: 'Rejected',            color: 'bg-red-500',    count: rejected },
        ].filter(x => x.count > 0).map(x => (
          <span key={x.label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-sm ${x.color}`} />
            {x.label} — {pct(x.count, total)}%
          </span>
        ))}
      </div>
    </div>
  )
}

function RubricTable({ rubrics, total }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Rubric Health — This Batch</h3>
          <p className="text-xs text-slate-400 mt-0.5">Sorted by most issues first</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-medium">
          {[['bg-green-100 text-green-700','Pass'],['bg-yellow-100 text-yellow-700','Minor'],['bg-orange-100 text-orange-700','Major'],['bg-red-100 text-red-700','Critical']].map(([cls,l]) => (
            <span key={l} className={`px-1.5 py-0.5 rounded ${cls}`}>{l}</span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-slate-400">
              <th className="text-left px-4 py-2 font-medium">Rubric</th>
              <th className="text-right px-3 py-2 font-medium">Pass</th>
              <th className="text-right px-3 py-2 font-medium">Minor</th>
              <th className="text-right px-3 py-2 font-medium">Major</th>
              <th className="text-right px-3 py-2 font-medium">Critical</th>
              <th className="text-right px-3 py-2 font-medium">N/A</th>
              <th className="px-4 py-2 font-medium w-36">Issue rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rubrics.map(r => {
              const issuePct = r.app > 0 ? Math.round((r.issues / r.app) * 100) : 0
              return (
                <tr key={r.key} className={`hover:bg-gray-50 ${r.issues === 0 ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">{r.label}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-green-700">{r.pass || '—'}</td>
                  <td className="px-3 py-2.5 text-right">{r.minor > 0 ? <span className="font-semibold text-yellow-700">{r.minor}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-right">{r.major > 0 ? <span className="font-bold text-orange-700">{r.major}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-right">{r.critical > 0 ? <span className="font-bold text-red-700">{r.critical}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-gray-400">{r.na > 0 ? r.na : '—'}</td>
                  <td className="px-4 py-2.5">
                    {r.app > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.critical > 0 ? 'bg-red-400' : r.major > 0 ? 'bg-orange-400' : r.minor > 0 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${issuePct}%` }}
                          />
                        </div>
                        <span className={`text-[10px] w-8 text-right font-medium ${issuePct > 20 ? 'text-orange-600' : 'text-slate-400'}`}>{issuePct}%</span>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QuestionTypePanel({ typeCounts, results }) {
  const total = results.length
  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
  if (types.length <= 1) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Question Types</h3>
        <p className="text-xs text-slate-400">{types.length} types in this batch</p>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {types.map(([t, c], i) => (
          <div key={t} className={`${TYPE_COLORS[i % TYPE_COLORS.length]}`} style={{ width: `${pct(c, total)}%` }} title={`${t}: ${c}`} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {types.map(([type, count], i) => {
          const app = results.filter(r => (r['Question Type'] || r.question_type) === type && r.Overall_Status === 'Approved').length
          const flag = count - app
          return (
            <div key={type} className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${TYPE_COLORS[i % TYPE_COLORS.length]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 truncate">{type}</span>
                  <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{count} ({pct(count, total)}%)</span>
                </div>
                <div className="text-[10px] text-slate-400 flex gap-2">
                  <span className="text-green-600">{app} approved</span>
                  {flag > 0 && <span className="text-orange-500">{flag} flagged</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SeverityPanel({ results }) {
  let pass = 0, minor = 0, major = 0, critical = 0
  for (const r of results) {
    for (const { key } of RUBRIC_COLS) {
      const s = r[key]
      if (s === 'Pass') pass++
      else if (s === 'Minor') minor++
      else if (s === 'Major') major++
      else if (s === 'Critical') critical++
    }
  }
  const rubricTotal = pass + minor + major + critical
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Overall Severity</h3>
        <p className="text-xs text-slate-400">Across all rubrics in this batch</p>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {[{ v: pass, c: 'bg-green-500' },{ v: minor, c: 'bg-yellow-400' },{ v: major, c: 'bg-orange-400' },{ v: critical, c: 'bg-red-500' }]
          .map(({ v, c }) => v > 0 && <div key={c} className={c} style={{ width: `${pct(v, rubricTotal)}%` }} />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Pass',     count: pass,     cls: 'text-green-700',  dot: 'bg-green-500' },
          { label: 'Minor',    count: minor,    cls: 'text-yellow-700', dot: 'bg-yellow-400' },
          { label: 'Major',    count: major,    cls: 'text-orange-700', dot: 'bg-orange-400' },
          { label: 'Critical', count: critical, cls: 'text-red-700',    dot: 'bg-red-500' },
        ].map(({ label, count, cls, dot }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
            <span className={`text-sm font-bold ${cls}`}>{count}</span>
            <span className="text-xs text-slate-400">{label}</span>
            <span className="text-[10px] text-slate-300">({pct(count, rubricTotal)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightsPanel({ insights }) {
  if (!insights || insights.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Batch Insights</h3>
      <div className="flex flex-col gap-2">
        {insights.map((ins, i) => (
          <div key={i} className={`flex gap-3 items-start p-3 rounded-lg border ${ins.cls}`}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-white border border-current">{ins.icon}</span>
            <p className="text-sm leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuestionTable({ results }) {
  const [filter, setFilter] = useState('All')
  const statuses = ['All', 'Approved', 'Needs Review', 'Rejected', 'Review Failed']
  const filtered = filter === 'All' ? results : results.filter(r => r.Overall_Status === filter)

  const STATUS_BADGE = {
    'Approved':      'bg-green-100 text-green-700',
    'Needs Review':  'bg-yellow-100 text-yellow-700',
    'Rejected':      'bg-red-100 text-red-700',
    'Review Failed': 'bg-gray-100 text-gray-600',
  }

  const topIssueFor = (r) => {
    const order = ['Critical','Major','Minor']
    for (const sev of order) {
      for (const { key, short } of RUBRIC_COLS) {
        if (r[key] === sev) return { short, sev }
      }
    }
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-800">All Questions — Quick View</h3>
        <div className="flex gap-1 flex-wrap">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'
              }`}
            >
              {s}
              {s !== 'All' && (
                <span className="ml-1 opacity-70">({results.filter(r => r.Overall_Status === s).length})</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-slate-400">
              <th className="text-left px-4 py-2 font-medium">Q. No</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Top Issue</th>
              <th className="text-left px-4 py-2 font-medium">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r, i) => {
              const qno = r['Q. NO'] || r.q_no || `Q${i + 1}`
              const top = topIssueFor(r)
              const SEV_CLS = { Critical: 'bg-red-100 text-red-700', Major: 'bg-orange-100 text-orange-700', Minor: 'bg-yellow-100 text-yellow-700' }
              return (
                <tr key={qno} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">{qno}</td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{r['Question Type'] || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[r.Overall_Status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.Overall_Status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {top ? (
                      <span className={`px-1.5 py-0.5 rounded font-medium ${SEV_CLS[top.sev]}`}>{top.short} — {top.sev}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 max-w-xs truncate">{r.Remarks || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">No questions match this filter.</p>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JobDashboard() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('memory')  // 'memory' | 'sheets'

  useEffect(() => {
    // Try in-memory store first (fast), fall back to Google Sheets (Render-restart safe)
    getResults(jobId)
      .then(d => { setResults(d.results); setSource('memory'); setLoading(false) })
      .catch(() => {
        getResultsFromSheets(jobId)
          .then(d => { setResults(d.results); setSource('sheets') })
          .catch(e => setError(e.response?.data?.detail || e.message || 'Job results not found. The server may have restarted.'))
          .finally(() => setLoading(false))
      })
  }, [jobId])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 flex items-center justify-center gap-3 text-slate-500">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading review results…
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center space-y-3">
        <p className="text-red-600 font-semibold">{error}</p>
        <button onClick={() => navigate('/')} className="text-sm text-brand-600 hover:underline">Back to upload</button>
      </div>
    )
  }

  const stats = computeStats(results)
  const passRate    = pctf(stats.approved, stats.total)
  const flagRate    = pctf(stats.needsReview + stats.rejected, stats.total)
  const cleanRate   = pctf(stats.approvedClean, stats.total)
  const issueRate   = pctf(stats.questionsWithIssues, stats.total)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-400 bg-gray-100 px-2 py-0.5 rounded">Job {jobId.slice(0, 8)}…</span>
            <span className="text-xs text-slate-400">{stats.total} questions</span>
            {source === 'sheets' && (
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">☁ from Sheets</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Review Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Results for this specific upload batch</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Overall Dashboard
          </Link>
          <Link
            to={`/results/${jobId}`}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Review Questions &amp; Feedback
          </Link>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Pass Rate"
          value={passRate} suffix="%"
          desc="Percentage of questions approved by the AI"
          good={v => v >= 80} warn={v => v >= 60 && v < 80}
        />
        <MetricCard
          label="Clean Rate"
          value={cleanRate} suffix="%"
          desc="Approved with zero corrections needed"
          good={v => v >= 70} warn={v => v >= 50 && v < 70}
        />
        <MetricCard
          label="Flag Rate"
          value={flagRate} suffix="%"
          desc="Flagged for revision or rejected"
          good={v => v <= 10} warn={v => v > 10 && v <= 25}
        />
        <MetricCard
          label="Issue Rate"
          value={issueRate} suffix="%"
          desc="Questions with at least one non-Pass rubric"
          good={v => v <= 15} warn={v => v > 15 && v <= 30}
        />
      </div>

      {/* Status summary */}
      <StatusCards stats={stats} />

      {/* Rubric heatmap */}
      <RubricTable rubrics={stats.rubrics} total={stats.total} />

      {/* Bottom split: severity + types + insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SeverityPanel results={results} />
        <QuestionTypePanel typeCounts={stats.typeCounts} results={results} />
        <InsightsPanel insights={stats.insights} />
      </div>

      {/* DSPy optimizer callout */}
      <div className="bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-100 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-brand-700">DSPy Prompt Optimizer</span>
            <span className="text-xs bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full">AI self-improvement</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Review individual questions, mark rubric scores as Accept / Reject / Override, then run the
            optimizer to update the AI's few-shot examples. Feedback is saved to Google Sheets permanently.
          </p>
        </div>
        <Link
          to={`/results/${jobId}`}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Open Review &amp; Optimizer
        </Link>
      </div>

      {/* Quick question table */}
      <QuestionTable results={results} />

      <p className="text-xs text-slate-400 text-center">
        Results for job <code className="bg-gray-100 px-1 rounded">{jobId.slice(0, 8)}</code>.
        {source === 'sheets' ? ' Loaded from Google Sheets — in-memory store had expired.' : ' Loaded from server memory. Also saved to Google Sheets permanently.'}
        {' '}Visit <Link to="/dashboard" className="text-brand-600 hover:underline">Overall Dashboard</Link> for aggregate stats across all jobs.
      </p>
    </div>
  )
}
