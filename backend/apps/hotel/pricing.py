"""The "smart" part of Smart Pricing: a plain function, not a model, so
apps.hotel.serializers._create_reservation and RoomTypeViewSet.suggested_rate
(the quote-preview action the frontend calls before a booking exists) can
share the exact same math — a booking's default rate should be the same
number the front desk previewed a moment earlier.
"""

from .models import Reservation, Room, SeasonalRate

# (occupancy_percent_threshold, surge_percent) — first match wins, checked
# highest threshold first. Hardcoded rather than a configurable model: this
# is a starting policy, not something any demo tenant has asked to tune yet.
OCCUPANCY_SURGE_TIERS = (
    (85, 25),
    (60, 10),
)


def compute_suggested_rate_cents(room_type, check_in_date, check_out_date):
    seasonal = (
        SeasonalRate.objects.filter(
            company=room_type.company,
            room_type=room_type,
            start_date__lte=check_in_date,
            end_date__gte=check_in_date,
        )
        .order_by("-start_date")
        .first()
    )
    base_cents = seasonal.rate_cents if seasonal else room_type.base_rate_cents

    total_rooms = Room.objects.filter(company=room_type.company, room_type=room_type).count()
    if total_rooms == 0:
        occupancy_percent = 0
    else:
        occupied_rooms = (
            Reservation.objects.filter(
                company=room_type.company,
                room__room_type=room_type,
                status__in=[Reservation.Status.CONFIRMED, Reservation.Status.CHECKED_IN],
                check_in_date__lt=check_out_date,
                check_out_date__gt=check_in_date,
            )
            .values("room_id")
            .distinct()
            .count()
        )
        occupancy_percent = round(occupied_rooms / total_rooms * 100)

    surge_percent = 0
    for threshold, surge in OCCUPANCY_SURGE_TIERS:
        if occupancy_percent >= threshold:
            surge_percent = surge
            break

    suggested_cents = round(base_cents * (100 + surge_percent) / 100)

    return {
        "base_rate_cents": base_cents,
        "occupancy_percent": occupancy_percent,
        "surge_percent": surge_percent,
        "suggested_rate_cents": suggested_cents,
        "seasonal_rate_name": seasonal.name if seasonal else None,
    }
