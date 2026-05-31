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
  const adminLogoInp = document.getElementById('adminLogoInp');
  const btnAdminClearLogo = document.getElementById('btnAdminClearLogo');
  
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userGreeting = document.getElementById('userGreeting');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const btnLogout = document.getElementById('btnLogout');
  const dashboardContent = document.getElementById('dashboardContent');
  
  const obsModal = document.getElementById('obsModal');
  const obsModalText = document.getElementById('obsModalText');
  const closeObsModal = document.getElementById('closeObsModal');

  const userSelectModal = document.getElementById('userSelectModal');
  const userSelectContainer = document.getElementById('userSelectContainer');
  const cancelUserSelect = document.getElementById('cancelUserSelect');

  // Initializer
  const init = () => {
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
    
    // Bind Admin logo events
    adminLogoInp.addEventListener('change', handleAdminLogoUpload);
    btnAdminClearLogo.addEventListener('click', handleAdminClearLogo);

    // Bind global events
    btnLogout.addEventListener('click', handleLogout);
    closeObsModal.addEventListener('click', () => obsModal.classList.remove('open'));
    obsModal.addEventListener('click', (e) => { if (e.target === obsModal) obsModal.classList.remove('open'); });
    cancelUserSelect.addEventListener('click', () => userSelectModal.classList.remove('open'));

    // 1. Check if we already have a cached decrypted session
    const cachedDb = localStorage.getItem(CACHE_KEY_DB);
    const cachedUser = localStorage.getItem(CACHE_KEY_USER);

    if (cachedDb && cachedUser) {
      try {
        db = JSON.parse(cachedDb);
        currentUser = JSON.parse(cachedUser);
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
        fetch('./porto2026_mobile.enc')
          .then(res => { if (res.ok) return res.text(); })
          .then(text => {
            if (text && text !== savedGlobalEnc) {
              localStorage.setItem('porto2026_global_enc', text);
              encryptedText = text;
              console.log("Database synced with server.");
            }
          }).catch(() => {});
      }
      return;
    }

    // If no localStorage database, try auto-fetching from server
    if (window.location.protocol === 'file:') {
      updateLoginStatus('Modo Local. Por favor, aceda ao Painel de Administração para carregar o ficheiro .enc.', 'danger');
    } else {
      fetch('./porto2026_mobile.enc')
        .then(response => {
          if (!response.ok) throw new Error("Offline");
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
    const phoneInput = loginPhone.value.trim().replace(/\s+/g, '');

    if (!phoneInput) {
      updateLoginStatus('Por favor, introduza o seu número de telemóvel.', 'danger');
      return;
    }

    updateLoginStatus('A desencriptar base de dados...', 'info');

    try {
      // 1. Decrypt raw container
      const decryptedText = await decryptContainer(encryptedText, phoneInput);
      const parsedDb = JSON.parse(decryptedText);

      // 2. Find volunteer(s) by phone number
      const cleanPhone = phoneInput.replace(/[^0-9]/g, '');
      const matchingVolunteers = parsedDb.volunteers.filter(v => {
        const dbPhone = (v.phone || '').replace(/[^0-9]/g, '');
        return dbPhone.endsWith(cleanPhone) && cleanPhone.length >= 8;
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
    localStorage.removeItem(CACHE_KEY_DB);
    localStorage.removeItem(CACHE_KEY_USER);
    db = null;
    currentUser = null;

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
    
    fetch('./porto2026_mobile.enc')
      .then(response => response.text())
      .then(text => {
        encryptedText = text;
        localStorage.setItem('porto2026_global_enc', text);
        loginPhone.disabled = false;
        btnLogin.disabled = false;
        updateLoginStatus('Introduza o seu número de telemóvel para entrar.', 'info');
      })
      .catch(err => {
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

    const savedLogo = localStorage.getItem('porto2026_custom_logo');
    if (savedLogo) {
      btnAdminClearLogo.style.display = 'block';
    } else {
      btnAdminClearLogo.style.display = 'none';
    }
  };

  const applyCustomLogo = () => {
    const savedLogo = localStorage.getItem('porto2026_custom_logo');
    if (appLogoContainer) {
      if (savedLogo) {
        appLogoContainer.innerHTML = `<img src="${savedLogo}" style="max-height: 85px; max-width: 140px; object-fit: contain; margin-top: 4px; border: none; outline: none; background: none;">`;
      } else {
        appLogoContainer.innerHTML = '🇵🇹';
      }
    }
  };

  const handleAdminLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, carregue apenas ficheiros de imagem válidos.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64Url = ev.target.result;
      
      // Save locally
      localStorage.setItem('porto2026_custom_logo', base64Url);
      
      applyCustomLogo();
      updateAdminPanelUI();
      alert('Logótipo carregado e configurado com sucesso! Já substitui a bandeira de Portugal no ecrã de login.');
    };
    reader.readAsDataURL(file);
  };

  const handleAdminClearLogo = () => {
    if (confirm('Tem a certeza de que deseja remover o logótipo personalizado e restaurar a bandeira original de Portugal?')) {
      localStorage.removeItem('porto2026_custom_logo');
      applyCustomLogo();
      updateAdminPanelUI();
      alert('Logótipo personalizado removido com sucesso.');
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
    if (userGreeting) {
      userGreeting.textContent = greeting + ',';
    }

    userName.textContent = currentUser.fullName;
    userAvatar.textContent = currentUser.fullName.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();

    // Map DB Role label
    const r = String(currentUser.responsibility || '').toUpperCase();
    let roleText = 'Indicador';
    if (r === 'CAP') roleText = 'Capitão';
    else if (r === 'KM') roleText = 'Homem-Chave';
    else if (r.includes('TORNI')) roleText = 'Torniquetes';
    else if (currentUser.isSister || r === 'IRM') roleText = 'Irmã';
    userRoleBadge.textContent = roleText;

    renderRoleDashboard();
  };

  // Observations Popups inside mobile PWA
  const openRemarksModal = (name, remarks) => {
    document.getElementById('obsModalText').textContent = remarks;
    obsModal.classList.add('open');
  };

  // Dashboard Rendering based on user database roles
  const renderRoleDashboard = () => {
    dashboardContent.innerHTML = '';
    
    // Find all assignments for this volunteer
    const assigns = db.assignments.filter(a => a.volunteerId === currentUser.id);

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

    // 4. Render Date Filter Dropdown if there are multiple days
    let filterContainer = null;
    if (uniqueDates.length > 1) {
      filterContainer = document.createElement('div');
      filterContainer.className = 'form-group mb-4';
      filterContainer.style.background = '#ffffff';
      filterContainer.style.border = '1px solid rgba(0,0,0,0.05)';
      filterContainer.style.padding = '14px 16px';
      filterContainer.style.borderRadius = 'var(--radius-lg)';
      filterContainer.style.boxShadow = 'var(--shadow-card)';
      
      filterContainer.innerHTML = `
        <label class="form-label" for="dashboardDateSelect" style="display:flex; align-items:center; gap:6px;">
          <span>📅</span> Selecionar Dia do Congresso
        </label>
        <select id="dashboardDateSelect" class="form-input" style="width:100%; margin-top:6px; border-color:rgba(0,0,0,0.08); font-weight:700; color:var(--text-primary); background-color:#f8fafc; cursor:pointer;">
          <option value="all" ${activeDateFilter === 'all' ? 'selected' : ''}>Todos os Dias (${assigns.length} escalas)</option>
          ${uniqueDates.map(date => {
            const count = assigns.filter(a => {
              const sh = db.shifts.find(s => s.id === a.shiftId);
              return sh && sh.date === date;
            }).length;
            return `<option value="${date}" ${activeDateFilter === date ? 'selected' : ''}>${getWeekDay(date)}, ${formatDate(date)} (${count} escalas)</option>`;
          }).join('')}
        </select>
      `;
      dashboardContent.appendChild(filterContainer);
    }

    // 5. Render dashboard role section
    const roleContentContainer = document.createElement('div');
    roleContentContainer.id = 'roleContentContainer';
    dashboardContent.appendChild(roleContentContainer);

    // Dynamic role resolving
    const isAssignedAsLeader = db.assignments.some(a => a.volunteerId === currentUser.id && (a.role === 'CAP' || a.role === 'KM'));
    const isCap = (currentUser.responsibility === 'CAP' || isAssignedAsLeader);
    const isKm = (currentUser.responsibility === 'KM');

    // We pass filtered assignments to the specific renders!
    if (isKm) {
      renderKeymanView(filteredAssigns, roleContentContainer);
    } else if (isCap) {
      renderCaptainView(filteredAssigns, roleContentContainer);
    } else {
      renderIndicatorView(filteredAssigns, roleContentContainer);
    }

    // 6. Bind dropdown change listener
    const dateSelect = document.getElementById('dashboardDateSelect');
    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        activeDateFilter = e.target.value;
        renderRoleDashboard();
      });
    }

    // Bind dynamically rendered events
    document.querySelectorAll('.obs-popup-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRemarksModal(btn.dataset.name, btn.dataset.remarks);
      });
    });
  };

  // 1. INDICADOR VIEW
  const renderIndicatorView = (assigns, container) => {
    const target = container || dashboardContent;
    if (assigns.length === 0) {
      target.innerHTML = renderEmptyState('Sem escalas atribuídas', 'De momento não tens escalas atribuídas para o dia selecionado.');
      return;
    }

    // Sort assignments by shift date/time
    const sorted = [...assigns].map(a => {
      const sh = db.shifts.find(s => s.id === a.shiftId);
      const sec = db.sectors.find(s => s.id === a.sectorId);
      return { assign: a, shift: sh, sector: sec };
    }).filter(x => x.shift && x.sector)
      .sort((a,b) => a.shift.date.localeCompare(b.shift.date) || a.shift.startTime.localeCompare(b.shift.startTime));

    let html = `<h4 class="card-section-title">As Tuas Escalas (${sorted.length})</h4>`;

    sorted.forEach((item, idx) => {
      const sh = item.shift;
      const sec = item.sector;
      const roleText = item.assign.role === 'CAP' ? 'Capitão' : (item.assign.role === 'KM' ? 'Homem-Chave' : 'Indicador');

      // Find Captains of this sector/shift
      const captains = db.assignments
        .filter(a => a.shiftId === sh.id && a.sectorId === sec.id && a.role === 'CAP')
        .map(a => db.volunteers.find(v => v.id === a.volunteerId))
        .filter(Boolean);

      let capsHtml = '';
      if (captains.length > 0) {
        capsHtml = `
          <div style="margin-top:10px; border-top:1px dashed var(--surface-border); padding-top:10px;">
            <span class="card-section-title">Capitão do teu Turno</span>
            <div class="vol-row-list">
              ${captains.map(c => `
                <div class="vol-row-item">
                  <div class="vol-name-info">
                    <span class="vol-name">${esc(c.fullName)}</span>
                    <span class="vol-cong">${esc(c.congregation || 'Sem Congregação')}</span>
                  </div>
                  <div class="vol-actions">
                    ${c.phone ? `
                      <a href="tel:${c.phone}" class="btn-action-tactile phone" title="Ligar">📞</a>
                      <a href="https://wa.me/351${c.phone.replace(/[^0-9]/g,'')}?text=Olá!" target="_blank" class="btn-action-tactile wa" title="Enviar WhatsApp">💬</a>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`;
      }

      html += `
        <div class="scale-card scale-card-accent">
          <div class="scale-card-header">
            <div>
              <h3>${esc(sec.name)}</h3>
              <span class="scale-subsector">${esc(sec.subSector || 'Geral')}</span>
            </div>
            <span class="scale-time-badge">${sh.startTime}–${sh.endTime}</span>
          </div>
          <div class="scale-date-row">
            📅 <strong>${getWeekDay(sh.date)}</strong>, ${formatDate(sh.date)}
          </div>
          <div style="font-size:13px; color:var(--text-secondary);">
            Função: <span class="user-role-badge" style="background:var(--primary-light);color:var(--primary);">${roleText}</span>
          </div>
          ${capsHtml}
        </div>`;
    });

    target.innerHTML = html;
  };

  // 2. CAPITÃO VIEW
  const renderCaptainView = (assigns, container) => {
    const target = container || dashboardContent;
    
    if (assigns.length === 0) {
      target.innerHTML = renderEmptyState('Nenhum turno associado', 'De momento não estás escalado em nenhum turno ou setor como Capitão para o dia selecionado.');
      return;
    }

    const sorted = [...assigns].map(a => {
      const sh = db.shifts.find(s => s.id === a.shiftId);
      const sec = db.sectors.find(s => s.id === a.sectorId);
      return { assign: a, shift: sh, sector: sec };
    }).filter(x => x.shift && x.sector)
      .sort((a,b) => a.shift.date.localeCompare(b.shift.date) || a.shift.startTime.localeCompare(b.shift.startTime));

    let html = `<h4 class="card-section-title">Painel de Capitão (${sorted.length} Escalas)</h4>`;

    sorted.forEach((item, idx) => {
      const sh = item.shift;
      const sec = item.sector;

      // Find all team indicators assigned to this same shift and sector
      const sameSecAssigns = db.assignments.filter(a => a.shiftId === sh.id && a.sectorId === sec.id);
      
      const teamInds = sameSecAssigns
        .filter(a => !a.role || a.role === 'IND')
        .map(a => db.volunteers.find(v => v.id === a.volunteerId))
        .filter(Boolean);

      const teamKms = sameSecAssigns
        .filter(a => a.role === 'KM')
        .map(a => db.volunteers.find(v => v.id === a.volunteerId))
        .filter(Boolean);

      let teamHtml = '';
      if (teamInds.length > 0) {
        teamHtml = `
          <div style="margin-top:12px; border-top:1px dashed var(--surface-border); padding-top:10px;">
            <span class="card-section-title">A tua equipa de Indicadores (${teamInds.length})</span>
            <div class="vol-row-list">
              ${teamInds.map(i => {
                const isSister = !!i.isSister;
                const isTorni = i.responsibility && (i.responsibility.includes('TORNI') || i.responsibility.includes('Torniquete'));
                const rLabel = isTorni ? 'Torniquetes' : (isSister ? 'Irmã' : 'Indicador');
                const rClass = isTorni ? 'badge-torni' : (isSister ? 'badge-irma' : 'badge-ind');

                const obsIcon = i.additionalRemarks 
                  ? `<span class="obs-popup-trigger" data-name="${esc(i.fullName)}" data-remarks="${esc(i.additionalRemarks)}" style="cursor:pointer;font-size:13px;margin-left:4px;" title="Ver Observações">📝</span>` 
                  : '';

                return `
                  <div class="vol-row-item">
                    <div class="vol-name-info">
                      <div style="display:flex;align-items:center;">
                        <span class="vol-name">${esc(i.fullName)}</span>
                        <span class="resp-badge-small ${rClass}">${rLabel}</span>
                        ${obsIcon}
                      </div>
                      <span class="vol-cong">${esc(i.congregation || 'Sem Congregação')}</span>
                    </div>
                    <div class="vol-actions">
                      ${i.phone ? `
                        <a href="tel:${i.phone}" class="btn-action-tactile phone" title="Ligar">📞</a>
                        <a href="https://wa.me/351${i.phone.replace(/[^0-9]/g,'')}?text=Olá!" target="_blank" class="btn-action-tactile wa" title="Enviar WhatsApp">💬</a>
                      ` : ''}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      } else {
        teamHtml = `<p style="font-size:11.5px;color:var(--text-muted);margin-top:8px;">Nenhum indicador atribuído a este setor ainda.</p>`;
      }

      let kmsHtml = '';
      if (teamKms.length > 0) {
        kmsHtml = `
          <div style="margin-top:10px; border-top:1px dashed var(--surface-border); padding-top:8px;">
            <span class="card-section-title">Homem-Chave do Turno</span>
            <div class="vol-row-list">
              ${teamKms.map(k => `
                <div class="vol-row-item">
                  <div class="vol-name-info">
                    <span class="vol-name">${esc(k.fullName)}</span>
                    <span class="vol-cong">${esc(k.congregation || 'Sem Congregação')}</span>
                  </div>
                  <div class="vol-actions">
                    ${k.phone ? `
                      <a href="tel:${k.phone}" class="btn-action-tactile phone" title="Ligar">📞</a>
                      <a href="https://wa.me/351${k.phone.replace(/[^0-9]/g,'')}?text=Olá!" target="_blank" class="btn-action-tactile wa" title="Enviar WhatsApp">💬</a>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`;
      }

      html += `
        <div class="scale-card">
          <div class="scale-card-header">
            <div>
              <h3>${esc(sec.name)}</h3>
              <span class="scale-subsector">${esc(sec.subSector || 'Geral')}</span>
            </div>
            <span class="scale-time-badge">${sh.startTime}–${sh.endTime}</span>
          </div>
          <div class="scale-date-row">
            📅 <strong>${getWeekDay(sh.date)}</strong>, ${formatDate(sh.date)}
          </div>
          ${kmsHtml}
          ${teamHtml}
        </div>`;
    });

    target.innerHTML = html;
  };

  // 3. HOMEM-CHAVE VIEW
  const renderKeymanView = (assigns, container) => {
    const target = container || dashboardContent;

    if (assigns.length === 0) {
      target.innerHTML = renderEmptyState('Nenhum turno associado', 'De momento não estás atribuído em nenhum turno ou setor como Homem-Chave para o dia selecionado.');
      return;
    }

    const sorted = [...assigns].map(a => {
      const sh = db.shifts.find(s => s.id === a.shiftId);
      const sec = db.sectors.find(s => s.id === a.sectorId);
      return { assign: a, shift: sh, sector: sec };
    }).filter(x => x.shift && x.sector)
      .sort((a,b) => a.shift.date.localeCompare(b.shift.date) || a.shift.startTime.localeCompare(b.shift.startTime));

    let html = `<h4 class="card-section-title">Painel de Homem-Chave (${sorted.length} Escalas)</h4>`;

    sorted.forEach((item, idx) => {
      const sh = item.shift;
      const sec = item.sector;

      // Find all team indicators and captains assigned to this same shift and sector
      const sameSecAssigns = db.assignments.filter(a => a.shiftId === sh.id && a.sectorId === sec.id);
      
      const teamInds = sameSecAssigns
        .filter(a => !a.role || a.role === 'IND')
        .map(a => db.volunteers.find(v => v.id === a.volunteerId))
        .filter(Boolean);

      const teamCaps = sameSecAssigns
        .filter(a => a.role === 'CAP')
        .map(a => db.volunteers.find(v => v.id === a.volunteerId))
        .filter(Boolean);

      let capsHtml = '';
      if (teamCaps.length > 0) {
        capsHtml = `
          <div style="margin-top:10px; border-top:1px dashed var(--surface-border); padding-top:8px;">
            <span class="card-section-title">Capitão(es) do Setor (${teamCaps.length})</span>
            <div class="vol-row-list">
              ${teamCaps.map(c => `
                <div class="vol-row-item">
                  <div class="vol-name-info">
                    <span class="vol-name">${esc(c.fullName)}</span>
                    <span class="vol-cong">${esc(c.congregation || 'Sem Congregação')}</span>
                  </div>
                  <div class="vol-actions">
                    ${c.phone ? `
                      <a href="tel:${c.phone}" class="btn-action-tactile phone" title="Ligar">📞</a>
                      <a href="https://wa.me/351${c.phone.replace(/[^0-9]/g,'')}?text=Olá!" target="_blank" class="btn-action-tactile wa" title="Enviar WhatsApp">💬</a>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`;
      }

      let teamHtml = '';
      if (teamInds.length > 0) {
        teamHtml = `
          <div style="margin-top:12px; border-top:1px dashed var(--surface-border); padding-top:10px;">
            <span class="card-section-title">Indicadores do Setor (${teamInds.length})</span>
            <div class="vol-row-list">
              ${teamInds.map(i => {
                const isSister = !!i.isSister;
                const isTorni = i.responsibility && (i.responsibility.includes('TORNI') || i.responsibility.includes('Torniquete'));
                const rLabel = isTorni ? 'Torniquetes' : (isSister ? 'Irmã' : 'Indicador');
                const rClass = isTorni ? 'badge-torni' : (isSister ? 'badge-irma' : 'badge-ind');

                const obsIcon = i.additionalRemarks 
                  ? `<span class="obs-popup-trigger" data-name="${esc(i.fullName)}" data-remarks="${esc(i.additionalRemarks)}" style="cursor:pointer;font-size:13px;margin-left:4px;" title="Ver Observações">📝</span>` 
                  : '';

                return `
                  <div class="vol-row-item">
                    <div class="vol-name-info">
                      <div style="display:flex;align-items:center;">
                        <span class="vol-name">${esc(i.fullName)}</span>
                        <span class="resp-badge-small ${rClass}">${rLabel}</span>
                        ${obsIcon}
                      </div>
                      <span class="vol-cong">${esc(i.congregation || 'Sem Congregação')}</span>
                    </div>
                    <div class="vol-actions">
                      ${i.phone ? `
                        <a href="tel:${i.phone}" class="btn-action-tactile phone" title="Ligar">📞</a>
                        <a href="https://wa.me/351${i.phone.replace(/[^0-9]/g,'')}?text=Olá!" target="_blank" class="btn-action-tactile wa" title="Enviar WhatsApp">💬</a>
                      ` : ''}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      } else {
        teamHtml = `<p style="font-size:11.5px;color:var(--text-muted);margin-top:8px;">Nenhum indicador atribuído a este setor ainda.</p>`;
      }

      html += `
        <div class="scale-card scale-card-accent" style="border-left-color:var(--warning);">
          <div class="scale-card-header">
            <div>
              <h3>${esc(sec.name)}</h3>
              <span class="scale-subsector">${esc(sec.subSector || 'Geral')}</span>
            </div>
            <span class="scale-time-badge">${sh.startTime}–${sh.endTime}</span>
          </div>
          <div class="scale-date-row">
            📅 <strong>${getWeekDay(sh.date)}</strong>, ${formatDate(sh.date)}
          </div>
          ${capsHtml}
          ${teamHtml}
        </div>`;
    });

    target.innerHTML = html;
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
