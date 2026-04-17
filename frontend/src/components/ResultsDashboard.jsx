function StatCard({ label, count, total, colorClass, icon }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className={`bg-white rounded-xl border p-5 ${colorClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-bold mt-1">{count}</p>
          <p className="text-xs mt-1 text-slate-400">{pct}% of total</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

export default function ResultsDashboard({ results }) {
  const total = results.length
  const approved = results.filter((r) => r.Overall_Status === 'Approved').length
  const needsReview = results.filter((r) => r.Overall_Status === 'Needs Review').length
  const rejected = results.filter((r) => r.Overall_Status === 'Rejected').length
  const failed = results.filter((r) => r.Overall_Status === 'Review Failed').length

  const rubricsWithIssues = {}
  const RUBRIC_COLS = [
    'R1_Grammatical_Accuracy', 'R2_Spelling', 'R3_Ambiguity',
    'R4_Functionality_Alignment', 'R5_Instruction_Clarity', 'R6_Academic_Language',
    'R7_Option_Explanation_Consistency', 'R8_Readability',
    'R9_Formatting_Spacing', 'R10_Punctuation', 'R11_EN_Consistency',
  ]
  for (const r of results) {
    for (const col of RUBRIC_COLS) {
      const score = r[col]
      if (score && score !== 'Pass' && score !== 'N/A') {
        rubricsWithIssues[col] = (rubricsWithIssues[col] || 0) + 1
      }
    }
  }
  const topIssues = Object.entries(rubricsWithIssues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total" count={total} total={total} colorClass="border-gray-200" icon="📋" />
        <StatCard label="Approved" count={approved} total={total} colorClass="border-green-200 text-green-800" icon="✅" />
        <StatCard label="Needs Review" count={needsReview} total={total} colorClass="border-yellow-200 text-yellow-800" icon="⚠️" />
        <StatCard label="Rejected" count={rejected} total={total} colorClass="border-red-200 text-red-800" icon="❌" />
      </div>

      {topIssues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-slate-600 mb-2">Most common issues</p>
          <div className="flex flex-wrap gap-2">
            {topIssues.map(([col, count]) => (
              <span key={col} className="text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2.5 py-1 rounded-full font-medium">
                {col.replace(/_/g, ' ')} — {count} question{count !== 1 ? 's' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {failed > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
          {failed} question{failed !== 1 ? 's' : ''} failed to review (likely an API error). Check the Excel file for details.
        </div>
      )}
    </div>
  )
}
