#!/usr/bin/env python3
"""
Generate a cryptographically-secure 64-character hex API key for Qdrant.

Usage:
    python scripts/generate_qdrant_key.py

The printed key must be set in TWO places so both services use the same value:

  1. Qdrant service  →  QDRANT__SERVICE__API_KEY=<key>
     (Railway: add as a Railway variable on the Qdrant service;
      Docker Compose: add to the qdrant.environment block or the .env file)

  2. Backend service  →  QDRANT_API_KEY=<key>
     (Railway: add as a Railway secret on the backend service;
      Docker Compose: add to backend/.env)

Never commit the key to version control.
"""
import secrets


def main() -> None:
    key = secrets.token_hex(32)  # 32 bytes → 64 hex characters
    print("Generated QDRANT API key (64-char hex):\n")
    print(f"  {key}\n")
    print("Set this value in both services:")
    print(f"  Qdrant  →  QDRANT__SERVICE__API_KEY={key}")
    print(f"  Backend →  QDRANT_API_KEY={key}")
    print("\nKeep this value secret — treat it like a password.")


if __name__ == "__main__":
    main()
