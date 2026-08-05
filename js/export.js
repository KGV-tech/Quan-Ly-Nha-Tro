// ===========================================
// EXCEL EXPORT FUNCTIONALITY
// ===========================================

// Initialize export functionality
function initExportFunctionality() {
    // Add event listeners for export buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('export-btn')) {
            const exportType = e.target.getAttribute('data-type');
            handleExport(exportType);
        }
    });
}

// Main export handler
function handleExport(exportType) {
    try {
        const exportHandlers = {
            'houses': exportHouses,
            'rooms': exportRooms,
            'tenants': exportTenants,
            'expenses': exportExpenses,
            'houseExpenses': exportHouseExpenses,
            'summary': exportSummary
        };
        
        const handler = exportHandlers[exportType];
        if (handler) {
            handler();
        } else {
            console.error('Unknown export type:', exportType);
            alert('Loại xuất file không được hỗ trợ');
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Lỗi xuất file: ' + error.message);
    }
}

// Export houses data
function exportHouses() {
    const houses = getHousesFromLocalStorage();
    const rooms = getRoomsFromLocalStorage();
    
    const data = houses.map(house => {
        const houseRooms = rooms.filter(room => room.houseId === house.id);
        const occupiedRooms = houseRooms.filter(room => room.status === 'occupied');
        
        return {
            'ID Nhà': house.id,
            'Tên nhà': house.name,
            'Địa chỉ': house.address,
            'Ghi chú': house.notes || '',
            'Tổng số phòng': houseRooms.length,
            'Số phòng đã thuê': occupiedRooms.length,
            'Số phòng trống': houseRooms.length - occupiedRooms.length,
            'Tỷ lệ lấp đầy': houseRooms.length > 0 ? 
                Math.round((occupiedRooms.length / houseRooms.length) * 100) + '%' : '0%'
        };
    });
    
    exportToExcel(data, 'Danh_sach_nha_' + getCurrentDate());
}

// Export rooms data
function exportRooms() {
    const houses = getHousesFromLocalStorage();
    const rooms = getRoomsFromLocalStorage();
    const tenants = getTenantsFromLocalStorage();
    
    const data = rooms.map(room => {
        const house = houses.find(h => h.id === room.houseId);
        const roomTenants = tenants.filter(t => t.roomId === room.id);
        
        return {
            'ID Phòng': room.id,
            'Tên phòng': room.name,
            'Nhà': house ? house.name : 'Không xác định',
            'Địa chỉ nhà': house ? house.address : '',
            'Giá phòng (VNĐ)': formatCurrency(room.price),
            'Trạng thái': getStatusText(room.status),
            'Số người thuê': roomTenants.length,
            'Danh sách người thuê': roomTenants.map(t => t.name).join(', ') || 'Không có',
            'Ghi chú': room.notes || ''
        };
    });
    
    exportToExcel(data, 'Danh_sach_phong_' + getCurrentDate());
}

// Export tenants data
function exportTenants() {
    const tenants = getTenantsFromLocalStorage();
    const rooms = getRoomsFromLocalStorage();
    const houses = getHousesFromLocalStorage();
    
    const data = tenants.map(tenant => {
        const room = rooms.find(r => r.id === tenant.roomId);
        const house = room ? houses.find(h => h.id === room.houseId) : null;
        
        return {
            'ID Người thuê': tenant.id,
            'Họ tên': tenant.name,
            'Số điện thoại': tenant.phone || '',
            'Email': tenant.email || '',
            'CMND/CCCD': tenant.idNumber || '',
            'Phòng': room ? room.name : 'Không xác định',
            'Nhà': house ? house.name : 'Không xác định',
            'Địa chỉ nhà': house ? house.address : '',
            'Ngày bắt đầu thuê': formatDate(tenant.startDate),
            'Ngày kết thúc thuê': tenant.endDate ? formatDate(tenant.endDate) : 'Chưa có',
            'Trạng thái': tenant.status === 'active' ? 'Đang thuê' : 'Đã trả phòng',
            'Ghi chú': tenant.notes || ''
        };
    });
    
    exportToExcel(data, 'Danh_sach_nguoi_thue_' + getCurrentDate());
}

// Export expenses data
function exportExpenses() {
    const expenses = getExpensesFromLocalStorage();
    const tenants = getTenantsFromLocalStorage();
    const rooms = getRoomsFromLocalStorage();
    const houses = getHousesFromLocalStorage();
    
    const data = expenses.map(expense => {
        const tenant = tenants.find(t => t.id === expense.tenantId);
        const room = tenant ? rooms.find(r => r.id === tenant.roomId) : null;
        const house = room ? houses.find(h => h.id === room.houseId) : null;
        
        let details = '';
        if (expense.category === 'electricity') {
            details = `Chỉ số cũ: ${expense.oldIndex || 0}, Chỉ số mới: ${expense.newIndex || 0}, Đơn giá: ${formatCurrency(expense.unitPrice || 0)}/kWh`;
        } else if (expense.category === 'water') {
            details = `Chỉ số cũ: ${expense.oldIndex || 0}, Chỉ số mới: ${expense.newIndex || 0}, Đơn giá: ${formatCurrency(expense.unitPrice || 0)}/m³`;
        }
        
        return {
            'ID Chi phí': expense.id,
            'Người thuê': tenant ? tenant.name : 'Không xác định',
            'Phòng': room ? room.name : 'Không xác định',
            'Nhà': house ? house.name : 'Không xác định',
            'Loại chi phí': getCategoryText(expense.category),
            'Số tiền (VNĐ)': formatCurrency(expense.amount),
            'Ngày tạo': formatDate(expense.date),
            'Thời gian từ': expense.fromDate ? formatDate(expense.fromDate) : '',
            'Thời gian đến': expense.toDate ? formatDate(expense.toDate) : '',
            'Trạng thái thanh toán': expense.paidStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán',
            'Chi tiết': details,
            'Ghi chú': expense.notes || ''
        };
    });
    
    exportToExcel(data, 'Ky_thanh_toan_' + getCurrentDate());
}

// Export house expenses data
function exportHouseExpenses() {
    const houseExpenses = getHouseExpensesFromLocalStorage();
    const houses = getHousesFromLocalStorage();
    
    const data = houseExpenses.map(expense => {
        const house = houses.find(h => h.id === expense.houseId);
        
        return {
            'ID Chi phí': expense.id,
            'Nhà': house ? house.name : 'Không xác định',
            'Địa chỉ nhà': house ? house.address : '',
            'Loại chi phí': getHouseExpenseTypeText(expense.type),
            'Số tiền (VNĐ)': formatCurrency(expense.amount),
            'Ngày tạo': formatDate(expense.date),
            'Thời gian từ': expense.fromDate ? formatDate(expense.fromDate) : '',
            'Thời gian đến': expense.toDate ? formatDate(expense.toDate) : '',
            'Ngày thanh toán': expense.paymentDate ? formatDate(expense.paymentDate) : '',
            'Trạng thái': expense.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán',
            'Ghi chú': expense.notes || ''
        };
    });
    
    exportToExcel(data, 'Chi_phi_nha_' + getCurrentDate());
}

// Export summary report
function exportSummary() {
    const houses = getHousesFromLocalStorage();
    const rooms = getRoomsFromLocalStorage();
    const tenants = getTenantsFromLocalStorage();
    const expenses = getExpensesFromLocalStorage();
    const houseExpenses = getHouseExpensesFromLocalStorage();
    
    // Create multiple sheets
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Tổng quan
    const summaryData = [
        {
            'Chỉ số': 'Tổng số nhà',
            'Giá trị': houses.length
        },
        {
            'Chỉ số': 'Tổng số phòng',
            'Giá trị': rooms.length
        },
        {
            'Chỉ số': 'Số phòng đã thuê',
            'Giá trị': rooms.filter(r => r.status === 'occupied').length
        },
        {
            'Chỉ số': 'Số phòng trống',
            'Giá trị': rooms.filter(r => r.status === 'available').length
        },
        {
            'Chỉ số': 'Tổng số người thuê',
            'Giá trị': tenants.length
        },
        {
            'Chỉ số': 'Số người đang thuê',
            'Giá trị': tenants.filter(t => t.status === 'active').length
        },
        {
            'Chỉ số': 'Tổng số chi phí phòng',
            'Giá trị': expenses.length
        },
        {
            'Chỉ số': 'Tổng tiền chi phí phòng (VNĐ)',
            'Giá trị': formatCurrency(expenses.reduce((sum, e) => sum + Number(e.amount), 0))
        },
        {
            'Chỉ số': 'Tổng số chi phí nhà',
            'Giá trị': houseExpenses.length
        },
        {
            'Chỉ số': 'Tổng tiền chi phí nhà (VNĐ)',
            'Giá trị': formatCurrency(houseExpenses.reduce((sum, e) => sum + Number(e.amount), 0))
        },
        {
            'Chỉ số': 'Tổng tiền đã thanh toán (VNĐ)',
            'Giá trị': formatCurrency(expenses.filter(e => e.paidStatus === 'paid').reduce((sum, e) => sum + Number(e.amount), 0))
        },
        {
            'Chỉ số': 'Tổng tiền chưa thanh toán (VNĐ)',
            'Giá trị': formatCurrency(expenses.filter(e => e.paidStatus === 'unpaid').reduce((sum, e) => sum + Number(e.amount), 0))
        }
    ];
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tổng quan');
    
    // Sheet 2: Chi tiết nhà
    const housesData = houses.map(house => {
        const houseRooms = rooms.filter(room => room.houseId === house.id);
        const occupiedRooms = houseRooms.filter(room => room.status === 'occupied');
        const totalRevenue = expenses
            .filter(e => {
                const tenant = tenants.find(t => t.id === e.tenantId);
                if (!tenant) return false;
                const room = rooms.find(r => r.id === tenant.roomId);
                return room && room.houseId === house.id;
            })
            .reduce((sum, e) => sum + Number(e.amount), 0);
        
        return {
            'Tên nhà': house.name,
            'Địa chỉ': house.address,
            'Số phòng': houseRooms.length,
            'Số phòng đã thuê': occupiedRooms.length,
            'Tỷ lệ lấp đầy': houseRooms.length > 0 ? 
                Math.round((occupiedRooms.length / houseRooms.length) * 100) + '%' : '0%',
            'Tổng doanh thu (VNĐ)': formatCurrency(totalRevenue),
            'Ghi chú': house.notes || ''
        };
    });
    
    const housesSheet = XLSX.utils.json_to_sheet(housesData);
    XLSX.utils.book_append_sheet(workbook, housesSheet, 'Chi tiết nhà');
    
    // Sheet 3: Chi tiết phòng
    const roomsData = rooms.map(room => {
        const house = houses.find(h => h.id === room.houseId);
        const roomTenants = tenants.filter(t => t.roomId === room.id);
        const roomExpenses = expenses.filter(e => {
            const tenant = tenants.find(t => t.id === e.tenantId);
            return tenant && tenant.roomId === room.id;
        });
        
        return {
            'Tên phòng': room.name,
            'Nhà': house ? house.name : 'Không xác định',
            'Giá phòng (VNĐ)': formatCurrency(room.price),
            'Trạng thái': getStatusText(room.status),
            'Số người thuê': roomTenants.length,
            'Tổng chi phí (VNĐ)': formatCurrency(roomExpenses.reduce((sum, e) => sum + Number(e.amount), 0)),
            'Ghi chú': room.notes || ''
        };
    });
    
    const roomsSheet = XLSX.utils.json_to_sheet(roomsData);
    XLSX.utils.book_append_sheet(workbook, roomsSheet, 'Chi tiết phòng');
    
    // Sheet 4: Chi tiết người thuê
    const tenantsData = tenants.map(tenant => {
        const room = rooms.find(r => r.id === tenant.roomId);
        const house = room ? houses.find(h => h.id === room.houseId) : null;
        const tenantExpenses = expenses.filter(e => e.tenantId === tenant.id);
        
        return {
            'Họ tên': tenant.name,
            'Số điện thoại': tenant.phone || '',
            'Phòng': room ? room.name : 'Không xác định',
            'Nhà': house ? house.name : 'Không xác định',
            'Ngày bắt đầu': formatDate(tenant.startDate),
            'Trạng thái': tenant.status === 'active' ? 'Đang thuê' : 'Đã trả phòng',
            'Tổng chi phí (VNĐ)': formatCurrency(tenantExpenses.reduce((sum, e) => sum + Number(e.amount), 0)),
            'Số lần thanh toán': tenantExpenses.length
        };
    });
    
    const tenantsSheet = XLSX.utils.json_to_sheet(tenantsData);
    XLSX.utils.book_append_sheet(workbook, tenantsSheet, 'Chi tiết người thuê');
    
    // Sheet 5: Chi tiết chi phí
    const expensesData = expenses.map(expense => {
        const tenant = tenants.find(t => t.id === expense.tenantId);
        const room = tenant ? rooms.find(r => r.id === tenant.roomId) : null;
        const house = room ? houses.find(h => h.id === room.houseId) : null;
        
        return {
            'Người thuê': tenant ? tenant.name : 'Không xác định',
            'Phòng': room ? room.name : 'Không xác định',
            'Nhà': house ? house.name : 'Không xác định',
            'Loại chi phí': getCategoryText(expense.category),
            'Số tiền (VNĐ)': formatCurrency(expense.amount),
            'Ngày tạo': formatDate(expense.date),
            'Trạng thái': expense.paidStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán',
            'Ghi chú': expense.notes || ''
        };
    });
    
    const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Chi tiết chi phí phòng');
    
    // Sheet 6: Chi tiết chi phí nhà
    const houseExpensesData = houseExpenses.map(expense => {
        const house = houses.find(h => h.id === expense.houseId);
        
        return {
            'Nhà': house ? house.name : 'Không xác định',
            'Loại chi phí': getHouseExpenseTypeText(expense.type),
            'Số tiền (VNĐ)': formatCurrency(expense.amount),
            'Ngày tạo': formatDate(expense.date),
            'Thời gian từ': expense.fromDate ? formatDate(expense.fromDate) : '',
            'Thời gian đến': expense.toDate ? formatDate(expense.toDate) : '',
            'Ngày thanh toán': expense.paymentDate ? formatDate(expense.paymentDate) : '',
            'Trạng thái': expense.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán',
            'Ghi chú': expense.notes || ''
        };
    });
    
    const houseExpensesSheet = XLSX.utils.json_to_sheet(houseExpensesData);
    XLSX.utils.book_append_sheet(workbook, houseExpensesSheet, 'Chi tiết chi phí nhà');
    
    // Export the workbook
    const fileName = 'Bao_cao_tong_hop_' + getCurrentDate() + '.xlsx';
    XLSX.writeFile(workbook, fileName);
    
    showExportSuccess(fileName);
}

// Helper function to export single sheet data
function exportToExcel(data, fileName) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    const fullFileName = fileName + '.xlsx';
    XLSX.writeFile(workbook, fullFileName);
    
    showExportSuccess(fullFileName);
}

// Helper functions
function getCurrentDate() {
    const now = new Date();
    return now.getFullYear() + '-' + 
           String(now.getMonth() + 1).padStart(2, '0') + '-' + 
           String(now.getDate()).padStart(2, '0');
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

function getStatusText(status) {
    const statusMap = {
        'available': 'Còn trống',
        'occupied': 'Đã cho thuê',
        'maintenance': 'Bảo trì'
    };
    return statusMap[status] || status;
}



function getHouseExpenseTypeText(type) {
    const typeMap = {
        'electricity': 'Tiền điện',
        'water': 'Tiền nước',
        'garbage': 'Tiền rác',
        'internet': 'Tiền Internet',
        'phone': 'Tiền điện thoại',
        'tv': 'Tiền truyền hình',
        'other': 'Chi phí khác'
    };
    return typeMap[type] || type;
}

function showExportSuccess(fileName) {
    // Create success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        z-index: 10000;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <div>
            <div style="font-weight: 600;">Xuất file thành công!</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">${fileName}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initExportFunctionality();
}); 