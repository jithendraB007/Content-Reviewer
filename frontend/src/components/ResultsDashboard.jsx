const RUBRIC_COLS = [
  { key: 'R1_Grammatical_Accuracy',          label: 'R1 — Grammar' },
  { key: 'R2_Spelling',                      label: 'R2 — Spelling' },
  { key: 'R3_Ambiguity',                     label: 'R3 — Ambiguity' },
  { key: 'R4_Functionality_Alignment',       label: 'R4 — Alignment' },
  { key: 'R5_Instruction_Clarity',           label: 'R5 — Instructions' },
  { key: 'R6_Academic_Language',             label: 'R6 — Academic Lang' },
  { key: 'R7_Option_Explanation_Consistency', label: 'R7 — Options/Exp' },
  { key: 'R8_Readability',                   label: 'R8 — Readability' },
  { key: 'R9_Formatting_Spacing',            label: 'R9 — Formatting' },
  { key: 'R10_Punctuation',                  label: 'R10 — Punctuation' },
  { key: 'R11_EN_Consistency',               label: 'R11 — EN Consistency' },
]

const STATUS_COLORS = {
  Approved:       { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  bar: 'bg-green-500' },
  'Needs Review': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', bar: 'bg-yellow-400' },
  Rejected:       { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    bar: 'bg-red-500' },
  'Review Failed':{ bg: 'bg-gray-50',   border: 'border-gray-300',   text: 'text-gray-600',   bar: 'bg-gray-400' },
}

const SCORE_CELL = {
  Pass:     'bg-green-100 text-green-700',
  Minor:    'bg-yellow-100 text-yellow-700',
  Major:    'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
  'N/A':    'text-gray-300',
}

function pct(n, total) {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function StatusBar({ results, total }) {
  const statuses = ['Approved', 'Needs Review', 'Rejected', 'Review Failed']
  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-px bg-gray-100">
      {statuses.map((s) => {
        const count = results.filter((r) => r.Overall_Status === s).length
        if (count === 0) return null
        return (
          <div
            key={s}
            className={`${STATUS_COLORS[s].bar} transition-all`}
            style={{ width: `${pct(count, total)}%` }}
            title={`${s}: ${count}`}
          />
        )
      })}
    </div>
  )
}

function StatusCards({ results }) {
  const total    = results.length
  const approved = results.filter((r) => r.Overall_Status === 'Approved').length
  const approvedClean = results.filter(
    (r) => r.Overall_Status === 'Approved' && !RUBRIC_COLS.some((c) => r[c.key] === 'Minor')
  ).length
  const approvedMinor = approved - approvedClean
  const needsReview = results.filter((r) => r.Overall_Status === 'Needs Review').length
  const rejected    = results.filter((r) => r.Overall_Status === 'Rejected').length
  const failed      = results.filter((r) => r.Overall_Status === 'Review Failed').length

  const cards = [
    { label: 'Total Reviewed', value: total, sub: `${pct(approved, total)}% passed`, bg: 'bg-white border-gray-200', val: 'text-slate-800' },
    { label: 'Approved — Clean', value: approvedClean, sub: `${pct(approvedClean, total)}% of total`, bg: 'bg-green-50 border-green-200', val: 'text-green-700' },
    { label: 'Approved — Minor Fixes', value: approvedMinor, sub: 'small corrections applied', bg: 'bg-blue-50 border-blue-200', val: 'text-blue-700' },
    { label: 'Needs Revision', value: needsReview, sub: 'major issues found', bg: 'bg-yellow-50 border-yellow-200', val: 'text-yellow-700' },
    { label: 'Rejected', value: rejected, sub: 'critical issues — rewrite', bg: 'bg-red-50 border-red-200', val: 'text-red-700' },
  ]
  if (failed > 0) {
    cards.push({ label: 'Review Failed', value: failed, sub: 'API error', bg: 'bg-gray-50 border-gray-200', val: 'text-gray-600' })
  }

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${failed > 0 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-5'}`}>
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
            <div className={`text-2xl font-bold ${c.val}`}>{c.value}</div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5 leading-tight">{c.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>
      <StatusBar results={results} total={total} />
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Approved (clean)', color: 'bg-green-500', count: approvedClean },
          { label: 'Approved (minor)', color: 'bg-blue-400',  count: approvedMinor },
          { label: 'Needs Revision',   color: 'bg-yellow-400', count: needsReview },
          { label: 'Rejected',         color: 'bg-red-500',   count: rejected },
        ].filter(x => x.count > 0).map((x) => (
          <span key={x.label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-sm ${x.color}`} />
            {x.label} — {pct(x.count, total)}%
          </span>
        ))}
      </div>
    </div>
  )
}

function RubricTable({ results }) {
  const applicable = (key) => results.filter((r) => r[key] && r[key] !== 'N/A').length

  const rows = RUBRIC_COLS.map(({ key, label }) => {
    const pass     = results.filter((r) => r[key] === 'Pass').length
    const minor    = results.filter((r) => r[key] === 'Minor').length
    const major    = results.filter((r) => r[key] === 'Major').length
    const critical = results.filter((r) => r[key] === 'Critical').length
    const na       = results.filter((r) => r[key] === 'N/A').length
    const issues   = minor + major + critical
    const app      = applicable(key)
    return { key, label, pass, minor, major, critical, na, issues, app }
  }).sort((a, b) => b.issues - a.issues)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Rubric Health Breakdown</h3>
          <p className="text-xs text-slate-400 mt-0.5">How each quality rubric scored — sorted by most issues first</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-medium">
          {[['bg-green-100 text-green-700','Pass'],['bg-yellow-100 text-yellow-700','Minor'],['bg-orange-100 text-orange-700','Major'],['bg-red-100 text-red-700','Critical']].map(([cls,l]) => (
            <span key={l} className={`px-1.5 py-0.5 rounded ${cls}`}>{l}</span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-2 font-medium">Rubric</th>
              <th className="text-right px-3 py-2 font-medium">Pass</th>
              <th className="text-right px-3 py-2 font-medium">Minor</th>
              <th className="text-right px-3 py-2 font-medium">Major</th>
              <th className="text-right px-3 py-2 font-medium">Critical</th>
              <th className="text-right px-3 py-2 font-medium">N/A</th>
              <th className="px-4 py-2 font-medium w-32">Issue rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => {
              const issuePct = r.app > 0 ? Math.round((r.issues / r.app) * 100) : 0
              return (
                <tr key={r.key} className={`hover:bg-gray-50 ${r.issues > 0 ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-700 whitespace-nowrap">{r.label}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-semibold text-green-700">{r.pass || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.minor > 0 ? <span className="font-semibold text-yellow-700">{r.minor}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.major > 0 ? <span className="font-bold text-orange-700">{r.major}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.critical > 0 ? <span className="font-bold text-red-700">{r.critical}</span> : <span className="text-gray-300">—</span>}
                  </td>
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

function QuestionTypeBreakdown({ results }) {
  const typeCounts = {}
  for (const r of results) {
    const t = r['Question Type'] || r.question_type || 'Unknown'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }
  const total = results.length
  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])

  if (types.length <= 1) return null

  const TYPE_COLORS = [
    'bg-indigo-400', 'bg-sky-400', 'bg-teal-400',
    'bg-violet-400', 'bg-pink-400', 'bg-amber-400', 'bg-lime-400',
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Question Types</h3>
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        {types.map(([type, count], i) => (
          <div
            key={type}
            className={`${TYPE_COLORS[i % TYPE_COLORS.length]} transition-all`}
            style={{ width: `${pct(count, total)}%` }}
            title={`${type}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {types.map(([type, count], i) => {
          const approved = results.filter((r) => (r['Question Type'] || r.question_type) === type && r.Overall_Status === 'Approved').length
          const flagged  = count - approved
          return (
            <div key={type} className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${TYPE_COLORS[i % TYPE_COLORS.length]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 truncate">{type}</span>
                  <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{count} ({pct(count, total)}%)</span>
                </div>
                <div className="flex gap-2 mt-0.5 text-[10px] text-slate-400">
                  <span className="text-green-600">{approved} approved</span>
                  {flagged > 0 && <span className="text-orange-500">{flagged} flagged</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SeveritySummary({ results }) {
  const total = results.length
  let pass = 0, minor = 0, major = 0, critical = 0, na = 0
  for (const r of results) {
    for (const { key } of RUBRIC_COLS) {
      const s = r[key]
      if (s === 'Pass') pass++
      else if (s === 'Minor') minor++
      else if (s === 'Major') major++
      else if (s === 'Critical') critical++
      else if (s === 'N/A') na++
    }
  }
  const rubricTotal = pass + minor + major + critical

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-1">Overall Rubric Severity</h3>
      <p className="text-xs text-slate-400 mb-3">Across all {RUBRIC_COLS.length} rubrics × {total} questions</p>

      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        {[
          { count: pass,     color: 'bg-green-500' },
          { count: minor,    color: 'bg-yellow-400' },
          { count: major,    color: 'bg-orange-400' },
          { count: critical, color: 'bg-red-500' },
        ].map(({ count, color }) =>
          count > 0 ? (
            <div key={color} className={`${color}`} style={{ width: `${pct(count, rubricTotal)}%` }} />
          ) : null
        )}
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
            <div>
              <span className={`text-sm font-bold ${cls}`}>{count}</span>
              <span className="text-xs text-slate-400 ml-1">{label}</span>
              <span className="text-[10px] text-slate-300 ml-1">({pct(count, rubricTotal)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ResultsDashboard({ results }) {
  if (!results || results.length === 0) return null

  const failed = results.filter((r) => r.Overall_Status === 'Review Failed').length

  return (
    <div className="space-y-4">
      {/* Status summary cards + bar */}
      <StatusCards results={results} />

      {/* Rubric health table */}
      <RubricTable results={results} />

      {/* Bottom row: severity summary + question type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SeveritySummary results={results} />
        <QuestionTypeBreakdown results={results} />
      </div>

      {failed > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
          {failed} question{failed !== 1 ? 's' : ''} failed to review (API error). Check the downloaded Excel for details.
        </div>
      )}
    </div>
  )
}
