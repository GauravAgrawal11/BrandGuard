import json
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from governance.models import BrandProfile, ExceptionRequest
from governance.auth import generate_user_token

User = get_user_model()


class Phase1RBACTestCase(TestCase):
    """
    Tests proving writers receive HTTP 403 on admin-only endpoints:
    1. /api/users/
    2. /api/rules/upload/
    3. /api/rules/scrape/
    4. /api/exceptions/{id}/decide/
    And that admins succeed with 200/201.
    """

    def setUp(self):
        self.client = Client()

        # Seed profile
        self.profile = BrandProfile.objects.create(
            org_name="NovaPay",
            allowed_hex_palette=[{"name": "Midnight Emerald", "hex": "#0A3423", "max_delta_e": 4.0}],
            allowed_fonts=["Inter"]
        )

        # Seed Admin user
        self.admin = User.objects.create_user(
            username="test_admin",
            email="admin@novapay.io",
            password="adminpassword123",
            role="ADMIN",
            department="Brand Governance Lead"
        )
        self.admin_token = generate_user_token(self.admin)

        # Seed Content Writer user
        self.writer = User.objects.create_user(
            username="test_writer",
            email="writer@novapay.io",
            password="writerpassword123",
            role="CONTENT_WRITER",
            department="Marketing Ops"
        )
        self.writer_token = generate_user_token(self.writer)

        # Seed sample Exception Request
        self.exception = ExceptionRequest.objects.create(
            id="EX-2041",
            draft_id="DRAFT_024",
            rule_code="VOICE_004",
            title="Global ambition. Local simplicity.",
            requester_name="Alex Morgan",
            warning_type="Warning · Voice",
            status="PENDING"
        )

    # -------------------------------------------------------------
    # Test 1: Content Writer gets 403 on /api/users/
    # -------------------------------------------------------------
    def test_writer_forbidden_on_users_endpoint(self):
        # GET /api/users/ with writer bearer token
        response = self.client.get(
            '/api/users/',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(response.status_code, 403, "Content Writer MUST receive HTTP 403 on GET /api/users/")
        self.assertIn("error", response.json())
        self.assertEqual(response.json()["error"], "Forbidden")

        # POST /api/users/ with writer bearer token
        response_post = self.client.post(
            '/api/users/',
            data=json.dumps({"username": "hacker", "email": "hacker@novapay.io", "role": "ADMIN"}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(response_post.status_code, 403, "Content Writer MUST receive HTTP 403 on POST /api/users/")

    # -------------------------------------------------------------
    # Test 2: Content Writer gets 403 on /api/rules/upload/
    # -------------------------------------------------------------
    def test_writer_forbidden_on_rules_upload_endpoint(self):
        response = self.client.post(
            '/api/rules/upload/',
            data=json.dumps({"rules_text": "Sample policy document"}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(response.status_code, 403, "Content Writer MUST receive HTTP 403 on POST /api/rules/upload/")
        self.assertIn("error", response.json())
        self.assertEqual(response.json()["error"], "Forbidden")

    # -------------------------------------------------------------
    # Test 3: Content Writer gets 403 on /api/rules/scrape/
    # -------------------------------------------------------------
    def test_writer_forbidden_on_rules_scrape_endpoint(self):
        response = self.client.post(
            '/api/rules/scrape/',
            data=json.dumps({"url": "https://competitor.com/brand"}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(response.status_code, 403, "Content Writer MUST receive HTTP 403 on POST /api/rules/scrape/")
        self.assertIn("error", response.json())
        self.assertEqual(response.json()["error"], "Forbidden")

    # -------------------------------------------------------------
    # Test 4: Content Writer gets 403 on /api/exceptions/{id}/decide/
    # -------------------------------------------------------------
    def test_writer_forbidden_on_exceptions_decide_endpoint(self):
        # Test /api/exceptions/EX-2041/decide/
        response_decide = self.client.post(
            f'/api/exceptions/{self.exception.id}/decide/',
            data=json.dumps({"status": "APPROVED", "decision_note": "Self-approved by writer"}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(response_decide.status_code, 403, "Content Writer MUST receive HTTP 403 on /api/exceptions/{id}/decide/")
        self.assertIn("error", response_decide.json())
        self.assertEqual(response_decide.json()["error"], "Forbidden")

        # Also test alias /api/exceptions/EX-2041/decision/
        response_decision = self.client.post(
            f'/api/exceptions/{self.exception.id}/decision/',
            data=json.dumps({"status": "APPROVED"}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.writer_token}'
        )
        self.assertEqual(response_decision.status_code, 403, "Content Writer MUST receive HTTP 403 on /api/exceptions/{id}/decision/")

    # -------------------------------------------------------------
    # Test 5: Admin succeeds on all 4 endpoints
    # -------------------------------------------------------------
    def test_admin_succeeds_on_all_admin_endpoints(self):
        # 1. Admin GET /api/users/ -> 200
        res_users = self.client.get(
            '/api/users/',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res_users.status_code, 200)
        self.assertIn("users", res_users.json())

        # 2. Admin POST /api/rules/upload/ -> 201
        res_upload = self.client.post(
            '/api/rules/upload/',
            data=json.dumps({"rules_text": "Sample admin policy draft"}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res_upload.status_code, 201)
        self.assertEqual(res_upload.json()["status"], "success")

        # 3. Admin POST /api/rules/scrape/ -> 200
        res_scrape = self.client.post(
            '/api/rules/scrape/',
            data=json.dumps({"url": "https://novapay.io"}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res_scrape.status_code, 200)
        self.assertEqual(res_scrape.json()["status"], "success")

        # 4. Admin POST /api/exceptions/{id}/decide/ -> 200
        res_decide = self.client.post(
            f'/api/exceptions/{self.exception.id}/decide/',
            data=json.dumps({"status": "APPROVED", "decision_note": "Brand-compliance cleared by Lead."}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res_decide.status_code, 200)
        self.assertEqual(res_decide.json()["status"], "APPROVED")

    # -------------------------------------------------------------
    # Test 6: Unauthenticated callers receive HTTP 401
    # -------------------------------------------------------------
    def test_unauthenticated_callers_receive_401(self):
        for path in ['/api/users/', '/api/rules/upload/', '/api/rules/scrape/', f'/api/exceptions/{self.exception.id}/decide/']:
            res = self.client.get(path) if path == '/api/users/' else self.client.post(path, data={}, content_type='application/json')
            self.assertEqual(res.status_code, 401, f"Unauthenticated request to {path} should receive 401")
