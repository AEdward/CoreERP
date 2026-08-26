"""Happy Hour price preview — a plain function, not a trigger. A price
change here only ever happens because a bartender looked at the
suggested price and used it when adding a line; nothing recomputes an
already-rung-in OrderLine.unit_price_cents retroactively, same locking
principle every other snapshotted line-item price in this codebase
already follows.
"""

from django.db.models import Q
from django.utils import timezone

from .models import HappyHourRule


def compute_happy_hour_price_cents(item, base_price_cents, when=None):
    when = when or timezone.localtime()
    today_weekday = when.weekday()
    current_time = when.time()

    # Blank category on the rule = applies to every item.
    rules = HappyHourRule.objects.filter(company=item.company, is_active=True).filter(
        Q(category="") | Q(category=item.category)
    )

    matching_rule = None
    for rule in rules:
        if rule.day_of_week is not None and rule.day_of_week != today_weekday:
            continue
        if rule.start_time <= rule.end_time:
            in_window = rule.start_time <= current_time <= rule.end_time
        else:
            # Overnight window (e.g. 22:00-02:00) wraps past midnight.
            in_window = current_time >= rule.start_time or current_time <= rule.end_time
        if in_window:
            matching_rule = rule
            break

    if matching_rule is None:
        return {
            "base_price_cents": base_price_cents,
            "suggested_price_cents": base_price_cents,
            "happy_hour_name": None,
            "discount_percent": 0,
        }

    discount_percent = float(matching_rule.discount_percent)
    suggested_cents = round(base_price_cents * (100 - discount_percent) / 100)
    return {
        "base_price_cents": base_price_cents,
        "suggested_price_cents": suggested_cents,
        "happy_hour_name": matching_rule.name,
        "discount_percent": discount_percent,
    }
