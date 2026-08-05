// ===========================================
// CORE FUNCTIONS & UTILITIES
// ===========================================

// Constants
const LS_HOUSES_KEY = 'room-rental-app-houses';
const LS_ROOMS_KEY = 'room-rental-app-rooms';
const LS_TENANTS_KEY = 'room-rental-app-tenants';
const LS_EXPENSES_KEY = 'room-rental-app-expenses';

// Default images
const DEFAULT_HOUSE_IMAGE = 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2065&q=80';
const DEFAULT_ROOM_IMAGE = 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80';

// Utility functions
function generateId(type) {
    // Unified ID generation function
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9) + '_' + type;
}

function generateHouseId() {
    return generateId('house');
}

function generateRoomId() {
    return generateId('room');
}

function generateTenantId() {
    return generateId('tenant');
}

function generateExpenseId() {
    return generateId('expense');
}



// Currency formatting functions
function formatCurrency(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) {
        amount = 0;
    }
    
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function parseCurrency(formattedAmount) {
    if (!formattedAmount) return 0;
    
    const withoutDots = formattedAmount.replace(/\./g, '');
    const withDecimalDot = withoutDots.replace(/,/g, '.');
    const numericString = withDecimalDot.replace(/[^\d.-]/g, '');
    
    return parseFloat(numericString) || 0;
}

// Date formatting
function formatDate(dateString) {
    if (!dateString) return '';
    
    // Nếu là định dạng yyyy-mm-dd, chuyển thành dd-mm-yyyy
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dateString.match(dateRegex);
    
    if (match) {
        const [, year, month, day] = match;
        return `${day}-${month}-${year}`;
    }
    
    // Nếu không phải định dạng yyyy-mm-dd, dùng Date object
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return dateString; // Trả về chuỗi gốc nếu không parse được
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
}

// Convert date from yyyy-mm-dd to dd-mm-yyyy format
function formatDateDisplay(dateString) {
    if (!dateString) return dateString;
    
    // Check if it's already in yyyy-mm-dd format
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dateString.match(dateRegex);
    
    if (match) {
        const [, year, month, day] = match;
        return `${day}-${month}-${year}`;
    }
    
    return dateString;
}

// Convert date range text from yyyy-mm-dd to dd-mm-yyyy format
function formatDateRangeDisplay(rangeText) {
    if (!rangeText) return rangeText;
    
    // Pattern: "từ yyyy-mm-dd đến yyyy-mm-dd"
    const rangeRegex = /từ (\d{4}-\d{2}-\d{2}) đến (\d{4}-\d{2}-\d{2})/;
    const match = rangeText.match(rangeRegex);
    
    if (match) {
        const [, startDate, endDate] = match;
        const formattedStart = formatDateDisplay(startDate);
        const formattedEnd = formatDateDisplay(endDate);
        return `từ ${formattedStart} đến ${formattedEnd}`;
    }
    
    return rangeText;
}

// LocalStorage functions with error handling
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

function getFromLocalStorage(key, defaultValue = []) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return defaultValue;
    }
}

function saveHousesToLocalStorage(houses) {
    return saveToLocalStorage(LS_HOUSES_KEY, houses);
}

function getHousesFromLocalStorage() {
    return getFromLocalStorage(LS_HOUSES_KEY);
}

function saveRoomsToLocalStorage(rooms) {
    return saveToLocalStorage(LS_ROOMS_KEY, rooms);
}

function getRoomsFromLocalStorage() {
    return getFromLocalStorage(LS_ROOMS_KEY);
}

function saveTenantsToLocalStorage(tenants) {
    return saveToLocalStorage(LS_TENANTS_KEY, tenants);
}

function getTenantsFromLocalStorage() {
    return getFromLocalStorage(LS_TENANTS_KEY);
}

function saveExpensesToLocalStorage(expenses) {
    return saveToLocalStorage(LS_EXPENSES_KEY, expenses);
}

function getExpensesFromLocalStorage() {
    return getFromLocalStorage(LS_EXPENSES_KEY);
}

function saveHouseExpensesToLocalStorage(houseExpenses) {
    saveToLocalStorage('houseExpenses', houseExpenses);
}

function getHouseExpensesFromLocalStorage() {
    return getFromLocalStorage('houseExpenses');
}

function getAllProviderInfo() {
    const providerInfo = {};
    const keys = Object.keys(localStorage);
    const providerKeys = keys.filter(key => key.startsWith('houseProviderInfo_'));
    
    providerKeys.forEach(key => {
        providerInfo[key] = JSON.parse(localStorage.getItem(key) || '{}');
    });
    
    return providerInfo;
}

function saveAllProviderInfo(providerInfo) {
    Object.keys(providerInfo).forEach(key => {
        localStorage.setItem(key, JSON.stringify(providerInfo[key]));
    });
}

// Modal close function
function closeModals() {
    const modals = [
        document.getElementById('house-modal'),
        document.getElementById('room-modal'),
        document.getElementById('tenant-modal'),
        document.getElementById('expense-modal')
    ];
    
    modals.forEach(modal => {
        if (modal) modal.style.display = 'none';
    });
    
    // Reset forms
    const forms = [
        document.getElementById('house-form'),
        document.getElementById('room-form'),
        document.getElementById('tenant-form'),
        document.getElementById('expense-form')
    ];
    
    forms.forEach(form => {
        if (form) {
            form.reset();
            if (form.id === 'expense-form') {
                toggleExpenseFields('');
            }
        }
    });
}

// Show/hide sections
function hideAllSections() {
    try {
    const sections = document.querySelectorAll('main > section');
    const navButtons = document.querySelectorAll('nav a');
    
        sections.forEach((section) => {
            section.classList.remove('active');
        });
        
        navButtons.forEach((button) => {
            button.classList.remove('active');
        });
    } catch (error) {
        console.error('Error in hideAllSections:', error);
    }
}

function showSection(sectionId) {
    try {
        hideAllSections();
        
        const section = document.getElementById(sectionId);
        
        if (section) {
            section.classList.add('active');
        }
    } catch (error) {
        console.error('Error in showSection:', error);
        console.error('Error stack:', error.stack);
    }
}

function showSectionSimple(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('main > section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
        return true;
    } else {
        console.error('Section not found:', sectionId);
        return false;
    }
}

// Room status and type text functions
function getRoomStatusText(status) {
    const statusMap = {
        'available': 'Trống',
        'occupied': 'Đã thuê'
    };
    return statusMap[status] || status;
}

// Expense category text
function getCategoryText(category) {
    const categoryMap = {
        'room': 'Tiền phòng',
        'rent': 'Tiền thuê phòng',
        'electricity': 'Tiền điện',
        'water': 'Tiền nước',
        'internet': 'Tiền internet',
        'parking': 'Tiền gửi xe',
        'cleaning': 'Phí vệ sinh',
        'security': 'Phí bảo vệ',
        'other': 'Tiền rác',
        'deposit': 'Tiền cọc khi ký hợp đồng thuê phòng',
        'prepaid_unused': 'Tiền phòng đã thanh toán đầu kỳ'
    };
    return categoryMap[category] || category;
}

// Calculate total expense for tenant
function calculateTotalExpense(tenantId) {
    const expenses = getExpensesFromLocalStorage();
    const tenantExpenses = expenses.filter(expense => expense.tenantId === tenantId);
    return tenantExpenses.reduce((total, expense) => total + (expense.amount || 0), 0);
}

// Currency input handlers
function handleCurrencyInput(inputElement) {
    let value = inputElement.value.replace(/[^\d]/g, '');
    if (value) {
        value = parseInt(value).toLocaleString('vi-VN');
        inputElement.value = value;
    }
}

function handleCurrencyBlur(inputElement) {
    const value = inputElement.value;
    if (value) {
        const numericValue = parseCurrency(value);
        inputElement.value = formatCurrency(numericValue);
    }
}

// Hàm dọn dẹp các mô tả tự động đã có
function cleanupAutoGeneratedDescriptions() {
    const rooms = getRoomsFromLocalStorage();
    let cleanedCount = 0;
    
    const updatedRooms = rooms.map(room => {
        // Kiểm tra nếu mô tả chứa "Phòng được tạo tự động"
        if (room.description && room.description.includes('Phòng được tạo tự động')) {
            cleanedCount++;
            return {
                ...room,
                description: '' // Xóa mô tả tự động
            };
        }
        return room;
    });
    
    if (cleanedCount > 0) {
        saveRoomsToLocalStorage(updatedRooms);

        return true;
    } else {

        return false;
    }
}



// Tính năng export/import dữ liệu để đồng bộ
function exportAllData() {
    const data = {
        houses: getHousesFromLocalStorage(),
        rooms: getRoomsFromLocalStorage(),
        tenants: getTenantsFromLocalStorage(),
        expenses: getExpensesFromLocalStorage(),
        houseExpenses: getHouseExpensesFromLocalStorage(),
        providerInfo: getAllProviderInfo(),
        exportTime: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `rental-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    alert('Đã xuất dữ liệu thành công!');
}

function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Kiểm tra format dữ liệu
                if (!data.houses || !data.rooms || !data.tenants) {
                    throw new Error('File không đúng định dạng');
                }
                
                // Xác nhận import
                const confirmMsg = `Bạn có chắc muốn import dữ liệu?\n` +
                    `- ${data.houses.length} nhà\n` +
                    `- ${data.rooms.length} phòng\n` +
                    `- ${data.tenants.length} người thuê\n` +
                    `- ${data.expenses ? data.expenses.length : 0} chi phí phòng\n` +
                    `- ${data.houseExpenses ? data.houseExpenses.length : 0} chi phí nhà\n` +
                    `- ${data.providerInfo ? Object.keys(data.providerInfo).length : 0} thông tin nhà cung cấp\n` +
                    `Dữ liệu hiện tại sẽ bị ghi đè!`;
                
                if (!confirm(confirmMsg)) return;
                
                // Import dữ liệu
                saveHousesToLocalStorage(data.houses);
                saveRoomsToLocalStorage(data.rooms);
                saveTenantsToLocalStorage(data.tenants);
                if (data.expenses) {
                    saveExpensesToLocalStorage(data.expenses);
                }
                if (data.houseExpenses) {
                    saveHouseExpensesToLocalStorage(data.houseExpenses);
                }
                if (data.providerInfo) {
                    saveAllProviderInfo(data.providerInfo);
                }
                
                alert('Import dữ liệu thành công!');
                
                // Refresh UI
                if (typeof refreshCurrentView === 'function') {
                    refreshCurrentView();
                } else {
                    location.reload();
                }
                
            } catch (error) {
                alert('Lỗi khi import dữ liệu: ' + error.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Thêm nút export/import vào UI
function addDataSyncButtons() {
    const exportSection = document.getElementById('export-section');
    if (!exportSection) return;
    
    const syncDiv = document.createElement('div');
    syncDiv.className = 'export-group';
    syncDiv.innerHTML = `
        <h3><i class="fas fa-sync-alt"></i> Đồng bộ dữ liệu</h3>
        <div class="export-buttons">
            <button class="btn-primary" onclick="exportAllData()">
                <i class="fas fa-download"></i> Xuất dữ liệu
            </button>
            <button class="btn-secondary" onclick="importAllData()">
                <i class="fas fa-upload"></i> Nhập dữ liệu
            </button>
            <button class="btn-success" onclick="openCloudSignIn()">
                <i class="fas fa-cloud"></i> Đăng nhập đồng bộ
            </button>
            <span id="cloud-sync-controls" style="display:none; gap:8px; align-items:center;">
                <button class="btn-secondary" onclick="syncToCloudNow()"><i class="fas fa-sync"></i> Đồng bộ ngay</button>
                <button class="btn-secondary" onclick="signOutCloud()">Đăng xuất</button>
            </span>
        </div>
        <p class="export-note">
            <i class="fas fa-info-circle"></i> Xuất/nhập bản sao lưu thủ công hoặc đăng nhập để đồng bộ đám mây.
        </p>
        <p id="cloud-sync-status" class="export-note cloud-sync-status">Đang chuẩn bị đồng bộ đám mây…</p>
    `;
    
    exportSection.appendChild(syncDiv);
    window.dispatchEvent(new Event('cloud-sync-ui-ready'));
}



// Hàm kiểm tra tất cả ID trong hệ thống (đơn giản hóa)
function checkAllIds() {
    const houses = getHousesFromLocalStorage();
    const rooms = getRoomsFromLocalStorage();
    const tenants = getTenantsFromLocalStorage();
    const expenses = getExpensesFromLocalStorage();
    
    // Thống kê ID
    const stats = {
        houses: {
            total: houses.length,
            unique: new Set(houses.map(h => h.id)).size,
            duplicates: houses.length - new Set(houses.map(h => h.id)).size
        },
        rooms: {
            total: rooms.length,
            unique: new Set(rooms.map(r => r.id)).size,
            duplicates: rooms.length - new Set(rooms.map(r => r.id)).size
        },
        tenants: {
            total: tenants.length,
            unique: new Set(tenants.map(t => t.id)).size,
            duplicates: tenants.length - new Set(tenants.map(t => t.id)).size
        },
        expenses: {
            total: expenses.length,
            unique: new Set(expenses.map(e => e.id)).size,
            duplicates: expenses.length - new Set(expenses.map(e => e.id)).size
        }
    };
    
    // Kiểm tra format cũ
    const oldFormatHouseIds = houses.filter(h => /^\d+$/.test(h.id));
    const totalDuplicates = stats.houses.duplicates + stats.rooms.duplicates + stats.tenants.duplicates + stats.expenses.duplicates;
    const totalInvalidFormat = oldFormatHouseIds.length;
    
    if (totalDuplicates > 0 || totalInvalidFormat > 0) {
        if (confirm(`Phát hiện ${totalDuplicates} ID trùng lặp và ${totalInvalidFormat} ID cần cập nhật. Sửa ngay?`)) {
            fixDuplicateIds();
        }
    }
    
    return stats;
}

// Hàm sửa dữ liệu có ID trùng lặp
function fixDuplicateIds() {
    let totalFixed = 0;
    
    // 1. Sửa nhà có ID trùng hoặc định dạng cũ
    const houses = getHousesFromLocalStorage();
    const houseIds = new Set();
    const oldHouseIdPattern = /^\d+$/; // Chỉ timestamp
    let fixedHouses = 0;
    
    houses.forEach(house => {
        const needsNewId = houseIds.has(house.id) || oldHouseIdPattern.test(house.id);
        
        if (needsNewId) {
            // ID trùng hoặc định dạng cũ, tạo ID mới
            const oldId = house.id;
            house.id = generateHouseId();
            fixedHouses++;
            
            // Cập nhật rooms có houseId trùng
            const rooms = getRoomsFromLocalStorage();
            rooms.forEach(room => {
                if (room.houseId === oldId) {
                    room.houseId = house.id;
                }
            });
            saveRoomsToLocalStorage(rooms);
        } else {
            houseIds.add(house.id);
        }
    });
    
    if (fixedHouses > 0) {
        saveHousesToLocalStorage(houses);
        totalFixed += fixedHouses;
    }
    
    // 2. Sửa phòng có ID trùng
    const rooms = getRoomsFromLocalStorage();
    const roomIds = new Set();
    let fixedRooms = 0;
    
    rooms.forEach(room => {
        if (roomIds.has(room.id)) {
            // ID trùng, tạo ID mới
            const oldId = room.id;
            room.id = generateRoomId();
            fixedRooms++;
            
            // Cập nhật tenants có roomId trùng
            const tenants = getTenantsFromLocalStorage();
            tenants.forEach(tenant => {
                if (tenant.roomId === oldId) {
                    tenant.roomId = room.id;
                }
            });
            saveTenantsToLocalStorage(tenants);
        } else {
            roomIds.add(room.id);
        }
    });
    
    if (fixedRooms > 0) {
        saveRoomsToLocalStorage(rooms);
        totalFixed += fixedRooms;
    }
    
    // 3. Sửa người thuê có ID trùng
    const tenants = getTenantsFromLocalStorage();
    const tenantIds = new Set();
    let fixedTenants = 0;
    
    tenants.forEach(tenant => {
        if (tenantIds.has(tenant.id)) {
            // ID trùng, tạo ID mới
            const oldId = tenant.id;
            tenant.id = generateTenantId();
            fixedTenants++;
            
            // Cập nhật expenses có tenantId trùng
            const expenses = getExpensesFromLocalStorage();
            expenses.forEach(expense => {
                if (expense.tenantId === oldId) {
                    expense.tenantId = tenant.id;
                }
            });
            saveExpensesToLocalStorage(expenses);
        } else {
            tenantIds.add(tenant.id);
        }
    });
    
    if (fixedTenants > 0) {
        saveTenantsToLocalStorage(tenants);
        totalFixed += fixedTenants;
    }
    
    // 4. Sửa chi phí có ID trùng
    const expenses = getExpensesFromLocalStorage();
    const expenseIds = new Set();
    let fixedExpenses = 0;
    
    expenses.forEach(expense => {
        if (expenseIds.has(expense.id)) {
            // ID trùng, tạo ID mới
            const oldId = expense.id;
            expense.id = generateExpenseId();
            fixedExpenses++;
        } else {
            expenseIds.add(expense.id);
        }
    });
    
    if (fixedExpenses > 0) {
        saveExpensesToLocalStorage(expenses);
        totalFixed += fixedExpenses;
    }
    
    // Hiển thị kết quả
    if (totalFixed > 0) {
        setTimeout(() => {
            alert(`Đã sửa ${totalFixed} ID trùng lặp. Trang sẽ được làm mới.`);
            location.reload();
        }, 500);
    }
} 
