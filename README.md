# 🏥 MedPulse — Healthcare AI Voice Assistant & Clinic CRM

An intelligent, full-stack Healthcare Voice Assistant and Patient CRM powered by **FastAPI**, **Vapi AI**, and modern web technologies. Patients can schedule appointments in real-time via a web voice widget, while clinic staff can monitor and manage appointments and priority midnight leads from a built-in administrative dashboard.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org)
[![Vapi](https://img.shields.io/badge/AI%20Voice-Vapi-8A2BE2.svg)](https://vapi.ai)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg?logo=vercel&logoColor=white)](https://vercel.com)

---

## 🌟 Key Features

- 🎙️ **Real-time AI Voice Assistant:** Interactive floating voice widget with conversational turn-taking, speech-to-text, text-to-speech, and live transcription.
- 📅 **Automated Appointment Scheduling:** Vapi tool-calling automatically checks doctor schedules, books patient slots, and updates records.
- 🌙 **Midnight / After-Hours Triage (10 PM Policy):** Intelligent routing for bookings requested after 10 PM, recording them as priority midnight leads with specialized dispatch messaging.
- 📊 **Built-in Administrative CRM Portal:** Modern dashboard (`/admin`) to search, filter, track status (`new_lead`, `confirmed`, `completed`, `cancelled`), and manually register patient leads.
- ⚡ **Multi-Cloud Ready:** Optimized for zero-configuration serverless deployment on **Vercel** (`vercel.json` + `api/index.py`) and traditional WSGI hosting on **PythonAnywhere** (`a2wsgi`).

---

## 🗂️ Project Architecture

```text
healthcare-voice-agent/
├── api/
│   └── index.py            # Vercel Serverless Function entrypoint
├── app/
│   ├── core/               # App configuration, doctor schedules & Vapi tools
│   ├── models/             # Pydantic schemas for requests & webhook payloads
│   ├── routers/            # API endpoints: /vapi/webhook, /vapi/appointments, /api/leads
│   ├── services/           # SQLite CRM database logic & external CRM sync
│   ├── static/             # Frontend patient landing page, widget & admin UI
│   └── main.py             # Main FastAPI application & lifespan handlers
├── clinic_crm.db           # SQLite database for clinic CRM leads
├── requirements.txt        # Python dependencies
├── vercel.json             # Vercel routing configuration
└── .env.example            # Environment variable template
```

---

## 🚀 Quick Start (Local Development)

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/Tareq905/medicare-voice-assistant.git
cd medicare-voice-assistant

# Create virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file based on `.env.example`:
```env
CRM_BASE_URL=http://localhost:8000/api
TIMEZONE=Asia/Dhaka

# Vapi Credentials
VAPI_API_KEY=your-vapi-public-key
VAPI_ASSISTANT_ID=your-vapi-assistant-id

# Admin Login
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 3. Run Development Server
```bash
uvicorn app.main:app --reload --port 8000
```

- **Website & Voice Widget:** [http://localhost:8000/](http://localhost:8000/)
- **Clinic CRM Dashboard:** [http://localhost:8000/admin](http://localhost:8000/admin)
- **API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ☁️ Deployment Guides

### Option A: Deploy on Vercel (Recommended)

1. Fork or push this repository to your GitHub account.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import `medicare-voice-assistant`.
4. In **Environment Variables**, add:
   - `TIMEZONE`: `Asia/Dhaka`
   - `VAPI_API_KEY`: *(Your Vapi Public Key)*
   - `VAPI_ASSISTANT_ID`: *(Your Vapi Assistant ID)*
   - `ADMIN_USERNAME`: `admin`
   - `ADMIN_PASSWORD`: `admin123`
5. Click **Deploy**. Your app is live with automatic SSL!

### Option B: Deploy on PythonAnywhere

1. In PythonAnywhere Bash Console:
   ```bash
   git clone https://github.com/Tareq905/medicare-voice-assistant.git
   cd medicare-voice-assistant
   python3.10 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. In **Web** Tab:
   - **Source Code:** `/home/<username>/medicare-voice-assistant`
   - **Virtualenv:** `/home/<username>/medicare-voice-assistant/venv`
   - In **WSGI configuration file**:
     ```python
     import sys, os
     project_home = '/home/<username>/medicare-voice-assistant'
     if project_home not in sys.path:
         sys.path.insert(0, project_home)
     from dotenv import load_dotenv
     load_dotenv(os.path.join(project_home, '.env'))
     from a2wsgi import ASGIMiddleware
     from app.main import app
     application = ASGIMiddleware(app)
     ```
3. Click **Reload**.

---

## 🔗 Connecting with Vapi Voice Agent

In your [Vapi Dashboard](https://dashboard.vapi.ai/):
1. Navigate to your **Assistant** settings.
2. Set **Server URL** to:
   ```text
   https://<your-deployed-domain>/vapi/webhook
   ```
3. Vapi will now automatically dispatch appointment booking and info queries directly to your live server.

---

## 🛡️ License

This project is open-source and available under the [MIT License](LICENSE).
