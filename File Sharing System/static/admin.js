// Execute code when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Main UI elements
    const addFileBtn = document.getElementById('addFileBtn');
    const addFileModal = document.getElementById('addFileModal');
    const cancelUpload = document.getElementById('cancelUpload');
    const fileUploadForm = document.getElementById('fileUploadForm');
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    const closeNotifications = document.getElementById('closeNotifications');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const shareDepartments = document.getElementById('shareDepartments');
    const shareUsers = document.getElementById('shareUsers');
    const filterType = document.getElementById('filterType');
    
    // File sharing and permission elements
    const expirationEnabled = document.getElementById('expirationEnabled');
    const expirationDate = document.getElementById('expirationDate');
    const isPrivate = document.getElementById('isPrivate');
    // Load initial data and populate UI components
    updateDashboardStats();
    loadFilesTable();
    loadActivities();
    loadDepartmentsAndUsers();

    // Initialize users module if it exists
    initializeUsersModule();
    // File upload modal management
    if (addFileBtn) {
        addFileBtn.addEventListener('click', function() {
            // Show the file upload modal when the add file button is clicked
            addFileModal.style.display = 'flex';
        });
    }
    
    if (cancelUpload) {
        cancelUpload.addEventListener('click', function() {
            // Hide the upload modal when cancel is clicked
            addFileModal.style.display = 'none';
        });
    }
    
    // Notification panel toggle
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            // Toggle the visibility of the notification panel
            notificationPanel.classList.toggle('visible');
        });
    }
    
    if (closeNotifications) {
        closeNotifications.addEventListener('click', function() {
            // Hide the notification panel when close button is clicked
            notificationPanel.classList.remove('visible');
        });
    }
    
    // Form submission handling
    if (fileUploadForm) {
        fileUploadForm.addEventListener('submit', handleFileUpload);
    }
    
    // Filter files by type
    if (filterType) {
        filterType.addEventListener('change', function() {
            // Reload the files table with the selected filter type
            loadFilesTable(this.value);
        });
    }
     // Set up periodic updates for expiration timers (every minute)
     setInterval(updateExpirationTimers, 60000);
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === addFileModal) {
            addFileModal.style.display = 'none';
        }
    });
    
    // Enable/disable expiration date input based on checkbox
    if (expirationEnabled) {
        expirationEnabled.addEventListener('change', function() {
            // Toggle the disabled state of the date input based on checkbox state
            expirationDate.disabled = !this.checked;
        });
    }
    
    // Toggle share options based on private status
    if (isPrivate) {
        isPrivate.addEventListener('change', function() {
            const isChecked = this.checked;
            
            // Get containers
            const shareDepartmentsContainer = document.getElementById('shareDepartments');
            const shareUsersContainer = document.getElementById('shareUsers');
            
            if (shareDepartmentsContainer) {
                // Disable all department checkboxes when file is private
                const deptCheckboxes = shareDepartmentsContainer.querySelectorAll('input[type="checkbox"]');
                deptCheckboxes.forEach(box => {
                    box.disabled = isChecked;
                    // Uncheck all checkboxes when file is marked as private
                    if (isChecked) box.checked = false;
                });
                
                // Add visual indication of disabled state
                if (isChecked) {
                    shareDepartmentsContainer.classList.add('disabled');
                } else {
                    shareDepartmentsContainer.classList.remove('disabled');
                }
            }
            
            if (shareUsersContainer) {
                // Disable all user checkboxes when file is private
                const userCheckboxes = shareUsersContainer.querySelectorAll('input[type="checkbox"]');
                userCheckboxes.forEach(box => {
                    box.disabled = isChecked;
                    // Uncheck all checkboxes when file is marked as private
                    if (isChecked) box.checked = false;
                });
                
                // Add visual indication of disabled state
                if (isChecked) {
                    shareUsersContainer.classList.add('disabled');
                } else {
                    shareUsersContainer.classList.remove('disabled');
                }
            }
        });
        
    }
    
    // Setup navigation
    setupNavigation();
      
    // Add search functionality
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            const searchTerm = this.value.trim();
            if (searchTerm.length >= 2) { // Only search if at least 2 characters entered
                searchGlobal(searchTerm);
            } else if (searchTerm.length === 0) {
                // Reset to default display if search is cleared
                loadFilesTable();
                if (document.getElementById('usersTable')) {
                    loadUsersTable();
                }
                // If on activities page, reset activities
                if (document.getElementById('activitiesList')) {
                    loadActivities();
                }
            }
        }, 500)); // Debounce for 500ms to avoid too many requests
    }
});

//Sets up the sidebar navigation functionality
// Modify the setupNavigation function to redirect to separate pages
function setupNavigation() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links li a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Get the clicked section name
            const section = this.querySelector('span').textContent.trim();
            
            // Handle different sections
            if (section === 'Dashboard') {
                window.location.href = '/admin/dashboard';
            }
            else if (section === 'Users') {
                window.location.href = '/admin/users';
            }
            else if (section === 'Files') {
                window.location.href = '/admin/files';
            }
            else if (section === 'Activities') {
                window.location.href = '/admin/activities';
            }
            else if (section === 'Settings') {
                window.location.href = '/admin/settings';
            }
        });
    });
}
/*Fetches and updates dashboard statistics
Retrieves file counts, user activity, and storage usage data*/
function updateDashboardStats() {
    fetch('/api/admin/stats')
        .then(response => response.json())
        .then(data => {
            const totalFilesElement = document.getElementById('totalFiles');
            const activeUsersElement = document.getElementById('activeUsers');
            const storageUsedElement = document.getElementById('storageUsed');
            const sharedFilesElement = document.getElementById('sharedFiles');
            
            // Update UI elements with the fetched data
            if (totalFilesElement) totalFilesElement.textContent = data.totalFiles || '0';
            if (activeUsersElement) activeUsersElement.textContent = data.activeUsers || '0';
            if (storageUsedElement) storageUsedElement.textContent = data.storageUsed || '0';
            if (sharedFilesElement) sharedFilesElement.textContent = data.sharedFiles || '0';
        })
        .catch(error => {
            console.error('Error fetching dashboard stats:', error);
            
            // Display error state if needed
            const elements = [
                document.getElementById('totalFiles'),
                document.getElementById('activeUsers'),
                document.getElementById('storageUsed'),
                document.getElementById('sharedFiles')
            ];
            
            elements.forEach(el => {
                if (el) el.textContent = 'Error';
            });
        });
}

//Loads and populates the files table
//@param {string} filterValue - The type of files to filter by (defaults to 'all')
function loadFilesTable(filterValue = 'all') {
    const filesList = document.getElementById('filesList');
    if (!filesList) return;
    
    // Clear existing content
    filesList.innerHTML = '';
    
    // Show loading state
    filesList.innerHTML = '<tr><td colspan="6" class="loading-message">Loading files...</td></tr>';
    
    // Fetch files from server with optional filter
    fetch(`/api/admin/files?type=${filterValue}`)
        .then(response => response.json())
        .then(data => {
            // Clear loading message
            filesList.innerHTML = '';
            
            // Display message if no files found
            if (!data.files || data.files.length === 0) {
                filesList.innerHTML = '<tr><td colspan="6" class="empty-message">No files found</td></tr>';
                return;
            }
            
            // Populate table with files
            data.files.forEach(file => {
                const fileType = file.file_type || getFileTypeFromName(file.filename);
                const fileTypeIcon = getFileIcon(fileType);
                const row = document.createElement('tr');
                
                // Create display name (without timestamp prefix)
                const displayName = file.filename.includes('_') ? 
                    file.filename.split('_').slice(1).join('_') : file.filename;
                
                // Create table row with file details and action buttons
                row.innerHTML = `
                    <td>
                        <div class="file-info">
                            <div class="file-icon file-${fileTypeIcon}">
                                <i class="fas fa-file-${fileTypeIcon}"></i>
                            </div>
                            <span>${displayName}</span>
                        </div>
                    </td>
                    <td>${file.size_formatted || formatFileSize(file.file_size || 0)}</td>
                    <td>${fileType}</td>
                    <td>${file.uploaded_by || 'Unknown'}</td>
                    <td>${file.date_formatted || formatDate(file.uploaded_at)}</td>
                    <td class="actions">
                        <button class="action-btn download" data-id="${file.id}" data-filename="${file.filename}" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn share" data-id="${file.id}" title="Share">
                            <i class="fas fa-share-alt"></i>
                        </button>
                        <button class="action-btn delete" data-id="${file.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                filesList.appendChild(row);
            });
            
            // Add event listeners to newly created action buttons
            updateDownloadButtons();
            addFileActionListeners();
        })
        .catch(error => {
            console.error('Error loading files:', error);
            filesList.innerHTML = '<tr><td colspan="6" class="error-message">Error loading files</td></tr>';
        });
}

// Attaches event listeners to file action buttons (download, share, delete)
function addFileActionListeners() {
    // Delete button listeners - UPDATED to move to trash instead of permanent deletion
    document.querySelectorAll('.action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            const filename = this.getAttribute('data-filename') || 'this file';
            
            // Updated confirmation message to indicate the file will be moved to trash
            if (confirm(`Are you sure you want to move "${filename}" to trash?`)) {
                // Changed to use the trash-file endpoint instead of delete endpoint
                fetch('/api/admin/trash-file', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ file_id: fileId })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Remove the row from the table
                        this.closest('tr').remove();
                        showToast('File moved to trash successfully');
                        // Update dashboard stats to reflect change
                        updateDashboardStats();
                        // Refresh activities to show the action
                        loadActivities();
                    } else {
                        showToast(data.error || 'Error moving file to trash');
                    }
                })
                .catch(error => {
                    console.error('Error moving file to trash:', error);
                    showToast('Error moving file to trash');
                });
            }
        });
    });
    
    // Preview button listeners
    document.querySelectorAll('.action-btn.preview').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            const filename = this.getAttribute('data-filename');
            const fileType = this.getAttribute('data-type');
            previewFile(fileId, filename, fileType);
        });
    });
}

//Updates the download button event listeners to handle password-protected files
function updateDownloadButtons() {
    document.querySelectorAll('.action-btn.download').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            const filename = this.getAttribute('data-filename');
            downloadFile(fileId, filename);
        });
    });
}
/**
 * Performs a global search across various sections of the admin dashboard
 * @param {string} searchTerm - The term to search for
 */
function searchGlobal(searchTerm) {
    // Identify which page we're on based on visible tables/lists
    const filesTable = document.getElementById('filesList');
    const usersTable = document.getElementById('usersList');
    const activitiesList = document.getElementById('activitiesList');
    
    if (filesTable) {
        // If on files page or dashboard, search files
        const filterType = document.getElementById('filterType');
        const filterValue = filterType ? filterType.value : 'all';
        loadFilesTable(filterValue, searchTerm);
    }
    
    if (usersTable) {
        // If on users page, search users
        loadUsersTable(undefined, searchTerm);
    }
    
    if (activitiesList) {
        // If on activities page, search activities
        const timeframeSelect = document.getElementById('activityTimeframe');
        const timeframe = timeframeSelect ? timeframeSelect.value : 'today';
        loadActivitiesWithSearch(timeframe, searchTerm);
    }
    
    // Show searching indicator
    showToast(`Searching for "${searchTerm}"...`);
}

/**
 * Updated version of loadUsersTable that accepts a search parameter
 * @param {string} roleFilter - Optional role filter
 * @param {string} searchQuery - Optional search term
 */
function loadUsersTable(roleFilter, searchQuery) {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
    // Get filter values from parameters or UI
    const roleSelect = document.getElementById('userFilterRole');
    roleFilter = roleFilter || (roleSelect ? roleSelect.value : 'all');
    
    // Use provided search query or get from input if not provided
    const userSearchInput = document.getElementById('userSearchInput');
    if (searchQuery && userSearchInput) {
        // Update the search input field to match the global search
        userSearchInput.value = searchQuery;
    } else if (!searchQuery && userSearchInput) {
        searchQuery = userSearchInput.value.trim();
    }
    
    // Clear existing content and show loading state
    usersList.innerHTML = '<tr><td colspan="7" class="loading-message">Loading users...</td></tr>';
    
    // Build query parameters
    let queryParams = [];
    if (roleFilter && roleFilter !== 'all') {
        queryParams.push(`role=${roleFilter}`);
    }
    if (searchQuery) {
        queryParams.push(`search=${encodeURIComponent(searchQuery)}`);
    }
    
    const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';
    
    // Fetch users data
    fetch(`/api/admin/users${queryString}`)
        .then(response => response.json())
        .then(data => {
            // Clear loading message
            usersList.innerHTML = '';
            
            // Display message if no users found
            if (!data.users || data.users.length === 0) {
                usersList.innerHTML = '<tr><td colspan="7" class="empty-message">No users found</td></tr>';
                return;
            }
            
            // Populate table with users
            data.users.forEach(user => {
                const row = document.createElement('tr');
                
                // Format the last login time
                const lastLogin = user.last_login ? formatTimeAgo(user.last_login) : 'Never';
                
                // Set status class and text
                const statusClass = user.is_active ? 'status-active' : 'status-inactive';
                const statusText = user.is_active ? 'Active' : 'Inactive';
                
                row.innerHTML = `
                    <td>${escapeHtml(user.name)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.department || 'None')}</td>
                    <td>${user.role === 'admin' ? 'Admin' : 'User'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${lastLogin}</td>
                    <td class="actions">
                        <button class="action-btn edit" data-id="${user.id}" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" data-id="${user.id}" data-name="${escapeHtml(user.name)}" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                usersList.appendChild(row);
            });
            
            // Add event listeners to action buttons
            addUserActionListeners();
            
            // If this was a search, show the result count
            if (searchQuery) {
                showToast(`Found ${data.users.length} user(s) matching "${searchQuery}"`);
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
            usersList.innerHTML = '<tr><td colspan="7" class="error-message">Error loading users</td></tr>';
        });
}

/**
 * Updated version of loadActivities that includes search functionality
 * @param {string} timeframe - Timeframe filter for activities
 * @param {string} searchQuery - Optional search term
 */
function loadActivitiesWithSearch(timeframe = 'today', searchQuery = '') {
    const activitiesList = document.getElementById('activitiesList');
    if (!activitiesList) return;
    
    // Clear existing content
    activitiesList.innerHTML = '';
    
    // Show loading state
    activitiesList.innerHTML = '<div class="loading-message">Loading activities...</div>';
    
    // Build query URL with parameters
    let url = `/api/admin/activities?timeframe=${timeframe}`;
    if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
    }
    
    // Fetch activities from server
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Clear loading message
            activitiesList.innerHTML = '';
            
            // Display message if no activities found
            if (!data.activities || data.activities.length === 0) {
                activitiesList.innerHTML = '<div class="empty-message">No activities found</div>';
                return;
            }
            
            // Populate activities list
            data.activities.forEach(activity => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                
                // Get appropriate icon and color based on activity type
                const icon = activity.icon || getActivityIcon(activity.activity_type);
                const colorClass = activity.color || '';
                
                // Format the timestamp for display
                const formattedTime = formatTimeAgo(activity.timestamp);
                
                // Create activity item with icon and description
                activityItem.innerHTML = `
                    <div class="activity-icon ${colorClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p class="activity-text">
                            <strong>${activity.user_name}</strong> (${activity.department}): 
                            ${activity.details}
                        </p>
                        <p class="activity-time">${formattedTime}</p>
                    </div>
                `;
                
                activitiesList.appendChild(activityItem);
            });
            
            // If this was a search, show the result count
            if (searchQuery) {
                showToast(`Found ${data.activities.length} activities matching "${searchQuery}"`);
            }
        })
        .catch(error => {
            console.error('Error loading activities:', error);
            activitiesList.innerHTML = '<div class="error-message">Error loading activities</div>';
        });
}

// Update the original loadActivities function to use the new search-enabled function
function loadActivities() {
    const timeframeSelect = document.getElementById('activityTimeframe');
    const timeframe = timeframeSelect ? timeframeSelect.value : 'today';
    loadActivitiesWithSearch(timeframe);
}

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait between calls
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}
/**
 * Handles file download with password checking
 * @param {string} fileId - The ID of the file to download
 * @param {string} filename - The filename of the file to download
 * @param {string} providedPassword - Optional password if already verified
 */
function downloadFile(fileId, filename, providedPassword = '') {
    // If password already provided and verified, download directly with it
    if (providedPassword) {
        // Create a form to submit the password
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/api/admin/download/${filename}`;
        form.style.display = 'none';
        
        // Add password input
        const passwordInput = document.createElement('input');
        passwordInput.type = 'hidden';
        passwordInput.name = 'password';
        passwordInput.value = providedPassword;
        
        // Add form to document and submit
        form.appendChild(passwordInput);
        document.body.appendChild(form);
        form.submit();
        
        setTimeout(() => {
            document.body.removeChild(form);
        }, 2000);
        
        return;
    }
    
    // Otherwise check if password is required
    fetch(`/api/admin/file-info/${filename}`)
        .then(response => response.json())
        .then(data => {
            if (data.isPasswordProtected) {
                // If password protected, prompt for password
                promptForPassword(filename);
            } else {
                // If not password protected, download directly
                window.location.href = `/api/admin/download/${filename}`;
            }
        })
        .catch(error => {
            console.error("Error checking file info:", error);
            showToast("Error checking file info. Please try again.");
        });
}

/**
 * Displays a password prompt modal for password-protected files
 * @param {string} filename - The filename of the file to download
 */
function promptForPassword(filename) {
    // Create modal for password input
    const passwordModal = document.createElement('div');
    passwordModal.classList.add('modal');
    passwordModal.style.display = 'flex';
    passwordModal.id = 'passwordModal';
    
    passwordModal.innerHTML = `
        <div class="modal-content">
            <h2>Password Required</h2>
            <p>This file is password protected. Please enter the password to download.</p>
            <div class="form-group">
                <input type="password" id="downloadPassword" placeholder="Enter password" class="form-control">
            </div>
            <div class="modal-actions">
                <button id="submitPassword" class="btn primary">Download</button>
                <button id="cancelPassword" class="btn secondary">Cancel</button>
            </div>
        </div>
    `;
    
    // Add modal to the document
    document.body.appendChild(passwordModal);
    
    // Focus the password input
    document.getElementById('downloadPassword').focus();
    
    // Add event listeners
    document.getElementById('submitPassword').addEventListener('click', () => {
        const password = document.getElementById('downloadPassword').value;
        if (!password) {
            showToast("Please enter a password");
            return;
        }
        
        // Try to download with password
        downloadWithPassword(filename, password);
        // Remove the modal
        document.body.removeChild(passwordModal);
    });
    
    document.getElementById('cancelPassword').addEventListener('click', () => {
        // Remove the modal
        document.body.removeChild(passwordModal);
    });
    
    // Submit on Enter key
    document.getElementById('downloadPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submitPassword').click();
        }
    });
}

/**
 * Initiates file download with a password
 * @param {string} filename - The filename of the file to download
 * @param {string} password - The password for the protected file
 */
function downloadWithPassword(filename, password) {
    // First verify the password before proceeding with download
    const formData = new FormData();
    formData.append('password', password);
    
    fetch(`/api/admin/verify-password/${filename}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Password verification failed');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Password is correct, proceed with download
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `/api/admin/download/${filename}`;
            form.style.display = 'none';
            
            // Add password input
            const passwordInput = document.createElement('input');
            passwordInput.type = 'hidden';
            passwordInput.name = 'password';
            passwordInput.value = password;
            
            // Add form to document and submit
            form.appendChild(passwordInput);
            document.body.appendChild(form);
            form.submit();
            
            // Remove the form after submission
            setTimeout(() => {
                document.body.removeChild(form);
            }, 2000);
            
            showToast("Download started...");
        } else {
            // This shouldn't happen normally, but handle it just in case
            showToast("Error verifying password.");
        }
    })
    .catch(error => {
        console.error("Password verification failed:", error);
        showToast("Incorrect password. Please try again.");
        
        // Re-prompt for password
        setTimeout(() => {
            promptForPassword(filename);
        }, 1000);
    });
}
//Loads and displays recent user activities
function loadActivities() {
    const activitiesList = document.getElementById('activitiesList');
    if (!activitiesList) return;
    
    // Clear existing content
    activitiesList.innerHTML = '';
    
    // Get selected timeframe
    const timeframeSelect = document.getElementById('activityTimeframe');
    const timeframe = timeframeSelect ? timeframeSelect.value : 'today';
    
    // Show loading state
    activitiesList.innerHTML = '<div class="loading-message">Loading activities...</div>';
    
    // Fetch activities from server
    fetch(`/api/admin/activities?timeframe=${timeframe}`)
        .then(response => response.json())
        .then(data => {
            // Clear loading message
            activitiesList.innerHTML = '';
            
            // Display message if no activities found
            if (!data.activities || data.activities.length === 0) {
                activitiesList.innerHTML = '<div class="empty-message">No recent activities</div>';
                return;
            }
            
            // Populate activities list
            data.activities.forEach(activity => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                
                // Get appropriate icon and color based on activity type
                const icon = activity.icon || getActivityIcon(activity.activity_type);
                const colorClass = activity.color || '';
                
                // Format the timestamp for display
                const formattedTime = formatTimeAgo(activity.timestamp);
                
                // Create activity item with icon and description
                activityItem.innerHTML = `
                    <div class="activity-icon ${colorClass}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p class="activity-text">
                            <strong>${activity.user_name}</strong> (${activity.department}): 
                            ${activity.details}
                        </p>
                        <p class="activity-time">${formattedTime}</p>
                    </div>
                `;
                
                activitiesList.appendChild(activityItem);
            });
            
            // Add event listener to timeframe select if it exists
            if (timeframeSelect) {
                timeframeSelect.addEventListener('change', loadActivities);
            }
        })
        .catch(error => {
            console.error('Error loading activities:', error);
            activitiesList.innerHTML = '<div class="error-message">Error loading activities</div>';
        });
}

/**
 * Loads departments and users for sharing options
 * Uses async/await for cleaner promise handling
 */
function loadDepartmentsAndUsers() {
    const shareDepartmentsContainer = document.getElementById('shareDepartments');
    const shareUsersContainer = document.getElementById('shareUsers');
    
    if (!shareDepartmentsContainer || !shareUsersContainer) return;
    
    // Clear existing content
    shareDepartmentsContainer.innerHTML = '<p class="loading">Loading departments...</p>';
    shareUsersContainer.innerHTML = '<p class="loading">Loading users...</p>';
    
    // Fetch departments from API
    fetch('/api/admin/all-departments')
        .then(response => response.json())
        .then(data => {
            shareDepartmentsContainer.innerHTML = '';
            
            if (!data.departments || data.departments.length === 0) {
                shareDepartmentsContainer.innerHTML = '<p>No departments found</p>';
                return;
            }
            
            // Add each department as a checkbox
            data.departments.forEach(dept => {
                const deptItem = document.createElement('div');
                deptItem.className = 'checkbox-item';
                deptItem.innerHTML = `
                    <input type="checkbox" id="dept_${dept}" name="departments[]" value="${dept}">
                    <label for="dept_${dept}">${dept}</label>
                `;
                shareDepartmentsContainer.appendChild(deptItem);
            });
        })
        .catch(error => {
            console.error('Error loading departments:', error);
            shareDepartmentsContainer.innerHTML = '<p class="error">Failed to load departments</p>';
        });
    
    // Fetch users from API
    fetch('/api/admin/all-users')
        .then(response => response.json())
        .then(data => {
            shareUsersContainer.innerHTML = '';
            
            if (!data.users || data.users.length === 0) {
                shareUsersContainer.innerHTML = '<p>No users found</p>';
                return;
            }
            
            // Add each user as a checkbox
            data.users.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'checkbox-item';
                userItem.innerHTML = `
                    <input type="checkbox" id="user_${user.id}" name="users[]" value="${user.id}">
                    <label for="user_${user.id}">${user.name} (${user.department || 'No Department'})</label>
                `;
                shareUsersContainer.appendChild(userItem);
            });
        })
        .catch(error => {
            console.error('Error loading users:', error);
            shareUsersContainer.innerHTML = '<p class="error">Failed to load users</p>';
        });
}

/**
 * Handles file upload form submission
 * Processes form data and sends to server
 * @param {Event} e - The submit event
 */
function handleFileUpload(e) {
    e.preventDefault();
    
    // Get file input and validate
    const fileInput = document.getElementById('fileInput');
    const descInput = document.getElementById('fileDescription');
    const isPrivateInput = document.getElementById('isPrivate');
    const passwordInput = document.getElementById('filePassword');
    
    // Get expiration inputs
    const expirationEnabled = document.getElementById('expirationEnabled');
    const expirationDate = document.getElementById('expirationDate');
    const expirationTime = document.getElementById('expirationTime');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a file to upload');
        return;
    }

    const file = fileInput.files[0];

    // File size validation
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
    if (file.size > MAX_FILE_SIZE) {
        showToast(`File size exceeds the maximum limit of 5 GB`);
        return;
    }

    // File type validation
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'docx', 'xlsx', 'txt', 'mp4', 'mov', 'avi', 'wmv'];
    const blockedExtensions = ['exe', 'bat', 'sh', 'js', 'msi', 'vbs'];

    if (blockedExtensions.includes(fileExt)) {
        showToast("This file type is not allowed for security reasons");
        return;
    }

    if (!allowedExtensions.includes(fileExt)) {
        showToast("Unsupported file type");
        return;
    }

    // Create FormData object to send file and metadata
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', descInput ? descInput.value.trim() : '');
    
    // Handle the private file setting
    formData.append('isPrivate', isPrivateInput ? isPrivateInput.checked.toString() : 'false');
    
    // Handle expiration settings
    if (expirationEnabled && expirationEnabled.checked && expirationDate && expirationDate.value) {
        formData.append('expirationEnabled', 'true');
        formData.append('expirationDate', expirationDate.value);
        if (expirationTime && expirationTime.value) {
            // Ensure the time format includes seconds (HH:MM -> HH:MM:00)
            let timeValue = expirationTime.value;
            if (timeValue.split(':').length === 2) {
                timeValue = `${timeValue}:00`;
            }
            formData.append('expirationTime', timeValue);
        } else {
            formData.append('expirationTime', '23:59:59');
        }
    }
    
    // Process department sharing if not private
    if (!isPrivateInput || !isPrivateInput.checked) {
        // Get selected departments
        const selectedDepts = [];
        document.querySelectorAll('#shareDepartments input[type="checkbox"]:checked').forEach(checkbox => {
            selectedDepts.push(checkbox.value);
        });
        
        if (selectedDepts.length > 0) {
            formData.append('shareWith', selectedDepts.join(','));
        }
        
        // Get selected users
        document.querySelectorAll('#shareUsers input[type="checkbox"]:checked').forEach(checkbox => {
            formData.append('shareWithUsers', checkbox.value);
        });
    }
    
    // Password protection (if provided)
    if (passwordInput && passwordInput.value) {
        formData.append('password', passwordInput.value);
    }
    
    // Show upload progress
    const uploadProgress = document.createElement('div');
    uploadProgress.classList.add('upload-progress');
    document.body.appendChild(uploadProgress);

    // Show loading state on submit button
    const fileUploadForm = document.getElementById('fileUploadForm');
    const submitButton = fileUploadForm.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    submitButton.disabled = true;

    try {
        const xhr = new XMLHttpRequest();
        
        // Progress tracking
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                uploadProgress.textContent = `Uploading: ${percentComplete.toFixed(2)}%`;
                uploadProgress.style.width = `${percentComplete}%`;
            }
        };

        xhr.onload = function() {
            uploadProgress.remove();
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            
            if (xhr.status === 201) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    
                    // Create success message with expiration info
                    let successMessage = "File uploaded successfully!";
                    if (response.expiration) {
                        const expirationDate = new Date(response.expiration);
                        successMessage += ` File will expire on ${expirationDate.toLocaleDateString()} at ${expirationDate.toLocaleTimeString()}.`;
                    }
                    
                    showToast(successMessage);
                    addFileModal.style.display = 'none';
                    fileUploadForm.reset();
                    
                    // Refresh the data displays
                    loadFilesTable();
                    updateDashboardStats();
                    loadActivities();
                } catch (e) {
                    // If JSON parsing fails, still try to handle success case
                    showToast("File uploaded successfully!");
                    addFileModal.style.display = 'none';
                    fileUploadForm.reset();
                    
                    // Refresh the data displays
                    loadFilesTable();
                    updateDashboardStats();
                    loadActivities();
                }
            } else {
                try {
                    const response = JSON.parse(xhr.responseText);
                    showToast(response.error || "Upload failed");
                } catch (e) {
                    showToast("Upload failed. Please try again.");
                }
            }
        };

        xhr.onerror = function() {
            uploadProgress.remove();
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            showToast("Network error. Please try again.");
        };

        xhr.open("POST", "/api/admin/upload", true);
        xhr.send(formData);
    } catch (error) {
        uploadProgress.remove();
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
        showToast(`Error uploading file: ${error.message}`);
        console.error("Upload error:", error);
    }
}

/**
 * Displays a temporary notification message
 * @param {string} message - The message to display
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) {
        // If toast elements don't exist, create them
        const newToast = document.createElement('div');
        newToast.id = 'toast';
        newToast.className = 'toast';
        
        const msgContent = document.createElement('p');
        msgContent.textContent = message;
        
        newToast.appendChild(msgContent);
        document.body.appendChild(newToast);
        
        // Show the toast
        setTimeout(() => {
            newToast.classList.add('show');
            setTimeout(() => {
                newToast.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(newToast);
                }, 300);
            }, 3000);
        }, 10);
    } else {
        // Use existing toast elements
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        // Auto-hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

/**
 * Returns the appropriate icon class based on file type
 * @param {string} type - The file type or extension
 * @returns {string} - Icon class name
 */
function getFileIcon(type) {
    switch(type.toLowerCase()) {
        case 'pdf':
            return 'pdf';
        case 'excel':
        case 'xlsx':
        case 'xls':
        case 'csv':
            return 'excel';
        case 'image':
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
            return 'image';
        case 'powerpoint':
        case 'ppt':
        case 'pptx':
            return 'powerpoint';
        case 'document':
        case 'doc':
        case 'docx':
        case 'txt':
        case 'text':
            return 'word';
        case 'video':
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv':
            return 'video';
        default:
            return 'other';
    }
}

/**
 * Formats a date string into a human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date (e.g., "Jan 15, 2025")
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Converts timestamp to relative time (e.g., "2 hours ago")
 * @param {string} timestamp - ISO date string
 * @returns {string} - Human-readable relative time
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown time';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000); // Difference in seconds
    
    if (diff < 60) {
        return 'just now';
    } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diff < 604800) { // Less than 1 week
        const days = Math.floor(diff / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
        // If more than a week ago, return the formatted date
        return formatDate(timestamp);
    }
}

/**
 * Formats file size in bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size (e.g., "2.5 MB")
 */
function formatFileSize(bytes) {
    if (bytes === 0 || bytes === undefined || bytes === null) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Returns the appropriate icon for activity type
 * @param {string} type - The activity type
 * @returns {string} - Font Awesome icon name
 */
function getActivityIcon(type) {
    switch(type) {
        case 'file_upload':
            return 'fa-upload';
        case 'file_download':
            return 'fa-download';
        case 'file_delete':
            return 'fa-trash';
        case 'file_share':
            return 'fa-share-alt';
        case 'login':
            return 'fa-sign-in-alt';
        case 'logout':
            return 'fa-sign-out-alt';
        case 'user_create':
            return 'fa-user-plus';
        case 'user_update':
            return 'fa-user-edit';
        default:
            return 'fa-bell';
    }
}

/**
 * Determines file type from filename extension
 * @param {string} filename - The name of the file
 * @returns {string} - The determined file type
 */
function getFileTypeFromName(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    switch(extension) {
        case 'pdf':
            return 'pdf';
        case 'xlsx':
        case 'xls':
        case 'csv':
            return 'excel';
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
            return 'image';
        case 'ppt':
        case 'pptx':
            return 'powerpoint';
        case 'doc':
        case 'docx':
        case 'txt':
            return 'document';
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv':
            return 'video';
        default:
            return 'alt';
    }
}

/**
 * Determines file type from filename extension
 * @param {string} filename - The name of the file
 * @returns {string} - The determined file type
 */
function getFileTypeFromName(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    switch(extension) {
        case 'pdf':
            return 'pdf';
        case 'xlsx':
        case 'xls':
        case 'csv':
            return 'excel';
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
            return 'image';
        case 'ppt':
        case 'pptx':
            return 'powerpoint';
        case 'doc':
        case 'docx':
        case 'txt':
            return 'document';
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv':
            return 'video';
        default:
            return 'other';
    }
}

/**
 * Formats a date string into a human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date (e.g., "Jan 15, 2025")
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Converts timestamp to relative time (e.g., "2 hours ago")
 * @param {string} timestamp - ISO date string
 * @returns {string} - Human-readable relative time
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown time';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000); // Difference in seconds
    
    if (diff < 60) {
        return 'just now';
    } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diff < 604800) { // Less than 1 week
        const days = Math.floor(diff / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
        // If more than a week ago, return the formatted date
        return formatDate(timestamp);
    }
}

/**
 * Formats file size in bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size (e.g., "2.5 MB")
 */
function formatFileSize(bytes) {
    if (bytes === 0 || bytes === undefined || bytes === null) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Returns the appropriate icon for activity type
 * @param {string} type - The activity type
 * @returns {string} - Font Awesome icon name
 */
function getActivityIcon(type) {
    switch(type) {
        case 'file_upload':
            return 'fa-upload';
        case 'file_download':
            return 'fa-download';
        case 'file_delete':
            return 'fa-trash';
        case 'file_share':
            return 'fa-share-alt';
        case 'login':
            return 'fa-sign-in-alt';
        case 'logout':
            return 'fa-sign-out-alt';
        case 'user_create':
            return 'fa-user-plus';
        case 'user_update':
            return 'fa-user-edit';
        default:
            return 'fa-bell';
    }
}
// Users Management JavaScript

/**
 * Initialize users module and attach event handlers
 */
function initializeUsersModule() {
    // Reference UI elements
    const addUserBtn = document.getElementById('addUserBtn');
    const userModal = document.getElementById('userModal');
    const cancelUserForm = document.getElementById('cancelUserForm');
    const userForm = document.getElementById('userForm');
    const userFilterRole = document.getElementById('userFilterRole');
    const userSearchInput = document.getElementById('userSearchInput');
    const deleteUserModal = document.getElementById('deleteUserModal');
    const cancelDeleteUser = document.getElementById('cancelDeleteUser');
    const confirmDeleteUser = document.getElementById('confirmDeleteUser');
    
    // Add event listeners
    if (addUserBtn) {
        addUserBtn.addEventListener('click', function() {
            openUserModal('add');
        });
    }
    
    if (cancelUserForm) {
        cancelUserForm.addEventListener('click', function() {
            userModal.style.display = 'none';
        });
    }
    
    if (userForm) {
        userForm.addEventListener('submit', handleUserFormSubmit);
    }
    
    if (userFilterRole) {
        userFilterRole.addEventListener('change', function() {
            loadUsersTable();
        });
    }
    
    if (userSearchInput) {
        userSearchInput.addEventListener('input', debounce(function() {
            loadUsersTable();
        }, 300));
    }
    
    if (cancelDeleteUser) {
        cancelDeleteUser.addEventListener('click', function() {
            deleteUserModal.style.display = 'none';
        });
    }
    
    if (confirmDeleteUser) {
        confirmDeleteUser.addEventListener('click', function() {
            const userId = confirmDeleteUser.getAttribute('data-user-id');
            if (userId) {
                deleteUser(userId);
            }
        });
    }
    
    // Setup password visibility toggles
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                this.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                this.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === userModal) {
            userModal.style.display = 'none';
        }
        if (event.target === deleteUserModal) {
            deleteUserModal.style.display = 'none';
        }
    });
    
    // Load initial data
    loadUsersTable();
    loadDepartmentsForUserForm();
}

/**
 * Loads user data from the server and populates the users table
 */
function loadUsersTable() {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
    // Get filter values
    const roleFilter = document.getElementById('userFilterRole').value;
    const searchQuery = document.getElementById('userSearchInput').value.trim();
    
    // Clear existing content and show loading state
    usersList.innerHTML = '<tr><td colspan="7" class="loading-message">Loading users...</td></tr>';
    
    // Build query parameters
    let queryParams = [];
    if (roleFilter && roleFilter !== 'all') {
        queryParams.push(`role=${roleFilter}`);
    }
    if (searchQuery) {
        queryParams.push(`search=${encodeURIComponent(searchQuery)}`);
    }
    
    const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';
    
    // Fetch users data
    fetch(`/api/admin/users${queryString}`)
        .then(response => response.json())
        .then(data => {
            // Clear loading message
            usersList.innerHTML = '';
            
            // Display message if no users found
            if (!data.users || data.users.length === 0) {
                usersList.innerHTML = '<tr><td colspan="7" class="empty-message">No users found</td></tr>';
                return;
            }
            
            // Populate table with users
            data.users.forEach(user => {
                const row = document.createElement('tr');
                
                // Format the last login time
                const lastLogin = user.last_login ? formatTimeAgo(user.last_login) : 'Never';
                
                // Set status class and text
                const statusClass = user.is_active ? 'status-active' : 'status-inactive';
                const statusText = user.is_active ? 'Active' : 'Inactive';
                
                row.innerHTML = `
                    <td>${escapeHtml(user.name)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.department || 'None')}</td>
                    <td>${user.role === 'admin' ? 'Admin' : 'User'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${lastLogin}</td>
                    <td class="actions">
                        <button class="action-btn edit" data-id="${user.id}" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" data-id="${user.id}" data-name="${escapeHtml(user.name)}" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                usersList.appendChild(row);
            });
            
            // Add event listeners to action buttons
            addUserActionListeners();
        })
        .catch(error => {
            console.error('Error loading users:', error);
            usersList.innerHTML = '<tr><td colspan="7" class="error-message">Error loading users</td></tr>';
        });
}

/**
 * Fetches departments and populates the department dropdown for the user form
 */
function loadDepartmentsForUserForm() {
    const departmentSelect = document.getElementById('userDepartment');
    if (!departmentSelect) return;
    
    // Clear existing options except the first one
    while (departmentSelect.options.length > 0) {
        departmentSelect.remove(0);
    }
    
    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select Department';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    departmentSelect.appendChild(placeholderOption);
    
    // Fetch departments from API
    fetch('/api/admin/all-departments')
        .then(response => response.json())
        .then(data => {
            if (!data.departments || data.departments.length === 0) {
                const noDeptOption = document.createElement('option');
                noDeptOption.value = '';
                noDeptOption.textContent = 'No departments available';
                departmentSelect.appendChild(noDeptOption);
                return;
            }
            
            // Add each department as an option
            data.departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                departmentSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error loading departments:', error);
            const errorOption = document.createElement('option');
            errorOption.value = '';
            errorOption.textContent = 'Error loading departments';
            departmentSelect.appendChild(errorOption);
        });
}

/**
 * Opens the user modal in either add or edit mode
 * @param {string} mode - 'add' or 'edit'
 * @param {object} userData - User data when in edit mode
 */
function openUserModal(mode, userData = null) {
    const userModal = document.getElementById('userModal');
    const userModalTitle = document.getElementById('userModalTitle');
    const userForm = document.getElementById('userForm');
    const passwordFields = document.getElementById('passwordFields');
    const userId = document.getElementById('userId');
    
    // Reset form
    userForm.reset();
    
    if (mode === 'add') {
        userModalTitle.textContent = 'Add New User';
        userId.value = '';
        
        // Show password fields for new users
        passwordFields.style.display = 'block';
        
        // Set required attribute on password fields
        document.getElementById('userPassword').required = true;
        document.getElementById('userPasswordConfirm').required = true;
    } else if (mode === 'edit' && userData) {
        userModalTitle.textContent = 'Edit User';
        userId.value = userData.id;
        
        // Hide password fields for editing existing users
        passwordFields.style.display = 'none';
        
        // Remove required attribute from password fields
        document.getElementById('userPassword').required = false;
        document.getElementById('userPasswordConfirm').required = false;
        
        // Populate form with user data
        document.getElementById('userName').value = userData.name;
        document.getElementById('userEmail').value = userData.email;
        
        // Set department (wait for options to load if necessary)
        const departmentSelect = document.getElementById('userDepartment');
        if (userData.department) {
            if (departmentSelect.options.length > 1) {
                Array.from(departmentSelect.options).forEach(option => {
                    if (option.value === userData.department) {
                        option.selected = true;
                    }
                });
            } else {
                // If options aren't loaded yet, add the current department temporarily
                const tempOption = document.createElement('option');
                tempOption.value = userData.department;
                tempOption.textContent = userData.department;
                tempOption.selected = true;
                departmentSelect.appendChild(tempOption);
            }
        }
        
        // Set role
        document.getElementById('userRole').value = userData.role || 'user';
        
        // Set status
        document.getElementById('userStatus').checked = userData.is_active !== false;
    }
    
    // Show modal
    userModal.style.display = 'flex';
}

/**
 * Handles the user form submission
 * @param {Event} e - Form submit event
 */
function handleUserFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const userId = document.getElementById('userId').value;
    const isEditMode = userId !== '';
    
    // Validate form
    if (!form.checkValidity()) {
        // Let the browser handle basic validation
        return;
    }
    
    // Validate passwords match if in add mode or if passwords are provided in edit mode
    const password = document.getElementById('userPassword').value;
    const passwordConfirm = document.getElementById('userPasswordConfirm').value;
    
    if ((!isEditMode || password) && password !== passwordConfirm) {
        showToast('Passwords do not match');
        return;
    }
    
    // Collect form data
    const formData = {
        name: document.getElementById('userName').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        department: document.getElementById('userDepartment').value,
        role: document.getElementById('userRole').value,
        is_active: document.getElementById('userStatus').checked
    };
    
    // Add password only if it's provided
    if (password) {
        formData.password = password;
    }
    
    // Show loading state on submit button
    const saveButton = document.getElementById('saveUserBtn');
    const originalText = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveButton.disabled = true;
    
    // Determine endpoint and method
    const endpoint = isEditMode ? `/api/admin/users/${userId}` : '/api/admin/users';
    const method = isEditMode ? 'PUT' : 'POST';
    
    // Send data to server
    fetch(endpoint, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
        
        if (data.success) {
            // Close modal and reload table
            document.getElementById('userModal').style.display = 'none';
            showToast(isEditMode ? 'User updated successfully' : 'User added successfully');
            loadUsersTable();
            
            // If user stats are shown on dashboard, refresh them
            updateDashboardStats();
        } else {
            showToast(data.error || 'Error saving user');
        }
    })
    .catch(error => {
        console.error('Error saving user:', error);
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
        showToast('Error saving user. Please try again.');
    });
}

/**
 * Adds event listeners to user action buttons
 */
function addUserActionListeners() {
    // Edit button listeners
    document.querySelectorAll('#usersTable .action-btn.edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            
            // Fetch user details
            fetch(`/api/admin/users/${userId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.user) {
                        openUserModal('edit', data.user);
                    } else {
                        showToast(data.error || 'Error fetching user details');
                    }
                })
                .catch(error => {
                    console.error('Error fetching user details:', error);
                    showToast('Error fetching user details');
                });
        });
    });
    
    // Delete button listeners
    document.querySelectorAll('#usersTable .action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            const userName = this.getAttribute('data-name');
            
            // Set data for confirmation modal
            document.getElementById('deleteUserName').textContent = userName;
            document.getElementById('confirmDeleteUser').setAttribute('data-user-id', userId);
            
            // Show the confirmation modal
            document.getElementById('deleteUserModal').style.display = 'flex';
        });
    });
}

/**
 * Deletes a user after confirmation
 * @param {string} userId - ID of user to delete
 */
function deleteUser(userId) {
    // Show loading state on confirm button
    const confirmBtn = document.getElementById('confirmDeleteUser');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    confirmBtn.disabled = true;
    
    fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
        
        // Close the confirmation modal
        document.getElementById('deleteUserModal').style.display = 'none';
        
        if (data.success) {
            showToast('User deleted successfully');
            loadUsersTable();
            
            // If user stats are shown on dashboard, refresh them
            updateDashboardStats();
        } else {
            showToast(data.error || 'Error deleting user');
        }
    })
    .catch(error => {
        console.error('Error deleting user:', error);
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
        document.getElementById('deleteUserModal').style.display = 'none';
        showToast('Error deleting user. Please try again.');
    });
}

/**
 * Helper function to escape HTML for secure display
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait between calls
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}
/**
 * Handles file preview based on file type
 * @param {string} fileId - The ID of the file to preview
 * @param {string} filename - The filename of the file to preview
 * @param {string} fileType - The type/extension of the file
 */
function previewFile(fileId, filename, fileType) {
    // Check if the file requires a password
    fetch(`/api/admin/file-info/${filename}`)
        .then(response => response.json())
        .then(data => {
            if (data.isPasswordProtected) {
                // If password protected, prompt for password
                promptForPreviewPassword(filename, fileType);
            } else {
                // If not password protected, preview directly
                showPreviewModal(filename, fileType);
            }
        })
        .catch(error => {
            console.error("Error checking file info:", error);
            showToast("Error checking file info. Please try again.");
        });
}

/**
 * Displays a password prompt modal for password-protected files during preview
 * @param {string} filename - The filename of the file to preview
 * @param {string} fileType - The type/extension of the file
 */
function promptForPreviewPassword(filename, fileType) {
    // Create modal for password input
    const passwordModal = document.createElement('div');
    passwordModal.classList.add('modal');
    passwordModal.style.display = 'flex';
    passwordModal.id = 'passwordModal';
    
    passwordModal.innerHTML = `
        <div class="modal-content">
            <h2>Password Required</h2>
            <p>This file is password protected. Please enter the password to preview.</p>
            <div class="form-group">
                <input type="password" id="previewPassword" placeholder="Enter password" class="form-control">
            </div>
            <div class="modal-actions">
                <button id="submitPreviewPassword" class="btn primary">Preview</button>
                <button id="cancelPreviewPassword" class="btn secondary">Cancel</button>
            </div>
        </div>
    `;
    
    // Add modal to the document
    document.body.appendChild(passwordModal);
    
    // Focus the password input
    document.getElementById('previewPassword').focus();
    
    // Add event listeners
    document.getElementById('submitPreviewPassword').addEventListener('click', () => {
        const password = document.getElementById('previewPassword').value;
        if (!password) {
            showToast("Please enter a password");
            return;
        }
        
        // Try to preview with password
        verifyPasswordAndPreview(filename, password, fileType);
        // Remove the modal
        document.body.removeChild(passwordModal);
    });
    
    document.getElementById('cancelPreviewPassword').addEventListener('click', () => {
        // Remove the modal
        document.body.removeChild(passwordModal);
    });
    
    // Submit on Enter key
    document.getElementById('previewPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submitPreviewPassword').click();
        }
    });
}

/**
 * Verifies password and shows preview if correct
 * @param {string} filename - The filename of the file
 * @param {string} password - The password for the protected file
 * @param {string} fileType - The type/extension of the file
 */
function verifyPasswordAndPreview(filename, password, fileType) {
    // Create a form to submit the password
    const formData = new FormData();
    formData.append('password', password);
    
    // Verify password
    fetch(`/api/admin/verify-password/${filename}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            showPreviewModal(filename, fileType, password);
        } else {
            showToast("Incorrect password. Please try again.");
        }
    })
    .catch(error => {
        console.error("Error verifying password:", error);
        showToast("Error verifying password. Please try again.");
    });
}
/**
 * Shows the preview modal for the file
 * @param {string} filename - The filename of the file to preview
 * @param {string} fileType - The type/extension of the file
 * @param {string} password - Optional password for protected files
 */
function showPreviewModal(filename, fileType, password = '') {
    // Create the preview modal
    const previewModal = document.createElement('div');
    previewModal.classList.add('modal', 'preview-modal');
    previewModal.style.display = 'flex';
    previewModal.id = 'previewModal';
    
    // Set base content for the modal
    let modalContent = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h2>File Preview: ${filename.split('_').slice(1).join('_')}</h2>
                <button id="closePreview" class="close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="preview-container">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading preview...</p>
                </div>
            </div>
            <div class="modal-footer">
                <button id="downloadFromPreview" class="btn primary" data-filename="${filename}">
                    <i class="fas fa-download"></i> Download
                </button>
                <button id="closePreviewBtn" class="btn secondary">Close</button>
            </div>
        </div>
    `;
    
    previewModal.innerHTML = modalContent;
    document.body.appendChild(previewModal);
    
    // Setup event listeners for the modal buttons
    document.getElementById('closePreview').addEventListener('click', () => {
        document.body.removeChild(previewModal);
    });
    
    document.getElementById('closePreviewBtn').addEventListener('click', () => {
        document.body.removeChild(previewModal);
    });
    
    document.getElementById('downloadFromPreview').addEventListener('click', function() {
        const filename = this.getAttribute('data-filename');
        downloadFile(null, filename, password);
    });
    
    // Get the file extension from the filename
    const extension = fileType.toLowerCase();
    const previewContainer = previewModal.querySelector('.preview-container');
    
    // Generate the preview URL with password if needed
    let previewUrl = `/api/admin/preview/${filename}`;
    if (password) {
        previewUrl += `?password=${encodeURIComponent(password)}`;
    }
    
    // Show appropriate preview based on file type
    if (['png', 'jpg', 'jpeg', 'gif'].includes(extension)) {
        // Image preview
        const img = document.createElement('img');
        img.className = 'file-preview-image';
        img.src = previewUrl;
        img.alt = 'File Preview';
        
        img.onload = function() {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
        };
        
        img.onerror = function() {
            previewContainer.innerHTML = '<div class="preview-error">Error loading image preview</div>';
        };
    } else if (['pdf'].includes(extension)) {
        // PDF preview
        previewContainer.innerHTML = `
            <iframe class="file-preview-iframe" src="${previewUrl}" frameborder="0"></iframe>
        `;
    } else if (['mp4', 'mov', 'avi', 'wmv'].includes(extension)) {
        // Video preview
        previewContainer.innerHTML = `
            <video class="file-preview-video" controls>
                <source src="${previewUrl}" type="video/${extension === 'mov' ? 'quicktime' : extension}">
                Your browser does not support the video tag.
            </video>
        `;
    } else if (['txt', 'csv'].includes(extension)) {
        // Text preview - fetch and display
        fetch(previewUrl)
            .then(response => response.text())
            .then(text => {
                previewContainer.innerHTML = `
                    <pre class="file-preview-text">${escapeHtml(text)}</pre>
                `;
            })
            .catch(error => {
                previewContainer.innerHTML = '<div class="preview-error">Error loading text preview</div>';
            });
    } else {
        // Unsupported file type
        previewContainer.innerHTML = `
            <div class="preview-unavailable">
                <i class="fas fa-file-${getFileIcon(extension)} preview-icon"></i>
                <p>Preview not available for this file type</p>
                <p>Please download the file to view its contents</p>
            </div>
        `;
    }
    
    // Add event listener to close when clicking outside
    previewModal.addEventListener('click', function(event) {
        if (event.target === previewModal) {
            document.body.removeChild(previewModal);
        }
    });
}

// Function to handle expiration checkbox change
document.addEventListener('DOMContentLoaded', function() {
    const expirationEnabled = document.getElementById('expirationEnabled');
    const expirationInputs = document.querySelector('.expiration-inputs');
    const expirationDate = document.getElementById('expirationDate');
    const expirationTime = document.getElementById('expirationTime');
    
    if (expirationEnabled) {
        // Set minimum date to today
        const today = new Date();
        const todayFormatted = today.toISOString().split('T')[0];
        
        if (expirationDate) {
            expirationDate.min = todayFormatted;
            expirationDate.value = todayFormatted;
        }
        
        // Toggle expiration inputs visibility and state
        expirationEnabled.addEventListener('change', function() {
            if (expirationInputs) {
                expirationInputs.style.display = this.checked ? 'block' : 'none';
            }
            
            if (expirationDate) {
                expirationDate.disabled = !this.checked;
            }
            
            if (expirationTime) {
                expirationTime.disabled = !this.checked;
                if (this.checked && !expirationTime.value) {
                    expirationTime.value = '23:59';
                }
            }
        });
        
        // Initialize the state based on checkbox
        if (expirationEnabled.checked) {
            if (expirationInputs) expirationInputs.style.display = 'block';
            if (expirationDate) expirationDate.disabled = false;
            if (expirationTime) expirationTime.disabled = false;
        } else {
            if (expirationInputs) expirationInputs.style.display = 'none';
            if (expirationDate) expirationDate.disabled = true;
            if (expirationTime) expirationTime.disabled = true;
        }
    }
    
    // Set up the update function to refresh expiration timers
    setInterval(updateExpirationTimers, 60000); // Update every minute

    // Initialize expiration indicators
    initExpirationIndicators();
     // Update expiration timers every 10 seconds for more responsive UI
     setInterval(updateExpirationTimers, 10000);
    
     // Check for files that need frequent refresh every minute
     setInterval(setupExpirationRefresh, 60000);
     
     // Add this line to refresh the file list every minute to check for expired files
     setInterval(() => {
         if (document.getElementById('filesList')) {
             const filterType = document.getElementById('filterType');
             const filterValue = filterType ? filterType.value : 'all';
             loadFilesTable(filterValue);
         }
     }, 60000);

    // Add CSS styles for the new UI elements
    addStylesToHead();

    
});

/**
 * Updates all expiration indicators with current time remaining
 */
function updateExpirationTimers() {
    // Find all elements with expiration information
    const expirationElements = document.querySelectorAll('.expiration-indicator, .expiration-warning');
    
    if (expirationElements.length === 0) {
        return; // No expiration elements to update
    }
    
    console.log(`Updating ${expirationElements.length} expiration indicators`);
    
    expirationElements.forEach(element => {
        // Skip if element doesn't have expiration data
        if (!element.dataset.expires) return;
        
        try {
            const expirationDate = new Date(element.dataset.expires);
            const now = new Date();
            const timeRemaining = expirationDate - now;
            
            if (timeRemaining <= 0) {
                // If expired, update the display and refresh the list
                element.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Expired';
                element.className = 'status-indicator expiration-warning';
                
                // After a short delay, refresh the file list to remove expired files
                setTimeout(() => {
                    const filterType = document.getElementById('filterType');
                    const filterValue = filterType ? filterType.value : 'all';
                    loadFilesTable(filterValue);
                }, 3000);
                
                return;
            }
            
            // Calculate remaining time with more precision
            const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
            
            // Update the display text with more detailed time information
            let message = '';
            let icon = 'fa-clock';
            let className = 'status-indicator expiration-indicator';
            
            // Format the exact expiration date/time
            const formattedExpirationDate = expirationDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            
            const formattedExpirationTime = expirationDate.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // For more precision, show a combination of days, hours, and minutes
            if (days > 0) {
                if (hours > 0) {
                    message = `Expires in ${days}d ${hours}h (${formattedExpirationDate} at ${formattedExpirationTime})`;
                } else {
                    message = `Expires in ${days}d (${formattedExpirationDate} at ${formattedExpirationTime})`;
                }
                
                if (days <= 2) {
                    className = 'status-indicator expiration-warning';
                }
            } else if (hours > 0) {
                if (minutes > 0) {
                    message = `Expires in ${hours}h ${minutes}m (${formattedExpirationTime})`;
                } else {
                    message = `Expires in ${hours}h (${formattedExpirationTime})`;
                }
                className = 'status-indicator expiration-warning';
            } else {
                message = `Expires in ${minutes}m (${formattedExpirationTime})`;
                className = 'status-indicator expiration-warning';
                icon = 'fa-exclamation-circle';
            }
            
            element.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
            element.className = className;
            element.title = `Expires on ${formattedExpirationDate} at ${formattedExpirationTime}`;
            
            // Update row highlighting if needed
            const row = element.closest('tr');
            if (row) {
                row.classList.remove('expiration-row-urgent', 'expiration-row-critical');
                if (days === 0 && hours < 2) {
                    row.classList.add('expiration-row-urgent');
                }
                if (days === 0 && hours === 0 && minutes < 15) {
                    row.classList.add('expiration-row-critical');
                }
            }
            
        } catch (error) {
            console.error("Error updating expiration element:", error);
        }
    });
}
/**
 * Creates and returns an expiration indicator element based on time remaining
 * @param {Date} expirationDate - The file's expiration date
 * @returns {Object} - Object containing the indicator element and severity level
 */
function createExpirationIndicator(expirationDate) {
    const now = new Date();
    const timeRemaining = expirationDate - now;
    
    // Create indicator element
    const indicator = document.createElement('div');
    
    // If already expired, show expired indicator
    if (timeRemaining <= 0) {
        indicator.className = 'status-indicator expiration-warning';
        indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Expired';
        return {
            element: indicator,
            severity: 'expired'
        };
    }
    
    // Calculate remaining time units
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    // Determine severity and message based on time remaining
    let severity = 'info';
    let message = '';
    let icon = 'fa-clock';
    
    if (days > 0) {
        // More than a day remaining
        message = `Expires in ${days} day${days !== 1 ? 's' : ''}`;
        if (days <= 2) {
            severity = 'warning';
        }
    } else if (hours > 0) {
        // Less than a day but more than an hour
        message = `Expires in ${hours} hour${hours !== 1 ? 's' : ''}`;
        severity = 'warning';
    } else {
        // Less than an hour remaining
        message = `Expires in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        severity = 'warning';
        icon = 'fa-exclamation-circle';
    }
    
    // Add classes based on severity
    indicator.className = `status-indicator ${severity === 'warning' ? 'expiration-warning' : 'expiration-indicator'}`;
    indicator.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    
    // Add data attributes for later updates
    indicator.dataset.expires = expirationDate.toISOString();
    indicator.dataset.severity = severity;
    
    return {
        element: indicator,
        severity: severity
    };
}
/**
 * Updates all expiration indicators on the page with current time remaining
 */
function updateAllExpirationIndicators() {
    // Find all expiration badges
    document.querySelectorAll('.expiration-indicator, .expiration-warning').forEach(indicator => {
        // Skip if doesn't have expiration data
        if (!indicator.dataset.expires) return;
        
        try {
            const expirationDate = new Date(indicator.dataset.expires);
            updateExpirationElement(indicator, expirationDate);
        } catch (error) {
            console.error('Error updating expiration indicator:', error);
        }
    });
}

function updateExpirationElement(element, expirationDate) {
    const now = new Date();
    const timeRemaining = expirationDate - now;
    
    // Already expired
    if (timeRemaining <= 0) {
        element.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Expired';
        element.className = 'status-indicator expiration-warning';
        return;
    }
    
    // Calculate remaining time
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    // Update the display text
    let message = '';
    let icon = 'fa-clock';
    let className = 'status-indicator expiration-indicator';
    
    if (days > 0) {
        message = `Expires in ${days} day${days !== 1 ? 's' : ''}`;
        if (days <= 2) {
            className = 'status-indicator expiration-warning';
        }
    } else if (hours > 0) {
        message = `Expires in ${hours} hour${hours !== 1 ? 's' : ''}`;
        className = 'status-indicator expiration-warning';
    } else {
        message = `Expires in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        className = 'status-indicator expiration-warning';
        icon = 'fa-exclamation-circle';
    }
    
    element.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    element.className = className;
}

/**
 * Start periodic updates of expiration indicators
 */
function initExpirationIndicators() {
    console.log("Initializing expiration indicators");
    
    // Initial update
    updateAllExpirationIndicators();
    
    // Set up periodic updates every minute
    setInterval(updateAllExpirationIndicators, 60000);
}

// Add this to your loadFilesTable function when displaying files with expiration
function enhanceFileDisplay(file, row) {
    // Check if file has expiration time
    if (file.expiration_datetime) {
        try {
            const expirationDate = new Date(file.expiration_datetime);
            const fileNameCell = row.querySelector('td:first-child');
            
            // Create expiration indicator
            const indicator = createExpirationIndicator(expirationDate);
            
            if (indicator) {
                // Add indicator to the file name cell
                const fileDetails = fileNameCell.querySelector('.file-details');
                
                if (fileDetails) {
                    // Add or update existing indicators container
                    let indicatorsContainer = fileDetails.querySelector('.file-indicators');
                    
                    if (!indicatorsContainer) {
                        indicatorsContainer = document.createElement('div');
                        indicatorsContainer.className = 'file-indicators';
                        fileDetails.appendChild(indicatorsContainer);
                    }
                    
                    // Add the new indicator
                    indicatorsContainer.appendChild(indicator.element);
                    
                    // If critical expiration, highlight the entire row
                    if (indicator.severity === 'critical' || indicator.severity === 'urgent') {
                        row.classList.add(`expiration-row-${indicator.severity}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error adding expiration indicator:', error);
        }
    }
}

/**
 * Fetches expiration info for a file and adds the indicator
 * @param {string} fileId - The ID of the file
 * @param {HTMLElement} row - The table row element
 */
function fetchFileExpirationInfo(fileId, row) {
    fetch(`/api/admin/file/${fileId}`)
        .then(response => response.json())
        .then(data => {
            if (data.file && data.file.expiration_datetime) {
                const expirationDate = new Date(data.file.expiration_datetime);
                const now = new Date();
                
                // Skip if file is already expired (server should handle removal)
                if (expirationDate <= now) {
                    return;
                }
                
                const fileDetails = row.querySelector('.file-details');
                if (!fileDetails) return;
                
                const indicatorsContainer = fileDetails.querySelector('.file-indicators');
                if (!indicatorsContainer) return;
                
                // Create expiration indicator
                const timeRemaining = expirationDate - now;
                const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                
                let message = '';
                let className = 'status-indicator expiration-indicator';
                let icon = 'fa-clock';
                
                if (days > 0) {
                    message = `Expires in ${days} day${days !== 1 ? 's' : ''}`;
                    if (days <= 2) {
                        className = 'status-indicator expiration-warning';
                    }
                } else if (hours > 0) {
                    message = `Expires in ${hours} hour${hours !== 1 ? 's' : ''}`;
                    className = 'status-indicator expiration-warning';
                } else {
                    message = `Expires in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
                    className = 'status-indicator expiration-warning';
                    icon = 'fa-exclamation-circle';
                }
                
                const indicator = document.createElement('div');
                indicator.className = className;
                indicator.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
                indicator.dataset.expires = expirationDate.toISOString();
                
                indicatorsContainer.appendChild(indicator);
                
                // If very close to expiration, add a class to the row
                if (days === 0 && hours < 2) {
                    row.classList.add('expiration-row-urgent');
                }
            }
        })
        .catch(error => {
            console.error("Error fetching file expiration details:", error);
        });
}
// Setup periodic refresh of file list when expirations are present
function setupExpirationRefresh() {
    // Check if there are any files with expiration
    const expirationElements = document.querySelectorAll('.expiration-indicator, .expiration-warning');
    
    if (expirationElements.length > 0) {
        // If we have expiring files, set up more frequent refresh of file list
        const minExpirationTime = Array.from(expirationElements).reduce((min, el) => {
            if (!el.dataset.expires) return min;
            
            const expTime = new Date(el.dataset.expires) - new Date();
            return expTime < min ? expTime : min;
        }, Infinity);
        
        // If any file expires in less than 2 minutes, refresh file list every 30 seconds
        if (minExpirationTime < 2 * 60 * 1000) {
            if (!window.expirationRefreshInterval) {
                window.expirationRefreshInterval = setInterval(() => {
                    const filterType = document.getElementById('filterType');
                    const filterValue = filterType ? filterType.value : 'all';
                    loadFilesTable(filterValue);
                }, 30000); // Refresh every 30 seconds
                
                console.log("Set up frequent refresh for soon-expiring files");
            }
        }
    } else {
        // Clear interval if no expiring files
        if (window.expirationRefreshInterval) {
            clearInterval(window.expirationRefreshInterval);
            window.expirationRefreshInterval = null;
            console.log("Cleared frequent refresh interval - no expiring files");
        }
    }
}
/**
 * Creates and shows a custom confirmation dialog
 * @param {Object} options - Configuration options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string} options.confirmButtonText - Text for the confirm button
 * @param {string} options.cancelButtonText - Text for the cancel button
 * @param {string} options.confirmButtonClass - CSS class for the confirm button
 * @param {Function} options.onConfirm - Function to call when confirmed
 * @param {Function} options.onCancel - Function to call when canceled
 * @returns {HTMLElement} The dialog element
 */
function showConfirmDialog(options) {
    // Default options
    const settings = Object.assign({
        title: 'Confirm Action',
        message: 'Are you sure you want to proceed?',
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        confirmButtonClass: 'btn danger',
        onConfirm: () => {},
        onCancel: () => {}
    }, options);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    document.body.appendChild(overlay);
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
        <div class="dialog-title">${settings.title}</div>
        <div class="dialog-message">${settings.message}</div>
        <div class="dialog-actions">
            <button class="btn secondary cancel-button">${settings.cancelButtonText}</button>
            <button class="${settings.confirmButtonClass} confirm-button">${settings.confirmButtonText}</button>
        </div>
    `;
    document.body.appendChild(dialog);
    
    // Focus the cancel button by default (safer option)
    setTimeout(() => {
        dialog.querySelector('.cancel-button').focus();
    }, 100);
    
    // Function to close the dialog
    const closeDialog = () => {
        document.body.removeChild(dialog);
        document.body.removeChild(overlay);
    };
    
    // Event listeners
    dialog.querySelector('.confirm-button').addEventListener('click', () => {
        closeDialog();
        settings.onConfirm();
    });
    
    dialog.querySelector('.cancel-button').addEventListener('click', () => {
        closeDialog();
        settings.onCancel();
    });
    
    // Close when clicking overlay
    overlay.addEventListener('click', () => {
        closeDialog();
        settings.onCancel();
    });
    
    // Close on escape key
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', escHandler);
            closeDialog();
            settings.onCancel();
        }
    });
    
    return dialog;
}
/**
 * Deletes a user's file after confirmation
 * @param {string} fileId - The ID of the file to delete
 * @param {string} fileName - The name of the file for display
 * @param {string} ownerName - The name of the file owner
 */
function deleteUserFile(fileId, fileName, ownerName) {
    // Double confirmation required for deleting another user's file
    if (!confirm(`Are you sure you want to delete the file "${fileName}" owned by ${ownerName}?`)) {
        return; // User cancelled on first dialog
    }
    
    // Second confirmation dialog with more explicit warning
    if (!confirm(`WARNING: This action cannot be undone and the file will be permanently deleted. Proceed?`)) {
        return; // User cancelled on second dialog
    }
    
    // Show a loading indicator
    const fileRow = document.querySelector(`tr[data-file-id="${fileId}"]`);
    if (fileRow) {
        fileRow.classList.add('deleting-row');
    }
    
    // Call the API to delete the user's file
    fetch(`/api/admin/delete-user-file/${fileId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || "File deleted successfully");
            
            // Remove the row from the table if it exists
            if (fileRow) {
                fileRow.addEventListener('transitionend', () => {
                    fileRow.remove();
                });
                fileRow.classList.add('removing-row');
            } else {
                // If row not found, just refresh the files table
                loadFilesTable();
            }
            
            // Update dashboard stats to reflect deletion
            updateDashboardStats();
            
            // Refresh activities to show the deletion
            loadActivities();
        } else {
            showToast(data.error || "Error deleting file", "error");
            
            // Remove the deleting class if there was an error
            if (fileRow) {
                fileRow.classList.remove('deleting-row');
            }
        }
    })
    .catch(error => {
        console.error('Error deleting file:', error);
        showToast(`Error deleting file: ${error.message}`, "error");
        
        // Remove the deleting class if there was an error
        if (fileRow) {
            fileRow.classList.remove('deleting-row');
        }
    });
}
/**
 * Performs the actual API call to delete a user file
 * @param {string} fileId - The ID of the file to delete
 * @param {string} fileName - The name of the file for display
 * @param {string} ownerName - The name of the file owner
 */
function performUserFileDeletion(fileId, fileName, ownerName) {
    // Show a loading indicator
    const fileRow = document.querySelector(`tr[data-file-id="${fileId}"]`);
    if (fileRow) {
        fileRow.classList.add('deleting-row');
    }
    
    // Call the API to delete the user's file
    fetch(`/api/admin/delete-user-file/${fileId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || "File deleted successfully");
            
            // Remove the row from the table if it exists
            if (fileRow) {
                fileRow.addEventListener('transitionend', () => {
                    if (fileRow.parentElement) {
                        fileRow.parentElement.removeChild(fileRow);
                    }
                });
                fileRow.classList.add('removing-row');
            } else {
                // If row not found, just refresh the files table
                loadFilesTable();
            }
            
            // Update dashboard stats to reflect deletion
            updateDashboardStats();
            
            // Refresh activities to show the deletion
            loadActivities();
        } else {
            showToast(data.error || "Error deleting file", "error");
            
            // Remove the deleting class if there was an error
            if (fileRow) {
                fileRow.classList.remove('deleting-row');
            }
        }
    })
    .catch(error => {
        console.error('Error deleting file:', error);
        showToast(`Error deleting file: ${error.message}`, "error");
        
        // Remove the deleting class if there was an error
        if (fileRow) {
            fileRow.classList.remove('deleting-row');
        }
    });
}
/**
 * Helper function to get current admin ID
 * @returns {string} The current admin ID
 */
function getCurrentAdminId() {
    // Try to get from a hidden input or data attribute
    const adminIdInput = document.getElementById('adminId');
    if (adminIdInput && adminIdInput.value) {
        return adminIdInput.value;
    }
    
    // Fallback - check session storage or session
    return sessionStorage.getItem('adminId') || '';
}
/**
 * Update the loadFilesTable function to show user files and admin actions
 * @param {string} filterValue - The type of files to filter by (defaults to 'all')
 * @param {string} searchQuery - Optional search term
 */
function loadFilesTable(filterValue = 'all', searchQuery = '') {
    const filesList = document.getElementById('filesList');
    if (!filesList) return;
    
    // Clear existing content
    filesList.innerHTML = '';
    
    // Show loading state
    filesList.innerHTML = '<tr><td colspan="6" class="loading-message">Loading files...</td></tr>';
    
    // Fetch files from server with optional filter
    let url = `/api/admin/files?type=${filterValue}`;
    if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Clear loading message
            filesList.innerHTML = '';
            
            // Display message if no files found
            if (!data.files || data.files.length === 0) {
                filesList.innerHTML = '<tr><td colspan="6" class="empty-message">No files found</td></tr>';
                return;
            }
            
            // Populate table with files
            data.files.forEach(file => {
                const fileType = file.file_type || getFileTypeFromName(file.filename);
                const fileTypeIcon = getFileIcon(fileType);
                const row = document.createElement('tr');
                
                // Create display name (without timestamp prefix)
                const displayName = file.filename.includes('_') ? 
                    file.filename.split('_').slice(1).join('_') : file.filename;
                
                // Only create User File tag if the uploader is not an admin
                const userFileTag = file.uploader_role !== 'admin' ? 
                    '<div class="tag user-file">User File</div>' : '';
                
                // Create table row with file details and action buttons
                row.innerHTML = `
                    <td>
                        <div class="file-info">
                            <div class="file-icon file-${fileTypeIcon}">
                                <i class="fas fa-file-${fileTypeIcon}"></i>
                            </div>
                            <div class="file-details">
                                <span class="file-name">${displayName}</span>
                                ${userFileTag}
                                <div class="file-indicators"></div>
                            </div>
                        </div>
                    </td>
                    <td>${file.size_formatted || formatFileSize(file.file_size || 0)}</td>
                    <td>${fileType}</td>
                    <td>${file.uploaded_by || 'Unknown'}</td>
                    <td>${file.date_formatted || formatDate(file.uploaded_at)}</td>
                    <td class="actions">
                        <button class="action-btn download" data-id="${file.id}" data-filename="${file.filename}" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn preview" data-id="${file.id}" data-filename="${file.filename}" data-type="${fileType}" title="Preview">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn delete" data-id="${file.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                filesList.appendChild(row);
                
                // Add password protection indicator if needed
                if (file.is_password_protected) {
                    const fileDetails = row.querySelector('.file-details');
                    const indicatorsContainer = fileDetails.querySelector('.file-indicators');
                    const passwordBadge = document.createElement('div');
                    passwordBadge.className = 'status-indicator password-protected';
                    passwordBadge.innerHTML = '<i class="fas fa-lock"></i> Password Protected';
                    indicatorsContainer.appendChild(passwordBadge);
                }
                
                // Check for expiration and add indicator
                fetchFileExpirationInfo(file.id, row);
            });
            
            // Add event listeners to newly created action buttons
            updateDownloadButtons();
            addFileActionListeners();
        })
        .catch(error => {
            console.error('Error loading files:', error);
            filesList.innerHTML = '<tr><td colspan="6" class="error-message">Error loading files</td></tr>';
        });
}
/**
 * Add event listeners to file action buttons including delete-user-file buttons
 */
function updateFileActionListeners() {
    // Add event listeners for delete-user-file buttons
    document.querySelectorAll('.action-btn.delete-user-file').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            const fileName = this.getAttribute('data-filename');
            const ownerName = this.getAttribute('data-owner');
            
            deleteUserFile(fileId, fileName, ownerName);
        });
    });
}
/**
 * Enhanced showToast function that supports different message types
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error, warning, info)
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) {
        // If toast elements don't exist, create them
        const newToast = document.createElement('div');
        newToast.id = 'toast';
        newToast.className = `toast ${type}-toast`;
        
        const msgContent = document.createElement('p');
        msgContent.id = 'toastMessage';
        msgContent.textContent = message;
        
        newToast.appendChild(msgContent);
        document.body.appendChild(newToast);
        
        // Show the toast
        setTimeout(() => {
            newToast.classList.add('show');
            setTimeout(() => {
                newToast.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(newToast);
                }, 300);
            }, 3000);
        }, 10);
    } else {
        // Use existing toast elements
        toast.className = `toast ${type}-toast`;
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        // Auto-hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}
/**
 * Add CSS styles to the document head
 */
function addStylesToHead() {
    // Only add if not already present
    if (!document.getElementById('admin-file-deletion-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'admin-file-deletion-styles';
        styleEl.textContent = `
            /* File ownership display */
            .user-owned {
                background-color: rgba(255, 240, 245, 0.2);
            }
            
            .user-owned:hover {
                background-color: rgba(255, 240, 245, 0.3);
            }
            
            .admin-owned {
                background-color: rgba(240, 248, 255, 0.2);
            }
            
            .admin-owned:hover {
                background-color: rgba(240, 248, 255, 0.3);
            }
            
            .ownership-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: bold;
                margin-left: 6px;
                vertical-align: middle;
            }
            
            .ownership-badge.user {
                background-color: #ffecb5;
                color: #ad8b00;
            }
            
            .ownership-badge.admin {
                background-color: #d1e9ff;
                color: #0058ad;
            }
            
            /* User info in table cells */
            .user-info {
                display: flex;
                flex-direction: column;
            }
            
            .user-name {
                font-weight: 500;
            }
            
            .user-dept {
                font-size: 0.8rem;
                color: #666;
            }
            
            /* Animation for deleting files */
            .deleting-row {
                background-color: rgba(255, 0, 0, 0.1);
                transition: opacity 0.5s ease-out, background-color 0.3s ease-in;
            }
            
            .removing-row {
                opacity: 0;
            }
            
            /* Different styling for user file delete button */
            .action-btn.delete-user-file {
                background-color: #ff7875;
                color: white;
            }
            
            .action-btn.delete-user-file:hover {
                background-color: #ff4d4f;
            }
            
            /* Confirmation dialog styling */
            .confirm-dialog {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: white;
                width: 400px;
                max-width: 90vw;
                padding: 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1000;
            }
            
            .confirm-dialog .dialog-title {
                font-size: 1.2rem;
                font-weight: bold;
                margin-bottom: 12px;
                color: #ff4d4f;
            }
            
            .confirm-dialog .dialog-message {
                margin-bottom: 20px;
                line-height: 1.5;
            }
            
            .confirm-dialog .dialog-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            
            .dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 999;
            }
            
            /* Toast styles for different message types */
            .toast.error-toast {
                background-color: #ff4d4f;
                color: white;
            }
            
            .toast.warning-toast {
                background-color: #faad14;
                color: white;
            }
            
            .toast.info-toast {
                background-color: #1890ff;
                color: white;
            }
            
            .toast.success-toast {
                background-color: #52c41a;
                color: white;
            }
        `;
        document.head.appendChild(styleEl);
    }
}