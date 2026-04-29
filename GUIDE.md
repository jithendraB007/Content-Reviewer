# Exam Content Reviewer — Complete Guide

A complete guide for anyone new to this project. Covers what the app does, how it works internally, how to run it locally, and how to deploy it.

---

## Table of Contents

1. [What Is This App?](#1-what-is-this-app)
2. [How It Works — Big Picture](#2-how-it-works--big-picture)
3. [Key Concepts](#3-key-concepts)
4. [The 11 Quality Rubrics](#4-the-11-quality-rubrics)
5. [Question Type Routing](#5-question-type-routing)
6. [Feedback and Optimization Loop](#6-feedback-and-optimization-loop)
7. [Project Structure](#7-project-structure)
8. [Input Excel Format](#8-input-excel-format)
9. [Running Locally](#9-running-locally)
10. [API Endpoints](#10-api-endpoints)
11. [Deploying to Render](#11-deploying-to-render)
12. [Environment Variables](#12-environment-variables)

---

## 1. What Is This App?

The **Exam Content Reviewer** is a full-stack AI-powered tool for checking the quality of exam questions before they are published.

**The problem it solves:**
Content teams create hundreds of exam questions. Manually checking every question for grammar errors, ambiguous phrasing, wrong answer keys, formatting issues, and inconsistent language is slow and error-prone.

**What this app does:**
- You upload an Excel file containing exam questions
- The AI automatically checks each question against 11 quality rubrics
- You get back a color-coded Excel report showing what passed, what needs review, and what was rejected
- You can give feedback on the AI's decisions to make it smarter over time

---

## 2. How It Works — Big Picture

```
User uploads Excel file
        ↓
Backend validates columns and question types
        ↓
Questions grouped into batches of 5
        ↓
Each batch → 4 API calls to Azure OpenAI (GPT-4.1 mini)
  - Batch 1: Grammar + Spelling + Punctuation + EN Consistency
  - Batch 2: Functionality + Instruction Clarity + Academic Language + Readability
  - Batch 3: Option/Explanation Consistency + Formatting
  - Batch 4: Ambiguity (uses Chain-of-Thought reasoning)
        ↓
LLM returns JSON with scores (Pass / Minor / Major / Critical) per rubric
        ↓
Overall status computed:
  - Any Critical → Rejected
  - Any Major    → Needs Review
  - All Pass     → Approved
        ↓
Color-coded Excel file generated
        ↓
Results displayed in the frontend with original vs corrected diffs
        ↓
User submits Accept / Reject / Override feedback per rubric
        ↓
User clicks "Optimize Prompts" → DSPy BootstrapFewShot improves prompts
        ↓
Next upload uses improved prompts
```

---

## 3. Key Concepts

### DSPy
[DSPy](https://github.com/stanfordnlp/dspy) is a framework for programming (not just prompting) language models. Instead of writing raw prompts, you define **Signatures** (input/output schemas) and DSPy handles the prompt construction. It also supports **optimization** — automatically improving prompts based on examples.

In this app, DSPy is used to:
- Define each rubric as a typed Signature with clear input/output fields
- Call Azure OpenAI with structured outputs
- Run `BootstrapFewShot` optimization when users submit feedback

### Azure OpenAI
The LLM powering the reviews. We use **GPT-4.1 mini** (deployment: `gpt-5.4-mini-2026-03-17`) via the Azure OpenAI API. The model receives batches of 5 questions and returns structured JSON reviews.

### DSPy Signatures
A Signature is like a typed function definition for an LLM call:

```python
class MQTextMechanics(dspy.Signature):
    """Review up to 5 questions for grammar, spelling, punctuation, EN consistency."""
    questions_json: str = dspy.InputField(...)   # JSON array of 5 questions
    results_json: str = dspy.OutputField(...)    # JSON array of scores
```

DSPy converts this into a structured prompt and parses the output automatically.

### BootstrapFewShot
A DSPy optimizer. When users reject or override AI decisions, those examples are stored. `BootstrapFewShot` uses those examples to find few-shot demonstrations that improve the LLM's scoring accuracy. The optimized state is saved to `backend/optimized/reviewer_module.json` and loaded automatically on the next review run.

### Batch Processing (5 questions per call)
Instead of making 11 API calls per question (1 per rubric × 11 rubrics), questions are:
1. Grouped into batches of 5
2. Related rubrics grouped into 4 batch calls per group of 5 questions

This reduces API calls from `11 × N` to `4 × ceil(N/5)` — about 10× fewer calls for large files.

---

## 4. The 11 Quality Rubrics

| # | Name | What It Checks | Severity Impact |
|---|------|----------------|-----------------|
| R1 | Grammatical Accuracy | Subject-verb agreement, tense, articles, fragments | Major → Needs Review |
| R2 | Spelling | Typos, misspellings, confused words (their/there) | Major → Needs Review |
| R3 | Ambiguity | Multiple valid answers, vague stems, similar options | Critical → Rejected |
| R4 | Functionality Alignment | Does question test what it claims? Right difficulty? | Major → Needs Review |
| R5 | Instruction Clarity | Are instructions complete and appropriate? | Minor → Approved |
| R6 | Academic Language | No slang, formal tone, culturally neutral | Major → Needs Review |
| R7 | Option/Explanation Consistency | Correct answer matches explanation? | Major → Needs Review |
| R8 | Readability | Sentence length, wordiness, cognitive load | Minor → Approved |
| R9 | Formatting/Spacing | Option labels (A/B/C/D), capitalization, schema | Minor → Approved |
| R10 | Punctuation | Missing ?, missing ., comma misuse | Minor → Approved |
| R11 | EN Consistency | Mixed British/American English | Minor → Approved |

**Score meanings:**
- `Pass` — No issue found
- `Minor` — Small issue, question still usable
- `Major` — Significant issue, needs human review
- `Critical` — Question must be rejected and rewritten
- `N/A` — Rubric not applicable to this question type

---

## 5. Question Type Routing

Not all rubrics apply to all question types. For example, R7 (Option/Explanation Consistency) only makes sense for questions with options.

| Question Type | Skipped Rubrics |
|---------------|-----------------|
| MCQ | None (all 11 apply) |
| Fill in the Blanks | R7 |
| Speaking Based | R7 |
| Textual | R7 |
| Audio Based MCQ | None (all 11 apply) |
| Prompt Based | R7 (unless options present) |
| Image Based with Options | None |
| Image Based with Audio | R7 |

---

## 6. Feedback and Optimization Loop

### How feedback works
On the results page, every rubric with a non-Pass score shows three buttons:
- **Accept** — AI was correct, keep this score
- **Reject** — AI was wrong, this should be Pass
- **Override** — AI got the score but the correction is wrong; enter the right correction

All feedback is saved to a local SQLite database (`backend/feedback.db`).

### How optimization works
1. Click **Optimize Prompts** on the results page
2. The backend reads all `reject` and `override` feedback records
3. DSPy `BootstrapFewShot` runs on each batch predictor using those records as training examples
4. The optimized module is saved to `backend/optimized/reviewer_module.json`
5. The next time a file is uploaded, `RubricReviewer` loads the optimized weights automatically

**Minimum required:** At least 1 reject or override feedback to enable the button.

---

## 7. Project Structure

```
content-reviewer/
├── .env                          # Your secrets (never commit this)
├── .env.example                  # Template for env vars
├── .gitignore
├── backend/
│   ├── main.py                   # FastAPI app, all 7 endpoints
│   ├── config.py                 # DSPy + Azure OpenAI setup
│   ├── requirements.txt
│   ├── feedback.db               # SQLite feedback store (auto-created)
│   ├── uploads/                  # Uploaded + reviewed Excel files
│   ├── optimized/                # Saved DSPy optimized weights
│   ├── excel/
│   │   ├── reader.py             # Validate + read uploaded Excel
│   │   ├── writer.py             # Write color-coded output Excel
│   │   └── template.py           # Generate blank template
│   ├── pipeline/
│   │   ├── signatures.py         # DSPy Signatures for all 11 rubrics + batch variants
│   │   ├── modules.py            # RubricReviewer DSPy module
│   │   ├── reviewer.py           # Orchestrates review of a DataFrame
│   │   ├── router.py             # Maps question type → applicable rubrics
│   │   ├── corrector.py          # Merges corrections (highest severity wins)
│   │   └── remarks.py            # Generates human-readable remarks string
│   └── feedback/
│       ├── models.py             # DB schema documentation
│       ├── store.py              # SQLite CRUD (insert, query feedback)
│       └── optimizer.py          # DSPy BootstrapFewShot optimization
└── frontend/
    ├── src/
    │   ├── api.js                # Axios API client + mock mode
    │   ├── App.jsx               # React Router routes
    │   ├── pages/
    │   │   ├── HomePage.jsx      # Upload page
    │   │   ├── ReviewPage.jsx    # Progress polling page
    │   │   └── FeedbackPage.jsx  # Results + feedback + optimizer
    │   └── components/
    │       ├── Header.jsx
    │       ├── UploadPanel.jsx
    │       ├── ProgressBar.jsx
    │       ├── ResultsDashboard.jsx
    │       ├── QuestionReviewCard.jsx  # Per-question expand/collapse card
    │       ├── FeedbackPanel.jsx       # Accept/Reject/Override buttons
    │       └── DownloadButton.jsx
    ├── package.json
    └── vite.config.js            # Dev proxy: /api → localhost:8000
```

---

## 8. Input Excel Format

Your Excel file must have these columns (download the template from the app):

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `Q. NO` | Yes | Unique question ID | `Q001` |
| `Question Type` | Yes | Type of question | `MCQ` |
| `Instructions` | Yes | What student must do | `Choose the correct answer.` |
| `Question` | Yes | The question text | `What is the capital of France?` |
| `Options` | For MCQ | Pipe-separated A/B/C/D | `A) Paris \| B) London \| C) Berlin \| D) Madrid` |
| `Correct Answer` | Yes | The right answer | `A) Paris` |
| `Explanation` | Yes | Why this is correct | `Paris is the capital of France.` |
| `Transcript` | For audio | Audio/video script | `The speaker discussed...` |
| `Question Purpose` | Yes | Skill being tested | `Vocabulary in context` |
| `Difficulty` | Yes | Difficulty level | `A1`, `A2`, `Easy`, `Medium`, `Hard` |
| `Schema` | No | Format metadata | (leave blank if unsure) |
| `Tags` | No | Topic tags | `Grammar, Synonyms` |

**Valid Question Types:**
`MCQ`, `Fill in the Blanks`, `Speaking Based`, `Textual`, `Audio Based MCQ`, `Prompt Based`, `Image Based with Options`, `Image Based with Audio`

---

## 9. Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- Azure OpenAI API key (or NVIDIA NIM key)

### Step 1 — Clone and set up environment
```bash
git clone https://github.com/your-repo/content-reviewer.git
cd content-reviewer
cp .env.example .env
# Edit .env and add your Azure OpenAI credentials
```

### Step 2 — Start the backend
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### Step 3 — Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173`

### Step 4 — Upload and review
1. Open `http://localhost:5173`
2. Click **Download Template** to get the correct Excel format
3. Fill in your questions and upload
4. Wait for the review to complete (~30–60 seconds for 10 questions)
5. View results, submit feedback, download the reviewed Excel

---

## 10. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload Excel file, returns `job_id` |
| `GET` | `/api/status/{job_id}` | Poll progress: `{status, progress, current, total}` |
| `GET` | `/api/results/{job_id}` | Full results JSON (only when status=done) |
| `GET` | `/api/download/{job_id}` | Download reviewed Excel file |
| `GET` | `/api/template` | Download blank input template |
| `POST` | `/api/feedback` | Submit rubric feedback |
| `POST` | `/api/optimize` | Trigger DSPy BootstrapFewShot optimization |
| `GET` | `/api/feedback/stats` | Get feedback counts by verdict |

---

## 11. Deploying to Render

### Backend (Web Service)
| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python -m uvicorn main:app --host 0.0.0.0 --port $PORT` |

Add all environment variables from section 12 in the Render dashboard.

### Frontend (Static Site)
| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Build Command | `npm install && node node_modules/vite/bin/vite.js build` |
| Publish Directory | `dist` |

Add `VITE_API_URL` = your backend Render URL.

### Free Tier Limitations
- Backend spins down after 15 minutes of inactivity (first request is slow)
- No persistent disk — `feedback.db` and uploads reset on redeploy
- Static sites (frontend) have no limitations on free tier

---

## 12. Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | `979zfVAX...` |
| `AZURE_OPENAI_ENDPOINT` | Azure resource endpoint | `https://your-resource.openai.azure.com/` |
| `AZURE_OPENAI_API_VERSION` | API version | `2025-04-01-preview` |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name | `gpt-5.4-mini-2026-03-17` |
| `UPLOAD_DIR` | Folder for uploaded files | `uploads` |
| `MAX_FILE_SIZE_MB` | Max upload size | `10` |
| `INTER_CALL_DELAY` | Seconds between API calls | `0.5` |
| `FRONTEND_URL` | Frontend URL for CORS | `https://your-app.onrender.com` |
| `VITE_API_URL` | Backend URL (frontend only) | `https://your-backend.onrender.com` |
| `VITE_USE_MOCK` | Run frontend without backend | `false` |

---

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `WinError 10013` | Port 8000 already in use | `Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess \| Stop-Process -Force` |
| `ModuleNotFoundError` | Wrong virtual environment active | Activate the correct venv: `venv\Scripts\activate` |
| `404 Not Found` on model | Wrong model slug for LLM provider | Check exact deployment name in Azure Portal |
| `temperature` error | GPT-5 only supports `temperature=1` | Set `temperature=1` in `config.py` |
| `Upload failed` | Axios sending wrong Content-Type | Do not set `Content-Type` header manually for file uploads |
| All questions `Review Failed` | Rate limit exhausted all retries | Increase `INTER_CALL_DELAY` in `.env` |
