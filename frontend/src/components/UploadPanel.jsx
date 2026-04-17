import { useState, useRef } from 'react'

const MAX_SIZE_MB = 10

export default function UploadPanel({ onFileSelected, file }) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function validate(f) {
    if (!f) return 'No file selected.'
    const ext = f.name.toLowerCase()
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      return 'Only Excel files (.xlsx or .xls) are accepted.'
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB} MB.`
    }
    return ''
  }

  function handleFile(f) {
    const err = validate(f)
    setError(err)
    if (!err) onFileSelected(f)
  }

  function onDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function onInputChange(e) {
    const f = e.target.files[0]
    if (f) handleFile(f)
  }

  return (
    <div className="w-full">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
          ${isDragging ? 'border-brand-600 bg-brand-50' : 'border-gray-300 hover:border-brand-600 hover:bg-gray-50'}
          ${file ? 'border-green-400 bg-green-50' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-green-700">{file.name}</p>
            <p className="text-sm text-green-600">{(file.size / 1024).toFixed(1)} KB — Click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Drop your Excel file here</p>
              <p className="text-sm text-slate-400 mt-1">or click to browse — .xlsx or .xls, max {MAX_SIZE_MB} MB</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
