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


# ---- soepele spelling (lenient) ---------------------------------------------


def test_lenient_near_miss_stays_question_mark_for_the_ai():
    # 'Miloen' is one letter off 'Meloen'. It counts (valid) but is NOT
    # green-checked by fuzzy matching alone: the AI referee decides. Only the
    # canon (dubbel pairing) comes from the fuzzy match.
    assert game.classify("Miloen", "M", "Vrucht") == (True, False)
    assert game.list_canonical("Miloen", "Vrucht", lenient=True) == "meloen"
    assert game.list_canonical("Miloen", "Vrucht", lenient=False) is None


def test_fuzzy_never_green_checks_real_words_in_wrong_category():
    # Audit regression: 'bier' is 1 edit from 'beer' but is NOT an animal.
    # It must stay an orange "?" so the AI (or the group) can reject it.
    assert game.classify("bier", "B", "Dier") == (True, False)
    assert game.classify("kerk", "K", "Vrucht") == (True, False)


def test_lenient_never_fixes_the_first_letter_or_wrong_letter():
    # The round letter stays the game: wrong first letter never counts.
    assert game.classify("Meloen", "B", "Vrucht") == (False, False)
    # And fuzzy matching never crosses first letters ('gebra' vs 'zebra').
    assert game.list_canonical("gebra", "Dier", lenient=True) is None


def test_lenient_short_words_stay_exact():
    # Budget 0 under 4 letters: 'kot' must not morph into 'kat'.
    assert game.list_canonical("kot", "Dier", lenient=True) is None


def test_lenient_canonical_makes_misspelling_dubbel():
    raw = {"p1": {"Vrucht": "Meloen"}, "p2": {"Vrucht": "Miloen"}}
    rnd = Round(letter="M")
    rnd.answers = game.build_answers(raw, "M", ["p1", "p2"], ["Vrucht"], lenient=True)
    pts = game.score_round(rnd, ["p1", "p2"], ["Vrucht"])
    assert pts["p1"]["Vrucht"] == PT_HALF
    assert pts["p2"]["Vrucht"] == PT_HALF


def test_strict_mode_unchanged_by_canon():
    # Same input without lenient: 'Miloen' is its own key, both unique.
    raw = {"p1": {"Vrucht": "Meloen"}, "p2": {"Vrucht": "Miloen"}}
    rnd = Round(letter="M")
    rnd.answers = game.build_answers(raw, "M", ["p1", "p2"], ["Vrucht"])
    pts = game.score_round(rnd, ["p1", "p2"], ["Vrucht"])
    assert pts["p1"]["Vrucht"] == PT_FULL
    assert pts["p2"]["Vrucht"] == PT_FULL


def test_edit_distance_capped():
    assert game._edit_distance_capped("miloen", "meloen", 1) == 1
    assert game._edit_distance_capped("banaaan", "banaan", 2) == 1
    assert game._edit_distance_capped("aap", "aap", 0) == 0
    assert game._edit_distance_capped("kort", "veellanger", 2) == 3  # capped out
