// Kích hoạt tính năng chạy nền PWA ứng dụng độc lập
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Midnight Pace PWA đã sẵn sàng!', reg.scope))
      .catch(err => console.log('Lỗi đăng ký PWA:', err));
  });
}

// Khởi tạo các biến toàn cục
let map, routeLine;
let watchId = null;
let startTime = null;
let timerInterval = null;
let totalDistance = 0;
let totalCalories = 0;
let lastCoord = null;
let pathCoords = [];
let wakeLock = null;

// Thông tin tài khoản người dùng
let runnerProfile = { username: "Runner", weight: 60 };

window.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadProfile();
    loadHistory();
    
    // Sự kiện nút bấm
    document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
    document.getElementById('btn-start').addEventListener('click', startTracking);
    document.getElementById('btn-stop').addEventListener('click', stopTracking);
    document.getElementById('btn-share-fb').addEventListener('click', shareToFacebook);
});

function initMap() {
    map = L.map('map-container').setView([35.6895, 139.6917], 15); // Mặc định tọa độ bên Nhật cho bro luôn
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);
    routeLine = L.polyline([], { color: '#00ff9d', weight: 5, opacity: 0.8 }).addTo(map);
}

function loadProfile() {
    const saved = localStorage.getItem('midnight_runner_profile');
    if (saved) {
        runnerProfile = JSON.parse(saved);
        document.getElementById('profile-modal').classList.add('d-none');
        updateWelcomeText();
    }
}

function saveProfile() {
    const user = document.getElementById('username-input').value.trim();
    const weight = parseFloat(document.getElementById('weight-input').value);
    
    if (!user || !weight || isNaN(weight)) {
        alert("Điền đầy đủ thông tin đi bro ơi!");
        return;
    }
    
    runnerProfile = { username: user, weight: weight };
    localStorage.setItem('midnight_runner_profile', JSON.stringify(runnerProfile));
    document.getElementById('profile-modal').classList.add('d-none');
    updateWelcomeText();
    addLog(`Đã khởi tạo đặc vụ: ${user}`);
}

// LOGIC TÍNH TỔNG KM ĐỂ PHÂN HẠNG (RANK) CHUẨN PRO
function updateWelcomeText() {
    const history = JSON.parse(localStorage.getItem('midnight_history')) || [];
    // Tính tổng số KM bro đã từng chạy từ trước đến nay
    let grandTotalKM = history.reduce((sum, item) => sum + parseFloat(item.km || 0), 0);
    
    let rankName = "TÂN BINH BÓNG ĐÊM 🔰";
    if (grandTotalKM >= 5 && grandTotalKM < 15) rankName = "THỢ SĂN VỆT SÁNG ⚡";
    if (grandTotalKM >= 15 && grandTotalKM < 50) rankName = "QUÁI KIỆT CYBER 🔥";
    if (grandTotalKM >= 50) rankName = "HUYỀN THOẠI MIDNIGHT 🌌";

    document.getElementById('welcome-text').innerHTML = `
        <span style="color: #00d2ff;">👤 @${runnerProfile.username}</span> | 
        <span style="color: #ff0055; font-weight: bold; text-shadow: 0 0 5px #ff0055;">Cấp bậc: ${rankName}</span>
        <br><small style="color: #718096;">(Tổng tích lũy: ${grandTotalKM.toFixed(2)} KM)</small>
    `;
}

function updateStats() {
    document.getElementById('distance').innerText = totalDistance.toFixed(2);
    totalCalories = totalDistance * runnerProfile.weight * 1.03; 
    document.getElementById('calories').innerText = Math.round(totalCalories);
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            addLog("Đã khóa màn hình chống ngủ ngầm 👁️");
        }
    } catch (err) {}
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => { wakeLock = null; });
    }
}

function startTracking() {
    if (watchId) return;
    
    startTime = Date.now();
    totalDistance = 0;
    totalCalories = 0;
    pathCoords = [];
    routeLine.setLatLngs([]);
    lastCoord = null;
    
    document.getElementById('btn-start').classList.add('d-none');
    document.getElementById('btn-stop').className = "btn btn-cyber-red";
    document.getElementById('share-panel').classList.add('d-none'); // Ẩn bảng chia sẻ cũ đi
    
    requestWakeLock();

    timerInterval = setInterval(() => {
        let diff = Date.now() - startTime;
        let hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
        let mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        let secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        document.getElementById('timer').innerText = `${hrs}:${mins}:${secs}`;
    }, 1000);

    addLog("Đang kết nối GPS...");

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const currentPos = [lat, lng];

                if (lastCoord) {
                    let d = distanceHaversine(lastCoord[0], lastCoord[1], lat, lng);
                    if (d > 0.0005 && d < 0.3) { 
                        totalDistance += d;
                        updateStats();
                    }
                } else {
                    addLog("Đã khóa định vị! Bắt đầu chạy...");
                }

                lastCoord = currentPos;
                pathCoords.push(currentPos);
                routeLine.setLatLngs(pathCoords);
                map.setView(currentPos, 16);
            },
            (error) => { addLog("Lỗi tín hiệu GPS yếu!"); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }
}

// SỬA: Khi bấm dừng, chụp lại màn hình thành tích kèm bản đồ rồi hiện nút chia sẻ
function stopTracking() {
    if (!watchId) return;
    
    navigator.geolocation.clearWatch(watchId);
    clearInterval(timerInterval);
    watchId = null;
    
    releaseWakeLock();
    
    document.getElementById('btn-stop').className = "btn btn-cyber-red d-none";
    document.getElementById('btn-start').className = "btn btn-cyber-green";
    
    addLog(`Hành trình hoàn thành: ${totalDistance.toFixed(2)} KM.`);
    
    // Lưu vào lịch sử và cập nhật lại Rank ngay lập tức
    saveToHistory(totalDistance.toFixed(2), Math.round(totalCalories), document.getElementById('timer').innerText);
    updateWelcomeText();

    // KICH HOẠT QUẢ CHỤP ẢNH CHIA SẺ VINH QUANG
    addLog("Hệ thống đang đóng gói hình ảnh thành tích...");
    setTimeout(() => {
        const zone = document.getElementById('capture-zone');
        html2canvas(zone, {
            useCORS: true,
            backgroundColor: "#0d0e15"
        }).then(canvas => {
            const previewZone = document.getElementById('preview-image-zone');
            previewZone.innerHTML = ""; // Xóa ảnh cũ
            
            const img = new Image();
            img.src = canvas.toDataURL('image/png');
            img.style.width = "100%";
            img.style.borderRadius = "8px";
            img.style.border = "1px solid #00ff9d";
            previewZone.appendChild(img);
            
            // Hiện bảng chia sẻ lên
            document.getElementById('share-panel').classList.remove('d-none');
            addLog("Đã tạo ảnh thống kê thành công!");
        });
    }, 1000);
}

function distanceHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              ...Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function saveToHistory(km, kcal, duration) {
    const history = JSON.parse(localStorage.getItem('midnight_history')) || [];
    const today = new Date();
    const dateStr = `${today.getDate()}/${today.getMonth() + 1} ${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')}`;
    
    const newRecord = { date: dateStr, km: km, kcal: kcal, time: duration };
    history.unshift(newRecord);
    localStorage.setItem('midnight_history', JSON.stringify(history));
    
    loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('midnight_history')) || [];
    const list = document.getElementById('history-list');
    const emptyText = document.getElementById('history-empty');
    
    list.innerHTML = "";
    if (history.length === 0) {
        emptyText.className = "history-empty";
        return;
    }
    
    emptyText.className = "history-empty d-none";
    history.slice(0, 5).forEach(item => {
        const li = document.createElement('li');
        li.className = "history-item";
        li.innerHTML = `
            <span class="history-date"><i class="fa-regular fa-calendar"></i> ${item.date}</span>
            <span class="history-data">${item.km} KM | ${item.kcal} KCAL | ${item.time}</span>
        `;
        list.appendChild(li);
    });
}

function shareToFacebook() {
    // Mở nhanh Facebook để người dùng dán ảnh vừa lưu vào đăng bài
    window.open('https://www.facebook.com/', '_blank');
}

function addLog(message) {
    const list = document.getElementById('log-list');
    const li = document.createElement('li');
    li.innerText = `> ${message}`;
    list.appendChild(li);
    if (list.children.length > 4) list.removeChild(list.children[0]);
}
