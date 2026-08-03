from django.db import transaction

from .models import NumberSequence


def next_number(company, code, padding=5):
    """Atomically issues the next number for (company, code), e.g.
    next_number(company, "INV") -> "INV-00001", then "INV-00002", ...

    One shared engine instead of every document type formatting its own
    id-based string (which is what Invoice and Bill each did before this
    existed) — new document types just pick a code, no new counter logic.
    """
    with transaction.atomic():
        seq, _ = NumberSequence.objects.select_for_update().get_or_create(
            company=company, code=code
        )
        seq.last_value += 1
        seq.save(update_fields=["last_value"])
    return f"{code}-{seq.last_value:0{padding}d}"
