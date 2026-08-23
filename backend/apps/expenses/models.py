from django.db import models

from apps.common.models import TenantModel


class Expense(TenantModel):
    """An employee expense claim — real money owed to an employee, the
    same shape as a supplier Bill but on the other side of the ledger
    conceptually (see apps.accounting.posting.post_expense_journal,
    which posts it exactly like a Bill: Dr Expense, Cr Accounts
    Payable). Once approved (via apps.approvals — see apps/expenses/apps.py's
    hook registration), it's payable the same way a Bill is: a Payment
    with `expense` set instead of `bill` clears it.

    Known simplification: `expenses.manage` is granted to every default
    role (see apps.roles.seed.SHARED_PERMISSIONS) so any employee can
    submit their own claim — the permission model has no per-row
    ownership dimension to say "only your own records", so the only real
    access control here is segregation of duties at approval time (an
    employee can't approve their own request), not a role gate on who's
    allowed to approve. Good enough for a first version; a real
    finance-approver role is a natural follow-up once it's actually
    needed.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        PAID = "paid", "Paid"

    employee = models.ForeignKey("hr.Employee", on_delete=models.PROTECT, related_name="expenses")
    category = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    amount_cents = models.BigIntegerField()
    expense_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = "expenses"
        ordering = ["-expense_date", "-created_at"]

    def __str__(self):
        return f"{self.employee} — {self.category} ({self.amount_cents / 100:.2f})"
