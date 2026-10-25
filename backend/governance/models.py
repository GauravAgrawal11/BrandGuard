import uuid
import hmac
import hashlib
from datetime import date, datetime
from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser


class BrandGuardUser(AbstractUser):
    """
    Custom user model for BrandGuard supporting exactly two roles:
    - ADMIN: Full governance control, rules, scraper, playground, reviews, team management, telemetry
    - CONTENT_WRITER: Pre-flight audit, patch application, scoped voice/tone exceptions, submissions
    """
    ROLE_CHOICES = [
        ('ADMIN', 'Admin / Brand Governance Lead'),
        ('CONTENT_WRITER', 'Content Writer'),
    ]

    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default='CONTENT_WRITER')
    department = models.CharField(max_length=128, default='Marketing')
    avatar_color = models.CharField(max_length=32, default='#0A3423')

    @property
    def is_admin_user(self):
        return self.role == 'ADMIN' or self.is_superuser

    @property
    def is_writer_user(self):
        return self.role == 'CONTENT_WRITER'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'name': self.get_full_name() or self.username,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'role': self.role,
            'department': self.department,
            'avatar_color': self.avatar_color,
            'is_active': self.is_active,
            'date_joined': self.date_joined.isoformat() if self.date_joined else None,
        }

    def __str__(self):
        return f"{self.username} ({self.role})"


class SystemSettings(models.Model):
    """
    Global BrandGuard settings configurable by Admins.
    Maintains defaults as fallbacks.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    confidential_mode_default = models.BooleanField(default=True)
    ruleset_version = models.CharField(max_length=32, default='v3.2')
    blocker_penalty = models.FloatField(default=18.0)
    warning_penalty = models.FloatField(default=8.0)
    approved_exception_deduction = models.FloatField(default=4.0)
    color_distance_algorithm = models.CharField(max_length=32, default='CIEDE2000')  # CIEDE2000 | CIE76
    color_distance_threshold = models.FloatField(default=4.0)
    friction_min_triggers = models.IntegerField(default=20)
    notification_email = models.CharField(max_length=255, blank=True, default='brand-ops@novapay.io')
    notification_slack_webhook = models.CharField(max_length=512, blank=True, default='')
    languages_supported = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_settings(cls):
        obj = cls.objects.first()
        if not obj:
            obj = cls.objects.create(
                confidential_mode_default=True,
                ruleset_version='v3.2',
                blocker_penalty=18.0,
                warning_penalty=8.0,
                approved_exception_deduction=4.0,
                color_distance_algorithm='CIEDE2000',
                color_distance_threshold=4.0,
                friction_min_triggers=20,
                languages_supported=["en", "es", "fr", "de", "ja"]
            )
        return obj

    def to_dict(self):
        return {
            'confidential_mode_default': self.confidential_mode_default,
            'ruleset_version': self.ruleset_version,
            'blocker_penalty': self.blocker_penalty,
            'warning_penalty': self.warning_penalty,
            'approved_exception_deduction': self.approved_exception_deduction,
            'color_distance_algorithm': self.color_distance_algorithm,
            'color_distance_threshold': self.color_distance_threshold,
            'friction_min_triggers': self.friction_min_triggers,
            'notification_email': self.notification_email,
            'notification_slack_webhook': self.notification_slack_webhook,
            'languages_supported': self.languages_supported or ["en", "es", "fr", "de", "ja"],
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __str__(self):
        return f"SystemSettings ({self.ruleset_version})"


class BrandProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_name = models.CharField(max_length=255)
    allowed_hex_palette = models.JSONField(default=list)  # list of {"name": str, "hex": str, "max_delta_e": float}
    allowed_fonts = models.JSONField(default=list)  # list of strings
    wcag_min_ratio = models.FloatField(default=4.5)
    logo_aspect_ratio = models.FloatField(default=3.5)

    def to_dict(self):
        return {
            'id': str(self.id),
            'org_name': self.org_name,
            'allowed_hex_palette': self.allowed_hex_palette,
            'allowed_fonts': self.allowed_fonts,
            'wcag_min_ratio': self.wcag_min_ratio,
            'logo_aspect_ratio': self.logo_aspect_ratio,
            'rules': [r.to_dict() for r in self.rules.filter(is_active=True).order_by('rule_code')],
            'facts': [f.to_dict() for f in self.facts.all().order_by('fact_code')],
        }

    def __str__(self):
        return self.org_name


class BrandRule(models.Model):
    PILLAR_CHOICES = [
        ('VISUAL', 'Visual'),
        ('FACTUAL', 'Factual'),
        ('TONE', 'Tone'),
    ]
    SEVERITY_CHOICES = [
        ('BLOCKER', 'Blocker'),
        ('WARNING', 'Warning'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='rules')
    pillar = models.CharField(max_length=32, choices=PILLAR_CHOICES)
    rule_code = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=255)
    version = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    severity = models.CharField(max_length=32, choices=SEVERITY_CHOICES, default='WARNING')
    enforcement = models.CharField(max_length=64, default='Block publish')
    claims_allowed = models.TextField(blank=True, default='')
    claims_disallowed = models.TextField(blank=True, default='')
    source = models.CharField(max_length=255, blank=True, default='NovaPay Brand Guidelines')
    applies_to = models.CharField(max_length=128, default='All channels')
    language = models.CharField(max_length=16, default='en')
    owner = models.CharField(max_length=128, default='Jordan Lee, Brand Governance Lead')
    structured_spec = models.JSONField(default=dict)
    rule_description = models.TextField(blank=True)
    trigger_count = models.IntegerField(default=0)
    override_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def override_rate(self):
        if self.trigger_count == 0:
            return 0.0
        return round((self.override_count / self.trigger_count) * 100, 1)

    def to_dict(self):
        return {
            'id': str(self.id),
            'profile_id': str(self.profile_id),
            'pillar': self.pillar,
            'rule_code': self.rule_code,
            'title': self.title,
            'version': self.version,
            'is_active': self.is_active,
            'severity': self.severity,
            'enforcement': self.enforcement,
            'claims_allowed': self.claims_allowed,
            'claims_disallowed': self.claims_disallowed,
            'source': self.source,
            'applies_to': self.applies_to,
            'language': self.language,
            'owner': self.owner,
            'structured_spec': self.structured_spec,
            'rule_description': self.rule_description,
            'trigger_count': self.trigger_count,
            'override_count': self.override_count,
            'override_rate': self.override_rate,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __str__(self):
        return f"{self.rule_code} - {self.title} (v{self.version})"


class BrandRuleVersion(models.Model):
    """Immutable version snapshot for rollback and historical comparison."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule = models.ForeignKey(BrandRule, on_delete=models.CASCADE, related_name='versions')
    version_number = models.IntegerField()
    title = models.CharField(max_length=255)
    pillar = models.CharField(max_length=32)
    severity = models.CharField(max_length=32)
    structured_spec = models.JSONField(default=dict)
    rule_description = models.TextField(blank=True)
    claims_allowed = models.TextField(blank=True)
    claims_disallowed = models.TextField(blank=True)
    enforcement = models.CharField(max_length=64)
    source = models.CharField(max_length=255, blank=True)
    change_note = models.TextField(blank=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version_number']

    def to_dict(self):
        return {
            'id': str(self.id),
            'rule_id': str(self.rule_id),
            'rule_code': self.rule.rule_code,
            'version_number': self.version_number,
            'title': self.title,
            'pillar': self.pillar,
            'severity': self.severity,
            'structured_spec': self.structured_spec,
            'rule_description': self.rule_description,
            'claims_allowed': self.claims_allowed,
            'claims_disallowed': self.claims_disallowed,
            'enforcement': self.enforcement,
            'source': self.source,
            'change_note': self.change_note,
            'changed_by': self.changed_by.username if self.changed_by else 'System',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __str__(self):
        return f"{self.rule.rule_code} v{self.version_number}"


class DraftRule(models.Model):
    """
    Parsed or scraped rule awaiting Admin review and activation.
    Never auto-activated.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    SOURCE_TYPE_CHOICES = [
        ('UPLOAD', 'File Upload'),
        ('SCRAPE', 'URL Scraper'),
        ('MANUAL', 'Manual Draft'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule_code = models.CharField(max_length=64)
    pillar = models.CharField(max_length=32, default='TONE')
    title = models.CharField(max_length=255)
    severity = models.CharField(max_length=32, default='WARNING')
    enforcement = models.CharField(max_length=64, default='Block publish')
    claims_allowed = models.TextField(blank=True)
    claims_disallowed = models.TextField(blank=True)
    source = models.CharField(max_length=255, default='Uploaded document')
    source_type = models.CharField(max_length=32, choices=SOURCE_TYPE_CHOICES, default='UPLOAD')
    structured_spec = models.JSONField(default=dict)
    rule_description = models.TextField(blank=True)
    language = models.CharField(max_length=16, default='en')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='DRAFT')
    review_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'rule_code': self.rule_code,
            'pillar': self.pillar,
            'title': self.title,
            'severity': self.severity,
            'enforcement': self.enforcement,
            'claims_allowed': self.claims_allowed,
            'claims_disallowed': self.claims_disallowed,
            'source': self.source,
            'source_type': self.source_type,
            'structured_spec': self.structured_spec,
            'rule_description': self.rule_description,
            'language': self.language,
            'status': self.status,
            'review_notes': self.review_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __str__(self):
        return f"[DRAFT] {self.rule_code} - {self.title} ({self.status})"


class FactLedger(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='facts')
    fact_code = models.CharField(max_length=64, db_index=True)
    category = models.CharField(max_length=128)
    claim_truth = models.TextField()
    last_verified = models.DateField()
    valid_until = models.DateField()
    superseded_by_text = models.TextField(blank=True)
    is_verified = models.BooleanField(default=True)  # Scraped facts are unverified until admin checks
    source = models.CharField(max_length=255, default='NovaPay Product Facts')
    trigger_count = models.IntegerField(default=0)
    override_count = models.IntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    @property
    def is_expired(self):
        return self.valid_until < date.today()

    @property
    def days_until_expiry(self):
        delta = self.valid_until - date.today()
        return delta.days

    @property
    def blast_radius_count(self):
        try:
            count = 0
            for sub in self.profile.submissions.all():
                latest_v = sub.versions.order_by('-version_number').first()
                if not latest_v:
                    continue
                if (latest_v.findings.filter(rule_citation_code=self.fact_code).exists()
                    or self.fact_code.lower() in latest_v.raw_text.lower()
                    or any(w.lower() in latest_v.raw_text.lower() for w in self.claim_truth.split() if len(w) > 5)):
                    count += 1
            return max(count, 1 if self.is_expired else 0)
        except Exception:
            return 0

    def to_dict(self):
        return {
            'id': str(self.id),
            'profile_id': str(self.profile_id),
            'fact_code': self.fact_code,
            'category': self.category,
            'claim_truth': self.claim_truth,
            'last_verified': self.last_verified.isoformat() if self.last_verified else None,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'superseded_by_text': self.superseded_by_text,
            'is_expired': self.is_expired,
            'is_verified': self.is_verified,
            'source': self.source,
            'days_until_expiry': self.days_until_expiry,
            'blast_radius_count': self.blast_radius_count,
            'trigger_count': self.trigger_count,
            'override_count': self.override_count,
        }

    def __str__(self):
        return f"{self.fact_code} - {self.category} ({'EXPIRED' if self.is_expired else 'ACTIVE'})"


class Submission(models.Model):
    CHANNEL_CHOICES = [
        ('LINKEDIN_POST', 'LinkedIn Post'),
        ('PRESS_RELEASE', 'Press Release'),
        ('PITCH_DECK', 'Pitch Deck'),
        ('LANDING_PAGE', 'Landing Page'),
    ]
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('IN_REVIEW', 'In Review'),
        ('EXCEPTION_PENDING', 'Exception Pending'),
        ('APPROVED', 'Brand-Compliance Cleared'),
        ('STALE_REAUDIT_REQUIRED', 'Stale Re-Audit Required'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='submissions')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='submissions')
    title = models.CharField(max_length=255)
    channel_context = models.CharField(max_length=64, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=64, choices=STATUS_CHOICES, default='IN_REVIEW')
    confidential_mode = models.BooleanField(default=False)
    clearance_hash = models.CharField(max_length=128, blank=True)
    clearance_signature = models.TextField(blank=True)
    signed_file_url = models.CharField(max_length=512, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_submissions')
    approved_at = models.DateTimeField(null=True, blank=True)
    audit_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        latest_ver = self.versions.order_by('-version_number').first()
        return {
            'id': str(self.id),
            'profile_id': str(self.profile_id),
            'author': self.author.to_dict() if self.author else None,
            'title': self.title,
            'channel_context': self.channel_context,
            'status': self.status,
            'confidential_mode': self.confidential_mode,
            'clearance_hash': self.clearance_hash,
            'clearance_signature': self.clearance_signature,
            'signed_file_url': self.signed_file_url,
            'approved_by': self.approved_by.username if self.approved_by else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'audit_notes': self.audit_notes,
            'latest_score': latest_ver.compliance_score if latest_ver else 100.0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'versions': [v.to_dict() for v in self.versions.all().order_by('version_number')],
        }

    def __str__(self):
        return f"{self.title} ({self.status})"


class SubmissionVersion(models.Model):
    FILE_TYPE_CHOICES = [
        ('TEXT', 'Text'),
        ('IMAGE', 'Image'),
        ('PDF', 'PDF'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='versions')
    version_number = models.IntegerField(default=1)
    raw_text = models.TextField(blank=True)
    uploaded_file = models.FileField(upload_to='uploads/', null=True, blank=True)
    file_type = models.CharField(max_length=32, choices=FILE_TYPE_CHOICES, default='TEXT')
    compliance_score = models.FloatField(default=100.0)
    score_breakdown = models.JSONField(default=dict, blank=True)
    voice_fingerprint = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'submission_id': str(self.submission_id),
            'version_number': self.version_number,
            'raw_text': self.raw_text,
            'uploaded_file_url': self.uploaded_file.url if self.uploaded_file else None,
            'file_type': self.file_type,
            'compliance_score': round(self.compliance_score, 1),
            'score_breakdown': self.score_breakdown,
            'voice_fingerprint': self.voice_fingerprint,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'findings': [f.to_dict() for f in self.findings.all()],
        }

    def __str__(self):
        return f"{self.submission.title} v{self.version_number}"


class AuditFinding(models.Model):
    PILLAR_CHOICES = [
        ('VISUAL', 'Visual'),
        ('FACTUAL', 'Factual'),
        ('TONE', 'Tone'),
    ]
    SEVERITY_CHOICES = [
        ('BLOCKER', 'Blocker'),
        ('WARNING', 'Warning'),
    ]
    PROVENANCE_CHOICES = [
        ('DETERMINISTIC_CV', 'Deterministic CV'),
        ('DETERMINISTIC_LEXICON', 'Deterministic Lexicon'),
        ('HYBRID_RAG_LLM', 'Hybrid RAG LLM'),
    ]
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('ACCEPTED', 'Accepted'),
        ('OVERRIDDEN_PENDING', 'Overridden Pending'),
        ('OVERRIDE_APPROVED', 'Override Approved'),
        ('REJECTED', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(SubmissionVersion, on_delete=models.CASCADE, related_name='findings')
    pillar = models.CharField(max_length=32, choices=PILLAR_CHOICES)
    severity = models.CharField(max_length=32, choices=SEVERITY_CHOICES)
    engine_provenance = models.CharField(max_length=64, choices=PROVENANCE_CHOICES)
    confidence = models.FloatField(default=1.0)
    rule_citation_code = models.CharField(max_length=64)
    rule_citation_title = models.CharField(max_length=255)
    source_excerpt = models.TextField(blank=True)
    location_json = models.JSONField(default=dict)
    explanation = models.TextField()
    suggested_fixes = models.JSONField(default=list)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='OPEN')
    override_reason = models.TextField(blank=True)
    reviewer_comment = models.TextField(blank=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'version_id': str(self.version_id),
            'pillar': self.pillar,
            'severity': self.severity,
            'engine_provenance': self.engine_provenance,
            'confidence': self.confidence,
            'rule_citation_code': self.rule_citation_code,
            'rule_citation_title': self.rule_citation_title,
            'source_excerpt': self.source_excerpt,
            'location_json': self.location_json,
            'explanation': self.explanation,
            'suggested_fixes': self.suggested_fixes,
            'status': self.status,
            'override_reason': self.override_reason,
            'reviewer_comment': self.reviewer_comment,
        }

    def __str__(self):
        return f"[{self.severity}] {self.rule_citation_code}: {self.rule_citation_title}"


class BrandComplianceSignature(models.Model):
    """
    Cryptographic HMAC-SHA256 clearance signature stored in database
    to withstand social media platforms stripping PNG/PDF metadata.
    Verified against (file hash + draft id + ruleset version + approver + timestamp).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='signatures')
    file_sha256 = models.CharField(max_length=128, db_index=True)
    draft_id = models.CharField(max_length=128, db_index=True)
    ruleset_version = models.CharField(max_length=32)
    approver_username = models.CharField(max_length=150)
    timestamp = models.DateTimeField()
    hmac_signature = models.CharField(max_length=256, db_index=True)
    ed25519_signature = models.CharField(max_length=256, blank=True, default='')
    ed25519_public_key = models.CharField(max_length=256, blank=True, default='')
    canonical_payload = models.TextField()
    legal_notice = models.TextField(default="Brand-compliance cleared. Not a substitute for formal legal review.")
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def create_signature(cls, submission, file_bytes, approver_username):
        from governance.crypto_sign import (
            build_canonical_payload, sign_hmac_sha256, sign_ed25519, get_ed25519_keys, LEGAL_NOTICE
        )
        settings_obj = SystemSettings.get_settings()
        ruleset_ver = settings_obj.ruleset_version
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        now = datetime.utcnow()
        now_iso = now.isoformat() + 'Z'
        payload = build_canonical_payload(file_hash, str(submission.id), ruleset_ver, approver_username, now_iso)
        hmac_sig = sign_hmac_sha256(payload)
        _, _, ed25519_pub_hex = get_ed25519_keys()
        ed25519_sig = sign_ed25519(payload)

        return cls.objects.create(
            submission=submission,
            file_sha256=file_hash,
            draft_id=str(submission.id),
            ruleset_version=ruleset_ver,
            approver_username=approver_username,
            timestamp=now,
            hmac_signature=hmac_sig,
            ed25519_signature=ed25519_sig,
            ed25519_public_key=ed25519_pub_hex,
            canonical_payload=payload,
            legal_notice=LEGAL_NOTICE
        )

    def to_dict(self):
        return {
            'id': str(self.id),
            'submission_id': str(self.submission_id),
            'file_sha256': self.file_sha256,
            'draft_id': self.draft_id,
            'ruleset_version': self.ruleset_version,
            'approver_username': self.approver_username,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'hmac_signature': self.hmac_signature,
            'ed25519_signature': self.ed25519_signature,
            'ed25519_public_key': self.ed25519_public_key,
            'canonical_payload': self.canonical_payload,
            'legal_notice': self.legal_notice,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __str__(self):
        return f"Sig-{self.hmac_signature[:16]} ({self.draft_id})"


class ExceptionRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('DECLINED', 'Declined'),
    ]

    id = models.CharField(max_length=64, primary_key=True)  # e.g. "EX-2041"
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, null=True, blank=True, related_name='exceptions')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='exceptions_created')
    draft_id = models.CharField(max_length=64, default='DRAFT_024')
    rule_code = models.CharField(max_length=64, default='VOICE_004')
    title = models.CharField(max_length=255, default='Global ambition. Local simplicity.')
    requester_name = models.CharField(max_length=128, default='Alex Morgan')
    requester_dept = models.CharField(max_length=128, default='Marketing')
    requested_date = models.DateField(default=date.today)
    warning_type = models.CharField(max_length=128, default='Warning · Voice')
    quote_text = models.TextField(default="Don't get wrecked by banks!")
    rule_description = models.TextField(default="Aggressive comparison tone is outside the default voice range.")
    justification = models.TextField(default="This is an intentional challenger voice for NovaPay's 'Global ambition' campaign.")
    campaign_reference = models.CharField(max_length=255, default='Global ambition · Q3 2026 launch')
    scope = models.CharField(max_length=128, default='This draft only')
    channel = models.CharField(max_length=128, default='LinkedIn post')
    expires_on = models.DateField(default=date(2026, 10, 31))
    reviewer_name = models.CharField(max_length=128, default='Jordan Lee')
    reviewer_title = models.CharField(max_length=128, default='Brand Governance Lead')
    hard_blockers_count = models.IntegerField(default=0)
    supporting_file_name = models.CharField(max_length=255, default='Q3_challenger_campaign.pdf')
    supporting_file_size = models.CharField(max_length=64, default='1.2 MB')
    evidence_file = models.FileField(upload_to='evidence/', null=True, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='PENDING')
    decision_note = models.TextField(blank=True, default='')
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.CharField(max_length=128, blank=True, default='')
    decided_by_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='exceptions_decided')
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'id': self.id,
            'draft_id': self.draft_id,
            'submission_id': str(self.submission_id) if self.submission_id else None,
            'rule_code': self.rule_code,
            'title': self.title,
            'requester_name': self.requester_name,
            'requester_dept': self.requester_dept,
            'requested_date': self.requested_date.strftime('%b %d, %Y') if self.requested_date else '',
            'warning_type': self.warning_type,
            'quote_text': self.quote_text,
            'rule_description': self.rule_description,
            'justification': self.justification,
            'campaign_reference': self.campaign_reference,
            'scope': self.scope,
            'channel': self.channel,
            'expires_on': self.expires_on.strftime('%b %d, %Y') if self.expires_on else '',
            'reviewer_name': self.reviewer_name,
            'reviewer_title': self.reviewer_title,
            'hard_blockers_count': self.hard_blockers_count,
            'supporting_file_name': self.supporting_file_name,
            'supporting_file_size': self.supporting_file_size,
            'evidence_file_url': self.evidence_file.url if self.evidence_file else None,
            'status': self.status,
            'decision_note': self.decision_note,
            'decided_at': self.decided_at.isoformat() if self.decided_at else None,
            'decided_by': self.decided_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __str__(self):
        return f"{self.id} - {self.title} ({self.status})"


class Notification(models.Model):
    """In-app notifications for exception decisions and expiring facts."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=64, default='INFO')  # EXCEPTION_DECIDED, FACT_EXPIRING, AUDIT_COMPLETE
    link_url = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def to_dict(self):
        return {
            'id': str(self.id),
            'recipient_id': self.recipient_id,
            'title': self.title,
            'message': self.message,
            'notification_type': self.notification_type,
            'link_url': self.link_url,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __str__(self):
        return f"Notification to {self.recipient.username}: {self.title}"


class AuditTrail(models.Model):
    """
    Immutable audit trail logging who did what and when
    for every rule change, decision, override, and publication download.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    user_display = models.CharField(max_length=150)
    user_role = models.CharField(max_length=64, default='')
    action = models.CharField(max_length=64)  # RULE_CREATED, RULE_UPDATED, EXCEPTION_APPROVED, FILE_DOWNLOADED, AUDIT_EXECUTED
    entity_type = models.CharField(max_length=64)  # RULE, EXCEPTION, SUBMISSION, FACT, SETTINGS
    entity_id = models.CharField(max_length=128)
    description = models.TextField()
    metadata_json = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def log(cls, request, action, entity_type, entity_id, description, metadata=None):
        user = getattr(request, 'user', None) if request else None
        username = 'System'
        role = 'SYSTEM'
        ip = None
        if user and user.is_authenticated:
            username = getattr(user, 'username', 'User')
            role = getattr(user, 'role', 'UNKNOWN')
        if request:
            ip = request.META.get('REMOTE_ADDR')

        return cls.objects.create(
            user=user if user and user.is_authenticated else None,
            user_display=username,
            user_role=role,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            description=description,
            metadata_json=metadata or {},
            ip_address=ip
        )

    def to_dict(self):
        return {
            'id': str(self.id),
            'user_display': self.user_display,
            'user_role': self.user_role,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'description': self.description,
            'metadata_json': self.metadata_json,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __str__(self):
        return f"[{self.action}] {self.user_display} on {self.entity_type}:{self.entity_id}"
