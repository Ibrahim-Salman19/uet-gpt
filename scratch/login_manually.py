import os
import time
from playwright.sync_api import sync_playwright

def login():
    state_path = "playwright/.clerk/state.json"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        # Log console messages and errors
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))
        
        print("Visiting /chat first...")
        page.goto("http://localhost:3000/chat")
        time.sleep(5)
        
        print("Visiting /sign-in...")
        page.goto("http://localhost:3000/sign-in")
        time.sleep(8) # Wait 8 seconds to ensure rendering is complete
        
        # Let's inspect the DOM inputs
        inputs = page.query_selector_all("input")
        print(f"Found {len(inputs)} inputs on the page:")
        for idx, inp in enumerate(inputs):
            try:
                print(f"  [{idx}] type={inp.get_attribute('type')}, name={inp.get_attribute('name')}, id={inp.get_attribute('id')}, class={inp.get_attribute('class')}")
            except Exception as e:
                print(f"  [{idx}] error: {e}")
                
        # Take a screenshot to verify it rendered
        page.screenshot(path="C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7/login_step0.png")
        
        # Let's look for name="identifier"
        email_input = page.locator("input[name='identifier'], input[type='email']")
        if email_input.count() > 0:
            print("Email input found! Filling in email...")
            email_input.first.fill("ibrahim.pk848@gmail.com")
            page.screenshot(path="C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7/login_step1.png")
            
            print("Clicking Continue...")
            button = page.locator("button:has-text('Continue'), button[type='submit']")
            button.first.click()
            
            time.sleep(5)
            page.screenshot(path="C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7/login_step2.png")
            
            # Print inputs on the OTP screen
            inputs_otp = page.query_selector_all("input")
            print(f"Found {len(inputs_otp)} inputs on the OTP page:")
            for idx, inp in enumerate(inputs_otp):
                try:
                    print(f"  [{idx}] type={inp.get_attribute('type')}, name={inp.get_attribute('name')}, class={inp.get_attribute('class')}")
                except Exception as e:
                    pass
            
            # Look for OTP inputs (digit fields or code field)
            inputs_fields = page.locator("input[data-index]")
            if inputs_fields.count() > 0:
                print("Entering code digit-by-digit...")
                for i in range(inputs_fields.count()):
                    inputs_fields.nth(i).fill("424242"[i])
            else:
                otp_input = page.locator("input[name*='code'], input[autocomplete='one-time-code']")
                if otp_input.count() > 0:
                    print("Entering code in single input...")
                    otp_input.first.fill("424242")
                else:
                    print("Could not find OTP input.")
                    
            time.sleep(8)
            page.screenshot(path="C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7/login_step3.png")
        else:
            print("Email input not found.")
            
        print("Final URL:", page.url)
        page.goto("http://localhost:3000/chat")
        time.sleep(5)
        print("URL after /chat check:", page.url)
        page.screenshot(path="C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7/login_step4.png")
        
        if "sign-in" not in page.url and "/chat" in page.url:
            print("Successfully signed in!")
            context.storage_state(path=state_path)
            print(f"Saved auth state to {state_path}")
        else:
            print("Sign in failed.")
            
        browser.close()

if __name__ == "__main__":
    login()
