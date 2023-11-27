from rest_framework import serializers

from . import models


class ReasonSerializer(serializers.ModelSerializer):
    type_tag = serializers.CharField(source='get_type_display')
    class Meta:
        model = models.Reason
        fields = ('id', 'text','type', 'type_tag')

class OperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Operation
        fields = ('id', 'name')
