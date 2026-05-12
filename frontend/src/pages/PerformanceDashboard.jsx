import { useEffect, useState } from 'react'
import { getPerformanceDashboard } from '../api'

const METRIC_CONFIG = [
  {
    key: 'precision',
    label: 'Precision',
    description: 'Of all questions flagged by the AI, how many actually had real issues?',
    good: (v) => v >= 90,
    warn: (v) => v >= 70 && v < 90,
    suffix: '%',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'recall',
    label: 'Recall',
    description: 'Of all questions that had real issues, how many did the AI catch?',
    good: (v) => v >= 80,
    warn: (v) => v >= 50 && v < 80,
    suffix: '%',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    key: 'f1_score',
    label: 'F1 Score',
    description: 'Balanced score combining Precision and Recall. Higher is better (max 1.0).',
    good: (v) => v >= 0.8,
    warn: (v) => v >= 0.5 && v < 0.8,
    suffix: '',
    decimals: 2,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: 'accuracy',
    label: 'Accuracy',
    description: 'Overall percentage of questions the AI judged correctly.',
    good: (v) => v >= 90,
    warn: (v) => v >= 70 && v < 90,
    suffix: '%',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
]

function metricColor(cfg, value) {
  if (cfg.good(value)) return 'green'
  if (cfg.warn(value)) return 'yellow'
  return 'red'
}

const COLOR_CLASSES = {
  green:  { card: 'bg-green-50 border-green-200',  icon: 'bg-green-100 text-green-700',  value: 'text-green-700', badge: 'bg-green-100 text-green-800' },
  yellow: { card: 'bg-yellow-50 border-yellow-200', icon: 'bg-yellow-100 text-yellow-700', value: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  red:    { card: 'bg-red-50 border-red-200',      icon: 'bg-red-100 text-red-700',      value: 'text-red-700',   badge: 'bg-red-100 text-red-800' },
}

function MetricCard({ cfg, value }) {
  const color = metricColor(cfg, value)
  const cls = COLOR_CLASSES[color]
  const displayed = cfg.decimals ? value.toFixed(cfg.decimals) : value
  const label = color === 'green' ? 'Good' : color === 'yellow' ? 'Fair' : 'Needs Work'

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 ${cls.card}`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cls.icon}`}>
          {cfg.icon}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls.badge}`}>{label}</span>
      </div>
      <div>
        <div className={`text-3xl font-bold ${cls.value}`}>{displayed}{cfg.suffix}</div>
        <div className="text-sm font-medium text-slate-700 mt-0.5">{cfg.label}</div>
        <div className="text-xs text-slate-500 mt-1 leading-relaxed">{cfg.description}</div>
      </div>
    </div>
  )
}

function ConfusionMatrix({ cm }) {
  const cells = [
    { label: 'True Positive (TP)',  sub: 'AI flagged → real issue',        value: cm.tp, color: 'bg-green-100 text-green-800 border-green-300' },
    { label: 'False Negative (FN)', sub: 'AI approved → missed real issue', value: cm.fn, color: 'bg-red-100 text-red-800 border-red-300' },
    { label: 'False Positive (FP)', sub: 'AI flagged → not a real issue',   value: cm.fp, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { label: 'True Negative (TN)',  sub: 'AI approved → correct approval',  value: cm.tn, color: 'bg-blue-100 text-blue-800 border-blue-300' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Confusion Matrix</h2>
      <p className="text-xs text-slate-500 mb-4">How the AI's decisions align with ground truth from human reviewers</p>

      <div className="grid grid-cols-2 gap-0 border border-gray-300 rounded-lg overflow-hidden">
        <div className="col-span-2 grid grid-cols-2 bg-gray-50 border-b border-gray-300 text-center">
          <div className="py-1.5 text-xs font-semibold text-slate-600 border-r border-gray-300">AI Said: Problem</div>
          <div className="py-1.5 text-xs font-semibold text-slate-600">AI Said: Clean</div>
        </div>
        {cells.map((c, i) => (
          <div key={i} className={`p-4 flex flex-col items-center justify-center gap-1 border-gray-200 ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b' : ''} ${c.color} border`}>
            <div className="text-2xl font-bold">{c.value.toLocaleString()}</div>
            <div className="text-xs font-semibold text-center">{c.label}</div>
            <div className="text-xs text-center opacity-75">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Row labels:</span>
        <span className="text-xs bg-gray-100 text-slate-600 px-2 py-0.5 rounded">Top row = Actually a Problem</span>
        <span className="text-xs bg-gray-100 text-slate-600 px-2 py-0.5 rounded">Bottom row = Actually Clean</span>
      </div>
    </div>
  )
}

function OutcomesBar({ outcomes, total }) {
  const bars = [
    { label: 'Correct Approvals', value: outcomes.correct_approvals, color: 'bg-green-400', textColor: 'text-green-700' },
    { label: 'Missed Issues (FN)', value: outcomes.missed_issues, color: 'bg-orange-400', textColor: 'text-orange-700' },
    { label: 'Correctly Flagged', value: outcomes.correctly_flagged, color: 'bg-blue-400', textColor: 'text-blue-700' },
    { label: 'False Flags (FP)', value: outcomes.false_flags, color: 'bg-red-400', textColor: 'text-red-700' },
  ].filter(b => b.value > 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Question Outcomes</h2>
      <p className="text-xs text-slate-500 mb-4">Breakdown of all {total?.toLocaleString()} questions reviewed</p>

      <div className="flex h-8 rounded-lg overflow-hidden gap-0.5 mb-4">
        {bars.map((b) => (
          <div
            key={b.label}
            className={`${b.color} flex items-center justify-center transition-all`}
            style={{ width: `${(b.value / total) * 100}%`, minWidth: b.value > 0 ? '4px' : '0' }}
            title={`${b.label}: ${b.value}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${b.color}`} />
            <div>
              <div className={`text-sm font-semibold ${b.textColor}`}>{b.value.toLocaleString()}</div>
              <div className="text-xs text-slate-500">{b.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DiagnosticInsights({ insights }) {
  if (!insights || insights.length === 0) return null

  const iconFor = (text) => {
    if (text.toLowerCase().includes('perfect') || text.toLowerCase().includes('good') || text.toLowerCase().includes('high overall')) {
      return { icon: '✓', cls: 'bg-green-50 border-green-200 text-green-800' }
    }
    if (text.toLowerCase().includes('low recall') || text.toLowerCase().includes('low precision') || text.toLowerCase().includes('threshold')) {
      return { icon: '⚠', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800' }
    }
    return { icon: 'i', cls: 'bg-blue-50 border-blue-200 text-blue-800' }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Diagnostic Insights</h2>
      <p className="text-xs text-slate-500 mb-4">Automated analysis of the agent's strengths and weaknesses</p>
      <div className="flex flex-col gap-3">
        {insights.map((text, i) => {
          const { icon, cls } = iconFor(text)
          return (
            <div key={i} className={`flex gap-3 items-start p-3 rounded-lg border ${cls}`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-white border border-current">{icon}</span>
              <p className="text-sm leading-relaxed">{text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AgentBreakdown({ outcomes }) {
  const rows = [
    {
      label: 'Approved — No Issues',
      desc: 'AI said clean and it was correct',
      value: outcomes.approved_no_changes,
      color: 'bg-green-500',
      tag: 'Correct',
      tagCls: 'bg-green-100 text-green-800',
    },
    {
      label: 'Approved — With Minor Fixes',
      desc: 'AI approved but reviewer applied small corrections',
      value: outcomes.approved_with_changes,
      color: 'bg-orange-400',
      tag: 'Missed',
      tagCls: 'bg-orange-100 text-orange-800',
    },
    {
      label: 'Needs Revision',
      desc: 'AI flagged for major or minor issues',
      value: outcomes.needs_review,
      color: 'bg-blue-400',
      tag: 'Flagged',
      tagCls: 'bg-blue-100 text-blue-800',
    },
    {
      label: 'Rejected',
      desc: 'AI found critical issues — question rejected',
      value: outcomes.rejected,
      color: 'bg-red-500',
      tag: 'Rejected',
      tagCls: 'bg-red-100 text-red-800',
    },
  ]

  const total = rows.reduce((s, r) => s + r.value, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Agent Decision Breakdown</h2>
      <p className="text-xs text-slate-500 mb-4">How the AI classified each question and what that means</p>
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-24 text-right">
              <span className="text-sm font-bold text-slate-800">{r.value.toLocaleString()}</span>
              <span className="text-xs text-slate-400 ml-1">({total > 0 ? ((r.value / total) * 100).toFixed(1) : 0}%)</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-700">{r.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.tagCls}`}>{r.tag}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${r.color} rounded-full`} style={{ width: total > 0 ? `${(r.value / total) * 100}%` : '0%' }} />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function pct(n, total) {
  if (!total) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

function SummaryRow({ label, sub, count, ofTotal, ofGroup, color, bold }) {
  return (
    <tr className={bold ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}>
      <td className="px-4 py-2.5 text-sm text-slate-700">
        {label}
        {sub && <div className="text-xs text-slate-400 font-normal">{sub}</div>}
      </td>
      <td className="px-4 py-2.5 text-sm text-right font-semibold text-slate-800">{count?.toLocaleString()}</td>
      <td className="px-4 py-2.5 text-sm text-right text-slate-500">{ofGroup ?? '—'}</td>
      <td className="px-4 py-2.5 text-sm text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full`} style={{ width: ofTotal }} />
          </div>
          <span className="text-slate-500 w-8 text-right">{ofTotal}</span>
        </div>
      </td>
    </tr>
  )
}

function AgentSummaryTable({ summary, total, totalFiles }) {
  if (!summary) return null
  const approved = summary.approved_total ?? 0
  const flagged  = summary.flagged_total ?? 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-slate-800">Detailed Review Summary</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {total?.toLocaleString()} questions across {totalFiles ?? '—'} review files
        </p>
      </div>

      {/* Approved by Agent */}
      <div className="px-6 pt-4 pb-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-sm font-semibold text-slate-700">
            Approved by Agent —{' '}
            <span className="text-green-700">{approved.toLocaleString()}</span>
            <span className="text-slate-400 font-normal ml-1">({pct(approved, total)} of total)</span>
          </span>
        </div>
      </div>
      <table className="w-full mb-2">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-gray-100">
            <th className="px-4 py-1.5 text-left font-medium">Category</th>
            <th className="px-4 py-1.5 text-right font-medium">Count</th>
            <th className="px-4 py-1.5 text-right font-medium">% of Approved</th>
            <th className="px-4 py-1.5 text-right font-medium">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          <SummaryRow
            label="Correct — No Changes Needed"
            sub="AI approved and no corrections were required"
            count={summary.approved_correct}
            ofGroup={pct(summary.approved_correct, approved)}
            ofTotal={pct(summary.approved_correct, total)}
            color="bg-green-500"
          />
          <SummaryRow
            label="Approved — Minor Fixes Applied"
            sub="AI approved but reviewer made small corrections"
            count={summary.approved_with_fixes}
            ofGroup={pct(summary.approved_with_fixes, approved)}
            ofTotal={pct(summary.approved_with_fixes, total)}
            color="bg-orange-400"
          />
        </tbody>
      </table>

      {/* Flagged by Agent */}
      <div className="px-6 pt-2 pb-1 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-sm font-semibold text-slate-700">
            Flagged by Agent —{' '}
            <span className="text-blue-700">{flagged.toLocaleString()}</span>
            <span className="text-slate-400 font-normal ml-1">({pct(flagged, total)} of total)</span>
          </span>
        </div>
      </div>
      <table className="w-full mb-2">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-gray-100">
            <th className="px-4 py-1.5 text-left font-medium">Category</th>
            <th className="px-4 py-1.5 text-right font-medium">Count</th>
            <th className="px-4 py-1.5 text-right font-medium">% of Flagged</th>
            <th className="px-4 py-1.5 text-right font-medium">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          <SummaryRow
            label="Needs Revision (correctly flagged)"
            sub="Has major issues — sent back for revision"
            count={summary.flagged_needs_revision}
            ofGroup={pct(summary.flagged_needs_revision, flagged)}
            ofTotal={pct(summary.flagged_needs_revision, total)}
            color="bg-yellow-400"
          />
          <SummaryRow
            label="Rejected (correctly flagged)"
            sub="Has critical issues — question rejected"
            count={summary.flagged_rejected}
            ofGroup={pct(summary.flagged_rejected, flagged)}
            ofTotal={pct(summary.flagged_rejected, total)}
            color="bg-red-500"
          />
          <SummaryRow
            label="Incorrectly Flagged (false positive)"
            sub="AI flagged but human reviewer disagreed"
            count={summary.flagged_false_positive || 0}
            ofGroup={summary.flagged_false_positive ? pct(summary.flagged_false_positive, flagged) : '—'}
            ofTotal={summary.flagged_false_positive ? pct(summary.flagged_false_positive, total) : '—'}
            color="bg-purple-400"
          />
        </tbody>
      </table>

      {/* Full Summary */}
      <div className="border-t border-gray-200">
        <div className="px-6 pt-3 pb-1">
          <span className="text-sm font-semibold text-slate-700">Full Summary</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-gray-100">
              <th className="px-4 py-1.5 text-left font-medium">Category</th>
              <th className="px-4 py-1.5 text-right font-medium">Count</th>
              <th className="px-4 py-1.5 text-right font-medium">% of Flagged</th>
              <th className="px-4 py-1.5 text-right font-medium">% of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <SummaryRow label="Approved — Correct"          count={summary.approved_correct}       ofGroup={null} ofTotal={pct(summary.approved_correct, total)}       color="bg-green-500" />
            <SummaryRow label="Approved — With Minor Fixes" count={summary.approved_with_fixes}     ofGroup={null} ofTotal={pct(summary.approved_with_fixes, total)}     color="bg-orange-400" />
            <SummaryRow label="Flagged — Needs Revision"    count={summary.flagged_needs_revision}  ofGroup={null} ofTotal={pct(summary.flagged_needs_revision, total)}  color="bg-yellow-400" />
            <SummaryRow label="Flagged — Rejected"          count={summary.flagged_rejected}        ofGroup={null} ofTotal={pct(summary.flagged_rejected, total)}        color="bg-red-500" />
            {(summary.review_failed ?? 0) > 0 && (
              <SummaryRow label="Review Failed" count={summary.review_failed} ofGroup={null} ofTotal={pct(summary.review_failed, total)} color="bg-gray-400" />
            )}
            <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
              <td className="px-4 py-2.5 text-sm text-slate-800">Total</td>
              <td className="px-4 py-2.5 text-sm text-right text-slate-800">{total?.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-sm text-right text-slate-500">—</td>
              <td className="px-4 py-2.5 text-sm text-right text-slate-500">{totalFiles ?? '—'} files</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PerformanceDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    getPerformanceDashboard()
      .then((d) => { setData(d); setFetchedAt(new Date()) })
      .catch((e) => setError(e.message || 'Failed to load performance data'))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 flex items-center justify-center gap-3 text-slate-500">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading performance data from Google Sheets…
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center text-red-600">
        <p className="font-semibold">Could not load performance data</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={() => load()}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
        >
          Try Again
        </button>
      </div>
    )
  }

  const { metrics, confusion_matrix: cm, question_outcomes: outcomes, agent_summary: summary, diagnostic_insights: insights, total_questions, total_files, data_source } = data

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agent Performance Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Across <span className="font-semibold text-slate-700">{total_questions?.toLocaleString()}</span> questions reviewed — how well is the AI content reviewer doing?
          </p>
          {fetchedAt && (
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.9-3M20 15a9 9 0 01-15.9 3" />
                </svg>
                Last updated {fetchedAt.toLocaleTimeString()}
              </span>
              {data_source && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                  {data_source === 'Google Sheets' ? '☁ Google Sheets' : '💾 Local files'}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.9-3M20 15a9 9 0 01-15.9 3" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {METRIC_CONFIG.map((cfg) => (
          <MetricCard key={cfg.key} cfg={cfg} value={metrics[cfg.key]} />
        ))}
      </div>

      {/* Outcomes bar + Confusion matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <OutcomesBar outcomes={outcomes} total={total_questions} />
        <ConfusionMatrix cm={cm} />
      </div>

      {/* Agent breakdown + Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <AgentBreakdown outcomes={outcomes} />
        <DiagnosticInsights insights={insights} />
      </div>

      {/* Detailed Summary Table */}
      <AgentSummaryTable summary={summary} total={total_questions} totalFiles={total_files} />

      {/* Footnote */}
      <p className="text-xs text-slate-400 mt-6 text-center">
        Data sourced from Google Sheets — all review jobs are logged permanently regardless of server restarts.
        Metrics update within 5 minutes of each new review job. Human feedback (reject/override) improves recall over time via DSPy optimization.
        "Missed Issues" = questions the AI approved but minor corrections were applied — used as a proxy for issues that slipped through.
      </p>
    </div>
  )
}
