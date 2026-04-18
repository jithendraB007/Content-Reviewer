import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const api = axios.create({ baseURL: BASE_URL, timeout: 60000 })

// ── Mock data ─────────────────────────────────────────────────────────────────

export const MOCK_RESULTS = [
  {
    'Q. NO': 'Q001',
    'Question Type': 'MCQ',
    Corrected_Question: 'What is the capital of France?',
    Corrected_Instructions: 'Choose the correct answer.',
    Corrected_Options: 'A) Paris | B) London | C) Berlin | D) Madrid',
    Corrected_Explanation: 'Paris is the capital and largest city of France.',
    Corrected_Transcript: '',
    R1_Grammatical_Accuracy: 'Pass',
    R2_Spelling: 'Pass',
    R3_Ambiguity: 'Pass',
    R4_Functionality_Alignment: 'Pass',
    R5_Instruction_Clarity: 'Minor',
    R6_Academic_Language: 'Pass',
    R7_Option_Explanation_Consistency: 'Pass',
    R8_Readability: 'Pass',
    R9_Formatting_Spacing: 'Pass',
    R10_Punctuation: 'Pass',
    R11_EN_Consistency: 'Pass',
    Overall_Status: 'Approved',
    Remarks: '[INSTRUCTION_CLARITY - Minor] Instructions could be more specific for MCQ format.',
  },
  {
    'Q. NO': 'Q002',
    'Question Type': 'MCQ',
    Question: 'Which of the following are a mammal?',
    Corrected_Question: 'Which of the following is a mammal?',
    Corrected_Instructions: 'Choose the correct answer.',
    Corrected_Options: 'A) Eagle | B) Dolphin | C) Salmon | D) Cobra',
    Corrected_Explanation: 'Dolphins are marine mammals, unlike fish, birds, and reptiles.',
    Corrected_Transcript: '',
    R1_Grammatical_Accuracy: 'Major',
    R2_Spelling: 'Pass',
    R3_Ambiguity: 'Pass',
    R4_Functionality_Alignment: 'Pass',
    R5_Instruction_Clarity: 'Pass',
    R6_Academic_Language: 'Pass',
    R7_Option_Explanation_Consistency: 'Minor',
    R8_Readability: 'Pass',
    R9_Formatting_Spacing: 'Pass',
    R10_Punctuation: 'Pass',
    R11_EN_Consistency: 'Pass',
    Overall_Status: 'Needs Review',
    Remarks:
      '[GRAMMAR - Major] Subject-verb agreement error. Original: "Which of the following are" → Corrected: "Which of the following is". Reason: Subject-verb agreement error.\n[OPTION_EXPLANATION_CONSISTENCY - Minor] Explanation uses "Dolphins is" instead of "Dolphins are".',
  },
  {
    'Q. NO': 'Q003',
    'Question Type': 'Fill in the Blanks',
    Corrected_Question: 'Water boils at ___ degrees Celsius at sea level.',
    Corrected_Instructions: 'Fill in the blank with the correct answer.',
    Corrected_Options: '',
    Corrected_Explanation: 'Water undergoes phase transition from liquid to gas at 100°C.',
    Corrected_Transcript: '',
    R1_Grammatical_Accuracy: 'Pass',
    R2_Spelling: 'Pass',
    R3_Ambiguity: 'Critical',
    R4_Functionality_Alignment: 'Pass',
    R5_Instruction_Clarity: 'Pass',
    R6_Academic_Language: 'Pass',
    R7_Option_Explanation_Consistency: 'N/A',
    R8_Readability: 'Pass',
    R9_Formatting_Spacing: 'Pass',
    R10_Punctuation: 'Pass',
    R11_EN_Consistency: 'Pass',
    Overall_Status: 'Rejected',
    Remarks:
      '[AMBIGUITY - Critical] The blank could be answered as "100", "one hundred", or "212 Fahrenheit". Needs to specify unit and format expected.',
  },
  {
    'Q. NO': 'Q004',
    'Question Type': 'Audio Based MCQ',
    Corrected_Question: 'What does the speaker primarily discuss?',
    Corrected_Instructions: 'Listen to the audio and choose the correct answer.',
    Corrected_Options: 'A) Fossil fuels | B) Renewable energy | C) Nuclear power | D) Coal mining',
    Corrected_Explanation: 'The transcript explicitly mentions solar, wind, and hydro power.',
    Corrected_Transcript: 'The speaker talked about renewable energy sources including solar, wind, and hydro power as alternatives to fossil fuels.',
    R1_Grammatical_Accuracy: 'Pass',
    R2_Spelling: 'Pass',
    R3_Ambiguity: 'Pass',
    R4_Functionality_Alignment: 'Pass',
    R5_Instruction_Clarity: 'Pass',
    R6_Academic_Language: 'Pass',
    R7_Option_Explanation_Consistency: 'Pass',
    R8_Readability: 'Pass',
    R9_Formatting_Spacing: 'Pass',
    R10_Punctuation: 'Pass',
    R11_EN_Consistency: 'Pass',
    Overall_Status: 'Approved',
    Remarks: 'No issues found.',
  },
  {
    'Q. NO': 'Q005',
    'Question Type': 'Image Based with Options',
    Corrected_Question: 'What type of cloud formation is shown in the image?',
    Corrected_Instructions: 'Look at the image and choose the correct answer.',
    Corrected_Options: 'A) Cumulus | B) Stratus | C) Cirrus | D) Nimbus',
    Corrected_Explanation:
      'Cumulus clouds are characterised by their fluffy, cotton-like appearance with flat bases.',
    Corrected_Transcript: '',
    R1_Grammatical_Accuracy: 'Pass',
    R2_Spelling: 'Pass',
    R3_Ambiguity: 'Pass',
    R4_Functionality_Alignment: 'Pass',
    R5_Instruction_Clarity: 'Pass',
    R6_Academic_Language: 'Pass',
    R7_Option_Explanation_Consistency: 'Pass',
    R8_Readability: 'Pass',
    R9_Formatting_Spacing: 'Pass',
    R10_Punctuation: 'Pass',
    R11_EN_Consistency: 'Minor',
    Overall_Status: 'Approved',
    Remarks:
      '[EN_CONSISTENCY - Minor] Mixed British/American: "characterised" (British) detected as dominant. Standardized.',
  },
]

let mockProgress = 0
let mockInterval = null

// ── API functions ──────────────────────────────────────────────────────────────

export async function uploadFile(file) {
  if (USE_MOCK) {
    await delay(800)
    mockProgress = 0
    return { job_id: 'mock-job-001', total_questions: MOCK_RESULTS.length }
  }
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/api/upload', form)
  return res.data
}

export async function getStatus(jobId) {
  if (USE_MOCK) {
    await delay(300)
    mockProgress = Math.min(mockProgress + 25, 100)
    const isDone = mockProgress >= 100
    return {
      job_id: jobId,
      status: isDone ? 'done' : 'processing',
      progress: mockProgress,
      current: Math.floor((mockProgress / 100) * MOCK_RESULTS.length),
      total: MOCK_RESULTS.length,
      current_question: isDone ? 'Complete' : `Q00${Math.ceil((mockProgress / 100) * MOCK_RESULTS.length)}`,
      elapsed_seconds: 4.2,
      error: null,
    }
  }
  const res = await api.get(`/api/status/${jobId}`)
  return res.data
}

export async function getResults(jobId) {
  if (USE_MOCK) {
    await delay(400)
    return { job_id: jobId, results: MOCK_RESULTS }
  }
  const res = await api.get(`/api/results/${jobId}`)
  return res.data
}

export async function downloadResults(jobId) {
  if (USE_MOCK) {
    alert('Mock mode: Excel download not available without backend.')
    return
  }
  const res = await api.get(`/api/download/${jobId}`, { responseType: 'blob' })
  triggerDownload(res.data, `reviewed_${jobId}.xlsx`)
}

export async function downloadTemplate() {
  if (USE_MOCK) {
    alert('Mock mode: Template download not available without backend.')
    return
  }
  const res = await api.get('/api/template', { responseType: 'blob' })
  triggerDownload(res.data, 'exam_questions_template.xlsx')
}

export async function submitFeedback(payload) {
  if (USE_MOCK) {
    await delay(300)
    console.log('[Mock] Feedback submitted:', payload)
    return { status: 'saved', id: 'mock-id-' + Date.now() }
  }
  const res = await api.post('/api/feedback', payload)
  return res.data
}

export async function triggerOptimization() {
  if (USE_MOCK) {
    await delay(1000)
    return { status: 'complete', results: [{ status: 'skipped', reason: 'Mock mode' }] }
  }
  const res = await api.post('/api/optimize')
  return res.data
}

export async function getFeedbackStats() {
  if (USE_MOCK) {
    return { total: 12, accept: 8, reject: 3, override: 1 }
  }
  const res = await api.get('/api/feedback/stats')
  return res.data
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
