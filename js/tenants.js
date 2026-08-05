// ===========================================
// TENANTS & EXPENSES MANAGEMENT
// ===========================================

// DOM elements
let tenantsListEl, allTenantsListEl, expensesListEl;

// Global variables for room fees functionality
let isSavingRoomFees = false;
let roomFeesListenersSetup = false;
let timeGroupEditData = {};

// Initialize DOM elements
function initTenantsDOM() {
    tenantsListEl = document.getElementById('tenants-list');
    allTenantsListEl = document.getElementById('all-tenants-list');
    expensesListEl = document.getElementById('expenses-list');
    
    if (!tenantsListEl) console.warn('tenants-list element not found');
    if (!allTenantsListEl) console.warn('all-tenants-list element not found');
    if (!expensesListEl) console.warn('expenses-list element not found');
}

// Tenants CRUD operations
function getTenantsForRoom(roomId) {
    return getTenantsFromLocalStorage().filter(t => t.roomId === roomId);
}

function getTenantById(tenantId) {
    return getTenantsFromLocalStorage().find(t => t.id === tenantId);
}

function addTenant(tenant) {
    const tenants = getTenantsFromLocalStorage();
    tenant.id = generateTenantId();
    tenants.push(tenant);
    saveTenantsToLocalStorage(tenants);
    
    // Cập nhật trạng thái phòng thành "đã cho thuê"
    updateRoomStatus(tenant.roomId, 'occupied');
    
    // Reset search and render all tenants
    const searchInput = document.getElementById('tenant-search-input');
    if (searchInput) {
        searchInput.value = '';
        updateSearchResults('');
    } else {
        renderAllTenantsList();
    }
}

function updateTenant(updatedTenant) {
    const tenants = getTenantsFromLocalStorage();
    const index = tenants.findIndex(t => t.id === updatedTenant.id);
    if (index !== -1) {
        const oldTenant = tenants[index];
        tenants[index] = updatedTenant;
        saveTenantsToLocalStorage(tenants);
        
        // Nếu đổi phòng, cập nhật trạng thái phòng cũ và mới
        if (oldTenant.roomId !== updatedTenant.roomId) {
            // Phòng cũ: kiểm tra xem còn người thuê nào khác không
            const remainingInOld = tenants.filter(t => 
                t.id !== updatedTenant.id && t.roomId === oldTenant.roomId
            );
            if (remainingInOld.length === 0) {
                updateRoomStatus(oldTenant.roomId, 'available');
            }
            
            // Phòng mới: set thành đã cho thuê
            updateRoomStatus(updatedTenant.roomId, 'occupied');
        }
        
        // Reset search and render all tenants
        const searchInput = document.getElementById('tenant-search-input');
        if (searchInput) {
            searchInput.value = '';
            updateSearchResults('');
        } else {
            renderAllTenantsList();
        }
    }
}

function deleteTenant(tenantId) {
    const tenants = getTenantsFromLocalStorage();
    const tenantToDelete = tenants.find(t => t.id === tenantId);
    
    if (tenantToDelete) {
        // Xóa tất cả chi phí của người thuê này
        const expenses = getExpensesFromLocalStorage();
        saveExpensesToLocalStorage(expenses.filter(e => e.tenantId !== tenantId));
        
        // Xóa người thuê
        const updatedTenants = tenants.filter(t => t.id !== tenantId);
        saveTenantsToLocalStorage(updatedTenants);
        
        // Kiểm tra xem phòng còn người thuê nào khác không
        const remainingInRoom = updatedTenants.filter(t => t.roomId === tenantToDelete.roomId);
        if (remainingInRoom.length === 0) {
            // Nếu không còn ai, chuyển phòng về trạng thái "còn trống"
            updateRoomStatus(tenantToDelete.roomId, 'available');
        }
    }
    
    // Reset search and render all tenants
    const searchInput = document.getElementById('tenant-search-input');
    if (searchInput) {
        searchInput.value = '';
        updateSearchResults('');
    } else {
        renderAllTenantsList();
    }
}

// Expenses CRUD operations
function getExpensesForTenant(tenantId) {
    return getExpensesFromLocalStorage().filter(e => e.tenantId === tenantId);
}

function addExpense(expense) {
    const expenses = getExpensesFromLocalStorage();
    expense.id = generateExpenseId();
    expenses.push(expense);
    saveExpensesToLocalStorage(expenses);
    renderExpensesList(expense.tenantId);
}

function updateExpense(updatedExpense) {
    const expenses = getExpensesFromLocalStorage();
    const index = expenses.findIndex(e => e.id === updatedExpense.id);
    if (index !== -1) {
        expenses[index] = updatedExpense;
        saveExpensesToLocalStorage(expenses);
        renderExpensesList(updatedExpense.tenantId);
    }
}

function deleteExpense(expenseId, tenantId) {
    const expenses = getExpensesFromLocalStorage();
    saveExpensesToLocalStorage(expenses.filter(e => e.id !== expenseId));
    renderExpensesList(tenantId);
}

function calculateTotalExpense(tenantId) {
    return getExpensesForTenant(tenantId).reduce((total, e) => total + Number(e.amount), 0);
}

// ===========================================
// ROOM FEES LOGIC (WHERE DUPLICATE ISSUE IS)
// ===========================================

// Phiếu thu tiền phòng và phiếu trả phòng là hai luồng dữ liệu độc lập.
function isMoveoutRoomFeeExpense(expense) {
    return expense.receiptType === 'moveout' ||
        expense.category === 'deposit' ||
        expense.category === 'prepaid_unused';
}

function isTenantMovedOut(tenant) {
    return tenant.status === 'moved_out' || Boolean(tenant.moveOutDate) || Boolean(tenant.endDate);
}

function completeTenantMoveout(tenantId) {
    const tenants = getTenantsFromLocalStorage();
    const tenant = tenants.find(item => item.id === tenantId);
    if (!tenant || isTenantMovedOut(tenant)) return;
    if (!confirm(`Hoàn tất trả phòng cho ${tenant.name}? Hồ sơ và toàn bộ lịch sử thu tiền vẫn được giữ lại.`)) return;

    tenant.status = 'moved_out';
    tenant.moveOutDate = new Date().toISOString().split('T')[0];
    tenant.endDate = tenant.moveOutDate;
    saveTenantsToLocalStorage(tenants);

    const stillOccupied = tenants.some(item => item.roomId === tenant.roomId && !isTenantMovedOut(item));
    if (!stillOccupied) updateRoomStatus(tenant.roomId, 'available');

    renderAllTenantsList();
    window.showSection('all-tenants');
}

function openRoomFeesModal(tenantId, options) {
    const mode = options && options.mode ? options.mode : 'add';
    const tenant = getTenantsFromLocalStorage().find(t => t.id === tenantId);
    if (!tenant) {
        alert("Không tìm thấy thông tin người thuê");
        return;
    }
    
    // Store current tenant for fallback
    window.currentTenantId = tenantId;
    
    // Thiết lập thông tin người thuê
    const els = {
        tenantId: document.getElementById('room-fees-tenant-id'),
        tenantName: document.getElementById('room-fees-tenant-name'),
        houseName: document.getElementById('room-fees-house-name'),
        roomId: document.getElementById('room-fees-room-id')
    };
    
    if (els.tenantId) els.tenantId.value = tenant.id;
    if (els.tenantName) els.tenantName.textContent = tenant.name;
    
    // Set room and house information
    if (els.roomId || els.houseName) {
        const room = getRoomById(tenant.roomId);
        if (room) {
            // Set room name
            if (els.roomId) {
                els.roomId.textContent = room.name;
            }
            
            // Set house name
            if (els.houseName) {
                const house = getHouseById(room.houseId);
                els.houseName.textContent = house ? house.name : 'Không xác định';
            }
        } else {
            // Fallback when room not found
            if (els.roomId) els.roomId.textContent = tenant.roomId;
            if (els.houseName) els.houseName.textContent = 'Không xác định';
        }
    }
    
    // Cập nhật tiêu đề theo ngữ cảnh
    const roomFeesModal = document.getElementById('room-fees-modal');
    const roomFeesTitle = document.getElementById('room-fees-modal-title');
    if (roomFeesTitle) {
        roomFeesTitle.textContent = roomFeesModal && roomFeesModal.classList.contains('inline-room-fees')
            ? 'Khai báo trả phòng'
            : 'Thu tiền phòng';
    }
    const isMoveoutMode = !!(roomFeesModal && roomFeesModal.classList.contains('inline-room-fees'));
    const saveRoomFeesButton = document.getElementById('save-room-fees-btn');
    if (saveRoomFeesButton) saveRoomFeesButton.textContent = isMoveoutMode ? 'Lưu' : 'Lưu khoản thu';
    const refundCard = document.getElementById('room-fees-refund-card');
    if (refundCard) {
        refundCard.style.display = isMoveoutMode ? 'block' : 'none';
    }
    if (!isMoveoutMode) {
        ['room-fees-deposit', 'room-fees-prepaid-unused'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = '';
                input.setAttribute('data-value', 0);
            }
        });
        const refundNotes = document.getElementById('room-fees-refund-notes');
        if (refundNotes) refundNotes.value = '';
    }
    
    // Thiết lập thời gian mặc định chỉ khi thêm mới
    if (mode === 'add') {
        resetModalMethodSelections();
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-based
        const configuredStartDay = tenant.rentStartDay ? parseInt(tenant.rentStartDay, 10) : 1;
        const configuredEndDay = tenant.rentEndDay ? parseInt(tenant.rentEndDay, 10) : null;
        // From date: current month, day = max(1, startDay - 1)
        const fromDay = Math.max(1, (configuredStartDay || 1) - 1);
        const fromDateObj = new Date(currentYear, currentMonth, fromDay);
        // To date: next month, day = (endDay - 1) or last day of next month
        const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const nextMonthIndex = (currentMonth + 1) % 12;
        const nextMonthLastDay = new Date(nextMonthYear, nextMonthIndex + 1, 0).getDate();
        const toDay = configuredEndDay ? Math.max(1, Math.min(configuredEndDay - 1, nextMonthLastDay)) : nextMonthLastDay;
        const toDateObj = new Date(nextMonthYear, nextMonthIndex, toDay);
        document.getElementById('room-fees-from-date').value = fromDateObj.toISOString().split('T')[0];
        document.getElementById('room-fees-to-date').value = toDateObj.toISOString().split('T')[0];
    }
    
    // Thiết lập giá trị mặc định
    const defaults = { 
        electricity: 4000, 
        water: 11000,
        roomPrice: 2200000,
        garbage: 20000,
        internet: 0,
        deposit: Number(tenant.initialDeposit) || 0
    };
    
    // Reset fields với giá trị mặc định chỉ khi thêm mới
    if (mode === 'add') {
        ['electricity', 'water'].forEach(type => {
            document.getElementById(`room-fees-${type}-old-index`).value = "";
            document.getElementById(`room-fees-${type}-new-index`).value = "";
            document.getElementById(`room-fees-${type}-unit-price`).value = defaults[type];
            const amt = document.getElementById(`room-fees-${type}-amount`);
            amt.value = "";
            amt.setAttribute('data-value', 0);
        });
    }
    
    // Set default room price chỉ khi thêm mới
    if (mode === 'add') {
        const roomPriceInput = document.getElementById('room-fees-room-price');
        const roomForPrice = getRoomById(tenant.roomId);
        const roomPriceFromRoom = roomForPrice && typeof roomForPrice.price === 'number' && roomForPrice.price > 0 ? roomForPrice.price : null;
        const defaultRoomPrice = roomPriceFromRoom || tenant.rentAmount || defaults.roomPrice;
        if (roomPriceInput) {
            roomPriceInput.value = formatCurrency(defaultRoomPrice);
            roomPriceInput.setAttribute('data-value', defaultRoomPrice);
        }
    }
    
    // Set default garbage, internet, deposit fees chỉ khi thêm mới
    if (mode === 'add') {
        const garbageInput = document.getElementById('room-fees-garbage');
        const internetInput = document.getElementById('room-fees-internet');
        const depositInput = document.getElementById('room-fees-deposit');
        
        if (garbageInput) {
            garbageInput.value = formatCurrency(defaults.garbage);
            garbageInput.setAttribute('data-value', defaults.garbage);
        }
        if (internetInput) {
            internetInput.value = formatCurrency(defaults.internet);
            internetInput.setAttribute('data-value', defaults.internet);
        }
        if (isMoveoutMode && depositInput) {
            depositInput.value = formatCurrency(defaults.deposit);
            depositInput.setAttribute('data-value', defaults.deposit);
        }
    }

    // Chỉ phiếu thu tiền phòng mới có thể kế thừa kỳ thu tiền phòng trước đó.
    // Phiếu trả phòng luôn được khai báo độc lập.
    if (mode === 'add' && !isMoveoutMode) {
        const latestReceipt = getLatestReceiptDataForTenant(tenantId);
        if (latestReceipt) {
            const fromDateEl = document.getElementById('room-fees-from-date');
            const toDateEl = document.getElementById('room-fees-to-date');
            if (fromDateEl && latestReceipt.fromDate) fromDateEl.value = latestReceipt.fromDate;
            if (toDateEl && latestReceipt.toDate) toDateEl.value = latestReceipt.toDate;

            const setCurrencyField = (id, amount) => {
                const el = document.getElementById(id);
                if (!el) return;
                const normalized = Number(amount) || 0;
                el.value = formatCurrency(normalized);
                el.setAttribute('data-value', normalized);
            };

            const electricity = latestReceipt.items.find(i => i.category === 'electricity');
            const water = latestReceipt.items.find(i => i.category === 'water');
            const rent = latestReceipt.items.find(i => i.category === 'rent');
            const garbage = latestReceipt.items.find(i => i.category === 'other');
            const internet = latestReceipt.items.find(i => i.category === 'internet');

            const electricityNotesEl = document.getElementById('room-fees-electricity-notes');
            const waterNotesEl = document.getElementById('room-fees-water-notes');
            const otherNotesEl = document.getElementById('room-fees-other-notes');

            const stripNotePrefix = (text) => (text || '').replace(/^📝\s*Lưu ý:\s*/i, '').trim();

            if (electricity) {
                const method = electricity.method === 'direct' ? 'direct' : 'consumption';
                const radio = document.querySelector(`input[name="electricity-method"][value="${method}"]`);
                if (radio) radio.checked = true;
                if (method === 'consumption') {
                    document.getElementById('electricity-consumption-inputs').style.display = 'block';
                    document.getElementById('electricity-direct-inputs').style.display = 'none';
                    const oldEl = document.getElementById('room-fees-electricity-old-index');
                    const newEl = document.getElementById('room-fees-electricity-new-index');
                    const unitEl = document.getElementById('room-fees-electricity-unit-price');
                    if (oldEl) oldEl.value = electricity.oldIndex ?? '';
                    if (newEl) newEl.value = electricity.newIndex ?? '';
                    if (unitEl) unitEl.value = electricity.unitPrice ?? defaults.electricity;
                } else {
                    document.getElementById('electricity-consumption-inputs').style.display = 'none';
                    document.getElementById('electricity-direct-inputs').style.display = 'block';
                    setCurrencyField('room-fees-electricity-direct-amount', electricity.amount);
                }
                if (electricityNotesEl) electricityNotesEl.value = stripNotePrefix(electricity.notes);
            }

            if (water) {
                const method = water.method === 'direct' ? 'direct' : 'consumption';
                const radio = document.querySelector(`input[name="water-method"][value="${method}"]`);
                if (radio) radio.checked = true;
                if (method === 'consumption') {
                    document.getElementById('water-consumption-inputs').style.display = 'block';
                    document.getElementById('water-direct-inputs').style.display = 'none';
                    const oldEl = document.getElementById('room-fees-water-old-index');
                    const newEl = document.getElementById('room-fees-water-new-index');
                    const unitEl = document.getElementById('room-fees-water-unit-price');
                    if (oldEl) oldEl.value = water.oldIndex ?? '';
                    if (newEl) newEl.value = water.newIndex ?? '';
                    if (unitEl) unitEl.value = water.unitPrice ?? defaults.water;
                } else {
                    document.getElementById('water-consumption-inputs').style.display = 'none';
                    document.getElementById('water-direct-inputs').style.display = 'block';
                    setCurrencyField('room-fees-water-direct-amount', water.amount);
                }
                if (waterNotesEl) waterNotesEl.value = stripNotePrefix(water.notes);
            }

            setCurrencyField('room-fees-room-price', rent ? rent.amount : defaults.roomPrice);
            setCurrencyField('room-fees-garbage', garbage ? garbage.amount : defaults.garbage);
            setCurrencyField('room-fees-internet', internet ? internet.amount : defaults.internet);
            if (isMoveoutMode) setCurrencyField('room-fees-deposit', defaults.deposit);

            const mergedOtherNotes = [rent?.notes, garbage?.notes, internet?.notes]
                .map(stripNotePrefix)
                .find(Boolean) || '';
            if (otherNotesEl) otherNotesEl.value = mergedOtherNotes;
        } else {
            // Không có phiếu cũ thì dùng tiền cọc từ hồ sơ người thuê
            const depositInput = document.getElementById('room-fees-deposit');
            if (isMoveoutMode && depositInput) {
                depositInput.value = formatCurrency(defaults.deposit);
                depositInput.setAttribute('data-value', defaults.deposit);
            }
        }
    }
    
    // Clear editing state only khi thêm mới
    const modal = document.getElementById('room-fees-modal');
    if (modal && mode === 'add') {
        modal.removeAttribute('data-editing-time-key');
    }
    
    // Setup listeners if not already done
    setupRoomFeesListeners();
    
    // Tính tổng chỉ khi thêm mới (edit/copy sẽ tự tính sau khi điền dữ liệu)
    if (mode === 'add') {
        calculateTotalRoomFees();
    }
    
    // Show modal
    if (modal) {
        modal.style.display = 'block';
    } else {

        showTenantDetails(tenantId);
    }
}

function getLatestReceiptDataForTenant(tenantId) {
    const expenses = getExpensesFromLocalStorage().filter(expense => {
        if (expense.tenantId !== tenantId) return false;
        // Ưu tiên lấy phiếu thu phòng thông thường gần nhất; bỏ phiếu trả phòng
        if (isMoveoutRoomFeeExpense(expense)) return false;
        return true;
    });
    if (!expenses.length) return null;

    const groupedByPeriod = {};
    expenses.forEach(expense => {
        const fromDate = expense.fromDate || expense.date || '';
        const toDate = expense.toDate || expense.date || '';
        const key = `${fromDate}|${toDate}`;
        if (!groupedByPeriod[key]) {
            groupedByPeriod[key] = {
                fromDate,
                toDate,
                latestDate: toDate || fromDate,
                latestCreatedAt: expense.createdAt || expense.updatedAt || expense.date || '',
                items: []
            };
        }
        groupedByPeriod[key].items.push(expense);
        const candidateCreatedAt = expense.createdAt || expense.updatedAt || expense.date || '';
        if (new Date(candidateCreatedAt || 0) > new Date(groupedByPeriod[key].latestCreatedAt || 0)) {
            groupedByPeriod[key].latestCreatedAt = candidateCreatedAt;
        }
    });

    const groups = Object.values(groupedByPeriod);
    groups.sort((a, b) => {
        const byCreatedAt = new Date(b.latestCreatedAt || 0) - new Date(a.latestCreatedAt || 0);
        if (byCreatedAt !== 0) return byCreatedAt;
        return new Date(b.latestDate || 0) - new Date(a.latestDate || 0);
    });
    return groups[0] || null;
}

function resetModalMethodSelections() {
    // Reset electricity method to consumption
    const electricityConsumptionRadio = document.querySelector('input[name="electricity-method"][value="consumption"]');
    if (electricityConsumptionRadio) {
        electricityConsumptionRadio.checked = true;
    }
    
    // Reset water method to consumption
    const waterConsumptionRadio = document.querySelector('input[name="water-method"][value="consumption"]');
    if (waterConsumptionRadio) {
        waterConsumptionRadio.checked = true;
    }
    
    // Show consumption inputs, hide direct inputs
    const electricityConsumptionInputs = document.getElementById('electricity-consumption-inputs');
    const electricityDirectInputs = document.getElementById('electricity-direct-inputs');
    const waterConsumptionInputs = document.getElementById('water-consumption-inputs');
    const waterDirectInputs = document.getElementById('water-direct-inputs');
    
    if (electricityConsumptionInputs) electricityConsumptionInputs.style.display = 'block';
    if (electricityDirectInputs) electricityDirectInputs.style.display = 'none';
    if (waterConsumptionInputs) waterConsumptionInputs.style.display = 'block';
    if (waterDirectInputs) waterDirectInputs.style.display = 'none';
    
    // Clear direct input values
    const electricityDirectAmount = document.getElementById('room-fees-electricity-direct-amount');
    const waterDirectAmount = document.getElementById('room-fees-water-direct-amount');
    
    if (electricityDirectAmount) {
        electricityDirectAmount.value = '';
        electricityDirectAmount.removeAttribute('data-value');
    }
    if (waterDirectAmount) {
        waterDirectAmount.value = '';
        waterDirectAmount.removeAttribute('data-value');
    }
    
    // Clear notes fields
    const electricityNotesEl = document.getElementById('room-fees-electricity-notes');
    const waterNotesEl = document.getElementById('room-fees-water-notes');
    const otherNotesEl = document.getElementById('room-fees-other-notes');
    
    if (electricityNotesEl) electricityNotesEl.value = '';
    if (waterNotesEl) waterNotesEl.value = '';
    if (otherNotesEl) otherNotesEl.value = '';
}

function calculateTotalRoomFees() {
    // Calculate electricity based on selected method
    const electricityMethod = document.querySelector('input[name="electricity-method"]:checked')?.value || 'consumption';
    let electricityAmount = 0;
    
    if (electricityMethod === 'consumption') {
        const electricityOldIndexEl = document.getElementById('room-fees-electricity-old-index');
        const electricityNewIndexEl = document.getElementById('room-fees-electricity-new-index');
        const electricityUnitPriceEl = document.getElementById('room-fees-electricity-unit-price');
        const electricityAmountEl = document.getElementById('room-fees-electricity-amount');
        
        const electricityOldIndex = electricityOldIndexEl ? parseFloat(electricityOldIndexEl.value) || 0 : 0;
        const electricityNewIndex = electricityNewIndexEl ? parseFloat(electricityNewIndexEl.value) || 0 : 0;
        const electricityUnitPrice = electricityUnitPriceEl ? parseFloat(electricityUnitPriceEl.value) || 0 : 0;
        
        // Validation: mark field as invalid if new index < old index
        if (electricityNewIndexEl && electricityNewIndex > 0 && electricityNewIndex < electricityOldIndex) {
            electricityNewIndexEl.style.borderColor = '#e74c3c';
            electricityNewIndexEl.style.backgroundColor = '#fdf2f2';
        } else if (electricityNewIndexEl) {
            electricityNewIndexEl.style.borderColor = '';
            electricityNewIndexEl.style.backgroundColor = '';
        }
        
        const electricityUsage = Math.max(0, electricityNewIndex - electricityOldIndex);
        electricityAmount = electricityUsage * electricityUnitPrice;
        
        if (electricityAmountEl) {
            electricityAmountEl.setAttribute('data-value', electricityAmount);
            electricityAmountEl.value = formatCurrency(electricityAmount).replace(/\s₫$/, '');
        }
    } else {
        // Direct input method
        const electricityDirectEl = document.getElementById('room-fees-electricity-direct-amount');
        electricityAmount = electricityDirectEl ? parseInt(electricityDirectEl.getAttribute('data-value')) || 0 : 0;
    }
    
    // Calculate water based on selected method
    const waterMethod = document.querySelector('input[name="water-method"]:checked')?.value || 'consumption';
    let waterAmount = 0;
    
    if (waterMethod === 'consumption') {
        const waterOldIndexEl = document.getElementById('room-fees-water-old-index');
        const waterNewIndexEl = document.getElementById('room-fees-water-new-index');
        const waterUnitPriceEl = document.getElementById('room-fees-water-unit-price');
        const waterAmountEl = document.getElementById('room-fees-water-amount');
        
        const waterOldIndex = waterOldIndexEl ? parseFloat(waterOldIndexEl.value) || 0 : 0;
        const waterNewIndex = waterNewIndexEl ? parseFloat(waterNewIndexEl.value) || 0 : 0;
        const waterUnitPrice = waterUnitPriceEl ? parseFloat(waterUnitPriceEl.value) || 0 : 0;
        
        // Validation: mark field as invalid if new index < old index
        if (waterNewIndexEl && waterNewIndex > 0 && waterNewIndex < waterOldIndex) {
            waterNewIndexEl.style.borderColor = '#e74c3c';
            waterNewIndexEl.style.backgroundColor = '#fdf2f2';
        } else if (waterNewIndexEl) {
            waterNewIndexEl.style.borderColor = '';
            waterNewIndexEl.style.backgroundColor = '';
        }
        
        const waterUsage = Math.max(0, waterNewIndex - waterOldIndex);
        waterAmount = waterUsage * waterUnitPrice;
        
        if (waterAmountEl) {
            waterAmountEl.setAttribute('data-value', waterAmount);
            waterAmountEl.value = formatCurrency(waterAmount).replace(/\s₫$/, '');
        }
    } else {
        // Direct input method
        const waterDirectEl = document.getElementById('room-fees-water-direct-amount');
        waterAmount = waterDirectEl ? parseInt(waterDirectEl.getAttribute('data-value')) || 0 : 0;
    }
    
    // Get other fees
    const roomPriceEl = document.getElementById('room-fees-room-price');
    const garbageEl = document.getElementById('room-fees-garbage');
    const internetEl = document.getElementById('room-fees-internet');
    const depositEl = document.getElementById('room-fees-deposit');
    const prepaidUnusedEl = document.getElementById('room-fees-prepaid-unused');
    const totalEl = document.getElementById('room-fees-total');
    
    const roomPrice = roomPriceEl ? parseInt(roomPriceEl.getAttribute('data-value')) || 0 : 0;
    const garbagePrice = garbageEl ? parseInt(garbageEl.getAttribute('data-value')) || 0 : 0;
    const internetPrice = internetEl ? parseInt(internetEl.getAttribute('data-value')) || 0 : 0;
    const isMoveoutMode = !!(document.getElementById('room-fees-modal')?.classList.contains('inline-room-fees'));
    const depositAmount = isMoveoutMode && depositEl ? parseInt(depositEl.getAttribute('data-value')) || 0 : 0;
    const prepaidUnusedAmount = isMoveoutMode && prepaidUnusedEl ? parseInt(prepaidUnusedEl.getAttribute('data-value')) || 0 : 0;
    const totalTitleEl = document.getElementById('room-fees-total-title');
    
    // Calculate total
    const totalCosts = electricityAmount + waterAmount + roomPrice + garbagePrice + internetPrice;
    const settlementAmount = depositAmount + prepaidUnusedAmount - totalCosts;
    if (totalEl) {
        const displayAmount = isMoveoutMode ? Math.abs(settlementAmount) : totalCosts;
        totalEl.value = formatCurrency(displayAmount).replace(/\s₫$/, '');
        totalEl.setAttribute('data-value', isMoveoutMode ? settlementAmount : totalCosts);
    }

    if (totalTitleEl) {
        if (!isMoveoutMode) {
            totalTitleEl.textContent = '💯 Tổng cộng';
        } else if (settlementAmount > 0) {
            totalTitleEl.textContent = '💯 Chủ nhà trả lại tiền cho Người thuê phòng';
        } else if (settlementAmount < 0) {
            totalTitleEl.textContent = '💯 Người thuê phòng thanh toán cho Chủ nhà';
        } else {
            totalTitleEl.textContent = '💯 Hai bên đã thanh toán đủ';
        }
    }
}

function saveRoomFees() {
    if (isSavingRoomFees) {
        return;
    }
    isSavingRoomFees = true;
    
    const saveBtn = document.getElementById('save-room-fees-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu...';
    }
    
    try {
        const roomFeesModalEl = document.getElementById('room-fees-modal');
        const isMoveoutReceipt = !!(roomFeesModalEl && roomFeesModalEl.classList.contains('inline-room-fees'));
        const tenantIdEl = document.getElementById('room-fees-tenant-id');
        const tenantId = tenantIdEl ? tenantIdEl.value : window.currentTenantId;
        if (!tenantId) {
            alert("Không tìm thấy thông tin người thuê");
            return;
        }
        
        const fromDateEl = document.getElementById('room-fees-from-date');
        const toDateEl = document.getElementById('room-fees-to-date');
        const fromDate = fromDateEl ? fromDateEl.value : '';
        const toDate = toDateEl ? toDateEl.value : '';
        
        if (!fromDate || !toDate) {
            alert("Vui lòng chọn thời gian từ ngày và đến ngày");
            return;
        }
        

        
        // Calculate electricity based on method
        const electricityMethod = document.querySelector('input[name="electricity-method"]:checked')?.value || 'consumption';
        let electricityAmount = 0;
        let electricityOldIndex, electricityNewIndex, electricityUnitPrice;
        
        if (electricityMethod === 'consumption') {
            electricityOldIndex = parseFloat(document.getElementById('room-fees-electricity-old-index').value) || 0;
            electricityNewIndex = parseFloat(document.getElementById('room-fees-electricity-new-index').value) || 0;
            electricityUnitPrice = parseFloat(document.getElementById('room-fees-electricity-unit-price').value) || 0;
            
            // Validation: check if electricity new index is less than old index
            if (electricityNewIndex > 0 && electricityNewIndex < electricityOldIndex) {
                alert('Chỉ số điện mới không được nhỏ hơn Chỉ số cũ');
                document.getElementById('room-fees-electricity-new-index').focus();
                document.getElementById('room-fees-electricity-new-index').select();
                throw new Error('Invalid electricity index');
            }
            
            electricityAmount = Math.max(0, electricityNewIndex - electricityOldIndex) * electricityUnitPrice;
        } else {
            // Direct input method - KHÔNG khởi tạo index variables
            const electricityDirectEl = document.getElementById('room-fees-electricity-direct-amount');
            electricityAmount = electricityDirectEl ? parseInt(electricityDirectEl.getAttribute('data-value')) || 0 : 0;
        }
        
        // Calculate water based on method
        const waterMethod = document.querySelector('input[name="water-method"]:checked')?.value || 'consumption';
        let waterAmount = 0;
        let waterOldIndex, waterNewIndex, waterUnitPrice;
        
        if (waterMethod === 'consumption') {
            waterOldIndex = parseFloat(document.getElementById('room-fees-water-old-index').value) || 0;
            waterNewIndex = parseFloat(document.getElementById('room-fees-water-new-index').value) || 0;
            waterUnitPrice = parseFloat(document.getElementById('room-fees-water-unit-price').value) || 0;
            
            // Validation: check if water new index is less than old index
            if (waterNewIndex > 0 && waterNewIndex < waterOldIndex) {
                alert('Chỉ số nước mới không được nhỏ hơn Chỉ số cũ');
                document.getElementById('room-fees-water-new-index').focus();
                document.getElementById('room-fees-water-new-index').select();
                throw new Error('Invalid water index');
            }
            
            waterAmount = Math.max(0, waterNewIndex - waterOldIndex) * waterUnitPrice;
        } else {
            // Direct input method - KHÔNG khởi tạo index variables
            const waterDirectEl = document.getElementById('room-fees-water-direct-amount');
            waterAmount = waterDirectEl ? parseInt(waterDirectEl.getAttribute('data-value')) || 0 : 0;
        }
        
        const roomPrice = parseFloat(document.getElementById('room-fees-room-price').getAttribute('data-value')) || 0;
        const garbagePrice = parseFloat(document.getElementById('room-fees-garbage').getAttribute('data-value')) || 0;
        const internetPrice = parseFloat(document.getElementById('room-fees-internet').getAttribute('data-value')) || 0;
        const depositAmount = isMoveoutReceipt
            ? (parseFloat(document.getElementById('room-fees-deposit')?.getAttribute('data-value')) || 0)
            : 0;
        const prepaidUnusedAmount = isMoveoutReceipt
            ? (parseFloat(document.getElementById('room-fees-prepaid-unused')?.getAttribute('data-value')) || 0)
            : 0;
        
        // Get notes from textarea fields
        const electricityNotes = document.getElementById('room-fees-electricity-notes')?.value?.trim() || '';
        const waterNotes = document.getElementById('room-fees-water-notes')?.value?.trim() || '';
        const otherNotes = document.getElementById('room-fees-other-notes')?.value?.trim() || '';
        const refundNotes = document.getElementById('room-fees-refund-notes')?.value?.trim() || '';
    

    
        // Nếu đây là phiếu copy, cảnh báo nếu dữ liệu hoàn toàn trùng khớp với nguồn
        try {
            const modalEl = document.getElementById('room-fees-modal');
            const copyMetaStr = modalEl ? modalEl.getAttribute('data-copy-source') : null;
            if (copyMetaStr) {
                const meta = JSON.parse(copyMetaStr);
                const sameTenant = String(meta.tenantId) === String(tenantId);
                const sameRange = meta.fromDate === fromDate && meta.toDate === toDate;
                
                // Thu thập các item hiện tại từ form giống cấu trúc meta.items
                const currentItems = [];
                if ((parseInt(document.getElementById('room-fees-room-price').getAttribute('data-value')) || 0) > 0 || (document.getElementById('room-fees-other-notes')?.value?.trim() || '')) {
                    currentItems.push({ category: 'rent', amount: parseFloat(document.getElementById('room-fees-room-price').getAttribute('data-value')) || 0, method: null, oldIndex: null, newIndex: null, unitPrice: null, notes: (document.getElementById('room-fees-other-notes')?.value?.trim() ? `📝 Lưu ý: ${document.getElementById('room-fees-other-notes').value.trim()}` : '') });
                }
                if ((parseInt(document.getElementById('room-fees-garbage').getAttribute('data-value')) || 0) > 0 || (document.getElementById('room-fees-other-notes')?.value?.trim() || '')) {
                    currentItems.push({ category: 'other', amount: parseFloat(document.getElementById('room-fees-garbage').getAttribute('data-value')) || 0, method: null, oldIndex: null, newIndex: null, unitPrice: null, notes: (document.getElementById('room-fees-other-notes')?.value?.trim() ? `📝 Lưu ý: ${document.getElementById('room-fees-other-notes').value.trim()}` : '') });
                }
                if ((parseInt(document.getElementById('room-fees-internet').getAttribute('data-value')) || 0) > 0 || (document.getElementById('room-fees-other-notes')?.value?.trim() || '')) {
                    currentItems.push({ category: 'internet', amount: parseFloat(document.getElementById('room-fees-internet').getAttribute('data-value')) || 0, method: null, oldIndex: null, newIndex: null, unitPrice: null, notes: (document.getElementById('room-fees-other-notes')?.value?.trim() ? `📝 Lưu ý: ${document.getElementById('room-fees-other-notes').value.trim()}` : '') });
                }
                if (isMoveoutReceipt && ((parseInt(document.getElementById('room-fees-deposit')?.getAttribute('data-value')) || 0) > 0 || (document.getElementById('room-fees-refund-notes')?.value?.trim() || ''))) {
                    currentItems.push({ category: 'deposit', amount: parseFloat(document.getElementById('room-fees-deposit').getAttribute('data-value')) || 0, method: null, oldIndex: null, newIndex: null, unitPrice: null, notes: (document.getElementById('room-fees-refund-notes')?.value?.trim() ? `📝 Lưu ý: ${document.getElementById('room-fees-refund-notes').value.trim()}` : '') });
                }
                if (isMoveoutReceipt && (parseInt(document.getElementById('room-fees-prepaid-unused')?.getAttribute('data-value')) || 0) > 0) {
                    currentItems.push({ category: 'prepaid_unused', amount: parseFloat(document.getElementById('room-fees-prepaid-unused').getAttribute('data-value')) || 0, method: null, oldIndex: null, newIndex: null, unitPrice: null, notes: '' });
                }
                // Electricity
                if (electricityMethod === 'consumption') {
                    if (electricityAmount > 0 || (document.getElementById('room-fees-electricity-notes')?.value?.trim() || '')) {
                        currentItems.push({ category: 'electricity', amount: electricityAmount, method: 'consumption', oldIndex: electricityOldIndex || 0, newIndex: electricityNewIndex || 0, unitPrice: electricityUnitPrice || 0, notes: (document.getElementById('room-fees-electricity-notes')?.value?.trim() ? `📝 Lưu ý: ${document.getElementById('room-fees-electricity-notes').value.trim()}` : '') });
                    }
                } else {
                    if (electricityAmount > 0 || (document.getElementById('room-fees-electricity-notes')?.value?.trim() || '')) {
                        currentItems.push({ category: 'electricity', amount: electricityAmount, method: 'direct', oldIndex: null, newIndex: null, unitPrice: null, notes: (document.getElementById('room-fees-electricity-notes')?.value?.trim() ? `📝 Lưu ý: ${document.getElementById('room-fees-electricity-notes').value.trim()}` : '') });
                    }
                }
                // Water
                if (waterMethod === 'consumption') {
                    if (waterAmount > 0 || (document.getElementById('room-fees-water-notes')?.value?.trim() || '')) {
                        currentItems.push({ category: 'water', amount: waterAmount, method: 'consumption', oldIndex: waterOldIndex || 0, newIndex: waterNewIndex || 0, unitPrice: waterUnitPrice || 0, notes: (document.getElementById('room-fees-water-notes')?.value?.trim() ? `📝 Lưu ý: ${document.getElementById('room-fees-water-notes').value.trim()}` : '') });
                    }
                } else {
                    if (waterAmount > 0 || (document.getElementById('room-fees-water-notes')?.value?.trim() || '')) {
                        currentItems.push({ category: 'water', amount: waterAmount, method: 'direct', oldIndex: null, newIndex: null, unitPrice: null, notes: (document.getElementById('room-fees-water-notes')?.value?.trim() ? `📝 Lưu ý: ${document.getElementById('room-fees-water-notes').value.trim()}` : '') });
                    }
                }
                // So sánh sâu: cùng số lượng và từng phần tử trùng hoàn toàn theo category+fields tương ứng
                const normalize = arr => arr
                    .map(it => ({
                        category: it.category,
                        amount: Number(it.amount) || 0,
                        method: it.method || null,
                        oldIndex: it.oldIndex ?? null,
                        newIndex: it.newIndex ?? null,
                        unitPrice: it.unitPrice ?? null,
                        notes: it.notes || ''
                    }))
                    .sort((a,b) => a.category.localeCompare(b.category));
                const a = normalize(meta.items);
                const b = normalize(currentItems);
                const sameItems = a.length === b.length && a.every((ai, idx) => {
                    const bi = b[idx];
                    return ai.category === bi.category && ai.amount === bi.amount && ai.method === bi.method && ai.oldIndex === bi.oldIndex && ai.newIndex === bi.newIndex && ai.unitPrice === bi.unitPrice && ai.notes === bi.notes;
                });
                if (sameTenant && sameRange && sameItems) {
                    const cont = confirm('Phiếu copy đang hoàn toàn trùng khớp với phiếu cũ (chưa chỉnh gì). Bạn có chắc muốn lưu để tạo bản trùng không?');
                    if (!cont) {
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('Không thể kiểm tra trùng phiếu copy:', e);
        }

        // Get current expenses
        let expenses = getExpensesFromLocalStorage();
        
        // Remove old expenses if editing
        const editingTimeKey = document.getElementById('room-fees-modal').getAttribute('data-editing-time-key');
        const editingData = window.timeGroupEditData && window.timeGroupEditData[editingTimeKey];
        
        if (editingTimeKey && editingData) {
            // Get the expense IDs that were being edited
            const editingExpenseIds = editingData.map(e => e.id);
            
            // Remove these specific expenses
            expenses = expenses.filter(expense => !editingExpenseIds.includes(expense.id));
            
            // Clear the editing data
            delete window.timeGroupEditData[editingTimeKey];
            document.getElementById('room-fees-modal').removeAttribute('data-editing-time-key');
        } else {
            // Check for existing expenses in same time range to prevent duplicates
            const existingInTimeRange = expenses.filter(expense => 
                expense.tenantId === tenantId && 
                expense.fromDate === fromDate && 
                expense.toDate === toDate &&
                isMoveoutRoomFeeExpense(expense) === isMoveoutReceipt
            );
            
            if (existingInTimeRange.length > 0) {
                const confirmOverwrite = confirm(`Đã có chi phí trong khoảng thời gian từ ${formatDateDisplay(fromDate)} đến ${formatDateDisplay(toDate)}. Bạn có muốn ghi đè không?`);
                if (confirmOverwrite) {
                    // Remove existing expenses in same time range
                    expenses = expenses.filter(expense => 
                        !(expense.tenantId === tenantId && 
                          expense.fromDate === fromDate && 
                          expense.toDate === toDate &&
                          isMoveoutRoomFeeExpense(expense) === isMoveoutReceipt)
                    );
                } else {
                    // User cancelled, stop here
                    return;
                }
            }
        }
        
        // Add new expenses
        const newExpenses = [];
        
        if (electricityAmount > 0 || electricityNotes) {
            const expense = {
                id: generateExpenseId(),
                tenantId: tenantId,
                category: 'electricity',
                date: toDate,
                fromDate: fromDate,
                toDate: toDate,
                amount: electricityAmount,
                method: electricityMethod,
                paidStatus: 'unpaid',
                notes: electricityNotes ? `📝 Lưu ý: ${electricityNotes}` : '',
                receiptType: isMoveoutReceipt ? 'moveout' : 'room-fees'
            };
            if (electricityMethod === 'consumption') {
                expense.oldIndex = electricityOldIndex;
                expense.newIndex = electricityNewIndex;
                expense.usage = Math.max(0, electricityNewIndex - electricityOldIndex);
                expense.unitPrice = electricityUnitPrice;
            }
            expenses.push(expense);
            newExpenses.push(expense);
        }
        
        if (waterAmount > 0 || waterNotes) {
            const expense = {
                id: generateExpenseId(),
                tenantId: tenantId,
                category: 'water',
                date: toDate,
                fromDate: fromDate,
                toDate: toDate,
                amount: waterAmount,
                method: waterMethod,
                paidStatus: 'unpaid',
                notes: waterNotes ? `📝 Lưu ý: ${waterNotes}` : '',
                receiptType: isMoveoutReceipt ? 'moveout' : 'room-fees'
            };
            if (waterMethod === 'consumption') {
                expense.oldIndex = waterOldIndex;
                expense.newIndex = waterNewIndex;
                expense.usage = Math.max(0, waterNewIndex - waterOldIndex);
                expense.unitPrice = waterUnitPrice;
            }
            expenses.push(expense);
            newExpenses.push(expense);
        }
        
        if (roomPrice > 0 || otherNotes) {
            const expense = {
                id: generateExpenseId(),
                tenantId: tenantId,
                category: 'rent',
                date: toDate,
                fromDate: fromDate,
                toDate: toDate,
                amount: roomPrice,
                paidStatus: 'unpaid',
                notes: otherNotes ? `📝 Lưu ý: ${otherNotes}` : '',
                receiptType: isMoveoutReceipt ? 'moveout' : 'room-fees'
            };
            expenses.push(expense);
            newExpenses.push(expense);
        }
        
        if (garbagePrice > 0 || otherNotes) {
            const expense = {
                id: generateExpenseId(),
                tenantId: tenantId,
                category: 'other',
                date: toDate,
                fromDate: fromDate,
                toDate: toDate,
                amount: garbagePrice,
                paidStatus: 'unpaid',
                notes: otherNotes ? `📝 Lưu ý: ${otherNotes}` : '',
                receiptType: isMoveoutReceipt ? 'moveout' : 'room-fees'
            };
            expenses.push(expense);
            newExpenses.push(expense);
        }
        
        if (internetPrice > 0 || otherNotes) {
            const expense = {
                id: generateExpenseId(),
                tenantId: tenantId,
                category: 'internet',
                date: toDate,
                fromDate: fromDate,
                toDate: toDate,
                amount: internetPrice,
                paidStatus: 'unpaid',
                notes: otherNotes ? `📝 Lưu ý: ${otherNotes}` : '',
                receiptType: isMoveoutReceipt ? 'moveout' : 'room-fees'
            };
            expenses.push(expense);
            newExpenses.push(expense);
        }

        let refundNotesAttached = false;
        
        if (isMoveoutReceipt && (depositAmount > 0 || refundNotes)) {
            const expense = {
                id: generateExpenseId(),
                tenantId: tenantId,
                category: 'deposit',
                date: toDate,
                fromDate: fromDate,
                toDate: toDate,
                amount: depositAmount,
                paidStatus: 'unpaid',
                notes: refundNotes ? `📝 Lưu ý: ${refundNotes}` : '',
                receiptType: isMoveoutReceipt ? 'moveout' : 'room-fees'
            };
            expenses.push(expense);
            newExpenses.push(expense);
            refundNotesAttached = true;
        }

        if (isMoveoutReceipt && (prepaidUnusedAmount > 0 || (refundNotes && !refundNotesAttached))) {
            const expense = {
                id: generateExpenseId(),
                tenantId: tenantId,
                category: 'prepaid_unused',
                date: toDate,
                fromDate: fromDate,
                toDate: toDate,
                amount: prepaidUnusedAmount,
                paidStatus: 'unpaid',
                notes: (!refundNotesAttached && refundNotes) ? `📝 Lưu ý: ${refundNotes}` : '',
                receiptType: isMoveoutReceipt ? 'moveout' : 'room-fees'
            };
            expenses.push(expense);
            newExpenses.push(expense);
        }
        
        
        
        // Save all at once
        saveExpensesToLocalStorage(expenses);
        
        // Render and complete
        renderExpensesList(tenantId);
        renderMoveoutExpensesList(tenantId);
        if (isMoveoutReceipt && typeof loadMoveoutPaymentPeriods === 'function') {
            const moveoutTenantSelect = document.getElementById('moveout-tenant-select');
            loadMoveoutPaymentPeriods(moveoutTenantSelect?.value || tenantId);
        }
        document.getElementById('room-fees-modal').style.display = 'none';
        // Xóa metadata copy source sau khi lưu
        const modalElAfter = document.getElementById('room-fees-modal');
        if (modalElAfter) modalElAfter.removeAttribute('data-copy-source');
        alert("Đã lưu chi phí phòng thành công!");
        

        
    } catch (error) {
        console.error('Error saving room fees:', error);
        alert('Có lỗi xảy ra khi lưu chi phí. Vui lòng thử lại.');
    } finally {
        isSavingRoomFees = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            const isMoveoutMode = document.getElementById('room-fees-modal')?.classList.contains('inline-room-fees');
            saveBtn.textContent = isMoveoutMode ? 'Lưu' : 'Lưu khoản thu';
        }
    }
}

function setupRoomFeesListeners() {
    if (roomFeesListenersSetup) return;
    roomFeesListenersSetup = true;
    
    // Setup method toggles
    setupMethodToggles();
    
    // Input event listeners
    const inputIds = [
        'room-fees-electricity-old-index',
        'room-fees-electricity-new-index', 
        'room-fees-electricity-unit-price',
        'room-fees-water-old-index',
        'room-fees-water-new-index',
        'room-fees-water-unit-price'
    ];
    
    inputIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', calculateTotalRoomFees);
        }
    });
    
    // Currency inputs
    const currencyInputs = [
        'room-fees-room-price',
        'room-fees-garbage', 
        'room-fees-internet',
        'room-fees-deposit',
        'room-fees-prepaid-unused'
    ];
    
    currencyInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', function() { handleCurrencyInput(this); });
            element.addEventListener('blur', function() { handleCurrencyBlur(this); });
        }
    });
    
    // Save button
    const saveBtn = document.getElementById('save-room-fees-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveRoomFees);
    }
    
    // Cancel button
    const cancelBtn = document.getElementById('cancel-room-fees-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            document.getElementById('room-fees-modal').style.display = 'none';
        });
    }
    
    roomFeesListenersSetup = true;
}

function setupMethodToggles() {
    // Setup electricity method toggle
    const electricityRadios = document.querySelectorAll('input[name="electricity-method"]');
    electricityRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const consumptionInputs = document.getElementById('electricity-consumption-inputs');
            const directInputs = document.getElementById('electricity-direct-inputs');
            
            if (this.value === 'consumption') {
                consumptionInputs.style.display = 'block';
                directInputs.style.display = 'none';
                // Clear direct input when switching
                document.getElementById('room-fees-electricity-direct-amount').value = '';
            } else {
                consumptionInputs.style.display = 'none';
                directInputs.style.display = 'block';
                // Clear consumption inputs when switching
                document.getElementById('room-fees-electricity-old-index').value = '';
                document.getElementById('room-fees-electricity-new-index').value = '';
                document.getElementById('room-fees-electricity-unit-price').value = '';
                document.getElementById('room-fees-electricity-amount').value = '';
            }
            calculateTotalRoomFees();
        });
    });
    
    // Setup water method toggle
    const waterRadios = document.querySelectorAll('input[name="water-method"]');
    waterRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const consumptionInputs = document.getElementById('water-consumption-inputs');
            const directInputs = document.getElementById('water-direct-inputs');
            
            if (this.value === 'consumption') {
                consumptionInputs.style.display = 'block';
                directInputs.style.display = 'none';
                // Clear direct input when switching
                document.getElementById('room-fees-water-direct-amount').value = '';
            } else {
                consumptionInputs.style.display = 'none';
                directInputs.style.display = 'block';
                // Clear consumption inputs when switching
                document.getElementById('room-fees-water-old-index').value = '';
                document.getElementById('room-fees-water-new-index').value = '';
                document.getElementById('room-fees-water-unit-price').value = '';
                document.getElementById('room-fees-water-amount').value = '';
            }
            calculateTotalRoomFees();
        });
    });
    
    // Setup currency formatting for direct amount inputs
    const electricityDirectInput = document.getElementById('room-fees-electricity-direct-amount');
    const waterDirectInput = document.getElementById('room-fees-water-direct-amount');
    
    if (electricityDirectInput) {
        electricityDirectInput.addEventListener('input', function() { 
            handleCurrencyInput(this); 
        });
        electricityDirectInput.addEventListener('blur', function() { 
            handleCurrencyBlur(this); 
        });
    }
    
    if (waterDirectInput) {
        waterDirectInput.addEventListener('input', function() { 
            handleCurrencyInput(this); 
        });
        waterDirectInput.addEventListener('blur', function() { 
            handleCurrencyBlur(this); 
        });
    }
}

function handleCurrencyInput(inputElement) {
    const cursorPosition = inputElement.selectionStart;
    let value = inputElement.value;
    value = value.replace(/[^\d]/g, '');
    const numValue = parseInt(value, 10) || 0;
    inputElement.setAttribute('data-value', numValue);
    inputElement.value = value;
    
    setTimeout(() => {
        inputElement.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
    
    // Tự động tính tổng khi thay đổi
    calculateTotalRoomFees();
}

function handleCurrencyBlur(inputElement) {
    const rawValue = parseInt(inputElement.getAttribute('data-value'), 10) || 0;
    const formattedValue = formatCurrency(rawValue).replace(/\s₫$/, '');
    inputElement.value = formattedValue;
}

// Time group edit functionality


// ===========================================
// RENDER FUNCTIONS
// ===========================================

function renderTenantsForRoom(roomId) {
    if (!tenantsListEl) return;
    
    const tenants = getTenantsForRoom(roomId);
    
    if (tenants.length === 0) {
        tenantsListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Chưa có người thuê nào trong phòng này.</p>
            </div>
        `;
        return;
    }
    
    tenantsListEl.innerHTML = '';
    
    tenants.forEach(tenant => {
        const tenantCard = document.createElement('div');
        tenantCard.className = 'tenant-card';
        tenantCard.innerHTML = `
            <div class="tenant-card-content">
                <h4 class="card-title">${tenant.name}</h4>
                <p class="tenant-phone"><i class="fas fa-phone"></i> ${tenant.phone}</p>
                <p class="tenant-rent"><i class="fas fa-money-bill-wave"></i> ${formatCurrency(tenant.rentAmount)}/tháng</p>
                <p class="tenant-period">
                    <i class="fas fa-calendar"></i> 
                    ${formatDate(tenant.startDate)} ${tenant.endDate ? '- ' + formatDate(tenant.endDate) : '(đang thuê)'}
                </p>
            </div>
            <div class="tenant-card-actions">
                <button class="btn-primary tenant-fees-btn" data-id="${tenant.id}">
                    <i class="fas fa-receipt"></i> Chi phí
                </button>
                <button class="btn-secondary edit-tenant-btn" data-id="${tenant.id}">
                    <i class="fas fa-edit"></i> Sửa
                </button>
                <button class="btn-danger delete-tenant-btn" data-id="${tenant.id}">
                    <i class="fas fa-trash"></i> Xóa
                </button>
            </div>
        `;
        
        tenantsListEl.appendChild(tenantCard);
        
        // Add event listeners
        tenantCard.addEventListener('click', () => showTenantDetails(tenant.id));
        
        const editBtn = tenantCard.querySelector('.edit-tenant-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTenantModal(tenant.id);
        });
        
        const deleteBtn = tenantCard.querySelector('.delete-tenant-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Bạn có chắc chắn muốn xóa người thuê này không?')) {
                deleteTenant(tenant.id);
                renderTenantsForRoom(roomId);
            }
        });
        
        const feesBtn = tenantCard.querySelector('.tenant-fees-btn');
        feesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openRoomFeesModal(tenant.id);
        });
    });
}

function renderAllTenantsList(filteredTenants = null) {
    // Ensure DOM elements are initialized
    if (!allTenantsListEl) {
        allTenantsListEl = document.getElementById('all-tenants-list');
        if (!allTenantsListEl) {
            console.error('all-tenants-list element not found');
            return;
        }
    }
    
    const tenants = filteredTenants || getTenantsFromLocalStorage();
    
    if (tenants.length === 0) {
        const searchInput = document.getElementById('tenant-search-input');
        const isSearchActive = searchInput ? searchInput.value.trim() !== '' : false;
        allTenantsListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>${isSearchActive ? 'Không tìm thấy người thuê nào phù hợp với từ khóa tìm kiếm.' : 'Chưa có người thuê nào. Hãy thêm người thuê mới!'}</p>
            </div>
        `;
        return;
    }
    
    const createSection = (title, list, emptyText) => {
        const section = document.createElement('div');
        section.className = 'tenant-status-section';
        section.innerHTML = `<h3>${title} <span>${list.length}</span></h3>`;
        const houseGrid = document.createElement('div');
        houseGrid.className = 'tenant-house-grid';
        const groups = new Map();
        list.forEach(tenant => {
            const room = getRoomById(tenant.roomId);
            const house = room ? getHouseById(room.houseId) : null;
            const key = house ? house.id : 'unassigned';
            if (!groups.has(key)) groups.set(key, { house, tenants: [] });
            groups.get(key).tenants.push({ tenant, room });
        });
        if (!groups.size) houseGrid.innerHTML = `<p class="tenant-list-empty">${emptyText}</p>`;
        groups.forEach(({ house, tenants: groupTenants }) => {
            const houseColumn = document.createElement('div');
            houseColumn.className = 'tenant-house-column';
            houseColumn.innerHTML = `<h4><i class="fas fa-home"></i> ${house ? house.name : 'Chưa gán nhà'}</h4>`;
            groupTenants.sort((a, b) => a.tenant.name.localeCompare(b.tenant.name, 'vi')).forEach(({ tenant, room }) => {
                const nameButton = document.createElement('button');
                nameButton.className = 'tenant-name-link';
                nameButton.innerHTML = `${tenant.name}<small>${room ? room.name : 'Chưa gán phòng'}</small>`;
                nameButton.onclick = () => showTenantDetails(tenant.id);
                houseColumn.appendChild(nameButton);
            });
            houseGrid.appendChild(houseColumn);
        });
        section.appendChild(houseGrid);
        return section;
    };

    const activeTenants = tenants.filter(tenant => !isTenantMovedOut(tenant));
    const movedOutTenants = tenants.filter(isTenantMovedOut);
    allTenantsListEl.innerHTML = '';
    allTenantsListEl.className = 'tenant-status-lists';
    allTenantsListEl.append(
        createSection('1. Danh sách đang thuê phòng', activeTenants, 'Chưa có người thuê đang ở.'),
        createSection('2. Danh sách đã trả phòng', movedOutTenants, 'Chưa có người thuê đã trả phòng.')
    );
}

function showTenantDetails(tenantId) {
    const tenant = getTenantById(tenantId);
    if (!tenant) {
        console.error("Không tìm thấy người thuê với ID:", tenantId);
        return;
    }
    
    // Set current tenant ID for header button
    window.currentTenantId = tenantId;
    const movedOut = isTenantMovedOut(tenant);
    const roomFeesButton = document.getElementById('room-fees-btn-header');
    if (roomFeesButton) roomFeesButton.style.display = movedOut ? 'none' : '';
    
    // Lấy thông tin phòng và nhà
    const room = getRoomById(tenant.roomId);
    const house = room ? getHouseById(room.houseId) : null;
    
    // Cập nhật tiêu đề
    const tenantNameHeader = document.getElementById('tenant-name-header');
    if (tenantNameHeader) {
        tenantNameHeader.textContent = tenant.name;
    }
    
    // Hiển thị thông tin chi tiết người thuê
    const tenantDetailsEl = document.getElementById('tenant-details');
    if (!tenantDetailsEl) {
        console.error('tenant-details element not found');
        return;
    }
    
    let houseAndRoomInfo = '';
    
    if (room && house) {
        houseAndRoomInfo = `
            <div class="detail-item">
                <span class="detail-label">Nhà:</span>
                <span class="detail-value">${house.name}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Phòng:</span>
                <span class="detail-value">${room.name}</span>
            </div>
        `;
    }
    
    tenantDetailsEl.innerHTML = `
        <div class="tenant-details-compact">
            <div class="tenant-info-row">
                <div class="info-group">
                    <span class="info-label">👤 Họ tên:</span>
                    <span class="info-value">${tenant.name}</span>
                </div>
                <div class="info-group">
                    <span class="info-label">📞 SĐT:</span>
                    <span class="info-value">${tenant.phone || 'Chưa cập nhật'}</span>
                </div>

                <div class="info-group">
                    <span class="info-label">🆔 CMND/CCCD:</span>
                    <span class="info-value">${tenant.idCard || 'Chưa cập nhật'}</span>
                </div>
            </div>
            <div class="tenant-info-row">
                <div class="info-group">
                    <span class="info-label">🚪 Phòng:</span>
                    <span class="info-value">${room ? room.name : 'N/A'}</span>
                </div>
                <div class="info-group">
                    <span class="info-label">🏠 Nhà:</span>
                    <span class="info-value">${house ? house.name : 'N/A'}</span>
                </div>
            </div>
            <div class="tenant-info-row">
                <div class="info-group">
                    <span class="info-label">📅 Ngày bắt đầu tính tiền thuê phòng:</span>
                    <span class="info-value">${tenant.rentStartDay ? tenant.rentStartDay + ' hàng tháng' : '-'}</span>
                </div>
                <div class="info-group">
                    <span class="info-label">📅 Ngày kết thúc tính tiền thuê phòng:</span>
                    <span class="info-value">${tenant.rentEndDay ? tenant.rentEndDay + ' hàng tháng' : '-'}</span>
                </div>
            </div>
        </div>
        <div class="tenant-actions">
            <button class="btn-secondary edit-tenant-btn" data-id="${tenant.id}">
                <i class="fas fa-edit"></i> Sửa thông tin
            </button>
            ${movedOut ? '<span class="tenant-moved-out-badge">Đã trả phòng</span>' : `<button class="btn-success complete-moveout-btn" data-id="${tenant.id}"><i class="fas fa-check-circle"></i> Hoàn tất trả phòng</button>`}
        </div>
    `;
    
    // Thêm sự kiện cho nút chỉnh sửa người thuê
    const editTenantBtn = tenantDetailsEl.querySelector('.edit-tenant-btn');
    if (editTenantBtn) {
        editTenantBtn.addEventListener('click', function() {
            const tenantId = this.getAttribute('data-id');
            console.log('Edit tenant button clicked in details:', tenantId);
            openTenantModal(tenantId);
        });
    }
    const completeMoveoutBtn = tenantDetailsEl.querySelector('.complete-moveout-btn');
    if (completeMoveoutBtn) completeMoveoutBtn.addEventListener('click', () => completeTenantMoveout(tenant.id));
    
    // Hiển thị danh sách chi phí của người thuê
    renderExpensesList(tenantId);
    renderMoveoutExpensesList(tenantId);
    
    // Hiển thị phần chi tiết người thuê và ẩn các phần khác
    
    // Setup back button using the new system
    if (typeof window.setupBackButtonForSection === 'function') {
        window.setupBackButtonForSection('tenant-details');
    } else {
        // Fallback to old method
        setupBackButtonListener();
    }
    
    // Explicitly hide house-expense-section before navigation
    const houseExpenseSection = document.getElementById('house-expense-section');
    if (houseExpenseSection) {
        houseExpenseSection.classList.remove('active');
    }
    
    try {
        // Use the global showSection function from app.js
        if (typeof window.showSection === 'function') {
            window.showSection('tenant-details');
        } else {
            // Fallback: manually show the section
            const section = document.getElementById('tenant-details-section');
            if (section) {
                document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
                section.classList.add('active');
            }
        }
    } catch (error) {
        console.error('Error calling showSection:', error);
    }
}

function renderExpensesList(tenantId) {
    // Ensure DOM elements are initialized
    if (!expensesListEl) {
        expensesListEl = document.getElementById('expenses-list');
        if (!expensesListEl) {
            console.error('expenses-list element not found');
            return;
        }
    }
    
    // The tenant detail page lists only ordinary room-fee receipts. Move-out
    // receipts, including "Các khoản đã thu", belong exclusively to Trả phòng.
    const expenses = getExpensesForTenant(tenantId).filter(expense => !isMoveoutRoomFeeExpense(expense));
    
    if (expenses.length === 0) {
        expensesListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>Chưa có chi phí nào. Hãy thêm chi phí mới!</p>
            </div>
        `;
        return;
    }
    
    expensesListEl.innerHTML = '';
    
    // Group chi phí theo thời gian từ notes (fromDate đến toDate)
    const timeGroups = {};
    const ungroupedExpenses = [];
    
    expenses.forEach(expense => {
        // Ưu tiên sử dụng fromDate và toDate, fallback sang tìm trong notes
        let timeKey = null;
        
        if (expense.fromDate && expense.toDate) {
            timeKey = `${expense.fromDate} đến ${expense.toDate}`;
        } else {
            // Fallback: Tìm pattern "từ YYYY-MM-DD đến YYYY-MM-DD" trong notes
            const timePattern = /từ (\d{4}-\d{2}-\d{2}) đến (\d{4}-\d{2}-\d{2})/;
            const match = expense.notes?.match(timePattern);
            if (match) {
                timeKey = `${match[1]} đến ${match[2]}`;
            }
        }
        
        if (timeKey) {
            if (!timeGroups[timeKey]) {
                timeGroups[timeKey] = [];
            }
            timeGroups[timeKey].push(expense);
        } else {
            ungroupedExpenses.push(expense);
        }
    });
    
    // Sắp xếp các nhóm thời gian theo thứ tự gần nhất lên đầu
    const sortedTimeKeys = Object.keys(timeGroups).sort((a, b) => {
        const dateA = new Date(a.split(' đến ')[1]);
        const dateB = new Date(b.split(' đến ')[1]);
        return dateB - dateA;
    });
    
    // Group theo trạng thái thanh toán
    const paidGroups = {
        'paid': { timeGroups: {}, ungrouped: [] },
        'unpaid': { timeGroups: {}, ungrouped: [] }
    };
    
    // Phân loại time groups theo trạng thái thanh toán
    sortedTimeKeys.forEach(timeKey => {
        const groupExpenses = timeGroups[timeKey];
        const paidExpenses = groupExpenses.filter(exp => exp.paidStatus === 'paid');
        const unpaidExpenses = groupExpenses.filter(exp => exp.paidStatus === 'unpaid');
        
        if (paidExpenses.length > 0) {
            paidGroups['paid'].timeGroups[timeKey] = paidExpenses;
        }
        if (unpaidExpenses.length > 0) {
            paidGroups['unpaid'].timeGroups[timeKey] = unpaidExpenses;
        }
    });
    
    // Phân loại ungrouped expenses theo trạng thái
    ungroupedExpenses.forEach(expense => {
        if (expense.paidStatus === 'paid') {
            paidGroups['paid'].ungrouped.push(expense);
        } else {
            paidGroups['unpaid'].ungrouped.push(expense);
        }
    });
    
    // Tạo các main groups theo trạng thái thanh toán
    ['unpaid', 'paid'].forEach(status => {
        const statusData = paidGroups[status];
        const hasTimeGroups = Object.keys(statusData.timeGroups).length > 0;
        const hasUngrouped = statusData.ungrouped.length > 0;
        
        if (!hasTimeGroups && !hasUngrouped) return;
        
        // Tính tổng cho main group
        let totalAmount = 0;
        Object.values(statusData.timeGroups).forEach(expenses => {
            totalAmount += expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
        });
        totalAmount += statusData.ungrouped.reduce((sum, exp) => sum + Number(exp.amount), 0);
        
        const statusText = status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
        const statusClass = status === 'paid' ? 'status-paid' : 'status-unpaid';
        
        const mainGroupContainer = document.createElement('div');
        mainGroupContainer.className = 'expense-main-group';
        
        const mainGroupId = `main-group-${status}`;
        const isCollapsed = status === 'paid'; // Mặc định thu gọn nhóm "Đã thanh toán"
        
        mainGroupContainer.innerHTML = `
            <div class="expense-main-group-header" data-target="${mainGroupId}">
                <div class="main-group-title">
                    <i class="fas fa-chevron-${isCollapsed ? 'right' : 'down'} toggle-icon"></i>
                    <h3>${statusText}</h3>
                </div>
                <div class="main-group-summary">
                    <span class="main-group-total">${formatCurrency(totalAmount)}</span>
                    <span class="main-group-status ${statusClass}">${statusText}</span>
                </div>
            </div>
            <div class="expense-main-group-content ${isCollapsed ? 'collapsed' : ''}" id="${mainGroupId}">
                <!-- Các time groups sẽ được thêm vào đây -->
            </div>
        `;
        
        const mainGroupContent = mainGroupContainer.querySelector('.expense-main-group-content');
        
        // Lấy tất cả time keys và sắp xếp theo thời gian gần nhất lên đầu
        const timeKeys = Object.keys(statusData.timeGroups).sort((a, b) => {
            const dateA = new Date(a.split(' đến ')[1]);
            const dateB = new Date(b.split(' đến ')[1]);
            return dateB - dateA;
        });
        
        // Thêm time groups vào main group
        timeKeys.forEach(timeKey => {
            const timeGroupExpenses = statusData.timeGroups[timeKey];
            const timeGroupTotal = timeGroupExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
            
            // Sắp xếp chi phí trong time group theo loại
            timeGroupExpenses.sort((a, b) => {
                const orderMap = {'rent': 0, 'electricity': 1, 'water': 2, 'internet': 3, 'other': 4};
                return (orderMap[a.category] || 5) - (orderMap[b.category] || 5);
            });
            
            const timeGroupContainer = document.createElement('div');
            timeGroupContainer.className = 'expense-time-group';
            
            timeGroupContainer.innerHTML = `
                <div class="expense-time-group-header">
                    <h4>Kỳ: ${formatDateRangeDisplay(timeKey)}</h4>
                    <div class="time-group-header-right">
                        <span class="time-group-total">${formatCurrency(timeGroupTotal)}</span>
                        <button class="btn-icon time-group-toggle-status-btn" data-time-key="${timeKey}" data-tenant-id="${tenantId}" 
                                title="${status === 'paid' ? 'Đánh dấu toàn bộ kỳ chưa thanh toán' : 'Đánh dấu toàn bộ kỳ đã thanh toán'}">
                            <i class="fas ${status === 'paid' ? 'fa-undo' : 'fa-check-double'}"></i>
                        </button>
                        <button class="btn-icon time-group-edit-btn" data-time-key="${timeKey}" data-tenant-id="${tenantId}" title="Sửa kỳ chi phí">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon time-group-view-btn" data-time-key="${timeKey}" data-tenant-id="${tenantId}" title="Xem nhanh phiếu thu">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon time-group-copy-btn" data-time-key="${timeKey}" data-tenant-id="${tenantId}" title="Copy & tạo mới">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="expense-time-group-content">
                    <!-- Summary sẽ được thêm vào đây -->
                </div>
            `;
            
            // Thêm summary và event listeners
            const timeGroupContent = timeGroupContainer.querySelector('.expense-time-group-content');
            addTimeGroupSummary(timeGroupContent, timeGroupExpenses, tenantId);
            
            // Thêm event listener cho nút toggle trạng thái toàn bộ kỳ
            const timeGroupToggleBtn = timeGroupContainer.querySelector('.time-group-toggle-status-btn');
            if (timeGroupToggleBtn) {
                timeGroupToggleBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const newStatus = status === 'paid' ? 'unpaid' : 'paid';
                    const confirmMessage = `Bạn có chắc muốn đánh dấu toàn bộ kỳ ${formatDateRangeDisplay(timeKey)} là ${newStatus === 'paid' ? 'đã thanh toán' : 'chưa thanh toán'}?`;
                    
                    if (confirm(confirmMessage)) {
                        toggleTimeGroupStatus(timeKey, newStatus, tenantId);
                    }
                });
            }
            
            // Thêm event listener cho nút sửa time group
            const timeGroupEditBtn = timeGroupContainer.querySelector('.time-group-edit-btn');
            timeGroupEditBtn.addEventListener('click', () => {
                openTimeGroupEditModal(timeKey, timeGroupExpenses, tenantId);
            });

            const timeGroupViewBtn = timeGroupContainer.querySelector('.time-group-view-btn');
            timeGroupViewBtn.addEventListener('click', () => {
                viewRoomFeeReceipt(timeKey, timeGroupExpenses, tenantId);
            });
            
            // Thêm event listener cho nút copy & tạo mới time group
            const timeGroupCopyBtn = timeGroupContainer.querySelector('.time-group-copy-btn');
            if (timeGroupCopyBtn) {
                timeGroupCopyBtn.addEventListener('click', () => {
                    openTimeGroupCopyModal(timeKey, timeGroupExpenses, tenantId);
                });
            }
            
            mainGroupContent.appendChild(timeGroupContainer);
        });
        
        // Thêm ungrouped expenses nếu có (không có header)
        if (statusData.ungrouped.length > 0) {
            // Sắp xếp chi phí lẻ theo ngày giảm dần
            statusData.ungrouped.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Tạo summary cho ungrouped expenses
            addTimeGroupSummary(mainGroupContent, statusData.ungrouped, tenantId);
        }
        
        // Thêm event listener cho toggle
        const headerEl = mainGroupContainer.querySelector('.expense-main-group-header');
        headerEl.addEventListener('click', function() {
            toggleMainGroup(mainGroupId);
        });
        
        expensesListEl.appendChild(mainGroupContainer);
    });
}

function viewRoomFeeReceipt(timeKey, expenses, tenantId) {
    const receiptExpenses = getExpensesForTenant(tenantId).filter(expense =>
        !isMoveoutRoomFeeExpense(expense) &&
        `${expense.fromDate || expense.date} đến ${expense.toDate || expense.date}` === timeKey
    );
    const receiptData = generateReceiptDataFromExpenses(tenantId, timeKey, receiptExpenses.length ? receiptExpenses : expenses);
    if (!receiptData || typeof displaySimpleReceipt !== 'function') return;

    document.getElementById('quick-receipt-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'quick-receipt-modal';
    modal.className = 'quick-receipt-modal';
    const dialog = document.createElement('div');
    dialog.className = 'quick-receipt-dialog';
    dialog.innerHTML = `<div class="quick-receipt-actions"><strong>Phiếu thu — ${formatDateRangeDisplay(timeKey)}</strong><button type="button" aria-label="Đóng">&times;</button></div>`;
    dialog.querySelector('button').onclick = () => modal.remove();
    dialog.appendChild(displaySimpleReceipt(receiptData));
    modal.onclick = event => { if (event.target === modal) modal.remove(); };
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

function renderMoveoutExpensesList(tenantId) {
    const container = document.getElementById('moveout-expenses-list');
    if (!container) return;
    const groups = {};
    getExpensesForTenant(tenantId).filter(isMoveoutRoomFeeExpense).forEach(expense => {
        const fromDate = expense.fromDate || expense.date || '';
        const toDate = expense.toDate || expense.date || '';
        const key = `${fromDate} đến ${toDate}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(expense);
    });
    const entries = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    if (!entries.length) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = '<h3 class="moveout-history-title">Phiếu trả phòng</h3>';
    const list = document.createElement('div');
    list.className = 'moveout-history-list';
    entries.forEach(([timeKey, expenses]) => {
        const item = document.createElement('div');
        item.className = 'moveout-history-item';
        const total = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
        item.innerHTML = `<span><strong>${formatDateRangeDisplay(timeKey)}</strong><small>${expenses.length} khoản · ${formatCurrency(total)}</small></span><button type="button" class="btn-secondary">Xem phiếu</button>`;
        item.querySelector('button').onclick = () => viewMoveoutReceipt(timeKey, expenses, tenantId);
        list.appendChild(item);
    });
    container.appendChild(list);
}

function viewMoveoutReceipt(timeKey, expenses, tenantId) {
    const receiptData = generateReceiptDataFromExpenses(tenantId, timeKey, expenses);
    if (!receiptData || typeof displaySimpleReceipt !== 'function') return;
    receiptData.receiptKind = 'moveout';
    document.getElementById('quick-receipt-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'quick-receipt-modal';
    modal.className = 'quick-receipt-modal';
    const dialog = document.createElement('div');
    dialog.className = 'quick-receipt-dialog';
    dialog.innerHTML = `<div class="quick-receipt-actions"><strong>Phiếu trả phòng — ${formatDateRangeDisplay(timeKey)}</strong><button type="button" aria-label="Đóng">&times;</button></div>`;
    dialog.querySelector('button').onclick = () => modal.remove();
    dialog.appendChild(displaySimpleReceipt(receiptData));
    modal.onclick = event => { if (event.target === modal) modal.remove(); };
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

// Hàm thêm tóm tắt cho time group
function addTimeGroupSummary(container, expenses, tenantId) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'time-group-summary';
    
    expenses.forEach(expense => {
        const categoryText = getCategoryText(expense.category);
        const paidStatus = expense.paidStatus || 'unpaid';
        const paidStatusClass = paidStatus === 'paid' ? 'status-paid' : 'status-unpaid';
        const paidStatusText = paidStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
        const isPaid = paidStatus === 'paid';
        
        let detailInfo = '';
        
        // CHỈ hiển thị detail info nếu KHÔNG PHẢI là method direct
        if (expense.method !== 'direct') {
            if (expense.category === 'electricity' && expense.oldIndex !== undefined) {
                detailInfo = `(${expense.oldIndex} → ${expense.newIndex} kWh)`;
            } else if (expense.category === 'water' && expense.oldIndex !== undefined) {
                detailInfo = `(${expense.oldIndex} → ${expense.newIndex} m³)`;
            }
        }
        // Nếu method === 'direct' -> không hiển thị detail info
        
        const expenseItem = document.createElement('div');
        expenseItem.className = 'expense-summary-item';
        expenseItem.setAttribute('data-expense-id', expense.id);
        
        // Hiển thị actions cho cả paid và unpaid
        const actionsHTML = `
            <div class="expense-summary-actions">
                <button class="btn-icon expense-status-toggle-btn" data-id="${expense.id}" 
                        title="${isPaid ? 'Đánh dấu chưa thanh toán' : 'Đánh dấu đã thanh toán'}">
                    <i class="fas ${isPaid ? 'fa-undo' : 'fa-check'}"></i>
                </button>
                ${!isPaid ? `
                <button class="btn-icon expense-delete-btn" data-id="${expense.id}" title="Xóa">
                    <i class="fas fa-trash"></i>
                </button>
                ` : ''}
            </div>
        `;
        
        expenseItem.innerHTML = `
            <div class="expense-summary-left">
                <span class="expense-category-text">${categoryText}</span>
                ${detailInfo ? `<span class="expense-detail-info">${detailInfo}</span>` : ''}
            </div>
            <div class="expense-summary-right">
                <span class="expense-amount">${formatCurrency(expense.amount)}</span>
                <span class="expense-status ${paidStatusClass}">${paidStatusText}</span>
                ${actionsHTML}
            </div>
        `;
        
        // Thêm event listener cho nút toggle trạng thái
        const statusToggleBtn = expenseItem.querySelector('.expense-status-toggle-btn');
        if (statusToggleBtn) {
            statusToggleBtn.addEventListener('click', () => {
                const confirmMessage = isPaid ? 
                    'Bạn có chắc muốn đánh dấu chi phí này là chưa thanh toán?' : 
                    'Bạn có chắc muốn đánh dấu chi phí này là đã thanh toán?';
                    
                if (confirm(confirmMessage)) {
                    toggleExpenseStatus(expense.id, tenantId);
                }
            });
        }
        
        // Thêm event listener cho nút xóa (chỉ khi chưa thanh toán)
        if (!isPaid) {
            const deleteBtn = expenseItem.querySelector('.expense-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (confirm('Bạn có chắc chắn muốn xóa chi phí này?')) {
                        deleteExpense(expense.id, tenantId);
                    }
                });
            }
        }
        
        summaryDiv.appendChild(expenseItem);
    });
    
    container.appendChild(summaryDiv);
}

function createExpenseItem(expense, tenantId) {
    let detailsHtml = '';
    
    // LOGIC MỚI - ĐƠN GIẢN VÀ RÕ RÀNG:
    // Chỉ hiển thị details KHI VÀ CHỈ KHI method === 'direct' là FALSE
    
    if (expense.category === 'electricity') {
        // CHỈ hiển thị details nếu KHÔNG PHẢI là method direct
        if (expense.method !== 'direct') {
            // Kiểm tra có đủ dữ liệu để hiển thị không
            if (expense.oldIndex !== undefined && expense.newIndex !== undefined && expense.unitPrice !== undefined) {
                detailsHtml = `
                    <div class="expense-details">
                        <p>Chỉ số cũ: ${expense.oldIndex} | Chỉ số mới: ${expense.newIndex}</p>
                        <p>Tiêu thụ: ${expense.newIndex - expense.oldIndex} kWh × ${formatCurrency(expense.unitPrice)}/kWh</p>
                    </div>
                `;
            }
        }
        // Nếu method === 'direct' -> không hiển thị details gì cả
        
    } else if (expense.category === 'water') {
        // CHỈ hiển thị details nếu KHÔNG PHẢI là method direct  
        if (expense.method !== 'direct') {
            // Kiểm tra có đủ dữ liệu để hiển thị không
            if (expense.oldIndex !== undefined && expense.newIndex !== undefined && expense.unitPrice !== undefined) {
                detailsHtml = `
                    <div class="expense-details">
                        <p>Chỉ số cũ: ${expense.oldIndex} | Chỉ số mới: ${expense.newIndex}</p>
                        <p>Tiêu thụ: ${expense.newIndex - expense.oldIndex} m³ × ${formatCurrency(expense.unitPrice)}/m³</p>
                    </div>
                `;
            }
        }
        // Nếu method === 'direct' -> không hiển thị details gì cả
    }
    
    return `
        <div class="expense-item">
            <div class="expense-header">
                <div class="expense-info">
                    <h4>${getCategoryText(expense.category)}</h4>
                    <p class="expense-date">${formatDate(expense.date)}</p>
                    ${expense.description ? `<p class="expense-description">${expense.description}</p>` : ''}
                </div>
                <div class="expense-amount">
                    <span class="amount">${formatCurrency(expense.amount)}</span>
                </div>
            </div>
            ${detailsHtml}
            <div class="expense-actions">
                <button class="btn-secondary btn-sm" onclick="openExpenseModal('edit', '${expense.id}')">
                    <i class="fas fa-edit"></i> Sửa
                </button>
                <button class="btn-danger btn-sm" onclick="deleteExpense('${expense.id}', '${tenantId}')">
                    <i class="fas fa-trash"></i> Xóa
                </button>
            </div>
        </div>
    `;
}

// Hàm toggle cho main group
function toggleMainGroup(groupId) {
    const groupContent = document.getElementById(groupId);
    const toggleIcon = document.querySelector(`[data-target="${groupId}"] .toggle-icon`);
    
    if (groupContent.classList.contains('collapsed')) {
        groupContent.classList.remove('collapsed');
        toggleIcon.className = 'fas fa-chevron-down toggle-icon';
    } else {
        groupContent.classList.add('collapsed');
        toggleIcon.className = 'fas fa-chevron-right toggle-icon';
    }
}

function toggleExpenseStatus(expenseId, tenantId) {
    const expenses = getExpensesFromLocalStorage();
    const expense = expenses.find(e => e.id === expenseId);
    
    if (expense) {
        expense.paidStatus = expense.paidStatus === 'paid' ? 'unpaid' : 'paid';
        saveExpensesToLocalStorage(expenses);
        renderExpensesList(tenantId);
    }
}

function toggleTimeGroupStatus(timeKey, newStatus, tenantId) {
    try {
        const expenses = getExpensesFromLocalStorage();
        
        // Chuyển đổi tenantId thành chuỗi để đảm bảo so sánh chính xác
        const tenantIdStr = String(tenantId);
        
        // Tìm tất cả expense trong time group này - sử dụng logic giống như trong renderExpensesList
        const timeGroupExpenses = expenses.filter(expense => {
            const expenseTenantId = String(expense.tenantId);
            const matchesTenant = expenseTenantId === tenantIdStr;
            
            // Kiểm tra xem expense có thuộc time group này không (giống như logic grouping)
            let expenseTimeKey = null;
            
            if (expense.fromDate && expense.toDate) {
                expenseTimeKey = `${expense.fromDate} đến ${expense.toDate}`;
            } else {
                // Fallback: Tìm pattern "từ YYYY-MM-DD đến YYYY-MM-DD" trong notes
                const timePattern = /từ (\d{4}-\d{2}-\d{2}) đến (\d{4}-\d{2}-\d{2})/;
                const match = expense.notes?.match(timePattern);
                if (match) {
                    expenseTimeKey = `${match[1]} đến ${match[2]}`;
                }
            }
            
            return matchesTenant && !isMoveoutRoomFeeExpense(expense) && expenseTimeKey === timeKey;
        });
        
        if (timeGroupExpenses.length > 0) {
            // Cập nhật trạng thái cho tất cả expense trong group
            timeGroupExpenses.forEach(expense => {
                expense.paidStatus = newStatus;
            });
            
            saveExpensesToLocalStorage(expenses);
            renderExpensesList(tenantId);
            
            const statusText = newStatus === 'paid' ? 'đã thanh toán' : 'chưa thanh toán';
            alert(`Đã cập nhật ${timeGroupExpenses.length} chi phí thành ${statusText}`);
        } else {
            alert('Không tìm thấy chi phí nào để cập nhật. Vui lòng kiểm tra lại dữ liệu.');
        }
    } catch (error) {
        console.error('Error in toggleTimeGroupStatus:', error);
        alert('Có lỗi xảy ra khi cập nhật trạng thái. Vui lòng thử lại.');
    }
}

// Hàm mở modal sửa time group
function openTimeGroupEditModal(timeKey, expenses, tenantId) {
    const tenant = getTenantById(tenantId);
    if (!tenant) {
        alert("Không tìm thấy thông tin người thuê");
        return;
    }
    
    // Lấy từ ngày và đến ngày từ timeKey
    const [fromDate, toDate] = timeKey.split(' đến ');
    
    // Mở modal chi phí phòng với dữ liệu hiện có ở chế độ edit
    openRoomFeesModal(tenantId, { mode: 'edit' });
    
    // Đợi modal hiển thị rồi điền dữ liệu
    setTimeout(() => {
        // Reset về trạng thái sạch trước khi nạp dữ liệu kỳ được chọn
        resetModalMethodSelections();
        const clearMoney = (id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = '';
            el.setAttribute('data-value', 0);
        };
        clearMoney('room-fees-room-price');
        clearMoney('room-fees-garbage');
        clearMoney('room-fees-internet');
        clearMoney('room-fees-deposit');

        // Điền thời gian
        document.getElementById('room-fees-from-date').value = fromDate;
        document.getElementById('room-fees-to-date').value = toDate;
        
        // Điền dữ liệu từ các expense hiện có
        expenses.forEach(expense => {
            switch(expense.category) {
                case 'electricity':
                    if (expense.method === 'consumption' && expense.oldIndex !== undefined) {
                        // Chọn consumption method
                        document.querySelector('input[name="electricity-method"][value="consumption"]').checked = true;
                        // Trigger change event để hiển thị đúng form
                        document.querySelector('input[name="electricity-method"][value="consumption"]').dispatchEvent(new Event('change'));
                        // Điền dữ liệu consumption
                        document.getElementById('room-fees-electricity-old-index').value = expense.oldIndex;
                        document.getElementById('room-fees-electricity-new-index').value = expense.newIndex;
                        document.getElementById('room-fees-electricity-unit-price').value = expense.unitPrice;
                    } else if (expense.method === 'direct') {
                        // Chọn direct method
                        document.querySelector('input[name="electricity-method"][value="direct"]').checked = true;
                        // Trigger change event để hiển thị đúng form
                        document.querySelector('input[name="electricity-method"][value="direct"]').dispatchEvent(new Event('change'));
                        // Điền dữ liệu direct amount
                        const directInput = document.getElementById('room-fees-electricity-direct-amount');
                        directInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                        directInput.setAttribute('data-value', expense.amount);
                    } else if (!expense.method && expense.oldIndex !== undefined) {
                        // Backward compatibility cho data cũ
                        document.querySelector('input[name="electricity-method"][value="consumption"]').checked = true;
                        document.querySelector('input[name="electricity-method"][value="consumption"]').dispatchEvent(new Event('change'));
                        document.getElementById('room-fees-electricity-old-index').value = expense.oldIndex;
                        document.getElementById('room-fees-electricity-new-index').value = expense.newIndex;
                        document.getElementById('room-fees-electricity-unit-price').value = expense.unitPrice;
                    }
                    break;
                case 'water':
                    if (expense.method === 'consumption' && expense.oldIndex !== undefined) {
                        // Chọn consumption method
                        document.querySelector('input[name="water-method"][value="consumption"]').checked = true;
                        // Trigger change event để hiển thị đúng form
                        document.querySelector('input[name="water-method"][value="consumption"]').dispatchEvent(new Event('change'));
                        // Điền dữ liệu consumption
                        document.getElementById('room-fees-water-old-index').value = expense.oldIndex;
                        document.getElementById('room-fees-water-new-index').value = expense.newIndex;
                        document.getElementById('room-fees-water-unit-price').value = expense.unitPrice;
                    } else if (expense.method === 'direct') {
                        // Chọn direct method
                        document.querySelector('input[name="water-method"][value="direct"]').checked = true;
                        // Trigger change event để hiển thị đúng form
                        document.querySelector('input[name="water-method"][value="direct"]').dispatchEvent(new Event('change'));
                        // Điền dữ liệu direct amount
                        const directInput = document.getElementById('room-fees-water-direct-amount');
                        directInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                        directInput.setAttribute('data-value', expense.amount);
                    } else if (!expense.method && expense.oldIndex !== undefined) {
                        // Backward compatibility cho data cũ
                        document.querySelector('input[name="water-method"][value="consumption"]').checked = true;
                        document.querySelector('input[name="water-method"][value="consumption"]').dispatchEvent(new Event('change'));
                        document.getElementById('room-fees-water-old-index').value = expense.oldIndex;
                        document.getElementById('room-fees-water-new-index').value = expense.newIndex;
                        document.getElementById('room-fees-water-unit-price').value = expense.unitPrice;
                    }
                    break;
                case 'rent':
                    const roomPriceInput = document.getElementById('room-fees-room-price');
                    roomPriceInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                    roomPriceInput.setAttribute('data-value', expense.amount);
                    break;
                case 'other':
                    const garbageInput = document.getElementById('room-fees-garbage');
                    garbageInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                    garbageInput.setAttribute('data-value', expense.amount);
                    break;
                case 'internet':
                    const internetInput = document.getElementById('room-fees-internet');
                    internetInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                    internetInput.setAttribute('data-value', expense.amount);
                    break;
                case 'deposit':
                    const depositInput = document.getElementById('room-fees-deposit');
                    if (depositInput) {
                        depositInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                        depositInput.setAttribute('data-value', expense.amount);
                    }
                    break;
                case 'prepaid_unused':
                    const prepaidUnusedInput = document.getElementById('room-fees-prepaid-unused');
                    if (prepaidUnusedInput) {
                        prepaidUnusedInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                        prepaidUnusedInput.setAttribute('data-value', expense.amount);
                    }
                    break;
            }
        });
        
        // Tính lại tổng
        calculateTotalRoomFees();
        
        // Load notes from expenses
        let electricityNotes = '';
        let waterNotes = '';
        let otherNotes = '';
        
        expenses.forEach(expense => {
            if (expense.notes) {
                const notes = expense.notes;
                if (expense.category === 'electricity' && notes.includes('📝 Lưu ý:')) {
                    const noteMatch = notes.match(/📝 Lưu ý: (.+)/);
                    if (noteMatch) {
                        electricityNotes = noteMatch[1];
                    }
                } else if (expense.category === 'water' && notes.includes('📝 Lưu ý:')) {
                    const noteMatch = notes.match(/📝 Lưu ý: (.+)/);
                    if (noteMatch) {
                        waterNotes = noteMatch[1];
                    }
                } else if ((expense.category === 'rent' || expense.category === 'other' || expense.category === 'internet' || expense.category === 'deposit') && notes.includes('📝 Lưu ý:')) {
                    const noteMatch = notes.match(/📝 Lưu ý: (.+)/);
                    if (noteMatch) {
                        otherNotes = noteMatch[1];
                    }
                }
            }
        });
        
        // Fill notes fields
        const electricityNotesEl = document.getElementById('room-fees-electricity-notes');
        const waterNotesEl = document.getElementById('room-fees-water-notes');
        const otherNotesEl = document.getElementById('room-fees-other-notes');
        
        if (electricityNotesEl) electricityNotesEl.value = electricityNotes;
        if (waterNotesEl) waterNotesEl.value = waterNotes;
        if (otherNotesEl) otherNotesEl.value = otherNotes;
        
        // Đánh dấu là đang sửa time group
        if (!window.timeGroupEditData) {
            window.timeGroupEditData = {};
        }
        window.timeGroupEditData[timeKey] = expenses;
        document.getElementById('room-fees-modal').setAttribute('data-editing-time-key', timeKey);
    }, 100);
}

// Hàm mở modal copy time group (prefill dữ liệu nhưng KHÔNG ở trạng thái edit)
function openTimeGroupCopyModal(timeKey, expenses, tenantId) {
    const tenant = getTenantById(tenantId);
    if (!tenant) {
        alert("Không tìm thấy thông tin người thuê");
        return;
    }
    
    // Lấy từ ngày và đến ngày từ timeKey
    const [fromDate, toDate] = timeKey.split(' đến ');
    
    // Mở modal chi phí phòng với dữ liệu hiện có ở chế độ copy (không reset)
    openRoomFeesModal(tenantId, { mode: 'edit' });
    
    // Đợi modal hiển thị rồi điền dữ liệu
    setTimeout(() => {
        // Reset về trạng thái sạch trước khi nạp dữ liệu copy
        resetModalMethodSelections();
        const clearMoney = (id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = '';
            el.setAttribute('data-value', 0);
        };
        clearMoney('room-fees-room-price');
        clearMoney('room-fees-garbage');
        clearMoney('room-fees-internet');
        clearMoney('room-fees-deposit');

        // Điền thời gian giống phiếu cũ để người dùng có thể chỉnh sửa nếu muốn
        const fromEl = document.getElementById('room-fees-from-date');
        const toEl = document.getElementById('room-fees-to-date');
        if (fromEl) fromEl.value = fromDate;
        if (toEl) toEl.value = toDate;
        
        // Điền dữ liệu từ các expense hiện có
        expenses.forEach(expense => {
            switch(expense.category) {
                case 'electricity':
                    if (expense.method === 'consumption' && expense.oldIndex !== undefined) {
                        document.querySelector('input[name="electricity-method"][value="consumption"]').checked = true;
                        document.querySelector('input[name="electricity-method"][value="consumption"]').dispatchEvent(new Event('change'));
                        document.getElementById('room-fees-electricity-old-index').value = expense.oldIndex;
                        document.getElementById('room-fees-electricity-new-index').value = expense.newIndex;
                        document.getElementById('room-fees-electricity-unit-price').value = expense.unitPrice;
                    } else if (expense.method === 'direct') {
                        document.querySelector('input[name="electricity-method"][value="direct"]').checked = true;
                        document.querySelector('input[name="electricity-method"][value="direct"]').dispatchEvent(new Event('change'));
                        const directInput = document.getElementById('room-fees-electricity-direct-amount');
                        directInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                        directInput.setAttribute('data-value', expense.amount);
                    } else if (!expense.method && expense.oldIndex !== undefined) {
                        document.querySelector('input[name="electricity-method"][value="consumption"]').checked = true;
                        document.querySelector('input[name="electricity-method"][value="consumption"]').dispatchEvent(new Event('change'));
                        document.getElementById('room-fees-electricity-old-index').value = expense.oldIndex;
                        document.getElementById('room-fees-electricity-new-index').value = expense.newIndex;
                        document.getElementById('room-fees-electricity-unit-price').value = expense.unitPrice;
                    }
                    break;
                case 'water':
                    if (expense.method === 'consumption' && expense.oldIndex !== undefined) {
                        document.querySelector('input[name="water-method"][value="consumption"]').checked = true;
                        document.querySelector('input[name="water-method"][value="consumption"]').dispatchEvent(new Event('change'));
                        document.getElementById('room-fees-water-old-index').value = expense.oldIndex;
                        document.getElementById('room-fees-water-new-index').value = expense.newIndex;
                        document.getElementById('room-fees-water-unit-price').value = expense.unitPrice;
                    } else if (expense.method === 'direct') {
                        document.querySelector('input[name="water-method"][value="direct"]').checked = true;
                        document.querySelector('input[name="water-method"][value="direct"]').dispatchEvent(new Event('change'));
                        const directInput = document.getElementById('room-fees-water-direct-amount');
                        directInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                        directInput.setAttribute('data-value', expense.amount);
                    } else if (!expense.method && expense.oldIndex !== undefined) {
                        document.querySelector('input[name="water-method"][value="consumption"]').checked = true;
                        document.querySelector('input[name="water-method"][value="consumption"]').dispatchEvent(new Event('change'));
                        document.getElementById('room-fees-water-old-index').value = expense.oldIndex;
                        document.getElementById('room-fees-water-new-index').value = expense.newIndex;
                        document.getElementById('room-fees-water-unit-price').value = expense.unitPrice;
                    }
                    break;
                case 'rent':
                    const roomPriceInput = document.getElementById('room-fees-room-price');
                    roomPriceInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                    roomPriceInput.setAttribute('data-value', expense.amount);
                    break;
                case 'other':
                    const garbageInput = document.getElementById('room-fees-garbage');
                    garbageInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                    garbageInput.setAttribute('data-value', expense.amount);
                    break;
                case 'internet':
                    const internetInput = document.getElementById('room-fees-internet');
                    internetInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                    internetInput.setAttribute('data-value', expense.amount);
                    break;
                case 'deposit':
                    const depositInput = document.getElementById('room-fees-deposit');
                    if (depositInput) {
                        depositInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                        depositInput.setAttribute('data-value', expense.amount);
                    }
                    break;
                case 'prepaid_unused':
                    const prepaidUnusedInput = document.getElementById('room-fees-prepaid-unused');
                    if (prepaidUnusedInput) {
                        prepaidUnusedInput.value = formatCurrency(expense.amount).replace(/\s₫$/, '');
                        prepaidUnusedInput.setAttribute('data-value', expense.amount);
                    }
                    break;
            }
        });
        
        // Fill notes (giữ nguyên để người dùng chỉnh)
        let electricityNotes = '';
        let waterNotes = '';
        let otherNotes = '';
        expenses.forEach(expense => {
            if (expense.notes) {
                const notes = expense.notes;
                if (expense.category === 'electricity' && notes.includes('📝 Lưu ý:')) {
                    const noteMatch = notes.match(/📝 Lưu ý: (.+)/);
                    if (noteMatch) electricityNotes = noteMatch[1];
                } else if (expense.category === 'water' && notes.includes('📝 Lưu ý:')) {
                    const noteMatch = notes.match(/📝 Lưu ý: (.+)/);
                    if (noteMatch) waterNotes = noteMatch[1];
                } else if ((expense.category === 'rent' || expense.category === 'other' || expense.category === 'internet' || expense.category === 'deposit') && notes.includes('📝 Lưu ý:')) {
                    const noteMatch = notes.match(/📝 Lưu ý: (.+)/);
                    if (noteMatch) otherNotes = noteMatch[1];
                }
            }
        });
        const electricityNotesEl = document.getElementById('room-fees-electricity-notes');
        const waterNotesEl = document.getElementById('room-fees-water-notes');
        const otherNotesEl = document.getElementById('room-fees-other-notes');
        if (electricityNotesEl) electricityNotesEl.value = electricityNotes;
        if (waterNotesEl) waterNotesEl.value = waterNotes;
        if (otherNotesEl) otherNotesEl.value = otherNotes;
        
        // ĐẢM BẢO KHÔNG ở trạng thái edit
        const modal = document.getElementById('room-fees-modal');
        if (modal) {
            modal.removeAttribute('data-editing-time-key');
        }
        if (window.timeGroupEditData && window.timeGroupEditData[timeKey]) {
            delete window.timeGroupEditData[timeKey];
        }
        
        // Gắn metadata để cảnh báo trùng lặp khi lưu (source snapshot)
        try {
            const meta = {
                tenantId: String(tenantId),
                fromDate,
                toDate,
                items: expenses.map(e => ({
                    category: e.category,
                    amount: Number(e.amount) || 0,
                    method: e.method || null,
                    oldIndex: e.oldIndex ?? null,
                    newIndex: e.newIndex ?? null,
                    unitPrice: e.unitPrice ?? null,
                    notes: e.notes || ''
                }))
            };
            const modalEl = document.getElementById('room-fees-modal');
            if (modalEl) modalEl.setAttribute('data-copy-source', JSON.stringify(meta));
        } catch (err) {
            console.warn('Không thể gắn metadata copy source:', err);
        }
        
        // Tính lại tổng
        calculateTotalRoomFees();
    }, 100);
}

// Hàm cập nhật trạng thái phòng
function updateRoomStatus(roomId, newStatus) {
    if (!roomId) return;
    
    const rooms = getRoomsFromLocalStorage();
    const room = rooms.find(r => r.id === roomId);
    
    if (room && room.status !== newStatus) {
        room.status = newStatus;
        saveRoomsToLocalStorage(rooms);
        refreshRoomDisplays(room.houseId);
    }
}

// Hàm refresh tất cả hiển thị liên quan đến phòng
function refreshRoomDisplays(houseId) {
    // Refresh home section (dashboard)
    const homeSection = document.getElementById('home-section');
    if (homeSection && homeSection.classList.contains('active')) {
        renderDashboard();
    }
    
    // Refresh all rooms section
    const allRoomsSection = document.getElementById('all-rooms-section');
    if (allRoomsSection && allRoomsSection.classList.contains('active')) {
        renderAllRoomsList();
    }
    
    // Refresh room details section
    const roomDetailsSection = document.getElementById('room-details-section');
    if (roomDetailsSection && roomDetailsSection.classList.contains('active')) {
        // Get current room ID from header
        const roomNameHeader = document.getElementById('room-name-header');
        if (roomNameHeader) {
            const currentRoomName = roomNameHeader.textContent;
            const rooms = getRoomsFromLocalStorage();
            const currentRoom = rooms.find(r => r.name === currentRoomName && r.houseId === houseId);
            if (currentRoom) {
                showRoomDetails(currentRoom.id);
            }
        }
    }
}

// Hàm đồng bộ trạng thái phòng với dữ liệu người thuê hiện có
function syncRoomStatusWithTenants() {
    const rooms = getRoomsFromLocalStorage();
    const tenants = getTenantsFromLocalStorage();
    let hasChanges = false;
    let changedRooms = [];
    
    rooms.forEach(room => {
        const tenantsInRoom = tenants.filter(tenant => tenant.roomId === room.id);
        const shouldBeOccupied = tenantsInRoom.length > 0;
        const currentStatus = room.status;
        const newStatus = shouldBeOccupied ? 'occupied' : 'available';
        
        if (currentStatus !== newStatus) {
            room.status = newStatus;
            hasChanges = true;
            changedRooms.push({
                room: room,
                oldStatus: currentStatus,
                newStatus: newStatus
            });
        }
    });
    
    if (hasChanges) {
        saveRoomsToLocalStorage(rooms);
        forceRefreshAllDisplays();
    }
}

// Hàm force refresh tất cả hiển thị
function forceRefreshAllDisplays() {
    // Refresh home section (dashboard)
    const homeSection = document.getElementById('home-section');
    if (homeSection && homeSection.classList.contains('active')) {
        renderDashboard();
    }
    
    // Refresh all rooms section
    const allRoomsSection = document.getElementById('all-rooms-section');
    if (allRoomsSection && allRoomsSection.classList.contains('active')) {
        renderAllRoomsList();
    }
}

// ===========================================
// DATA CLEANUP FUNCTIONS
// ===========================================

function cleanupDuplicateTenants() {
    const tenants = getTenantsFromLocalStorage();
    const uniqueTenants = [];
    const seenTenants = new Set();
    
    tenants.forEach(tenant => {
        const uniqueKey = `${tenant.name}-${tenant.phone}-${tenant.roomId}`;
        
        if (!seenTenants.has(uniqueKey)) {
            seenTenants.add(uniqueKey);
            uniqueTenants.push(tenant);
        } else {
            const expenses = getExpensesFromLocalStorage();
            const cleanedExpenses = expenses.filter(expense => expense.tenantId !== tenant.id);
            if (expenses.length !== cleanedExpenses.length) {
                saveExpensesToLocalStorage(cleanedExpenses);
            }
        }
    });
    
    if (tenants.length !== uniqueTenants.length) {
        saveTenantsToLocalStorage(uniqueTenants);
        syncRoomStatusWithTenants();
        return true;
    }
    
    return false;
}

// Manual cleanup function that can be called from browser console
function manualCleanupDuplicates() {
    const wasCleanupPerformed = cleanupDuplicateTenants();
    
    if (wasCleanupPerformed) {
        if (document.getElementById('all-tenants-section').classList.contains('active')) {
            renderAllTenantsList();
        }
        syncRoomStatusWithTenants();
        alert('Đã dọn dẹp dữ liệu trùng lặp thành công! Trang sẽ được làm mới.');
        location.reload();
    } else {
        alert('Không tìm thấy dữ liệu trùng lặp nào.');
    }
}





// ===========================================
// SEARCH FUNCTIONALITY
// ===========================================

// Tìm kiếm người thuê
function searchTenants(searchTerm) {
    const allTenants = getTenantsFromLocalStorage();
    
    if (!searchTerm || searchTerm.trim() === '') {
        return allTenants;
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    return allTenants.filter(tenant => {
        // Tìm theo tên
        if (tenant.name && tenant.name.toLowerCase().includes(term)) {
            return true;
        }
        
        // Tìm theo số điện thoại
        if (tenant.phone && tenant.phone.includes(term)) {
            return true;
        }
        
        // Tìm theo CMND/CCCD
        if (tenant.idCard && tenant.idCard.toLowerCase().includes(term)) {
            return true;
        }
        

        
        // Tìm theo tên phòng
        const room = getRoomById(tenant.roomId);
        if (room && room.name && room.name.toLowerCase().includes(term)) {
            return true;
        }
        
        // Tìm theo tên nhà
        if (room) {
            const house = getHouseById(room.houseId);
            if (house && house.name && house.name.toLowerCase().includes(term)) {
                return true;
            }
        }
        
        return false;
    });
}

// Cập nhật kết quả tìm kiếm
function updateSearchResults(searchTerm) {
    const filteredTenants = searchTenants(searchTerm);
    renderAllTenantsList(filteredTenants);
    
    // Cập nhật số lượng kết quả
    const resultsCountEl = document.getElementById('search-results-count');
    const resultsNumberEl = document.getElementById('results-number');
    const clearBtnEl = document.getElementById('clear-search-btn');
    
    if (searchTerm.trim() !== '') {
        resultsCountEl.style.display = 'block';
        resultsNumberEl.textContent = filteredTenants.length;
        clearBtnEl.style.display = 'flex';
    } else {
        resultsCountEl.style.display = 'none';
        clearBtnEl.style.display = 'none';
    }
}

// Setup search functionality
function setupTenantSearch() {
    const searchInput = document.getElementById('tenant-search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    
    if (!searchInput) return;
    
    // Search on input
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value;
        updateSearchResults(searchTerm);
    });
    
    // Clear search
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            searchInput.value = '';
            updateSearchResults('');
            searchInput.focus();
        });
    }
    
    // Search on Enter key
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            updateSearchResults(this.value);
        }
    });
}

// Make search functions available globally
window.setupTenantSearch = setupTenantSearch;
window.searchTenants = searchTenants;

// Setup back button event listener
function setupBackButtonListener() {
    console.log('Setting up back button listener...');
    const backBtn = document.getElementById('back-to-list-btn');
    if (backBtn) {
        console.log('Back button found, setting up event listener');
        
        // Remove any existing listeners by cloning the button
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        
        // Add new event listener
        newBackBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Back button clicked - navigating to tenants section');
            
            try {
                // First try to use the global showSection function
                if (typeof window.showSection === 'function') {
                    window.showSection('all-tenants');
                    console.log('Navigation completed using window.showSection');
                } else {
                    // Fallback: manually show the section
                    const section = document.getElementById('tenants-section');
                    if (section) {
                        document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
                        section.classList.add('active');
                        console.log('Fallback navigation completed');
                    } else {
                        console.error('tenants-section not found');
                    }
                }
            } catch (error) {
                console.error('Error during navigation:', error);
                // Final fallback
                const section = document.getElementById('tenants-section');
                if (section) {
                    document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
                    section.classList.add('active');
                    console.log('Final fallback navigation completed');
                }
            }
        });
        
        console.log('Back button event listener set up successfully');
    } else {
        console.error('Back button not found!');
        // Try again after a short delay
        setTimeout(() => {
            console.log('Retrying back button setup...');
            setupBackButtonListener();
        }, 100);
    }
}
