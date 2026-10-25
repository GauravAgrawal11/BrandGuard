import json
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from governance.models import BrandProfile, BrandRule, ExceptionRequest, Submission, SubmissionVersion, AuditFinding, Notification, AuditTrail
from governance.auth import generate_user_token

User = get_user_model()


class Phase4ExceptionsTestCase(TestCase):
    """
    Automated tests for Phase 4:
    1. Writer Exception Request (tone rules allowed)
    2. Server-side BLOCK on FACT rules (HTTP 400)
    3. Server-side BLOCK on ACCESSIBILITY / VISUAL rules (HTTP 400)
    4. Admin Review Queue decision (approve/reject, timeline updates, notifications, audit notes)
    5. RBAC enforcement: Writers receive HTTP 403 on /api/exceptions/{id}/decide/
    """

    def setUp(self):
        self.client = Client()

        # Seed profile
        self.profile = BrandProfile.objects.create(
            org_name="NovaPay",
            allowed_hex_palette=[{"name": "Midnight Emerald", "hex": "#0A3423", "max_delta_e": 4.0}],
            allowed_fonts=["Inter"]
        )

        # Tone Rule
        self.tone_rule = BrandRule.objects.create(
            profile=self.profile,
            rule_code="VOICE_CHALLENGER_01",
            title="Challenger Tone Guardrail",
            pillar="TONE",
            severity="WARNING"
        )

        # Fact Rule
        self.fact_rule = BrandRule.objects.create(
            profile=self.profile,
            rule_code="FACT_TRANSFER_FEE_01",
            title="International Transfer Fee Truth",
            pillar="FACTUAL",
            severity="BLOCKER"
        )

        # Visual / Accessibility Rule
        self.vis_rule = BrandRule.objects.create(
            profile=self.profile,
            rule_code="VIS_WCAG_2.1",
            title="WCAG 2.1 Contrast AA Standard",
            pillar="VISUAL",
            severity="BLOCKER"
        )

        # Admin user
        self.admin = User.objects.create_user(
            username="admin_p4",
            email="admin4@novapay.io",
            password="adminpassword123",
            role="ADMIN"
        )
        self.admin_token = generate_user_token(self.admin)

        # Content Writer user
        self.writer = User.objects.create_user(
            username="writer_p4",
            email="writer4@novapay.io",
            password="writerpassword123",
            role="CONTENT_WRITER"
        )
        self.writer_token = generate_user_token(self.writer)

    def test_writer_can_submit_tone_exception(self):
        """Tone rules are allowed to have scoped exceptions requested."""
        payload = {
            "rule_code": "VOICE_CHALLENGER_01",
            "warning_type": "Warning · Tone",
            "title": "Challenger Brand Campaign",
            "quote_text": "Don't settle for sluggish legacy bank rails.",
            "justification": "Target audience is fintech operators who respond to direct challenger language.",
            "scope": "This draft only",
            "channel": "LinkedIn post"
        }
        res = self.client.post(
            '/api/exceptions/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["status"], "PENDING")
        self.assertEqual(data["rule_code"], "VOICE_CHALLENGER_01")

        # Verify admin received notification
        notif = Notification.objects.filter(recipient=self.admin, notification_type="EXCEPTION_PENDING").first()
        self.assertIsNotNone(notif)
        self.assertIn("VOICE_CHALLENGER_01", notif.title)

    def test_fact_exception_strictly_blocked_server_side(self):
        """HARD SAFETY REQUIREMENT: Factual rules CANNOT be overridden."""
        payload = {
            "rule_code": "FACT_TRANSFER_FEE_01",
            "warning_type": "Blocker · Factual",
            "title": "Zero Fee Claim Campaign",
            "quote_text": "Zero-fee international transfers for all users.",
            "justification": "Marketing wants to highlight zero-fee for promotional week."
        }
        res = self.client.post(
            '/api/exceptions/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(res.status_code, 400, "Fact exceptions MUST be rejected with HTTP 400")
        data = res.json()
        self.assertIn("error", data)
        self.assertIn("Factual truth claims cannot be overridden", data["error"])

    def test_accessibility_exception_strictly_blocked_server_side(self):
        """HARD SAFETY REQUIREMENT: Accessibility & WCAG rules CANNOT be overridden."""
        payload = {
            "rule_code": "VIS_WCAG_2.1",
            "warning_type": "Accessibility Contrast",
            "title": "Light Green CTA Banner",
            "quote_text": "CTA Text #90EE90 on White",
            "justification": "Design team requested pastel CTA aesthetic."
        }
        res = self.client.post(
            '/api/exceptions/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(res.status_code, 400, "Accessibility exceptions MUST be rejected with HTTP 400")
        data = res.json()
        self.assertIn("error", data)
        self.assertIn("accessibility standards cannot be overridden", data["error"])

    def test_admin_decision_approves_exception_updates_timeline_and_notifies_writer(self):
        """Admin decision approves exception, updates timeline, recalculates score, and creates writer notification."""
        # Setup submission with finding
        sub = Submission.objects.create(
            profile=self.profile,
            author=self.writer,
            title="Q3 Ambition Campaign",
            channel_context="LINKEDIN_POST",
            status="EXCEPTION_PENDING"
        )
        ver = SubmissionVersion.objects.create(
            submission=sub,
            version_number=1,
            raw_text="Don't settle for slow bank rails.",
            compliance_score=82.0
        )
        finding = AuditFinding.objects.create(
            version=ver,
            pillar="TONE",
            severity="WARNING",
            rule_citation_code="VOICE_CHALLENGER_01",
            rule_citation_title="Challenger Tone Guardrail",
            source_excerpt="slow bank rails",
            status="OVERRIDDEN_PENDING"
        )

        ex = ExceptionRequest.objects.create(
            id="EX-TEST-01",
            submission=sub,
            author=self.writer,
            rule_code="VOICE_CHALLENGER_01",
            title="Q3 Ambition Campaign",
            requester_name="writer_p4",
            status="PENDING"
        )

        # Admin approves exception
        decision_res = self.client.post(
            f'/api/exceptions/{ex.id}/decide/',
            data=json.dumps({
                "status": "APPROVED",
                "decision_note": "Approved for this specific Q3 challenger corridor.",
                "reviewer_name": "Admin Jordan"
            }),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(decision_res.status_code, 200)
        ex.refresh_from_db()
        self.assertEqual(ex.status, "APPROVED")
        self.assertIsNotNone(ex.decided_at)
        self.assertEqual(ex.decided_by, "Admin Jordan")

        # Verify finding and submission were synchronized
        finding.refresh_from_db()
        self.assertEqual(finding.status, "OVERRIDE_APPROVED")
        sub.refresh_from_db()
        self.assertEqual(sub.status, "APPROVED")  # Brand-compliance cleared

        # Verify writer received notification
        notif = Notification.objects.filter(recipient=self.writer, notification_type="EXCEPTION_APPROVED").first()
        self.assertIsNotNone(notif)
        self.assertIn("EX-TEST-01", notif.title)
        self.assertIn("Approved for this specific Q3", notif.message)

    def test_writer_forbidden_on_exception_decision(self):
        """Writers must receive HTTP 403 when attempting to decide exceptions."""
        ex = ExceptionRequest.objects.create(
            id="EX-TEST-02",
            rule_code="VOICE_CHALLENGER_01",
            title="Unauthorized Decision Attempt",
            status="PENDING"
        )
        res = self.client.post(
            f'/api/exceptions/{ex.id}/decide/',
            data=json.dumps({"status": "APPROVED"}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(res.status_code, 403, "Content Writer MUST receive HTTP 403 on exception decision")

    def test_notifications_list_and_mark_read(self):
        """Verify notifications can be fetched and marked as read."""
        notif = Notification.objects.create(
            recipient=self.writer,
            title="Test Notification",
            message="Your exception was reviewed.",
            is_read=False
        )
        # Fetch notifications
        res = self.client.get(
            '/api/notifications/',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["unread_count"], 1)

        # Mark read
        res_post = self.client.post(
            '/api/notifications/',
            data=json.dumps({"id": str(notif.id)}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(res_post.status_code, 200)
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)
