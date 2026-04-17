import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadPanel from '../components/UploadPanel'
import DownloadButton from '../components/DownloadButton'
import { uploadFile, downloadTemplate } from '../api'

export default function HomePage() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleStartReview() {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const { job_id, total_questions } = await uploadFile(file)
      navigate(`/review/${job_id}`, { state: { total: total_questions } })
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail?.errors)) {
        setError(detail.errors.join(' | '))
      } else if (typeof detail === 'string') {
        setError(detail)
      } else {
        setError('Upload failed. Please check your file and try again.')
      }
    } finally {
      setUploading(false)
    }
  }

  const estimatedMinutes = file ? Math.ceil((file.size / 1024 / 50) * 0.5) : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">Upload Exam Questions</h1>
        <p className="text-slate-500 mt-2 text-sm">
          Upload your Excel file and the AI will review every question across 11 quality rubrics.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <UploadPanel onFileSelected={setFile} file={file} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <DownloadButton
            onClick={downloadTemplate}
            label="Download Template"
            variant="secondary"
          />
          <button
            onClick={handleStartReview}
            disabled={!file || uploading}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              'Start Review'
            )}
          </button>
        </div>

        {file && estimatedMinutes && (
          <p className="text-xs text-slate-400 text-center">
            Estimated review time: ~{estimatedMinutes}–{estimatedMinutes * 2} minutes
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Required columns</p>
        <div className="flex flex-wrap gap-2">
          {['Q. NO', 'Question Type', 'Transcript', 'Instructions', 'Question',
            'Options', 'Correct Answer', 'Explanation', 'Schema',
            'Question Purpose', 'Difficulty', 'Tags'].map((col) => (
            <span key={col} className="text-xs bg-gray-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
