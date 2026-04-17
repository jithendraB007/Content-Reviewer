import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from config import REQUIRED_COLUMNS

SAMPLE_ROW = {
    "Q. NO": "Q001",
    "Question Type": "MCQ",
    "Transcript": "",
    "Instructions": "Choose the correct answer.",
    "Question": "What is the capital of France?",
    "Options": "A) Paris | B) London | C) Berlin | D) Madrid",
    "Correct Answer": "A) Paris",
    "Explanation": "Paris is the capital and largest city of France.",
    "Schema": "Geography",
    "Question Purpose": "Test knowledge of European capitals",
    "Difficulty": "Easy",
    "Tags": "Geography, Europe, Capitals",
}


def generate_template(output_path: str) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Questions"

    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)

    for col_idx, header in enumerate(REQUIRED_COLUMNS, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.row_dimensions[1].height = 25

    sample_values = [SAMPLE_ROW.get(col, "") for col in REQUIRED_COLUMNS]
    ws.append(sample_values)

    col_widths = {
        "Q. NO": 8,
        "Question Type": 20,
        "Transcript": 40,
        "Instructions": 30,
        "Question": 50,
        "Options": 40,
        "Correct Answer": 20,
        "Explanation": 50,
        "Schema": 15,
        "Question Purpose": 30,
        "Difficulty": 12,
        "Tags": 25,
    }
    for col_idx, header in enumerate(REQUIRED_COLUMNS, 1):
        from openpyxl.utils import get_column_letter
        ws.column_dimensions[get_column_letter(col_idx)].width = col_widths.get(header, 20)

    ws.freeze_panes = "A2"

    info_ws = wb.create_sheet(title="Instructions")
    info_ws["A1"] = "EXAM CONTENT REVIEWER — Input Template"
    info_ws["A1"].font = Font(bold=True, size=14)
    info_ws["A3"] = "Question Types accepted:"
    info_ws["A3"].font = Font(bold=True)
    types = [
        "MCQ", "Fill in the Blanks", "Speaking Based", "Textual",
        "Audio Based MCQ", "Prompt Based",
        "Image Based with Options", "Image Based with Audio",
    ]
    for i, t in enumerate(types, 4):
        info_ws.cell(row=i, column=1, value=f"  • {t}")
    info_ws["A13"] = "Difficulty values: Easy / Medium / Hard"
    info_ws["A14"] = "Options format: A) option1 | B) option2 | C) option3 | D) option4"
    info_ws.column_dimensions["A"].width = 60

    os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
    wb.save(output_path)
