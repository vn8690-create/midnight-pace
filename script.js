let watchId = null;
let startTime = null;
let timerInterval = null;
let totalDistance = 0; 
let lastPosition = null;

// Biến quản lý bản đồ
let map = null;
let pathLine = null;
let routeCoordinates = []; // Mảng lưu các tọa độ đã chạy để vẽ hình

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const txtDistance = document.getElementById('distance');
const txtTimer = document.getElementById('timer');
const txtStatus = document.getElementById('status');
const logList = document.getElementById('log-list');
const sharePanel = document.getElementById('share-panel');
const btnShareFb = document.getElementById('btn-share-fb');
const adBanner = document.getElementById('ad-banner');
const walletAlert = document.getElementById('wallet-alert');
const previewZone = document.getElementById('preview-image-zone');

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function addLog(text, className = "") {
  const li = document.createElement('li');
  if(className) li.className = className;
  li.innerHTML = `• ${text}`;
  logList.insertBefore(li, logList.firstChild);
}

// Khởi tạo bản đồ nền tối (Dùng OpenStreetMap phiên bản giao diện tối của CartoDB)
function initMap(lat, lon) {
  if (map === null) {
    map = L.map('map-container').setView([lat, lon], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);
    
    // Nét vẽ đường chạy màu xanh Neon phát sáng
    pathLine = L.polyline([], {
      color: '#00ffcc',
      weight: 5,
      opacity: 0.8,
      shadowBlur: 10,
      shadowColor: '#00ffcc'
    }).addTo(map);
  } else {
    map.setView([lat, lon], 16);
  }
}

btnStart.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert("Trình duyệt không hỗ trợ GPS!");
    return;
  }

  btnStart.classList.add('d-none');
  btnStop.classList.remove('d-none');
  sharePanel.classList.add('d-none');
  previewZone.innerHTML = "";
  routeCoordinates = [];
  totalDistance = 0;
  txtDistance.innerText = "0.00";
  
  txtStatus.innerText = "🏃 Đang đồng bộ vệ tinh và vẽ bản đồ...";

  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const hrs = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
    const mins = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
    const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
    txtTimer.innerText = `${hrs}:${mins}:${secs}`;
  }, 1000);

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      // Khởi tạo hoặc cập nhật tâm bản đồ theo vị trí hiện tại
      initMap(lat, lon);
      
      // Thêm tọa độ mới vào mảng và vẽ lên bản đồ
      const currentCoord = [lat, lon];
      routeCoordinates.push(currentCoord);
      pathLine.setLatLngs(routeCoordinates);
      
      addLog(`Cập nhật vị trí: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

      if (lastPosition) {
        const dist = calculateDistance(lastPosition.lat, lastPosition.lon, lat, lon);
        if (dist > 0.002) { 
          totalDistance += dist;
          txtDistance.innerText = totalDistance.toFixed(2);
        }
      }
      lastPosition = { lat, lon };
    },
    (error) => { addLog(`Lỗi GPS: ${error.message}`); },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
});

btnStop.addEventListener('click', () => {
  clearInterval(timerInterval);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  
  txtStatus.innerText = "🏁 Hành trình khép lại. Đang xuất ảnh vinh quang...";
  addLog("Chặng chạy kết thúc. Đang xử lý tạo ảnh thành tích...");

  // KÍCH HOẠT THƯ VIỆN TỰ ĐỘNG CHỤP MÀN HÌNH APP
  // Đợi 1 chút để bản đồ định hình ổn định rồi chụp
  setTimeout(() => {
    const target = document.getElementById('capture-zone');
    html2canvas(target, {
      useCORS: true, // Cho phép chụp cả bản đồ hình ảnh trên mạng
      backgroundColor: '#0b0e14'
    }).then(canvas => {
      const imgUrl = canvas.toDataURL("image/png");
      
      // Tạo một thẻ img chứa bức ảnh vừa chụp để người dùng nhìn thấy
      const img = document.createElement('img');
      img.src = imgUrl;
      previewZone.appendChild(img);
      
      // Hiện khu vực chia sẻ
      sharePanel.classList.remove('d-none');
      btnStart.classList.remove('d-none');
      btnStop.classList.add('d-none');
      txtStatus.innerText = "🏁 Đã tạo xong ảnh thành tích bên dưới!";
    });
  }, 1000);

  watchId = null;
  lastPosition = null;
});

btnShareFb.addEventListener('click', () => {
  const distanceRun = txtDistance.innerText;
  const timeRun = txtTimer.innerText;
  const caption = `[MIDNIGHT PACE] \nTha thứ là sự mạnh mẽ thầm lặng. Đêm nay tớ đã hoàn thành ${distanceRun} KM trong ${timeRun}.`;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(caption)}`, '_blank');
});

adBanner.addEventListener('click', () => {
  walletAlert.classList.remove('d-none');
  setTimeout(() => { walletAlert.classList.add('d-none'); }, 3000);
});