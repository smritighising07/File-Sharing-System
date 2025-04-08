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
// Enhanced updateFilesList function with better error handling
// Complete updateFilesList function with expiration functionality
function updateFilesList(files) {
    console.log("updateFilesList called with", files ? files.length : 0, "files");
    
    // Clear the current contents
    filesGrid.innerHTML = "";

    // Check if files is valid
    if (!files || !Array.isArray(files) || files.length === 0) {
        console.log("No files to display or invalid files array");
        const noFilesEl = document.createElement("div");
        noFilesEl.classList.add("no-files");
        noFilesEl.textContent = "No files found";
        filesGrid.appendChild(noFilesEl);
        return;
    }

    // Debug log the first file to see its structure
    console.log("First file structure:", files[0]);

    try {
        files.forEach((file, index) => {
            if (!file || !file.filename) {
                console.warn(`File at index ${index} is invalid:`, file);
                return; // Skip this file
            }
            
            const fileType = getFileType(file.filename);
            const fileExt = file.filename.split(".").pop().toUpperCase();
            
            // Make sure we can get a date
            let uploadDate = "Unknown date";
            try {
                if (file.uploaded_at) {
                    uploadDate = new Date(file.uploaded_at).toLocaleDateString() + " " + 
                                 new Date(file.uploaded_at).toLocaleTimeString();
                }
            } catch (dateError) {
                console.warn("Error formatting date:", dateError);
            }
            
            // Get shortened filename (remove timestamp prefix if present)
            let displayName = file.filename;
            if (typeof displayName === 'string' && displayName.includes('_')) {
                const parts = displayName.split('_');
                if (parts.length > 1) {
                    // Skip timestamp part
                    displayName = parts.slice(1).join('_');
                }
            }

            // Create file card
            const fileCard = document.createElement("div");
            fileCard.classList.add("file-card");
            if (file.id) {
                fileCard.dataset.fileId = file.id; // Store file ID in dataset for easy access
            }

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
            
            // Start with the main file info elements
            fileInfo.append(fileName, fileDate, deptInfo);
            
            // Add expiration info if available
            if (file.expiration_datetime) {
                try {
                    const expirationDate = new Date(file.expiration_datetime);
                    const now = new Date();
                    const timeRemaining = expirationDate - now;
                    
                    // Create expiration info element
                    const expirationInfo = document.createElement("p");
                    expirationInfo.classList.add("file-expiration");
                    
                    // Add expiration date as tooltip
                    expirationInfo.title = `Expires on ${expirationDate.toLocaleDateString()} at ${expirationDate.toLocaleTimeString()}`;
                    
                    // Format with days/hours remaining if in the future
                    if (timeRemaining > 0) {
                        // Calculate days, hours, minutes
                        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        
                        // Create time remaining text
                        let timeRemainingText = "";
                        if (days > 0) {
                            timeRemainingText = `${days} day${days !== 1 ? 's' : ''} ${hours} hr${hours !== 1 ? 's' : ''}`;
                        } else if (hours > 0) {
                            timeRemainingText = `${hours} hour${hours !== 1 ? 's' : ''}`;
                        } else {
                            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                            timeRemainingText = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
                        }
                        
                        // Add warning class if expiration is very soon (less than 1 day)
                        if (timeRemaining < 24 * 60 * 60 * 1000) {
                            expirationInfo.classList.add("expiration-warning");
                            expirationInfo.innerHTML = `<i class="fas fa-clock"></i> Expires in ${timeRemainingText}`;
                        } else {
                            expirationInfo.innerHTML = `<i class="fas fa-calendar-alt"></i> Expires in ${timeRemainingText}`;
                        }
                    } else {
                        // If expiration date is in the past (shouldn't happen but just in case)
                        expirationInfo.classList.add("expiration-expired");
                        expirationInfo.innerHTML = `<i class="fas fa-exclamation-circle"></i> Expired`;
                    }
                    
                    fileInfo.appendChild(expirationInfo);
                } catch (dateError) {
                    console.warn("Error formatting expiration date:", dateError);
                }
            }
            
            // Add shared by info if available (for "Shared with Me" view)
            if (file.shared_by_name) {
                const sharedByInfo = document.createElement("p");
                sharedByInfo.classList.add("file-shared-by");
                sharedByInfo.textContent = `Shared by: ${file.shared_by_name}`;
                fileInfo.appendChild(sharedByInfo);
            }
            
            // Add shared with info if available (for department shares)
            if (file.shared_department && filterType.value === "my-shares") {
                const sharedWithInfo = document.createElement("p");
                sharedWithInfo.classList.add("file-shared-with");
                sharedWithInfo.textContent = `Shared with: ${file.shared_department} Dept`;
                fileInfo.appendChild(sharedWithInfo);
            }
            
            // Add shared with user info if available (for user shares)
            if (file.shared_with_user && filterType.value === "my-shares") {
                const sharedWithUserInfo = document.createElement("p");
                sharedWithUserInfo.classList.add("file-shared-with-user");
                sharedWithUserInfo.textContent = `Shared with: ${file.shared_with_user}`;
                fileInfo.appendChild(sharedWithUserInfo);
            }
            
            // Favorited date if available
            if (file.favorited_at) {
                const favoritedInfo = document.createElement("p");
                favoritedInfo.classList.add("file-favorited");
                let favDate = "Unknown date";
                try {
                    favDate = new Date(file.favorited_at).toLocaleDateString();
                } catch (dateError) {
                    console.warn("Error formatting favorite date:", dateError);
                }
                favoritedInfo.textContent = `Favorited: ${favDate}`;
                fileInfo.appendChild(favoritedInfo);
            }
            
            // File type and badges container
            const badgesContainer = document.createElement("div");
            badgesContainer.classList.add("file-badges");
            
            // File type badge
            const fileTypeSpan = document.createElement("span");
            fileTypeSpan.classList.add("file-type");
            fileTypeSpan.textContent = fileExt;
            badgesContainer.appendChild(fileTypeSpan);

            // Owner badge if applicable
            if (file.is_owner) {
                const ownerBadge = document.createElement("span");
                ownerBadge.classList.add("owner-badge");
                ownerBadge.textContent = "Owner";
                badgesContainer.appendChild(ownerBadge);
            }
            
            // Add the badges container to file info
            fileInfo.appendChild(badgesContainer);

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
            const trashBtn = document.createElement("button");
            trashBtn.classList.add("dropdown-item");
            trashBtn.innerHTML = `<i class="fas fa-trash"></i> Move to Trash`;
            trashBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                moveToTrash(file.id, displayName);
            });

            // Add buttons to dropdown
            dropdownMenu.append(previewBtn, downloadBtn, favoriteBtn, trashBtn);

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
            
            console.log(`Added file card ${index+1}/${files.length}: ${displayName}`);
        });
        
        console.log("Finished adding file cards:", filesGrid.children.length);
    } catch (error) {
        console.error("Error in updateFilesList:", error);
        filesGrid.innerHTML = `
            <div class="search-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error displaying files: ${error.message}</p>
                <button class="btn secondary" onclick="location.reload()">Reload</button>
            </div>`;
    }
}
// Preview file function that checks for password
function previewFile(filename, displayName) {
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
    
    // First check if file is password protected
    fetch(`/api/file-info/${filename}`)
        .then(response => response.json())
        .then(data => {
            if (data.isPasswordProtected) {
                // Hide loading indicator
                previewLoader.classList.add("hidden");
                
                // Show password prompt
                promptForPreviewPassword(filename, getFileType(filename));
            } else {
                // No password needed, proceed with preview
                
                // Check if we can preview this file type
                const previewType = isPreviewable(filename);
                
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
                        fetch(previewUrl)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Failed to fetch text file');
                                }
                                return response.text();
                            })
                            .then(text => {
                                const pre = document.createElement('pre');
                                pre.classList.add('preview-text');
                                pre.textContent = text;
                                
                                previewContent.appendChild(pre);
                                previewLoader.classList.add("hidden");
                                previewContent.classList.remove("hidden");
                            })
                            .catch(error => {
                                previewLoader.classList.add("hidden");
                                previewError.classList.remove("hidden");
                                
                                const errorMsg = document.createElement('p');
                                errorMsg.textContent = `Error loading text preview: ${error.message}`;
                                previewError.appendChild(errorMsg);
                                downloadInsteadBtn.classList.remove('hidden');
                            });
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
        })
        .catch(error => {
            console.error("Error checking file info:", error);
            previewLoader.classList.add("hidden");
            previewError.classList.remove("hidden");
            
            const errorMsg = document.createElement('p');
            errorMsg.textContent = `Error: ${error.message}`;
            previewError.appendChild(errorMsg);
            downloadInsteadBtn.classList.remove('hidden');
        });
}


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
    // First check if file is password protected
    fetch(`/api/file-info/${filename}`)
        .then(response => response.json())
        .then(data => {
            if (data.isPasswordProtected) {
                // Show password input modal
                promptForPassword(filename);
            } else {
                // No password needed, proceed with download
                const downloadLink = document.createElement('a');
                downloadLink.href = `/api/download/${filename}`;
                downloadLink.download = filename.split('_').slice(1).join('_') || filename;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        })
        .catch(error => {
            console.error('Error checking file info:', error);
            showErrorToast('Error checking file information');
        });
}
// Function to initiate direct download
function initiateDownload(filename) {
    window.location.href = `/api/download/${filename}`;
}

// Function to initiate direct download
function initiateDirectDownload(filename) {
    const a = document.createElement('a');
    a.href = `/api/download/${filename}`;
    a.download = filename.split('_').slice(1).join('_') || filename; // Use original filename if possible
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Function to prompt for password
function promptForPassword(filename) {
    // Remove any existing password modal first
    const existingModal = document.getElementById('passwordModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
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
                <div id="passwordError" class="password-error" style="color: red; display: none;">Incorrect password</div>
            </div>
            <div class="form-actions">
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
            document.getElementById('passwordError').textContent = 'Please enter a password';
            document.getElementById('passwordError').style.display = 'block';
            return;
        }
        
        // Hide error message if it was shown
        document.getElementById('passwordError').style.display = 'none';
        
        // Close the modal
        document.body.removeChild(passwordModal);
        
        // Try to download with password
        downloadWithPassword(filename, password);
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

// Add this CSS to your styles
function addToastStyles() {
    if (document.getElementById('toast-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'toast-styles';
    styleEl.textContent = `
        .info-toast {
            background-color: #2196F3;
            color: white;
        }
    `;
    document.head.appendChild(styleEl);
}
 
// Updated function to download with password using Fetch API
function downloadWithPassword(filename, password) {
    // Show loading indicator
    const loadingToast = document.createElement('div');
    loadingToast.classList.add('toast', 'info-toast');
    loadingToast.textContent = "Verifying password...";
    document.body.appendChild(loadingToast);
    setTimeout(() => {
        loadingToast.classList.add('show');
    }, 10);
    
    // Create form data
    const formData = new FormData();
    formData.append('password', password);
    
    // First verify the password before starting the download
    fetch(`/api/verify-password/${filename}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Incorrect password");
        }
        return response.json();
    })
    .then(data => {
        if (!data.success) {
            throw new Error(data.error || "Password verification failed");
        }
        
        // Password is verified, now download the file
        // Create a temporary anchor element for download
        const downloadLink = document.createElement('a');
        downloadLink.href = `/api/download/${filename}?password=${encodeURIComponent(password)}`;
        downloadLink.download = filename.split('_').slice(1).join('_') || filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Remove loading toast
        setTimeout(() => {
            loadingToast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(loadingToast);
            }, 300);
        }, 500);
        
        showSuccessToast("File download started");
    })
    .catch(error => {
        console.error("Download error:", error);
        
        // Remove loading toast
        setTimeout(() => {
            loadingToast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(loadingToast);
            }, 300);
        }, 500);
        
        showErrorToast(error.message || "Password incorrect");
        
        // If password was incorrect, prompt again after a short delay
        setTimeout(() => promptForPassword(filename), 1000);
    });
}

// Function to prompt for password when previewing files
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
                <div id="previewPasswordError" class="password-error" style="color: red; display: none;">Incorrect password</div>
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
            document.getElementById('previewPasswordError').textContent = 'Please enter a password';
            document.getElementById('previewPasswordError').style.display = 'block';
            return;
        }
        
        // Hide error message if it was shown
        document.getElementById('previewPasswordError').style.display = 'none';
        
        // Try to verify password before preview
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
// Function to verify password and preview file
function verifyPasswordAndPreview(filename, password, fileType) {
    // Create form data
    const formData = new FormData();
    formData.append('password', password);
    
    // Show loading toast
    showInfoToast("Verifying password...");
    
    // Verify password
    fetch(`/api/verify-password/${filename}`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Incorrect password");
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Password is correct, show preview
            showPreviewWithPassword(filename, fileType, password);
        } else {
            throw new Error("Password verification failed");
        }
    })
    .catch(error => {
        console.error("Error verifying password:", error);
        showErrorToast(error.message || "Password incorrect");
        
        // If password was incorrect, prompt again after a short delay
        setTimeout(() => promptForPreviewPassword(filename, fileType), 1000);
    });
}
// Function to show preview with password
function showPreviewWithPassword(filename, fileType, password) {
    // Get the preview filename
    const displayName = filename.split('_').slice(1).join('_') || filename;
    previewFileName.textContent = displayName;
    
    // Store the filename for the download button
    downloadPreviewBtn.dataset.filename = filename;
    downloadPreviewBtn.dataset.password = password; // Store password for download button
    downloadInsteadBtn.dataset.filename = filename;
    downloadInsteadBtn.dataset.password = password; // Store password for download instead button
    
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
    
    if (!previewType) {
        // If not previewable, show error message
        previewLoader.classList.add("hidden");
        previewError.classList.remove("hidden");
        
        // Clear any previous error messages
        previewError.innerHTML = '';
        
        // Add specific error message
        const errorMsg = document.createElement('p');
        errorMsg.textContent = `Preview not available for ${filename.split('.').pop()} files`;
        previewError.appendChild(errorMsg);
        
        // Show Download Instead button
        downloadInsteadBtn.classList.remove('hidden');
        
        return;
    }
    
    // Create the preview URL with password as a query parameter
    const previewUrl = `/api/preview/${filename}?password=${encodeURIComponent(password)}`;
    
    // Show preview based on file type
    try {
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
            fetch(previewUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch text file');
                    }
                    return response.text();
                })
                .then(text => {
                    const pre = document.createElement('pre');
                    pre.classList.add('preview-text');
                    pre.textContent = text;
                    
                    previewContent.appendChild(pre);
                    previewLoader.classList.add("hidden");
                    previewContent.classList.remove("hidden");
                })
                .catch(error => {
                    previewLoader.classList.add("hidden");
                    previewError.classList.remove("hidden");
                    
                    const errorMsg = document.createElement('p');
                    errorMsg.textContent = `Error loading text preview: ${error.message}`;
                    previewError.appendChild(errorMsg);
                    downloadInsteadBtn.classList.remove('hidden');
                });
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

// Add this info toast to your existing toast functions
function showInfoToast(message) {
    const toast = document.createElement('div');
    toast.classList.add('toast', 'info-toast');
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

// Function to get current user's department
function getUserDepartment() {
    // This should ideally come from your server/session
    // For now, we could store this in localStorage after login
    return localStorage.getItem('userDepartment') || '';
}

// Improved function to get current user ID
function getUserId() {
    // Try to get from localStorage first
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
        return storedUserId;
    }
    
    // Check if there's a hidden element with user ID (common pattern)
    const userIdElement = document.getElementById('currentUserId');
    if (userIdElement && userIdElement.value) {
        return userIdElement.value;
    }
    
    // Return null if we can't find the user ID
    // The server will need to resolve this from the session
    return null;
}


// Enhanced file upload function with size validation
// Modified upload function to include password
// Enhanced upload function with proper handling of the "Keep file private" option
// Enhanced upload function with all necessary fields including shared_by_user_id
// Enhanced upload function to include expiration
// Enhanced file upload function with proper password protection handling
async function uploadFile(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('fileInput');
    const descInput = document.getElementById('fileDescription');
    const isPrivateInput = document.getElementById('isPrivate');
    const shareWithSelect = document.getElementById('shareWith');
    const shareUsersSelect = document.getElementById('shareUsers');
    const passwordInput = document.getElementById('filePassword');
    
    // Get expiration inputs
    const enableExpiration = document.getElementById('enableExpiration');
    const expirationDate = document.getElementById('expirationDate');
    const expirationTime = document.getElementById('expirationTime');
    
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

    // Create FormData object to send file and metadata
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', descInput ? descInput.value.trim() : '');
    
    // Handle the private file setting
    formData.append('isPrivate', isPrivateInput ? isPrivateInput.checked.toString() : 'false');
    
    // Add password protection if a password is provided
    if (passwordInput && passwordInput.value) {
        formData.append('password', passwordInput.value);
        formData.append('isPasswordProtected', 'true');
    }
    
    // Handle expiration settings
    if (enableExpiration && enableExpiration.checked && expirationDate && expirationDate.value) {
        formData.append('enableExpiration', 'true');
        formData.append('expirationDate', expirationDate.value);
        if (expirationTime && expirationTime.value) {
            formData.append('expirationTime', expirationTime.value);
        } else {
            formData.append('expirationTime', '23:59:59');
        }
    } else {
        formData.append('enableExpiration', 'false');
    }
    
    // Get current user information (for sharing)
    const currentUserId = getUserId();
    
    if (currentUserId) {
        formData.append('shared_by_user_id', currentUserId);
    } else {
        formData.append('use_session_user', 'true');
    }
    
    // If file is not private, handle department and user sharing
    if (!isPrivateInput.checked) {
        // Add department sharing if selected
        if (shareWithSelect.value) {
            formData.append('shareWith', shareWithSelect.value);
        }
        
        // Add user sharing if any users are selected
        if (shareUsersSelect) {
            const selectedUsers = Array.from(shareUsersSelect.selectedOptions).map(option => option.value);
            selectedUsers.forEach(userId => {
                formData.append('shareWithUsers', userId);
            });
        }
    }

    // Show upload progress
    const uploadProgress = document.createElement('div');
    uploadProgress.classList.add('upload-progress');
    document.body.appendChild(uploadProgress);

    // Show loading state on submit button
    const uploadForm = document.getElementById('uploadForm');
    const submitButton = uploadForm.querySelector('button[type="submit"]');
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
                    console.log("Upload response:", response);
                    
                    // Add expiration info to success message if present
                    let successMsg = response.message || "File uploaded successfully!";
                    if (response.expiration) {
                        const expDate = new Date(response.expiration);
                        successMsg += ` Will expire on ${expDate.toLocaleDateString()} at ${expDate.toLocaleTimeString()}.`;
                    }
                    
                    // Add password info to success message if file is password protected
                    if (passwordInput && passwordInput.value) {
                        successMsg += " File is password protected.";
                    }
                    
                    // First close modal and reset form
                    closeUploadModal();
                    uploadForm.reset();
                    
                    // Then show toast with slight delay to ensure visibility
                    setTimeout(() => {
                        showSuccessToast(successMsg);
                        // Refresh file list
                        filterFiles("all"); 
                    }, 300);
                    
                } catch (e) {
                    console.error("Error parsing response:", e);
                    // Close modal and reset form first
                    closeUploadModal();
                    uploadForm.reset();
                    
                    // Show success toast with delay
                    setTimeout(() => {
                        showSuccessToast("File uploaded successfully!");
                        filterFiles("all");
                    }, 300);
                }
            } else {
                try {
                    const response = JSON.parse(xhr.responseText);
                    showErrorToast(response.error || "Upload failed");
                } catch (e) {
                    console.error("Error parsing error response:", e);
                    showErrorToast("Upload failed. Please try again.");
                }
            }
        };

        xhr.onerror = function() {
            uploadProgress.remove();
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            showErrorToast("Network error. Please try again.");
        };

        xhr.open("POST", "/api/upload", true);
        xhr.send(formData);
    } catch (error) {
        uploadProgress.remove();
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
        showErrorToast(`Error uploading file: ${error.message}`);
        console.error("Upload error:", error);
    }
}
// Add this function to handle the interaction between private checkbox and sharing
function setupPrivacyToggle() {
    const isPrivateCheckbox = document.getElementById('isPrivate');
    const shareWithSelect = document.getElementById('shareWith');
    const shareUsersSelect = document.getElementById('shareUsers');
    const sharingContainer = document.getElementById('sharingContainer'); // Assuming this is the container for sharing options
    
    isPrivateCheckbox.addEventListener('change', function() {
        if (this.checked) {
            // If private is checked, disable all sharing options
            shareWithSelect.disabled = true;
            shareWithSelect.value = '';
            shareUsersSelect.disabled = true;
            // Clear multiple select by removing all selections
            Array.from(shareUsersSelect.selectedOptions).forEach(option => {
                option.selected = false;
            });
            
            if (sharingContainer) {
                sharingContainer.classList.add('disabled');
            }
        } else {
            // If private is unchecked, enable all sharing options
            shareWithSelect.disabled = false;
            shareUsersSelect.disabled = false;
            if (sharingContainer) {
                sharingContainer.classList.remove('disabled');
            }
        }
    });
    
    // Initialize on page load
    if (isPrivateCheckbox.checked) {
        shareWithSelect.disabled = true;
        shareUsersSelect.disabled = true;
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
// Improved filterFiles function with cache busting
function filterFiles(filterValue = "all") {
    const searchQuery = document.querySelector(".search-bar").value.trim();
    
    // Update the filter type dropdown value
    document.getElementById("filterType").value = filterValue;
    
    // If there's a search query, use enhanced search with the new filter type
    if (searchQuery) {
        enhancedSearch();
        return;
    }
    
    // Show loading state
    filesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading files...</div>';
    
    // Handle favorites filter
    if (filterValue === "favorites") {
        fetch(`/api/favorites?_t=${Date.now()}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store'
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.error) {
                    console.error("Error:", data.error);
                    filesGrid.innerHTML = '<div class="search-error"><i class="fas fa-exclamation-circle"></i><p>Error loading favorites!</p></div>';
                    return;
                }
                updateFilesList(data.files);
                
                // Remove the search results count if it exists
                const countIndicator = document.querySelector('.search-results-count');
                if (countIndicator) {
                    countIndicator.parentNode.removeChild(countIndicator);
                }
            })
            .catch((error) => {
                console.error("Fetch error:", error);
                filesGrid.innerHTML = '<div class="search-error"><i class="fas fa-exclamation-circle"></i><p>Failed to load favorites. Please try again.</p></div>';
            });
        return;
    }
    
    // Handle trash view separately 
    if (filterValue === "trash") {
        getTrashFiles();
        return;
    }
    
    // Clear any previous "trash view" styling
    document.querySelector(".main-content").classList.remove("trash-view");
    
    // Handle other filters with strong cache-busting
    fetch(`/api/files?type=${filterValue}&_t=${Date.now()}`, {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        },
        cache: 'no-store'
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.error) {
                console.error("Error:", data.error);
                filesGrid.innerHTML = '<div class="search-error"><i class="fas fa-exclamation-circle"></i><p>Error loading files!</p></div>';
                return;
            }
            
            // Ensure all files are in an array format
            let filteredFiles = Array.isArray(data.files) ? data.files : [];
            
            // Additional client-side filtering for specific file types
            if (["documents", "images", "videos"].includes(filterValue)) {
                filteredFiles = filteredFiles.filter((file) => getFileType(file.filename) === filterValue);
            }
            
            // Double-check for is_deleted - in case the server API doesn't filter them out
            filteredFiles = filteredFiles.filter(file => !file.is_deleted);
            
            console.log(`Displaying ${filteredFiles.length} files after filtering`);
            
            updateFilesList(filteredFiles);
            
            // Remove the search results count if it exists
            const countIndicator = document.querySelector('.search-results-count');
            if (countIndicator) {
                countIndicator.parentNode.removeChild(countIndicator);
            }
        })
        .catch((error) => {
            console.error("Fetch error:", error);
            filesGrid.innerHTML = '<div class="search-error"><i class="fas fa-exclamation-circle"></i><p>Failed to load files. Please try again.</p></div>';
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
    
    // Get the search input element
    const searchBar = document.querySelector(".search-bar");
    
    // Show/hide clear button based on search content
    const clearButton = document.querySelector('.search-clear-btn');
    if (clearButton) {
        clearButton.style.display = searchBar.value ? 'block' : 'none';
    }
    
    // Only perform search if there's actually text to search
    if (searchBar.value.trim().length > 0) {
        // Show a small "searching..." indicator
        const searchingIndicator = document.querySelector('.searching-indicator');
        if (searchingIndicator) {
            searchingIndicator.style.display = 'inline-block';
        }
        
        searchTimeout = setTimeout(() => {
            enhancedSearch();
        }, 500); // Wait 500ms after typing stops
    } else {
        // If search is empty, show all files based on current filter
        clearSearch();
    }
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
                // For non-trash views, restore normal view
                document.querySelector(".main-content").classList.remove("trash-view");
                
                // Show quick access again
                const quickAccessSection = document.querySelector('.quick-access');
                if (quickAccessSection) {
                    quickAccessSection.style.display = '';
                }
                
                // Restore filter dropdown if needed
                restoreFilterDropdown();
                
                filterFiles("all");
                document.querySelector(".welcome-section h1").textContent = "Welcome back, Users! 👋";
                document.querySelector(".welcome-section p").textContent = "Manage and share your files securely from anywhere.";
            } else if (action === "Shared with Me") {
                // For non-trash views, restore normal view
                document.querySelector(".main-content").classList.remove("trash-view");
                
                // Show quick access again
                const quickAccessSection = document.querySelector('.quick-access');
                if (quickAccessSection) {
                    quickAccessSection.style.display = '';
                }
                
                // Restore filter dropdown if needed
                restoreFilterDropdown();
                
                filterFiles("shared-with-me");
                document.querySelector(".welcome-section h1").textContent = "Files Shared with Me";
                document.querySelector(".welcome-section p").textContent = "Files shared by your team members.";
            } else if (action === "My Shares") {
                // For non-trash views, restore normal view
                document.querySelector(".main-content").classList.remove("trash-view");
                
                // Show quick access again
                const quickAccessSection = document.querySelector('.quick-access');
                if (quickAccessSection) {
                    quickAccessSection.style.display = '';
                }
                
                // Restore filter dropdown if needed
                restoreFilterDropdown();
                
                filterFiles("my-shares");
                document.querySelector(".welcome-section h1").textContent = "Files I've Shared";
                document.querySelector(".welcome-section p").textContent = "Manage files you've shared with others.";
            } else if (action === "Favorites") {
                // For non-trash views, restore normal view
                document.querySelector(".main-content").classList.remove("trash-view");
                
                // Show quick access again
                const quickAccessSection = document.querySelector('.quick-access');
                if (quickAccessSection) {
                    quickAccessSection.style.display = '';
                }
                
                // Restore filter dropdown if needed
                restoreFilterDropdown();
                
                filterFiles("favorites");
                document.querySelector(".welcome-section h1").textContent = "Favorite Files";
                document.querySelector(".welcome-section p").textContent = "Quick access to your important files.";
                
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
                // Show trash files
                document.querySelector(".main-content").classList.add("trash-view");
                
                // Hide quick access section
                const quickAccessSection = document.querySelector('.quick-access');
                if (quickAccessSection) {
                    quickAccessSection.style.display = 'none';
                }
                
                // Update header for trash view
                updateHeaderForTrashView();
                
                // Get trash files
                getTrashFiles();
            }
        });
    });
    
    // Helper function to restore the filter dropdown
    function restoreFilterDropdown() {
        const sectionHeader = document.querySelector('.section-header');
        if (sectionHeader && !sectionHeader.querySelector('#filterType')) {
            const emptyTrashContainer = sectionHeader.querySelector('.empty-trash-container');
            if (emptyTrashContainer) {
                const filterSelect = document.createElement('select');
                filterSelect.id = 'filterType';
                filterSelect.className = 'btn secondary';
                filterSelect.innerHTML = `
                    <option value="all">All Files</option>
                    <option value="documents">Documents</option>
                    <option value="images">Images</option>
                    <option value="videos">Videos</option>
                `;
                filterSelect.addEventListener('change', (e) => filterFiles(e.target.value));
                sectionHeader.replaceChild(filterSelect, emptyTrashContainer);
            }
        }
        
        // Also make sure to update section title
        const sectionTitle = document.querySelector('.section-header h2');
        if (sectionTitle) {
            sectionTitle.textContent = 'Recent Files';
        }
    }
    
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
        const password = this.dataset.password;
        
        if (filename) {
            if (password) {
                // If we have a stored password from preview, use it directly
                downloadWithPassword(filename, password);
            } else {
                // Otherwise go through the normal download flow
                downloadFile(filename);
            }
        }
    });
    
    // Download instead button in preview error state
    downloadInsteadBtn.addEventListener("click", function() {
        const filename = this.dataset.filename;
        const password = this.dataset.password;
        
        if (filename) {
            if (password) {
                // If we have a stored password from preview, use it directly
                downloadWithPassword(filename, password);
            } else {
                // Otherwise go through the normal download flow
                downloadFile(filename);
            }
        }
    });
});

// Helper function to update header for trash view
function updateHeaderForTrashView() {
    const sectionHeader = document.querySelector('.section-header');
    if (!sectionHeader) return;
    
    // Update section title
    const titleElement = sectionHeader.querySelector('h2');
    if (titleElement) {
        titleElement.textContent = 'Trash';
    }
    
    // Replace filter dropdown with empty trash button if not already done
    if (!sectionHeader.querySelector('.empty-trash-container')) {
        const filterSelect = sectionHeader.querySelector('#filterType');
        if (filterSelect) {
            const emptyTrashBtn = document.createElement('button');
            emptyTrashBtn.classList.add('btn', 'primary', 'empty-trash-btn');
            emptyTrashBtn.innerHTML = '<i class="fas fa-trash"></i> Empty Trash';
            emptyTrashBtn.onclick = confirmEmptyTrash;
            
            const emptyTrashContainer = document.createElement('div');
            emptyTrashContainer.classList.add('empty-trash-container');
            emptyTrashContainer.appendChild(emptyTrashBtn);
            
            sectionHeader.replaceChild(emptyTrashContainer, filterSelect);
        }
    }
}
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

// Function to populate the users dropdown
function populateUsersDropdown() {
    fetch('/api/users')
      .then(response => response.json())
      .then(data => {
        const userSelect = document.getElementById('shareUsers');
        userSelect.innerHTML = ''; // Clear existing options
        
        if (data.users && data.users.length > 0) {
          data.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (${user.department})`;
            userSelect.appendChild(option);
          });
        }
      })
      .catch(error => console.error('Error fetching users:', error));
  }
  
  // Call this function when your page loads
  document.addEventListener('DOMContentLoaded', function() {
    //Populate user dropdown for file sharing
    populateUsersDropdown();
     // Initialize the enhanced search functionality
     initializeSearch();
     // Set up toast notification styles
     addToastStyles();
  });

// Event Listeners
uploadBtn.addEventListener("click", openUploadModal);
cancelUploadBtn.addEventListener("click", closeUploadModal);
// uploadForm event listener already handled by inline onsubmit in HTML
filterType.addEventListener("change", (e) => filterFiles(e.target.value));
searchBar.addEventListener("input", searchFiles);

// Enhanced search function using the existing UI
function enhancedSearch() {
    const searchQuery = document.querySelector(".search-bar").value.trim();
    const fileType = document.getElementById("filterType").value;
    
    // If the search query is empty, revert to the normal filter view
    if (!searchQuery) {
        filterFiles(fileType);
        return;
    }
    
    // Show loading state
    filesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching files...</div>';
    
    // API endpoint based on filter type
    let apiEndpoint = '/api/files';
    if (fileType === "favorites") {
        apiEndpoint = '/api/favorites';
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('search', searchQuery);
    if (fileType !== "favorites") {
        queryParams.append('type', fileType);
    }
    
    console.log(`Searching with query: "${searchQuery}", filter: ${fileType}, endpoint: ${apiEndpoint}`);
    
    // Make the API request
    fetch(`${apiEndpoint}?${queryParams.toString()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Search request failed: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Debug log the response
            console.log("Search API response:", data);
            console.log("Files in response:", data.files ? data.files.length : 0);
            
            // Apply client-side filtering for specific file types if needed
            let filteredFiles = data.files || [];
            
            if (["documents", "images", "videos"].includes(fileType) && fileType !== "favorites") {
                filteredFiles = filteredFiles.filter(file => getFileType(file.filename) === fileType);
                console.log(`After filtering for ${fileType}: ${filteredFiles.length} files remain`);
            }
            
            // Hide the searching indicator
            const searchingIndicator = document.querySelector('.searching-indicator');
            if (searchingIndicator) {
                searchingIndicator.style.display = 'none';
            }
            
            // If no files found, show a message
            if (!filteredFiles || filteredFiles.length === 0) {
                filesGrid.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <p>No files found matching "${searchQuery}"</p>
                        <button class="btn secondary" onclick="clearSearch()">Clear Search</button>
                    </div>`;
                return;
            }
            
            // Clear the files grid before updating
            filesGrid.innerHTML = "";
            
            // Directly create file items in the grid for debugging
            console.log("Attempting to create file items for:", filteredFiles);
            
            // Update the files list with results
            updateFilesList(filteredFiles);
            
            // Add a small indicator showing search results count
            const countIndicator = document.createElement('div');
            countIndicator.classList.add('search-results-count');
            countIndicator.textContent = `${filteredFiles.length} file${filteredFiles.length !== 1 ? 's' : ''} found`;
            
            // Insert the count before the files grid
            const filesGridParent = filesGrid.parentNode;
            const existingCount = document.querySelector('.search-results-count');
            
            if (existingCount) {
                filesGridParent.removeChild(existingCount);
            }
            
            filesGridParent.insertBefore(countIndicator, filesGrid);
            
            // Check if files were actually added to the grid
            console.log("Files grid after update:", filesGrid.children.length, "children");
        })
        .catch(error => {
            console.error("Search error:", error);
            filesGrid.innerHTML = `
                <div class="search-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error searching files: ${error.message}</p>
                    <button class="btn secondary" onclick="clearSearch()">Reset</button>
                </div>`;
                
            // Hide the searching indicator
            const searchingIndicator = document.querySelector('.searching-indicator');
            if (searchingIndicator) {
                searchingIndicator.style.display = 'none';
            }
        });
}

// Function to clear the search
function clearSearch() {
    const searchBar = document.querySelector(".search-bar");
    searchBar.value = '';
    
    // Hide the searching indicator if it exists
    const searchingIndicator = document.querySelector('.searching-indicator');
    if (searchingIndicator) {
        searchingIndicator.style.display = 'none';
    }
    
    // Filter files based on the current filter type
    filterFiles(document.getElementById("filterType").value);
    
    // Remove the search results count indicator if it exists
    const countIndicator = document.querySelector('.search-results-count');
    if (countIndicator) {
        countIndicator.parentNode.removeChild(countIndicator);
    }
    
    // Hide the clear button
    const clearButton = document.querySelector('.search-clear-btn');
    if (clearButton) {
        clearButton.style.display = 'none';
    }
}

// Initialize search functionality
function initializeSearch() {
    // Get the search bar element
    const searchBar = document.querySelector(".search-bar");
    if (!searchBar) return; // Exit if search bar doesn't exist
    
    // Make sure search wrapper has relative positioning for the clear button
    const searchWrapper = searchBar.closest('.search-wrapper');
    if (searchWrapper) {
        searchWrapper.style.position = 'relative';
    }
    
    // Set up search bar event listeners
    // Input event for real-time searching
    searchBar.addEventListener("input", searchFiles);
    
    // Enter key for immediate search
    searchBar.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            enhancedSearch();
            event.preventDefault();
        }
    });
    
    // Add a small clear button inside the search input if it doesn't exist
    if (!document.querySelector('.search-clear-btn')) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.classList.add('search-clear-btn');
        clearButton.innerHTML = '<i class="fas fa-times"></i>';
        clearButton.style.cssText = `
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #6b7280;
            cursor: pointer;
            display: none;
            padding: 6px;
            z-index: 10;
            font-size: 14px;
        `;
        clearButton.addEventListener('click', clearSearch);
        
        if (searchWrapper) {
            searchWrapper.appendChild(clearButton);
        } else if (searchBar.parentNode) {
            // Fallback if searchWrapper is not found
            searchBar.parentNode.style.position = 'relative';
            searchBar.parentNode.appendChild(clearButton);
        }
    }
    
    // Add a small "searching..." indicator
    if (!document.querySelector('.searching-indicator')) {
        const searchingIndicator = document.createElement('span');
        searchingIndicator.classList.add('searching-indicator');
        searchingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        searchingIndicator.style.cssText = `
            position: absolute;
            right: 40px;
            top: 50%;
            transform: translateY(-50%);
            color: #6b7280;
            font-size: 12px;
            display: none;
            z-index: 10;
        `;
        
        if (searchWrapper) {
            searchWrapper.appendChild(searchingIndicator);
        } else if (searchBar.parentNode) {
            searchBar.parentNode.appendChild(searchingIndicator);
        }
    }
    
    // Show/hide clear button based on initial search content
    const clearButton = document.querySelector('.search-clear-btn');
    if (clearButton) {
        clearButton.style.display = searchBar.value ? 'block' : 'none';
    }
    
    console.log('Search functionality initialized successfully');
}

// This is a direct fix for the search display issue
// Add this to your user.js file, replacing the current enhancedSearch function

function enhancedSearch() {
    const searchQuery = document.querySelector(".search-bar").value.trim();
    const fileType = document.getElementById("filterType").value;
    
    // If the search query is empty, revert to the normal filter view
    if (!searchQuery) {
        filterFiles(fileType);
        return;
    }
    
    console.log("Performing search for:", searchQuery, "with filter:", fileType);
    
    // Show loading state
    filesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching files...</div>';
    
    // API endpoint based on filter type
    let apiEndpoint = '/api/files';
    if (fileType === "favorites") {
        apiEndpoint = '/api/favorites';
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('search', searchQuery);
    if (fileType !== "favorites") {
        queryParams.append('type', fileType);
    }
    
    // Make the API request
    fetch(`${apiEndpoint}?${queryParams.toString()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Search request failed: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Search API response:", data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Important: Make sure we're working with an array
            const files = Array.isArray(data.files) ? data.files : [];
            console.log(`Found ${files.length} files in response`);
            
            // Hide the searching indicator
            const searchingIndicator = document.querySelector('.searching-indicator');
            if (searchingIndicator) {
                searchingIndicator.style.display = 'none';
            }
            
            // If no files found, show a message
            if (files.length === 0) {
                filesGrid.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <p>No files found matching "${searchQuery}"</p>
                        <button class="btn secondary" onclick="clearSearch()">Clear Search</button>
                    </div>`;
                return;
            }
            
            // Create file cards directly in this function to bypass any issues
            // with the updateFilesList function
            filesGrid.innerHTML = ""; // Clear the grid
            
            // Add search results count indicator
            const countIndicator = document.createElement('div');
            countIndicator.classList.add('search-results-count');
            countIndicator.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} found`;
            
            const filesGridParent = filesGrid.parentNode;
            const existingCount = document.querySelector('.search-results-count');
            
            if (existingCount) {
                filesGridParent.removeChild(existingCount);
            }
            
            filesGridParent.insertBefore(countIndicator, filesGrid);
            
            // Create file cards for each result
            files.forEach(file => {
                // Skip files without a filename
                if (!file || !file.filename) return;
                
                const fileType = getFileType(file.filename);
                const fileExt = file.filename.split(".").pop().toUpperCase();
                
                // Format the date safely
                let uploadDate = "Unknown date";
                try {
                    if (file.uploaded_at) {
                        uploadDate = new Date(file.uploaded_at).toLocaleDateString() + " " + 
                                     new Date(file.uploaded_at).toLocaleTimeString();
                    }
                } catch (e) {
                    console.error("Date formatting error:", e);
                }
                
                // Get shortened filename (remove timestamp prefix if present)
                let displayName = file.filename;
                if (displayName.includes('_')) {
                    const parts = displayName.split('_');
                    if (parts.length > 1) {
                        // Skip timestamp part
                        displayName = parts.slice(1).join('_');
                    }
                }
                
                // Create a simplified file card
                const fileCard = document.createElement("div");
                fileCard.classList.add("file-card");
                fileCard.dataset.fileId = file.id || "unknown"; // Store file ID
                
                // Simple file card HTML structure
                fileCard.innerHTML = `
                    <div class="file-icon">
                        <i class="fas ${getIconClass(fileType)}"></i>
                    </div>
                    <div class="file-info">
                        <h3 class="file-name" title="${displayName}">${displayName}</h3>
                        <p class="file-date">Uploaded: ${uploadDate}</p>
                        <p class="file-department">Dept: ${file.uploaded_by_department || 'Unknown'}</p>
                        <span class="file-type">${fileExt}</span>
                        ${file.is_owner ? '<span class="owner-badge">Owner</span>' : ''}
                    </div>
                    <div class="file-actions">
                        <button class="menu-btn" title="More options">
                            <i class="fas fa-ellipsis-vertical"></i>
                        </button>
                        <div class="dropdown-menu hidden">
                            <button class="dropdown-item preview-btn">
                                <i class="fas fa-eye"></i> Preview
                            </button>
                            <button class="dropdown-item download-btn">
                                <i class="fas fa-download"></i> Download
                            </button>
                            <button class="dropdown-item favorite-btn">
                                <i class="fas fa-star"></i> ${filterType.value === "favorites" || file.favorited_at ? 'Remove from' : 'Add to'} Favorites
                            </button>
                            <button class="dropdown-item delete-btn">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
                
                // Add event listeners to the buttons
                const menuBtn = fileCard.querySelector('.menu-btn');
                const dropdownMenu = fileCard.querySelector('.dropdown-menu');
                const previewBtn = fileCard.querySelector('.preview-btn');
                const downloadBtn = fileCard.querySelector('.download-btn');
                const favoriteBtn = fileCard.querySelector('.favorite-btn');
                const deleteBtn = fileCard.querySelector('.delete-btn');
                
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdownMenu.classList.toggle('hidden');
                    
                    // Close all other open dropdowns
                    document.querySelectorAll(".dropdown-menu:not(.hidden)").forEach(menu => {
                        if (menu !== dropdownMenu) {
                            menu.classList.add("hidden");
                        }
                    });
                });
                
                previewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    previewFile(file.filename, displayName);
                });
                
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    downloadFile(file.filename);
                });
                
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (filterType.value === "favorites" || file.favorited_at) {
                        removeFromFavorites(file.id);
                    } else {
                        addToFavorites(file.id);
                    }
                });
                
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    moveToTrash(file.id, displayName);
                });
                
                // Add the file card to the grid
                filesGrid.appendChild(fileCard);
            });
            
            console.log(`Added ${filesGrid.children.length} file cards to the grid`);
        })
        .catch(error => {
            console.error("Search error:", error);
            filesGrid.innerHTML = `
                <div class="search-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error searching files: ${error.message}</p>
                    <button class="btn secondary" onclick="clearSearch()">Reset</button>
                </div>`;
                
            // Hide the searching indicator
            const searchingIndicator = document.querySelector('.searching-indicator');
            if (searchingIndicator) {
                searchingIndicator.style.display = 'none';
            }
        });
}

// Close dropdown menus when clicking elsewhere
document.addEventListener('click', function() {
    document.querySelectorAll(".dropdown-menu:not(.hidden)").forEach(menu => {
        menu.classList.add("hidden");
    });
});

// Log to confirm this script has loaded
console.log("Direct search fix script loaded");

// Function to toggle expiration date/time fields
function toggleExpirationFields() {
    const enableExpiration = document.getElementById('enableExpiration');
    const expirationDate = document.getElementById('expirationDate');
    const expirationTime = document.getElementById('expirationTime');
    
    if (enableExpiration) {
        const isEnabled = enableExpiration.checked;
        
        if (expirationDate) {
            expirationDate.disabled = !isEnabled;
            if (isEnabled) {
                // Set default date to tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                expirationDate.value = tomorrow.toISOString().split('T')[0];
            } else {
                expirationDate.value = '';
            }
        }
        
        if (expirationTime) {
            expirationTime.disabled = !isEnabled;
            if (isEnabled) {
                // Default time to 23:59:59 (end of day)
                expirationTime.value = '23:59:59';
            } else {
                expirationTime.value = '';
            }
        }
    }
}
// Initialize expiration fields on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set up expiration toggle
    const enableExpiration = document.getElementById('enableExpiration');
    if (enableExpiration) {
        enableExpiration.addEventListener('change', toggleExpirationFields);
        // Initial state setup
        toggleExpirationFields();
    }
});

// Function to move a file to trash
function moveToTrash(fileId, fileName) {
    try {
        // Show confirmation dialog
        if (!confirm(`Are you sure you want to move "${fileName}" to trash?`)) {
            return; // User cancelled
        }
        
        console.log(`Moving file to trash: ${fileName} (ID: ${fileId})`);
        
        // Find the file card in the DOM and visually indicate deletion
        const fileCard = document.querySelector(`.file-card[data-file-id="${fileId}"]`);
        if (fileCard) {
            fileCard.classList.add('deleting');
        }
        
        // Send API request to move file to trash
        fetch(`/api/trash/move/${fileId}`, {
            method: 'POST',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        })
        .then(response => response.json())
        .then(data => {
            // Show success toast
            showSuccessToast(data.message || 'File moved to trash');
            
            // Remove file card from current view
            if (fileCard && fileCard.parentNode) {
                fileCard.parentNode.removeChild(fileCard);
            }
            
            // Update the navigation to show the Trash section
            document.querySelectorAll(".nav-links li").forEach(link => link.classList.remove("active"));
            document.querySelector(".nav-links li:nth-child(6)").classList.add("active");
            
            // Update main content for trash view
            document.querySelector(".main-content").classList.add("trash-view");
            
            // Hide quick access section
            const quickAccessSection = document.querySelector('.quick-access');
            if (quickAccessSection) {
                quickAccessSection.style.display = 'none';
            }
            
            // Update welcome section text
            document.querySelector(".welcome-section h1").textContent = "Trash";
            document.querySelector(".welcome-section p").textContent = "Files in trash will be permanently deleted after 30 days";
            
            // Get trash files
            getTrashFiles();
        })
        .catch(error => {
            console.error("Error moving file to trash:", error);
            showErrorToast(`Error: ${error.message}`);
            
            // Remove the animation if there was an error
            if (fileCard) {
                fileCard.classList.remove('deleting');
            }
        });
    } catch (error) {
        console.error("Exception in moveToTrash:", error);
        showErrorToast(`Error: ${error.message}`);
    }
}
// Function to get trash files
function getTrashFiles() {
    // Update page title for trash view
    document.querySelector(".welcome-section h1").textContent = "Trash";
    document.querySelector(".welcome-section p").textContent = "Files in trash will be permanently deleted after 30 days";
    
    // Show loading state
    filesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading trash files...</div>';
    
    // Use a direct fetch with timestamp to prevent caching
    fetch(`/api/trash?timestamp=${Date.now()}`, {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Clear the files grid
        filesGrid.innerHTML = '';
        
        // If no files in trash, show empty message
        if (!data.files || data.files.length === 0) {
            filesGrid.innerHTML = `
                <div class="empty-trash">
                    <i class="fas fa-trash"></i>
                    <p>Trash is empty</p>
                </div>
            `;
            return;
        }
        
        // Replace filter dropdown with empty trash button if not already done
        updateHeaderForTrashView();
        
        // Display trash files
        data.files.forEach(file => {
            createTrashFileCard(file);
        });
    })
    .catch(error => {
        console.error("Error fetching trash files:", error);
        filesGrid.innerHTML = `
            <div class="search-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading trash files: ${error.message}</p>
                <button class="btn secondary" onclick="getTrashFiles()">Retry</button>
            </div>
        `;
    });
}

// Helper function to update header for trash view
function updateHeaderForTrashView() {
    const sectionHeader = document.querySelector('.section-header');
    if (!sectionHeader) return;
    
    // Update section title
    const titleElement = sectionHeader.querySelector('h2');
    if (titleElement) {
        titleElement.textContent = 'Trash';
    }
    
    // Replace filter dropdown with empty trash button if not already done
    if (!sectionHeader.querySelector('.empty-trash-container')) {
        const filterSelect = sectionHeader.querySelector('#filterType');
        if (filterSelect) {
            const emptyTrashBtn = document.createElement('button');
            emptyTrashBtn.classList.add('btn', 'primary', 'empty-trash-btn');
            emptyTrashBtn.innerHTML = '<i class="fas fa-trash"></i> Empty Trash';
            emptyTrashBtn.onclick = confirmEmptyTrash;
            
            const emptyTrashContainer = document.createElement('div');
            emptyTrashContainer.classList.add('empty-trash-container');
            emptyTrashContainer.appendChild(emptyTrashBtn);
            
            sectionHeader.replaceChild(emptyTrashContainer, filterSelect);
        }
    }
}
// Function to create a file card for items in trash
function createTrashFileCard(file) {
    // Skip files without a filename
    if (!file || !file.filename) return;
    
    const fileType = getFileType(file.filename);
    const fileExt = file.filename.split(".").pop().toUpperCase();
    
    // Format the date safely
    let uploadDate = "Unknown date";
    let movedDate = "Unknown date";
    let deletionDate = "Unknown date";
    
    try {
        if (file.uploaded_at) {
            uploadDate = new Date(file.uploaded_at).toLocaleDateString();
        }
        if (file.moved_at) {
            movedDate = new Date(file.moved_at).toLocaleDateString();
        }
        if (file.scheduled_deletion) {
            const delDate = new Date(file.scheduled_deletion);
            deletionDate = delDate.toLocaleDateString();
            
            // Calculate days remaining
            const today = new Date();
            const daysRemaining = Math.ceil((delDate - today) / (1000 * 60 * 60 * 24));
            if (daysRemaining > 0) {
                deletionDate += ` (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)`;
            }
        }
    } catch (e) {
        console.error("Date formatting error:", e);
    }
    
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
    fileCard.classList.add("file-card", "trash-item");
    fileCard.dataset.fileId = file.id || "unknown";
    
    // File icon
    const fileIcon = document.createElement("div");
    fileIcon.classList.add("file-icon");
    fileIcon.innerHTML = `<i class="fas ${getIconClass(fileType)}"></i>`;
    
    // File info
    const fileInfo = document.createElement("div");
    fileInfo.classList.add("file-info");
    
    fileInfo.innerHTML = `
        <h3 class="file-name" title="${displayName}">${displayName}</h3>
        <p class="trash-info"><i class="fas fa-trash"></i> Moved to trash: ${movedDate}</p>
        <p class="deletion-info"><i class="fas fa-clock"></i> Will be deleted on: ${deletionDate}</p>
        <div class="file-badges">
            <span class="file-type">${fileExt}</span>
        </div>
    `;
    
    // File actions
    const fileActions = document.createElement("div");
    fileActions.classList.add("file-actions");
    
    // Restore and delete buttons
    const restoreBtn = document.createElement("button");
    restoreBtn.className = "btn secondary restore-btn";
    restoreBtn.innerHTML = '<i class="fas fa-undo"></i> Restore';
    restoreBtn.onclick = (e) => {
        e.stopPropagation();
        restoreFromTrash(file.id, displayName);
    };
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn delete-btn";
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Forever';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        permanentlyDeleteFile(file.id, displayName);
    };
    
    fileActions.appendChild(restoreBtn);
    fileActions.appendChild(deleteBtn);
    
    // Assemble file card
    fileCard.appendChild(fileIcon);
    fileCard.appendChild(fileInfo);
    fileCard.appendChild(fileActions);
    
    // Add to grid
    filesGrid.appendChild(fileCard);
}
// Function to restore file from trash
// Function to restore file from trash
function restoreFromTrash(fileId, fileName) {
    try {
        // Show confirmation dialog
        if (!confirm(`Restore "${fileName}" from trash?`)) {
            return; // User cancelled
        }
        
        console.log(`Restoring file from trash: ${fileName} (ID: ${fileId})`);
        
        // Get the file card element for animation
        const fileCard = document.querySelector(`.file-card[data-file-id="${fileId}"]`);
        if (fileCard) {
            fileCard.classList.add('restoring'); // Add animation class
        }
        
        // Generate a unique cache-busting timestamp
        const timestamp = Date.now();
        
        // Call API to restore file with strong cache-busting
        fetch(`/api/trash/restore/${fileId}?nocache=${timestamp}`, {
            method: 'POST',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store'
        })
        .then(response => response.json())
        .then(data => {
            // Show success toast
            showSuccessToast(data.message || 'File restored successfully');
            
            // Remove the file card visually
            if (fileCard && fileCard.parentNode) {
                fileCard.parentNode.removeChild(fileCard);
            }
            
            // If this was the last file, show empty trash message
            if (filesGrid.querySelectorAll('.file-card').length === 0) {
                filesGrid.innerHTML = `
                    <div class="empty-trash">
                        <i class="fas fa-trash"></i>
                        <p>Trash is empty</p>
                    </div>
                `;
            }
            
            // Navigate back to Dashboard (All Files)
            document.querySelector(".main-content").classList.remove("trash-view");
            
            // Show quick access again
            const quickAccessSection = document.querySelector('.quick-access');
            if (quickAccessSection) {
                quickAccessSection.style.display = '';
            }
            
            // Restore filter dropdown
            restoreFilterDropdown();
            
            // Update welcome section text
            document.querySelector(".welcome-section h1").textContent = "Welcome back, Users! 👋";
            document.querySelector(".welcome-section p").textContent = "Manage and share your files securely from anywhere.";
            
            // Update active tab in navigation
            document.querySelectorAll(".nav-links li").forEach(link => link.classList.remove("active"));
            document.querySelector(".nav-links li:first-child").classList.add("active");
            
            // Force refresh of files list
            filterFiles("all");
        })
        .catch(error => {
            console.error("Error restoring file from trash:", error);
            showErrorToast(`Error: ${error.message}`);
            
            // Remove animation if there was an error
            if (fileCard) {
                fileCard.classList.remove('restoring');
            }
        });
    } catch (error) {
        console.error("Exception in restoreFromTrash:", error);
        showErrorToast(`Error: ${error.message}`);
    }
}

// Helper function to restore the filter dropdown
function restoreFilterDropdown() {
    const sectionHeader = document.querySelector('.section-header');
    if (sectionHeader && !sectionHeader.querySelector('#filterType')) {
        const emptyTrashContainer = sectionHeader.querySelector('.empty-trash-container');
        if (emptyTrashContainer) {
            const filterSelect = document.createElement('select');
            filterSelect.id = 'filterType';
            filterSelect.className = 'btn secondary';
            filterSelect.innerHTML = `
                <option value="all">All Files</option>
                <option value="documents">Documents</option>
                <option value="images">Images</option>
                <option value="videos">Videos</option>
            `;
            filterSelect.addEventListener('change', (e) => filterFiles(e.target.value));
            sectionHeader.replaceChild(filterSelect, emptyTrashContainer);
        }
    }
    
    // Also make sure to update section title
    const sectionTitle = document.querySelector('.section-header h2');
    if (sectionTitle) {
        sectionTitle.textContent = 'Recent Files';
    }
}
// Function to permanently delete file
function permanentlyDeleteFile(fileId, fileName) {
    try {
        // Show confirmation dialog with warning
        if (!confirm(`WARNING: This will permanently delete "${fileName}". This action cannot be undone. Are you sure?`)) {
            return; // User cancelled
        }
        
        // Get the file card element for animation
        const fileCard = document.querySelector(`.file-card[data-file-id="${fileId}"]`);
        if (fileCard) {
            fileCard.classList.add('deleting'); // Add animation class
        }
        
        // Call API to permanently delete file
        fetch(`/api/trash/delete/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        })
        .then(response => response.json())
        .then(data => {
            // Remove the file card after animation completes
            setTimeout(() => {
                if (fileCard && fileCard.parentNode) {
                    fileCard.parentNode.removeChild(fileCard);
                }
                
                // If this was the last file, show empty trash message
                if (filesGrid.querySelectorAll('.file-card').length === 0) {
                    filesGrid.innerHTML = `
                        <div class="empty-trash">
                            <i class="fas fa-trash"></i>
                            <p>Trash is empty</p>
                        </div>
                    `;
                }
            }, 500); // Match animation duration
            
            // Show success notification
            showSuccessToast(data.message || 'File permanently deleted');
            
        })
        .catch(error => {
            console.error("Error permanently deleting file:", error);
            showErrorToast(`Error: ${error.message}`);
            
            // Remove animation if there was an error
            if (fileCard) {
                fileCard.classList.remove('deleting');
            }
        });
    } catch (error) {
        console.error("Exception in permanentlyDeleteFile:", error);
        showErrorToast(`Error: ${error.message}`);
    }
}
// 3. NEW UTILITY FUNCTION - FORCE GET TRASH FILES
function forceGetTrashFiles() {
    console.log("Force refreshing trash files list");
    
    // Show loading indicator
    filesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading trash files...</div>';
    
    // Generate a unique timestamp for cache busting
    const timestamp = new Date().getTime();
    
    // Make a completely fresh request with aggressive cache prevention
    fetch(`/api/trash?timestamp=${timestamp}`, {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Force-Refresh': 'true'
        },
        cache: 'no-store'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Trash API response:", data);
        
        // Clear the files grid
        filesGrid.innerHTML = '';
        
        // If no files in trash, show empty message
        if (!data.files || data.files.length === 0) {
            filesGrid.innerHTML = `
                <div class="empty-trash">
                    <i class="fas fa-trash"></i>
                    <p>Trash is empty</p>
                </div>
            `;
            return;
        }
        
        // Display trash files
        data.files.forEach(file => {
            createTrashFileCard(file);
        });
        
        console.log(`Displayed ${data.files.length} files in trash`);
    })
    .catch(error => {
        console.error("Error loading trash files:", error);
        filesGrid.innerHTML = `
            <div class="search-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading trash files: ${error.message}</p>
                <button class="btn secondary" onclick="forceGetTrashFiles()">Retry</button>
            </div>
        `;
    });
}

// 4. NEW UTILITY FUNCTION - FORCE REFRESH FILES
function forceRefreshFiles() {
    console.log("Force refreshing files list");
    
    // Show loading indicator
    filesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading files...</div>';
    
    // Generate a unique timestamp for cache busting
    const timestamp = new Date().getTime();
    
    // Make a completely fresh request with aggressive cache prevention
    fetch(`/api/files?type=all&timestamp=${timestamp}`, {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Force-Refresh': 'true'
        },
        cache: 'no-store'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Files API response:", data);
        
        // Use the existing update function to populate the files list
        updateFilesList(data.files || []);
        
        console.log(`Displayed ${data.files ? data.files.length : 0} files`);
    })
    .catch(error => {
        console.error("Error loading files:", error);
        filesGrid.innerHTML = `
            <div class="search-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading files: ${error.message}</p>
                <button class="btn secondary" onclick="forceRefreshFiles()">Retry</button>
            </div>
        `;
    });
}


// Function to confirm and empty trash
function confirmEmptyTrash() {
    // Show confirmation dialog with warning
    if (!confirm("WARNING: This will permanently delete ALL files in trash and cannot be undone. Are you sure?")) {
        return; // User cancelled
    }
    
    emptyTrash();
}

// Function to empty trash
function emptyTrash() {
    try {
        // Show loading state
        filesGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Emptying trash...</div>';
        
        // Call API to empty trash
        fetch('/api/trash/empty', {
            method: 'DELETE',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        })
        .then(response => response.json())
        .then(data => {
            // Update the trash view
            filesGrid.innerHTML = `
                <div class="empty-trash">
                    <i class="fas fa-trash"></i>
                    <p>Trash is empty</p>
                </div>
            `;
            
            // Show success notification
            const deletedCount = data.deleted_count || 0;
            showSuccessToast(`${deletedCount} file${deletedCount !== 1 ? 's' : ''} permanently deleted`);
            
        })
        .catch(error => {
            console.error("Error emptying trash:", error);
            showErrorToast(`Error: ${error.message}`);
            
            // Reload trash files in case of error
            getTrashFiles();
        });
    } catch (error) {
        console.error("Exception in emptyTrash:", error);
        showErrorToast(`Error: ${error.message}`);
    }
}