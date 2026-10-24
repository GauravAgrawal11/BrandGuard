from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
import governance.views as gov_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/brand-profile/', gov_views.brand_profile_view, name='brand_profile'),
    path('api/brand-profile/add-rule/', gov_views.add_rule_view, name='add_rule'),
    path('api/brand-profile/safe-prompt/', gov_views.brand_safe_prompt_view, name='safe_prompt'),
    path('api/brand-profile/facts/<uuid:fact_id>/expire-or-update/', gov_views.expire_or_update_fact_view, name='expire_or_update_fact'),
    path('api/submissions/audit/', gov_views.audit_submission_view, name='audit_submission'),
    path('api/submissions/verify-stamp/', gov_views.verify_stamp_view, name='verify_stamp'),
    path('api/findings/<uuid:finding_id>/resolve/', gov_views.resolve_finding_view, name='resolve_finding'),
    path('api/submissions/<uuid:sub_id>/approve/', gov_views.approve_submission_view, name='approve_submission'),
    path('api/telemetry/', gov_views.telemetry_view, name='telemetry'),
    path('api/exceptions/', gov_views.exception_requests_view, name='exception_requests'),
    path('api/exceptions/<str:exception_id>/', gov_views.exception_detail_view, name='exception_detail'),
    path('api/exceptions/<str:exception_id>/decision/', gov_views.exception_decision_view, name='exception_decision'),
    path('api/rules/<str:rule_code>/', gov_views.rule_detail_view, name='rule_detail'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
