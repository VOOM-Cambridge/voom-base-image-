from django.contrib import admin
from . import models
import datetime
import time
from adminsortable.admin import SortableAdmin

@admin.register(models.Operation)
class OperationAdmin(SortableAdmin):
    list_display = ['id', 'name']
    ordering = ['order']
    readonly_fields = ['id']


@admin.register(models.Reason)
class ReasonAdmin(admin.ModelAdmin):
    list_display = ['id', 'text', 'operation', 'type']
    list_filter = ['type','operation']
    ordering = ['id']
    readonly_fields = ['id']
