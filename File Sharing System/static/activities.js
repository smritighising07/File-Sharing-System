document.addEventListener('DOMContentLoaded', function () {
    // Global variables
    let activities = [];
    let filteredActivities = [];
    let currentPage = 1;
    const activitiesPerPage = 10;
    let totalPages = 0;
    let allUsers = [];
    let allDepartments = [];

    // DOM elements
    const pageNumbers = document.getElementById('pageNumbers');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentRangeEl = document.getElementById('currentRange');
    const totalItemsEl = document.getElementById('totalItems');

    // Filters
    const timeRangeFilter = document.getElementById('timeRange');
    const activityTypeFilter = document.getElementById('activityType');
    const userFilter = document.getElementById('userFilter');
    const departmentFilter = document.getElementById('departmentFilter');
    const searchInput = document.getElementById('activitySearch');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const customDateRange = document.getElementById('customDateRange');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const applyDateRangeBtn = document.getElementById('applyDateRange');

    // Export
    const exportBtn = document.getElementById('exportActivities');
    const exportModal = document.getElementById('exportModal');
    const cancelExportBtn = document.getElementById('cancelExport');
    const exportForm = document.getElementById('exportForm');

    // Modal for clearing activities
    const clearActivitiesBtn = document.getElementById('clearActivities');
    const clearActivitiesModal = document.getElementById('clearActivitiesModal');
    const cancelClearActivitiesBtn = document.getElementById('cancelClearActivities');
    const confirmClearActivitiesBtn = document.getElementById('confirmClearActivities');

    // Detail Modal
    const activityDetailModal = document.getElementById('activityDetailModal');
    const closeDetailModalBtn = document.getElementById('closeDetailModal');

    // Toast
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    // Initialize
    init();

    // Functions
    function init() {
        // Set default dates for custom range
        const today = new Date();
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);

        startDateInput.value = formatDateForInput(lastWeek);
        endDateInput.value = formatDateForInput(today);

        // Load activities
        fetchActivities();

        // Load users and departments
        fetchUsers();
        fetchDepartments();

        // Load current user
        fetchCurrentUser();

        // Add event listeners
        addEventListeners();
    }

    function fetchActivities() {
        // Show loading state
        activitiesList.innerHTML = '<tr><td colspan="6" class="text-center">Loading activities...</td></tr>';

        // Get filter values
        const timeRange = timeRangeFilter.value;
        const activityType = activityTypeFilter.value;
        const user = userFilter.value;
        const department = departmentFilter.value;
        const searchTerm = searchInput.value.trim();

        // Build filter parameters
        let params = new URLSearchParams();

        if (timeRange === 'custom') {
            params.append('start_date', startDateInput.value);
            params.append('end_date', endDateInput.value);
        } else {
            params.append('timeframe', timeRange);
        }

        if (activityType !== 'all') {
            params.append('activity_type', activityType);
        }

        if (user !== 'all') {
            params.append('user_id', user);
        }

        if (department !== 'all') {
            params.append('department', department);
        }

        if (searchTerm) {
            params.append('search', searchTerm);
        }

        // Debug
        console.log('Fetching activities with params:', params.toString());

        // Fetch activities from server
        fetch(`/api/admin/activities?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch activities');
                }
                return response.json();
            })
            .then(data => {
                console.log('Received activities data:', data);
                console.log('Number of activities:', data.activities ? data.activities.length : 0);

                activities = data.activities || [];
                filteredActivities = [...activities];

                // Debug - log first 3 activities
                if (activities.length > 0) {
                    console.log('First 3 activities:', activities.slice(0, 3));
                }

                updatePagination();
                renderActivities();
            })
            .catch(error => {
                console.error('Error fetching activities:', error);
                showToast('Error loading activities. Please try again.', 'error');
                activitiesList.innerHTML = `<tr><td colspan="6" class="text-center">
                    Error loading activities. <button class="btn-link retry-btn">Try again</button>
                </td></tr>`;

                // Add event listener to retry button
                const retryBtn = activitiesList.querySelector('.retry-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', fetchActivities);
                }
            });
    }
    // Find the renderActivities function and modify it to remove IP address column
    function renderActivities() {
        // If no activities
        if (filteredActivities.length === 0) {
            activitiesList.innerHTML = '<tr><td colspan="5" class="text-center">No activities found</td></tr>';
            return;
        }

        // Calculate slice indexes
        const startIndex = (currentPage - 1) * activitiesPerPage;
        const endIndex = Math.min(startIndex + activitiesPerPage, filteredActivities.length);

        // Update pagination info
        currentRangeEl.textContent = `${startIndex + 1}-${endIndex}`;
        totalItemsEl.textContent = filteredActivities.length;

        // Get current page activities
        const currentActivities = filteredActivities.slice(startIndex, endIndex);

        // Clear table
        activitiesList.innerHTML = '';

        // Render activities
        currentActivities.forEach(activity => {
            const row = document.createElement('tr');
            row.dataset.activityId = activity.id;
            row.addEventListener('click', () => showActivityDetails(activity));

            // Format date
            const activityDate = new Date(activity.timestamp);
            const formattedDate = activityDate.toLocaleString();

            // Determine badge class and icon based on activity_type
            let badgeClass = '';
            let iconClass = '';

            // Map activity details to specific classes for styling
            const activityDetails = (activity.details || '').toLowerCase();

            if (activityDetails.includes('viewed files management page')) {
                badgeClass = 'files_management_view';
                iconClass = 'fa-folder-open';
            } else if (activityDetails.includes('viewed all files')) {
                badgeClass = 'viewed_all_files';
                iconClass = 'fa-eye';
            } else if (activityDetails.includes('viewed my files') || activityDetails.includes('view my files')) {
                badgeClass = 'my_files_view';
                iconClass = 'fa-folder-open';
            } else if (activityDetails.includes('moved file to trash')) {
                badgeClass = 'move_to_trash';
                iconClass = 'fa-trash-alt';
            } else if (activityDetails.includes('login verification code')) {
                badgeClass = 'login_verification';
                iconClass = 'fa-shield-alt';
            } else if (activityDetails.includes('added file to favorites')) {
                badgeClass = 'favorite_add';
                iconClass = 'fa-star';
            } else if (activityDetails.includes('removed file from favorites')) {
                badgeClass = 'favorite_remove';
                iconClass = 'fa-star-half-alt';
            } else if (activityDetails.includes('view details for file')) {
                badgeClass = 'file_details_view';
                iconClass = 'fa-file-alt';
            } else if (activityDetails.includes('viewed favorites')) {
                badgeClass = 'favorite_add';
                iconClass = 'fa-star';
            } else if (activityDetails.includes('viewed trash') || activityDetails.includes('trash files')) {
                badgeClass = 'trash_view';
                iconClass = 'fa-trash';
            } else if (activityDetails.includes('restored file')) {
                badgeClass = 'file_restore';
                iconClass = 'fa-undo';
            } else if (activityDetails.includes('permanently deleted')) {
                badgeClass = 'permanent_delete';
                iconClass = 'fa-trash-alt';
            } else if (activityDetails.includes('shared files') || activityDetails.includes('viewed shared')) {
                badgeClass = 'shared_files_view';
                iconClass = 'fa-share-alt';
            } else if (activityDetails.includes('page view') || activityDetails.includes('viewed page')) {
                badgeClass = 'page_view';
                iconClass = 'fa-file';
            } else {
                // Default cases from the original code
                switch (activity.activity_type) {
                    case 'login':
                        badgeClass = 'login';
                        iconClass = 'fa-sign-in-alt';
                        break;
                    case 'logout':
                        badgeClass = 'logout';
                        iconClass = 'fa-sign-out-alt';
                        break;
                    case 'file_upload':
                        badgeClass = 'file_upload';
                        iconClass = 'fa-upload';
                        break;
                    case 'file_download':
                        badgeClass = 'file_download';
                        iconClass = 'fa-download';
                        break;
                    case 'file_share':
                        badgeClass = 'file_share';
                        iconClass = 'fa-share-alt';
                        break;
                    case 'file_delete':
                        badgeClass = 'file_delete';
                        iconClass = 'fa-trash-alt';
                        break;
                    case 'user_create':
                        badgeClass = 'user_create';
                        iconClass = 'fa-user-plus';
                        break;
                    case 'user_update':
                        badgeClass = 'user_update';
                        iconClass = 'fa-user-edit';
                        break;
                    case 'user_delete':
                        badgeClass = 'user_delete';
                        iconClass = 'fa-user-minus';
                        break;
                    default:
                        badgeClass = '';
                        iconClass = 'fa-info-circle';
                }
            }

            // Build table row - MODIFIED: Removed IP address column
            row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${activity.user_name || 'Unknown'}</td>
            <td>${activity.department || 'N/A'}</td>
            <td>
                <span class="activity-type-badge ${badgeClass}">
                    <i class="fas ${iconClass} activity-icon"></i>
                    ${formatActivityType(activity.activity_type) || formatActivityLabel(activity.details)}
                </span>
            </td>
            <td>${activity.details || 'No details'}</td>
        `;

            activitiesList.appendChild(row);
        });
    }

    // Helper function to format activity labels based on details
    function formatActivityLabel(details) {
        if (!details) return 'Activity';

        if (details.includes('viewed files management page')) {
            return 'Page View';
        } else if (details.includes('viewed all files')) {
            return 'View All Files';
        } else if (details.includes('viewed my files') || details.includes('view my files')) {
            return 'My Files';
        } else if (details.includes('moved file to trash')) {
            return 'Move to Trash';
        } else if (details.includes('login verification code')) {
            return 'Verification';
        } else if (details.includes('added file to favorites')) {
            return 'Add to Favorites';
        } else if (details.includes('removed file from favorites')) {
            return 'Remove from Favorites';
        } else if (details.includes('view details for file')) {
            return 'View File Details';
        } else if (details.includes('viewed favorites')) {
            return 'View Favorites';
        } else if (details.includes('trash files') || details.includes('viewed trash')) {
            return 'View Trash';
        } else if (details.includes('restored file')) {
            return 'File Restore';
        } else if (details.includes('permanently deleted')) {
            return 'Permanent Delete';
        } else if (details.includes('shared files') || details.includes('viewed shared')) {
            return 'Shared Files';
        }

        // Default label - capitalize first letter of each word
        return details.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .substring(0, 20) + (details.length > 20 ? '...' : '');
    }
    function updatePagination() {
        totalPages = Math.ceil(filteredActivities.length / activitiesPerPage);

        // Update pagination controls
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

        // Render page numbers
        pageNumbers.innerHTML = '';

        // If only a few pages, show all
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.appendChild(createPageButton(i));
            }
        } else {
            // Show first page, current page, and last page with ellipsis
            pageNumbers.appendChild(createPageButton(1));

            // Add ellipsis for many pages
            if (currentPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }

            // Show a window around current page
            const startPage = Math.max(2, currentPage - 1);
            const endPage = Math.min(totalPages - 1, currentPage + 1);

            for (let i = startPage; i <= endPage; i++) {
                if (i > 1 && i < totalPages) {
                    pageNumbers.appendChild(createPageButton(i));
                }
            }

            // Add ellipsis for many pages
            if (currentPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }

            // Add last page if we have multiple pages
            if (totalPages > 1) {
                pageNumbers.appendChild(createPageButton(totalPages));
            }
        }
    }

    function createPageButton(pageNum) {
        const pageBtn = document.createElement('div');
        pageBtn.className = `page-number ${pageNum === currentPage ? 'active' : ''}`;
        pageBtn.textContent = pageNum;
        pageBtn.addEventListener('click', () => {
            if (pageNum !== currentPage) {
                currentPage = pageNum;
                renderActivities();
                updatePagination();
            }
        });
        return pageBtn;
    }

    function fetchUsers() {
        fetch('/api/admin/all-users')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch users');
                }
                return response.json();
            })
            .then(data => {
                allUsers = data.users || [];
                populateUserFilter();
            })
            .catch(error => {
                console.error('Error fetching users:', error);
            });
    }

    function fetchDepartments() {
        fetch('/api/admin/all-departments')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch departments');
                }
                return response.json();
            })
            .then(data => {
                allDepartments = data.departments || [];
                populateDepartmentFilter();
            })
            .catch(error => {
                console.error('Error fetching departments:', error);
            });
    }

    function fetchCurrentUser() {
        fetch('/api/admin/current-user')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch current user');
                }
                return response.json();
            })
            .then(data => {
                // Update user display
                const currentUserEl = document.getElementById('currentUser');
                if (currentUserEl && data.name) {
                    currentUserEl.textContent = data.name;
                }
            })
            .catch(error => {
                console.error('Error fetching current user:', error);
            });
    }

    function populateUserFilter() {
        userFilter.innerHTML = '<option value="all" selected>All Users</option>';

        allUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            userFilter.appendChild(option);
        });
    }

    function populateDepartmentFilter() {
        departmentFilter.innerHTML = '<option value="all" selected>All Departments</option>';

        allDepartments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentFilter.appendChild(option);
        });
    }

    function formatActivityType(type) {
        if (!type) return 'Unknown';

        // Replace underscores with spaces and capitalize each word
        return type.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function showToast(message, type = 'success') {
        toastMessage.textContent = message;

        // Set icon based on type
        const toastIcon = toast.querySelector('.toast-icon i');
        toastIcon.className = type === 'error'
            ? 'fas fa-exclamation-circle'
            : 'fas fa-check-circle';

        if (type === 'error') {
            toast.querySelector('.toast-icon').classList.add('error');
        } else {
            toast.querySelector('.toast-icon').classList.remove('error');
        }

        // Show toast
        toast.classList.remove('hide');
        toast.classList.add('show');

        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
        }, 3000);
    }
    //
    function showActivityDetails(activity) {
        // Populate modal with activity details
        document.getElementById('detailActivityId').textContent = activity.id;
        document.getElementById('detailDateTime').textContent = new Date(activity.timestamp).toLocaleString();
        document.getElementById('detailUser').textContent = activity.user_name || 'Unknown';
        document.getElementById('detailDepartment').textContent = activity.department || 'N/A';
        document.getElementById('detailType').textContent = formatActivityType(activity.activity_type);
        document.getElementById('detailDescription').textContent = activity.details || 'No description available';
        // IP Address field has been removed
        
        // Show/hide sections based on activity type
        const fileSection = document.getElementById('fileDetailsSection');
        const shareSection = document.getElementById('shareDetailsSection');
        
        // Reset sections visibility
        fileSection.style.display = 'none';
        shareSection.style.display = 'none';
        
        // Show file details if applicable
        if (activity.file_id && (
            activity.activity_type === 'file_upload' || 
            activity.activity_type === 'file_download' || 
            activity.activity_type === 'file_delete'
        )) {
            fileSection.style.display = 'block';
            document.getElementById('detailFilename').textContent = activity.filename || 'Unknown';
            document.getElementById('detailFileSize').textContent = activity.file_size_formatted || 'Unknown';
            document.getElementById('detailFileType').textContent = activity.file_type || 'Unknown';
        }
        
        // Show share details if applicable
        if (activity.activity_type === 'file_share') {
            shareSection.style.display = 'block';
            document.getElementById('detailSharedWith').textContent = activity.shared_with || 'Unknown';
            document.getElementById('detailPermissions').textContent = activity.permissions || 'Standard access';
        }
        
        // Show the modal
        activityDetailModal.classList.add('show');
    }
    function addEventListeners() {
        // Pagination controls
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderActivities();
                updatePagination();
            }
        });

        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderActivities();
                updatePagination();
            }
        });

        // Filter change events
        timeRangeFilter.addEventListener('change', () => {
            if (timeRangeFilter.value === 'custom') {
                customDateRange.style.display = 'flex';
            } else {
                customDateRange.style.display = 'none';
                fetchActivities();
            }
        });

        activityTypeFilter.addEventListener('change', fetchActivities);
        userFilter.addEventListener('change', fetchActivities);
        departmentFilter.addEventListener('change', fetchActivities);

        // Custom date range
        applyDateRangeBtn.addEventListener('click', fetchActivities);

        // Search
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(fetchActivities, 500);
        });

        // Reset filters
        resetFiltersBtn.addEventListener('click', () => {
            timeRangeFilter.value = 'week';
            activityTypeFilter.value = 'all';
            userFilter.value = 'all';
            departmentFilter.value = 'all';
            searchInput.value = '';
            customDateRange.style.display = 'none';

            fetchActivities();
        });

        // Export activities
        exportBtn.addEventListener('click', () => {
            exportModal.classList.add('show');
        });

        cancelExportBtn.addEventListener('click', () => {
            exportModal.classList.remove('show');
        });

        exportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            exportActivities();
            exportModal.classList.remove('show');
        });

        // Activity detail modal
        closeDetailModalBtn.addEventListener('click', () => {
            activityDetailModal.classList.remove('show');
        });

        // Clear activities functionality
        clearActivitiesBtn.addEventListener('click', () => {
            // Show confirmation modal
            clearActivitiesModal.classList.add('show');
        });

        cancelClearActivitiesBtn.addEventListener('click', () => {
            clearActivitiesModal.classList.remove('show');
        });

        // FIX: Use the clearActivities function that's defined within this scope
        confirmClearActivitiesBtn.addEventListener('click', clearActivities);

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === exportModal) {
                exportModal.classList.remove('show');
            }
            if (e.target === activityDetailModal) {
                activityDetailModal.classList.remove('show');
            }
            if (e.target === clearActivitiesModal) {
                clearActivitiesModal.classList.remove('show');
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                exportModal.classList.remove('show');
                activityDetailModal.classList.remove('show');
                clearActivitiesModal.classList.remove('show');
            }
        });
    }

    function exportActivities() {
        const format = document.getElementById('exportFormat').value;
        const dateRange = document.getElementById('exportDateRange').value;
        const includeIp = document.getElementById('includeIpAddresses').checked;

        // Build export parameters
        let params = new URLSearchParams();
        params.append('format', format);

        if (dateRange === 'current') {
            // Use current filters
            const timeRange = timeRangeFilter.value;
            const activityType = activityTypeFilter.value;
            const user = userFilter.value;
            const department = departmentFilter.value;

            if (timeRange === 'custom') {
                params.append('start_date', startDateInput.value);
                params.append('end_date', endDateInput.value);
            } else {
                params.append('timeframe', timeRange);
            }

            if (activityType !== 'all') {
                params.append('activity_type', activityType);
            }

            if (user !== 'all') {
                params.append('user_id', user);
            }

            if (department !== 'all') {
                params.append('department', department);
            }
        } else {
            params.append('timeframe', dateRange);
        }

        params.append('include_ip', includeIp);

        // Create export URL
        const exportUrl = `/api/admin/export-activities?${params.toString()}`;

        // Create a temporary link and trigger download
        const a = document.createElement('a');
        a.href = exportUrl;
        a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast('Export started. Your file will download shortly.');
    }

    // FIX: Moving clearActivities function inside the DOMContentLoaded scope
    // so it has access to all required variables
    function clearActivities() {
        // Show loading state in the confirmation modal
        confirmClearActivitiesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        confirmClearActivitiesBtn.disabled = true;

        // Get filter values to potentially clear only filtered activities
        const timeRange = timeRangeFilter.value;
        const activityType = activityTypeFilter.value;
        const user = userFilter.value;
        const department = departmentFilter.value;
        const searchTerm = searchInput.value.trim();

        // Build filter parameters
        let params = new URLSearchParams();

        if (timeRange === 'custom') {
            params.append('start_date', startDateInput.value);
            params.append('end_date', endDateInput.value);
        } else {
            params.append('timeframe', timeRange);
        }

        if (activityType !== 'all') {
            params.append('activity_type', activityType);
        }

        if (user !== 'all') {
            params.append('user_id', user);
        }

        if (department !== 'all') {
            params.append('department', department);
        }

        if (searchTerm) {
            params.append('search', searchTerm);
        }

        // Send DELETE request to clear activities
        fetch(`/api/admin/clear-activities?${params.toString()}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to clear activities');
                }
                return response.json();
            })
            .then(data => {
                // Close the modal
                clearActivitiesModal.classList.remove('show');

                // Show success message
                showToast(data.message || 'Activities cleared successfully');

                // Refresh the activities list
                fetchActivities();
            })
            .catch(error => {
                console.error('Error clearing activities:', error);
                showToast('Error clearing activities. Please try again.', 'error');
            })
            .finally(() => {
                // Reset button state
                confirmClearActivitiesBtn.innerHTML = 'Clear All Logs';
                confirmClearActivitiesBtn.disabled = false;
            });
    }
});