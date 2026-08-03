from django.contrib import admin

from .models import Account, JournalEntry, JournalLine, Payment

admin.site.register(Account)
admin.site.register(JournalEntry)
admin.site.register(JournalLine)
admin.site.register(Payment)
