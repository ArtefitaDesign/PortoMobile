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

  const DEFAULT_LOGO_SVG = `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 215.547506 254.937016" style="width:120px;height:auto;display:block;margin:0 auto;"><g><path d="M155.656514,107.216707c-1.176208,5.37561-2.425293,10.225342-3.539429,14.216736-.814697,2.91687-4.762085,3.493164-6.283386.876709-3.110596-5.350525-9.650208-10.914673-23.364258-11.768799-1.785156-.111267-3.587463-.127319-5.393433-.094666v32.647583c32.134583-2.728699,59.899048-12.828918,76.807068-26.495361.594055-.479614,1.474854-.00238,1.395569.756653-2.122986,20.455811-21.354614,38.86908-49.340027,49.549622,6.77179,1.302856,13.639587,2.210449,20.577942,2.210449,5.766907,0,10.468872-.123718,14.343384-.978821,2.408875-.531677,3.396912-1.805725,3.566223-3.474548.169373-1.667053-.765808-3.763794-4.645935-4.5271-2.887634-.568054-5.905823-1.106323-5.905823-2.433655,0-1.123352,1.470032-1.887573,5.362549-2.358826,3.103088-.375488,10.15387-.769043,15.216553-2.264709,11.13031-3.287598,21.093994-13.097961,21.093994-31.831299v-12.494446l-59.890991-1.535522Z" fill="#91cae0" /><path d="M70.049154,116.126497c.704224-1.350769,1.433228-2.878662,2.165466-4.559692-9.503662,3.075439-18.586243,7.387085-26.99939,12.847534l-14.931091,15.875122c4.798035,1.216675,9.835144,2.229919,15.070801,3.021423-.07843-.799927-.123291-1.622986-.123291-2.466919,0-6.031128,2.086182-11.135864,4.951416-12.313721,1.333557-.548828,2.86084-.983215,4.575867-1.383545-1.85553,2.929688-3.027771,7.868286-3.027771,13.694458,0,1.146606.046875,2.257141.134155,3.326416.662537.07489,1.327515.146545,1.9953.214172-.104492-1.121338-.166138-2.30072-.166138-3.540588,0-7.525635,2.09375-13.055115,4.261597-14.32019,1.848389-.264648,3.912109-.411133,5.601562-.420349,1.183044.006409,2.549805.080872,3.898132.214966-2.192261,2.76355-3.615479,8.106506-3.615479,14.525574,0,1.494446.080078,2.92688.226196,4.285645.662537.030457,1.324341.062439,1.990906.08606-.160156-1.361511-.253418-2.820801-.253418-4.371704,0-7.322632,1.982056-12.752441,4.085876-14.205688.397522.066467.785461.136108,1.146973.213745,1.088928.232605,2.102173.472046,3.049805.733032-1.702637,2.97052-2.764771,7.712585-2.764771,13.258911,0,1.570923.093689,3.067383.254639,4.487427.655762.004822,1.315125.003174,1.974487.001587-.168945-1.393555-.265869-2.89447-.265869-4.489014,0-5.684021,1.194641-10.227905,2.713562-12.657166.317017.112488.635742.223389.93396.346252,2.865234,1.177856,4.951416,6.282593,4.951416,12.313721,0,1.510498-.131287,2.962891-.373108,4.310852.853516-.036011,1.709473-.077271,2.56781-.124512-.146973-1.309082-.231445-2.707886-.231445-4.189148,0-7.322632,1.982117-12.752441,4.086304-14.205688.397156.066467.785461.136108,1.146545.213745,1.089355.232605,2.102234.472046,3.050232.733032-1.702637,2.97052-2.765137,7.712585-2.765137,13.258911,0,1.347534.065247,2.645447.184509,3.884094.62738-.035217,1.283508-.071655,1.964905-.110107-.118896-1.188965-.186157-2.448853-.186157-3.773987,0-5.684021,1.194641-10.227905,2.713501-12.657166.317078.112488.635742.223389.934021.346252,2.865234,1.177856,4.951416,6.282593,4.951416,12.313721,0,1.144165-.076111,2.2547-.217407,3.312439,3.907715-.218994,7.626892-.427185,10.003723-.560913v-32.676819c-13.676025,1.496094-26.934937,6.097778-35.615967,9.685242-2.777527,1.147766-5.441833-1.805542-4.048645-4.477417ZM81.601034,126.100985c1.183411.006042,2.550171.080505,3.898132.2146-1.225098,1.544128-2.206726,3.897339-2.836426,6.790588-1.074951-3.170288-2.817627-5.501465-4.983032-6.391418-.262268-.107727-.5401-.207031-.818726-.305908,1.610168-.193359,3.309204-.300232,4.740051-.307861Z" fill="#91cae0" /></g><path d="M145.750457,166.867741c.000801.001201.001601.002002.002802.003203.043637.008407.087675.015813.131712.024421-.044838-.008808-.089676-.018816-.134515-.027624Z" fill="#979797" /><path d="M215.541899,29.629453v-8.094494l-62.59171,7.919745c1.683434,3.707558,3.13467,8.217199,4.305267,13.667441l3.824057,3.635897-2.870445,1.393387c.100886.605716.202973,1.206628.297854,1.832761l3.948563-1.912029,5.809748,5.521102c-3.147881-1.147577-6.37503-2.119005-9.661028-2.919286.259021,1.769307.497624,3.605471.707403,5.537516,4.037038,1.087326,7.941164,2.462898,11.685553,4.116506.194566.085072.388331.171346.582096.25802.314268.141721.627735.284242.9396.429766.513237.237602,1.023272.48141,1.530904.730022.04644.022619.092879.045038.138918.067858,1.957667.96322,3.870897,2.005108,5.73008,3.128064.032027.019216.064455.038032.096482.057249.291849.176951.580895.357905.869941.538659.954813.590303,1.900819,1.193416,2.828409,1.821351l-.028424.012811c.004404.003203.009208.006005.013612.009208v30.085424l-26.133058.052044c-.377121,2.164443-.779464,4.283048-1.198621,6.338399l59.1748,1.51489v-15.520619l-8.179767-19.726401,8.179767-3.712362v-10.518158c-9.559342-6.062363-19.705584-11.02439-30.062004-14.613246v-8.451799l30.062004-3.199725ZM157.963659,41.330419c1.325529.15213,2.652259.321073,3.980991.522845,2.260725.342892,4.492626.76325,6.701708,1.238855l-5.852985,2.836816-4.829714-4.598517ZM169.50589,52.315975l-5.336946-5.078926,5.336946-2.585602v7.664528ZM175.352469,51.020272l-4.065863,1.958868v-7.160899l4.065863,5.202031ZM172.031641,43.87939c3.786825.941202,7.492381,2.071765,11.108261,3.388886l-6.147636,2.959721-4.960625-6.348607ZM171.514,54.840125l4.956221-2.382829,6.037142,7.731985c-3.537413-2.020521-7.210141-3.807643-10.993363-5.349156ZM183.698778,58.819715l-5.582755-7.154694,5.582755-2.690091v9.844785ZM183.698778,40.676662c-7.654119-2.529554-15.410726-4.297861-23.120092-5.202031,5.532712-.582496,17.912456-1.898417,23.120092-2.455091v7.657122ZM185.479895,97.462828v-28.841164c10.497741,7.513599,19.101069,17.404424,25.210672,28.790922l-25.210672.050243ZM185.479895,61.951782l4.986647-2.554776,6.233709,10.692307c-3.537413-2.984742-7.290209-5.705459-11.220357-8.137531ZM212.434853,87.00452c-3.609875-4.958223-7.671734-9.539525-12.114318-13.683855l5.420216-2.459895,6.694101,16.14375ZM214.557061,64.905498l-7.876709,3.574845-5.204433-12.550489c4.562686,2.685687,8.928805,5.686643,13.081141,8.975645ZM199.678788,70.605152v-14.362833l5.379782,12.97385-5.379782,2.44168v-1.052697ZM197.891666,68.609252l-5.840575-10.022937,5.840575-2.990947v13.013884ZM197.607825,53.746994l-6.453497,3.298009-5.046298-8.64196c3.946561,1.568536,7.785031,3.350253,11.499795,5.343952ZM189.563773,57.861699l-4.083878,2.088179v-9.095547l4.083878,7.007368Z" fill="#2f358f" /><path d="M127.937829,166.289964c-10.585831-2.582335-20.584901-5.021472-29.322316-5.021472-9.181107,0-15.368651,1.106629-21.918996,2.277967-7.197471,1.287572-14.640634,2.618883-26.59376,2.618883-5.36455,0-9.724906-.150884-13.356233-.403437-.344873-.023985-.459818.449012-.141973.583996,17.569144,7.461365,39.738407,11.296142,63.59603,9.967087,13.765196-.768058,26.776462-3.183435,38.515127-6.886747.299052-.094345.275171-.5212-.030972-.589561-3.616901-.807647-7.199053-1.681437-10.746907-2.546715Z" fill="#2f358f" /><g><polygon points="117.076037 0 109.713855 0 109.713855 12.241638 117.076037 12.700073 117.076037 0" fill="#472e13" /><path d="M76.861194,126.408936c.278564.098877.556274.19812.818481.305847,0,0,0,.000061.000122.000061,2.165405.889954,3.907959,3.220825,4.983032,6.391052.629761-2.893127,1.611328-5.246155,2.836304-6.790161-.307251-.03064-.615112-.05719-.921875-.081482-1.039185-.082214-2.0625-.128601-2.976196-.13324-.696777.003723-1.458252.031799-2.240967.081116-.824585.052002-1.672852.127625-2.498901.226807Z" fill="#472e13" /><path d="M193.883044,116.598938c-16.907959,13.666443-44.672363,23.766663-76.807007,26.495361v-32.647583c-2.452515.04425-4.912476.203979-7.362183.471985v32.676819c-2.376953.133728-6.096069.341919-10.003784.560913.141235-1.057739.217407-2.168274.217407-3.312439,0-6.031128-2.086182-11.135864-4.951416-12.313721-.29834-.122864-.616943-.233765-.934082-.346252-1.518799,2.42926-2.713379,6.973145-2.713379,12.657166,0,1.325134.067139,2.585022.186035,3.773987-.681396.038452-1.337402.07489-1.964844.110107-.119263-1.238647-.18457-2.53656-.18457-3.884094,0-5.546326,1.0625-10.288391,2.765137-13.258911-.947998-.260986-1.960815-.500427-3.050171-.733032-.361084-.077637-.74939-.147278-1.146606-.213745-2.104126,1.453247-4.086182,6.883057-4.086182,14.205688,0,1.481262.084473,2.880066.231445,4.189148-.858398.047241-1.714355.088501-2.567871.124512.241821-1.347961.373047-2.800354.373047-4.310852,0-6.031128-2.086182-11.135864-4.951416-12.313721-.298096-.122864-.616943-.233765-.933838-.346252-1.519043,2.42926-2.713623,6.973145-2.713623,12.657166,0,1.594543.096924,3.095459.265869,4.489014-.659424.001587-1.318726.003235-1.974487-.001587-.161011-1.420044-.254639-2.916504-.254639-4.487427,0-5.546326,1.062134-10.288391,2.764771-13.258911-.947632-.260986-1.960938-.500427-3.049805-.733032-.361572-.077637-.749512-.147278-1.146973-.213745-2.10376,1.453247-4.085938,6.883057-4.085938,14.205688,0,1.550903.093262,3.010193.253418,4.371704-.666504-.023621-1.328369-.055603-1.990845-.08606-.146118-1.358765-.226196-2.791199-.226196-4.285645,0-6.419067,1.423218-11.762024,3.615479-14.525574-1.348389-.134094-2.715088-.208557-3.898193-.214966-1.689453.009216-3.753174.155701-5.601562.420349-2.167725,1.265076-4.261475,6.794556-4.261475,14.32019,0,1.239868.061523,2.41925.166016,3.540588-.667725-.067627-1.332764-.139282-1.995239-.214172-.08728-1.069275-.134155-2.17981-.134155-3.326416,0-5.826172,1.172241-10.764771,3.027832-13.694458-1.715088.40033-3.242432.834717-4.575928,1.383545-2.865234,1.177856-4.951416,6.282593,4.951416,12.313721,0,.843933.044922,1.666992.123291,2.466919-5.235596-.791504-10.272705-1.804749-15.070801-3.021423l48.580078-51.651184c.465698-2.656433.876465-5.461426,1.207886-8.448181l-55.144531,58.630554c-8.934448-2.652283-16.911255-6.042358-23.629761-10.037354-.656128-.389954-1.460815.215393-1.269043.953979,2.042969,7.856689,6.677734,15.077271,13.333008,21.380249L.08446,165.234375c-.190186.202148-.036499.530457.240234.511597,1.894287-.128113,3.914795-.207764,6.100342-.227356.08252-.000793.162842-.034851.21936-.095276l10.40564-11.063049c2.852539,2.315979,5.994751,4.486206,9.397217,6.492371.082886.048828.171753.083618.266235.103271,4.864136,1.012878,11.694458,1.835144,24.053345,1.835144,11.562256,0,18.79834-1.303894,25.796387-2.565002,6.654053-1.199829,12.938965-2.33197,22.353394-2.33197,9.080933,0,19.197876,2.486511,29.908569,5.118347,5.621704,1.381592,11.331299,2.781616,17.11145,3.893311,27.986206-10.680298,47.218628-29.093933,49.342041-49.550171.079224-.759033-.801514-1.236267-1.39563-.756653Z" fill="#472e13" /></g><path d="M80.709601,72.796379c1.617078-26.166145-8.086302-47.600217-13.614944-57.507311-1.424373-2.552416.538073-5.668651,3.446589-5.487486l61.662918,3.840856c13.460401.838421,24.94742,10.782061,27.714598,49.348087,1.489788,20.763103-3.959946,44.681273-7.801851,58.442907-.814347,2.916975-4.761979,3.493121-6.283116.876853-3.110924-5.35061-9.650344-10.914775-23.364332-11.768991-17.742806-1.105163-36.990592,5.35933-48.371544,10.062521-2.777724,1.147898-5.441761-1.805454-4.048744-4.477357,4.225818-8.105408,9.344013-22.029063,10.660424-43.33008Z" fill="#c4942c" /><g><g><path d="M89.492411,250.036889c-.394929,0-.727614.139513-.989469.414246-.261855.272587-.392783.596687-.392783.968006,0,.002146,0,.057952-.083708.208196-.053659.092293-.143806.171708-.287611.244684-.173855.107318-.382051.139513-.650345.105171-.287611-.038634-.616004-.156684-.970152-.347709l-.418539-.238245c-.553759-.319807-1.068884-.585955-1.530351-.789858-.485076-.214635-.98303-.349856-1.478838-.403515-.497954-.057952-1.043128-.027903-1.611912.081561-.225367.045073-.463613.103025-.716882.180294.626735-.50654,1.438057-1.002347,2.421088-1.485277.384197-.191026.811322-.392783,1.281374-.600979.635321-.283319,1.326447-.603126,2.066939-.965859.75337-.367027,1.468106-.828493,2.122744-1.367228.66537-.54732,1.223422-1.201958,1.661278-1.946743.444295-.761956.669663-1.669864.669663-2.695821,0-.931518-.18244-1.80723-.538735-2.605674-.358441-.798444-.864981-1.493863-1.504594-2.069086-.64176-.577369-1.408008-1.034543-2.277282-1.358642-.87142-.328392-1.835133-.493662-2.865383-.493662-1.704205,0-3.165873.448588-4.344221,1.335032-1.178349.886444-2.032598,2.169964-2.539137,3.822657-.107318.36488-.079415.721175.083708,1.051714.165269.345563.440003.577369.815615.686833.369173.107318.725468.075122,1.060299-.098732.34127-.178147.568784-.455027.678248-.8242.650345-2.157086,2.039037-3.206653,4.245489-3.206653.652492,0,1.262056.096586,1.809377.287611.54732.191026,1.017372.452881,1.401569.781273.379905.321953.680394.716882.892883,1.171909.208196.452881.315514.963713.315514,1.519619,0,.53015-.115903,1.004494-.345563,1.405862-.238245.418539-.575223.80059-.998055,1.133275-.442149.347709-.970152.680394-1.564692.987323-.637467.326246-1.298544.643906-1.963914.940103-.244684.107318-.489369.212489-.725468.319807-.242538.107318-.472198.214635-.68898.321953-.579516.298343-1.201958.652492-1.850157,1.051714-.656784.405661-1.268495.890737-1.817962,1.438057-.555906.558052-1.021665,1.201958-1.382252,1.916694-.369173.727614-.555906,1.556107-.555906,2.457576,0,.540881.242538.955128.676102,1.178349.362734.246831.867127.285465,1.365081.038634,1.010933-.558052,1.832987-.970152,2.438259-1.227715.598833-.251123,1.111812-.394929,1.526058-.424978.397076-.040781.770541.025756,1.105372.173855.373466.163123.80059.379905,1.298544.654638l.431417.268294c.512979.294051,1.004494.493662,1.461667.596687.382051.085854.7362.128781,1.051714.128781.062244,0,.122342-.002146.180294-.004293.373466-.019317.695419-.075122.98303-.171708.283319-.09444.525857-.199611.719029-.315514.491515-.304782.899322-.716882,1.210544-1.225568.315514-.517271.476491-1.062445.476491-1.620498,0-.369173-.133074-.695419-.392783-.965859-.264002-.27688-.588101-.416393-.963713-.416393Z" fill="#c4942c" /><path d="M107.511056,237.641693v-.002146c-.693272-.890737-1.53679-1.590449-2.506942-2.077671-.972299-.493662-2.064793-.742639-3.249581-.742639-1.214837,0-2.328794.240392-3.311825.71259-.98303.474344-1.828694,1.156885-2.509088,2.030451-.680394.87142-1.206251,1.940304-1.562546,3.176604-.358441,1.234154-.538735,2.627138-.538735,4.140318,0,1.496009.180294,2.876115.538735,4.099537.358441,1.229861.888591,2.298746,1.575424,3.176604.693272.884298,1.541082,1.575424,2.524113,2.056207.980884.480783,2.08411.725468,3.283922.725468,1.216983,0,2.326648-.240392,3.298947-.71259.974445-.474344,1.813669-1.156885,2.49621-2.028305.678248-.87142,1.204105-1.942451,1.564692-3.178751.358441-1.232007.538735-2.624991.538735-4.138171,0-1.472399-.186733-2.839627-.551613-4.063049-.369173-1.219129-.903615-2.288014-1.590449-3.174458ZM101.754533,252.331342c-.980884,0-1.813669-.214635-2.474747-.64176-.673955-.431417-1.227715-1.002347-1.639815-1.691327-.424978-.701858-.731907-1.502448-.91864-2.380307-.188879-.892883-.283319-1.813669-.283319-2.738748,0-.369173.021464-.817761.066537-1.337179.040781-.519418.126635-1.064592.257563-1.620498.126635-.555906.311221-1.111812.549467-1.654839.233953-.532296.549467-1.010933.937957-1.425179.386344-.409954.873566-.75337,1.446643-1.019518.566638-.264002,1.25991-.397076,2.058354-.397076.95942,0,1.78362.223221,2.446844.66537.673955.450734,1.227715,1.038836,1.644107,1.744986.422832.721175.72976,1.528204.916493,2.397478.188879.882152.283319,1.772889.283319,2.646455,0,.294051-.017171.686833-.051513,1.180495-.034342.485076-.113757,1.013079-.231806,1.568985-.118049.553759-.296197,1.118251-.525857,1.680595-.227514.551613-.538735,1.058153-.931518,1.506741-.384197.444295-.87142.811322-1.453082,1.094641-.573077.279026-1.277081.420685-2.096988.420685Z" fill="#c4942c"Z>`;

  const applyCustomLogo = () => {
    const savedLogo = localStorage.getItem('porto2026_custom_logo');
    if (appLogoContainer) {
      if (savedLogo) {
        appLogoContainer.innerHTML = `<img src="${savedLogo}" style="max-height: 85px; max-width: 140px; object-fit: contain; margin-top: 4px; border: none; outline: none; background: none;">`;
      } else {
        appLogoContainer.innerHTML = DEFAULT_LOGO_SVG;
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
