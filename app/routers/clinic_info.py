from fastapi import APIRouter, Request
from app.core.vapi_tools import extract_tool_call, format_tool_result

router = APIRouter()


DOCTORS_INFO = (
    "At MedPulse Healthcare Clinic, our specialist doctors are: "
    "1. Dr. Ali Hossain (Internal & General Medicine, ID: doc_1, 09:00 AM - 10:00 PM, Sun-Thu). "
    "2. Dr. Zarah Binte Alam (Cardiology & Internal Medicine, ID: doc_2, 10:00 AM - 08:00 PM, Sat-Wed). "
    "3. Dr. Amara Okonkwo (Pediatrics & Family Medicine, ID: doc_3, 08:30 AM - 04:00 PM, Mon-Thu). "
    "4. Dr. Priya Sharma (Psychiatry & Mental Health, ID: doc_4, 03:00 PM - 09:00 PM, Sun-Thu). "
    "5. Dr. Sarah Chen (Gynecology & Obstetrics, ID: doc_5, 09:00 AM - 05:30 PM, Sun-Thu). "
    "6. Dr. Elena Kowalski (Dermatology & Cosmetic Medicine, ID: doc_7, 02:00 PM - 08:00 PM, Tue-Sun). "
    "7. Dr. James Mitchell (Neurology & Brain Surgery, ID: doc_8, 10:00 AM - 06:00 PM, Tue-Sat). "
    "8. Dr. David O'Brien (Emergency Medicine, ID: doc_9, 06:00 PM - 06:00 AM Next Day, Thu-Tue). "
    "9. Dr. Marcus Rodriguez (Orthopedic Surgery, ID: doc_12, 10:30 AM - 05:00 PM, Wed-Sat). "
    "Please note: After 10:00 PM, private patient consultations are closed and redirected to our help desk, except emergency medicine."
)

CLINIC_INFO = {
    "services": "We offer Internal Medicine, Cardiology, Pediatrics, Psychiatry, Gynecology & Obstetrics, Dermatology, Neurology & Brain Surgery, Emergency Medicine, and Orthopedic Surgery, along with lab diagnostics and ECG.",
    "location": "MedPulse Clinic is located in Dhaka, open 7 days a week with 24/7 emergency & help desk support.",
    "pricing": "Consultation fees range from BDT 800 to BDT 1500 depending on the specialist.",
    "doctors": DOCTORS_INFO,
}

DEFAULT_INFO = DOCTORS_INFO


@router.api_route("/clinic-info", methods=["GET", "POST"])
async def get_clinic_info(request: Request):
    """
    Returns conversational clinic information. Does not write to CRM,
    as only callers requesting doctor appointments are recorded as leads.
    """
    tool_call_id = "call_info"
    topic = "doctors"
    if request.method == "POST":
        tool_call_id, args = await extract_tool_call(request)
        topic = (args.get("topic") or "doctors").lower()

    info = CLINIC_INFO.get(topic, DOCTORS_INFO)
    return format_tool_result(tool_call_id, info)


@router.api_route("/doctors", methods=["GET", "POST"])
@router.api_route("/get-doctors", methods=["GET", "POST"])
@router.api_route("/get_doctors", methods=["GET", "POST"])
async def get_doctors_list(request: Request):
    """
    Dedicated endpoint called by Vapi when requesting doctor list or availability.
    """
    tool_call_id = "call_doctors"
    if request.method == "POST":
        tool_call_id, _ = await extract_tool_call(request)

    return format_tool_result(tool_call_id, DOCTORS_INFO)

