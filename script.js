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
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
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
                <div class="expense-item-amount">$${expense.amount.toFixed(2)}</div>
            </div>
        `).join('');
    }

    initializeChart() {
        const ctx = document.getElementById('expenseChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Expenses',
                    data: [],
                    borderColor: '#4CAF50',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Expense Trend'
                    }
                }
            }
        });
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
            await this.saveToGoogleSheets(expense);
            // Add the new expense to the local array immediately
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
        this.chart.data.labels = filteredExpenses.map(e => new Date(e.date).toLocaleDateString());
        this.chart.data.datasets[0].data = filteredExpenses.map(e => e.amount);
        this.chart.update();
    }

    toggleTheme() {
        if (document.body.classList.contains('dark-mode')) {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
        }
    }
}

// Initialize the expense tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ExpenseTracker();
}); 