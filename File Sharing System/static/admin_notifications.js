// Notification System for Admin Dashboard
let notificationCheckInterval = null;
let notificationList = null;
let notificationBtn = null;
let notificationPanel = null;
let notificationBadge = null;
let closeNotificationsBtn = null;
let markAllReadBtn = null;
let unreadCount = 0;

// Initialize the notification system
function initNotifications() {
    // Get DOM elements
    notificationBtn = document.getElementById('notificationBtn');
    notificationPanel = document.getElementById('notificationPanel');
    notificationList = document.getElementById('notificationList');
    closeNotificationsBtn = document.getElementById('closeNotifications');
    markAllReadBtn = document.getElementById('markAllRead');
    
    // Add notification badge if it doesn't exist
    if (!document.getElementById('notificationBadge')) {
        notificationBadge = document.createElement('span');
        notificationBadge.id = 'notificationBadge';
        notificationBadge.className = 'notification-badge';
        notificationBadge.style.display = 'none';
        
        // Add to notification button
        if (notificationBtn) {
            notificationBtn.appendChild(notificationBadge);
        }
    } else {
        notificationBadge = document.getElementById('notificationBadge');
    }
    
    // Set up event listeners
    if (notificationBtn) {
        notificationBtn.addEventListener('click', toggleNotificationPanel);
    }
    
    if (closeNotificationsBtn) {
        closeNotificationsBtn.addEventListener('click', closeNotificationPanel);
    }
    
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }
    
    // Start checking for new notifications
    startNotificationChecking();
}

// Toggle notification panel visibility
function toggleNotificationPanel() {
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
            }
        }
    }
}

// Close notification panel
function closeNotificationPanel() {
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
}

// Fetch notifications
function fetchNotifications(page = 1, perPage = 10) {
    if (!notificationList) return;
    
    // Show loading state
    notificationList.innerHTML = '<div class="notification-loading">Loading notifications...</div>';
    
    // Fetch notifications from API
    fetch(`/api/notifications?page=${page}&per_page=${perPage}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }
            return response.json();
        })
        .then(data => {
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
            notificationList.innerHTML = '<div class="notification-error">Failed to load notifications</div>';
        });
}

// Fetch unread notification count
function fetchUnreadCount() {
    fetch('/api/notifications/unread-count')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch unread count');
            }
            return response.json();
        })
        .then(data => {
            updateNotificationBadge(data.unread_count);
        })
        .catch(error => {
            console.error('Error fetching unread count:', error);
        });
}

// Update notification badge with unread count
function updateNotificationBadge(count) {
    if (!notificationBadge) return;
    
    // Update the badge UI
    if (count > 0) {
        notificationBadge.textContent = count > 99 ? '99+' : count;
        notificationBadge.style.display = 'block';
        unreadCount = count;
        
        // Add the glow effect to the bell icon if unread notifications exist
        if (notificationBtn) {
            notificationBtn.classList.add('has-notifications');
        }
    } else {
        notificationBadge.style.display = 'none';
        unreadCount = 0;
        
        // Remove glow effect if no unread notifications
        if (notificationBtn) {
            notificationBtn.classList.remove('has-notifications');
        }
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
            <button class="btn-delete" title="Delete" data-id="${notification.id}">
                <i class="fas fa-times"></i>
            </button>
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
        
        // Add event listener for delete button
        const deleteBtn = item.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNotification(notification.id);
            });
        }
        
        // Mark as read when clicked
        item.addEventListener('click', () => {
            if (!notification.is_read) {
                markNotificationAsRead(notification.id);
            }
            
            // If notification has a related file, navigate to it
            if (notification.related_file_id) {
                // For admin, navigate to the file in the files view
                // This is just a placeholder - implement according to your application's routing
                // window.location.href = `/admin/files?file=${notification.related_file_id}`;
            }
        });
    }, 10);
    
    return item;
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
    fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to mark notification as read');
            }
            return response.json();
        })
        .then(data => {
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
        });
}
