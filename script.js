// Khởi tạo các biến toàn cục
let map, routeLine;
let watchId = null;
let startTime = null;
let timerInterval = null;
let totalDistance = 0;
let totalCalories = 0;
let lastCoord = null;
let pathCoords = [];

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

// Bản đồ thô sơ ban đầu
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

// Logic Tính Calo theo công thức MET khoa học
function updateStats() {
    document.getElementById('distance').innerText = totalDistance.toFixed(2);
    
    // Tính Calo: Giả lập vận tốc chạy bộ thông thường có chỉ số MET = 8.0
    if (startTime) {
        let elapsedMinutes = (Date.now() - startTime) / 60000;
        totalCalories = elapsedMinutes * ((8.0 * 3.5 * runnerProfile.weight) / 200);
        document.getElementById('calories').innerText = Math.round(totalCalories);
    }
}

// Bắt đầu chạy bộ
function startTracking() {
    if (watchId) return;
    
    startTime = Date.now();
    totalDistance = 0;
    totalCalories = 0;
    pathCoords = [];
    routeLine.setLatLngs([]);
    lastCoord = null;
    
    document.getElementById('btn-start').classList.add('d-none');
    document.getElementById('btn-stop').classList.remove('d-none');
    
    // Chạy bộ bấm giờ liên tục
    timerInterval = setInterval(() => {
        let diff = Date.now() - startTime;
        let hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
        let mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        let secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        document.getElementById('timer').innerText = `${hrs}:${mins}:${secs}`;
        updateStats();
    }, 1000);

    addLog("Đang kết nối vệ tinh GPS...");

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const currentPos = [lat, lng];

                if (lastCoord) {
                    // Thuật toán Haversine đo khoảng cách chuẩn hệ tọa độ địa lý trái đất
                    let d = distanceHaversine(lastCoord[0], lastCoord[1], lat, lng);
                    if (d > 0.002) { 
                        totalDistance += d;
                        addLog(`Di chuyển: +${(d*1000).toFixed(0)} mét`);
                    }
                } else {
                    addLog("Đã khóa mục tiêu vị trí!");
                }

                lastCoord = currentPos;
                pathCoords.push(currentPos);
                routeLine.setLatLngs(pathCoords);
                map.setView(currentPos, 16);
                updateStats();
            },
            (error) => { addLog("Lỗi: Không tìm thấy tín hiệu định vị!"); },
            { enableHighAccuracy: true, distanceFilter: 1 }
        );
    }
}

// Kết thúc chạy bộ và Lưu lịch sử
function stopTracking() {
    if (!watchId) return;
    
    navigator.geolocation.clearWatch(watchId);
    clearInterval(timerInterval);
    watchId = null;
    
    document.getElementById('btn-stop').classList.add('d-none');
    document.getElementById('btn-start').classList.remove('d-none');
    
    addLog(`Hành trình kết thúc. Tổng cộng: ${totalDistance.toFixed(2)} KM.`);
    
    // Tiến hành lưu lịch sử vào bộ nhớ điện thoại
    saveToHistory(totalDistance.toFixed(2), Math.round(totalCalories), document.getElementById('timer').innerText);
}

// Thuật toán đo khoảng cách trái đất hình cầu
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

// Quản lý lưu trữ lịch sử chạy bộ (LocalStorage)
function saveToHistory(km, kcal, duration) {
    const history = JSON.parse(localStorage.getItem('midnight_history')) || [];
    const today = new Date();
    const dateStr = `${today.getDate()}/${today.getMonth() + 1} ${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')}`;
    
    const newRecord = { date: dateStr, km: km, kcal: kcal, time: duration };
    history.unshift(newRecord); // Cho lên đầu danh sách
    localStorage.setItem('midnight_history', JSON.stringify(history));
    
    loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('midnight_history')) || [];
    const list = document.getElementById('history-list');
    const emptyText = document.getElementById('history-empty');
    
    list.innerHTML = "";
    if (history.length === 0) {
        emptyText.classList.remove('d-none');
        return;
    }
    
    emptyText.classList.add('d-none');
    // Chỉ hiển thị tối đa 5 chuyến chạy gần nhất cho nhẹ app
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
    if (list.children.length > 3) list.removeChild(list.children[0]);
}

function clickAd() {
    const alertBox = document.getElementById('wallet-alert');
    alertBox.classList.remove('d-none');
    setTimeout(() => { alertBox.classList.add('d-none'); }, 3000);
}
