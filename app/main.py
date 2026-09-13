import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse
from app.routers import appointments, clinic_info, vapi_webhook, crm
from app.services import crm_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite CRM database and leads table
    crm_db.init_db()
    yield


app = FastAPI(
    title="Healthcare Voice Agent API & Clinic Portal",
    description="FastAPI backend with built-in CRM and Vapi Voice Agent integration",
    version="1.0.0",
    lifespan=lifespan,
)

# 1. Register API & Vapi Routers
app.include_router(appointments.router, prefix="/vapi", tags=["Appointments"])
app.include_router(clinic_info.router, prefix="/vapi", tags=["Clinic Info"])
app.include_router(vapi_webhook.router, prefix="/vapi", tags=["Vapi Webhook"])
app.include_router(crm.router, tags=["CRM"])


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


static_dir = os.path.join(os.path.dirname(__file__), "static")


@app.get("/admin")
async def admin_portal():
    admin_html = os.path.join(static_dir, "admin.html")
    if os.path.exists(admin_html):
        return FileResponse(admin_html)
    return {"error": "admin.html not found"}


@app.get("/crm")
async def crm_redirect():
    return RedirectResponse(url="/admin")


# 2. Mount Frontend Static Files (Website + Voice Widget)
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

