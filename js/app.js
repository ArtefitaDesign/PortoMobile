/**
 * PORTO 2026 MOBILE — CLIENT APPLICATION
 * Standalone decryption, caching, and role-based dashboard rendering
 */
'use strict';

const App = (() => {

  // State
  let db = null;
  let currentUser = null;
  let encryptedText = null;
  let activeDateFilter = 'all';
  let countdownInterval = null;
  let backgroundSyncInterval = null;
  let lastSyncCheckTime = 0;
  let activeRdShiftId = '';
  let activeRdSectorId = 'all';

  // Cache keys
  const CACHE_KEY_DB = 'porto2026_mobile_db';
  const CACHE_KEY_USER = 'porto2026_mobile_user';

  // DOM Elements
  const pageLogin = document.getElementById('pageLogin');
  const pageDashboard = document.getElementById('pageDashboard');
  const loginPhone = document.getElementById('loginPhone');
  const btnLogin = document.getElementById('btnLogin');
  const loginStatusMsg = document.getElementById('loginStatusMsg');
  const appLogoContainer = document.getElementById('appLogoContainer');
  
  const encFileInp = document.getElementById('encFileInp');
  const fileNameLabel = document.getElementById('fileNameLabel');
  const localFilePickerWrapper = document.getElementById('localFilePickerWrapper');
  
  // Admin DOM Elements
  const btnAdminAccess = document.getElementById('btnAdminAccess');
  const adminPasswordModal = document.getElementById('adminPasswordModal');
  const closeAdminPasswordModal = document.getElementById('closeAdminPasswordModal');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const btnVerifyAdminPassword = document.getElementById('btnVerifyAdminPassword');
  
  const adminPanelModal = document.getElementById('adminPanelModal');
  const closeAdminPanelModal = document.getElementById('closeAdminPanelModal');
  const adminPanelStatus = document.getElementById('adminPanelStatus');
  const adminFileInp = document.getElementById('adminFileInp');
  const btnAdminClearDb = document.getElementById('btnAdminClearDb');
  
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userGreeting = document.getElementById('userGreeting');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const btnLogout = document.getElementById('btnLogout');
  const dashboardContent = document.getElementById('dashboardContent');
  
  const shiftDetailsPopup = document.getElementById('shiftDetailsPopup');
  const closeShiftDetailsPopup = document.getElementById('closeShiftDetailsPopup');
  const popupSectorName = document.getElementById('popupSectorName');
  const popupBodyContent = document.getElementById('popupBodyContent');
  
  const obsModal = document.getElementById('obsModal');
  const obsModalText = document.getElementById('obsModalText');
  const closeObsModal = document.getElementById('closeObsModal');

  const userSelectModal = document.getElementById('userSelectModal');
  const userSelectContainer = document.getElementById('userSelectContainer');
  const cancelUserSelect = document.getElementById('cancelUserSelect');

  // Initializer
  const init = () => {

    // Register Service Worker for offline capabilities
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[Service Worker] Registered successfully', reg.scope))
        .catch(err => console.warn('[Service Worker] Registration failed', err));
    }

    // Clear any previous custom logo to enforce new default logo
    localStorage.removeItem('porto2026_custom_logo');

    // 0. High security: Clear console and disable dev shortcuts
    try {
      console.clear();
      // Block context menu
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      // Block common inspect shortcuts
      document.addEventListener('keydown', (e) => {
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J')) ||
          (e.metaKey && e.altKey && e.key === 'I')
        ) {
          e.preventDefault();
        }
      });
    } catch (err) {}

    // Apply custom logo if saved
    applyCustomLogo();

    // Bind login events
    btnLogin.addEventListener('click', handleLogin);
    if (encFileInp) {
      encFileInp.addEventListener('change', handleFileSelect);
    }

    // iOS fix: when keyboard appears the input can jump outside the login card.
    // Wait for the keyboard to fully open (~350ms) then scroll the input into view.
    if (loginPhone) {
      loginPhone.addEventListener('focus', () => {
        setTimeout(() => {
          loginPhone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350);
      });
    }

    // Bind Admin events
    btnAdminAccess.addEventListener('click', () => {
      adminPasswordInput.value = '';
      adminPasswordModal.classList.add('open');
      adminPasswordInput.focus();
    });
    
    closeAdminPasswordModal.addEventListener('click', () => adminPasswordModal.classList.remove('open'));
    adminPasswordModal.addEventListener('click', (e) => { if (e.target === adminPasswordModal) adminPasswordModal.classList.remove('open'); });
    
    btnVerifyAdminPassword.addEventListener('click', handleAdminPasswordVerify);
    adminPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAdminPasswordVerify();
    });
    
    closeAdminPanelModal.addEventListener('click', () => adminPanelModal.classList.remove('open'));
    adminPanelModal.addEventListener('click', (e) => { if (e.target === adminPanelModal) adminPanelModal.classList.remove('open'); });
    
    adminFileInp.addEventListener('change', handleAdminFileUpload);
    btnAdminClearDb.addEventListener('click', handleAdminClearDb);

    // Bind global events
    btnLogout.addEventListener('click', handleLogout);
    closeObsModal.addEventListener('click', () => obsModal.classList.remove('open'));
    obsModal.addEventListener('click', (e) => { if (e.target === obsModal) obsModal.classList.remove('open'); });
    cancelUserSelect.addEventListener('click', () => userSelectModal.classList.remove('open'));
    
    if (closeShiftDetailsPopup) {
      closeShiftDetailsPopup.addEventListener('click', () => shiftDetailsPopup.classList.remove('open'));
    }
    if (shiftDetailsPopup) {
      // Tap backdrop to close
      shiftDetailsPopup.addEventListener('click', (e) => { if (e.target === shiftDetailsPopup) shiftDetailsPopup.classList.remove('open'); });
    }

    // 1. Check if we already have a cached decrypted session
    const cachedDb = localStorage.getItem(CACHE_KEY_DB);
    const cachedUser = localStorage.getItem(CACHE_KEY_USER);

    if (cachedDb && cachedUser) {
      try {
        db = JSON.parse(cachedDb);
        currentUser = JSON.parse(cachedUser);
        
        // Cache session start timestamp
        if (!sessionStorage.getItem('porto2026_session_start_time')) {
          const lastSeen = localStorage.getItem(`porto2026_last_seen_${currentUser.id}`) || '0';
          const sessionStart = lastSeen !== '0' ? lastSeen : Date.now().toString();
          sessionStorage.setItem('porto2026_session_start_time', sessionStart);
          localStorage.setItem(`porto2026_last_seen_${currentUser.id}`, Date.now().toString());
        }
        
        showDashboard();
        return; // Now it is safe to return because event listeners are already bound!
      } catch (err) {
        localStorage.removeItem(CACHE_KEY_DB);
        localStorage.removeItem(CACHE_KEY_USER);
      }
    }

    // Disable controls initially while fetching
    loginPhone.disabled = true;
    btnLogin.disabled = true;

    // 2. Dynamic Database Loading Core
    // Check if there is an active database saved in localStorage
    const savedGlobalEnc = localStorage.getItem('porto2026_global_enc');
    if (savedGlobalEnc) {
      encryptedText = savedGlobalEnc;
      loginPhone.disabled = false;
      btnLogin.disabled = false;
      updateLoginStatus('Base de dados carregada! Introduza o seu número de telemóvel para entrar.', 'info');
      
      // Try to sync with server quietly if online
      if (window.location.protocol !== 'file:') {
        fetch('./porto2026_mobile.enc?_t=' + Date.now(), { method: 'HEAD' })
          .then(res => {
            if (res.ok) {
              const newVersion = res.headers.get('ETag') || res.headers.get('Last-Modified') || res.headers.get('Content-Length');
              const savedVersion = localStorage.getItem('porto2026_global_enc_version');
              if (savedVersion && newVersion === savedVersion) {
                return null; // No changes
              }
              return newVersion || 'new';
            }
            return null;
          })
          .then(newVersion => {
            if (newVersion) {
              return fetch('./porto2026_mobile.enc?_t=' + Date.now())
                .then(res => { if (res.ok) return res.text(); })
                .then(text => {
                  if (text && text !== savedGlobalEnc) {
                    localStorage.setItem('porto2026_global_enc', text);
                    localStorage.setItem('porto2026_global_enc_version', newVersion);
                    encryptedText = text;
                    console.log("Database synced with server.");
                  }
                });
            }
          }).catch(() => {});
      }
      return;
    }

    // If no localStorage database, try auto-fetching from server
    if (window.location.protocol === 'file:') {
      updateLoginStatus('Modo Local. Por favor, aceda ao Painel de Administração para carregar o ficheiro .enc.', 'danger');
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      fetch('./porto2026_mobile.enc?_t=' + Date.now(), { signal: controller.signal })
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error("Offline");
          const version = response.headers.get('ETag') || response.headers.get('Last-Modified') || response.headers.get('Content-Length');
          if (version) {
            localStorage.setItem('porto2026_global_enc_version', version);
          }
          return response.text();
        })
        .then(text => {
          encryptedText = text;
          localStorage.setItem('porto2026_global_enc', text);
          loginPhone.disabled = false;
          btnLogin.disabled = false;
          updateLoginStatus('Introduza o seu número de telemóvel para entrar.', 'info');
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.warn("Auto-fetch failed", err);
          updateLoginStatus('⚠️ Nenhuma base de dados ativa. Aceda ao Painel de Administração para carregar as escalas.', 'danger');
        });
    }
  };

  // UI Utilities
  const esc = (str) => {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Returns a wa.me-compatible phone number, preserving existing country codes.
  // If the number already starts with + or 00, strips the + and uses it directly.
  // If exactly 9 digits, it is a local Portuguese number, so we prepend 351.
  // Otherwise, it already contains the country code, so we use it directly.
  const waPhone = (raw) => {
    const cleanRaw = String(raw || '').trim();
    let digits = cleanRaw.replace(/[^0-9]/g, '');
    
    if (cleanRaw.startsWith('+')) {
      return digits;
    }
    if (digits.startsWith('00')) {
      return digits.slice(2);
    }
    if (digits.length === 9) {
      return '351' + digits;
    }
    return digits;
  };

  // Prepares a tel: href compatible number.
  // Adds '+' to numbers with a country code if they don't have one.
  // If exactly 9 digits, prepends '+351'.
  const makeTelLink = (raw) => {
    const cleanRaw = String(raw || '').trim();
    let digits = cleanRaw.replace(/[^0-9]/g, '');
    if (cleanRaw.startsWith('+')) {
      return '+' + digits;
    }
    if (digits.startsWith('00')) {
      return '+' + digits.slice(2);
    }
    if (digits.length === 9) {
      return '+351' + digits;
    }
    return '+' + digits;
  };

  const getWeekDay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[d.getDay()];
  };

  // Hex conversion & SHA-256 helpers
  const hexToBuf = (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer;
  };

  const sha256 = async (str) => {
    const encoder = new TextEncoder();
    const hash = await window.crypto.subtle.digest("SHA-256", encoder.encode(str));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Decryption core (Envelope cryptography)
  const decryptContainer = async (containerJson, rawPhone) => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // 1. Normalize phone input
    const cleanPhone = rawPhone.trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 8) {
      throw new Error("Telemóvel inválido.");
    }

    // 2. Parse container
    const container = typeof containerJson === 'string' ? JSON.parse(containerJson) : containerJson;
    const { keysTable, salt, payloadIv, payloadCt } = container;

    // 3. Compute hash of normalized phone to lookup in table
    const phoneHash = await sha256(cleanPhone);
    const keyBlock = keysTable[phoneHash];
    if (!keyBlock) {
      throw new Error("Não autorizado.");
    }

    // 4. Derive decryption key from phone using salt from container
    const saltBytes = new Uint8Array(hexToBuf(salt));
    const phoneBuffer = encoder.encode(cleanPhone);
    const baseKey = await window.crypto.subtle.importKey(
      "raw",
      phoneBuffer,
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 100000,
        hash: "SHA-256"
      },
      baseKey,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["decrypt"]
    );

    // 5. Decrypt master key using derived key
    const keyIvBytes = new Uint8Array(hexToBuf(keyBlock.iv));
    const keyCtBytes = new Uint8Array(hexToBuf(keyBlock.ct));

    const masterKeyBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: keyIvBytes
      },
      derivedKey,
      keyCtBytes
    );

    // 6. Import master key to decrypt main payload
    const importedMasterKey = await window.crypto.subtle.importKey(
      "raw",
      masterKeyBuffer,
      "AES-GCM",
      false,
      ["decrypt"]
    );

    const payloadIvBytes = new Uint8Array(hexToBuf(payloadIv));
    const payloadCtBytes = new Uint8Array(hexToBuf(payloadCt));

    const decryptedPayloadBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: payloadIvBytes
      },
      importedMasterKey,
      payloadCtBytes
    );

    return decoder.decode(decryptedPayloadBuffer);
  };

  // Event handlers
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileNameLabel.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      encryptedText = ev.target.result;
      loginPhone.disabled = false;
      btnLogin.disabled = false;
      updateLoginStatus('Ficheiro encriptado carregado! Introduza agora o seu número de telemóvel para entrar.', 'info');
      loginPhone.focus();
    };
    reader.readAsText(file);
  };

  const handleLogin = async () => {
    let phoneInput = loginPhone.value.trim().replace(/\s+/g, '');

    if (!phoneInput) {
      updateLoginStatus('Por favor, introduza o seu número de telemóvel.', 'danger');
      return;
    }

    const countryCodeSelect = document.getElementById('countryCodeSelect');
    const selectedPrefix = countryCodeSelect ? countryCodeSelect.value : '351';

    let cleanPhone = phoneInput.replace(/[^0-9]/g, '');

    // Prepend country code if not already typed
    if (cleanPhone.length === 9) {
      cleanPhone = selectedPrefix + cleanPhone;
    } else if (cleanPhone.length < 9) {
      cleanPhone = selectedPrefix + cleanPhone;
    } else if (!cleanPhone.startsWith(selectedPrefix) && !cleanPhone.startsWith('351') && !cleanPhone.startsWith('1')) {
      cleanPhone = selectedPrefix + cleanPhone;
    }

    updateLoginStatus('A desencriptar base de dados...', 'info');

    try {
      // 1. Decrypt raw container
      const decryptedText = await decryptContainer(encryptedText, cleanPhone);
      const parsedDb = JSON.parse(decryptedText);

      // 2. Find volunteer(s) by phone number
      const matchingVolunteers = parsedDb.volunteers.filter(v => {
        const dbPhone = (v.phone || '').replace(/[^0-9]/g, '');
        if (dbPhone.length < 8) return false; // Ignore empty or invalid phone numbers
        return dbPhone.endsWith(cleanPhone) || cleanPhone.endsWith(dbPhone) || dbPhone === cleanPhone;
      });

      if (matchingVolunteers.length === 0) {
        updateLoginStatus('Número de telemóvel não encontrado na base de dados.', 'danger');
        return;
      }

      db = parsedDb;

      // 3. Handle shared phone numbers
      if (matchingVolunteers.length > 1) {
        // Show selection modal
        userSelectContainer.innerHTML = '';
        matchingVolunteers.forEach(v => {
          const btn = document.createElement('button');
          btn.className = 'vol-row-item';
          btn.style.width = '100%';
          btn.style.textAlign = 'left';
          btn.style.background = 'var(--surface)';
          btn.style.border = '1px solid var(--surface-border)';
          btn.style.borderRadius = '8px';
          btn.style.padding = '12px';
          btn.style.marginBottom = '8px';
          btn.style.cursor = 'pointer';
          
          btn.innerHTML = `
            <div style="font-weight:700;color:var(--text-primary);">${esc(v.fullName)}</div>
            <div style="font-size:11px;color:var(--text-secondary);">${esc(v.congregation || 'Sem Congregação')}</div>
          `;
          btn.addEventListener('click', () => {
            userSelectModal.classList.remove('open');
            currentUser = v;
            
            // Cache session start time
            const lastSeen = localStorage.getItem(`porto2026_last_seen_${currentUser.id}`) || '0';
            const sessionStart = lastSeen !== '0' ? lastSeen : Date.now().toString();
            sessionStorage.setItem('porto2026_session_start_time', sessionStart);
            localStorage.setItem(`porto2026_last_seen_${currentUser.id}`, Date.now().toString());
            
            // Detect scale changes before caching the new database
            detectScaleChanges(db);
            
            localStorage.setItem(CACHE_KEY_DB, JSON.stringify(db));
            localStorage.setItem(CACHE_KEY_USER, JSON.stringify(currentUser));
            showDashboard();
          });
          userSelectContainer.appendChild(btn);
        });
        userSelectModal.classList.add('open');
        updateLoginStatus('Por favor, selecione o seu nome no painel.', 'info');
      } else {
        // Only one volunteer has this phone number
        currentUser = matchingVolunteers[0];
        
        // Cache session start time
        const lastSeen = localStorage.getItem(`porto2026_last_seen_${currentUser.id}`) || '0';
        const sessionStart = lastSeen !== '0' ? lastSeen : Date.now().toString();
        sessionStorage.setItem('porto2026_session_start_time', sessionStart);
        localStorage.setItem(`porto2026_last_seen_${currentUser.id}`, Date.now().toString());
        
        // Detect scale changes before caching the new database
        detectScaleChanges(db);
        
        localStorage.setItem(CACHE_KEY_DB, JSON.stringify(db));
        localStorage.setItem(CACHE_KEY_USER, JSON.stringify(currentUser));
        showDashboard();
      }

    } catch (err) {
      console.error(err);
      updateLoginStatus('Telemóvel não autorizado ou erro de desencriptação.', 'danger');
    }
  };

  const handleLogout = () => {
    // Before clearing, save the current timestamp as the last seen timestamp
    if (currentUser) {
      localStorage.setItem(`porto2026_last_seen_${currentUser.id}`, Date.now().toString());
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (backgroundSyncInterval) {
      clearInterval(backgroundSyncInterval);
      backgroundSyncInterval = null;
    }
    sessionStorage.removeItem('porto2026_session_start_time');
    localStorage.removeItem(CACHE_KEY_DB);
    localStorage.removeItem(CACHE_KEY_USER);
    db = null;
    currentUser = null;
    activeDateFilter = 'all'; // Reset active filter to 'all' on logout!

    // Reset login form
    loginPhone.value = '';
    
    loginStatusMsg.className = 'alert alert-info';

    pageDashboard.classList.remove('active');
    pageLogin.classList.add('active');

    // 1. Check if we already have the encrypted text loaded from localStorage
    const savedGlobalEnc = localStorage.getItem('porto2026_global_enc');
    if (savedGlobalEnc) {
      encryptedText = savedGlobalEnc;
      loginPhone.disabled = false;
      btnLogin.disabled = false;
      updateLoginStatus('Base de dados carregada! Introduza o seu número de telemóvel para entrar.', 'info');
      return;
    }

    // 2. Fetch encrypted file automatically if no local database exists
    loginPhone.disabled = true;
    btnLogin.disabled = true;
    loginStatusMsg.textContent = 'A ligar ao servidor de escalas...';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    fetch('./porto2026_mobile.enc?_t=' + Date.now(), { signal: controller.signal })
      .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error("Offline");
        const version = response.headers.get('ETag') || response.headers.get('Last-Modified') || response.headers.get('Content-Length');
        if (version) {
          localStorage.setItem('porto2026_global_enc_version', version);
        }
        return response.text();
      })
      .then(text => {
        encryptedText = text;
        localStorage.setItem('porto2026_global_enc', text);
        loginPhone.disabled = false;
        btnLogin.disabled = false;
        updateLoginStatus('Introduza o seu número de telemóvel para entrar.', 'info');
      })
      .catch(err => {
        clearTimeout(timeoutId);
        updateLoginStatus('⚠️ Nenhuma base de dados ativa. Aceda ao Painel de Administração para carregar as escalas.', 'danger');
      });
  };

  /* ---- ADMIN PORTAL CONTROLS ---- */
  const handleAdminPasswordVerify = () => {
    const pw = adminPasswordInput.value.trim();
    if (pw === 'PortIndic2026*') {
      adminPasswordModal.classList.remove('open');
      adminPanelModal.classList.add('open');
      updateAdminPanelUI();
    } else {
      alert('Palavra-passe incorreta!');
    }
  };

  const updateAdminPanelUI = () => {
    const savedGlobalEnc = localStorage.getItem('porto2026_global_enc');
    if (savedGlobalEnc) {
      const sizeKB = Math.round(savedGlobalEnc.length / 1024);
      adminPanelStatus.className = 'alert alert-success';
      adminPanelStatus.textContent = `✅ Base de dados ativa no dispositivo (~${sizeKB} KB).`;
      btnAdminClearDb.style.display = 'block';
    } else {
      adminPanelStatus.className = 'alert alert-info';
      adminPanelStatus.textContent = '❌ Nenhuma base de dados guardada neste dispositivo.';
      btnAdminClearDb.style.display = 'none';
    }
  };

  const DEFAULT_LOGO_SVG = `﻿<?xml version="1.0" encoding="utf-8"?><svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 215.547506 254.937016" width="120" height="142" style="width:120px;height:142px;display:block;margin:0 auto;"><g><path d="M155.656514,107.216707c-1.176208,5.37561-2.425293,10.225342-3.539429,14.216736-.814697,2.91687-4.762085,3.493164-6.283386.876709-3.110596-5.350525-9.650208-10.914673-23.364258-11.768799-1.785156-.111267-3.587463-.127319-5.393433-.094666v32.647583c32.134583-2.728699,59.899048-12.828918,76.807068-26.495361.594055-.479614,1.474854-.00238,1.395569.756653-2.122986,20.455811-21.354614,38.86908-49.340027,49.549622,6.77179,1.302856,13.639587,2.210449,20.577942,2.210449,5.766907,0,10.468872-.123718,14.343384-.978821,2.408875-.531677,3.396912-1.805725,3.566223-3.474548.169373-1.667053-.765808-3.763794-4.645935-4.5271-2.887634-.568054-5.905823-1.106323-5.905823-2.433655,0-1.123352,1.470032-1.887573,5.362549-2.358826,3.103088-.375488,10.15387-.769043,15.216553-2.264709,11.13031-3.287598,21.093994-13.097961,21.093994-31.831299v-12.494446l-59.890991-1.535522Z" fill="#91cae0" /><path d="M70.049154,116.126497c.704224-1.350769,1.433228-2.878662,2.165466-4.559692-9.503662,3.075439-18.586243,7.387085-26.99939,12.847534l-14.931091,15.875122c4.798035,1.216675,9.835144,2.229919,15.070801,3.021423-.07843-.799927-.123291-1.622986-.123291-2.466919,0-6.031128,2.086182-11.135864,4.951416-12.313721,1.333557-.548828,2.86084-.983215,4.575867-1.383545-1.85553,2.929688-3.027771,7.868286-3.027771,13.694458,0,1.146606.046875,2.257141.134155,3.326416.662537.07489,1.327515.146545,1.9953.214172-.104492-1.121338-.166138-2.30072-.166138-3.540588,0-7.525635,2.09375-13.055115,4.261597-14.32019,1.848389-.264648,3.912109-.411133,5.601562-.420349,1.183044.006409,2.549805.080872,3.898132.214966-2.192261,2.76355-3.615479,8.106506-3.615479,14.525574,0,1.494446.080078,2.92688.226196,4.285645.662537.030457,1.324341.062439,1.990906.08606-.160156-1.361511-.253418-2.820801-.253418-4.371704,0-7.322632,1.982056-12.752441,4.085876-14.205688.397522.066467.785461.136108,1.146973.213745,1.088928.232605,2.102173.472046,3.049805.733032-1.702637,2.97052-2.764771,7.712585-2.764771,13.258911,0,1.570923.093689,3.067383.254639,4.487427.655762.004822,1.315125.003174,1.974487.001587-.168945-1.393555-.265869-2.89447-.265869-4.489014,0-5.684021,1.194641-10.227905,2.713562-12.657166.317017.112488.635742.223389.93396.346252,2.865234,1.177856,4.951416,6.282593,4.951416,12.313721,0,1.510498-.131287,2.962891-.373108,4.310852.853516-.036011,1.709473-.077271,2.56781-.124512-.146973-1.309082-.231445-2.707886-.231445-4.189148,0-7.322632,1.982117-12.752441,4.086304-14.205688.397156.066467.785461.136108,1.146545.213745,1.089355.232605,2.102234.472046,3.050232.733032-1.702637,2.97052-2.765137,7.712585-2.765137,13.258911,0,1.347534.065247,2.645447.184509,3.884094.62738-.035217,1.283508-.071655,1.964905-.110107-.118896-1.188965-.186157-2.448853-.186157-3.773987,0-5.684021,1.194641-10.227905,2.713501-12.657166.317078.112488.635742.223389.934021.346252,2.865234,1.177856,4.951416,6.282593,4.951416,12.313721,0,1.144165-.076111,2.2547-.217407,3.312439,3.907715-.218994,7.626892-.427185,10.003723-.560913v-32.676819c-13.676025,1.496094-26.934937,6.097778-35.615967,9.685242-2.777527,1.147766-5.441833-1.805542-4.048645-4.477417ZM81.601034,126.100985c1.183411.006042,2.550171.080505,3.898132.2146-1.225098,1.544128-2.206726,3.897339-2.836426,6.790588-1.074951-3.170288-2.817627-5.501465-4.983032-6.391418-.262268-.107727-.5401-.207031-.818726-.305908,1.610168-.193359,3.309204-.300232,4.740051-.307861Z" fill="#91cae0" /></g><path d="M145.750457,166.867741c.000801.001201.001601.002002.002802.003203.043637.008407.087675.015813.131712.024421-.044838-.008808-.089676-.018816-.134515-.027624Z" fill="#979797" /><path d="M215.541899,29.629453v-8.094494l-62.59171,7.919745c1.683434,3.707558,3.13467,8.217199,4.305267,13.667441l3.824057,3.635897-2.870445,1.393387c.100886.605716.202973,1.206628.297854,1.832761l3.948563-1.912029,5.809748,5.521102c-3.147881-1.147577-6.37503-2.119005-9.661028-2.919286.259021,1.769307.497624,3.605471.707403,5.537516,4.037038,1.087326,7.941164,2.462898,11.685553,4.116506.194566.085072.388331.171346.582096.25802.314268.141721.627735.284242.9396.429766.513237.237602,1.023272.48141,1.530904.730022.04644.022619.092879.045038.138918.067858,1.957667.96322,3.870897,2.005108,5.73008,3.128064.032027.019216.064455.038032.096482.057249.291849.176951.580895.357905.869941.538659.954813.590303,1.900819,1.193416,2.828409,1.821351l-.028424.012811c.004404.003203.009208.006005.013612.009208v30.085424l-26.133058.052044c-.377121,2.164443-.779464,4.283048-1.198621,6.338399l59.1748,1.51489v-15.520619l-8.179767-19.726401,8.179767-3.712362v-10.518158c-9.559342-6.062363-19.705584-11.02439-30.062004-14.613246v-8.451799l30.062004-3.199725ZM157.963659,41.330419c1.325529.15213,2.652259.321073,3.980991.522845,2.260725.342892,4.492626.76325,6.701708,1.238855l-5.852985,2.836816-4.829714-4.598517ZM169.50589,52.315975l-5.336946-5.078926,5.336946-2.585602v7.664528ZM175.352469,51.020272l-4.065863,1.958868v-7.160899l4.065863,5.202031ZM172.031641,43.87939c3.786825.941202,7.492381,2.071765,11.108261,3.388886l-6.147636,2.959721-4.960625-6.348607ZM171.514,54.840125l4.956221-2.382829,6.037142,7.731985c-3.537413-2.020521-7.210141-3.807643-10.993363-5.349156ZM183.698778,58.819715l-5.582755-7.154694,5.582755-2.690091v9.844785ZM183.698778,40.676662c-7.654119-2.529554-15.410726-4.297861-23.120092-5.202031,5.532712-.582496,17.912456-1.898417,23.120092-2.455091v7.657122ZM185.479895,97.462828v-28.841164c10.497741,7.513599,19.101069,17.404424,25.210672,28.790922l-25.210672.050243ZM185.479895,61.951782l4.986647-2.554776,6.233709,10.692307c-3.537413-2.984742-7.290209-5.705459-11.220357-8.137531ZM212.434853,87.00452c-3.609875-4.958223-7.671734-9.539525-12.114318-13.683855l5.420216-2.459895,6.694101,16.14375ZM214.557061,64.905498l-7.876709,3.574845-5.204433-12.550489c4.562686,2.685687,8.928805,5.686643,13.081141,8.975645ZM199.678788,70.605152v-14.362833l5.379782,12.97385-5.379782,2.44168v-1.052697ZM197.891666,68.609252l-5.840575-10.022937,5.840575-2.990947v13.013884ZM197.607825,53.746994l-6.453497,3.298009-5.046298-8.64196c3.946561,1.568536,7.785031,3.350253,11.499795,5.343952ZM189.563773,57.861699l-4.083878,2.088179v-9.095547l4.083878,7.007368Z" fill="#2f358f" /><path d="M127.937829,166.289964c-10.585831-2.582335-20.584901-5.021472-29.322316-5.021472-9.181107,0-15.368651,1.106629-21.918996,2.277967-7.197471,1.287572-14.640634,2.618883-26.59376,2.618883-5.36455,0-9.724906-.150884-13.356233-.403437-.344873-.023985-.459818.449012-.141973.583996,17.569144,7.461365,39.738407,11.296142,63.59603,9.967087,13.765196-.768058,26.776462-3.183435,38.515127-6.886747.299052-.094345.275171-.5212-.030972-.589561-3.616901-.807647-7.199053-1.681437-10.746907-2.546715Z" fill="#2f358f" /><g><polygon points="117.076037 0 109.713855 0 109.713855 12.241638 117.076037 12.700073 117.076037 0" fill="#472e13" /><path d="M76.861194,126.408936c.278564.098877.556274.19812.818481.305847,0,0,0,.000061.000122.000061,2.165405.889954,3.907959,3.220825,4.983032,6.391052.629761-2.893127,1.611328-5.246155,2.836304-6.790161-.307251-.03064-.615112-.05719-.921875-.081482-1.039185-.082214-2.0625-.128601-2.976196-.13324-.696777.003723-1.458252.031799-2.240967.081116-.824585.052002-1.672852.127625-2.498901.226807Z" fill="#472e13" /><path d="M193.883044,116.598938c-16.907959,13.666443-44.672363,23.766663-76.807007,26.495361v-32.647583c-2.452515.04425-4.912476.203979-7.362183.471985v32.676819c-2.376953.133728-6.096069.341919-10.003784.560913.141235-1.057739.217407-2.168274.217407-3.312439,0-6.031128-2.086182-11.135864-4.951416-12.313721-.29834-.122864-.616943-.233765-.934082-.346252-1.518799,2.42926-2.713379,6.973145-2.713379,12.657166,0,1.325134.067139,2.585022.186035,3.773987-.681396.038452-1.337402.07489-1.964844.110107-.119263-1.238647-.18457-2.53656-.18457-3.884094,0-5.546326,1.0625-10.288391,2.765137-13.258911-.947998-.260986-1.960815-.500427-3.050171-.733032-.361084-.077637-.74939-.147278-1.146606-.213745-2.104126,1.453247-4.086182,6.883057-4.086182,14.205688,0,1.481262.084473,2.880066.231445,4.189148-.858398.047241-1.714355.088501-2.567871.124512.241821-1.347961.373047-2.800354.373047-4.310852,0-6.031128-2.086182-11.135864-4.951416-12.313721-.298096-.122864-.616943-.233765-.933838-.346252-1.519043,2.42926-2.713623,6.973145-2.713623,12.657166,0,1.594543.096924,3.095459.265869,4.489014-.659424.001587-1.318726.003235-1.974487-.001587-.161011-1.420044-.254639-2.916504-.254639-4.487427,0-5.546326,1.062134-10.288391,2.764771-13.258911-.947632-.260986-1.960938-.500427-3.049805-.733032-.361572-.077637-.749512-.147278-1.146973-.213745-2.10376,1.453247-4.085938,6.883057-4.085938,14.205688,0,1.550903.093262,3.010193.253418,4.371704-.666504-.023621-1.328369-.055603-1.990845-.08606-.146118-1.358765-.226196-2.791199-.226196-4.285645,0-6.419067,1.423218-11.762024,3.615479-14.525574-1.348389-.134094-2.715088-.208557-3.898193-.214966-1.689453.009216-3.753174.155701-5.601562.420349-2.167725,1.265076-4.261475,6.794556-4.261475,14.32019,0,1.239868.061523,2.41925.166016,3.540588-.667725-.067627-1.332764-.139282-1.995239-.214172-.08728-1.069275-.134155-2.17981-.134155-3.326416,0-5.826172,1.172241-10.764771,3.027832-13.694458-1.715088.40033-3.242432.834717-4.575928,1.383545-2.865234,1.177856-4.951416,6.282593-4.951416,12.313721,0,.843933.044922,1.666992.123291,2.466919-5.235596-.791504-10.272705-1.804749-15.070801-3.021423l48.580078-51.651184c.465698-2.656433.876465-5.461426,1.207886-8.448181l-55.144531,58.630554c-8.934448-2.652283-16.911255-6.042358-23.629761-10.037354-.656128-.389954-1.460815.215393-1.269043.953979,2.042969,7.856689,6.677734,15.077271,13.333008,21.380249L.08446,165.234375c-.190186.202148-.036499.530457.240234.511597,1.894287-.128113,3.914795-.207764,6.100342-.227356.08252-.000793.162842-.034851.21936-.095276l10.40564-11.063049c2.852539,2.315979,5.994751,4.486206,9.397217,6.492371.082886.048828.171753.083618.266235.103271,4.864136,1.012878,11.694458,1.835144,24.053345,1.835144,11.562256,0,18.79834-1.303894,25.796387-2.565002,6.654053-1.199829,12.938965-2.33197,22.353394-2.33197,9.080933,0,19.197876,2.486511,29.908569,5.118347,5.621704,1.381592,11.331299,2.781616,17.11145,3.893311,27.986206-10.680298,47.218628-29.093933,49.342041-49.550171.079224-.759033-.801514-1.236267-1.39563-.756653Z" fill="#472e13" /></g><path d="M80.709601,72.796379c1.617078-26.166145-8.086302-47.600217-13.614944-57.507311-1.424373-2.552416.538073-5.668651,3.446589-5.487486l61.662918,3.840856c13.460401.838421,24.94742,10.782061,27.714598,49.348087,1.489788,20.763103-3.959946,44.681273-7.801851,58.442907-.814347,2.916975-4.761979,3.493121-6.283116.876853-3.110924-5.35061-9.650344-10.914775-23.364332-11.768991-17.742806-1.105163-36.990592,5.35933-48.371544,10.062521-2.777724,1.147898-5.441761-1.805454-4.048744-4.477357,4.225818-8.105408,9.344013-22.029063,10.660424-43.33008Z" fill="#c4942c" /><g><g><path d="M89.492411,250.036889c-.394929,0-.727614.139513-.989469.414246-.261855.272587-.392783.596687-.392783.968006,0,.002146,0,.057952-.083708.208196-.053659.092293-.143806.171708-.287611.244684-.173855.107318-.382051.139513-.650345.105171-.287611-.038634-.616004-.156684-.970152-.347709l-.418539-.238245c-.553759-.319807-1.068884-.585955-1.530351-.789858-.485076-.214635-.98303-.349856-1.478838-.403515-.497954-.057952-1.043128-.027903-1.611912.081561-.225367.045073-.463613.103025-.716882.180294.626735-.50654,1.438057-1.002347,2.421088-1.485277.384197-.191026.811322-.392783,1.281374-.600979.635321-.283319,1.326447-.603126,2.066939-.965859.75337-.367027,1.468106-.828493,2.122744-1.367228.66537-.54732,1.223422-1.201958,1.661278-1.946743.444295-.761956.669663-1.669864.669663-2.695821,0-.931518-.18244-1.80723-.538735-2.605674-.358441-.798444-.864981-1.493863-1.504594-2.069086-.64176-.577369-1.408008-1.034543-2.277282-1.358642-.87142-.328392-1.835133-.493662-2.865383-.493662-1.704205,0-3.165873.448588-4.344221,1.335032-1.178349.886444-2.032598,2.169964-2.539137,3.822657-.107318.36488-.079415.721175.083708,1.051714.165269.345563.440003.577369.815615.686833.369173.107318.725468.075122,1.060299-.098732.34127-.178147.568784-.455027.678248-.8242.650345-2.157086,2.039037-3.206653,4.245489-3.206653.652492,0,1.262056.096586,1.809377.287611.54732.191026,1.017372.452881,1.401569.781273.379905.321953.680394.716882.892883,1.171909.208196.452881.315514.963713.315514,1.519619,0,.53015-.115903,1.004494-.345563,1.405862-.238245.418539-.575223.80059-.998055,1.133275-.442149.347709-.970152.680394-1.564692.987323-.637467.326246-1.298544.643906-1.963914.940103-.244684.107318-.489369.212489-.725468.319807-.242538.107318-.472198.214635-.68898.321953-.579516.298343-1.201958.652492-1.850157,1.051714-.656784.405661-1.268495.890737-1.817962,1.438057-.555906.558052-1.021665,1.201958-1.382252,1.916694-.369173.727614-.555906,1.556107-.555906,2.457576,0,.540881.242538.955128.676102,1.178349.362734.246831.867127.285465,1.365081.038634,1.010933-.558052,1.832987-.970152,2.438259-1.227715.598833-.251123,1.111812-.394929,1.526058-.424978.397076-.040781.770541.025756,1.105372.173855.373466.163123.80059.379905,1.298544.654638l.431417.268294c.512979.294051,1.004494.493662,1.461667.596687.382051.085854.7362.128781,1.051714.128781.062244,0,.122342-.002146.180294-.004293.373466-.019317.695419-.075122.98303-.171708.283319-.09444.525857-.199611.719029-.315514.491515-.304782.899322-.716882,1.210544-1.225568.315514-.517271.476491-1.062445.476491-1.620498,0-.369173-.133074-.695419-.392783-.965859-.264002-.27688-.588101-.416393-.963713-.416393Z" fill="#c4942c" /><path d="M107.511056,237.641693v-.002146c-.693272-.890737-1.53679-1.590449-2.506942-2.077671-.972299-.493662-2.064793-.742639-3.249581-.742639-1.214837,0-2.328794.240392-3.311825.71259-.98303.474344-1.828694,1.156885-2.509088,2.030451-.680394.87142-1.206251,1.940304-1.562546,3.176604-.358441,1.234154-.538735,2.627138-.538735,4.140318,0,1.496009.180294,2.876115.538735,4.099537.358441,1.229861.888591,2.298746,1.575424,3.176604.693272.884298,1.541082,1.575424,2.524113,2.056207.980884.480783,2.08411.725468,3.283922.725468,1.216983,0,2.326648-.240392,3.298947-.71259.974445-.474344,1.813669-1.156885,2.49621-2.028305.678248-.87142,1.204105-1.942451,1.564692-3.178751.358441-1.232007.538735-2.624991.538735-4.138171,0-1.472399-.186733-2.839627-.551613-4.063049-.369173-1.219129-.903615-2.288014-1.590449-3.174458ZM101.754533,252.331342c-.980884,0-1.813669-.214635-2.474747-.64176-.673955-.431417-1.227715-1.002347-1.639815-1.691327-.424978-.701858-.731907-1.502448-.91864-2.380307-.188879-.892883-.283319-1.813669-.283319-2.738748,0-.369173.021464-.817761.066537-1.337179.040781-.519418.126635-1.064592.257563-1.620498.126635-.555906.311221-1.111812.549467-1.654839.233953-.532296.549467-1.010933.937957-1.425179.386344-.409954.873566-.75337,1.446643-1.019518.566638-.264002,1.25991-.397076,2.058354-.397076.95942,0,1.78362.223221,2.446844.66537.673955.450734,1.227715,1.038836,1.644107,1.744986.422832.721175.72976,1.528204.916493,2.397478.188879.882152.283319,1.772889.283319,2.646455,0,.294051-.017171.686833-.051513,1.180495-.034342.485076-.113757,1.013079-.231806,1.568985-.118049.553759-.296197,1.118251-.525857,1.680595-.227514.551613-.538735,1.058153-.931518,1.506741-.384197.444295-.87142.811322-1.453082,1.094641-.573077.279026-1.277081.420685-2.096988.420685Z" fill="#c4942c" /><path d="M124.793501,250.451135c-.261855.272587-.392783.596687-.392783.968006,0,.002146,0,.057952-.083708.208196-.053659.092293-.143806.171708-.287611.244684-.173855.107318-.384197.139513-.650345.105171-.287611-.038634-.616004-.156684-.970152-.347709l-.418539-.238245c-.553759-.319807-1.068884-.585955-1.530351-.789858-.485076-.214635-.98303-.349856-1.478838-.403515-.495808-.057952-1.045275-.027903-1.611912.081561-.225367.045073-.463613.103025-.716882.180294.626735-.50654,1.438057-1.002347,2.421088-1.485277.384197-.191026.811322-.392783,1.281374-.600979.635321-.283319,1.326447-.603126,2.066939-.965859.75337-.367027,1.468106-.828493,2.122744-1.367228.66537-.54732,1.223422-1.201958,1.661278-1.946743.444295-.761956.669663-1.669864.669663-2.695821,0-.931518-.18244-1.80723-.538735-2.605674-.358441-.798444-.864981-1.493863-1.504594-2.069086-.64176-.577369-1.408008-1.034543-2.277282-1.358642-.87142-.328392-1.835133-.493662-2.865383-.493662-1.704205,0-3.165873.448588-4.344221,1.335032-1.178349.886444-2.032598,2.169964-2.539137,3.822657-.107318.36488-.079415.721175.083708,1.051714.165269.345563.440003.577369.815615.686833.369173.107318.727614.075122,1.060299-.098732.34127-.178147.568784-.455027.678248-.8242.650345-2.157086,2.039037-3.206653,4.245489-3.206653.652492,0,1.262056.096586,1.809377.287611.54732.191026,1.017372.452881,1.401569.781273.379905.321953.680394.716882.892883,1.171909.208196.452881.315514.963713.315514,1.519619,0,.53015-.115903,1.004494-.345563,1.405862-.238245.418539-.575223.80059-.998055,1.133275-.442149.347709-.970152.680394-1.564692.987323-.637467.326246-1.298544.643906-1.963914.940103-.244684.107318-.489369.212489-.725468.319807-.242538.107318-.472198.214635-.68898.321953-.579516.298343-1.201958.652492-1.850157,1.051714-.656784.405661-1.268495.890737-1.817962,1.438057-.555906.558052-1.021665,1.201958-1.382252,1.916694-.369173.727614-.555906,1.556107-.555906,2.457576,0,.540881.242538.955128.676102,1.178349.362734.246831.867127.285465,1.365081.038634,1.010933-.558052,1.832987-.970152,2.438259-1.227715.598833-.251123,1.111812-.394929,1.526058-.424978.399222-.040781.770541.025756,1.105372.173855.373466.163123.80059.379905,1.298544.654638l.431417.268294c.512979.294051,1.004494.493662,1.461667.596687.382051.085854.7362.128781,1.051714.128781.062244,0,.122342-.002146.180294-.004293.373466-.019317.695419-.075122.98303-.171708.283319-.09444.525857-.199611.719029-.315514.491515-.304782.899322-.716882,1.210544-1.225568.315514-.517271.476491-1.062445.476491-1.620498,0-.369173-.133074-.695419-.392783-.965859-.540881-.566638-1.440204-.536589-1.953182-.002146Z" fill="#c4942c" /><path d="M144.170788,246.75726c-.072976-.418539-.193172-.84781-.356295-1.279227-.165269-.433564-.377758-.856395-.628882-1.25991-.261855-.416393-.588101-.802737-.970152-1.150446-1.268495-1.176202-2.90831-1.682742-4.874371-1.523912-.766249.055805-1.528204.244684-2.26655.564491-.592394.255416-1.257764.622443-1.981085,1.090348.021464-.223221.042927-.429271.068683-.620296.042927-.336978.081561-.598833.115903-.787712.152391-.809176.386344-1.496009.693272-2.03689.309075-.540881.673955-.985177,1.083909-1.322154.409954-.336978.845664-.583808,1.296398-.72976.455027-.148098.910054-.223221,1.352203-.223221.680394,0,1.249178.090147,1.689181.270441.442149.178147.80059.392783,1.066738.633175.261855.238245.452881.480783.57093.719029.152391.319807.208196.485076.236099.588101.109464.330539.321953.583808.633175.751224.309075.167416.639614.195318.974445.083708.354148-.109464.613857-.3241.772688-.639614.154538-.313368.176001-.64176.066537-.968006-.145952-.478637-.371319-.950835-.691126-1.44235-.31766-.48293-.72976-.91864-1.225568-1.294252-.491515-.375612-1.083909-.684687-1.762157-.925079-.676102-.236099-1.459521-.356295-2.330941-.356295-.880005,0-1.712791.156684-2.476893.467905-.770541.311221-1.463814.751224-2.062647,1.304983-.603126.560198-1.116104,1.242739-1.521765,2.028305s-.701858,1.665571-.882152,2.620699c-.053659.304782-.122342.761956-.199611,1.37152-.081561.622443-.130928,1.332886-.148098,2.114159-.017171.796297.019317,1.650547.107318,2.539137.088001.903615.287611,1.798645.590247,2.657187.510832,1.545375,1.347911,2.743041,2.489771,3.565095,1.137568.822054,2.528405,1.238446,4.129586,1.238446,1.058153,0,2.008988-.203904,2.824602-.607418.811322-.401368,1.502448-.933664,2.054061-1.586156.54732-.648199.968006-1.390838,1.249178-2.210745.281172-.815615.422832-1.652693.422832-2.489771,0-.354148-.036488-.742639-.109464-1.154739ZM137.729579,252.251927c-1.040982,0-1.923134-.261855-2.620699-.77698-.697565-.517271-1.227715-1.285666-1.575424-2.275136-.152391-.474344-.270441-.963713-.347709-1.450936-.066537-.429271-.120196-.882152-.156684-1.347911.946542-.742639,1.78362-1.302837,2.489771-1.661278.710443-.360588,1.39513-.575223,2.021866-.64176,1.255617-.098732,2.217184.186733,2.95553.875713.437856.405661.751224.886444.927225,1.427326.184586.560198.27688,1.068884.27688,1.511033,0,.427125-.07083.907908-.212489,1.429472-.141659.510832-.371319.987323-.682541,1.414448-.311221.424978-.725468.783419-1.234154,1.071031-.497954.281172-1.118251.424978-1.841572.424978Z" fill="#c4942c" /></g><g><path d="M38.347399,223.204608c-.543654,0-1.003189-.188487-1.373932-.565462-.373859-.376975-.559231-.839625-.559231-1.391068v-28.120439c0-.521845.18693-.978265.563904-1.369259.376975-.390994.841183-.58727,1.391068-.58727h11.039749c1.478301,0,2.86158.28351,4.151394.848972,1.288256.563904,2.411392,1.325642,3.367848,2.280541.956456.956456,1.716637,2.08738,2.282099,3.391214.565462,1.303834.847414,2.693344.847414,4.171645s-.281952,2.86158-.847414,4.151394-1.325642,2.411392-2.282099,3.367848c-.956456.956456-2.079592,1.716637-3.367848,2.282099-1.289814.565462-2.673093.847414-4.151394.847414-.549885,0-1.021882-.188487-1.412876-.565462-.390994-.375417-.585713-.839625-.585713-1.391068,0-.549885.194718-1.014093.585713-1.38951.390994-.376975.862992-.565462,1.412876-.565462.926859,0,1.796082-.180699,2.607668-.543654.811586-.361397,1.521918-.847414,2.129439-1.456493.609079-.607521,1.087307-1.317854,1.434684-2.129439.347377-.810028.521845-1.679251.521845-2.607668,0-.926859-.174468-1.80387-.523403-2.629476-.348935-.825606-.828721-1.542169-1.4378-2.151248-.610637-.609079-1.322527-1.087307-2.13567-1.434684s-1.685482-.521845-2.615456-.521845h-9.108144v26.12185c0,.551442-.18693,1.014093-.559231,1.391068-.372301.376975-.830279.565462-1.37549.565462Z" fill="#2f358f" /><path d="M124.497933,223.290284c-.841183,0-1.585786-.115273-2.238482-.347377-.651138-.230546-1.339662-.766411-2.064014-1.607594-.319338-.347377-.746161-.91907-1.282025-1.716637-.537423-.797566-1.180772-1.746234-1.934721-2.847561-.405014-.579482-.775758-1.099769-1.107558-1.563977-.333358-.464208-.573251-.811586-.718121-1.04369l-.17291-.260144c-.376975-.492248-.710332-.847414-1.000073-1.065499-.289741-.216527-.767969-.325569-1.434684-.325569-.549885,0-1.020324-.188487-1.411318-.565462-.392552-.375417-.58727-.839625-.58727-1.391068,0-.549885.194718-1.020324.58727-1.411318.390994-.392552.861434-.58727,1.411318-.58727.926859,0,1.80387-.180699,2.629476-.543654.827163-.361397,1.543727-.847414,2.152806-1.456493.607521-.607521,1.09198-1.317854,1.454935-2.129439.362955-.810028.543654-1.679251.543654-2.607668,0-.926859-.180699-1.80387-.543654-2.629476-.362955-.825606-.847414-1.542169-1.454935-2.151248-.609079-.609079-1.325642-1.093538-2.152806-1.456493-.825606-.361397-1.702617-.542096-2.629476-.542096h-9.126837v26.29476c0,.549885-.188487,1.014093-.565462,1.391068-.376975.375417-.839625.563904-1.38951.563904-.551442,0-1.021882-.188487-1.412876-.563904-.390994-.376975-.58727-.841183-.58727-1.391068v-28.294907c0-.549885.196276-1.014093.58727-1.391068.390994-.375417.861434-.563904,1.412876-.563904h11.081808c1.478301,0,2.869369.281952,4.173203.847414,1.303834.563904,2.440989,1.331873,3.411465,2.302349.970476.972034,1.738445,2.109189,2.303907,3.413023s.847414,2.694901.847414,4.171645c0,2.000146-.500037,3.818037-1.50011,5.455228-.998515,1.637192-2.324158,2.919217-3.976927,3.846076.087234.116831.188487.260144.305318.434611l.17291.218085c.202507.260144.478228.637118.825606,1.129366.348935.493806.724352,1.04369,1.130924,1.651211.260144.376975.535865.781989.825606,1.218158.289741.434611.571693.847414.847414,1.238408s.521845.746161.738372,1.063941c.218085.319338.398783.551442.543654.696313.261701.289741.4424.45642.543654.500037.101254.042059.355166.063868.76018.063868.549885,0,1.014093.196276,1.391068.58727s.565462.862992.565462,1.412876-.188487,1.014093-.565462,1.391068c-.376975.375417-.841183.563904-1.391068.563904Z" fill="#2f358f" /><path d="M150.084842,191.17111c.549885,0,1.006304.182256,1.367701.543654.362955.362955.543654.819375.543654,1.369259,0,.521845-.180699.972034-.543654,1.347451-.361397.376975-.817817.565462-1.367701.565462h-9.344921v26.076676c0,.551442-.183814,1.007862-.549885,1.369259-.36607.362955-.827163.543654-1.384837.543654-.528076,0-.98138-.180699-1.363028-.543654-.38009-.361397-.570135-.817817-.570135-1.369259v-26.076676h-9.344921c-.521845,0-.972034-.188487-1.347451-.565462-.376975-.375417-.565462-.825606-.565462-1.347451,0-.549885.188487-1.006304.565462-1.369259.375417-.361397.825606-.543654,1.347451-.543654h22.557727Z" fill="#2f358f" /><path d="M93.807791,200.972406c-.841034-1.954977-1.991879-3.657523-3.454969-5.106318-1.464307-1.448694-3.173137-2.593558-5.128115-3.433274-1.956194-.841135-4.036069-1.261753-6.237192-1.261753-1.942406,0-3.782218.327147-5.520651.9783-1.738433.652673-3.302091,1.557777-4.693405,2.716733-.059205.059205-.101378.087185-.130981.087185l-.172748.172951c-1.710453,1.478297-3.057972,3.254139-4.042151,5.324383-.986207,2.071765-1.4785,4.325808-1.4785,6.758986,0,2.232246.420517,4.318103,1.260334,6.25909.841034,1.940886,1.992284,3.635726,3.454969,5.084421,1.462685,1.450316,3.165433,2.59366,5.107839,3.433274,1.940784.841236,4.012954,1.261854,6.215294,1.261854,1.883607,0,3.650021-.297545,5.302891-.891114,1.651248-.593468,3.171515-1.412807,4.562424-2.456495l.087185-.087287c1.883201-1.476675,3.375488-3.302395,4.476861-5.475436,1.101373-2.173042,1.651248-4.548637,1.651248-7.128306,0-2.201022-.420517-4.280593-1.260334-6.237192ZM90.352823,211.708459c-.024331.061232-.06326.113138-.088402.173762-.223843.538115-.493104,1.050582-.788317,1.546524-.088402.148114-.17437.297849-.268449.441806-.31995.488947-.677612.949204-1.062443,1.386043-.059205.066707-.100973.145072-.161394.210664l-.014598-.017336c-.860498.935315-1.859682,1.738028-2.973625,2.368195l.032847.040247c-.898616.492293-1.847516.877023-2.847511,1.151251-.998372.275647-2.049867.412711-3.149618.412711-1.68085,0-3.260323-.317719-4.738822-.956402-.073803-.031934-.135036-.080596-.208434-.113746-.626923-.277675-1.227487-.603403-1.793583-.978401-.035685-.023621-.073803-.043897-.108677-.067923-1.92943-1.306968-3.463079-3.152558-4.387648-5.32053-.005677-.013686-.015004-.024838-.020681-.038524-.637061-1.476776-.956605-3.05635-.956605-4.7372,0-.828361.08678-1.630263.24493-2.410571.012976-.064071.030413-.126419.044201-.190084.064477-.292476.136658-.58262.223438-.868203.053122-.179034.115571-.353506.176804-.529093.033252-.093572.058394-.18978.094079-.282642.010543-.026257.026358-.04856.036496-.074716.969176-2.528271,2.752621-4.645554,5.03363-6.039707l-.029197-.035584c.927002-.579478,1.926997-1.021892,2.998767-1.325621,1.07177-.305351,2.188552-.456506,3.347508-.456506,1.679228,0,3.259106.319341,4.7372.956503.073803.031833.135036.080494.208028.113544.628545.278182,1.230326.604721,1.797638.980733.034063.022709.070559.041971.104217.064983,1.929835,1.307069,3.46389,3.153065,4.388459,5.321443.005677.013585.015004.024736.021087.038422.636655,1.476776.956199,3.05635.956199,4.737099,0,1.593665-.281831,3.093758-.847522,4.49886Z" fill="#2f358f" /><path d="M182.530989,200.972406c-.841034-1.954977-1.991879-3.657523-3.454969-5.106318-1.464307-1.448694-3.173137-2.593558-5.128115-3.433274-1.956194-.841135-4.036069-1.261753-6.237192-1.261753-1.942406,0-3.782218.327147-5.520651.9783-1.738433.652673-3.302091,1.557777-4.693405,2.716733-.059205.059205-.101378.087185-.130981.087185l-.172748.172951c-1.710453,1.478297-3.057972,3.254139-4.042151,5.324383-.986207,2.071765-1.4785,4.325808-1.4785,6.758986,0,2.232246.420517,4.318103,1.260334,6.25909.841034,1.940886,1.992284,3.635726,3.454969,5.084421,1.462685,1.450316,3.165433,2.59366,5.107839,3.433274,1.940784.841236,4.012954,1.261854,6.215294,1.261854,1.883607,0,3.650021-.297545,5.302891-.891114,1.651248-.593468,3.171515-1.412807,4.562424-2.456495l.087185-.087287c1.883201-1.476675,3.375488-3.302395,4.476861-5.475436,1.101373-2.173042,1.651248-4.548637,1.651248-7.128306,0-2.201022-.420517-4.280593-1.260334-6.237192ZM179.07602,211.708459c-.024331.061232-.06326.113138-.088402.173762-.223843.538115-.493104,1.050582-.788317,1.546524-.088402.148114-.17437.297849-.268449.441806-.31995.488947-.677612.949204-1.062443,1.386043-.059205.066707-.100973.145072-.161394.210664l-.014598-.017336c-.860498.935315-1.859682,1.738028-2.973625,2.368195l.032847.040247c-.898616.492293-1.847516.877023-2.847511,1.151251-.998372.275647-2.049867.412711-3.149618.412711-1.68085,0-3.260323-.317719-4.738822-.956402-.073803-.031934-.135036-.080596-.208434-.113746-.626923-.277675-1.227487-.603403-1.793583-.978401-.035685-.023621-.073803-.043897-.108677-.067923-1.92943-1.306968-3.463079-3.152558-4.387648-5.32053-.005677-.013686-.015004-.024838-.020681-.038524-.637061-1.476776-.956605-3.05635-.956605-4.7372,0-.828361.08678-1.630263.24493-2.410571.012976-.064071.030413-.126419.044201-.190084.064477-.292476.136658-.58262.223438-.868203.053122-.179034.115571-.353506.176804-.529093.033252-.093572.058394-.18978.094079-.282642.010543-.026257.026358-.04856.036496-.074716.969176-2.528271,2.752621-4.645554,5.03363-6.039707l-.029197-.035584c.927002-.579478,1.926997-1.021892,2.998767-1.325621,1.07177-.305351,2.188552-.456506,3.347508-.456506,1.679228,0,3.259106.319341,4.7372.956503.073803.031833.135036.080494.208028.113544.628545.278182,1.230326.604721,1.797638.980733.034063.022709.070559.041971.104217.064983,1.929835,1.307069,3.46389,3.153065,4.388459,5.321443.005677.013585.015004.024736.021087.038422.636655,1.476776.956199,3.05635.956199,4.737099,0,1.593665-.281831,3.093758-.847522,4.49886Z" fill="#2f358f" /></g></g></svg>`;

  const applyCustomLogo = () => {
    if (appLogoContainer) {
      appLogoContainer.innerHTML = DEFAULT_LOGO_SVG;
    }
  };

  const handleAdminFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      
      try {
        const parsed = JSON.parse(text);
        if (!parsed.keysTable || !parsed.payloadCt) {
          throw new Error();
        }
      } catch (err) {
        alert('Ficheiro inválido! Certifique-se de que exportou o ficheiro encriptado correto (.enc) da área administrativa.');
        return;
      }

      // Save locally
      localStorage.setItem('porto2026_global_enc', text);
      localStorage.removeItem('porto2026_global_enc_version'); // Invalidate version key to trigger fresh HEAD fetch
      encryptedText = text;
      
      // Enable login page fields
      loginPhone.disabled = false;
      btnLogin.disabled = false;
      updateLoginStatus('Base de dados carregada pelo administrador! Introduza o número de telemóvel.', 'info');
      
      updateAdminPanelUI();
      alert('Ficheiro carregado com sucesso! Agora todos os voluntários podem aceder à escala usando apenas o seu número de telemóvel.');

      // Try quietly to upload to server if hosted
      if (window.location.protocol !== 'file:') {
        try {
          await fetch('./upload_enc.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: text })
          });
          console.log("Uploaded successfully to the server disk.");
        } catch (err) {
          console.warn("Could not write directly to server disk, saved only in browser localStorage.");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleAdminClearDb = () => {
    if (confirm('Tem a certeza de que deseja apagar a base de dados de escalas deste dispositivo? Os voluntários não conseguirão fazer login até que seja feito um novo upload.')) {
      localStorage.removeItem('porto2026_global_enc');
      encryptedText = null;
      
      loginPhone.value = '';
      loginPhone.disabled = true;
      btnLogin.disabled = true;
      updateLoginStatus('⚠️ Nenhuma base de dados ativa. Aceda ao Painel de Administração para carregar as escalas.', 'danger');
      
      updateAdminPanelUI();
      adminPanelModal.classList.remove('open');
      alert('Base de dados apagada com sucesso.');
    }
  };

  const updateLoginStatus = (msg, type) => {
    loginStatusMsg.className = `alert alert-${type}`;
    loginStatusMsg.textContent = msg;
  };

  const showDashboard = () => {
    // Hide login, show dashboard
    pageLogin.classList.remove('active');
    pageDashboard.classList.add('active');

    // Populate user profile info
    const hr = new Date().getHours();
    let greeting = 'Olá';
    if (hr >= 5 && hr < 12) greeting = 'Bom dia';
    else if (hr >= 12 && hr < 20) greeting = 'Boa tarde';
    else greeting = 'Boa noite';

    const firstName = currentUser.fullName.trim().split(' ')[0];
    userName.textContent = `${greeting}, ${firstName}! 👋`;
    if (userAvatar) {
      userAvatar.textContent = currentUser.fullName.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
    }

    // Map DB Role label
    const r = String(currentUser.responsibility || '').toUpperCase();
    let roleText = 'Indicador';
    if (r === 'RD') roleText = 'Responsável de Departamento';
    else if (r === 'CAP') roleText = 'Capitão';
    else if (r === 'KM') roleText = 'Homem-Chave';
    else if (r.includes('TORNI')) roleText = 'Torniquetes';
    else if (currentUser.isSister || r === 'IRM') roleText = 'Irmã';
    userRoleBadge.textContent = roleText + " [Responsibility: " + (currentUser.responsibility || "N/A") + " | isUsher: " + currentUser.isUsher + " | isSister: " + currentUser.isSister + " | id: " + currentUser.id + "]";

    detectScaleChanges(db);
    renderRoleDashboard();
    startBackgroundSync();
  };

  const performSilentSyncCheck = async () => {
    if (window.location.protocol === 'file:' || !currentUser || !currentUser.phone) return;

    // Throttle checks to at most once every 5 minutes (300000ms) to protect server & save data
    const now = Date.now();
    if (now - lastSyncCheckTime < 300000) return;
    lastSyncCheckTime = now;

    try {
      const nocacheUrl = './porto2026_mobile.enc?_nocache=' + now;
      
      // 1. Perform a lightweight HEAD request first
      const headRes = await fetch(nocacheUrl, { method: 'HEAD' });
      if (!headRes.ok) return;
      
      const newVersion = headRes.headers.get('ETag') || headRes.headers.get('Last-Modified') || headRes.headers.get('Content-Length');
      const savedVersion = localStorage.getItem('porto2026_global_enc_version');
      
      if (savedVersion && newVersion === savedVersion) {
        // No changes on server, save bandwidth!
        return;
      }

      // 2. Fetch the full file only if version changed
      const res = await fetch(nocacheUrl);
      if (!res.ok) return;
      const text = await res.text();
      
      const savedGlobalEnc = localStorage.getItem('porto2026_global_enc');
      if (text && text !== savedGlobalEnc) {
        // A new scales file exists! Decrypt it silently in the background
        const decryptedText = await decryptContainer(text, currentUser.phone);
        const parsedDb = JSON.parse(decryptedText);
        
        const newMe = parsedDb.volunteers.find(v => String(v.id) === String(currentUser.id));
        if (newMe) {
          // Detect scale changes before silently updating database cache
          detectScaleChanges(parsedDb);

          db = parsedDb;
          currentUser = newMe;
          
          // Silently cache updated version
          localStorage.setItem(CACHE_KEY_DB, JSON.stringify(db));
          localStorage.setItem(CACHE_KEY_USER, JSON.stringify(currentUser));
          
          // Also store the raw global text so that subsequent page refreshes don't sync
          localStorage.setItem('porto2026_global_enc', text);
          if (newVersion) {
            localStorage.setItem('porto2026_global_enc_version', newVersion);
          }
          
          // Re-render user dashboard immediately with alterations highlighted!
          renderRoleDashboard();
          console.log("Dashboard silently synchronized with latest GitHub scales update!");
        }
      }
    } catch (err) {
      console.warn("Silent background sync skipped", err);
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      performSilentSyncCheck();
    }
  };

  const startBackgroundSync = () => {
    // Perform checking when app becomes active/visible
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also perform a check right now upon dashboard display
    performSilentSyncCheck();
  };

  // Observations Popups inside mobile PWA
  const openRemarksModal = (name, remarks) => {
    document.getElementById('obsModalText').textContent = remarks;
    obsModal.classList.add('open');
  };

  // Helper to synchronously detect shifts added or altered compared to a previously cached database
  const detectScaleChanges = (newDb) => {
    if (!newDb || !currentUser) return;
    try {
      const keyLastAssigns = `porto2026_last_assignments_${currentUser.id}`;
      const oldAssignsStr = localStorage.getItem(keyLastAssigns);
      
      const newAssigns = newDb.assignments.filter(a => String(a.volunteerId) === String(currentUser.id));
      
      if (oldAssignsStr) {
        const oldAssigns = JSON.parse(oldAssignsStr);
        newAssigns.forEach(a => {
          const oldA = oldAssigns.find(o => o.shiftId === a.shiftId && o.sectorId === a.sectorId);
          const keyFirstSeen = `porto2026_alert_first_seen_${currentUser.id}_${a.id}`;
          if (!oldA) {
            // Assignment is completely NEW!
            if (!localStorage.getItem(keyFirstSeen)) {
              localStorage.setItem(keyFirstSeen, Date.now().toString());
              localStorage.setItem(keyFirstSeen + '_type', 'new');
            }
          } else if (a.role !== oldA.role || a.updatedAt !== oldA.updatedAt) {
            // Assignment was ALTERED!
            if (!localStorage.getItem(keyFirstSeen)) {
              localStorage.setItem(keyFirstSeen, Date.now().toString());
              localStorage.setItem(keyFirstSeen + '_type', 'altered');
            }
          }
        });
      }
      
      // Save current assignments as the last seen ones for the next comparison
      localStorage.setItem(keyLastAssigns, JSON.stringify(newAssigns));
    } catch (err) {
      console.warn("detectScaleChanges error", err);
    }
  };

  // Helper to check if a shift has been completed (past its date and end time)
  const isShiftCompleted = (a) => {
    if (!db || !db.shifts) return false;
    const sh = db.shifts.find(s => s.id === a.shiftId);
    if (!sh) return false;
    const shiftEnd = new Date(`${sh.date}T${sh.endTime}:00`);
    return !isNaN(shiftEnd.getTime()) && Date.now() > shiftEnd.getTime();
  };

  // Helper to render a "done" check icon on the bottom right corner of completed shifts
  const getCompletedBadgeHtml = (a) => {
    if (isShiftCompleted(a)) {
      return `
        <span style="position: absolute; bottom: 12px; right: 16px; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: #0284c7; color: white; border-radius: 50%; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35); pointer-events: none;" title="Concluído">
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
            <polyline points="1.5 4 4 6 8.5 1.5"></polyline>
          </svg>
        </span>
      `;
    }
    return '';
  };

  // Helper to synchronously fetch CSS class names for completed or newly alert shifts
  const getCardClass = (a) => {
    if (isShiftCompleted(a)) {
      return 'completed';
    }
    if (!currentUser) return '';
    const key = `porto2026_alert_first_seen_${currentUser.id}_${a.id}`;
    const firstSeen = localStorage.getItem(key);
    if (firstSeen) {
      const elapsed = Date.now() - parseInt(firstSeen);
      if (elapsed < 3600000) {
        const type = localStorage.getItem(key + '_type') || 'new';
        if (type === 'new') {
          return 'new-alert';
        }
      }
    }
    return '';
  };

  // Helper to determine and track shift change badges (remains active for 1 hour since first visualized)
  const getChangeBadgeHtml = (a, sessionStart) => {
    if (!currentUser) return '';
    const key = `porto2026_alert_first_seen_${currentUser.id}_${a.id}`;
    const firstSeen = localStorage.getItem(key);
    if (firstSeen) {
      const elapsed = Date.now() - parseInt(firstSeen);
      if (elapsed < 3600000) { // 1 hour in ms
        const type = localStorage.getItem(key + '_type') || 'new';
        if (type === 'altered') {
          return `<span class="badge-change altered">Alterado</span>`;
        } else {
          // Yellow box with dark yellow letters and a bell icon
          return `<span class="badge-change new" style="background: rgba(234, 179, 8, 0.15); color: #854d0e; border: 1px solid rgba(234, 179, 8, 0.3);">🔔 Novo</span>`;
        }
      }
    }
    return '';
  };

  // Dashboard Rendering based on user database roles
  const renderRoleDashboard = () => {
    try {
    const oldCarousel = dashboardContent.querySelector('.carousel-wrapper');
    const savedScrollLeft = oldCarousel ? oldCarousel.scrollLeft : 0;
    
    dashboardContent.innerHTML = '';
    
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    const isRd = (currentUser.responsibility === 'RD');
    if (isRd) {
      renderRdView(dashboardContent);
      return;
    }
    
    // Find all assignments for this volunteer
    const assigns = db.assignments.filter(a => String(a.volunteerId) === String(currentUser.id));

    // Dynamic Real-time Countdown Banner Engine
    const nowMs = Date.now();
    const mappedShifts = assigns.map(a => {
      const sh = db.shifts.find(s => s.id === a.shiftId);
      const sec = db.sectors.find(s => s.id === a.sectorId);
      if (!sh || !sec) return null;
      const startDt = new Date(sh.date + 'T' + sh.startTime + ':00');
      const endDt = new Date(sh.date + 'T' + sh.endTime + ':00');
      return { assign: a, shift: sh, sector: sec, startDt, endDt };
    }).filter(Boolean).sort((a, b) => a.startDt - b.startDt);

    const activeShift = mappedShifts.find(u => nowMs >= u.startDt.getTime() && nowMs <= u.endDt.getTime());
    const nextShift = mappedShifts.find(u => u.startDt.getTime() > nowMs);

    // Check if user is Captain or Keyman to disable countdown boxes completely for them
    const isAssignedAsLeader = db.assignments.some(a => String(a.volunteerId) === String(currentUser.id) && (a.role === 'CAP' || a.role === 'KM'));
    const isCap = (currentUser.responsibility === 'CAP' || isAssignedAsLeader);
    const isKm = (currentUser.responsibility === 'KM');
    const isIndicator = !isCap && !isKm;

    if (isIndicator) {
      if (activeShift) {
        const { assign: a, shift: sh, sector: sec } = activeShift;
        const activeCard = document.createElement('div');
        activeCard.className = 'premium-countdown-card mb-4';
        activeCard.innerHTML = `
          <div class="scale-card scale-card-accent active-now" style="padding: 18px 20px; box-shadow: var(--shadow-card); position: relative; overflow: hidden;">
            <div style="position: relative; z-index: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--success); background: rgba(16, 185, 129, 0.08); padding: 3px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(16, 185, 129, 0.15);">
                  <span style="width: 6px; height: 6px; background: var(--success); border-radius: 50%; display: inline-block; animation: pulse-badge 1s infinite;"></span> A Decorrer Agora
                </span>
                <span style="font-size: 12px; font-weight: 700; color: var(--success);">Ativo</span>
              </div>
              <h3 style="font-size: 17px; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">${esc(sec.name)}</h3>
              <p style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 0px; font-weight: 500;">
                📍 <span style="color: var(--danger); font-weight: 800; font-size: 13px;">${esc(sec.subSector || 'Geral')}${a.door ? ` • 🚪 ${esc(a.door)}` : ''}</span> • 🕒 Termina às ${sh.endTime}
              </p>
            </div>
          </div>
        `;
        dashboardContent.appendChild(activeCard);
      }
      
      if (nextShift) {
        const { assign: a, shift: sh, sector: sec, startDt } = nextShift;
        const nextCard = document.createElement('div');
        nextCard.className = 'premium-countdown-card mb-4';
        nextCard.innerHTML = `
          <div class="scale-card scale-card-accent next-shift" style="padding: 18px 20px; box-shadow: var(--shadow-card); position: relative; overflow: hidden;">
            <div style="position: relative; z-index: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary); background: var(--primary-light); padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(124, 58, 237, 0.15);">Próximo Turno</span>
                <span id="countdown-text" style="font-size: 12px; font-weight: 700; color: var(--primary); font-family: monospace;">--h --m --s</span>
              </div>
              <h3 style="font-size: 17px; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">${esc(sec.name)}</h3>
              <p style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 12px; font-weight: 500;">
                📍 <span style="color: var(--danger); font-weight: 800; font-size: 13px;">${esc(sec.subSector || 'Geral')}${a.door ? ` • 🚪 ${esc(a.door)}` : ''}</span> • 📅 ${getWeekDay(sh.date)}, ${formatDate(sh.date)} às ${sh.startTime}
              </p>
              <div style="width: 100%; height: 6px; background: rgba(0, 0, 0, 0.06); border-radius: 3px; overflow: hidden; margin-top: 8px;">
                <div id="countdown-progress" style="width: 100%; height: 100%; background: var(--success); border-radius: 3px; transition: width 1s linear;"></div>
              </div>
            </div>
          </div>
        `;
        dashboardContent.appendChild(nextCard);
      }

        const targetTime = startDt.getTime();
        const referenceMs = 24 * 60 * 60 * 1000; // 24h progress bar window

        const updateCountdown = () => {
          const textEl = document.getElementById('countdown-text');
          const progressEl = document.getElementById('countdown-progress');
          if (!textEl || !progressEl) return;

          const diff = targetTime - Date.now();
          if (diff <= 0) {
            textEl.textContent = 'A começar!';
            progressEl.style.width = '0%';
            clearInterval(countdownInterval);
            setTimeout(renderRoleDashboard, 2000);
            return;
          }

          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);

          let displayText = '';
          if (hours > 0) {
            displayText = `${hours}h ${mins}m ${secs}s`;
          } else {
            displayText = `${mins}m ${secs}s`;
          }
          textEl.textContent = displayText;

          const pct = Math.max(0, Math.min(100, (1 - (diff / referenceMs)) * 100));
          progressEl.style.width = `${pct}%`;
        };

        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
      }
    }
    


    // 1. Find all unique dates across assignments to build the dropdown
    const uniqueDates = [];
    assigns.forEach(a => {
      const sh = db.shifts.find(s => s.id === a.shiftId);
      if (sh && sh.date && !uniqueDates.includes(sh.date)) {
        uniqueDates.push(sh.date);
      }
    });
    uniqueDates.sort();

    // 2. Validate current filter against available unique dates
    if (activeDateFilter !== 'all' && !uniqueDates.includes(activeDateFilter)) {
      activeDateFilter = 'all';
    }

    // 3. Filter assignments based on dropdown select choice
    const filteredAssigns = activeDateFilter === 'all'
      ? assigns
      : assigns.filter(a => {
          const sh = db.shifts.find(s => s.id === a.shiftId);
          return sh && sh.date === activeDateFilter;
        });

    // 4. Render Date Filter Pills (Horizontal Scrolling - Travel App style) if there are multiple days
    if (uniqueDates.length > 1) {
      const filterSection = document.createElement('div');
      filterSection.style.margin = '8px 0 18px 0';
      
      const allActive = activeDateFilter === 'all';
      const allBadge = `<button class="date-pill-btn ${allActive ? 'active' : ''}" data-value="all" style="
        background: ${allActive ? 'var(--primary)' : '#ffffff'};
        color: ${allActive ? 'white' : 'var(--text-secondary)'};
        border: 1.5px solid ${allActive ? 'var(--primary)' : 'rgba(0,0,0,0.08)'};
        font-weight: 700;
        font-size: 13.5px;
        padding: 10px 18px;
        border-radius: 20px;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: ${allActive ? '0 4px 10px rgba(47, 53, 143, 0.15)' : 'none'};
        transition: all 0.2s ease;
      ">
        Todos os Dias (${assigns.length})
      </button>`;

      const pillsHtml = uniqueDates.map(date => {
        const count = assigns.filter(a => {
          const sh = db.shifts.find(s => s.id === a.shiftId);
          return sh && sh.date === date;
        }).length;
        const isActive = activeDateFilter === date;
        
        return `<button class="date-pill-btn ${isActive ? 'active' : ''}" data-value="${date}" style="
          background: ${isActive ? 'var(--primary)' : '#ffffff'};
          color: ${isActive ? 'white' : 'var(--text-secondary)'};
          border: 1.5px solid ${isActive ? 'var(--primary)' : 'rgba(0,0,0,0.08)'};
          font-weight: 700;
          font-size: 13.5px;
          padding: 10px 18px;
          border-radius: 20px;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: ${isActive ? '0 4px 10px rgba(47, 53, 143, 0.15)' : 'none'};
          transition: all 0.2s ease;
        ">
          ${getWeekDay(date)}, ${formatDate(date)} (${count})
        </button>`;
      }).join('');

      filterSection.innerHTML = `
        <div class="carousel-wrapper" style="display:flex; gap:8px; overflow-x:auto; padding: 4px 16px; margin: 0 -16px; -webkit-overflow-scrolling:touch; scrollbar-width:none;">
          ${allBadge}
          ${pillsHtml}
        </div>
      `;
      dashboardContent.appendChild(filterSection);

      // Restore scroll position to prevent returning to start of list
      const newCarousel = filterSection.querySelector('.carousel-wrapper');
      if (newCarousel) {
        newCarousel.scrollLeft = savedScrollLeft;
      }
    }

    // 5. Render dashboard role section
    const roleContentContainer = document.createElement('div');
    roleContentContainer.id = 'roleContentContainer';
    dashboardContent.appendChild(roleContentContainer);



    // We pass filtered assignments to the specific renders!
    if (isKm) {
      renderKeymanView(filteredAssigns, roleContentContainer);
    } else if (isCap) {
      renderCaptainView(filteredAssigns, roleContentContainer);
    } else {
      renderIndicatorView(filteredAssigns, roleContentContainer);
    }

    // 6. Bind Date Pills change listeners
    document.querySelectorAll('.date-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeDateFilter = btn.dataset.value;
        renderRoleDashboard();
      });
    });

    // Bind dynamically rendered events
    document.querySelectorAll('.obs-popup-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRemarksModal(btn.dataset.name, btn.dataset.remarks);
      });
    });

    document.querySelectorAll('.btn-toggle-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.dataset.target;
        const panel = document.getElementById(targetId);
        if (panel) {
          const isHidden = panel.style.display === 'none';
          panel.style.display = isHidden ? 'block' : 'none';
          
          const span = btn.querySelector('span');
          if (span) {
            span.textContent = isHidden ? '👥 Ocultar Equipa' : '👥 Ver Equipa';
          }
          btn.style.background = isHidden ? 'var(--primary)' : 'var(--primary-light)';
          btn.style.color = isHidden ? '#ffffff' : 'var(--primary)';
        }
      });
    });

    document.querySelectorAll('.btn-add-cal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const title = btn.dataset.title;
        const date = btn.dataset.date;
        const start = btn.dataset.start;
        const end = btn.dataset.end;
        const sec = btn.dataset.sec;
        const sub = btn.dataset.sub;
        handleAddToCalendar(title, date, start, end, sec, sub);
      });
    });
    } catch(err) {
      // Fallback for Safari/iOS errors - show content via simpler path
      console.error('renderRoleDashboard error:', err);
      dashboardContent.innerHTML = `<div style="padding:20px;text-align:center;color:var(--danger);font-weight:700;font-size:14px;">⚠️ Erro ao carregar o painel.<br><span style="font-size:12px;font-weight:400;color:var(--text-secondary);">${String(err)}</span><br><br><button onclick="location.reload()" style="background:var(--primary);color:white;border:none;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Recarregar</button></div>`;
    }
  };

  const handleAddToCalendar = (title, dateStr, startTime, endTime, sectorName, subSector) => {
    const parseLocal = (dStr, tStr) => {
      const dp = dStr.split('-');
      const tp = tStr.split(':');
      return new Date(
        parseInt(dp[0], 10),
        parseInt(dp[1], 10) - 1,
        parseInt(dp[2], 10),
        parseInt(tp[0], 10),
        parseInt(tp[1], 10),
        0
      );
    };

    const formatICSDate = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    };

    const startDt = parseLocal(dateStr, startTime);
    const endDt = parseLocal(dateStr, endTime);
    const startIso = formatICSDate(startDt);
    const endIso = formatICSDate(endDt);

    const loc = `Estádio do Dragão, Porto - Setor ${sectorName} (${subSector})`;
    const descText = `Congresso Internacional Porto 2026\nTurno de Serviço como voluntário no Setor ${sectorName}\nSub-setor: ${subSector}\nHorário: ${startTime} às ${endTime}`;
    
    // Check if the user is on an Android device to use a direct Google Calendar template link
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(title)}` +
        `&dates=${startIso}/${endIso}` +
        `&details=${encodeURIComponent(descText)}` +
        `&location=${encodeURIComponent(loc)}`;
      
      window.open(googleCalendarUrl, '_blank');
    } else {
      const desc = descText.replace(/\n/g, '\\n');
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Porto 2026//Escalas//PT',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${Date.now()}-${Math.random()}@porto2026`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${startIso}`,
        `DTEND:${endIso}`,
        `SUMMARY:${title}`,
        `LOCATION:${loc}`,
        `DESCRIPTION:${desc}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
      
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${dateStr}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Helper to enable smooth click-and-drag scroll on PC/Desktop browsers
  const initDragToScroll = () => {
    document.querySelectorAll('.carousel-wrapper').forEach(slider => {
      let isDown = false;
      let startX;
      let scrollLeft;
      let moved = false;

      slider.addEventListener('mousedown', (e) => {
        isDown = true;
        moved = false;
        slider.style.cursor = 'grabbing';
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
      });

      const stopDragging = () => {
        if (!isDown) return;
        isDown = false;
        slider.style.cursor = 'default';
      };

      slider.addEventListener('mouseleave', stopDragging);
      slider.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        slider.style.cursor = 'default';
        
        if (moved) {
          const preventClick = (event) => {
            event.stopImmediatePropagation();
            event.preventDefault();
            slider.removeEventListener('click', preventClick, true);
          };
          slider.addEventListener('click', preventClick, true);
        }
      });

      slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > 5) {
          moved = true;
        }
        e.preventDefault();
        slider.scrollLeft = scrollLeft - walk;
      });
    });
  };

  // Dynamic Modal Detail Drawer for Mockup 3 Details Sheet
  const openShiftDetailsPopup = (item, roleText, capsHtml, kmsHtml, teamHtml, buttonsHtml) => {
    popupSectorName.textContent = item.sector.name;
    
    let html = `
      <div style="margin-bottom: 12px; font-size: 13px;">
        <span class="scale-subsector" style="font-size: 12px; font-weight: 800; color: var(--danger); display: block; margin-bottom: 2px;">${esc(item.sector.subSector || 'Geral')}${item.assign.door ? ` • 🚪 ${esc(item.assign.door)}` : ''}</span>
        <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 13px; color: var(--text-primary); font-weight: 700; margin-bottom: 6px;">
          <span>📅 ${getWeekDay(item.shift.date)}, ${formatDate(item.shift.date)}</span>
          <span>🕒 ${item.shift.startTime} – ${item.shift.endTime}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary);">
          Função: <span class="user-role-badge" style="background: var(--primary-light); color: var(--primary); font-weight: 800; border: 1px solid rgba(47, 53, 143, 0.15); padding: 2px 6px; border-radius: 6px; font-size: 10.5px;">${roleText}</span>
        </div>
      </div>
      
      <div style="margin-bottom: 12px; max-height: 45vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
        ${capsHtml || ''}
        ${kmsHtml || ''}
        ${teamHtml || ''}
      </div>

      <div style="margin-top: 8px; border-top: 1.5px solid var(--surface-border); padding-top: 12px; display: flex; justify-content: center;">
        ${buttonsHtml}
      </div>
    `;

    popupBodyContent.innerHTML = html;

    // Bind add-cal action inside bottom sheet modal
    popupBodyContent.querySelectorAll('.btn-add-cal').forEach(btn => {
      btn.addEventListener('click', () => {
        const title = btn.dataset.title;
        const date = btn.dataset.date;
        const start = btn.dataset.start;
        const end = btn.dataset.end;
        const sec = btn.dataset.sec;
        const sub = btn.dataset.sub;
        handleAddToCalendar(title, date, start, end, sec, sub);
      });
    });

    // Handle Dynamically Binded Observações
    popupBodyContent.querySelectorAll('.obs-popup-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRemarksModal(btn.dataset.name, btn.dataset.remarks);
      });
    });

    shiftDetailsPopup.classList.add('open');
  };

  // 1. INDICADOR VIEW
  const renderIndicatorView = (assigns, container) => {
    const target = container || dashboardContent;
    if (assigns.length === 0) {
      target.innerHTML = renderEmptyState('Sem escalas atribuídas', 'De momento não tens escalas atribuídas para o dia selecionado.');
      return;
    }

    const sessionStart = parseInt(sessionStorage.getItem('porto2026_session_start_time') || '0');

    // Sort assignments by shift date/time
    const sorted = [...assigns].map(a => {
      const sh = db.shifts.find(s => s.id === a.shiftId);
      const sec = db.sectors.find(s => s.id === a.sectorId);
      return { assign: a, shift: sh, sector: sec };
    }).filter(x => x.shift && x.sector)
      .sort((a,b) => a.shift.date.localeCompare(b.shift.date) || a.shift.startTime.localeCompare(b.shift.startTime));

    // Group sorted items by shift date
    const groups = {};
    sorted.forEach(item => {
      const date = item.shift.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    const sortedDates = Object.keys(groups).sort();

    let html = `
      <p style="font-size:12.5px;color:var(--text-muted);margin: 4px 0 14px 4px;">Desliza para os lados e clica no cartão para ver detalhes</p>
    `;

    sortedDates.forEach(date => {
      const dateItems = groups[date];
      html += `
        <h4 class="card-section-title" style="margin-left: 4px; margin-top: 16px; font-size: 13px; color: var(--primary); font-weight: 800;">
          ${getWeekDay(date)}, ${formatDate(date)} (${dateItems.length})
        </h4>
        <div class="carousel-wrapper" style="display: flex; gap: 12px; overflow-x: auto; padding: 4px 16px; margin: 0 -16px 16px -16px; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
      `;

      dateItems.forEach(item => {
        const sh = item.shift;
        const sec = item.sector;
        const a = item.assign;
        const roleText = a.role === 'CAP' ? 'Capitão' : (a.role === 'KM' ? 'Homem-Chave' : 'Indicador');
        const changeBadgeHtml = getChangeBadgeHtml(a, sessionStart);
        const cardCustomClass = getCardClass(a);
        const globalIdx = sorted.indexOf(item);

        html += `
          <div class="scale-card carousel-card ${cardCustomClass}" data-idx="${globalIdx}" style="flex-shrink: 0; width: 280px; cursor: pointer; margin-bottom: 0; position: relative;">
            <div class="scale-card-header" style="margin-bottom: 8px;">
              <div>
                <h3 style="font-size: 15.5px; line-height: 1.2; font-weight:800; letter-spacing:-0.01em;">${esc(sec.name)} ${changeBadgeHtml}</h3>
                <span class="scale-subsector" style="font-size: 12.5px;">${esc(sec.subSector || 'Geral')}${a.door ? ` • 🚪 ${esc(a.door)}` : ''}</span>
              </div>
            </div>
            <div class="scale-date-row" style="font-size: 13px; margin-bottom: 8px; color: var(--text-primary); font-weight:700; display: none;">
              📅 <span>${getWeekDay(sh.date)}, ${formatDate(sh.date)}</span>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; font-weight: 500;">
              🕒 Horário: <strong>${sh.startTime}–${sh.endTime}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Função: <span class="user-role-badge" style="padding: 2px 6px; font-size:11.5px; font-weight: 800;">${roleText}</span>
            </div>
            <div style="margin-top: 16px; border-top:1px solid rgba(0,0,0,0.03); padding-top:12px; font-weight: 800; color: var(--primary); font-size: 12.5px; display: flex; align-items: center; gap: 4px;">
              🔎 Ver Detalhes do Turno ›
            </div>
            ${getCompletedBadgeHtml(a)}
          </div>`;
      });

      html += `</div>`;
    });
    target.innerHTML = html;
    initDragToScroll();

    // Bind Carousel Card clicks to open Details Drawer Sheet
    target.querySelectorAll('.carousel-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx);
        const item = sorted[idx];
        const sh = item.shift;
        const sec = item.sector;
        const a = item.assign;
        const roleText = a.role === 'CAP' ? 'Capitão' : (a.role === 'KM' ? 'Homem-Chave' : 'Indicador');

        // Render Captain info inside details popup
        const captains = db.assignments
          .filter(x => x.shiftId === sh.id && x.sectorId === sec.id && x.role === 'CAP')
          .map(x => db.volunteers.find(v => String(v.id) === String(x.volunteerId)))
          .filter(Boolean);

        let capsHtml = '';
        if (captains.length > 0) {
          capsHtml = `
            <div style="margin-bottom: 8px;">
              <span class="card-section-title" style="color: var(--primary); font-weight: 800; font-size: 11px; margin-bottom: 4px;">Capitão do Turno</span>
              <div class="vol-row-list">
                ${captains.map(c => `
                  <div class="vol-row-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                      <span class="vol-name">${esc(c.fullName)}</span>
                      <span class="vol-cong" style="font-size:11.5px; color:var(--text-muted);">${esc(c.congregation || 'Sem Congregação')}</span>
                    </div>
                    ${c.phone ? `
                      <div class="vol-actions">
                        <a href="tel:${makeTelLink(c.phone)}" class="btn-action-pill phone" title="Ligar">📞 Ligar</a>
                        <a href="https://wa.me/${waPhone(c.phone)}?text=Olá!" target="_blank" class="btn-action-pill wa" title="WhatsApp">💬 WhatsApp</a>
                      </div>
                    ` : `<div style="font-size:11px; color:var(--danger); font-weight:600;">⚠️ Sem telemóvel</div>`}
                  </div>
                `).join('')}
              </div>
            </div>`;
        }

        const buttonsHtml = `
          <button class="btn-add-cal btn-primary" data-title="${esc(roleText)} - ${esc(sec.name)}, ${esc(sec.subSector || 'Geral')}" data-date="${sh.date}" data-start="${sh.startTime}" data-end="${sh.endTime}" data-sec="${esc(sec.name)}" data-sub="${esc(sec.subSector || 'Geral')}" style="width: auto; min-width: 220px; padding: 10px 20px; font-size: 13px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(47, 53, 143, 0.15);">
            📅 Adicionar à minha Agenda
          </button>
        `;

        openShiftDetailsPopup(item, roleText, capsHtml, null, null, buttonsHtml);
      });
    });
  };

  // 2. CAPTAIN VIEW
  const renderCaptainView = (assigns, container) => {
    const target = container || dashboardContent;
    if (assigns.length === 0) {
      target.innerHTML = renderEmptyState('Nenhum turno associado', 'De momento não estás escalado em nenhum turno ou setor como Capitão para o dia selecionado.');
      return;
    }

    const sessionStart = parseInt(sessionStorage.getItem('porto2026_session_start_time') || '0');

    // Sort assignments by shift date/time
    const sorted = [...assigns].map(a => {
      const sh = db.shifts.find(s => s.id === a.shiftId);
      const sec = db.sectors.find(s => s.id === a.sectorId);
      return { assign: a, shift: sh, sector: sec };
    }).filter(x => x.shift && x.sector)
      .sort((a,b) => a.shift.date.localeCompare(b.shift.date) || a.shift.startTime.localeCompare(b.shift.startTime));

    // Group sorted items by shift date
    const groups = {};
    sorted.forEach(item => {
      const date = item.shift.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    const sortedDates = Object.keys(groups).sort();

    let html = `
      <p style="font-size:12.5px;color:var(--text-muted);margin: 4px 0 14px 4px;">Desliza para os lados e clica no cartão para gerir a equipa</p>
    `;

    sortedDates.forEach(date => {
      const dateItems = groups[date];
      html += `
        <h4 class="card-section-title" style="margin-left: 4px; margin-top: 16px; font-size: 13px; color: var(--primary); font-weight: 800;">
          ${getWeekDay(date)}, ${formatDate(date)} (${dateItems.length})
        </h4>
        <div class="carousel-wrapper" style="display: flex; gap: 12px; overflow-x: auto; padding: 4px 16px; margin: 0 -16px 16px -16px; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
      `;

      dateItems.forEach(item => {
        const sh = item.shift;
        const sec = item.sector;
        const a = item.assign;
        const changeBadgeHtml = getChangeBadgeHtml(a, sessionStart);
        const cardCustomClass = getCardClass(a);
        const globalIdx = sorted.indexOf(item);

        html += `
          <div class="scale-card carousel-card ${cardCustomClass}" data-idx="${globalIdx}" style="flex-shrink: 0; width: 280px; cursor: pointer; margin-bottom: 0; position: relative;">
            <div class="scale-card-header" style="margin-bottom: 8px;">
              <div>
                <h3 style="font-size: 15.5px; line-height: 1.2; font-weight:800; letter-spacing:-0.01em;">${esc(sec.name)} ${changeBadgeHtml}</h3>
                <span class="scale-subsector" style="font-size: 12.5px;">${esc(sec.subSector || 'Geral')}${a.door ? ` • 🚪 ${esc(a.door)}` : ''}</span>
              </div>
            </div>
            <div class="scale-date-row" style="font-size: 13px; margin-bottom: 8px; color: var(--text-primary); font-weight:700; display: none;">
              📅 <span>${getWeekDay(sh.date)}, ${formatDate(sh.date)}</span>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; font-weight: 500;">
              🕒 Horário: <strong>${sh.startTime}–${sh.endTime}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Função: <span class="user-role-badge" style="padding: 2px 6px; font-size:11.5px; font-weight: 800; background:var(--primary-light); color:var(--primary);">Capitão</span>
            </div>
            <div style="margin-top: 16px; border-top:1px solid rgba(0,0,0,0.03); padding-top:12px; font-weight: 800; color: var(--primary); font-size: 12.5px; display: flex; align-items: center; gap: 4px;">
              👥 Gerir Equipa & Contactos ›
            </div>
            ${getCompletedBadgeHtml(a)}
          </div>`;
      });

      html += `</div>`;
    });
    target.innerHTML = html;
    initDragToScroll();

    // Bind Captain Carousel Cards
    target.querySelectorAll('.carousel-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx);
        const item = sorted[idx];
        const sh = item.shift;
        const sec = item.sector;

        // Find indicators assigned
        const sameSecAssigns = db.assignments.filter(x => x.shiftId === sh.id && x.sectorId === sec.id);
        const teamInds = sameSecAssigns.filter(x => !x.role || x.role === 'IND').map(x => db.volunteers.find(v => String(v.id) === String(x.volunteerId))).filter(Boolean);
        const teamKms = sameSecAssigns.filter(x => x.role === 'KM').map(x => db.volunteers.find(v => String(v.id) === String(x.volunteerId))).filter(Boolean);
        const teamCaps = sameSecAssigns.filter(x => x.role === 'CAP' && String(x.volunteerId) !== String(currentUser.id)).map(x => db.volunteers.find(v => String(v.id) === String(x.volunteerId))).filter(Boolean);

        let teamHtml = '';
        if (teamInds.length > 0) {
          teamHtml = `
            <div>
              <span class="card-section-title" style="color: var(--info); font-weight: 800; font-size: 11px; margin-bottom: 4px;">Equipa de Indicadores (${teamInds.length})</span>
              <div class="vol-row-list">
                ${teamInds.map(i => {
                  const isSister = !!i.isSister;
                  const isTorni = i.responsibility && (i.responsibility.includes('TORNI') || i.responsibility.includes('Torniquete'));
                  const rLabel = isTorni ? 'Torniquetes' : (isSister ? 'Irmã' : 'Indicador');
                  const rClass = isTorni ? 'badge-torni' : (isSister ? 'badge-irma' : 'badge-ind');

                  return `
                    <div class="vol-row-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch; padding: 10px 12px; background: #f8fafc; border-radius: 12px;">
                      <div style="display:flex; flex-direction:column; gap:2px;">
                        <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                          <span class="vol-name" style="font-size:13.5px;">${esc(i.fullName)}</span>
                          <span class="resp-badge-small ${rClass}" style="margin:0; font-size:9px; padding:2px 6px;">${rLabel}</span>
                        </div>
                        <span class="vol-cong" style="font-size:11.5px; color:var(--text-muted);">${esc(i.congregation || 'Sem Congregação')}</span>
                      </div>
                      ${i.phone ? `
                        <div class="vol-actions" style="margin-top: 2px;">
                          <a href="tel:${makeTelLink(i.phone)}" class="btn-action-pill phone" title="Ligar">📞 Ligar</a>
                          <a href="https://wa.me/${waPhone(i.phone)}?text=Olá!" target="_blank" class="btn-action-pill wa" title="WhatsApp">💬 WhatsApp</a>
                        </div>
                      ` : `<div style="font-size:11px; color:var(--danger); font-weight:600;">⚠️ Sem telemóvel</div>`}
                    </div>`;
                }).join('')}
              </div>
            </div>`;
        } else {
          teamHtml = `<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Nenhum indicador atribuído a este setor ainda.</p>`;
        }

        let kmsHtml = '';
        if (teamKms.length > 0) {
          kmsHtml = `
            <div style="margin-bottom: 8px;">
              <span class="card-section-title" style="color: var(--warning); font-weight: 800; font-size: 11px; margin-bottom: 4px;">Homem-Chave</span>
              <div class="vol-row-list">
                ${teamKms.map(k => `
                  <div class="vol-row-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch; padding: 10px 12px; background: #f8fafc; border-radius: 12px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                      <span class="vol-name" style="font-size:13.5px;">${esc(k.fullName)}</span>
                      <span class="vol-cong" style="font-size:11.5px; color:var(--text-muted);">${esc(k.congregation || 'Sem Congregação')}</span>
                    </div>
                    ${k.phone ? `
                      <div class="vol-actions" style="margin-top: 2px;">
                        <a href="tel:${makeTelLink(k.phone)}" class="btn-action-pill phone" title="Ligar">📞 Ligar</a>
                        <a href="https://wa.me/${waPhone(k.phone)}?text=Olá!" target="_blank" class="btn-action-pill wa" title="WhatsApp">💬 WhatsApp</a>
                      </div>
                    ` : `<div style="font-size:11px; color:var(--danger); font-weight:600;">⚠️ Sem telemóvel</div>`}
                  </div>
                `).join('')}
              </div>
            </div>`;
        }

        let capsHtml = '';
        if (teamCaps.length > 0) {
          capsHtml = `
            <div style="margin-bottom: 8px;">
              <span class="card-section-title" style="color: var(--primary); font-weight: 800; font-size: 11px; margin-bottom: 4px;">Co-Capitão do Setor (${teamCaps.length})</span>
              <div class="vol-row-list">
                ${teamCaps.map(c => `
                  <div class="vol-row-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch; padding: 10px 12px; background: #f8fafc; border-radius: 12px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                      <span class="vol-name" style="font-size:13.5px;">${esc(c.fullName)}</span>
                      <span class="vol-cong" style="font-size:11.5px; color:var(--text-muted);">${esc(c.congregation || 'Sem Congregação')}</span>
                    </div>
                    ${c.phone ? `
                      <div class="vol-actions" style="margin-top: 2px;">
                        <a href="tel:${makeTelLink(c.phone)}" class="btn-action-pill phone" title="Ligar">📞 Ligar</a>
                        <a href="https://wa.me/${waPhone(c.phone)}?text=Olá!" target="_blank" class="btn-action-pill wa" title="WhatsApp">💬 WhatsApp</a>
                      </div>
                    ` : `<div style="font-size:11px; color:var(--danger); font-weight:600;">⚠️ Sem telemóvel</div>`}
                  </div>
                `).join('')}
              </div>
            </div>`;
        }

        const buttonsHtml = `
          <button class="btn-add-cal btn-primary" data-title="Capitão - ${esc(sec.name)}, ${esc(sec.subSector || 'Geral')}" data-date="${sh.date}" data-start="${sh.startTime}" data-end="${sh.endTime}" data-sec="${esc(sec.name)}" data-sub="${esc(sec.subSector || 'Geral')}" style="width: auto; min-width: 220px; padding: 10px 20px; font-size: 13px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(47, 53, 143, 0.15);">
            📅 Adicionar à minha Agenda
          </button>
        `;

        openShiftDetailsPopup(item, 'Capitão', capsHtml, kmsHtml, teamHtml, buttonsHtml);
      });
    });
  };

  // 3. HOMEM-CHAVE VIEW
  const renderKeymanView = (assigns, container) => {
    const target = container || dashboardContent;
    if (assigns.length === 0) {
      target.innerHTML = renderEmptyState('Nenhum turno associado', 'De momento não estás atribuído em nenhum turno ou setor como Homem-Chave para o dia selecionado.');
      return;
    }

    const sessionStart = parseInt(sessionStorage.getItem('porto2026_session_start_time') || '0');

    // Sort assignments by shift date/time
    const sorted = [...assigns].map(a => {
      const sh = db.shifts.find(s => s.id === a.shiftId);
      const sec = db.sectors.find(s => s.id === a.sectorId);
      return { assign: a, shift: sh, sector: sec };
    }).filter(x => x.shift && x.sector)
      .sort((a,b) => a.shift.date.localeCompare(b.shift.date) || a.shift.startTime.localeCompare(b.shift.startTime));

    // Group sorted items by shift date
    const groups = {};
    sorted.forEach(item => {
      const date = item.shift.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    const sortedDates = Object.keys(groups).sort();

    let html = `
      <p style="font-size:12.5px;color:var(--text-muted);margin: 4px 0 14px 4px;">Desliza para os lados e clica no cartão para gerir a equipa</p>
    `;

    sortedDates.forEach(date => {
      const dateItems = groups[date];
      html += `
        <h4 class="card-section-title" style="margin-left: 4px; margin-top: 16px; font-size: 13px; color: var(--primary); font-weight: 800;">
          ${getWeekDay(date)}, ${formatDate(date)} (${dateItems.length})
        </h4>
        <div class="carousel-wrapper" style="display: flex; gap: 12px; overflow-x: auto; padding: 4px 16px; margin: 0 -16px 16px -16px; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
      `;

      dateItems.forEach(item => {
        const sh = item.shift;
        const sec = item.sector;
        const a = item.assign;
        const changeBadgeHtml = getChangeBadgeHtml(a, sessionStart);
        const cardCustomClass = getCardClass(a);
        const globalIdx = sorted.indexOf(item);

        html += `
          <div class="scale-card carousel-card ${cardCustomClass}" data-idx="${globalIdx}" style="flex-shrink: 0; width: 280px; cursor: pointer; margin-bottom: 0; position: relative;">
            <div class="scale-card-header" style="margin-bottom: 8px;">
              <div>
                <h3 style="font-size: 15.5px; line-height: 1.2; font-weight:800; letter-spacing:-0.01em;">${esc(sec.name)} ${changeBadgeHtml}</h3>
                <span class="scale-subsector" style="font-size: 12.5px;">${esc(sec.subSector || 'Geral')}${a.door ? ` • 🚪 ${esc(a.door)}` : ''}</span>
              </div>
            </div>
            <div class="scale-date-row" style="font-size: 13px; margin-bottom: 8px; color: var(--text-primary); font-weight:700; display: none;">
              📅 <span>${getWeekDay(sh.date)}, ${formatDate(sh.date)}</span>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; font-weight: 500;">
              🕒 Horário: <strong>${sh.startTime}–${sh.endTime}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Função: <span class="user-role-badge" style="padding: 2px 6px; font-size:11.5px; font-weight: 800; background:var(--warning-light); color:var(--warning); border-color: rgba(217, 119, 6, 0.15);">Homem-Chave</span>
            </div>
            <div style="margin-top: 16px; border-top:1px solid rgba(0,0,0,0.03); padding-top:12px; font-weight: 800; color: var(--primary); font-size: 12.5px; display: flex; align-items: center; gap: 4px;">
              👥 Gerir Equipa & Contactos ›
            </div>
            ${getCompletedBadgeHtml(a)}
          </div>`;
      });

      html += `</div>`;
    });
    target.innerHTML = html;
    initDragToScroll();

    // Bind Carousel Cards
    target.querySelectorAll('.carousel-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx);
        const item = sorted[idx];
        const sh = item.shift;
        const sec = item.sector;

        // Find indicators, captains and other keymen assigned to same sector/shift
        const sameSecAssigns = db.assignments.filter(x => x.shiftId === sh.id && x.sectorId === sec.id);
        const teamInds = sameSecAssigns.filter(x => !x.role || x.role === 'IND').map(x => db.volunteers.find(v => String(v.id) === String(x.volunteerId))).filter(Boolean);
        const teamKms = sameSecAssigns.filter(x => x.role === 'KM' && String(x.volunteerId) !== String(currentUser.id)).map(x => db.volunteers.find(v => String(v.id) === String(x.volunteerId))).filter(Boolean);
        const teamCaps = sameSecAssigns.filter(x => x.role === 'CAP').map(x => db.volunteers.find(v => String(v.id) === String(x.volunteerId))).filter(Boolean);

        let teamHtml = '';
        if (teamInds.length > 0) {
          teamHtml = `
            <div>
              <span class="card-section-title" style="color: var(--info); font-weight: 800; font-size: 11px; margin-bottom: 4px;">Equipa de Indicadores (${teamInds.length})</span>
              <div class="vol-row-list">
                ${teamInds.map(i => {
                  const isSister = !!i.isSister;
                  const isTorni = i.responsibility && (i.responsibility.includes('TORNI') || i.responsibility.includes('Torniquete'));
                  const rLabel = isTorni ? 'Torniquetes' : (isSister ? 'Irmã' : 'Indicador');
                  const rClass = isTorni ? 'badge-torni' : (isSister ? 'badge-irma' : 'badge-ind');

                  return `
                    <div class="vol-row-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch; padding: 10px 12px; background: #f8fafc; border-radius: 12px;">
                      <div style="display:flex; flex-direction:column; gap:2px;">
                        <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                          <span class="vol-name" style="font-size:13.5px;">${esc(i.fullName)}</span>
                          <span class="resp-badge-small ${rClass}" style="margin:0; font-size:9px; padding:2px 6px;">${rLabel}</span>
                        </div>
                        <span class="vol-cong" style="font-size:11.5px; color:var(--text-muted);">${esc(i.congregation || 'Sem Congregação')}</span>
                      </div>
                      ${i.phone ? `
                        <div class="vol-actions" style="margin-top: 2px;">
                          <a href="tel:${makeTelLink(i.phone)}" class="btn-action-pill phone" title="Ligar">📞 Ligar</a>
                          <a href="https://wa.me/${waPhone(i.phone)}?text=Olá!" target="_blank" class="btn-action-pill wa" title="WhatsApp">💬 WhatsApp</a>
                        </div>
                      ` : `<div style="font-size:11px; color:var(--danger); font-weight:600;">⚠️ Sem telemóvel</div>`}
                    </div>`;
                }).join('')}
              </div>
            </div>`;
        } else {
          teamHtml = `<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Nenhum indicador atribuído a este setor ainda.</p>`;
        }

        let kmsHtml = '';
        if (teamKms.length > 0) {
          kmsHtml = `
            <div style="margin-bottom: 8px;">
              <span class="card-section-title" style="color: var(--warning); font-weight: 800; font-size: 11px; margin-bottom: 4px;">Co-Homem-Chave (${teamKms.length})</span>
              <div class="vol-row-list">
                ${teamKms.map(k => `
                  <div class="vol-row-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch; padding: 10px 12px; background: #f8fafc; border-radius: 12px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                      <span class="vol-name" style="font-size:13.5px;">${esc(k.fullName)}</span>
                      <span class="vol-cong" style="font-size:11.5px; color:var(--text-muted);">${esc(k.congregation || 'Sem Congregação')}</span>
                    </div>
                    ${k.phone ? `
                      <div class="vol-actions" style="margin-top: 2px;">
                        <a href="tel:${makeTelLink(k.phone)}" class="btn-action-pill phone" title="Ligar">📞 Ligar</a>
                        <a href="https://wa.me/${waPhone(k.phone)}?text=Olá!" target="_blank" class="btn-action-pill wa" title="WhatsApp">💬 WhatsApp</a>
                      </div>
                    ` : `<div style="font-size:11px; color:var(--danger); font-weight:600;">⚠️ Sem telemóvel</div>`}
                  </div>
                `).join('')}
              </div>
            </div>`;
        }

        let capsHtml = '';
        if (teamCaps.length > 0) {
          capsHtml = `
            <div style="margin-bottom: 8px;">
              <span class="card-section-title" style="color: var(--primary); font-weight: 800; font-size: 11px; margin-bottom: 4px;">Capitão do Setor (${teamCaps.length})</span>
              <div class="vol-row-list">
                ${teamCaps.map(c => `
                  <div class="vol-row-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch; padding: 10px 12px; background: #f8fafc; border-radius: 12px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                      <span class="vol-name" style="font-size:13.5px;">${esc(c.fullName)}</span>
                      <span class="vol-cong" style="font-size:11.5px; color:var(--text-muted);">${esc(c.congregation || 'Sem Congregação')}</span>
                    </div>
                    ${c.phone ? `
                      <div class="vol-actions" style="margin-top: 2px;">
                        <a href="tel:${makeTelLink(c.phone)}" class="btn-action-pill phone" title="Ligar">📞 Ligar</a>
                        <a href="https://wa.me/${waPhone(c.phone)}?text=Olá!" target="_blank" class="btn-action-pill wa" title="WhatsApp">💬 WhatsApp</a>
                      </div>
                    ` : `<div style="font-size:11px; color:var(--danger); font-weight:600;">⚠️ Sem telemóvel</div>`}
                  </div>
                `).join('')}
              </div>
            </div>`;
        }

        const buttonsHtml = `
          <button class="btn-add-cal btn-primary" data-title="Homem-Chave - ${esc(sec.name)}, ${esc(sec.subSector || 'Geral')}" data-date="${sh.date}" data-start="${sh.startTime}" data-end="${sh.endTime}" data-sec="${esc(sec.name)}" data-sub="${esc(sec.subSector || 'Geral')}" style="width: auto; min-width: 220px; padding: 10px 20px; font-size: 13px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(47, 53, 143, 0.15);">
            📅 Adicionar à minha Agenda
          </button>
        `;

        openShiftDetailsPopup(item, 'Homem-Chave', capsHtml, kmsHtml, teamHtml, buttonsHtml);
      });
    });
  };

  const renderRdVolRow = (v, roleLabel, rClass) => {
    if (!v) return '';
    return `
      <div class="vol-row-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch; padding: 10px 12px; background: #ffffff; border-radius: 12px; border: 1px solid rgba(0,0,0,0.03); margin-bottom: 4px;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
            <span class="vol-name" style="font-size:13px; font-weight: 700; color: var(--text-primary);">${esc(v.fullName)}</span>
            <span class="resp-badge-small ${rClass}" style="margin:0; font-size:9px; padding:2px 6px;">${roleLabel}</span>
          </div>
          <span class="vol-cong" style="font-size:11.5px; color:var(--text-muted);">${esc(v.congregation || 'Sem Congregação')}</span>
        </div>
        ${v.phone ? `
          <div class="vol-actions" style="margin-top: 2px; display: flex; gap: 8px;">
            <a href="tel:${makeTelLink(v.phone)}" class="btn-action-pill phone" title="Ligar" style="flex: 1; justify-content: center;">📞 Ligar</a>
            <a href="https://wa.me/${waPhone(v.phone)}?text=Olá!" target="_blank" class="btn-action-pill wa" title="WhatsApp" style="flex: 1; justify-content: center;">💬 WhatsApp</a>
          </div>
        ` : `<div style="font-size:11px; color:var(--danger); font-weight:600;">⚠️ Sem telemóvel</div>`}
      </div>
    `;
  };

  const renderRdView = (container) => {
    const target = container || dashboardContent;
    
    // Sort shifts chronologically
    const sortedShifts = [...db.shifts].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.startTime.localeCompare(b.startTime);
    });

    if (sortedShifts.length === 0) {
      target.innerHTML = renderEmptyState('Sem turnos cadastrados', 'Não existem turnos disponíveis no sistema.');
      return;
    }

    // Default shift if none selected
    if (!activeRdShiftId || !db.shifts.some(s => s.id === activeRdShiftId)) {
      activeRdShiftId = sortedShifts[0].id;
    }

    // Sort sectors alphabetically
    const sortedSectors = [...db.sectors].sort((a, b) => a.name.localeCompare(b.name));

    // Get current shift object
    const selectedShift = db.shifts.find(s => s.id === activeRdShiftId);

    // Build filters HTML
    let filterHtml = `
      <div class="rd-filters-container" style="display: flex; gap: 10px; margin-bottom: 18px; padding: 0 4px;">
        <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Turno</label>
          <select id="rdFilterShift" style="width: 100%; padding: 12px; border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.08); font-size: 13px; font-weight: 700; background: white; color: var(--text-primary); cursor: pointer; box-shadow: var(--shadow-sm); outline: none;">
            ${sortedShifts.map(s => {
              const selectedAttr = s.id === activeRdShiftId ? 'selected' : '';
              return `<option value="${s.id}" ${selectedAttr}>${getWeekDay(s.date)}, ${formatDate(s.date)} — ${s.startTime} às ${s.endTime}</option>`;
            }).join('')}
          </select>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Setor</label>
          <select id="rdFilterSector" style="width: 100%; padding: 12px; border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.08); font-size: 13px; font-weight: 700; background: white; color: var(--text-primary); cursor: pointer; box-shadow: var(--shadow-sm); outline: none;">
            <option value="all" ${activeRdSectorId === 'all' ? 'selected' : ''}>Todos os Setores</option>
            ${sortedSectors.map(sec => {
              const selectedAttr = sec.id === activeRdSectorId ? 'selected' : '';
              return `<option value="${sec.id}" ${selectedAttr}>${esc(sec.name)} (${esc(sec.subSector || 'Geral')})</option>`;
            }).join('')}
          </select>
        </div>
      </div>
      <div id="rdViewContent"></div>
    `;

    target.innerHTML = filterHtml;

    // Filter assignments for the selected shift and (optionally) sector
    const activeShiftAssigns = db.assignments.filter(a => a.shiftId === activeRdShiftId);
    
    let sectorsToShow = [];
    if (activeRdSectorId !== 'all') {
      const sec = db.sectors.find(s => s.id === activeRdSectorId);
      if (sec) sectorsToShow.push(sec);
    } else {
      sectorsToShow = sortedSectors;
    }

    const rdViewContent = target.querySelector('#rdViewContent');
    let contentHtml = '';

    if (sectorsToShow.length === 0) {
      contentHtml = renderEmptyState('Nenhum setor encontrado', 'Não existem setores para exibir.');
    } else {
      sectorsToShow.forEach(sec => {
        const secAssigns = activeShiftAssigns.filter(a => a.sectorId === sec.id);
        
        // Find Captains and Keymen
        const capAssigns = secAssigns.filter(a => a.role === 'CAP');
        const kmAssigns = secAssigns.filter(a => a.role === 'KM');
        
        // Find Indicators/Sisters (everything else)
        const indAssigns = secAssigns.filter(a => a.role !== 'CAP' && a.role !== 'KM');

        // Let's group indicators by doors
        const doors = sec.doors || [];
        const doorGroups = {};
        
        // Initialize door groups so they show in order
        doors.forEach(d => {
          doorGroups[d] = [];
        });
        
        const generalGroup = [];

        indAssigns.forEach(a => {
          if (a.door && doors.includes(a.door)) {
            doorGroups[a.door].push(a);
          } else if (a.door) {
            if (!doorGroups[a.door]) doorGroups[a.door] = [];
            doorGroups[a.door].push(a);
          } else {
            generalGroup.push(a);
          }
        });

        const totalSecCount = secAssigns.length;

        contentHtml += `
          <div class="rd-sector-card" style="background: rgba(255,255,255,0.75); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1.5px solid rgba(255,255,255,0.45); border-radius: 18px; padding: 18px; margin-bottom: 18px; box-shadow: var(--shadow-card);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <div>
                <h3 style="font-size: 16px; font-weight: 800; color: var(--text-primary); margin:0;">${esc(sec.name)}</h3>
                <span style="font-size: 12px; color: var(--danger); font-weight: 800; margin-top: 2px; display: inline-block;">📍 ${esc(sec.subSector || 'Geral')}</span>
              </div>
              <span style="font-size: 11px; font-weight: 800; color: var(--primary); background: var(--primary-light); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(47,53,143,0.15);">${totalSecCount} Atribuídos</span>
            </div>
            
            <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 12px;">
              <!-- Leaders: CAP & KM -->
              ${(capAssigns.length > 0 || kmAssigns.length > 0) ? `
                <div style="padding: 10px; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px solid rgba(0,0,0,0.02);">
                  <span class="card-section-title" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">Responsáveis do Setor</span>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${capAssigns.map(a => {
                      const v = db.volunteers.find(vol => String(vol.id) === String(a.volunteerId));
                      return renderRdVolRow(v, 'Capitão', 'badge-cap');
                    }).join('')}
                    ${kmAssigns.map(a => {
                      const v = db.volunteers.find(vol => String(vol.id) === String(a.volunteerId));
                      return renderRdVolRow(v, 'Homem-Chave', 'badge-km');
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Doors -->
              ${Object.keys(doorGroups).map(doorName => {
                const doorAssigns = doorGroups[doorName];
                return `
                  <div style="padding: 10px; background: rgba(255, 255, 255, 0.4); border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.03);">
                    <span class="card-section-title" style="font-size: 11px; color: var(--info); margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                      🚪 ${esc(doorName)} (${doorAssigns.length})
                    </span>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                      ${doorAssigns.length > 0 ? doorAssigns.map(a => {
                        const v = db.volunteers.find(vol => String(vol.id) === String(a.volunteerId));
                        const isSister = v && !!v.isSister;
                        const isTorni = v && v.responsibility && (v.responsibility.includes('TORNI') || v.responsibility.includes('Torniquete'));
                        const rLabel = isTorni ? 'Torniquetes' : (isSister ? 'Irmã' : 'Indicador');
                        const rClass = isTorni ? 'badge-torni' : (isSister ? 'badge-irma' : 'badge-ind');
                        return renderRdVolRow(v, rLabel, rClass);
                      }).join('') : `<p style="font-size: 12px; color: var(--text-muted); font-style: italic; margin: 4px 0 0 4px;">Sem voluntários atribuídos</p>`}
                    </div>
                  </div>
                `;
              }).join('')}

              <!-- Sem Porta / Geral -->
              ${generalGroup.length > 0 ? `
                <div style="padding: 10px; background: rgba(255, 255, 255, 0.4); border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.03);">
                  <span class="card-section-title" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
                    Sem Porta / Geral (${generalGroup.length})
                  </span>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${generalGroup.map(a => {
                      const v = db.volunteers.find(vol => String(vol.id) === String(a.volunteerId));
                      const isSister = v && !!v.isSister;
                      const isTorni = v && v.responsibility && (v.responsibility.includes('TORNI') || v.responsibility.includes('Torniquete'));
                      const rLabel = isTorni ? 'Torniquetes' : (isSister ? 'Irmã' : 'Indicador');
                      const rClass = isTorni ? 'badge-torni' : (isSister ? 'badge-irma' : 'badge-ind');
                      return renderRdVolRow(v, rLabel, rClass);
                    }).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });
    }

    rdViewContent.innerHTML = contentHtml;

    // Attach event listeners to filters to update state and trigger re-render
    const rdFilterShift = target.querySelector('#rdFilterShift');
    const rdFilterSector = target.querySelector('#rdFilterSector');

    rdFilterShift.addEventListener('change', (e) => {
      activeRdShiftId = e.target.value;
      renderRdView(target);
    });

    rdFilterSector.addEventListener('change', (e) => {
      activeRdSectorId = e.target.value;
      renderRdView(target);
    });
  };

  const renderEmptyState = (title, msg) => `
    <div style="text-align:center;padding:40px 16px;color:var(--text-secondary);">
      <div style="font-size:40px;margin-bottom:12px;">📅</div>
      <h3 style="font-weight:700;font-size:16px;color:var(--text-primary);margin-bottom:6px;">${title}</h3>
      <p style="font-size:13px;line-height:1.6;max-width:280px;margin:0 auto;">${msg}</p>
    </div>`;

  // Return exports
  return { init };

})();

// Initialize when page loads
window.addEventListener('DOMContentLoaded', App.init);

// Save last seen timestamp when volunteer closes PWA or refreshes (removed to prevent sessionStart reset on simple reload)
