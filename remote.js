const urlParams = new URLSearchParams(window.location.search);
const initialTargetId = urlParams.get('id');

let peer = null;
let conn = null;
let html5QrcodeScanner = null;

const setupScreen = document.getElementById('setup-screen');
const remoteScreen = document.getElementById('remote-screen');
const loader = document.getElementById('loader');
const peerIdInput = document.getElementById('peer-id-input');
const btnConnect = document.getElementById('btn-connect');
const btnScan = document.getElementById('btn-scan');
const btnDisconnect = document.getElementById('btn-disconnect');
const connectedIdEl = document.getElementById('connected-id');
const savedDevicesDiv = document.getElementById('saved-devices');
const devicesList = document.getElementById('devices-list');

function showLoader(text) {
    document.getElementById('loader-text').innerText = text;
    loader.style.display = 'flex';
}

function hideLoader() {
    loader.style.display = 'none';
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function getSavedDevices() {
    try {
        return JSON.parse(localStorage.getItem('cleaniptv_saved_devices') || '[]');
    } catch(e) {
        return [];
    }
}

function saveDevice(id) {
    const devices = getSavedDevices();
    if (!devices.includes(id)) {
        devices.unshift(id);
        if (devices.length > 5) devices.pop(); // Keep only last 5
        localStorage.setItem('cleaniptv_saved_devices', JSON.stringify(devices));
        renderSavedDevices();
    }
}

function removeDevice(id) {
    const devices = getSavedDevices();
    const newDevices = devices.filter(d => d !== id);
    localStorage.setItem('cleaniptv_saved_devices', JSON.stringify(newDevices));
    renderSavedDevices();
}

function renderSavedDevices() {
    const devices = getSavedDevices();
    if (devices.length === 0) {
        savedDevicesDiv.style.display = 'none';
        return;
    }
    
    savedDevicesDiv.style.display = 'block';
    devicesList.innerHTML = '';
    
    devices.forEach(id => {
        const li = document.createElement('li');
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = id;
        
        const btns = document.createElement('div');
        
        const connectBtn = document.createElement('button');
        connectBtn.className = 'device-connect-btn';
        connectBtn.innerText = 'Conectar';
        connectBtn.onclick = () => connectToPeer(id);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'device-remove-btn';
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        removeBtn.onclick = () => removeDevice(id);
        
        btns.appendChild(connectBtn);
        btns.appendChild(removeBtn);
        
        li.appendChild(nameSpan);
        li.appendChild(btns);
        devicesList.appendChild(li);
    });
}

function initializePeer(targetId) {
    showLoader('Iniciando conexão segura...');
    
    // Destroy previous instance if any
    if (peer) peer.destroy();
    
    peer = new Peer(); // Auto generate my ID
    
    peer.on('open', (id) => {
        hideLoader();
        if (targetId) {
            connectToPeer(targetId);
        }
    });
    
    peer.on('error', (err) => {
        hideLoader();
        alert('Erro de conexão: ' + err.message);
        disconnect();
    });
}

function connectToPeer(targetId) {
    if (!targetId) return;
    
    showLoader('Conectando a ' + targetId + '...');
    
    // Cleanup old connection
    if (conn) {
        conn.close();
    }
    
    conn = peer.connect(targetId);
    
    conn.on('open', () => {
        hideLoader();
        saveDevice(targetId);
        connectedIdEl.innerText = targetId;
        showScreen('remote-screen');
        
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(50);
    });
    
    conn.on('close', () => {
        alert('A conexão com a TV foi encerrada.');
        disconnect();
    });
    
    conn.on('error', (err) => {
        hideLoader();
        alert('Falha na conexão: ' + err.message);
        disconnect();
    });
}

function disconnect() {
    if (conn) {
        conn.close();
        conn = null;
    }
    showScreen('setup-screen');
    renderSavedDevices();
}

function sendCommand(key) {
    if (key === 'SEARCH') {
        const query = prompt("Digite o que deseja buscar na TV:");
        if (query !== null) {
            if (conn && conn.open) {
                conn.send({ command: 'SEARCH', query: query });
                if (navigator.vibrate) navigator.vibrate(20);
            }
        }
        return;
    }

    if (conn && conn.open) {
        conn.send({ command: key });
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(20);
    }
}

// Event Listeners
btnConnect.addEventListener('click', () => {
    const val = peerIdInput.value.trim();
    if (val) {
        if (!peer) {
            initializePeer(val);
        } else {
            connectToPeer(val);
        }
    }
});

btnDisconnect.addEventListener('click', () => {
    disconnect();
});

btnScan.addEventListener('click', () => {
    const reader = document.getElementById('reader');
    reader.style.display = 'block';
    
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", { fps: 10, qrbox: {width: 250, height: 250} }, /* verbose= */ false);
            
        html5QrcodeScanner.render((decodedText, decodedResult) => {
            // Decoded text could be a full URL: https://.../?id=TV-ABCD
            html5QrcodeScanner.clear();
            reader.style.display = 'none';
            
            let id = decodedText;
            try {
                const url = new URL(decodedText);
                id = url.searchParams.get('id') || decodedText;
            } catch(e) {}
            
            peerIdInput.value = id;
            if (!peer) {
                initializePeer(id);
            } else {
                connectToPeer(id);
            }
        }, (error) => {
            // parse error, ignore
        });
    }
});

document.querySelectorAll('.dpad-btn, .control-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        sendCommand(btn.getAttribute('data-key'));
    });
});

// Init
renderSavedDevices();
if (initialTargetId) {
    initializePeer(initialTargetId);
} else {
    initializePeer(); // Just open peer connection to be ready
}
