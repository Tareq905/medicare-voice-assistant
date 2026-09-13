// Dedicated Admin CRM Portal JavaScript

const adminAuthScreen = document.getElementById("admin-auth-screen");
const adminDashboardScreen = document.getElementById("admin-dashboard-screen");
const adminUserControls = document.getElementById("admin-user-controls");
const adminLoginForm = document.getElementById("admin-login-form");
const adminUsernameInput = document.getElementById("admin-username");
const adminPasswordInput = document.getElementById("admin-password");
const adminLoginError = document.getElementById("admin-login-error");
const adminLogoutBtn = document.getElementById("admin-logout-btn");

// Table & CRM Elements
const crmLeadsTbody = document.getElementById("crm-leads-tbody");
const crmSearchInput = document.getElementById("crm-search-input");
const crmStatusFilter = document.getElementById("crm-status-filter");
const refreshLeadsBtn = document.getElementById("refresh-leads-btn");

const statTotalLeads = document.getElementById("stat-total-leads");
const statNewLeads = document.getElementById("stat-new-leads");
const statConfirmed = document.getElementById("stat-confirmed");
const statToday = document.getElementById("stat-today");
const statMidnightLeads = document.getElementById("stat-midnight-leads");

// Tabs Elements
const tabAllLeads = document.getElementById("tab-all-leads");
const tabMidnightLeads = document.getElementById("tab-midnight-leads");
const allTabBadge = document.getElementById("all-tab-badge");
const midnightTabBadge = document.getElementById("midnight-tab-badge");
const midnightViewBanner = document.getElementById("midnight-view-banner");
const statCardMidnight = document.getElementById("stat-card-midnight");

let currentViewTab = "all"; // "all" | "midnight"

// Manual Modal Elements
const addManualLeadBtn = document.getElementById("add-manual-lead-btn");
const manualLeadModal = document.getElementById("manual-lead-modal");
const closeManualModalBtn = document.getElementById("close-manual-modal-btn");
const cancelManualModalBtn = document.getElementById("cancel-manual-modal-btn");
const manualLeadForm = document.getElementById("manual-lead-form");

let autoRefreshInterval = null;
let countdownSec = 5;

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkAuth();
});

function startAutoRefresh() {
  stopAutoRefresh();
  countdownSec = 5;
  updateCountdownPill();

  autoRefreshInterval = setInterval(() => {
    countdownSec--;
    if (countdownSec <= 0) {
      countdownSec = 5;
      const isModalOpen = manualLeadModal && manualLeadModal.style.display === "flex";
      const isLoggedIn = sessionStorage.getItem("admin_crm_auth") === "true";
      if (isLoggedIn && !isModalOpen) {
        loadLeads(true);
        loadStats();
      }
    }
    updateCountdownPill();
  }, 1000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

function updateCountdownPill() {
  const countdownEl = document.getElementById("refresh-countdown");
  if (countdownEl) {
    countdownEl.textContent = `${countdownSec}s`;
  }
}

function checkAuth() {
  const isLoggedIn = sessionStorage.getItem("admin_crm_auth") === "true";
  if (isLoggedIn) {
    adminAuthScreen.style.display = "none";
    adminDashboardScreen.style.display = "block";
    adminUserControls.style.display = "flex";
    loadLeads();
    loadStats();
    startAutoRefresh();
  } else {
    adminAuthScreen.style.display = "flex";
    adminDashboardScreen.style.display = "none";
    adminUserControls.style.display = "none";
    stopAutoRefresh();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  adminLoginError.classList.add("hidden");
  adminLoginError.textContent = "";

  const username = adminUsernameInput.value.trim();
  const password = adminPasswordInput.value.trim();

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      sessionStorage.setItem("admin_crm_auth", "true");
      sessionStorage.setItem("admin_crm_user", data.username);
      adminLoginForm.reset();
      checkAuth();
    } else {
      adminLoginError.textContent = data.detail || "Invalid username or password.";
      adminLoginError.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Login error:", err);
    adminLoginError.textContent = "Unable to connect to login service. Please try again.";
    adminLoginError.classList.remove("hidden");
  }
}

function handleLogout() {
  sessionStorage.removeItem("admin_crm_auth");
  sessionStorage.removeItem("admin_crm_user");
  stopAutoRefresh();
  checkAuth();
}

function setupEventListeners() {
  adminLoginForm.addEventListener("submit", handleLogin);
  adminLogoutBtn.addEventListener("click", handleLogout);

  if (tabAllLeads) {
    tabAllLeads.addEventListener("click", () => switchTab("all"));
  }
  if (tabMidnightLeads) {
    tabMidnightLeads.addEventListener("click", () => switchTab("midnight"));
  }
  if (statCardMidnight) {
    statCardMidnight.addEventListener("click", () => switchTab("midnight"));
  }

  refreshLeadsBtn.addEventListener("click", () => {
    countdownSec = 5;
    updateCountdownPill();
    loadLeads();
    loadStats();
  });

  crmStatusFilter.addEventListener("change", () => {
    loadLeads();
  });

  let searchTimeout = null;
  crmSearchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadLeads();
    }, 300);
  });

  addManualLeadBtn.addEventListener("click", () => {
    manualLeadModal.style.display = "flex";
  });

  closeManualModalBtn.addEventListener("click", () => {
    manualLeadModal.style.display = "none";
  });

  cancelManualModalBtn.addEventListener("click", () => {
    manualLeadModal.style.display = "none";
  });

  manualLeadForm.addEventListener("submit", handleManualLeadSubmit);
}

function switchTab(tab) {
  currentViewTab = tab;
  if (tab === "midnight") {
    if (tabMidnightLeads) {
      tabMidnightLeads.className = "btn btn-sm btn-primary active-tab";
      tabMidnightLeads.style.background = "#f59e0b";
      tabMidnightLeads.style.borderColor = "#f59e0b";
      tabMidnightLeads.style.color = "#000";
    }
    if (tabAllLeads) {
      tabAllLeads.className = "btn btn-sm btn-outline";
      tabAllLeads.style.background = "transparent";
      tabAllLeads.style.color = "var(--text-main)";
    }
    if (midnightViewBanner) midnightViewBanner.style.display = "inline-flex";
  } else {
    if (tabAllLeads) {
      tabAllLeads.className = "btn btn-sm btn-primary active-tab";
      tabAllLeads.style.color = "#fff";
    }
    if (tabMidnightLeads) {
      tabMidnightLeads.className = "btn btn-sm btn-outline";
      tabMidnightLeads.style.background = "transparent";
      tabMidnightLeads.style.borderColor = "rgba(245, 158, 11, 0.4)";
      tabMidnightLeads.style.color = "#f59e0b";
    }
    if (midnightViewBanner) midnightViewBanner.style.display = "none";
  }
  loadLeads(false);
}

async function loadLeads(silent = false) {
  const status = crmStatusFilter.value;
  const search = crmSearchInput.value.trim();

  let url = `/api/leads?status=${encodeURIComponent(status)}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }

  if (!silent && (!crmLeadsTbody.children.length || crmLeadsTbody.innerText.includes("Loading"))) {
    crmLeadsTbody.innerHTML = `
      <tr><td colspan="9" class="text-center py-6">Loading patient leads...</td></tr>
    `;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    renderLeadsTable(data.leads || []);
  } catch (err) {
    console.error("Failed to load leads:", err);
    if (!silent) {
      crmLeadsTbody.innerHTML = `
        <tr><td colspan="9" class="text-center py-6 text-danger">Failed to load leads. Please check backend connection.</td></tr>
      `;
    }
  }
}

async function loadStats() {
  try {
    const res = await fetch("/api/crm/stats");
    const stats = await res.json();
    statTotalLeads.textContent = stats.total_leads || 0;
    statNewLeads.textContent = stats.new_leads || 0;
    statConfirmed.textContent = stats.confirmed || 0;
    statToday.textContent = stats.today_appointments || 0;
    if (statMidnightLeads) {
      statMidnightLeads.textContent = stats.midnight_patients || 0;
    }
    if (allTabBadge) {
      allTabBadge.textContent = stats.total_leads || 0;
    }
    if (midnightTabBadge) {
      midnightTabBadge.textContent = stats.midnight_patients || 0;
    }
  } catch (err) {
    console.error("Failed to load stats:", err);
  }
}

function renderLeadsTable(leads) {
  let displayLeads = leads;
  if (currentViewTab === "midnight") {
    displayLeads = leads.filter((l) => 
      l.status === "midnight_patient" || 
      l.status === "followed_up" ||
      l.source === "midnight_voice" || 
      (l.reason && l.reason.includes("[Midnight"))
    );
  }

  if (displayLeads.length === 0) {
    const emptyMsg = currentViewTab === "midnight"
      ? "🌙 No midnight patient leads found. Incoming bookings requested after 10:00 PM cutoff via AI Voice Assistant will appear here for follow-up."
      : "No patient leads found. Incoming bookings from the AI Assistant or manual bookings will appear here automatically.";

    crmLeadsTbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-6" style="color: var(--text-dim);">
          ${emptyMsg}
        </td>
      </tr>
    `;
    return;
  }

  crmLeadsTbody.innerHTML = displayLeads.map((lead) => {
    const doctorDisplay = lead.doctor_name || lead.doctor_id || "Unspecified";
    const dateDisplay = lead.preferred_date || "TBD";
    const timeDisplay = lead.preferred_time || "";
    const dateTime = `${dateDisplay} ${timeDisplay}`.trim();
    const reasonDisplay = lead.reason || "General Consultation";

    const isMidnight = lead.source === "midnight_voice" || lead.status === "midnight_patient" || lead.status === "followed_up" || (lead.reason && lead.reason.includes("[Midnight"));
    const isAssistant = lead.source === "voice_agent" || lead.source === "assistant" || lead.source === "ai_assistant";

    let sourceBadge = "";
    if (isMidnight) {
      sourceBadge = `<span class="badge badge-warning" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); white-space: nowrap;">🌙 Midnight Book</span>`;
    } else if (isAssistant) {
      sourceBadge = `<span class="badge badge-purple" style="white-space: nowrap;">🤖 Book via Assistant</span>`;
    } else {
      sourceBadge = `<span class="badge badge-outline" style="white-space: nowrap;">📝 Manual Book</span>`;
    }

    const followUpBtn = (isMidnight && lead.status === "midnight_patient")
      ? `<button class="btn btn-sm btn-outline" style="font-size: 0.75rem; padding: 4px 8px; border-color: #f59e0b; color: #fbbf24; margin-right: 6px;" title="Mark as Followed Up" onclick="window.updateLeadStatus(${lead.id}, 'followed_up')">📞 Follow Up</button>`
      : "";

    return `
      <tr data-lead-id="${lead.id}">
        <td class="font-mono">#${lead.id}</td>
        <td><strong>${escapeHtml(lead.patient_name)}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="font-mono">${escapeHtml(lead.phone)}</span>
            <a href="tel:${escapeHtml(lead.phone)}" class="btn btn-outline" style="padding: 2px 6px; font-size: 0.72rem; border-radius: 4px; color: var(--color-primary);" title="Call patient for follow-up">📞</a>
          </div>
        </td>
        <td>${escapeHtml(doctorDisplay)}</td>
        <td>📅 ${escapeHtml(dateTime)}</td>
        <td style="max-width: 220px; white-space: normal;">${escapeHtml(reasonDisplay)}</td>
        <td>${sourceBadge}</td>
        <td>
          <select class="lead-status-select" onchange="window.updateLeadStatus(${lead.id}, this.value)">
            <option value="new_lead" ${lead.status === 'new_lead' ? 'selected' : ''}>New Lead</option>
            <option value="midnight_patient" ${lead.status === 'midnight_patient' ? 'selected' : ''}>🌙 Midnight Patient</option>
            <option value="followed_up" ${lead.status === 'followed_up' ? 'selected' : ''}>📞 Followed Up</option>
            <option value="confirmed" ${lead.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="completed" ${lead.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${lead.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td style="white-space: nowrap;">
          ${followUpBtn}
          <button class="table-btn-delete" title="Delete lead" onclick="window.deleteLeadItem(${lead.id})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.updateLeadStatus = async function (leadId, newStatus) {
  try {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      loadStats();
    } else {
      alert("Failed to update status");
      loadLeads();
    }
  } catch (err) {
    console.error("Error updating status:", err);
  }
};

window.deleteLeadItem = async function (leadId) {
  try {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      loadLeads();
      loadStats();
    } else {
      alert("Failed to delete lead");
    }
  } catch (err) {
    console.error("Error deleting lead:", err);
  }
};

async function handleManualLeadSubmit(e) {
  e.preventDefault();

  const doctorSelect = document.getElementById("lead-doctor");
  const doctorName = doctorSelect.options[doctorSelect.selectedIndex].text;

  const payload = {
    patient_name: document.getElementById("lead-name").value.trim(),
    phone: document.getElementById("lead-phone").value.trim(),
    doctor_id: doctorSelect.value,
    doctor_name: doctorName,
    preferred_date: document.getElementById("lead-date").value,
    preferred_time: document.getElementById("lead-time").value,
    status: document.getElementById("lead-status").value,
    reason: document.getElementById("lead-reason").value.trim(),
    source: "manual_book",
  };

  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      manualLeadForm.reset();
      manualLeadModal.style.display = "none";
      loadLeads();
      loadStats();
    } else {
      alert("Failed to create lead");
    }
  } catch (err) {
    console.error("Error saving manual lead:", err);
  }
}

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
