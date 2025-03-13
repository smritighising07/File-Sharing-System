from flask import Blueprint, render_template, request, redirect, url_for, flash, session
import os
import mysql.connector
from mysql.connector import Error
from werkzeug.utils import secure_filename
import bcrypt  # Secure password hashing

admin_bp = Blueprint('admin', __name__)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'docx'}

# Ensure the upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# ✅ Function to connect to the database
def get_db_connection():
    try:
        return mysql.connector.connect(
            host="localhost",
            user="root",
            password="smriti",
            database="secure_file_sharing"
        )
    except Error as e:
        print(f"Database connection error: {e}")
        return None

# ✅ Check if a file type is allowed
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ✅ Admin Dashboard Route
@admin_bp.route('/admin_dashboard')
def admin_dashboard():
    conn = get_db_connection()
    if not conn:
        flash("Database connection failed!", "danger")
        return redirect(url_for('admin.admin_dashboard'))
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()
    
    cursor.execute("SELECT * FROM files")
    files = cursor.fetchall()

    cursor.close()
    conn.close()
    
    return render_template('admin_dashboard.html', users=users, files=files)

# ✅ Add User Route (with password hashing)
@admin_bp.route('/add_user', methods=['POST'])
def add_user():
    name = request.form['name']
    email = request.form['email']
    password = request.form['password']

    if not name or not email or not password:
        flash('All fields are required!', 'danger')
        return redirect(url_for('admin.admin_dashboard'))

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)", 
                       (name, email, hashed_password, 'user'))  # Default role as 'user'
        conn.commit()
        flash('User added successfully!', 'success')
    except Error as e:
        flash(f"Error adding user: {e}", 'danger')
    finally:
        cursor.close()
        conn.close()

    return redirect(url_for('admin.admin_dashboard'))

# ✅ Delete User Route
@admin_bp.route('/delete_user/<int:user_id>')
def delete_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        flash('User deleted successfully!', 'success')
    except Error as e:
        flash(f"Error deleting user: {e}", 'danger')
    finally:
        cursor.close()
        conn.close()
    
    return redirect(url_for('admin.admin_dashboard'))

# ✅ Upload File Route (with security)
@admin_bp.route('/upload_file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        flash('No file part', 'danger')
        return redirect(url_for('admin.admin_dashboard'))

    file = request.files['file']
    if file.filename == '':
        flash('No selected file', 'danger')
        return redirect(url_for('admin.admin_dashboard'))

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)

        # Prevent overwriting existing files
        if os.path.exists(file_path):
            flash('File with the same name already exists!', 'warning')
            return redirect(url_for('admin.admin_dashboard'))

        file.save(file_path)

        # Insert file record into the database
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO files (filename, user_id, filepath) VALUES (%s, %s, %s)",
                           (filename, session.get('user_id', 1), file_path))  # Using session user_id or default to 1
            conn.commit()
            flash('File uploaded successfully!', 'success')
        except Error as e:
            flash(f"Error uploading file: {e}", 'danger')
        finally:
            cursor.close()
            conn.close()
    else:
        flash('Invalid file type!', 'danger')

    return redirect(url_for('admin.admin_dashboard'))

# ✅ Delete File Route
@admin_bp.route('/delete_file/<int:file_id>')
def delete_file(file_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT filename FROM files WHERE id = %s", (file_id,))
        file = cursor.fetchone()
        
        if file:
            file_path = os.path.join(UPLOAD_FOLDER, file[0])
            if os.path.exists(file_path):
                os.remove(file_path)
            
            cursor.execute("DELETE FROM files WHERE id = %s", (file_id,))
            conn.commit()
            flash('File deleted successfully!', 'success')
        else:
            flash('File not found!', 'danger')

    except Error as e:
        flash(f"Error deleting file: {e}", 'danger')
    finally:
        cursor.close()
        conn.close()

    return redirect(url_for('admin.admin_dashboard'))
