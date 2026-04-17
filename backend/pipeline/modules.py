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

    def call_with_retry(self, predictor, max_retries: int = 3, **kwargs):
        delay = INTER_CALL_DELAY
        last_error = None
        for attempt in range(max_retries):
            try:
                time.sleep(delay)
                return predictor(**kwargs)
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "429" in err_str or "rate limit" in err_str or "too many" in err_str:
                    delay = min(delay * 2, 60)
                    continue
                raise
        raise RuntimeError(f"Max retries ({max_retries}) exceeded: {last_error}")

    def forward(self, **kwargs):
        pass
