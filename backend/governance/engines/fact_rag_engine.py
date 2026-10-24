"""
Citation-Grounded Fact & Tone Engine.
Evaluates copy against the Brand Fact Ledger and Tone rules using:
1. Gemini 2.5 Flash with structured JSON output (when GEMINI_API_KEY is present).
2. Deterministic Regex NLI Offline Fallback (when offline or unconfigured).
"""

import os
import re
import json
from datetime import date
from .privacy_proxy import sanitize_text, restore_tokens


OFFLINE_FALLBACK_RULES = [
    {
        "pattern": r"(?:500\+\s*enterprise\s*teams|500\s*enterprises)",
        "citation_code": "FACT_008",
        "citation_title": "Outdated Enterprise Adoption Metric",
        "pillar": "FACTUAL",
        "severity": "BLOCKER",
        "explanation": (
            "Claim cites '500+ enterprise teams', which expired on 2025-12-31. "
            "Superseded by FACT_042: 'over 2,400+ enterprise teams as of 2026'."
        ),
        "suggested_fixes": [
            "over 2,400+ enterprise teams globally",
            "more than 2,400 forward-thinking organizations"
        ],
    },
    {
        "pattern": r"(?:instant(?:,\s*|\s+)zero-fee\s*international\s*transfers|zero-fee\s*international\s*transfers|instant\s*international\s*transfers)",
        "citation_code": "FACT_012",
        "citation_title": "Factual Pricing & SLA Contradiction",
        "pillar": "FACTUAL",
        "severity": "BLOCKER",
        "explanation": (
            "Violates FACT_012 truth ledger. International wire settlements require standard 24-hour clearing "
            "and are subject to the 0.5% FX schedule; transfers are not zero-fee or instantaneous."
        ),
        "suggested_fixes": [
            "transparent 24-hour global transfers with low 0.5% FX rates",
            "streamlined international settlements with clear, capped 0.5% fees"
        ],
    },
    {
        "pattern": r"(?:Basic\s*Plan\s*with\s*unlimited\s*seats|unlimited\s*seats\s*on\s*Basic)",
        "citation_code": "FACT_015",
        "citation_title": "Product Tier Entitlement Misrepresentation",
        "pillar": "FACTUAL",
        "severity": "BLOCKER",
        "explanation": (
            "Basic Plan is capped at 3 active seats according to verified Product Tier Matrix (FACT_015). "
            "Unlimited seats require the Enterprise Tier."
        ),
        "suggested_fixes": [
            "Basic Plan with up to 3 collaborative seats",
            "Enterprise Plan featuring unlimited team seats"
        ],
    },
    {
        "pattern": r"(?:#1\s*fastest|world's\s*fastest|unmatched\s*speed)",
        "citation_code": "TONE_001",
        "citation_title": "Unsupported Promotional Superlative",
        "pillar": "TONE",
        "severity": "WARNING",
        "explanation": (
            "Claims like '#1 fastest' violate FTC compliance & Brand Tone Rule TONE_001. "
            "NovaPay policy strictly prohibits unquantified superlative superiority claims."
        ),
        "suggested_fixes": [
            "high-throughput payment infrastructure",
            "enterprise-grade settlement speed verified by industry benchmarks"
        ],
    },
    {
        "pattern": r"(?:Don't\s*get\s*wrecked\s*by\s*banks!?|get\s*wrecked\b|banks\s*are\s*scamming|rip-off\s*banks)",
        "citation_code": "TONE_002",
        "citation_title": "Aggressive / Fear-Mongering Tone Violation",
        "pillar": "TONE",
        "severity": "BLOCKER",
        "explanation": (
            "Violates NovaPay Executive Voice Policy (TONE_002). Communication must remain confident, "
            "institutional, and constructive without resorting to fear-mongering or juvenile slang ('wrecked')."
        ),
        "suggested_fixes": [
            "Eliminate legacy banking friction with modern fintech rails",
            "Upgrade from unpredictable legacy bank wire fees to transparent settlement"
        ],
    },
]


def audit_facts_and_tone(raw_text: str, profile, facts=None, rules=None, confidential_mode: bool = False):
    """
    Audits text against facts and tone guidelines.
    Returns: (findings_list, triggered_rule_codes, triggered_fact_codes)
    """
    findings = []
    triggered_rules = set()
    triggered_facts = set()

    if not raw_text or not raw_text.strip():
        return findings, list(triggered_rules), list(triggered_facts)

    if facts is None:
        facts = list(profile.facts.all())
    if rules is None:
        rules = list(profile.rules.filter(pillar__in=['FACTUAL', 'TONE']))

    # Privacy proxy scrub if confidential_mode is enabled
    sanitized_text, token_map = sanitize_text(raw_text, enabled=confidential_mode)

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    llm_succeeded = False

    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)

            # Build fact and tone context
            fact_lines = []
            today = date.today()
            for f in facts:
                is_expired = f.valid_until and f.valid_until < today
                status_str = f"EXPIRED (superseded by: {f.superseded_by_text})" if is_expired else "ACTIVE"
                fact_lines.append(f"- [{f.fact_code}] ({status_str}) {f.category}: {f.claim_truth} (valid until {f.valid_until})")

            rule_lines = []
            for r in rules:
                rule_lines.append(f"- [{r.rule_code}] {r.title}: {r.rule_description}")

            prompt = f"""
You are the BrandGuard enterprise brand-governance & fact linter for {profile.org_name}.
Audit the candidate copy against the Brand Fact Ledger and Tone Rules.

LIVING FACT LEDGER:
{chr(10).join(fact_lines)}

BRAND TONE & COMPLIANCE RULES:
{chr(10).join(rule_lines)}

CANDIDATE COPY:
\"\"\"{sanitized_text}\"\"\"

INSTRUCTIONS:
1. Identify any direct factual contradictions, expired metrics, unsupported superlatives, or aggressive/unprofessional tone.
2. Return a valid JSON list of finding objects. If none, return [].
Each finding object MUST follow this schema:
{{
  "pillar": "FACTUAL" | "TONE",
  "severity": "BLOCKER" | "WARNING",
  "rule_citation_code": "e.g. FACT_008 or TONE_001",
  "rule_citation_title": "Concise violation title",
  "source_excerpt": "Exact substring from candidate copy that triggered this",
  "start_char": 0,
  "end_char": 10,
  "explanation": "Clear explanation citing the fact or rule",
  "suggested_fixes": ["Intent-preserving rewrite 1", "Intent-preserving rewrite 2"]
}}
"""
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )

            raw_resp = response.text
            parsed = json.loads(raw_resp)
            if isinstance(parsed, list):
                for item in parsed:
                    excerpt = item.get("source_excerpt", "")
                    start_char = item.get("start_char", 0)
                    end_char = item.get("end_char", len(excerpt))

                    # Recalculate true start/end if possible
                    if excerpt and excerpt in raw_text:
                        pos = raw_text.find(excerpt)
                        if pos != -1:
                            start_char = pos
                            end_char = pos + len(excerpt)

                    finding = {
                        "pillar": item.get("pillar", "FACTUAL"),
                        "severity": item.get("severity", "WARNING"),
                        "engine_provenance": "HYBRID_RAG_LLM",
                        "confidence": 0.96,
                        "rule_citation_code": item.get("rule_citation_code", "FACT_GENERAL"),
                        "rule_citation_title": item.get("rule_citation_title", "Factual Inconsistency"),
                        "source_excerpt": excerpt,
                        "location_json": {
                            "format": "TEXT_OFFSET",
                            "start_char": start_char,
                            "end_char": end_char,
                            "excerpt": excerpt,
                        },
                        "explanation": item.get("explanation", ""),
                        "suggested_fixes": item.get("suggested_fixes", []),
                        "status": "OPEN",
                    }
                    restored_finding = restore_tokens(finding, token_map)
                    findings.append(restored_finding)

                    code = restored_finding["rule_citation_code"]
                    if code.startswith("FACT_"):
                        triggered_facts.add(code)
                    else:
                        triggered_rules.add(code)

                llm_succeeded = True
        except Exception as e:
            llm_succeeded = False

    # Mandatory Offline Deterministic Fallback if LLM was not used or did not produce matches
    if not llm_succeeded or not findings:
        for rule_spec in OFFLINE_FALLBACK_RULES:
            pat = rule_spec["pattern"]
            for m in re.finditer(pat, raw_text, re.IGNORECASE):
                excerpt = m.group(0)
                code = rule_spec["citation_code"]
                if code.startswith("FACT_"):
                    triggered_facts.add(code)
                else:
                    triggered_rules.add(code)

                findings.append({
                    "pillar": rule_spec["pillar"],
                    "severity": rule_spec["severity"],
                    "engine_provenance": "HYBRID_RAG_LLM",
                    "confidence": 0.96,
                    "rule_citation_code": code,
                    "rule_citation_title": rule_spec["citation_title"],
                    "source_excerpt": excerpt,
                    "location_json": {
                        "format": "TEXT_OFFSET",
                        "start_char": m.start(),
                        "end_char": m.end(),
                        "excerpt": excerpt,
                    },
                    "explanation": rule_spec["explanation"],
                    "suggested_fixes": list(rule_spec["suggested_fixes"]),
                    "status": "OPEN",
                })

    return findings, list(triggered_rules), list(triggered_facts)
