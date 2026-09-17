"""
Parker - Facebook Group Scraper (Selenium)
Optional supplement to the Node.js scraper for groups that block API access.
Usage: python scripts/facebook_scraper.py
Env:  FACEBOOK_EMAIL, FACEBOOK_PASSWORD
"""

import time
import json
import os
import re

from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

load_dotenv()

BASE_URL = "https://www.facebook.com"
GROUPS = [
    "islamabad-real-estate",
    "islamabad-properties-for-rent",
]

KEYWORDS = [
    "rent", "apartment", "flat", "furnished",
    "bedroom", "short term", "available"
]

PHONE_RE = re.compile(r"(?:\+92|0)?3\d{2}\d{7,8}")


def setup_driver():
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option(
        "excludeSwitches", ["enable-automation"]
    )
    return webdriver.Chrome(options=options)


def login(driver):
    email = os.getenv("FACEBOOK_EMAIL")
    password = os.getenv("FACEBOOK_PASSWORD")
    if not email or not password:
        print("⚠️  FACEBOOK_EMAIL/FACEBOOK_PASSWORD not set - skipping login")
        return False

    driver.get(f"{BASE_URL}/login")
    time.sleep(3)

    driver.find_element(By.ID, "email").send_keys(email)
    driver.find_element(By.ID, "pass").send_keys(password)
    driver.find_element(By.NAME, "login").click()
    time.sleep(5)
    print("✅ Logged in")
    return True


def scrape_group(driver, group_name):
    url = f"{BASE_URL}/groups/{group_name}/posts/"
    driver.get(url)
    time.sleep(5)

    posts = []
    for _ in range(3):
        body = driver.find_elements(By.XPATH, "//div[@data-ad-preview='message']")
        for element in body:
            text = element.text.strip()
            if not text or not any(k in text.lower() for k in KEYWORDS):
                continue

            phone = PHONE_RE.search(text)
            posts.append({
                "title": text[:100],
                "content": text,
                "platform": "facebook",
                "phone": phone.group(0) if phone else None,
                "sourceUrl": None
            })
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(3)

    return posts


def main():
    driver = setup_driver()
    try:
        login(driver)
        all_posts = []
        for group in GROUPS:
            print(f"Scraping group: {group}")
            all_posts.extend(scrape_group(driver, group))

        out_path = "logs/facebook_scraped.json"
        os.makedirs("logs", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(all_posts, f, ensure_ascii=False, indent=2)

        print(f"✅ Scraped {len(all_posts)} posts -> {out_path}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()