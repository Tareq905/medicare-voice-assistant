# pyrefly: ignore [missing-import]
import httpx
from app.core.config import settings
from app.services.crm_db import create_lead


async def push_lead_to_crm(lead_data: dict) -> dict:
    """
    Saves lead/appointment data directly into local SQLite CRM,
    and optionally forwards to an external CRM if configured.
    """
    # 1. Save directly into local SQLite CRM
    saved_lead = create_lead(
        patient_name=lead_data.get("name") or lead_data.get("patient_name") or "Unknown",
        phone=lead_data.get("phone") or "",
        doctor_id=lead_data.get("doctor_id"),
        doctor_name=lead_data.get("doctor_name"),
        preferred_date=lead_data.get("date") or lead_data.get("preferred_date"),
        preferred_time=lead_data.get("time") or lead_data.get("preferred_time"),
        reason=lead_data.get("reason"),
        status=lead_data.get("status", "new_lead"),
        source=lead_data.get("source", "voice_agent"),
    )

    # 2. Forward to external CRM if a separate external CRM URL is configured
    is_external_crm = (
        settings.crm_base_url
        and "your-crm.com" not in settings.crm_base_url
        and "localhost:8000" not in settings.crm_base_url
        and "127.0.0.1:8000" not in settings.crm_base_url
    )

    if is_external_crm:
        headers = {"Content-Type": "application/json"}
        if settings.crm_api_key:
            headers["Authorization"] = f"Bearer {settings.crm_api_key}"

        async with httpx.AsyncClient(timeout=10) as client:
            try:
                response = await client.post(
                    f"{settings.crm_base_url}/leads",
                    json=lead_data,
                    headers=headers,
                )
                response.raise_for_status()
                return {"id": saved_lead["id"], "external": response.json()}
            except httpx.HTTPError as e:
                return {"id": saved_lead["id"], "warning": f"External sync error: {str(e)}"}

    return {"id": saved_lead["id"], "status": "saved_to_crm"}
