from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
import governance.views as gov_views

urlpatterns = [
    # Root Health Check & API Directory
    path('', gov_views.root_api_status_view, name='root_status'),

    # Authentication
    path('api/auth/login/', gov_views.auth_login_view, name='auth_login'),
    path('api/auth/me/', gov_views.auth_me_view, name='auth_me'),
    path('api/auth/logout/', gov_views.auth_logout_view, name='auth_logout'),
    path('api/auth/users/', gov_views.auth_users_view, name='auth_users'),
    path('api/notifications/', gov_views.notifications_list_view, name='notifications_list'),

    # Existing and profile routes
    path('api/brand-profile/', gov_views.brand_profile_view, name='brand_profile'),
    path('api/brand-profile/add-rule/', gov_views.add_rule_view, name='add_rule'),
    path('api/brand-profile/safe-prompt/', gov_views.brand_safe_prompt_view, name='safe_prompt'),
    path('api/brand-profile/facts/<uuid:fact_id>/expire-or-update/', gov_views.expire_or_update_fact_view, name='expire_or_update_fact'),
    path('api/facts/', gov_views.facts_list_create_view, name='facts_list_create'),
    path('api/facts/<uuid:fact_id>/blast-radius/', gov_views.fact_blast_radius_view, name='fact_blast_radius'),
    path('api/facts/<uuid:fact_id>/bulk-re-audit/', gov_views.fact_bulk_re_audit_view, name='fact_bulk_re_audit'),
    path('api/facts/<uuid:fact_id>/expire-or-update/', gov_views.expire_or_update_fact_view, name='fact_expire_or_update'),
    path('api/submissions/', gov_views.submissions_list_view, name='submissions_list'),
    path('api/submissions/audit/', gov_views.audit_submission_view, name='audit_submission'),
    path('api/submissions/live-lint/', gov_views.live_lint_view, name='submissions_live_lint'),
    path('api/submissions/verify-stamp/', gov_views.verify_stamp_view, name='verify_stamp'),
    path('api/submissions/<uuid:sub_id>/', gov_views.submission_detail_view, name='submission_detail'),
    path('api/submissions/<uuid:sub_id>/approve/', gov_views.approve_submission_view, name='approve_submission'),
    path('api/findings/<uuid:finding_id>/resolve/', gov_views.resolve_finding_view, name='resolve_finding'),
    path('api/telemetry/', gov_views.telemetry_view, name='telemetry'),
    path('api/exceptions/', gov_views.exception_requests_view, name='exception_requests'),
    path('api/exceptions/<str:exception_id>/', gov_views.exception_detail_view, name='exception_detail'),
    path('api/exceptions/<str:exception_id>/decide/', gov_views.exception_decision_view, name='exception_decide'),
    path('api/exceptions/<str:exception_id>/decision/', gov_views.exception_decision_view, name='exception_decision'),
    # Phase 2: Rule Registry, Drafts, Scraper, Playground, and Versioning
    path('api/rules/', gov_views.rules_list_create_view, name='rules_list_create'),
    path('api/rules/upload/', gov_views.rules_upload_view, name='rules_upload'),
    path('api/rules/scrape/', gov_views.rules_scrape_view, name='rules_scrape'),
    path('api/rules/drafts/', gov_views.draft_rules_list_view, name='draft_rules_list'),
    path('api/rules/drafts/approve/', gov_views.draft_rules_approve_view, name='draft_rules_approve'),
    path('api/rules/playground/', gov_views.rule_playground_view, name='rule_playground'),
    path('api/rules/<str:rule_code>/', gov_views.rule_detail_view, name='rule_detail'),
    path('api/rules/<str:rule_code>/versions/', gov_views.rule_versions_view, name='rule_versions'),
    path('api/rules/<str:rule_code>/rollback/', gov_views.rule_rollback_view, name='rule_rollback'),
    path('api/submissions/<uuid:sub_id>/export-pdf/', gov_views.export_submission_pdf_view, name='export_submission_pdf'),
    path('api/notifications/integrations/', gov_views.notification_integrations_view, name='notification_integrations'),
    path('api/notifications/test-webhook/', gov_views.test_notification_webhook_view, name='test_notification_webhook'),
    path('api/users/', gov_views.users_management_view, name='users_management'),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
