import bcrypt
import mysql.connector

# Connect to your database
conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='smriti',  # Change to your actual password
    database='secure_file_sharing'
)
cursor = conn.cursor()

# Fetch all users
cursor.execute("SELECT id, password_hash FROM users")
users = cursor.fetchall()

for user in users:
    user_id, password_hash = user
    if not password_hash.startswith("$2b$"):  # Only hash plain text passwords
        hashed_password = bcrypt.hashpw(password_hash.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed_password, user_id))
        print(f"Updated password for user ID {user_id}")

conn.commit()
cursor.close()
conn.close()
