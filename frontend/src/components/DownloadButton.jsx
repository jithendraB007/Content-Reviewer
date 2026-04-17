export default function DownloadButton({ onClick, label = 'Download', variant = 'primary', disabled = false }) {
  const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1'
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-600 disabled:opacity-50',
    secondary: 'bg-white text-slate-700 border border-gray-300 hover:bg-gray-50 focus:ring-brand-600 disabled:opacity-50',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant] || styles.primary}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </button>
  )
}
