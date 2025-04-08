import os
import datetime
import io
import redis
import logging
from flask import Blueprint, request, jsonify, session, Response
from werkzeug.utils import secure_filename
from mysql.connector import connect, Error
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes
import base64
import mimetypes
# Add these imports at the top of user_routes.py if not already there
import threading
import time
from apscheduler.schedulers.background import BackgroundScheduler
# Logging configuration
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    handlers=[
                        logging.FileHandler('file_sharing.log'),
                        logging.StreamHandler()
                    ])
logger = logging.getLogger(__name__)

# create blueprint
user_bp = Blueprint('user_bp', __name__)



# File preview and storage configuration
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5 GB
MAX_PREVIEW_SIZE = 10 * 1024 * 1024  # 10 MB max preview size
STREAMING_CHUNK_SIZE = 1024 * 1024  # 1 MB chunks for streaming
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'docx', 'xlsx', 'txt', 'mp4', 'mov', 'avi', 'wmv'}
BLOCKED_EXTENSIONS = {'exe', 'bat', 'sh', 'js', 'msi', 'vbs'}

# Redis caching configuration
try:
    redis_client = redis.Redis(
        host='localhost',  # Replace with your Redis host
        port=6379,  # Default Redis port
        db=0,
        decode_responses=False  # Keep as bytes for file content
    )
    logger.info("Redis connection established successfully")
except Exception as e:
    logger.error(f"Failed to connect to Redis: {e}")
    redis_client = None
# Database Connection 
def get_db_connection():
    try:
        conn = connect(
            host='localhost',
            user='root',
            password='smriti',
            database='secure_file_sharing'
        )
        return conn
    except Error as e:
        logger.error(f"Database connection error: {e}")
        return None

def check_file_size(file):
    """
    Check if file size is within allowed limits
    """
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

def decrypt_file_stream(filepath, encryption_key):
    """
    Generator function to decrypt and stream file contents with caching
    """
    # Check Redis cache first
    if redis_client:
        try:
            cached_file = redis_client.get(filepath)
            if cached_file:
                logger.info(f"File retrieved from Redis cache: {filepath}")
                decrypted_file = decrypt_file(cached_file, encryption_key)
                
                # Stream cached file
                for i in range(0, len(decrypted_file), STREAMING_CHUNK_SIZE):
                    yield decrypted_file[i:i+STREAMING_CHUNK_SIZE]
                return
        except Exception as cache_error:
            logger.error(f"Redis cache error: {cache_error}")

    # File not in cache, decrypt and potentially cache
    try:
        with open(filepath, 'rb') as f:
            encrypted_file = f.read()
            decrypted_file = decrypt_file(encrypted_file, encryption_key)
            
            # Cache in Redis if file is small enough
            if redis_client and len(decrypted_file) <= MAX_PREVIEW_SIZE:
                try:
                    # Store encrypted file in Redis to save decryption overhead
                    redis_client.setex(filepath, 3600, encrypted_file)  # 1-hour expiration
                    logger.info(f"File cached in Redis: {filepath}")
                except Exception as cache_error:
                    logger.error(f"Failed to cache file in Redis: {cache_error}")
            
            # Stream the file in chunks
            for i in range(0, len(decrypted_file), STREAMING_CHUNK_SIZE):
                yield decrypted_file[i:i+STREAMING_CHUNK_SIZE]
    except Exception as e:
        logger.error(f"Decryption error: {e}")
        yield b''


# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Function to check allowed file types
def allowed_file(filename):
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        return "This file type is not allowed"
    return ext in ALLOWED_EXTENSIONS


# Update your existing upload_file function to include the password handling
# Update your upload_file function in user_routes.py to handle expiration time
@user_bp.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    share_with = request.form.get('shareWith', '')
    share_with_users = request.form.getlist('shareWithUsers')  # Get list of user IDs
    is_private = request.form.get('isPrivate', 'false') == 'true'
    description = request.form.get('description', '')
    access_password = request.form.get('password', '')
    is_password_protected = request.form.get('isPasswordProtected', 'false') == 'true'
    
    # Get expiration parameters
    enable_expiration = request.form.get('enableExpiration', 'false') == 'true'
    expiration_date = request.form.get('expirationDate', '')
    expiration_time = request.form.get('expirationTime', '')
    expiration_datetime = None
    
    if enable_expiration and expiration_date:
        try:
            # Use default time if not provided
            if not expiration_time:
                expiration_time = "23:59:59"
                
            # Combine date and time strings into a datetime object
            expiration_str = f"{expiration_date} {expiration_time}"
            expiration_datetime = datetime.datetime.strptime(expiration_str, '%Y-%m-%d %H:%M:%S')
            
            # Verify that expiration time is in the future
            if expiration_datetime <= datetime.datetime.now():
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

    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Fetch uploader's department and name
        cursor.execute("SELECT department, name FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        if not user_data:
            return jsonify({"error": "User not found"}), 400

        uploader_department = user_data['department']
        shared_by_name = user_data['name']  # Fetching name of users that shared file

        filename = secure_filename(file.filename)
        unique_filename = f"{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)

        # Use AES-256 encryption instead of Fernet
        encrypted_file, encryption_key = encrypt_file(file.read())
        
        # Store the encrypted file
        with open(filepath, 'wb') as f:
            f.write(encrypted_file)

        # Store the key as base64 for database storage
        encryption_key_b64 = base64.b64encode(encryption_key).decode('utf-8')

        # Calculate file size
        file_size = os.path.getsize(filepath)

        # Store file with appropriate privacy and password settings (now including expiration)
        if is_password_protected and access_password:
            cursor.execute("""
                INSERT INTO files (
                    user_id, filename, filepath, encryption_key, uploaded_by_department, 
                    uploaded_at, access_password, is_private, file_size, expiration_datetime
                )
                VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s)
            """, (user_id, unique_filename, filepath, encryption_key_b64, uploader_department, 
                  access_password, is_private, file_size, expiration_datetime))
        else:
            cursor.execute("""
                INSERT INTO files (
                    user_id, filename, filepath, encryption_key, uploaded_by_department, 
                    uploaded_at, is_private, file_size, expiration_datetime
                )
                VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s, %s)
            """, (user_id, unique_filename, filepath, encryption_key_b64, uploader_department, 
                  is_private, file_size, expiration_datetime))

        file_id = cursor.lastrowid

        # Insert into `file_shares` if shared with departments and not private
        if share_with and not is_private:
            departments = [dept.strip() for dept in share_with.split(',')]
            for department in departments:
                cursor.execute("""
                    INSERT INTO file_shares (file_id, shared_department, shared_by_name, shared_by_user_id) 
                    VALUES (%s, %s, %s, %s)
                """, (file_id, department, shared_by_name, user_id))
        
        # Insert into `user_file_shares` if shared with specific users
        if share_with_users and not is_private:
            for user_share_id in share_with_users:
                cursor.execute("""
                    INSERT INTO user_file_shares (file_id, shared_with_user_id, shared_by_name, shared_by_user_id, shared_at) 
                    VALUES (%s, %s, %s, %s, NOW())
                """, (file_id, user_share_id, shared_by_name, user_id))

        conn.commit()
        
        # Log the file upload activity - ALWAYS LOG THIS ACTION
        try:
            log_user_activity(
                user_id=user_id,
                activity_type='file_upload',
                description=f"Uploaded file: {filename}" + 
                            (f" (expires: {expiration_datetime})" if expiration_datetime else ""),
                file_id=file_id
            )
            
            # If file was shared, also log sharing activity
            if (share_with and not is_private) or (share_with_users and not is_private):
                share_targets = []
                if share_with:
                    share_targets.append(f"departments: {share_with}")
                if share_with_users:
                    share_targets.append(f"users: {len(share_with_users)}")
                
                log_user_activity(
                    user_id=user_id,
                    activity_type='file_share',
                    description=f"Shared file: {filename} with {', '.join(share_targets)}",
                    file_id=file_id
                )
        except Exception as log_error:
            logger.error(f"Error logging file upload activity: {log_error}")
            # Continue even if activity logging fails
            
        return jsonify({
            "message": "File uploaded successfully!",
            "filename": unique_filename,
            "file_id": file_id,
            "expiration": expiration_datetime.isoformat() if expiration_datetime else None
        }), 201

    except Exception as e:
        logger.error(f"File upload error: {e}")
        return jsonify({"error": f"File upload error: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# Get uploaded files route with filtering
# Get uploaded files route with filtering
# Update the get_uploaded_files route to filter out deleted files
@user_bp.route('/api/files', methods=['GET'])
def get_uploaded_files():
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    search_query = request.args.get('search', '')
    file_type = request.args.get('type', 'all')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get user's department
        cursor.execute("SELECT department FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        if not user_data or not user_data['department']:
            return jsonify({"error": "User department not found"}), 400

        user_department = user_data['department']

        # Base query - with additional shared_by_name from file_shares
        # Now including is_deleted = 0 filter to exclude deleted/expired files
        if file_type == "shared-with-me":
            # Files shared with the user's department or directly with the user
            query = """
                SELECT DISTINCT f.id, f.filename, f.filepath, f.uploaded_at, 
                       f.uploaded_by_department, f.expiration_datetime,
                       COALESCE(fs.shared_by_name, fus.shared_by_name) as shared_by_name,
                       FALSE as is_owner, 
                       CASE 
                           WHEN fus.id IS NOT NULL THEN 'user' 
                           WHEN fs.id IS NOT NULL THEN 'department' 
                           ELSE NULL 
                       END as share_type
                FROM files f
                LEFT JOIN file_shares fs ON f.id = fs.file_id AND fs.shared_department = %s
                LEFT JOIN user_file_shares fus ON f.id = fus.file_id AND fus.shared_with_user_id = %s
                WHERE (
                    (fs.shared_department = %s AND f.user_id != %s) OR 
                    (fus.shared_with_user_id = %s)
                )
                AND (f.is_private = FALSE OR f.is_private IS NULL)
                AND f.is_deleted = 0
            """
            params = [user_department, user_id, user_department, user_id, user_id]
        elif file_type == "my-shares":
            # Files owned by the user and shared with others (departments or users)
            query = """
                SELECT DISTINCT f.id, f.filename, f.filepath, f.uploaded_at, 
                       f.uploaded_by_department, f.expiration_datetime,
                       COALESCE(
                           (SELECT GROUP_CONCAT(shared_department) FROM file_shares WHERE file_id = f.id),
                           (SELECT GROUP_CONCAT(u.name) FROM user_file_shares fus
                            JOIN users u ON fus.shared_with_user_id = u.id
                            WHERE fus.file_id = f.id)
                       ) as shared_with,
                       TRUE as is_owner,
                       CASE 
                           WHEN EXISTS (SELECT 1 FROM user_file_shares WHERE file_id = f.id) THEN 'user' 
                           WHEN EXISTS (SELECT 1 FROM file_shares WHERE file_id = f.id) THEN 'department' 
                           ELSE NULL 
                       END as share_type
                FROM files f
                LEFT JOIN file_shares fs ON f.id = fs.file_id
                LEFT JOIN user_file_shares fus ON f.id = fus.file_id
                WHERE f.user_id = %s
                AND (f.is_private = FALSE OR f.is_private IS NULL)
                AND (fs.id IS NOT NULL OR fus.id IS NOT NULL)
                AND f.is_deleted = 0
                GROUP BY f.id
            """
            params = [user_id]
        elif file_type == "private":
            # Only private files owned by the user
            query = """
                SELECT DISTINCT f.id, f.filename, f.filepath, f.uploaded_at, 
                       f.uploaded_by_department, f.expiration_datetime,
                       NULL as shared_by_name,
                       TRUE as is_owner, NULL as share_type
                FROM files f
                WHERE f.user_id = %s AND f.is_private = TRUE
                AND f.is_deleted = 0
            """
            params = [user_id]
        else:
            # Default query (all files the user has access to)
            query = """
                SELECT DISTINCT f.id, f.filename, f.filepath, f.uploaded_at, 
                       f.uploaded_by_department, f.expiration_datetime,
                       COALESCE(fs.shared_by_name, fus.shared_by_name) as shared_by_name,
                       CASE WHEN f.user_id = %s THEN true ELSE false END as is_owner,
                       CASE 
                           WHEN f.user_id = %s THEN 'owner'
                           WHEN fus.id IS NOT NULL THEN 'user' 
                           WHEN fs.id IS NOT NULL THEN 'department' 
                           ELSE NULL 
                       END as share_type
                FROM files f
                LEFT JOIN file_shares fs ON f.id = fs.file_id AND fs.shared_department = %s
                LEFT JOIN user_file_shares fus ON f.id = fus.file_id AND fus.shared_with_user_id = %s
                WHERE ((f.user_id = %s) OR 
                      (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL)) OR
                      (fus.shared_with_user_id = %s AND (f.is_private = FALSE OR f.is_private IS NULL)))
                AND f.is_deleted = 0
            """
            params = [user_id, user_id, user_department, user_id, user_id, user_department, user_id]

        # Add search filter if provided
        if search_query:
            query += " AND f.filename LIKE %s"
            params.append(f"%{search_query}%")

        # Execute query
        cursor.execute(query, params)
        files = cursor.fetchall()
        
        # Convert datetime objects to strings for JSON serialization
        for file in files:
            if 'expiration_datetime' in file and file['expiration_datetime']:
                file['expiration_datetime'] = file['expiration_datetime'].isoformat()

        return jsonify({"files": files}), 200

    except Exception as e:
        logger.error(f"Error fetching files: {e}")
        return jsonify({"error": f"Error fetching files: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# User Route to get all users
@user_bp.route('/api/users', methods=['GET'])
def get_all_users():
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    current_user_id = session['user_id']

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get all users except the current user
        cursor.execute("""
            SELECT id, name, email, department 
            FROM users 
            WHERE id != %s
            ORDER BY name
        """, (current_user_id,))
        
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
# Add these routes to your flask
@user_bp.route('/api/file-info/<filename>', methods=['GET'])
def get_file_info(filename):
    """Check if a file is password protected and return its info"""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get user's department
        cursor.execute("SELECT department FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        if not user_data or not user_data['department']:
            return jsonify({"error": "User department not found"}), 400

        user_department = user_data['department']

        # Check file access and get password protection status
        cursor.execute("""
            SELECT f.id, f.filename, 
                   CASE WHEN f.access_password IS NOT NULL AND f.access_password != '' 
                        THEN TRUE ELSE FALSE END as isPasswordProtected
            FROM files f
            LEFT JOIN file_shares fs ON f.id = fs.file_id
            LEFT JOIN user_file_shares fus ON f.id = fus.file_id
            WHERE f.filename = %s 
            AND (f.user_id = %s 
                 OR (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL))
                 OR (fus.shared_with_user_id = %s AND (f.is_private = FALSE OR f.is_private IS NULL)))
            LIMIT 1
        """, (filename, user_id, user_department, user_id))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "File not found or you don't have access"}), 404

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
# File download route
# Modified File download route to support query parameter password
@user_bp.route('/api/download/<filename>', methods=['GET', 'POST'])
def download_file(filename):
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    # Get password from POST body or query parameter
    password = ""
    
    if request.method == 'POST':
        password = request.form.get('password', '')
    elif request.method == 'GET':
        password = request.args.get('password', '')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get user's department
        cursor.execute("SELECT department FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        if not user_data or not user_data['department']:
            return jsonify({"error": "User department not found"}), 400

        user_department = user_data['department']

        # Check file access permissions and get password
        cursor.execute("""
            SELECT f.id, f.filepath, f.encryption_key, f.filename as original_filename, 
                   f.access_password, f.user_id as owner_id, f.is_private
            FROM files f
            LEFT JOIN file_shares fs ON f.id = fs.file_id
            LEFT JOIN user_file_shares fus ON f.id = fus.file_id
            WHERE f.filename = %s 
            AND (f.user_id = %s 
                 OR (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL))
                 OR (fus.shared_with_user_id = %s AND (f.is_private = FALSE OR f.is_private IS NULL)))
            LIMIT 1
        """, (filename, user_id, user_department, user_id))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "You do not have permission to access this file"}), 403

        # Check if private and not owner
        if file_record.get('is_private') and file_record['owner_id'] != user_id:
            return jsonify({"error": "This is a private file"}), 403

        # Check if password is required (except for file owner)
        has_password = file_record['access_password'] and file_record['access_password'].strip() != ''
        needs_password = has_password and file_record['owner_id'] != user_id
        
        logger.info(f"Password status for {filename}: has_password={has_password}, needs_password={needs_password}")
        
        if needs_password:
            stored_password = file_record['access_password'] or ''
            
            # For both GET and POST, validate the password if needed
            if password != stored_password:
                logger.warning(f"Incorrect password attempt for file: {filename}")
                # IMPORTANT: Return with proper headers to prevent download
                response = jsonify({"error": "Incorrect password", "requiresPassword": True})
                response.headers["Content-Type"] = "application/json"
                return response, 401
            
            logger.info(f"Correct password provided for file: {filename}")
        
        # If we reach here, either no password is needed or correct password was provided
        # Log the file download activity
        try:
            log_user_activity(
                user_id=user_id,
                activity_type='file_download',
                description=f"Downloaded file: {filename}",
                file_id=file_record['id']
            )
        except Exception as log_error:
            logger.error(f"Error logging file download activity: {log_error}")
        
        # Process file download
        filepath = file_record['filepath']
        encryption_key = base64.b64decode(file_record['encryption_key'])
        
        # Get original filename (without timestamp prefix)
        original_filename = filename
        if '_' in filename:
            original_filename = filename.split('_', 1)[1]

        logger.info(f"Sending file: {filepath}, password was correct or not needed")

        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                encrypted_file = f.read()
                decrypted_file = decrypt_file(encrypted_file, encryption_key)

            # Set explicit content type for file download
            response = Response(decrypted_file, content_type='application/octet-stream')
            response.headers['Content-Disposition'] = f'attachment; filename={original_filename}'
            response.headers['X-Response-Type'] = 'file'
            return response

        return jsonify({"error": "File not found on server"}), 404

    except Exception as e:
        logger.error(f"Error downloading file: {e}", exc_info=True)
        response = jsonify({"error": f"Error downloading file: {str(e)}"})
        response.headers["Content-Type"] = "application/json"
        return response, 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# password verification 
@user_bp.route('/api/verify-password/<filename>', methods=['POST'])
def verify_file_password(filename):
    """Verify file password without downloading the file"""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    password = request.form.get('password', '')
    
    if not password:
        return jsonify({"error": "No password provided"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get user's department
        cursor.execute("SELECT department FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        if not user_data or not user_data['department']:
            return jsonify({"error": "User department not found"}), 400

        user_department = user_data['department']

        # Get file password and check if user has access
        cursor.execute("""
            SELECT f.access_password
            FROM files f
            LEFT JOIN file_shares fs ON f.id = fs.file_id
            LEFT JOIN user_file_shares fus ON f.id = fus.file_id
            WHERE f.filename = %s 
            AND (f.user_id = %s 
                 OR (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL))
                 OR (fus.shared_with_user_id = %s AND (f.is_private = FALSE OR f.is_private IS NULL)))
            LIMIT 1
        """, (filename, user_id, user_department, user_id))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "File not found or you don't have access"}), 404

        # If file has password, verify it
        if file_record['access_password']:
            stored_password = file_record['access_password'].strip()
            input_password = password.strip()
            
            if input_password != stored_password:
                logger.warning(f"Incorrect password attempt for file: {filename}")
                return jsonify({"error": "Incorrect password"}), 401
            
            # Log successful password verification
            try:
                log_user_activity(
                    user_id=user_id,
                    activity_type='password_verify',
                    description=f"Successfully verified password for file: {filename}"
                )
            except Exception as log_error:
                logger.error(f"Error logging password verification: {log_error}")
            
            return jsonify({"success": True, "message": "Password verified"}), 200
        else:
            # If file doesn't have a password
            return jsonify({"success": True, "message": "No password required"}), 200

    except Exception as e:
        logger.error(f"Error verifying password for {filename}: {e}")
        return jsonify({"error": f"Error verifying password: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# Add file to favorites
@user_bp.route('/api/favorites/add/<int:file_id>', methods=['POST'])
def add_to_favorites(file_id):
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Check if file exists and user has access to it
        cursor.execute("""
            SELECT f.id, f.filename
            FROM files f
            LEFT JOIN file_shares fs ON f.id = fs.file_id
            LEFT JOIN users u ON u.id = %s
            WHERE f.id = %s 
            AND (f.user_id = %s OR (fs.shared_department = u.department))
            LIMIT 1
        """, (user_id, file_id, user_id))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "File not found or you don't have access"}), 404

        # Check if already in favorites
        cursor.execute("""
            SELECT * FROM favorites 
            WHERE user_id = %s AND file_id = %s
        """, (user_id, file_id))
        
        if cursor.fetchone():
            return jsonify({"message": "File already in favorites"}), 200

        # Add to favorites
        cursor.execute("""
            INSERT INTO favorites (user_id, file_id, added_at)
            VALUES (%s, %s, NOW())
        """, (user_id, file_id))

        # Log the add to favorites activity - ALWAYS LOG THIS ACTION
        try:
            log_user_activity(
                user_id=user_id,
                activity_type='add_favorite',
                description=f"Added file to favorites: {file_record['filename']}",
                file_id=file_id
            )
        except Exception as log_error:
            logger.error(f"Error logging add to favorites activity: {log_error}")
            # Continue even if activity logging fails

        conn.commit()
        return jsonify({"message": "Added to favorites successfully"}), 201

    except Exception as e:
        return jsonify({"error": f"Error adding to favorites: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# Remove file from favorites
@user_bp.route('/api/favorites/remove/<int:file_id>', methods=['DELETE'])
def remove_from_favorites(file_id):
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get file name for activity log
        cursor.execute("SELECT filename FROM files WHERE id = %s", (file_id,))
        file_info = cursor.fetchone()
        filename = file_info['filename'] if file_info else f"ID: {file_id}"

        # Remove from favorites
        cursor.execute("""
            DELETE FROM favorites
            WHERE user_id = %s AND file_id = %s
        """, (user_id, file_id))

        if cursor.rowcount == 0:
            return jsonify({"error": "File not found in favorites"}), 404
            
        # Log the removal from favorites - ALWAYS LOG THIS ACTION
        try:
            log_user_activity(
                user_id=user_id,
                activity_type='remove_favorite',
                description=f"Removed file from favorites: {filename}",
                file_id=file_id
            )
        except Exception as log_error:
            logger.error(f"Error logging remove from favorites activity: {log_error}")

        conn.commit()
        return jsonify({"message": "Removed from favorites successfully"}), 200

    except Exception as e:
        return jsonify({"error": f"Error removing from favorites: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()


# Get user's favorite files
@user_bp.route('/api/favorites', methods=['GET'])
def get_favorites():
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    search_query = request.args.get('search', '')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Base query to get favorite files with all needed information
        query = """
            SELECT f.id, f.filename, f.filepath, f.uploaded_at, f.uploaded_by_department,
                   fs.shared_by_name, fav.added_at as favorited_at,
                   CASE WHEN f.user_id = %s THEN true ELSE false END as is_owner
            FROM favorites fav
            JOIN files f ON fav.file_id = f.id
            LEFT JOIN file_shares fs ON f.id = fs.file_id
            WHERE fav.user_id = %s
        """
        params = [user_id, user_id]

        # Add search filter if provided
        if search_query:
            query += " AND f.filename LIKE %s"
            params.append(f"%{search_query}%")

        # Execute query
        cursor.execute(query, params)
        favorites = cursor.fetchall()

        return jsonify({"files": favorites}), 200

    except Exception as e:
        return jsonify({"error": f"Error fetching favorites: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
            
# file preview route
@user_bp.route('/api/preview/<filename>', methods=['GET'])
def preview_file(filename):
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    # Get password from query parameter if provided
    password = request.args.get('password', '')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get user's department
        cursor.execute("SELECT department FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        if not user_data or not user_data['department']:
            return jsonify({"error": "User department not found"}), 400

        user_department = user_data['department']

        # Check file access permissions
        cursor.execute("""
            SELECT f.id, f.filepath, f.encryption_key, f.filename, f.filepath, 
                   f.user_id as owner_id, f.is_private, f.access_password
            FROM files f
            LEFT JOIN file_shares fs ON f.id = fs.file_id
            LEFT JOIN user_file_shares fus ON f.id = fus.file_id
            WHERE f.filename = %s 
            AND (f.user_id = %s 
                 OR (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL))
                 OR (fus.shared_with_user_id = %s AND (f.is_private = FALSE OR f.is_private IS NULL)))
            LIMIT 1
        """, (filename, user_id, user_department, user_id))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "You do not have permission to access this file"}), 403
            
        # Check if private and not owner
        if file_record.get('is_private') and file_record['owner_id'] != user_id:
            return jsonify({"error": "This is a private file"}), 403

        # Check if password is required (except for file owner)
        has_password = file_record['access_password'] and file_record['access_password'].strip() != ''
        needs_password = has_password and file_record['owner_id'] != user_id
        
        if needs_password:
            # Verify the provided password if needed
            stored_password = file_record['access_password'].strip()
            provided_password = password.strip()
            
            if not provided_password:
                return jsonify({"error": "Password required", "requiresPassword": True}), 401
                
            if provided_password != stored_password:
                return jsonify({"error": "Incorrect password", "requiresPassword": True}), 401
                
        filepath = file_record['filepath']
        
        # ALWAYS log the preview activity 
        try:
            log_user_activity(
                user_id=user_id,
                activity_type='file_preview',
                description=f"Previewed file: {filename}",
                file_id=file_record['id']
            )
        except Exception as log_error:
            logger.error(f"Error logging file preview activity: {log_error}")
            
        # Decode the base64 encryption key
        encryption_key = base64.b64decode(file_record['encryption_key'])
        
        # Get file extension
        file_ext = filename.rsplit('.', 1)[1].lower()

        # Previewable file types
        image_types = ['png', 'jpg', 'jpeg', 'gif']
        text_types = ['txt', 'log']
        pdf_types = ['pdf']
        document_types = ['docx', 'xlsx']
        video_types = ['mp4', 'mov', 'avi', 'wmv']

        if file_ext not in image_types + text_types + pdf_types + document_types + video_types:
            return jsonify({"error": f"Preview not available for {file_ext} files"}), 400

        with open(filepath, 'rb') as f:
            encrypted_file = f.read()
            decrypted_file = decrypt_file(encrypted_file, encryption_key)

        # Determine content type based on file extension
        content_type_map = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'txt': 'text/plain',
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'wmv': 'video/x-ms-wmv'
        }

        response = Response(decrypted_file, content_type=content_type_map.get(file_ext, 'application/octet-stream'))
        
        if file_ext in image_types:
            response.headers['Content-Disposition'] = f'inline; filename={filename}'
        else:
            response.headers['Content-Disposition'] = f'inline'

        return response

    except Exception as e:
        logger.error(f"Error previewing file: {e}")
        return jsonify({"error": f"Error previewing file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# Comprehensive error handling middleware
@user_bp.errorhandler(Exception)
def handle_global_exception(error):
    """
    Global error handler for unhandled exceptions
    """
    logger.error(f"Unhandled exception: {error}", exc_info=True)
    return jsonify({
        "error": "An unexpected error occurred",
        "details": str(error)
    }), 500
    
# Logout route
@user_bp.route('/api/logout', methods=['POST'])
def logout():
    if 'user_id' in session:
        user_id = session.get('user_id')
        
        # Log the logout activity
        try:
            log_user_activity(
                user_id=user_id,
                activity_type='logout',
                description="User logged out"
            )
        except Exception as log_error:
            logger.error(f"Error logging logout activity: {log_error}")
    
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200

# Make sure log_user_activity helper function is defined
def log_user_activity(user_id, activity_type, description, file_id=None):
    """
    Log a user activity in the database
    
    Parameters:
    user_id (int): The ID of the user performing the action
    activity_type (str): Type of activity (file_upload, file_download, etc.)
    description (str): Description of the activity
    file_id (int, optional): Associated file ID if applicable
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
# Global scheduler for checking expired files
scheduler = BackgroundScheduler()

# Function to check and process expired files
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
            AND is_deleted = 0
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
                    
                    # Log this automatic deletion
                    log_user_activity(
                        user_id=file['user_id'],
                        activity_type='file_expiration',
                        description=f"File automatically deleted due to expiration: {file['filename']}",
                        file_id=file['id']
                    )
                    
                    logger.info(f"Expired file marked as deleted: {file['filename']} (ID: {file['id']})")
                    
                    # Note: We're not deleting the actual file from storage yet
                    # In a production environment, you might want to add a separate cleanup task
                    # that physically removes files that have been marked as deleted for some time
                    
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
# Initialize the scheduler when the app starts
def init_scheduler():
    if not scheduler.running:
        # Check for expired files every minute
        scheduler.add_job(
            check_expired_files,
            'interval',
            minutes=1,
            id='check_expired_files_job'
        )
        scheduler.start()
        logger.info("File expiration scheduler started")
# Initialize the scheduler for checking expired files
init_scheduler()
# Add these trash-related routes to your user_routes.py file

# Move a file to trash
@user_bp.route('/api/trash/move/<int:file_id>', methods=['POST'])
def move_to_trash(file_id):
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']

    try:
        conn = get_db_connection()
        # Use a transaction to ensure database consistency
        conn.autocommit = False
        cursor = conn.cursor(dictionary=True)

        # First, check if the user has permission to delete this file
        cursor.execute("""
            SELECT f.id, f.filename, f.user_id as owner_id
            FROM files f
            WHERE f.id = %s AND f.user_id = %s AND f.is_deleted = 0
        """, (file_id, user_id))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "File not found or you don't have permission to delete it"}), 404

        # Check if the file is already in trash
        cursor.execute("SELECT id FROM trash WHERE file_id = %s", (file_id,))
        if cursor.fetchone():
            # If already in trash, ensure it's marked as deleted in the files table
            cursor.execute("""
                UPDATE files SET is_deleted = 1, deleted_at = NOW()
                WHERE id = %s
            """, (file_id,))
            conn.commit()
            return jsonify({"message": "File already in trash"}), 200

        # Set default scheduled deletion to 30 days from now
        scheduled_deletion = datetime.datetime.now() + datetime.timedelta(days=30)
        
        # Move the file to trash
        cursor.execute("""
            INSERT INTO trash (user_id, file_id, moved_at, scheduled_deletion)
            VALUES (%s, %s, NOW(), %s)
        """, (user_id, file_id, scheduled_deletion))
        
        # Mark file as deleted in the files table
        cursor.execute("""
            UPDATE files SET is_deleted = 1, deleted_at = NOW()
            WHERE id = %s
        """, (file_id,))

        # Log the activity
        log_user_activity(
            user_id=user_id,
            activity_type='move_to_trash',
            description=f"Moved file to trash: {file_record['filename']}",
            file_id=file_id
        )

        # Commit all changes in one transaction
        conn.commit()
        return jsonify({"message": "File moved to trash successfully"}), 200

    except Exception as e:
        # Roll back transaction on error
        if 'conn' in locals() and conn:
            conn.rollback()
        logger.error(f"Error moving file to trash: {e}")
        return jsonify({"error": f"Error moving file to trash: {str(e)}"}), 500
    finally:
        if 'conn' in locals() and conn:
            conn.autocommit = True
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# Get files in trash
@user_bp.route('/api/trash', methods=['GET'])
def get_trash_files():
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    search_query = request.args.get('search', '')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT f.id, f.filename, f.uploaded_at, f.uploaded_by_department,
                   t.moved_at, t.scheduled_deletion
            FROM trash t
            JOIN files f ON t.file_id = f.id
            WHERE t.user_id = %s
        """
        params = [user_id]

        # Add search filter if provided
        if search_query:
            query += " AND f.filename LIKE %s"
            params.append(f"%{search_query}%")

        # Order by most recently moved to trash
        query += " ORDER BY t.moved_at DESC"

        cursor.execute(query, params)
        files = cursor.fetchall()

        # Format dates for JSON
        for file in files:
            if file['moved_at']:
                file['moved_at'] = file['moved_at'].isoformat()
            if file['scheduled_deletion']:
                file['scheduled_deletion'] = file['scheduled_deletion'].isoformat()
            if file['uploaded_at']:
                file['uploaded_at'] = file['uploaded_at'].isoformat()

        return jsonify({"files": files}), 200

    except Exception as e:
        logger.error(f"Error getting trash files: {e}")
        return jsonify({"error": f"Error getting trash files: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# Restore file from trash
@user_bp.route('/api/trash/restore/<int:file_id>', methods=['POST'])
def restore_from_trash(file_id):
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']

    try:
        conn = get_db_connection()
        # Use a transaction to ensure database consistency
        conn.autocommit = False
        cursor = conn.cursor(dictionary=True)

        # First check if the file is in trash and belongs to this user
        cursor.execute("""
            SELECT t.id, f.filename
            FROM trash t
            JOIN files f ON t.file_id = f.id
            WHERE t.file_id = %s AND t.user_id = %s
        """, (file_id, user_id))

        trash_record = cursor.fetchone()
        if not trash_record:
            return jsonify({"error": "File not found in trash or you don't have permission"}), 404

        # IMPORTANT: First update the file's status in the files table
        # This ensures file will be visible in normal views
        cursor.execute("""
            UPDATE files 
            SET is_deleted = 0, deleted_at = NULL
            WHERE id = %s
        """, (file_id,))
        
        # Now remove from trash table
        cursor.execute("DELETE FROM trash WHERE file_id = %s", (file_id,))

        # Log the activity
        log_user_activity(
            user_id=user_id,
            activity_type='restore_from_trash',
            description=f"Restored file from trash: {trash_record['filename']}",
            file_id=file_id
        )

        # Make sure to commit changes in a single transaction
        conn.commit()
        
        return jsonify({
            "message": "File restored successfully", 
            "fileId": file_id,
            "fileName": trash_record['filename']
        }), 200

    except Exception as e:
        # Rollback on error
        if 'conn' in locals() and conn:
            conn.rollback()
        logger.error(f"Error restoring file from trash: {e}")
        return jsonify({"error": f"Error restoring file from trash: {str(e)}"}), 500
    finally:
        if 'conn' in locals() and conn:
            conn.autocommit = True
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# Add a dedicated route to get file status - helpful for debugging
@user_bp.route('/api/file-status/<int:file_id>', methods=['GET'])
def get_file_status(file_id):
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get comprehensive file status
        cursor.execute("""
            SELECT 
                f.id, f.filename, f.is_deleted, f.deleted_at,
                t.id as trash_id, t.moved_at, t.scheduled_deletion
            FROM files f
            LEFT JOIN trash t ON f.id = t.file_id
            WHERE f.id = %s AND f.user_id = %s
        """, (file_id, user_id))

        file_status = cursor.fetchone()
        if not file_status:
            return jsonify({"error": "File not found or you don't have permission"}), 404

        # Convert datetime objects to strings
        for key, value in file_status.items():
            if isinstance(value, datetime.datetime):
                file_status[key] = value.isoformat()

        return jsonify({
            "status": file_status,
            "in_trash": file_status['trash_id'] is not None,
            "is_deleted": file_status['is_deleted'] == 1
        }), 200

    except Exception as e:
        logger.error(f"Error getting file status: {e}")
        return jsonify({"error": f"Error getting file status: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
# Permanently delete file from trash
@user_bp.route('/api/trash/delete/<int:file_id>', methods=['DELETE'])
def permanently_delete_file(file_id):
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    keep_local = request.args.get('keepLocal', 'false').lower() == 'true'

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # First check if the file is in trash and belongs to this user
        cursor.execute("""
            SELECT t.id, f.filename, f.filepath, f.encryption_key
            FROM trash t
            JOIN files f ON t.file_id = f.id
            WHERE t.file_id = %s AND t.user_id = %s
        """, (file_id, user_id))

        trash_record = cursor.fetchone()
        if not trash_record:
            return jsonify({"error": "File not found in trash or you don't have permission"}), 404

        # Store the filepath for possible physical deletion
        filepath = trash_record['filepath']
        
        # First, remove from trash
        cursor.execute("DELETE FROM trash WHERE file_id = %s", (file_id,))
        
        # Remove any file shares
        cursor.execute("DELETE FROM file_shares WHERE file_id = %s", (file_id,))
        cursor.execute("DELETE FROM user_file_shares WHERE file_id = %s", (file_id,))
        
        # Remove from favorites
        cursor.execute("DELETE FROM favorites WHERE file_id = %s", (file_id,))
        
        # Log the activity before deleting from files table
        log_user_activity(
            user_id=user_id,
            activity_type='permanent_delete',
            description=f"Permanently deleted file from dashboard: {trash_record['filename']}",
            file_id=file_id
        )
        
        # Finally delete from files table
        cursor.execute("DELETE FROM files WHERE id = %s", (file_id,))

        conn.commit()
        
        # Optionally, actually delete the physical file if not requested to keep local
        if not keep_local:
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                    logger.info(f"Physical file deleted: {filepath}")
            except Exception as file_error:
                # Log error but don't fail the request if physical deletion fails
                logger.error(f"Error deleting physical file {filepath}: {file_error}")
        else:
            logger.info(f"Keeping local file intact as requested: {filepath}")

        return jsonify({"message": "File permanently deleted from dashboard"}), 200

    except Exception as e:
        logger.error(f"Error permanently deleting file: {e}")
        return jsonify({"error": f"Error permanently deleting file: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()


# Empty trash (delete all files in trash)
@user_bp.route('/api/trash/empty', methods=['DELETE'])
def empty_trash():
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get all files in trash for this user
        cursor.execute("""
            SELECT t.file_id, f.filename, f.filepath
            FROM trash t
            JOIN files f ON t.file_id = f.id
            WHERE t.user_id = %s
        """, (user_id,))

        trash_files = cursor.fetchall()
        
        if not trash_files:
            return jsonify({"message": "Trash is already empty"}), 200

        # Process each file
        for file in trash_files:
            file_id = file['file_id']
            
            # Remove from trash
            cursor.execute("DELETE FROM trash WHERE file_id = %s", (file_id,))
            
            # Remove any file shares and favorites
            cursor.execute("DELETE FROM file_shares WHERE file_id = %s", (file_id,))
            cursor.execute("DELETE FROM user_file_shares WHERE file_id = %s", (file_id,))
            cursor.execute("DELETE FROM favorites WHERE file_id = %s", (file_id,))
            
            # Log individual deletion
            log_user_activity(
                user_id=user_id,
                activity_type='permanent_delete',
                description=f"Permanently deleted file (empty trash): {file['filename']}",
                file_id=file_id
            )
            
            # Delete from files table
            cursor.execute("DELETE FROM files WHERE id = %s", (file_id,))
            
            # Try to delete physical file
            try:
                if os.path.exists(file['filepath']):
                    os.remove(file['filepath'])
            except Exception as file_error:
                logger.error(f"Error deleting physical file {file['filepath']}: {file_error}")

        # Log the empty trash operation
        log_user_activity(
            user_id=user_id,
            activity_type='empty_trash',
            description=f"Emptied trash ({len(trash_files)} files deleted)"
        )

        conn.commit()
        return jsonify({
            "message": "Trash emptied successfully", 
            "deleted_count": len(trash_files)
        }), 200

    except Exception as e:
        logger.error(f"Error emptying trash: {e}")
        return jsonify({"error": f"Error emptying trash: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()