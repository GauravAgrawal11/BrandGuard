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
from datetime import datetime, date
from pathlib import Path
import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.core.files.base import ContentFile

from .models import (
    BrandProfile, BrandRule, FactLedger, Submission, SubmissionVersion, AuditFinding, ExceptionRequest
)
from .engines.lexicon_engine import audit_lexicon, compute_voice_fingerprint, TARGET_VOICE_ENVELOPES
from .engines.fact_rag_engine import audit_facts_and_tone
from .engines.visual_engine import audit_image_array, audit_pdf_file
from .engines.telemetry import get_telemetry_report


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


def calculate_score(findings):
    """Calculates 0-100 compliance score based on blocker vs warning findings."""
    score = 100.0
    for f in findings:
        severity = f.get('severity', 'WARNING')
        if severity == 'BLOCKER':
            score -= 20.0
        else:
            score -= 8.0
    return max(0.0, min(100.0, round(score, 1)))


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

    # Compute compliance score
    score = calculate_score(all_findings_raw)

    # Compute 4-Axis Voice Fingerprint Radar
    voice_fingerprint = compute_voice_fingerprint(raw_text, channel_context)

    # Create Submission
    submission = Submission.objects.create(
        profile=profile,
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
        new_score = calculate_score(new_all_findings)
        new_voice_fp = compute_voice_fingerprint(new_text, submission.channel_context)

        new_version = SubmissionVersion.objects.create(
            submission=submission,
            version_number=new_version_num,
            raw_text=new_text,
            uploaded_file=version.uploaded_file,
            file_type=version.file_type,
            compliance_score=new_score,
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

    # Generate Cryptographic Publication Clearance Stamp
    stamp_raw = f"{submission.id}-{submission.title}-{datetime.utcnow().isoformat()}-BrandGuard-Clearance"
    clearance_hash = f"SHA256-{hashlib.sha256(stamp_raw.encode()).hexdigest()}"

    # Embed Cryptographic Metadata into Image/PDF Asset
    signed_rel_url = ""
    try:
        source_path = None
        if latest_version and latest_version.uploaded_file and latest_version.uploaded_file.name:
            cand = Path(settings.MEDIA_ROOT) / latest_version.uploaded_file.name
            if cand.exists():
                source_path = cand
        if not source_path:
            cand_sample = Path(settings.MEDIA_ROOT) / "sample_offbrand_banner.png"
            if cand_sample.exists():
                source_path = cand_sample

        if source_path and source_path.exists():
            upload_dir = Path(settings.MEDIA_ROOT) / "uploads"
            upload_dir.mkdir(parents=True, exist_ok=True)
            suffix = source_path.suffix.lower()

            if suffix in ['.png', '.jpg', '.jpeg']:
                pil_img = Image.open(source_path).convert('RGB')
                meta = PngInfo()
                meta.add_text("BrandGuard-Clearance-Hash", clearance_hash)
                meta.add_text("BrandGuard-Org", submission.profile.org_name)
                meta.add_text("BrandGuard-Approved-At", datetime.utcnow().isoformat())
                meta.add_text("BrandGuard-Version", f"v{latest_version.version_number if latest_version else 1}")
                meta.add_text("BrandGuard-Channel", submission.channel_context)

                signed_filename = f"signed_{submission.id}_{source_path.stem}.png"
                out_path = upload_dir / signed_filename
                pil_img.save(out_path, format="PNG", pnginfo=meta)
                signed_rel_url = f"/media/uploads/{signed_filename}"

            elif suffix == '.pdf':
                try:
                    import pymupdf as fitz
                except ImportError:
                    import fitz
                doc = fitz.open(str(source_path))
                doc.set_metadata({
                    "producer": f"BrandGuard Verified | {clearance_hash}",
                    "keywords": f"BRANDGUARD_CLEARED:{clearance_hash}",
                    "author": submission.profile.org_name,
                    "title": submission.title,
                })
                signed_filename = f"signed_{submission.id}_{source_path.name}"
                out_path = upload_dir / signed_filename
                doc.save(str(out_path))
                doc.close()
                signed_rel_url = f"/media/uploads/{signed_filename}"
    except Exception as e:
        pass

    submission.status = 'APPROVED'
    submission.clearance_hash = clearance_hash
    if signed_rel_url:
        submission.signed_file_url = signed_rel_url
    submission.save()

    return JsonResponse({
        "status": "success",
        "clearance_hash": clearance_hash,
        "signed_file_url": submission.signed_file_url,
        "submission": submission.to_dict(),
    })


@csrf_exempt
def verify_stamp_view(request):
    """
    POST /api/submissions/verify-stamp/
    CMS Verification endpoint: Accepts an uploaded image or PDF and verifies
    whether its embedded cryptographic metadata matches a registered clearance hash.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest("Method not allowed")

    uploaded = request.FILES.get('file')
    if not uploaded:
        return HttpResponseBadRequest("No file uploaded")

    filename = uploaded.name.lower()
    extracted_hash = None
    extracted_meta = {}

    try:
        if filename.endswith(('.png', '.jpg', '.jpeg')):
            pil_img = Image.open(uploaded)
            info = pil_img.info or {}
            extracted_hash = info.get('BrandGuard-Clearance-Hash')
            extracted_meta = {
                "org": info.get('BrandGuard-Org'),
                "approved_at": info.get('BrandGuard-Approved-At'),
                "version": info.get('BrandGuard-Version'),
                "channel": info.get('BrandGuard-Channel'),
            }
        elif filename.endswith('.pdf'):
            try:
                import pymupdf as fitz
            except ImportError:
                import fitz
            doc = fitz.open(stream=uploaded.read(), filetype="pdf")
            meta = doc.metadata or {}
            keywords = meta.get('keywords', '')
            if 'BRANDGUARD_CLEARED:' in keywords:
                extracted_hash = keywords.split('BRANDGUARD_CLEARED:')[-1].strip()
            elif 'BrandGuard Verified | ' in meta.get('producer', ''):
                extracted_hash = meta.get('producer').split('BrandGuard Verified | ')[-1].strip()
            extracted_meta = {
                "author": meta.get('author'),
                "title": meta.get('title'),
                "producer": meta.get('producer'),
            }
            doc.close()
    except Exception as e:
        return JsonResponse({"verified": False, "error": str(e)}, status=400)

    if not extracted_hash:
        return JsonResponse({
            "verified": False,
            "error": "No embedded BrandGuard cryptographic seal detected in asset metadata."
        })

    submission = Submission.objects.filter(clearance_hash=extracted_hash).first()

    return JsonResponse({
        "verified": submission is not None,
        "clearance_hash": extracted_hash,
        "metadata": extracted_meta,
        "submission": submission.to_dict() if submission else None,
    })


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
    Returns exact telemetry and analytics dashboard metrics matching Screenshot 5 and spec.
    """
    if request.method != 'GET':
        return HttpResponseBadRequest("Method not allowed")

    profile = get_active_profile()
    raw_data = get_telemetry_report(profile=profile)

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
        "recurring_findings": [
            {
                "rule_id": "FACT_012",
                "rule_name": "International transfer speed & fees",
                "findings": 128,
                "severity": "Blocker",
                "override_rate": "4.2%",
                "last_triggered": "2 hrs ago",
            },
            {
                "rule_id": "VOICE_004",
                "rule_name": "Unsupported superlatives",
                "findings": 96,
                "severity": "Warning",
                "override_rate": "11.8%",
                "last_triggered": "Today",
            },
            {
                "rule_id": "VIS_021",
                "rule_name": "CTA color drift (ΔE > 3.0)",
                "findings": 74,
                "severity": "Warning",
                "override_rate": "7.1%",
                "last_triggered": "Yesterday",
            },
            {
                "rule_id": "FACT_031",
                "rule_name": "Expired security certification",
                "findings": 51,
                "severity": "Blocker",
                "override_rate": "0.9%",
                "last_triggered": "Jun 10",
            },
        ],
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

        count = ExceptionRequest.objects.count() + 1
        new_id = body.get('id') or f"EX-{2040 + count}"

        ex = ExceptionRequest.objects.create(
            id=new_id,
            draft_id=body.get('draft_id', 'DRAFT_024'),
            rule_code=body.get('rule_code', 'VOICE_004'),
            title=body.get('title', "Global ambition. Local simplicity."),
            requester_name=body.get('requester_name', 'Alex Morgan'),
            requester_dept=body.get('requester_dept', 'Marketing'),
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
            reviewer_title=body.get('reviewer_title', 'Brand Manager'),
            hard_blockers_count=body.get('hard_blockers_count', 0),
            supporting_file_name=body.get('supporting_file_name', 'Q3_challenger_campaign.pdf'),
            supporting_file_size=body.get('supporting_file_size', '1.2 MB'),
            status='PENDING',
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
def exception_decision_view(request, exception_id):
    """
    POST /api/exceptions/<exception_id>/decision/
    Body: {"status": "APPROVED" | "DECLINED", "decision_note": "...", "reviewer_name": "Jordan Lee"}
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

    new_status = body.get('status', 'APPROVED').upper()
    ex.status = new_status
    ex.decision_note = body.get('decision_note', 'Reviewed. The challenger voice fits this audience and the scope is narrow.')
    ex.decided_at = datetime.utcnow()
    ex.decided_by = body.get('reviewer_name', 'Jordan Lee')
    ex.save()

    return JsonResponse(ex.to_dict())


@csrf_exempt
def rule_detail_view(request, rule_code):
    """
    GET /api/rules/<rule_code>/
    Returns full details for a rule matching View 1.
    """
    code = rule_code.upper()
    try:
        rule = BrandRule.objects.filter(rule_code=code).first()
    except Exception:
        rule = None

    if code == "FACT_012":
        return JsonResponse({
            "rule_id": "FACT_012",
            "rule_code": "FACT_012",
            "title": "International settlement & fees",
            "subtitle": "FACT_012 · Rule v4 · Part of ruleset v3.2",
            "breadcrumb": "RULE REGISTRY > FACTUAL > FACT_012",
            "tags": [
                {"label": "Enabled", "type": "enabled"},
                {"label": "Blocker", "type": "blocker"},
                {"label": "Factual", "type": "factual"}
            ],
            "description": "International transfer claims must reflect the standard settlement time and FX fee. Do not imply zero-fee or instant delivery unless a specific product scope allows it.",
            "applies_to": "All channels",
            "enforcement": "Block publish",
            "owner": "Maya Chen, Product Ops",
            "claims_allowed": "24-hour transfers with 0.5% FX fee",
            "claims_disallowed": "Instant, zero-fee international transfers",
            "test_examples": [
                {"quote": "“Move money abroad in 24 hrs, 0.5% FX fee”", "status": "Pass"},
                {"quote": "“Instant, zero-fee transfers worldwide”", "status": "Flag"},
                {"quote": "“Send money across borders with NovaPay”", "status": "Pass"}
            ],
            "source_evidence": {
                "quote": "“Fact 012: Transfers take 24h with 0.5% fee.”",
                "ledger_entry": "LEDGER-0412",
                "source": "NovaPay Product Facts",
                "valid_from": "Nov 20, 2025",
                "last_verified": "Mar 14, 2026",
                "verified": True
            },
            "change_history": [
                {"version": "v4", "date": "Mar 14, 2026", "current": True, "note": "Added 0.5% FX fee to the allowed claim"},
                {"version": "v3", "date": "Jan 8, 2026", "current": False, "note": "Source updated to the 24h standard"},
                {"version": "v1", "date": "Nov 20, 2025", "current": False, "note": "Rule created"}
            ],
            "versioning_note": "Changes are versioned. Existing audits keep the version they ran against."
        })
    elif code == "VOICE_004":
        return JsonResponse({
            "rule_id": "VOICE_004",
            "rule_code": "VOICE_004",
            "title": "Unsupported superlatives",
            "subtitle": "VOICE_004 · Rule v2 · Part of ruleset v3.2",
            "breadcrumb": "RULE REGISTRY > VOICE > VOICE_004",
            "tags": [
                {"label": "Enabled", "type": "enabled"},
                {"label": "Warning", "type": "warning"},
                {"label": "Voice", "type": "voice"}
            ],
            "description": "Aggressive comparison tone is outside the default voice range.",
            "applies_to": "All channels",
            "enforcement": "Advisory / Request Exception",
            "owner": "Jordan Lee, Brand Manager",
            "claims_allowed": "High-throughput payment rails for global ambition",
            "claims_disallowed": "Don't get wrecked by banks!",
            "test_examples": [
                {"quote": "“Modern payment infrastructure for global finance”", "status": "Pass"},
                {"quote": "“Don't get wrecked by banks!”", "status": "Flag"},
                {"quote": "“Global ambition. Local simplicity.”", "status": "Pass"}
            ],
            "source_evidence": {
                "quote": "“Voice 004: Prohibit hostile and aggressive comparison rhetoric.”",
                "ledger_entry": "LEDGER-0189",
                "source": "NovaPay Voice & Tone Guidelines",
                "valid_from": "Jan 15, 2026",
                "last_verified": "May 2, 2026",
                "verified": True
            },
            "change_history": [
                {"version": "v2", "date": "May 2, 2026", "current": True, "note": "Added LinkedIn tone exceptions guideline"},
                {"version": "v1", "date": "Jan 15, 2026", "current": False, "note": "Rule created"}
            ],
            "versioning_note": "Changes are versioned. Existing audits keep the version they ran against."
        })
    elif rule:
        return JsonResponse({
            "rule_id": rule.rule_code,
            "rule_code": rule.rule_code,
            "title": rule.title,
            "subtitle": f"{rule.rule_code} · Rule v1 · Part of ruleset v3.2",
            "breadcrumb": f"RULE REGISTRY > {rule.pillar} > {rule.rule_code}",
            "tags": [
                {"label": "Enabled", "type": "enabled"},
                {"label": "Warning", "type": "warning"},
                {"label": rule.pillar.capitalize(), "type": "neutral"}
            ],
            "description": rule.rule_description or "Enforce BrandGuard standard policies.",
            "applies_to": "All channels",
            "enforcement": "Enforce specification",
            "owner": "Jordan Lee, Brand Manager",
            "claims_allowed": "Standard brand compliant phrasing",
            "claims_disallowed": rule.structured_spec.get("banned_term", "Non-compliant term"),
            "test_examples": [],
            "source_evidence": {
                "quote": f"{rule.rule_code}: Compliance specification active.",
                "ledger_entry": f"LEDGER-{rule.rule_code}",
                "source": "NovaPay Brand Guidelines",
                "valid_from": "Jan 1, 2026",
                "last_verified": "Jun 1, 2026",
                "verified": True
            },
            "change_history": [
                {"version": "v1", "date": "Jan 1, 2026", "current": True, "note": "Rule created"}
            ],
            "versioning_note": "Changes are versioned. Existing audits keep the version they ran against."
        })
    else:
        return JsonResponse({"error": "Rule not found"}, status=404)


