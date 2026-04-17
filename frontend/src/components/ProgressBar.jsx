export default function ProgressBar({ progress = 0, label = '' }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-slate-500 mb-2">
        <span>{label}</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
