"""Unit tests for Pen Neer scoring + validity (§3 rules)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import game  # noqa: E402
from app.models import PT_FULL, PT_HALF, Answer, Round  # noqa: E402


def make_round(letter, answers_by_player):
    rnd = Round(letter=letter)
    for pid, cats in answers_by_player.items():
        rnd.answers[pid] = {
            cat: Answer(text=text, valid=game.auto_validate(text, letter))
            for cat, text in cats.items()
        }
    return rnd


def test_normalize_strips_diacritics_and_case():
    assert game.normalize("Curaçao") == game.normalize("curacao")
    assert game.normalize("  Égypte ") == "egypte"
    assert game.normalize("Aap!") == "aap"


def test_starts_with_basic_and_diacritics():
    assert game.starts_with("Appel", "A")
    assert game.starts_with("appel", "a")
    assert game.starts_with("Égypte", "E")
    assert not game.starts_with("Banaan", "A")
    assert not game.starts_with("", "A")


def test_starts_with_ij_y_leniency():
    assert game.starts_with("IJsland", "I")
    assert game.starts_with("IJsbeer", "Y")  # lenient: IJ accepted for Y
    assert game.starts_with("Yoghurt", "I")  # lenient: Y accepted for I


def test_unique_scores_full():
    rnd = make_round("A", {
        "p1": {"Dier": "Aap"},
        "p2": {"Dier": "Antiloop"},
    })
    pts = game.score_round(rnd, ["p1", "p2"], ["Dier"])
    assert pts["p1"]["Dier"] == PT_FULL
    assert pts["p2"]["Dier"] == PT_FULL


def test_shared_scores_half():
    rnd = make_round("A", {
        "p1": {"Dier": "Aap"},
        "p2": {"Dier": "aap"},  # same after normalize
        "p3": {"Dier": "Aap"},
    })
    pts = game.score_round(rnd, ["p1", "p2", "p3"], ["Dier"])
    assert pts["p1"]["Dier"] == PT_HALF
    assert pts["p2"]["Dier"] == PT_HALF
    assert pts["p3"]["Dier"] == PT_HALF


def test_wrong_letter_and_empty_score_zero():
    rnd = make_round("A", {
        "p1": {"Dier": "Beer"},   # wrong letter
        "p2": {"Dier": ""},        # empty
    })
    pts = game.score_round(rnd, ["p1", "p2"], ["Dier"])
    assert pts["p1"]["Dier"] == 0
    assert pts["p2"]["Dier"] == 0


def test_challenge_flips_validity_and_promotes_other_to_unique():
    # Two players share "Aap": both half. Challenge one -> the other becomes unique.
    rnd = make_round("A", {
        "p1": {"Dier": "Aap"},
        "p2": {"Dier": "Aap"},
    })
    pts = game.score_round(rnd, ["p1", "p2"], ["Dier"])
    assert pts["p1"]["Dier"] == PT_HALF and pts["p2"]["Dier"] == PT_HALF

    rnd.answers["p2"]["Dier"].valid = False  # challenge succeeds
    pts = game.score_round(rnd, ["p1", "p2"], ["Dier"])
    assert pts["p1"]["Dier"] == PT_FULL  # now unique
    assert pts["p2"]["Dier"] == 0


def test_total_scores_sums_rounds():
    r1 = make_round("A", {"p1": {"Dier": "Aap"}, "p2": {"Dier": "Antiloop"}})
    r1.points = game.score_round(r1, ["p1", "p2"], ["Dier"])
    r2 = make_round("B", {"p1": {"Dier": "Beer"}, "p2": {"Dier": "Beer"}})
    r2.points = game.score_round(r2, ["p1", "p2"], ["Dier"])
    totals = game.total_scores([r1, r2], ["p1", "p2"])
    assert totals["p1"] == PT_FULL + PT_HALF
    assert totals["p2"] == PT_FULL + PT_HALF


def test_pick_letter_excludes_used_and_pool():
    used = list("ABCDEFGHIJKLMNOPRSTUVWZ")[:-1]  # all but Z used
    assert game.pick_letter(used) == "Z"
    # Q, X, Y never appear
    for _ in range(200):
        assert game.pick_letter([]) not in ("Q", "X", "Y")
