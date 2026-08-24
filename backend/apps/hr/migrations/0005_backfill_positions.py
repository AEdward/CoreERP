from django.db import migrations


def forwards(apps, schema_editor):
    Employee = apps.get_model("hr", "Employee")
    Position = apps.get_model("hr", "Position")

    seen = {}
    for employee in Employee.objects.exclude(position="").only("id", "company_id", "position"):
        key = (employee.company_id, employee.position)
        position_id = seen.get(key)
        if position_id is None:
            position, _ = Position.objects.get_or_create(
                company_id=employee.company_id, title=employee.position
            )
            position_id = position.id
            seen[key] = position_id
        employee.position_new_id = position_id
        employee.save(update_fields=["position_new"])


def backwards(apps, schema_editor):
    Employee = apps.get_model("hr", "Employee")
    Employee.objects.exclude(position_new__isnull=True).update(position_new=None)


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0004_position_contracts_leave"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
