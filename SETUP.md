# Healthcare Voice Agent & Clinic CRM — Setup & User Guide

## ১. Dependencies ইনস্টল করুন

```bash
pip install -r requirements.txt
```

## ২. .env ফাইল চেক করুন

আপনার `.env` ফাইলে Vapi এর কী এবং অ্যাসিস্ট্যান্ট আইডি বসানো আছে:
```env
CRM_BASE_URL=https://your-crm.com/api
TIMEZONE=Asia/Dhaka

VAPI_API_KEY=f73a5527-fbf5-4558-8541-90d6ecfb30c3
VAPI_ASSISTANT_ID=2cf92924-a0c4-4e2d-8a6c-74fed5f8d827
```

## ৩. FastAPI Server চালু করুন

```bash
uvicorn app.main:app --reload --port 8000
```

## ৪. ব্রাউজারে ক্লিনিক ওয়েবসাইট ও CRM ওপেন করুন

- **ক্লিনিক ওয়েবসাইট ও লাইভ ভয়েস এজেন্ট:**
  - ব্রাউজারে যান: `http://localhost:8000/`
  - স্ক্রিনের নিচে ডানপাশে একটি উজ্জ্বল রোবট আইকন (`Floating Robot Widget`) দেখতে পাবেন।
  - রোবটটিতে ক্লিক করলে ভয়েস এজেন্ট ড্রয়ার ওপেন হবে।
  - **Dial / Start Call** এ ক্লিক করলে আপনার মাইক্রোফোন দিয়ে সরাসরি AI ভয়েস এজেন্টের সাথে কথা বলতে পারবেন।
  - কথপোকথনের সাথে সাথে স্ক্রিনে **লাইভ চ্যাট ট্রান্সক্রিপ্ট** টেক্সট বাবল হিসেবে আপডেট হবে।

- **রোগীদের লিড ও CRM ড্যাশবোর্ড (Protected Admin Portal):**
  - পেইজের নিচের দিকে স্ক্রোল করুন অথবা সরাসরি `http://localhost:8000/crm` এ যান।
  - CRM ডেটা দেখার জন্য **Admin Login** গেটওয়ে দেওয়া হয়েছে:
    - **Username:** `admin`
    - **Password:** `admin123`
  - লগইন করার পর ভয়েস এজেন্টের মাধ্যমে বুক হওয়া সকল রোগীর লিড, পরিসংখ্যান ও স্ট্যাটাস পরিবর্তন করার পূর্ণ ড্যাশবোর্ড এক্সেস পাবেন। কাজ শেষে **Logout** বাটন দিয়ে লগআউট করতে পারবেন।

## ৫. Vapi Custom Tools কনফিগারেশন (ngrok)

Vapi থেকে লোকাল মেশিনে ফাংশন কল পাঠাতে আলাদা টার্মিনালে ngrok চালান:
```bash
ngrok http 8000
```
ngrok থেকে পাওয়া URL দিয়ে Vapi ড্যাশবোর্ডের Tools এ Server URL সেট করুন:
1. `check_availability`: `https://<your-ngrok>.ngrok-free.dev/vapi/check-availability`
2. `book_appointment`: `https://<your-ngrok>.ngrok-free.dev/vapi/book-appointment`
3. `clinic_info`: `https://<your-ngrok>.ngrok-free.dev/vapi/clinic-info`

## ৬. রাত ১০টার প্রাইভেট পেশেন্ট পলিসি
- Dr. Ali Hossain (ডাঃ আলী হোসেন): সকাল ৯:০০ - রাত ১০:০০
- Dr. Zarah Binte Alam (ডাঃ জারাহ বিনতে আলম): সকাল ১০:০০ - রাত ৮:০০
- রাত ১০টার পর কোনো রোগী অ্যাপয়েন্টমেন্ট চাইলে এজেন্ট স্বয়ংক্রিয়ভাবে জানাবে:
  > *"Dr. [Name] is not available for private patients at this time. Let me redirect you to our help desk for discussing your personal project."*
