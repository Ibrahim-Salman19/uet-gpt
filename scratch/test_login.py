import os
import time
from playwright.sync_api import sync_playwright

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        print("Visiting /chat...")
        page.goto("http://localhost:3000/chat")
        time.sleep(3)
        print("URL after visiting /chat:", page.url)
        page.screenshot(path="C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7/test_chat_unauth.png")
        
        print("Visiting /sign-in...")
        page.goto("http://localhost:3000/sign-in")
        time.sleep(3)
        print("URL after visiting /sign-in:", page.url)
        page.screenshot(path="C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7/test_signin_unauth.png")
        
        browser.close()

if __name__ == "__main__":
    test()
