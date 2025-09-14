# 🏠 Family Chores Rotation App

A comprehensive family chore management system built with Next.js that automatically rotates tasks between children and tracks rewards.

## Features

### 📋 Core Functionality
- **Automatic Task Rotation**: Chores are automatically assigned to children using a date-based rotation algorithm
- **Reward System**: Track stars and money earned for completed tasks
- **Smart Scheduling**: Support for daily, weekly, monthly, weekdays, weekends, and custom day patterns
- **Task Completion**: Mark tasks complete to earn rewards and update child statistics
- **Payment System**: Pay out accumulated money rewards to children

### 👥 Family Management
- **Children Management**: Add, edit, and delete children with individual reward tracking
- **Chore Templates**: Create reusable chore templates with custom emojis, colors, and rewards
- **One-off Tasks**: Add special tasks for specific dates (any child, first-come, or all children)

### ⚙️ Advanced Features
- **Parent Controls**: PIN-protected settings and approval workflows
- **Data Persistence**: All data saved locally in browser storage
- **Responsive Design**: Works on desktop and mobile devices
- **Export/Import**: Sync data between devices using QR codes

## Getting Started

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

### Production Build
```bash
npm run build
npm run export
```

### GitHub Pages Deployment
This app is configured as a static site that can be deployed to GitHub Pages:

1. Push your code to a GitHub repository
2. Go to repository Settings > Pages
3. Set source to "GitHub Actions"
4. The app will be available at `https://yourusername.github.io/family-chores/`

The app is pre-configured with:
- Static export enabled
- Base path set to `/family-chores`
- All assets properly configured for GitHub Pages

## How to Use

1. **Add Children**: Click "+ Add Child" to add family members
2. **Create Chores**: Click "+ Add Chore" to create recurring tasks
3. **View Daily Tasks**: Each child's column shows their assigned tasks for today
4. **Complete Tasks**: Click "Complete" to mark tasks done and earn rewards
5. **Pay Rewards**: Use the "Pay" button to reset a child's money balance
6. **Manage Settings**: Click the settings gear to configure chores, children, and parent controls

## Task Assignment Logic

- Tasks are automatically assigned using a consistent rotation algorithm
- Assignment is based on the current date and chore ID for fairness
- Only eligible children (or all children if none specified) receive assignments
- Completed tasks are tracked daily to prevent duplicate completions

## Scheduling Options

- **Daily**: Task appears every day
- **Weekly**: Task appears once per week on a consistent day
- **Monthly**: Task appears once per month
- **Weekdays**: Monday through Friday only
- **Weekends**: Saturday and Sunday only
- **Custom Days**: Select specific days of the week

## Data Storage

All data is stored locally in your browser's localStorage. Use the sync feature to share configurations between devices.
