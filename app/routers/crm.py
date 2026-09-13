from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.core.config import settings
from app.services import crm_db

router = APIRouter()


class CreateLeadRequest(BaseModel):
    patient_name: str
    phone: str
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = "new_lead"
    source: Optional[str] = "manual"


class UpdateLeadStatusRequest(BaseModel):
    status: str = Field(..., description="e.g. 'new_lead', 'confirmed', 'completed', 'cancelled'")


class AdminLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/api/admin/login")
async def admin_login(req: AdminLoginRequest):
    """
    Authenticates the clinic administrator.
    """
    if req.username == settings.admin_username and req.password == settings.admin_password:
        return {
            "success": True,
            "message": "Login successful",
            "username": req.username,
            "token": "admin-auth-session-token-2026",
        }
    raise HTTPException(status_code=401, detail="Invalid username or password")


def get_ngrok_webhook_url() -> Optional[str]:
    """
    Detects if an ngrok tunnel is running locally and exposes port 8000.
    Returns the public webhook URL if available so Vapi can call back to FastAPI.
    """
    import urllib.request
    import json

    try:
        req = urllib.request.Request("http://127.0.0.1:4040/api/tunnels", headers={"User-Agent": "FastAPI"})
        with urllib.request.urlopen(req, timeout=0.6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            tunnels = data.get("tunnels", [])
            for t in tunnels:
                addr = str(t.get("config", {}).get("addr", ""))
                pub = t.get("public_url", "")
                if "8000" in addr and pub.startswith("https"):
                    return f"{pub}/vapi/webhook"

            # If no 8000 tunnel is open yet, try creating one dynamically
            create_data = json.dumps({"name": "fastapi-8000", "addr": "8000", "proto": "http"}).encode("utf-8")
            create_req = urllib.request.Request(
                "http://127.0.0.1:4040/api/tunnels",
                data=create_data,
                headers={"Content-Type": "application/json", "User-Agent": "FastAPI"}
            )
            with urllib.request.urlopen(create_req, timeout=1.0) as cr_resp:
                cr_data = json.loads(cr_resp.read().decode("utf-8"))
                pub = cr_data.get("public_url", "")
                if pub.startswith("https"):
                    return f"{pub}/vapi/webhook"
    except Exception:
        pass
    return None


@router.get("/api/config")
async def get_public_config():
    """
    Returns public Vapi credentials (API Key and Assistant ID)
    and optional active webhook server URL for the frontend Voice Agent widget.
    """
    server_url = get_ngrok_webhook_url()
    return {
        "vapi_api_key": settings.vapi_api_key or "",
        "vapi_assistant_id": settings.vapi_assistant_id or "",
        "clinic_name": "MedPulse Healthcare Clinic",
        "server_url": server_url,
    }



@router.get("/api/leads")
async def list_leads(
    status: Optional[str] = Query(None, description="Filter by status (all, new_lead, confirmed, completed, cancelled)"),
    search: Optional[str] = Query(None, description="Search by name, phone, or doctor"),
):
    """
    Lists all patient leads recorded in the CRM.
    """
    leads = crm_db.get_all_leads(status=status, search=search)
    return {"leads": leads, "count": len(leads)}


@router.post("/api/leads")
async def create_lead_endpoint(lead: CreateLeadRequest):
    """
    Creates a new patient lead (manually or via API).
    """
    new_lead = crm_db.create_lead(
        patient_name=lead.patient_name,
        phone=lead.phone,
        doctor_id=lead.doctor_id,
        doctor_name=lead.doctor_name,
        preferred_date=lead.preferred_date,
        preferred_time=lead.preferred_time,
        reason=lead.reason,
        status=lead.status or "new_lead",
        source=lead.source or "manual",
    )
    return {"success": True, "lead": new_lead}


@router.patch("/api/leads/{lead_id}")
async def update_status_endpoint(lead_id: int, req: UpdateLeadStatusRequest):
    """
    Updates the current status of a lead (e.g. confirmed, completed, cancelled).
    """
    updated = crm_db.update_lead_status(lead_id, req.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"success": True, "lead_id": lead_id, "new_status": req.status}


@router.delete("/api/leads/{lead_id}")
async def delete_lead_endpoint(lead_id: int):
    """
    Deletes a lead by ID.
    """
    deleted = crm_db.delete_lead(lead_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"success": True, "deleted_id": lead_id}


@router.get("/api/crm/stats")
async def crm_stats():
    """
    Returns summary statistics for the CRM dashboard cards.
    """
    stats = crm_db.get_crm_stats()
    return stats
