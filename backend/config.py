import os
import dspy
from dotenv import load_dotenv
from supabase import create_client, Client

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
    lm = dspy.LM(
        model="openai/qwen/qwen3-30b-a3b",
        api_base="https://integrate.api.nvidia.com/v1",
        api_key=os.environ["NVIDIA_API_KEY"],
        max_tokens=4096,
        temperature=0.1,
        cache=False,
    )
    dspy.configure(lm=lm)
    _dspy_configured = True


def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_ANON_KEY", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment")
    return create_client(url, key)


supabase: Client = None


def init_supabase():
    global supabase
    supabase = get_supabase_client()
