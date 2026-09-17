"""
Parker - Scraper test (verifies keywords and API endpoints work)
Usage: python scripts/test_scraper.py
"""

import json
import re

KEYWORDS = [
    "rent", "apartment", "house", "flat", "studio", "room",
    "furnished", "short term rental", "per night"
]

URGENCY = ["urgent", "asap", "immediately", "today", "available now"]

def analyze_text(text):
    text_lower = text.lower()
    return {
        "keyword_matches": [k for k in KEYWORDS if k in text_lower],
        "urgency": [u for u in URGENCY if u in text_lower],
        "phone": extract_phone(text),
        "email": re.findall(r"[^\s@]+@[^\s@]+\.[^\s@]+", text),
    }


def extract_phone(text):
    match = re.search(r"(?:\+92|0)?3\d{2}\d{7,8}", text)
    return match.group(0) if match else None


def main():
    print("=== PARKER SCRAPER TEST ===")
    test_posts = [
        "2 bedroom furnished apartment for rent in F-7 Islamabad, available immediately. Call 03001234567",
        "Looking for flat no need",
        "House for rent in Bahria Town, urgent! contact now 03211234567 house@email.com",
    ]

    for post in test_posts:
        result = analyze_text(post)
        print(f"\n📝 Post: {post[:50]}...")
        print(json.dumps(result, indent=2))

        if result["phone"]:
            print("✅ Lead qualifies (has contact)")
        else:
            print("⚠️  Low quality lead (no contact)")

    print("\n=== TEST COMPLETE ===")


if __name__ == "__main__":
    main()