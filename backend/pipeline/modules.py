import time
import dspy

from .signatures import (
    GrammaticalAccuracy,
    SpellingCheck,
    AmbiguityCheck,
    FunctionalityAlignment,
    InstructionClarity,
    AcademicLanguage,
    OptionExplanationConsistency,
    ReadabilityCheck,
    FormattingSpacing,
    PunctuationCheck,
    ENConsistency,
)

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import INTER_CALL_DELAY


class RubricReviewer(dspy.Module):
    def __init__(self):
        super().__init__()
        self.r1 = dspy.Predict(GrammaticalAccuracy)
        self.r2 = dspy.Predict(SpellingCheck)
        self.r3 = dspy.ChainOfThought(AmbiguityCheck)
        self.r4 = dspy.Predict(FunctionalityAlignment)
        self.r5 = dspy.Predict(InstructionClarity)
        self.r6 = dspy.Predict(AcademicLanguage)
        self.r7 = dspy.Predict(OptionExplanationConsistency)
        self.r8 = dspy.Predict(ReadabilityCheck)
        self.r9 = dspy.Predict(FormattingSpacing)
        self.r10 = dspy.Predict(PunctuationCheck)
        self.r11 = dspy.Predict(ENConsistency)

    def call_with_retry(self, predictor, max_retries: int = 6, **kwargs):
        time.sleep(INTER_CALL_DELAY)
        delay = 15.0  # initial wait after a rate-limit hit
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
