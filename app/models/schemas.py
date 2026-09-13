from pydantic import BaseModel, Field
from typing import Optional


class AppointmentRequest(BaseModel):
    """Schema expected from Vapi function call arguments"""
    patient_name: str
    phone: str
    doctor_id: str = Field(..., description="e.g. doc_1, doc_2")
    preferred_date: str = Field(..., description="e.g. 2026-09-14")
    preferred_time: str = Field(..., description="e.g. 15:30")
    reason: Optional[str] = None


class AppointmentResponse(BaseModel):
    status: str  # "booked" | "unavailable"
    message: str
    crm_id: Optional[str] = None


class ClinicInfoRequest(BaseModel):
    topic: Optional[str] = Field(
        None, description="e.g. 'services', 'location', 'pricing', 'doctors'"
    )


class ClinicInfoResponse(BaseModel):
    info: str
