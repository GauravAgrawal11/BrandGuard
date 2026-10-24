"""
0ms Lexicon & AI-Slop Linter Engine.
Fast deterministic regex scanner for banned terminology, improper brand casing,
and clichéd AI filler slop.
"""

import re
import numpy as np

AI_SLOP_PATTERNS = [
    {
        "phrase": "delve into",
        "replacement": "examine",
        "reason": "Overused generic AI cliché. Use precise, active vocabulary.",
    },
    {
        "phrase": "in today's fast-paced",
        "replacement": "today",
        "reason": "Generic marketing filler cliché. State the concrete value proposition.",
    },
    {
        "phrase": "testament to",
        "replacement": "demonstrates",
        "reason": "Passive AI boilerplate. State direct measurable outcomes.",
    },
    {
        "phrase": "ever-evolving landscape",
        "replacement": "market",
        "reason": "Trite buzzword phrase. Replace with specific context or domain.",
    },
    {
        "phrase": "dive deep into",
        "replacement": "analyze",
        "reason": "Overused conversational AI transition.",
    },
    {
        "phrase": "game-changing",
        "replacement": "transformative",
        "reason": "Hype adjective without supporting evidence.",
    },
    {
        "phrase": "beacon of",
        "replacement": "leader in",
        "reason": "Melodramatic filler phrasing.",
    },
]


def audit_lexicon(raw_text, profile, rules=None):
    """
    Scans raw_text for banned brand terms and AI-slop phrases.
    Returns: (findings_list, rules_to_increment_trigger)
    """
    findings = []
    triggered_rules = set()

    if not raw_text or not raw_text.strip():
        return findings, list(triggered_rules)

    if rules is None:
        rules = profile.rules.all()

    # 1. Scan BrandRule entries with structured_spec
    for rule in rules:
        spec = rule.structured_spec or {}
        banned_term = spec.get('banned_term')
        if not banned_term:
            continue

        case_sensitive = spec.get('case_sensitive', False)
        replacement = spec.get('replacement', '')
        flags = 0 if case_sensitive else re.IGNORECASE

        # Word boundary pattern
        escaped_term = re.escape(banned_term)
        pattern = rf"\b{escaped_term}\b"

        for match in re.finditer(pattern, raw_text, flags=flags):
            start = match.start()
            end = match.end()
            excerpt = match.group(0)

            triggered_rules.add(rule.id)

            suggested = []
            if replacement:
                suggested.append(f"Replace with '{replacement}'")
            if spec.get('alternatives'):
                for alt in spec.get('alternatives'):
                    suggested.append(f"Replace with '{alt}'")
            if not suggested:
                suggested.append(f"Remove '{excerpt}'")

            findings.append({
                "pillar": rule.pillar,
                "severity": "BLOCKER" if rule.pillar == "FACTUAL" else "WARNING",
                "engine_provenance": "DETERMINISTIC_LEXICON",
                "confidence": 1.0,
                "rule_citation_code": rule.rule_code,
                "rule_citation_title": rule.title,
                "source_excerpt": excerpt,
                "location_json": {
                    "format": "TEXT_OFFSET",
                    "start_char": start,
                    "end_char": end,
                    "excerpt": excerpt,
                },
                "explanation": (
                    rule.rule_description or
                    f"Use of banned term '{excerpt}' violates brand rule {rule.rule_code}."
                ),
                "suggested_fixes": suggested,
                "status": "OPEN",
            })

    # 2. Scan AI-slop phrases
    for slop in AI_SLOP_PATTERNS:
        phrase = slop["phrase"]
        pattern = rf"\b{re.escape(phrase)}\b"
        for match in re.finditer(pattern, raw_text, re.IGNORECASE):
            start = match.start()
            end = match.end()
            excerpt = match.group(0)

            findings.append({
                "pillar": "TONE",
                "severity": "WARNING",
                "engine_provenance": "DETERMINISTIC_LEXICON",
                "confidence": 1.0,
                "rule_citation_code": "TONE_AI_SLOP_001",
                "rule_citation_title": "AI Filler & Cliché Idiom Detected",
                "source_excerpt": excerpt,
                "location_json": {
                    "format": "TEXT_OFFSET",
                    "start_char": start,
                    "end_char": end,
                    "excerpt": excerpt,
                },
                "explanation": (
                    f"Detected synthetic AI filler idiom '{excerpt}'. {slop['reason']}"
                ),
                "suggested_fixes": [
                    f"Replace with concise equivalent: '{slop['replacement']}'",
                    f"Reword without '{excerpt}'"
                ],
                "status": "OPEN",
            })

    return findings, list(triggered_rules)


TARGET_VOICE_ENVELOPES = {
    'PRESS_RELEASE': {'urgency': 25, 'formality': 85, 'technicality': 75, 'warmth': 50},
    'LINKEDIN_POST': {'urgency': 55, 'formality': 60, 'technicality': 60, 'warmth': 85},
    'PITCH_DECK': {'urgency': 40, 'formality': 75, 'technicality': 80, 'warmth': 65},
    'LANDING_PAGE': {'urgency': 65, 'formality': 50, 'technicality': 55, 'warmth': 80},
}


def compute_voice_fingerprint(text: str, channel_context: str = 'LINKEDIN_POST'):
    """
    Computes a 0–100 score across 4 deterministic voice axes:
    1. urgency
    2. formality
    3. technicality
    4. warmth
    Returns draft scores, channel target envelope, and alignment percentage.
    """
    if not text or not text.strip():
        target = TARGET_VOICE_ENVELOPES.get(channel_context, TARGET_VOICE_ENVELOPES['LINKEDIN_POST'])
        return {
            "draft_scores": {"urgency": 50, "formality": 50, "technicality": 50, "warmth": 50},
            "target_envelope": target,
            "alignment_pct": 75,
        }

    words = re.findall(r'\b[A-Za-z0-9_-]+\b', text)
    word_count = max(len(words), 1)

    # 1. Urgency
    exclamation_count = text.count('!')
    urgency_tokens = [
        'now', 'instant', 'today', 'fast', 'quick', 'hurry', 'limited', 'exclusive',
        'rapid', 'zero-fee', 'switch', 'wrecked', 'flash', 'sale', 'immediately', 'act'
    ]
    urgency_hits = sum(1 for w in words if w.lower() in urgency_tokens)
    raw_urgency = (urgency_hits / word_count) * 450 + (exclamation_count * 12)
    urgency_score = int(np.clip(raw_urgency + 15, 5, 100))

    # 2. Formality
    avg_word_length = sum(len(w) for w in words) / word_count
    contractions_slang = ['don\'t', 'dont', 'wrecked', 'cheap', 'can\'t', 'cant', 'won\'t', 'rip-off', 'gonna', 'wanna']
    slang_count = sum(text.lower().count(c) for c in contractions_slang)
    formal_vocab = [
        'infrastructure', 'settlement', 'governance', 'institution', 'compliance',
        'transparent', 'collaborative', 'sovereign', 'schedule', 'regulatory',
        'custody', 'methodology', 'framework', 'prohibited', 'entitlement'
    ]
    formal_hits = sum(1 for w in words if w.lower() in formal_vocab)
    raw_formality = (avg_word_length - 4.0) * 18 + (formal_hits * 10) - (slang_count * 15) + 40
    formality_score = int(np.clip(raw_formality, 10, 100))

    # 3. Technicality
    numbers_metrics = re.findall(r'\b\d+(?:\.\d+)?%?\+?\b', text)
    technical_acronyms = [
        'sla', 'fx', 'api', 'wcag', 'soc2', 'msb', 'fincen', 'apy', 'iso',
        'rgb', 'lab', 'swift', 'cielab', 'pdf', 'png', 'svg', 'nli', 'rag'
    ]
    acronym_hits = sum(1 for w in words if w.lower() in technical_acronyms)
    raw_technicality = (len(numbers_metrics) * 8) + (acronym_hits * 14) + 15
    technicality_score = int(np.clip(raw_technicality, 10, 100))

    # 4. Warmth
    warm_pronouns = ['we', 'our', 'us', 'you', 'your', 'partner', 'together', 'community', 'support', 'seamless', 'welcome', 'collaborative']
    warm_hits = sum(1 for w in words if w.lower() in warm_pronouns)
    hostile_tokens = ['wrecked', 'banks', 'scam', 'cheap', 'destroy', 'prohibit', 'penalty', 'danger']
    hostile_hits = sum(1 for w in words if w.lower() in hostile_tokens)
    raw_warmth = (warm_hits * 12) - (hostile_hits * 16) + 35
    warmth_score = int(np.clip(raw_warmth, 10, 100))

    target = TARGET_VOICE_ENVELOPES.get(channel_context, TARGET_VOICE_ENVELOPES['LINKEDIN_POST'])
    draft_scores = {
        'urgency': urgency_score,
        'formality': formality_score,
        'technicality': technicality_score,
        'warmth': warmth_score,
    }

    # Compute overall alignment percentage
    diffs = [abs(draft_scores[k] - target[k]) for k in ['urgency', 'formality', 'technicality', 'warmth']]
    mean_diff = sum(diffs) / 4.0
    alignment_pct = int(max(0, min(100, round(100 - mean_diff))))

    return {
        "draft_scores": draft_scores,
        "target_envelope": target,
        "alignment_pct": alignment_pct,
    }
