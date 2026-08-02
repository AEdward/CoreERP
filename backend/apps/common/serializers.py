from rest_framework import serializers


class CompanyScopedSerializer(serializers.ModelSerializer):
    """Validates that any FK field listed in `same_company_fields` points
    to a row belonging to the active company.

    Django FKs don't enforce this by themselves, and RLS doesn't catch it
    either — both rows can individually belong to companies the request's
    user is a member of, just not the *same* one (e.g. an Employee in
    Company A referencing a Department that's actually in Company B,
    where the user happens to also work). This is an app-layer check,
    same as the active-company scoping itself.
    """

    same_company_fields: list[str] = []

    def validate(self, attrs):
        request = self.context.get("request")
        company = getattr(request, "company", None)
        if company:
            for field_name in self.same_company_fields:
                related = attrs.get(field_name)
                if related is not None and related.company_id != company.id:
                    raise serializers.ValidationError(
                        {field_name: "Must belong to the active company."}
                    )
        return super().validate(attrs)
