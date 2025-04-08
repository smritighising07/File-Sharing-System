// users_management.js - Dedicated JavaScript file for user management functionality

document.addEventListener('DOMContentLoaded', function() {
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
});

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
                
                row.innerHTML = `
                    <td>${escapeHtml(user.name)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.department || 'None')}</td>
                    <td>${user.role === 'admin' ? 'Admin' : 'User'}</td>
                    <td><span class="status-badge status-active">Active</span></td>
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
        role: document.getElementById('userRole').value
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
 * Formats a timestamp into a "time ago" string
 * @param {string} timestamp - ISO date string
 * @returns {string} - Formatted "time ago" string
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000); // Difference in seconds
    
    if (diff < 60) {
        return 'Just now';
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
        return time.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
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
 * Shows a toast notification
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