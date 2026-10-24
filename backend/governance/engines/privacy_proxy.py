"""
Confidentiality & PII Proxy Engine.
Provides local reversible codename, internal project name, and PII scrubbing
before external LLM inference, and restores original tokens upon return.
"""

import re


def sanitize_text(text: str, enabled: bool = False):
    """
    If enabled is True, replaces confidential codenames and emails with reversible placeholders.
    Returns: (sanitized_text, token_map)
    where token_map maps placeholder -> original_text
    """
    if not enabled or not text:
        return text, {}

    token_map = {}
    reverse_map = {}
    sanitized = text

    # 1. Project Codenames: Project [A-Z][a-zA-Z0-9_-]+
    codename_pattern = r'\bProject\s+[A-Z][a-zA-Z0-9_-]+\b'
    codename_counter = 1

    for match in re.finditer(codename_pattern, sanitized):
        original = match.group(0)
        if original not in reverse_map:
            placeholder = f"[CODENAME_{codename_counter}]"
            codename_counter += 1
            reverse_map[original] = placeholder
            token_map[placeholder] = original

    # Replace codenames
    for orig, placeholder in sorted(reverse_map.items(), key=lambda x: len(x[0]), reverse=True):
        sanitized = re.sub(re.escape(orig), placeholder, sanitized)

    # 2. Email addresses
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    email_counter = 1
    email_reverse_map = {}

    for match in re.finditer(email_pattern, sanitized):
        orig_email = match.group(0)
        if orig_email not in email_reverse_map:
            placeholder = f"[EMAIL_{email_counter}]"
            email_counter += 1
            email_reverse_map[orig_email] = placeholder
            token_map[placeholder] = orig_email

    for orig_email, placeholder in sorted(email_reverse_map.items(), key=lambda x: len(x[0]), reverse=True):
        sanitized = re.sub(re.escape(orig_email), placeholder, sanitized)

    return sanitized, token_map


def restore_tokens(obj, token_map: dict):
    """
    Recursively restores sanitized tokens inside strings, lists, or dicts.
    """
    if not token_map:
        return obj

    if isinstance(obj, str):
        restored = obj
        for placeholder, original in token_map.items():
            restored = restored.replace(placeholder, original)
        return restored
    elif isinstance(obj, list):
        return [restore_tokens(item, token_map) for item in obj]
    elif isinstance(obj, dict):
        return {k: restore_tokens(v, token_map) for k, v in obj.items()}
    return obj
