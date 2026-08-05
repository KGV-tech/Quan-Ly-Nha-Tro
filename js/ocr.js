// OCR functionality for bill scanning
let currentScanningType = null;

// Initialize Tesseract.js
async function initializeOCR() {
    try {
        await Tesseract.createWorker('vie');
        console.log('OCR initialized successfully');
    } catch (error) {
        console.error('Error initializing OCR:', error);
    }
}

// Scan bill function
async function scanBill(expenseType) {
    currentScanningType = expenseType;
    
    // Create file input for camera/upload
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment'; // Use back camera on mobile
    
    fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            await processBillImage(file, expenseType);
        }
    };
    
    fileInput.click();
}

// Process the bill image with OCR
async function processBillImage(file, expenseType) {
    try {
        // Show loading indicator
        showScanLoading(expenseType);
        
        // Create worker for Vietnamese language
        const worker = await Tesseract.createWorker('vie');
        
        // Recognize text from image
        const { data: { text } } = await worker.recognize(file);
        
        // Parse the extracted text
        const parsedData = parseBillText(text, expenseType);
        
        // Auto-fill the form
        autoFillExpenseForm(expenseType, parsedData);
        
        // Terminate worker
        await worker.terminate();
        
        // Hide loading indicator
        hideScanLoading(expenseType);
        
        // Show success message
        showScanSuccess(expenseType);
        
    } catch (error) {
        console.error('OCR Error:', error);
        hideScanLoading(expenseType);
        showScanError(expenseType, error.message);
    }
}

// Parse extracted text to extract relevant information
function parseBillText(text, expenseType) {
    const result = {
        amount: null,
        fromDate: null,
        toDate: null,
        paymentDate: null,
        notes: ''
    };
    
    console.log('Extracted text:', text);
    
    // Extract amount (look for Vietnamese currency patterns)
    const amountPatterns = [
        /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:VNĐ|đồng|VND)/gi,
        /(?:Tổng cộng|Thành tiền|Số tiền|Phải trả)[:\s]*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
        /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
    ];
    
    for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
            const amountStr = match[1] || match[0];
            const amount = parseFloat(amountStr.replace(/[,\.]/g, ''));
            if (amount > 0) {
                result.amount = amount;
                break;
            }
        }
    }
    
    // Extract dates (look for Vietnamese date patterns)
    const datePatterns = [
        /(\d{1,2}\/\d{1,2}\/\d{4})/g,
        /(\d{1,2}-\d{1,2}-\d{4})/g,
        /(\d{4}-\d{1,2}-\d{1,2})/g,
        /(?:Từ ngày|Từ)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi,
        /(?:Đến ngày|Đến)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi,
        /(?:Ngày thanh toán|Thanh toán)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi
    ];
    
    for (const pattern of datePatterns) {
        const matches = text.match(pattern);
        if (matches) {
            for (const match of matches) {
                const dateStr = match.replace(/[^\d\/\-]/g, '');
                const date = parseVietnameseDate(dateStr);
                if (date) {
                    if (!result.fromDate) {
                        result.fromDate = date;
                    } else if (!result.toDate) {
                        result.toDate = date;
                    } else if (!result.paymentDate) {
                        result.paymentDate = date;
                    }
                }
            }
        }
    }
    
    // Extract additional notes based on expense type
    const typeKeywords = {
        'electricity': ['điện', 'kWh', 'số điện'],
        'water': ['nước', 'm3', 'số nước'],
        'garbage': ['rác', 'vệ sinh', 'môi trường'],
        'internet': ['internet', 'wifi', 'mạng'],
        'phone': ['điện thoại', 'phone', 'viễn thông'],
        'tv': ['truyền hình', 'tv', 'cáp'],
        'other': ['khác', 'dịch vụ']
    };
    
    const keywords = typeKeywords[expenseType] || [];
    const relevantLines = text.split('\n').filter(line => 
        keywords.some(keyword => line.toLowerCase().includes(keyword))
    );
    
    if (relevantLines.length > 0) {
        result.notes = relevantLines.join('; ');
    }
    
    return result;
}

// Parse Vietnamese date format
function parseVietnameseDate(dateStr) {
    try {
        // Handle dd/mm/yyyy format
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900) {
                    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
            }
        }
        
        // Handle yyyy-mm-dd format
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const day = parseInt(parts[2]);
                if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900) {
                    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
            }
        }
    } catch (error) {
        console.error('Date parsing error:', error);
    }
    
    return null;
}

// Auto-fill the expense form with extracted data
function autoFillExpenseForm(expenseType, data) {
    const modal = document.getElementById(`house-expense-${expenseType}-modal`);
    if (!modal) return;
    
    // Fill amount
    if (data.amount) {
        const amountInput = modal.querySelector('.modal-expense-amount');
        if (amountInput) {
            amountInput.value = data.amount;
        }
    }
    
    // Fill from date
    if (data.fromDate) {
        const fromDateInput = modal.querySelector('.modal-expense-from-date');
        if (fromDateInput) {
            fromDateInput.value = data.fromDate;
        }
    }
    
    // Fill to date
    if (data.toDate) {
        const toDateInput = modal.querySelector('.modal-expense-to-date');
        if (toDateInput) {
            toDateInput.value = data.toDate;
        }
    }
    
    // Fill payment date
    if (data.paymentDate) {
        const paymentDateInput = modal.querySelector('.modal-expense-payment-date');
        if (paymentDateInput) {
            paymentDateInput.value = data.paymentDate;
        }
    }
    
    // Fill notes
    if (data.notes) {
        const notesInput = modal.querySelector('.modal-expense-notes');
        if (notesInput) {
            notesInput.value = data.notes;
        }
    }
}

// Show loading indicator during scan
function showScanLoading(expenseType) {
    const modal = document.getElementById(`house-expense-${expenseType}-modal`);
    if (!modal) return;
    
    const scanBtn = modal.querySelector('.scan-btn');
    if (scanBtn) {
        scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        scanBtn.disabled = true;
        scanBtn.title = 'Đang quét...';
    }
}

// Hide loading indicator
function hideScanLoading(expenseType) {
    const modal = document.getElementById(`house-expense-${expenseType}-modal`);
    if (!modal) return;
    
    const scanBtn = modal.querySelector('.scan-btn');
    if (scanBtn) {
        scanBtn.innerHTML = '<i class="fas fa-camera"></i>';
        scanBtn.disabled = false;
        scanBtn.title = 'Quét hóa đơn';
    }
}

// Show success message
function showScanSuccess(expenseType) {
    const modal = document.getElementById(`house-expense-${expenseType}-modal`);
    if (!modal) return;
    
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'scan-notification success';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Quét hóa đơn thành công! Đã tự động điền thông tin.</span>
    `;
    
    modal.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Show error message
function showScanError(expenseType, errorMessage) {
    const modal = document.getElementById(`house-expense-${expenseType}-modal`);
    if (!modal) return;
    
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'scan-notification error';
    notification.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>Lỗi quét hóa đơn: ${errorMessage}</span>
    `;
    
    modal.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Initialize OCR when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeOCR();
    addScanButtonsToModals();
});

// Add scan buttons to all expense modals
function addScanButtonsToModals() {
    const expenseTypes = ['garbage', 'internet', 'phone', 'tv', 'other'];
    
    expenseTypes.forEach(type => {
        const modal = document.getElementById(`house-expense-${type}-modal`);
        if (modal) {
            const amountInput = modal.querySelector('.modal-expense-amount');
            if (amountInput && !amountInput.parentElement.classList.contains('input-with-scan')) {
                // Wrap input in scan container
                const wrapper = document.createElement('div');
                wrapper.className = 'input-with-scan';
                
                // Create scan button
                const scanBtn = document.createElement('button');
                scanBtn.type = 'button';
                scanBtn.className = 'scan-btn';
                scanBtn.onclick = () => scanBill(type);
                scanBtn.title = 'Quét hóa đơn';
                scanBtn.innerHTML = '<i class="fas fa-camera"></i>';
                
                // Move input to wrapper and add button
                amountInput.parentNode.insertBefore(wrapper, amountInput);
                wrapper.appendChild(amountInput);
                wrapper.appendChild(scanBtn);
            }
        }
    });
} 