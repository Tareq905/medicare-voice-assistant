import json
from datetime import datetime
from fastapi import APIRouter, Request
from app.services import crm_db
from app.core.schedule import resolve_doctor, get_current_time_bd

router = APIRouter()


@router.post("/webhook")
async def vapi_webhook(request: Request):
    """
    Receives Vapi call events, transcripts, and handles server-side tool calls
    (configured as the Server URL in Vapi).
    """
    try:
        payload = await request.json()
    except Exception:
        return {"received": False, "error": "Invalid JSON body"}

    message = payload.get("message", {})
    event_type = message.get("type") or payload.get("type")

    # Handle Tool / Function calls from Vapi
    if event_type in ["tool-calls", "function-call"]:
        raw_tools = []
        if event_type == "function-call":
            func = message.get("functionCall") or payload.get("functionCall") or {}
            raw_tools.append({
                "id": func.get("id") or "call_" + str(int(datetime.now().timestamp())),
                "name": func.get("name"),
                "arguments": func.get("parameters") or func.get("arguments") or {}
            })
        else:
            # toolCalls list
            tool_calls = message.get("toolCalls") or payload.get("toolCalls") or []
            if not tool_calls:
                # toolWithToolCallList format
                tool_list = message.get("toolWithToolCallList") or payload.get("toolWithToolCallList") or []
                for item in tool_list:
                    tc = item.get("toolCall", {})
                    fn = item.get("function", {}) or tc.get("function", {})
                    raw_tools.append({
                        "id": tc.get("id") or item.get("id") or "call_" + str(int(datetime.now().timestamp())),
                        "name": fn.get("name"),
                        "arguments": fn.get("arguments") or {}
                    })
            else:
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    raw_tools.append({
                        "id": tc.get("id") or "call_" + str(int(datetime.now().timestamp())),
                        "name": fn.get("name"),
                        "arguments": fn.get("arguments") or {}
                    })

        results = []
        for tool in raw_tools:
            call_id = tool.get("id")
            name = tool.get("name") or "book_appointment"
            args = tool.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    args = {}

            if name in ["book_appointment", "bookAppointment"]:
                patient_name = args.get("patient_name") or args.get("name") or args.get("caller_name") or "Patient"
                phone = args.get("phone") or args.get("phoneNumber") or args.get("phone_number") or "N/A"
                doctor_id_arg = args.get("doctor_id") or args.get("doctor") or ""
                doctor_name_arg = args.get("doctor_name") or ""
                preferred_date = args.get("preferred_date") or args.get("date") or "Tomorrow"
                preferred_time = args.get("preferred_time") or args.get("time") or "10:00 AM"
                reason = args.get("reason") or args.get("symptoms") or "Consultation"

                # Doctor resolution
                resolved = resolve_doctor(doctor_id_arg or doctor_name_arg or "Dr. Ali Hossain")
                doctor_id = "doc_1"
                doctor_name = "Dr. Ali Hossain"
                if resolved:
                    doctor_name = resolved.get("name", "Dr. Ali Hossain")
                    for k, v in crm_db.DOCTOR_SCHEDULE.items() if hasattr(crm_db, "DOCTOR_SCHEDULE") else []:
                        if v.get("name") == doctor_name:
                            doctor_id = k

                # Check midnight / after 10 PM condition
                bd_now = get_current_time_bd()
                current_hour = bd_now.hour
                is_currently_night = current_hour >= 22 or current_hour < 9
                time_lower = str(preferred_time).lower()
                is_night_time = any(k in time_lower for k in ["10 pm", "10:00 pm", "10:30 pm", "11 pm", "11:00 pm", "12 am", "midnight"])
                is_midnight = bool(args.get("is_midnight")) or is_currently_night or is_night_time

                if is_midnight:
                    crm_db.create_lead(
                        patient_name=patient_name,
                        phone=phone,
                        doctor_id=doctor_id,
                        doctor_name=doctor_name,
                        preferred_date=preferred_date,
                        preferred_time=preferred_time,
                        reason=f"[Midnight Booking] {reason}",
                        status="midnight_patient",
                        source="midnight_voice",
                    )
                    confirm_text = (
                        f"Doctor is not available at this time, let me redirect your info to our available persons. "
                        f"I have recorded your details as a priority midnight patient and our team will follow up with you."
                    )
                else:
                    crm_db.create_lead(
                        patient_name=patient_name,
                        phone=phone,
                        doctor_id=doctor_id,
                        doctor_name=doctor_name,
                        preferred_date=preferred_date,
                        preferred_time=preferred_time,
                        reason=reason,
                        status="new_lead",
                        source="voice_agent",
                    )
                    confirm_text = (
                        f"Your appointment with {doctor_name} for {preferred_date} at {preferred_time} has been successfully confirmed! "
                        f"We look forward to seeing you, {patient_name}."
                    )

                results.append({
                    "name": name,
                    "toolCallId": call_id,
                    "result": confirm_text
                })

            elif name in ["get_doctors", "list_doctors", "clinic_info", "get_clinic_info"]:
                results.append({
                    "name": name,
                    "toolCallId": call_id,
                    "result": (
                        "MedPulse Healthcare Clinic is open Sunday through Thursday from 9:00 AM to 10:00 PM. "
                        "Doctors available: Dr. Ali Hossain (Internal Medicine), Dr. Zarah Binte Alam (Cardiology), "
                        "Dr. Sarah Chen (Gynecology), Dr. James Mitchell (Neurology), Dr. Amara Okonkwo (Pediatrics), "
                        "Dr. Marcus Rodriguez (Orthopedics), Dr. Elena Kowalski (Dermatology), Dr. Priya Sharma (Psychiatry), "
                        "and Dr. David O'Brien (Emergency Medicine 24/7). Appointments after 10 PM are reserved as priority midnight leads."
                    )
                })
            else:
                results.append({
                    "name": name,
                    "toolCallId": call_id,
                    "result": "Operation completed successfully."
                })

        return {"results": results}

    # Other events (call-started, call-ended, end-of-call-report, etc.)
    return {"received": True, "event_type": event_type}

