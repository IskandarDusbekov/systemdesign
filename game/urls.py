from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/state", views.state),
    path("api/rooms", views.rooms),
    path("api/rooms/<int:pk>", views.room_detail),
    path("api/blocks", views.blocks),
    path("api/blocks/<int:pk>", views.block_detail),
    path("api/connections", views.connections),
    path("api/connections/<int:pk>", views.connection_detail),
    path("api/code", views.code),
    path("api/rotate", views.rotate),
    path("api/launch/<str:step>", views.launch_step),
    path("api/models", views.models_view),
    path("api/tick", views.tick),
    path("api/offers", views.offers),
    path("api/growth", views.growth_view),
    path("api/power", views.power),
    path("api/reset", views.reset),
]
