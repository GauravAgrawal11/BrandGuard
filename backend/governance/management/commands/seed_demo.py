"""
Management command to seed NovaPay demo brand profile, rules, facts,
telemetry stats, sample submissions, and the off-brand test PNG banner.
"""

import os
from pathlib import Path
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont
from governance.models import (
    BrandProfile, BrandRule, FactLedger, Submission, SubmissionVersion, AuditFinding, ExceptionRequest
)


class Command(BaseCommand):
    help = "Seeds NovaPay brand profile, living facts, rules, sample banner and telemetry data"

    def handle(self, *args, **options):
        self.stdout.write("Seeding NovaPay brand governance ecosystem...")

        # 1. Brand Profile
        palette = [
            {"name": "Midnight Emerald", "hex": "#0A3423", "max_delta_e": 4.0},
            {"name": "Teal", "hex": "#00D4B6", "max_delta_e": 4.5},
            {"name": "Pure White", "hex": "#FFFFFF", "max_delta_e": 2.0},
            {"name": "Muted Panel", "hex": "#F8FAF9", "max_delta_e": 2.0},
        ]
        profile, created = BrandProfile.objects.get_or_create(
            org_name="NovaPay",
            defaults={
                "allowed_hex_palette": palette,
                "allowed_fonts": ["Inter", "JetBrains Mono", "Plus Jakarta Sans"],
                "wcag_min_ratio": 4.5,
                "logo_aspect_ratio": 3.5,
            }
        )
        profile.org_name = "NovaPay"
        profile.allowed_hex_palette = palette
        profile.save()

        # 2. Brand Rules
        rules_data = [
            {
                "pillar": "VISUAL",
                "rule_code": "LEX_001",
                "title": "Strict Brand Casing (NovaPay)",
                "structured_spec": {
                    "banned_term": "Novapay",
                    "replacement": "NovaPay",
                    "case_sensitive": True,
                    "alternatives": ["NovaPay Technologies", "NovaPay Inc."]
                },
                "rule_description": "NovaPay requires camelCase capitalization with capital N and capital P. Never write 'Novapay' or 'novapay'.",
                "trigger_count": 24,
                "override_count": 2,  # 8.3% override rate -> TEAM_TRAINING_GAP
            },
            {
                "pillar": "TONE",
                "rule_code": "LEX_002",
                "title": "Prohibited Value Terminology ('cheap')",
                "structured_spec": {
                    "banned_term": "cheap",
                    "replacement": "cost-effective",
                    "case_sensitive": False,
                    "alternatives": ["accessible", "transparently priced", "high-efficiency"]
                },
                "rule_description": "NovaPay conveys institutional trust and premium engineering. Avoid the word 'cheap'.",
                "trigger_count": 18,
                "override_count": 11,  # 61.1% override rate -> NEEDS_CLARIFICATION
            },
            {
                "pillar": "FACTUAL",
                "rule_code": "LEX_003",
                "title": "Regulatory APY Prohibition ('guaranteed returns')",
                "structured_spec": {
                    "banned_term": "guaranteed returns",
                    "replacement": "target APY yields",
                    "case_sensitive": False,
                    "alternatives": ["projected institutional yield", "variable liquidity yield"]
                },
                "rule_description": "Strict compliance prohibition against claiming 'guaranteed returns' on treasury sweep accounts.",
                "trigger_count": 9,
                "override_count": 0,  # 0% override rate -> TEAM_TRAINING_GAP
            },
            {
                "pillar": "TONE",
                "rule_code": "TONE_001",
                "title": "Unsubstantiated Performance Superlatives",
                "structured_spec": {
                    "banned_term": "#1 fastest",
                    "replacement": "high-throughput payment rails",
                    "case_sensitive": False,
                },
                "rule_description": "Prohibits unverified superlative claims such as '#1 fastest' or 'world's quickest' without audited independent benchmark citations.",
                "trigger_count": 15,
                "override_count": 8,  # 53.3% override rate -> NEEDS_CLARIFICATION
            },
            {
                "pillar": "TONE",
                "rule_code": "TONE_002",
                "title": "Executive Voice Policy (No Aggressive Slang)",
                "structured_spec": {
                    "banned_term": "get wrecked",
                    "replacement": "eliminate legacy banking friction",
                    "case_sensitive": False,
                },
                "rule_description": "Prohibits fear-mongering and juvenile slang like 'don't get wrecked by banks' in public communications.",
                "trigger_count": 12,
                "override_count": 1,  # 8.3% override rate -> TEAM_TRAINING_GAP
            },
            {
                "pillar": "VISUAL",
                "rule_code": "VIS_COLOR_001",
                "title": "Approved Brand Color Compliance (CIELAB ΔE ≤ 4.0)",
                "structured_spec": {
                    "max_delta_e": 4.0,
                    "approved_palette": ["#00C885", "#062B22", "#020617", "#FFFFFF", "#2EE59D"]
                },
                "rule_description": "All creative visual assets must only employ approved brand swatches within acceptable CIELAB Delta-E color distance tolerances.",
                "trigger_count": 21,
                "override_count": 13,  # 61.9% override rate -> NEEDS_CLARIFICATION
            },
            {
                "pillar": "VISUAL",
                "rule_code": "VIS_WCAG_2.1",
                "title": "WCAG 2.1 AA Contrast Standard (Ratio ≥ 4.5:1)",
                "structured_spec": {
                    "min_contrast_ratio": 4.5
                },
                "rule_description": "Text against visual backgrounds must meet or exceed WCAG 2.1 AA standard 4.5:1 contrast ratio to guarantee accessibility.",
                "trigger_count": 16,
                "override_count": 2,  # 12.5% override rate -> TEAM_TRAINING_GAP
            },
            {
                "pillar": "FACTUAL",
                "rule_code": "FACT_012",
                "title": "International settlement & fees",
                "structured_spec": {
                    "allowed_claim": "24-hour transfers with 0.5% FX fee",
                    "disallowed_claim": "Instant, zero-fee international transfers",
                    "applies_to": "All channels",
                    "enforcement": "Block publish",
                    "owner": "Maya Chen, Product Ops",
                    "ledger_entry": "LEDGER-0412",
                    "source": "NovaPay Product Facts",
                    "valid_from": "Nov 20, 2025",
                    "last_verified": "Mar 14, 2026",
                },
                "rule_description": "International transfer claims must reflect the standard settlement time and FX fee. Do not imply zero-fee or instant delivery unless a specific product scope allows it.",
                "trigger_count": 128,
                "override_count": 5,  # 4.2% override rate -> Blocker
            },
            {
                "pillar": "TONE",
                "rule_code": "VOICE_004",
                "title": "Unsupported superlatives",
                "structured_spec": {
                    "banned_term": "wrecked",
                    "warning_type": "Warning · Voice",
                    "quote": "Don't get wrecked by banks!",
                },
                "rule_description": "Aggressive comparison tone is outside the default voice range.",
                "trigger_count": 96,
                "override_count": 11,  # 11.8% override rate -> Warning
            },
            {
                "pillar": "VISUAL",
                "rule_code": "VIS_021",
                "title": "CTA color drift (ΔE > 3.0)",
                "structured_spec": {
                    "max_delta_e": 3.0,
                },
                "rule_description": "CTA buttons must comply with primary emerald swatches (ΔE ≤ 3.0).",
                "trigger_count": 74,
                "override_count": 5,  # 7.1% override rate -> Warning
            },
            {
                "pillar": "FACTUAL",
                "rule_code": "FACT_031",
                "title": "Expired security certification",
                "structured_spec": {
                    "valid_until": "2026-06-10",
                },
                "rule_description": "Compliance claims require active, unexpired SOC2 and ISO certifications.",
                "trigger_count": 51,
                "override_count": 0,  # 0.9% override rate -> Blocker
            },
        ]

        for r_spec in rules_data:
            BrandRule.objects.update_or_create(
                profile=profile,
                rule_code=r_spec["rule_code"],
                defaults=r_spec
            )

        # 3. Living Fact Ledger
        facts_data = [
            {
                "fact_code": "FACT_008",
                "category": "Adoption & Enterprise Traction",
                "claim_truth": "NovaPay serves 500+ enterprise teams across North America and Europe.",
                "last_verified": date(2024, 6, 15),
                "valid_until": date(2025, 12, 31),  # EXPIRED!
                "superseded_by_text": "FACT_042: over 2,400+ enterprise teams as of 2026",
                "trigger_count": 14,
                "override_count": 10,  # 71.4% override rate -> NEEDS_CLARIFICATION
            },
            {
                "fact_code": "FACT_042",
                "category": "Adoption & Enterprise Traction",
                "claim_truth": "NovaPay serves over 2,400+ enterprise teams worldwide across 38 sovereign markets.",
                "last_verified": date(2026, 1, 10),
                "valid_until": date(2027, 12, 31),
                "superseded_by_text": "",
                "trigger_count": 4,
                "override_count": 0,
            },
            {
                "fact_code": "FACT_012",
                "category": "Global Settlement & Pricing SLA",
                "claim_truth": "International cross-border settlements clear in standard 24 hours with a transparent 0.5% FX conversion fee schedule.",
                "last_verified": date(2025, 11, 1),
                "valid_until": date(2027, 6, 30),
                "superseded_by_text": "",
                "trigger_count": 22,
                "override_count": 15,  # 68.2% override rate -> NEEDS_CLARIFICATION
            },
            {
                "fact_code": "FACT_015",
                "category": "Subscription & Tier Entitlements",
                "claim_truth": "The NovaPay Basic Plan is strictly capped at 3 active collaborative seats. Unlimited seat provisioning requires the Enterprise SLA Tier.",
                "last_verified": date(2025, 10, 1),
                "valid_until": date(2027, 12, 31),
                "superseded_by_text": "",
                "trigger_count": 11,
                "override_count": 2,  # 18.2% override rate -> TEAM_TRAINING_GAP
            },
            {
                "fact_code": "FACT_021",
                "category": "Regulatory & Legal Custody",
                "claim_truth": "NovaPay operates as a registered Money Services Business (FinCEN MSB #310002491) maintaining 1:1 segregated liquid tier-1 client reserves.",
                "last_verified": date(2025, 8, 20),
                "valid_until": date(2028, 1, 1),
                "superseded_by_text": "",
                "trigger_count": 5,
                "override_count": 1,
            },
        ]

        for f_spec in facts_data:
            FactLedger.objects.update_or_create(
                profile=profile,
                fact_code=f_spec["fact_code"],
                defaults=f_spec
            )

        # 4. Programmatically Generate Off-Brand Promotional PNG Banner
        media_dir = Path(settings.MEDIA_ROOT)
        media_dir.mkdir(parents=True, exist_ok=True)
        banner_path = media_dir / "sample_offbrand_banner.png"

        img_w, img_h = 800, 450
        banner_img = Image.new("RGB", (img_w, img_h), color=(147, 51, 234))  # Off-brand purple #9333EA
        draw = ImageDraw.Draw(banner_img)

        # Off-brand high Delta-E magenta badge section (#FF007F)
        draw.rectangle([0, 0, 800, 80], fill=(255, 0, 127))
        draw.rectangle([0, 370, 800, 450], fill=(234, 88, 12))  # Off-brand bright orange #EA580C

        # Low contrast text box (gray text on dark grey surface: #78716C on #57534E ~ 2.1:1 contrast)
        draw.rectangle([40, 260, 760, 340], fill=(87, 83, 78))

        # Draw decorative shapes & CVD Color Collapse Demonstration Swatches
        draw.ellipse([640, 100, 780, 240], fill=(236, 72, 153))

        # Color-Vision Deficiency test badges: Crimson (150, 70, 90) vs Olive (112, 133, 63)
        # Visibly distinct in normal vision (ΔE=64.2), but collapses to ΔE=6.1 under Deuteranopia!
        draw.rounded_rectangle([520, 260, 630, 310], radius=8, fill=(150, 70, 90))
        draw.rounded_rectangle([640, 260, 750, 310], radius=8, fill=(112, 133, 63))

        # Draw banner text
        try:
            # Try to load a system font or default
            font_title = ImageFont.truetype("arial.ttf", 36)
            font_subtitle = ImageFont.truetype("arial.ttf", 22)
            font_low_contrast = ImageFont.truetype("arial.ttf", 20)
            font_badge = ImageFont.truetype("arial.ttf", 24)
            font_tiny = ImageFont.truetype("arial.ttf", 14)
        except Exception:
            font_title = font_subtitle = font_low_contrast = font_badge = font_tiny = ImageFont.load_default()

        # Top banner text with tight optical encroaching lines (triggers VIS_LOGO_SPACE)
        draw.text((30, 24), "FLASH CAMPAIGN // Q4 AGENCY EXPANSION", fill=(255, 255, 255), font=font_badge)
        # Tight secondary badge borders encroaching within the 15% clear-space isolation zone
        for offset_x in range(10, 320, 12):
            draw.line([(offset_x, 8), (offset_x + 8, 20)], fill=(255, 255, 255), width=2)
            draw.line([(offset_x, 60), (offset_x + 8, 72)], fill=(255, 255, 255), width=2)
        draw.rectangle([15, 12, 330, 72], outline=(255, 255, 255), width=2)

        # Main headline with brand casing error and superlative
        draw.text((40, 110), "Novapay Flash Sale: #1 fastest payments", fill=(255, 255, 255), font=font_title)
        draw.text((40, 165), "cheap fees & instant zero-fee international transfers", fill=(254, 240, 138), font=font_subtitle)
        draw.text((40, 205), "Join 500+ enterprise teams and Basic Plan with unlimited seats", fill=(243, 244, 246), font=font_subtitle)

        # CVD Badges text
        draw.text((540, 275), "TIER A", fill=(255, 255, 255), font=font_badge)
        draw.text((660, 275), "TIER B", fill=(255, 255, 255), font=font_badge)

        # Low contrast text inside the box (violates WCAG 2.1)
        draw.text((60, 315), "Settlement terms apply. Instant wire transfers subject to network capacity.", fill=(168, 162, 158), font=font_low_contrast)
        draw.text((60, 340), "Limited availability across eligible jurisdictions. No warranty implied.", fill=(168, 162, 158), font=font_low_contrast)

        # Bottom warning callout with aggressive tone
        draw.text((30, 395), "Don't get wrecked by banks!! Switch to Novapay today.", fill=(255, 255, 255), font=font_badge)

        banner_img.save(banner_path, format="PNG")
        self.stdout.write(self.style.SUCCESS(f"Saved sample off-brand banner to: {banner_path}"))

        # 5. Pre-seed a sample historical Submission with multi-version progression for Tab 3
        sub_title = "Global Enterprise Liquidity Q1 Pitch Deck"
        sample_sub, _ = Submission.objects.get_or_create(
            profile=profile,
            title=sub_title,
            channel_context="PITCH_DECK",
            defaults={
                "status": "APPROVED",
                "confidential_mode": True,
                "clearance_hash": "SHA256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            }
        )

        # Version 1 (Score 58)
        v1, _ = SubmissionVersion.objects.get_or_create(
            submission=sample_sub,
            version_number=1,
            defaults={
                "raw_text": "Novapay is the #1 fastest payments network. We offer cheap enterprise plans for 500+ enterprise teams.",
                "file_type": "TEXT",
                "compliance_score": 58.0,
            }
        )

        # Version 2 (Score 84)
        v2, _ = SubmissionVersion.objects.get_or_create(
            submission=sample_sub,
            version_number=2,
            defaults={
                "raw_text": "NovaPay is the high-throughput payments network. We offer cost-effective enterprise plans for 500+ enterprise teams.",
                "file_type": "TEXT",
                "compliance_score": 84.0,
            }
        )

        # Version 3 (Score 100 - Approved)
        v3, _ = SubmissionVersion.objects.get_or_create(
            submission=sample_sub,
            version_number=3,
            defaults={
                "raw_text": "NovaPay is the high-throughput payments network. We offer cost-effective enterprise plans for over 2,400+ enterprise teams worldwide.",
                "file_type": "TEXT",
                "compliance_score": 100.0,
            }
        )

        # Seed findings for v1
        if not v1.findings.exists():
            AuditFinding.objects.create(
                version=v1,
                pillar="VISUAL",
                severity="WARNING",
                engine_provenance="DETERMINISTIC_LEXICON",
                confidence=1.0,
                rule_citation_code="LEX_001",
                rule_citation_title="Strict Brand Casing (NovaPay)",
                source_excerpt="Novapay",
                location_json={"format": "TEXT_OFFSET", "start_char": 0, "end_char": 7, "excerpt": "Novapay"},
                explanation="Capitalize both N and P: NovaPay.",
                suggested_fixes=["NovaPay"],
                status="ACCEPTED",
            )
            AuditFinding.objects.create(
                version=v1,
                pillar="TONE",
                severity="WARNING",
                engine_provenance="HYBRID_RAG_LLM",
                confidence=0.96,
                rule_citation_code="TONE_001",
                rule_citation_title="Unsubstantiated Performance Superlatives",
                source_excerpt="#1 fastest",
                location_json={"format": "TEXT_OFFSET", "start_char": 15, "end_char": 25, "excerpt": "#1 fastest"},
                explanation="Avoid unsubstantiated superlative.",
                suggested_fixes=["high-throughput"],
                status="OVERRIDE_APPROVED",
                override_reason="Benchmarked internally against Swift ISO 20022 latency standard.",
                reviewer_comment="Approved with footnote citing benchmark methodology.",
            )

        # 6. Pre-seed DRAFT_024 Submission with creator Alex Morgan, channel LINKEDIN_POST
        draft_024, _ = Submission.objects.get_or_create(
            profile=profile,
            title="DRAFT_024 - Global ambition. Local simplicity.",
            channel_context="LINKEDIN_POST",
            defaults={
                "status": "EXCEPTION_PENDING",
                "confidential_mode": False,
            }
        )
        v_draft, _ = SubmissionVersion.objects.get_or_create(
            submission=draft_024,
            version_number=1,
            defaults={
                "raw_text": "Don't get wrecked by banks! Your business. Without borders. Transfers settle in 24 hrs with a 0.5% FX fee.",
                "file_type": "TEXT",
                "compliance_score": 96.0,
            }
        )

        # 7. Seed Exception Requests (EX-2041, EX-2039, EX-2036)
        ExceptionRequest.objects.update_or_create(
            id="EX-2041",
            defaults={
                "draft_id": "DRAFT_024",
                "rule_code": "VOICE_004",
                "title": "Global ambition. Local simplicity.",
                "requester_name": "Alex Morgan",
                "requester_dept": "Marketing",
                "requested_date": date(2026, 6, 11),
                "warning_type": "Warning · Voice",
                "quote_text": "Don't get wrecked by banks!",
                "rule_description": "Aggressive comparison tone is outside the default voice range.",
                "justification": "This is an intentional challenger voice for NovaPay's 'Global ambition' campaign. It addresses banking friction, not individuals or protected groups, and makes no fee or speed claim.",
                "campaign_reference": "Global ambition · Q3 2026 launch",
                "scope": "This draft only",
                "channel": "LinkedIn post",
                "expires_on": date(2026, 10, 31),
                "reviewer_name": "Jordan Lee",
                "reviewer_title": "Brand Manager",
                "hard_blockers_count": 0,
                "supporting_file_name": "Q3_challenger_campaign.pdf",
                "supporting_file_size": "1.2 MB",
                "status": "PENDING",
                "decision_note": "Reviewed. The challenger voice fits this audience and the scope is narrow.",
            }
        )

        ExceptionRequest.objects.update_or_create(
            id="EX-2039",
            defaults={
                "draft_id": "DRAFT_022",
                "rule_code": "VOICE_002",
                "title": "Move money, not mountains.",
                "requester_name": "Priya Nair",
                "requester_dept": "Growth",
                "requested_date": date(2026, 6, 10),
                "warning_type": "Warning · Voice",
                "quote_text": "Move money, not mountains.",
                "rule_description": "Colloquial idiom register requires brand review.",
                "justification": "Targeting high-velocity international e-commerce merchants.",
                "campaign_reference": "Summer Merchant Push 2026",
                "scope": "This draft only",
                "channel": "LinkedIn post",
                "expires_on": date(2026, 10, 31),
                "reviewer_name": "Jordan Lee",
                "reviewer_title": "Brand Manager",
                "hard_blockers_count": 0,
                "status": "PENDING",
            }
        )

        ExceptionRequest.objects.update_or_create(
            id="EX-2036",
            defaults={
                "draft_id": "DRAFT_019",
                "rule_code": "FACT_015",
                "title": "The banking you deserve.",
                "requester_name": "Sam Okafor",
                "requester_dept": "Brand",
                "requested_date": date(2026, 6, 9),
                "warning_type": "Warning · Voice",
                "quote_text": "The banking you deserve.",
                "rule_description": "Unqualified superlative phrasing.",
                "justification": "Executive interview quote for European fintech roundup.",
                "campaign_reference": "FinTech Europe Spotlight",
                "scope": "This draft only",
                "channel": "Press Release",
                "expires_on": date(2026, 10, 31),
                "reviewer_name": "Jordan Lee",
                "reviewer_title": "Brand Manager",
                "hard_blockers_count": 0,
                "status": "PENDING",
            }
        )

        self.stdout.write(self.style.SUCCESS("Demo seeding completed successfully!"))
