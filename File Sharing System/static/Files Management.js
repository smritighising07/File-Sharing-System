// Files Management JavaScript

// Global variables
let currentCategory = 'all';
let currentFileType = 'all';
let searchQuery = '';

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
 * Handles file upload form submission
 * @param {Event} e - The submit event
 */
function handleFileUpload(e) {
    e.preventDefault();
    
    // Get file input and validate
    const fileInput = document.getElementById('fileInput');
    const descInput = document.getElementById('fileDescription');
    const isPrivateInput = document.getElementById('isPrivate');
    const passwordInput = document.getElementById('filePassword');
    
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
    
    // Handle the private file setting - convert boolean to string
    formData.append('isPrivate', isPrivateInput ? isPrivateInput.checked.toString() : 'false');
    
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
    
    // Handle expiration date if enabled
    const expirationEnabled = document.getElementById('expirationEnabled');
    const expirationDate = document.getElementById('expirationDate');
    
    if (expirationEnabled && expirationEnabled.checked && expirationDate && expirationDate.value) {
        formData.append('expiration_date', expirationDate.value);
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
                    showToast("File uploaded successfully!");
                    const addFileModal = document.getElementById('addFileModal');
                    addFileModal.style.display = 'none';
                    fileUploadForm.reset();
                    
                    // Refresh the data displays
                    loadFilesTable(currentCategory, currentFileType, searchQuery);
                    
                    // Log activity
                    logActivity('file_upload', `Uploaded file: ${file.name}`);
                    
                } catch (e) {
                    // If JSON parsing fails, still try to handle success case
                    showToast("File uploaded successfully!");
                    const addFileModal = document.getElementById('addFileModal');
                    addFileModal.style.display = 'none';
                    fileUploadForm.reset();
                    loadFilesTable(currentCategory, currentFileType, searchQuery);
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
 * Handles file sharing form submission
 * @param {Event} e - The submit event
 */
function handleShareFile(e) {
    e.preventDefault();
    
    const shareFileId = document.getElementById('shareFileId').value;
    
    if (!shareFileId) {
        showToast('File ID is missing');
        return;
    }
    
    // Get selected departments
    const selectedDepts = [];
    document.querySelectorAll('#shareDepartmentsModal input[type="checkbox"]:checked').forEach(checkbox => {
        selectedDepts.push(checkbox.value);
    });
    
    // Get selected users
    const selectedUsers = [];
    document.querySelectorAll('#shareUsersModal input[type="checkbox"]:checked').forEach(checkbox => {
        selectedUsers.push(checkbox.value);
    });
    
    // Validate that at least one department or user is selected
    if (selectedDepts.length === 0 && selectedUsers.length === 0) {
        showToast('Please select at least one department or user to share with');
        return;
    }
    
    // Prepare data for API
    const data = {
        file_id: shareFileId,
        share_with_departments: selectedDepts,
        share_with_users: selectedUsers
    };
    
    // Show loading state
    const submitButton = document.querySelector('#shareFileForm button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sharing...';
    submitButton.disabled = true;
    
    // Send request to API
    fetch('/api/admin/share-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
        
        if (data.success) {
            // Close modal and show success message
            document.getElementById('shareFileModal').style.display = 'none';
            showToast('File shared successfully');
            
            // Refresh file list if in shared category
            if (currentCategory === 'shared') {
                loadFilesTable(currentCategory, currentFileType, searchQuery);
            }
            
            // Log activity
            logActivity('file_share', 'Shared file with departments/users');
        } else {
            showToast(data.error || 'Error sharing file');
        }
    })
    .catch(error => {
        console.error('Error sharing file:', error);
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
        showToast('Error sharing file. Please try again.');
    });
}

/**
 * Displays a password prompt for protected files
 * @param {string} filename - The filename of the file to download
 */
function downloadWithPassword(filename, password) {
    console.log(`Downloading file with password: ${filename}`);
    
    // First verify the password before proceeding with download
    const formData = new FormData();
    formData.append('password', password);
    
    fetch(`/api/admin/verify-password/${filename}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log(`Password verification response status: ${response.status}`);
        if (!response.ok) {
            throw new Error('Password verification failed');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('Password verified successfully, proceeding with download');
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
            
            // Log activity
            logActivity('file_download', `Downloaded password-protected file: ${filename}`);
        } else {
            // This shouldn't happen normally, but handle it just in case
            console.error('Password verification returned success=false');
            showToast("Error verifying password.");
            promptForPassword(filename);
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
// Fixed promptForPassword function for password-protected downloads
function promptForPassword(filename) {
    // Remove any existing password modals first
    const existingModal = document.getElementById('passwordModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
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
                <input type="password" id="filePassword" placeholder="Enter password" class="form-control">
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
    document.getElementById('filePassword').focus();
    
    // Add event listeners
    document.getElementById('submitPassword').addEventListener('click', () => {
        const password = document.getElementById('filePassword').value;
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
    document.getElementById('filePassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submitPassword').click();
        }
    });
    
    // Close when clicking outside
    passwordModal.addEventListener('click', function(event) {
        if (event.target === passwordModal) {
            document.body.removeChild(passwordModal);
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
            
            // Log activity
            logActivity('file_download', `Downloaded password-protected file: ${filename}`);
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
/**
 * Displays a toast notification
 * @param {string} message - Message to display
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
 * Initializes file navigation tabs with enhanced logging
 */
function initFileNavigation() {
    const navItems = document.querySelectorAll('.files-navigation .nav-item');
    const categoryTitle = document.getElementById('currentCategoryTitle');
    
    console.log("DEBUG: Initializing file navigation with categories:", 
                Array.from(navItems).map(item => item.getAttribute('data-category')));
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Prevent default behavior if it's a link
            e.preventDefault();
            
            console.log("DEBUG: Navigation item clicked:", this.getAttribute('data-category'));
            
            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked nav item
            this.classList.add('active');
            
            // Get category from data attribute
            const category = this.getAttribute('data-category');
            
            // Important: Update the global currentCategory variable
            currentCategory = category;
            
            console.log(`DEBUG: Switched to category: ${category}, updating global currentCategory`);
            
            // Update category title
            if (categoryTitle) {
                categoryTitle.textContent = this.querySelector('span').textContent;
            }
            
            // Reset file type filter
            currentFileType = 'all';
            const filterType = document.getElementById('filterType');
            if (filterType) {
                filterType.value = 'all';
            }
            
            // Reset search query
            searchQuery = '';
            const searchInput = document.getElementById('fileSearchInput');
            if (searchInput) {
                searchInput.value = '';
            }
            
            // Explicitly log that we're loading files for this category
            console.log(`DEBUG: Loading files table for category: ${category}`);
            
            // Load files for this category
            loadFilesTable(category, 'all', '');
        });
    });
    
    // Initialize with all files on page load
    console.log("DEBUG: Initial load of 'all' files category");
    loadFilesTable('all', 'all', '');
    
    // Set the initial active tab
    const allFilesTab = document.querySelector('.files-navigation .nav-item[data-category="all"]');
    if (allFilesTab) {
        allFilesTab.classList.add('active');
        if (categoryTitle) {
            categoryTitle.textContent = allFilesTab.querySelector('span').textContent;
        }
    }
}
/**
 * Initializes file filter controls with enhanced debugging
 */
function initFileFilters() {
    const filterType = document.getElementById('filterType');
    const searchInput = document.getElementById('fileSearchInput');
    
    if (filterType) {
        console.log("DEBUG: Setting up file type filter event listener");
        filterType.addEventListener('change', function() {
            currentFileType = this.value;
            console.log(`DEBUG: File type filter changed to: ${currentFileType}, current category: ${currentCategory}`);
            loadFilesTable(currentCategory, currentFileType, searchQuery);
        });
    }
    
    if (searchInput) {
        console.log("DEBUG: Setting up search input event listener");
        searchInput.addEventListener('input', debounce(function() {
            searchQuery = this.value.trim();
            console.log(`DEBUG: Search query changed to: ${searchQuery}, current category: ${currentCategory}`);
            loadFilesTable(currentCategory, currentFileType, searchQuery);
        }, 300));
    }
}

/**
 * Initializes modals and their controls
 */
function initFileModals() {
    // Share file modal
    const cancelShare = document.getElementById('cancelShare');
    const shareFileForm = document.getElementById('shareFileForm');
    
    if (cancelShare) {
        cancelShare.addEventListener('click', function() {
            document.getElementById('shareFileModal').style.display = 'none';
        });
    }
    
    if (shareFileForm) {
        shareFileForm.addEventListener('submit', handleShareFile);
    }
    
    // File details modal
    const closeFileDetails = document.getElementById('closeFileDetails');
    const downloadFileDetails = document.getElementById('downloadFileDetails');
    
    if (closeFileDetails) {
        closeFileDetails.addEventListener('click', function() {
            document.getElementById('fileDetailsModal').style.display = 'none';
        });
    }
    
    if (downloadFileDetails) {
        downloadFileDetails.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            const filename = this.getAttribute('data-filename');
            if (fileId && filename) {
                downloadFile(fileId, filename);
            }
        });
    }
    
    // Restore file modal
    const cancelRestore = document.getElementById('cancelRestore');
    const confirmRestore = document.getElementById('confirmRestore');
    
    if (cancelRestore) {
        cancelRestore.addEventListener('click', function() {
            document.getElementById('restoreFileModal').style.display = 'none';
        });
    }
    
    if (confirmRestore) {
        confirmRestore.addEventListener('click', function() {
            const fileId = this.getAttribute('data-file-id');
            if (fileId) {
                restoreFile(fileId);
            }
        });
    }
    
    // Delete file modal
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    
    if (cancelDelete) {
        cancelDelete.addEventListener('click', function() {
            document.getElementById('deleteFileModal').style.display = 'none';
        });
    }
    
    if (confirmDelete) {
        confirmDelete.addEventListener('click', function() {
            const fileId = this.getAttribute('data-file-id');
            const permanently = this.getAttribute('data-permanent') === 'true';
            if (fileId) {
                deleteFile(fileId, permanently);
            }
        });
    }
}

/**
 * Shows file details in modal
 * @param {number} fileId - The ID of the file to show details for
 */
function showFileDetails(fileId) {
    const fileDetailsModal = document.getElementById('fileDetailsModal');
    const fileDetailsContent = document.getElementById('fileDetailsContent');
    const downloadBtn = document.getElementById('downloadFileDetails');
    
    if (!fileDetailsModal || !fileDetailsContent) return;
    
    // Show loading state
    fileDetailsContent.innerHTML = '<div class="loading-message">Loading file details...</div>';
    fileDetailsModal.style.display = 'flex';
    
    // Fetch file details
    fetch(`/api/admin/file/${fileId}`)
        .then(response => response.json())
        .then(data => {
            if (!data.file) {
                fileDetailsContent.innerHTML = '<div class="error-message">File not found</div>';
                return;
            }
            
            const file = data.file;
            
            // Format the data for display
            const fileType = file.file_type || getFileTypeFromName(file.filename);
            const fileTypeIcon = getFileIcon(fileType);
            
            // Create display name (without timestamp prefix)
            const displayName = file.filename.includes('_') ? 
                file.filename.split('_').slice(1).join('_') : file.filename;
            
            // Set file data on download button
            if (downloadBtn) {
                downloadBtn.setAttribute('data-id', file.id);
                downloadBtn.setAttribute('data-filename', file.filename);
            }
            
            // Build the details HTML
            let detailsHtml = `
                <div class="file-details-row">
                    <div class="file-details-item">
                        <div class="file-info">
                            <div class="file-icon file-${fileTypeIcon}">
                                <i class="fas fa-file-${fileTypeIcon}"></i>
                            </div>
                            <h3>${displayName}</h3>
                        </div>
                    </div>
                </div>
                
                <div class="file-details-row">
                    <div class="file-details-item">
                        <span class="label">Size</span>
                        <span class="value">${file.size_formatted}</span>
                    </div>
                    <div class="file-details-item">
                        <span class="label">Type</span>
                        <span class="value">${fileType}</span>
                    </div>
                </div>
                
                <div class="file-details-row">
                    <div class="file-details-item">
                        <span class="label">Uploaded By</span>
                        <span class="value">${file.uploaded_by}</span>
                    </div>
                    <div class="file-details-item">
                        <span class="label">Department</span>
                        <span class="value">${file.department || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="file-details-row">
                    <div class="file-details-item">
                        <span class="label">Upload Date</span>
                        <span class="value">${file.date_formatted}</span>
                    </div>
                    <div class="file-details-item">
                        <span class="label">Last Modified</span>
                        <span class="value">${file.date_formatted}</span>
                    </div>
                </div>
            `;
            
            // Add more details if available
            if (file.description) {
                detailsHtml += `
                    <div class="file-details-item">
                        <span class="label">Description</span>
                        <span class="value">${file.description}</span>
                    </div>
                `;
            }
            // Add sharing info if available
            if (file.shared_with) {
                const depts = file.shared_with.departments || [];
                const users = file.shared_with.users || [];
                
                if (depts.length > 0 || users.length > 0) {
                    detailsHtml += `
                        <div class="file-details-item">
                            <span class="label">Shared With</span>
                            <div class="value">
                    `;
                    
                    if (depts.length > 0) {
                        detailsHtml += `
                            <div class="shared-details">
                                <strong>Departments:</strong> ${depts.join(', ')}
                            </div>
                        `;
                    }
                    
                    if (users.length > 0) {
                        detailsHtml += `
                            <div class="shared-details">
                                <strong>Users:</strong> ${users.join(', ')}
                            </div>
                        `;
                    }
                    
                    detailsHtml += `
                            </div>
                        </div>
                    `;
                }
            }
                        
            // Add security info
            detailsHtml += `
                <div class="file-details-row">
                    <div class="file-details-item">
                        <span class="label">Privacy</span>
                        <span class="value">${file.is_private ? 'Private' : 'Shareable'}</span>
                    </div>
                    <div class="file-details-item">
                        <span class="label">Password Protected</span>
                        <span class="value">${file.is_password_protected ? 'Yes' : 'No'}</span>
                    </div>
                </div>
            `;
            
            fileDetailsContent.innerHTML = detailsHtml;
            
            // Log activity
            logActivity('file_view_details', `Viewed details for file: ${displayName}`);
        })
        .catch(error => {
            console.error('Error fetching file details:', error);
            fileDetailsContent.innerHTML = '<div class="error-message">Error loading file details</div>';
        });
}

/**
 * Shows file sharing modal
 * @param {number} fileId - The ID of the file to share
 */
function showShareModal(fileId) {
    const shareFileModal = document.getElementById('shareFileModal');
    const shareFileId = document.getElementById('shareFileId');
    
    if (!shareFileModal || !shareFileId) return;
    
    // Set file ID in form
    shareFileId.value = fileId;
    
    // Load departments and users for sharing if not already loaded
    loadDepartmentsAndUsersForShare();
    
    // Show the modal
    shareFileModal.style.display = 'flex';
}

/**
 * Shows restore confirmation modal
 * @param {number} fileId - The ID of the file to restore
 */
function showRestoreConfirmation(fileId) {
    const restoreFileModal = document.getElementById('restoreFileModal');
    const confirmRestore = document.getElementById('confirmRestore');
    
    if (!restoreFileModal || !confirmRestore) return;
    
    // Set file ID on confirm button
    confirmRestore.setAttribute('data-file-id', fileId);
    
    // Show the modal
    restoreFileModal.style.display = 'flex';
}

/**
 * Shows delete confirmation modal
 * @param {number} fileId - The ID of the file to delete
 * @param {boolean} permanent - Whether this is a permanent deletion
 */
function showDeleteConfirmation(fileId, permanent) {
    const deleteFileModal = document.getElementById('deleteFileModal');
    const deleteFileMessage = document.getElementById('deleteFileMessage');
    const confirmDelete = document.getElementById('confirmDelete');
    
    if (!deleteFileModal || !confirmDelete) return;
    
    // Set file ID and permanent flag on confirm button
    confirmDelete.setAttribute('data-file-id', fileId);
    confirmDelete.setAttribute('data-permanent', permanent);
    
    // Update message based on deletion type
    if (deleteFileMessage) {
        if (permanent) {
            deleteFileMessage.textContent = 'Are you sure you want to permanently delete this file? This action cannot be undone.';
        } else {
            deleteFileMessage.textContent = 'Are you sure you want to move this file to trash?';
        }
    }
    
    // Show the modal
    deleteFileModal.style.display = 'flex';
}
// Separate function for download password prompt to avoid confusion
function promptForDownloadPassword(filename) {
    // Remove any existing password modals first
    const existingModal = document.getElementById('downloadPasswordModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Create modal for password input
    const passwordModal = document.createElement('div');
    passwordModal.classList.add('modal');
    passwordModal.style.display = 'flex';
    passwordModal.id = 'downloadPasswordModal';
    
    passwordModal.innerHTML = `
        <div class="modal-content">
            <h2>Password Required</h2>
            <p>This file is password protected. Please enter the password to download.</p>
            <div class="form-group">
                <input type="password" id="downloadFilePassword" placeholder="Enter password" class="form-control">
            </div>
            <div class="modal-actions">
                <button id="submitDownloadPassword" class="btn primary">Download</button>
                <button id="cancelDownloadPassword" class="btn secondary">Cancel</button>
            </div>
        </div>
    `;
    
    // Add modal to the document
    document.body.appendChild(passwordModal);
    
    // Focus the password input
    document.getElementById('downloadFilePassword').focus();
    
    // Add event listeners
    document.getElementById('submitDownloadPassword').addEventListener('click', () => {
        const password = document.getElementById('downloadFilePassword').value;
        if (!password) {
            showToast("Please enter a password");
            return;
        }
        
        // Try to download with password
        processDownloadWithPassword(filename, password);
        
        // Remove the modal
        document.body.removeChild(passwordModal);
    });
    
    document.getElementById('cancelDownloadPassword').addEventListener('click', () => {
        // Remove the modal
        document.body.removeChild(passwordModal);
    });
    
    // Submit on Enter key
    document.getElementById('downloadFilePassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submitDownloadPassword').click();
        }
    });
    
    // Close when clicking outside
    passwordModal.addEventListener('click', function(event) {
        if (event.target === passwordModal) {
            document.body.removeChild(passwordModal);
        }
    });
}
// Separate function for processing download with password
function processDownloadWithPassword(filename, password) {
    console.log(`Processing download with password for file: ${filename}`);
    
    // First verify the password before proceeding with download
    const formData = new FormData();
    formData.append('password', password);
    
    // Show toast indicating verification in progress
    showToast("Verifying password...");
    
    fetch(`/api/admin/verify-password/${filename}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log(`Password verification response status: ${response.status}`);
        if (!response.ok) {
            throw new Error('Password verification failed');
        }
        return response.json();
    })
    .then(data => {
        console.log("Password verification response:", data);
        
        if (data.success) {
            console.log('Password verified successfully, proceeding with download');
            showToast("Password verified, starting download...");
            
            // Password is correct, proceed with download using a form
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
            
            setTimeout(() => {
                console.log("Submitting download form");
                form.submit();
                
                // Remove the form after submission
                setTimeout(() => {
                    document.body.removeChild(form);
                }, 2000);
            }, 500);
            
            // Log activity
            logActivity('file_download', `Downloaded password-protected file: ${filename}`);
        } else {
            console.error('Password verification returned success=false');
            showToast("Error verifying password. Please try again.");
            setTimeout(() => promptForDownloadPassword(filename), 1000);
        }
    })
    .catch(error => {
        console.error("Password verification failed:", error);
        showToast("Incorrect password. Please try again.");
        
        // Re-prompt for password
        setTimeout(() => {
            promptForDownloadPassword(filename);
        }, 1000);
    });
}

/**
 * Downloads a file with password handling
 * @param {number} fileId - The ID of the file to download
 * @param {string} filename - The filename of the file to download
 */
function downloadFile(fileId, filename) {
    console.log(`Attempting to download file: ${filename}`);
    
    // First check if the file requires a password
    fetch(`/api/admin/file-info/${filename}`)
        .then(response => response.json())
        .then(data => {
            if (data.isPasswordProtected) {
                // If password protected, prompt for password
                console.log('File is password protected, prompting for password');
                promptForDownloadPassword(filename);
            } else {
                // If not password protected, download directly
                console.log('File is not password protected, downloading directly');
                window.location.href = `/api/admin/download/${filename}`;
                // Log activity
                logActivity('file_download', `Downloaded file: ${filename}`);
            }
        })
        .catch(error => {
            console.error("Error checking file info:", error);
            showToast("Error checking file info. Please try again.");
        });
}

/**
 * Toggles a file as favorite/unfavorite
 * @param {number} fileId - The ID of the file to favorite/unfavorite
 * @param {boolean} currentState - The current favorite state
 */
function toggleFavorite(fileId, currentState) {
    fetch('/api/admin/toggle-favorite', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            file_id: fileId, 
            add_to_favorites: !currentState 
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Refresh the files list
            loadFilesTable(currentCategory, currentFileType, searchQuery);
            showToast(currentState ? 'Removed from favorites' : 'Added to favorites');
            
            // Log activity
            logActivity(
                currentState ? 'file_unfavorite' : 'file_favorite', 
                `${currentState ? 'Removed file from' : 'Added file to'} favorites`
            );
        } else {
            showToast(data.error || 'Error updating favorite status');
        }
    })
    .catch(error => {
        console.error('Error toggling favorite:', error);
        showToast('Error updating favorite status');
    });
}

/**
 * Restores a file from trash
 * @param {number} fileId - The ID of the file to restore
 */
function restoreFile(fileId) {
    fetch('/api/admin/restore-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_id: fileId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close the modal
            document.getElementById('restoreFileModal').style.display = 'none';
            
            // Refresh the files list
            loadFilesTable(currentCategory, currentFileType, searchQuery);
            showToast('File restored successfully');
            
            // Log activity
            logActivity('file_restore', 'Restored file from trash');
        } else {
            showToast(data.error || 'Error restoring file');
        }
    })
    .catch(error => {
        console.error('Error restoring file:', error);
        showToast('Error restoring file');
    });
}

/**
 * Deletes a file (move to trash or permanent)
 * @param {number} fileId - The ID of the file to delete
 * @param {boolean} permanent - Whether this is a permanent deletion
 */
function deleteFile(fileId, permanent) {
    const url = permanent 
        ? `/api/admin/permanent-delete-file/${fileId}`
        : `/api/admin/trash-file`;
    
    const method = permanent ? 'DELETE' : 'POST';
    const body = permanent ? null : JSON.stringify({ file_id: fileId });

    fetch(url, {
        method: method,
        headers: permanent ? {} : {
            'Content-Type': 'application/json'
        },
        body: body
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close the modal
            document.getElementById('deleteFileModal').style.display = 'none';
            
            // Refresh the files list
            loadFilesTable(currentCategory, currentFileType, searchQuery);
            
            showToast(permanent ? 'File permanently deleted' : 'File moved to trash');
            
            // Log activity
            logActivity(
                permanent ? 'file_permanent_delete' : 'file_trash',
                permanent ? 'Permanently deleted file' : 'Moved file to trash'
            );
        } else {
            showToast(data.error || 'Error deleting file');
        }
    })
    .catch(error => {
        console.error('Error deleting file:', error);
        showToast('Error deleting file');
    });
}

/**
 * Logs an activity to the server
 * @param {string} activityType - The type of activity
 * @param {string} description - Description of the activity
 * @param {number} fileId - Optional file ID associated with the activity
 */
function logActivity(activityType, description, fileId = null) {
    const data = {
        activity_type: activityType,
        description: description
    };
    
    if (fileId) {
        data.file_id = fileId;
    }
    
    fetch('/api/admin/log-activity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .catch(error => {
        console.error('Error logging activity:', error);
    });
}

/**
 * Loads departments and users for the sharing modals
 */
function loadDepartmentsAndUsersForShare() {
    // Load departments for sharing options in modal
    fetch('/api/admin/all-departments')
        .then(response => response.json())
        .then(data => {
            if (data.departments && data.departments.length > 0) {
                const shareDepartmentsModal = document.getElementById('shareDepartmentsModal');
                
                if (shareDepartmentsModal) {
                    shareDepartmentsModal.innerHTML = '';
                    data.departments.forEach(department => {
                        shareDepartmentsModal.innerHTML += `
                            <div class="checkbox-item">
                                <input type="checkbox" id="dept-modal-${department}" name="shareDeptModal" value="${department}">
                                <label for="dept-modal-${department}">${department}</label>
                            </div>
                        `;
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error loading departments for sharing:', error);
        });
    
    // Load users for sharing options in modal
    fetch('/api/admin/all-users')
        .then(response => response.json())
        .then(data => {
            if (data.users && data.users.length > 0) {
                const shareUsersModal = document.getElementById('shareUsersModal');
                
                if (shareUsersModal) {
                    shareUsersModal.innerHTML = '';
                    data.users.forEach(user => {
                        shareUsersModal.innerHTML += `
                            <div class="checkbox-item">
                                <input type="checkbox" id="user-modal-${user.id}" name="shareUserModal" value="${user.id}">
                                <label for="user-modal-${user.id}">${user.name} (${user.department || 'No Department'})</label>
                            </div>
                        `;
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error loading users for sharing:', error);
        });
}

/**
 * Returns the appropriate empty state message based on category
 * @param {string} category - The category of files
 * @returns {string} - The empty state message
 */
function getEmptyStateMessage(category) {
    switch(category) {
        case 'all':
            return 'No files available. Upload a file to get started.';
        case 'my-files':
            return 'You haven\'t uploaded any files yet. Click "Add File" to upload.';
        case 'shared':
            return 'You haven\'t shared any files with others yet.';
        case 'favorites':
            return 'You haven\'t marked any files as favorites yet.';
        case 'trash':
            return 'Your trash is empty.';
        default:
            return 'No files found.';
    }
}

/**
 * Gets the current user ID from session
 * @returns {number} - The current user ID
 */
function getCurrentUserId() {
    // This would normally come from session data
    // For now, we'll fetch it from API
    let userId = 0;
    
    // Synchronous request to get current user info
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/admin/current-user', false); // Synchronous request
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            userId = response.user_id;
        }
    };
    
    try {
        xhr.send();
    } catch (e) {
        console.error('Error fetching current user ID:', e);
    }
    
    return userId;
}

/**
 * Generates action buttons HTML based on file and category
 * @param {object} file - The file object
 * @param {string} category - The current category
 * @returns {string} - HTML for action buttons
 */
function getActionButtons(file, category) {
    const isOwner = file.uploaded_by_id === getCurrentUserId();
    const isFavorite = file.is_favorite;
    const isUserFile = file.uploader_role !== 'admin';
    
    // Base actions for all categories except trash
    if (category !== 'trash') {
        const favoriteClass = isFavorite ? 'active' : '';
        const favoriteIcon = isFavorite ? 'fas fa-star' : 'far fa-star';
        
        // Create display name for file (used in delete confirmation dialog)
        const displayName = file.filename.includes('_') ? 
            file.filename.split('_').slice(1).join('_') : file.filename;
        
        let buttons = `
            <button class="action-btn info" data-id="${file.id}" title="File Details">
                <i class="fas fa-info-circle"></i>
            </button>
            <button class="action-btn download" data-id="${file.id}" data-filename="${file.filename}" title="Download">
                <i class="fas fa-download"></i>
            </button>
            <button class="action-btn preview" data-id="${file.id}" data-filename="${file.filename}" data-type="${file.file_type || getFileTypeFromName(file.filename)}" title="Preview">
                <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn favorite ${favoriteClass}" data-id="${file.id}" title="${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}">
                <i class="${favoriteIcon}"></i>
            </button>
        `;
        
        // Add share button if user is owner and file is not private
        if (isOwner && !file.is_private) {
            buttons += `
                <button class="action-btn share" data-id="${file.id}" title="Share">
                    <i class="fas fa-share-alt"></i>
                </button>
            `;
        }
        
        // Add appropriate delete button based on file ownership
        if (isOwner) {
            // If admin owns the file, show regular delete button
            buttons += `
                <button class="action-btn delete" data-id="${file.id}" title="Move to Trash">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else if (isUserFile) {
            // If it's a user's file, show special delete-user-file button with distinctive styling
            buttons += `
                <button class="action-btn delete-user-file" data-id="${file.id}" data-filename="${displayName}" data-owner="${file.uploaded_by}" title="Delete User File">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
        }
        
        return buttons;
    } 
    // Special actions for trash
    else {
        return `
            <button class="action-btn info" data-id="${file.id}" title="File Details">
                <i class="fas fa-info-circle"></i>
            </button>
            <button class="action-btn preview" data-id="${file.id}" data-filename="${file.filename}" data-type="${file.file_type || getFileTypeFromName(file.filename)}" title="Preview">
                <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn restore" data-id="${file.id}" title="Restore File">
                <i class="fas fa-trash-restore"></i>
            </button>
            <button class="action-btn permanently-delete" data-id="${file.id}" title="Delete Permanently">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
    }
}


/**
 * Attaches event listeners to file action buttons
 * @param {string} category - The current file category
 */
function addFileActionListeners(category) {
    // Info button - shows file details
    document.querySelectorAll('.action-btn.info').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            showFileDetails(fileId);
        });
    });
    
    // Download button
    document.querySelectorAll('.action-btn.download').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            const filename = this.getAttribute('data-filename');
            downloadFile(fileId, filename);
        });
    });
    
    // Preview button - add this for all categories
    document.querySelectorAll('.action-btn.preview').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log("Preview button clicked");
            const fileId = this.getAttribute('data-id');
            const filename = this.getAttribute('data-filename');
            const fileType = this.getAttribute('data-type');
            console.log(`Preview clicked for file: ${filename}, type: ${fileType}, id: ${fileId}`);
            previewFile(fileId, filename, fileType);
        });
    });
    
    // Favorite/unfavorite button
    document.querySelectorAll('.action-btn.favorite').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            const isFavorite = this.classList.contains('active');
            toggleFavorite(fileId, isFavorite);
        });
    });
    
    // Share button
    document.querySelectorAll('.action-btn.share').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            showShareModal(fileId);
        });
    });
    
    // Delete button (move to trash)
    document.querySelectorAll('.action-btn.delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const fileId = this.getAttribute('data-id');
            showDeleteConfirmation(fileId, false);
        });
    });
    
    // If in trash category, add restore and permanent delete listeners
    if (category === 'trash') {
        // Restore button
        document.querySelectorAll('.action-btn.restore').forEach(btn => {
            btn.addEventListener('click', function() {
                const fileId = this.getAttribute('data-id');
                showRestoreConfirmation(fileId);
            });
        });
        
        // Permanent delete button
        document.querySelectorAll('.action-btn.permanently-delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const fileId = this.getAttribute('data-id');
                showDeleteConfirmation(fileId, true);
            });
        });
    }
}
/**
 * Loads the files table based on category, file type, and search query
 * @param {string} category - The category of files to load (all, my-files, shared, favorites, trash)
 * @param {string} fileType - The type of files to filter by (all, documents, images, videos, others)
 * @param {string} search - The search query for filtering files
 */
function loadFilesTable(category = 'all', fileType = 'all', search = '') {
    const filesList = document.getElementById('filesList');
    if (!filesList) {
        console.error('filesList element not found');
        return;
    }
    
    // Clear existing content
    filesList.innerHTML = '';
    
    // Show loading state
    filesList.innerHTML = '<tr><td colspan="7" class="loading-message">Loading files...</td></tr>';
    
    // Build query parameters
    let queryParams = [];
    
    // Always include category parameter (important for filtering)
    queryParams.push(`category=${encodeURIComponent(category)}`);
    
    if (fileType !== 'all') {
        queryParams.push(`type=${encodeURIComponent(fileType)}`);
    }
    
    if (search) {
        queryParams.push(`search=${encodeURIComponent(search)}`);
    }
    
    const queryString = queryParams.join('&');
    
    console.log(`Loading files with category=${category}, fileType=${fileType}, search=${search}`);
    console.log(`Full query string: ${queryString}`);
    
    // Fetch files from server
    fetch(`/api/admin/files?${queryString}`)
        .then(response => {
            console.log(`Server response status: ${response.status}`);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Clear loading message
            filesList.innerHTML = '';
            
            console.log(`Received ${data.files ? data.files.length : 0} files for category '${category}'`);
            
            // Display message if no files found
            if (!data.files || data.files.length === 0) {
                filesList.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="empty-state">
                                <i class="fas fa-folder-open"></i>
                                <h3>No files found</h3>
                                <p>${getEmptyStateMessage(category)}</p>
                            </div>
                        </td>
                    </tr>`;
                return;
            }
            
            // Populate table with files
            data.files.forEach(file => {
                const fileType = file.file_type || getFileTypeFromName(file.filename);
                const fileTypeIcon = getFileIcon(fileType);
                const row = document.createElement('tr');
                
                // Add data attributes for file info
                row.dataset.fileId = file.id;
                row.dataset.fileOwner = file.uploaded_by_id;
                
                // Add class to indicate if it's a user file 
                if (file.uploader_role !== 'admin') {
                    row.classList.add('user-owned');
                } else {
                    row.classList.add('admin-owned');
                }
                
                // Create display name (without timestamp prefix)
                const displayName = file.filename.includes('_') ? 
                    file.filename.split('_').slice(1).join('_') : file.filename;
                
                // Store displayName as data attribute for easy access by other functions
                row.dataset.displayName = displayName;
                
                // Create action buttons based on category
                const actionButtons = getActionButtons(file, category);
                
                // Add visual tag for user-owned files
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
                    <td>${file.size_formatted || 'Unknown'}</td>
                    <td>${fileType}</td>
                    <td>
                        <div class="user-info">
                            <span class="user-name">${file.uploaded_by || 'Unknown'}</span>
                            <span class="user-dept">${file.department || 'No Department'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="shared-with-info">
                            ${renderSharedWith(file.shared_with)}
                        </div>
                    </td>
                    <td>${file.date_formatted || formatDate(file.uploaded_at)}</td>
                    <td class="actions">
                        ${actionButtons}
                    </td>
                `;
                
                filesList.appendChild(row);
            });
            
            // Add event listeners to newly created action buttons
            addFileActionListeners(category);
            
            // Add event listeners for delete-user-file buttons
            document.querySelectorAll('.action-btn.delete-user-file').forEach(btn => {
                btn.addEventListener('click', function() {
                    const fileId = this.getAttribute('data-id');
                    const fileName = this.getAttribute('data-filename') || 'this file';
                    const ownerName = this.getAttribute('data-owner') || 'user';
                    
                    // Show custom confirmation dialog with enhanced warning
                    showDeleteUserFileConfirmation(fileId, fileName, ownerName);
                });
            });
            
            // Log activity
            logActivity('file_view', `Viewed ${category} files`);
        })
        .catch(error => {
            console.error('Error loading files:', error);
            filesList.innerHTML = `<tr><td colspan="7" class="error-message">Error loading files: ${error.message}</td></tr>`;
        });
}

/**
 * Loads departments and users for sharing options
 */
function loadDepartmentsAndUsers() {
    // Load departments for sharing options
    fetch('/api/admin/all-departments')
        .then(response => response.json())
        .then(data => {
            if (data.departments && data.departments.length > 0) {
                const shareDepartments = document.getElementById('shareDepartments');
                const shareDepartmentsModal = document.getElementById('shareDepartmentsModal');
                
                if (shareDepartments) {
                    shareDepartments.innerHTML = '';
                    data.departments.forEach(department => {
                        shareDepartments.innerHTML += `
                            <div class="checkbox-item">
                                <input type="checkbox" id="dept-${department}" name="shareDept" value="${department}">
                                <label for="dept-${department}">${department}</label>
                            </div>
                        `;
                    });
                }
                
                if (shareDepartmentsModal) {
                    shareDepartmentsModal.innerHTML = '';
                    data.departments.forEach(department => {
                        shareDepartmentsModal.innerHTML += `
                            <div class="checkbox-item">
                                <input type="checkbox" id="dept-modal-${department}" name="shareDeptModal" value="${department}">
                                <label for="dept-modal-${department}">${department}</label>
                            </div>
                        `;
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error loading departments:', error);
        });
    
    // Load users for sharing options
    fetch('/api/admin/all-users')
        .then(response => response.json())
        .then(data => {
            if (data.users && data.users.length > 0) {
                const shareUsers = document.getElementById('shareUsers');
                const shareUsersModal = document.getElementById('shareUsersModal');
                
                if (shareUsers) {
                    shareUsers.innerHTML = '';
                    data.users.forEach(user => {
                        shareUsers.innerHTML += `
                            <div class="checkbox-item">
                                <input type="checkbox" id="user-${user.id}" name="shareUser" value="${user.id}">
                                <label for="user-${user.id}">${user.name} (${user.department || 'No Department'})</label>
                            </div>
                        `;
                    });
                }
                
                if (shareUsersModal) {
                    shareUsersModal.innerHTML = '';
                    data.users.forEach(user => {
                        shareUsersModal.innerHTML += `
                            <div class="checkbox-item">
                                <input type="checkbox" id="user-modal-${user.id}" name="shareUserModal" value="${user.id}">
                                <label for="user-modal-${user.id}">${user.name} (${user.department || 'No Department'})</label>
                            </div>
                        `;
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
        });
}

// Document ready event handler to initialize everything
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');
    
    // Initialize file navigation
    initFileNavigation();
    
    // Initialize file filters
    initFileFilters();
    
    // Initialize file modals
    initFileModals();
    
    // Initialize add file functionality
    const addFileBtn = document.getElementById('addFileBtn');
    const addFileModal = document.getElementById('addFileModal');
    const cancelUpload = document.getElementById('cancelUpload');
    const fileUploadForm = document.getElementById('fileUploadForm');
    
    if (addFileBtn && addFileModal) {
        addFileBtn.addEventListener('click', function() {
            addFileModal.style.display = 'flex';
            
            // Load departments and users for sharing options if not already loaded
            loadDepartmentsAndUsers();
        });
    }
    
    if (cancelUpload) {
        cancelUpload.addEventListener('click', function() {
            addFileModal.style.display = 'none';
        });
    }
    
    if (fileUploadForm) {
        fileUploadForm.addEventListener('submit', handleFileUpload);
    }
    
    // Initialize expiration date toggle
    const expirationEnabled = document.getElementById('expirationEnabled');
    const expirationDate = document.getElementById('expirationDate');
    
    if (expirationEnabled && expirationDate) {
        expirationEnabled.addEventListener('change', function() {
            expirationDate.disabled = !this.checked;
        });
    }
    
    // Explicitly add preview event listeners
    document.querySelectorAll('.action-btn.preview').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log("Preview button clicked");
            const fileId = this.getAttribute('data-id');
            const filename = this.getAttribute('data-filename');
            const fileType = this.getAttribute('data-type');
            console.log(`Preview clicked for file: ${filename}, type: ${fileType}, id: ${fileId}`);
            previewFile(fileId, filename, fileType);
        });
    });
    
    // Log initial page load
    logActivity('page_view', 'Viewed files management page');
    
    // Make an immediate call to load the files table with default parameters
    console.log("Making initial call to load files table");
    loadFilesTable('all', 'all', '');
});
/**
 * Renders the shared with information for a file
 * @param {Object} sharedWith - Contains departments and users the file is shared with
 * @returns {string} - HTML for displaying sharing information
 */
function renderSharedWith(sharedWith) {
    if (!sharedWith || ((!sharedWith.departments || sharedWith.departments.length === 0) && 
                        (!sharedWith.users || sharedWith.users.length === 0))) {
        return '<span class="no-sharing">Not shared</span>';
    }
    
    let html = '';
    
    // Add departments if any
    if (sharedWith.departments && sharedWith.departments.length > 0) {
        html += '<div class="shared-departments">';
        html += '<span class="share-label">Departments:</span> ';
        html += sharedWith.departments.slice(0, 2).join(', ');
        if (sharedWith.departments.length > 2) {
            html += ` +${sharedWith.departments.length - 2} more`;
        }
        html += '</div>';
    }
    
    // Add users if any
    if (sharedWith.users && sharedWith.users.length > 0) {
        html += '<div class="shared-users">';
        html += '<span class="share-label">Users:</span> ';
        html += sharedWith.users.slice(0, 2).join(', ');
        if (sharedWith.users.length > 2) {
            html += ` +${sharedWith.users.length - 2} more`;
        }
        html += '</div>';
    }
    
    return html;
}

/**
 * Handles file preview with password protection
 * @param {string} fileId - The ID of the file to preview
 * @param {string} filename - The filename of the file to preview
 * @param {string} fileType - The type/extension of the file
 */
function previewFile(fileId, filename, fileType) {
    console.log(`Attempting to preview file: ${filename}, type: ${fileType}`);
    
    // Check if the file requires a password
    fetch(`/api/admin/file-info/${filename}`)
        .then(response => {
            console.log(`File info response status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log(`File info data:`, data);
            if (data.isPasswordProtected) {
                console.log(`File is password protected, showing password prompt`);
                // If password protected, prompt for password
                promptForPreviewPassword(filename, fileType);
            } else {
                console.log(`File is not password protected, showing preview directly`);
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
    // Remove any existing password modals first
    const existingModal = document.getElementById('passwordModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
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
    
    // Close when clicking outside 
    passwordModal.addEventListener('click', function(event) {
        if (event.target === passwordModal) {
            document.body.removeChild(passwordModal);
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
    console.log(`Verifying password for file: ${filename}`);
    
    // Create a form to submit the password
    const formData = new FormData();
    formData.append('password', password);
    
    // Verify password
    fetch(`/api/admin/verify-password/${filename}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log(`Password verification response status: ${response.status}`);
        if (!response.ok) {
            throw new Error('Password verification failed');
        }
        return response.json();
    })
    .then(data => {
        console.log(`Password verification result:`, data);
        if (data.success) {
            showPreviewModal(filename, fileType, password);
        } else {
            showToast("Error verifying password.");
        }
    })
    .catch(error => {
        console.error("Password verification failed:", error);
        showToast("Incorrect password. Please try again.");
        
        // Re-prompt for password
        setTimeout(() => {
            promptForPreviewPassword(filename, fileType);
        }, 1000);
    });
}

/**
 * Shows the preview modal for the file
 * @param {string} filename - The filename of the file to preview
 * @param {string} fileType - The type/extension of the file
 * @param {string} password - Optional password for protected files
 */
function showPreviewModal(filename, fileType, password = '') {
    console.log(`Showing preview modal for file: ${filename}, type: ${fileType}`);
    
    // Remove any existing preview modal first
    const existingModal = document.getElementById('previewModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
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
        // This is important - use the cached password for download
        if (password) {
            downloadWithPassword(filename, password);
        } else {
            downloadFile(null, filename);
        }
    });
    
    // Get the file extension from the filename
    const extension = fileType.toLowerCase() || filename.split('.').pop().toLowerCase();
    const previewContainer = previewModal.querySelector('.preview-container');
    
    // Generate the preview URL with password if needed
    let previewUrl = `/api/admin/preview/${filename}`;
    if (password) {
        previewUrl += `?password=${encodeURIComponent(password)}`;
    }
    
    console.log(`Preview URL: ${previewUrl}, File extension: ${extension}`);
    
    // Show appropriate preview based on file type
    if (['png', 'jpg', 'jpeg', 'gif', 'image'].includes(extension)) {
        // Image preview
        const img = document.createElement('img');
        img.className = 'file-preview-image';
        img.src = previewUrl;
        img.alt = 'File Preview';
        
        img.onload = function() {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
            console.log('Image preview loaded successfully');
        };
        
        img.onerror = function() {
            previewContainer.innerHTML = '<div class="preview-error">Error loading image preview</div>';
            console.error('Error loading image preview');
        };
    } else if (['pdf'].includes(extension)) {
        // PDF preview
        previewContainer.innerHTML = `
            <iframe class="file-preview-iframe" src="${previewUrl}" frameborder="0"></iframe>
        `;
        console.log('PDF preview loaded');
    } else if (['mp4', 'mov', 'avi', 'wmv', 'video'].includes(extension)) {
        // Video preview
        previewContainer.innerHTML = `
            <video class="file-preview-video" controls>
                <source src="${previewUrl}" type="video/${extension === 'mov' ? 'quicktime' : (extension === 'video' ? 'mp4' : extension)}">
                Your browser does not support the video tag.
            </video>
        `;
        console.log('Video preview loaded');
    } else if (['txt', 'csv', 'document'].includes(extension)) {
        // Text preview - fetch and display
        fetch(previewUrl)
            .then(response => response.text())
            .then(text => {
                previewContainer.innerHTML = `
                    <pre class="file-preview-text">${escapeHtml(text)}</pre>
                `;
                console.log('Text preview loaded successfully');
            })
            .catch(error => {
                previewContainer.innerHTML = '<div class="preview-error">Error loading text preview</div>';
                console.error('Error loading text preview:', error);
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
        console.log(`Preview not available for file type: ${extension}`);
    }
    
    // Add event listener to close when clicking outside
    previewModal.addEventListener('click', function(event) {
        if (event.target === previewModal) {
            document.body.removeChild(previewModal);
        }
    });
    
    // Log activity
    logActivity('file_preview', `Previewed file: ${filename.split('_').slice(1).join('_')}`);
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
// Add a new function to show the delete user file confirmation dialog
function showDeleteUserFileConfirmation(fileId, fileName, ownerName) {
    showConfirmDialog({
        title: "Delete User File",
        message: `Are you sure you want to delete the file "${fileName}" owned by ${ownerName}? This file will be permanently deleted and cannot be recovered.`,
        confirmButtonText: "Delete Permanently",
        cancelButtonText: "Cancel",
        confirmButtonClass: "btn danger",
        onConfirm: () => {
            // Show second confirmation for double safety
            showConfirmDialog({
                title: "CONFIRM PERMANENT DELETION",
                message: "WARNING: This action cannot be undone. The file will be permanently deleted and cannot be recovered by any means.",
                confirmButtonText: "Yes, Delete Permanently",
                cancelButtonText: "No, Keep File",
                confirmButtonClass: "btn danger",
                onConfirm: () => {
                    deleteUserFile(fileId, fileName, ownerName);
                }
            });
        }
    });
}
// Add the custom confirmation dialog function if it doesn't exist
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
    
    // Remove any existing dialog
    const existingDialog = document.querySelector('.confirm-dialog');
    if (existingDialog) {
        existingDialog.parentElement.remove();
    }
    
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

// Implementation of deleteUserFile function
function deleteUserFile(fileId, fileName, ownerName) {
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
                loadFilesTable(currentCategory, currentFileType, searchQuery);
            }
            
            // Log activity
            logActivity('admin_file_delete', `Deleted user file: ${fileName} owned by ${ownerName}`);
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

// Add CSS style for the delete-user-file button and the animations
const style = document.createElement('style');
style.textContent = `
/* Specific style for the delete user file button */
.action-btn.delete-user-file {
    background-color: #ff4d4f;
    color: white;
}

.action-btn.delete-user-file:hover {
    background-color: #ff1f1f;
}

/* Tag styling for user files */
.tag {
    display: inline-block;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 0.7rem;
    margin-left: 5px;
    vertical-align: middle;
}

.tag.user-file {
    background-color: #ffd591;
    color: #ad4e00;
}

/* File row styling */
.user-owned {
    background-color: rgba(255, 242, 230, 0.3);
}

.admin-owned {
    background-color: rgba(240, 248, 255, 0.2);
}

/* Animation for deletion */
.deleting-row {
    background-color: rgba(255, 77, 79, 0.2);
    transition: opacity 0.5s ease-out, background-color 0.3s ease-in;
}

.removing-row {
    opacity: 0;
}

/* Confirmation dialog styles */
.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1000;
}

.confirm-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1001;
    width: 400px;
    max-width: 90%;
}

.dialog-title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 15px;
    color: #ff4d4f;
}

.dialog-message {
    margin-bottom: 20px;
    line-height: 1.5;
}

.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

/* Toast message styles for different types */
.toast.error-toast {
    background-color: #ff4d4f;
    color: white;
}

.toast.success-toast {
    background-color: #52c41a;
    color: white;
}
`;

// Append the style to the document head
document.head.appendChild(style);

// Add styles for the user information in the table
const userInfoStyle = document.createElement('style');
userInfoStyle.textContent = `
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

/* Enhanced toast messages with different types */
.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.toast.show {
    opacity: 1;
}

.toast.success-toast {
    background-color: #52c41a;
}

.toast.error-toast {
    background-color: #ff4d4f;
}

.toast.warning-toast {
    background-color: #faad14;
}

.toast.info-toast {
    background-color: #1890ff;
}

.toast-icon {
    font-size: 1.2rem;
}

.toast-content {
    flex: 1;
}
`;

document.head.appendChild(userInfoStyle);
/**
 * Enhanced showToast function that supports different message types
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds to show the toast
 */
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    // Get or create toast container
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.left = '50%';
        toastContainer.style.transform = 'translateX(-50%)';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    if (!toast || !toastMessage) {
        // If toast elements don't exist, create a new one
        const newToast = document.createElement('div');
        newToast.id = 'toast-' + Date.now(); // Unique ID
        newToast.className = `toast ${type}-toast`;
        
        // Add appropriate icon based on type
        let icon = '';
        switch(type) {
            case 'success':
                icon = '<i class="fas fa-check-circle"></i>';
                break;
            case 'error':
                icon = '<i class="fas fa-exclamation-circle"></i>';
                break;
            case 'warning':
                icon = '<i class="fas fa-exclamation-triangle"></i>';
                break;
            case 'info':
                icon = '<i class="fas fa-info-circle"></i>';
                break;
            default:
                icon = '<i class="fas fa-bell"></i>';
        }
        
        newToast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <p>${message}</p>
            </div>
        `;
        
        toastContainer.appendChild(newToast);
        
        // Show the toast
        setTimeout(() => {
            newToast.classList.add('show');
            setTimeout(() => {
                newToast.classList.remove('show');
                setTimeout(() => {
                    if (newToast.parentNode) {
                        newToast.parentNode.removeChild(newToast);
                    }
                }, 300);
            }, duration);
        }, 10);
    } else {
        // Use existing toast elements
        toast.className = `toast ${type}-toast`;
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        // Auto-hide toast after the duration
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
}

// Add styles for enhanced toast notifications
const toastStyles = document.createElement('style');
toastStyles.textContent = `
#toast-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
}

.toast {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16);
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    min-width: 250px;
    max-width: 350px;
}

.toast.show {
    opacity: 1;
    transform: translateY(0);
}

.toast-icon {
    margin-right: 12px;
    font-size: 18px;
}

.toast-content {
    flex: 1;
}

.toast-content p {
    margin: 0;
    line-height: 1.4;
}

.toast.success-toast {
    background-color: #f6ffed;
    border: 1px solid #b7eb8f;
    color: #52c41a;
}

.toast.error-toast {
    background-color: #fff2f0;
    border: 1px solid #ffccc7;
    color: #ff4d4f;
}

.toast.warning-toast {
    background-color: #fffbe6;
    border: 1px solid #ffe58f;
    color: #faad14;
}

.toast.info-toast {
    background-color: #e6f7ff;
    border: 1px solid #91d5ff;
    color: #1890ff;
}
`;

document.head.appendChild(toastStyles);