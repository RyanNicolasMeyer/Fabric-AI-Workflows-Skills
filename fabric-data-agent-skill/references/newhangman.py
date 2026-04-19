"""Standalone Hangman game.

This file intentionally includes "missing" pieces that are often imported from
elsewhere in partial codebases (for example, a common_words list).
"""

from __future__ import annotations

import random
import string
from dataclasses import dataclass, field


HANGMAN_PICS = [
    r"""
  +---+
  |   |
      |
      |
      |
      |
=========
""",
    r"""
  +---+
  |   |
  O   |
      |
      |
      |
=========
""",
    r"""
  +---+
  |   |
  O   |
  |   |
      |
      |
=========
""",
    r"""
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========
""",
    r"""
  +---+
  |   |
  O   |
 /|\  |
      |
      |
=========
""",
    r"""
  +---+
  |   |
  O   |
 /|\  |
 /    |
      |
=========
""",
    r"""
  +---+
  |   |
  O   |
 /|\  |
 / \  |
      |
=========
""",
]


# Inferred "hidden" dependency replacement:
# A practical default list of common words used for random Hangman selection.
common_words = [
    "about", "above", "actor", "adapt", "after", "again", "agent", "agree",
    "album", "alert", "alive", "allow", "alone", "along", "alter", "angel",
    "apple", "apply", "arena", "argue", "arise", "array", "audio", "award",
    "basic", "beach", "begin", "below", "bench", "birth", "black", "blame",
    "blend", "block", "board", "brain", "brand", "bread", "break", "bring",
    "broad", "brown", "build", "cable", "carry", "cause", "chain", "chair",
    "chart", "check", "chess", "chief", "child", "choice", "class", "clean",
    "clear", "click", "clock", "close", "coach", "coast", "color", "count",
    "court", "cover", "craft", "crash", "cream", "cross", "crowd", "daily",
    "dance", "death", "debug", "delay", "depth", "dirty", "doubt", "draft",
    "dream", "drink", "drive", "earth", "eight", "elect", "elite", "empty",
    "enemy", "enjoy", "enter", "equal", "error", "event", "every", "exact",
    "faith", "false", "fault", "field", "fifth", "final", "first", "flame",
    "floor", "focus", "force", "frame", "fresh", "front", "fruit", "giant",
    "given", "glass", "globe", "grace", "grade", "grand", "grant", "graph",
    "great", "green", "group", "guard", "guest", "guide", "habit", "happy",
    "heart", "heavy", "honey", "horse", "house", "human", "ideal", "image",
    "index", "inner", "input", "issue", "joint", "judge", "known", "label",
    "large", "laser", "later", "laugh", "layer", "learn", "least", "leave",
    "legal", "level", "light", "limit", "local", "logic", "loose", "lucky",
    "lunch", "magic", "major", "maker", "march", "match", "maybe", "media",
    "metal", "might", "minor", "model", "money", "month", "moral", "motor",
    "mount", "mouse", "movie", "music", "naked", "never", "night", "noise",
    "north", "novel", "nurse", "occur", "ocean", "offer", "often", "order",
    "other", "owner", "paint", "panel", "paper", "party", "peace", "phase",
    "phone", "photo", "piece", "pilot", "pitch", "place", "plain", "plane",
    "plant", "plate", "point", "power", "press", "price", "prime", "print",
    "prior", "prize", "proof", "proud", "queen", "quick", "quiet", "radio",
    "raise", "range", "rapid", "ratio", "reach", "react", "ready", "refer",
    "right", "rival", "river", "robot", "rough", "round", "route", "royal",
    "rural", "scale", "scene", "scope", "score", "sense", "serve", "seven",
    "shade", "shake", "shape", "share", "sharp", "sheet", "shelf", "shift",
    "shine", "shirt", "shock", "short", "shown", "sight", "since", "skill",
    "sleep", "small", "smart", "smile", "solid", "solve", "sound", "south",
    "space", "spare", "speak", "speed", "spend", "spice", "split", "sport",
    "staff", "stage", "stand", "start", "state", "steam", "steel", "stick",
    "still", "stock", "stone", "store", "storm", "story", "strip", "study",
    "style", "sugar", "super", "sweet", "table", "taste", "teach", "thank",
    "their", "theme", "there", "thick", "thing", "think", "third", "those",
    "throw", "tight", "title", "today", "topic", "total", "touch", "tower",
    "track", "trade", "train", "trend", "trial", "trick", "truck", "truly",
    "trust", "truth", "under", "union", "unity", "until", "upper", "upset",
    "urban", "usage", "usual", "value", "video", "visit", "vital", "voice",
    "waste", "watch", "water", "wheel", "where", "which", "while", "white",
    "whole", "whose", "woman", "world", "worry", "write", "wrong", "youth",
]


def choose_word(words: list[str]) -> str:
    """Pick a random word with simple sanity checks."""
    candidates = [w.strip().lower() for w in words if w and w.isalpha()]
    if not candidates:
        raise ValueError("No usable words were found in common_words.")
    return random.choice(candidates)


@dataclass
class HangmanGame:
    secret_word: str
    max_wrong_guesses: int = field(default=len(HANGMAN_PICS) - 1)
    guessed_letters: set[str] = field(default_factory=set)
    wrong_letters: set[str] = field(default_factory=set)

    def display_word(self) -> str:
        return " ".join(
            letter if letter in self.guessed_letters else "_"
            for letter in self.secret_word
        )

    def all_letters_found(self) -> bool:
        return all(letter in self.guessed_letters for letter in set(self.secret_word))

    @property
    def wrong_guess_count(self) -> int:
        return len(self.wrong_letters)

    @property
    def is_lost(self) -> bool:
        return self.wrong_guess_count >= self.max_wrong_guesses

    @property
    def is_won(self) -> bool:
        return self.all_letters_found()

    def guess_letter(self, letter: str) -> tuple[bool, str]:
        if len(letter) != 1 or letter not in string.ascii_lowercase:
            return False, "Please enter a single letter (a-z)."
        if letter in self.guessed_letters or letter in self.wrong_letters:
            return False, f"You already guessed '{letter}'."

        if letter in self.secret_word:
            self.guessed_letters.add(letter)
            return True, f"Nice! '{letter}' is in the word."
        self.wrong_letters.add(letter)
        return True, f"Sorry, '{letter}' is not in the word."

    def guess_word(self, guess: str) -> tuple[bool, str]:
        if not guess.isalpha():
            return False, "Word guesses should contain only letters."
        guess = guess.lower()
        if guess == self.secret_word:
            self.guessed_letters.update(set(self.secret_word))
            return True, "Excellent! You guessed the whole word."
        self.wrong_letters.add(f"[{guess}]")
        return True, f"'{guess}' is not the secret word."

    def render(self) -> str:
        stage = min(self.wrong_guess_count, len(HANGMAN_PICS) - 1)
        wrong_letter_only = sorted(ch for ch in self.wrong_letters if len(ch) == 1)
        wrong_word_guesses = sorted(ch for ch in self.wrong_letters if len(ch) > 1)
        wrong_display = ", ".join(wrong_letter_only + wrong_word_guesses) or "None"
        return (
            f"{HANGMAN_PICS[stage]}\n"
            f"Word: {self.display_word()}\n"
            f"Wrong guesses ({self.wrong_guess_count}/{self.max_wrong_guesses}): {wrong_display}\n"
        )


def get_player_guess() -> str:
    raw = input("Guess a letter (or entire word): ").strip().lower()
    return raw


def play_round(word_list: list[str]) -> None:
    game = HangmanGame(secret_word=choose_word(word_list))
    print("\nWelcome to Hangman!\n")

    while not game.is_won and not game.is_lost:
        print(game.render())
        guess = get_player_guess()
        if not guess:
            print("Please type a letter or word.\n")
            continue
        if len(guess) == 1:
            _, message = game.guess_letter(guess)
            print(f"{message}\n")
        else:
            _, message = game.guess_word(guess)
            print(f"{message}\n")

    print(game.render())
    if game.is_won:
        print(f"You won. The word was '{game.secret_word}'.\n")
    else:
        print(f"You lost. The word was '{game.secret_word}'.\n")


def should_play_again() -> bool:
    while True:
        answer = input("Play again? (y/n): ").strip().lower()
        if answer in {"y", "yes"}:
            return True
        if answer in {"n", "no"}:
            return False
        print("Please answer with 'y' or 'n'.")


def main() -> None:
    while True:
        play_round(common_words)
        if not should_play_again():
            print("Thanks for playing.")
            break


if __name__ == "__main__":
    main()
