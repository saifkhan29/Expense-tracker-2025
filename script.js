// Google Sheets API configuration
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const API_KEY = 'YOUR_API_KEY';
const RANGE = 'Sheet1!A:E';

class ExpenseTracker {
    constructor() {
        this.expenses = [];
        this.chart = null;
        this.selectedCategory = '';
        this.selectedPaymentMode = '';
        this.categories = [
            'Food', 'Transportation', 'Entertainment',
            'Shopping', 'Bills', 'Healthcare', 'Others'
        ];
        this.paymentModes = [
            'Cash', 'Credit Card', 'Debit Card',
            'UPI', 'Net Banking'
        ];
        this.initializeElements();
        this.setupEventListeners();
        this.initializeChart();
        this.loadExpenses();
    }

    initializeElements() {
        this.form = document.getElementById('expenseForm');
        this.viewType = document.getElementById('viewType');
        this.viewDate = document.getElementById('viewDate');
        this.themeToggle = document.getElementById('themeToggle');
        this.categoryInput = document.getElementById('category');
        this.paymentModeInput = document.getElementById('paymentMode');
        this.expensesList = document.getElementById('expensesList');
        this.viewDate.valueAsDate = new Date();
        // Set default date in the form
        document.getElementById('date').valueAsDate = new Date();
        this.modal = document.getElementById('settingsModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.itemList = document.getElementById('itemList');
        this.newItemInput = document.getElementById('newItemInput');
        this.addItemBtn = document.getElementById('addItemBtn');
    }

    setupEventListeners() {
        // Fix duplicate form submission
        if (this.form) {
            this.form.onsubmit = (e) => this.handleFormSubmit(e);
        }
        this.viewType.addEventListener('change', () => this.updateChart());
        this.viewDate.addEventListener('change', () => this.updateChart());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Setup category tabs
        document.querySelectorAll('#categoryTabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleTabClick(btn, 'category'));
        });
        
        // Setup payment mode tabs
        document.querySelectorAll('#paymentTabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleTabClick(btn, 'paymentMode'));
        });
        document.getElementById('manageCategoriesBtn').addEventListener('click', () => 
            this.openModal('categories'));
        document.getElementById('managePaymentBtn').addEventListener('click', () => 
            this.openModal('payment'));
        document.querySelector('.close-btn').addEventListener('click', () => 
            this.closeModal());
        this.addItemBtn.addEventListener('click', () => this.addNewItem());
    }

    handleTabClick(button, type) {
        // Remove active class from all buttons in the group
        button.parentElement.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Update hidden input value
        const value = button.dataset.value;
        if (type === 'category') {
            this.categoryInput.value = value;
            this.selectedCategory = value;
        } else {
            this.paymentModeInput.value = value;
            this.selectedPaymentMode = value;
        }
    }

    renderExpensesList() {
        const expenses = this.expenses.slice().reverse().slice(0, 5); // Get last 5 expenses
        if (expenses.length === 0) {
            this.expensesList.innerHTML = '<div class="no-expenses">No expenses added yet</div>';
            return;
        }
        this.expensesList.innerHTML = expenses.map(expense => `
            <div class="expense-item">
                <div class="expense-item-details">
                    <div class="expense-item-description">${expense.description}</div>
                    <div class="expense-item-date">${new Date(expense.date).toLocaleDateString()}</div>
                    <div class="expense-item-tags">
                        <span class="expense-tag">${expense.category}</span>
                        <span class="expense-tag">${expense.paymentMode}</span>
                    </div>
                </div>
                <div class="expense-item-right">
                    <div class="expense-item-amount">$${expense.amount.toFixed(2)}</div>
                    <div class="expense-item-actions">
                        <button class="edit-expense-btn" onclick="expenseTracker.editExpense('${expense.date}', '${expense.description}')" title="Edit">✎</button>
                        <button class="delete-expense-btn" onclick="expenseTracker.deleteExpense('${expense.date}', '${expense.description}')" title="Delete">×</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    initializeChart() {
        const options = {
            series: [{
                name: 'Expenses',
                data: []
            }],
            chart: {
                type: 'bar',
                height: 400,
                background: 'transparent',
                foreColor: getComputedStyle(document.body).getPropertyValue('--text-color'),
                animations: {
                    enabled: false
                }
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    style: {
                        colors: getComputedStyle(document.body).getPropertyValue('--text-color')
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        colors: getComputedStyle(document.body).getPropertyValue('--text-color')
                    },
                    formatter: function (value) {
                        return '$' + value.toFixed(2);
                    }
                }
            },
            grid: {
                borderColor: getComputedStyle(document.body).getPropertyValue('--border-color'),
                strokeDashArray: 4
            },
            plotOptions: {
                bar: {
                    borderRadius: 8,
                    columnWidth: '60%'
                }
            },
            dataLabels: {
                enabled: false
            },
            fill: {
                opacity: 1,
                colors: [getComputedStyle(document.body).getPropertyValue('--primary-color')]
            },
            theme: {
                mode: document.body.classList.contains('dark-mode') ? 'dark' : 'light'
            }
        };
        
        this.chart = new ApexCharts(document.querySelector("#expenseChart"), options);
        this.chart.render();
    }

    async loadExpenses() {
        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`
            );
            const data = await response.json();
            this.expenses = data.values.map(row => ({
                date: row[0],
                description: row[1],
                amount: parseFloat(row[2]),
                category: row[3],
                paymentMode: row[4]
            }));
            this.updateChart();
            this.renderExpensesList();
        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        const expense = {
            date: document.getElementById('date').value,
            description: document.getElementById('description').value,
            amount: parseFloat(document.getElementById('amount').value),
            category: this.selectedCategory,
            paymentMode: this.selectedPaymentMode
        };

        // Validate if all fields are filled
        if (!expense.category || !expense.paymentMode) {
            alert('Please select both category and payment mode');
            return;
        }

        try {
            if (this.editingExpense) {
                // Remove the old expense
                const index = this.expenses.findIndex(e => 
                    e.date === this.editingExpense.date && 
                    e.description === this.editingExpense.description
                );
                if (index !== -1) {
                    this.expenses.splice(index, 1);
                }
                this.editingExpense = null;
                document.querySelector('.submit-btn').textContent = 'Add Expense';
            }

            await this.saveToGoogleSheets(expense);
            // Add the new/updated expense to the local array
            this.expenses.push(expense);
            // Update the UI
            this.renderExpensesList();
            this.updateChart();
            
            e.target.reset();
            // Reset tab selections
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            this.selectedCategory = '';
            this.selectedPaymentMode = '';
            // Reset date to current date
            document.getElementById('date').valueAsDate = new Date();
        } catch (error) {
            console.error('Error saving expense:', error);
        }
    }

    async saveToGoogleSheets(expense) {
        const values = [
            [expense.date, expense.description, expense.amount, expense.category, expense.paymentMode]
        ];

        await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}:append?valueInputOption=USER_ENTERED&key=${API_KEY}`,
            {
                method: 'POST',
                body: JSON.stringify({ values }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    filterExpenses() {
        const date = new Date(this.viewDate.value);
        const viewType = this.viewType.value;

        return this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            switch (viewType) {
                case 'daily':
                    return expenseDate.toDateString() === date.toDateString();
                case 'weekly':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    return expenseDate >= weekStart && expenseDate <= weekEnd;
                case 'monthly':
                    return expenseDate.getMonth() === date.getMonth() &&
                           expenseDate.getFullYear() === date.getFullYear();
            }
        });
    }

    updateChart() {
        const filteredExpenses = this.filterExpenses();
        const data = filteredExpenses.map(e => ({
            x: new Date(e.date).getTime(),
            y: e.amount
        }));

        this.chart.updateSeries([{
            data: data
        }]);
    }

    toggleTheme() {
        if (document.body.classList.contains('dark-mode')) {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
        }
        
        // Update chart colors
        this.updateChartColors();
    }

    updateChartColors() {
        const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
        const borderColor = getComputedStyle(document.body).getPropertyValue('--border-color');
        const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color');

        this.chart.updateOptions({
            chart: {
                foreColor: textColor
            },
            grid: {
                borderColor: borderColor
            },
            fill: {
                colors: [primaryColor]
            },
            theme: {
                mode: document.body.classList.contains('dark-mode') ? 'dark' : 'light'
            }
        });
    }

    openModal(type) {
        this.currentModalType = type;
        this.modalTitle.textContent = type === 'categories' ? 'Manage Categories' : 'Manage Payment Methods';
        this.renderItemList();
        this.modal.style.display = 'block';
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.newItemInput.value = '';
        this.updateTabButtons();
    }

    renderItemList() {
        const items = this.currentModalType === 'categories' ? this.categories : this.paymentModes;
        this.itemList.innerHTML = items.map(item => `
            <div class="item-entry">
                <span class="item-text">${item}</span>
                <div class="item-actions">
                    <button class="edit-btn" onclick="expenseTracker.editItem('${item}')">✎</button>
                    <button class="delete-btn" onclick="expenseTracker.deleteItem('${item}')">&times;</button>
                </div>
            </div>
        `).join('');
    }

    addNewItem() {
        const newItem = this.newItemInput.value.trim();
        if (!newItem) return;

        if (this.currentModalType === 'categories') {
            this.categories.push(newItem);
        } else {
            this.paymentModes.push(newItem);
        }

        this.renderItemList();
        this.newItemInput.value = '';
        this.updateTabButtons();
    }

    deleteItem(item) {
        if (this.currentModalType === 'categories') {
            this.categories = this.categories.filter(i => i !== item);
        } else {
            this.paymentModes = this.paymentModes.filter(i => i !== item);
        }
        this.renderItemList();
        this.updateTabButtons();
    }

    editItem(item) {
        const itemElement = this.itemList.querySelector(`[data-item="${item}"]`);
        const itemText = item;
        
        // Create an input field for editing
        const input = document.createElement('input');
        input.type = 'text';
        input.value = itemText;
        input.className = 'edit-input';
        
        // Create save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '✓';
        saveBtn.className = 'save-btn';
        
        // Replace the text with input and add save button
        const itemEntry = this.itemList.querySelector(`.item-entry:has(button[onclick*="${item}"])`);
        const span = itemEntry.querySelector('span');
        const actions = itemEntry.querySelector('.item-actions');
        
        span.replaceWith(input);
        actions.innerHTML = '';
        actions.appendChild(saveBtn);
        
        input.focus();
        
        // Handle save
        saveBtn.onclick = () => {
            const newValue = input.value.trim();
            if (newValue && newValue !== item) {
                if (this.currentModalType === 'categories') {
                    this.categories = this.categories.map(i => i === item ? newValue : i);
                } else {
                    this.paymentModes = this.paymentModes.map(i => i === item ? newValue : i);
                }
                // Update any existing expenses with the old category/payment method
                this.expenses = this.expenses.map(expense => ({
                    ...expense,
                    category: expense.category === item ? newValue : expense.category,
                    paymentMode: expense.paymentMode === item ? newValue : expense.paymentMode
                }));
                this.renderItemList();
                this.updateTabButtons();
                this.renderExpensesList();
                this.updateChart();
            } else {
                this.renderItemList(); // Reset the view if invalid input
            }
        };
        
        // Handle cancel on escape key
        input.onkeydown = (e) => {
            if (e.key === 'Escape') {
                this.renderItemList();
            } else if (e.key === 'Enter') {
                saveBtn.onclick();
            }
        };
    }

    updateTabButtons() {
        const categoryTabs = document.getElementById('categoryTabs');
        const paymentTabs = document.getElementById('paymentTabs');
        
        categoryTabs.innerHTML = this.categories.map(category => `
            <button type="button" class="tab-btn" data-value="${category}">${category}</button>
        `).join('');
        
        paymentTabs.innerHTML = this.paymentModes.map(mode => `
            <button type="button" class="tab-btn" data-value="${mode}">${mode}</button>
        `).join('');
        
        // Reattach event listeners
        this.setupEventListeners();
    }

    async deleteExpense(date, description) {
        if (confirm('Are you sure you want to delete this expense?')) {
            // Find the expense index
            const index = this.expenses.findIndex(e => 
                e.date === date && e.description === description
            );
            
            if (index !== -1) {
                // Remove from local array
                this.expenses.splice(index, 1);
                
                // Update UI
                this.renderExpensesList();
                this.updateChart();
                
                // Here you would also update the Google Sheet
                // Note: This is a simplified version. In reality, you'd need to implement
                // proper Google Sheets deletion logic
                try {
                    // You'll need to implement the actual Google Sheets deletion logic here
                    console.log('Expense deleted from local storage');
                } catch (error) {
                    console.error('Error deleting expense:', error);
                }
            }
        }
    }

    editExpense(date, description) {
        // Find the expense
        const expense = this.expenses.find(e => 
            e.date === date && e.description === description
        );
        
        if (!expense) return;

        // Pre-fill the form
        document.getElementById('date').value = expense.date;
        document.getElementById('description').value = expense.description;
        document.getElementById('amount').value = expense.amount;
        
        // Set category and payment mode
        this.selectedCategory = expense.category;
        this.selectedPaymentMode = expense.paymentMode;
        
        // Update tab buttons
        document.querySelectorAll('#categoryTabs .tab-btn').forEach(btn => {
            if (btn.dataset.value === expense.category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        document.querySelectorAll('#paymentTabs .tab-btn').forEach(btn => {
            if (btn.dataset.value === expense.paymentMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Store the expense being edited
        this.editingExpense = {
            date,
            description
        };
        
        // Change submit button text
        const submitBtn = document.querySelector('.submit-btn');
        submitBtn.textContent = 'Update Expense';
        
        // Scroll to form
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    }
}

// Initialize the expense tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.expenseTracker = new ExpenseTracker();
}); 