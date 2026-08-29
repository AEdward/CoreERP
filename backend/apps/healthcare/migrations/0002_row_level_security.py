from django.db import migrations

from apps.common.rls import tenant_policy_sql

TABLES = [
    "healthcare_patients",
    "healthcare_medical_staff",
    "healthcare_appointments",
    "healthcare_medical_records",
    "healthcare_diagnostic_orders",
    "healthcare_prescriptions",
    "healthcare_prescription_lines",
    "healthcare_beds",
    "healthcare_admissions",
    "healthcare_insurance_providers",
    "healthcare_patient_insurances",
    "healthcare_medical_bills",
    "healthcare_medical_bill_lines",
    "healthcare_blood_units",
]

POLICIES = [tenant_policy_sql(table) for table in TABLES]


class Migration(migrations.Migration):
    dependencies = [
        ("healthcare", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(enable_sql, reverse_sql=disable_sql) for enable_sql, disable_sql in POLICIES
    ]
