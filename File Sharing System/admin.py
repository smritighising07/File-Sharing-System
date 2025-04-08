from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, Response
import os
from datetime import datetime, timedelta
import base64
import logging
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import Error
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes
import logging
import re
import hashlib
import secrets
from flask import request, jsonify, session

admin_bp = Blueprint('admin', __name__)

# Logging configuration
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    handlers=[
                        logging.FileHandler('admin.log'),
                        logging.StreamHandler()
                    ])
# Get existing logger from admin.py
logger = logging.getLogger(__name__)

# File storage configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'docx', 'xlsx', 'txt', 'mp4', 'mov', 'avi', 'wmv'}
BLOCKED_EXTENSIONS = {'exe', 'bat', 'sh', 'js', 'msi', 'vbs'}
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5 GB

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Database Connection
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='smriti',
            database='secure_file_sharing'
        )
        return conn
    except Error as e:
        logger.error(f"Database connection error: {e}")
        return None

def allowed_file(filename):
    """Check if a file is allowed based on its extension"""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        return "This file type is not allowed"
    return ext in ALLOWED_EXTENSIONS

def check_file_size(file):
    """Check if file size is within allowed limits"""
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset file pointer
    
    if file_size > MAX_FILE_SIZE:
        logger.warning(f"File size exceeded limit: {file_size} bytes")
        return False
    return True

def encrypt_file(file_data, key=None):
    """
    Encrypt file using AES-256
    Returns the encrypted data and the key used for encryption
    """
    if key is None:
        # Generate a random 32-byte key for AES-256
        key = get_random_bytes(32)
    
    # Generate a random IV (Initialization Vector)
    iv = get_random_bytes(16)
    
    # Create cipher object and encrypt the data
    cipher = AES.new(key, AES.MODE_CBC, iv)
    
    # Pad the data to be a multiple of 16 bytes (AES block size)
    padded_data = pad(file_data, AES.block_size)
    encrypted_data = cipher.encrypt(padded_data)
    
    # Prepend IV to the encrypted data for later decryption
    encrypted_data_with_iv = iv + encrypted_data
    
    return encrypted_data_with_iv, key

def decrypt_file(encrypted_data, key):
    """
    Decrypt file using AES-256
    """
    # Extract the IV (first 16 bytes)
    iv = encrypted_data[:16]
    actual_encrypted_data = encrypted_data[16:]
    
    # Create cipher object for decryption
    cipher = AES.new(key, AES.MODE_CBC, iv)
    
    # Decrypt and unpad the data
    decrypted_data = unpad(cipher.decrypt(actual_encrypted_data), AES.block_size)
    
    return decrypted_data

# Route to render the admin dashboard
@admin_bp.route('/dashboard')
def dashboard():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login_page'))
    
    return render_template('admin_dashboard.html')

# Updated route to render the users management page
@admin_bp.route('/users')
def users():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login_page'))
    
    return render_template('users_management.html') 


# Route to render the files management page
@admin_bp.route('/files')
def files():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login_page'))
    
    return render_template('Files Management.html')

# Route to render the activities page
@admin_bp.route('/activities')
def activities():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login_page'))
    
    return render_template('activities.html')
# Route to render the analytics page
@admin_bp.route('/analytics')
def analytics():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login_page'))
    
    return render_template('admin/analytics.html')



# API route to get dashboard statistics
@admin_bp.route('/api/admin/stats')
def get_stats():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get total files
        cursor.execute("SELECT COUNT(*) as count FROM files")
        total_files = cursor.fetchone()['count']
        
        # Get active users - first check if last_login column exists
        try:
            cursor.execute("""
                SELECT COUNT(*) as count FROM users 
                WHERE last_login > DATE_SUB(NOW(), INTERVAL 30 DAY)
            """)
            active_users = cursor.fetchone()['count']
        except Error as e:
            if "Unknown column 'last_login'" in str(e):
                # Fallback: count users who have any activity in the last 30 days
                cursor.execute("""
                    SELECT COUNT(DISTINCT user_id) as count FROM activities 
                    WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
                """)
                active_users = cursor.fetchone()['count']
            else:
                raise
        
        # Get storage used - handle potentially missing file_size column
        cursor.execute("""
            SELECT SUM(
                CASE WHEN file_size IS NOT NULL THEN file_size 
                ELSE (LENGTH(filepath) / 10) -- Fallback estimation if file_size is NULL
                END
            ) as total_size FROM files
        """)
        result = cursor.fetchone()
        storage_used = result['total_size'] if result['total_size'] else 0
        
        # Get shared files count
        cursor.execute("""
            SELECT COUNT(DISTINCT file_id) as count FROM 
            (SELECT file_id FROM file_shares 
             UNION 
             SELECT file_id FROM user_file_shares) as shared_files
        """)
        shared_files = cursor.fetchone()['count']
        
        # Format the storage for display
        if storage_used < 1024:
            readable_storage = f"{storage_used} B"
        elif storage_used < 1024 * 1024:
            readable_storage = f"{storage_used / 1024:.2f} KB"
        elif storage_used < 1024 * 1024 * 1024:
            readable_storage = f"{storage_used / (1024 * 1024):.2f} MB"
        else:
            readable_storage = f"{storage_used / (1024 * 1024 * 1024):.2f} GB"
        
        return jsonify({
            "totalFiles": total_files,
            "activeUsers": active_users,
            "storageUsed": readable_storage,
            "sharedFiles": shared_files
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return jsonify({"error": "Failed to fetch statistics"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to upload file (for admin)
# This is the updated upload_file route for admin.py

# This is the updated upload_file route for admin.py
# It ensures proper handling of expiration settings

@admin_bp.route('/api/admin/upload', methods=['POST'])
def upload_file():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session['user_id']
    
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    share_with = request.form.get('shareWith', '')
    share_with_users = request.form.getlist('shareWithUsers')  # Get list of user IDs
    is_private = request.form.get('isPrivate', 'false') == 'true'
    description = request.form.get('description', '')
    access_password = request.form.get('password', '')
    is_password_protected = access_password != ''

    # Get expiration settings
    expiration_enabled = request.form.get('expirationEnabled', 'false') == 'true'
    expiration_date = request.form.get('expirationDate', '')
    expiration_time = request.form.get('expirationTime', '')
    expiration_datetime = None
    
    # Process expiration datetime if enabled
    if expiration_enabled and expiration_date:
        try:
            # Use default time if not provided
            if not expiration_time:
                expiration_time = "23:59:59"
            
            # Combine date and time into a datetime object
            # Check if the time format includes seconds
            if ":" in expiration_time and len(expiration_time.split(":")) == 2:
                # Add seconds if they're not provided (HH:MM -> HH:MM:00)
                expiration_time = f"{expiration_time}:00"
                
            expiration_str = f"{expiration_date} {expiration_time}"
            expiration_datetime = datetime.strptime(expiration_str, '%Y-%m-%d %H:%M:%S')
            
            # Verify that the expiration time is in the future
            if expiration_datetime <= datetime.now():
                return jsonify({"error": "Expiration time must be in the future"}), 400
            
            logger.info(f"File will expire at: {expiration_datetime}")
        except ValueError as e:
            logger.error(f"Invalid expiration date/time format: {e}")
            return jsonify({"error": "Invalid date or time format"}), 400

    if not file or file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    allowed_check = allowed_file(file.filename)
    if allowed_check is not True:
        return jsonify({"error": allowed_check}), 400

    # FIXED: Check file size first before reading the data
    if not check_file_size(file):
        return jsonify({"error": "File size exceeds the allowed limit"}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Fetch admin's department and name
        cursor.execute("SELECT department, name FROM users WHERE id = %s", (admin_id,))
        admin_data = cursor.fetchone()  # Make sure to fetch the result
        if not admin_data:
            return jsonify({"error": "Admin not found"}), 400

        admin_department = admin_data['department']
        shared_by_name = admin_data['name']  # Fetching name of admin that shared file

        filename = secure_filename(file.filename)
        unique_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)

        # Get file data and size
        file_data = file.read()
        file_size = len(file_data)

        # Use AES-256 encryption
        encrypted_file, encryption_key = encrypt_file(file_data)
        
        # Store the encrypted file
        with open(filepath, 'wb') as f:
            f.write(encrypted_file)

        # Store the key as base64 for database storage
        encryption_key_b64 = base64.b64encode(encryption_key).decode('utf-8')

        # Check if the expiration_datetime column exists in the files table
        try:
            cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'expiration_datetime'")
            column_exists = bool(cursor.fetchone())  # Properly fetch the result
        except Error as e:
            logger.warning(f"Error checking for column existence: {e}")
            column_exists = False

        # Store file with appropriate privacy, password, and expiration settings
        if column_exists:
            # With expiration_datetime column
            if is_password_protected:
                cursor.execute("""
                    INSERT INTO files (user_id, filename, filepath, encryption_key, 
                    uploaded_by_department, uploaded_at, access_password, is_private, description, 
                    file_size, expiration_datetime)
                    VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s, %s)
                """, (admin_id, unique_filename, filepath, encryption_key_b64, admin_department, 
                    access_password, is_private, description, file_size, expiration_datetime))
            else:
                cursor.execute("""
                    INSERT INTO files (user_id, filename, filepath, encryption_key, 
                    uploaded_by_department, uploaded_at, is_private, description, 
                    file_size, expiration_datetime)
                    VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s)
                """, (admin_id, unique_filename, filepath, encryption_key_b64, admin_department, 
                    is_private, description, file_size, expiration_datetime))
        else:
            # Without expiration_datetime column - fall back to standard insertion
            if is_password_protected:
                cursor.execute("""
                    INSERT INTO files (user_id, filename, filepath, encryption_key, 
                    uploaded_by_department, uploaded_at, access_password, is_private, description, file_size)
                    VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s)
                """, (admin_id, unique_filename, filepath, encryption_key_b64, admin_department, 
                    access_password, is_private, description, file_size))
            else:
                cursor.execute("""
                    INSERT INTO files (user_id, filename, filepath, encryption_key, 
                    uploaded_by_department, uploaded_at, is_private, description, file_size)
                    VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s, %s)
                """, (admin_id, unique_filename, filepath, encryption_key_b64, admin_department, 
                    is_private, description, file_size))

            # If expiration is enabled but column doesn't exist, log a warning
            if expiration_enabled and expiration_datetime:
                logger.warning("File expiration requested but expiration_datetime column doesn't exist in files table")

        file_id = cursor.lastrowid

        # Insert into `file_shares` if shared with departments and not private
        if share_with and not is_private:
            departments = [dept.strip() for dept in share_with.split(',')]
            for department in departments:
                cursor.execute("""
                    INSERT INTO file_shares (file_id, shared_department, shared_by_name, shared_by_user_id) 
                    VALUES (%s, %s, %s, %s)
                """, (file_id, department, shared_by_name, admin_id))
        
        # Insert into `user_file_shares` if shared with specific users
        if share_with_users and not is_private:
            for user_share_id in share_with_users:
                cursor.execute("""
                    INSERT INTO user_file_shares (file_id, shared_with_user_id, shared_by_name, shared_by_user_id, shared_at) 
                    VALUES (%s, %s, %s, %s, NOW())
                """, (file_id, user_share_id, shared_by_name, admin_id))

        # FIXED: Update the activities insert to match table structure
        try:
            cursor.execute("""
                INSERT INTO activities (user_id, activity_type, description, file_id, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (admin_id, 'file_upload', f"Uploaded file: {filename}" +
                  (f" (expires: {expiration_datetime})" if expiration_datetime else ""), file_id))
        except Error as e:
            logger.error(f"Error logging activity: {e}")
            # Continue even if activity logging fails

        conn.commit()
        
        response_data = {
            "message": "File uploaded successfully!",
            "filename": unique_filename,
            "file_id": file_id
        }
        
        # Add expiration info to response if applicable
        if expiration_datetime:
            response_data["expiration"] = expiration_datetime.isoformat()
            
        return jsonify(response_data), 201

    except Exception as e:
        logger.error(f"File upload error: {e}")
        return jsonify({"error": f"File upload error: {str(e)}"}), 500
    finally:
        if cursor:
            try:
                # Ensure any unread results are consumed before closing the cursor
                while cursor.nextset():
                    pass
            except:
                pass
            cursor.close()
        if conn:
            conn.close()
# File download route for admin
@admin_bp.route('/api/admin/download/<filename>', methods=['GET', 'POST'])
def download_file(filename):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403

    admin_id = session['user_id']
    logger.info(f"Download request for file: {filename} by admin ID: {admin_id}")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get admin's department
        cursor.execute("SELECT department FROM users WHERE id = %s", (admin_id,))
        admin_data = cursor.fetchone()
        if not admin_data or not admin_data['department']:
            return jsonify({"error": "Admin department not found"}), 400

        admin_department = admin_data['department']

        # Check file access permissions and get password
        cursor.execute("""
            SELECT f.filepath, f.encryption_key, f.filename as original_filename, 
                   f.access_password, f.user_id as owner_id, f.is_private, f.id as file_id
            FROM files f
            WHERE f.filename = %s 
            LIMIT 1
        """, (filename,))

        file_record = cursor.fetchone()
        if not file_record:
            logger.warning(f"File not found: {filename}")
            return jsonify({"error": "File not found"}), 404

        # If file requires a password and the user is not the owner, validate password
        if file_record['access_password'] and file_record['owner_id'] != admin_id:
            password = request.form.get('password') or (request.json.get('password') if request.is_json else '')
            logger.info(f"Password-protected file: {filename}, password provided: {'Yes' if password else 'No'}")

            if not password:
                logger.warning(f"No password provided for password-protected file: {filename}")
                return jsonify({"error": "Password required", "requiresPassword": True}), 401

            # Trim both passwords for comparison to avoid whitespace issues
            db_password = file_record['access_password'].strip() if file_record['access_password'] else ''
            input_password = password.strip()
            
            logger.info(f"Password comparison - DB length: {len(db_password)}, Input length: {len(input_password)}")
            
            # Check if password is correct - RETURN immediately if incorrect
            if input_password != db_password:
                logger.warning(f"Incorrect password provided for file: {filename}")
                return jsonify({"error": "Incorrect password", "requiresPassword": True}), 401
            
            logger.info(f"Password validation successful for file: {filename}")

        filepath = file_record['filepath']
        encryption_key = base64.b64decode(file_record['encryption_key'])

        # Extract original filename
        original_filename = filename.split('_', 1)[1] if '_' in filename else filename

        if os.path.exists(filepath):
            try:
                cursor.execute("""
                    INSERT INTO activities (user_id, activity_type, description, file_id, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                """, (admin_id, 'file_download', f"Downloaded file: {original_filename}", file_record['file_id']))
                conn.commit()
            except Error as e:
                logger.error(f"Error logging activity: {e}")

            logger.info(f"Preparing to decrypt and serve file: {filename}")
            with open(filepath, 'rb') as f:
                encrypted_file = f.read()
                decrypted_file = decrypt_file(encrypted_file, encryption_key)

            response = Response(decrypted_file, content_type='application/octet-stream')
            response.headers['Content-Disposition'] = f'attachment; filename={original_filename}'
            logger.info(f"File download successful: {filename}")
            return response

        logger.warning(f"File exists in DB but not on disk: {filename}")
        return jsonify({"error": "File not found on server"}), 404

    except Exception as e:
        logger.error(f"Error downloading file {filename}: {e}")
        return jsonify({"error": f"Error downloading file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# Add file info check for password protection
@admin_bp.route('/api/admin/file-info/<filename>', methods=['GET'])
def get_file_info(filename):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403

    admin_id = session['user_id']  # FIXED: Using user_id consistently

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Check file access and get password protection status
        cursor.execute("""
            SELECT f.id, f.filename, 
                   CASE WHEN f.access_password IS NOT NULL AND f.access_password != '' 
                        THEN TRUE ELSE FALSE END as isPasswordProtected
            FROM files f
            WHERE f.filename = %s 
            LIMIT 1
        """, (filename,))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "File not found"}), 404

        return jsonify({
            "filename": file_record['filename'],
            "isPasswordProtected": file_record['isPasswordProtected']
        }), 200

    except Exception as e:
        logger.error(f"Error getting file info: {e}")
        return jsonify({"error": f"Error getting file info: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# API route to get recent activities (for admin dashboard)
# Updates to admin.py file - Add these improved activities routes


# Enhanced API route to get activities with more filtering options
# Enhanced API route to get activities with more filtering options
@admin_bp.route('/api/admin/activities')
def get_activities():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    # Get filter parameters
    timeframe = request.args.get('timeframe', 'week')
    activity_type = request.args.get('activity_type', '')
    user_id = request.args.get('user_id', '')
    department = request.args.get('department', '')
    search = request.args.get('search', '')
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Start building the query - this should get ALL users' activities by default
        query = """
            SELECT a.id, a.activity_type, a.description, a.created_at as timestamp,
                  a.file_id, a.user_id, u.name as user_name, u.department, f.filename, 
                  IFNULL(f.file_size, 0) as file_size,
                  SUBSTRING_INDEX(IFNULL(f.filename, ''), '.', -1) as file_type
            FROM activities a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN files f ON a.file_id = f.id
            WHERE 1=1
        """
        params = []
        
        # Add time filter
        if timeframe == 'today':
            query += " AND DATE(a.created_at) = CURDATE()"
        elif timeframe == 'yesterday':
            query += " AND DATE(a.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
        elif timeframe == 'week':
            query += " AND a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        elif timeframe == 'month':
            query += " AND a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        elif timeframe == 'custom' and start_date and end_date:
            query += " AND DATE(a.created_at) BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        
        # Add activity type filter
        if activity_type:
            if activity_type == 'login':
                query += " AND (a.activity_type = 'login' OR a.activity_type = 'logout')"
            elif activity_type == 'user_management':
                query += " AND (a.activity_type LIKE 'user_%')"
            else:
                query += " AND a.activity_type = %s"
                params.append(activity_type)
        
        # Add user filter - only apply if specifically requested
        if user_id:
            query += " AND a.user_id = %s"
            params.append(user_id)
        
        # Add department filter
        if department:
            query += " AND u.department = %s"
            params.append(department)
        
        # Add search filter
        if search:
            query += """ AND (a.description LIKE %s OR u.name LIKE %s 
                       OR f.filename LIKE %s OR a.activity_type LIKE %s)"""
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term, search_term])
        
        # Add order by most recent
        query += " ORDER BY a.created_at DESC LIMIT 500"
        
        # Debug log the query
        logger.info(f"Activities query: {query}")
        logger.info(f"Activities params: {params}")
        
        # Execute query
        cursor.execute(query, params)
        activities = cursor.fetchall()
        
        # Log result count for debugging
        logger.info(f"Found {len(activities)} activities")
        
        # Format activities for response
        formatted_activities = []
        for activity in activities:
            activity_record = {
                'id': activity['id'],
                'activity_type': activity['activity_type'],
                'details': activity['description'],
                'timestamp': activity['timestamp'].strftime('%Y-%m-%d %H:%M:%S') if activity['timestamp'] else '',
                'user_name': activity['user_name'] or 'Unknown User',
                'user_id': activity['user_id'],
                'department': activity['department'] or 'N/A',
                'file_id': activity['file_id']
            }
            
            # Add IP address if available
            # This would require adding an ip_address column to your activities table
            # For now, we'll just use a placeholder
            activity_record['ip_address'] = 'N/A'
            
            # Add file details if available
            if activity['file_id'] and activity['filename']:
                activity_record['filename'] = activity['filename']
                
                # Format file size
                size = activity['file_size']
                if size is None:
                    activity_record['file_size_formatted'] = 'Unknown'
                elif size < 1024:
                    activity_record['file_size_formatted'] = f"{size} B"
                elif size < 1024 * 1024:
                    activity_record['file_size_formatted'] = f"{size / 1024:.2f} KB"
                elif size < 1024 * 1024 * 1024:
                    activity_record['file_size_formatted'] = f"{size / (1024 * 1024):.2f} MB"
                else:
                    activity_record['file_size_formatted'] = f"{size / (1024 * 1024 * 1024):.2f} GB"
                
                activity_record['file_type'] = activity['file_type']
            
            formatted_activities.append(activity_record)
        
        return jsonify({"activities": formatted_activities}), 200
        
    except Exception as e:
        logger.error(f"Error fetching activities: {e}")
        return jsonify({"error": f"Failed to fetch activities: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to get all departments (for file sharing)
@admin_bp.route('/api/admin/all-departments')
def get_all_departments():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Try to get departments from the departments table first
        try:
            cursor.execute("SELECT name FROM departments ORDER BY name")
            departments = [dept['name'] for dept in cursor.fetchall()]
        except Error as e:
            # Fall back to getting distinct departments from users table
            logger.warning(f"Error fetching from departments table: {e}, falling back to users table")
            cursor.execute("SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != ''")
            departments = [dept['department'] for dept in cursor.fetchall()]
        
        return jsonify({"departments": departments}), 200
        
    except Exception as e:
        logger.error(f"Error fetching departments: {e}")
        return jsonify({"error": f"Error fetching departments: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# API route to get all users (for file sharing)
@admin_bp.route('/api/admin/all-users')
def get_all_users():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT id, name, email, department 
            FROM users 
            ORDER BY name
        """)
        
        users = cursor.fetchall()
        return jsonify({"users": users}), 200
        
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({"error": f"Error fetching users: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# Add endpoint to get recent files for the dashboard
@admin_bp.route('/api/admin/recent-files')
def get_recent_files():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    limit = request.args.get('limit', 10, type=int)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get recent files from all users
        cursor.execute("""
            SELECT f.id, f.filename, f.uploaded_at, 
                   u.name as uploaded_by, f.uploaded_by_department as department,
                   CASE WHEN f.access_password IS NOT NULL AND f.access_password != '' 
                        THEN TRUE ELSE FALSE END as is_password_protected,
                   f.is_private
            FROM files f
            JOIN users u ON f.user_id = u.id
            ORDER BY f.uploaded_at DESC
            LIMIT %s
        """, (limit,))
        
        files = cursor.fetchall()
        
        # Format the data for display
        formatted_files = []
        for file in files:
            # Extract display name without timestamp
            display_name = file['filename']
            if '_' in display_name:
                display_name = display_name.split('_', 1)[1]
                
            # Format upload date
            upload_date = file['uploaded_at'].strftime('%Y-%m-%d %H:%M:%S') if file['uploaded_at'] else 'Unknown'
            
            formatted_files.append({
                'id': file['id'],
                'filename': file['filename'],
                'display_name': display_name,
                'uploaded_at': upload_date,
                'uploaded_by': file['uploaded_by'],
                'department': file['department'],
                'is_password_protected': file['is_password_protected'],
                'is_private': file['is_private']
            })
        
        return jsonify({"files": formatted_files}), 200
        
    except Exception as e:
        logger.error(f"Error fetching recent files: {e}")
        return jsonify({"error": f"Error fetching recent files: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# API route to get all users
# API route to get all users
@admin_bp.route('/api/admin/users')
def get_users():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    role_filter = request.args.get('role', '')
    search_query = request.args.get('search', '')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Build query based on filters
        query = """
            SELECT id, name, email, department, role, created_at, last_login
            FROM users
            WHERE 1=1
        """
        params = []
        
        # Apply role filter
        if role_filter and role_filter != 'all':
            query += " AND role = %s"
            params.append(role_filter)
        
        # Apply search filter
        if search_query:
            query += " AND (name LIKE %s OR email LIKE %s OR department LIKE %s)"
            search_term = f"%{search_query}%"
            params.extend([search_term, search_term, search_term])
        
        # Order by name
        query += " ORDER BY name"
        
        cursor.execute(query, params)
        users = cursor.fetchall()
        
        # Format the data for response
        formatted_users = []
        for user in users:
            # Convert timestamps to string if they exist
            if user.get('created_at'):
                user['created_at'] = user['created_at'].isoformat()
            if user.get('last_login'):
                user['last_login'] = user['last_login'].isoformat()
                
            formatted_users.append(user)
        
        return jsonify({"users": formatted_users}), 200
        
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({"error": f"Failed to fetch users: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to get a single user
@admin_bp.route('/api/admin/users/<user_id>')
def get_user(user_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT id, name, email, department, role, created_at, last_login
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Convert timestamps to string if they exist
        if user.get('created_at'):
            user['created_at'] = user['created_at'].isoformat()
        if user.get('last_login'):
            user['last_login'] = user['last_login'].isoformat()
        
        return jsonify({"user": user}), 200
        
    except Exception as e:
        logger.error(f"Error fetching user details: {e}")
        return jsonify({"error": f"Failed to fetch user details: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# API route to create a new user
@admin_bp.route('/api/admin/users', methods=['POST'])
def create_user():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data or not data.get('name') or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Validate email format
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, data.get('email')):
        return jsonify({"error": "Invalid email format"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (data.get('email'),))
        existing_user = cursor.fetchone()
        
        if existing_user:
            return jsonify({"error": "Email already in use"}), 409
        
        # Hash the password directly (without salt since your schema only has password_hash)
        password_hash = hashlib.sha256(data.get('password').encode()).hexdigest()
        
        # Insert new user
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, department)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            data.get('name'), 
            data.get('email'), 
            password_hash, 
            data.get('role', 'user'), 
            data.get('department', '')
        ))
        
        conn.commit()
        
        user_id = cursor.lastrowid
        
        # Log activity
        try:
            admin_id = session.get('user_id')
            cursor.execute("""
                INSERT INTO activities (user_id, activity_type, description, created_at)
                VALUES (%s, %s, %s, NOW())
            """, (admin_id, 'user_create', f"Created user: {data.get('name')} ({data.get('email')})"))
            conn.commit()
        except Exception as log_error:
            logger.error(f"Error logging user creation activity: {log_error}")
        
        return jsonify({
            "success": True,
            "message": "User created successfully",
            "user_id": user_id
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return jsonify({"error": f"Failed to create user: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# API route to update a user
@admin_bp.route('/api/admin/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data or not data.get('name') or not data.get('email'):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Validate email format
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, data.get('email')):
        return jsonify({"error": "Invalid email format"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Check if user exists
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        existing_user = cursor.fetchone()
        
        if not existing_user:
            return jsonify({"error": "User not found"}), 404
        
        # Check if email already exists for another user
        cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (data.get('email'), user_id))
        email_exists = cursor.fetchone()
        
        if email_exists:
            return jsonify({"error": "Email already in use by another user"}), 409
        
        # Prepare update fields
        update_fields = []
        update_values = []
        
        # Basic fields
        update_fields.append("name = %s")
        update_values.append(data.get('name'))
        
        update_fields.append("email = %s")
        update_values.append(data.get('email'))
        
        if 'department' in data:
            update_fields.append("department = %s")
            update_values.append(data.get('department'))
        
        if 'role' in data:
            update_fields.append("role = %s")
            update_values.append(data.get('role'))
        
        # Handle password update if provided
        if data.get('password'):
            password_hash = hashlib.sha256(data.get('password').encode()).hexdigest()
            update_fields.append("password_hash = %s")
            update_values.append(password_hash)
        
        # Build and execute update query
        if update_fields:
            update_sql = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
            update_values.append(user_id)
            
            cursor.execute(update_sql, update_values)
            conn.commit()
            
            # Log activity
            try:
                admin_id = session.get('user_id')
                cursor.execute("""
                    INSERT INTO activities (user_id, activity_type, description, created_at)
                    VALUES (%s, %s, %s, NOW())
                """, (admin_id, 'user_update', f"Updated user: {data.get('name')} (ID: {user_id})"))
                conn.commit()
            except Exception as log_error:
                logger.error(f"Error logging user update activity: {log_error}")
            
            return jsonify({
                "success": True,
                "message": "User updated successfully"
            }), 200
        else:
            return jsonify({"error": "No fields to update"}), 400
        
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        return jsonify({"error": f"Failed to update user: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to delete a user
# API route to delete a user
@admin_bp.route('/api/admin/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    # Prevent deleting own account
    if str(session.get('user_id')) == str(user_id):
        return jsonify({"error": "Cannot delete your own account"}), 400
    
    try:
        conn = get_db_connection()
        conn.autocommit = False  # Start transaction
        cursor = conn.cursor(dictionary=True)
        
        # Get user info for logging
        cursor.execute("SELECT name, email FROM users WHERE id = %s", (user_id,))
        user_info = cursor.fetchone()
        
        if not user_info:
            return jsonify({"error": "User not found"}), 404
        
        # First delete related records from verification_codes
        try:
            cursor.execute("DELETE FROM verification_codes WHERE user_id = %s", (user_id,))
            logger.info(f"Deleted verification codes for user ID {user_id}")
        except Exception as e:
            logger.warning(f"Error deleting verification codes: {e}")
            # Continue even if there are no verification codes

        # Check for any files uploaded by the user
        cursor.execute("SELECT id FROM files WHERE user_id = %s", (user_id,))
        files = cursor.fetchall()
        
        # If user has files, handle them
        if files:
            file_ids = [file['id'] for file in files]
            for file_id in file_ids:
                # Delete shares associated with each file
                try:
                    cursor.execute("DELETE FROM file_shares WHERE file_id = %s", (file_id,))
                    cursor.execute("DELETE FROM user_file_shares WHERE file_id = %s", (file_id,))
                except Exception as e:
                    logger.warning(f"Error deleting file shares for file {file_id}: {e}")
            
            # Delete the files
            try:
                cursor.execute("DELETE FROM files WHERE user_id = %s", (user_id,))
                logger.info(f"Deleted files for user ID {user_id}")
            except Exception as e:
                logger.error(f"Error deleting files: {e}")
                conn.rollback()
                return jsonify({"error": f"Cannot delete user: {str(e)}"}), 500
        
        # Delete activities
        try:
            cursor.execute("DELETE FROM activities WHERE user_id = %s", (user_id,))
            logger.info(f"Deleted activities for user ID {user_id}")
        except Exception as e:
            logger.warning(f"Error deleting activities: {e}")
        
        # Finally delete the user
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"error": "User could not be deleted"}), 500
        
        # Log activity
        try:
            admin_id = session.get('user_id')
            cursor.execute("""
                INSERT INTO activities (user_id, activity_type, description, created_at)
                VALUES (%s, %s, %s, NOW())
            """, (admin_id, 'user_delete', f"Deleted user: {user_info['name']} ({user_info['email']})"))
        except Exception as log_error:
            logger.error(f"Error logging user deletion activity: {log_error}")
        
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": "User deleted successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return jsonify({"error": f"Failed to delete user: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.autocommit = True  # Reset autocommit
            conn.close()
# API route to clear activities
@admin_bp.route('/api/admin/clear-activities', methods=['DELETE'])
def clear_activities():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    
    # Get filter parameters from request
    timeframe = request.args.get('timeframe', 'week')
    activity_type = request.args.get('activity_type', '')
    user_id = request.args.get('user_id', '')
    department = request.args.get('department', '')
    search = request.args.get('search', '')
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    
    try:
        conn = get_db_connection()
        conn.autocommit = False  # Start transaction
        cursor = conn.cursor(dictionary=True)
        
        # Start building the query
        query = "DELETE FROM activities WHERE 1=1"
        params = []
        
        # Add time filter
        if timeframe == 'today':
            query += " AND DATE(created_at) = CURDATE()"
        elif timeframe == 'yesterday':
            query += " AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
        elif timeframe == 'week':
            query += " AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        elif timeframe == 'month':
            query += " AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        elif timeframe == 'custom' and start_date and end_date:
            query += " AND DATE(created_at) BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        
        # Add activity type filter
        if activity_type:
            if activity_type == 'login':
                query += " AND (activity_type = 'login' OR activity_type = 'logout')"
            elif activity_type == 'user_management':
                query += " AND (activity_type LIKE 'user_%')"
            else:
                query += " AND activity_type = %s"
                params.append(activity_type)
        
        # Add user filter
        if user_id:
            query += " AND user_id = %s"
            params.append(user_id)
        
        # Add department filter - this requires a JOIN
        if department:
            query = query.replace("DELETE FROM activities", 
                                 "DELETE a FROM activities a JOIN users u ON a.user_id = u.id")
            query += " AND u.department = %s"
            params.append(department)
        
        # Add search filter - this is more complex for a DELETE query
        if search:
            # For search, we need to identify records first then delete them
            search_query = """
                DELETE FROM activities WHERE id IN (
                    SELECT a.id FROM (
                        SELECT activities.id 
                        FROM activities 
                        LEFT JOIN users ON activities.user_id = users.id
                        LEFT JOIN files ON activities.file_id = files.id
                        WHERE activities.description LIKE %s 
                           OR users.name LIKE %s
                           OR files.filename LIKE %s
                           OR activities.activity_type LIKE %s
                    ) a
                )
            """
            search_term = f"%{search}%"
            
            # Execute the search-based deletion separately
            cursor.execute(search_query, [search_term, search_term, search_term, search_term])
        else:
            # Execute the normal filter-based deletion
            logger.info(f"Clearing activities with query: {query}")
            logger.info(f"Parameters: {params}")
            cursor.execute(query, params)
        
        # Get number of deleted rows
        deleted_count = cursor.rowcount
        
        # Log this activity
        cursor.execute("""
            INSERT INTO activities (user_id, activity_type, description, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (admin_id, 'clear_logs', f"Cleared {deleted_count} activity logs"))
        
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": f"Successfully cleared {deleted_count} activity logs",
            "count": deleted_count
        }), 200
        
    except Exception as e:
        logger.error(f"Error clearing activities: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return jsonify({"error": f"Failed to clear activities: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.autocommit = True  # Reset autocommit
            conn.close()
# fetching the basic file infromation and before returning the response
@admin_bp.route('/api/admin/files')
def get_admin_files():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    search_query = request.args.get('search', '')
    file_type = request.args.get('type', 'all')
    category = request.args.get('category', 'all')
    
    # Get current admin ID
    admin_id = session.get('user_id')
    
    logger.info(f"Files request - Category: {category}, Type: {file_type}, Search: {search_query}")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get admin's department for shared file filtering
        cursor.execute("SELECT department FROM users WHERE id = %s", (admin_id,))
        admin_data = cursor.fetchone()
        admin_department = admin_data['department'] if admin_data and admin_data['department'] else None
        
        # Simplified approach with specific queries for each category
        if category == 'my-files':
            # Query for "My Files" - files uploaded by current user and not in trash
            query = """
                SELECT f.id, f.filename, f.description,
                       IFNULL(f.file_size, 0) as file_size, 
                       f.uploaded_at, f.user_id as uploaded_by_id,
                       u.name as uploaded_by, f.uploaded_by_department as department,
                       u.role as uploader_role,
                       f.is_private, f.access_password IS NOT NULL as is_password_protected,
                       SUBSTRING_INDEX(f.filename, '.', -1) as file_type,
                       EXISTS(SELECT 1 FROM favorites WHERE file_id = f.id AND user_id = %s) as is_favorite,
                       0 as in_trash,
                       f.expiration_datetime
                FROM files f
                JOIN users u ON f.user_id = u.id
                LEFT JOIN trash t ON t.file_id = f.id
                WHERE f.user_id = %s AND t.id IS NULL
                AND (f.is_deleted = 0 OR f.is_deleted IS NULL)
            """
            params = [admin_id, admin_id]  # First for favorites check, second for user_id
            
        elif category == 'shared':
            # Query for "Shared Files" - files YOU have shared with others
            query = """
                SELECT f.id, f.filename, f.description,
                       IFNULL(f.file_size, 0) as file_size, 
                       f.uploaded_at, f.user_id as uploaded_by_id,
                       u.name as uploaded_by, f.uploaded_by_department as department,
                       u.role as uploader_role,
                       f.is_private, f.access_password IS NOT NULL as is_password_protected,
                       SUBSTRING_INDEX(f.filename, '.', -1) as file_type,
                       EXISTS(SELECT 1 FROM favorites WHERE file_id = f.id AND user_id = %s) as is_favorite,
                       0 as in_trash,
                       f.expiration_datetime
                FROM files f
                JOIN users u ON f.user_id = u.id
                LEFT JOIN trash t ON t.file_id = f.id
                WHERE f.user_id = %s 
                AND f.is_private = 0 
                AND t.id IS NULL
                AND (f.is_deleted = 0 OR f.is_deleted IS NULL)
                AND (
                    EXISTS(SELECT 1 FROM file_shares WHERE file_id = f.id)
                    OR EXISTS(SELECT 1 FROM user_file_shares WHERE file_id = f.id)
                )
            """
            params = [admin_id, admin_id]

        elif category == 'favorites':
            # Query for "Favorites" - files marked as favorites by the user
            query = """
                SELECT f.id, f.filename, f.description,
                       IFNULL(f.file_size, 0) as file_size, 
                       f.uploaded_at, f.user_id as uploaded_by_id,
                       u.name as uploaded_by, f.uploaded_by_department as department,
                       u.role as uploader_role,
                       f.is_private, f.access_password IS NOT NULL as is_password_protected,
                       SUBSTRING_INDEX(f.filename, '.', -1) as file_type,
                       1 as is_favorite,
                       0 as in_trash,
                       f.expiration_datetime
                FROM files f
                JOIN users u ON f.user_id = u.id
                JOIN favorites fav ON fav.file_id = f.id AND fav.user_id = %s
                LEFT JOIN trash t ON t.file_id = f.id
                WHERE t.id IS NULL
                AND (f.is_deleted = 0 OR f.is_deleted IS NULL)
            """
            params = [admin_id]
            
        elif category == 'trash':
            # Query for "Trash" - files in trash
            query = """
                SELECT f.id, f.filename, f.description,
                       IFNULL(f.file_size, 0) as file_size, 
                       f.uploaded_at, f.user_id as uploaded_by_id,
                       u.name as uploaded_by, f.uploaded_by_department as department,
                       u.role as uploader_role,
                       f.is_private, f.access_password IS NOT NULL as is_password_protected,
                       SUBSTRING_INDEX(f.filename, '.', -1) as file_type,
                       EXISTS(SELECT 1 FROM favorites WHERE file_id = f.id AND user_id = %s) as is_favorite,
                       1 as in_trash,
                       f.expiration_datetime
                FROM files f
                JOIN users u ON f.user_id = u.id
                JOIN trash t ON t.file_id = f.id
            """
            params = [admin_id]
            
        else:  # 'all' category
            # Query for "All Files" - all files except those in trash
            query = """
                SELECT f.id, f.filename, f.description,
                       IFNULL(f.file_size, 0) as file_size, 
                       f.uploaded_at, f.user_id as uploaded_by_id,
                       u.name as uploaded_by, f.uploaded_by_department as department,
                       u.role as uploader_role,
                       f.is_private, f.access_password IS NOT NULL as is_password_protected,
                       SUBSTRING_INDEX(f.filename, '.', -1) as file_type,
                       EXISTS(SELECT 1 FROM favorites WHERE file_id = f.id AND user_id = %s) as is_favorite,
                       0 as in_trash,
                       f.expiration_datetime
                FROM files f
                JOIN users u ON f.user_id = u.id
                LEFT JOIN trash t ON t.file_id = f.id
                WHERE t.id IS NULL
                AND (f.is_deleted = 0 OR f.is_deleted IS NULL)
            """
            params = [admin_id]
            
        # Add file type filter if specified
        if file_type != 'all':
            type_clause = ""
            if file_type == 'documents':
                type_clause = "AND SUBSTRING_INDEX(f.filename, '.', -1) IN ('pdf', 'docx', 'xlsx', 'txt', 'doc', 'ppt', 'pptx')"
            elif file_type == 'images':
                type_clause = "AND SUBSTRING_INDEX(f.filename, '.', -1) IN ('png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg')"
            elif file_type == 'videos':
                type_clause = "AND SUBSTRING_INDEX(f.filename, '.', -1) IN ('mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv')"
            elif file_type == 'others':
                type_clause = """AND SUBSTRING_INDEX(f.filename, '.', -1) NOT IN 
                            ('pdf', 'docx', 'xlsx', 'txt', 'doc', 'ppt', 'pptx', 
                             'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 
                             'mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv')"""
                             
            query += " " + type_clause
        
        # Add search filter if provided
        if search_query:
            search_clause = " AND (f.filename LIKE %s OR u.name LIKE %s OR f.description LIKE %s)"
            query += search_clause
            search_term = f"%{search_query}%"
            params.extend([search_term, search_term, search_term])
        
        # Add order by most recent
        query += " ORDER BY f.uploaded_at DESC"
        
        # Log the query for debugging
        logger.info(f"Files query: {query}")
        logger.info(f"Parameters: {params}")
        
        # Execute query
        cursor.execute(query, params)
        files = cursor.fetchall()
        
        # Log result for debugging
        logger.info(f"Found {len(files)} files for the category '{category}'")
        
        # Format file sizes and dates
        formatted_files = []
        for file in files:
            file_record = {
                'id': file['id'],
                'filename': file['filename'],
                'description': file['description'] if file['description'] else '',
                'uploaded_by': file['uploaded_by'],
                'uploaded_by_id': file['uploaded_by_id'],
                'uploader_role': file['uploader_role'],
                'department': file['department'],
                'is_private': file['is_private'],
                'is_password_protected': file['is_password_protected'],
                'file_type': file['file_type'],
                'is_favorite': bool(file['is_favorite']),
                'in_trash': bool(file['in_trash'])
            }
            
            # Add expiration info if available
            if 'expiration_datetime' in file and file['expiration_datetime']:
                file_record['expiration_datetime'] = file['expiration_datetime'].isoformat()
            
            # Format file size
            size = file['file_size']
            if size is None:
                file_record['size_formatted'] = 'Unknown'
            elif size < 1024:
                file_record['size_formatted'] = f"{size} B"
            elif size < 1024 * 1024:
                file_record['size_formatted'] = f"{size / 1024:.2f} KB"
            elif size < 1024 * 1024 * 1024:
                file_record['size_formatted'] = f"{size / (1024 * 1024):.2f} MB"
            else:
                file_record['size_formatted'] = f"{size / (1024 * 1024 * 1024):.2f} GB"
            
            # Format date
            if file['uploaded_at']:
                file_record['date_formatted'] = file['uploaded_at'].strftime("%Y-%m-%d %H:%M")
            else:
                file_record['date_formatted'] = 'Unknown'
            
            # Get departments the file is shared with
            cursor.execute("""
                SELECT shared_department 
                FROM file_shares 
                WHERE file_id = %s
            """, (file['id'],))
            shared_departments = [row['shared_department'] for row in cursor.fetchall()]
            
            # Get users the file is shared with
            cursor.execute("""
                SELECT u.name 
                FROM user_file_shares ufs
                JOIN users u ON ufs.shared_with_user_id = u.id
                WHERE ufs.file_id = %s
            """, (file['id'],))
            shared_users = [row['name'] for row in cursor.fetchall()]
            
            # Add sharing information to the file record
            file_record['shared_with'] = {
                'departments': shared_departments,
                'users': shared_users
            }
            
            formatted_files.append(file_record)
        
        return jsonify({"files": formatted_files}), 200
        
    except Exception as e:
        logger.error(f"Error fetching files: {e}")
        return jsonify({"error": f"Failed to fetch files: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to share a file with departments or users
@admin_bp.route('/api/admin/share-file', methods=['POST'])
def share_file():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    data = request.json
    
    # Validate required fields
    if not data or not data.get('file_id'):
        return jsonify({"error": "Missing file_id"}), 400
    
    file_id = data.get('file_id')
    departments = data.get('share_with_departments', [])
    users = data.get('share_with_users', [])
    
    # Check if any departments or users were selected
    if not departments and not users:
        return jsonify({"error": "No departments or users selected"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get admin name and check if file exists
        cursor.execute("""
            SELECT u.name, f.is_private, f.filename
            FROM users u, files f
            WHERE u.id = %s AND f.id = %s
        """, (admin_id, file_id))
        
        result = cursor.fetchone()
        if not result:
            return jsonify({"error": "File or user not found"}), 404
        
        admin_name = result['name']
        is_private = result['is_private']
        filename = result['filename']
        
        if is_private:
            return jsonify({"error": "Cannot share a private file"}), 400
        
        # Share with departments
        if departments:
            for department in departments:
                # Check if already shared with this department
                cursor.execute("""
                    SELECT id FROM file_shares 
                    WHERE file_id = %s AND shared_department = %s
                """, (file_id, department))
                
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO file_shares 
                        (file_id, shared_department, shared_by_name, shared_by_user_id)
                        VALUES (%s, %s, %s, %s)
                    """, (file_id, department, admin_name, admin_id))
        
        # Share with users
        if users:
            for user_id in users:
                # Check if already shared with this user
                cursor.execute("""
                    SELECT id FROM user_file_shares 
                    WHERE file_id = %s AND shared_with_user_id = %s
                """, (file_id, user_id))
                
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO user_file_shares 
                        (file_id, shared_with_user_id, shared_by_name, shared_by_user_id, shared_at)
                        VALUES (%s, %s, %s, %s, NOW())
                    """, (file_id, user_id, admin_name, admin_id))
        
        # Log activity
        cursor.execute("""
            INSERT INTO activities 
            (user_id, activity_type, description, file_id, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (admin_id, 'file_share', f"Shared file: {filename}", file_id))
        
        conn.commit()
        return jsonify({"success": True, "message": "File shared successfully"}), 200
        
    except Exception as e:
        logger.error(f"Error sharing file: {e}")
        return jsonify({"error": f"Failed to share file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to delete a file
@admin_bp.route('/api/admin/files/<file_id>', methods=['DELETE'])
def delete_admin_file(file_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    
    try:
        conn = get_db_connection()
        conn.autocommit = False  # Start transaction
        cursor = conn.cursor(dictionary=True)
        
        # Check if file exists and get file path
        cursor.execute("""
            SELECT f.filepath, f.filename, f.user_id as owner_id
            FROM files f
            WHERE f.id = %s
        """, (file_id,))
        
        file = cursor.fetchone()
        if not file:
            return jsonify({"error": "File not found"}), 404
        
        # Check if admin is the owner or if they have admin privileges
        if file['owner_id'] != admin_id and session.get('role') != 'admin':
            return jsonify({"error": "Not authorized to delete this file"}), 403
        
        # Delete file shares first
        cursor.execute("DELETE FROM file_shares WHERE file_id = %s", (file_id,))
        cursor.execute("DELETE FROM user_file_shares WHERE file_id = %s", (file_id,))
        
        # Delete file activities
        cursor.execute("DELETE FROM activities WHERE file_id = %s", (file_id,))
        
        # Delete the file record
        cursor.execute("DELETE FROM files WHERE id = %s", (file_id,))
        
        # Log the activity
        cursor.execute("""
            INSERT INTO activities 
            (user_id, activity_type, description, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (admin_id, 'file_delete', f"Deleted file: {file['filename']}"))
        
        # Delete the actual file from storage
        if file['filepath'] and os.path.exists(file['filepath']):
            os.remove(file['filepath'])
        
        conn.commit()
        return jsonify({"success": True, "message": "File deleted successfully"}), 200
        
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return jsonify({"error": f"Failed to delete file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.autocommit = True  # Reset autocommit
            conn.close()
#API route to delete user files
# Add this route to your admin_bp blueprint in admin.py

@admin_bp.route('/api/admin/delete-user-file/<file_id>', methods=['DELETE'])
def delete_user_file(file_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    
    try:
        conn = get_db_connection()
        conn.autocommit = False  # Start transaction
        cursor = conn.cursor(dictionary=True)
        
        # First get file info to check existence and get details for logging
        cursor.execute("""
            SELECT f.id, f.filename, f.filepath, f.user_id as owner_id, u.name as owner_name
            FROM files f
            JOIN users u ON f.user_id = u.id
            WHERE f.id = %s
        """, (file_id,))
        
        file = cursor.fetchone()
        if not file:
            return jsonify({"error": "File not found"}), 404
        
        # Get admin name for logging
        cursor.execute("SELECT name FROM users WHERE id = %s", (admin_id,))
        admin_data = cursor.fetchone()
        admin_name = admin_data['name'] if admin_data else 'Unknown Admin'
        
        # Store file info for logging
        filepath = file['filepath']
        filename = file['filename']
        owner_id = file['owner_id']
        owner_name = file['owner_name']
        
        # Delete file shares first
        cursor.execute("DELETE FROM file_shares WHERE file_id = %s", (file_id,))
        cursor.execute("DELETE FROM user_file_shares WHERE file_id = %s", (file_id,))
        
        # Delete from favorites
        cursor.execute("DELETE FROM favorites WHERE file_id = %s", (file_id,))
        
        # Remove from trash if it's there
        cursor.execute("DELETE FROM trash WHERE file_id = %s", (file_id,))
        
        # Log activity for the admin
        cursor.execute("""
            INSERT INTO activities (user_id, activity_type, description, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (admin_id, 'admin_file_delete', 
              f"Deleted user file: {filename} owned by {owner_name} (user ID: {owner_id})"))
        
        # Log activity for the file owner
        cursor.execute("""
            INSERT INTO activities (user_id, activity_type, description, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (owner_id, 'file_deleted_by_admin', 
              f"Your file '{filename}' was deleted by admin: {admin_name}"))
        
        # Delete the file record
        cursor.execute("DELETE FROM files WHERE id = %s", (file_id,))
        
        # Delete the actual file from storage
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        
        conn.commit()
        return jsonify({
            "success": True, 
            "message": f"File '{filename}' owned by {owner_name} has been deleted successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting user file: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return jsonify({"error": f"Failed to delete file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.autocommit = True  # Reset autocommit
            conn.close()
# API route to log activity (e.g., downloads)
@admin_bp.route('/api/admin/log-activity', methods=['POST'])
def log_admin_activity():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    data = request.json
    user_id = session.get('user_id')
    
    # Validate required fields
    if not data or not data.get('activity_type'):
        return jsonify({"error": "Missing activity_type"}), 400
    
    activity_type = data.get('activity_type')
    description = data.get('description', '')
    file_id = data.get('file_id')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # If file_id is provided, get file name for better description
        if file_id and not description:
            cursor.execute("SELECT filename FROM files WHERE id = %s", (file_id,))
            file = cursor.fetchone()
            if file:
                description = f"Interacted with file: {file[0]}"
        
        # Insert activity log
        if file_id:
            cursor.execute("""
                INSERT INTO activities 
                (user_id, activity_type, description, file_id, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (user_id, activity_type, description, file_id))
        else:
            cursor.execute("""
                INSERT INTO activities 
                (user_id, activity_type, description, created_at)
                VALUES (%s, %s, %s, NOW())
            """, (user_id, activity_type, description))
        
        conn.commit()
        return jsonify({"success": True}), 200
        
    except Exception as e:
        logger.error(f"Error logging activity: {e}")
        return jsonify({"error": f"Failed to log activity: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# Add this new route at the end of the file in admin.py

# API route to get current user information
@admin_bp.route('/api/admin/current-user')
def get_current_user():
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in"}), 401
    
    user_id = session.get('user_id')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT id, name, email, department, role 
            FROM users 
            WHERE id = %s
        """, (user_id,))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "user_id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "department": user['department'],
            "role": user['role']
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching current user: {e}")
        return jsonify({"error": "Error fetching user data", "user_id": user_id}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# Add a new API route to export activities
@admin_bp.route('/api/admin/export-activities')
def export_activities():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    # Get filter parameters
    export_format = request.args.get('format', 'csv')
    timeframe = request.args.get('timeframe', 'week')
    activity_type = request.args.get('activity_type', '')
    user_id = request.args.get('user_id', '')
    department = request.args.get('department', '')
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    include_ip = request.args.get('include_ip', 'true') == 'true'
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Start building the query - similar to get_activities but with no LIMIT
        query = """
            SELECT a.id, a.activity_type, a.description, a.created_at as timestamp,
                  a.file_id, u.name as user_name, u.email as user_email, u.department, 
                  f.filename, IFNULL(f.file_size, 0) as file_size,
                  SUBSTRING_INDEX(f.filename, '.', -1) as file_type
            FROM activities a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN files f ON a.file_id = f.id
            WHERE 1=1
        """
        params = []
        
        # Add time filter
        if timeframe == 'today':
            query += " AND DATE(a.created_at) = CURDATE()"
        elif timeframe == 'yesterday':
            query += " AND DATE(a.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
        elif timeframe == 'week':
            query += " AND a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        elif timeframe == 'month':
            query += " AND a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        elif timeframe == 'all':
            pass  # No date filter for all time
        elif timeframe == 'custom' and start_date and end_date:
            query += " AND DATE(a.created_at) BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        
        # Add activity type filter
        if activity_type:
            if activity_type == 'login':
                query += " AND (a.activity_type = 'login' OR a.activity_type = 'logout')"
            elif activity_type == 'user_management':
                query += " AND (a.activity_type LIKE 'user_%')"
            else:
                query += " AND a.activity_type = %s"
                params.append(activity_type)
        
        # Add user filter
        if user_id:
            query += " AND a.user_id = %s"
            params.append(user_id)
        
        # Add department filter
        if department:
            query += " AND u.department = %s"
            params.append(department)
        
        # Add order by most recent
        query += " ORDER BY a.created_at DESC"
        
        # Execute query
        cursor.execute(query, params)
        activities = cursor.fetchall()
        
        # Format activities
        formatted_activities = []
        for activity in activities:
            activity_record = {
                'ID': activity['id'],
                'Timestamp': activity['timestamp'].strftime('%Y-%m-%d %H:%M:%S') if activity['timestamp'] else '',
                'User': activity['user_name'] or 'Unknown',
                'Email': activity['user_email'] or 'N/A',
                'Department': activity['department'] or 'N/A',
                'Activity Type': activity['activity_type'],
                'Description': activity['description'] or 'No details'
            }
            
            # Add IP address if requested
            if include_ip:
                activity_record['IP Address'] = 'N/A'  # Placeholder for IP address
            
            # Add file details if available
            if activity['file_id'] and activity['filename']:
                activity_record['Filename'] = activity['filename']
                
                # Format file size
                size = activity['file_size']
                if size is None:
                    activity_record['File Size'] = 'Unknown'
                elif size < 1024:
                    activity_record['File Size'] = f"{size} B"
                elif size < 1024 * 1024:
                    activity_record['File Size'] = f"{size / 1024:.2f} KB"
                elif size < 1024 * 1024 * 1024:
                    activity_record['File Size'] = f"{size / (1024 * 1024):.2f} MB"
                else:
                    activity_record['File Size'] = f"{size / (1024 * 1024 * 1024):.2f} GB"
                
                activity_record['File Type'] = activity['file_type']
            
            formatted_activities.append(activity_record)
        
        # Generate the export file based on format
        if export_format == 'csv':
            return generate_csv_export(formatted_activities)
        elif export_format == 'json':
            return generate_json_export(formatted_activities)
        elif export_format == 'pdf':
            return generate_pdf_export(formatted_activities)
        else:
            return jsonify({"error": "Unsupported export format"}), 400
            
    except Exception as e:
        logger.error(f"Error exporting activities: {e}")
        return jsonify({"error": f"Failed to export activities: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# CSV export function
def generate_csv_export(activities):
    """Generate and return a CSV file from activities data"""
    if not activities:
        return jsonify({"error": "No activities to export"}), 404
    
    import csv
    from io import StringIO
    
    # First collect all unique field names from all activities
    fieldnames = set()
    for activity in activities:
        for key in activity.keys():
            fieldnames.add(key)
    
    # Sort fieldnames for consistent column order
    fieldnames = sorted(list(fieldnames))
    
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    # For each activity, ensure all expected fields exist before writing
    for activity in activities:
        # Create a new dict with all fields (missing ones set to empty string)
        row = {field: activity.get(field, '') for field in fieldnames}
        writer.writerow(row)
    
    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = f'attachment; filename=activity-log-{datetime.now().strftime("%Y%m%d")}.csv'
    return response
# JSON export function
def generate_json_export(activities):
    """Generate and return a JSON file from activities data"""
    if not activities:
        return jsonify({"error": "No activities to export"}), 404
    
    import json
    
    # Get all possible field names
    all_fields = set()
    for activity in activities:
        for key in activity.keys():
            all_fields.add(key)
    
    # Normalize all activities to have the same structure
    normalized_activities = []
    for activity in activities:
        normalized = {field: activity.get(field, '') for field in all_fields}
        normalized_activities.append(normalized)
    
    response = Response(json.dumps(normalized_activities, indent=2), mimetype='application/json')
    response.headers['Content-Disposition'] = f'attachment; filename=activity-log-{datetime.now().strftime("%Y%m%d")}.json'
    return response

def generate_json_export(activities):
    """Generate and return a JSON file from activities data"""
    if not activities:
        return jsonify({"error": "No activities to export"}), 404
    
    import json
    
    response = Response(json.dumps(activities, indent=2), mimetype='application/json')
    response.headers['Content-Disposition'] = f'attachment; filename=activity-log-{datetime.now().strftime("%Y%m%d")}.json'
    return response

def generate_pdf_export(activities):
    """Generate and return a PDF file from activities data"""
    if not activities:
        return jsonify({"error": "No activities to export"}), 404
    
    try:
        # For PDF generation, you would typically use a library like ReportLab or WeasyPrint
        # This is a simplified implementation for demonstration purposes
        from io import BytesIO
        
        # In a real implementation, format the activities data into a PDF
        output = BytesIO()
        output.write(b"This is a placeholder for PDF export. In a real implementation, this would be a formatted PDF document.")
        output.seek(0)
        
        response = Response(output.getvalue(), mimetype='application/pdf')
        response.headers['Content-Disposition'] = f'attachment; filename=activity-log-{datetime.now().strftime("%Y%m%d")}.pdf'
        return response
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        return jsonify({"error": "PDF generation is not fully implemented"}), 501


# Helper function to log activities
def log_activity(user_id, activity_type, description, file_id=None):
    """
    Log an activity in the database
    
    Parameters:
    user_id (int): The ID of the user performing the action
    activity_type (str): Type of activity (login, file_upload, etc.)
    description (str): Description of the activity
    file_id (int, optional): Associated file ID if applicable
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        logger.info(f"Logging activity for user {user_id}: {activity_type}")
        
        if file_id:
            cursor.execute("""
                INSERT INTO activities (user_id, activity_type, description, file_id, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (user_id, activity_type, description, file_id))
        else:
            cursor.execute("""
                INSERT INTO activities (user_id, activity_type, description, created_at)
                VALUES (%s, %s, %s, NOW())
            """, (user_id, activity_type, description))
            
        conn.commit()
        logger.info(f"Activity logged successfully for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error logging activity for user {user_id}: {e}")
        return False
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to get a specific file's details
@admin_bp.route('/api/admin/file/<file_id>')
def get_file_details(file_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get the file details including expiration_datetime
        query = """
            SELECT f.id, f.filename, f.description, f.filepath, 
                   IFNULL(f.file_size, 0) as file_size, 
                   f.uploaded_at, f.user_id as uploaded_by_id,
                   u.name as uploaded_by, f.uploaded_by_department as department,
                   f.is_private, f.access_password IS NOT NULL as is_password_protected,
                   SUBSTRING_INDEX(f.filename, '.', -1) as file_type,
                   (f.user_id = %s) as is_owned,
                   EXISTS(SELECT 1 FROM favorites WHERE file_id = f.id AND user_id = %s) as is_favorite,
                   EXISTS(SELECT 1 FROM trash WHERE file_id = f.id) as in_trash,
                   f.expiration_datetime
            FROM files f
            JOIN users u ON f.user_id = u.id
            WHERE f.id = %s
        """
        
        cursor.execute(query, (admin_id, admin_id, file_id))
        file = cursor.fetchone()
        
        if not file:
            return jsonify({"error": "File not found"}), 404
        
        # Format file size
        size = file['file_size']
        if size is None:
            file['size_formatted'] = 'Unknown'
        elif size < 1024:
            file['size_formatted'] = f"{size} B"
        elif size < 1024 * 1024:
            file['size_formatted'] = f"{size / 1024:.2f} KB"
        elif size < 1024 * 1024 * 1024:
            file['size_formatted'] = f"{size / (1024 * 1024):.2f} MB"
        else:
            file['size_formatted'] = f"{size / (1024 * 1024 * 1024):.2f} GB"
        
        # Format date
        if file['uploaded_at']:
            file['date_formatted'] = file['uploaded_at'].strftime("%Y-%m-%d %H:%M")
        else:
            file['date_formatted'] = 'Unknown'
        
        # Format expiration date if it exists
        if file['expiration_datetime']:
            file['expiration_formatted'] = file['expiration_datetime'].strftime("%Y-%m-%d %H:%M")
            
            # Add remaining time information
            now = datetime.now()
            expiration = file['expiration_datetime']
            time_remaining = expiration - now
            
            if time_remaining.total_seconds() > 0:
                days = time_remaining.days
                hours = time_remaining.seconds // 3600
                minutes = (time_remaining.seconds % 3600) // 60
                
                if days > 0:
                    file['expiration_remaining'] = f"{days} day{days != 1 and 's' or ''}, {hours} hour{hours != 1 and 's' or ''}"
                elif hours > 0:
                    file['expiration_remaining'] = f"{hours} hour{hours != 1 and 's' or ''}, {minutes} minute{minutes != 1 and 's' or ''}"
                else:
                    file['expiration_remaining'] = f"{minutes} minute{minutes != 1 and 's' or ''}"
            else:
                file['expiration_remaining'] = "Expired"
        
        return jsonify({"file": file}), 200
        
    except Exception as e:
        logger.error(f"Error fetching file details: {e}")
        return jsonify({"error": f"Failed to fetch file details: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to toggle favorite status
@admin_bp.route('/api/admin/toggle-favorite', methods=['POST'])
def toggle_favorite():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    data = request.json
    
    # Validate required fields
    if not data or 'file_id' not in data or 'add_to_favorites' not in data:
        return jsonify({"error": "Missing required fields"}), 400
    
    file_id = data.get('file_id')
    add_to_favorites = data.get('add_to_favorites')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # First check if the file exists
        cursor.execute("SELECT id, filename FROM files WHERE id = %s", (file_id,))
        file = cursor.fetchone()
        
        if not file:
            return jsonify({"error": "File not found"}), 404
        
        # Check if already in favorites
        cursor.execute("SELECT id FROM favorites WHERE file_id = %s AND user_id = %s", (file_id, admin_id))
        existing = cursor.fetchone()
        
        if add_to_favorites and not existing:
            # Add to favorites
            cursor.execute("""
                INSERT INTO favorites (user_id, file_id, added_at)
                VALUES (%s, %s, NOW())
            """, (admin_id, file_id))
            
            activity_description = f"Added file to favorites: {file['filename']}"
            
        elif not add_to_favorites and existing:
            # Remove from favorites
            cursor.execute("DELETE FROM favorites WHERE file_id = %s AND user_id = %s", (file_id, admin_id))
            
            activity_description = f"Removed file from favorites: {file['filename']}"
        else:
            # No action needed, already in desired state
            return jsonify({"success": True, "message": "No change needed"}), 200
        
        # Log the activity
        try:
            cursor.execute("""
                INSERT INTO activities (user_id, activity_type, description, file_id, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (admin_id, 'favorite_toggle', activity_description, file_id))
        except Exception as e:
            logger.warning(f"Error logging favorite activity: {e}")
        
        conn.commit()
        return jsonify({
            "success": True, 
            "message": "Favorites updated successfully",
            "is_favorite": add_to_favorites
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating favorites: {e}")
        return jsonify({"error": f"Failed to update favorites: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to move a file to trash
# API route to move a file to trash
@admin_bp.route('/api/admin/trash-file', methods=['POST'])
def trash_file():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    data = request.json
    
    # Validate required fields
    if not data or 'file_id' not in data:
        return jsonify({"error": "Missing file_id"}), 400
    
    file_id = data.get('file_id')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Check if file exists and get filename
        cursor.execute("SELECT id, filename, user_id FROM files WHERE id = %s", (file_id,))
        file = cursor.fetchone()
        
        if not file:
            return jsonify({"error": "File not found"}), 404
        
        # Check if user owns the file or is an admin
        if file['user_id'] != admin_id and session.get('role') != 'admin':
            return jsonify({"error": "Not authorized to trash this file"}), 403
        
        # Check if already in trash
        cursor.execute("SELECT id FROM trash WHERE file_id = %s", (file_id,))
        if cursor.fetchone():
            return jsonify({"error": "File is already in trash"}), 400
        
        # Set deletion date to 30 days from now
        deletion_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
        
        # Move to trash
        cursor.execute("""
            INSERT INTO trash (user_id, file_id, moved_at, scheduled_deletion)
            VALUES (%s, %s, NOW(), %s)
        """, (admin_id, file_id, deletion_date))
        
        # Update the file record to mark as deleted
        cursor.execute("""
            UPDATE files SET is_deleted = 1, deleted_at = NOW() 
            WHERE id = %s
        """, (file_id,))
        
        # Log the activity
        cursor.execute("""
            INSERT INTO activities (user_id, activity_type, description, file_id, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (admin_id, 'file_trash', f"Moved file to trash: {file['filename']}", file_id))
        
        conn.commit()
        return jsonify({"success": True, "message": "File moved to trash successfully"}), 200
        
    except Exception as e:
        logger.error(f"Error moving file to trash: {e}")
        return jsonify({"error": f"Failed to move file to trash: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# API route to restore a file from trash
@admin_bp.route('/api/admin/restore-file', methods=['POST'])
def restore_file():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    data = request.json
    
    # Validate required fields
    if not data or 'file_id' not in data:
        return jsonify({"error": "Missing file_id"}), 400
    
    file_id = data.get('file_id')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Check if file exists and get filename
        cursor.execute("SELECT id, filename FROM files WHERE id = %s", (file_id,))
        file = cursor.fetchone()
        
        if not file:
            return jsonify({"error": "File not found"}), 404
        
        # Check if file is in trash
        cursor.execute("SELECT id, user_id FROM trash WHERE file_id = %s", (file_id,))
        trash_record = cursor.fetchone()
        
        if not trash_record:
            return jsonify({"error": "File is not in trash"}), 400
        
        # Check if user is authorized to restore
        if trash_record['user_id'] != admin_id and session.get('role') != 'admin':
            return jsonify({"error": "Not authorized to restore this file"}), 403
        
        # Remove from trash
        cursor.execute("DELETE FROM trash WHERE file_id = %s", (file_id,))
        
        # Update the file record to unmark as deleted
        cursor.execute("""
            UPDATE files SET is_deleted = 0, deleted_at = NULL 
            WHERE id = %s
        """, (file_id,))
        
        # Log the activity
        cursor.execute("""
            INSERT INTO activities (user_id, activity_type, description, file_id, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (admin_id, 'file_restore', f"Restored file from trash: {file['filename']}", file_id))
        
        conn.commit()
        return jsonify({"success": True, "message": "File restored successfully"}), 200
        
    except Exception as e:
        logger.error(f"Error restoring file: {e}")
        return jsonify({"error": f"Failed to restore file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# API route to permanently delete a file
@admin_bp.route('/api/admin/permanent-delete-file/<file_id>', methods=['DELETE'])
def permanent_delete_file(file_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403
    
    admin_id = session.get('user_id')
    
    try:
        conn = get_db_connection()
        conn.autocommit = False  # Start transaction
        cursor = conn.cursor(dictionary=True)
        
        # Check if file exists and is in trash
        cursor.execute("""
            SELECT f.id, f.filename, f.filepath, f.user_id, t.id as trash_id 
            FROM files f
            LEFT JOIN trash t ON t.file_id = f.id
            WHERE f.id = %s
        """, (file_id,))
        
        file = cursor.fetchone()
        
        if not file:
            return jsonify({"error": "File not found"}), 404
        
        # Check if the file is in trash
        if not file.get('trash_id'):
            return jsonify({"error": "File must be in trash to be permanently deleted"}), 400
        
        # Check if admin is the owner or if they have admin privileges
        if file['user_id'] != admin_id and session.get('role') != 'admin':
            return jsonify({"error": "Not authorized to delete this file"}), 403
        
        # Delete file shares
        cursor.execute("DELETE FROM file_shares WHERE file_id = %s", (file_id,))
        cursor.execute("DELETE FROM user_file_shares WHERE file_id = %s", (file_id,))
        
        # Delete from favorites
        cursor.execute("DELETE FROM favorites WHERE file_id = %s", (file_id,))
        
        # Delete from trash
        cursor.execute("DELETE FROM trash WHERE file_id = %s", (file_id,))
        
        # Get file activities for logging
        cursor.execute("SELECT id FROM activities WHERE file_id = %s", (file_id,))
        activity_ids = [row['id'] for row in cursor.fetchall()]
        
        # Delete file activities
        if activity_ids:
            cursor.execute("DELETE FROM activities WHERE file_id = %s", (file_id,))
        
        # Log the permanent deletion
        cursor.execute("""
            INSERT INTO activities (user_id, activity_type, description, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (admin_id, 'file_permanent_delete', f"Permanently deleted file: {file['filename']}"))
        
        # Delete the file record
        cursor.execute("DELETE FROM files WHERE id = %s", (file_id,))
        
        # Delete the actual file from storage
        if file['filepath'] and os.path.exists(file['filepath']):
            os.remove(file['filepath'])
        
        conn.commit()
        return jsonify({"success": True, "message": "File permanently deleted"}), 200
        
    except Exception as e:
        logger.error(f"Error permanently deleting file: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return jsonify({"error": f"Failed to delete file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.autocommit = True  # Reset autocommit
            conn.close()

# API route to preview a file
@admin_bp.route('/api/admin/preview/<filename>', methods=['GET'])
def preview_file(filename):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403

    admin_id = session['user_id']
    password = request.args.get('password', '')
    
    logger.info(f"Preview request for file: {filename} by admin ID: {admin_id}")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get admin's department
        cursor.execute("SELECT department FROM users WHERE id = %s", (admin_id,))
        admin_data = cursor.fetchone()
        if not admin_data or not admin_data['department']:
            return jsonify({"error": "Admin department not found"}), 400

        admin_department = admin_data['department']

        # Check file access permissions and get password
        cursor.execute("""
            SELECT f.filepath, f.encryption_key, f.filename as original_filename, 
                   f.access_password, f.user_id as owner_id, f.is_private, f.id as file_id
            FROM files f
            WHERE f.filename = %s 
            LIMIT 1
        """, (filename,))

        file_record = cursor.fetchone()
        if not file_record:
            logger.warning(f"File not found: {filename}")
            return jsonify({"error": "File not found"}), 404

        # If file requires a password and the user is not the owner, validate password
        if file_record['access_password'] and file_record['owner_id'] != admin_id:
            logger.info(f"Password-protected file: {filename}, password provided: {'Yes' if password else 'No'}")

            if not password:
                logger.warning(f"No password provided for password-protected file: {filename}")
                return jsonify({"error": "Password required", "requiresPassword": True}), 401

            # Trim both passwords for comparison to avoid whitespace issues
            db_password = file_record['access_password'].strip() if file_record['access_password'] else ''
            input_password = password.strip()
            
            logger.info(f"Password comparison - DB length: {len(db_password)}, Input length: {len(input_password)}")
            
            # Check if password is correct - RETURN immediately if incorrect
            if input_password != db_password:
                logger.warning(f"Incorrect password provided for file: {filename}")
                return jsonify({"error": "Incorrect password", "requiresPassword": True}), 401
            
            logger.info(f"Password validation successful for file: {filename}")

        filepath = file_record['filepath']
        encryption_key = base64.b64decode(file_record['encryption_key'])

        # Extract original filename
        original_filename = filename.split('_', 1)[1] if '_' in filename else filename

        if os.path.exists(filepath):
            try:
                cursor.execute("""
                    INSERT INTO activities (user_id, activity_type, description, file_id, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                """, (admin_id, 'file_preview', f"Previewed file: {original_filename}", file_record['file_id']))
                conn.commit()
            except Error as e:
                logger.error(f"Error logging activity: {e}")

            logger.info(f"Preparing to decrypt and serve file preview: {filename}")
            with open(filepath, 'rb') as f:
                encrypted_file = f.read()
                decrypted_file = decrypt_file(encrypted_file, encryption_key)

            # Determine content type based on file extension
            file_extension = original_filename.split('.')[-1].lower()
            content_type = get_content_type(file_extension)
            
            response = Response(decrypted_file, content_type=content_type)
            
            # For preview, we don't want to force download
            if content_type != 'application/octet-stream':
                response.headers['Content-Disposition'] = f'inline; filename={original_filename}'
            else:
                # For non-previewable files, we still set download
                response.headers['Content-Disposition'] = f'attachment; filename={original_filename}'
                
            logger.info(f"File preview successful: {filename}")
            return response

        logger.warning(f"File exists in DB but not on disk: {filename}")
        return jsonify({"error": "File not found on server"}), 404

    except Exception as e:
        logger.error(f"Error previewing file {filename}: {e}")
        return jsonify({"error": f"Error previewing file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# Helper function to determine content type for preview
def get_content_type(extension):
    content_types = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'txt': 'text/plain',
        'csv': 'text/plain',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'wmv': 'video/x-ms-wmv',
    }
    return content_types.get(extension.lower(), 'application/octet-stream')
# API route to verify file password without downloading
@admin_bp.route('/api/admin/verify-password/<filename>', methods=['POST'])
def verify_file_password(filename):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Not authorized"}), 403

    admin_id = session['user_id']
    password = request.form.get('password', '')
    
    if not password:
        return jsonify({"error": "No password provided"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get file password
        cursor.execute("""
            SELECT access_password
            FROM files
            WHERE filename = %s 
            LIMIT 1
        """, (filename,))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "File not found"}), 404

        # If file has password, verify it
        if file_record['access_password']:
            db_password = file_record['access_password'].strip()
            input_password = password.strip()
            
            if input_password != db_password:
                return jsonify({"error": "Incorrect password"}), 401
            
            return jsonify({"success": True, "message": "Password verified"}), 200
        else:
            return jsonify({"success": True, "message": "No password required"}), 200

    except Exception as e:
        logger.error(f"Error verifying password for {filename}: {e}")
        return jsonify({"error": f"Error verifying password: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# Set up scheduler for checking expired files
from apscheduler.schedulers.background import BackgroundScheduler
import threading
from datetime import datetime, timedelta

admin_scheduler = None

def check_expired_files():
    """
    Background task to check for and process expired files.
    Marks files as deleted when they've reached their expiration time.
    """
    logger.info("Running expired files check...")
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Find all files that have expired but are not yet marked as deleted
        cursor.execute("""
            SELECT id, filename, filepath, user_id 
            FROM files 
            WHERE expiration_datetime IS NOT NULL 
            AND expiration_datetime <= NOW() 
            AND (is_deleted = 0 OR is_deleted IS NULL)
        """)
        
        expired_files = cursor.fetchall()
        
        if expired_files:
            logger.info(f"Found {len(expired_files)} expired files to process")
            
            for file in expired_files:
                try:
                    # Mark the file as deleted
                    cursor.execute("""
                        UPDATE files 
                        SET is_deleted = 1, deleted_at = NOW() 
                        WHERE id = %s
                    """, (file['id'],))
                    
                    # Add to trash with 30-day deletion schedule
                    deletion_date = datetime.now() + timedelta(days=30)
                    
                    # Check if file is already in trash
                    cursor.execute("SELECT id FROM trash WHERE file_id = %s", (file['id'],))
                    if not cursor.fetchone():
                        cursor.execute("""
                            INSERT INTO trash (user_id, file_id, moved_at, scheduled_deletion)
                            VALUES (%s, %s, NOW(), %s)
                        """, (file['user_id'], file['id'], deletion_date))
                    
                    # Log this automatic deletion
                    cursor.execute("""
                        INSERT INTO activities (user_id, activity_type, description, file_id, created_at)
                        VALUES (%s, %s, %s, %s, NOW())
                    """, (file['user_id'], 'file_expiration', 
                          f"File automatically deleted due to expiration: {file['filename']}", 
                          file['id']))
                    
                    logger.info(f"Expired file marked as deleted: {file['filename']} (ID: {file['id']})")
                    
                except Exception as individual_error:
                    logger.error(f"Error processing expired file {file['id']}: {individual_error}")
                    # Continue with other files even if one fails
            
            # Commit all changes
            conn.commit()
        else:
            logger.info("No expired files found")
            
    except Exception as e:
        logger.error(f"Error in expired files check: {e}")
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

def init_admin_scheduler():
    """Initialize the scheduler for checking expired files"""
    global admin_scheduler
    
    if admin_scheduler is None:
        logger.info("Initializing admin file expiration scheduler...")
        admin_scheduler = BackgroundScheduler()
        admin_scheduler.add_job(
            check_expired_files, 
            'interval', 
            seconds=30,  # Check every 30 seconds for quicker response (changed from 60)
            id='admin_check_expired_files'
        )
        admin_scheduler.start()
        logger.info("Admin file expiration scheduler started")

def init_app(app):
    """Initialize the scheduler when the app starts"""
    # Initialize scheduler once when the app starts
    with app.app_context():
        init_admin_scheduler()
        logger.info("Admin blueprint initialized with scheduler")