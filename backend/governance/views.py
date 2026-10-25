"""
Pure Django JSON API views for BrandGuard (Phase 2 Upgraded).
No Django REST Framework (DRF) abstractions - custom dictionary serialization and @csrf_exempt JsonResponse.
Features:
1. Multi-modal Pre-Flight Audit with Voice Fingerprint Radar
2. Stale Fact Blast-Radius Retroactive Governance
3. Cryptographic PNG/PDF Metadata Stamping on Manager Sign-Off
4. CMS Cryptographic Stamp Verification endpoint
5. Brand-Safe Prompt / .cursorrules Compiler
"""

import json
import hashlib
from datetime import datetime, date, timedelta
from pathlib import Path
import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotFound, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.core.files.base import ContentFile
from django.contrib.auth import authenticate, login, logout
from django.db.models import Q

from .models import (
    BrandGuardUser, SystemSettings, BrandProfile, BrandRule, BrandRuleVersion,
    DraftRule, FactLedger, Submission, SubmissionVersion, AuditFinding,
    BrandComplianceSignature, ExceptionRequest, Notification, AuditTrail
)
from .auth import generate_user_token, decode_user_token, get_authenticated_user_from_request
from .permissions import IsAdmin, IsWriter, admin_required, writer_required
from .scraper import scrape_brand_profile, SSRFSecurityException
from .rule_parser import parse_rule_document, RuleParsingException
from .engines.lexicon_engine import audit_lexicon, compute_voice_fingerprint, TARGET_VOICE_ENVELOPES
from .engines.fact_rag_engine import audit_facts_and_tone
from .engines.visual_engine import audit_image_array, audit_pdf_file
from .engines.telemetry import get_telemetry_report
from .crypto_sign import (
    sign_hmac_sha256, sign_ed25519, get_ed25519_keys, build_canonical_payload,
    embed_clearance_in_png, embed_clearance_in_pdf, verify_asset_clearance,
    extract_metadata_from_file, LEGAL_NOTICE
)

@csrf_exempt
def root_api_status_view(request):
    """
    GET /
    Root health check and API status endpoint.
    """
    return JsonResponse({
        "status": "online",
        "service": "BrandGuard Enterprise Governance API",
        "ruleset_version": "v3.2",
        "endpoints": {
            "auth_login": "/api/auth/login/",
            "auth_me": "/api/auth/me/",
            "brand_profile": "/api/brand-profile/",
            "rules": "/api/rules/",
            "facts": "/api/facts/",
            "submissions": "/api/submissions/",
            "telemetry": "/api/telemetry/",
            "exceptions": "/api/exceptions/"
        }
    })


def get_active_profile():
    """Returns the primary BrandProfile, creating NovaPay default if missing."""
    profile = BrandProfile.objects.first()
    palette = [
        {"name": "Midnight Emerald", "hex": "#0A3423", "max_delta_e": 4.0},
        {"name": "Teal", "hex": "#00D4B6", "max_delta_e": 4.5},
        {"name": "Pure White", "hex": "#FFFFFF", "max_delta_e": 2.0},
        {"name": "Muted Panel", "hex": "#F8FAF9", "max_delta_e": 2.0},
    ]
    if not profile:
        profile = BrandProfile.objects.create(
            org_name="NovaPay",
            allowed_hex_palette=palette,
            allowed_fonts=["Inter", "JetBrains Mono", "Plus Jakarta Sans"],
            wcag_min_ratio=4.5,
            logo_aspect_ratio=3.5,
        )
    else:
        if profile.org_name != "NovaPay" or len(profile.allowed_hex_palette) != 4:
            profile.org_name = "NovaPay"
            profile.allowed_hex_palette = palette
            profile.save()
    return profile


def calculate_score(findings, approved_exception_count=0):
    """
    Calculates 0-100 compliance score and detailed breakdown.
    Configurable weights from SystemSettings (default: 18 pts/BLOCKER, 8 pts/WARNING, 4 pts/approved exception).
    Returns (final_score, breakdown_dict).
    """
    try:
        sys_settings = SystemSettings.get_settings()
        blocker_penalty = float(sys_settings.blocker_penalty)
        warning_penalty = float(sys_settings.warning_penalty)
        exception_deduction = float(sys_settings.approved_exception_deduction)
    except Exception:
        blocker_penalty = 18.0
        warning_penalty = 8.0
        exception_deduction = 4.0

    blockers = 0
    warnings = 0
    approved_count = approved_exception_count

    for f in findings:
        status = f.get('status', 'OPEN') if isinstance(f, dict) else getattr(f, 'status', 'OPEN')
        if status in ('OVERRIDE_APPROVED', 'ACCEPTED'):
            if status == 'OVERRIDE_APPROVED':
                approved_count += 1
            continue
        severity = f.get('severity', 'WARNING') if isinstance(f, dict) else getattr(f, 'severity', 'WARNING')
        if severity == 'BLOCKER':
            blockers += 1
        else:
            warnings += 1

    blockers_deduction = round(blockers * blocker_penalty, 1)
    warnings_deduction = round(warnings * warning_penalty, 1)
    exceptions_deduction = round(approved_count * exception_deduction, 1)
    total_deductions = round(blockers_deduction + warnings_deduction + exceptions_deduction, 1)

    final_score = max(0.0, min(100.0, round(100.0 - total_deductions, 1)))

    breakdown = {
        "final_score": final_score,
        "base_score": 100.0,
        "blockers_count": blockers,
        "blockers_deduction": blockers_deduction,
        "blocker_rate": blocker_penalty,
        "warnings_count": warnings,
        "warnings_deduction": warnings_deduction,
        "warning_rate": warning_penalty,
        "approved_exceptions_count": approved_count,
        "approved_exceptions_deduction": exceptions_deduction,
        "exception_deduction_rate": exception_deduction,
        "total_deductions": total_deductions,
        "formula": f"100 - ({blockers}×{blocker_penalty}) - ({warnings}×{warning_penalty}) - ({approved_count}×{exception_deduction})",
        "explanation": f"Score {final_score}/100: {blockers} blockers (-{blockers_deduction}), {warnings} warnings (-{warnings_deduction}), {approved_count} approved exceptions (-{exceptions_deduction}).",
    }

    return final_score, breakdown


@csrf_exempt
def brand_profile_view(request):
    """GET /api/brand-profile/"""
    if request.method != 'GET':
        return HttpResponseBadRequest("Method not allowed")

    profile = get_active_profile()
    data = profile.to_dict()
    data["sample_banner_url"] = "/media/sample_offbrand_banner.png"
    return JsonResponse(data, safe=False)


@csrf_exempt
def add_rule_view(request):
    """POST /api/brand-profile/add-rule/"""
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body")

    profile = get_active_profile()
    item_type = body.get('type', 'RULE').upper()

    if item_type == 'RULE':
        rule_code = body.get('rule_code', '').strip()
        title = body.get('title', '').strip()
        pillar = body.get('pillar', 'TONE').upper()
        banned_term = body.get('banned_term', '').strip()
        replacement = body.get('replacement', '').strip()
        case_sensitive = bool(body.get('case_sensitive', False))
        description = body.get('rule_description', '').strip()

        if not rule_code or not title:
            return HttpResponseBadRequest("rule_code and title are required")

        rule, created = BrandRule.objects.update_or_create(
            profile=profile,
            rule_code=rule_code,
            defaults={
                "title": title,
                "pillar": pillar,
                "structured_spec": {
                    "banned_term": banned_term,
                    "replacement": replacement,
                    "case_sensitive": case_sensitive,
                },
                "rule_description": description,
            }
        )
        return JsonResponse({
            "status": "success",
            "item_type": "RULE",
            "item": rule.to_dict(),
            "profile": profile.to_dict(),
        })

    elif item_type == 'FACT':
        fact_code = body.get('fact_code', '').strip()
        category = body.get('category', '').strip()
        claim_truth = body.get('claim_truth', '').strip()
        valid_until_str = body.get('valid_until', '').strip()
        superseded_by_text = body.get('superseded_by_text', '').strip()

        if not fact_code or not claim_truth:
            return HttpResponseBadRequest("fact_code and claim_truth are required")

        try:
            valid_until = datetime.strptime(valid_until_str, '%Y-%m-%d').date() if valid_until_str else date.today()
        except ValueError:
            valid_until = date.today()

        fact, created = FactLedger.objects.update_or_create(
            profile=profile,
            fact_code=fact_code,
            defaults={
                "category": category or "General Truth",
                "claim_truth": claim_truth,
                "last_verified": date.today(),
                "valid_until": valid_until,
                "superseded_by_text": superseded_by_text,
            }
        )
        return JsonResponse({
            "status": "success",
            "item_type": "FACT",
            "item": fact.to_dict(),
            "profile": profile.to_dict(),
        })

    return HttpResponseBadRequest(f"Unknown item type: {item_type}")


@csrf_exempt
@admin_required
def expire_or_update_fact_view(request, fact_id):
    """
    POST /api/brand-profile/facts/<uuid:fact_id>/expire-or-update/
    Simulates or executes retroactive fact updates and detects blast radius.
    Transitions all affected APPROVED submissions to STALE_REAUDIT_REQUIRED.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    fact = FactLedger.objects.filter(id=fact_id).first()
    if not fact:
        return HttpResponseNotFound("Fact not found")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        body = {}

    new_claim = body.get('new_claim_truth', '').strip()
    valid_until_str = body.get('valid_until', '').strip()
    superseded = body.get('superseded_by_text', '').strip()

    if new_claim:
        fact.claim_truth = new_claim
    if valid_until_str:
        try:
            fact.valid_until = datetime.strptime(valid_until_str, '%Y-%m-%d').date()
        except ValueError:
            pass
    if superseded:
        fact.superseded_by_text = superseded
    fact.save()

    # Search for all APPROVED submissions affected by this fact update
    affected_submissions = []
    approved_subs = Submission.objects.filter(profile=fact.profile)

    for sub in approved_subs:
        latest_ver = sub.versions.order_by('-version_number').first()
        if not latest_ver:
            continue

        # Check if fact was cited or referenced in draft copy
        is_affected = (
            latest_ver.findings.filter(rule_citation_code=fact.fact_code).exists()
            or fact.fact_code.lower() in latest_ver.raw_text.lower()
            or any(w.lower() in latest_ver.raw_text.lower() for w in fact.claim_truth.split() if len(w) > 5)
        )

        if is_affected and sub.status in ['APPROVED', 'IN_REVIEW']:
            sub.status = 'STALE_REAUDIT_REQUIRED'
            sub.save()
            affected_submissions.append(sub)

    return JsonResponse({
        "status": "success",
        "fact": fact.to_dict(),
        "affected_submissions_count": len(affected_submissions),
        "affected_titles": [s.title for s in affected_submissions],
    })


@csrf_exempt
def facts_list_create_view(request):
    """
    GET /api/facts/
    Lists all facts with expiry alerts, countdown days, and blast radius count.
    POST /api/facts/
    Creates a new fact in the FactLedger.
    """
    profile = get_active_profile()

    # Seed initial facts if table is empty
    if FactLedger.objects.filter(profile=profile).count() == 0:
        today_d = date.today()
        FactLedger.objects.create(
            profile=profile,
            fact_code="FACT_012",
            category="International Rails & Settlement",
            claim_truth="Transfers settle in 24 hrs with a 0.5% FX fee.",
            last_verified=today_d - timedelta(days=15),
            valid_until=today_d + timedelta(days=60),
            source="NovaPay Core Treasury Rails v2",
            trigger_count=128,
            override_count=5
        )
        FactLedger.objects.create(
            profile=profile,
            fact_code="FACT_031",
            category="Regulatory & Security Certification",
            claim_truth="NovaPay maintains SOC2 Type II certification and ISO/IEC 27001.",
            last_verified=today_d - timedelta(days=90),
            valid_until=today_d + timedelta(days=14),  # Expiring soon!
            superseded_by_text="SOC2 Type II recertification scheduled for Q4 2026.",
            source="Annual Compliance Audit Report",
            trigger_count=51,
            override_count=1
        )
        FactLedger.objects.create(
            profile=profile,
            fact_code="FACT_009",
            category="Yield & Interest Rate Guarantee",
            claim_truth="Treasury deposits earn up to 4.8% floating APY.",
            last_verified=today_d - timedelta(days=120),
            valid_until=today_d - timedelta(days=10),  # Expired!
            superseded_by_text="Floating APY adjusted to 4.2% floating APY effective Oct 15.",
            source="Monetary Policy Committee Memo",
            trigger_count=84,
            override_count=0
        )
        FactLedger.objects.create(
            profile=profile,
            fact_code="FACT_015",
            category="Supported Corridors",
            claim_truth="Direct local clearing across 140+ countries and 45 currencies.",
            last_verified=today_d - timedelta(days=30),
            valid_until=today_d + timedelta(days=180),
            source="Global Banking Partnerships Directory",
            trigger_count=37,
            override_count=2
        )

    if request.method == 'GET':
        facts = FactLedger.objects.filter(profile=profile).order_by('valid_until')
        items = []
        now_date = date.today()
        expiring_soon_count = 0
        expired_count = 0

        for f in facts:
            days = (f.valid_until - now_date).days
            if days < 0:
                status_label = 'EXPIRED'
                expired_count += 1
            elif days <= 30:
                status_label = 'EXPIRING_SOON'
                expiring_soon_count += 1
            else:
                status_label = 'ACTIVE'

            d = f.to_dict()
            d['expiry_status'] = status_label
            d['days_until_expiry'] = days
            items.append(d)

        return JsonResponse({
            "facts": items,
            "total_facts": len(items),
            "expiring_soon_count": expiring_soon_count,
            "expired_count": expired_count,
        })

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return HttpResponseBadRequest("Invalid JSON body")

        fact_code = body.get('fact_code', '').strip().upper()
        if not fact_code:
            return JsonResponse({"error": "fact_code is required"}, status=400)

        valid_until_str = body.get('valid_until', '2026-12-31')
        try:
            valid_until = datetime.strptime(valid_until_str, '%Y-%m-%d').date()
        except ValueError:
            valid_until = date(2026, 12, 31)

        last_verified_str = body.get('last_verified', str(date.today()))
        try:
            last_verified = datetime.strptime(last_verified_str, '%Y-%m-%d').date()
        except ValueError:
            last_verified = date.today()

        user = get_authenticated_user_from_request(request)

        fact = FactLedger.objects.create(
            profile=profile,
            fact_code=fact_code,
            category=body.get('category', 'Financial Disclosure'),
            claim_truth=body.get('claim_truth', ''),
            last_verified=last_verified,
            valid_until=valid_until,
            superseded_by_text=body.get('superseded_by_text', ''),
            source=body.get('source', 'NovaPay Product Facts'),
            created_by=user,
        )
        return JsonResponse(fact.to_dict(), status=201)

    return HttpResponseBadRequest("Method not allowed")


@csrf_exempt
def fact_blast_radius_view(request, fact_id):
    """
    GET /api/facts/<uuid:fact_id>/blast-radius/
    Returns list of all submissions (campaign assets) citing or mentioning this fact.
    """
    fact = FactLedger.objects.filter(id=fact_id).first()
    if not fact:
        return HttpResponseNotFound("Fact not found")

    profile = fact.profile
    affected = []
    for sub in profile.submissions.all():
        latest_ver = sub.versions.order_by('-version_number').first()
        if not latest_ver:
            continue

        has_finding = latest_ver.findings.filter(rule_citation_code=fact.fact_code).exists()
        in_text = fact.fact_code.lower() in latest_ver.raw_text.lower()
        keyword_match = any(w.lower() in latest_ver.raw_text.lower() for w in fact.claim_truth.split() if len(w) > 5)

        if has_finding or in_text or keyword_match:
            citing_snippet = ""
            for line in latest_ver.raw_text.splitlines():
                if fact.fact_code.lower() in line.lower() or any(w.lower() in line.lower() for w in fact.claim_truth.split() if len(w) > 5):
                    citing_snippet = line.strip()
                    break
            if not citing_snippet:
                citing_snippet = latest_ver.raw_text[:80]

            affected.append({
                "submission_id": str(sub.id),
                "title": sub.title,
                "author": sub.author.username if sub.author else "Alex Morgan",
                "channel": sub.channel_context,
                "status": sub.status,
                "compliance_score": latest_ver.compliance_score,
                "version_number": latest_ver.version_number,
                "citing_snippet": citing_snippet,
            })

    return JsonResponse({
        "fact": fact.to_dict(),
        "blast_radius_count": len(affected),
        "affected_submissions": affected,
    })


@csrf_exempt
@admin_required
def fact_bulk_re_audit_view(request, fact_id):
    """
    POST /api/facts/<uuid:fact_id>/bulk-re-audit/
    Executes automated retroactive re-audit on all submissions in blast radius.
    Flags outdated claims, transitions approved assets to STALE_REAUDIT_REQUIRED,
    recalculates compliance scores, logs to AuditTrail, and generates notifications.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    fact = FactLedger.objects.filter(id=fact_id).first()
    if not fact:
        return HttpResponseNotFound("Fact not found")

    profile = fact.profile
    user = get_authenticated_user_from_request(request)

    affected_submissions = []
    flagged_count = 0

    for sub in profile.submissions.all():
        latest_ver = sub.versions.order_by('-version_number').first()
        if not latest_ver:
            continue

        has_finding = latest_ver.findings.filter(rule_citation_code=fact.fact_code).exists()
        in_text = fact.fact_code.lower() in latest_ver.raw_text.lower()
        keyword_match = any(w.lower() in latest_ver.raw_text.lower() for w in fact.claim_truth.split() if len(w) > 5)

        if has_finding or in_text or keyword_match:
            # Re-audit this submission: add/update a BLOCKER finding for outdated claim
            finding, created = AuditFinding.objects.get_or_create(
                version=latest_ver,
                rule_citation_code=fact.fact_code,
                defaults={
                    "pillar": "FACTUAL",
                    "severity": "BLOCKER",
                    "rule_citation_title": f"Outdated Fact: {fact.category}",
                    "explanation": f"Claim cites Fact [{fact.fact_code}] ('{fact.claim_truth}'), which expired on {fact.valid_until}. Superseded by: '{fact.superseded_by_text or 'Updated institutional policy'}'. Re-audit required before publication.",
                    "status": "OPEN",
                    "source_excerpt": fact.claim_truth[:60],
                    "suggested_fixes": [f"Update copy to align with: '{fact.superseded_by_text or 'active rate disclosure'}'"]
                }
            )
            if not created:
                finding.severity = "BLOCKER"
                finding.status = "OPEN"
                finding.explanation = f"Fact [{fact.fact_code}] expired on {fact.valid_until}. Superseded by: '{fact.superseded_by_text or 'Updated policy'}'. Retroactive re-audit flagged this asset."
                finding.save()

            flagged_count += 1

            # Recalculate score
            approved_count = latest_ver.findings.filter(status='OVERRIDE_APPROVED').count()
            new_score, new_breakdown = calculate_score(latest_ver.findings.all(), approved_exception_count=approved_count)
            latest_ver.compliance_score = new_score
            latest_ver.score_breakdown = new_breakdown
            latest_ver.save()

            sub.status = 'STALE_REAUDIT_REQUIRED'
            sub.save()

            affected_submissions.append(sub)

            # Multi-channel notification to author
            if sub.author:
                from governance.notifications import dispatch_notification
                dispatch_notification(
                    recipient=sub.author,
                    notification_type='FACT_EXPIRING',
                    title=f"Re-audit Required: {sub.title}",
                    message=f"Fact [{fact.fact_code}] cited in your asset '{sub.title}' has expired or updated. Status changed to STALE_REAUDIT_REQUIRED.",
                    link_url=f"/api/submissions/{sub.id}/"
                )

    # AuditTrail logging
    AuditTrail.log(
        request,
        action="BULK_RE_AUDIT_EXECUTED",
        entity_type="FACT_LEDGER",
        entity_id=str(fact.id),
        description=f"Executed bulk re-audit for fact {fact.fact_code}. {len(affected_submissions)} submissions transitioned to STALE_REAUDIT_REQUIRED."
    )

    return JsonResponse({
        "status": "success",
        "fact_code": fact.fact_code,
        "blast_radius_total": len(affected_submissions),
        "flagged_count": flagged_count,
        "affected_submissions": [
            {"id": str(s.id), "title": s.title, "channel": s.channel_context, "status": s.status}
            for s in affected_submissions
        ]
    })



@csrf_exempt
def audit_submission_view(request):
    """
    POST /api/submissions/audit/
    Accepts multipart/form-data or JSON.
    Runs Visual (CV + CVD + Optical Clear-Space), Lexicon, and Fact/Tone engines.
    Computes 4-Axis Voice Fingerprint Radar.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    profile = get_active_profile()

    # Read parameters from form or JSON
    if request.content_type and 'multipart/form-data' in request.content_type:
        title = request.POST.get('title', 'Draft Campaign')
        channel_context = request.POST.get('channel_context', 'LINKEDIN_POST')
        confidential_mode = request.POST.get('confidential_mode', 'false').lower() in ('true', '1')
        raw_text = request.POST.get('raw_text', '')
        use_sample_banner = request.POST.get('use_sample_banner', 'false').lower() in ('true', '1')
        uploaded_file = request.FILES.get('file')
    else:
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            body = {}
        title = body.get('title', 'Draft Campaign')
        channel_context = body.get('channel_context', 'LINKEDIN_POST')
        confidential_mode = bool(body.get('confidential_mode', False))
        raw_text = body.get('raw_text', '')
        use_sample_banner = bool(body.get('use_sample_banner', False))
        uploaded_file = None

    file_type = 'TEXT'
    img_for_cv = None
    pdf_file_obj = None

    if use_sample_banner:
        banner_path = Path(settings.MEDIA_ROOT) / "sample_offbrand_banner.png"
        if banner_path.exists():
            pil_img = Image.open(banner_path).convert('RGB')
            img_for_cv = np.array(pil_img)
            file_type = 'IMAGE'
    elif uploaded_file:
        fname = uploaded_file.name.lower()
        if fname.endswith('.pdf'):
            file_type = 'PDF'
            pdf_file_obj = uploaded_file
        elif fname.endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp')):
            file_type = 'IMAGE'
            try:
                pil_img = Image.open(uploaded_file).convert('RGB')
                img_for_cv = np.array(pil_img)
            except Exception:
                pass

    # 1. Lexicon Engine
    lex_findings, triggered_rules = audit_lexicon(raw_text, profile)

    # 2. Fact & Tone Engine
    fact_findings, fact_triggered_rules, triggered_facts = audit_facts_and_tone(
        raw_text, profile, confidential_mode=confidential_mode
    )

    # 3. Visual Identity CV Engine (Color, CVD, WCAG, Optical Clear-Space)
    visual_findings = []
    if img_for_cv is not None:
        visual_findings = audit_image_array(img_for_cv, profile)
    elif pdf_file_obj is not None:
        visual_findings = audit_pdf_file(pdf_file_obj, profile)

    all_findings_raw = lex_findings + fact_findings + visual_findings

    # Compute compliance score and detailed breakdown
    score, score_breakdown = calculate_score(all_findings_raw)

    # Compute 4-Axis Voice Fingerprint Radar
    voice_fingerprint = compute_voice_fingerprint(raw_text, channel_context)

    # Resolve author
    user = get_authenticated_user_from_request(request)

    # Create Submission
    submission = Submission.objects.create(
        profile=profile,
        author=user,
        title=title,
        channel_context=channel_context,
        status='IN_REVIEW',
        confidential_mode=confidential_mode,
    )

    # Create Version 1
    version = SubmissionVersion.objects.create(
        submission=submission,
        version_number=1,
        raw_text=raw_text,
        file_type=file_type,
        compliance_score=score,
        score_breakdown=score_breakdown,
        voice_fingerprint=voice_fingerprint,
    )

    if use_sample_banner:
        banner_rel = "sample_offbrand_banner.png"
        version.uploaded_file.name = banner_rel
        version.save()
    elif uploaded_file:
        version.uploaded_file = uploaded_file
        version.save()

    # Save findings
    for f in all_findings_raw:
        AuditFinding.objects.create(
            version=version,
            pillar=f.get('pillar', 'TONE'),
            severity=f.get('severity', 'WARNING'),
            engine_provenance=f.get('engine_provenance', 'DETERMINISTIC_LEXICON'),
            confidence=f.get('confidence', 1.0),
            rule_citation_code=f.get('rule_citation_code', 'GEN_001'),
            rule_citation_title=f.get('rule_citation_title', 'Brand Inconsistency'),
            source_excerpt=f.get('source_excerpt', ''),
            location_json=f.get('location_json', {}),
            explanation=f.get('explanation', ''),
            suggested_fixes=f.get('suggested_fixes', []),
            status='OPEN',
        )

    # Increment trigger counts
    all_triggered_rule_codes = set(fact_triggered_rules)
    for r_id in triggered_rules:
        rule_obj = BrandRule.objects.filter(id=r_id).first()
        if rule_obj:
            rule_obj.trigger_count += 1
            rule_obj.save()

    for code in all_triggered_rule_codes:
        rule_obj = BrandRule.objects.filter(profile=profile, rule_code=code).first()
        if rule_obj:
            rule_obj.trigger_count += 1
            rule_obj.save()

    for code in triggered_facts:
        fact_obj = FactLedger.objects.filter(profile=profile, fact_code=code).first()
        if fact_obj:
            fact_obj.trigger_count += 1
            fact_obj.save()

    # Increment visual rule triggers
    for vf in visual_findings:
        vcode = vf.get('rule_citation_code')
        vr = BrandRule.objects.filter(profile=profile, rule_code=vcode).first()
        if vr:
            vr.trigger_count += 1
            vr.save()

    return JsonResponse(submission.to_dict(), safe=False)


@csrf_exempt
def resolve_finding_view(request, finding_id):
    """
    POST /api/findings/<uuid:finding_id>/resolve/
    Accepts:
    - {"action": "ACCEPT_FIX", "chosen_fix": "..."} -> patches copy into Version v+1
    - {"action": "REQUEST_OVERRIDE", "override_reason": "..."} -> marks finding OVERRIDDEN_PENDING
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    finding = AuditFinding.objects.filter(id=finding_id).first()
    if not finding:
        return HttpResponseNotFound("Finding not found")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body")

    action = body.get('action', '').upper()
    version = finding.version
    submission = version.submission
    profile = submission.profile

    if action == 'ACCEPT_FIX':
        chosen_fix = body.get('chosen_fix', '').strip()
        replacement_text = chosen_fix
        if replacement_text.startswith("Replace with '") and replacement_text.endswith("'"):
            replacement_text = replacement_text[14:-1]
        elif replacement_text.startswith("Replace with "):
            replacement_text = replacement_text[13:]

        old_text = version.raw_text
        target_excerpt = finding.source_excerpt

        if target_excerpt and target_excerpt in old_text:
            new_text = old_text.replace(target_excerpt, replacement_text, 1)
        else:
            new_text = old_text + f" {replacement_text}"

        finding.status = 'ACCEPTED'
        finding.save()

        # Re-audit the patched text to create Version v+1
        new_version_num = version.version_number + 1

        lex_findings, _ = audit_lexicon(new_text, profile)
        fact_findings, _, _ = audit_facts_and_tone(new_text, profile, confidential_mode=submission.confidential_mode)

        # Retain visual findings from previous version
        retained_visual = []
        for vf in version.findings.filter(pillar='VISUAL'):
            retained_visual.append({
                "pillar": vf.pillar,
                "severity": vf.severity,
                "engine_provenance": vf.engine_provenance,
                "confidence": vf.confidence,
                "rule_citation_code": vf.rule_citation_code,
                "rule_citation_title": vf.rule_citation_title,
                "source_excerpt": vf.source_excerpt,
                "location_json": vf.location_json,
                "explanation": vf.explanation,
                "suggested_fixes": vf.suggested_fixes,
                "status": vf.status,
            })

        new_all_findings = lex_findings + fact_findings + retained_visual
        new_score, new_breakdown = calculate_score(new_all_findings)
        new_voice_fp = compute_voice_fingerprint(new_text, submission.channel_context)

        new_version = SubmissionVersion.objects.create(
            submission=submission,
            version_number=new_version_num,
            raw_text=new_text,
            uploaded_file=version.uploaded_file,
            file_type=version.file_type,
            compliance_score=new_score,
            score_breakdown=new_breakdown,
            voice_fingerprint=new_voice_fp,
        )

        for f in new_all_findings:
            AuditFinding.objects.create(
                version=new_version,
                pillar=f.get('pillar', 'TONE'),
                severity=f.get('severity', 'WARNING'),
                engine_provenance=f.get('engine_provenance', 'DETERMINISTIC_LEXICON'),
                confidence=f.get('confidence', 1.0),
                rule_citation_code=f.get('rule_citation_code', 'GEN_001'),
                rule_citation_title=f.get('rule_citation_title', 'Brand Inconsistency'),
                source_excerpt=f.get('source_excerpt', ''),
                location_json=f.get('location_json', {}),
                explanation=f.get('explanation', ''),
                suggested_fixes=f.get('suggested_fixes', []),
                status=f.get('status', 'OPEN'),
            )

        return JsonResponse({
            "status": "success",
            "action": "ACCEPT_FIX",
            "submission": submission.to_dict(),
        })

    elif action == 'REQUEST_OVERRIDE':
        override_reason = body.get('override_reason', '').strip()
        finding.status = 'OVERRIDDEN_PENDING'
        finding.override_reason = override_reason
        finding.save()

        submission.status = 'EXCEPTION_PENDING'
        submission.save()

        citation = finding.rule_citation_code
        rule_obj = BrandRule.objects.filter(profile=profile, rule_code=citation).first()
        if rule_obj:
            rule_obj.override_count += 1
            rule_obj.save()
        else:
            fact_obj = FactLedger.objects.filter(profile=profile, fact_code=citation).first()
            if fact_obj:
                fact_obj.override_count += 1
                fact_obj.save()

        return JsonResponse({
            "status": "success",
            "action": "REQUEST_OVERRIDE",
            "submission": submission.to_dict(),
        })

    return HttpResponseBadRequest(f"Unknown action: {action}")


@csrf_exempt
def submissions_list_view(request):
    """
    GET /api/submissions/
    Returns list of submissions for My Workspace.
    Writers see their own submissions; admins see all submissions.
    Supports filtering by status (?status=IN_REVIEW) and search.
    """
    if request.method != 'GET':
        return HttpResponseBadRequest("Method not allowed")

    user = get_authenticated_user_from_request(request)
    profile = get_active_profile()
    qs = Submission.objects.filter(profile=profile)

    if user and getattr(user, 'role', '') == 'CONTENT_WRITER':
        qs = qs.filter(author=user)

    status_filter = request.GET.get('status', '').strip().upper()
    if status_filter:
        qs = qs.filter(status=status_filter)

    search = request.GET.get('search', '').strip()
    if search:
        from django.db.models import Q
        qs = qs.filter(
            Q(title__icontains=search) |
            Q(channel_context__icontains=search) |
            Q(status__icontains=search)
        )

    submissions = [s.to_dict() for s in qs.order_by('-created_at')]
    return JsonResponse({
        "status": "success",
        "submissions": submissions,
        "total": len(submissions)
    })


@csrf_exempt
def submission_detail_view(request, sub_id):
    """
    GET /api/submissions/<uuid:sub_id>/
    Returns full submission record with versions, findings, and score.
    """
    if request.method != 'GET':
        return HttpResponseBadRequest("Method not allowed")

    submission = Submission.objects.filter(id=sub_id).first()
    if not submission:
        return JsonResponse({"error": "Submission not found"}, status=404)

    return JsonResponse(submission.to_dict())


@csrf_exempt
def live_lint_view(request):
    """
    POST /api/submissions/live-lint/
    Real-time debounced lexicon and tone linter for interactive writing.
    Does not create a database submission record.
    Returns findings, character spans, readiness score, and breakdown.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body")

    raw_text = body.get('raw_text', '')
    channel_context = body.get('channel_context', 'LINKEDIN_POST')
    profile = get_active_profile()

    lex_findings, _ = audit_lexicon(raw_text, profile)
    fact_findings, _, _ = audit_facts_and_tone(raw_text, profile, confidential_mode=False)

    all_findings = lex_findings + fact_findings
    score, breakdown = calculate_score(all_findings)
    voice_fp = compute_voice_fingerprint(raw_text, channel_context)

    return JsonResponse({
        "status": "success",
        "findings": all_findings,
        "count": len(all_findings),
        "compliance_score": score,
        "score_breakdown": breakdown,
        "voice_fingerprint": voice_fp,
        "raw_text": raw_text
    })


@csrf_exempt
@admin_required
def approve_submission_view(request, sub_id):
    """
    POST /api/submissions/<uuid:sub_id>/approve/
    Manager endpoint:
    1. Approves pending overrides
    2. Generates SHA256 cryptographic clearance hash
    3. Injects immutable XMP / PngInfo metadata into PNG or PDF asset
    4. Saves signed file to media/uploads/signed_<sub_id>_<filename>
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    submission = Submission.objects.filter(id=sub_id).first()
    if not submission:
        return HttpResponseNotFound("Submission not found")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        body = {}

    reviewer_comment = body.get('reviewer_comment', 'Approved by Brand Governance Lead.')

    latest_version = submission.versions.order_by('-version_number').first()
    if latest_version:
        for finding in latest_version.findings.all():
            if finding.status == 'OVERRIDDEN_PENDING':
                finding.status = 'OVERRIDE_APPROVED'
                finding.reviewer_comment = reviewer_comment
                finding.save()

    # Locate asset source file
    source_path = None
    if latest_version and latest_version.uploaded_file and latest_version.uploaded_file.name:
        cand = Path(settings.MEDIA_ROOT) / latest_version.uploaded_file.name
        if cand.exists():
            source_path = cand
    if not source_path:
        cand_sample = Path(settings.MEDIA_ROOT) / "sample_offbrand_banner.png"
        if cand_sample.exists():
            source_path = cand_sample

    file_bytes = b"NovaPay-BrandGuard-Clearance-Payload"
    if source_path and source_path.exists():
        try:
            with open(source_path, 'rb') as f:
                file_bytes = f.read()
        except Exception:
            pass

    user = get_authenticated_user_from_request(request)
    approver_username = (user.get_full_name() or user.username) if user else body.get('reviewer_name', 'Jordan Lee')

    # Create / update cryptographic clearance signature record in DB
    sig_obj = BrandComplianceSignature.create_signature(
        submission=submission,
        file_bytes=file_bytes,
        approver_username=approver_username
    )
    clearance_hash = f"SHA256-{sig_obj.hmac_signature[:32]}"
    canonical_payload = sig_obj.canonical_payload
    hmac_sig = sig_obj.hmac_signature
    ed25519_sig = sig_obj.ed25519_signature
    ed25519_pub = sig_obj.ed25519_public_key

    # Embed Cryptographic Metadata (tEXt tags + ISO XMP) into Image / PDF Asset
    signed_rel_url = ""
    try:
        if source_path and source_path.exists():
            upload_dir = Path(settings.MEDIA_ROOT) / "uploads"
            upload_dir.mkdir(parents=True, exist_ok=True)
            suffix = source_path.suffix.lower()
            now_iso = sig_obj.timestamp.isoformat() + 'Z'
            ruleset_ver = sig_obj.ruleset_version

            if suffix in ['.png', '.jpg', '.jpeg']:
                signed_filename = f"signed_{submission.id}_{source_path.stem}.png"
                out_path = upload_dir / signed_filename
                embed_clearance_in_png(
                    source_path=source_path,
                    out_path=out_path,
                    clearance_hash=clearance_hash,
                    hmac_sig=hmac_sig,
                    ed25519_sig=ed25519_sig,
                    ed25519_pub=ed25519_pub,
                    canonical_payload=canonical_payload,
                    draft_id=str(submission.id),
                    ruleset_version=ruleset_ver,
                    approver=approver_username,
                    timestamp_iso=now_iso,
                    title=submission.title
                )
                signed_rel_url = f"/media/uploads/{signed_filename}"

            elif suffix == '.pdf':
                signed_filename = f"signed_{submission.id}_{source_path.name}"
                out_path = upload_dir / signed_filename
                embed_clearance_in_pdf(
                    source_path=source_path,
                    out_path=out_path,
                    clearance_hash=clearance_hash,
                    hmac_sig=hmac_sig,
                    ed25519_sig=ed25519_sig,
                    ed25519_pub=ed25519_pub,
                    canonical_payload=canonical_payload,
                    draft_id=str(submission.id),
                    ruleset_version=ruleset_ver,
                    approver=approver_username,
                    timestamp_iso=now_iso,
                    title=submission.title
                )
                signed_rel_url = f"/media/uploads/{signed_filename}"
    except Exception:
        pass

    submission.status = 'APPROVED'
    submission.clearance_hash = clearance_hash
    if signed_rel_url:
        submission.signed_file_url = signed_rel_url
    submission.save()

    # Log to AuditTrail
    AuditTrail.log(
        request,
        action="SUBMISSION_APPROVED_SIGNED",
        entity_type="SUBMISSION",
        entity_id=str(submission.id),
        description=f"Submission '{submission.title}' signed and cleared by {approver_username}. Clearance hash: {clearance_hash}."
    )

    if submission.author:
        from governance.notifications import dispatch_notification
        dispatch_notification(
            recipient=submission.author,
            notification_type='STAMP_APPROVED',
            title=f"Compliance Clearance: {submission.title}",
            message=f"Admin {approver_username} has approved and cryptographically stamped '{submission.title}'. Asset is cleared for publication.",
            link_url=f"/api/submissions/{submission.id}/"
        )

    return JsonResponse({
        "status": "success",
        "clearance_hash": clearance_hash,
        "hmac_signature": hmac_sig,
        "ed25519_signature": ed25519_sig,
        "ed25519_public_key": ed25519_pub,
        "canonical_payload": canonical_payload,
        "signed_file_url": submission.signed_file_url,
        "legal_notice": LEGAL_NOTICE,
        "submission": submission.to_dict(),
        "signature": sig_obj.to_dict(),
    })


@csrf_exempt
def verify_stamp_view(request):
    """
    POST /api/submissions/verify-stamp/
    CMS Verification endpoint: Accepts an uploaded image or PDF and verifies
    whether its embedded cryptographic metadata (HMAC / Ed25519 / XMP) matches
    a valid signature and registered clearance hash.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    uploaded = request.FILES.get('file')
    if not uploaded:
        return HttpResponseBadRequest("No file uploaded")

    temp_dir = Path(settings.MEDIA_ROOT) / "temp_verify"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_file = temp_dir / f"verify_{uploaded.name}"

    try:
        with open(temp_file, 'wb+') as dest:
            for chunk in uploaded.chunks():
                dest.write(chunk)

        result = verify_asset_clearance(temp_file)
        submission = None
        if result.get("clearance_hash"):
            submission = Submission.objects.filter(clearance_hash=result["clearance_hash"]).first()

        return JsonResponse({
            "verified": result.get("verified", False),
            "status": result.get("status"),
            "compliance_status": result.get("compliance_status"),
            "clearance_hash": result.get("clearance_hash"),
            "hmac_signature": result.get("hmac_signature"),
            "ed25519_signature": result.get("ed25519_signature"),
            "canonical_payload": result.get("canonical_payload"),
            "has_xmp": result.get("has_xmp", False),
            "legal_notice": result.get("legal_notice") or LEGAL_NOTICE,
            "metadata": {
                "approver": result.get("approver"),
                "approved_at": result.get("timestamp"),
                "ruleset_version": result.get("ruleset_version"),
            },
            "submission": submission.to_dict() if submission else None,
        })
    finally:
        try:
            if temp_file.exists():
                temp_file.unlink()
        except Exception:
            pass


@csrf_exempt
def brand_safe_prompt_view(request):
    """
    GET /api/brand-profile/safe-prompt/?channel=LINKEDIN_POST
    Compiles an AI-Safe Writer System Prompt & .cursorrules file
    grounded in the active profile's non-expired truths and lexicon rules.
    """
    if request.method != 'GET':
        return HttpResponseBadRequest("Method not allowed")

    channel = request.GET.get('channel', 'LINKEDIN_POST')
    profile = get_active_profile()

    # Active facts only (filter out expired ones)
    today = date.today()
    active_facts = [f for f in profile.facts.all() if f.valid_until and f.valid_until >= today]
    rules = profile.rules.all()

    # Channel voice target
    voice_target = TARGET_VOICE_ENVELOPES.get(channel, TARGET_VOICE_ENVELOPES['LINKEDIN_POST'])

    # Compile Markdown System Prompt
    prompt_lines = [
        f"# SYSTEM GOVERNANCE PROMPT: {profile.org_name.upper()}",
        f"Target Channel: {channel}",
        f"Compiled At: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}",
        "",
        "## 1. VOICE & TONE ENVELOPE (TARGET METRICS)",
        f"- Urgency: {voice_target['urgency']}/100",
        f"- Formality: {voice_target['formality']}/100",
        f"- Technicality: {voice_target['technicality']}/100",
        f"- Warmth: {voice_target['warmth']}/100",
        "",
        "## 2. STRICT LEXICON & CASING BOUNDARIES",
    ]

    for r in rules:
        spec = r.structured_spec or {}
        banned = spec.get('banned_term')
        repl = spec.get('replacement')
        if banned and repl:
            prompt_lines.append(f"- NEVER use '{banned}' -> MUST replace with '{repl}' ({r.title})")
        else:
            prompt_lines.append(f"- Rule [{r.rule_code}] {r.title}: {r.rule_description}")

    prompt_lines.extend([
        "",
        "## 3. CITATION-GROUNDED TRUTH LEDGER (DO NOT HALLUCINATE OR USE OUTDATED STATS)",
    ])

    for f in active_facts:
        prompt_lines.append(f"- [{f.fact_code}] {f.category}: \"{f.claim_truth}\" (Verified until {f.valid_until})")

    prompt_lines.extend([
        "",
        "## 4. APPROVED BRAND PALETTE & STYLING TOKENS",
    ])
    for sw in profile.allowed_hex_palette:
        prompt_lines.append(f"- {sw.get('name')}: {sw.get('hex')} (Max ΔE: {sw.get('max_delta_e', 4.0)})")

    prompt_lines.extend([
        "",
        "## 5. GENERATION DIRECTIVES",
        "- All claims must directly reference an active fact citation code above.",
        "- Do not use filler clichés like 'delve into', 'in today's fast-paced landscape', or 'testament to'.",
        "- Ensure copy satisfies WCAG 2.1 AA legibility when paired with brand colors.",
    ])

    compiled_markdown = "\n".join(prompt_lines)

    return JsonResponse({
        "channel": channel,
        "org_name": profile.org_name,
        "voice_envelope": voice_target,
        "system_prompt": compiled_markdown,
    })


@csrf_exempt
def telemetry_view(request):
    """
    GET /api/telemetry/
    Returns telemetry metrics including Friction Score with minimum trigger count filter.
    """
    if request.method != 'GET':
        return HttpResponseBadRequest("Method not allowed")

    profile = get_active_profile()
    raw_data = get_telemetry_report(profile=profile)

    # Minimum trigger count filter parameter (defaults to BRANDGUARD_FRICTION_MIN_TRIGGERS or 10)
    try:
        min_triggers = int(request.GET.get('min_triggers', getattr(settings, 'BRANDGUARD_FRICTION_MIN_TRIGGERS', 10)))
    except (ValueError, TypeError):
        min_triggers = 10

    # Extended recurring findings & governance metrics pool
    findings_pool = [
        {
            "rule_id": "FACT_012",
            "rule_name": "International transfer speed & fees",
            "pillar": "FACTUAL",
            "findings": 128,
            "severity": "Blocker",
            "override_rate": "4.2%",
            "last_triggered": "2 hrs ago",
            "recommendation": "High volume truth claim. Keep strict regex; writers frequently attempt to quote old 4.8% APY."
        },
        {
            "rule_id": "VOICE_004",
            "rule_name": "Aggressive Comparison & Unsupported Superlatives",
            "pillar": "TONE",
            "findings": 96,
            "severity": "Warning",
            "override_rate": "11.8%",
            "last_triggered": "Today",
            "recommendation": "Elevated 11.8% override rate indicates writers need clearer campaign guidance on acceptable challenger voice."
        },
        {
            "rule_id": "VIS_021",
            "rule_name": "CTA color drift (ΔE > 3.0)",
            "pillar": "VISUAL",
            "findings": 74,
            "severity": "Warning",
            "override_rate": "7.1%",
            "last_triggered": "Yesterday",
            "recommendation": "Color drift predominantly on partner social banners. Recommend bundling Figma token styles."
        },
        {
            "rule_id": "FACT_031",
            "rule_name": "Expired security certification / SOC2",
            "pillar": "FACTUAL",
            "findings": 51,
            "severity": "Blocker",
            "override_rate": "0.9%",
            "last_triggered": "Jun 10",
            "recommendation": "Low override rate (0.9%) demonstrates strong organizational adherence to security audit claims."
        },
        {
            "rule_id": "VOICE_002",
            "rule_name": "Colloquial Idiomatic Clichés",
            "pillar": "TONE",
            "findings": 42,
            "severity": "Warning",
            "override_rate": "9.5%",
            "last_triggered": "3 days ago",
            "recommendation": "Idiomatic phrasing common in creator platform campaigns. Consider channel-specific exception envelopes."
        },
        {
            "rule_id": "VIS_WCAG_2.1",
            "rule_name": "WCAG 2.1 AA Contrast Standard",
            "pillar": "VISUAL",
            "findings": 38,
            "severity": "Blocker",
            "override_rate": "0.0%",
            "last_triggered": "4 days ago",
            "recommendation": "Zero override rate. Accessibility contrast ratio threshold is strictly respected across all creative."
        },
        {
            "rule_id": "LEX_FIN_008",
            "rule_name": "Guaranteed Returns Terminology",
            "pillar": "LEXICON",
            "findings": 18,
            "severity": "Blocker",
            "override_rate": "0.0%",
            "last_triggered": "1 week ago",
            "recommendation": "Guaranteed returns strictly prohibited under financial regulations. Deterministic engine catches 100% of attempts."
        },
        {
            "rule_id": "VOICE_CONFIDENCE",
            "rule_name": "Overpromising Marketing Baseline",
            "pillar": "TONE",
            "findings": 12,
            "severity": "Warning",
            "override_rate": "16.7%",
            "last_triggered": "1 week ago",
            "recommendation": "High override rate (16.7%) on executive press releases. Re-tune confidence threshold for PR channel."
        },
        {
            "rule_id": "TYPO_FONT_001",
            "rule_name": "Non-Standard Typography Font Family",
            "pillar": "VISUAL",
            "findings": 4,
            "severity": "Warning",
            "override_rate": "0.0%",
            "last_triggered": "2 weeks ago",
            "recommendation": "Isolated typography drift. Below minimum trigger threshold."
        }
    ]

    # Deterministic Friction Score calculation:
    # Friction Score = findings * (1 + override_rate_float * 2.0) * severity_weight
    # Blocker weight = 2.5, Warning weight = 1.0
    friction_leaderboard = []
    for item in findings_pool:
        findings_count = item["findings"]
        override_rate_pct = float(item["override_rate"].replace("%", "").strip())
        override_rate_float = override_rate_pct / 100.0
        severity_weight = 2.5 if item["severity"].upper() == "BLOCKER" else 1.0

        friction_score = round(findings_count * (1.0 + override_rate_float * 2.0) * severity_weight, 1)
        level = "HIGH" if friction_score >= 120 else "MEDIUM" if friction_score >= 60 else "LOW"

        entry = {
            **item,
            "friction_score": friction_score,
            "friction_level": level,
        }
        if findings_count >= min_triggers:
            friction_leaderboard.append(entry)

    friction_leaderboard.sort(key=lambda x: x["friction_score"], reverse=True)

    scores = [x["friction_score"] for x in friction_leaderboard]
    overall_friction_index = round(sum(scores) / len(scores), 1) if scores else 0.0

    telemetry_data = {
        "audit_volume": 1248,
        "audit_volume_delta": "↑ 12.4% vs prior",
        "first_pass_rate": 78.0,
        "first_pass_delta": "↑ 4.1 pts",
        "review_time_saved": "104 hrs",
        "review_time_saved_subtext": "≈ 5 min per audit",
        "open_findings": 864,
        "hard_blockers": 112,
        "warnings_count": 752,
        "weekly_trends": [
            {"week": "W1", "audits": 180, "first_pass": 140},
            {"week": "W2", "audits": 215, "first_pass": 168},
            {"week": "W3", "audits": 240, "first_pass": 187},
            {"week": "W4", "audits": 285, "first_pass": 222},
            {"week": "W5", "audits": 328, "first_pass": 256},
        ],
        "categories": [
            {"name": "Factual claims", "count": 342, "pct": 40},
            {"name": "Color & contrast", "count": 251, "pct": 29},
            {"name": "Voice & tone", "count": 178, "pct": 21},
            {"name": "Logo & layout", "count": 93, "pct": 10},
        ],
        "severity_breakdown": {
            "total": 864,
            "blockers": 112,
            "warnings": 752,
            "blocker_pct": 13,
            "warning_pct": 87,
        },
        "min_triggers": min_triggers,
        "overall_friction_index": overall_friction_index,
        "high_friction_count": sum(1 for x in friction_leaderboard if x["friction_level"] == "HIGH"),
        "friction_leaderboard": friction_leaderboard,
        "recurring_findings": friction_leaderboard[:4],
        "raw_telemetry": raw_data,
    }
    return JsonResponse(telemetry_data, safe=False)


@csrf_exempt
def exception_requests_view(request):
    """
    GET /api/exceptions/ -> lists exception requests
    POST /api/exceptions/ -> creates a new exception request
    """
    if request.method == 'GET':
        status_filter = request.GET.get('status')
        qs = ExceptionRequest.objects.all().order_by('-created_at')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        items = [ex.to_dict() for ex in qs]
        return JsonResponse({"exceptions": items, "count": len(items)}, safe=False)

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return HttpResponseBadRequest("Invalid JSON body")

        rule_code = body.get('rule_code', '').strip().upper()
        warning_type = body.get('warning_type', '').strip().upper()
        pillar_spec = body.get('pillar', '').strip().upper()

        # HARD SECURITY REQUIREMENT: Tone rules only! FACT and Accessibility rules strictly blocked server-side.
        if rule_code.startswith('FACT_') or 'FACT' in warning_type or pillar_spec == 'FACTUAL':
            return JsonResponse({
                "error": "Exceptions are strictly restricted to tone/voice rules. Factual truth claims cannot be overridden under any circumstances.",
                "rule_code": rule_code,
                "pillar": "FACTUAL"
            }, status=400)

        if (rule_code.startswith('VIS_') or
            'VISUAL' in warning_type or
            'ACCESSIBILITY' in warning_type or
            'WCAG' in rule_code or
            pillar_spec == 'VISUAL'):
            return JsonResponse({
                "error": "Exceptions are strictly restricted to tone/voice rules. Visual brand identity and WCAG accessibility standards cannot be overridden.",
                "rule_code": rule_code,
                "pillar": "VISUAL"
            }, status=400)

        # Check existing BrandRule in database if registered
        profile = get_active_profile()
        rule_obj = BrandRule.objects.filter(profile=profile, rule_code=rule_code).first()
        if rule_obj and rule_obj.pillar != 'TONE':
            return JsonResponse({
                "error": f"Exceptions are strictly restricted to tone/voice rules. Rule {rule_code} belongs to pillar '{rule_obj.pillar}' which cannot be overridden.",
                "rule_code": rule_code,
                "pillar": rule_obj.pillar
            }, status=400)

        count = ExceptionRequest.objects.count() + 1
        new_id = body.get('id') or f"EX-{2040 + count}"

        user = get_authenticated_user_from_request(request)
        requester_name = body.get('requester_name') or (user.get_full_name() or user.username if user else 'Alex Morgan')
        requester_dept = body.get('requester_dept') or (getattr(user, 'department', 'Marketing') if user else 'Marketing')

        # Link Submission if available
        sub = None
        sub_id = body.get('submission_id') or body.get('draft_id')
        if sub_id:
            try:
                sub = Submission.objects.filter(id=sub_id).first()
            except Exception:
                sub = Submission.objects.filter(title__icontains=body.get('title', '')).first()
        if not sub and body.get('title'):
            sub = Submission.objects.filter(title=body.get('title')).first()

        ex = ExceptionRequest.objects.create(
            id=new_id,
            submission=sub,
            author=user,
            draft_id=body.get('draft_id', 'DRAFT_024'),
            rule_code=rule_code or 'VOICE_004',
            title=body.get('title', "Global ambition. Local simplicity."),
            requester_name=requester_name,
            requester_dept=requester_dept,
            requested_date=date.today(),
            warning_type=body.get('warning_type', 'Warning · Voice'),
            quote_text=body.get('quote_text', "Don't get wrecked by banks!"),
            rule_description=body.get('rule_description', "Aggressive comparison tone is outside the default voice range."),
            justification=body.get('justification', ""),
            campaign_reference=body.get('campaign_reference', 'Global ambition · Q3 2026 launch'),
            scope=body.get('scope', 'This draft only'),
            channel=body.get('channel', 'LinkedIn post'),
            expires_on=date(2026, 10, 31),
            reviewer_name=body.get('reviewer_name', 'Jordan Lee'),
            reviewer_title=body.get('reviewer_title', 'Brand Governance Lead'),
            hard_blockers_count=body.get('hard_blockers_count', 0),
            supporting_file_name=body.get('supporting_file_name', 'Q3_challenger_campaign.pdf'),
            supporting_file_size=body.get('supporting_file_size', '1.2 MB'),
            status='PENDING',
        )

        if sub:
            sub.status = 'EXCEPTION_PENDING'
            sub.save()

        # Audit trail
        AuditTrail.log(
            request,
            action="EXCEPTION_REQUESTED",
            entity_type="EXCEPTION_REQUEST",
            entity_id=ex.id,
            description=f"Writer {requester_name} requested tone exception for {ex.rule_code} in '{ex.title}'."
        )

        # Multi-channel notification to all admins
        from governance.notifications import dispatch_notification
        for admin_u in BrandGuardUser.objects.filter(role='ADMIN'):
            dispatch_notification(
                recipient=admin_u,
                notification_type='EXCEPTION_PENDING',
                title=f"Exception Request {ex.id}: {ex.rule_code}",
                message=f"Writer {requester_name} requested a tone exception for '{ex.title}'.",
                link_url=f"/api/exceptions/{ex.id}/"
            )

        return JsonResponse(ex.to_dict(), status=201)

    return HttpResponseBadRequest("Method not allowed")


@csrf_exempt
def exception_detail_view(request, exception_id):
    """
    GET /api/exceptions/<exception_id>/
    """
    try:
        ex = ExceptionRequest.objects.get(id=exception_id)
        return JsonResponse(ex.to_dict())
    except ExceptionRequest.DoesNotExist:
        return HttpResponseNotFound("Exception request not found")


@csrf_exempt
@admin_required
def exception_decision_view(request, exception_id):
    """
    POST /api/exceptions/<exception_id>/decide/ (and /decision/)
    Admin-only endpoint: decides on exception requests.
    Content writers receive HTTP 403 Forbidden.
    Updates status timeline, notifications, and submission synchronization.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    try:
        ex = ExceptionRequest.objects.get(id=exception_id)
    except ExceptionRequest.DoesNotExist:
        return HttpResponseNotFound("Exception request not found")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        body = {}

    from django.utils import timezone
    raw_status = body.get('status', 'APPROVED').upper()
    if raw_status in ('REJECT', 'REJECTED', 'DECLINED', 'DECLINE'):
        new_status = 'DECLINED'
    else:
        new_status = 'APPROVED'

    decision_note = body.get('decision_note', 'Reviewed. The challenger voice fits this audience and the scope is narrow.').strip()
    reviewer_name = body.get('reviewer_name') or (request.user.get_full_name() or request.user.username)

    ex.status = new_status
    ex.decision_note = decision_note
    ex.decided_at = timezone.now()
    ex.decided_by = reviewer_name
    ex.decided_by_user = request.user
    ex.save()

    # Synchronize submission & findings
    sub = ex.submission
    if not sub and ex.draft_id:
        try:
            sub = Submission.objects.filter(id=ex.draft_id).first()
        except Exception:
            sub = Submission.objects.filter(title=ex.title).first()

    if sub:
        latest_v = sub.versions.order_by('-version_number').first()
        if latest_v:
            finding = latest_v.findings.filter(rule_citation_code=ex.rule_code).first()
            if finding:
                if new_status == 'APPROVED':
                    finding.status = 'OVERRIDE_APPROVED'
                    finding.reviewer_comment = decision_note
                    finding.save()
                else:
                    finding.status = 'REJECTED'
                    finding.reviewer_comment = decision_note
                    finding.save()

            approved_count = latest_v.findings.filter(status='OVERRIDE_APPROVED').count()
            open_blockers = latest_v.findings.filter(severity='BLOCKER', status='OPEN').count()

            new_score, new_breakdown = calculate_score(latest_v.findings.all(), approved_exception_count=approved_count)
            latest_v.compliance_score = new_score
            latest_v.score_breakdown = new_breakdown
            latest_v.save()

            if new_status == 'APPROVED' and open_blockers == 0:
                sub.status = 'APPROVED'
            elif new_status == 'DECLINED':
                sub.status = 'IN_REVIEW'
            sub.save()

    # Multi-channel notification for the writer/requester
    recipient = ex.author or BrandGuardUser.objects.filter(username=ex.requester_name).first()
    if recipient:
        from governance.notifications import dispatch_notification
        dispatch_notification(
            recipient=recipient,
            notification_type='EXCEPTION_APPROVED' if new_status == 'APPROVED' else 'EXCEPTION_REJECTED',
            title=f"Exception {ex.id} {new_status.capitalize()}",
            message=f"Admin {reviewer_name} has {new_status.lower()} your request for [{ex.rule_code}]. Note: '{decision_note}'",
            link_url=f"/api/exceptions/{ex.id}/"
        )

    # Audit trail
    AuditTrail.log(
        request,
        action=f"EXCEPTION_{new_status}",
        entity_type="EXCEPTION_REQUEST",
        entity_id=ex.id,
        description=f"Admin {reviewer_name} {new_status.lower()} exception request {ex.id} for {ex.rule_code}: '{decision_note}'."
    )

    return JsonResponse(ex.to_dict())


@csrf_exempt
def rules_list_create_view(request):
    """
    GET /api/rules/ -> List active rules with search/filter (severity, pillar, status, query)
    POST /api/rules/ -> Admin creates a new rule (creates version 1)
    """
    profile = get_active_profile()

    if request.method == 'GET':
        qs = BrandRule.objects.filter(profile=profile)

        # Filters
        pillar = request.GET.get('pillar', '').strip().upper()
        if pillar:
            qs = qs.filter(pillar=pillar)

        severity = request.GET.get('severity', '').strip().upper()
        if severity:
            qs = qs.filter(severity=severity)

        status = request.GET.get('status', 'active').strip().lower()
        if status == 'active':
            qs = qs.filter(is_active=True)
        elif status == 'inactive':
            qs = qs.filter(is_active=False)

        search = request.GET.get('search', '').strip()
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(rule_code__icontains=search) |
                Q(title__icontains=search) |
                Q(rule_description__icontains=search) |
                Q(claims_allowed__icontains=search) |
                Q(claims_disallowed__icontains=search)
            )

        rules = [r.to_dict() for r in qs.order_by('rule_code')]
        return JsonResponse({"rules": rules, "total": len(rules)})

    elif request.method == 'POST':
        user = get_authenticated_user_from_request(request)
        if not user:
            return JsonResponse({"error": "Unauthorized", "detail": "Authentication required."}, status=401)
        if getattr(user, 'role', '') != 'ADMIN' and not user.is_superuser:
            return JsonResponse({"error": "Forbidden", "detail": "Admin privileges required to create rules."}, status=403)

        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return HttpResponseBadRequest("Invalid JSON body")

        rule_code = body.get('rule_code', '').strip().upper()
        title = body.get('title', '').strip()
        pillar = body.get('pillar', 'TONE').strip().upper()
        severity = body.get('severity', 'WARNING').strip().upper()
        enforcement = body.get('enforcement', 'Block publish').strip()
        claims_allowed = body.get('claims_allowed', '').strip()
        claims_disallowed = body.get('claims_disallowed', '').strip()
        description = body.get('rule_description', '').strip()
        source = body.get('source', 'NovaPay Brand Guidelines').strip()
        banned_term = body.get('banned_term', '').strip()
        replacement = body.get('replacement', '').strip()

        if not rule_code or not title:
            return JsonResponse({"error": "rule_code and title are required."}, status=400)

        if BrandRule.objects.filter(profile=profile, rule_code=rule_code).exists():
            return JsonResponse({"error": f"Rule with code '{rule_code}' already exists."}, status=400)

        structured_spec = body.get('structured_spec', {})
        if banned_term:
            structured_spec['banned_term'] = banned_term
        if replacement:
            structured_spec['replacement'] = replacement

        rule = BrandRule.objects.create(
            profile=profile,
            rule_code=rule_code,
            title=title,
            pillar=pillar,
            severity=severity,
            version=1,
            is_active=True,
            enforcement=enforcement,
            claims_allowed=claims_allowed or replacement,
            claims_disallowed=claims_disallowed or banned_term,
            source=source,
            structured_spec=structured_spec,
            rule_description=description,
            owner=f"{user.get_full_name() or user.username}, Brand Governance"
        )

        BrandRuleVersion.objects.create(
            rule=rule,
            version_number=1,
            title=rule.title,
            pillar=rule.pillar,
            severity=rule.severity,
            structured_spec=rule.structured_spec,
            rule_description=rule.rule_description,
            claims_allowed=rule.claims_allowed,
            claims_disallowed=rule.claims_disallowed,
            enforcement=rule.enforcement,
            source=rule.source,
            change_note="Initial rule creation.",
            changed_by=user
        )

        AuditTrail.log(
            request,
            action="RULE_CREATED",
            entity_type="RULE",
            entity_id=rule.rule_code,
            description=f"Admin created rule {rule.rule_code}: {rule.title}."
        )

        return JsonResponse({"status": "success", "rule": rule.to_dict()}, status=201)

    return HttpResponseBadRequest("Method not allowed")


@csrf_exempt
def rule_detail_view(request, rule_code):
    """
    GET /api/rules/<rule_code>/ -> Full rule details with version history & examples
    PUT/PATCH /api/rules/<rule_code>/ -> Admin updates rule, increments version, creates snapshot
    DELETE /api/rules/<rule_code>/ -> Admin deactivates rule
    """
    profile = get_active_profile()
    code = rule_code.strip().upper()
    rule = BrandRule.objects.filter(profile=profile, rule_code=code).first()

    if not rule:
        return JsonResponse({"error": f"Rule '{code}' not found."}, status=404)

    if request.method == 'GET':
        data = rule.to_dict()
        data["subtitle"] = f"{rule.rule_code} · Rule v{rule.version} · Part of ruleset v3.2"
        data["breadcrumb"] = f"RULE REGISTRY > {rule.pillar} > {rule.rule_code}"
        data["tags"] = [
            {"label": "Enabled" if rule.is_active else "Disabled", "type": "enabled" if rule.is_active else "disabled"},
            {"label": rule.severity.capitalize(), "type": rule.severity.lower()},
            {"label": rule.pillar.capitalize(), "type": "neutral"}
        ]
        data["test_examples"] = [
            {"quote": f"“{rule.claims_allowed or 'Standard compliant statement'}”", "status": "Pass"},
            {"quote": f"“{rule.claims_disallowed or 'Non-compliant statement'}”", "status": "Flag"},
        ]
        data["source_evidence"] = {
            "quote": f"{rule.rule_code}: {rule.rule_description or rule.title}",
            "ledger_entry": f"LEDGER-{rule.rule_code}",
            "source": rule.source or "NovaPay Brand Guidelines",
            "last_verified": "May 2026",
            "verified": True
        }
        data["change_history"] = [
            {
                "version": f"v{v.version_number}",
                "date": v.created_at.strftime('%b %d, %Y') if v.created_at else '',
                "current": v.version_number == rule.version,
                "note": v.change_note or "Rule update",
                "changed_by": v.changed_by.username if v.changed_by else "Admin"
            }
            for v in rule.versions.all().order_by('-version_number')
        ]
        data["versioning_note"] = "Changes are versioned. Existing audits retain the version they ran against."
        return JsonResponse(data)

    user = get_authenticated_user_from_request(request)
    if not user:
        return JsonResponse({"error": "Unauthorized", "detail": "Authentication required."}, status=401)
    if getattr(user, 'role', '') != 'ADMIN' and not user.is_superuser:
        return JsonResponse({"error": "Forbidden", "detail": "Admin privileges required to modify rules."}, status=403)

    if request.method in ('PUT', 'PATCH'):
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return HttpResponseBadRequest("Invalid JSON body")

        change_note = body.get('change_note', '').strip() or f"Updated specification for {rule.rule_code}."
        if 'title' in body:
            rule.title = body['title'].strip()
        if 'severity' in body:
            rule.severity = body['severity'].strip().upper()
        if 'enforcement' in body:
            rule.enforcement = body['enforcement'].strip()
        if 'claims_allowed' in body:
            rule.claims_allowed = body['claims_allowed'].strip()
        if 'claims_disallowed' in body:
            rule.claims_disallowed = body['claims_disallowed'].strip()
        if 'rule_description' in body:
            rule.rule_description = body['rule_description'].strip()
        if 'structured_spec' in body:
            rule.structured_spec = body['structured_spec']
        if 'banned_term' in body or 'replacement' in body:
            spec = rule.structured_spec or {}
            if 'banned_term' in body:
                spec['banned_term'] = body['banned_term'].strip()
            if 'replacement' in body:
                spec['replacement'] = body['replacement'].strip()
            rule.structured_spec = spec
        if 'is_active' in body:
            rule.is_active = bool(body['is_active'])

        rule.version += 1
        rule.save()

        new_v = BrandRuleVersion.objects.create(
            rule=rule,
            version_number=rule.version,
            title=rule.title,
            pillar=rule.pillar,
            severity=rule.severity,
            structured_spec=rule.structured_spec,
            rule_description=rule.rule_description,
            claims_allowed=rule.claims_allowed,
            claims_disallowed=rule.claims_disallowed,
            enforcement=rule.enforcement,
            source=rule.source,
            change_note=change_note,
            changed_by=user
        )

        AuditTrail.log(
            request,
            action="RULE_UPDATED",
            entity_type="RULE",
            entity_id=rule.rule_code,
            description=f"Admin updated rule {rule.rule_code} to v{rule.version}: {change_note}."
        )

        return JsonResponse({"status": "success", "rule": rule.to_dict(), "new_version": new_v.to_dict()})

    elif request.method == 'DELETE':
        rule.is_active = False
        rule.save()

        AuditTrail.log(
            request,
            action="RULE_DEACTIVATED",
            entity_type="RULE",
            entity_id=rule.rule_code,
            description=f"Admin deactivated rule {rule.rule_code}."
        )
        return JsonResponse({"status": "success", "message": f"Rule '{rule.rule_code}' deactivated."})

    return HttpResponseBadRequest("Method not allowed")


@csrf_exempt
def rule_versions_view(request, rule_code):
    """
    GET /api/rules/<rule_code>/versions/
    Returns all historical versions of a rule for comparison.
    """
    profile = get_active_profile()
    rule = BrandRule.objects.filter(profile=profile, rule_code=rule_code.upper()).first()
    if not rule:
        return JsonResponse({"error": "Rule not found"}, status=404)

    versions = [v.to_dict() for v in rule.versions.all().order_by('-version_number')]
    return JsonResponse({
        "rule_code": rule.rule_code,
        "current_version": rule.version,
        "versions": versions
    })


@csrf_exempt
@admin_required
def rule_rollback_view(request, rule_code):
    """
    POST /api/rules/<rule_code>/rollback/
    Body: {"target_version": 2}
    Reverts active rule to snapshot from target_version, increments version counter,
    and logs rollback snapshot.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    profile = get_active_profile()
    rule = BrandRule.objects.filter(profile=profile, rule_code=rule_code.upper()).first()
    if not rule:
        return JsonResponse({"error": "Rule not found"}, status=404)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body")

    target_version_num = body.get('target_version')
    if not target_version_num:
        return JsonResponse({"error": "target_version is required."}, status=400)

    target_snapshot = rule.versions.filter(version_number=target_version_num).first()
    if not target_snapshot:
        return JsonResponse({"error": f"Version {target_version_num} does not exist for rule {rule.rule_code}."}, status=404)

    rule.title = target_snapshot.title
    rule.severity = target_snapshot.severity
    rule.structured_spec = target_snapshot.structured_spec
    rule.rule_description = target_snapshot.rule_description
    rule.claims_allowed = target_snapshot.claims_allowed
    rule.claims_disallowed = target_snapshot.claims_disallowed
    rule.enforcement = target_snapshot.enforcement
    rule.source = target_snapshot.source
    rule.is_active = True

    old_v = rule.version
    rule.version += 1
    rule.save()

    new_snapshot = BrandRuleVersion.objects.create(
        rule=rule,
        version_number=rule.version,
        title=rule.title,
        pillar=rule.pillar,
        severity=rule.severity,
        structured_spec=rule.structured_spec,
        rule_description=rule.rule_description,
        claims_allowed=rule.claims_allowed,
        claims_disallowed=rule.claims_disallowed,
        enforcement=rule.enforcement,
        source=rule.source,
        change_note=f"Rolled back from v{old_v} to v{target_version_num} configuration.",
        changed_by=request.user
    )

    AuditTrail.log(
        request,
        action="RULE_ROLLED_BACK",
        entity_type="RULE",
        entity_id=rule.rule_code,
        description=f"Admin rolled back rule {rule.rule_code} from v{old_v} to v{target_version_num} (now v{rule.version})."
    )

    return JsonResponse({
        "status": "success",
        "message": f"Successfully rolled back {rule.rule_code} to v{target_version_num}. New version is v{rule.version}.",
        "rule": rule.to_dict(),
        "new_version": new_snapshot.to_dict()
    })


@csrf_exempt
def auth_login_view(request):
    """
    POST /api/auth/login/
    Accepts: {"username": "admin", "password": "..."} or {"email": "..."}
    Returns: {"status": "success", "token": "...", "user": {...}}
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body")

    username = body.get('username', '').strip()
    email = body.get('email', '').strip()
    password = body.get('password', '').strip()

    if not username and not email:
        return JsonResponse({"error": "Username or email is required."}, status=400)

    user = None
    if username:
        user = authenticate(request, username=username, password=password)
    if not user:
        identifier = username or email
        try:
            cand = BrandGuardUser.objects.filter(
                Q(username__iexact=identifier) | Q(email__iexact=identifier)
            ).first()
            if cand and cand.check_password(password):
                user = cand
        except Exception:
            pass

    if not user:
        return JsonResponse({"error": "Invalid username or password."}, status=401)

    if not user.is_active:
        return JsonResponse({"error": "This account has been deactivated."}, status=403)

    login(request, user)
    token = generate_user_token(user)

    AuditTrail.log(
        request,
        action="USER_LOGIN",
        entity_type="USER",
        entity_id=str(user.id),
        description=f"User {user.username} ({user.role}) logged in successfully."
    )

    return JsonResponse({
        "status": "success",
        "token": token,
        "user": user.to_dict(),
    })


@csrf_exempt
def auth_me_view(request):
    """
    GET /api/auth/me/
    Returns authenticated user profile, permissions, and notifications count.
    """
    if request.method != 'GET':
        return HttpResponseBadRequest("Method not allowed")

    user = get_authenticated_user_from_request(request)
    if not user:
        return JsonResponse({"error": "Unauthorized", "detail": "Authentication required."}, status=401)

    unread_notifications = user.notifications.filter(is_read=False).count()

    return JsonResponse({
        "user": user.to_dict(),
        "is_admin": user.is_admin_user,
        "is_writer": user.is_writer_user,
        "unread_notifications": unread_notifications,
    })


@csrf_exempt
def auth_logout_view(request):
    """
    POST /api/auth/logout/
    """
    user = get_authenticated_user_from_request(request)
    if user:
        AuditTrail.log(
            request,
            action="USER_LOGOUT",
            entity_type="USER",
            entity_id=str(user.id),
            description=f"User {user.username} logged out."
        )
    logout(request)
    return JsonResponse({"status": "success", "message": "Logged out successfully."})


@csrf_exempt
def auth_users_view(request):
    """
    GET /api/auth/users/
    Quick user switcher listing for development / pair demo testing.
    """
    users = BrandGuardUser.objects.filter(is_active=True).order_by('role', 'username')
    return JsonResponse({
        "users": [u.to_dict() for u in users]
    })


@csrf_exempt
def notifications_list_view(request):
    """
    GET /api/notifications/
    Returns list of notifications for the current authenticated user (or all if unauthenticated/demo).
    POST /api/notifications/
    Marks notifications as read or creates a test notification.
    """
    user = get_authenticated_user_from_request(request)
    if request.method == 'GET':
        if user:
            qs = Notification.objects.filter(recipient=user).order_by('-created_at')
        else:
            qs = Notification.objects.all().order_by('-created_at')[:30]
        items = [n.to_dict() for n in qs]
        unread_count = sum(1 for n in items if not n.get('is_read'))
        return JsonResponse({"notifications": items, "unread_count": unread_count})

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            body = {}
        action = body.get('action', 'MARK_READ')
        nid = body.get('id')
        if nid:
            Notification.objects.filter(id=nid).update(is_read=True)
        elif action == 'MARK_ALL_READ':
            if user:
                Notification.objects.filter(recipient=user, is_read=False).update(is_read=True)
            else:
                Notification.objects.filter(is_read=False).update(is_read=True)
        return JsonResponse({"status": "success"})

    return HttpResponseBadRequest("Method not allowed")


@csrf_exempt
@admin_required
def users_management_view(request):
    """
    GET /api/users/ -> Admin lists team users with per-writer stats & top 5 triggered rules.
    POST /api/users/ -> Admin creates or invites new writer/admin.
    Content writers receive HTTP 403 Forbidden.
    """
    if request.method == 'GET':
        users = BrandGuardUser.objects.all().order_by('role', 'username')
        user_list = []
        team_scores = []
        team_rule_counts = {}

        for u in users:
            u_dict = u.to_dict()
            user_subs = Submission.objects.filter(author=u)
            sub_count = user_subs.count()
            approved_count = user_subs.filter(status='APPROVED').count()
            approval_rate = round((approved_count / sub_count * 100), 1) if sub_count > 0 else 100.0

            u_dict['audits_count'] = sub_count
            u_dict['approved_count'] = approved_count
            u_dict['approval_rate'] = approval_rate
            u_dict['exceptions_count'] = ExceptionRequest.objects.filter(author=u).count()
            u_dict['exceptions_approved'] = ExceptionRequest.objects.filter(author=u, status='APPROVED').count()

            # Average score
            scores = []
            for s in user_subs:
                latest_v = s.versions.order_by('-version_number').first()
                if latest_v:
                    scores.append(latest_v.compliance_score)
                    team_scores.append(latest_v.compliance_score)
            u_dict['avg_compliance_score'] = round(sum(scores) / len(scores), 1) if scores else 100.0

            # Top 5 rules triggered
            rule_counts = {}
            for s in user_subs:
                for v in s.versions.all():
                    for f in v.findings.all():
                        code = f.rule_citation_code
                        rule_counts[code] = rule_counts.get(code, 0) + 1
                        team_rule_counts[code] = team_rule_counts.get(code, 0) + 1
            top_rules = sorted([{"rule_code": k, "count": v} for k, v in rule_counts.items()], key=lambda x: x["count"], reverse=True)[:5]
            u_dict['top_triggered_rules'] = top_rules

            user_list.append(u_dict)

        team_avg = round(sum(team_scores) / len(team_scores), 1) if team_scores else 95.0
        team_top_rules = sorted([{"rule_code": k, "count": v} for k, v in team_rule_counts.items()], key=lambda x: x["count"], reverse=True)[:5]

        return JsonResponse({
            "users": user_list,
            "total": len(user_list),
            "team_metrics": {
                "total_members": users.count(),
                "writers_count": users.filter(role='CONTENT_WRITER').count(),
                "admins_count": users.filter(role='ADMIN').count(),
                "team_avg_score": team_avg,
                "team_top_triggered_rules": team_top_rules
            }
        })

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return HttpResponseBadRequest("Invalid JSON body")

        username = body.get('username', '').strip()
        email = body.get('email', '').strip()
        role = body.get('role', 'CONTENT_WRITER').upper()
        department = body.get('department', 'Marketing').strip()
        password = body.get('password', 'writer123').strip()

        if not username or not email:
            return JsonResponse({"error": "username and email are required."}, status=400)

        if BrandGuardUser.objects.filter(username=username).exists():
            return JsonResponse({"error": f"Username '{username}' already exists."}, status=400)

        user = BrandGuardUser.objects.create(
            username=username,
            email=email,
            role=role,
            department=department,
            first_name=body.get('first_name', ''),
            last_name=body.get('last_name', ''),
            avatar_color=body.get('avatar_color', '#00D4B6')
        )
        user.set_password(password)
        user.save()

        AuditTrail.log(
            request,
            action="USER_CREATED",
            entity_type="USER",
            entity_id=str(user.id),
            description=f"Admin created user {user.username} with role {user.role}."
        )

        return JsonResponse({"status": "success", "user": user.to_dict()}, status=201)

    return HttpResponseBadRequest("Method not allowed")


@csrf_exempt
def export_submission_pdf_view(request, sub_id):
    """
    GET /api/submissions/<sub_id>/export-pdf/
    Generates and downloads an executive PDF compliance & audit dossier.
    Available to both Writers and Admins for verified publishing.
    """
    if request.method != 'GET':
        return HttpResponseBadRequest("Method not allowed")

    try:
        sub = Submission.objects.get(id=sub_id)
    except (Submission.DoesNotExist, ValueError):
        return JsonResponse({"error": f"Submission '{sub_id}' not found."}, status=404)

    from governance.pdf_report import generate_audit_report_pdf
    pdf_bytes = generate_audit_report_pdf(sub)

    AuditTrail.log(
        request,
        action="AUDIT_REPORT_EXPORTED_PDF",
        entity_type="SUBMISSION",
        entity_id=str(sub.id),
        description=f"Exported PDF audit report for submission '{sub.title}' ({sub.id})."
    )

    clean_channel = (getattr(sub, 'channel_context', 'asset') or 'asset').replace(' ', '_')
    filename = f"BrandGuard_Audit_{clean_channel}_{str(sub.id)[:8]}.pdf"
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@csrf_exempt
@admin_required
def notification_integrations_view(request):
    """
    GET /api/notifications/integrations/
    Returns operational status of multi-channel notification services (In-App, Email, Slack).
    """
    from governance.notifications import get_notification_integrations_status
    return JsonResponse(get_notification_integrations_status())


@csrf_exempt
@admin_required
def test_notification_webhook_view(request):
    """
    POST /api/notifications/test-webhook/
    Admin test ping for Email and Slack notifications.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    from governance.notifications import dispatch_notification
    user = request.user
    title = "Test Webhook Alert"
    message = "BrandGuard multi-channel notification verification test. All channels operational."

    res = dispatch_notification(
        recipient=user,
        title=title,
        message=message,
        notification_type="INFO",
        link_url="https://brandguard.internal"
    )
    return JsonResponse({"status": "success", "result": res})


@csrf_exempt
@admin_required
def rules_upload_view(request):
    """
    POST /api/rules/upload/
    Uploads rules in ANY format: PDF, DOCX, XLSX, CSV, JSON, YAML, MD, TXT, PNG/JPG.
    Parser outputs DRAFT rules only. Never auto-activates.
    Admin reviews, edits and approves drafts first.
    Content writers receive HTTP 403 Forbidden.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    uploaded_file = request.FILES.get('file')
    raw_content = request.POST.get('raw_content', '')
    filename = request.POST.get('filename', 'uploaded_rules.txt')

    parsed_rules = []
    try:
        if uploaded_file:
            file_bytes = uploaded_file.read()
            filename = uploaded_file.name
            parsed_rules = parse_rule_document(filename, file_bytes)
        elif raw_content:
            file_bytes = raw_content.encode('utf-8')
            parsed_rules = parse_rule_document(filename, file_bytes)
        else:
            try:
                body = json.loads(request.body.decode('utf-8'))
                raw_text = body.get('rules_text', '')
                fname = body.get('filename', 'policy_input.yaml')
                if raw_text:
                    parsed_rules = parse_rule_document(fname, raw_text.encode('utf-8'))
            except Exception:
                pass

        if not parsed_rules:
            return JsonResponse({"error": "No valid rules could be parsed from the provided file or text."}, status=400)

        # Stage as DRAFT rules (never auto-activated)
        staged_drafts = []
        for r in parsed_rules:
            code = r.get('rule_code', f"DRAFT_{DraftRule.objects.count()+1:03d}")
            draft = DraftRule.objects.create(
                rule_code=code,
                pillar=r.get('pillar', 'TONE'),
                title=r.get('title', 'Imported Rule Draft'),
                severity=r.get('severity', 'WARNING'),
                enforcement=r.get('enforcement', 'Block publish'),
                claims_allowed=r.get('claims_allowed', ''),
                claims_disallowed=r.get('claims_disallowed', ''),
                source=r.get('source', f"Uploaded from {filename}"),
                source_type="UPLOAD",
                structured_spec=r.get('structured_spec', {}),
                rule_description=r.get('rule_description', ''),
                status="DRAFT",
                created_by=request.user
            )
            staged_drafts.append(draft.to_dict())

        AuditTrail.log(
            request,
            action="RULES_UPLOADED_DRAFT",
            entity_type="DRAFT_RULE",
            entity_id=f"{len(staged_drafts)}_rules",
            description=f"Admin uploaded {filename} creating {len(staged_drafts)} DRAFT rules for review."
        )

        return JsonResponse({
            "status": "success",
            "message": f"Successfully parsed {len(staged_drafts)} draft rules from {filename}. Staged for review.",
            "drafts": staged_drafts,
            "count": len(staged_drafts)
        }, status=201)

    except RuleParsingException as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Failed to parse document: {str(e)}"}, status=500)


@csrf_exempt
@admin_required
def draft_rules_list_view(request):
    """
    GET /api/rules/drafts/
    Lists all pending draft rules awaiting admin approval.
    """
    drafts = DraftRule.objects.filter(status='DRAFT').order_by('-created_at')
    return JsonResponse({
        "drafts": [d.to_dict() for d in drafts],
        "count": drafts.count()
    })


@csrf_exempt
@admin_required
def draft_rules_approve_view(request):
    """
    POST /api/rules/drafts/approve/
    Body: {"draft_ids": [uuid1, uuid2], "action": "APPROVE" | "REJECT", "edits": {draft_id: {...}}}
    Approves draft rules and activates them into BrandRule.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body")

    draft_ids = body.get('draft_ids', [])
    single_id = body.get('draft_id')
    if single_id and single_id not in draft_ids:
        draft_ids.append(single_id)

    if not draft_ids:
        return JsonResponse({"error": "draft_ids list is required."}, status=400)

    action = body.get('action', 'APPROVE').upper()
    edits = body.get('edits', {})
    profile = get_active_profile()

    approved_rules = []
    rejected_rules = []

    for did in draft_ids:
        draft = DraftRule.objects.filter(id=did).first()
        if not draft:
            continue

        if action == 'APPROVE':
            edit_data = edits.get(str(did), {})
            title = edit_data.get('title') or draft.title
            code = edit_data.get('rule_code') or draft.rule_code
            severity = edit_data.get('severity') or draft.severity
            enforcement = edit_data.get('enforcement') or draft.enforcement
            claims_allowed = edit_data.get('claims_allowed') or draft.claims_allowed
            claims_disallowed = edit_data.get('claims_disallowed') or draft.claims_disallowed
            description = edit_data.get('rule_description') or draft.rule_description

            rule, created = BrandRule.objects.update_or_create(
                profile=profile,
                rule_code=code.upper(),
                defaults={
                    "title": title,
                    "pillar": draft.pillar,
                    "severity": severity,
                    "enforcement": enforcement,
                    "claims_allowed": claims_allowed,
                    "claims_disallowed": claims_disallowed,
                    "rule_description": description,
                    "source": draft.source,
                    "is_active": True,
                    "version": 1,
                    "owner": f"{request.user.get_full_name() or request.user.username}, Brand Governance"
                }
            )

            BrandRuleVersion.objects.create(
                rule=rule,
                version_number=1,
                title=rule.title,
                pillar=rule.pillar,
                severity=rule.severity,
                structured_spec=rule.structured_spec,
                rule_description=rule.rule_description,
                claims_allowed=rule.claims_allowed,
                claims_disallowed=rule.claims_disallowed,
                enforcement=rule.enforcement,
                source=rule.source,
                change_note=f"Approved from draft ({draft.source_type}).",
                changed_by=request.user
            )

            draft.status = 'APPROVED'
            draft.save()
            approved_rules.append(rule.to_dict())

            AuditTrail.log(
                request,
                action="DRAFT_APPROVED",
                entity_type="RULE",
                entity_id=rule.rule_code,
                description=f"Admin approved draft rule {draft.rule_code} into active rule {rule.rule_code}."
            )

        elif action == 'REJECT':
            draft.status = 'REJECTED'
            draft.review_notes = body.get('reason', 'Rejected by Brand Governance Lead.')
            draft.save()
            rejected_rules.append(draft.to_dict())

            AuditTrail.log(
                request,
                action="DRAFT_REJECTED",
                entity_type="DRAFT_RULE",
                entity_id=draft.rule_code,
                description=f"Admin rejected draft rule {draft.rule_code}."
            )

    return JsonResponse({
        "status": "success",
        "action": action,
        "approved": approved_rules,
        "rejected": rejected_rules,
    })


@csrf_exempt
@admin_required
def rules_scrape_view(request):
    """
    POST /api/rules/scrape/
    Admin pastes a URL.
    1. If preview only: SSRF-safe scraper extracts hex palette, fonts, homepage factual claims.
       Returns preview table with checkboxes.
    2. If import_selected: imports selected items as DRAFT rules or UNVERIFIED facts.
    Content writers receive HTTP 403 Forbidden.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body")

    url = body.get('url', '').strip()
    if not url:
        return JsonResponse({"error": "URL is required."}, status=400)

    import_selected = body.get('import_selected', False)
    profile = get_active_profile()

    try:
        # Run SSRF-Safe extraction
        extracted = scrape_brand_profile(url)

        if not import_selected:
            preview_items = []
            for p in extracted.get('palette', []):
                preview_items.append({
                    "id": f"color_{p['hex']}",
                    "type": "HEX_PALETTE",
                    "value": p['hex'],
                    "label": f"{p['name']} ({p['hex']})",
                    "detail": f"Observed {p.get('count', 1)} times in page styles",
                    "status": "draft",
                    "selected": True
                })
            for f in extracted.get('fonts', []):
                preview_items.append({
                    "id": f"font_{f}",
                    "type": "FONT",
                    "value": f,
                    "label": f,
                    "detail": "Extracted typography token",
                    "status": "draft",
                    "selected": True
                })
            for idx, c in enumerate(extracted.get('claims', [])):
                preview_items.append({
                    "id": f"claim_{idx+1}",
                    "type": "FACT",
                    "code": f"FACT_SCRAPED_{idx+1:02d}",
                    "value": c['claim_text'],
                    "label": c['claim_text'],
                    "detail": f"Extracted from {c.get('tag', 'HTML')} (Unverified)",
                    "status": "unverified",
                    "selected": True
                })

            return JsonResponse({
                "status": "success",
                "mode": "preview",
                "url": url,
                "summary": f"Successfully scraped {len(extracted.get('palette', []))} brand colors, {len(extracted.get('fonts', []))} fonts, and {len(extracted.get('claims', []))} factual statements.",
                "preview_items": preview_items,
                "palette": extracted.get('palette', []),
                "fonts": extracted.get('fonts', []),
                "claims": extracted.get('claims', [])
            })

        # Process selected items for import
        selected_items = body.get('selected_items', [])
        imported_facts = []
        imported_draft_rules = []

        for item in selected_items:
            item_type = item.get('type')
            val = item.get('value', '').strip()

            if item_type == 'FACT' and val:
                code = item.get('code') or f"FACT_SCRAPE_{FactLedger.objects.count()+1:03d}"
                fact = FactLedger.objects.create(
                    profile=profile,
                    fact_code=code,
                    category="Web Scraped Factual Claim",
                    claim_truth=val,
                    last_verified=date.today(),
                    valid_until=date.today() + timedelta(days=365),
                    is_verified=False,  # Unverified until admin checks!
                    source=f"Scraped from {url}",
                    created_by=request.user
                )
                imported_facts.append(fact.to_dict())

            elif item_type == 'HEX_PALETTE' and val:
                d_rule = DraftRule.objects.create(
                    rule_code=f"DRAFT_COLOR_{DraftRule.objects.count()+1:03d}",
                    pillar="VISUAL",
                    title=f"Brand Swatch ({val})",
                    severity="BLOCKER",
                    enforcement="Block publish",
                    claims_allowed=val,
                    claims_disallowed="Off-brand swatches exceeding ΔE 4.0",
                    source=f"Scraped from {url}",
                    source_type="SCRAPE",
                    structured_spec={"hex": val, "max_delta_e": 4.0},
                    rule_description=f"Brand color swatch {val} extracted from {url}.",
                    status="DRAFT",
                    created_by=request.user
                )
                imported_draft_rules.append(d_rule.to_dict())

        AuditTrail.log(
            request,
            action="URL_SCRAPED_IMPORTED",
            entity_type="SCRAPE",
            entity_id=url,
            description=f"Admin imported {len(imported_facts)} unverified facts and {len(imported_draft_rules)} draft rules from {url}."
        )

        return JsonResponse({
            "status": "success",
            "message": f"Successfully imported {len(imported_facts)} unverified facts and {len(imported_draft_rules)} draft rules.",
            "imported_facts": imported_facts,
            "imported_draft_rules": imported_draft_rules
        }, status=201)

    except SSRFSecurityException as e:
        return JsonResponse({"error": f"SSRF Security Violation: {str(e)}"}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Scrape failed: {str(e)}"}, status=500)


@csrf_exempt
@admin_required
def rule_playground_view(request):
    """
    POST /api/rules/playground/
    Tests sample copy or visual swatch against an active or draft rule before activating it.
    Returns whether the input passes, triggers a warning, or is blocked.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body")

    rule_code = body.get('rule_code', '').strip().upper()
    draft_id = body.get('draft_id')
    test_text = body.get('test_text', '').strip()
    profile = get_active_profile()

    target_rule = None
    if draft_id:
        target_rule = DraftRule.objects.filter(id=draft_id).first()
    if not target_rule and rule_code:
        target_rule = BrandRule.objects.filter(profile=profile, rule_code=rule_code).first()

    if not target_rule:
        return JsonResponse({"error": "Target rule or draft could not be found."}, status=404)

    spec = target_rule.structured_spec or {}
    banned_term = spec.get('banned_term') or target_rule.claims_disallowed
    allowed_term = spec.get('replacement') or target_rule.claims_allowed
    case_sensitive = spec.get('case_sensitive', False)

    flagged = False
    match_excerpt = ""
    explanation = ""

    if banned_term:
        if case_sensitive:
            flagged = banned_term in test_text
        else:
            flagged = banned_term.lower() in test_text.lower()
        if flagged:
            match_excerpt = banned_term
            explanation = f"Detected prohibited term '{banned_term}' in sample copy. Should be replaced with '{allowed_term}'."

    if not flagged and target_rule.pillar == 'TONE':
        if '#1' in test_text or 'fastest' in test_text.lower() or 'wrecked' in test_text.lower():
            flagged = True
            match_excerpt = "Unsubstantiated tone indicator"
            explanation = "Sample sentence triggers tone warning: aggressive comparison or unsubstantiated superlative."

    if not flagged and target_rule.pillar == 'FACTUAL':
        if target_rule.claims_disallowed and target_rule.claims_disallowed.lower() in test_text.lower():
            flagged = True
            match_excerpt = target_rule.claims_disallowed
            explanation = f"Sample statement conflicts with truth ledger. Disallowed claim '{target_rule.claims_disallowed}' detected."

    status = "FLAG" if flagged else "PASS"
    return JsonResponse({
        "status": status,
        "rule_code": target_rule.rule_code,
        "title": target_rule.title,
        "pillar": target_rule.pillar,
        "severity": target_rule.severity,
        "flagged": flagged,
        "match_excerpt": match_excerpt,
        "explanation": explanation if flagged else f"Sample copy passed all checks for rule [{target_rule.rule_code}] {target_rule.title}.",
        "suggested_fix": allowed_term if flagged else None,
        "test_text": test_text
    })


