"""The sentence behind a question reaches the projection, or it is lost here.

`D-246` carried a question's reason across five hops inside KAE-Memory and
served it on `QuestionCandidateResponse.reason`. `D-248` is the sixth hop: for
one day `_questions` read six fields off each candidate and not that one, so a
caller got `severity: critical` and no statement of what was critical — the
same defect `D-246` had just fixed, one boundary later.

Written against `_questions` rather than through the app, because the app-level
test modules need dependencies CI installs and a local run may not, and a test
that cannot be run is not a guard.
"""

from kae_studio.projection import _questions

# KAE-Memory's wording for a finding that offered no summary
# (`clarification_service.REASON_UNSTATED`). Written out because Studio's CI has
# no KAE-Memory checkout and cannot import the constant.
REASON_UNSTATED = "The finding behind this question gave no reason."


def _candidate(**overrides: object) -> dict[str, object]:
    candidate = {
        "candidate_key": "question:partial_area:authorization:-",
        "question": "Which role holds approval authority?",
        "severity": "critical",
        "area_key": "authorization",
        "disposition": "open",
        "reason": "Authorization has no confirmed knowledge.",
    }
    candidate.update(overrides)
    return candidate


def test_the_reason_reaches_the_projection() -> None:
    [question] = _questions({"candidates": [_candidate()]})

    assert question["reason"] == "Authorization has no confirmed knowledge."


def test_the_grade_still_arrives_beside_it() -> None:
    # The control. Severity was never dropped, so a failure here means the
    # fixture stopped reaching `_questions` at all rather than that the reason
    # regressed — which is the difference between a broken test and a real one.
    [question] = _questions({"candidates": [_candidate()]})

    assert question["severity"] == "critical"


def test_the_stated_absence_is_carried_rather_than_reworded() -> None:
    # KAE-Memory owns the sentence for a finding with no reason and sends it on
    # the wire. Studio prints what it was given; a second phrasing invented here
    # is one concept in two words across a boundary (`D-125`).
    [question] = _questions({"candidates": [_candidate(reason=REASON_UNSTATED)]})

    assert question["reason"] == REASON_UNSTATED


def test_a_kae_memory_without_the_field_yields_no_invented_sentence() -> None:
    # A deployment older than `D-246` sends no `reason` at all. That is not a
    # stated absence and must not be rendered as one — the surface shows the
    # row exactly as it showed it before the field existed.
    candidate = _candidate()
    del candidate["reason"]

    [question] = _questions({"candidates": [candidate]})

    assert question["reason"] == ""
    assert question["reason"] != REASON_UNSTATED
