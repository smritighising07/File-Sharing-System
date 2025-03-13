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
# Logging configuration
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    handlers=[
                        logging.FileHandler('file_sharing.log'),
                        logging.StreamHandler()
                    ])
logger = logging.getLogger(__name__)

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

@user_bp.route('/api/upload', methods=['POST'])
def upload_file():
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    
    # Validate file size before processing
    if not check_file_size(file):
        return jsonify({
            "error": f"File size exceeds the maximum limit of {MAX_FILE_SIZE / (1024*1024*1024):.2f} GB"
        }), 400


user_bp = Blueprint('user_bp', __name__)

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Database connection
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
        print(f"Database connection error: {e}")
        return None

# Function to check allowed file types
def allowed_file(filename):
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        return "This file type is not allowed"
    return ext in ALLOWED_EXTENSIONS


# Update your existing upload_file function to include the password handling
@user_bp.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    share_with = request.form.get('shareWith', '')
    is_private = request.form.get('isPrivate', 'false') == 'true'
    description = request.form.get('description', '')
    access_password = request.form.get('password', '')
    is_password_protected = request.form.get('isPasswordProtected', 'false') == 'true'

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

        # Store file with appropriate privacy and password settings
        if is_password_protected and access_password:
            cursor.execute("""
                INSERT INTO files (user_id, filename, filepath, encryption_key, 
                uploaded_by_department, uploaded_at, access_password, is_private)
                VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s)
            """, (user_id, unique_filename, filepath, encryption_key_b64, uploader_department, access_password, is_private))
        else:
            cursor.execute("""
                INSERT INTO files (user_id, filename, filepath, encryption_key, 
                uploaded_by_department, uploaded_at, is_private)
                VALUES (%s, %s, %s, %s, %s, NOW(), %s)
            """, (user_id, unique_filename, filepath, encryption_key_b64, uploader_department, is_private))

        file_id = cursor.lastrowid

        # Insert into `file_shares` if shared with departments and not private
        if share_with and not is_private:
            departments = [dept.strip() for dept in share_with.split(',')]
            for department in departments:
                cursor.execute("""
                    INSERT INTO file_shares (file_id, shared_department, shared_by_name) 
                    VALUES (%s, %s, %s)
                """, (file_id, department, shared_by_name))

        conn.commit()
        return jsonify({
            "message": "File uploaded successfully!",
            "filename": unique_filename,
            "file_id": file_id
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
        if file_type == "shared-with-me":
            # Only files shared with the user's department but not owned by the user
            query = """
                SELECT DISTINCT f.id, f.filename, f.filepath, f.uploaded_at, 
                       f.uploaded_by_department, fs.shared_by_name,
                       FALSE as is_owner
                FROM files f
                JOIN file_shares fs ON f.id = fs.file_id
                WHERE fs.shared_department = %s AND f.user_id != %s
                AND (f.is_private = FALSE OR f.is_private IS NULL)
            """
            params = [user_department, user_id]
        elif file_type == "my-shares":
            # Only files owned by the user and shared with others
            query = """
                SELECT DISTINCT f.id, f.filename, f.filepath, f.uploaded_at, 
                       f.uploaded_by_department, fs.shared_department,
                       TRUE as is_owner
                FROM files f
                JOIN file_shares fs ON f.id = fs.file_id
                WHERE f.user_id = %s
                AND (f.is_private = FALSE OR f.is_private IS NULL)
            """
            params = [user_id]
        elif file_type == "private":
            # Only private files owned by the user
            query = """
                SELECT DISTINCT f.id, f.filename, f.filepath, f.uploaded_at, 
                       f.uploaded_by_department, NULL as shared_by_name,
                       TRUE as is_owner
                FROM files f
                WHERE f.user_id = %s AND f.is_private = TRUE
            """
            params = [user_id]
        else:
            # Default query (all files the user has access to)
            query = """
                SELECT DISTINCT f.id, f.filename, f.filepath, f.uploaded_at, 
                       f.uploaded_by_department, fs.shared_by_name,
                       CASE WHEN f.user_id = %s THEN true ELSE false END as is_owner
                FROM files f
                LEFT JOIN file_shares fs ON f.id = fs.file_id
                WHERE (f.user_id = %s) OR 
                      (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL))
            """
            params = [user_id, user_id, user_department]

        # Add search filter if provided
        if search_query:
            query += " AND f.filename LIKE %s"
            params.append(f"%{search_query}%")

        # Execute query
        cursor.execute(query, params)
        files = cursor.fetchall()

        return jsonify({"files": files}), 200

    except Exception as e:
        return jsonify({"error": f"Error fetching files: {str(e)}"}), 500
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
            WHERE f.filename = %s 
            AND (f.user_id = %s 
                 OR (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL)))
            LIMIT 1
        """, (filename, user_id, user_department))

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
@user_bp.route('/api/download/<filename>', methods=['GET', 'POST'])
def download_file(filename):
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

        # Check file access permissions and get password
        cursor.execute("""
            SELECT f.filepath, f.encryption_key, f.filename as original_filename, 
                   f.access_password, f.user_id as owner_id, f.is_private
            FROM files f
            LEFT JOIN file_shares fs ON f.id = fs.file_id
            WHERE f.filename = %s 
            AND (f.user_id = %s 
                 OR (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL)))
            LIMIT 1
        """, (filename, user_id, user_department))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "You do not have permission to access this file"}), 403

        # Check if private and not owner
        if file_record.get('is_private') and file_record['owner_id'] != user_id:
            return jsonify({"error": "This is a private file"}), 403

        # Check if password is required (except for the file owner)
        if (file_record['access_password'] and file_record['owner_id'] != user_id and 
            request.method == 'GET'):
            # Password required but not provided via POST
            return jsonify({"error": "Password required", "requiresPassword": True}), 401
        
        # Validate password if provided and required
        if (file_record['access_password'] and file_record['owner_id'] != user_id and 
            request.method == 'POST'):
            password = request.form.get('password', '')
            if password != file_record['access_password']:
                return jsonify({"error": "Incorrect password"}), 401

        filepath = file_record['filepath']
        # Decode the base64 encryption key
        encryption_key = base64.b64decode(file_record['encryption_key'])
        
        # Get original filename (without timestamp prefix)
        original_filename = filename
        if '_' in filename:
            original_filename = filename.split('_', 1)[1]

        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                encrypted_file = f.read()
                decrypted_file = decrypt_file(encrypted_file, encryption_key)

            response = Response(decrypted_file, content_type='application/octet-stream')
            response.headers['Content-Disposition'] = f'attachment; filename={original_filename}'
            return response

        return jsonify({"error": "File not found on server"}), 404

    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        return jsonify({"error": f"Error downloading file: {str(e)}"}), 500
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
            SELECT f.id
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

        # Remove from favorites
        cursor.execute("""
            DELETE FROM favorites
            WHERE user_id = %s AND file_id = %s
        """, (user_id, file_id))

        if cursor.rowcount == 0:
            return jsonify({"error": "File not found in favorites"}), 404

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
            SELECT f.filepath, f.encryption_key, f.filename, f.filepath, f.user_id as owner_id, f.is_private
            FROM files f
            LEFT JOIN file_shares fs ON f.id = fs.file_id
            WHERE f.filename = %s 
            AND (f.user_id = %s 
                 OR (fs.shared_department = %s AND (f.is_private = FALSE OR f.is_private IS NULL)))
            LIMIT 1
        """, (filename, user_id, user_department))

        file_record = cursor.fetchone()
        if not file_record:
            return jsonify({"error": "You do not have permission to access this file"}), 403
         # Check if private and not owner
        if file_record.get('is_private') and file_record['owner_id'] != user_id:
            return jsonify({"error": "This is a private file"}), 403

        filepath = file_record['filepath']
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
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200