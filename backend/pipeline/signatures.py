import dspy

SCORE_DESC = "Severity score: one of Pass, Minor, Major, Critical"


class GrammaticalAccuracy(dspy.Signature):
    """Evaluate grammatical accuracy of exam question content.
    Check ONLY grammar: subject-verb agreement, tense consistency, article usage (a/an/the),
    sentence fragments, run-on sentences, dangling modifiers, and pronoun agreement.
    Do NOT flag spelling errors, punctuation, or readability issues here."""

    question: str = dspy.InputField(desc="The question text")
    task_instructions: str = dspy.InputField(desc="Task instructions given to the student")
    options: str = dspy.InputField(desc="Answer options string (may be empty)")
    explanation: str = dspy.InputField(desc="Answer explanation text")
    transcript: str = dspy.InputField(desc="Audio/video transcript text (may be empty)")
    question_type: str = dspy.InputField(desc="Question type e.g. MCQ, Fill in the Blanks")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Specific grammatical issues found, comma-separated. Write 'None' if no issues.")
    corrected_question: str = dspy.OutputField(desc="Grammatically corrected question text (unchanged if no issues)")
    corrected_instructions: str = dspy.OutputField(desc="Grammatically corrected instructions (unchanged if no issues)")
    corrected_options: str = dspy.OutputField(desc="Grammatically corrected options (unchanged if no issues)")
    corrected_explanation: str = dspy.OutputField(desc="Grammatically corrected explanation (unchanged if no issues)")
    corrected_transcript: str = dspy.OutputField(desc="Grammatically corrected transcript (unchanged if no issues)")


class SpellingCheck(dspy.Signature):
    """Evaluate spelling accuracy in exam question content.
    Check for typos, misspellings, and commonly confused words (affect/effect, their/there/they're,
    its/it's, then/than, etc.).
    Do NOT flag British vs American English spelling differences here — that is a separate rubric.
    Do NOT flag grammar or punctuation."""

    question: str = dspy.InputField(desc="The question text")
    task_instructions: str = dspy.InputField(desc="Task instructions")
    options: str = dspy.InputField(desc="Answer options string (may be empty)")
    explanation: str = dspy.InputField(desc="Answer explanation text")
    transcript: str = dspy.InputField(desc="Audio/video transcript text (may be empty)")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Specific misspellings found as 'original->correction' pairs, comma-separated. Write 'None' if no issues.")
    corrected_question: str = dspy.OutputField(desc="Spelling-corrected question text")
    corrected_instructions: str = dspy.OutputField(desc="Spelling-corrected instructions")
    corrected_options: str = dspy.OutputField(desc="Spelling-corrected options")
    corrected_explanation: str = dspy.OutputField(desc="Spelling-corrected explanation")
    corrected_transcript: str = dspy.OutputField(desc="Spelling-corrected transcript")


class AmbiguityCheck(dspy.Signature):
    """[HIGHEST PRIORITY] Deeply evaluate whether the question has EXACTLY ONE defensible correct answer.
    Reason through ALL possible interpretations before scoring.
    Consider: Can a knowledgeable student argue for a different answer?
    Is the question stem vague or open to multiple readings?
    For MCQ: are any two options so similar a student could reasonably choose either?
    For Fill in the Blanks: could multiple valid words fill the blank?
    For Speaking/Textual: is the expected answer clearly derivable from the prompt?
    This is the most important rubric — err on the side of flagging ambiguity."""

    question: str = dspy.InputField(desc="The question text")
    options: str = dspy.InputField(desc="Answer options string (may be empty)")
    correct_answer: str = dspy.InputField(desc="The marked correct answer")
    task_instructions: str = dspy.InputField(desc="Task instructions")
    question_type: str = dspy.InputField(desc="Question type")
    question_purpose: str = dspy.InputField(desc="What skill/concept the question tests")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Detailed ambiguity issues found. Write 'None' if unambiguous.")
    corrected_question: str = dspy.OutputField(desc="Disambiguated question text (unchanged if unambiguous)")
    corrected_instructions: str = dspy.OutputField(desc="Clarified instructions (unchanged if clear)")
    corrected_options: str = dspy.OutputField(desc="Clarified options (unchanged if clear)")


class FunctionalityAlignment(dspy.Signature):
    """Evaluate whether the question actually tests what the Question Purpose states.
    Check: Does this question measure the intended skill or knowledge?
    Is the difficulty level (Easy/Medium/Hard) appropriate for the question's cognitive demand?
    Does the correct answer genuinely require the stated skill to select it?"""

    question: str = dspy.InputField(desc="The question text")
    question_purpose: str = dspy.InputField(desc="What skill/concept the question tests")
    correct_answer: str = dspy.InputField(desc="The marked correct answer")
    explanation: str = dspy.InputField(desc="Answer explanation")
    difficulty: str = dspy.InputField(desc="Stated difficulty: Easy / Medium / Hard")
    question_type: str = dspy.InputField(desc="Question type")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Alignment issues found. Write 'None' if well-aligned.")
    suggestions: str = dspy.OutputField(desc="Suggestions to improve alignment, or 'None' if aligned.")


class InstructionClarity(dspy.Signature):
    """Evaluate clarity and completeness of the task instructions.
    Instructions must unambiguously tell the student exactly what to do.
    Check: Are they complete? Do they match the question type?
    Are they unnecessarily complex or missing key directives?
    For example, MCQ should say 'Choose the correct answer', not 'Answer the question'."""

    task_instructions: str = dspy.InputField(desc="Task instructions to evaluate")
    question_type: str = dspy.InputField(desc="Question type")
    difficulty: str = dspy.InputField(desc="Difficulty level")
    question: str = dspy.InputField(desc="The question text for context")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Clarity issues found. Write 'None' if clear.")
    corrected_instructions: str = dspy.OutputField(desc="Improved clear instructions (unchanged if already clear)")


class AcademicLanguage(dspy.Signature):
    """Evaluate whether all language used meets academic exam standards.
    Check: Is the tone formal and professional? No slang, colloquialisms, or informal contractions.
    Is the content culturally neutral and unbiased? No stereotypes or culturally specific references
    that disadvantage certain students. Is vocabulary level appropriate for the stated difficulty?"""

    question: str = dspy.InputField(desc="The question text")
    task_instructions: str = dspy.InputField(desc="Task instructions")
    options: str = dspy.InputField(desc="Answer options string (may be empty)")
    explanation: str = dspy.InputField(desc="Answer explanation")
    difficulty: str = dspy.InputField(desc="Difficulty level")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Language/bias issues found. Write 'None' if academically appropriate.")
    corrected_question: str = dspy.OutputField(desc="Academic-language corrected question (unchanged if appropriate)")
    corrected_instructions: str = dspy.OutputField(desc="Academic-language corrected instructions (unchanged if appropriate)")
    corrected_options: str = dspy.OutputField(desc="Academic-language corrected options (unchanged if appropriate)")
    corrected_explanation: str = dspy.OutputField(desc="Academic-language corrected explanation (unchanged if appropriate)")


class OptionExplanationConsistency(dspy.Signature):
    """Evaluate consistency between the correct answer, options, and explanation.
    Check: Does the marked correct answer match what the explanation describes?
    Does the explanation actually justify WHY the correct answer is right?
    Does it address why the distractors (wrong options) are incorrect?
    Are there any contradictions between the correct answer label and explanation content?
    Only applicable to question types with options (MCQ, Audio Based MCQ, Image Based with Options)."""

    options: str = dspy.InputField(desc="All answer options string")
    correct_answer: str = dspy.InputField(desc="The marked correct answer")
    explanation: str = dspy.InputField(desc="Answer explanation")
    question: str = dspy.InputField(desc="The question text")
    question_type: str = dspy.InputField(desc="Question type")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Consistency issues found. Write 'None' if consistent.")
    corrected_explanation: str = dspy.OutputField(desc="Corrected explanation that properly justifies the answer (unchanged if consistent)")
    suggestions: str = dspy.OutputField(desc="Other suggestions to improve consistency, or 'None'.")


class ReadabilityCheck(dspy.Signature):
    """Evaluate readability and cognitive clarity of the question content.
    This is about CLARITY OF COMMUNICATION, not grammatical correctness.
    Check: Are sentences unnecessarily long or complex? Could the question be simplified
    without losing meaning? Is the cognitive load appropriate for the difficulty level?
    Is the question unnecessarily wordy? Are there nested clauses that obscure meaning?
    Do NOT flag grammar issues here — only readability and clarity."""

    question: str = dspy.InputField(desc="The question text")
    task_instructions: str = dspy.InputField(desc="Task instructions")
    explanation: str = dspy.InputField(desc="Answer explanation")
    difficulty: str = dspy.InputField(desc="Difficulty level")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Readability issues found. Write 'None' if readable.")
    corrected_question: str = dspy.OutputField(desc="More readable question text (unchanged if already readable)")
    corrected_instructions: str = dspy.OutputField(desc="More readable instructions (unchanged if already readable)")


class FormattingSpacing(dspy.Signature):
    """Evaluate formatting and structural consistency of the question.
    Check: Are options consistently labeled (A) B) C) D) or A. B. C. D.)?
    Is the same format used throughout? Are there extra spaces, missing line breaks,
    or inconsistent capitalization in option labels?
    Does the question comply with the Schema format specified?
    Are option texts properly aligned and consistently cased?"""

    question: str = dspy.InputField(desc="The question text")
    options: str = dspy.InputField(desc="Answer options string (may be empty)")
    task_instructions: str = dspy.InputField(desc="Task instructions")
    question_schema: str = dspy.InputField(desc="Schema/format metadata")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Formatting issues found. Write 'None' if well-formatted.")
    corrected_options: str = dspy.OutputField(desc="Reformatted options with consistent labeling (unchanged if already correct)")
    corrected_question: str = dspy.OutputField(desc="Reformatted question text (unchanged if already correct)")


class PunctuationCheck(dspy.Signature):
    """Evaluate punctuation accuracy across all question content.
    Check ONLY punctuation: missing periods at sentence ends, missing question marks,
    incorrect comma usage (comma splices, missing Oxford commas where needed),
    semicolon misuse, quotation mark issues, inconsistent terminal punctuation in option lists.
    Do NOT flag grammar or spelling here — only punctuation."""

    question: str = dspy.InputField(desc="The question text")
    task_instructions: str = dspy.InputField(desc="Task instructions")
    options: str = dspy.InputField(desc="Answer options string (may be empty)")
    explanation: str = dspy.InputField(desc="Answer explanation")
    transcript: str = dspy.InputField(desc="Audio/video transcript text (may be empty)")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    issues: str = dspy.OutputField(desc="Specific punctuation issues found. Write 'None' if correct.")
    corrected_question: str = dspy.OutputField(desc="Punctuation-corrected question text")
    corrected_instructions: str = dspy.OutputField(desc="Punctuation-corrected instructions")
    corrected_options: str = dspy.OutputField(desc="Punctuation-corrected options")
    corrected_explanation: str = dspy.OutputField(desc="Punctuation-corrected explanation")
    corrected_transcript: str = dspy.OutputField(desc="Punctuation-corrected transcript")


class ENConsistency(dspy.Signature):
    """Evaluate British/American English consistency throughout the question content.
    First detect the DOMINANT English variant used (British or American).
    Then flag any words that use the OTHER variant.
    Examples: colour/color, analyse/analyze, travelling/traveling, behaviour/behavior,
    recognise/recognize, favour/favor, centre/center.
    Standardize to the dominant variant — do not change the standard itself,
    just make all text consistent with it."""

    question: str = dspy.InputField(desc="The question text")
    task_instructions: str = dspy.InputField(desc="Task instructions")
    options: str = dspy.InputField(desc="Answer options string (may be empty)")
    explanation: str = dspy.InputField(desc="Answer explanation")
    transcript: str = dspy.InputField(desc="Audio/video transcript text (may be empty)")

    score: str = dspy.OutputField(desc=SCORE_DESC)
    detected_standard: str = dspy.OutputField(desc="Dominant English variant detected: 'British' or 'American'")
    issues: str = dspy.OutputField(desc="Mixed-variant words found as 'original->standardized' pairs. Write 'None' if consistent.")
    corrected_question: str = dspy.OutputField(desc="EN-consistent question text")
    corrected_instructions: str = dspy.OutputField(desc="EN-consistent instructions")
    corrected_options: str = dspy.OutputField(desc="EN-consistent options")
    corrected_explanation: str = dspy.OutputField(desc="EN-consistent explanation")
    corrected_transcript: str = dspy.OutputField(desc="EN-consistent transcript")
