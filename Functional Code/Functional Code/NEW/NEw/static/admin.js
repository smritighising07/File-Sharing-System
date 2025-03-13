document.addEventListener('DOMContentLoaded', function() {
    // Variables
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
    
    // Initialize dashboard and tables
    updateDashboardStats();
    loadFilesTable();
    loadActivities();
    loadDepartmentsAndUsers();
    
    // Event Listeners
    if (addFileBtn) {
        addFileBtn.addEventListener('click', function() {
            addFileModal.style.display = 'flex';
        });
    }
    
    if (cancelUpload) {
        cancelUpload.addEventListener('click', function() {
            addFileModal.style.display = 'none';
        });
    }
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            notificationPanel.classList.toggle('visible');
        });
    }
    
    if (closeNotifications) {
        closeNotifications.addEventListener('click', function() {
            notificationPanel.classList.remove('visible');
        });
    }
    
    if (fileUploadForm) {
        fileUploadForm.addEventListener('submit', handleFileUpload);
    }
    
    if (filterType) {
        filterType.addEventListener('change', function() {
            loadFilesTable(this.value);
        });
    }
    
    // When clicking outside the modal, close it
    window.addEventListener('click', function(event) {
        if (event.target === addFileModal) {
            addFileModal.style.display = 'none';
        }
    });
    
    // Functions
    
    function updateDashboardStats() {
        fetch('/get_dashboard_stats')
            .then(response => response.json())
            .then(data => {
                const totalFilesElement = document.getElementById('totalFiles');
                const activeUsersElement = document.getElementById('activeUsers');
                const storageUsedElement = document.getElementById('storageUsed');
                const sharedFilesElement = document.getElementById('sharedFiles');
                
                if (totalFilesElement) totalFilesElement.textContent = data.total_files || '0';
                if (activeUsersElement) activeUsersElement.textContent = data.active_users || '0';
                if (storageUsedElement) storageUsedElement.textContent = formatFileSize(data.storage_used || 0);
                if (sharedFilesElement) sharedFilesElement.textContent = data.shared_files || '0';
            })
            .catch(error => {
                console.error('Error fetching dashboard stats:', error);
            });
    }
    
    function loadFilesTable(filterValue = 'all') {
        const filesList = document.getElementById('filesList');
        if (!filesList) return;
        
        // Clear existing content
        filesList.innerHTML = '';
        
        // Show loading state
        filesList.innerHTML = '<tr><td colspan="6" class="loading-message">Loading files...</td></tr>';
        
        // Fetch files from server
        fetch(`/get_files?filter=${filterValue}`)
            .then(response => response.json())
            .then(files => {
                // Clear loading message
                filesList.innerHTML = '';
                
                if (files.length === 0) {
                    filesList.innerHTML = '<tr><td colspan="6" class="empty-message">No files found</td></tr>';
                    return;
                }
                
                // Populate table with files
                files.forEach(file => {
                    const fileTypeIcon = getFileIcon(file.file_type || getFileTypeFromName(file.filename));
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>
                            <div class="file-info">
                                <div class="file-icon file-${fileTypeIcon}">
                                    <i class="fas fa-file-${fileTypeIcon}"></i>
                                </div>
                                <span>${file.filename}</span>
                            </div>
                        </td>
                        <td>${formatFileSize(file.file_size || 0)}</td>
                        <td>${file.file_type || getFileTypeFromName(file.filename)}</td>
                        <td>${file.uploaded_by || 'Unknown'}</td>
                        <td>${formatDate(file.uploaded_at)}</td>
                        <td class="actions">
                            <button class="action-btn download" data-id="${file.id}" title="Download">
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
                
                // Add event listeners to action buttons
                addFileActionListeners();
            })
            .catch(error => {
                console.error('Error loading files:', error);
                filesList.innerHTML = '<tr><td colspan="6" class="error-message">Error loading files</td></tr>';
            });
    }
    
    function addFileActionListeners() {
        // Delete button listeners
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const fileId = this.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this file?')) {
                    fetch(`/delete_file/${fileId}`, {
                        method: 'DELETE'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            this.closest('tr').remove();
                            showToast('File deleted successfully');
                            updateDashboardStats();
                        } else {
                            showToast('Error deleting file');
                        }
                    })
                    .catch(error => {
                        console.error('Error deleting file:', error);
                        showToast('Error deleting file');
                    });
                }
            });
        });

        // Download button listeners
        document.querySelectorAll('.action-btn.download').forEach(btn => {
            btn.addEventListener('click', function() {
                const fileId = this.getAttribute('data-id');
                window.location.href = `/download_file/${fileId}`;
            });
        });

        // Share button listeners
        document.querySelectorAll('.action-btn.share').forEach(btn => {
            btn.addEventListener('click', function() {
                const fileId = this.getAttribute('data-id');
                // Implementation for sharing modal would go here
                showToast('Sharing feature will be implemented soon');
            });
        });
    }
    
    function loadActivities() {
        const activitiesList = document.getElementById('activitiesList');
        if (!activitiesList) return;
        
        // Clear existing content
        activitiesList.innerHTML = '';
        
        // Fetch activities from server
        fetch('/get_activities')
            .then(response => response.json())
            .then(activities => {
                if (activities.length === 0) {
                    activitiesList.innerHTML = '<div class="empty-message">No recent activities</div>';
                    return;
                }
                
                // Populate activities
                activities.forEach(activity => {
                    const activityItem = document.createElement('div');
                    activityItem.className = 'activity-item';
                    
                    activityItem.innerHTML = `
                        <div class="activity-icon">
                            <i class="fas fa-${getActivityIcon(activity.type)}"></i>
                        </div>
                        <div class="activity-content">
                            <p class="activity-text">${activity.description}</p>
                            <p class="activity-time">${formatTimeAgo(activity.timestamp)}</p>
                        </div>
                    `;
                    
                    activitiesList.appendChild(activityItem);
                });
            })
            .catch(error => {
                console.error('Error loading activities:', error);
                activitiesList.innerHTML = '<div class="error-message">Error loading activities</div>';
            });
    }
    
    async function loadDepartmentsAndUsers() {
        try {
            // Get departments
            const departmentsResponse = await fetch('/get_departments');
            const departments = await departmentsResponse.json();
            
            // Get users
            const usersResponse = await fetch('/get_users');
            const users = await usersResponse.json();
            
            // Populate departments in share modal
            if (shareDepartments) {
                shareDepartments.innerHTML = '';
                
                departments.forEach(dept => {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'checkbox-item';
                    checkbox.innerHTML = `
                        <input type="checkbox" id="dept_${dept.id}" name="departments[]" value="${dept.id}">
                        <label for="dept_${dept.id}">${dept.name}</label>
                    `;
                    shareDepartments.appendChild(checkbox);
                });
            }
            
            // Add users section to the form if it doesn't exist
            if (!shareUsers) {
                const userSectionDiv = document.createElement('div');
                userSectionDiv.className = 'form-group';
                userSectionDiv.innerHTML = `
                    <label>Share with Specific Users:</label>
                    <div id="shareUsers" class="checkbox-group"></div>
                `;
                
                // Insert after departments section
                shareDepartments.parentNode.insertAdjacentElement('afterend', userSectionDiv);
                
                // Update the shareUsers variable
                shareUsers = document.getElementById('shareUsers');
            }
            
            // Populate users in share modal
            if (shareUsers) {
                shareUsers.innerHTML = '';
                
                users.forEach(user => {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'checkbox-item';
                    checkbox.innerHTML = `
                        <input type="checkbox" id="user_${user.id}" name="users[]" value="${user.id}">
                        <label for="user_${user.id}">${user.name} (${user.email})</label>
                    `;
                    shareUsers.appendChild(checkbox);
                });
            }
        } catch (error) {
            console.error('Error loading departments and users:', error);
            if (shareDepartments) {
                shareDepartments.innerHTML = '<div class="error-message">Error loading departments</div>';
            }
            if (shareUsers) {
                shareUsers.innerHTML = '<div class="error-message">Error loading users</div>';
            }
        }
    }
    
    function handleFileUpload(e) {
        e.preventDefault();
        
        const formData = new FormData(fileUploadForm);
        
        // Show loading state
        const submitButton = fileUploadForm.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        submitButton.disabled = true;
        
        // Send file to server
        fetch('/upload_file', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            fileUploadForm.reset();
            addFileModal.style.display = 'none';
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            
            if (data.success) {
                showToast('File uploaded successfully');
                
                // Refresh file list and dashboard stats
                loadFilesTable();
                updateDashboardStats();
                loadActivities();
            } else {
                showToast(data.message || 'Error uploading file');
            }
        })
        .catch(error => {
            console.error('Error uploading file:', error);
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            showToast('Error uploading file');
        });
    }
    
    function showToast(message) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
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
                return 'alt';
        }
    }
    
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
    
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    function formatTimeAgo(timestamp) {
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
        } else {
            const days = Math.floor(diff / 86400);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function getActivityIcon(type) {
        switch(type) {
            case 'upload':
                return 'upload';
            case 'download':
                return 'download';
            case 'delete':
                return 'trash';
            case 'share':
                return 'share-alt';
            case 'user':
                return 'user';
            default:
                return 'bell';
        }
    }
});