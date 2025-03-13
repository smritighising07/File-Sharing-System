// DOM Elements
const uploadBtn = document.getElementById("uploadBtn");
const uploadModal = document.getElementById("uploadModal");
const cancelUploadBtn = document.getElementById("cancelUpload");
const uploadForm = document.getElementById("uploadForm");
const filesGrid = document.getElementById("filesGrid");
const filterType = document.getElementById("filterType");
const searchBar = document.querySelector(".search-bar");
// File preview
const previewModal = document.getElementById("previewModal");
const closePreviewBtn = document.getElementById("closePreviewBtn");
const downloadPreviewBtn = document.getElementById("downloadPreviewBtn");
const downloadInsteadBtn = document.getElementById("downloadInsteadBtn");
const previewContent = document.getElementById("previewContent");
const previewLoader = document.getElementById("previewLoader");
const previewError = document.getElementById("previewError");
const previewFileName = document.getElementById("previewFileName");

// File type mappings
const FILE_TYPES = {
    documents: [".pdf", ".docx", ".xlsx", ".txt", ".doc"],
    images: [".jpg", ".jpeg", ".png", ".gif"],
    videos: [".mp4", ".mov", ".avi", ".wmv"],
};

// File size and upload validation
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_FILE_SIZE_READABLE = '5 GB';
// Valid file types for preview
const PREVIEWABLE_TYPES = {
    documents: [".pdf", ".docx", ".xlsx", ".txt", ".doc", ".log"],
    images: [".jpg", ".jpeg", ".png", ".gif"],
    videos: [".mp4", ".mov", ".avi", ".wmv"],
    text: [".txt", ".log"]
};

// Function to determine file type from extension
function getFileType(filename) {
    const ext = "." + filename.split(".").pop().toLowerCase();
    for (const [type, extensions] of Object.entries(FILE_TYPES)) {
        if (extensions.includes(ext)) return type;
    }
    return "other";
}

// Function to check if a file is previewable
function isPreviewable(filename) {
    const ext = "." + filename.split(".").pop().toLowerCase();
    for (const [type, extensions] of Object.entries(PREVIEWABLE_TYPES)) {
        if (extensions.includes(ext)) return type;
    }
    return false;
}
// Update file display dynamically
function updateFilesList(files) {
    filesGrid.innerHTML = "";

    if (!files || files.length === 0) {
        const noFilesEl = document.createElement("div");
        noFilesEl.classList.add("no-files");
        noFilesEl.textContent = "No files found";
        filesGrid.appendChild(noFilesEl);
        return;
    }

    files.forEach((file) => {
        const fileType = getFileType(file.filename);
        const fileExt = file.filename.split(".").pop().toUpperCase();
        const uploadDate = new Date(file.uploaded_at).toLocaleDateString() + " " + 
                          new Date(file.uploaded_at).toLocaleTimeString();
        
        // Get shortened filename (remove timestamp prefix if present)
        let displayName = file.filename;
        if (displayName.includes('_')) {
            const parts = displayName.split('_');
            if (parts.length > 1) {
                // Skip timestamp part
                displayName = parts.slice(1).join('_');
            }
        }

        // Create file card
        const fileCard = document.createElement("div");
        fileCard.classList.add("file-card");
        fileCard.dataset.fileId = file.id; // Store file ID in dataset for easy access

        // File Icon
        const fileIcon = document.createElement("div");
        fileIcon.classList.add("file-icon");
        const icon = document.createElement("i");
        icon.classList.add("fas", getIconClass(fileType));
        fileIcon.appendChild(icon);

        // File Info
        const fileInfo = document.createElement("div");
        fileInfo.classList.add("file-info");

        const fileName = document.createElement("h3");
        fileName.classList.add("file-name");
        fileName.textContent = displayName;
        fileName.title = displayName; // Add tooltip on hover

        const fileDate = document.createElement("p");
        fileDate.classList.add("file-date");
        fileDate.textContent = `Uploaded: ${uploadDate}`;

        // Department info
        const deptInfo = document.createElement("p");
        deptInfo.classList.add("file-department");
        deptInfo.textContent = `Dept: ${file.uploaded_by_department || 'Unknown'}`;
        
        // Add shared by info if available (for "Shared with Me" view)
        if (file.shared_by_name) {
            const sharedByInfo = document.createElement("p");
            sharedByInfo.classList.add("file-shared-by");
            sharedByInfo.textContent = `Shared by: ${file.shared_by_name}`;
            fileInfo.appendChild(sharedByInfo);
        }
        
        // Add shared with info if available (for "My Shares" view)
        if (file.shared_department && filterType.value === "my-shares") {
            const sharedWithInfo = document.createElement("p");
            sharedWithInfo.classList.add("file-shared-with");
            sharedWithInfo.textContent = `Shared with: ${file.shared_department} Dept`;
            fileInfo.appendChild(sharedWithInfo);
        }
        
        // Favorited date if available
        if (file.favorited_at) {
            const favoritedInfo = document.createElement("p");
            favoritedInfo.classList.add("file-favorited");
            const favDate = new Date(file.favorited_at).toLocaleDateString();
            favoritedInfo.textContent = `Favorited: ${favDate}`;
            fileInfo.appendChild(favoritedInfo);
        }
        
        // File type badge
        const fileTypeSpan = document.createElement("span");
        fileTypeSpan.classList.add("file-type");
        fileTypeSpan.textContent = fileExt;

        // Owner badge if applicable
        if (file.is_owner) {
            const ownerBadge = document.createElement("span");
            ownerBadge.classList.add("owner-badge");
            ownerBadge.textContent = "Owner";
            fileInfo.appendChild(ownerBadge);
        }

        fileInfo.append(fileName, fileDate, deptInfo, fileTypeSpan);

        // File Actions with three-dots menu
        const fileActions = document.createElement("div");
        fileActions.classList.add("file-actions");

        // Create three dots menu button
        const menuBtn = document.createElement("button");
        menuBtn.classList.add("menu-btn");
        menuBtn.setAttribute("title", "More options");
        menuBtn.innerHTML = `<i class="fas fa-ellipsis-vertical"></i>`;

        // Create dropdown menu
        const dropdownMenu = document.createElement("div");
        dropdownMenu.classList.add("dropdown-menu");
        dropdownMenu.classList.add("hidden");

        // Preview button in dropdown
        const previewBtn = document.createElement("button");
        previewBtn.classList.add("dropdown-item");
        previewBtn.innerHTML = `<i class="fas fa-eye"></i> Preview`;
        previewBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            previewFile(file.filename, displayName);
        });

        // Download button in dropdown
        const downloadBtn = document.createElement("button");
        downloadBtn.classList.add("dropdown-item");
        downloadBtn.innerHTML = `<i class="fas fa-download"></i> Download`;
        downloadBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            downloadFile(file.filename);
        });

        // Favorite/Unfavorite button in dropdown
        const favoriteBtn = document.createElement("button");
        favoriteBtn.classList.add("dropdown-item");
        
        // Change button text based on current view and favorite status
        if (filterType.value === "favorites" || file.favorited_at) {
            favoriteBtn.innerHTML = `<i class="fas fa-star"></i> Remove from Favorites`;
            favoriteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                removeFromFavorites(file.id);
            });
        } else {
            favoriteBtn.innerHTML = `<i class="fas fa-star"></i> Add to Favorites`;
            favoriteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                addToFavorites(file.id);
            });
        }

        // Delete button in dropdown
        const deleteBtn = document.createElement("button");
        deleteBtn.classList.add("dropdown-item");
        deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Delete`;
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            // Implement delete functionality
            if (confirm("Are you sure you want to delete this file?")) {
                alert("File deleted");
                // Add actual delete implementation here
            }
        });

        // Add buttons to dropdown
        dropdownMenu.append(previewBtn, downloadBtn, favoriteBtn, deleteBtn);

        // Toggle dropdown when clicking menu button
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle("hidden");
            
            // Close all other open dropdowns
            document.querySelectorAll(".dropdown-menu:not(.hidden)").forEach(menu => {
                if (menu !== dropdownMenu) {
                    menu.classList.add("hidden");
                }
            });
        });

        fileActions.append(menuBtn, dropdownMenu);

        // Append all elements to fileCard
        fileCard.append(fileIcon, fileInfo, fileActions);
        filesGrid.appendChild(fileCard);
    });
}

// Preview file function
async function previewFile(filename, displayName) {
    // Set the preview filename
    previewFileName.textContent = displayName || filename;
    
    // Store the filename for the download button
    downloadPreviewBtn.dataset.filename = filename;
    downloadInsteadBtn.dataset.filename = filename;
    
    // Reset preview content
    previewContent.innerHTML = '';
    
    // Show the preview modal
    previewModal.classList.add("active");
    
    // Show loading indicator
    previewLoader.classList.remove("hidden");
    previewContent.classList.add("hidden");
    previewError.classList.add("hidden");
    
    // Check if we can preview this file type
    const previewType = isPreviewable(filename);
    
    console.log("Preview Type:", previewType); // Debugging log
    
    if (!previewType) {
        // If not previewable, show error message
        previewLoader.classList.add("hidden");
        previewError.classList.remove("hidden");
        
        // Clear any previous error messages
        previewError.innerHTML = '';
        
        // Optional: Add specific error message
        const errorMsg = document.createElement('p');
        errorMsg.textContent = `Preview not available for ${filename.split('.').pop()} files`;
        previewError.appendChild(errorMsg);
        
        // Show Download Instead button
        downloadInsteadBtn.classList.remove('hidden');
        
        return;
    }
    
    try {
        // Create the preview URL - this will use the same endpoint as download
        const previewUrl = `/api/preview/${filename}`;
        
        // Reset error state and hide download instead button
        previewError.innerHTML = '';
        downloadInsteadBtn.classList.add('hidden');
        
        if (previewType === 'images') {
            // For images, create an img element
            const img = document.createElement('img');
            img.onload = () => {
                previewLoader.classList.add("hidden");
                previewContent.classList.remove("hidden");
            };
            img.onerror = () => {
                previewLoader.classList.add("hidden");
                previewError.classList.remove("hidden");
                
                const errorMsg = document.createElement('p');
                errorMsg.textContent = 'Unable to load image preview';
                previewError.appendChild(errorMsg);
                downloadInsteadBtn.classList.remove('hidden');
            };
            img.src = previewUrl;
            img.classList.add('preview-image');
            previewContent.appendChild(img);
        
        } else if (previewType === 'text') {
            // For text files, use fetch to get content
            const response = await fetch(previewUrl);
            
            if (!response.ok) {
                throw new Error('Failed to fetch text file');
            }
            
            const text = await response.text();
            
            const pre = document.createElement('pre');
            pre.classList.add('preview-text');
            pre.textContent = text;
            
            previewContent.appendChild(pre);
            previewLoader.classList.add("hidden");
            previewContent.classList.remove("hidden");
        } else if (previewType === 'documents') {
            // This should handle all document types including PDF and DOCX
            const iframe = document.createElement('iframe');
            iframe.onload = () => {
                previewLoader.classList.add("hidden");
                previewContent.classList.remove("hidden");
            };
            iframe.onerror = () => {
                previewLoader.classList.add("hidden");
                previewError.classList.remove("hidden");
                
                const errorMsg = document.createElement('p');
                errorMsg.textContent = 'Unable to load document preview';
                previewError.appendChild(errorMsg);
                downloadInsteadBtn.classList.remove('hidden');
            };
            iframe.src = previewUrl;
            iframe.classList.add('preview-iframe');
            previewContent.appendChild(iframe);
        } else if (previewType === 'videos') {
            // For videos, use video element
            const video = document.createElement('video');
            video.controls = true;
            video.classList.add('preview-video');
            
            const source = document.createElement('source');
            source.src = previewUrl;
            source.type = `video/${filename.split('.').pop()}`;
            
            video.appendChild(source);
            
            video.onloadedmetadata = () => {
                previewLoader.classList.add("hidden");
                previewContent.classList.remove("hidden");
            };
            
            video.onerror = () => {
                previewLoader.classList.add("hidden");
                previewError.classList.remove("hidden");
                
                const errorMsg = document.createElement('p');
                errorMsg.textContent = 'Unable to load video preview';
                previewError.appendChild(errorMsg);
                downloadInsteadBtn.classList.remove('hidden');
            };
            
            previewContent.appendChild(video);
        }
    } catch (error) {
        console.error("Error previewing file:", error);
        previewLoader.classList.add("hidden");
        previewError.classList.remove("hidden");
        
        const errorMsg = document.createElement('p');
        errorMsg.textContent = `Preview failed: ${error.message}`;
        previewError.appendChild(errorMsg);
        
        // Always show Download Instead button in case of any error
        downloadInsteadBtn.classList.remove('hidden');
    }
}
// Add these new functions to your existing user.js file

// Function to preview file before upload - modified to only show metadata
function previewUploadFile(event) {
    const fileInput = event.target;
    const file = fileInput.files[0];
    const previewContainer = document.getElementById('uploadFilePreview');
    const uploadForm = document.getElementById('uploadForm');

    // Clear previous preview
    previewContainer.innerHTML = '';
    previewContainer.classList.remove('hidden');

    if (!file) {
        previewContainer.classList.add('hidden');
        return;
    }

    // Get file type
    const fileType = getFileType(file.name);
    const fileIcon = getIconClass(fileType);

    // For all files, just show file details and icon without rendering content
    const filePreviewEl = document.createElement('div');
    filePreviewEl.classList.add('upload-preview-file');
    filePreviewEl.innerHTML = `
        <i class="fas ${fileIcon} upload-preview-icon"></i>
        <div class="upload-preview-details">
            <p class="upload-preview-name">${file.name}</p>
            <p class="upload-preview-size">${formatFileSize(file.size)}</p>
            <p class="upload-preview-type">${file.type || 'Unknown type'}</p>
        </div>
    `;
    previewContainer.appendChild(filePreviewEl);
}
// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Close preview modal
function closePreviewModal() {
    previewModal.classList.remove("active");
    previewContent.innerHTML = '';
}

// Add to favorites function
async function addToFavorites(fileId) {
    try {
        const response = await fetch(`/api/favorites/add/${fileId}`, {
            method: 'POST',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to add to favorites');
        }
        
        alert("Added to favorites successfully!");
        
        // Refresh the current view
        filterFiles(filterType.value);
    } catch (error) {
        console.error("Error adding to favorites:", error);
        alert("Error adding to favorites: " + error.message);
    }
}

// Remove from favorites function
async function removeFromFavorites(fileId) {
    try {
        const response = await fetch(`/api/favorites/remove/${fileId}`, {
            method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to remove from favorites');
        }
        
        alert("Removed from favorites successfully!");
        
        // If we're in the favorites view, refresh to show the updated list
        if (filterType.value === "favorites") {
            filterFiles("favorites");
        } else {
            // Otherwise just refresh the current view
            filterFiles(filterType.value);
        }
    } catch (error) {
        console.error("Error removing from favorites:", error);
        alert("Error removing from favorites: " + error.message);
    }
}

// Get appropriate icon class based on file type
function getIconClass(fileType) {
    switch (fileType) {
        case "images":
            return "fa-image";
        case "videos":
            return "fa-video";
        case "documents":
            return "fa-file-alt";
        default:
            return "fa-file";
    }
}
//Password protection for downloads
function downloadFile(filename) {
    // First check if the file requires a password
    fetch(`/api/file-info/${filename}`)
        .then(response => response.json())
        .then(data => {
            if (data.isPasswordProtected) {
                // If password protected, prompt for password
                promptForPassword(filename);
            } else {
                // If not password protected, download directly
                window.location.href = `/api/download/${filename}`;
            }
        })
        .catch(error => {
            console.error("Error checking file info:", error);
            showErrorToast("Error checking file info. Please try again.");
        });
}
// Function to prompt for password
function promptForPassword(filename) {
    // Create modal for password input
    const passwordModal = document.createElement('div');
    passwordModal.classList.add('modal', 'active');
    passwordModal.id = 'passwordModal';
    
    passwordModal.innerHTML = `
        <div class="modal-content">
            <h2>Password Required</h2>
            <p>This file is password protected. Please enter the password to download.</p>
            <div class="form-group">
                <input type="password" id="downloadPassword" placeholder="Enter password" class="form-control">
            </div>
            <div class="form-actions">
                <button id="submitPassword" class="btn btn-primary">Download</button>
                <button id="cancelPassword" class="btn btn-secondary">Cancel</button>
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
             showErrorToast("Please enter a password");
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
 // Function to download with password
function downloadWithPassword(filename, password) {
    // Create a form to submit the password
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `/api/download/${filename}`;
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
    
    // Set up error handling if password is wrong
    // The server should respond with a 401 status if password is incorrect
    setTimeout(() => {
        // After 2 seconds, check if we're still on the same page
        // If so, assume the password was wrong
        document.body.removeChild(form);
    }, 2000);
}

    

// Function to get current user's department
function getUserDepartment() {
    // This should ideally come from your server/session
    // For now, we could store this in localStorage after login
    return localStorage.getItem('userDepartment') || '';
}

// Function to get current user ID from session
function getUserId() {
    // This would need to be implemented to return the current user's ID
    // For now, just return null
    return null;
}



// Enhanced file upload function with size validation
// Modified upload function to include password
// Enhanced upload function with proper handling of the "Keep file private" option
async function uploadFile(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('fileInput');
    const descInput = document.getElementById('fileDescription');
    const isPrivateInput = document.getElementById('isPrivate');
    const shareWithSelect = document.getElementById('shareWith');
    const passwordInput = document.getElementById('filePassword');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showErrorToast("Please select a file to upload");
        return;
    }

    const file = fileInput.files[0];

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
        showErrorToast(`File size exceeds the maximum limit of ${MAX_FILE_SIZE_READABLE}`);
        return;
    }

    // File type validation
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'docx', 'xlsx', 'txt', 'mp4', 'mov', 'avi', 'wmv'];
    const blockedExtensions = ['exe', 'bat', 'sh', 'js', 'msi', 'vbs'];

    if (blockedExtensions.includes(fileExt)) {
        showErrorToast("This file type is not allowed for security reasons");
        return;
    }

    if (!allowedExtensions.includes(fileExt)) {
        showErrorToast("Unsupported file type");
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', descInput.value.trim());
    
    // Handle the private file setting - convert boolean to string
    formData.append('isPrivate', isPrivateInput.checked.toString());
    
    // If file is private, don't allow department sharing
    if (!isPrivateInput.checked && shareWithSelect.value) {
        formData.append('shareWith', shareWithSelect.value);
    }
    
    // Password protection (if provided)
    if (passwordInput.value) {
        formData.append('password', passwordInput.value);
        formData.append('isPasswordProtected', 'true');
    }

    // Show upload progress
    const uploadProgress = document.createElement('div');
    uploadProgress.classList.add('upload-progress');
    document.body.appendChild(uploadProgress);

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
            
            const response = JSON.parse(xhr.responseText);
            
            if (xhr.status === 201) {
                showSuccessToast("File uploaded successfully!");
                closeUploadModal();
                filterFiles("all"); // Refresh file list
                uploadForm.reset();
            } else {
                showErrorToast(response.error || "Upload failed");
            }
        };

        xhr.onerror = function() {
            uploadProgress.remove();
            showErrorToast("Network error. Please try again.");
        };

        xhr.open("POST", "/api/upload", true);
        xhr.send(formData);
    } catch (error) {
        uploadProgress.remove();
        showErrorToast(`Error uploading file: ${error.message}`);
        console.error("Upload error:", error);
    }
}
// Add this function to handle the interaction between private checkbox and sharing
function setupPrivacyToggle() {
    const isPrivateCheckbox = document.getElementById('isPrivate');
    const shareWithSelect = document.getElementById('shareWith');
    const sharingContainer = document.getElementById('sharingContainer'); // Assuming this is the container for sharing options
    
    isPrivateCheckbox.addEventListener('change', function() {
        if (this.checked) {
            // If private is checked, disable sharing options
            shareWithSelect.disabled = true;
            shareWithSelect.value = '';
            if (sharingContainer) {
                sharingContainer.classList.add('disabled');
            }
        } else {
            // If private is unchecked, enable sharing options
            shareWithSelect.disabled = false;
            if (sharingContainer) {
                sharingContainer.classList.remove('disabled');
            }
        }
    });
    
    // Initialize on page load
    if (isPrivateCheckbox.checked) {
        shareWithSelect.disabled = true;
        if (sharingContainer) {
            sharingContainer.classList.add('disabled');
        }
    }
}
// Toast notification functions
function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast', 'error-toast');
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }, 10);
}

function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast', 'success-toast');
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }, 10);
}

// Enhanced filter function
function filterFiles(filterValue = "all") {
    const searchQuery = searchBar.value.trim();
    
    // Show loading state
    filesGrid.innerHTML = '<div class="loading">Loading files...</div>';
    
    // Special handling for favorites
    if (filterValue === "favorites") {
        fetch(`/api/favorites?search=${encodeURIComponent(searchQuery)}`)
            .then((response) => response.json())
            .then((data) => {
                if (data.error) {
                    console.error("Error:", data.error);
                    filesGrid.innerHTML = '<div class="error-message">Error loading favorites!</div>';
                    return;
                }
                updateFilesList(data.files);
            })
            .catch((error) => {
                console.error("Fetch error:", error);
                filesGrid.innerHTML = '<div class="error-message">Failed to load favorites. Please try again.</div>';
            });
        return;
    }

    // Handle other filter types
    fetch(`/api/files?search=${encodeURIComponent(searchQuery)}&type=${filterValue}`)
        .then((response) => response.json())
        .then((data) => {
            if (data.error) {
                console.error("Error:", data.error);
                filesGrid.innerHTML = '<div class="error-message">Error loading files!</div>';
                return;
            }

            // For standard file types (documents, images, videos), filter locally
            let filteredFiles = data.files;
            if (["documents", "images", "videos"].includes(filterValue)) {
                filteredFiles = data.files.filter((file) => getFileType(file.filename) === filterValue);
            }
            // For other filters (my-shares, shared-with-me, all, etc.), 
            // the filtering has already been done on the server

            updateFilesList(filteredFiles);
        })
        .catch((error) => {
            console.error("Fetch error:", error);
            filesGrid.innerHTML = '<div class="error-message">Failed to load files. Please try again.</div>';
        });
}

// Function for handling quick access filter clicks
function handleQuickAccessClick(type) {
    filterType.value = type;
    filterFiles(type);
    
    // Update the section title based on selection
    if (type === "my-shares") {
        document.querySelector(".welcome-section h1").textContent = "Files I've Shared";
    } else if (type === "shared-with-me") {
        document.querySelector(".welcome-section h1").textContent = "Files Shared with Me";
    } else {
        document.querySelector(".welcome-section h1").textContent = "Welcome back, Users! 👋";
    }
}

// Debounced search function to optimize API calls
let searchTimeout;
function searchFiles() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        filterFiles(filterType.value);
    }, 300);
}

// Function to close the upload modal
function closeUploadModal() {
    uploadModal.classList.remove("active");
    uploadForm.reset();
}

// Function to open the upload modal (to match the HTML onclick)
function openUploadModal() {
    uploadModal.classList.add("active");
}

// Function for logging out
function logoutUser() {
    fetch('/api/logout', {
        method: 'POST'
    })
    .then(response => {
        if (response.ok) {
            window.location.href = '/login';
        }
    })
    .catch(error => {
        console.error('Logout error:', error);
    });
}

// Set up the sidebar navigation functionality
document.addEventListener("DOMContentLoaded", function() {
    const navLinks = document.querySelectorAll(".nav-links li");
    
    navLinks.forEach(link => {
        link.addEventListener("click", function() {
            const action = this.querySelector("span").textContent.trim();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove("active"));
            
            // Add active class to clicked link
            this.classList.add("active");
            
            // Handle different navigation actions
            if (action === "Dashboard") {
                filterFiles("all");
                document.querySelector(".welcome-section h1").textContent = "Welcome back, Users! 👋";
            } else if (action === "Shared with Me") {
                filterFiles("shared-with-me");
                document.querySelector(".welcome-section h1").textContent = "Files Shared with Me";
            } else if (action === "Notification") {
                filterFiles("notification");
                document.querySelector(".welcome-section h1").textContent = "Notification";
            } else if (action === "Favorites") {
                filterFiles("favorites");
                document.querySelector(".welcome-section h1").textContent = "Favorite Files";
                // Add favorite filter option to the select if not already present
                if (!document.querySelector('#filterType option[value="favorites"]')) {
                    const option = document.createElement('option');
                    option.value = 'favorites';
                    option.textContent = 'Favorites';
                    filterType.appendChild(option);
                }
                // Set the filter type dropdown to "favorites"
                filterType.value = "favorites";
            } else if (action === "Trash") {
                // Implement later
                document.querySelector(".welcome-section h1").textContent = "Deleted Files";
            }
        });
    });
    
    // Initialize dashboard with "All" files
    filterFiles("all");
    
    // Close dropdown menus when clicking elsewhere on the page
    document.addEventListener('click', function() {
        document.querySelectorAll(".dropdown-menu:not(.hidden)").forEach(menu => {
            menu.classList.add("hidden");
        });
    });
    // Set up privacy toggle behavior
    setupPrivacyToggle();
    // Preview modal event listeners
    closePreviewBtn.addEventListener("click", closePreviewModal);
    
    // Download button in preview modal
    downloadPreviewBtn.addEventListener("click", function() {
        const filename = this.dataset.filename;
        if (filename) {
            downloadFile(filename);
        }
    });
    
    // Download instead button in preview error state
    downloadInsteadBtn.addEventListener("click", function() {
        const filename = this.dataset.filename;
        if (filename) {
            downloadFile(filename);
        }
    });
});
// Add this to your styles (either in your CSS file or in a style tag)
function addPrivacyStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .disabled {
            opacity: 0.5;
            pointer-events: none;
        }
        
        /* Optional styling for the private checkbox to make it more noticeable */
        #isPrivate:checked + label {
            font-weight: bold;
            color: #0056b3;
        }
    `;
    document.head.appendChild(styleEl);
}

// Call this in your DOMContentLoaded event or directly
addPrivacyStyles();

// Event Listeners
uploadBtn.addEventListener("click", openUploadModal);
cancelUploadBtn.addEventListener("click", closeUploadModal);
// uploadForm event listener already handled by inline onsubmit in HTML
filterType.addEventListener("change", (e) => filterFiles(e.target.value));
searchBar.addEventListener("input", searchFiles);