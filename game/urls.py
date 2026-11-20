from django.urls import path

from . import accounts, views

urlpatterns = [
    path("", views.index, name="index"),
    path("kirish/", accounts.login_view, name="login"),
    path("royxat/", accounts.register_view, name="register"),
    path("chiqish/", accounts.logout_view, name="logout"),
    path("api/owner", views.owner_view),
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
    path("api/dev", views.dev_view),
    path("api/profile", views.profile_view),
    path("api/web", views.web_view),
    path("api/admin", views.admin_view),
    path("api/djadmin", views.djadmin_view),
    path("api/resume", views.resume),
    path("api/withdraw", views.withdraw),
    path("api/offers", views.offers),
    path("api/growth", views.growth_view),
    path("api/power", views.power),
    path("api/reset", views.reset),
]
