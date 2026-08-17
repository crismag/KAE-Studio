"""Local file decode — Studio turns allowed uploads into text Memory can ingest.

Memory's document route is text only. Types we cannot read are refused, and a
scanned PDF that yields almost nothing is a warning rather than a silent empty
success. This is not analysis.
"""

from __future__ import annotations

import importlib.util
from io import BytesIO
from typing import Any

import pytest

from kae_studio.acquisition.decode import MAX_BYTES, MAX_EXCEL_ROWS, DecodeError, decode


def _pdf(text: str) -> bytes:
    import pymupdf

    document = pymupdf.open()
    page = document.new_page()
    if text:
        page.insert_textbox(page.rect, text)
    data = document.tobytes()
    document.close()
    return data


def _docx(text: str) -> bytes:
    from docx import Document

    document = Document()
    document.add_paragraph(text)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def _xlsx(rows: list[list[object]], sheets: int = 1) -> bytes:
    from openpyxl import Workbook

    workbook = Workbook()
    first = workbook.active
    assert first is not None
    first.title = "Sheet1"
    for row in rows:
        first.append(row)
    for index in range(2, sheets + 1):
        sheet = workbook.create_sheet(f"Sheet{index}")
        sheet.append(["extra", index])
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


class TestPlainText:
    def test_utf8_passes_through(self) -> None:
        decoded = decode("Invoices go out weekly.".encode(), "brief.txt", "text/plain")
        assert decoded.text == "Invoices go out weekly."
        assert decoded.format == "text"
        assert decoded.suggested_title == "brief"
        assert decoded.warnings == []

    def test_markdown_is_text(self) -> None:
        decoded = decode(b"# Scope\n\nMust invoice weekly.", "notes.md", "")
        assert "Must invoice weekly." in decoded.text
        assert decoded.format == "text"

    def test_csv_becomes_a_table(self) -> None:
        decoded = decode(b"name,amount\nAlpha,12\n", "rates.csv", "text/csv")
        assert decoded.format == "csv"
        assert "name | amount" in decoded.text
        assert "Alpha | 12" in decoded.text


class TestPdf:
    def test_extracts_digital_text(self) -> None:
        decoded = decode(
            _pdf("The ministry invoices every week, without exception."),
            "brief.pdf",
            "application/pdf",
        )
        assert "invoices every week" in decoded.text
        assert decoded.format == "pdf"
        assert decoded.warnings == []

    def test_a_blank_scan_is_refused_not_emptied(self) -> None:
        with pytest.raises(DecodeError, match="no readable text"):
            decode(_pdf(""), "scan.pdf", "application/pdf")

    def test_almost_no_text_warns_rather_than_pretending(self) -> None:
        decoded = decode(_pdf("Hi."), "scan.pdf", "application/pdf")
        assert decoded.text == "Hi."
        assert decoded.warnings
        assert "scan" in decoded.warnings[0].lower() or "OCR" in decoded.warnings[0]


class TestWord:
    def test_extracts_paragraphs(self) -> None:
        decoded = decode(_docx("Stakeholders sign off on the weekly invoice."), "spec.docx", "")
        assert "weekly invoice" in decoded.text
        assert decoded.format == "docx"

    def test_legacy_doc_is_refused(self) -> None:
        with pytest.raises(DecodeError, match=r"\.doc"):
            decode(b"anything", "legacy.doc", "application/msword")


class TestExcel:
    def test_sheets_become_tables(self) -> None:
        decoded = decode(_xlsx([["role", "count"], ["approver", 3]]), "staff.xlsx", "")
        assert decoded.format == "xlsx"
        assert "## Sheet1" in decoded.text
        assert "role | count" in decoded.text
        assert "approver | 3" in decoded.text

    def test_row_cap_is_a_warning(self) -> None:
        rows = [["n"]] + [[i] for i in range(MAX_EXCEL_ROWS + 5)]
        decoded = decode(_xlsx(rows), "big.xlsx", "")
        assert any("200" in warning for warning in decoded.warnings)
        assert str(MAX_EXCEL_ROWS + 4) not in decoded.text


class TestRefusals:
    def test_unsupported_types_are_refused(self) -> None:
        with pytest.raises(DecodeError, match="cannot read this file type"):
            decode(b"\x89PNG", "logo.png", "image/png")

    def test_empty_is_refused(self) -> None:
        with pytest.raises(DecodeError, match="empty"):
            decode(b"", "blank.txt", "text/plain")

    def test_oversize_is_refused(self) -> None:
        with pytest.raises(DecodeError, match="10 MB"):
            decode(b"x" * (MAX_BYTES + 1), "huge.txt", "text/plain")

    def test_octet_stream_still_follows_the_extension(self) -> None:
        decoded = decode("notes".encode(), "brief.txt", "application/octet-stream")
        assert decoded.text == "notes"


@pytest.mark.skipif(
    importlib.util.find_spec("cie_slim") is None,
    reason="cris-cie-slim is a private sibling repository",
)
class TestTheDecodeRoute:
    """Multipart in, preview out. Nothing is written to Memory.

    The skip is a decorator and not an `importorskip` in the class body, which
    is what this was. `importorskip` raises, and a raise in a class body leaves
    the module import — so the four route tests took the thirteen decode tests
    above them out of CI's reach too, and the runner reported one skip for the
    file (`D-233`).
    """

    def test_returns_text_and_does_not_ingest(self) -> None:
        from fastapi.testclient import TestClient

        from kae_studio.api import create_app
        from kae_studio.config import Settings

        app = create_app(
            Settings.from_environment(
                {
                    "KAE_MEMORY_TOKEN": "token",
                    "STUDIO_SESSION_SECRET": "x" * 40,
                    "STUDIO_NO_AUTH": "1",
                }
            )
        )
        with TestClient(app) as client:
            response = client.post(
                "/api/decode",
                files={"file": ("brief.txt", b"Invoices go out weekly.", "text/plain")},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["text"] == "Invoices go out weekly."
        assert body["suggested_title"] == "brief"
        assert body["format"] == "text"

    def test_unsupported_is_415(self) -> None:
        from fastapi.testclient import TestClient

        from kae_studio.api import create_app
        from kae_studio.config import Settings

        app = create_app(
            Settings.from_environment(
                {
                    "KAE_MEMORY_TOKEN": "token",
                    "STUDIO_SESSION_SECRET": "x" * 40,
                    "STUDIO_NO_AUTH": "1",
                }
            )
        )
        with TestClient(app) as client:
            response = client.post(
                "/api/decode",
                files={"file": ("logo.png", b"\x89PNG", "image/png")},
            )

        assert response.status_code == 415
        assert "cannot read this file type" in response.json()["detail"]

    def test_upload_origin_registers_as_upload(self) -> None:
        from fastapi.testclient import TestClient

        from kae_studio.api import create_app
        from kae_studio.config import Settings

        class RecordingMemory:
            def __init__(self) -> None:
                self.registered: list[dict[str, Any]] = []

            async def ingest_document(self, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
                return {"document": "Brief", "chunks": [], "truncated_chunks": 0, "warnings": []}

            async def register_source(self, _project_id: str, body: dict[str, Any]) -> dict[str, Any]:
                self.registered.append(body)
                return {}

            async def aclose(self) -> None:
                return None

        app = create_app(
            Settings.from_environment(
                {
                    "KAE_MEMORY_TOKEN": "token",
                    "STUDIO_SESSION_SECRET": "x" * 40,
                    "STUDIO_NO_AUTH": "1",
                }
            )
        )
        memory = RecordingMemory()
        with TestClient(app) as client:
            client.app.state.memory = memory
            response = client.post(
                "/api/projects/p1/documents",
                json={"title": "Brief", "text": "Invoices go out weekly.", "origin": "upload"},
            )

        assert response.status_code == 200
        assert memory.registered[0]["kind"] == "upload"
