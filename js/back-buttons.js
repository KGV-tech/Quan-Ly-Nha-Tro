// ===========================================
// BACK BUTTONS MANAGEMENT SYSTEM
// ===========================================

// Back button configurations
const BACK_BUTTON_CONFIGS = {
    'back-to-houses-btn': {
        targetSection: 'home',
        action: () => {
            renderDashboard();
        }
    },
    'back-to-house-btn': {
        targetSection: 'rooms',
        action: () => {
            renderAllRoomsList();
        }
    },
    'back-to-list-btn': {
        targetSection: 'tenants',
        action: () => {
            renderAllTenantsList();
        }
    },
    'back-to-rooms-btn': {
        targetSection: 'rooms',
        action: () => {
            renderAllRoomsList();
        }
    },
    'back-to-receipt-form-btn': {
        targetSection: 'print-receipt',
        action: () => {
            setupReceiptForm();
        }
    }
};

// Initialize all back buttons
function initializeBackButtons() {
    Object.keys(BACK_BUTTON_CONFIGS).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            setupBackButton(buttonId, button);
        }
    });
}

// Setup individual back button
function setupBackButton(buttonId, buttonElement) {
    const config = BACK_BUTTON_CONFIGS[buttonId];
    if (!config) {
        console.error(`No configuration found for button: ${buttonId}`);
        return;
    }
    
    // Remove existing listeners by cloning
    const newButton = buttonElement.cloneNode(true);
    buttonElement.parentNode.replaceChild(newButton, buttonElement);
    
    // Add new event listener
    newButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            // Explicitly hide house-expense-section before any navigation
            const houseExpenseSection = document.getElementById('house-expense-section');
            if (houseExpenseSection) {
                houseExpenseSection.classList.remove('active');
            }
            
            // Execute the action
            config.action();
            
            // Navigate to target section
            if (typeof window.showSection === 'function') {
                window.showSection(config.targetSection);
            } else {
                // Fallback navigation
                const section = document.getElementById(config.targetSection + '-section');
                if (section) {
                    document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
                    section.classList.add('active');
                }
            }

            // Some older navigation helpers use a different section-id format.
            // Verify the requested destination so a back action can never leave
            // the user on an empty screen.
            const target = document.getElementById(config.targetSection + '-section');
            if (target && !target.classList.contains('active')) {
                document.querySelectorAll('main > section').forEach(section => section.classList.remove('active'));
                target.classList.add('active');
            }
        } catch (error) {
            console.error(`Error in back button ${buttonId}:`, error);
            
            // Final fallback
            try {
                // Explicitly hide house-expense-section in fallback
                const houseExpenseSection = document.getElementById('house-expense-section');
                if (houseExpenseSection) {
                    houseExpenseSection.classList.remove('active');
                }
                
                const section = document.getElementById(config.targetSection + '-section');
                if (section) {
                    document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
                    section.classList.add('active');
                }
            } catch (fallbackError) {
                console.error('Final fallback also failed:', fallbackError);
            }
        }
    });
    
    console.log(`Back button ${buttonId} setup completed`);
}

// Setup back button for a specific section when it becomes active
function setupBackButtonForSection(sectionName) {
    // Map section names to button IDs
    const sectionButtonMap = {
        'house-details': 'back-to-houses-btn',
        'room-details': 'back-to-house-btn',
        'tenant-details': 'back-to-list-btn',
        'house-expense': 'back-to-rooms-btn',
        'print-receipt': 'back-to-receipt-form-btn'
    };
    
    const buttonId = sectionButtonMap[sectionName];
    if (buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            setupBackButton(buttonId, button);
        }
    }
}

// Re-initialize back buttons when DOM changes
function reinitializeBackButtons() {
    setTimeout(() => {
        initializeBackButtons();
    }, 100);
}

// Make functions globally available
window.initializeBackButtons = initializeBackButtons;
window.setupBackButtonForSection = setupBackButtonForSection;
window.reinitializeBackButtons = reinitializeBackButtons; 
