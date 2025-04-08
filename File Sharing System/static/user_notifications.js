// Notification System for User Dashboard
let notificationCheckInterval = null;
let notificationList = null;
let notificationBtn = null;
let notificationPanel = null;
let notificationBadge = null;
let unreadCount = 0;

// Initialize the notification system
function initNotifications() {
    console.log('Initializing notification system...');
    
    // Create the notification UI elements if they don't exist
    createNotificationUIElements();
    
    // Get references to DOM elements
    notificationBtn = document.getElementById('notificationBtn');
    notificationPanel = document.getElementById('notificationPanel');
    notificationList = document.getElementById('notificationList');
    notificationBadge = document.getElementById('notificationBadge');
    
    // Set up event listeners
    if (notificationBtn) {
        notificationBtn.addEventListener('click', toggleNotificationPanel);
        console.log('Notification button event listener added');
    } else {
        console.error('Notification button not found in DOM');
    }
    
    const closeNotificationsBtn = document.getElementById('closeNotifications');
    if (closeNotificationsBtn) {
        closeNotificationsBtn.addEventListener('click', closeNotificationPanel);
    }
    
    const markAllReadBtn = document.getElementById('markAllRead');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }
    
    // Add notification styles
    addNotificationStyles();
    
    // Start checking for new notifications
    startNotificationChecking();
    
    console.log('Notification system initialized successfully');
}

// Create the notification UI elements
function createNotificationUIElements() {
    // Skip if elements already exist
    if (document.getElementById('notificationBtn') && document.getElementById('notificationPanel')) {
        console.log('Notification elements already exist');
        return;
    }
    
    console.log('Creating notification UI elements...');
    
    // Create notification button if it doesn't exist
    if (!document.getElementById('notificationBtn')) {
        // Look for user actions container
        const userActions = document.querySelector('.user-actions');
        
        if (userActions) {
            // Create notification button
            const notificationButton = document.createElement('button');
            notificationButton.id = 'notificationBtn';
            notificationButton.className = 'notification-btn';
            notificationButton.innerHTML = '<i class="fas fa-bell"></i>';
            
            // Create notification badge
            const badge = document.createElement('span');
            badge.id = 'notificationBadge';
            badge.className = 'notification-badge';
            badge.style.display = 'none';
            badge.textContent = '0';
            
            // Add badge to button
            notificationButton.appendChild(badge);
            
            // Insert before the upload button (which is usually the last element)
            userActions.insertBefore(notificationButton, userActions.firstChild);
            
            console.log('Notification button created and added to DOM');
        } else {
            console.error('User actions container not found');
        }
    }
    
    // Create notification panel if it doesn't exist
    if (!document.getElementById('notificationPanel')) {
        const panel = document.createElement('div');
        panel.id = 'notificationPanel';
        panel.className = 'notification-panel';
        
        panel.innerHTML = `
            <div class="notification-header">
                <h3>Notifications</h3>
                <button id="closeNotifications" class="close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-list" id="notificationList">
                <!-- Notifications will be populated by JavaScript -->
                <div class="notification-loading">Loading notifications...</div>
            </div>
            <div class="notification-footer">
                <button id="markAllRead" class="btn secondary">Mark All as Read</button>
            </div>
        `;
        
        // Add to body
        document.body.appendChild(panel);
        
        console.log('Notification panel created and added to DOM');
    }
}

// Toggle notification panel visibility
function toggleNotificationPanel(e) {
    if (e) {
        e.stopPropagation(); // Prevent event from bubbling up
    }
    
    if (notificationPanel) {
        notificationPanel.classList.toggle('visible');
        
        // When opening panel, fetch notifications
        if (notificationPanel.classList.contains('visible')) {
            fetchNotifications();
            
            // Hide the notification badge when panel is opened
            if (notificationBadge) {
                notificationBadge.style.display = 'none';
                notificationBadge.textContent = '0';
                unreadCount = 0;
                
                // Remove the glow effect when opened
                if (notificationBtn) {
                    notificationBtn.classList.remove('has-notifications');
                }
            }
        }
    }
}

// Close notification panel
function closeNotificationPanel(e) {
    if (e) {
        e.stopPropagation(); // Prevent event from bubbling up
    }
    
    if (notificationPanel) {
        notificationPanel.classList.remove('visible');
    }
}

// Start periodic checking for new notifications
function startNotificationChecking() {
    // Clear any existing interval
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }
    
    // Check for notifications immediately
    fetchUnreadCount();
    
    // Then check periodically (every 30 seconds)
    notificationCheckInterval = setInterval(fetchUnreadCount, 30000);
    console.log('Notification checking interval started');
}

// Fetch notifications
function fetchNotifications(page = 1, perPage = 10) {
    if (!notificationList) {
        console.error('Notification list element not found');
        return;
    }
    
    // Show loading state
    notificationList.innerHTML = '<div class="notification-loading">Loading notifications...</div>';
    
    console.log(`Fetching notifications: page ${page}, perPage ${perPage}`);
    
    // Fetch notifications from API
    fetch(`/api/notifications?page=${page}&per_page=${perPage}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Notifications fetched successfully:', data);
            
            // Clear notification list
            notificationList.innerHTML = '';
            
            // Check if there are any notifications
            if (!data.notifications || data.notifications.length === 0) {
                notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
                return;
            }
            
            // Add each notification to the list
            data.notifications.forEach(notification => {
                const notificationItem = createNotificationItem(notification);
                notificationList.appendChild(notificationItem);
            });
            
            // Add pagination if needed
            if (data.pagination && data.pagination.pages > 1) {
                const paginationControls = createPaginationControls(data.pagination);
                notificationList.appendChild(paginationControls);
            }
        })
        .catch(error => {
            console.error('Error fetching notifications:', error);
            notificationList.innerHTML = `<div class="notification-error">Failed to load notifications: ${error.message}</div>`;
        });
}

// Fetch unread notification count
function fetchUnreadCount() {
    console.log('Fetching unread notification count...');
    
    fetch('/api/notifications/unread-count')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch unread count: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Unread count fetched:', data);
            updateNotificationBadge(data.unread_count);
        })
        .catch(error => {
            console.error('Error fetching unread count:', error);
            // Don't update badge on error - keep previous state
        });
}

// Update notification badge with unread count
function updateNotificationBadge(count) {
    if (!notificationBadge) {
        console.error('Notification badge element not found');
        return;
    }
    
    // Update the badge UI
    if (count > 0) {
        notificationBadge.textContent = count > 99 ? '99+' : count;
        notificationBadge.style.display = 'block';
        unreadCount = count;
        
        // Add the glow effect to the bell icon if unread notifications exist
        if (notificationBtn) {
            notificationBtn.classList.add('has-notifications');
        }
        
        console.log(`Notification badge updated: ${count} unread`);
    } else {
        notificationBadge.style.display = 'none';
        unreadCount = 0;
        
        // Remove glow effect if no unread notifications
        if (notificationBtn) {
            notificationBtn.classList.remove('has-notifications');
        }
        
        console.log('Notification badge hidden (no unread notifications)');
    }
}

// Create a notification item element
function createNotificationItem(notification) {
    const item = document.createElement('div');
    item.className = 'notification-item';
    if (!notification.is_read) {
        item.classList.add('unread');
    }
    
    // Set data attribute for notification ID
    item.dataset.id = notification.id;
    
    // Determine icon based on notification type
    let iconClass = 'fas fa-bell';
    switch (notification.notification_type) {
        case 'file_shared':
            iconClass = 'fas fa-share-alt';
            break;
        case 'file_deleted_by_admin':
            iconClass = 'fas fa-trash';
            break;
        case 'file_expired':
            iconClass = 'fas fa-clock';
            break;
        case 'permission_changed':
            iconClass = 'fas fa-key';
            break;
    }
    
    // Format relative time if not already provided
    let timeAgo = notification.time_ago || 'Recently';
    
    // Create item content
    item.innerHTML = `
        <div class="notification-icon">
            <i class="${iconClass}"></i>
        </div>
        <div class="notification-content">
            <p class="notification-message">${notification.message}</p>
            <p class="notification-time">${timeAgo}</p>
        </div>
        <div class="notification-actions">
            ${!notification.is_read ? 
                `<button class="btn-mark-read" title="Mark as read" data-id="${notification.id}">
                    <i class="fas fa-check"></i>
                </button>` : ''
            }
        </div>
    `;
    
    // Add event listeners for actions
    setTimeout(() => {
        // Add event listener for mark as read button
        const markReadBtn = item.querySelector('.btn-mark-read');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                markNotificationAsRead(notification.id);
            });
        }
        
        // Mark as read when clicked
        item.addEventListener('click', () => {
            if (!notification.is_read) {
                markNotificationAsRead(notification.id);
            }
            
            // Handle navigating to related content based on notification type
            if (notification.related_file_id) {
                handleNotificationClick(notification);
            }
        });
    }, 10);
    
    return item;
}

// Handle notification click based on notification type
function handleNotificationClick(notification) {
    // Get file name if available
    const fileName = notification.file_name || '';
    
    // Handle different notification types
    switch (notification.notification_type) {
        case 'file_shared':
            // Navigate to the shared-with-me view
            const sharedTab = document.querySelector('.nav-links li:nth-child(2)');
            if (sharedTab) {
                sharedTab.click();
            }
            break;
            
        case 'file_deleted_by_admin':
            // Show a toast message with details since the file is gone
            showToast(`The file was deleted by an administrator`);
            break;
            
        case 'file_expired':
            // Navigate to the trash view
            const trashTab = document.querySelector('.nav-links li:nth-child(5)');
            if (trashTab) {
                trashTab.click();
            }
            break;
            
        default:
            // For other notifications, just navigate to the dashboard
            const dashboardTab = document.querySelector('.nav-links li:first-child');
            if (dashboardTab) {
                dashboardTab.click();
            }
    }
}

// Create pagination controls
function createPaginationControls(pagination) {
    const container = document.createElement('div');
    container.className = 'notification-pagination';
    
    // Calculate range of pages to show
    const currentPage = pagination.page;
    const totalPages = pagination.pages;
    
    // Create previous button
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '&laquo;';
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener('click', () => {
        fetchNotifications(currentPage - 1, pagination.per_page);
    });
    container.appendChild(prevBtn);
    
    // Add page buttons
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        if (i === currentPage) {
            pageBtn.className = 'active';
        }
        pageBtn.addEventListener('click', () => {
            fetchNotifications(i, pagination.per_page);
        });
        container.appendChild(pageBtn);
    }
    
    // Create next button
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '&raquo;';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.addEventListener('click', () => {
        fetchNotifications(currentPage + 1, pagination.per_page);
    });
    container.appendChild(nextBtn);
    
    return container;
}

// Mark a notification as read
function markNotificationAsRead(notificationId) {
    console.log(`Marking notification as read: ${notificationId}`);
    
    fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to mark notification as read: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Notification marked as read:', data);
            
            // Update UI
            const notificationItem = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
            if (notificationItem) {
                notificationItem.classList.remove('unread');
                
                // Remove mark as read button
                const markReadBtn = notificationItem.querySelector('.btn-mark-read');
                if (markReadBtn) {
                    markReadBtn.remove();
                }
            }
            
            // Update unread count
            fetchUnreadCount();
        })
        .catch(error => {
            console.error('Error marking notification as read:', error);
            showToast("Error marking notification as read", "error");
        });
}

// Mark all notifications as read
function markAllNotificationsAsRead() {
    console.log('Marking all notifications as read');
    
    fetch('/api/notifications/mark-all-read', {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to mark all notifications as read: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('All notifications marked as read:', data);
            
            // Update UI - remove unread class from all notifications
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
                
                // Remove mark as read button
                const markReadBtn = item.querySelector('.btn-mark-read');
                if (markReadBtn) {
                    markReadBtn.remove();
                }
            });
            
            // Update unread count
            updateNotificationBadge(0);
            
            // Show confirmation toast
            showToast("All notifications marked as read");
        })
        .catch(error => {
            console.error('Error marking all notifications as read:', error);
            showToast("Error marking notifications as read", "error");
        });
}

// Show toast notification message
function showToast(message, type = 'success') {
    // Check if global showSuccessToast/showErrorToast functions exist
    if (type === 'success' && typeof window.showSuccessToast === 'function') {
        window.showSuccessToast(message);
        return;
    } else if (type === 'error' && typeof window.showErrorToast === 'function') {
        window.showErrorToast(message);
        return;
    } else if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}-toast`;
    toast.textContent = message;
    toast.style.marginBottom = '10px';
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (toast.parentNode === toastContainer) {
                    toastContainer.removeChild(toast);
                }
                
                // Remove container if empty
                if (toastContainer.children.length === 0) {
                    document.body.removeChild(toastContainer);
                }
            }, 300);
        }, 3000);
    }, 10);
}

// Add notification-specific CSS
function addNotificationStyles() {
    // Skip if styles already added
    if (document.getElementById('notification-styles')) {
        return;
    }
    
    console.log('Adding notification styles');
    
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        }
        
        .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background-color: #ff4d4f;
            color: white;
            border-radius: 50%;
            min-width: 18px;
            height: 18px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* Notification Panel */
        .notification-panel {
            position: fixed;
            top: 60px;
            right: 20px;
            width: 350px;
            max-width: 90vw;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            max-height: 80vh;
            z-index: 1000;
            transform: translateY(-20px);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s, transform 0.3s, visibility 0.3s;
        }
        
        .notification-panel.visible {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
        }
        
        .notification-header {
            padding: 15px;
            border-bottom: 1px solid #e8e8e8;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .notification-header h3 {
            margin: 0;
            font-size: 16px;
        }
        
        .close-btn {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 16px;
            color: #999;
        }
        
        .notification-list {
            flex: 1;
            overflow-y: auto;
            padding: 0;
            max-height: calc(80vh - 110px);
        }
        
        .notification-item {
            padding: 12px 15px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            cursor: pointer;
            transition: background-color 0.2s;
            position: relative;
        }
        
        .notification-item:hover {
            background-color: #f9f9f9;
        }
        
        .notification-item.unread {
            background-color: #f0f7ff;
        }
        
        .notification-item.unread:hover {
            background-color: #e5f1ff;
        }
        
        .notification-icon {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background-color: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            color: #555;
        }
        
        .notification-item.unread .notification-icon {
            background-color: #e6f7ff;
            color: #1890ff;
        }
        
        .notification-content {
            flex: 1;
        }
        
        .notification-message {
            margin: 0 0 5px;
            font-size: 14px;
            line-height: 1.4;
        }
        
        .notification-time {
            margin: 0;
            font-size: 12px;
            color: #999;
        }
        
        .notification-actions {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        
        .notification-actions button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            font-size: 12px;
            color: #999;
            transition: color 0.2s;
        }
        
        .notification-actions button:hover {
            color: #1890ff;
        }
        
        /* Notification States */
        .notification-loading,
        .notification-empty,
        .notification-error {
            padding: 20px;
            text-align: center;
            color: #999;
        }
        
        .notification-pagination {
            display: flex;
            justify-content: center;
            padding: 10px;
            gap: 5px;
        }
        
        .notification-pagination button {
            border: 1px solid #d9d9d9;
            background-color: white;
            padding: 5px 10px;
            cursor: pointer;
            border-radius: 4px;
        }
        
        .notification-pagination button.active {
            background-color: #1890ff;
            color: white;
            border-color: #1890ff;
        }
        
        .notification-pagination button:disabled {
            cursor: not-allowed;
            color: #d9d9d9;
        }
        
        .notification-footer {
            padding: 10px 15px;
            border-top: 1px solid #e8e8e8;
            text-align: center;
        }
        
        /* Toast Notifications */
        .toast {
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            margin-bottom: 10px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            opacity: 0;
            transform: translateX(50px);
            transition: opacity 0.3s, transform 0.3s;
        }
        
        .toast.show {
            opacity: 1;
            transform: translateX(0);
        }
        
        .toast.success-toast {
            background-color: #52c41a;
        }
        
        .toast.error-toast {
            background-color: #ff4d4f;
        }
        
        .toast.info-toast {
            background-color: #1890ff;
        }
    `;
    
    document.head.appendChild(style);
}

// Close notification panel when clicking elsewhere on the page
document.addEventListener('click', function(event) {
    // Check if notification panel exists and is visible
    const panel = document.getElementById('notificationPanel');
    const btn = document.getElementById('notificationBtn');
    
    if (panel && panel.classList.contains('visible')) {
        // Check if the click was outside the panel and not on the notification button
        if (!panel.contains(event.target) && (!btn || !btn.contains(event.target))) {
            panel.classList.remove('visible');
        }
    }
});

// Make sure notifications are initialized when the page is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize with a slight delay to ensure DOM is ready
    setTimeout(initNotifications, 300);
});