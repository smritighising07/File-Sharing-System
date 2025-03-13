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
from admin import admin_bp  # Import admin routes
from user_routes import user_bp  # Import user routes

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

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()

        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"error": "Email already registered"}), 400

        # Hash password before saving
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        cursor.execute("INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)",
                       (name, email, hashed_password, role))
        conn.commit()

        return jsonify({"message": "User registered successfully!"}), 201
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

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
            expiration_time = (datetime.datetime.now() + datetime.timedelta(minutes=5))
            
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
        cursor.close()
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
        cursor.execute("SELECT id, role FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Set user session
        session['user_id'] = user['id']
        session['role'] = user['role']
        
        conn.commit()
        
        return jsonify({
            "message": "Verification successful!",
            "role": user['role'],
            "redirect": url_for('admin_dashboard' if user['role'] == 'admin' else 'user_dashboard')
        }), 200
        
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
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
        
        return jsonify({
            "message": "New verification code sent to your email"
        }), 200
        
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
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

# Logout Route
@app.route('/logout')
def logout():
    session.clear()  # Clear all session data
    return redirect(url_for('login_page'))

# 404 Error Handler
@app.errorhandler(404)
def page_not_found(e):
    return render_template('index.html'), 404

# Register Blueprints
app.register_blueprint(admin_bp)
app.register_blueprint(user_bp)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)