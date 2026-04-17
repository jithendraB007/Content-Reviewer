import { useState } from 'react'
import { submitFeedback } from '../api'

export default function FeedbackPanel({ jobId, questionNo, rubricName, aiScore, aiCorrection, originalText }) {
  const [verdict, setVerdict] = useState(null)
  const [override, setOverride] = useState('')
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!verdict) return
    setLoading(true)
    try {
      await submitFeedback({
        job_id: jobId,
        question_no: questionNo,
        rubric_name: rubricName,
        ai_score: aiScore,
        ai_correction: aiCorrection || '',
        user_verdict: verdict,
        user_correction: verdict === 'override' ? override : null,
        user_comment: comment || null,
        original_text: originalText || '',
      })
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-xs text-green-600 font-medium flex items-center gap-1">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Feedback saved
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        {['accept', 'reject', 'override'].map((v) => (
          <button
            key={v}
            onClick={() => setVerdict(v)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
              verdict === v
                ? v === 'accept'
                  ? 'bg-green-100 border-green-400 text-green-700'
                  : v === 'reject'
                  ? 'bg-red-100 border-red-400 text-red-700'
                  : 'bg-blue-100 border-blue-400 text-blue-700'
                : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50'
            }`}
          >
            {v === 'accept' ? '✓ Accept' : v === 'reject' ? '✗ Reject' : '✎ Override'}
          </button>
        ))}
      </div>

      {verdict === 'override' && (
        <textarea
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder="Enter the correct version..."
          className="w-full text-xs border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-600 resize-none"
          rows={2}
        />
      )}

      {verdict && verdict !== 'accept' && (
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: explain why (helps improve the AI)"
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      )}

      {verdict && (
        <button
          onClick={handleSubmit}
          disabled={loading || (verdict === 'override' && !override.trim())}
          className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Submit Feedback'}
        </button>
      )}
    </div>
  )
}
