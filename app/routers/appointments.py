from fastapi import APIRouter, Request
from app.core.schedule import is_doctor_available
from app.core.vapi_tools import extract_tool_call, format_tool_result
from app.services.crm_service import push_lead_to_crm

router = APIRouter()


@router.api_route("/book-appointment", methods=["POST"])
async def book_appointment(request: Request):
    """
    Called by the Vapi voice agent (as a Custom Tool) once patient
    booking information is collected during the call.
    """
    tool_call_id, args = await extract_tool_call(request)

    patient_name = args.get("patient_name") or args.get("name") or args.get("caller_name") or "Patient"
    phone = args.get("phone") or args.get("phone_number") or args.get("phoneNumber") or "N/A"
    doctor_id = args.get("doctor_id") or args.get("doctor") or args.get("selected_doctor") or args.get("doctor_name") or "doc_1"
    preferred_date = args.get("preferred_date") or args.get("date") or "Tomorrow"
    preferred_time = args.get("preferred_time") or args.get("time") or "Morning"
    reason = args.get("reason") or args.get("symptoms") or "Consultation"

    available, doctor_name = is_doctor_available(doctor_id)

    is_midnight = bool(args.get("is_midnight"))
    time_lower = str(preferred_time).lower()
    if any(k in time_lower for k in ["10 pm", "10:00 pm", "10:30 pm", "11 pm", "11:00 pm", "12 am", "midnight"]):
        is_midnight = True

    if not available or is_midnight:
        lead_data = {
            "name": patient_name,
            "phone": phone,
            "doctor_id": doctor_id,
            "doctor_name": doctor_name,
            "date": preferred_date,
            "time": preferred_time,
            "reason": f"[Midnight Request] {reason}",
            "source": "midnight_voice",
            "status": "midnight_patient",
        }
        await push_lead_to_crm(lead_data)
        message = (
            f"Doctor {doctor_name} is not available at this time, let me redirect your info to our available persons. "
            "I have recorded your request as a priority midnight patient and our team will follow up with you."
        )
        return format_tool_result(tool_call_id, message)

    # Only callers requesting doctor appointments become leads
    lead_data = {
        "name": patient_name,
        "phone": phone,
        "doctor_id": doctor_id,
        "doctor_name": doctor_name,
        "date": preferred_date,
        "time": preferred_time,
        "reason": reason,
        "source": "voice_agent",
        "status": "new_lead",
    }

    crm_result = await push_lead_to_crm(lead_data)

    message = (
        f"Your appointment with {doctor_name} on {preferred_date} "
        f"at {preferred_time} has been booked."
    )
    if crm_result.get("error"):
        message += " (Note: there was an issue syncing with our system, our team will confirm shortly.)"

    return format_tool_result(tool_call_id, message)


@router.api_route("/check-availability", methods=["GET", "POST"])
async def check_availability(request: Request):
    """
    Allows the agent to verify doctor availability before confirming a booking.
    """
    tool_call_id = "call_avail"
    doctor_id = "doc_1"

    if request.method == "POST":
        tool_call_id, args = await extract_tool_call(request)
        doctor_id = args.get("doctor_id") or args.get("doctor") or "doc_1"

    available, doctor_name = is_doctor_available(doctor_id)

    if available:
        message = f"{doctor_name} is available for appointments during their scheduled hours."
    else:
        message = (
            f"Doctor {doctor_name} is not available at this time. "
            "Let me redirect your info to our available persons for follow-up."
        )

    return format_tool_result(tool_call_id, message)

