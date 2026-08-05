// ===========================================
// MODAL FUNCTIONS
// ===========================================

function openHouseModal(houseId = null) {
    const modal = document.getElementById('house-modal');
    const title = document.getElementById('house-modal-title');
    const form = document.getElementById('house-form');
    
    if (!modal || !title || !form) {
        alert('Không tìm thấy form nhà cho thuê');
        return;
    }
    
    if (houseId) {
        // Edit mode
        const house = getHouseById(houseId);
        if (!house) {
            alert('Không tìm thấy thông tin nhà');
            return;
        }
        
        title.textContent = 'Sửa thông tin nhà';
        
        // Safely set form values with null checks
        const houseIdField = document.getElementById('house-id');
        const houseNameField = document.getElementById('house-name');
        const houseAddressField = document.getElementById('house-address');
        const houseRoomsCountField = document.getElementById('house-rooms-count');
        const houseNotesField = document.getElementById('house-notes');
        const houseImageField = document.getElementById('house-image');
        
        if (houseIdField) houseIdField.value = house.id;
        if (houseNameField) houseNameField.value = house.name || '';
        if (houseAddressField) houseAddressField.value = house.address || '';
        if (houseRoomsCountField) houseRoomsCountField.value = getRoomsForHouse(house.id).length || '';
        if (houseNotesField) houseNotesField.value = house.notes || '';
        if (houseImageField) houseImageField.value = house.image || '';
    } else {
        // Add mode
        title.textContent = 'Thêm nhà cho thuê mới';
        form.reset();
        
        const houseIdField = document.getElementById('house-id');
        if (houseIdField) houseIdField.value = '';
    }
    
    modal.style.display = 'block';
}

function openRoomModal(mode = 'edit', roomId = null) {
    const modal = document.getElementById('room-modal');
    const title = document.getElementById('room-modal-title');
    const form = document.getElementById('room-form');
    
    if (!modal || !title || !form) {
        alert('Không tìm thấy form phòng');
        return;
    }
    
    // Chỉ hỗ trợ chế độ edit vì add được xử lý trong modal sửa nhà
    if (!roomId) {
        alert('Không tìm thấy thông tin phòng');
        return;
    }
    
    const room = getRoomById(roomId);
    if (!room) {
        alert('Không tìm thấy thông tin phòng');
        return;
    }
    
    title.textContent = 'Sửa thông tin phòng';
    
    // Safely set form values with null checks
    const roomIdField = document.getElementById('room-id');
    const roomHouseIdField = document.getElementById('room-house-id');
    const roomNameField = document.getElementById('room-name');
    const roomPriceField = document.getElementById('room-price');
    const roomStatusField = document.getElementById('room-status');
    const roomAreaField = document.getElementById('room-area');
    const roomDescriptionField = document.getElementById('room-notes');
    const roomImageField = document.getElementById('room-image');
    
    if (roomIdField) roomIdField.value = room.id;
    if (roomHouseIdField) roomHouseIdField.value = room.houseId;
    if (roomNameField) roomNameField.value = room.name || '';
    if (roomPriceField) roomPriceField.value = room.price || '';
    if (roomStatusField) roomStatusField.value = room.status || '';
    if (roomAreaField) roomAreaField.value = room.area || '';
    if (roomDescriptionField) roomDescriptionField.value = room.description || '';
    if (roomImageField) roomImageField.value = room.image || '';
    
    modal.style.display = 'block';
}

function openTenantModal(tenantId = null, roomId = null) {
    console.log('openTenantModal called with tenantId:', tenantId, 'roomId:', roomId);
    
    const modal = document.getElementById('tenant-modal');
    const title = document.getElementById('tenant-modal-title');
    const form = document.getElementById('tenant-form');
    
    console.log('Modal elements found:', {
        modal: !!modal,
        title: !!title,
        form: !!form
    });
    
    if (!modal) {
        alert('Không tìm thấy form người thuê');
        return;
    }
    
    // Populate room select with error handling
    const roomSelect = document.getElementById('tenant-room-id');
    if (!roomSelect) {
        console.error('Room select element not found');
        return;
    }
    
    try {
        const rooms = getRoomsFromLocalStorage();
        roomSelect.innerHTML = '<option value="">Chọn phòng</option>';
        
        // Sort rooms alphabetically by house name and room name
        const sortedRooms = rooms.sort((a, b) => {
            const houseA = getHouseById(a.houseId);
            const houseB = getHouseById(b.houseId);
            const houseNameA = houseA ? houseA.name : 'Không xác định';
            const houseNameB = houseB ? houseB.name : 'Không xác định';
            
            // First sort by house name, then by room name
            const houseComparison = houseNameA.localeCompare(houseNameB, 'vi');
            if (houseComparison !== 0) {
                return houseComparison;
            }
            return a.name.localeCompare(b.name, 'vi');
        });
        
        sortedRooms.forEach(room => {
            const house = getHouseById(room.houseId);
            const houseName = house ? house.name : 'Không xác định';
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = `${houseName} - ${room.name}`;
            roomSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error populating room select:', error);
        roomSelect.innerHTML = '<option value="">Lỗi tải danh sách phòng</option>';
    }
    
    if (tenantId) {
        // Edit mode
        console.log('Edit mode - loading tenant data for ID:', tenantId);
        const tenant = getTenantById(tenantId);
        if (!tenant) {
            alert('Không tìm thấy thông tin người thuê');
            return;
        }
        
        console.log('Tenant data loaded:', tenant);
        title.textContent = 'Sửa thông tin người thuê';
        document.getElementById('tenant-id').value = tenant.id;
        document.getElementById('tenant-name').value = tenant.name || '';
        document.getElementById('tenant-phone').value = tenant.phone || '';

        document.getElementById('tenant-id-card').value = tenant.idCard || '';
        document.getElementById('tenant-room-id').value = tenant.roomId || '';
        // Day-only rent calculation fields
        const startDay = tenant.rentStartDay || (tenant.startDate ? new Date(tenant.startDate).getDate() : '');
        const endDay = tenant.rentEndDay || (tenant.endDate ? new Date(tenant.endDate).getDate() : '');
        const rentStartDayEl = document.getElementById('tenant-rent-start-day');
        const rentEndDayEl = document.getElementById('tenant-rent-end-day');
        const initialDepositEl = document.getElementById('tenant-initial-deposit');
        if (rentStartDayEl) rentStartDayEl.value = startDay || '';
        if (rentEndDayEl) rentEndDayEl.value = endDay || '';
        if (initialDepositEl) initialDepositEl.value = formatTenantDeposit(tenant.initialDeposit);
        document.getElementById('tenant-notes').value = tenant.notes || '';
        document.getElementById('tenant-notes').value = tenant.notes || '';
    } else {
        // Add mode
        console.log('Add mode - setting up new tenant form');
        title.textContent = 'Thêm người thuê mới';
        form.reset();
        document.getElementById('tenant-id').value = '';
        
        if (roomId) {
            document.getElementById('tenant-room-id').value = roomId;
        }
        
        // Default: leave day-only fields empty for user to set
    }
    
    modal.style.display = 'block';
    console.log('Tenant modal opened:', modal.id, 'Display:', modal.style.display, 'Z-index:', modal.style.zIndex);
    
    // Force modal to be visible
    modal.style.zIndex = '10000';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';

    const initialDepositEl = document.getElementById('tenant-initial-deposit');
    if (initialDepositEl) {
        initialDepositEl.oninput = () => {
            initialDepositEl.value = formatTenantDeposit(initialDepositEl.value);
        };
    }
}

function formatTenantDeposit(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits ? Number(digits).toLocaleString('vi-VN') : '';
}

// --- Individual modals for each expense type ---
let currentHouseId = null;

function openHouseExpenseModal(houseId, expenseType) {
    currentHouseId = houseId;
    const modalId = `house-expense-${expenseType}-modal`;
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Reset form
        const form = modal.querySelector('.house-expense-modal-form');
        if (form) form.reset();
    }
}

function closeHouseExpenseModal(expenseType) {
    const modalId = `house-expense-${expenseType}-modal`;
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Setup modal events for all expense types
if (typeof window.houseExpenseModalSetup === 'undefined') {
    window.houseExpenseModalSetup = true;
    document.addEventListener('DOMContentLoaded', function() {
        const expenseTypes = ['electricity', 'water', 'garbage', 'internet', 'phone', 'tv', 'other'];
        
        expenseTypes.forEach(type => {
            const modalId = `house-expense-${type}-modal`;
            const modal = document.getElementById(modalId);
            if (modal) {
                const form = modal.querySelector('.house-expense-modal-form');
                if (form) {
                    form.onsubmit = async function(e) {
                        e.preventDefault();
                        if (!currentHouseId) return;
                        
                        const amount = form.querySelector('.modal-expense-amount').value;
                        const fromDate = form.querySelector('.modal-expense-from-date').value;
                        const toDate = form.querySelector('.modal-expense-to-date').value;
                        const paymentDate = form.querySelector('.modal-expense-payment-date').value;
                        const notes = form.querySelector('.modal-expense-notes').value;
                        const status = form.querySelector('.modal-expense-status:checked').value;
                        const billFile = form.querySelector('.modal-expense-bill-image').files[0];
                        const paymentFile = form.querySelector('.modal-expense-payment-image').files[0];
                        
                        let billImage = '', paymentImage = '';
                        if (billFile) billImage = await fileToBase64(billFile);
                        if (paymentFile) paymentImage = await fileToBase64(paymentFile);
                        
                        const expense = {
                            id: 'HE' + Date.now(),
                            houseId: currentHouseId,
                            type: type,
                            amount,
                            fromDate,
                            toDate,
                            paymentDate,
                            notes,
                            status,
                            billImage,
                            paymentImage,
                            createdAt: new Date().toISOString()
                        };
                        
                        let houseExpenses = JSON.parse(localStorage.getItem('houseExpenses') || '[]');
                        houseExpenses.push(expense);
                        localStorage.setItem('houseExpenses', JSON.stringify(houseExpenses));
                        
                        closeHouseExpenseModal(type);
                        renderHouseExpenseTableWithSort(currentHouseId, '', currentSortField, currentSortDirection);
                    };
                }
            }
        });
    });
}

function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    preview.innerHTML = '';
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '120px';
            img.style.maxHeight = '120px';
            preview.appendChild(img);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveHouseExpense() {
    const houseId = document.getElementById('house-expense-house-id').value;
    const type = document.getElementById('house-expense-type').value;
    const fromDate = document.getElementById('house-expense-from-date').value;
    const toDate = document.getElementById('house-expense-to-date').value;
    const amount = document.getElementById('house-expense-amount').value;
    const notes = document.getElementById('house-expense-notes').value;
    const billFile = document.getElementById('house-expense-bill-image').files[0];
    const paymentFile = document.getElementById('house-expense-payment-image').files[0];
    let billImage = '', paymentImage = '';
    if (billFile) billImage = await fileToBase64(billFile);
    if (paymentFile) paymentImage = await fileToBase64(paymentFile);
    const expense = {
        id: 'HE' + Date.now(),
        houseId,
        type,
        fromDate,
        toDate,
        amount,
        notes,
        billImage,
        paymentImage,
        createdAt: new Date().toISOString()
    };
    let houseExpenses = JSON.parse(localStorage.getItem('houseExpenses') || '[]');
    houseExpenses.push(expense);
    localStorage.setItem('houseExpenses', JSON.stringify(houseExpenses));
    closeModals();
    refreshCurrentView();
    setTimeout(() => alert('Đã lưu chi phí nhà thành công!'), 100);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Form submit handlers
document.addEventListener('DOMContentLoaded', function() {
    // House form
    document.getElementById('house-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveHouse();
    });
    
    // Room form
    document.getElementById('room-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveRoom();
    });
    
    // Tenant form
    document.getElementById('tenant-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveTenant();
    });
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModals);
    });
    
    // Cancel buttons
    const cancelButtons = [
        'cancel-house-btn',
        'cancel-room-btn', 
        'cancel-tenant-btn',
        'cancel-expense-btn'
    ];
    
    cancelButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', closeModals);
        }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModals();
        }
    });
});

function saveHouse() {
    // Safely get form values with null checks
    const houseIdField = document.getElementById('house-id');
    const houseNameField = document.getElementById('house-name');
    const houseAddressField = document.getElementById('house-address');
    const houseRoomsCountField = document.getElementById('house-rooms-count');
    const houseNotesField = document.getElementById('house-notes');
    const houseImageField = document.getElementById('house-image');
    const houseModal = document.getElementById('house-modal');
    
    if (!houseNameField || !houseAddressField) {
        alert('Không tìm thấy form nhà cho thuê');
        return;
    }
    
    const houseId = houseIdField ? houseIdField.value : '';
    const name = houseNameField.value;
    const address = houseAddressField.value;
    const roomsCount = houseRoomsCountField ? parseInt(houseRoomsCountField.value) || 1 : 1;
    const notes = houseNotesField ? houseNotesField.value : '';
    const image = houseImageField ? houseImageField.value : '';
    
    if (!name || !address) {
        alert('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
    }
    
    const houseData = {
        name,
        address,
        notes,
        image
    };
    
    if (houseId) {
        // Edit mode - cập nhật nhà và quản lý số phòng
        houseData.id = houseId;
        updateHouse(houseData);
        
        // Lấy danh sách phòng hiện tại của nhà
        const currentRooms = getRoomsForHouse(houseId);
        const currentRoomsCount = currentRooms.length;
        
        if (roomsCount > currentRoomsCount) {
            // Tăng số phòng - tạo thêm phòng từ số hiện tại + 1
            const additionalRooms = roomsCount - currentRoomsCount;
            createAdditionalRoomsForHouse(houseId, currentRoomsCount + 1, additionalRooms, name);
        } else if (roomsCount < currentRoomsCount) {
            // Giảm số phòng - logic đơn giản và an toàn
            const roomsToDelete = currentRoomsCount - roomsCount;

            
            // Tìm phòng có thể xóa (trống, theo format "Số XX")
            const emptyRooms = currentRooms.filter(room => {
                // Kiểm tra format tên
                const isNumberFormat = /^Số \d+$/.test(room.name);
                if (!isNumberFormat) {
                    return false;
                }
                
                // Kiểm tra có người thuê không
                const tenants = getTenantsFromLocalStorage().filter(t => t.roomId === room.id);
                if (tenants.length > 0) {
                    return false;
                }
                
                return true;
            });
            

            
            if (emptyRooms.length === 0) {
                alert('Không thể xóa phòng nào vì tất cả phòng đều có người thuê hoặc không theo format "Số XX"');
                return;
            }
            
            // Sắp xếp theo số phòng giảm dần (xóa từ số lớn nhất)
            emptyRooms.sort((a, b) => {
                const aNum = parseInt(a.name.replace('Số ', ''));
                const bNum = parseInt(b.name.replace('Số ', ''));
                return bNum - aNum;
            });
            
            // Lấy danh sách phòng cần xóa
            const roomsToDeleteList = emptyRooms.slice(0, roomsToDelete);
            
            // Xác nhận với người dùng
            const confirmMsg = `Bạn có chắc muốn xóa ${roomsToDeleteList.length} phòng sau?\n${roomsToDeleteList.map(r => r.name).join(', ')}`;
            if (!confirm(confirmMsg)) {
                return;
            }
            
            // Thực hiện xóa
            let deletedCount = 0;
            
            for (const room of roomsToDeleteList) {
                // Xóa người thuê (nếu có)
                const currentTenants = getTenantsFromLocalStorage();
                const newTenants = currentTenants.filter(t => t.roomId !== room.id);
                saveTenantsToLocalStorage(newTenants);
                
                // Xóa phòng
                const currentRooms = getRoomsFromLocalStorage();
                const newRooms = currentRooms.filter(r => r.id !== room.id);
                saveRoomsToLocalStorage(newRooms);
                
                deletedCount++;
            }
            
            // Hiển thị thông báo
            setTimeout(() => {
                alert(`Đã xóa ${deletedCount} phòng thành công!`);
            }, 100);
        }
    } else {
        // Add mode - tạo nhà và tự động tạo phòng
        addHouse(houseData);
        
        // Tự động tạo phòng cho nhà mới
        const newHouseId = houseData.id; // ID đã được set trong addHouse
        if (newHouseId && roomsCount > 0) {
            createRoomsForHouse(newHouseId, roomsCount, name);
        }
    }
    
    // Đóng modal
    if (houseModal) {
        houseModal.style.display = 'none';
    }
    
    // Refresh UI ngay lập tức
    refreshCurrentView();
}

function saveRoom() {
    // Safely get form values with null checks
    const roomIdField = document.getElementById('room-id');
    const roomHouseIdField = document.getElementById('room-house-id');
    const roomNameField = document.getElementById('room-name');
    const roomPriceField = document.getElementById('room-price');
    const roomStatusField = document.getElementById('room-status');
    const roomAreaField = document.getElementById('room-area');
    const roomDescriptionField = document.getElementById('room-notes');
    const roomImageField = document.getElementById('room-image');
    const roomModal = document.getElementById('room-modal');
    
    // Kiểm tra form tồn tại
    if (!roomNameField) {
        alert('Không tìm thấy form phòng');
        return;
    }
    
    // Lấy giá trị từ form - ID được tạo tự động bởi hệ thống
    const roomId = roomIdField ? roomIdField.value : '';
    const houseId = roomHouseIdField ? roomHouseIdField.value : '';
    const name = roomNameField.value;
    const price = parseFloat(roomPriceField ? roomPriceField.value : 0) || 0;
    const status = roomStatusField ? roomStatusField.value : 'available';
    const area = roomAreaField ? roomAreaField.value : '';
    const description = roomDescriptionField ? roomDescriptionField.value : '';
    const image = roomImageField ? roomImageField.value : '';
    
    // Validation: Chỉ yêu cầu tên phòng (người dùng nhập)
    if (!name) {
        alert('Vui lòng nhập tên phòng');
        return;
    }
    
    // Validation: Đảm bảo houseId phải có (từ form hoặc context)
    // HouseId là bắt buộc cho logic hệ thống nhưng do hệ thống tự set
    if (!houseId) {
        alert('Lỗi: Không xác định được nhà cho phòng này');
        return;
    }
    
    const roomData = {
        houseId,
        name,
        price,
        status,
        area,
        description,
        image
    };
    
    if (roomId) {
        // Edit mode - ID đã tồn tại
        roomData.id = roomId;
        updateRoom(roomData);
    } else {
        // Add mode - ID sẽ được tạo tự động trong addRoom()
        addRoom(roomData);
    }
    
    // Đóng modal
    if (roomModal) {
        roomModal.style.display = 'none';
    }
    
    // Refresh UI
    refreshCurrentView();
}

function saveTenant() {
    // Safely get form values with null checks
    const tenantIdField = document.getElementById('tenant-id');
    const tenantNameField = document.getElementById('tenant-name');
    const tenantPhoneField = document.getElementById('tenant-phone');
    const tenantIdCardField = document.getElementById('tenant-id-card');
    const tenantRoomIdField = document.getElementById('tenant-room-id');
    const tenantRentStartDayField = document.getElementById('tenant-rent-start-day');
    const tenantRentEndDayField = document.getElementById('tenant-rent-end-day');
    const tenantInitialDepositField = document.getElementById('tenant-initial-deposit');
    const tenantNotesField = document.getElementById('tenant-notes');
    
    // Kiểm tra form tồn tại
    if (!tenantNameField) {
        alert('Không tìm thấy form người thuê');
        return;
    }
    
    // Lấy giá trị từ form - ID được tạo tự động bởi hệ thống
    const tenantId = tenantIdField ? tenantIdField.value : '';
    const name = tenantNameField.value;
    const phone = tenantPhoneField ? tenantPhoneField.value : '';
    const idCard = tenantIdCardField ? tenantIdCardField.value : '';
    const roomId = tenantRoomIdField ? tenantRoomIdField.value : '';
    const rentStartDay = tenantRentStartDayField ? parseInt(tenantRentStartDayField.value, 10) || '' : '';
    const rentEndDay = tenantRentEndDayField ? parseInt(tenantRentEndDayField.value, 10) || '' : '';
    const initialDeposit = tenantInitialDepositField
        ? Number(tenantInitialDepositField.value.replace(/\D/g, '')) || 0
        : 0;
    const notes = tenantNotesField ? tenantNotesField.value : '';
    
    // Validation: Chỉ yêu cầu tên người thuê (người dùng nhập)
    // Các trường khác như phone, roomId, startDate có thể để trống
    if (!name) {
        alert('Vui lòng nhập tên người thuê');
        return;
    }
    
    const tenantData = {
        name,
        phone,
        idCard,
        roomId,
        rentStartDay,
        rentEndDay,
        initialDeposit,
        notes
    };
    
    if (tenantId) {
        // Edit mode - ID đã tồn tại
        tenantData.id = tenantId;
        updateTenant(tenantData);
    } else {
        // Add mode - ID sẽ được tạo tự động trong addTenant()
        addTenant(tenantData);
    }
    
    // Đóng modal
    const tenantModal = document.getElementById('tenant-modal');
    if (tenantModal) {
        tenantModal.style.display = 'none';
    }
    
    // Refresh UI
    refreshCurrentView();
}

// Hàm tự động tạo phòng cho nhà mới
function createRoomsForHouse(houseId, roomsCount, houseName) {
    for (let i = 1; i <= roomsCount; i++) {
        const roomNumber = i.toString().padStart(2, '0'); // 01, 02, 03...
        const roomName = `Số ${roomNumber}`; // Số 01, 02, 03...
        
        const roomData = {
            houseId: houseId,
            name: roomName,
            price: 0, // Giá mặc định, người dùng có thể sửa sau
            status: 'available',
            area: '',
            description: '', // Không tự động thêm mô tả
            image: ''
        };
        
        // Thêm phòng vào database
        addRoom(roomData);
    }
}

// Hàm tạo thêm phòng khi sửa nhà (từ số thứ tự cụ thể)
function createAdditionalRoomsForHouse(houseId, startNumber, additionalCount, houseName) {
    for (let i = 0; i < additionalCount; i++) {
        const roomNumber = (startNumber + i).toString().padStart(2, '0');
        const roomName = `Số ${roomNumber}`;
        
        const roomData = {
            houseId: houseId,
            name: roomName,
            price: 0,
            status: 'available',
            area: '',
            description: '', // Không tự động thêm mô tả
            image: ''
        };
        
        // Thêm phòng vào database
        addRoom(roomData);
    }
}

// Hàm refresh UI dựa trên view hiện tại
function refreshCurrentView() {
    const homeSection = document.getElementById('home-section');
    const allRoomsSection = document.getElementById('all-rooms-section');
    const roomDetailsSection = document.getElementById('room-details-section');
    const tenantsSection = document.getElementById('tenants-section');
    const expensesSection = document.getElementById('expenses-section');
    const exportSection = document.getElementById('export-section');
    
    if (homeSection && homeSection.classList.contains('active')) {
        // Refresh dashboard
        renderDashboard();
    } else if (allRoomsSection && allRoomsSection.classList.contains('active')) {
        // Refresh danh sách phòng
        renderAllRoomsList();
    } else if (roomDetailsSection && roomDetailsSection.classList.contains('active')) {
        // Refresh chi tiết phòng
        const currentRoomId = roomDetailsSection.getAttribute('data-current-room-id');
        if (currentRoomId) {
            showRoomDetails(currentRoomId);
        }
    } else if (tenantsSection && tenantsSection.classList.contains('active')) {
        // Refresh danh sách người thuê
        renderAllTenantsList();
    } else if (expensesSection && expensesSection.classList.contains('active')) {
        // Refresh danh sách chi phí - có thể không có hàm này

    } else if (exportSection && exportSection.classList.contains('active')) {
        // Export section không cần refresh
        return;
    }
    
    // Luôn refresh danh sách nhà ở sidebar
    renderHousesList();
}

function showHouseExpenseSection(houseId) {
    // Use the global showSection function to properly manage sections
    if (typeof window.showSection === 'function') {
        window.showSection('house-expense');
    } else {
        // Fallback to direct manipulation
        hideAllSections();
        const section = document.getElementById('house-expense-section');
        if (section) {
            section.classList.add('active');
        }
    }
    
    // Wait a bit for the section to be properly shown, then render content
    setTimeout(() => {
        // Render house info
        const house = getHouseById(houseId);
        const infoDiv = document.getElementById('house-expense-info');
        const section = document.getElementById('house-expense-section');
        
        if (house && infoDiv) {
            infoDiv.innerHTML = `
                <h3>${house.name}</h3>
                <div><b>Địa chỉ:</b> ${house.address}</div>
                <div><b>Ghi chú:</b> ${house.notes || ''}</div>
            `;
        } else if (infoDiv) {
            infoDiv.innerHTML = '<i>Không tìm thấy thông tin nhà</i>';
        }
        
        // Store current houseId for expense entry
        if (section) {
            section.setAttribute('data-house-id', houseId);
        }
        
        // Clear entry area
        const entryArea = document.getElementById('house-expense-entry-area');
        if (entryArea) {
            entryArea.innerHTML = '';
        }
        
        // Render expense table
        renderHouseExpenseTable(houseId);
        
        // Setup provider info
        renderProviderInfo(houseId);
        
        // Setup expense card events
        setupExpenseCardEvents(houseId);
    }, 100);
}
window.showHouseExpenseSection = showHouseExpenseSection;

function renderHouseExpenseTable(houseId) {
    // Reset sort state to default
    currentSortField = 'createdAt';
    currentSortDirection = 'desc';
    
    // Use the new function with default sorting
    renderHouseExpenseTableWithSort(houseId, '', currentSortField, currentSortDirection);
}

// Global sort state
let currentSortField = 'createdAt';
let currentSortDirection = 'desc';

// Sort house expenses function
function sortHouseExpenses(houseId, field) {
    const tableArea = document.getElementById('house-expense-table-area');
    if (!tableArea) return;
    
    // Toggle sort direction if same field
    if (currentSortField === field) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortDirection = 'asc';
    }
    
    // Update sort state
    tableArea.setAttribute('data-current-sort', currentSortField);
    tableArea.setAttribute('data-current-direction', currentSortDirection);
    
    // Get current filter value
    const filterValue = document.getElementById('expense-type-filter')?.value || '';
    
    // Re-render table with current filter and new sort
    renderHouseExpenseTableWithSort(houseId, filterValue, currentSortField, currentSortDirection);
}

// Render table with sorting and filtering
function renderHouseExpenseTableWithSort(houseId, filterValue = '', sortField = 'createdAt', sortDirection = 'desc') {
    const tableArea = document.getElementById('house-expense-table-area');
    if (!tableArea) return;
    
    let expenses = JSON.parse(localStorage.getItem('houseExpenses') || '[]')
        .filter(e => e.houseId === houseId);
    
    // Apply filter
    if (filterValue) {
        expenses = expenses.filter(e => e.type === filterValue);
    }
    
    if (expenses.length === 0) {
        tableArea.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">Không có chi phí nào thuộc loại này</div>';
        return;
    }
    
    // Apply sorting
    expenses.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortField) {
            case 'type':
                aValue = getExpenseTypeLabel(a.type);
                bValue = getExpenseTypeLabel(b.type);
                break;
            case 'amount':
                aValue = parseFloat(a.amount) || 0;
                bValue = parseFloat(b.amount) || 0;
                break;
            case 'fromDate':
                aValue = a.fromDate ? new Date(a.fromDate) : new Date(0);
                bValue = b.fromDate ? new Date(b.fromDate) : new Date(0);
                break;
            case 'toDate':
                aValue = a.toDate ? new Date(a.toDate) : new Date(0);
                bValue = b.toDate ? new Date(b.toDate) : new Date(0);
                break;
            case 'notes':
                aValue = (a.notes || '').toLowerCase();
                bValue = (b.notes || '').toLowerCase();
                break;
            case 'paymentDate':
                aValue = a.paymentDate ? new Date(a.paymentDate) : new Date(0);
                bValue = b.paymentDate ? new Date(b.paymentDate) : new Date(0);
                break;
            case 'status':
                aValue = a.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
                bValue = b.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
                break;
            default:
                aValue = new Date(a.createdAt);
                bValue = new Date(b.createdAt);
        }
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    const expenseTypes = ['electricity', 'water', 'garbage', 'internet', 'phone', 'tv', 'other'];
    const typeOptions = expenseTypes.map(type => 
        `<option value="${type}" ${filterValue === type ? 'selected' : ''}>${getExpenseTypeLabel(type)}</option>`
    ).join('');
    
    // Generate sort icons with active state
    function getSortIcons(field) {
        const isActive = currentSortField === field;
        const isAsc = isActive && currentSortDirection === 'asc';
        const isDesc = isActive && currentSortDirection === 'desc';
        
        return `
            <div class="sort-icons">
                <div class="sort-icon asc ${isAsc ? 'active' : ''}" data-sort="${field}" data-direction="asc"></div>
                <div class="sort-icon desc ${isDesc ? 'active' : ''}" data-sort="${field}" data-direction="desc"></div>
            </div>
        `;
    }
    
    tableArea.innerHTML = `
        <div class="house-expense-table-wrapper">
            <div class="table-controls">
                <select id="expense-type-filter" onchange="filterExpenses('${houseId}')">
                    <option value="">Tất cả loại chi phí</option>
                    ${typeOptions}
                </select>
            </div>
            <table class="house-expense-table">
                <thead>
                    <tr>
                        <th class="sortable-header" data-sort="type" onclick="sortHouseExpenses('${houseId}', 'type')">
                            Hóa đơn
                            ${getSortIcons('type')}
                        </th>
                        <th class="sortable-header" data-sort="amount" onclick="sortHouseExpenses('${houseId}', 'amount')">
                            Số tiền
                            ${getSortIcons('amount')}
                        </th>
                        <th class="sortable-header" data-sort="fromDate" onclick="sortHouseExpenses('${houseId}', 'fromDate')">
                            Từ ngày
                            ${getSortIcons('fromDate')}
                        </th>
                        <th class="sortable-header" data-sort="toDate" onclick="sortHouseExpenses('${houseId}', 'toDate')">
                            Đến ngày
                            ${getSortIcons('toDate')}
                        </th>
                        <th class="sortable-header" data-sort="notes" onclick="sortHouseExpenses('${houseId}', 'notes')">
                            Ghi chú
                            ${getSortIcons('notes')}
                        </th>
                        <th class="sortable-header" data-sort="paymentDate" onclick="sortHouseExpenses('${houseId}', 'paymentDate')">
                            Ngày thanh toán
                            ${getSortIcons('paymentDate')}
                        </th>
                        <th class="sortable-header" data-sort="status" onclick="sortHouseExpenses('${houseId}', 'status')">
                            Trạng thái
                            ${getSortIcons('status')}
                        </th>
                        <th>Hình ảnh</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(e => `
                        <tr>
                            <td>${getExpenseTypeLabel(e.type)}</td>
                            <td>${formatCurrency(e.amount)}</td>
                            <td>${formatDate(e.fromDate) || '-'}</td>
                            <td>${formatDate(e.toDate) || '-'}</td>
                            <td>${e.notes || '-'}</td>
                            <td>${formatDate(e.paymentDate) || '-'}</td>
                            <td>${e.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</td>
                            <td>
                                ${e.billImage ? `<a href="${e.billImage}" target="_blank">Hóa đơn</a>` : ''}
                                ${e.paymentImage ? `<a href="${e.paymentImage}" target="_blank">Thanh toán</a>` : ''}
                            </td>
                            <td>
                                <button class="btn-sm btn-secondary" onclick="editHouseExpense('${e.id}')">Sửa</button>
                                <button class="btn-sm btn-danger" onclick="deleteHouseExpense('${e.id}', '${houseId}')">Xóa</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function filterExpenses(houseId) {
    const filterValue = document.getElementById('expense-type-filter').value;
    renderHouseExpenseTableWithSort(houseId, filterValue, currentSortField, currentSortDirection);
}

function editHouseExpense(expenseId) {
    const allExpenses = JSON.parse(localStorage.getItem('houseExpenses') || '[]');
    const expense = allExpenses.find(e => e.id === expenseId);
    if (!expense) {
        alert('Không tìm thấy chi phí để sửa');
        return;
    }
    
    // Render edit form
    const entryArea = document.getElementById('house-expense-entry-area');
    let label = getExpenseTypeLabel(expense.type);
    let icon = '';
    switch(expense.type) {
        case 'electricity': icon = 'fas fa-bolt'; break;
        case 'water': icon = 'fas fa-tint'; break;
        case 'garbage': icon = 'fas fa-trash'; break;
        case 'internet': icon = 'fas fa-wifi'; break;
        case 'phone': icon = 'fas fa-phone'; break;
        case 'tv': icon = 'fas fa-tv'; break;
        case 'other': icon = 'fas fa-ellipsis-h'; break;
        default: icon = 'fas fa-money-bill'; break;
    }
    
    entryArea.innerHTML = `
        <form id="house-expense-edit-form" class="form-section">
            <h4><i class="${icon}"></i> Sửa ${label}</h4>
            <input type="hidden" id="edit-expense-id" value="${expense.id}">
            <div class="form-group">
                <label for="edit-expense-amount">Số tiền (VNĐ):</label>
                <input type="number" id="edit-expense-amount" min="0" required value="${expense.amount}">
            </div>
            <div class="form-group">
                <label for="edit-expense-from-date">Từ ngày:</label>
                <input type="date" id="edit-expense-from-date" required value="${expense.fromDate || ''}">
            </div>
            <div class="form-group">
                <label for="edit-expense-to-date">Đến ngày:</label>
                <input type="date" id="edit-expense-to-date" required value="${expense.toDate || ''}">
            </div>
            <div class="form-group">
                <label for="edit-expense-payment-date">Ngày thanh toán:</label>
                <input type="date" id="edit-expense-payment-date" required value="${expense.paymentDate || ''}">
            </div>
            <div class="form-group">
                <label for="edit-expense-notes">Ghi chú:</label>
                <textarea id="edit-expense-notes">${expense.notes || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="edit-expense-bill-image">Hình ảnh Hóa Đơn:</label>
                <input type="file" id="edit-expense-bill-image" accept="image/*">
                <div id="edit-expense-bill-preview" class="image-preview">
                    ${expense.billImage ? `<img src="${expense.billImage}" style="max-width:120px;max-height:120px;">` : ''}
                </div>
            </div>
            <div class="form-group">
                <label for="edit-expense-payment-image">Hình ảnh Thanh toán Hóa Đơn:</label>
                <input type="file" id="edit-expense-payment-image" accept="image/*">
                <div id="edit-expense-payment-preview" class="image-preview">
                    ${expense.paymentImage ? `<img src="${expense.paymentImage}" style="max-width:120px;max-height:120px;">` : ''}
                </div>
            </div>
            <div class="form-group">
                <label for="edit-expense-status">Trạng thái:</label>
                <div class="radio-group">
                    <label><input type="radio" name="edit-expense-status" value="unpaid" ${expense.status === 'unpaid' ? 'checked' : ''}> Chưa thanh toán</label>
                    <label><input type="radio" name="edit-expense-status" value="paid" ${expense.status === 'paid' ? 'checked' : ''}> Đã thanh toán</label>
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn-primary">Cập nhật</button>
                <button type="button" class="btn-secondary" onclick="cancelEdit()">Hủy</button>
            </div>
        </form>
    `;
    
    // Add preview logic
    document.getElementById('edit-expense-bill-image').addEventListener('change', function(e) {
        previewImage(e.target, 'edit-expense-bill-preview');
    });
    document.getElementById('edit-expense-payment-image').addEventListener('change', function(e) {
        previewImage(e.target, 'edit-expense-payment-preview');
    });
    
    // Add submit logic
    document.getElementById('house-expense-edit-form').onsubmit = async function(ev) {
        ev.preventDefault();
        const amount = document.getElementById('edit-expense-amount').value;
        const fromDate = document.getElementById('edit-expense-from-date').value;
        const toDate = document.getElementById('edit-expense-to-date').value;
        const paymentDate = document.getElementById('edit-expense-payment-date').value;
        const notes = document.getElementById('edit-expense-notes').value;
        const status = document.querySelector('input[name="edit-expense-status"]:checked').value;
        const billFile = document.getElementById('edit-expense-bill-image').files[0];
        const paymentFile = document.getElementById('edit-expense-payment-image').files[0];
        
        let billImage = expense.billImage || '';
        let paymentImage = expense.paymentImage || '';
        
        if (billFile) billImage = await fileToBase64(billFile);
        if (paymentFile) paymentImage = await fileToBase64(paymentFile);
        
        const updatedExpense = {
            ...expense,
            amount,
            fromDate,
            toDate,
            paymentDate,
            notes,
            status,
            billImage,
            paymentImage,
            updatedAt: new Date().toISOString()
        };
        
        let houseExpenses = JSON.parse(localStorage.getItem('houseExpenses') || '[]');
        const index = houseExpenses.findIndex(e => e.id === expenseId);
        if (index !== -1) {
            houseExpenses[index] = updatedExpense;
            localStorage.setItem('houseExpenses', JSON.stringify(houseExpenses));
            entryArea.innerHTML = '<div style="color: #059669; font-weight: 600; padding: 20px;">Đã cập nhật chi phí thành công!</div>';
            renderHouseExpenseTableWithSort(expense.houseId, '', currentSortField, currentSortDirection);
        }
    };
}

function deleteHouseExpense(expenseId, houseId) {
    if (confirm('Bạn có chắc muốn xóa chi phí này?')) {
        let houseExpenses = JSON.parse(localStorage.getItem('houseExpenses') || '[]');
        houseExpenses = houseExpenses.filter(e => e.id !== expenseId);
        localStorage.setItem('houseExpenses', JSON.stringify(houseExpenses));
        renderHouseExpenseTableWithSort(houseId, '', currentSortField, currentSortDirection);
    }
}

function cancelEdit() {
    const entryArea = document.getElementById('house-expense-entry-area');
    entryArea.innerHTML = '';
}

// Make functions globally available
window.filterExpenses = filterExpenses;
window.editHouseExpense = editHouseExpense;
window.deleteHouseExpense = deleteHouseExpense;
window.cancelEdit = cancelEdit;

function getExpenseTypeLabel(type) {
    switch(type) {
        case 'electricity': return 'Tiền Điện';
        case 'water': return 'Tiền Nước';
        case 'garbage': return 'Tiền Rác';
        case 'internet': return 'Internet';
        case 'phone': return 'Điện Thoại';
        case 'tv': return 'Truyền Hình';
        case 'other': return 'Khác';
        default: return 'Chi phí';
    }
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ''; // Handle invalid dates
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Navigation: back to rooms
if (typeof window.houseExpenseNavSetup === 'undefined') {
    window.houseExpenseNavSetup = true;
    document.addEventListener('DOMContentLoaded', function() {
        // Setup back button using the new system
        if (typeof window.setupBackButtonForSection === 'function') {
            window.setupBackButtonForSection('house-expense');
        } else {
            // Fallback
            const backBtn = document.getElementById('back-to-rooms-btn');
            if (backBtn) {
                            backBtn.onclick = function() {
                // Explicitly hide house-expense-section before navigation
                const houseExpenseSection = document.getElementById('house-expense-section');
                if (houseExpenseSection) {
                    houseExpenseSection.classList.remove('active');
                }
                showSection('rooms');
            };
            }
        }
        // Expense type buttons
        document.querySelectorAll('.expense-type-btn').forEach(btn => {
            btn.onclick = function() {
                const type = btn.getAttribute('data-type');
                renderHouseExpenseEntry(type);
            };
        });
    });
}

function renderHouseExpenseEntry(type) {
    const houseId = document.getElementById('house-expense-section').getAttribute('data-house-id');
    const entryArea = document.getElementById('house-expense-entry-area');
    // Render a simple form for the selected expense type (can be expanded for each type)
    let label = '';
    let icon = '';
    switch(type) {
        case 'electricity': label = 'Tiền Điện'; icon = 'fas fa-bolt'; break;
        case 'water': label = 'Tiền Nước'; icon = 'fas fa-tint'; break;
        case 'garbage': label = 'Tiền Rác'; icon = 'fas fa-trash'; break;
        case 'internet': label = 'Internet'; icon = 'fas fa-wifi'; break;
        case 'phone': label = 'Điện Thoại'; icon = 'fas fa-phone'; break;
        case 'tv': label = 'Truyền Hình'; icon = 'fas fa-tv'; break;
        case 'other': label = 'Khác'; icon = 'fas fa-ellipsis-h'; break;
        default: label = 'Chi phí'; icon = 'fas fa-money-bill'; break;
    }
    entryArea.innerHTML = `
        <form id="house-expense-entry-form" class="form-section">
            <h4><i class="${icon}"></i> Khai báo hóa đơn</h4>
            <div class="form-group">
                <label for="expense-amount">Số tiền (VNĐ):</label>
                <input type="number" id="expense-amount" min="0" required>
            </div>
            <div class="form-group">
                <label for="expense-from-date">Từ ngày:</label>
                <input type="date" id="expense-from-date" required>
            </div>
            <div class="form-group">
                <label for="expense-to-date">Đến ngày:</label>
                <input type="date" id="expense-to-date" required>
            </div>
            <div class="form-group">
                <label for="expense-payment-date">Ngày thanh toán:</label>
                <input type="date" id="expense-payment-date" required>
            </div>
            <div class="form-group">
                <label for="expense-notes">Ghi chú:</label>
                <textarea id="expense-notes"></textarea>
            </div>
            <div class="form-group">
                <label for="expense-bill-image">Hình ảnh Hóa Đơn:</label>
                <input type="file" id="expense-bill-image" accept="image/*">
                <div id="expense-bill-preview" class="image-preview"></div>
            </div>
            <div class="form-group">
                <label for="expense-payment-image">Hình ảnh Thanh toán Hóa Đơn:</label>
                <input type="file" id="expense-payment-image" accept="image/*">
                <div id="expense-payment-preview" class="image-preview"></div>
            </div>
            <div class="form-group">
                <label for="expense-status">Trạng thái:</label>
                <div class="radio-group">
                    <label><input type="radio" name="expense-status" value="unpaid" checked> Chưa thanh toán</label>
                    <label><input type="radio" name="expense-status" value="paid"> Đã thanh toán</label>
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn-primary">Lưu</button>
            </div>
        </form>
    `;
    // Add preview logic
    document.getElementById('expense-bill-image').addEventListener('change', function(e) {
        previewImage(e.target, 'expense-bill-preview');
    });
    document.getElementById('expense-payment-image').addEventListener('change', function(e) {
        previewImage(e.target, 'expense-payment-preview');
    });
    // Add submit logic (save to localStorage)
    document.getElementById('house-expense-entry-form').onsubmit = async function(ev) {
        ev.preventDefault();
        const amount = document.getElementById('expense-amount').value;
        const fromDate = document.getElementById('expense-from-date').value;
        const toDate = document.getElementById('expense-to-date').value;
        const paymentDate = document.getElementById('expense-payment-date').value;
        const notes = document.getElementById('expense-notes').value;
        const status = document.querySelector('input[name="expense-status"]:checked').value;
        const billFile = document.getElementById('expense-bill-image').files[0];
        const paymentFile = document.getElementById('expense-payment-image').files[0];
        let billImage = '', paymentImage = '';
        if (billFile) billImage = await fileToBase64(billFile);
        if (paymentFile) paymentImage = await fileToBase64(paymentFile);
        const expense = {
            id: 'HE' + Date.now(),
            houseId,
            type,
            amount,
            fromDate,
            toDate,
            paymentDate,
            notes,
            status,
            billImage,
            paymentImage,
            createdAt: new Date().toISOString()
        };
        let houseExpenses = JSON.parse(localStorage.getItem('houseExpenses') || '[]');
        houseExpenses.push(expense);
        localStorage.setItem('houseExpenses', JSON.stringify(houseExpenses));
        entryArea.innerHTML = '<div style="color: #059669; font-weight: 600; padding: 20px;">Đã lưu chi phí thành công!</div>';
        renderHouseExpenseTableWithSort(houseId, '', currentSortField, currentSortDirection); // Re-render table after saving
    };
}

// Provider info logic for individual expense types
function renderProviderInfo(houseId) {
    const expenseTypes = ['electricity', 'water', 'garbage', 'internet', 'phone', 'tv', 'other'];
    expenseTypes.forEach(type => {
        const key = `houseProviderInfo_${houseId}_${type}`;
        const info = JSON.parse(localStorage.getItem(key) || '{}');
        const card = document.querySelector(`.expense-card[data-type="${type}"]`);
        if (card) {
            card.querySelector('.provider-name').textContent = info.name || '-';
            card.querySelector('.provider-customer-id').textContent = info.customerId || '-';
            card.querySelector('.provider-payday').textContent = info.payday || '-';
        }
    });
}

function showProviderEditForm(houseId, expenseType) {
    const key = `houseProviderInfo_${houseId}_${expenseType}`;
    const info = JSON.parse(localStorage.getItem(key) || '{}');
    const card = document.querySelector(`.expense-card[data-type="${expenseType}"]`);
    const cardInfo = card.querySelector('.expense-card-info');
    
    cardInfo.innerHTML = `
        <form class="provider-edit-form" style="width:100%;">
            <div class="provider-info-item"><b>Đơn vị cung cấp:</b> <input type="text" class="edit-provider-name" value="${info.name || ''}" style="width:180px;"></div>
            <div class="provider-info-item"><b>Mã Khách Hàng:</b> <input type="text" class="edit-provider-customer-id" value="${info.customerId || ''}" style="width:140px;"></div>
            <div class="provider-info-item"><b>Ngày đóng tiền hàng tháng:</b> <input type="text" class="edit-provider-payday" value="${info.payday || ''}" style="width:120px;" placeholder="VD: 10 hàng tháng"></div>
            <div style="margin-top:12px;display:flex;gap:8px;">
                <button type="submit" class="btn-primary" style="font-size:0.9rem;padding:6px 12px;"><i class="fas fa-save"></i> Lưu</button>
                <button type="button" class="btn-secondary cancel-provider-edit-btn" style="font-size:0.9rem;padding:6px 12px;">Hủy</button>
            </div>
        </form>
    `;
    
    card.querySelector('.cancel-provider-edit-btn').onclick = function() {
        // Restore original HTML structure
        cardInfo.innerHTML = `
            <div class="provider-info-item"><b>Đơn vị cung cấp:</b> <span class="provider-name">-</span></div>
            <div class="provider-info-item"><b>Mã Khách Hàng:</b> <span class="provider-customer-id">-</span></div>
            <div class="provider-info-item"><b>Ngày đóng tiền hàng tháng:</b> <span class="provider-payday">-</span></div>
        `;
        renderProviderInfo(houseId);
    };
    
    card.querySelector('.provider-edit-form').onsubmit = function(e) {
        e.preventDefault();
        const newInfo = {
            name: card.querySelector('.edit-provider-name').value,
            customerId: card.querySelector('.edit-provider-customer-id').value,
            payday: card.querySelector('.edit-provider-payday').value
        };
        localStorage.setItem(key, JSON.stringify(newInfo));
        
        // Restore original HTML structure
        cardInfo.innerHTML = `
            <div class="provider-info-item"><b>Đơn vị cung cấp:</b> <span class="provider-name">-</span></div>
            <div class="provider-info-item"><b>Mã Khách Hàng:</b> <span class="provider-customer-id">-</span></div>
            <div class="provider-info-item"><b>Ngày đóng tiền hàng tháng:</b> <span class="provider-payday">-</span></div>
        `;
        renderProviderInfo(houseId);
    };
}

// Patch setupExpenseCardEvents to open specific modals
function setupExpenseCardEvents(houseId) {
    // Setup edit provider buttons
    document.querySelectorAll('.edit-provider-btn').forEach(btn => {
        btn.onclick = function() {
            const expenseType = this.getAttribute('data-type');
            showProviderEditForm(houseId, expenseType);
        };
    });
    
    // Setup expense type buttons
    document.querySelectorAll('.expense-type-btn').forEach(btn => {
        btn.onclick = function() {
            const expenseType = this.getAttribute('data-type');
            openHouseExpenseModal(houseId, expenseType);
        };
    });
}

// Update showHouseExpenseSection to use new provider logic
const _origShowHouseExpenseSection = window.showHouseExpenseSection;
window.showHouseExpenseSection = function(houseId) {
    _origShowHouseExpenseSection(houseId);
    renderProviderInfo(houseId);
    setupExpenseCardEvents(houseId);
};
