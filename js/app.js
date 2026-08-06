// ===========================================
// MAIN APPLICATION
// ===========================================

function initializeApp() {
    try {
        initHousesDOM();
        initTenantsDOM();
        if (cleanupDuplicateTenants()) {}
        setupRoomFeesListeners();
        setupModalCloseEvents();
        syncRoomStatusWithTenants();
        hideAllSections();
        document.getElementById('home-section').classList.add('active');
        document.getElementById('nav-home').classList.add('active');
        renderDashboard();
        setTimeout(() => {
            if (typeof setupTenantSearch === 'function') {
                setupTenantSearch();
            }
        }, 500);
    } catch (error) {
        console.error('Error during app initialization:', error);
        alert('Lỗi khởi tạo ứng dụng: ' + error.message);
    }
}

// Modal setup
function setupModalCloseEvents() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        // Close button
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                modal.style.display = 'none';
            });
        }
        
        // Click outside modal
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Cancel button
        const cancelBtn = modal.querySelector('.btn-secondary');
        if (cancelBtn && (cancelBtn.id.includes('cancel') || cancelBtn.textContent.includes('Hủy'))) {
            cancelBtn.addEventListener('click', function() {
                modal.style.display = 'none';
                if (modal.id === 'expense-modal') {
                    toggleExpenseFields('');
                }
            });
        }
    });
}

// Navigation functions
function setupNavigation() {
    const navItems = [
        { id: 'nav-home', renderFn: renderDashboard, sectionId: 'home-section' },
        { id: 'nav-rooms', renderFn: renderAllRoomsList, sectionId: 'all-rooms-section' },
        { id: 'nav-tenants', renderFn: () => {
            renderAllTenantsList();
            setTimeout(() => setupTenantSearch(), 100);
        }, sectionId: 'all-tenants-section' },
        { id: 'nav-moveout', renderFn: () => {
            setupMoveoutSection();
        }, sectionId: 'moveout-section' },
        { id: 'nav-print-receipt', renderFn: setupReceiptForm, sectionId: 'print-receipt-section' },
        { id: 'nav-export', renderFn: () => {
            // Export section is already rendered in HTML
        }, sectionId: 'export-section' }
    ];
    
    navItems.forEach(item => {
        const navElement = document.getElementById(item.id);
        if (!navElement) return;
        
        navElement.addEventListener('click', function(e) {
            try {
                e.preventDefault();
                
                // Explicitly hide house-expense-section before navigation
                const houseExpenseSection = document.getElementById('house-expense-section');
                if (houseExpenseSection) {
                    houseExpenseSection.classList.remove('active');
                }
                
                item.renderFn();
                // Extract section name from sectionId (remove '-section' suffix)
                const sectionName = item.sectionId.replace('-section', '');
                showSection(sectionName);
            } catch (error) {
                console.error(`Navigation error for ${item.id}:`, error);
            }
        });
    });
    
    setupButtons();
}

function setupButtons() {
    const buttonHandlers = [
        { id: 'add-house-btn', handler: () => openHouseModal() },
        { id: 'add-tenant-global-btn', handler: () => openTenantModal() },
        { id: 'add-house-from-rooms-btn', handler: () => openHouseModal() },
        { id: 'room-fees-btn-header', handler: () => {
            if (window.currentTenantId) {
                openRoomFeesModal(window.currentTenantId, { mode: 'add' });
            } else {
                alert('Vui lòng chọn người thuê trước');
            }
        }},
        { id: 'add-tenant-btn', handler: function() {
            const roomId = this.getAttribute('data-room-id');
            openTenantModal(null, roomId);
        }},
        // Back buttons are now handled by the back-buttons.js system
    ];
    
    buttonHandlers.forEach(({ id, handler }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', handler);
        }
    });
    
    // Initialize back buttons using the new system
    if (typeof window.initializeBackButtons === 'function') {
        window.initializeBackButtons();
    }
    
    setupTenantListDelegation();
}

function setupMoveoutSection() {
    const tenantSelect = document.getElementById('moveout-tenant-select');
    const declareBtn = document.getElementById('moveout-declare-btn');
    if (!tenantSelect || !declareBtn) return;

    const tenants = getTenantsFromLocalStorage()
        .filter(tenant => tenant.roomId && (typeof isTenantMovedOut !== 'function' || !isTenantMovedOut(tenant)))
        .sort((a, b) => (a.name || '').localeCompare(b.name || 'vi'));

    const buildOptionLabel = (tenant, index) => {
        const room = typeof getRoomById === 'function' ? getRoomById(tenant.roomId) : null;
        const house = room && typeof getHouseById === 'function' ? getHouseById(room.houseId) : null;
        const name = tenant.name || `Người thuê ${index + 1}`;
        const roomName = room?.name || tenant.roomId || 'Không rõ phòng';
        const houseName = house?.name || 'Không rõ nhà';
        return `${name} - Phòng ${roomName} - ${houseName}`;
    };

    const refreshTenantOptions = () => {
        tenantSelect.innerHTML = '<option value="">-- Chọn người thuê --</option>';
        tenants.forEach((tenant, index) => {
            const option = document.createElement('option');
            option.value = tenant.id;
            option.textContent = buildOptionLabel(tenant, index);
            tenantSelect.appendChild(option);
        });
    };

    refreshTenantOptions();

    tenantSelect.value = '';
    declareBtn.disabled = true;

    tenantSelect.onchange = () => {
        declareBtn.disabled = !tenantSelect.value;
    };

    declareBtn.onclick = () => {
        const selectedTenantId = tenantSelect.value;
        if (!selectedTenantId) {
            alert('Vui lòng chọn người thuê hợp lệ.');
            return;
        }

        activateInlineRoomFeesMode();
        openRoomFeesModal(selectedTenantId, { mode: 'add' });

        const emptyMessage = document.getElementById('moveout-empty-message');
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
        }
    };

}

function isMoveoutExpense(expense) {
    return expense.receiptType === 'moveout' || expense.category === 'deposit' || expense.category === 'prepaid_unused';
}

function activateInlineRoomFeesMode() {
    const modal = document.getElementById('room-fees-modal');
    const host = document.getElementById('moveout-room-fees-host');
    if (!modal || !host) return;

    host.appendChild(modal);
    modal.classList.add('inline-room-fees');
}

function restoreDefaultRoomFeesModalMode() {
    const modal = document.getElementById('room-fees-modal');
    if (!modal) return;

    if (modal.classList.contains('inline-room-fees')) {
        document.body.appendChild(modal);
        modal.classList.remove('inline-room-fees');
        modal.style.display = 'none';
    }
}

function setupTenantListDelegation() {
    const allTenantsList = document.getElementById('all-tenants-list');
    if (allTenantsList) {
        allTenantsList.addEventListener('click', function(e) {
            const getBtn = (cls) => e.target.classList.contains(cls) ? e.target : e.target.closest('.' + cls);
            
            if (getBtn('tenant-card')) {
                const tenantId = getBtn('tenant-card').getAttribute('data-id');
                showTenantDetails(tenantId);
            }
            
            if (getBtn('edit-tenant-btn')) {
                const tenantId = getBtn('edit-tenant-btn').getAttribute('data-id');
                openTenantModal(tenantId);
                e.stopPropagation();
            }
            
            if (getBtn('delete-tenant-btn')) {
                const tenantId = getBtn('delete-tenant-btn').getAttribute('data-id');
                if (confirm('Xóa người thuê này?')) {
                    deleteTenant(tenantId);
                }
                e.stopPropagation();
            }
            
            if (getBtn('tenant-fees-btn')) {
                const tenantId = getBtn('tenant-fees-btn').getAttribute('data-id');
                openRoomFeesModal(tenantId);
                e.stopPropagation();
            }
        });
    }
}

function showSection(sectionName) {
    if (sectionName !== 'moveout') {
        restoreDefaultRoomFeesModalMode();
    }

    hideAllSections();
    
    // Ensure house-expense-section is always hidden unless explicitly requested
    const houseExpenseSection = document.getElementById('house-expense-section');
    if (houseExpenseSection && sectionName !== 'house-expense') {
        houseExpenseSection.classList.remove('active');
    }
    
    // "Danh sách phòng" dùng id all-rooms-section, còn router dùng tên ngắn rooms.
    // Ánh xạ rõ ràng để Quay lại từ chi tiết phòng không dẫn đến một section không tồn tại.
    const sectionId = sectionName === 'rooms' ? 'all-rooms-section' : sectionName + '-section';
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    // Update navigation
    document.querySelectorAll('nav a').forEach(nav => nav.classList.remove('active'));
    const navSectionName = sectionName === 'all-tenants' ? 'tenants' :
        sectionName === 'all-rooms' ? 'rooms' : sectionName;
    const navElement = document.getElementById('nav-' + navSectionName);
    if (navElement) {
        navElement.classList.add('active');
    }
    
    // Setup back button for the new section
    if (typeof window.setupBackButtonForSection === 'function') {
        window.setupBackButtonForSection(sectionName);
    }
    
    // Render appropriate content
    switch(sectionName) {
        case 'home':
            renderDashboard();
            break;
        case 'rooms':
            renderAllRoomsList();
            break;
        case 'tenants':
        case 'all-tenants':
            renderAllTenantsList();
            break;
        case 'print-receipt':
            setupReceiptForm();
            break;
        case 'moveout':
            setupMoveoutSection();
            break;
        case 'house-expense':
            // House expense section is managed by showHouseExpenseSection
            break;
        case 'export':
            // Export section is already rendered in HTML
            break;
    }
}

// Use the application router rather than the older core helper, whose argument
// format differs and could leave the previous screen blank.
window.showSection = showSection;

// Global function to ensure house-expense-section is always hidden
function ensureHouseExpenseSectionHidden() {
    const houseExpenseSection = document.getElementById('house-expense-section');
    if (houseExpenseSection && houseExpenseSection.classList.contains('active')) {
        houseExpenseSection.classList.remove('active');
    }
}

// Make the function globally available
window.ensureHouseExpenseSectionHidden = ensureHouseExpenseSectionHidden;

// Start only after Supabase has authenticated the user and loaded cloud data.
function startApplication() {
    if (window.applicationStarted) return;
    window.applicationStarted = true;
    try {
        // Check if data exists
        const existingHouses = getHousesFromLocalStorage();
        
        // Initialize sample data if needed
        if (existingHouses.length === 0) {
            initSampleData();
        }
        
        // Initialize all modules
        initHousesDOM();
        initTenantsDOM();
        
        // Fix duplicate IDs if any
        fixDuplicateIds();
        
        // Add data sync buttons
        addDataSyncButtons();
        
        // Set up navigation
        setupNavigation();
        
        // Setup modal events
        setupModalCloseEvents();
        
        // Clean up and sync
        if (typeof cleanupDuplicateTenants === 'function') {
            cleanupDuplicateTenants();
        }
        
        if (typeof setupRoomFeesListeners === 'function') {
            setupRoomFeesListeners();
        }
        
        if (typeof syncRoomStatusWithTenants === 'function') {
            syncRoomStatusWithTenants();
        }
        
        // Show home section by default
        showSection('home');
        
        // Ensure only home section is visible on startup
        document.querySelectorAll('.section').forEach(section => {
            if (section.id !== 'home-section') {
                section.classList.remove('active');
            }
        });
        
        // Explicitly hide house-expense-section on startup
        const houseExpenseSection = document.getElementById('house-expense-section');
        if (houseExpenseSection) {
            houseExpenseSection.classList.remove('active');
        }
        
        // Clean up auto-generated room descriptions on load
        if (typeof cleanupAutoGeneratedDescriptions === 'function') {
            cleanupAutoGeneratedDescriptions();
        }
        
        // Setup tenant search after a delay
        setTimeout(() => {
            if (typeof setupTenantSearch === 'function') {
                setupTenantSearch();
            }
        }, 500);
        
        // Setup global event listener to ensure house-expense-section is hidden
        document.addEventListener('click', function(e) {
            if (e.target.closest('nav a') || e.target.closest('.btn-secondary') || e.target.closest('.btn-primary')) {
                setTimeout(() => {
                    ensureHouseExpenseSectionHidden();
                }, 50);
            }
        });
        
        // Setup mutation observer to ensure house-expense-section is hidden when DOM changes
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const houseExpenseSection = document.getElementById('house-expense-section');
                    if (houseExpenseSection && houseExpenseSection.classList.contains('active')) {
                        const activeSections = document.querySelectorAll('.section.active');
                        if (activeSections.length > 1) {
                            const currentSection = Array.from(activeSections).find(section => 
                                section.id !== 'house-expense-section'
                            );
                            if (currentSection) {
                                houseExpenseSection.classList.remove('active');
                            }
                        }
                    }
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['class']
        });
        
    } catch (error) {
        window.applicationStarted = false;
        console.error('❌ Critical error during DOM setup:', error);
        alert('Lỗi khởi tạo ứng dụng: ' + error.message);
    }
}

window.startApplication = startApplication;

// ===========================================
// EXPENSE MODAL FUNCTIONS (Single expenses, not room fees)
// ===========================================

function openExpenseModal(mode, expenseId = null) {
    const modal = document.getElementById('expense-modal');
    const title = document.getElementById('expense-modal-title');
    const form = document.getElementById('expense-form');
    
    if (mode === 'edit' && expenseId) {
        // Edit mode
        const expenses = getExpensesFromLocalStorage();
        const expense = expenses.find(e => e.id === expenseId);
        
        if (!expense) {
            alert('Không tìm thấy thông tin chi phí');
            return;
        }
        
        title.textContent = 'Sửa chi phí';
        document.getElementById('expense-id').value = expense.id;
        document.getElementById('expense-tenant-id').value = expense.tenantId;
        document.getElementById('expense-category').value = expense.category;
        document.getElementById('expense-amount').value = expense.amount;
        document.getElementById('expense-date').value = expense.date;
        document.getElementById('expense-description').value = expense.description || '';
        
        // Toggle fields based on category
        toggleExpenseFields(expense.category);
        
        // Fill utility-specific fields
        if (expense.category === 'electricity') {
            document.getElementById('electricity-old-index').value = expense.oldIndex || '';
            document.getElementById('electricity-new-index').value = expense.newIndex || '';
            document.getElementById('electricity-unit-price').value = expense.unitPrice || '';
        } else if (expense.category === 'water') {
            document.getElementById('water-old-index').value = expense.oldIndex || '';
            document.getElementById('water-new-index').value = expense.newIndex || '';
            document.getElementById('water-unit-price').value = expense.unitPrice || '';
        }
    } else {
        // Add mode
        title.textContent = 'Thêm chi phí mới';
        form.reset();
        document.getElementById('expense-id').value = '';
        document.getElementById('expense-tenant-id').value = window.currentTenantId || '';
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
        toggleExpenseFields('');
    }
    
    modal.style.display = 'block';
}

function toggleExpenseFields(category) {
    const electricityFields = document.getElementById('electricity-fields');
    const waterFields = document.getElementById('water-fields');
    const amountField = document.getElementById('expense-amount');
    
    // Hide all utility fields
    if (electricityFields) electricityFields.style.display = 'none';
    if (waterFields) waterFields.style.display = 'none';
    
    // Show relevant fields and enable/disable amount input
    if (category === 'electricity' && electricityFields) {
        electricityFields.style.display = 'block';
        amountField.readOnly = true;
    } else if (category === 'water' && waterFields) {
        waterFields.style.display = 'block';
        amountField.readOnly = true;
    } else {
        amountField.readOnly = false;
    }
}

function calculateElectricityAmount() {
    const oldReading = parseFloat(document.getElementById('expense-old_reading').value) || 0;
    const newReading = parseFloat(document.getElementById('expense-new_reading').value) || 0;
    const pricePerKwh = parseFloat(document.getElementById('expense-price_per_kwh').value) || 0;
    
    const consumption = Math.max(0, newReading - oldReading);
    const amount = consumption * pricePerKwh;
    
    document.getElementById('expense-amount').value = amount.toFixed(0);
}

function calculateWaterAmount() {
    const oldReading = parseFloat(document.getElementById('expense-old_water_reading').value) || 0;
    const newReading = parseFloat(document.getElementById('expense-new_water_reading').value) || 0;
    const pricePerUnit = parseFloat(document.getElementById('expense-water_price_per_unit').value) || 0;
    
    const consumption = Math.max(0, newReading - oldReading);
    const amount = consumption * pricePerUnit;
    
    document.getElementById('expense-amount').value = amount.toFixed(0);
}

function saveExpense() {
    const form = document.getElementById('expense-form');
    const formData = new FormData(form);
    const expense = {};
    formData.forEach((value, key) => {
        if (key.startsWith('expense-') && value.trim() !== '') {
            const fieldName = key.replace('expense-', '');
            expense[fieldName] = value;
        }
    });
    const requiredFields = ['category', 'amount', 'date'];
    const missingFields = requiredFields.filter(field => !expense[field]);
    if (missingFields.length > 0) {
        alert('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
    }
    expense.amount = parseFloat(expense.amount);
    if (isNaN(expense.amount) || expense.amount <= 0) {
        alert('Số tiền phải là số dương');
        return;
    }
    const title = document.getElementById('expense-modal-title').textContent;
    if (title.includes('Thêm')) {
        expense.id = generateExpenseId();
        expense.tenantId = getCurrentSelectedTenantId();
        expense.isPaid = false;
        expense.createdAt = new Date().toISOString();
        addExpense(expense);
    } else {
        const expenseId = getCurrentEditingExpenseId();
        if (expenseId) {
            expense.id = expenseId;
            expense.tenantId = getCurrentSelectedTenantId();
            updateExpense(expense);
        }
    }
    document.getElementById('expense-modal').style.display = 'none';
    renderExpensesList(getCurrentSelectedTenantId());
}

function getCurrentSelectedTenantId() {
    const tenantDetailsSection = document.getElementById('tenant-details-section');
    return tenantDetailsSection.getAttribute('data-current-tenant-id');
}

function getCurrentEditingExpenseId() {
    const form = document.getElementById('expense-form');
    return form.getAttribute('data-editing-expense-id');
}

// ===========================================
// PRINT RECEIPT (PLACEHOLDER)
// ===========================================

function setupReceiptForm() {
    const tenantSelect = document.getElementById('receipt-tenant');
    const paymentPeriodSelect = document.getElementById('receipt-payment-period');
    
    // Điền danh sách tất cả người thuê
    tenantSelect.innerHTML = '<option value="">-- Chọn người thuê --</option>';
    const tenants = getTenantsFromLocalStorage();
    tenants.forEach(tenant => {
        const option = document.createElement('option');
        option.value = tenant.id;
        option.textContent = tenant.name;
        tenantSelect.appendChild(option);
    });
    
    // Setup event listener cho tenant select
    tenantSelect.addEventListener('change', function() {
        const tenantId = this.value;
        paymentPeriodSelect.innerHTML = '<option value="">-- Chọn kỳ thanh toán --</option>';
        
        if (tenantId) {
            loadPaymentPeriods(tenantId);
            paymentPeriodSelect.disabled = false;
        } else {
            paymentPeriodSelect.disabled = true;
        }
    });
    
    // Setup event listeners
    setupReceiptEventListeners();
}

function loadPaymentPeriods(tenantId) {
    const paymentPeriodSelect = document.getElementById('receipt-payment-period');
    const expenses = getExpensesFromLocalStorage();
    
    // Tìm tất cả time groups chưa thanh toán của tenant này
    const unpaidTimeGroups = {};
    
    expenses.forEach(expense => {
        if (expense.tenantId === tenantId && expense.paidStatus === 'unpaid' && !isMoveoutExpense(expense)) {
            let timeKey = null;
            
            // Lấy time key từ fromDate và toDate
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
                if (!unpaidTimeGroups[timeKey]) {
                    unpaidTimeGroups[timeKey] = [];
                }
                unpaidTimeGroups[timeKey].push(expense);
            }
        }
    });
    
    // Sắp xếp theo thời gian (mới nhất trước)
    const sortedTimeKeys = Object.keys(unpaidTimeGroups).sort((a, b) => {
        const dateA = new Date(a.split(' đến ')[1]);
        const dateB = new Date(b.split(' đến ')[1]);
        return dateB - dateA;
    });
    
    // Thêm vào dropdown
    sortedTimeKeys.forEach(timeKey => {
        const option = document.createElement('option');
        option.value = timeKey;
        // Format display text
        const displayText = formatDateRangeDisplay(timeKey);
        option.textContent = `Kỳ ${displayText}`;
        option.setAttribute('data-expenses', JSON.stringify(unpaidTimeGroups[timeKey]));
        paymentPeriodSelect.appendChild(option);
    });
    
    if (sortedTimeKeys.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Không có kỳ thanh toán nào chưa thanh toán';
        option.disabled = true;
        paymentPeriodSelect.appendChild(option);
    }
}

function setupReceiptEventListeners() {
    const previewBtn = document.getElementById('preview-receipt-btn');
    const backBtn = document.getElementById('back-to-receipt-form-btn');
    
    if (previewBtn) {
        previewBtn.onclick = previewReceipt;
    }
    
    if (backBtn) {
        backBtn.onclick = (e) => {
            e.preventDefault();
            document.getElementById('receipt-preview').style.display = 'none';
            document.querySelector('.print-receipt-form').style.display = 'block';
        };
    }
    
    // Export PNG button (chỉ cho preview)
    const exportPngPreviewBtn = document.getElementById('export-png-preview-btn');
    
    if (exportPngPreviewBtn) {
        exportPngPreviewBtn.onclick = exportPreviewToPNG;
    }
    
    // QR Code logic
    const qrIncludeSelect = document.getElementById('receipt-include-qr');
    const qrUploadBtn = document.getElementById('upload-qr-btn');
    const qrFileInput = document.getElementById('qr-file-input');
    const qrStatus = document.getElementById('qr-status');
    const qrHistoryContainer = document.getElementById('qr-history-container');
    const qrHistoryList = document.getElementById('qr-history-list');
    
    function renderQrHistory() {
        if (!qrHistoryList) return;
        const history = JSON.parse(localStorage.getItem('bank_qr_codes_history') || '[]');
        const activeQr = localStorage.getItem('bank_qr_code');
        
        qrHistoryList.innerHTML = '';
        if (history.length > 0 && qrIncludeSelect.value === 'yes') {
            qrHistoryContainer.style.display = 'block';
            
            history.forEach((qrStr, index) => {
                const isActive = (qrStr === activeQr);
                
                const itemDiv = document.createElement('div');
                itemDiv.style.cursor = 'pointer';
                itemDiv.style.textAlign = 'center';
                itemDiv.style.border = isActive ? '2px solid #4CAF50' : '1px solid #ddd';
                itemDiv.style.borderRadius = '4px';
                itemDiv.style.padding = '5px';
                itemDiv.style.backgroundColor = isActive ? '#e8f5e9' : 'white';
                
                const img = document.createElement('img');
                img.src = qrStr;
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.objectFit = 'contain';
                
                const checkDiv = document.createElement('div');
                checkDiv.style.marginTop = '4px';
                checkDiv.style.color = '#4CAF50';
                checkDiv.style.fontSize = '14px';
                checkDiv.style.height = '16px';
                checkDiv.innerHTML = isActive ? '<i class="fas fa-check-circle"></i>' : '';
                
                itemDiv.appendChild(img);
                itemDiv.appendChild(checkDiv);
                
                itemDiv.onclick = () => {
                    localStorage.setItem('bank_qr_code', qrStr);
                    qrStatus.style.display = 'inline-block';
                    renderQrHistory();
                };
                
                qrHistoryList.appendChild(itemDiv);
            });
        } else {
            qrHistoryContainer.style.display = 'none';
        }
    }
    
    if (qrIncludeSelect) {
        // Load saved QR preference
        const savedQrData = localStorage.getItem('bank_qr_code');
        if (savedQrData) {
            qrStatus.style.display = 'inline-block';
        }
        
        qrIncludeSelect.onchange = (e) => {
            if (e.target.value === 'yes') {
                qrUploadBtn.style.display = 'inline-block';
                if (localStorage.getItem('bank_qr_code')) {
                    qrStatus.style.display = 'inline-block';
                }
                renderQrHistory();
            } else {
                qrUploadBtn.style.display = 'none';
                qrStatus.style.display = 'none';
                if (qrHistoryContainer) qrHistoryContainer.style.display = 'none';
            }
        };
        
        // Initial render if already 'yes'
        if (qrIncludeSelect.value === 'yes') {
            renderQrHistory();
        }
    }
    
    if (qrUploadBtn && qrFileInput) {
        qrUploadBtn.onclick = () => {
            qrFileInput.click();
        };
        
        qrFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const base64String = event.target.result;
                    localStorage.setItem('bank_qr_code', base64String);
                    
                    // Add to history if not exists
                    let history = JSON.parse(localStorage.getItem('bank_qr_codes_history') || '[]');
                    if (!history.includes(base64String)) {
                        history.push(base64String);
                        // Giữ tối đa 10 ảnh gần nhất
                        if (history.length > 10) history.shift();
                        localStorage.setItem('bank_qr_codes_history', JSON.stringify(history));
                    }
                    
                    qrStatus.style.display = 'inline-block';
                    alert('Đã cập nhật QR Code thành công!');
                    renderQrHistory();
                    
                    // Xóa file input value để có thể chọn lại cùng 1 file
                    qrFileInput.value = '';
                };
                reader.readAsDataURL(file);
            }
        };
    }
}

function previewReceipt() {
    const tenantId = document.getElementById('receipt-tenant').value;
    const paymentPeriod = document.getElementById('receipt-payment-period').value;
    
    if (!tenantId || !paymentPeriod) {
        alert('Vui lòng chọn người thuê và kỳ thanh toán');
        return;
    }
    
    const receiptData = generateReceiptDataFromPeriod(tenantId, paymentPeriod);
    if (!receiptData) return;
    
    displayReceiptPreview(receiptData);
    
    // Ẩn form và hiện preview
    document.querySelector('.print-receipt-form').style.display = 'none';
    document.getElementById('receipt-preview').style.display = 'block';
}

function generateReceiptDataFromPeriod(tenantId, paymentPeriod) {
    const paymentPeriodSelect = document.getElementById('receipt-payment-period');
    const selectedOption = paymentPeriodSelect.querySelector(`option[value="${paymentPeriod}"]`);

    if (!selectedOption) {
        alert('Không tìm thấy thông tin kỳ thanh toán');
        return null;
    }

    const monthlyExpenses = JSON.parse(selectedOption.getAttribute('data-expenses'));

    if (!monthlyExpenses || monthlyExpenses.length === 0) {
        alert('Không có chi phí nào trong kỳ thanh toán này');
        return null;
    }

    return generateReceiptDataFromExpenses(tenantId, paymentPeriod, monthlyExpenses);
}

function generateReceiptDataFromExpenses(tenantId, paymentPeriod, monthlyExpenses) {
    const tenant = getTenantById(tenantId);
    if (!tenant) {
        alert('Không tìm thấy thông tin người thuê');
        return null;
    }

    const [fromDate, toDate] = paymentPeriod.split(' đến ');
    const formattedFromDate = formatDateDisplay(fromDate);
    const formattedToDate = formatDateDisplay(toDate);
    const monthText = `từ ${formattedFromDate} đến ${formattedToDate}`;

    const electricity = monthlyExpenses.find(e => e.category === 'electricity');
    const water = monthlyExpenses.find(e => e.category === 'water');
    const room = monthlyExpenses.find(e => e.category === 'rent');
    const other = monthlyExpenses.filter(e => !['electricity', 'water', 'rent'].includes(e.category));

    const totalAmount = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const agencyTotal = monthlyExpenses.filter(e => e.category !== 'rent' && e.category !== 'deposit' && e.category !== 'prepaid_unused').reduce((sum, expense) => sum + expense.amount, 0);

    const roomInfo = getRoomById(tenant.roomId);
    const houseInfo = roomInfo ? getHouseById(roomInfo.houseId) : null;
    const address = houseInfo ? `${roomInfo.name}, ${houseInfo.name}` : 'Không xác định';
    const roomName = roomInfo ? roomInfo.name : 'Không xác định';
    const houseName = houseInfo ? houseInfo.name : 'Không xác định';

    return {
        tenant: {
            ...tenant,
            room: { name: roomName },
            house: { name: houseName }
        },
        monthText,
        address,
        roomName,
        houseName,
        electricity,
        water,
        room,
        other,
        totalAmount,
        agencyTotal,
        monthlyExpenses,
        paymentPeriod
    };
}

function displayReceiptPreview(data, options = {}) {
    const content = document.getElementById(options.contentId || 'receipt-content');
    content.innerHTML = '';
    content.appendChild(displaySimpleReceipt(data));
}

function displaySimpleReceipt(data) {
    const template = document.getElementById('receipt-template-simple');
    const receiptHtml = template.content.cloneNode(true);
    const receiptPaper = receiptHtml.querySelector('.receipt-paper-simple');
    const isMoveout = data.receiptKind === 'moveout';

    if (data.receiptKind === 'moveout' && receiptPaper) {
        const moveoutTitle = document.createElement('h1');
        moveoutTitle.className = 'simple-moveout-title';
        moveoutTitle.textContent = 'PHIẾU THANH LÝ HỢP ĐỒNG CHO THUÊ PHÒNG TRỌ';
        const simpleHeader = receiptPaper.querySelector('.simple-header');
        if (simpleHeader) {
            simpleHeader.parentNode.insertBefore(moveoutTitle, simpleHeader);
        } else {
            receiptPaper.insertBefore(moveoutTitle, receiptPaper.firstChild);
        }
    }

    // Fill header
    receiptHtml.getElementById('simple-tenant-location').innerHTML = 
        `${data.tenant.name} – Phòng ${data.tenant.room.name}<br>Nhà ${data.tenant.house.name}`;
    
    // Thêm class CSS cho tiêu đề dựa trên tên nhà
    const simpleHeader = receiptHtml.querySelector('.simple-header');
    if (simpleHeader) {
        if (isMoveout) simpleHeader.classList.add('is-moveout');
        const houseName = data.tenant.house.name.toLowerCase();
        if (houseName.includes('bạch đằng') || houseName.includes('bach dang')) {
            simpleHeader.classList.add('house-bach-dang');
        } else if (houseName.includes('bình chuẩn') || houseName.includes('binh chuan')) {
            simpleHeader.classList.add('house-binh-chuan');
        }
    }
    
    const roomExpense = data.room;
    const roomAmount = roomExpense ? roomExpense.amount : 0;
    const roomItem = receiptHtml.getElementById('simple-room-item');
    if (roomItem) {
        roomItem.style.display = roomAmount > 0 ? 'flex' : 'none';
    }
    if (isMoveout) {
        const collectSectionTitle = document.createElement('div');
        collectSectionTitle.className = 'simple-section-title';
        collectSectionTitle.style.color = '#1e3a8a';
        collectSectionTitle.style.borderTopColor = '#1e3a8a';
        collectSectionTitle.style.paddingTop = '10px';
        collectSectionTitle.style.marginBottom = '10px';
        collectSectionTitle.textContent = 'CÁC KHOẢN CẦN THU';
        
        const roomItem = receiptHtml.getElementById('simple-room-item');
        if (roomItem && roomItem.parentNode) {
            roomItem.parentNode.insertBefore(collectSectionTitle, roomItem);
        }
    }

    if (roomAmount > 0) {
        receiptHtml.getElementById('simple-room-amount').textContent =
            formatCurrency(roomExpense.amount);
        receiptHtml.getElementById('simple-period').textContent = data.monthText;
    }

    const electricityExpense = data.electricity;
    const electricityAmount = electricityExpense ? electricityExpense.amount : 0;
    
    const electricityItem = receiptHtml.getElementById('simple-electricity-item');
    if (electricityItem) {
        electricityItem.style.display = electricityAmount > 0 ? 'flex' : 'none';
    }
    
    if (electricityAmount > 0) {
        if (electricityExpense.method === 'direct') {
            receiptHtml.getElementById('simple-electricity-details').style.display = 'none';
            receiptHtml.getElementById('simple-electricity-direct-details').style.display = 'block';
            receiptHtml.getElementById('simple-electricity-amount-direct').style.display = 'block';
            receiptHtml.getElementById('simple-electricity-amount-direct').textContent = formatCurrency(electricityExpense.amount);
        } else {
            receiptHtml.getElementById('simple-electricity-details').style.display = 'block';
            receiptHtml.getElementById('simple-electricity-direct-details').style.display = 'none';
            receiptHtml.getElementById('simple-electricity-amount-direct').style.display = 'none';
            receiptHtml.getElementById('simple-electricity-new').textContent = electricityExpense.newIndex || '0';
            receiptHtml.getElementById('simple-electricity-old').textContent = electricityExpense.oldIndex || '0';
            receiptHtml.getElementById('simple-electricity-consumption').textContent = 
                `${((electricityExpense.newIndex || 0) - (electricityExpense.oldIndex || 0))}KW`;
            receiptHtml.getElementById('simple-electricity-price').textContent = 
                formatCurrency(electricityExpense.unitPrice || 0);
            receiptHtml.getElementById('simple-electricity-amount').textContent = 
                formatCurrency(electricityExpense.amount);
        }
    }
    
    const waterExpense = data.water;
    const waterAmount = waterExpense ? waterExpense.amount : 0;
    
    const waterItem = receiptHtml.getElementById('simple-water-item');
    if (waterItem) {
        waterItem.style.display = waterAmount > 0 ? 'flex' : 'none';
    }
    
    if (waterAmount > 0) {
        if (waterExpense.method === 'direct') {
            receiptHtml.getElementById('simple-water-details').style.display = 'none';
            receiptHtml.getElementById('simple-water-direct-details').style.display = 'block';
            receiptHtml.getElementById('simple-water-amount-direct').style.display = 'block';
            receiptHtml.getElementById('simple-water-amount-direct').textContent = formatCurrency(waterExpense.amount);
        } else {
            receiptHtml.getElementById('simple-water-details').style.display = 'block';
            receiptHtml.getElementById('simple-water-direct-details').style.display = 'none';
            receiptHtml.getElementById('simple-water-amount-direct').style.display = 'none';
            receiptHtml.getElementById('simple-water-new').textContent = waterExpense.newIndex || '0';
            receiptHtml.getElementById('simple-water-old').textContent = waterExpense.oldIndex || '0';
            receiptHtml.getElementById('simple-water-consumption').textContent = 
                `${((waterExpense.newIndex || 0) - (waterExpense.oldIndex || 0))}m3`;
            receiptHtml.getElementById('simple-water-price').textContent = 
                formatCurrency(waterExpense.unitPrice || 0);
            receiptHtml.getElementById('simple-water-amount').textContent = 
                formatCurrency(waterExpense.amount);
        }
    }
    
    const internetExpense = data.other.find(e => e.category === 'internet');
    const internetAmount = internetExpense ? internetExpense.amount : 0;
    
    const internetItem = receiptHtml.getElementById('simple-internet-item');
    if (internetItem) {
        internetItem.style.display = internetAmount > 0 ? 'flex' : 'none';
    }
    
    if (internetAmount > 0) {
        const internetDetail = receiptHtml.getElementById('simple-internet-direct-details');
        if (internetDetail) internetDetail.style.display = 'block';
        receiptHtml.getElementById('simple-internet-amount').textContent = 
            formatCurrency(internetExpense.amount);
    }
    
    const garbageExpense = data.other.find(e => e.category === 'other');
    const garbageAmount = garbageExpense ? garbageExpense.amount : 0;
    
    const garbageItem = receiptHtml.getElementById('simple-garbage-item');
    if (garbageItem) {
        garbageItem.style.display = garbageAmount > 0 ? 'flex' : 'none';
    }
    
    if (garbageAmount > 0) {
        const garbageDetail = receiptHtml.getElementById('simple-garbage-direct-details');
        if (garbageDetail) garbageDetail.style.display = 'block';
        receiptHtml.getElementById('simple-garbage-amount').textContent = 
            formatCurrency(garbageExpense.amount);
    }

    const otherAgencyAmount = (data.other || [])
        .filter(e => !['internet', 'other', 'deposit', 'prepaid_unused'].includes(e.category))
        .reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const hasAgencyFees = electricityAmount > 0 || waterAmount > 0 || internetAmount > 0 ||
        garbageAmount > 0 || otherAgencyAmount > 0;
    const agencySectionTitle = receiptHtml.getElementById('simple-agency-section-title');
    if (agencySectionTitle) {
        agencySectionTitle.style.display = hasAgencyFees ? 'block' : 'none';
    }
    
    const refundExpensesList = (data.other || []).filter(e => e.category === 'deposit' || e.category === 'prepaid_unused');
    const refundTotal = refundExpensesList.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // Fill total
    const agencyTotalRow = receiptHtml.getElementById('simple-agency-total-row');
    const agencyTotalAmount = receiptHtml.getElementById('simple-agency-total-amount');
    if (agencyTotalRow && agencyTotalAmount) {
        if (data.agencyTotal > 0 || (isMoveout && roomAmount > 0)) {
            agencyTotalRow.style.display = 'flex';
            
            if (isMoveout) {
                const totalCollect = (data.room ? data.room.amount : 0) + (data.agencyTotal || 0);
                agencyTotalAmount.textContent = formatCurrency(totalCollect);
                const agencyLabel = agencyTotalRow.querySelector('.simple-agency-total-label');
                if (agencyLabel) agencyLabel.textContent = 'Tổng các khoản cần thu (1):';
                
                agencyTotalRow.style.background = '#e0e7ff';
                agencyTotalRow.style.color = '#1e3a8a';
                agencyTotalRow.style.padding = '12px 15px';
                agencyTotalRow.style.borderRadius = '6px';
                agencyTotalRow.style.border = '1px dashed #1e3a8a';
                agencyTotalRow.style.marginTop = '15px';
            } else {
                agencyTotalAmount.textContent = formatCurrency(data.agencyTotal);
            }
        } else {
            agencyTotalRow.style.display = 'none';
        }
    }

    const simpleTotalRow = receiptHtml.querySelector('.simple-total');
    if (isMoveout && refundTotal > 0) {
        const refundSection = document.createElement('div');
        refundSection.style.marginTop = '15px';
        refundSection.innerHTML = `
            <div class="simple-section-title" style="color: #15803d; border-top-color: #15803d; padding-top: 10px; margin-bottom: 10px;">CÁC KHOẢN ĐÃ THU</div>
        `;
        
        let refundNotesForSimple = '';
        refundExpensesList.forEach(expense => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'simple-item';
            itemDiv.innerHTML = `
                <span class="simple-label">${getCategoryText(expense.category)}:</span>
                <span class="simple-amount">${formatCurrency(expense.amount)}</span>
            `;
            refundSection.appendChild(itemDiv);
            
            if (expense.notes) {
                let noteText = expense.notes.replace(/^.*📝 Lưu ý: /s, '').trim();
                if (noteText) refundNotesForSimple += (refundNotesForSimple ? '\n' : '') + noteText;
            }
        });
        
        const refundTotalDiv = document.createElement('div');
        refundTotalDiv.style.display = 'flex';
        refundTotalDiv.style.justifyContent = 'space-between';
        refundTotalDiv.style.alignItems = 'center';
        refundTotalDiv.style.marginTop = '10px';
        refundTotalDiv.style.padding = '12px 15px';
        refundTotalDiv.style.borderRadius = '6px';
        refundTotalDiv.style.background = '#dcfce7';
        refundTotalDiv.style.color = '#15803d';
        refundTotalDiv.style.border = '1px dashed #15803d';
        refundTotalDiv.style.fontWeight = 'bold';
        refundTotalDiv.style.fontSize = '18px';
        refundTotalDiv.innerHTML = `
            <span>Tổng các khoản đã thu (2):</span>
            <span>${formatCurrency(refundTotal)}</span>
        `;
        refundSection.appendChild(refundTotalDiv);
        
        if (refundNotesForSimple) {
            const refundNotesDiv = document.createElement('div');
            refundNotesDiv.className = 'simple-notes';
            refundNotesDiv.style.background = '#dcfce7';
            refundNotesDiv.style.borderLeft = '3px solid #15803d';
            refundNotesDiv.style.marginTop = '10px';
            refundNotesDiv.innerHTML = `
                <div class="notes-content">
                    <span class="notes-label" style="color: #15803d;">📝 Lưu ý các khoản đã thu:</span>
                    <span class="notes-text" style="color: #2e7d32;">${refundNotesForSimple.replace(/\n/g, '<br>')}</span>
                </div>
            `;
            refundSection.appendChild(refundNotesDiv);
        }
        
        simpleTotalRow.parentNode.insertBefore(refundSection, simpleTotalRow);
    }

    let finalDisplayTotal = data.totalAmount;
    if (data.receiptKind === 'moveout') {
        const roomAmount = data.room ? data.room.amount : 0;
        const totalCosts = roomAmount + (data.agencyTotal || 0);
        const settlementAmount = refundTotal - totalCosts;
        finalDisplayTotal = Math.abs(settlementAmount);
        
        let labelText = 'Tổng thanh toán:';
        if (settlementAmount > 0) {
            labelText = 'Chủ nhà trả lại tiền cho Người thuê phòng [(2) - (1)]:';
        } else if (settlementAmount < 0) {
            labelText = 'Người thuê phòng thanh toán cho Chủ nhà [(1) - (2)]:';
        } else {
            labelText = 'Hai bên đã thanh toán đủ:';
        }
        
        const labelSpan = simpleTotalRow.querySelector('.simple-total-label');
        if (labelSpan) labelSpan.textContent = labelText;
        
        simpleTotalRow.style.background = '#1e3a8a';
        simpleTotalRow.style.color = 'white';
        simpleTotalRow.style.border = '2px solid #1e3a8a';
        
        const amountSpan = simpleTotalRow.querySelector('.simple-total-amount');
        if (amountSpan) {
            amountSpan.style.color = 'white';
        }
    }

    receiptHtml.getElementById('simple-total-amount').textContent = 
        formatCurrency(finalDisplayTotal);
    
    // Handle notes display
    handleNotesDisplay(receiptHtml, data);
    
    // QR Code
    const includeQrEl = document.getElementById('receipt-include-qr');
    const qrSection = receiptHtml.getElementById('simple-qr-section');
    const qrImage = receiptHtml.getElementById('simple-qr-image');
    if (includeQrEl && includeQrEl.value === 'yes' && qrSection && qrImage) {
        const qrBase64 = localStorage.getItem('bank_qr_code');
        if (qrBase64) {
            qrImage.src = qrBase64;
            qrSection.style.display = 'block';
        }
    }
    
    return receiptHtml;
}
// ===========================================
// EXPORT PNG FUNCTIONS
// ===========================================

function exportPreviewToPNG() {
    exportReceiptToPNG({
        contentId: 'receipt-content',
        filenamePrefix: 'phieu-thu'
    });
}

function exportReceiptToPNG({ contentId, filenamePrefix }) {
    const receiptContent = document.getElementById(contentId);

    if (!receiptContent || !receiptContent.innerHTML.trim()) {
        alert('Không có nội dung phiếu để xuất');
        return;
    }

    const targetElement = receiptContent.querySelector('.receipt-paper-simple') || receiptContent;
    exportReceiptElementToPNG(targetElement, filenamePrefix);
}

function exportReceiptElementToPNG(targetElement, filenamePrefix) {
    if (!targetElement) return;

    html2canvas(targetElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
    }).then(canvas => {
        let tenantName = filenamePrefix;
        const tenantLocationElement = targetElement.querySelector('#simple-tenant-location');
        if (tenantLocationElement) {
            const fullText = (tenantLocationElement.textContent || '').trim();
            tenantName = fullText.split(' –')[0] || fullText.split('-')[0] || fullText;
        }

        const sanitizedName = tenantName
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        const timestamp = new Date().toISOString().slice(0, 10);

        const link = document.createElement('a');
        link.download = `${filenamePrefix}-${sanitizedName || 'nguoi-thue'}-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(error => {
        console.error('Lỗi khi xuất PNG:', error);
        alert('Có lỗi xảy ra khi xuất PNG');
    });
}

// ===========================================
// SAMPLE DATA INITIALIZATION
// ===========================================

function initSampleData() {
    // Sample houses
    const houses = [
        {
            id: generateHouseId(),
            name: 'Nhà cho thuê số 123',
            address: '123 Đường ABC, Quận 1, TP.HCM',
            roomsCount: 5,
            notes: 'Nhà mới xây, đầy đủ tiện nghi',
            image: DEFAULT_HOUSE_IMAGE
        },
        {
            id: generateHouseId(),
            name: 'Nhà trọ Hòa Bình',
            address: '456 Đường XYZ, Quận 3, TP.HCM', 
            roomsCount: 8,
            notes: 'Gần trường học, an ninh tốt',
            image: DEFAULT_HOUSE_IMAGE
        }
    ];
    
    saveHousesToLocalStorage(houses);
    
    // Sample rooms
    const rooms = [
        {
            id: generateRoomId(),
            houseId: houses[0].id,
            name: 'Phòng 101',
            price: 3000000,
            status: 'occupied',
            description: 'Phòng có ban công',
            image: DEFAULT_ROOM_IMAGE
        },
        {
            id: generateRoomId(),
            houseId: houses[0].id,
            name: 'Phòng 102',
            price: 4500000,
            status: 'available',
            description: 'Phòng rộng rãi',
            image: DEFAULT_ROOM_IMAGE
        },
        {
            id: generateRoomId(),
            houseId: houses[1].id,
            name: 'Phòng A1',
            price: 5000000,
            status: 'occupied',
            description: 'Phòng cao cấp',
            image: DEFAULT_ROOM_IMAGE
        }
    ];
    
    saveRoomsToLocalStorage(rooms);
    
    // Sample tenants
    const tenants = [
        {
            id: generateTenantId(),
            roomId: rooms[0].id,
            name: 'Nguyễn Văn A',
            phone: '0901234567',
            rentAmount: 3000000,
            startDate: '2024-01-01',
            notes: 'Sinh viên, rất sạch sẽ'
        },
        {
            id: generateTenantId(),
            roomId: rooms[2].id,
            name: 'Trần Thị B',
            phone: '0907654321',
            rentAmount: 5000000,
            startDate: '2024-02-15',
            notes: 'Nhân viên văn phòng'
        }
    ];
    
    saveTenantsToLocalStorage(tenants);
    
    // Sample expenses
    const expenses = [
        {
            id: generateExpenseId(),
            tenantId: tenants[0].id,
            category: 'room',
            amount: 3000000,
            date: '2024-01-01',
            description: 'Tiền phòng tháng 1'
        },
        {
            id: generateExpenseId(),
            tenantId: tenants[0].id,
            category: 'electricity',
            amount: 150000,
            date: '2024-01-31',
            description: 'Tiền điện tháng 1',
            oldIndex: 100,
            newIndex: 150,
            unitPrice: 3000
        }
    ];
    
    saveExpensesToLocalStorage(expenses);
}

// Helper functions
function getRoomById(roomId) {
    const rooms = getRoomsFromLocalStorage();
    return rooms.find(room => room.id === roomId);
}

function getHouseById(houseId) {
    const houses = getHousesFromLocalStorage();
    return houses.find(house => house.id === houseId);
}

function getTenantById(tenantId) {
    const tenants = getTenantsFromLocalStorage();
    return tenants.find(tenant => tenant.id === tenantId);
}

function numberToWords(num) {
    if (num === 0) return 'không';
    
    const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const tens = ['', '', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
    const scales = ['', 'nghìn', 'triệu', 'tỷ'];
    
    function convertGroup(n) {
        let result = '';
        
        if (n >= 100) {
            result += ones[Math.floor(n / 100)] + ' trăm ';
            n %= 100;
        }
        
        if (n >= 20) {
            result += tens[Math.floor(n / 10)] + ' ';
            n %= 10;
        } else if (n >= 10) {
            result += 'mười ';
            n %= 10;
        }
        
        if (n > 0) {
            if (n === 1 && result.includes('mười')) {
                result += 'một';
            } else if (n === 5 && result.trim().endsWith('mười')) {
                result += 'lăm';
            } else {
                result += ones[n];
            }
        }
        
        return result.trim();
    }
    
    let result = '';
    let scaleIndex = 0;
    
    while (num > 0) {
        const group = num % 1000;
        if (group > 0) {
            const groupText = convertGroup(group);
            if (scaleIndex > 0) {
                result = groupText + ' ' + scales[scaleIndex] + ' ' + result;
            } else {
                result = groupText + ' ' + result;
            }
        }
        num = Math.floor(num / 1000);
        scaleIndex++;
    }
    
    return result.trim();
}

// Handle notes display in simple receipt
function handleNotesDisplay(receiptHtml, data) {
    // Điện
    let electricityNotes = data.electricity && data.electricity.notes ? data.electricity.notes.replace(/^.*📝 Lưu ý: /s, '') : '';
    const electricityNotesEl = receiptHtml.getElementById('simple-electricity-notes');
    const electricityNotesTextEl = receiptHtml.getElementById('simple-electricity-notes-text');
    if (electricityNotesEl && electricityNotesTextEl) {
        if (electricityNotes) {
            electricityNotesEl.style.display = 'block';
            electricityNotesTextEl.textContent = electricityNotes;
        } else {
            electricityNotesEl.style.display = 'none';
        }
    }

    // Nước
    let waterNotes = data.water && data.water.notes ? data.water.notes.replace(/^.*📝 Lưu ý: /s, '') : '';
    const waterNotesEl = receiptHtml.getElementById('simple-water-notes');
    const waterNotesTextEl = receiptHtml.getElementById('simple-water-notes-text');
    if (waterNotesEl && waterNotesTextEl) {
        if (waterNotes) {
            waterNotesEl.style.display = 'block';
            waterNotesTextEl.textContent = waterNotes;
        } else {
            waterNotesEl.style.display = 'none';
        }
    }

    // Internet
    let internetNotes = '';
    if (data.other && data.other.length) {
        const found = data.other.find(e => e.category === 'internet' && e.notes && e.notes.includes('📝 Lưu ý:'));
        if (found) internetNotes = found.notes.replace(/^.*📝 Lưu ý: /s, '');
    }
    // Nếu muốn hiển thị lưu ý internet, thêm block tương tự như trên

    // Rác
    let garbageNotes = '';
    if (data.other && data.other.length) {
        const found = data.other.find(e => e.category === 'other' && e.notes && e.notes.includes('📝 Lưu ý:'));
        if (found) garbageNotes = found.notes.replace(/^.*📝 Lưu ý: /s, '');
    }
    // Nếu muốn hiển thị lưu ý rác, thêm block tương tự như trên

    // Phòng
    let roomNotes = data.room && data.room.notes ? data.room.notes.replace(/^.*📝 Lưu ý: /s, '') : '';
    const otherNotesEl = receiptHtml.getElementById('simple-other-notes');
    const otherNotesTextEl = receiptHtml.getElementById('simple-other-notes-text');
    if (otherNotesEl && otherNotesTextEl) {
        if (roomNotes) {
            otherNotesEl.style.display = 'block';
            otherNotesTextEl.textContent = roomNotes;
        } else {
            otherNotesEl.style.display = 'none';
        }
    }
}
