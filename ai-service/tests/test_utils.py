"""Pure-Python tests (standard library only): python -m unittest discover -s tests"""
import unittest

from app.utils.json_utils import extract_json
from app.utils.rules import run_rules, worst
from app.utils.text import clean_line, clean_text, dedupe


class JsonTests(unittest.TestCase):
    def test_plain(self):
        self.assertEqual(extract_json('{"a": 1}'), {"a": 1})

    def test_code_fence(self):
        self.assertEqual(extract_json('```json\n{"captions": ["x"]}\n```'), {"captions": ["x"]})

    def test_text_around(self):
        self.assertEqual(extract_json('Sure! Here you go: {"replies": ["a", "b"]} Hope that helps'), {"replies": ["a", "b"]})

    def test_bare_array(self):
        self.assertEqual(extract_json('Options: ["one", "two"]'), ["one", "two"])

    def test_garbage(self):
        with self.assertRaises(ValueError):
            extract_json("no json here")


class TextTests(unittest.TestCase):
    def test_clean_text_strips_control_chars(self):
        self.assertEqual(clean_text("hi\x00 there\x07", 50), "hi there")

    def test_clean_line_collapses(self):
        self.assertEqual(clean_line("a \n  b\t c", 50), "a b c")

    def test_limit(self):
        self.assertEqual(len(clean_text("x" * 100, 10)), 10)

    def test_dedupe_case_insensitive(self):
        self.assertEqual(dedupe(["Hi", "hi", "Yo"]), ["Hi", "Yo"])


class RuleTests(unittest.TestCase):
    def test_clean_text_not_flagged(self):
        self.assertEqual(run_rules("Great day at the beach with friends!"), [])

    def test_threat(self):
        flags = run_rules("I'm going to kill you")
        self.assertEqual(worst(flags), "high")
        self.assertIn("violence", [f.category for f in flags])

    def test_self_harm(self):
        self.assertIn("self_harm", [f.category for f in run_rules("sometimes I want to die")])

    def test_spam_links(self):
        self.assertIn("spam", [f.category for f in run_rules("http://a.co http://b.co http://c.co")])

    def test_personal_info(self):
        self.assertIn("personal_info", [f.category for f in run_rules("call me on +91 98765 43210")])
        self.assertIn("personal_info", [f.category for f in run_rules("mail me at someone@example.com")])

    def test_repeated_chars(self):
        self.assertIn("spam", [f.category for f in run_rules("a" + "!" * 20)])


if __name__ == "__main__":
    unittest.main()
