import uuid
from datetime import date
from django.db import models


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
            'rules': [r.to_dict() for r in self.rules.all().order_by('rule_code')],
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

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='rules')
    pillar = models.CharField(max_length=32, choices=PILLAR_CHOICES)
    rule_code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    structured_spec = models.JSONField(default=dict)
    rule_description = models.TextField(blank=True)
    trigger_count = models.IntegerField(default=0)
    override_count = models.IntegerField(default=0)

    def to_dict(self):
        return {
            'id': str(self.id),
            'profile_id': str(self.profile_id),
            'pillar': self.pillar,
            'rule_code': self.rule_code,
            'title': self.title,
            'structured_spec': self.structured_spec,
            'rule_description': self.rule_description,
            'trigger_count': self.trigger_count,
            'override_count': self.override_count,
        }

    def __str__(self):
        return f"{self.rule_code} - {self.title}"


class FactLedger(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='facts')
    fact_code = models.CharField(max_length=64)
    category = models.CharField(max_length=128)
    claim_truth = models.TextField()
    last_verified = models.DateField()
    valid_until = models.DateField()
    superseded_by_text = models.TextField(blank=True)
    trigger_count = models.IntegerField(default=0)
    override_count = models.IntegerField(default=0)

    @property
    def is_expired(self):
        return self.valid_until < date.today()

    @property
    def blast_radius_count(self):
        try:
            count = 0
            for sub in self.profile.submissions.all():
                latest_v = sub.versions.order_by('-version_number').first()
                if not latest_v:
                    continue
                if (latest_v.findings.filter(rule_citation_code=self.fact_code).exists()
                    or self.fact_code.lower() in latest_v.raw_text.lower()):
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
            'blast_radius_count': self.blast_radius_count,
            'trigger_count': self.trigger_count,
            'override_count': self.override_count,
        }

    def __str__(self):
        return f"{self.fact_code} - {self.category}"


class Submission(models.Model):
    CHANNEL_CHOICES = [
        ('LINKEDIN_POST', 'LinkedIn Post'),
        ('PRESS_RELEASE', 'Press Release'),
        ('PITCH_DECK', 'Pitch Deck'),
        ('LANDING_PAGE', 'Landing Page'),
    ]
    STATUS_CHOICES = [
        ('IN_REVIEW', 'In Review'),
        ('EXCEPTION_PENDING', 'Exception Pending'),
        ('APPROVED', 'Approved'),
        ('STALE_REAUDIT_REQUIRED', 'Stale Re-Audit Required'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='submissions')
    title = models.CharField(max_length=255)
    channel_context = models.CharField(max_length=64, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=64, choices=STATUS_CHOICES, default='IN_REVIEW')
    confidential_mode = models.BooleanField(default=False)
    clearance_hash = models.CharField(max_length=128, blank=True)
    signed_file_url = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'profile_id': str(self.profile_id),
            'title': self.title,
            'channel_context': self.channel_context,
            'status': self.status,
            'confidential_mode': self.confidential_mode,
            'clearance_hash': self.clearance_hash,
            'signed_file_url': self.signed_file_url,
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
    suggested_fixes = models.JSONField(default=list)  # list of strings
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


class ExceptionRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('DECLINED', 'Declined'),
    ]

    id = models.CharField(max_length=64, primary_key=True)  # e.g. "EX-2041"
    draft_id = models.CharField(max_length=64, default='DRAFT_024')
    rule_code = models.CharField(max_length=64, default='VOICE_004')
    title = models.CharField(max_length=255, default='Global ambition. Local simplicity.')
    requester_name = models.CharField(max_length=128, default='Alex Morgan')
    requester_dept = models.CharField(max_length=128, default='Marketing')
    requested_date = models.DateField(default=date.today)
    warning_type = models.CharField(max_length=128, default='Warning · Voice')
    quote_text = models.TextField(default="Don't get wrecked by banks!")
    rule_description = models.TextField(default="Aggressive comparison tone is outside the default voice range.")
    justification = models.TextField(default="This is an intentional challenger voice for NovaPay's 'Global ambition' campaign. It addresses banking friction, not individuals or protected groups, and makes no fee or speed claim.")
    campaign_reference = models.CharField(max_length=255, default='Global ambition · Q3 2026 launch')
    scope = models.CharField(max_length=128, default='This draft only')
    channel = models.CharField(max_length=128, default='LinkedIn post')
    expires_on = models.DateField(default=date(2026, 10, 31))
    reviewer_name = models.CharField(max_length=128, default='Jordan Lee')
    reviewer_title = models.CharField(max_length=128, default='Brand Manager')
    hard_blockers_count = models.IntegerField(default=0)
    supporting_file_name = models.CharField(max_length=255, default='Q3_challenger_campaign.pdf')
    supporting_file_size = models.CharField(max_length=64, default='1.2 MB')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='PENDING')
    decision_note = models.TextField(blank=True, default='')
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.CharField(max_length=128, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'id': self.id,
            'draft_id': self.draft_id,
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
            'status': self.status,
            'decision_note': self.decision_note,
            'decided_at': self.decided_at.isoformat() if self.decided_at else None,
            'decided_by': self.decided_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __str__(self):
        return f"{self.id} - {self.title} ({self.status})"

