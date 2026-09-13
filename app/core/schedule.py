"""
Doctor-wise availability logic.
Restricts bookings outside doctor hours and applies 10:00 PM cutoff for private consultations.
"""
from datetime import datetime, time
import pytz
from app.core.config import settings

DOCTOR_SCHEDULE = {
    "doc_1": {"name": "Dr. Ali Hossain", "specialty": "Internal & General Medicine", "start": time(9, 0), "end": time(22, 0)},
    "doc_2": {"name": "Dr. Zarah Binte Alam", "specialty": "Cardiology & Internal Medicine", "start": time(10, 0), "end": time(20, 0)},
    "doc_3": {"name": "Dr. Amara Okonkwo", "specialty": "Pediatrics & Family Medicine", "start": time(8, 30), "end": time(16, 0)},
    "doc_4": {"name": "Dr. Priya Sharma", "specialty": "Psychiatry & Mental Health", "start": time(15, 0), "end": time(21, 0)},
    "doc_5": {"name": "Dr. Sarah Chen", "specialty": "Gynecology & Obstetrics", "start": time(9, 0), "end": time(17, 30)},
    "doc_7": {"name": "Dr. Elena Kowalski", "specialty": "Dermatology & Cosmetic Medicine", "start": time(14, 0), "end": time(20, 0)},
    "doc_8": {"name": "Dr. James Mitchell", "specialty": "Neurology & Brain Surgery", "start": time(10, 0), "end": time(18, 0)},
    "doc_9": {"name": "Dr. David O'Brien", "specialty": "Emergency Medicine", "start": time(18, 0), "end": time(6, 0)},
    "doc_12": {"name": "Dr. Marcus Rodriguez", "specialty": "Orthopedic Surgery", "start": time(10, 30), "end": time(17, 0)},
}

DEFAULT_CUTOFF = time(22, 0)  # Default 10:00 PM cutoff fallback


def get_current_time_bd() -> datetime:
    tz = pytz.timezone(settings.timezone)
    return datetime.now(tz)


def resolve_doctor(query: str | None) -> dict | None:
    if not query:
        return None
    q = str(query).strip().lower()
    
    # Direct ID match
    if q in DOCTOR_SCHEDULE:
        return DOCTOR_SCHEDULE[q]

    # Name or specialty match
    if "ali" in q or "hossain" in q or "doc_1" in q:
        return DOCTOR_SCHEDULE["doc_1"]
    if "zarah" in q or "binte" in q or "alam" in q or "cardio" in q or "heart" in q or "doc_2" in q:
        return DOCTOR_SCHEDULE["doc_2"]
    if "amara" in q or "okonkwo" in q or "pediatric" in q or "child" in q or "family" in q or "doc_3" in q:
        return DOCTOR_SCHEDULE["doc_3"]
    if "priya" in q or "sharma" in q or "psychiat" in q or "mental" in q or "doc_4" in q:
        return DOCTOR_SCHEDULE["doc_4"]
    if "sarah" in q or "chen" in q or "gynec" in q or "obstetric" in q or "women" in q or "doc_5" in q:
        return DOCTOR_SCHEDULE["doc_5"]
    if "elena" in q or "kowalski" in q or "derma" in q or "skin" in q or "cosmetic" in q or "doc_7" in q:
        return DOCTOR_SCHEDULE["doc_7"]
    if "james" in q or "mitchell" in q or "neuro" in q or "brain" in q or "spine" in q or "doc_8" in q:
        return DOCTOR_SCHEDULE["doc_8"]
    if "david" in q or "brien" in q or "o'brien" in q or "obrien" in q or "emergency" in q or "urgent" in q or "doc_9" in q:
        return DOCTOR_SCHEDULE["doc_9"]
    if "marcus" in q or "rodriguez" in q or "ortho" in q or "bone" in q or "joint" in q or "doc_12" in q:
        return DOCTOR_SCHEDULE["doc_12"]

    return None


def is_doctor_available(doctor_id: str | None) -> tuple[bool, str]:
    """
    Returns (is_available, doctor_name)
    """
    now = get_current_time_bd().time()
    doctor = resolve_doctor(doctor_id)

    if not doctor:
        # Fallback to default 10 PM cutoff
        is_available = now < DEFAULT_CUTOFF
        return is_available, "Dr. Ali Hossain"

    if doctor["start"] <= doctor["end"]:
        is_available = doctor["start"] <= now <= doctor["end"]
    else:
        # Overnight shift
        is_available = now >= doctor["start"] or now <= doctor["end"]

    return is_available, doctor["name"]

