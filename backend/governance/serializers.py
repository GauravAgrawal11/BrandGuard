from rest_framework import serializers
from .models import (
    BrandGuardUser, SystemSettings, BrandProfile, BrandRule,
    BrandRuleVersion, DraftRule, FactLedger, Submission,
    SubmissionVersion, AuditFinding, BrandComplianceSignature,
    ExceptionRequest, Notification, AuditTrail
)


class UserSummarySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = BrandGuardUser
        fields = ['id', 'username', 'email', 'name', 'role', 'department', 'avatar_color', 'is_active', 'date_joined']

    def get_name(self, obj):
        return obj.get_full_name() or obj.username


class UserCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = BrandGuardUser
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'department', 'is_active']

    def create(self, validated_data):
        password = validated_data.pop('password', 'writer123')
        user = BrandGuardUser.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = '__all__'


class BrandRuleVersionSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BrandRuleVersion
        fields = '__all__'

    def get_changed_by_name(self, obj):
        return obj.changed_by.username if obj.changed_by else 'System'


class BrandRuleSerializer(serializers.ModelSerializer):
    override_rate = serializers.ReadOnlyField()
    versions_count = serializers.SerializerMethodField()

    class Meta:
        model = BrandRule
        fields = '__all__'

    def get_versions_count(self, obj):
        return obj.versions.count()


class DraftRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DraftRule
        fields = '__all__'


class FactLedgerSerializer(serializers.ModelSerializer):
    is_expired = serializers.ReadOnlyField()
    days_until_expiry = serializers.ReadOnlyField()
    blast_radius_count = serializers.ReadOnlyField()

    class Meta:
        model = FactLedger
        fields = '__all__'


class AuditFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditFinding
        fields = '__all__'


class SubmissionVersionSerializer(serializers.ModelSerializer):
    findings = AuditFindingSerializer(many=True, read_only=True)

    class Meta:
        model = SubmissionVersion
        fields = '__all__'


class SubmissionSerializer(serializers.ModelSerializer):
    author_info = UserSummarySerializer(source='author', read_only=True)
    versions = SubmissionVersionSerializer(many=True, read_only=True)

    class Meta:
        model = Submission
        fields = '__all__'


class BrandComplianceSignatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandComplianceSignature
        fields = '__all__'


class ExceptionRequestSerializer(serializers.ModelSerializer):
    author_info = UserSummarySerializer(source='author', read_only=True)

    class Meta:
        model = ExceptionRequest
        fields = '__all__'


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'


class AuditTrailSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditTrail
        fields = '__all__'
