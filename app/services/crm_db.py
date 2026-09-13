import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "clinic_crm.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes the SQLite CRM database and leads table"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            doctor_id TEXT,
            doctor_name TEXT,
            preferred_date TEXT,
            preferred_time TEXT,
            reason TEXT,
            status TEXT DEFAULT 'new_lead',
            source TEXT DEFAULT 'voice_agent',
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def create_lead(
    patient_name: str,
    phone: str,
    doctor_id: Optional[str] = None,
    doctor_name: Optional[str] = None,
    preferred_date: Optional[str] = None,
    preferred_time: Optional[str] = None,
    reason: Optional[str] = None,
    status: str = "new_lead",
    source: str = "voice_agent",
) -> Dict[str, Any]:
    """Inserts a new patient lead into the CRM database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO leads (
            patient_name, phone, doctor_id, doctor_name,
            preferred_date, preferred_time, reason, status, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        patient_name, phone, doctor_id, doctor_name,
        preferred_date, preferred_time, reason, status, source, created_at
    ))

    lead_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "id": lead_id,
        "patient_name": patient_name,
        "phone": phone,
        "doctor_id": doctor_id,
        "doctor_name": doctor_name,
        "preferred_date": preferred_date,
        "preferred_time": preferred_time,
        "reason": reason,
        "status": status,
        "source": source,
        "created_at": created_at,
    }


def get_all_leads(status: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all leads from the CRM (with optional status and search filters)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM leads WHERE 1=1"
    params = []

    if status and status != "all":
        query += " AND status = ?"
        params.append(status)

    if search:
        query += " AND (patient_name LIKE ? OR phone LIKE ? OR doctor_name LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def update_lead_status(lead_id: int, status: str) -> bool:
    """Updates lead status (e.g. new_lead, confirmed, completed, cancelled)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE leads SET status = ? WHERE id = ?", (status, lead_id))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def delete_lead(lead_id: int) -> bool:
    """Deletes a lead from the CRM database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def get_crm_stats() -> Dict[str, Any]:
    """Provides summary statistics for the CRM dashboard"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM leads")
    total_leads = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE status = 'new_lead'")
    new_leads = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE status = 'confirmed'")
    confirmed = cursor.fetchone()[0]

    today_str = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("SELECT COUNT(*) FROM leads WHERE preferred_date = ?", (today_str,))
    today_appointments = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE status = 'midnight_patient' OR source = 'midnight_voice'")
    midnight_patients = cursor.fetchone()[0]

    conn.close()

    return {
        "total_leads": total_leads,
        "new_leads": new_leads,
        "confirmed": confirmed,
        "today_appointments": today_appointments,
        "midnight_patients": midnight_patients,
    }
