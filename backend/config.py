import os
import dspy
from dotenv import load_dotenv

load_dotenv()

REQUIRED_COLUMNS = [
    "Q. NO", "Question Type", "Transcript", "Instructions",
    "Question", "Options", "Correct Answer", "Explanation",
    "Schema", "Question Purpose", "Difficulty", "Tags"
]

VALID_QUESTION_TYPES = {
    "MCQ", "Fill in the Blanks", "Speaking Based", "Textual",
    "Audio Based MCQ", "Prompt Based",
    "Image Based with Options", "Image Based with Audio"
}

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", 10))
INTER_CALL_DELAY = float(os.environ.get("INTER_CALL_DELAY", 1.0))

_dspy_configured = False


def configure_dspy():
    global _dspy_configured
    if _dspy_configured:
        return
    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    lm = dspy.LM(
        model=f"azure/{deployment}",
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        max_tokens=8192,
        temperature=1,
        cache=False,
    )
    dspy.configure(lm=lm)
    _dspy_configured = True


def init_supabase():
    pass  # replaced by SQLite — kept for import compatibility
