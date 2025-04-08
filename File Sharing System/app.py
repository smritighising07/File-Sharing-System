import os
import bcrypt
import secrets
import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify, session, redirect, url_for, render_template
import mysql.connector
from mysql.connector import Error
from admin import admin_bp, log_activity  # Import admin routes and log_activity function
from user_routes import user_bp  # Import user routes
import uuid
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Secure session key

# Email configuration - Update with your email provider details
EMAIL_USERNAME = "smritighising07@gmail.com"  # Update with your email
EMAIL_PASSWORD = "nret ciec ggjc grrv"     # Use app password for Gmail
EMAIL_SERVER = "smtp.gmail.com"
EMAIL_PORT = 587

# Function to send verification code via email
def send_verification_email(recipient_email, code):
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_USERNAME
        msg['To'] = recipient_email
        msg['Subject'] = "FileShare - Your Verification Code"
        
        body = f"""
        <html>
        <body>
            <h2>FileShare Verification Code</h2>
            <p>Your verification code is: <strong>{code}</strong></p>
            <p>This code will expire in 5 minutes.</p>
            <p>If you did not request this code, please ignore this email.</p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(EMAIL_SERVER, EMAIL_PORT)
        server.starttls()
        server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

# Database Connection
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='smriti',  # Update with your actual MySQL password
            database='secure_file_sharing'
        )
        return conn
    except Error as e:  
        print(f"Error connecting to database: {e}")
        return None

# Root route - redirects to login
@app.route('/')
def home():
    return redirect(url_for('login_page'))

# Login page route
@app.route('/login', methods=['GET'])
def login_page():
    return render_template('index.html')

# User Registration Route (Hashes Password)
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'user')  # Default role: user
    department = data.get('department', '')  # Default empty department

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"error": "Email already registered"}), 400

        # Hash password before saving
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, department) 
            VALUES (%s, %s, %s, %s, %s)
        """, (name, email, hashed_password, role, department))
        
        conn.commit()
        
        # Get the new user's ID for activity logging
        new_user_id = cursor.lastrowid
        
        # Log the user registration (using admin ID if this was done by admin, or the new user's ID)
        admin_id = session.get('user_id') if session.get('role') == 'admin' else new_user_id
        log_activity(admin_id, 'user_create', f"New user registered: {name} ({email})")

        return jsonify({"message": "User registered successfully!"}), 201
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if conn:
            conn.close()

# Modified Login Route - Step 1: Validate credentials
# Modified Login Route - Step 1: Validate credentials
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    captcha_response = data.get('captchaResponse')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    # Verify captcha (you should implement actual verification with Google's API)
    if not captcha_response:
        return jsonify({"error": "CAPTCHA verification failed"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email=%s", (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        # Ensure the password hash is correct
        if bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            # Store user info in session temporarily
            session['temp_user_id'] = user['id']
            session['temp_user_role'] = user['role']
            
            # Generate a 6-digit verification code
            verification_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
            
            # Set expiration time (5 minutes from now)
            expiration_time = (datetime.now() + timedelta(minutes=5))
            
            # Store the code in the database
            try:
                cursor.execute(
                    "INSERT INTO verification_codes (user_id, code, expires_at) VALUES (%s, %s, %s)",
                    (user['id'], verification_code, expiration_time)
                )
                conn.commit()
                
                # Send verification code via email
                email_sent = send_verification_email(user['email'], verification_code)
                
                if not email_sent:
                    return jsonify({"error": "Failed to send verification email"}), 500
                
                # Log the login verification attempt
                log_activity(user['id'], 'login_verification', f"Login verification code sent to {user['email']}")
                
                return jsonify({
                    "message": "Verification code sent to your email",
                    "requiresVerification": True,
                    "userId": user['id']
                }), 200
            except Error as e:
                return jsonify({"error": f"Failed to generate verification code: {str(e)}"}), 500
        else:
            return jsonify({"error": "Invalid email or password"}), 401
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if conn:
            conn.close()

# New route for verifying the email code
@app.route('/verify-code', methods=['POST'])
def verify_code():
    data = request.get_json()
    user_id = data.get('userId')
    verification_code = data.get('code')
    
    if not user_id or not verification_code:
        return jsonify({"error": "User ID and verification code are required"}), 400
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Get the latest verification code for the user
        cursor.execute("""
            SELECT * FROM verification_codes 
            WHERE user_id = %s AND code = %s AND used = FALSE AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
        """, (user_id, verification_code))
        
        code_record = cursor.fetchone()
        
        if not code_record:
            return jsonify({"error": "Invalid or expired verification code"}), 401
        
        # Mark the code as used
        cursor.execute("UPDATE verification_codes SET used = TRUE WHERE id = %s", (code_record['id'],))
        
        # Get user details for session
        cursor.execute("SELECT id, role, name, email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Set user session
        session['user_id'] = user['id']
        session['role'] = user['role']
        session['name'] = user['name']
        session['email'] = user['email']
        
        # Log successful login with client IP
        client_ip = request.remote_addr
        log_activity(user['id'], 'login', f"User logged in from {client_ip}")
        
        # Update last_login timestamp
        cursor.execute("UPDATE users SET last_login = NOW() WHERE id = %s", (user['id'],))
        
        conn.commit()
        
        return jsonify({
            "message": "Verification successful!",
            "role": user['role'],
            "redirect": url_for('admin_dashboard' if user['role'] == 'admin' else 'user_dashboard')
        }), 200
        
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if conn:
            conn.close()

# Route to resend verification code
@app.route('/resend-code', methods=['POST'])
def resend_code():
    data = request.get_json()
    user_id = data.get('userId')
    
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Get user email
        cursor.execute("SELECT email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Generate a new verification code
        verification_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
        
        # Set expiration time (5 minutes from now)
        expiration_time = (datetime.datetime.now() + datetime.timedelta(minutes=5))
        
        # Store the code in the database
        cursor.execute(
            "INSERT INTO verification_codes (user_id, code, expires_at) VALUES (%s, %s, %s)",
            (user_id, verification_code, expiration_time)
        )
        conn.commit()
        
        # Send verification code via email
        email_sent = send_verification_email(user['email'], verification_code)
        
        if not email_sent:
            return jsonify({"error": "Failed to send verification email"}), 500
        
        # Log verification code resend
        log_activity(user_id, 'login_verification', f"Verification code resent to {user['email']}")
        
        return jsonify({
            "message": "New verification code sent to your email"
        }), 200
        
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if conn:
            conn.close()

# Admin dashboard route
@app.route('/admin_dashboard')
def admin_dashboard():
    if 'user_id' in session and session.get('role') == 'admin':
        return render_template('admin_dashboard.html')
    return redirect(url_for('login_page'))

# User dashboard route
@app.route('/user_dashboard')
def user_dashboard():
    if 'user_id' in session and session.get('role') == 'user':
        return render_template('user_dashboard.html')
    return redirect(url_for('login_page'))

# Logout Route - Updated with activity logging
@app.route('/logout')
def logout():
    if 'user_id' in session:
        user_id = session.get('user_id')
        user_role = session.get('role')
        
        # Log logout activity
        log_activity(user_id, 'logout', f"User logged out ({user_role})")
    
    session.clear()  # Clear all session data
    return redirect(url_for('login_page'))

# Function to send password reset email
def send_password_reset_email(recipient_email, reset_link):
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_USERNAME
        msg['To'] = recipient_email
        msg['Subject'] = "FileShare - Password Reset"
        
        body = f"""
        <html>
        <body>
            <h2>FileShare Password Reset</h2>
            <p>You requested a password reset for your FileShare account.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="{reset_link}">Reset Your Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this reset, please ignore this email or contact support.</p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(EMAIL_SERVER, EMAIL_PORT)
        server.starttls()
        server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending password reset email: {e}")
        return False

# Forgot Password page
@app.route('/forgot-password', methods=['GET'])
def forgot_password():
    return render_template('forget_password.html')  # Match your actual filename

# Process forgot password request
@app.route('/forgot-password', methods=['POST'])
def process_forgot_password():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        
        if not user:
            # Don't reveal that the email doesn't exist for security
            return jsonify({"message": "If your email is in our system, you will receive reset instructions."}), 200
        
        # Generate a unique token
        reset_token = str(uuid.uuid4())
        
        # Set expiration time (1 hour from now)
        expiration_time = datetime.now() + timedelta(hours=1)
        
        # Store the reset token in the database
        cursor.execute("""
            INSERT INTO password_reset_tokens (user_id, token, expires_at) 
            VALUES (%s, %s, %s)
        """, (user['id'], reset_token, expiration_time))
        
        conn.commit()
        
        # Create the reset link
        # In production, use request.host_url to get the base URL
        base_url = request.host_url
        if base_url.endswith('/'):
            base_url = base_url[:-1]  # Remove trailing slash
            
        reset_link = f"{base_url}/reset-password?token={reset_token}"
        
        # Send password reset email
        email_sent = send_password_reset_email(email, reset_link)
        
        if not email_sent:
            return jsonify({"error": "Failed to send password reset email"}), 500
        
        # Log the password reset request
        log_activity(user['id'], 'password_reset_request', f"Password reset requested for {email}")
        
        return jsonify({
            "message": "Password reset instructions sent to your email"
        }), 200
        
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if conn:
            conn.close()

# Reset Password Form (accessed via email link)
@app.route('/reset-password', methods=['GET'])
def reset_password_form():
    token = request.args.get('token')
    if not token:
        return redirect(url_for('login_page'))
    
    # Check if token is valid
    conn = get_db_connection()
    if conn is None:
        return redirect(url_for('login_page'))
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT * FROM password_reset_tokens 
            WHERE token = %s AND used = FALSE AND expires_at > NOW()
        """, (token,))
        
        token_record = cursor.fetchone()
        
        if not token_record:
            # Token is invalid or expired
            return redirect(url_for('login_page'))
        
        return render_template('forget_password.html', reset_token=token)  # Changed 'forgot' to 'forget'
        
    except Error as e:
        print(f"Error checking reset token: {e}")
        return redirect(url_for('login_page'))
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if conn:
            conn.close()
# Process Password Reset
@app.route('/reset-password', methods=['POST'])
def process_reset_password():
    data = request.get_json()
    token = data.get('token')
    password = data.get('password')
    
    if not token or not password:
        return jsonify({"error": "Token and password are required"}), 400
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Get the token record
        cursor.execute("""
            SELECT * FROM password_reset_tokens 
            WHERE token = %s AND used = FALSE AND expires_at > NOW()
        """, (token,))
        
        token_record = cursor.fetchone()
        
        if not token_record:
            return jsonify({"error": "Invalid or expired reset token"}), 401
        
        # Hash the new password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Update the user's password
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hashed_password, token_record['user_id'])
        )
        
        # Mark the token as used
        cursor.execute(
            "UPDATE password_reset_tokens SET used = TRUE WHERE id = %s",
            (token_record['id'],)
        )
        
        conn.commit()
        
        # Log the password reset
        log_activity(token_record['user_id'], 'password_reset', "Password reset completed")
        
        return jsonify({
            "message": "Password has been reset successfully"
        }), 200
        
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if conn:
            conn.close()
# 404 Error Handler
@app.errorhandler(404)
def page_not_found(e):
    return render_template('index.html'), 404

# Register Blueprints
app.register_blueprint(admin_bp)
app.register_blueprint(user_bp)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)