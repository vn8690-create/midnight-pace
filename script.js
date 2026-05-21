// Kích hoạt tính năng chạy nền PWA ứng dụng độc lập
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Midnight Pace PWA đã sẵn sàng chạy nền!', reg.scope))
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
let wakeLock = null; // Biến giữ màn hình luôn sáng

// Thông tin tài khoản người dùng (Lưu trên máy)
let runnerProfile = { username: "Runner", weight: 60 };

// Hàm kiểm tra profile khi mở app
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadProfile();
    loadHistory();
    
    // Nút bấm lưu profile ban đầu
    document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
    
    // Nút điều khiển hành trình
    document.getElementById('btn-start').addEventListener('click', startTracking);
    document.getElementById('btn-stop').addEventListener('click', stopTracking);
    document.getElementById('ad-banner').addEventListener('click', clickAd);
});

// Bản đồ đêm Cyberpunk
function initMap() {
    map = L.map('map-container').setView([21.0285, 105.8542], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);
    routeLine = L.polyline([], { color: '#00ff9d', weight: 5, opacity: 0.8 }).addTo(map);
}

// Xử lý Profile tài khoản Local
function loadProfile() {
    const saved = localStorage.getItem('midnight_runner_profile');
    if (saved) {
        runnerProfile = JSON.parse(saved);
        document.getElementById('profile-modal').classList.add('d-none');
        document.getElementById('welcome-text').innerText = `⚡ Sẵn sàng hoạt động: @${runnerProfile.username} (${runnerProfile.weight} KG)`;
    }
}

function saveProfile() {
    const user = document.getElementById('username-input').value.trim();
    const weight = parseFloat(document.getElementById('weight-input').value);
    
    if (!user || !weight || isNaN(weight)) {
        alert("Vui lòng điền đầy đủ Biệt danh và Cân nặng hợp lệ bro ơi!");
        return;
    }
    
    runnerProfile = { username: user, weight: weight };
    localStorage.setItem('midnight_runner_profile', JSON.stringify(runnerProfile));
    document.getElementById('profile-modal').classList.add('d-none');
    document.getElementById('welcome-text').innerText = `⚡ Sẵn sàng hoạt động: @${runnerProfile.username} (${runnerProfile.weight} KG)`;
    addLog(`Đã thiết lập tài khoản: ${user}`);
}

// ĐÃ SỬA: Logic tính Calo chuẩn xác dựa trên số KM thực tế di chuyển
function updateStats() {
    document.getElementById('distance').innerText = totalDistance.toFixed(2);
    
    // Công thức sinh học: 1 KM tiêu thụ khoảng 1 Kcal trên mỗi KG trọng lượng cơ thể
    totalCalories = totalDistance * runnerProfile.weight * 1.03; 
    document.getElementById('calories').innerText = Math.round(totalCalories);
}

// TÍNH NĂNG PRO: Ép màn hình điện thoại luôn sáng để định vị liên tục
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            addLog("Đã kích hoạt chế độ chống ngủ màn hình 👁️");
        }
    } catch (err) {
        addLog("Hệ thống không hỗ trợ giữ màn hình sáng.");
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
        addLog("Đã tắt chế độ giữ màn hình.");
    }
}

// Bắt đầu chạy bộ
async function startTracking() {
    if (watchId) return;
    
    startTime = Date.now();
    totalDistance = 0;
    totalCalories = 0;
    pathCoords = [];
    routeLine.setLatLngs([]);
    lastCoord = null;
    
    document.getElementById('btn-start').classList.add('d-none');
    document.getElementById('btn-stop').className = "btn btn-cyber-red";
    
    // Gọi tính năng giữ màn hình luôn sáng
    await requestWakeLock();

    timerInterval = setInterval(() => {
        let diff = Date.now() - startTime;
        let hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
        let mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        let secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        document.getElementById('timer').innerText = `${hrs}:${mins}:${secs}`;
    }, 1000);

    addLog("Đang khóa mục tiêu vệ tinh GPS...");

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const currentPos = [lat, lng];

                if (lastCoord) {
                    let d = distanceHaversine(lastCoord[0], lastCoord[1], lat, lng);
                    
                    // Bộ lọc tối ưu bám sát đường chạy (>0.5 mét và chống nhảy tọa độ ảo)
                    if (d > 0.0005 && d < 0.3) { 
                        totalDistance += d;
                        updateStats(); // Chỉ cập nhật Calo khi số KM thực tế thay đổi
                    }
                } else {
                    addLog("Đã khóa GPS! Bắt đầu vẽ hành trình...");
                }

                lastCoord = currentPos;
                pathCoords.push(currentPos);
                routeLine.setLatLngs(pathCoords);
                map.setView(currentPos, 16);
            },
            (error) => { addLog("Lỗi: Định vị bị gián đoạn!"); },
            { 
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );
    }
}

// Kết thúc chạy bộ
function stopTracking() {
    if (!watchId) return;
    
    navigator.geolocation.clearWatch(watchId);
    clearInterval(timerInterval);
    watchId = null;
    
    // Giải phóng, cho phép màn hình khóa như bình thường
    releaseWakeLock();
    
    document.getElementById('btn-stop').className = "btn btn-cyber-red d-none";
    document.getElementById('btn-start').className = "btn btn-cyber-green";
    
    addLog(`Hành trình hoàn thành: ${totalDistance.toFixed(2)} KM.`);
    saveToHistory(totalDistance.toFixed(2), Math.round(totalCalories), document.getElementById('timer').innerText);
}

// Thuật toán đo khoảng cách chuẩn địa lý
function distanceHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Quản lý lưu trữ lịch sử
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

function addLog(message) {
    const list = document.getElementById('log-list');
    const li = document.createElement('li');
    li.innerText = `> ${message}`;
    list.appendChild(li);
    if (list.children.length > 4) list.removeChild(list.children[0]);
}

function clickAd() {
    const alertBox = document.getElementById('wallet-alert');
    if(alertBox) {
        alertBox.className = "wallet-alert";
        setTimeout(() => { alertBox.className = "wallet-alert d-none"; }, 3000);
    }
}
