import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0005_backfill_positions"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="employee",
            name="position",
        ),
        migrations.RenameField(
            model_name="employee",
            old_name="position_new",
            new_name="position",
        ),
        migrations.AlterField(
            model_name="employee",
            name="position",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="employees",
                to="hr.position",
            ),
        ),
    ]
