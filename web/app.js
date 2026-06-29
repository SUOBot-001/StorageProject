// State variables
let games = [];
let filteredGames = [];
let selectedGame = null;
let currentPage = 1;
const itemsPerPage = 10;
let onlineFilter = false;
let cachedHWID = null;
let selectedSteamID = null;
let steamAccounts = [];
let currentPlan = null;  // activated plan, e.g. 'LIFETIME', '1YEAR', 'STANDARD'


// Color cover gradients based on the title to look unique and pretty as a fallback
function getCoverGradientStyle(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 75%, 25%) 0%, hsl(${h2}, 85%, 12%) 100%)`;
}

// Generate cover art SVG placeholder content
function createCoverArtSvg(title) {
  const words = title.split(/[^\w]+/);
  let initials = "";
  for (let w of words) {
    if (w && initials.length < 2) initials += w[0].toUpperCase();
  }
  if (!initials) initials = "SG";

  return `
    <svg width="100%" height="100%" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow-${initials}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#7CA2F7" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#4B89DC" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#glow-${initials})"/>
    </svg>
  `;
}

// Render library grid of games
function renderGrid() {
  const grid = document.getElementById("game-grid");
  grid.innerHTML = "";

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredGames.length);
  const pageGames = filteredGames.slice(startIndex, endIndex);

  const paddedGames = [...pageGames];
  while (paddedGames.length < 10 && (currentPage * itemsPerPage <= filteredGames.length || filteredGames.length > 0)) {
    paddedGames.push(null);
  }

  paddedGames.forEach(game => {
    if (!game) {
      const placeholder = document.createElement("div");
      placeholder.style.backgroundColor = "transparent";
      grid.appendChild(placeholder);
      return;
    }

    const card = document.createElement("div");
    card.className = "game-card";
    if (selectedGame && selectedGame.id === game.id) {
      card.classList.add("selected");
    }
    card.dataset.id = game.id;

    // Cover artwork container
    const coverContainer = document.createElement("div");
    coverContainer.className = "game-cover-container";

    const coverGradient = document.createElement("div");
    coverGradient.className = "game-cover-gradient";
    
    // Steam library cover art URL with fallback gradient & SVG text in case of 404
    const steamArtworkUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900_2x.jpg`;
    const fallbackArtworkUrl = `https://raw.githubusercontent.com/barryhamsy/gamelist/main/${game.appid}.jpg`;
    coverGradient.style.backgroundImage = `url('${steamArtworkUrl}'), url('${fallbackArtworkUrl}'), ${getCoverGradientStyle(game.name)}`;
    coverGradient.style.backgroundSize = "cover";
    coverGradient.style.backgroundPosition = "center";
    
    // Overlay initials on background
    coverGradient.innerHTML = createCoverArtSvg(game.name);
    
    coverContainer.appendChild(coverGradient);

    // Online Tag
    if (game.online) {
      const onlineTag = document.createElement("span");
      onlineTag.className = "online-tag";
      onlineTag.innerText = "ONLINE";
      coverContainer.appendChild(onlineTag);
    }

    card.appendChild(coverContainer);

    // Info section
    const info = document.createElement("div");
    info.className = "game-info";

    const title = document.createElement("div");
    title.className = "game-title";
    title.innerText = game.name;
    title.title = game.name;
    info.appendChild(title);

    const appid = document.createElement("div");
    appid.className = "game-appid";
    appid.innerText = `AppID ${game.appid}`;
    info.appendChild(appid);

    card.appendChild(info);
    card.addEventListener("click", () => selectGame(game));

    grid.appendChild(card);
  });

  const maxPage = Math.max(1, Math.ceil(filteredGames.length / itemsPerPage));
  document.getElementById("page-indicator").innerText = `Page ${currentPage} / ${maxPage}`;
  document.getElementById("btn-prev-page").disabled = currentPage === 1;
  document.getElementById("btn-next-page").disabled = currentPage === maxPage || filteredGames.length === 0;
}

// Select a game and update active sidebar details
function selectGame(game) {
  selectedGame = game;

  document.querySelectorAll(".game-card").forEach(card => {
    if (parseInt(card.dataset.id) === game.id) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });

  document.getElementById("steam-controller").classList.remove("disabled-section");
  document.getElementById("third-party-section").classList.remove("disabled-section");

  document.getElementById("empty-detail-state").classList.add("hidden");
  document.getElementById("active-detail-state").classList.remove("hidden");

  document.getElementById("detail-game-title").innerText = game.name;
  document.getElementById("detail-game-appid").innerText = `AppID: ${game.appid}`;
  
  const coverGrad = document.getElementById("detail-cover-gradient");
  const steamArtworkUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900_2x.jpg`;
  const fallbackArtworkUrl = `https://raw.githubusercontent.com/barryhamsy/gamelist/main/${game.appid}.jpg`;
  coverGrad.style.backgroundImage = `url('${steamArtworkUrl}'), url('${fallbackArtworkUrl}'), ${getCoverGradientStyle(game.name)}`;
  coverGrad.style.backgroundSize = "cover";
  coverGrad.style.backgroundPosition = "center";
  coverGrad.innerHTML = createCoverArtSvg(game.name);

  const badge = document.getElementById("detail-online-badge");
  if (game.online) {
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  // Enforce online-game plan ruleset on the action buttons
  applyOnlineLockToSelected();

  // Populate Steam Inputs
  document.getElementById("steam-username").value = game.username;
  document.getElementById("steam-username").classList.remove("disabled-input");
  
  // Reset Guard Code display area to default dashes
  const dashes = document.getElementById("slot-dashes");
  dashes.innerText = "------";
  dashes.classList.remove("active");

  // Populate Third-party Platform details
  const platform = game.platform || "Steam";
  const tpPlatformInput = document.getElementById("tp-platform");
  const tpUsernameInput = document.getElementById("tp-username");
  const tpPasswordInput = document.getElementById("tp-password");
  const tpSection = document.getElementById("third-party-section");
  const tpContent = document.getElementById("third-party-content");
  const tpArrow = document.getElementById("third-party-arrow");
  const lblTpUsername = document.getElementById("lbl-tp-username");
  const lblTpPassword = document.getElementById("lbl-tp-password");
  const tpNotesInput = document.getElementById("tp-notes");
  const lblTpNotes = document.getElementById("lbl-tp-notes");

  if (platform === "Steam" || platform === "None" || platform === "") {
    // Pure Steam game: no separate launcher. The Steam login is shown ONLY in
    // the main Steam Interface Controller above, never duplicated here.
    tpSection.style.display = "none";
    tpPlatformInput.value = "";
    tpUsernameInput.value = "";
    tpPasswordInput.value = "";
    if (tpNotesInput) tpNotesInput.value = "";
  } else {
    tpSection.style.display = "flex";
    tpSection.classList.remove("disabled-section");
    tpContent.style.display = "flex";
    if (tpArrow) tpArrow.style.transform = "rotate(90deg)";
    
    tpPlatformInput.value = platform;
    tpPlatformInput.classList.remove("disabled-input");
    tpUsernameInput.classList.remove("disabled-input");
    tpPasswordInput.classList.remove("disabled-input");
    
    const prefix = platform.toLowerCase();
    const customUserVal = game[`${prefix}_id`] || "";
    const customPassVal = game[`${prefix}_password`] || "";
    
    tpUsernameInput.value = customUserVal;
    tpPasswordInput.value = customPassVal;
    if (tpNotesInput) tpNotesInput.value = game[`${prefix}_notes`] || game.notes || "";
    
    lblTpUsername.innerText = game.custom_id_label || `${platform} ID / Username`;
    lblTpPassword.innerText = game.custom_password_label || `${platform} Password`;
    if (lblTpNotes) lblTpNotes.innerText = game.custom_note_label || "Notes";
  }

  showToast(`Selected: ${game.name}`, 'info');

  // Auto-detect Steam profile
  fetchSteamProfile();
}

// Copy content to Clipboard helper
function copyToClipboard(text, fieldName) {
  if (!text) return;

  if (window.pywebview && window.pywebview.api && window.pywebview.api.copy_to_clipboard) {
    window.pywebview.api.copy_to_clipboard(text).then(success => {
      if (success) {
        showToast(`Copied ${fieldName} securely!`, 'success');
      } else {
        fallbackCopy(text, fieldName);
      }
    });
  } else {
    fallbackCopy(text, fieldName);
  }
}

function fallbackCopy(text, fieldName) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied ${fieldName} to clipboard!`, 'success');
  }).catch(() => {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    showToast(`Copied ${fieldName}!`, 'success');
  });
}

// Display modern visual Toast inside window
function showToast(message, type = 'info') {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "";
  if (type === 'success') {
    icon = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>`;
  } else if (type === 'error') {
    icon = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>`;
  } else {
    icon = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`;
  }

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000); // 4 seconds duration to read detailed instructions
}

// Handle search queries and filter modes
function applyFilters() {
  const query = document.getElementById("search-input").value.toLowerCase().trim();
  
  filteredGames = games.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(query) || 
                          String(game.id).includes(query) ||
                          String(game.appid).includes(query);
    const matchesOnline = !onlineFilter || game.online;
    return matchesSearch && matchesOnline;
  });

  currentPage = 1;
  renderGrid();
}

// Fetch Steam Guard Authenticator code securely
function handleFetchSteamGuard() {
  if (!selectedGame) return;

  if (selectedGame.online && !isOnlineAllowed()) {
    showToast("Online games require a 1 Year or Lifetime plan.", 'error');
    return;
  }

  const btn = document.getElementById("btn-fetch-guard");
  const prevText = btn.innerText;
  
  btn.innerText = "Connecting IMAP...";
  btn.disabled = true;

  showToast("Establishing TLS Connection...", 'info');

  const fetchGuardPromise = (window.pywebview && window.pywebview.api && window.pywebview.api.fetch_steam_guard)
    ? window.pywebview.api.fetch_steam_guard(selectedGame.username)
    : mockFetchSteamGuard(selectedGame.username);

  fetchGuardPromise.then(result => {
    btn.innerText = prevText;
    btn.disabled = false;

    if (result.success && result.code) {
      onSteamGuardFetched(result.code);
    } else {
      showToast(`Fetch Failed: ${result.error || "No recent code found"}`, 'error');
    }
  }).catch(err => {
    btn.innerText = prevText;
    btn.disabled = false;
    showToast(`IMAP Fetch Error: ${err}`, 'error');
  });
}

// Global Callback triggered from Python backend thread when Steam Guard is loaded
window.onSteamGuardFetched = function(code) {
  const dashes = document.getElementById("slot-dashes");
  dashes.innerText = code;
  dashes.classList.add("active");
  
  showToast(`Steam Guard Code Fetched: ${code}`, 'success');
  copyToClipboard(code, "Steam Guard Code");
  
  // Alert the user about auto-fill typing
  showToast("Auto-typing Code. Please click the Steam Code input field NOW!", "info");
};

// Simulated Steam Guard fetcher for preview
function mockFetchSteamGuard(username) {
  return new Promise(resolve => {
    setTimeout(() => {
      const mockCode = Array.from({length: 5}, () => 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(Math.floor(Math.random() * 36))
      ).join("");
      
      resolve({
        success: true,
        code: mockCode
      });
    }, 2000);
  });
}

// Ruleset: ONLINE games require a 1 Year or Lifetime plan
function isOnlineAllowed() {
  const p = (currentPlan || '').toUpperCase();
  return p === '1YEAR' || p === 'LIFETIME';
}

// Lock/unlock the launch + guard buttons based on the selected game's online tag and plan
function applyOnlineLockToSelected() {
  const loginBtn = document.getElementById("btn-login-steam");
  const guardBtn = document.getElementById("btn-fetch-guard");
  const locked = !!(selectedGame && selectedGame.online && !isOnlineAllowed());
  if (loginBtn) {
    loginBtn.disabled = locked;
    loginBtn.classList.toggle("disabled-input", locked);
    loginBtn.title = locked ? "Online games require a 1 Year or Lifetime plan" : "";
  }
  if (guardBtn) {
    guardBtn.disabled = locked;
    guardBtn.classList.toggle("disabled-input", locked);
  }
  return locked;
}

// Trigger Steam Auto-Login via Python subprocess launcher
function handleSteamLogin() {
  if (!selectedGame) return;

  if (selectedGame.online && !isOnlineAllowed()) {
    showToast("Online games require a 1 Year or Lifetime plan.", 'error');
    return;
  }

  showToast("Auto-Login: Launching Steam Client...", 'info');

  if (window.pywebview && window.pywebview.api && window.pywebview.api.launch_steam) {
    window.pywebview.api.launch_steam(selectedGame.username, !!selectedGame.online).then(res => {
      if (res.success) {
        showToast("Steam Client launching. Fetching Guard Code in background...", 'success');
      } else {
        showToast(`Could not launch Steam: ${res.error}`, 'error');
      }
    });
  } else {
    // Web Preview Simulation
    setTimeout(() => {
      showToast("Simulation: Steam Launched with credentials. Connecting Gmail...", 'success');
      setTimeout(() => {
        const mockCode = "X77TH";
        onSteamGuardFetched(mockCode);
      }, 3000);
    }, 1000);
  }
}

// Fetch Steam Profile (SteamID, Persona, Avatar) from backend
function fetchSteamProfile() {
  const avatarEl = document.getElementById("steam-avatar");
  const personaEl = document.getElementById("steam-persona");
  const idEl = document.getElementById("steam-id-text");

  if (!avatarEl || !personaEl || !idEl) return;

  personaEl.innerText = "Detecting...";
  idEl.innerText = "SteamID: ---";
  avatarEl.src = "";

  if (window.pywebview && window.pywebview.api && window.pywebview.api.get_steam_profile) {
    window.pywebview.api.get_steam_profile().then(profile => {
      if (profile && profile.steamid && profile.steamid !== "UNKNOWN") {
        personaEl.innerText = profile.persona_name || "Steam User";
        idEl.innerText = `SteamID: ${profile.steamid}`;
        if (profile.avatar_url) {
          avatarEl.src = profile.avatar_url;
          avatarEl.style.display = "block";
        }
        checkActivationStatusSilently();
      } else {
        personaEl.innerText = "Not logged in";
        idEl.innerText = "SteamID: Not detected";
        updateActivationUI(false);
      }
    }).catch(() => {
      personaEl.innerText = "Error";
      idEl.innerText = "SteamID: Error";
      updateActivationUI(false);
    });
  } else {
    // Web Preview
    setTimeout(() => {
      personaEl.innerText = "SugaGamer";
      idEl.innerText = "SteamID: 76561198000000000";
      updateActivationUI(true, 'Standard');
    }, 500);
  }
}

// Handle CD Key Activation
function handleActivateCDKey() {
  const input = document.getElementById("cdkey-input");
  const status = document.getElementById("cdkey-status");
  if (!input || !status) return;

  const cdKey = input.value.trim().toLowerCase();
  if (!cdKey) {
    status.innerText = "Please enter a CD Key.";
    status.className = "cdkey-status error";
    return;
  }

  status.innerText = "Validating...";
  status.className = "cdkey-status";

  // Get HWID first, then validate
  const getHWID = () => {
    if (cachedHWID) return Promise.resolve(cachedHWID);
    if (window.pywebview && window.pywebview.api && window.pywebview.api.get_hwid) {
      return window.pywebview.api.get_hwid().then(hwid => {
        cachedHWID = hwid;
        return hwid;
      });
    }
    return Promise.resolve("UNKNOWN");
  };

  getHWID().then(hwid => {
    const currentId = selectedSteamID || null;
    if (window.pywebview && window.pywebview.api && window.pywebview.api.validate_cdkey) {
      window.pywebview.api.validate_cdkey(cdKey, hwid, currentId).then(result => {
        if (result.status === 'success') {
          status.innerText = result.message;
          status.className = "cdkey-status success";
          showToast(result.message, 'success');
          updateActivationUI(true, result.activation_type || 'Standard', result.cd_key || cdKey);
          autoCloseActivationModal();
        } else {
          status.innerText = result.message;
          status.className = "cdkey-status error";
          showToast(result.message, 'error');
        }
      }).catch(err => {
        status.innerText = "Validation error.";
        status.className = "cdkey-status error";
      });
    } else {
      // Web Preview
      setTimeout(() => {
        status.innerText = "CD Key validated! (Preview Mode)";
        status.className = "cdkey-status success";
        showToast("CD Key activated successfully. (Preview Mode)", 'success');
        updateActivationUI(true, 'Standard', cdKey);
        autoCloseActivationModal();
      }, 1000);
    }
  });
}

// Helper to update visual subscription activation state across the UI
function updateActivationUI(isActive, planName = null, cdKey = null) {
  const bannerBadge = document.getElementById("banner-status-badge");
  const bannerPlan = document.getElementById("banner-plan-text");
  const modalStatus = document.getElementById("modal-status-val");
  const modalPlan = document.getElementById("modal-plan-val");

  const btnDownload = document.getElementById("btn-download-dat");
  const btnRefresh = document.getElementById("btn-refresh");
  const btnSearch = document.getElementById("search-input");
  const detailsModal = document.getElementById("details-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const cdkeyInput = document.getElementById("cdkey-input");
  const btnActivate = document.getElementById("btn-activate-cdkey");

  if (isActive) {
    if (bannerBadge) {
      bannerBadge.innerText = "ACTIVE";
      bannerBadge.className = "badge active-badge";
    }
    if (bannerPlan) {
      bannerPlan.innerText = `Plan: ${planName || 'membership'}`;
    }
    currentPlan = planName || null;
    if (modalStatus) {
      modalStatus.innerText = "ACTIVE";
      modalStatus.style.color = "var(--accent-glow)";
    }
    if (modalPlan) {
      modalPlan.innerText = planName || "Standard";
    }
    
    if (btnDownload) btnDownload.disabled = false;
    if (btnRefresh) btnRefresh.disabled = false;
    if (btnSearch) btnSearch.disabled = false;
    if (btnCloseModal) btnCloseModal.style.display = "block";

    // Activated: show the key, grey out the field and activation buttons
    if (cdkeyInput) {
      if (cdKey) cdkeyInput.value = cdKey;
      cdkeyInput.readOnly = true;
      cdkeyInput.classList.add("disabled-input");
    }
    if (btnActivate) { btnActivate.disabled = true; btnActivate.classList.add("disabled-input"); }
  } else {
    if (bannerBadge) {
      bannerBadge.innerText = "INACTIVE";
      bannerBadge.className = "badge inactive-badge";
    }
    if (bannerPlan) {
      bannerPlan.innerText = "Plan: Not Activate Yet";
    }
    currentPlan = null;
    if (modalStatus) {
      modalStatus.innerText = "Not Activate Yet";
      modalStatus.style.color = "#ef4444";
    }
    if (modalPlan) {
      modalPlan.innerText = "Not Activate Yet";
    }

    if (btnDownload) btnDownload.disabled = true;
    if (btnRefresh) btnRefresh.disabled = true;
    if (btnSearch) btnSearch.disabled = true;
    
    if (detailsModal) detailsModal.classList.remove("hidden");
    if (btnCloseModal) btnCloseModal.style.display = "none";

    // Not activated: restore the field and activation buttons
    if (cdkeyInput) {
      cdkeyInput.value = "";
      cdkeyInput.readOnly = false;
      cdkeyInput.classList.remove("disabled-input");
    }
    if (btnActivate) { btnActivate.disabled = false; btnActivate.classList.remove("disabled-input"); }
  }

  // Re-evaluate online-game lock now that the plan may have changed
  applyOnlineLockToSelected();
}

// Silently checks activation on the server in the background
function checkActivationStatusSilently() {
  const currentId = selectedSteamID || null;
  if (window.pywebview && window.pywebview.api && window.pywebview.api.check_existing_user) {
    window.pywebview.api.check_existing_user(currentId).then(result => {
      if (result && result.status === 'success') {
        updateActivationUI(true, result.activation_type || 'Standard', result.cd_key);
      } else {
        updateActivationUI(false);
      }
    }).catch(() => {
      updateActivationUI(false);
    });
  } else {
    updateActivationUI(false);
  }
}

// Handle Reset Activation
function handleResetActivation() {
  const status = document.getElementById("cdkey-status");
  const btn = document.getElementById("btn-reset-activation");
  if (!status || !btn) return;

  const prevText = btn.innerText;
  btn.innerText = "Resetting...";
  btn.disabled = true;
  status.innerText = "";
  status.className = "cdkey-status";

  const currentId = selectedSteamID || null;
  if (window.pywebview && window.pywebview.api && window.pywebview.api.reset_activation) {
    window.pywebview.api.reset_activation(currentId).then(result => {
      btn.innerText = prevText;
      btn.disabled = false;

      if (result.status === 'success') {
        status.innerText = result.message;
        status.className = "cdkey-status success";
        showToast(result.message, 'success');
        updateActivationUI(false);
      } else {
        status.innerText = result.message;
        status.className = "cdkey-status error";
        showToast(result.message, 'error');
      }
    }).catch(err => {
      btn.innerText = prevText;
      btn.disabled = false;
      status.innerText = "Something went wrong. Please try again.";
      status.className = "cdkey-status error";
    });
  } else {
    // Web Preview
    setTimeout(() => {
      btn.innerText = prevText;
      btn.disabled = false;
      status.innerText = "Activation reset! (Preview Mode)";
      status.className = "cdkey-status success";
      showToast("Activation reset successfully! (Preview Mode)", 'success');
      updateActivationUI(false);
    }, 1000);
  }
}

// Populate SteamID Dropdown with detected accounts
function populateSteamIDDropdown() {
  const selectEl = document.getElementById("modal-steamid-select");
  if (!selectEl) return Promise.resolve();

  selectEl.innerHTML = "";

  const fetchPromise = (window.pywebview && window.pywebview.api && window.pywebview.api.get_all_steam_ids)
    ? window.pywebview.api.get_all_steam_ids()
    : Promise.resolve([
        { steamid: "76561198000000001", persona_name: "GamerPro" },
        { steamid: "76561198000000002", persona_name: "SugaGamer" }
      ]);

  return fetchPromise.then(accounts => {
    steamAccounts = accounts || [];
    if (accounts && accounts.length > 0) {
      accounts.forEach(acc => {
        const option = document.createElement("option");
        option.value = acc.steamid;
        option.innerText = `${acc.persona_name} (${acc.steamid})`;
        selectEl.appendChild(option);
      });
      
      if (selectedSteamID) {
        selectEl.value = selectedSteamID;
      } else {
        // Try to match the currently logged in SteamID
        if (window.pywebview && window.pywebview.api && window.pywebview.api.get_steam_profile) {
          return window.pywebview.api.get_steam_profile().then(profile => {
            if (profile && profile.steamid && profile.steamid !== "UNKNOWN") {
              selectedSteamID = profile.steamid;
              selectEl.value = selectedSteamID;
            } else {
              selectedSteamID = accounts[0].steamid;
              selectEl.value = selectedSteamID;
            }
          });
        } else {
          selectedSteamID = accounts[0].steamid;
          selectEl.value = selectedSteamID;
        }
      }
    } else {
      const option = document.createElement("option");
      option.value = "UNKNOWN";
      option.innerText = "No Accounts Detected";
      selectEl.appendChild(option);
      selectedSteamID = "UNKNOWN";
    }
  }).catch(err => {
    console.error("Error populating SteamID dropdown:", err);
  });
}

// Fetch Hardware ID from Python backend
function fetchHWID() {
  const hwidValEl = document.getElementById("hwid-value");
  if (!hwidValEl) return;
  
  hwidValEl.innerText = "Retrieving...";
  
  console.log("fetchHWID: starting...");
  console.log("fetchHWID: window.pywebview =", window.pywebview);
  if (window.pywebview) {
    console.log("fetchHWID: window.pywebview.api =", window.pywebview.api);
    if (window.pywebview.api) {
      console.log("fetchHWID: window.pywebview.api.get_hwid =", window.pywebview.api.get_hwid);
    }
  }

  if (window.pywebview && window.pywebview.api && window.pywebview.api.get_hwid) {
    window.pywebview.api.get_hwid().then(hwid => {
      console.log("fetchHWID: API returned hwid =", hwid);
      if (hwid) {
        hwidValEl.innerText = hwid;
      } else {
        hwidValEl.innerText = "Unavailable";
      }
    }).catch(err => {
      console.error("fetchHWID: Error calling get_hwid:", err);
      hwidValEl.innerText = "Error";
    });
  } else {
    console.warn("fetchHWID: pywebview API or get_hwid not found. Falling back to mock.");
    // Web Preview Simulation
    setTimeout(() => {
      hwidValEl.innerText = "MOCK-HWID-5F0C-61C1-A4AA-4797-BC54";
    }, 800);
  }
}

// Initialize UI elements and setup event hooks
function initUI() {
  games = [];
  filteredGames = [...games];
  renderGrid();

  // Hook Title Bar Buttons
  document.getElementById("win-close").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.close) {
      window.pywebview.api.close();
    } else {
      window.close();
    }
  });

  document.getElementById("win-min").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.minimize) {
      window.pywebview.api.minimize();
    } else {
      showToast("Simulation: Window Minimized", 'info');
    }
  });

  document.getElementById("win-max").addEventListener("click", () => {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.maximize) {
      window.pywebview.api.maximize();
    } else {
      showToast("Simulation: Window Maximized", 'info');
    }
  });

  // Modal triggers
  document.getElementById("btn-show-details").addEventListener("click", () => {
    document.getElementById("details-modal").classList.remove("hidden");
    populateSteamIDDropdown().then(() => {
      checkActivationStatusSilently();
    });
    fetchHWID();
  });

  const btnSwitchAccount = document.getElementById("btn-switch-account");
  const modalSwitchAccount = document.getElementById("switch-account-modal");
  const listSwitchAccount = document.getElementById("switch-account-list");
  
  if (btnSwitchAccount) {
    btnSwitchAccount.addEventListener("click", () => {
      if (!selectedSteamID) {
        showToast("No Steam account selected.", "error");
        return;
      }
      
      const acc = steamAccounts.find(a => a.steamid === selectedSteamID);
      if (!acc) {
        showToast("Selected account details not found.", "error");
        return;
      }
      
      showToast(`Switching to ${acc.persona_name}...`, "info");
      if (window.pywebview && window.pywebview.api && window.pywebview.api.switch_account) {
        window.pywebview.api.switch_account(acc.account_name).then(res => {
          if (res.success) {
            showToast("Steam is restarting...", "success");
          } else {
            showToast("Error: " + res.error, "error");
          }
        });
      }
    });
  }

  // SteamID dropdown change listener
  const selectEl = document.getElementById("modal-steamid-select");
  if (selectEl) {
    selectEl.addEventListener("change", (e) => {
      selectedSteamID = e.target.value;
      checkActivationStatusSilently();
    });
  }

  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("details-modal").classList.add("hidden");
  });

  document.getElementById("details-modal").addEventListener("click", (e) => {
    const btnCloseModal = document.getElementById("btn-close-modal");
    if (e.target.id === "details-modal" && btnCloseModal.style.display !== "none") {
      document.getElementById("details-modal").classList.add("hidden");
    }
  });

  // Search input listeners
  document.getElementById("search-input").addEventListener("input", applyFilters);

  // Clear button triggers
  document.getElementById("btn-clear").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    onlineFilter = false;
    document.getElementById("btn-online").classList.remove("active");
    applyFilters();
    showToast("Cleared filters", 'info');
  });

  // Online filter button triggers
  document.getElementById("btn-online").addEventListener("click", () => {
    onlineFilter = !onlineFilter;
    const btn = document.getElementById("btn-online");
    if (onlineFilter) {
      btn.classList.add("active");
      showToast("Showing ONLINE games only", 'info');
    } else {
      btn.classList.remove("active");
      showToast("Showing all library games", 'info');
    }
    applyFilters();
  });

  // Refresh Library button triggers
  document.getElementById("btn-refresh").addEventListener("click", () => {
    const icon = document.querySelector("#btn-refresh svg");
    icon.classList.add("spinning");
    showToast("Refreshing Library data...", 'info');
    
    const reloadPromise = (window.pywebview && window.pywebview.api && window.pywebview.api.get_games)
      ? window.pywebview.api.get_games()
      : Promise.resolve(null);

    reloadPromise.then(backendGames => {
      setTimeout(() => {
        icon.classList.remove("spinning");
        if (backendGames && backendGames.length > 0) {
          games = backendGames;
        } else {
          games = [];
        }
        applyFilters();
        showToast("Library successfully reloaded!", 'success');
      }, 1000);
    });
  });

  // Page Arrow Navigation Click Hooks
  document.getElementById("btn-prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderGrid();
    }
  });

  document.getElementById("btn-next-page").addEventListener("click", () => {
    const maxPage = Math.ceil(filteredGames.length / itemsPerPage);
    if (currentPage < maxPage) {
      currentPage++;
      renderGrid();
    }
  });

  // Copy helpers
  document.getElementById("btn-copy-username").addEventListener("click", () => {
    if (selectedGame) copyToClipboard(selectedGame.username, "Username");
  });

  document.getElementById("btn-copy-dashes").addEventListener("click", () => {
    const dashes = document.getElementById("slot-dashes");
    if (dashes.innerText && dashes.innerText !== "------") {
      copyToClipboard(dashes.innerText, "Steam Guard Code");
    } else {
      showToast("Steam Guard Code is empty.", "error");
    }
  });

  document.getElementById("btn-copy-tp-username").addEventListener("click", () => {
    if (selectedGame) copyToClipboard(selectedGame.username, "Username");
  });

  document.getElementById("btn-copy-tp-notes").addEventListener("click", () => {
    const notes = document.getElementById("tp-notes").value;
    if (notes) {
      copyToClipboard(notes, "Notes");
    } else {
      showToast("Notes is empty.", "error");
    }
  });

  document.getElementById("btn-copy-tp-password").addEventListener("click", () => {
    const pass = document.getElementById("tp-password").value;
    if (pass) {
      copyToClipboard(pass, "Password");
    } else {
      showToast("Password is empty.", "error");
    }
  });

  document.getElementById("btn-toggle-tp-password").addEventListener("click", () => {
    const input = document.getElementById("tp-password");
    const icon = document.getElementById("tp-eye-icon");
    if (input.type === "password") {
      input.type = "text";
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
      document.getElementById("btn-toggle-tp-password").title = "Hide Password";
    } else {
      input.type = "password";
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
      document.getElementById("btn-toggle-tp-password").title = "Show Password";
    }
  });

  // Third-party collapsible trigger
  const tpHeader = document.getElementById("third-party-header");
  const tpContent = document.getElementById("third-party-content");
  const tpArrow = document.getElementById("third-party-arrow");
  if (tpHeader && tpContent && tpArrow) {
    tpHeader.addEventListener("click", () => {
      if (tpContent.style.display === "none") {
        tpContent.style.display = "flex";
        tpArrow.style.transform = "rotate(90deg)";
      } else {
        tpContent.style.display = "none";
        tpArrow.style.transform = "rotate(0deg)";
      }
    });
  }

  document.getElementById("btn-copy-hwid").addEventListener("click", () => {
    const hwidValEl = document.getElementById("hwid-value");
    if (hwidValEl && hwidValEl.innerText && hwidValEl.innerText !== "Retrieving..." && hwidValEl.innerText !== "Unavailable" && hwidValEl.innerText !== "Error") {
      copyToClipboard(hwidValEl.innerText, "Hardware ID (HWID)");
    } else {
      showToast("HWID is not loaded yet.", "error");
    }
  });



  // Action Buttons
  document.getElementById("btn-fetch-guard").addEventListener("click", handleFetchSteamGuard);
  document.getElementById("btn-login-steam").addEventListener("click", handleSteamLogin);

  // CD Key Activation
  document.getElementById("btn-activate-cdkey").addEventListener("click", handleActivateCDKey);
  document.getElementById("btn-reset-activation").addEventListener("click", handleResetActivation);

  // Also allow Enter key in CD Key input
  document.getElementById("cdkey-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleActivateCDKey();
  });

  // Wait briefly for pywebview to initialize
  setTimeout(() => {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.get_games) {
      window.pywebview.api.get_games().then(backendGames => {
        if (backendGames && backendGames.length > 0) {
          games = backendGames;
          applyFilters();
          showToast("Synced with secure local backend!", 'success');
        }
      });
    }
    populateSteamIDDropdown().then(() => {
      const runSilentCheck = () => checkActivationStatusSilently();
      if (window.pywebview && window.pywebview.api && window.pywebview.api.verify_local_cdkey) {
        window.pywebview.api.verify_local_cdkey().then(r => {
          if (r && r.status === 'deleted') {
            showToast("Activation removed: CD Key no longer exists on the server.", 'error');
            updateActivationUI(false);
          }
          runSilentCheck();
        }).catch(runSilentCheck);
      } else {
        runSilentCheck();
      }
    });
  }, 500);
}

// Start Initialization
window.addEventListener("DOMContentLoaded", initUI);

// ── Window Resize Handles (frameless window) ──────────────────────────────
// Maps CSS direction names to Windows WM_NCLBUTTONDOWN hit-test codes
const RESIZE_HT = {
  n:  12, // HTTOP
  s:  15, // HTBOTTOM
  e:  11, // HTRIGHT
  w:  10, // HTLEFT
  ne: 14, // HTTOPRIGHT
  nw: 13, // HTTOPLEFT
  se: 17, // HTBOTTOMRIGHT
  sw: 16, // HTBOTTOMLEFT
};

document.querySelectorAll(".resize-handle").forEach(el => {
  el.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // Only left mouse button
    const dir = el.dataset.dir;
    const htCode = RESIZE_HT[dir];
    if (!htCode) return;

    // Call Python backend to trigger native OS resize
    if (window.pywebview && window.pywebview.api && window.pywebview.api.start_resize) {
      window.pywebview.api.start_resize(htCode);
    }
  });
});