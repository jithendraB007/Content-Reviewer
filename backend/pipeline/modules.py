import time
import dspy

from .signatures import (
    MQTextMechanics,
    MQContentQuality,
    MQStructure,
    MQAmbiguity,
)

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import INTER_CALL_DELAY


class RubricReviewer(dspy.Module):
    def __init__(self):
        super().__init__()
        self.mq_text = dspy.Predict(MQTextMechanics)       # R1, R2, R10, R11 for 5 questions
        self.mq_content = dspy.Predict(MQContentQuality)   # R4, R5, R6, R8 for 5 questions
        self.mq_structure = dspy.Predict(MQStructure)       # R7, R9 for 5 questions
        self.mq_ambiguity = dspy.ChainOfThought(MQAmbiguity) # R3 for 5 questions (CoT)

    def call_with_retry(self, predictor, max_retries: int = 6, **kwargs):
        time.sleep(INTER_CALL_DELAY)
        delay = 15.0
        last_error = None
        for attempt in range(max_retries):
            try:
                return predictor(**kwargs)
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "429" in err_str or "rate limit" in err_str or "too many" in err_str or "ratelim" in err_str:
                    print(f"Rate limit hit (attempt {attempt+1}/{max_retries}), waiting {delay:.0f}s...")
                    time.sleep(delay)
                    delay = min(delay * 2, 120)
                    continue
                raise
        raise RuntimeError(f"Max retries ({max_retries}) exceeded: {last_error}")

    def forward(self, **kwargs):
        pass
