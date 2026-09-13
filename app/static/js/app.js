// Import official Vapi Web SDK from ESM
import Vapi from "https://esm.sh/@vapi-ai/web";

// Global App State
let vapiInstance = null;
let vapiConfig = {
  vapi_api_key: "",
  vapi_assistant_id: "",
  clinic_name: "MedPulse Healthcare Clinic"
};

let callState = "idle"; // 'idle' | 'calling' | 'active'
let callStartTime = null;
let callTimerInterval = null;
let isMuted = false;
let currentSpeakerRole = null;
let currentTurnElement = null;
let currentTurnFinalText = "";
let currentTurnPartialText = "";

let currentSelectedDoctor = null;

// DOM Elements
const voiceWidgetToggleBtn = document.getElementById("voice-widget-toggle-btn");
const voiceModalBackdrop = document.getElementById("voice-modal-backdrop");
const voiceModalCloseBtn = document.getElementById("voice-modal-close-btn");
const openVoiceHeaderBtn = document.getElementById("open-voice-header-btn");
const heroStartCallBtn = document.getElementById("hero-start-call-btn");

const startCallBtn = document.getElementById("start-call-btn");
const endCallBtn = document.getElementById("end-call-btn");
const muteCallBtn = document.getElementById("mute-call-btn");
const micIcon = document.getElementById("mic-icon");

const callStatusBadge = document.getElementById("call-status-badge");
const callTimerText = document.getElementById("call-timer-text");
const callStateMessage = document.getElementById("call-state-message");
const avatarOrb = document.getElementById("avatar-orb");
const waveBars = document.getElementById("wave-bars");
const transcriptContainer = document.getElementById("transcript-container");

// Initialize application
document.addEventListener("DOMContentLoaded", async () => {
  await loadAppConfig();
  initVapi();
  setupEventListeners();
  startFrontendAutoRefresh();
});

let frontendAutoRefreshInterval = null;

// Frontend Auto-Refresher: continuously keeps doctor availability and config up-to-date
function startFrontendAutoRefresh() {
  if (frontendAutoRefreshInterval) clearInterval(frontendAutoRefreshInterval);

  // Initial check
  updateDoctorAvailabilityRealtime();

  // Auto-refresh every 15 seconds
  frontendAutoRefreshInterval = setInterval(async () => {
    updateDoctorAvailabilityRealtime();
    if (callState === "idle") {
      await loadAppConfig();
    }
  }, 15000);
}

// Real-time doctor availability badge updater based on Dhaka timezone
function updateDoctorAvailabilityRealtime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (3600000 * 6));
  const currentHour = bdTime.getHours();
  const currentMin = bdTime.getMinutes();
  const currentTotalMins = currentHour * 60 + currentMin;

  const schedules = {
    "doc_1": { start: 540, end: 1320, closeText: "Until 10 PM" },
    "doc_2": { start: 600, end: 1200, closeText: "Until 8 PM" },
    "doc_3": { start: 510, end: 960, closeText: "Until 4 PM" },
    "doc_4": { start: 900, end: 1260, closeText: "Until 9 PM" },
    "doc_5": { start: 540, end: 1050, closeText: "Until 5:30 PM" },
    "doc_7": { start: 840, end: 1200, closeText: "Until 8 PM" },
    "doc_8": { start: 600, end: 1080, closeText: "Until 6 PM" },
    "doc_9": { start: 1080, end: 360, overnight: true, closeText: "Night Shift" },
    "doc_12": { start: 630, end: 1020, closeText: "Until 5 PM" },
  };

  Object.keys(schedules).forEach(docId => {
    const btn = document.querySelector(`[data-doc-id="${docId}"]`);
    if (!btn) return;
    const card = btn.closest(".doctor-card");
    if (!card) return;
    const badge = card.querySelector(".doc-avail-badge");
    if (!badge) return;

    const s = schedules[docId];
    let isOpen = false;
    if (s.overnight) {
      isOpen = currentTotalMins >= s.start || currentTotalMins <= s.end;
    } else {
      isOpen = currentTotalMins >= s.start && currentTotalMins < s.end;
    }

    if (isOpen) {
      badge.className = "badge badge-success doc-avail-badge";
      badge.textContent = `● Available (${s.closeText})`;
    } else {
      badge.className = "badge badge-warning doc-avail-badge";
      badge.textContent = "🌙 Off Duty";
    }
  });
}

// Load config from backend (/api/config)
async function loadAppConfig() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      vapiConfig = await res.json();
    }
  } catch (err) {
    console.error("Failed to load config from server:", err);
  }
}

// Initialize Vapi Web SDK
function initVapi() {
  if (!vapiConfig.vapi_api_key) {
    console.warn("VAPI_API_KEY is not configured in .env");
    return;
  }

  try {
    vapiInstance = new Vapi(vapiConfig.vapi_api_key);

    // Vapi Event Listeners
    vapiInstance.on("call-start", () => {
      resetTranscriptTurn();
      setCallState("active");
      appendSystemNote("Connected with Dr. AI Agent. Start speaking!");
      startCallTimer();
    });

    vapiInstance.on("call-end", () => {
      setCallState("idle");
      appendSystemNote("Call ended. Thank you for calling MedPulse Clinic!");
      stopCallTimer();
      resetTranscriptTurn();
    });

    vapiInstance.on("speech-start", () => {
      avatarOrb.classList.add("speaking");
      waveBars.classList.add("active");
      callStateMessage.textContent = "AI Agent is speaking...";
    });

    vapiInstance.on("speech-end", () => {
      avatarOrb.classList.remove("speaking");
      waveBars.classList.remove("active");
      if (callState === "active") {
        callStateMessage.textContent = "Listening to your voice...";
      }
    });

    vapiInstance.on("message", (message) => {
      handleVapiMessage(message);
    });

    vapiInstance.on("error", (error) => {
      console.error("Vapi Error Event:", error);
      appendSystemNote(`Notice: ${error?.message || "Audio connection event occurred"}`);
      setCallState("idle");
      stopCallTimer();
      resetTranscriptTurn();
    });

  } catch (e) {
    console.error("Error creating Vapi instance:", e);
  }
}

// Reset transcript turn tracker
function resetTranscriptTurn() {
  currentSpeakerRole = null;
  currentTurnElement = null;
  currentTurnFinalText = "";
  currentTurnPartialText = "";
}

// Handle incoming transcripts and function events
function handleVapiMessage(message) {
  if (!message) return;

  // Real-time transcript events
  if (message.type === "transcript") {
    const role = message.role; // 'user' | 'assistant'
    const text = message.transcript;
    const isFinal = message.transcriptType === "final";

    if (!text || !text.trim()) return;

    renderTranscriptBubble(role, text, isFinal);
  }

  // Handle client-side function / tool calls
  if (message.type === "function-call" || message.type === "tool-calls") {
    handleToolCalls(message);
  }
}

// Client-side tool calls fallback handler
async function handleToolCalls(message) {
  let toolList = [];
  if (message.type === "function-call" && message.functionCall) {
    toolList.push({
      id: message.functionCall.id || "call_" + Date.now(),
      name: message.functionCall.name,
      args: message.functionCall.parameters || message.functionCall.arguments || {}
    });
  } else if (message.type === "tool-calls" && message.toolWithToolCallList) {
    toolList = message.toolWithToolCallList.map(t => ({
      id: t.toolCall?.id || t.id || "call_" + Date.now(),
      name: t.function?.name || t.toolCall?.function?.name,
      args: t.function?.arguments || t.toolCall?.function?.arguments || {}
    }));
  } else if (message.toolCalls) {
    toolList = message.toolCalls.map(t => ({
      id: t.id || "call_" + Date.now(),
      name: t.function?.name,
      args: t.function?.arguments || {}
    }));
  }

  for (const tool of toolList) {
    const { id, name, args } = tool;
    let parsedArgs = typeof args === "string" ? JSON.parse(args || "{}") : (args || {});

    if (name === "book_appointment" || name === "bookAppointment") {
      try {
        const timeStr = (parsedArgs.preferred_time || parsedArgs.time || "").toLowerCase();
        const reasonStr = (parsedArgs.reason || parsedArgs.symptoms || "").toLowerCase();

        // Determine if this booking is requested during/after 10 PM
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const bdTime = new Date(utc + (3600000 * 6));
        const currentHour = bdTime.getHours();
        const isCurrentlyAfter10PM = currentHour >= 22 || currentHour < 9;

        const isNightTimeRequested = [
          "10 pm", "10:00 pm", "10:30 pm", "11 pm", "11:00 pm", "11:30 pm", "12 am", "midnight", "night"
        ].some(k => timeStr.includes(k) || reasonStr.includes(k));

        const isMidnightBooking = Boolean(parsedArgs.is_midnight) || isCurrentlyAfter10PM || isNightTimeRequested;

        function resolveDoctor(dId, dName) {
          const map = {
            "doc_1": "Dr. Ali Hossain",
            "doc_2": "Dr. Zarah Binte Alam",
            "doc_3": "Dr. Amara Okonkwo",
            "doc_4": "Dr. Priya Sharma",
            "doc_5": "Dr. Sarah Chen",
            "doc_7": "Dr. Elena Kowalski",
            "doc_8": "Dr. James Mitchell",
            "doc_9": "Dr. David O'Brien",
            "doc_12": "Dr. Marcus Rodriguez"
          };
          if (dId && map[dId]) return { id: dId, name: map[dId] };
          const s = ((dId || "") + " " + (dName || "")).toLowerCase();
          if (s.includes("ali") || s.includes("hossain")) return { id: "doc_1", name: "Dr. Ali Hossain" };
          if (s.includes("zarah") || s.includes("cardio") || s.includes("heart")) return { id: "doc_2", name: "Dr. Zarah Binte Alam" };
          if (s.includes("amara") || s.includes("pediatric") || s.includes("child") || s.includes("family")) return { id: "doc_3", name: "Dr. Amara Okonkwo" };
          if (s.includes("priya") || s.includes("psychiat") || s.includes("mental")) return { id: "doc_4", name: "Dr. Priya Sharma" };
          if (s.includes("sarah") || s.includes("chen") || s.includes("gynec") || s.includes("women")) return { id: "doc_5", name: "Dr. Sarah Chen" };
          if (s.includes("elena") || s.includes("derma") || s.includes("skin") || s.includes("cosmetic")) return { id: "doc_7", name: "Dr. Elena Kowalski" };
          if (s.includes("james") || s.includes("neuro") || s.includes("brain") || s.includes("spine")) return { id: "doc_8", name: "Dr. James Mitchell" };
          if (s.includes("david") || s.includes("emergency") || s.includes("brien")) return { id: "doc_9", name: "Dr. David O'Brien" };
          if (s.includes("marcus") || s.includes("ortho") || s.includes("bone") || s.includes("joint")) return { id: "doc_12", name: "Dr. Marcus Rodriguez" };
          if (currentSelectedDoctor) return currentSelectedDoctor;
          return { id: "doc_1", name: "Dr. Ali Hossain" };
        }
        const docIdArg = parsedArgs.doctor_id || (currentSelectedDoctor ? currentSelectedDoctor.id : null);
        const docNameArg = parsedArgs.doctor_name || (currentSelectedDoctor ? currentSelectedDoctor.name : null);
        const resolvedDoc = resolveDoctor(docIdArg, docNameArg);

        let payload;
        let returnMsg;

        if (isMidnightBooking) {
          appendSystemNote("🌙 Recording Midnight Patient lead for priority follow-up...");
          payload = {
            patient_name: parsedArgs.patient_name || parsedArgs.name || "Patient",
            phone: parsedArgs.phone || parsedArgs.phoneNumber || "N/A",
            doctor_id: resolvedDoc.id,
            doctor_name: resolvedDoc.name,
            preferred_date: parsedArgs.preferred_date || parsedArgs.date || "Tonight",
            preferred_time: parsedArgs.preferred_time || parsedArgs.time || "After 10:00 PM",
            reason: `[Midnight Booking] ${parsedArgs.reason || parsedArgs.symptoms || "Appointment requested after 10:00 PM cutoff"}`,
            source: "midnight_voice",
            status: "midnight_patient"
          };
          returnMsg = `Doctor is not available at this time, let me redirect your info to our available persons. I have recorded your details as a priority midnight patient and our team will follow up with you.`;
        } else {
          appendSystemNote("🔄 Booking appointment & saving lead to CRM...");
          payload = {
            patient_name: parsedArgs.patient_name || parsedArgs.name || "Patient",
            phone: parsedArgs.phone || parsedArgs.phoneNumber || "N/A",
            doctor_id: resolvedDoc.id,
            doctor_name: resolvedDoc.name,
            preferred_date: parsedArgs.preferred_date || parsedArgs.date || "Tomorrow",
            preferred_time: parsedArgs.preferred_time || parsedArgs.time || "11:00 AM",
            reason: parsedArgs.reason || parsedArgs.symptoms || "Appointment via Voice Agent",
            source: "voice_agent",
            status: "new_lead"
          };
          returnMsg = `Appointment confirmed with ${payload.doctor_name} for ${payload.preferred_date} at ${payload.preferred_time}.`;
        }

        await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (vapiInstance) {
          // 1. Speak the confirmation directly through Vapi audio synthesizer
          if (typeof vapiInstance.say === "function") {
            vapiInstance.say(returnMsg, false, false, true);
          } else if (typeof vapiInstance.send === "function") {
            vapiInstance.send({
              type: "say",
              content: returnMsg,
              interruptAssistantEnabled: true
            });
          }

          // 2. Send status confirmation into conversation context
          if (typeof vapiInstance.send === "function") {
            vapiInstance.send({
              type: "add-message",
              message: {
                role: "system",
                content: `Booking successful for ${payload.patient_name} with ${payload.doctor_name} on ${payload.preferred_date} at ${payload.preferred_time}. Confirm this enthusiastically to the user.`
              },
              triggerResponseEnabled: false
            });
          }
        }
      } catch (err) {
        console.error("Tool execution error:", err);
      }
    } else if (name === "get_doctors" || name === "list_doctors" || name === "clinic_info" || name === "get_clinic_info") {
      appendSystemNote("📋 Retrieved doctor schedules...");
      const doctorsResult = {
        doctors: [
          { name: "Dr. Ali Hossain", specialty: "Internal & General Medicine", schedule: "09:00 AM - 10:00 PM (Sunday - Thursday)", id: "doc_1" },
          { name: "Dr. Zarah Binte Alam", specialty: "Cardiology & Internal Medicine", schedule: "10:00 AM - 08:00 PM (Saturday - Wednesday)", id: "doc_2" },
          { name: "Dr. Amara Okonkwo", specialty: "Pediatrics & Family Medicine", schedule: "08:30 AM - 04:00 PM (Monday - Thursday)", id: "doc_3" },
          { name: "Dr. Priya Sharma", specialty: "Psychiatry & Mental Health", schedule: "03:00 PM - 09:00 PM (Sunday - Thursday)", id: "doc_4" },
          { name: "Dr. Sarah Chen", specialty: "Gynecology & Obstetrics", schedule: "09:00 AM - 05:30 PM (Sunday - Thursday)", id: "doc_5" },
          { name: "Dr. Elena Kowalski", specialty: "Dermatology & Cosmetic Medicine", schedule: "02:00 PM - 08:00 PM (Tuesday - Sunday)", id: "doc_7" },
          { name: "Dr. James Mitchell", specialty: "Neurology & Brain Surgery", schedule: "10:00 AM - 06:00 PM (Tuesday - Saturday)", id: "doc_8" },
          { name: "Dr. David O'Brien", specialty: "Emergency Medicine", schedule: "06:00 PM - 06:00 AM Next Day (Thursday - Tuesday)", id: "doc_9" },
          { name: "Dr. Marcus Rodriguez", specialty: "Orthopedic Surgery", schedule: "10:30 AM - 05:00 PM (Wednesday - Saturday)", id: "doc_12" },
        ],
        policy: "No private patient appointments after 10:00 PM. Emergency medicine available 24/7."
      };
      if (vapiInstance && typeof vapiInstance.send === "function") {
        vapiInstance.send({
          type: "add-message",
          message: {
            role: "tool",
            tool_call_id: id,
            content: JSON.stringify(doctorsResult)
          }
        });
      }
    } else if (name === "check_availability") {
      appendSystemNote("🔍 Doctor schedule checked...");
      const docName = parsedArgs.doctor_name || (parsedArgs.doctor_id === "doc_2" ? "Dr. Zarah Binte Alam" : "Dr. Ali Hossain");
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const bdTime = new Date(utc + (3600000 * 6));
      const currentHour = bdTime.getHours();
      const isCurrentlyAfter10PM = currentHour >= 22 || currentHour < 9;

      const availMsg = isCurrentlyAfter10PM 
        ? `Doctor ${docName} is not available at this time. Let me redirect your info to our available persons for follow-up.`
        : `${docName} is available for appointments.`;

      if (vapiInstance && typeof vapiInstance.send === "function") {
        vapiInstance.send({
          type: "add-message",
          message: {
            role: "tool",
            tool_call_id: id,
            content: JSON.stringify({ available: !isCurrentlyAfter10PM, message: availMsg })
          }
        });
      }
    }
  }
}

// Turn-based speech bubble aggregation (solves split messages)
function renderTranscriptBubble(role, text, isFinal) {
  const isUser = role === "user";
  const roleName = isUser ? "👤 You" : "🤖 Dr. AI Agent";
  const roleClass = isUser ? "user" : "bot";
  const cleanChunk = text.trim();

  // If the same speaker is still speaking in the current turn
  if (currentTurnElement && currentSpeakerRole === role) {
    const textEl = currentTurnElement.querySelector(".chat-text");

    if (isFinal) {
      // Append final chunk to the accumulated final turn text
      if (currentTurnFinalText.length > 0) {
        // Prevent duplicate appending if the chunk is already at the end
        if (!currentTurnFinalText.endsWith(cleanChunk)) {
          currentTurnFinalText += " " + cleanChunk;
        }
      } else {
        currentTurnFinalText = cleanChunk;
      }
      currentTurnPartialText = "";
      if (textEl) {
        textEl.textContent = currentTurnFinalText;
      }
    } else {
      // Ongoing partial speech in the same turn
      currentTurnPartialText = cleanChunk;
      const combined = currentTurnFinalText 
        ? `${currentTurnFinalText} ${currentTurnPartialText}` 
        : currentTurnPartialText;
      if (textEl) {
        textEl.textContent = combined;
      }
    }
  } else {
    // New speaker turn (e.g. agent answered after user, or user replied after agent)
    currentSpeakerRole = role;
    currentTurnFinalText = isFinal ? cleanChunk : "";
    currentTurnPartialText = isFinal ? "" : cleanChunk;

    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-message ${roleClass}`;
    msgDiv.dataset.role = role;

    const initialText = currentTurnFinalText || currentTurnPartialText;
    msgDiv.innerHTML = `
      <div class="chat-sender">${roleName}</div>
      <div class="chat-text">${escapeHtml(initialText)}</div>
    `;

    transcriptContainer.appendChild(msgDiv);
    currentTurnElement = msgDiv;
  }

  // Auto-scroll to bottom
  transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}

// Append subtle system note in chat
function appendSystemNote(note) {
  resetTranscriptTurn();
  const noteDiv = document.createElement("div");
  noteDiv.className = "chat-message system-note";
  noteDiv.innerHTML = `<div class="chat-text">${escapeHtml(note)}</div>`;
  transcriptContainer.appendChild(noteDiv);
  transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}

// Set Call State
function setCallState(state) {
  callState = state;

  if (state === "active") {
    callStatusBadge.className = "call-badge active";
    callStatusBadge.textContent = "In Call";
    callStateMessage.textContent = "Listening to your voice...";
    startCallBtn.classList.add("hidden");
    endCallBtn.classList.remove("hidden");
    muteCallBtn.classList.remove("hidden");
    waveBars.classList.add("active");
  } else if (state === "calling") {
    callStatusBadge.className = "call-badge calling";
    callStatusBadge.textContent = "Connecting...";
    callStateMessage.textContent = "Connecting to Voice Agent...";
    startCallBtn.classList.add("hidden");
    endCallBtn.classList.remove("hidden");
    muteCallBtn.classList.add("hidden");
  } else {
    // idle
    callStatusBadge.className = "call-badge idle";
    callStatusBadge.textContent = "Idle";
    callTimerText.textContent = "Ready to assist • Click Dial to talk";
    callStateMessage.innerHTML = "Click the <strong>Dial</strong> button below to start talking to our AI Healthcare Agent.";
    startCallBtn.classList.remove("hidden");
    endCallBtn.classList.add("hidden");
    muteCallBtn.classList.add("hidden");
    avatarOrb.classList.remove("speaking");
    waveBars.classList.remove("active");
    resetTranscriptTurn();
  }
}

// Call Duration Timer
function startCallTimer() {
  stopCallTimer();
  callStartTime = Date.now();
  callTimerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - callStartTime) / 1000);
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
    const secs = String(elapsedSec % 60).padStart(2, "0");
    callTimerText.textContent = `Call Duration: ${mins}:${secs}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
}

// Start Call with comprehensive Assistant Overrides for doctor knowledge & cutoff
async function startVoiceCall(selectedDoctor = null) {
  if (selectedDoctor && selectedDoctor.name) {
    currentSelectedDoctor = selectedDoctor;
  } else {
    currentSelectedDoctor = null;
  }

  if (!vapiConfig.vapi_assistant_id) {
    alert("VAPI_ASSISTANT_ID is not configured in .env!");
    return;
  }

  if (!vapiInstance) {
    initVapi();
  }

  if (!vapiInstance) {
    alert("Vapi Web SDK could not be initialized. Please verify VAPI_API_KEY.");
    return;
  }

  openVoiceModal();
  setCallState("calling");

  try {
    const variableValues = {
      clinic_name: "MedPulse Healthcare Clinic",
      doctors: "1. Dr. Ali Hossain (Internal & General Medicine, doc_1), 2. Dr. Zarah Binte Alam (Cardiology & Internal Medicine, doc_2), 3. Dr. Sarah Chen (Gynecology & Obstetrics, doc_5), 4. Dr. James Mitchell (Neurology & Brain Surgery, doc_8), 5. Dr. Amara Okonkwo (Pediatrics & Family Medicine, doc_3), 6. Dr. Marcus Rodriguez (Orthopedic Surgery, doc_12), 7. Dr. Elena Kowalski (Dermatology & Cosmetic Medicine, doc_7), 8. Dr. Priya Sharma (Psychiatry & Mental Health, doc_4), 9. Dr. David O'Brien (Emergency Medicine, doc_9).",
      doctor_list: "Dr. Ali Hossain, Dr. Zarah Binte Alam, Dr. Sarah Chen, Dr. James Mitchell, Dr. Amara Okonkwo, Dr. Marcus Rodriguez, Dr. Elena Kowalski, Dr. Priya Sharma, and Dr. David O'Brien",
      cutoff_policy: "Private patient consultations are closed after 10:00 PM. Tell callers: 'Doctor is not available at this time, let me redirect your info to our available persons.' Collect patient name & phone, and register them as midnight patient."
    };

    let systemPrompt = `You are Dr. AI Agent, an extremely intelligent, polite, and efficient medical receptionist for MedPulse Healthcare Clinic.

CLINIC DOCTOR DIRECTORY & SCHEDULES:
1. Dr. Ali Hossain | Internal & General Medicine | ID: doc_1 | 09:00 AM - 10:00 PM (Sunday - Thursday)
2. Dr. Zarah Binte Alam | Cardiology & Internal Medicine | ID: doc_2 | 10:00 AM - 08:00 PM (Saturday - Wednesday)
3. Dr. Sarah Chen | Gynecology & Obstetrics | ID: doc_5 | 09:00 AM - 05:30 PM (Sunday - Thursday)
4. Dr. James Mitchell | Neurology & Brain Surgery | ID: doc_8 | 10:00 AM - 06:00 PM (Tuesday - Saturday)
5. Dr. Amara Okonkwo | Pediatrics & Family Medicine | ID: doc_3 | 08:30 AM - 04:00 PM (Monday - Thursday)
6. Dr. Marcus Rodriguez | Orthopedic Surgery | ID: doc_12 | 10:30 AM - 05:00 PM (Wednesday - Saturday)
7. Dr. Elena Kowalski | Dermatology & Cosmetic Medicine | ID: doc_7 | 02:00 PM - 08:00 PM (Tuesday - Sunday)
8. Dr. Priya Sharma | Psychiatry & Mental Health | ID: doc_4 | 03:00 PM - 09:00 PM (Sunday - Thursday)
9. Dr. David O'Brien | Emergency Medicine | ID: doc_9 | 06:00 PM - 06:00 AM Next Day (Thursday - Tuesday)
`;

    if (currentSelectedDoctor) {
      systemPrompt += `
CRITICAL ACTIVE BOOKING CONTEXT:
- The caller is currently on the website and specifically clicked to book an appointment with ${currentSelectedDoctor.name} (ID: ${currentSelectedDoctor.id}).
- THE DOCTOR IS ALREADY SELECTED: ${currentSelectedDoctor.name}.
- DO NOT ASK the caller: "Which doctor would you like to see?" or "Please specify your preferred doctor".
- DO NOT ask them to choose a doctor. You ALREADY KNOW they are booking with ${currentSelectedDoctor.name}!
`;
    }

    systemPrompt += `
INTELLIGENT RECOGNITION & CONVERSATION RULES:
1. PHONE NUMBER DIGITS:
   - Callers often speak phone numbers digit by digit with spaces or pauses (e.g. "0 1 6 2 5 8 0 1 5 3 0" or "01625801530").
   - You MUST immediately recognize any sequence of spoken digits as their complete phone number.
   - Acknowledge their number and name instantly: e.g. "Thank you, Tarek. I've noted your phone number 01625801530."
   - NEVER say you didn't get their phone number if they spoke digits!

2. ACTIVE INFORMATION TRACKING:
   - Track what the caller has already provided: Name, Phone Number, Doctor, Preferred Date/Time.
   - If they gave their Name and Phone, do not ask for them again.
   - If the doctor is ${currentSelectedDoctor ? currentSelectedDoctor.name : "already selected"}, ONLY ask for the preferred date and time:
     e.g., "What date and time would work best for you for Dr. ${currentSelectedDoctor ? currentSelectedDoctor.name : 'the doctor'}?"
   - Once you have Name, Phone, and Preferred Date/Time, IMMEDIATELY call the book_appointment tool! Do not stall.

3. AFTER 10:00 PM POLICY / MIDNIGHT LEADS:
   - Regular private appointments close after 10:00 PM (except Emergency Medicine with Dr. David O'Brien).
   - If caller requests an appointment after 10:00 PM:
     Say: "Doctor is not available at this time, let me redirect your info to our available persons."
     Collect their name and phone, then call book_appointment with is_midnight: true.

4. APPOINTMENT CONFIRMATION GUARANTEE:
   - When you call book_appointment, the booking is IMMEDIATELY AND 100% SUCCESSFUL on our system.
   - ALWAYS confirm the appointment immediately and enthusiastically:
     "Your appointment with [Doctor Name] on [Date] at [Time] has been confirmed! We have registered all your details. We look forward to seeing you!"
   - NEVER apologize. NEVER say there is a technical issue.
   - NEVER say "It seems there's a technical issue on our end with booking the appointment right now" or "Our team will reach out to you shortly to confirm your appointment due to an issue". The appointment is ALREADY registered and fully confirmed!

5. BE DYNAMIC & CONCISE:
   - Keep answers natural, empathetic, and direct. Avoid unnecessary robotic boilerplate.`;

    const assistantOverrides = {
      variableValues: variableValues,
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          }
        ]
      }
    };

    if (vapiConfig && vapiConfig.server_url) {
      assistantOverrides.server = {
        url: vapiConfig.server_url
      };
      assistantOverrides.serverUrl = vapiConfig.server_url;
    }


    if (currentSelectedDoctor) {
      variableValues.selected_doctor = currentSelectedDoctor.name;
      variableValues.doctor_name = currentSelectedDoctor.name;
      variableValues.doctor_id = currentSelectedDoctor.id;
      assistantOverrides.firstMessage = `Hello! Welcome to MedPulse Clinic. I see you would like to book an appointment with ${currentSelectedDoctor.name}. May I have your full name, phone number, and preferred date or time?`;
      appendSystemNote(`🎯 Direct Booking initiated for ${currentSelectedDoctor.name}`);
    }

    try {
      await vapiInstance.start(vapiConfig.vapi_assistant_id, assistantOverrides);
    } catch (overrideErr) {
      console.warn("Overrides failed, retrying start directly:", overrideErr);
      await vapiInstance.start(vapiConfig.vapi_assistant_id);
    }
  } catch (err) {
    console.error("Failed to start Vapi call:", err);
    appendSystemNote(`Connection error: ${err.message || "Could not start audio call"}`);
    setCallState("idle");
    stopCallTimer();
  }
}

// End Call
function endVoiceCall() {
  if (vapiInstance && (callState === "active" || callState === "calling")) {
    vapiInstance.stop();
  }
  setCallState("idle");
  stopCallTimer();
}

// Toggle Mute
function toggleMute() {
  if (!vapiInstance) return;
  isMuted = !isMuted;
  vapiInstance.setMuted(isMuted);

  if (isMuted) {
    muteCallBtn.style.color = "#ef4444";
    muteCallBtn.title = "Unmute Microphone";
    appendSystemNote("Microphone muted");
  } else {
    muteCallBtn.style.color = "";
    muteCallBtn.title = "Mute Microphone";
    appendSystemNote("Microphone unmuted");
  }
}

// Modal Toggle Handlers
function openVoiceModal() {
  voiceModalBackdrop.classList.add("open");
}

function closeVoiceModal() {
  voiceModalBackdrop.classList.remove("open");
}

// Setup Event Listeners
function setupEventListeners() {
  // Widget Modal
  voiceWidgetToggleBtn.addEventListener("click", () => {
    openVoiceModal();
  });

  voiceModalCloseBtn.addEventListener("click", closeVoiceModal);

  voiceModalBackdrop.addEventListener("click", (e) => {
    if (e.target === voiceModalBackdrop) {
      closeVoiceModal();
    }
  });

  // Call Trigger Buttons
  if (openVoiceHeaderBtn) {
    openVoiceHeaderBtn.addEventListener("click", () => {
      openVoiceModal();
      if (callState === "idle") startVoiceCall();
    });
  }

  if (heroStartCallBtn) {
    heroStartCallBtn.addEventListener("click", () => {
      openVoiceModal();
      if (callState === "idle") startVoiceCall();
    });
  }

  // Doctor card book buttons (AI Assistant)
  document.querySelectorAll(".book-doc-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const docId = e.currentTarget.dataset.docId || "doc_1";
      const docName = e.currentTarget.dataset.docName || "Dr. Ali Hossain";
      openVoiceModal();
      appendSystemNote(`Selected: ${docName}. Dialing AI Assistant for direct booking...`);
      startVoiceCall({ id: docId, name: docName });
    });
  });

  // Patient Manual Booking Modal
  const patientBookingModal = document.getElementById("patient-booking-modal");
  const closePatientModalBtn = document.getElementById("close-patient-modal-btn");
  const cancelPatientModalBtn = document.getElementById("cancel-patient-modal-btn");
  const patientBookingForm = document.getElementById("patient-booking-form");
  const patientDoctorSelect = document.getElementById("patient-doctor-select");
  const patientDateInput = document.getElementById("patient-date-input");
  const patientBookingSuccess = document.getElementById("patient-booking-success");

  // Open manual booking from doctor cards
  document.querySelectorAll(".book-manual-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const docId = e.currentTarget.dataset.docId || "doc_1";
      if (patientDoctorSelect) {
        patientDoctorSelect.value = docId;
      }
      if (patientDateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        patientDateInput.value = tomorrow.toISOString().split("T")[0];
      }
      if (patientBookingSuccess) {
        patientBookingSuccess.classList.add("hidden");
      }
      if (patientBookingModal) {
        patientBookingModal.style.display = "flex";
      }
    });
  });

  if (closePatientModalBtn) {
    closePatientModalBtn.addEventListener("click", () => {
      if (patientBookingModal) patientBookingModal.style.display = "none";
    });
  }

  if (cancelPatientModalBtn) {
    cancelPatientModalBtn.addEventListener("click", () => {
      if (patientBookingModal) patientBookingModal.style.display = "none";
    });
  }

  if (patientBookingModal) {
    patientBookingModal.addEventListener("click", (e) => {
      if (e.target === patientBookingModal) {
        patientBookingModal.style.display = "none";
      }
    });
  }

  if (patientBookingForm) {
    patientBookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const docName = patientDoctorSelect.options[patientDoctorSelect.selectedIndex].text;
      const payload = {
        patient_name: document.getElementById("patient-name-input").value.trim(),
        phone: document.getElementById("patient-phone-input").value.trim(),
        doctor_id: patientDoctorSelect.value,
        doctor_name: docName,
        preferred_date: patientDateInput.value,
        preferred_time: document.getElementById("patient-time-input").value,
        reason: document.getElementById("patient-reason-input").value.trim() || "Manual Online Booking",
        source: "manual_book",
        status: "new_lead"
      };

      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          if (patientBookingSuccess) {
            patientBookingSuccess.classList.remove("hidden");
          }
          setTimeout(() => {
            patientBookingForm.reset();
            if (patientBookingModal) patientBookingModal.style.display = "none";
          }, 1500);
        } else {
          alert("Failed to save booking. Please try again.");
        }
      } catch (err) {
        console.error("Manual booking error:", err);
        alert("Network error while booking appointment.");
      }
    });
  }

  // Call Controls
  startCallBtn.addEventListener("click", startVoiceCall);
  endCallBtn.addEventListener("click", endVoiceCall);
  muteCallBtn.addEventListener("click", toggleMute);
}

// Utility: Escape HTML
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}
