const fs = require('fs');
const checks = {
  '01-splash.png': ['index.html', 'My Finance', 'Track', 'Loading your financial world'],
  '02-login.png': ['login.html', 'Welcome Back', 'Email Address', 'Forgot Password', 'Continue with Google'],
  '03-signup.png': ['signup.html', 'Create Account', 'Full Name', 'Phone Number'],
  '04-forgot-password.png': ['forgot-password.html', 'Forgot Password', 'Send Reset Link'],
  '05-home.png': ['dashboard.html', 'Hello', 'Total Salary', 'Total Expenses', 'Total Savings', 'Savings Rate', 'Quick Add'],
  '06-daily-details.png': ['daily-details.html', 'Add Today', 'Mark All as ₹0'],
  '07-income.png': ['income.html', 'Total Income', 'Income Sources', 'Add Income'],
  '08-add-income.png': ['add-income.html', 'Add Income', 'Income Source', 'Amount', 'Payment Method'],
  '09-expenses.png': ['expenses.html', 'Total Expenses', 'Recent Expenses', 'Add Expense'],
  '10-add-expense.png': ['add-expense.html', 'Add Expense', 'Expense Category', 'Payment Method'],
  '11-expense-details.png': ['expense-details.html', 'Expense Details'],
  '12-grocery.jpg': ['grocery.html', 'Grocery', 'Total Spent', 'Add Grocery'],
  '13-room-rent.jpg': ['rent.html', 'Room Rent', 'Total Spent', 'Add Rent Payment'],
  '14-custom-expense.jpg': ['custom-expense.html', 'Add Custom Expense', 'Subcategory', 'Upload Pictures'],
  '15-reports.jpg': ['reports.html', 'Reports - Overview', 'Income', 'Expenses', 'Savings', 'Monthly Trend']
};
let failed = false;
for (const [image, [file, ...needles]] of Object.entries(checks)) {
  if (!fs.existsSync(file)) { console.error(`${image}: missing ${file}`); failed = true; continue; }
  const src = fs.readFileSync(file, 'utf8') + '\n' + fs.readFileSync('js/app.js', 'utf8');
  for (const needle of needles) if (!src.includes(needle)) { console.error(`${image}: ${file} missing expected UI text: ${needle}`); failed = true; }
}
console.log(`Reference workflow validation: ${failed ? 'FAILED' : '15/15 reference workflows mapped'}`);
if (failed) process.exit(1);
