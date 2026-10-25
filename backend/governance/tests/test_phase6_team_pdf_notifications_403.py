"""
Phase 6 Automated Test Suite:
1. Team Management: Per-writer stats, approval rates, average readiness score, top-5 rules.
2. PDF Audit Report Export: Generation of publication-ready PDF audit dossier.
3. Multi-Channel Notifications: In-App, Email, and Slack alerts.
4. Final Comprehensive Writer-403 Test Checklist: Rigorous verification that Content Writers
   are rejected with HTTP 403 Forbidden on all administrative endpoints.
"""
import json
from datetime import date, timedelta
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from governance.models import (
    BrandProfile, BrandRule, DraftRule, FactLedger,
    Submission, SubmissionVersion, AuditFinding, ExceptionRequest,
    Notification, AuditTrail
)
from governance.auth import generate_user_token
from governance.pdf_report import generate_audit_report_pdf

User = get_user_model()


class Phase6TeamPdfNotificationAnd403Tests(TestCase):
    def setUp(self):
        self.client = Client()

        # Admin user
        self.admin = User.objects.create_user(
            username='admin_lead',
            email='admin@brandguard.internal',
            password='adminpassword123',
            role='ADMIN',
            department='Brand Governance'
        )
        self.admin_token = generate_user_token(self.admin)
        self.admin_auth = {'HTTP_AUTHORIZATION': f'Bearer {self.admin_token}'}

        # Content Writer user
        self.writer = User.objects.create_user(
            username='writer_sarah',
            email='sarah@brandguard.internal',
            password='writerpassword123',
            role='CONTENT_WRITER',
            department='Marketing Creative'
        )
        self.writer_token = generate_user_token(self.writer)
        self.writer_auth = {'HTTP_AUTHORIZATION': f'Bearer {self.writer_token}'}

        # Brand Profile
        self.profile = BrandProfile.objects.create(
            org_name="NovaPay Global",
            allowed_hex_palette=[{"name": "Midnight Emerald", "hex": "#0A3423", "max_delta_e": 4.0}],
            allowed_fonts=["Inter", "JetBrains Mono"],
            wcag_min_ratio=4.5
        )

        # Active Rule
        self.rule = BrandRule.objects.create(
            profile=self.profile,
            rule_code="VOICE_004",
            title="Aggressive Comparison",
            pillar="TONE",
            severity="WARNING",
            enforcement="Warning only",
            claims_allowed="Fast & reliable international transfers.",
            claims_disallowed="Don't get wrecked by traditional banks!",
            rule_description="Avoid disparaging competitors with aggressive slang.",
            version=1,
            is_active=True
        )

        # Fact Ledger item
        self.fact = FactLedger.objects.create(
            profile=self.profile,
            fact_code="FACT_012",
            category="Fees",
            claim_truth="0.5% international fee across all corridors",
            last_verified=date.today(),
            valid_until=date.today() + timedelta(days=90),
            is_verified=True,
            created_by=self.admin
        )

        # Submissions
        self.sub = Submission.objects.create(
            profile=self.profile,
            author=self.writer,
            title="Global Expansion Social Campaign",
            channel_context="LINKEDIN_POST",
            status="IN_REVIEW"
        )
        self.version = SubmissionVersion.objects.create(
            submission=self.sub,
            version_number=1,
            raw_text="Fast & reliable transfers. Don't get wrecked by traditional banks!",
            file_type="TEXT",
            compliance_score=82.0
        )
        self.finding = AuditFinding.objects.create(
            version=self.version,
            rule_citation_code="VOICE_004",
            rule_citation_title="Aggressive Comparison",
            pillar="TONE",
            severity="WARNING",
            engine_provenance="DETERMINISTIC_LEXICON",
            source_excerpt="Don't get wrecked by traditional banks!",
            explanation="Aggressive comparison detected."
        )

        # Exception Request
        self.ex = ExceptionRequest.objects.create(
            id="EX-PHASE6-001",
            submission=self.sub,
            author=self.writer,
            draft_id="DRAFT_P6",
            rule_code="VOICE_004",
            title="Global Expansion Social Campaign",
            requester_name="writer_sarah",
            requester_dept="Marketing Creative",
            requested_date=date.today(),
            warning_type="Warning · Voice",
            quote_text="Don't get wrecked by traditional banks!",
            rule_description="Aggressive comparison tone.",
            justification="Challenger campaign targeting Gen Z founders.",
            status="PENDING"
        )

    # =========================================================================
    # 1. TEAM MANAGEMENT TESTS
    # =========================================================================
    def test_admin_team_management_stats(self):
        """Admin can list team members and receive per-writer stats and top 5 rules."""
        resp = self.client.get('/api/users/', **self.admin_auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("users", data)
        self.assertIn("team_metrics", data)

        # Writer stats verification
        writer_entry = next((u for u in data["users"] if u["username"] == "writer_sarah"), None)
        self.assertIsNotNone(writer_entry)
        self.assertEqual(writer_entry["audits_count"], 1)
        self.assertEqual(writer_entry["exceptions_count"], 1)
        self.assertEqual(writer_entry["avg_compliance_score"], 82.0)
        self.assertIn("top_triggered_rules", writer_entry)
        self.assertTrue(any(r["rule_code"] == "VOICE_004" for r in writer_entry["top_triggered_rules"]))

        # Team metrics verification
        metrics = data["team_metrics"]
        self.assertGreaterEqual(metrics["total_members"], 2)
        self.assertGreaterEqual(metrics["writers_count"], 1)
        self.assertGreaterEqual(metrics["admins_count"], 1)

    def test_admin_create_team_member(self):
        """Admin can invite/create new users."""
        payload = {
            "username": "new_writer",
            "email": "new_writer@brandguard.internal",
            "role": "CONTENT_WRITER",
            "department": "APAC Content",
            "password": "Password123!"
        }
        resp = self.client.post('/api/users/', data=json.dumps(payload), content_type='application/json', **self.admin_auth)
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(username="new_writer").exists())

    # =========================================================================
    # 2. PDF AUDIT REPORT EXPORT TESTS
    # =========================================================================
    def test_export_pdf_audit_report(self):
        """Both Writers and Admins can export an executive PDF compliance dossier."""
        resp = self.client.get(f'/api/submissions/{self.sub.id}/export-pdf/', **self.writer_auth)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'application/pdf')
        self.assertTrue(resp.content.startswith(b'%PDF-'))
        self.assertIn('Content-Disposition', resp)
        self.assertIn('attachment', resp['Content-Disposition'])

        # Verify PDF bytes structure
        pdf_bytes = generate_audit_report_pdf(self.sub)
        self.assertGreater(len(pdf_bytes), 1000)
        self.assertTrue(pdf_bytes.startswith(b'%PDF-'))

    # =========================================================================
    # 3. NOTIFICATIONS (IN-APP, EMAIL, SLACK) TESTS
    # =========================================================================
    def test_notification_integrations_endpoint(self):
        """Admin can inspect operational status of all notification channels."""
        resp = self.client.get('/api/notifications/integrations/', **self.admin_auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("in_app", data)
        self.assertIn("email", data)
        self.assertIn("slack", data)
        self.assertTrue(data["in_app"]["enabled"])

    def test_test_webhook_notification(self):
        """Admin can trigger test notification ping."""
        resp = self.client.post('/api/notifications/test-webhook/', data=json.dumps({}), content_type='application/json', **self.admin_auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertTrue(data["result"]["in_app"])

    # =========================================================================
    # 4. FINAL WRITER-403 COMPREHENSIVE TEST CHECKLIST
    # =========================================================================
    def test_writer_403_users_management_get(self):
        """CHECKLIST 1: GET /api/users/ -> 403 Forbidden for writers."""
        resp = self.client.get('/api/users/', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_users_management_post(self):
        """CHECKLIST 2: POST /api/users/ -> 403 Forbidden for writers."""
        resp = self.client.post('/api/users/', data=json.dumps({"username": "hack"}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_rules_upload(self):
        """CHECKLIST 3: POST /api/rules/upload/ -> 403 Forbidden for writers."""
        resp = self.client.post('/api/rules/upload/', data={"raw_content": "rules"}, **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_rules_scrape(self):
        """CHECKLIST 4: POST /api/rules/scrape/ -> 403 Forbidden for writers."""
        resp = self.client.post('/api/rules/scrape/', data=json.dumps({"url": "https://example.com"}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_rules_create(self):
        """CHECKLIST 5: POST /api/rules/ -> 403 Forbidden for writers."""
        resp = self.client.post('/api/rules/', data=json.dumps({"rule_code": "TEST_001", "title": "Test"}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_rules_update(self):
        """CHECKLIST 6: PUT /api/rules/<rule_code>/ -> 403 Forbidden for writers."""
        resp = self.client.put(f'/api/rules/{self.rule.rule_code}/', data=json.dumps({"title": "Updated"}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_rules_delete(self):
        """CHECKLIST 7: DELETE /api/rules/<rule_code>/ -> 403 Forbidden for writers."""
        resp = self.client.delete(f'/api/rules/{self.rule.rule_code}/', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_rules_rollback(self):
        """CHECKLIST 8: POST /api/rules/<rule_code>/rollback/ -> 403 Forbidden for writers."""
        resp = self.client.post(f'/api/rules/{self.rule.rule_code}/rollback/', data=json.dumps({"target_version": 1}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_draft_rules_list(self):
        """CHECKLIST 9: GET /api/rules/drafts/ -> 403 Forbidden for writers."""
        resp = self.client.get('/api/rules/drafts/', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_draft_rules_approve(self):
        """CHECKLIST 10: POST /api/rules/drafts/approve/ -> 403 Forbidden for writers."""
        resp = self.client.post('/api/rules/drafts/approve/', data=json.dumps({"draft_ids": ["dummy"]}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_rule_playground(self):
        """CHECKLIST 11: POST /api/rules/playground/ -> 403 Forbidden for writers."""
        resp = self.client.post('/api/rules/playground/', data=json.dumps({"rule_code": "VOICE_004", "test_text": "Sample"}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_exception_decide(self):
        """CHECKLIST 12: POST /api/exceptions/<id>/decide/ -> 403 Forbidden for writers."""
        resp = self.client.post(f'/api/exceptions/{self.ex.id}/decide/', data=json.dumps({"status": "APPROVED"}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_submission_approve(self):
        """CHECKLIST 13: POST /api/submissions/<id>/approve/ -> 403 Forbidden for writers."""
        resp = self.client.post(f'/api/submissions/{self.sub.id}/approve/', data=json.dumps({}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_bulk_re_audit(self):
        """CHECKLIST 14: POST /api/facts/<id>/bulk-re-audit/ -> 403 Forbidden for writers."""
        resp = self.client.post(f'/api/facts/{self.fact.id}/bulk-re-audit/', data=json.dumps({}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_403_expire_fact(self):
        """CHECKLIST 15: POST /api/facts/<id>/expire-or-update/ -> 403 Forbidden for writers."""
        resp = self.client.post(f'/api/facts/{self.fact.id}/expire-or-update/', data=json.dumps({"action": "EXPIRE"}), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp.status_code, 403)

    def test_writer_blocked_from_fact_or_accessibility_exception(self):
        """CHECKLIST 16: Content writer attempting FACT or VISUAL exception gets HTTP 400."""
        # FACT exception blocked
        resp_fact = self.client.post('/api/exceptions/', data=json.dumps({
            "rule_code": "FACT_012",
            "warning_type": "Factual",
            "pillar": "FACTUAL",
            "title": "Old Rate Claim"
        }), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp_fact.status_code, 400)
        self.assertIn("Factual truth claims cannot be overridden", resp_fact.json().get("error", ""))

        # ACCESSIBILITY / VISUAL exception blocked
        resp_vis = self.client.post('/api/exceptions/', data=json.dumps({
            "rule_code": "VIS_WCAG_2.1",
            "warning_type": "Visual",
            "pillar": "VISUAL",
            "title": "Low Contrast Swatch"
        }), content_type='application/json', **self.writer_auth)
        self.assertEqual(resp_vis.status_code, 400)
        self.assertIn("Visual brand identity and WCAG accessibility standards cannot be overridden", resp_vis.json().get("error", ""))
