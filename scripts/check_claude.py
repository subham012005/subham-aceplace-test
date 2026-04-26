import anthropic
import os

# Paste your API key here to test
# OR it will use the one from your environment variables
api_key = "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"

# Clean the key in case of copy-paste artifacts
api_key = api_key.replace("YOUR_CLAUDE_API_KEY_HERE", "").strip()

client = anthropic.Anthropic(api_key=api_key)

models_to_test = [
    "claude-3-7-sonnet-latest",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-haiku-20240307",
    "claude-2.1",
    "claude-instant-1.2"
]

print(f"--- Claude API Diagnostic Tool ---")
print(f"Testing {len(models_to_test)} models with key: {api_key[:10]}...{api_key[-5:]}\n")

for model in models_to_test:
    print(f"Testing {model}...", end=" ", flush=True)
    try:
        message = client.messages.create(
            model=model,
            max_tokens=10,
            messages=[
                {"role": "user", "content": "Hello, hi!"}
            ]
        )
        print(f"[SUCCESS]")
        print(f"   Response: {message.content[0].text}")
    except anthropic.NotFoundError:
        print(f"[FAILED] (404: Not Found - Your account might not have access)")
    except anthropic.AuthenticationError:
        print(f"[FAILED] (401: Invalid API Key - Check for extra characters)")
    except Exception as e:
        print(f"[FAILED] ({type(e).__name__}: {str(e)})")
    print("-" * 30)

print("\nDiagnostic Complete.")
