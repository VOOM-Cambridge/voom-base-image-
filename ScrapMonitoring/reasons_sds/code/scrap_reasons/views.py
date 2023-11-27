from django.db.models import Q
from django.http import HttpResponse
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, renderer_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from rest_framework.response import Response

from . import models
from . import serializers

@api_view(('GET',))
@renderer_classes((JSONRenderer,BrowsableAPIRenderer))
def getBaseReasons(request):
    reasons_qs = models.Reason.objects.filter(operation__isnull=True)
    serializer = serializers.ReasonSerializer(reasons_qs,many=True)
    return Response(serializer.data)

@api_view(('GET',))
@renderer_classes((JSONRenderer,BrowsableAPIRenderer))
def getOperationReasons(request,operation):
    reasons_qs = models.Reason.objects.filter(Q(operation__id=operation)|Q(operation__isnull=True))
    serializer = serializers.ReasonSerializer(reasons_qs,many=True)
    return Response(serializer.data)

@api_view(('GET',))
@renderer_classes((JSONRenderer,BrowsableAPIRenderer))
def getOperations(request):
    operations_qs = models.Operation.objects.all()
    serializer = serializers.OperationSerializer(operations_qs,many=True)
    return Response(serializer.data)


