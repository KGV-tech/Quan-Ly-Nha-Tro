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
    const editReceiptsBtn = document.getElementById('moveout-edit-receipt-btn');
    const receiptsModal = document.getElementById('moveout-receipts-modal');
    const receiptsList = document.getElementById('moveout-receipts-list');
    if (!tenantSelect || !declareBtn) return;

    const tenants = getTenantsFromLocalStorage()
        .filter(tenant => tenant.roomId)
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
        loadMoveoutPaymentPeriods(tenantSelect.value);
    };

    setupMoveoutPrintForm(tenantSelect);

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

    if (editReceiptsBtn && receiptsModal && receiptsList) {
        editReceiptsBtn.onclick = () => {
            const expenses = getExpensesFromLocalStorage();
            const moveoutExpenses = expenses.filter(expense => expense.receiptType === 'moveout' || expense.category === 'deposit' || expense.category === 'prepaid_unused');
            const grouped = {};
            moveoutExpenses.forEach(expense => {
                const fromDate = expense.fromDate || expense.date || '';
                const toDate = expense.toDate || expense.date || '';
                const key = `${expense.tenantId}|${fromDate} đến ${toDate}`;
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(expense);
            });

            const groupedEntries = Object.entries(grouped).sort((a, b) => {
                const dateA = new Date(a[1][0].toDate || a[1][0].date || 0);
                const dateB = new Date(b[1][0].toDate || b[1][0].date || 0);
                return dateB - dateA;
            });

            receiptsList.innerHTML = '';
            if (groupedEntries.length === 0) {
                receiptsList.innerHTML = '<div class="empty-state"><p>Chưa có Phiếu trả phòng nào đã lưu.</p></div>';
            } else {
                groupedEntries.forEach(([groupKey, groupExpenses]) => {
                    const [tenantId, timeKey] = groupKey.split('|');
                    const tenant = typeof getTenantById === 'function' ? getTenantById(tenantId) : null;
                    const item = document.createElement('div');
                    item.className = 'moveout-receipt-item';
                    item.innerHTML = `
                        <div class="moveout-receipt-meta">
                            <strong>${tenant ? tenant.name : 'Người thuê không xác định'}</strong><br>
                            Kỳ: ${timeKey}
                        </div>
                        <button type="button" class="btn-primary">Mở chỉnh sửa</button>
                    `;
                    const openBtn = item.querySelector('button');
                    openBtn.addEventListener('click', () => {
                        receiptsModal.style.display = 'none';
                        activateInlineRoomFeesMode();
                        if (typeof openTimeGroupEditModal === 'function') {
                            openTimeGroupEditModal(timeKey, groupExpenses, tenantId);
                        }
                    });
                    receiptsList.appendChild(item);
                });
            }

            receiptsModal.style.display = 'block';
        };
    }
}

function isMoveoutExpense(expense) {
    return expense.receiptType === 'moveout' || expense.category === 'deposit' || expense.category === 'prepaid_unused';
}

function setupMoveoutPrintForm(tenantSelect) {
    const paymentPeriodSelect = document.getElementById('moveout-payment-period');
    const previewBtn = document.getElementById('preview-moveout-receipt-btn');
    const backBtn = document.getElementById('back-to-moveout-form-btn');
    const printBtn = document.getElementById('print-moveout-preview-btn');
    const exportBtn = document.getElementById('export-moveout-png-btn');
    if (!paymentPeriodSelect || !previewBtn) return;

    if (tenantSelect) {
        loadMoveoutPaymentPeriods(tenantSelect.value);
    }

    paymentPeriodSelect.onchange = () => {
        previewBtn.disabled = !paymentPeriodSelect.value;
    };

    previewBtn.onclick = previewMoveoutReceipt;

    if (backBtn) {
        backBtn.onclick = () => {
            document.getElementById('moveout-receipt-preview').style.display = 'none';
            document.getElementById('moveout-print-form').style.display = 'block';
        };
    }

    if (printBtn) {
        printBtn.onclick = printMoveoutFromPreview;
    }

    if (exportBtn) {
        exportBtn.onclick = exportMoveoutPreviewToPNG;
    }
}

function loadMoveoutPaymentPeriods(tenantId) {
    const paymentPeriodSelect = document.getElementById('moveout-payment-period');
    const previewBtn = document.getElementById('preview-moveout-receipt-btn');
    if (!paymentPeriodSelect) return;

    paymentPeriodSelect.innerHTML = '<option value="">-- Chọn kỳ trả phòng --</option>';
    paymentPeriodSelect.disabled = true;
    if (previewBtn) previewBtn.disabled = true;

    if (!tenantId) return;

    const expenses = getExpensesFromLocalStorage();
    const moveoutTimeGroups = {};

    expenses.forEach(expense => {
        if (expense.tenantId !== tenantId || !isMoveoutExpense(expense)) return;

        let timeKey = null;
        if (expense.fromDate && expense.toDate) {
            timeKey = `${expense.fromDate} đến ${expense.toDate}`;
        } else {
            const timePattern = /từ (\d{4}-\d{2}-\d{2}) đến (\d{4}-\d{2}-\d{2})/;
            const match = expense.notes?.match(timePattern);
            if (match) {
                timeKey = `${match[1]} đến ${match[2]}`;
            }
        }

        if (timeKey) {
            if (!moveoutTimeGroups[timeKey]) {
                moveoutTimeGroups[timeKey] = [];
            }
            moveoutTimeGroups[timeKey].push(expense);
        }
    });

    const sortedTimeKeys = Object.keys(moveoutTimeGroups).sort((a, b) => {
        const dateA = new Date(a.split(' đến ')[1]);
        const dateB = new Date(b.split(' đến ')[1]);
        return dateB - dateA;
    });

    sortedTimeKeys.forEach(timeKey => {
        const option = document.createElement('option');
        option.value = timeKey;
        option.textContent = `Kỳ ${formatDateRangeDisplay(timeKey)}`;
        option.setAttribute('data-expenses', JSON.stringify(moveoutTimeGroups[timeKey]));
        paymentPeriodSelect.appendChild(option);
    });

    if (sortedTimeKeys.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Chưa có phiếu trả phòng nào';
        option.disabled = true;
        paymentPeriodSelect.appendChild(option);
    } else {
        paymentPeriodSelect.disabled = false;
    }
}

function previewMoveoutReceipt() {
    const tenantId = document.getElementById('moveout-tenant-select')?.value;
    const paymentPeriod = document.getElementById('moveout-payment-period')?.value;

    if (!tenantId || !paymentPeriod) {
        alert('Vui lòng chọn người thuê và kỳ trả phòng');
        return;
    }

    const receiptData = generateMoveoutReceiptDataFromPeriod(tenantId, paymentPeriod);
    if (!receiptData) return;

    displayReceiptPreview(receiptData, {
        contentId: 'moveout-receipt-content',
        templateTypeId: 'moveout-template-type'
    });

    document.getElementById('moveout-print-form').style.display = 'none';
    document.getElementById('moveout-receipt-preview').style.display = 'block';
}

function generateMoveoutReceiptDataFromPeriod(tenantId, paymentPeriod) {
    const paymentPeriodSelect = document.getElementById('moveout-payment-period');
    const selectedOption = paymentPeriodSelect?.querySelector(`option[value="${paymentPeriod}"]`);
    if (!selectedOption) {
        alert('Không tìm thấy thông tin kỳ trả phòng');
        return null;
    }

    const monthlyExpenses = JSON.parse(selectedOption.getAttribute('data-expenses'));
    if (!monthlyExpenses?.length) {
        alert('Không có chi phí nào trong kỳ trả phòng này');
        return null;
    }

    const receiptData = generateReceiptDataFromExpenses(tenantId, paymentPeriod, monthlyExpenses);
    if (receiptData) {
        receiptData.receiptKind = 'moveout';
    }
    return receiptData;
}

function printMoveoutFromPreview() {
    const receiptContent = document.getElementById('moveout-receipt-content')?.innerHTML;
    const templateType = document.getElementById('moveout-template-type')?.value || 'professional';
    if (!receiptContent?.trim()) {
        alert('Không có nội dung phiếu trả phòng để in');
        return;
    }
    createPrintWindow(receiptContent, templateType, 'Phiếu trả phòng');
}

function exportMoveoutPreviewToPNG() {
    exportReceiptToPNG({
        contentId: 'moveout-receipt-content',
        templateTypeId: 'moveout-template-type',
        filenamePrefix: 'phieu-tra-phong'
    });
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
    
    const section = document.getElementById(sectionName + '-section');
    if (section) {
        section.classList.add('active');
    }
    
    // Update navigation
    document.querySelectorAll('nav a').forEach(nav => nav.classList.remove('active'));
    const navElement = document.getElementById('nav-' + sectionName);
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

// Make showSection globally available (but don't override if already exists)
if (!window.showSection) {
    window.showSection = showSection;
}

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
    const printPreviewBtn = document.getElementById('print-preview-btn');
    
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
    
    if (printPreviewBtn) {
        printPreviewBtn.onclick = printFromPreview;
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
    const templateTypeEl = document.getElementById(options.templateTypeId || 'receipt-template-type');
    const templateType = templateTypeEl ? templateTypeEl.value : 'professional';

    let receiptHtml;
    if (templateType === 'simple') {
        receiptHtml = displaySimpleReceipt(data);
    } else {
        receiptHtml = displayProfessionalReceipt(data);
    }

    content.innerHTML = '';
    content.appendChild(receiptHtml);
}

function displayProfessionalReceipt(data) {
    const template = document.getElementById('receipt-template');
    const receiptHtml = template.content.cloneNode(true);
    const isMoveout = data.receiptKind === 'moveout';
    const receiptPaper = receiptHtml.querySelector('.receipt-paper');

    if (isMoveout && receiptPaper) {
        const mainTitle = receiptPaper.querySelector('.company-info h1');
        const receiptHeader = receiptPaper.querySelector('.receipt-header');
        const companyInfo = receiptPaper.querySelector('.company-info');
        if (mainTitle) {
            mainTitle.textContent = 'PHIẾU THANH LÝ HỢP ĐỒNG CHO THUÊ PHÒNG TRỌ';
            mainTitle.classList.add('receipt-moveout-banner');
            
            if (receiptHeader) {
                receiptHeader.style.position = 'relative';
                receiptHeader.style.justifyContent = 'center';
            }
            if (companyInfo) {
                companyInfo.style.alignItems = 'center';
                companyInfo.style.width = '100%';
            }
            const dateOnly = receiptPaper.querySelector('.receipt-date-only');
            if (dateOnly) {
                dateOnly.style.position = 'absolute';
                dateOnly.style.right = '0';
            }
        }
    }

    // Fill basic info
    receiptHtml.getElementById('receipt-month-year').textContent = `Kỳ ${data.monthText}`;
    receiptHtml.getElementById('receipt-tenant-name').textContent = data.tenant.name;
    receiptHtml.getElementById('receipt-tenant-phone').textContent = data.tenant.phone || 'Không có';
    
    // Fill room and house info
    receiptHtml.getElementById('receipt-room-name').textContent = data.roomName || 'Không xác định';
    receiptHtml.getElementById('receipt-house-name').textContent = data.houseName || 'Không xác định';
    
    // Generate receipt date
    const now = new Date();
    const receiptDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    
    receiptHtml.getElementById('receipt-date').textContent = receiptDate;
    
    // Fill table content
    const tableBody = receiptHtml.getElementById('receipt-table-body');
    let rowIndex = 1;

    if (data.room) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rowIndex++}</td>
            <td>Tiền phòng</td>
            <td class="detail-cell">Tiền thuê phòng ${data.monthText}</td>
            <td>${formatCurrency(data.room.amount)}</td>
        `;
        tableBody.appendChild(row);
    }

    const agencyExpenses = [];
    if (data.electricity) agencyExpenses.push({ type: 'electricity', expense: data.electricity });
    if (data.water) agencyExpenses.push({ type: 'water', expense: data.water });
    // Tiền rác trước, internet sau
    const garbageExpenses = data.other.filter(e => e.category === 'other');
    const internetExpenses = data.other.filter(e => e.category === 'internet');
    const otherExpenses = data.other.filter(e => e.category !== 'other' && e.category !== 'internet' && e.category !== 'deposit' && e.category !== 'prepaid_unused');
    const refundExpensesList = data.other.filter(e => e.category === 'deposit' || e.category === 'prepaid_unused');

    garbageExpenses.forEach(expense => agencyExpenses.push({ type: 'other', expense }));
    internetExpenses.forEach(expense => agencyExpenses.push({ type: 'other', expense }));
    otherExpenses.forEach(expense => agencyExpenses.push({ type: 'other', expense }));

    const refundExpenses = [];
    refundExpensesList.forEach(expense => refundExpenses.push({ type: 'refund', expense }));

    if (agencyExpenses.length > 0) {
        const sectionRow = document.createElement('tr');
        sectionRow.className = 'receipt-section-header';
        sectionRow.innerHTML = '<td colspan="4">Các khoản Thu hộ, Chi hộ</td>';
        tableBody.appendChild(sectionRow);
    }

    agencyExpenses.forEach(({ type, expense }) => {
        const row = document.createElement('tr');
        let label = '';
        let detailText = '';

        if (type === 'electricity') {
            label = 'Tiền điện';
            if (expense.method === 'direct') {
                detailText = 'Phí hàng tháng';
            } else {
                const consumption = (expense.newIndex || 0) - (expense.oldIndex || 0);
                detailText = `Chỉ số cũ: ${expense.oldIndex || 0} - Chỉ số mới: ${expense.newIndex || 0}<br>${consumption} kWh x ${formatCurrency(expense.unitPrice || 0)}`;
            }
        } else if (type === 'water') {
            label = 'Tiền nước';
            if (expense.method === 'direct') {
                detailText = 'Phí hàng tháng';
            } else {
                const consumption = (expense.newIndex || 0) - (expense.oldIndex || 0);
                detailText = `Chỉ số cũ: ${expense.oldIndex || 0} - Chỉ số mới: ${expense.newIndex || 0}<br>${consumption} m³ x ${formatCurrency(expense.unitPrice || 0)}`;
            }
        } else {
            label = getCategoryText(expense.category);
            if (expense.category === 'other' || expense.category === 'internet') {
                detailText = 'Phí hàng tháng';
            } else {
                detailText = expense.description || 'Chi phí khác';
            }
        }

        row.innerHTML = `
            <td>${rowIndex++}</td>
            <td>${label}</td>
            <td class="detail-cell">${detailText}</td>
            <td>${formatCurrency(expense.amount)}</td>
        `;
        tableBody.appendChild(row);
    });

    let refundTotal = 0;
    if (isMoveout && refundExpenses.length > 0) {
        const sectionRow = document.createElement('tr');
        sectionRow.className = 'receipt-section-header refund-section';
        sectionRow.innerHTML = '<td colspan="4">Các khoản đã thu</td>';
        tableBody.appendChild(sectionRow);

        refundExpenses.forEach(({ type, expense }) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${rowIndex++}</td>
                <td>${getCategoryText(expense.category)}</td>
                <td class="detail-cell">${expense.notes || ''}</td>
                <td>${formatCurrency(expense.amount)}</td>
            `;
            tableBody.appendChild(row);
            refundTotal += expense.amount || 0;
        });
    }
    
    // Fill total
    const agencyTotalRow = receiptHtml.getElementById('receipt-agency-total-row');
    const agencyTotalAmount = receiptHtml.getElementById('receipt-agency-total-amount');
    
    // Add refund summary if any
    const summaryContainer = receiptHtml.querySelector('.receipt-summary');
    
    if (agencyTotalRow && agencyTotalAmount) {
        if (data.agencyTotal > 0) {
            agencyTotalRow.style.display = 'flex';
            agencyTotalAmount.textContent = formatCurrency(data.agencyTotal);
        } else {
            agencyTotalRow.style.display = 'none';
        }
    }

    if (isMoveout && refundTotal > 0) {
        const refundSummaryRow = document.createElement('div');
        refundSummaryRow.className = 'summary-row moveout-summary-refund';
        refundSummaryRow.style.display = 'flex';
        refundSummaryRow.style.justifyContent = 'space-between';
        refundSummaryRow.innerHTML = `
            <span class="summary-label">Tổng các khoản đã thu:</span>
            <span class="summary-amount">${formatCurrency(refundTotal)}</span>
        `;
        // Insert before total
        const finalTotalRow = receiptHtml.querySelector('.summary-row:not(#receipt-agency-total-row)');
        summaryContainer.insertBefore(refundSummaryRow, finalTotalRow);
    }

    let finalDisplayTotal = data.totalAmount;
    const finalTotalRow = receiptHtml.querySelector('.summary-row:not(#receipt-agency-total-row):not(.moveout-summary-refund)');
    
    if (isMoveout) {
        const roomAmount = data.room ? data.room.amount : 0;
        const totalCosts = roomAmount + (data.agencyTotal || 0);
        const settlementAmount = refundTotal - totalCosts;
        finalDisplayTotal = Math.abs(settlementAmount);
        
        finalTotalRow.classList.add('moveout-final-total');
        
        let labelText = 'Tổng thanh toán:';
        if (settlementAmount > 0) {
            labelText = 'Chủ nhà trả lại tiền cho Người thuê phòng:';
        } else if (settlementAmount < 0) {
            labelText = 'Người thuê phòng thanh toán cho Chủ nhà:';
        } else {
            labelText = 'Hai bên đã thanh toán đủ:';
        }
        finalTotalRow.querySelector('.summary-label').textContent = labelText;
    }

    receiptHtml.getElementById('receipt-total-amount').textContent = formatCurrency(finalDisplayTotal);
    receiptHtml.getElementById('receipt-total-text').textContent = numberToWords(finalDisplayTotal) + ' đồng';
    
    // QR Code
    const includeQrEl = document.getElementById('receipt-include-qr');
    const qrSection = receiptHtml.getElementById('receipt-qr-section');
    const qrImage = receiptHtml.getElementById('receipt-qr-image');
    if (includeQrEl && includeQrEl.value === 'yes' && qrSection && qrImage) {
        const qrBase64 = localStorage.getItem('bank_qr_code');
        if (qrBase64) {
            qrImage.src = qrBase64;
            qrSection.style.display = 'block';
        }
    }
    
    return receiptHtml;
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

// Helper function to get print styles based on template type
function getPrintStyles(templateType) {
    if (templateType === 'simple') {
        return `
            body { font-family: 'Times New Roman', serif; margin: 0; background: white; }
            .receipt-paper-simple { background: white; max-width: 750px; margin: 0 auto; padding: 20px; font-family: 'Times New Roman', serif; line-height: 1.4; color: #333; }
            .simple-header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #333; }
            .simple-header h2 { margin: 0; font-size: 20px; font-weight: bold; color: #2c3e50; }
            .simple-header.house-bach-dang { background-color: #f5e4b6; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
            .simple-header.house-bach-dang h2 { color: #8b4513; }
            .simple-header.is-moveout.house-bach-dang { background-color: #dbeafe; }
            .simple-header.is-moveout.house-bach-dang h2 { color: #1e3a8a; }
            .simple-header.house-binh-chuan { background-color: #c1f9cf; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
            .simple-header.house-binh-chuan h2 { color: #2d5016; }
            .simple-header.is-moveout.house-binh-chuan { background-color: #fef3c7; }
            .simple-header.is-moveout.house-binh-chuan h2 { color: #92400e; }
            .simple-content { font-size: 18px; }
            .simple-section-title { margin: 16px 0 10px; padding: 8px 0 6px; border-top: 1px solid #333; font-size: 18px; font-weight: bold; text-align: center; text-transform: uppercase; color: #2c3e50; }
            .simple-item { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start; }
            .simple-label { font-weight: bold; min-width: 120px; flex-shrink: 0; }
            .simple-details { flex: 1; margin-left: 20px; }
            .simple-details div { margin-bottom: 5px; }
            .simple-amount { font-weight: bold; text-align: right; min-width: 120px; }
            .simple-total { margin-top: 15px; padding: 10px; border-top: 1px solid #333; background: yellow; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: bold; }
            .simple-total-label { font-weight: bold; }
            .simple-total-amount { font-size: 22px; font-weight: bold; color: #2c3e50; }
            .simple-notes { margin: 8px 0; padding: 8px 12px; background: rgba(255, 255, 0, 0.1); border-left: 3px solid #f39c12; border-radius: 4px; }
            .simple-moveout-title { text-align: center; font-size: 24px; font-weight: bold; color: #991b1b; background: #fee2e2; padding: 12px 20px; border-radius: 8px; margin: 0 0 15px 0; border: 2px solid #991b1b; text-transform: uppercase; }
            .notes-content { display: flex; flex-direction: column; gap: 4px; }
            .notes-label { font-weight: 600; color: #e67e22; font-size: 14px; }
            .notes-text { color: #2c3e50; font-size: 13px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
            @media print {
                @page { size: A5 portrait; margin: 15mm; }
                .receipt-paper-simple { padding: 15px; box-shadow: none; border: none; margin: 0; max-width: none; font-size: 16px; }
                .simple-header h2 { font-size: 18px; }
                .simple-header.house-bach-dang { background-color: #f5e4b6 !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .simple-header.house-bach-dang h2 { color: #8b4513 !important; }
                .simple-header.is-moveout.house-bach-dang { background-color: #dbeafe !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .simple-header.is-moveout.house-bach-dang h2 { color: #1e3a8a !important; }
                .simple-header.house-binh-chuan { background-color: #c1f9cf !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .simple-header.house-binh-chuan h2 { color: #2d5016 !important; }
                .simple-header.is-moveout.house-binh-chuan { background-color: #fef3c7 !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .simple-header.is-moveout.house-binh-chuan h2 { color: #92400e !important; }
                .simple-content { font-size: 16px; }
                .simple-total { font-size: 18px; background: yellow !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .simple-total-amount { font-size: 20px; }
                .simple-notes { background: rgba(255, 255, 0, 0.1) !important; -webkit-print-color-adjust: exact; color-adjust: exact; border-left: 3px solid #f39c12 !important; }
                .notes-label { color: #e67e22 !important; font-size: 13px !important; }
                .notes-text { color: #2c3e50 !important; font-size: 12px !important; }
                .simple-moveout-title { background: #fee2e2 !important; color: #991b1b !important; border: 2px solid #991b1b !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .simple-agency-total { -webkit-print-color-adjust: exact; color-adjust: exact; }
                body { background: white !important; -webkit-print-color-adjust: exact; }
            }
        `;
    } else {
        return `
            body { font-family: 'Times New Roman', serif; margin: 0; background: white; }
            .receipt-paper { background: white; max-width: 800px; margin: 0 auto; padding: 40px; font-family: 'Times New Roman', serif; line-height: 1.6; color: #333; font-size: 19px; }
            .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
            .company-info h1 { font-size: 31px; font-weight: bold; color: #2c3e50; margin: 0 0 10px 0; text-align: center; }
            .receipt-moveout-banner { font-size: 34px !important; color: #c0392b !important; letter-spacing: 1px; }
            .receipt-period { font-size: 21px; color: #555; text-align: center; font-weight: 500; }
            .receipt-date-only { text-align: right; font-size: 19px; color: #666; }
            .receipt-date-only p { margin: 5px 0; }
            .tenant-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #dee2e6; }
            .info-row { display: flex; justify-content: flex-start; margin-bottom: 10px; align-items: center; gap: 40px; }
            .info-row .info-pair { display: flex; align-items: center; }
            .info-row .info-pair .label { margin-right: 0.5em; }
            .info-row:last-child { margin-bottom: 0; }
            .info-row .label { font-weight: bold; color: #2c3e50; font-size: 19px; white-space: nowrap; }
            .info-row .value { color: #333; font-size: 19px; }
            .receipt-content { margin-bottom: 30px; }
            .receipt-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 19px; }
            .receipt-table th, .receipt-table td { border: 1px solid #333; padding: 14px 10px; text-align: left; }
            .receipt-table th { background: #f8f9fa; font-weight: bold; color: #2c3e50; text-align: center; }
            .receipt-table th:first-child { width: 50px; text-align: center; }
            .receipt-table th:last-child { width: 120px; text-align: right; }
            .receipt-table td:first-child { text-align: center; font-weight: bold; }
            .receipt-table td:last-child { text-align: right; font-weight: bold; }
            .receipt-table .detail-cell { font-size: 17px; color: #666; font-style: italic; }
            .receipt-table .receipt-section-header td { background: #eef2f7; font-weight: bold; font-size: 18px; color: #2c3e50; text-align: center; text-transform: uppercase; padding: 12px 10px; border-top: 2px solid #333; }
            .receipt-table .receipt-section-header.refund-section td { background: #e8f5e9; color: #2e7d32; }
            .receipt-summary { border-top: 2px solid #333; padding-top: 20px; margin-bottom: 30px; }
            .summary-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #fff3cd; padding: 15px 20px; border-radius: 8px; border: 2px solid #ffc107; }
            .summary-row.moveout-summary-refund { background: #e8f5e9; color: #2e7d32; border: 2px solid #2e7d32; }
            .summary-row.moveout-final-total { background: #0d7377; color: white; border: 2px solid #0d7377; margin-top: 15px; }
            .summary-row.moveout-final-total .summary-amount, .summary-row.moveout-final-total .summary-label { color: white; }
            .summary-label { font-size: 21px; font-weight: bold; color: #2c3e50; }
            .summary-amount { font-size: 27px; font-weight: bold; color: #e74c3c; padding: 10px 20px; border-radius: 4px; background: #f8f9fa; }
            .summary-text { font-size: 19px; color: #555; font-style: italic; }
            .receipt-footer { margin-top: 40px; }
            .signature-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .signature-box { text-align: center; width: 45%; }
            .signature-title { font-weight: bold; font-size: 19px; color: #2c3e50; margin-bottom: 5px; }
            .signature-subtitle { font-size: 17px; color: #666; margin-bottom: 40px; }
            .signature-space { height: 100px; border-bottom: 1px solid #333; margin-bottom: 10px; }
            @media print {
                @page { size: A5 portrait; margin: 15mm; }
                .receipt-paper { padding: 15px; box-shadow: none; border: none; margin: 0; max-width: none; font-size: 15px; }
                .receipt-header { page-break-inside: avoid; }
                .receipt-table { page-break-inside: avoid; }
                .signature-section { page-break-inside: avoid; }
                .summary-row { background: #fff3cd !important; border: 2px solid #ffc107 !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .summary-row.moveout-summary-refund { background: #e8f5e9 !important; border: 2px solid #2e7d32 !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .summary-row.moveout-final-total { background: #0d7377 !important; border: 2px solid #0d7377 !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .receipt-moveout-banner { background: #e0f2f1 !important; color: #0d7377 !important; -webkit-print-color-adjust: exact; color-adjust: exact; padding: 10px 20px; border-radius: 8px; display: inline-block; }
                .receipt-table .receipt-section-header.refund-section td { background: #e8f5e9 !important; color: #2e7d32 !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
                body { background: white !important; -webkit-print-color-adjust: exact; }
            }
        `;
    }
}

// Helper function to create print window
function createPrintWindow(receiptContent, templateType, title = '') {
    const printWindow = window.open('', '_blank');
    const styles = getPrintStyles(templateType);
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>${styles}</style>
        </head>
        <body>
            ${receiptContent}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function printReceipt(data) {
    // Tạo HTML để in
    displayReceiptPreview(data);
    
    // Mở cửa sổ in
    setTimeout(() => {
        const receiptContent = document.getElementById('receipt-content').innerHTML;
        const title = `Phiếu thu - ${data.tenant.name} - Kỳ ${data.monthText}`;
        createPrintWindow(receiptContent, 'professional', title);
    }, 100);
}

function printFromPreview() {
    const receiptContent = document.getElementById('receipt-content').innerHTML;
    const templateType = document.getElementById('receipt-template-type').value;
    createPrintWindow(receiptContent, templateType);
}

// ===========================================
// EXPORT PNG FUNCTIONS
// ===========================================

function exportPreviewToPNG() {
    exportReceiptToPNG({
        contentId: 'receipt-content',
        templateTypeId: 'receipt-template-type',
        filenamePrefix: 'phieu-thu'
    });
}

function exportReceiptToPNG({ contentId, templateTypeId, filenamePrefix }) {
    const receiptContent = document.getElementById(contentId);

    if (!receiptContent || !receiptContent.innerHTML.trim()) {
        alert('Không có nội dung phiếu để xuất');
        return;
    }

    const targetElement = receiptContent.querySelector('.receipt-paper-simple, .receipt-paper') || receiptContent;

    html2canvas(targetElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
    }).then(canvas => {
        const templateTypeEl = document.getElementById(templateTypeId);
        const templateType = templateTypeEl ? templateTypeEl.value : 'professional';
        let tenantName = filenamePrefix;

        if (templateType === 'simple') {
            const tenantLocationElement = receiptContent.querySelector('#simple-tenant-location');
            if (tenantLocationElement) {
                const fullText = (tenantLocationElement.textContent || '').trim();
                tenantName = fullText.split(' –')[0] || fullText.split('-')[0] || fullText;
            }
        } else {
            const tenantNameElement = receiptContent.querySelector('#receipt-tenant-name');
            if (tenantNameElement) {
                tenantName = (tenantNameElement.textContent || '').trim();
            }
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
