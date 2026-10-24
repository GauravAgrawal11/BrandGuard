"""
Governance Telemetry Engine.
Calculates Guideline Ambiguity Friction Scores and policy diagnoses
for Brand Rules and Fact Ledger items.
"""

import math
from governance.models import BrandRule, FactLedger, Submission


def calculate_friction(triggers: int, overrides: int):
    """
    Computes override rate percentage and ambiguity friction score.
    friction_score = (overrides / max(triggers, 1)) * ln(triggers + 1)
    """
    safe_triggers = max(triggers, 1)
    override_rate_pct = round((overrides / safe_triggers) * 100, 1)
    friction_score = round((overrides / safe_triggers) * math.log(triggers + 1), 3)

    if triggers >= 2 and override_rate_pct >= 50.0:
        diagnosis = "NEEDS_CLARIFICATION"
        diagnosis_label = "Rule Frequently Overridden (Needs Clarification)"
        diagnosis_badge_color = "purple"
    elif triggers >= 2 and override_rate_pct < 25.0:
        diagnosis = "TEAM_TRAINING_GAP"
        diagnosis_label = "Repeated Creator Mistake (Team Training Gap)"
        diagnosis_badge_color = "amber"
    elif triggers >= 2:
        diagnosis = "BALANCED_COMPLIANCE"
        diagnosis_label = "Healthy Exception Flow"
        diagnosis_badge_color = "emerald"
    else:
        diagnosis = "LOW_SAMPLE_SIZE"
        diagnosis_label = "Low Sample Size"
        diagnosis_badge_color = "slate"

    return {
        "triggers": triggers,
        "overrides": overrides,
        "override_rate_pct": override_rate_pct,
        "friction_score": friction_score,
        "diagnosis": diagnosis,
        "diagnosis_label": diagnosis_label,
        "diagnosis_badge_color": diagnosis_badge_color,
    }


def get_telemetry_report(profile=None):
    """
    Generates the complete Ambiguity Friction Leaderboard and KPI summary.
    """
    rule_qs = BrandRule.objects.all()
    fact_qs = FactLedger.objects.all()
    if profile:
        rule_qs = rule_qs.filter(profile=profile)
        fact_qs = fact_qs.filter(profile=profile)

    items = []

    for rule in rule_qs:
        f_data = calculate_friction(rule.trigger_count, rule.override_count)
        items.append({
            "id": str(rule.id),
            "type": "RULE",
            "pillar": rule.pillar,
            "code": rule.rule_code,
            "title": rule.title,
            "description": rule.rule_description or (rule.structured_spec.get('banned_term', '')),
            **f_data,
        })

    for fact in fact_qs:
        f_data = calculate_friction(fact.trigger_count, fact.override_count)
        items.append({
            "id": str(fact.id),
            "type": "FACT",
            "pillar": "FACTUAL",
            "code": fact.fact_code,
            "title": f"Fact: {fact.category}",
            "description": fact.claim_truth[:120] + ("..." if len(fact.claim_truth) > 120 else ""),
            **f_data,
        })

    # Sort descending by friction_score, then triggers
    items.sort(key=lambda x: (x["friction_score"], x["triggers"]), reverse=True)

    total_submissions = Submission.objects.count()
    total_triggers = sum(it["triggers"] for it in items)
    total_overrides = sum(it["overrides"] for it in items)
    avg_friction = round(sum(it["friction_score"] for it in items) / max(len(items), 1), 2)
    top_ambiguity_item = items[0] if items else None

    kpis = {
        "total_submissions": total_submissions,
        "total_rules_tracked": len(items),
        "total_triggers": total_triggers,
        "total_overrides": total_overrides,
        "average_friction_score": avg_friction,
        "top_ambiguity_code": top_ambiguity_item["code"] if top_ambiguity_item else "N/A",
        "top_ambiguity_friction": top_ambiguity_item["friction_score"] if top_ambiguity_item else 0.0,
    }

    return {
        "kpis": kpis,
        "leaderboard": items,
    }
