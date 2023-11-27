from django.db import models
from adminsortable.models import SortableMixin

class SimpleModel(models.Model):
    class Meta:
        abstract = True

class Operation(SimpleModel, SortableMixin):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=60, help_text="Name of the operation")
    
    order = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name


class Reason(models.Model):
    class Type(models.TextChoices):
        SCRAP = 'S', 'scrap'
        REWORK = 'R','rework'

    id = models.BigAutoField(primary_key=True)
    text = models.CharField(max_length=60, help_text="Label that represents this reason")
    type = models.CharField(max_length=1, choices=Type.choices, help_text="What type of reason this is")
    operation = models.ForeignKey(Operation, on_delete=models.CASCADE, related_name="reasons", blank=True,null=True)

    def __str__(self):
        return self.text

