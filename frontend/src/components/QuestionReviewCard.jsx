import { useState } from 'react'
import FeedbackPanel from './FeedbackPanel'

const RUBRIC_COLS = [
  { key: 'R1_Grammatical_Accuracy', label: 'Grammar' },
  { key: 'R2_Spelling', label: 'Spelling' },
  { key: 'R3_Ambiguity', label: 'Ambiguity' },
  { key: 'R4_Functionality_Alignment', label: 'Alignment' },
  { key: 'R5_Instruction_Clarity', label: 'Instructions' },
  { key: 'R6_Academic_Language', label: 'Academic Lang.' },
  { key: 'R7_Option_Explanation_Consistency', label: 'Options/Exp.' },
  { key: 'R8_Readability', label: 'Readability' },
  { key: 'R9_Formatting_Spacing', label: 'Formatting' },
  { key: 'R10_Punctuation', label: 'Punctuation' },
  { key: 'R11_EN_Consistency', label: 'EN Consistency' },
]

function scoreBadgeClass(score) {
  switch (score) {
    case 'Pass': return 'score-pass'
    case 'Minor': return 'score-minor'
    case 'Major': return 'score-major'
    case 'Critical': return 'score-critical'
    default: return 'score-na'
  }
}

function statusBadgeClass(status) {
  switch (status) {
    case 'Approved': return 'status-approved'
    case 'Needs Review': return 'status-needs-review'
    case 'Rejected': return 'status-rejected'
    default: return 'status-failed'
  }
}

function DiffRow({ label, original, corrected }) {
  if (!original && !corrected) return null
  const changed = original !== corrected && corrected && corrected.trim()
  if (!original && !corrected) return null

  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <p className="text-slate-400 font-medium mb-1 uppercase tracking-wide text-[10px]">Original {label}</p>
        <p className={`p-2 rounded-lg ${changed ? 'bg-red-50 text-red-800 line-through' : 'bg-gray-50 text-slate-600'}`}>
          {original || <em className="text-gray-300">empty</em>}
        </p>
      </div>
      <div>
        <p className="text-slate-400 font-medium mb-1 uppercase tracking-wide text-[10px]">Corrected {label}</p>
        <p className={`p-2 rounded-lg ${changed ? 'bg-green-50 text-green-800 font-medium' : 'bg-gray-50 text-slate-600'}`}>
          {corrected || original || <em className="text-gray-300">empty</em>}
        </p>
      </div>
    </div>
  )
}

export default function QuestionReviewCard({ result, jobId }) {
  const [expanded, setExpanded] = useState(false)
  const qNo = result['Q. NO'] || result.q_no || '?'
  const qType = result['Question Type'] || result.question_type || ''
  const status = result.Overall_Status || 'Unknown'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-bold text-slate-700 shrink-0">{qNo}</span>
          <span className="text-xs text-slate-400 shrink-0">{qType}</span>
          <span className="text-sm text-slate-600 truncate">
            {result.Question || result.Corrected_Question || ''}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadgeClass(status)}`}>
            {status}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Changes</p>
            <DiffRow label="Question" original={result.Question} corrected={result.Corrected_Question} />
            <DiffRow label="Instructions" original={result.Instructions} corrected={result.Corrected_Instructions} />
            <DiffRow label="Options" original={result.Options} corrected={result.Corrected_Options} />
            <DiffRow label="Explanation" original={result.Explanation} corrected={result.Corrected_Explanation} />
            {(result.Transcript || result.Corrected_Transcript) && (
              <DiffRow label="Transcript" original={result.Transcript} corrected={result.Corrected_Transcript} />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Rubric Scores</p>
            <div className="flex flex-wrap gap-1.5">
              {RUBRIC_COLS.map(({ key, label }) => {
                const score = result[key] || 'N/A'
                return (
                  <span key={key} className={`text-xs font-medium px-2 py-0.5 rounded-md ${scoreBadgeClass(score)}`}>
                    {label}: {score}
                  </span>
                )
              })}
            </div>
          </div>

          {result.Remarks && result.Remarks !== 'No issues found.' && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Remarks</p>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                {result.Remarks}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Feedback</p>
            <div className="space-y-3">
              {RUBRIC_COLS.filter(({ key }) => {
                const score = result[key]
                return score && score !== 'Pass' && score !== 'N/A'
              }).map(({ key, label }) => (
                <div key={key} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400">{result[key]}</p>
                  </div>
                  <div className="shrink-0">
                    <FeedbackPanel
                      jobId={jobId}
                      questionNo={String(qNo)}
                      rubricName={key}
                      aiScore={result[key]}
                      aiCorrection={result.Corrected_Question}
                      originalText={result.Question || ''}
                    />
                  </div>
                </div>
              ))}
              {RUBRIC_COLS.every(({ key }) => !result[key] || result[key] === 'Pass' || result[key] === 'N/A') && (
                <p className="text-xs text-slate-400">No issues to provide feedback on.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
