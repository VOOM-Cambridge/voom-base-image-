from django.urls import path, include
from rest_framework import routers
from . import views
from django.shortcuts import redirect


urlpatterns = [
                  path('reasons/', views.getBaseReasons),
                  path('reasons/<str:operation>/', views.getOperationReasons),
                  path('operations/', views.getOperations),
              ]
