// ===========================================
// HOUSES & ROOMS MANAGEMENT
// ===========================================

// DOM elements
let housesListEl;

// Initialize DOM elements
function initHousesDOM() {
    housesListEl = document.getElementById('houses-list');
    // For backward compatibility, still keep reference to old houses-list element
}

// Houses CRUD operations
function getHouseById(houseId) {
    return getHousesFromLocalStorage().find(h => h.id === houseId);
}

function addHouse(house) {
    const houses = getHousesFromLocalStorage();
    house.id = generateHouseId();
    houses.push(house);
    saveHousesToLocalStorage(houses);
    
    // Cập nhật giao diện tùy theo section hiện tại
    const homeSection = document.getElementById('home-section');
    if (homeSection && homeSection.classList.contains('active')) {
        renderDashboard();
    } else {
        renderHousesList();
    }
}

function updateHouse(updatedHouse) {
    const houses = getHousesFromLocalStorage();
    const index = houses.findIndex(h => h.id === updatedHouse.id);
    if (index !== -1) {
        houses[index] = updatedHouse;
        saveHousesToLocalStorage(houses);
        
        // Cập nhật giao diện tùy theo section hiện tại
        const homeSection = document.getElementById('home-section');
        if (homeSection && homeSection.classList.contains('active')) {
            renderDashboard();
        } else {
            renderHousesList();
        }
    }
}

function deleteHouse(houseId) {
    const rooms = getRoomsFromLocalStorage();
    const roomIds = rooms.filter(r => r.houseId === houseId).map(r => r.id);
    
    saveRoomsToLocalStorage(rooms.filter(r => r.houseId !== houseId));
    saveTenantsToLocalStorage(getTenantsFromLocalStorage().filter(t => !roomIds.includes(t.roomId)));
    saveHousesToLocalStorage(getHousesFromLocalStorage().filter(h => h.id !== houseId));
    
    // Cập nhật giao diện tùy theo section hiện tại
    const homeSection = document.getElementById('home-section');
    const allRoomsSection = document.getElementById('all-rooms-section');
    
    if (homeSection && homeSection.classList.contains('active')) {
        renderDashboard();
    } else {
        renderHousesList(); // Cho trang danh sách phòng
    }
    
    if (allRoomsSection && allRoomsSection.classList.contains('active')) {
        renderAllRoomsList();
    }
}

// Rooms CRUD operations
function getRoomById(roomId) {
    return getRoomsFromLocalStorage().find(r => r.id === roomId);
}

function getRoomsForHouse(houseId) {
    return getRoomsFromLocalStorage().filter(r => r.houseId === houseId);
}

function addRoom(room) {
    const rooms = getRoomsFromLocalStorage();
    room.id = generateRoomId();
    rooms.push(room);
    saveRoomsToLocalStorage(rooms);
    
    const allRoomsSection = document.getElementById('all-rooms-section');
    if (allRoomsSection && allRoomsSection.classList.contains('active')) renderAllRoomsList();
}

function updateRoom(updatedRoom) {
    const rooms = getRoomsFromLocalStorage();
    const index = rooms.findIndex(r => r.id === updatedRoom.id);
    if (index !== -1) {
        rooms[index] = updatedRoom;
        saveRoomsToLocalStorage(rooms);
        
        const allRoomsSection = document.getElementById('all-rooms-section');
        if (allRoomsSection && allRoomsSection.classList.contains('active')) renderAllRoomsList();
        
        const roomDetailsSection = document.getElementById('room-details-section');
        if (roomDetailsSection && roomDetailsSection.classList.contains('active')) {
            const currentRoomId = roomDetailsSection.getAttribute('data-current-room-id');
            if (currentRoomId === updatedRoom.id) showRoomDetails(updatedRoom.id);
        }
    }
}

function deleteRoom(roomId) {
    // Lấy thông tin phòng trước khi xóa để biết houseId
    const room = getRoomById(roomId);
    
    // Xóa người thuê của phòng này
    saveTenantsToLocalStorage(getTenantsFromLocalStorage().filter(t => t.roomId !== roomId));
    
    // Xóa phòng
    saveRoomsToLocalStorage(getRoomsFromLocalStorage().filter(r => r.id !== roomId));
    
    
}

// Render functions
function renderHousesList() {
    if (!housesListEl) return;
    
    const houses = getHousesFromLocalStorage();
    
    if (houses.length === 0) {
        housesListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-home"></i>
                <p>Chưa có nhà cho thuê nào. Hãy thêm nhà cho thuê mới!</p>
            </div>
        `;
        return;
    }
    
    housesListEl.innerHTML = '';
    
    houses.forEach(house => {
        const roomsCount = getRoomsForHouse(house.id).length;
        const roomsOccupied = getRoomsForHouse(house.id).filter(r => r.status === 'occupied').length;
        
        const houseItem = document.createElement('div');
        houseItem.className = 'house-item-list';
        houseItem.innerHTML = `
            <div class="house-item-main">
                <div class="house-item-info">
                    <div class="house-item-header">
                        <h3><i class="fas fa-home"></i> ${house.name}</h3>
                        <div class="house-stats">
                            <span class="total-rooms">${roomsCount} phòng</span>
                            <span class="occupied-rooms">${roomsOccupied} đã thuê</span>
                            <span class="available-rooms">${roomsCount - roomsOccupied} trống</span>
                        </div>
                    </div>
                    <p class="house-address"><i class="fas fa-map-marker-alt"></i> ${house.address}</p>
                    ${house.notes ? `<p class="house-notes"><i class="fas fa-sticky-note"></i> ${house.notes}</p>` : ''}
                </div>
                <div class="house-item-actions">
                    <button class="btn-secondary edit-house-list-btn" data-house-id="${house.id}">
                        <i class="fas fa-edit"></i> Sửa
                    </button>
                    <button class="btn-danger delete-house-list-btn" data-house-id="${house.id}">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                    <button class="btn-primary view-rooms-btn" data-house-id="${house.id}">
                        <i class="fas fa-door-open"></i> Xem nhà
                    </button>
                </div>
            </div>
        `;
        
        housesListEl.appendChild(houseItem);
        
        // Add event listeners
        houseItem.querySelector('.edit-house-list-btn').onclick = (e) => {
            e.stopPropagation();
            openHouseModal(house.id);
        };
        
        houseItem.querySelector('.delete-house-list-btn').onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Xóa nhà "${house.name}" và tất cả phòng bên trong?`)) {
                deleteHouse(house.id);
            }
        };
        
        houseItem.querySelector('.view-rooms-btn').onclick = (e) => {
            e.stopPropagation();
            renderAllRoomsList();
            showSection('all-rooms-section');
        };
        
        // Make entire item clickable to view rooms
        houseItem.onclick = () => {
            renderAllRoomsList();
            showSection('all-rooms-section');
        };
    });
}

// Render Dashboard với thống kê và tổng quan
function renderDashboard() {
    updateDashboardStats();
    renderHousesOverview();
}

// Cập nhật thống kê dashboard
function updateDashboardStats() {
    const houses = getHousesFromLocalStorage();
    const rooms = getRoomsFromLocalStorage();
    const tenants = getTenantsFromLocalStorage();
    
    const totalHouses = houses.length;
    const totalRooms = rooms.length;
    const availableRooms = rooms.filter(r => r.status !== 'occupied').length;
    const totalTenants = tenants.length;
    
    document.getElementById('total-houses').textContent = totalHouses;
    document.getElementById('total-rooms').textContent = totalRooms;
    document.getElementById('available-rooms').textContent = availableRooms;
    document.getElementById('total-tenants').textContent = totalTenants;
}

// Màu nhận diện cố định cho từng nhà, dùng thống nhất ở Dashboard và các danh sách.
function getHouseTitleThemeClass(houseId) {
    const houses = getHousesFromLocalStorage();
    const house = houses.find(item => item.id === houseId);
    const normalizedName = (house?.name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd');

    if (normalizedName.includes('bach dang')) return 'house-title-green';
    if (normalizedName.includes('37/7')) return 'house-title-orange';

    const houseIndex = houses.findIndex(item => item.id === houseId);
    return houseIndex >= 0 && houseIndex % 2 === 1 ? 'house-title-green' : 'house-title-orange';
}

// Render tổng quan nhà cho thuê
function renderHousesOverview() {
    const housesOverviewEl = document.getElementById('houses-overview');
    if (!housesOverviewEl) return;
    
    const houses = getHousesFromLocalStorage();
    
    if (houses.length === 0) {
        housesOverviewEl.innerHTML = `
            <div class="empty-overview">
                <i class="fas fa-home"></i>
                <p>Chưa có nhà cho thuê nào</p>
                <button class="btn-primary" onclick="document.getElementById('add-house-btn').click()">
                    <i class="fas fa-plus"></i> Thêm nhà đầu tiên
                </button>
            </div>
        `;
        return;
    }
    
    housesOverviewEl.innerHTML = '';
    
    houses.forEach(house => {
        const rooms = getRoomsForHouse(house.id);
        const totalRooms = rooms.length;
        const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
        const availableRooms = totalRooms - occupiedRooms;
        const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
        
        // Xác định trạng thái dựa trên tỷ lệ lấp đầy
        let statusClass, statusText, progressClass;
        if (occupancyRate >= 80) {
            statusClass = 'status-excellent';
            statusText = 'Tuyệt vời';
            progressClass = 'progress-excellent';
        } else if (occupancyRate >= 50) {
            statusClass = 'status-good';
            statusText = 'Tốt';
            progressClass = 'progress-good';
        } else {
            statusClass = 'status-warning';
            statusText = 'Cần chú ý';
            progressClass = 'progress-warning';
        }
        
        const houseCard = document.createElement('div');
        houseCard.className = 'house-overview-card';
        houseCard.innerHTML = `
            <div class="house-overview-header">
                <div class="house-overview-title ${getHouseTitleThemeClass(house.id)}">🏠 ${house.name}</div>
                <div class="house-overview-status ${statusClass}">${statusText}</div>
            </div>
            <div class="house-overview-stats">
                <div class="overview-stat">
                    <div class="overview-stat-number">${totalRooms}</div>
                    <div class="overview-stat-label">Tổng phòng</div>
                </div>
                <div class="overview-stat">
                    <div class="overview-stat-number">${occupiedRooms}</div>
                    <div class="overview-stat-label">Đã thuê</div>
                </div>
                <div class="overview-stat">
                    <div class="overview-stat-number">${availableRooms}</div>
                    <div class="overview-stat-label">Còn trống</div>
                </div>
            </div>
            <div class="house-overview-progress">
                <div class="progress-fill ${progressClass}" style="width: ${occupancyRate}%"></div>
            </div>
            <div class="house-overview-footer">
                <span>📍 ${house.address}</span>
                <span>${Math.round(occupancyRate)}% lấp đầy</span>
            </div>
            <div class="house-overview-actions">
                <button class="overview-action-btn edit-btn" data-house-id="${house.id}">
                    <i class="fas fa-edit"></i> Sửa
                </button>
                <button class="overview-action-btn delete-btn" data-house-id="${house.id}">
                    <i class="fas fa-trash"></i> Xóa
                </button>
                <button class="overview-action-btn view-btn" data-house-id="${house.id}">
                    <i class="fas fa-door-open"></i> Xem nhà
                </button>
            </div>
        `;
        
        // Event listeners cho các nút actions
        const editBtn = houseCard.querySelector('.edit-btn');
        const deleteBtn = houseCard.querySelector('.delete-btn');
        const viewBtn = houseCard.querySelector('.view-btn');
        
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openHouseModal(house.id);
        };
        
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Xóa nhà "${house.name}" và tất cả phòng bên trong?`)) {
                deleteHouse(house.id);
                // Cập nhật lại dashboard sau khi xóa
                renderDashboard();
            }
        };
        
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            renderAllRoomsList();
            showSection('all-rooms-section');
        };
        
        // Click vào card (không phải nút) để xem chi tiết phòng
        houseCard.onclick = (e) => {
            // Kiểm tra nếu click vào nút thì không thực hiện
            if (e.target.closest('.overview-action-btn')) return;
            
            renderAllRoomsList();
            showSection('all-rooms-section');
        };
        
        housesOverviewEl.appendChild(houseCard);
    });
}



// Render all houses and rooms in grouped list format (no images)
function renderAllRoomsList() {
    const allRoomsListEl = document.getElementById('all-rooms-list');
    if (!allRoomsListEl) return;
    
    const houses = getHousesFromLocalStorage();
    const allRooms = getRoomsFromLocalStorage();
    
    if (houses.length === 0) {
        allRoomsListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-home"></i>
                <p>Chưa có nhà cho thuê nào. Hãy thêm nhà cho thuê mới!</p>
            </div>
        `;
        return;
    }
    
    allRoomsListEl.innerHTML = '';
    allRoomsListEl.className = 'room-house-grid';
    
    houses.forEach(house => {
        const housesRooms = allRooms.filter(r => r.houseId === house.id);
        housesRooms.sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true, sensitivity: 'base' }));
        
        const houseGroup = document.createElement('div');
        houseGroup.className = 'room-house-column';
        
        const houseHeader = document.createElement('div');
        houseHeader.className = 'room-house-header';
        houseHeader.innerHTML = `
            <div class="room-house-info">
                <h3 class="${getHouseTitleThemeClass(house.id)}"><i class="fas fa-home"></i> ${house.name}</h3>
                <p class="house-address"><i class="fas fa-map-marker-alt"></i> ${house.address}</p>
                <span class="room-count">${housesRooms.length} phòng</span>
            </div>
            <div class="house-group-actions">
                <button class="btn-expense-house beautiful-expense-btn" data-house-id="${house.id}">
                    <i class="fas fa-file-invoice-dollar"></i> Chi phí nhà
                </button>
            </div>
        `;
        
        houseGroup.appendChild(houseHeader);
        
        const roomsList = document.createElement('div');
        roomsList.className = 'room-house-list';
        
        if (housesRooms.length === 0) {
            roomsList.innerHTML = `
                <div class="empty-rooms">
                    <i class="fas fa-door-open"></i>
                    <p>Chưa có phòng nào trong nhà này</p>
                </div>
            `;
        } else {
            housesRooms.forEach(room => {
                const roomButton = document.createElement('button');
                roomButton.className = 'tenant-name-link room-name-link';
                roomButton.innerHTML = `<span><i class="fas fa-door-closed"></i> ${room.name}</span>`;
                roomButton.onclick = () => showRoomDetails(room.id);
                roomsList.appendChild(roomButton);
            });
        }
        
        houseGroup.appendChild(roomsList);
        allRoomsListEl.appendChild(houseGroup);

        // Bind event for the house expense button after appending to DOM
        const expenseBtn = houseHeader.querySelector('.btn-expense-house');
        if (expenseBtn) {
            expenseBtn.onclick = e => {
                e.stopPropagation();
                if (window.showHouseExpenseSection) {
                    window.showHouseExpenseSection(house.id);
                } else {
                    console.error('showHouseExpenseSection not found');
                    alert('Chức năng chi phí nhà chưa sẵn sàng');
                }
            };
        }
    });
}

function showRoomDetails(roomId) {
    const room = getRoomById(roomId);
    if (!room) {
        console.error("Không tìm thấy phòng với ID:", roomId);
        return;
    }
    
    const house = getHouseById(room.houseId);
    
    // Set room name in header
    const roomNameHeader = document.getElementById('room-name-header');
    if (roomNameHeader) {
        roomNameHeader.textContent = room.name;
    } else {
        console.error('room-name-header element not found');
    }
    
    // Set room image
    const roomImageEl = document.getElementById('room-detail-image');
    if (roomImageEl) {
    const roomImage = room.image || DEFAULT_ROOM_IMAGE;
    roomImageEl.style.backgroundImage = `url('${roomImage}')`;
    } else {
        console.error('room-detail-image element not found');
    }
    
    // Set room details
    const roomDetailsEl = document.getElementById('room-details');
    if (roomDetailsEl) {
    roomDetailsEl.innerHTML = `
        <div class="detail-item"><span class="detail-label">🏠 Tên phòng:</span><span class="detail-value">${room.name}</span></div>
        <div class="detail-item"><span class="detail-label">🏢 Nhà:</span><span class="detail-value">${house ? house.name : 'N/A'}</span></div>
        <div class="detail-item"><span class="detail-label">💰 Giá thuê:</span><span class="detail-value">${formatCurrency(room.price)}/tháng</span></div>
        <div class="detail-item"><span class="detail-label">📐 Diện tích:</span><span class="detail-value">${room.area || 'Chưa cập nhật'}</span></div>
        <div class="detail-item"><span class="detail-label">📊 Trạng thái:</span><span class="detail-value room-status ${room.status}">${getRoomStatusText(room.status)}</span></div>
        ${room.description ? `<div class="detail-item"><span class="detail-label">📝 Mô tả:</span><span class="detail-value">${room.description}</span></div>` : ''}
    `;
    } else {
        console.error('room-details element not found');
    }
    
    // Set up add tenant button
    const addTenantBtn = document.getElementById('add-tenant-btn');
    if (addTenantBtn) {
    addTenantBtn.setAttribute('data-room-id', room.id);
    } else {
        console.error('add-tenant-btn element not found');
    }
    
    // Set up back button
    const backBtn = document.getElementById('back-to-house-btn');
    if (backBtn) {
    backBtn.setAttribute('data-house-id', room.houseId);
    } else {
        console.error('back-to-house-btn element not found');
    }
    
    // Set current room ID
    const roomDetailsSection = document.getElementById('room-details-section');
    if (roomDetailsSection) {
        roomDetailsSection.setAttribute('data-current-room-id', room.id);
    } else {
        console.error('room-details-section element not found');
    }
    
    // Render tenants for room
    renderTenantsForRoomCompact(room.id);
    
    // Explicitly hide house-expense-section before navigation
    const houseExpenseSection = document.getElementById('house-expense-section');
    if (houseExpenseSection) {
        houseExpenseSection.classList.remove('active');
    }
    
    // Show the room details section
    try {
        if (typeof window.showSection === 'function') {
            window.showSection('room-details');
        } else {
            // Fallback: manually show the section
            const section = document.getElementById('room-details-section');
            if (section) {
                document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
                section.classList.add('active');
            }
        }
    } catch (error) {
        console.error('Error calling showSection:', error);
    }
    
    // Setup back button for room details
    if (typeof window.setupBackButtonForSection === 'function') {
        window.setupBackButtonForSection('room-details');
    }
}

// Render tenants for room in compact format
function renderTenantsForRoomCompact(roomId) {
    const tenantsListEl = document.getElementById('tenants-list-compact');
    const tenantCountBadge = document.getElementById('tenant-count-badge');
    
    if (!tenantsListEl) {
        console.error('tenants-list-compact element not found');
        return;
    }
    
    if (!tenantCountBadge) {
        console.error('tenant-count-badge element not found');
        return;
    }
    
    const tenants = getTenantsForRoom(roomId);
    tenantCountBadge.textContent = `${tenants.length} người`;
    
    if (tenants.length === 0) {
        tenantsListEl.innerHTML = `
            <div class="empty-state-compact">
                <i class="fas fa-users"></i>
                <p>Chưa có người thuê nào</p>
            </div>
        `;
        return;
    }
    
    tenantsListEl.innerHTML = '';
    
    tenants.forEach(tenant => {
        const tenantEl = document.createElement('div');
        tenantEl.className = 'tenant-item-compact';
        
        const startDate = tenant.startDate ? formatDate(tenant.startDate) : 'N/A';
        const endDate = tenant.endDate ? formatDate(tenant.endDate) : 'Không xác định';
        const isActive = !tenant.endDate || new Date(tenant.endDate) > new Date();
        
        tenantEl.innerHTML = `
            <div class="tenant-item-header">
                <span class="tenant-name-compact">${tenant.name}</span>
                <span class="tenant-status-compact ${isActive ? 'active' : 'inactive'}">
                    ${isActive ? 'Đang thuê' : 'Đã rời'}
                </span>
            </div>
            <div class="tenant-info-compact">
                📞 ${tenant.phone || 'Chưa cập nhật'}<br>
                📅 Từ: ${startDate}<br>
                ⏰ Đến: ${endDate}<br>
                💰 Thuê: ${formatCurrency(tenant.rentAmount || 0)}/tháng
            </div>
            <div class="tenant-actions-compact">
                <button class="btn-primary btn-compact tenant-view-compact" data-id="${tenant.id}">
                    <i class="fas fa-eye"></i> Chi tiết
                </button>
                <button class="btn-secondary btn-compact tenant-edit-compact" data-id="${tenant.id}">
                    <i class="fas fa-edit"></i> Sửa
                </button>
                <button class="btn-danger btn-compact tenant-delete-compact" data-id="${tenant.id}">
                    <i class="fas fa-trash"></i> Xóa
                </button>
            </div>
        `;
        
        tenantsListEl.appendChild(tenantEl);
        
        // Add event listeners
        tenantEl.querySelector('.tenant-view-compact').onclick = () => showTenantDetails(tenant.id);
        tenantEl.querySelector('.tenant-edit-compact').onclick = () => openTenantModal(tenant.id);
        tenantEl.querySelector('.tenant-delete-compact').onclick = () => {
            if (confirm(`Xóa người thuê "${tenant.name}"?`)) {
                deleteTenant(tenant.id);
            }
        };
    });
}

// Toggle function for house rooms list
function toggleHouseRoomsList(houseId) {
    const roomsList = document.getElementById(`rooms-list-${houseId}`);
    const toggleIcon = document.querySelector(`[data-house-id="${houseId}"].toggle-icon`);
    
    if (!roomsList || !toggleIcon) return;
    
    // Sử dụng computed style thay vì inline style để kiểm tra trạng thái hiện tại
    const isCurrentlyVisible = window.getComputedStyle(roomsList).display !== 'none';
    
    if (isCurrentlyVisible) {
        // Đang hiển thị -> ẩn đi
        roomsList.style.display = 'none';
        toggleIcon.className = 'fas fa-chevron-right toggle-icon';
    } else {
        // Đang ẩn -> hiển thị
        roomsList.style.display = 'block';
        toggleIcon.className = 'fas fa-chevron-down toggle-icon';
    }
}
