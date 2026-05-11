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

OPTIMIZED_PATH = os.path.join(os.path.dirname(__file__), "..", "optimized", "reviewer_module.json")


class RubricReviewer(dspy.Module):
    def __init__(self):
        super().__init__()
        self.mq_text = dspy.Predict(MQTextMechanics)
        self.mq_content = dspy.Predict(MQContentQuality)
        self.mq_structure = dspy.Predict(MQStructure)
        self.mq_ambiguity = dspy.ChainOfThought(MQAmbiguity)
        self._load_optimized()

    def _load_optimized(self):
        # Try local file first
        if not os.path.exists(OPTIMIZED_PATH):
            # Not found locally — try downloading from Google Sheets (survives Render redeploys)
            try:
                from sheets.logger import load_optimized_weights
                load_optimized_weights(OPTIMIZED_PATH)
            except Exception as e:
                print(f"[WARN] Could not fetch weights from Sheets: {e}")
        if os.path.exists(OPTIMIZED_PATH):
            try:
                self.load(OPTIMIZED_PATH)
                print(f"[INFO] Loaded optimized reviewer weights from {OPTIMIZED_PATH}")
            except Exception as e:
                print(f"[WARN] Could not load optimized weights: {e}")

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
