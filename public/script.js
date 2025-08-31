class ChoreRotationApp {
    constructor() {
        this.defaultData = {
            children: [
                { id: 1, name: 'Child 1', canDoChores: [], stars: 0, money: 0 },
                { id: 2, name: 'Child 2', canDoChores: [], stars: 0, money: 0 },
                { id: 3, name: 'Child 3', canDoChores: [], stars: 0, money: 0 }
            ],
            chores: [
                { 
                    id: 1, 
                    name: 'Washing Dishes', 
                    emoji: '🍽️', 
                    color: '#FFB6C1',
                    recurrence: 'daily',
                    customDays: [],
                    eligibleChildren: [],
                    starReward: 1,
                    moneyReward: 0.50
                },
                { 
                    id: 2, 
                    name: 'Sweeping Floor', 
                    emoji: '🧹', 
                    color: '#98FB98',
                    recurrence: 'daily',
                    customDays: [],
                    eligibleChildren: [],
                    starReward: 1,
                    moneyReward: 0.75
                },
                { 
                    id: 3, 
                    name: 'Clearing Table', 
                    emoji: '🪑', 
                    color: '#87CEEB',
                    recurrence: 'daily',
                    customDays: [],
                    eligibleChildren: [],
                    starReward: 1,
                    moneyReward: 0.25
                }
            ],
            completedTasks: {},
            oneOffTasks: {},
            parentSettings: {
                pin: '',
                approvals: {
                    taskMove: false,
                    earlyComplete: false,
                    taskComplete: false,
                    editTasks: false
                }
            }
        };

        this.data = this.loadData();
        this.nextChildId = Math.max(...this.data.children.map(c => c.id), 0) + 1;
        this.nextChoreId = Math.max(...this.data.chores.map(c => c.id), 0) + 1;

        this.initializeApp();
        this.bindEvents();
    }

    loadData() {
        try {
            const savedData = localStorage.getItem('choreRotationData');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                // Ensure all children have canDoChores and eligibleChildren arrays
                parsed.children = parsed.children.map(child => ({
                    ...child,
                    canDoChores: child.canDoChores || [],
                    stars: child.stars || 0,
                    money: child.money || 0
                }));
                parsed.chores = parsed.chores.map(chore => ({
                    ...chore,
                    eligibleChildren: chore.eligibleChildren || [],
                    recurrence: chore.recurrence || 'daily',
                    customDays: chore.customDays || [],
                    starReward: chore.starReward || 1,
                    moneyReward: chore.moneyReward || 0
                }));
                parsed.completedTasks = parsed.completedTasks || {};
                parsed.oneOffTasks = parsed.oneOffTasks || {};
                parsed.parentSettings = parsed.parentSettings || {
                    pin: '',
                    approvals: {
                        taskMove: false,
                        earlyComplete: false,
                        taskComplete: false,
                        editTasks: false
                    }
                };
                return parsed;
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
        return JSON.parse(JSON.stringify(this.defaultData));
    }

    saveData() {
        try {
            localStorage.setItem('choreRotationData', JSON.stringify(this.data));
        } catch (error) {
            console.error('Error saving data:', error);
            this.showMessage('Error saving data', 'error');
        }
    }

    initializeApp() {
        this.updateCurrentDate();
        this.renderTasksView();
        this.renderSettingsChildren();
        this.renderSettingsChores();
    }

    bindEvents() {
        // Settings modal
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const syncBtn = document.getElementById('syncBtn');
        const syncModal = document.getElementById('syncModal');
        
        settingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'block';
            this.renderSettingsChildren();
            this.renderSettingsChores();
        });
        
        syncBtn.addEventListener('click', () => {
            console.log('Opening sync modal, current data:', this.data);
            syncModal.style.display = 'block';
        });

        // Close modal events
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Child management
        document.getElementById('addChildBtn').addEventListener('click', () => this.addChild());
        document.getElementById('newChildName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addChild();
        });

        // Chore management
        document.getElementById('addChoreBtn').addEventListener('click', () => this.addChore());
        document.getElementById('choreRecurrence').addEventListener('change', (e) => {
            const customDays = document.getElementById('customDaysSelector');
            customDays.style.display = e.target.value === 'custom-days' ? 'block' : 'none';
        });

        // Remove tab navigation since we only have tasks now
        
        // Parent settings
        document.getElementById('savePin').addEventListener('click', () => this.saveParentPin());
        this.loadParentSettings();
        
        // Task editing
        document.getElementById('saveTaskBtn').addEventListener('click', () => this.saveTaskEdit());
        document.getElementById('cancelEditBtn').addEventListener('click', () => this.closeTaskEditModal());
        
        // PIN verification
        document.getElementById('submitPin').addEventListener('click', () => this.submitPin());
        document.getElementById('cancelPin').addEventListener('click', () => this.cancelPin());
        
        // One-off tasks
        document.getElementById('saveOneOffTaskBtn').addEventListener('click', () => this.saveOneOffTask());
        document.getElementById('cancelOneOffBtn').addEventListener('click', () => this.closeOneOffTaskModal());

        // Settings actions
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            settingsModal.style.display = 'none';
            this.renderTasksView();
            this.showMessage('Settings saved successfully!', 'success');
        });

        document.getElementById('resetDataBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
                this.data = JSON.parse(JSON.stringify(this.defaultData));
                this.saveData();
                this.renderTasksView();
                this.renderSettingsChildren();
                this.renderSettingsChores();

                this.showMessage('Data reset successfully!', 'success');
            }
        });

        // Sync functionality
        document.getElementById('generateQRBtn').addEventListener('click', () => this.generateQRCode());
        document.getElementById('scanQRBtn').addEventListener('click', () => this.startQRScanner());
        document.getElementById('manualImportBtn').addEventListener('click', () => this.showManualImport());
        document.getElementById('stopScanBtn').addEventListener('click', () => this.stopQRScanner());
        document.getElementById('importDataBtn').addEventListener('click', () => this.importData());
    }

    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('currentDate').textContent = 
            now.toLocaleDateString('en-US', options);
    }

    shouldChoreRunToday(chore) {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        switch (chore.recurrence) {
            case 'daily':
                return true;
            case 'weekly':
                // Run once per week, on the same day as the chore was created
                return dayOfWeek === (chore.id % 7);
            case 'monthly':
                // Run on the first occurrence of the chore's assigned day each month
                const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const targetDay = (chore.id % 7);
                let firstTargetDay = new Date(firstOfMonth);
                firstTargetDay.setDate(firstTargetDay.getDate() + (targetDay - firstTargetDay.getDay() + 7) % 7);
                return today.getDate() === firstTargetDay.getDate();
            case 'weekdays':
                return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
            case 'weekends':
                return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
            case 'custom-days':
                return chore.customDays.includes(dayOfWeek.toString());
            default:
                return true;
        }
    }

    getRecurrenceDescription(chore) {
        switch (chore.recurrence) {
            case 'daily':
                return 'Every day';
            case 'weekly':
                const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return `Weekly on ${weekDays[chore.id % 7]}`;
            case 'monthly':
                return 'Monthly (first occurrence)';
            case 'weekdays':
                return 'Weekdays only';
            case 'weekends':
                return 'Weekends only';
            case 'custom-days':
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const selectedDays = chore.customDays.map(d => dayNames[parseInt(d)]);
                return selectedDays.length > 0 ? selectedDays.join(', ') : 'No days selected';
            default:
                return 'Daily';
        }
    }

    getEligibleChildren(chore) {
        if (chore.eligibleChildren.length === 0) {
            return this.data.children;
        }
        return this.data.children.filter(child => 
            chore.eligibleChildren.includes(child.id.toString())
        );
    }

    assignChoreToChild(chore) {
        const eligibleChildren = this.getEligibleChildren(chore);
        if (eligibleChildren.length === 0) {
            return null;
        }

        // Use date-based rotation to ensure consistency
        const today = new Date();
        const daysSinceEpoch = Math.floor((today - new Date(2023, 0, 1)) / (1000 * 60 * 60 * 24));
        const rotationIndex = (daysSinceEpoch + chore.id) % eligibleChildren.length;
        
        return eligibleChildren[rotationIndex];
    }

    renderTasksView() {
        const childrenColumns = document.getElementById('childrenColumns');
        
        if (this.data.children.length === 0) {
            childrenColumns.innerHTML = `
                <div class="no-children-message">
                    <h3>No children configured</h3>
                    <p>Add children in the settings to start managing chores.</p>
                </div>
            `;
            return;
        }

        // Set data attribute for responsive styling
        childrenColumns.setAttribute('data-child-count', this.data.children.length);
        
        childrenColumns.innerHTML = this.data.children.map(child => {
            const activeTasks = this.getChildTasks(child, true);
            const inactiveTasks = this.getChildTasks(child, false);
            const oneOffTasks = this.getOneOffTasks(child);
            
            return `
                <div class="child-column" data-child-id="${child.id}">
                    <div class="drop-indicator">Drop task here</div>
                    <div class="child-header">
                        <div class="child-name">${child.name}</div>
                        <div class="child-stats">
                            <div class="stat-item">
                                <span>⭐</span>
                                <span>${child.stars || 0}</span>
                            </div>
                            <div class="stat-item">
                                <span>💰</span>
                                <span>$${(child.money || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="tasks-list">
                        <div class="tasks-section">
                            <div class="section-title">
                                Today's Tasks 
                                <button class="add-task-btn" onclick="window.app.showOneOffTaskModal(${child.id})">+ Task</button>
                            </div>
                            ${activeTasks.map(task => this.renderTaskItem(child, task, 'active')).join('')}
                            ${oneOffTasks.map(task => this.renderTaskItem(child, task, 'one-off')).join('')}
                            ${activeTasks.length === 0 && oneOffTasks.length === 0 ? '<div class="empty-state">No tasks for today</div>' : ''}
                        </div>
                        ${inactiveTasks.length > 0 ? `
                        <div class="tasks-section inactive-tasks">
                            <div class="section-title">Upcoming Tasks</div>
                            ${inactiveTasks.map(task => this.renderTaskItem(child, task, 'inactive')).join('')}
                        </div>
                        ` : ''}
                    </div>
                    <div class="payment-controls">
                        <button class="payment-btn" onclick="window.app.payChild(${child.id})">
                            💰 Pay $${(child.money || 0).toFixed(2)}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update scroll indicators
        this.updateScrollIndicators();
        
        // Initialize drag and drop
        this.initializeDragAndDrop();
    }

    getChildTasks(child, activeOnly = true) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        return this.data.chores
            .filter(chore => activeOnly ? this.shouldChoreRunToday(chore) : !this.shouldChoreRunToday(chore))
            .filter(chore => this.getEligibleChildren(chore).includes(child))
            .map(chore => {
                const assignedChild = this.assignChoreToChild(chore);
                if (assignedChild && assignedChild.id === child.id) {
                    const taskKey = `${child.id}-${chore.id}-${todayStr}`;
                    const isCompleted = this.data.completedTasks[taskKey] || false;
                    
                    return {
                        ...chore,
                        isCompleted,
                        taskKey,
                        type: 'regular'
                    };
                }
                return null;
            })
            .filter(task => task !== null);
    }

    getOneOffTasks(child) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const oneOffTasks = this.data.oneOffTasks[todayStr] || [];
        
        return oneOffTasks.filter(task => {
            if (task.assignedTo && task.assignedTo !== child.id) return false;
            if (task.type === 'first-come' && task.completed) return false;
            if (task.type === 'all-children') {
                const taskKey = `${child.id}-oneoff-${task.id}-${todayStr}`;
                return !this.data.completedTasks[taskKey];
            }
            return true;
        }).map(task => ({
            ...task,
            taskKey: `${child.id}-oneoff-${task.id}-${todayStr}`,
            type: 'one-off'
        }));
    }

    renderTaskItem(child, task, status = 'active') {
        const isInactive = status === 'inactive';
        const isDraggable = !task.isCompleted && !isInactive;
        
        return `
            <div class="task-item ${task.isCompleted ? 'completed' : ''} ${isInactive ? 'inactive' : ''}" 
                 style="border-color: ${task.color}" 
                 ${isDraggable ? `draggable="true" ondragstart="window.app.handleDragStart(event)" data-task-id="${task.id}" data-task-key="${task.taskKey}" data-task-type="${task.type}"` : ''}>
                ${isDraggable ? '<span class="drag-handle">⋮⋮</span>' : ''}
                <div class="task-info">
                    <span class="task-emoji">${task.emoji}</span>
                    <div class="task-details">
                        <div class="task-name">${task.name}</div>
                        <div class="task-reward">
                            <span>⭐ ${task.starReward || 1}</span>
                            <span>💰 $${(task.moneyReward || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    ${!isInactive ? `
                        <button class="complete-btn" 
                                onclick="window.app.completeTask('${task.taskKey}', ${child.id}, ${task.id}, '${status}')"
                                ${task.isCompleted ? 'disabled' : ''}>
                            ${task.isCompleted ? '✓ Done' : 'Complete'}
                        </button>
                    ` : ''}
                    ${task.type !== 'one-off' ? `
                        <button class="edit-btn" onclick="window.app.editTask(${task.id})" title="Edit task">✏️</button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderSettingsChildren() {
        const childrenList = document.getElementById('childrenList');
        childrenList.innerHTML = this.data.children.map(child => `
            <div class="child-item">
                <div class="child-info">
                    <span class="child-name">${child.name}</span>
                </div>
                <div class="child-actions">
                    <button class="btn btn-small btn-secondary" onclick="app.editChild(${child.id})">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="app.deleteChild(${child.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    renderSettingsChores() {
        const choresList = document.getElementById('choresList');
        choresList.innerHTML = this.data.chores.map(chore => `
            <div class="chore-item" style="border-left: 4px solid ${chore.color}">
                <div class="chore-info">
                    <span style="font-size: 1.5rem; margin-right: 10px;">${chore.emoji}</span>
                    <div class="chore-details">
                        <span class="chore-name">${chore.name}</span>
                        <span class="chore-schedule-info">${this.getRecurrenceDescription(chore)}</span>
                        <span class="chore-schedule-info">
                            Eligible: ${this.getEligibleChildren(chore).map(c => c.name).join(', ') || 'All children'}
                        </span>
                    </div>
                </div>
                <div class="chore-actions">
                    <button class="btn btn-small btn-secondary" onclick="app.editChore(${chore.id})">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="app.deleteChore(${chore.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    addChild() {
        const nameInput = document.getElementById('newChildName');
        const name = nameInput.value.trim();
        
        if (!name) {
            this.showMessage('Please enter a child name', 'error');
            return;
        }

        if (this.data.children.some(child => child.name === name)) {
            this.showMessage('A child with this name already exists', 'error');
            return;
        }

        this.data.children.push({
            id: this.nextChildId++,
            name: name,
            canDoChores: []
        });

        nameInput.value = '';
        this.saveData();
        this.renderSettingsChildren();
        this.showMessage('Child added successfully!', 'success');
    }

    deleteChild(childId) {
        if (confirm('Are you sure you want to delete this child?')) {
            this.data.children = this.data.children.filter(child => child.id !== childId);
            // Remove child from all chore eligibility lists
            this.data.chores.forEach(chore => {
                chore.eligibleChildren = chore.eligibleChildren.filter(id => id !== childId.toString());
            });
            this.saveData();
            this.renderSettingsChildren();
            this.renderSettingsChores();
            this.showMessage('Child deleted successfully!', 'success');
        }
    }

    editChild(childId) {
        const child = this.data.children.find(c => c.id === childId);
        if (!child) return;

        const newName = prompt('Enter new name:', child.name);
        if (newName && newName.trim() && newName !== child.name) {
            if (this.data.children.some(c => c.name === newName.trim() && c.id !== childId)) {
                this.showMessage('A child with this name already exists', 'error');
                return;
            }
            child.name = newName.trim();
            this.saveData();
            this.renderSettingsChildren();
            this.showMessage('Child updated successfully!', 'success');
        }
    }

    addChore() {
        const nameInput = document.getElementById('newChoreName');
        const emojiInput = document.getElementById('newChoreEmoji');
        const colorInput = document.getElementById('newChoreColor');
        const starsInput = document.getElementById('newChoreStars');
        const moneyInput = document.getElementById('newChoreMoney');
        const recurrenceSelect = document.getElementById('choreRecurrence');
        
        const name = nameInput.value.trim();
        const emoji = emojiInput.value.trim() || '📝';
        const color = colorInput.value;
        const starReward = parseInt(starsInput.value) || 1;
        const moneyReward = parseFloat(moneyInput.value) || 0;
        const recurrence = recurrenceSelect.value;
        
        if (!name) {
            this.showMessage('Please enter a chore name', 'error');
            return;
        }

        if (this.data.chores.some(chore => chore.name === name)) {
            this.showMessage('A chore with this name already exists', 'error');
            return;
        }

        let customDays = [];
        if (recurrence === 'custom-days') {
            const checkboxes = document.querySelectorAll('#customDaysSelector input[type="checkbox"]:checked');
            customDays = Array.from(checkboxes).map(cb => cb.value);
            if (customDays.length === 0) {
                this.showMessage('Please select at least one day for custom schedule', 'error');
                return;
            }
        }

        this.data.chores.push({
            id: this.nextChoreId++,
            name: name,
            emoji: emoji,
            color: color,
            recurrence: recurrence,
            customDays: customDays,
            eligibleChildren: [],
            starReward: starReward,
            moneyReward: moneyReward
        });

        // Clear form
        nameInput.value = '';
        emojiInput.value = '';
        colorInput.value = '#FFB6C1';
        starsInput.value = '1';
        moneyInput.value = '0.50';
        recurrenceSelect.value = 'daily';
        document.getElementById('customDaysSelector').style.display = 'none';
        document.querySelectorAll('#customDaysSelector input[type="checkbox"]').forEach(cb => cb.checked = false);

        this.saveData();
        this.renderSettingsChores();
        this.showMessage('Chore added successfully!', 'success');
    }

    deleteChore(choreId) {
        if (confirm('Are you sure you want to delete this chore?')) {
            this.data.chores = this.data.chores.filter(chore => chore.id !== choreId);
            this.saveData();
            this.renderSettingsChores();
            this.showMessage('Chore deleted successfully!', 'success');
        }
    }

    editChore(choreId) {
        // For simplicity, we'll just allow editing the name for now
        const chore = this.data.chores.find(c => c.id === choreId);
        if (!chore) return;

        const newName = prompt('Enter new chore name:', chore.name);
        if (newName && newName.trim() && newName !== chore.name) {
            if (this.data.chores.some(c => c.name === newName.trim() && c.id !== choreId)) {
                this.showMessage('A chore with this name already exists', 'error');
                return;
            }
            chore.name = newName.trim();
            this.saveData();
            this.renderSettingsChores();
            this.showMessage('Chore updated successfully!', 'success');
        }
    }

    generateQRCode() {
        const container = document.getElementById('qrCodeContainer');
        console.log('Starting QR code generation...');
        
        container.innerHTML = '<p>Generating QR code...</p>';
        
        try {
            // Create a simplified copy of data without problematic Unicode
            const sanitizedData = {
                children: this.data.children.map(child => ({
                    id: child.id,
                    name: child.name,
                    canDoChores: child.canDoChores || []
                })),
                chores: this.data.chores.map(chore => ({
                    id: chore.id,
                    name: chore.name,
                    emoji: chore.emoji || '📝',
                    color: chore.color,
                    recurrence: chore.recurrence,
                    customDays: chore.customDays || [],
                    eligibleChildren: chore.eligibleChildren || []
                }))
            };
            
            console.log('Sanitized data:', sanitizedData);
            
            // Convert to JSON string
            const jsonString = JSON.stringify(sanitizedData);
            console.log('JSON string length:', jsonString.length);
            
            // Use URL encoding instead of hex to preserve Unicode properly
            const encodedString = encodeURIComponent(jsonString);
            const configData = btoa(encodedString);
            console.log('Successfully encoded config data');
            
            // Check if QR code library is available
            if (typeof qrcode !== 'undefined') {
                try {
                    const qr = qrcode(0, 'M');
                    qr.addData(configData);
                    qr.make();
                    
                    const moduleCount = qr.getModuleCount();
                    const maxSize = 256; // Maximum QR code size
                    const qrSize = Math.floor(maxSize / moduleCount);
                    const totalSize = moduleCount * qrSize;
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = totalSize;
                    canvas.height = totalSize;
                    const ctx = canvas.getContext('2d');
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, totalSize, totalSize);
                    ctx.fillStyle = '#000000';
                    
                    for (let row = 0; row < moduleCount; row++) {
                        for (let col = 0; col < moduleCount; col++) {
                            if (qr.isDark(row, col)) {
                                ctx.fillRect(col * qrSize, row * qrSize, qrSize, qrSize);
                            }
                        }
                    }
                    
                    container.innerHTML = '';
                    canvas.style.maxWidth = '100%';
                    canvas.style.height = 'auto';
                    canvas.style.border = '1px solid #e2e8f0';
                    // Remove border radius for QR codes to ensure clean scanning
                    canvas.style.borderRadius = '0px';
                    container.appendChild(canvas);
                    
                    // Add copy button for the raw data
                    const copyBtn = document.createElement('button');
                    copyBtn.textContent = 'Copy Config Data';
                    copyBtn.className = 'btn btn-secondary';
                    copyBtn.style.marginTop = '10px';
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(configData).then(() => {
                            this.showMessage('Configuration copied to clipboard!', 'success');
                        }).catch(() => {
                            this.showMessage('Could not copy to clipboard, please select and copy manually', 'error');
                        });
                    };
                    container.appendChild(copyBtn);
                    
                } catch (error) {
                    console.error('QR code generation error:', error);
                    this.showFallbackQR(container, configData);
                }
            } else {
                console.log('QR code library not available, showing fallback');
                this.showFallbackQR(container, configData);
            }
            
        } catch (error) {
            console.error('QR generation failed:', error);
            this.showFallbackQR(container, JSON.stringify(this.data));
        }
    }

    showFallbackQR(container, configData) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p><strong>QR Code generation not available</strong></p>
                <p>Copy this configuration data to share with other devices:</p>
                <textarea readonly style="width: 100%; height: 100px; margin: 10px 0; font-family: monospace; font-size: 12px;">${configData}</textarea>
                <button class="btn btn-secondary" onclick="navigator.clipboard.writeText(\`${configData.replace(/`/g, '\\`')}\`).then(() => app.showMessage('Configuration copied!', 'success')).catch(() => app.showMessage('Please copy manually', 'error'))">Copy Configuration</button>
            </div>
        `;
    }

    startQRScanner() {
        const scannerContainer = document.getElementById('qrScannerContainer');
        const manualContainer = document.getElementById('manualImportContainer');
        const video = document.getElementById('qrVideo');
        
        console.log('Starting QR scanner...');
        manualContainer.style.display = 'none';
        scannerContainer.style.display = 'block';
        
        // Check if jsQR is available
        if (typeof jsQR === 'undefined') {
            console.error('jsQR library not loaded');
            this.showMessage('QR scanning library not available. Please use manual import.', 'error');
            this.showManualImport();
            return;
        }
        
        // Request camera access with better constraints
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                console.log('Camera access granted');
                video.srcObject = stream;
                this.videoStream = stream;
                
                video.addEventListener('loadedmetadata', () => {
                    console.log('Video metadata loaded, starting detection');
                    this.startQRDetection();
                });
            })
            .catch(error => {
                console.error('Camera access failed:', error);
                this.showMessage('Camera access required for QR scanning. Please use manual import instead.', 'error');
                this.showManualImport();
            });
    }

    stopQRScanner() {
        const scannerContainer = document.getElementById('qrScannerContainer');
        
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        if (this.scanningInterval) {
            clearInterval(this.scanningInterval);
            this.scanningInterval = null;
        }
        
        scannerContainer.style.display = 'none';
    }

    showManualImport() {
        const scannerContainer = document.getElementById('qrScannerContainer');
        const manualContainer = document.getElementById('manualImportContainer');
        
        this.stopQRScanner();
        scannerContainer.style.display = 'none';
        manualContainer.style.display = 'block';
    }

    startQRDetection() {
        const video = document.getElementById('qrVideo');
        const canvas = document.getElementById('qrCanvas');
        const ctx = canvas.getContext('2d');
        
        console.log('Starting QR detection...');
        
        this.scanningInterval = setInterval(() => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                console.log('Scanning frame:', canvas.width, 'x', canvas.height);
                
                const qrResult = this.detectQRCode(imageData);
                
                if (qrResult) {
                    console.log('QR Code detected:', qrResult);
                    this.processScannedQR(qrResult);
                }
            } else {
                console.log('Video not ready, state:', video.readyState);
            }
        }, 500); // Scan every 500ms
    }

    detectQRCode(imageData) {
        try {
            // Use jsQR library for proper QR code detection
            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "attemptBoth",
                });
                
                if (code) {
                    console.log('QR Code found:', code.data);
                    return code.data;
                }
            } else {
                console.log('jsQR library not available');
                // Check if the jsQR script loaded properly
                console.log('Available global objects:', Object.keys(window).filter(k => k.toLowerCase().includes('qr')));
            }
            return null;
        } catch (error) {
            console.error('QR detection error:', error);
            return null;
        }
    }

    processScannedQR(qrData) {
        this.stopQRScanner();
        
        try {
            // Process the scanned QR data
            const importTextarea = document.getElementById('importData');
            importTextarea.value = qrData;
            this.importData();
            this.showMessage('QR code scanned successfully!', 'success');
        } catch (error) {
            console.error('Error processing scanned QR:', error);
            this.showMessage('Failed to process QR code data', 'error');
            this.showManualImport();
        }
    }

    importData() {
        const importTextarea = document.getElementById('importData');
        const configData = importTextarea.value.trim();
        
        if (!configData) {
            this.showMessage('Please paste configuration data', 'error');
            return;
        }

        try {
            let parsedData;
            try {
                // Try to parse as base64 first (from QR code) - handle URL decoding
                console.log('Attempting to decode config data...');
                const encodedString = atob(configData);
                console.log('Decoded string length:', encodedString.length);
                
                // Decode the URL-encoded string
                const jsonString = decodeURIComponent(encodedString);
                console.log('URL decoded string length:', jsonString.length);
                
                parsedData = JSON.parse(jsonString);
                console.log('Successfully parsed imported data');
            } catch (error) {
                console.log('URL decoding failed, trying direct JSON parsing:', error);
                // If that fails, try direct JSON parsing
                parsedData = JSON.parse(configData);
            }

            // Validate the structure
            if (!parsedData.children || !parsedData.chores || !Array.isArray(parsedData.children) || !Array.isArray(parsedData.chores)) {
                throw new Error('Invalid configuration format');
            }

            // Update IDs to avoid conflicts
            const maxChildId = Math.max(...this.data.children.map(c => c.id), 0);
            const maxChoreId = Math.max(...this.data.chores.map(c => c.id), 0);
            
            parsedData.children = parsedData.children.map((child, index) => ({
                ...child,
                id: maxChildId + index + 1,
                canDoChores: child.canDoChores || []
            }));
            
            parsedData.chores = parsedData.chores.map((chore, index) => ({
                ...chore,
                id: maxChoreId + index + 1,
                eligibleChildren: chore.eligibleChildren || [],
                recurrence: chore.recurrence || 'daily',
                customDays: chore.customDays || []
            }));

            this.data = parsedData;
            this.nextChildId = Math.max(...this.data.children.map(c => c.id), 0) + 1;
            this.nextChoreId = Math.max(...this.data.chores.map(c => c.id), 0) + 1;
            
            this.saveData();
            this.renderChores();
            this.renderSettingsChildren();
            this.renderSettingsChores();
            
            importTextarea.value = '';
            document.getElementById('syncModal').style.display = 'none';
            this.showMessage('Configuration imported successfully!', 'success');
            
        } catch (error) {
            console.error('Import error:', error);
            this.showMessage('Error importing configuration. Please check the data format.', 'error');
        }
    }



    payChild(childId) {
        const child = this.data.children.find(c => c.id === childId);
        if (!child) return;
        
        if (child.money <= 0) {
            this.showMessage(`${child.name} has no money to pay out.`, 'error');
            return;
        }
        
        if (confirm(`Pay ${child.name} $${child.money.toFixed(2)}?`)) {
            child.money = 0;
            this.saveData();
            this.renderTasksView();
            this.showMessage(`Paid ${child.name} successfully!`, 'success');
        }
    }





    updateScrollIndicators() {
        const childrenGrid = document.getElementById('childrenColumns');
        if (!childrenGrid) return;
        
        const isScrollable = childrenGrid.scrollWidth > childrenGrid.clientWidth;
        const isAtStart = childrenGrid.scrollLeft <= 5;
        const isAtEnd = childrenGrid.scrollLeft >= childrenGrid.scrollWidth - childrenGrid.clientWidth - 5;
        
        childrenGrid.classList.toggle('scrollable-left', isScrollable && !isAtStart);
        childrenGrid.classList.toggle('scrollable-right', isScrollable && !isAtEnd);
        
        // Add scroll event listener if not already added
        if (!childrenGrid.hasScrollListener) {
            childrenGrid.addEventListener('scroll', () => this.updateScrollIndicators());
            childrenGrid.hasScrollListener = true;
        }
    }

    // Drag and drop functionality
    initializeDragAndDrop() {
        const childColumns = document.querySelectorAll('.child-column');
        childColumns.forEach(column => {
            column.addEventListener('dragover', (e) => this.handleDragOver(e));
            column.addEventListener('drop', (e) => this.handleDrop(e));
            column.addEventListener('dragleave', (e) => {
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('drag-over');
                }
            });
        });
    }

    handleDragStart(e) {
        e.dataTransfer.setData('text/plain', '');
        e.target.classList.add('dragging');
        this.draggedTask = {
            taskId: e.target.dataset.taskId,
            taskKey: e.target.dataset.taskKey,
            taskType: e.target.dataset.taskType,
            sourceChild: parseInt(e.target.closest('.child-column').dataset.childId)
        };
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const targetChildId = parseInt(e.currentTarget.dataset.childId);
        
        if (this.draggedTask && targetChildId !== this.draggedTask.sourceChild) {
            this.moveTask(this.draggedTask, targetChildId);
        }
        
        // Clean up
        document.querySelectorAll('.task-item.dragging').forEach(item => {
            item.classList.remove('dragging');
        });
        document.querySelectorAll('.child-column').forEach(column => {
            column.classList.remove('drag-over');
        });
        this.draggedTask = null;
    }

    async moveTask(draggedTask, targetChildId) {
        const needsApproval = this.data.parentSettings.approvals.taskMove;
        
        if (needsApproval && !(await this.requestParentApproval('Moving task between children'))) {
            return;
        }

        // Move the task assignment
        const today = new Date().toISOString().split('T')[0];
        const newTaskKey = `${targetChildId}-${draggedTask.taskId}-${today}`;
        
        if (draggedTask.taskType === 'one-off') {
            // Update one-off task assignment
            const oneOffTasks = this.data.oneOffTasks[today] || [];
            const taskIndex = oneOffTasks.findIndex(t => t.id == draggedTask.taskId);
            if (taskIndex >= 0) {
                oneOffTasks[taskIndex].assignedTo = targetChildId;
            }
        } else {
            // For regular tasks, we need to modify the assignment logic
            // This is a simplification - in a real app you'd handle rotation better
            this.data.completedTasks[newTaskKey] = false;
            delete this.data.completedTasks[draggedTask.taskKey];
        }

        this.saveData();
        this.renderTasksView();
        this.showMessage('Task moved successfully!', 'success');
    }

    // Parent PIN and approval system
    async requestParentApproval(action) {
        return new Promise((resolve) => {
            this.pinResolver = resolve;
            document.getElementById('pinRequestMessage').textContent = 
                `Parent approval required: ${action}. Enter PIN to continue:`;
            document.getElementById('pinModal').style.display = 'block';
            document.getElementById('pinEntry').focus();
        });
    }

    submitPin() {
        const enteredPin = document.getElementById('pinEntry').value;
        const correctPin = this.data.parentSettings.pin;
        
        if (enteredPin === correctPin && correctPin.length === 4) {
            document.getElementById('pinModal').style.display = 'none';
            document.getElementById('pinEntry').value = '';
            if (this.pinResolver) this.pinResolver(true);
        } else {
            this.showMessage('Incorrect PIN. Try again.', 'error');
            document.getElementById('pinEntry').value = '';
        }
    }

    cancelPin() {
        document.getElementById('pinModal').style.display = 'none';
        document.getElementById('pinEntry').value = '';
        if (this.pinResolver) this.pinResolver(false);
    }

    saveParentPin() {
        const currentPin = document.getElementById('currentPin').value;
        const newPin = document.getElementById('newPin').value;
        const confirmPin = document.getElementById('confirmPin').value;
        const existingPin = this.data.parentSettings.pin;
        
        // If PIN exists, require current PIN
        if (existingPin && existingPin.length === 4 && currentPin !== existingPin) {
            this.showMessage('Current PIN is incorrect', 'error');
            return;
        }
        
        // Validate new PIN
        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
            this.showMessage('New PIN must be exactly 4 digits', 'error');
            return;
        }
        
        // Confirm PIN match
        if (newPin !== confirmPin) {
            this.showMessage('New PIN and confirmation do not match', 'error');
            return;
        }
        
        // Update PIN and approvals
        this.data.parentSettings.pin = newPin;
        this.data.parentSettings.approvals = {
            taskMove: document.getElementById('approveTaskMove').checked,
            earlyComplete: document.getElementById('approveEarlyComplete').checked,
            taskComplete: document.getElementById('approveTaskComplete').checked,
            editTasks: document.getElementById('approveEditTasks').checked
        };
        
        this.saveData();
        this.showMessage('Parent PIN updated successfully!', 'success');
        
        // Clear form
        document.getElementById('currentPin').value = '';
        document.getElementById('newPin').value = '';
        document.getElementById('confirmPin').value = '';
    }

    loadParentSettings() {
        const settings = this.data.parentSettings;
        document.getElementById('approveTaskMove').checked = settings.approvals.taskMove;
        document.getElementById('approveEarlyComplete').checked = settings.approvals.earlyComplete;
        document.getElementById('approveTaskComplete').checked = settings.approvals.taskComplete;
        document.getElementById('approveEditTasks').checked = settings.approvals.editTasks;
    }

    // Task editing
    editTask(taskId) {
        const task = this.data.chores.find(c => c.id == taskId);
        if (!task) return;

        document.getElementById('editTaskId').value = taskId;
        document.getElementById('editTaskName').value = task.name;
        document.getElementById('editTaskEmoji').value = task.emoji;
        document.getElementById('editTaskColor').value = task.color;
        document.getElementById('editTaskStars').value = task.starReward;
        document.getElementById('editTaskMoney').value = task.moneyReward;
        document.getElementById('editTaskRecurrence').value = task.recurrence;
        
        document.getElementById('taskEditModal').style.display = 'block';
    }

    async saveTaskEdit() {
        const needsApproval = this.data.parentSettings.approvals.editTasks;
        
        if (needsApproval && !(await this.requestParentApproval('Editing task'))) {
            return;
        }

        const taskId = parseInt(document.getElementById('editTaskId').value);
        const task = this.data.chores.find(c => c.id === taskId);
        
        if (task) {
            task.name = document.getElementById('editTaskName').value;
            task.emoji = document.getElementById('editTaskEmoji').value;
            task.color = document.getElementById('editTaskColor').value;
            task.starReward = parseInt(document.getElementById('editTaskStars').value);
            task.moneyReward = parseFloat(document.getElementById('editTaskMoney').value);
            task.recurrence = document.getElementById('editTaskRecurrence').value;
            
            this.saveData();
            this.renderTasksView();
            this.renderSettingsChores();
            this.closeTaskEditModal();
            this.showMessage('Task updated successfully!', 'success');
        }
    }

    closeTaskEditModal() {
        document.getElementById('taskEditModal').style.display = 'none';
    }

    // One-off tasks
    showOneOffTaskModal(childId = null) {
        document.getElementById('oneOffTaskDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('oneOffTaskModal').style.display = 'block';
        this.currentOneOffChildId = childId;
    }

    saveOneOffTask() {
        const name = document.getElementById('oneOffTaskName').value.trim();
        const emoji = document.getElementById('oneOffTaskEmoji').value.trim() || '📝';
        const color = document.getElementById('oneOffTaskColor').value;
        const stars = parseInt(document.getElementById('oneOffTaskStars').value) || 1;
        const money = parseFloat(document.getElementById('oneOffTaskMoney').value) || 0;
        const date = document.getElementById('oneOffTaskDate').value;
        const type = document.getElementById('oneOffTaskType').value;

        if (!name || !date) {
            this.showMessage('Please fill in task name and date', 'error');
            return;
        }

        const taskId = Date.now(); // Simple ID generation
        const oneOffTask = {
            id: taskId,
            name,
            emoji,
            color,
            starReward: stars,
            moneyReward: money,
            type,
            assignedTo: type === 'any-child' ? this.currentOneOffChildId : null,
            completed: false
        };

        if (!this.data.oneOffTasks[date]) {
            this.data.oneOffTasks[date] = [];
        }
        this.data.oneOffTasks[date].push(oneOffTask);

        this.saveData();
        this.renderTasksView();
        this.closeOneOffTaskModal();
        this.showMessage('One-off task added!', 'success');
    }

    closeOneOffTaskModal() {
        document.getElementById('oneOffTaskModal').style.display = 'none';
        // Clear form
        document.getElementById('oneOffTaskName').value = '';
        document.getElementById('oneOffTaskEmoji').value = '';
        document.getElementById('oneOffTaskColor').value = '#FFB6C1';
        document.getElementById('oneOffTaskStars').value = '1';
        document.getElementById('oneOffTaskMoney').value = '0.50';
    }

    async completeTask(taskKey, childId, taskId, status = 'active') {
        const child = this.data.children.find(c => c.id === childId);
        const isEarly = status === 'inactive';
        const needsCompleteApproval = this.data.parentSettings.approvals.taskComplete;
        const needsEarlyApproval = isEarly && this.data.parentSettings.approvals.earlyComplete;
        
        if ((needsCompleteApproval || needsEarlyApproval) && 
            !(await this.requestParentApproval(isEarly ? 'Completing task early' : 'Completing task'))) {
            return;
        }

        let task = this.data.chores.find(c => c.id === taskId);
        
        // Handle one-off tasks
        if (taskKey.includes('oneoff')) {
            const today = new Date().toISOString().split('T')[0];
            const oneOffTasks = this.data.oneOffTasks[today] || [];
            task = oneOffTasks.find(t => t.id == taskId);
        }
        
        if (!child || !task) return;
        
        // Mark task as completed
        this.data.completedTasks[taskKey] = true;
        
        // Award stars and money
        child.stars = (child.stars || 0) + (task.starReward || 1);
        child.money = (child.money || 0) + (task.moneyReward || 0);
        
        // Handle one-off task completion
        if (taskKey.includes('oneoff')) {
            const today = new Date().toISOString().split('T')[0];
            const oneOffTasks = this.data.oneOffTasks[today] || [];
            const taskIndex = oneOffTasks.findIndex(t => t.id == taskId);
            if (taskIndex >= 0 && oneOffTasks[taskIndex].type === 'first-come') {
                oneOffTasks[taskIndex].completed = true;
            }
        }
        
        this.saveData();
        this.renderTasksView();
        this.showMessage(`${child.name} completed ${task.name}! Earned ${task.starReward || 1} star(s) and $${(task.moneyReward || 0).toFixed(2)}`, 'success');
    }

    showMessage(message, type = 'info') {
        // Remove any existing messages
        const existingMessage = document.querySelector('.error-message, .success-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
        messageDiv.textContent = message;
        
        // Insert at top of container
        const container = document.querySelector('.container');
        container.insertBefore(messageDiv, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Initialize app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChoreRotationApp();
});