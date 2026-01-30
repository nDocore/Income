// ===== Wait for Firebase to be ready =====
window.addEventListener('firebase-ready', initApp);

// Fallback if Firebase already loaded
if (window.firebaseDB) {
    initApp();
}

// ===== DOM Elements =====
let transactionForm, descriptionInput, amountInput, categorySelect;
let typeButtons, transactionsList, emptyState, clearAllBtn;
let balanceEl, totalIncomeEl, totalExpenseEl, currentDateEl;

// ===== State =====
let transactions = [];
let currentType = 'income';
let firebaseInitialized = false;

// ===== Category Icons =====
const categoryIcons = {
    'salary': '💼',
    'bonus': '🎁',
    'investment': '📊',
    'other-income': '💵',
    'food': '🍜',
    'transport': '🚗',
    'shopping': '🛍️',
    'bills': '📄',
    'entertainment': '🎮',
    'health': '🏥',
    'other-expense': '💸'
};

const categoryNames = {
    'salary': 'เงินเดือน',
    'bonus': 'โบนัส',
    'investment': 'ลงทุน',
    'other-income': 'รายรับอื่นๆ',
    'food': 'อาหาร',
    'transport': 'เดินทาง',
    'shopping': 'ช้อปปิ้ง',
    'bills': 'ค่าบริการ',
    'entertainment': 'ความบันเทิง',
    'health': 'สุขภาพ',
    'other-expense': 'รายจ่ายอื่นๆ'
};

// ===== Initialize App =====
function initApp() {
    if (firebaseInitialized) return;
    firebaseInitialized = true;

    // Get DOM elements
    transactionForm = document.getElementById('transactionForm');
    descriptionInput = document.getElementById('description');
    amountInput = document.getElementById('amount');
    categorySelect = document.getElementById('category');
    typeButtons = document.querySelectorAll('.type-btn');
    transactionsList = document.getElementById('transactionsList');
    emptyState = document.getElementById('emptyState');
    clearAllBtn = document.getElementById('clearAll');
    balanceEl = document.getElementById('balance');
    totalIncomeEl = document.getElementById('totalIncome');
    totalExpenseEl = document.getElementById('totalExpense');
    currentDateEl = document.getElementById('currentDate');

    updateDate();
    setupEventListeners();
    setupFirebaseListener();

    console.log('✅ Money Tracker initialized with Firebase!');
}

// ===== Setup Firebase Realtime Listener =====
function setupFirebaseListener() {
    const { database, ref, onValue } = window.firebaseDB;
    const transactionsRef = ref(database, 'transactions');

    onValue(transactionsRef, (snapshot) => {
        const data = snapshot.val();
        transactions = [];

        if (data) {
            // Convert object to array and add Firebase key as id
            Object.keys(data).forEach(key => {
                transactions.push({
                    ...data[key],
                    firebaseKey: key
                });
            });

            // Sort by date (newest first)
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        renderTransactions();
        updateBalance();
    }, (error) => {
        console.error('Firebase read error:', error);
        showNotification('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    });
}

// ===== Update Current Date =====
function updateDate() {
    const now = new Date();
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString('th-TH', options);
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Type button toggle
    typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            typeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentType = btn.dataset.type;
        });
    });

    // Form submit
    transactionForm.addEventListener('submit', handleFormSubmit);

    // Clear all
    clearAllBtn.addEventListener('click', handleClearAll);
}

// ===== Handle Form Submit =====
async function handleFormSubmit(e) {
    e.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const category = categorySelect.value;

    if (!description || !amount || !category) {
        showNotification('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
        return;
    }

    const transaction = {
        id: generateId(),
        description,
        amount,
        category,
        type: currentType,
        date: new Date().toISOString()
    };

    try {
        await addTransactionToFirebase(transaction);
        showNotification('บันทึกรายการสำเร็จ!', 'success');

        // Reset form
        transactionForm.reset();
        typeButtons.forEach(b => b.classList.remove('active'));
        document.querySelector('.type-btn.income').classList.add('active');
        currentType = 'income';
    } catch (error) {
        console.error('Error adding transaction:', error);
        showNotification('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
}

// ===== Add Transaction to Firebase =====
async function addTransactionToFirebase(transaction) {
    const { database, ref, push, set } = window.firebaseDB;
    const transactionsRef = ref(database, 'transactions');
    const newTransactionRef = push(transactionsRef);
    await set(newTransactionRef, transaction);
}

// ===== Generate Unique ID =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ===== Render Transactions =====
function renderTransactions() {
    if (transactions.length === 0) {
        emptyState.classList.remove('hidden');
        // Remove all transaction items but keep empty state
        const items = transactionsList.querySelectorAll('.transaction-item');
        items.forEach(item => item.remove());
        return;
    }

    emptyState.classList.add('hidden');

    // Clear and re-render
    transactionsList.innerHTML = '';

    transactions.forEach(transaction => {
        const item = createTransactionElement(transaction);
        transactionsList.appendChild(item);
    });
}

// ===== Create Transaction Element =====
function createTransactionElement(transaction) {
    const div = document.createElement('div');
    div.className = `transaction-item ${transaction.type}`;
    div.dataset.id = transaction.id;
    div.dataset.firebaseKey = transaction.firebaseKey;

    const icon = categoryIcons[transaction.category] || '💰';
    const categoryName = categoryNames[transaction.category] || transaction.category;
    const sign = transaction.type === 'income' ? '+' : '-';
    const formattedAmount = formatCurrency(transaction.amount);

    div.innerHTML = `
        <div class="transaction-icon">${icon}</div>
        <div class="transaction-details">
            <div class="transaction-desc">${escapeHtml(transaction.description)}</div>
            <div class="transaction-category">${categoryName}</div>
        </div>
        <div class="transaction-amount">${sign}${formattedAmount}</div>
        <button class="delete-btn" onclick="deleteTransaction('${transaction.firebaseKey}')">
            🗑️
        </button>
    `;

    return div;
}

// ===== Delete Transaction from Firebase =====
async function deleteTransaction(firebaseKey) {
    const { database, ref, remove } = window.firebaseDB;

    try {
        const transactionRef = ref(database, `transactions/${firebaseKey}`);
        await remove(transactionRef);
        showNotification('ลบรายการสำเร็จ', 'success');
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showNotification('เกิดข้อผิดพลาดในการลบ', 'error');
    }
}

// Make deleteTransaction available globally
window.deleteTransaction = deleteTransaction;

// ===== Update Balance =====
function updateBalance() {
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    balanceEl.textContent = formatCurrency(balance);
    totalIncomeEl.textContent = formatCurrency(income);
    totalExpenseEl.textContent = formatCurrency(expense);
}

// ===== Format Currency =====
function formatCurrency(amount) {
    return '฿' + amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ===== Handle Clear All =====
async function handleClearAll() {
    if (transactions.length === 0) return;

    if (confirm('คุณต้องการลบรายการทั้งหมดหรือไม่?')) {
        const { database, ref, remove } = window.firebaseDB;

        try {
            const transactionsRef = ref(database, 'transactions');
            await remove(transactionsRef);
            showNotification('ลบรายการทั้งหมดสำเร็จ', 'success');
        } catch (error) {
            console.error('Error clearing transactions:', error);
            showNotification('เกิดข้อผิดพลาดในการลบ', 'error');
        }
    }
}

// ===== Show Notification =====
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        default: return 'ℹ️';
    }
}

// ===== Escape HTML =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
