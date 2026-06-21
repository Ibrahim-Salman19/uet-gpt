import os
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = "C:/Users/hafiz/.gemini/antigravity/brain/c00e70d0-efbf-4e8c-928a-24993418ddf7"

viewports = {
    "mobile": {"width": 375, "height": 667, "is_mobile": True},
    "tablet": {"width": 768, "height": 1024, "is_mobile": False},
    "desktop": {"width": 1440, "height": 900, "is_mobile": False}
}

def capture():
    # Calculate path to Clerk state JSON relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    clerk_state_path = os.path.join(project_dir, "playwright", ".clerk", "state.json")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        for name, vp in viewports.items():
            print(f"Capturing {name} viewport...")
            
            context_args = {
                "viewport": {"width": vp["width"], "height": vp["height"]},
                "is_mobile": vp["is_mobile"]
            }
            if os.path.exists(clerk_state_path):
                context_args["storage_state"] = clerk_state_path
                print(f"Loading Clerk auth state from {clerk_state_path}")
            else:
                print(f"Warning: Clerk auth state not found at {clerk_state_path}")
                
            context = browser.new_context(**context_args)
            page = context.new_page()
            
            # Go to chat page
            page.goto("http://127.0.0.1:3000/chat")
            
            # Wait for Clerk redirect chain and chat input to load
            print("Waiting for chat page to render...")
            try:
                page.wait_for_selector("#chat-input-field", timeout=15000)
            except Exception as e:
                print(f"Warning: Timed out waiting for chat-input-field on {name} viewport. Capturing anyway. Error: {e}")
            
            # Capture screenshot
            path = os.path.join(ARTIFACT_DIR, f"viewport_{name}.png")
            page.screenshot(path=path)
            print(f"Saved to {path}")
            
            context.close()
            
        browser.close()

if __name__ == "__main__":
    capture()
