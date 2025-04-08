import logging
from datetime import datetime

# Setup logging
logger = logging.getLogger(__name__)

# Import database connection function
from user_routes import get_db_connection

def create_notification(user_id, notification_type, message, related_file_id=None):
    """
    Create a notification in the database
    
    Parameters:
    - user_id: User ID of the recipient
    - notification_type: Type of notification (e.g., 'file_shared', 'file_deleted_by_admin')
    - message: Notification message
    - related_file_id: Related file ID (optional)
    
    Returns:
    - notification_id or None if an error occurs
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Insert notification
        cursor.execute("""
            INSERT INTO notifications (
                user_id, notification_type, message, 
                related_file_id, created_at, is_read
            ) VALUES (%s, %s, %s, %s, NOW(), 0)
        """, (user_id, notification_type, message, related_file_id))
        
        notification_id = cursor.lastrowid
        conn.commit()
        
        logger.info(f"Created notification ID {notification_id} for user {user_id}")
        return notification_id
    
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        return None
    
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

def notify_file_shared(file_id, receiver_id, sender_id=None, send_email=False):
    """
    Notify a user when a file is shared with them directly
    
    Parameters:
    - file_id: ID of the shared file
    - receiver_id: User ID of the receiver
    - sender_id: User ID of the sender (optional)
    - send_email: Whether to send an email notification (optional)
    
    Returns:
    - notification_id or None if an error occurs
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get file and sender information
        query = """
            SELECT f.filename, f.filepath, 
                   COALESCE(u.name, 'Another user') as sender_name 
            FROM files f
            LEFT JOIN users u ON u.id = %s
            WHERE f.id = %s
        """
        cursor.execute(query, (sender_id, file_id))
        file_info = cursor.fetchone()
        
        if not file_info:
            logger.error(f"File not found for notification: {file_id}")
            return None
        
        # Create notification message
        message = f"{file_info['sender_name']} shared a file with you: {file_info['filename']}"
        
        # Create notification
        notification_id = create_notification(
            user_id=receiver_id,
            notification_type='file_shared',
            message=message,
            related_file_id=file_id
        )
        
        # TODO: Implement email notification if needed
        if send_email:
            # send_email_notification(receiver_id, message, file_info)
            pass
        
        return notification_id
        
    except Exception as e:
        logger.error(f"Error in notify_file_shared: {e}")
        return None
    
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

def notify_department_share(file_id, department, sender_id=None, send_email=False):
    """
    Notify all users in a department when a file is shared with their department
    
    Parameters:
    - file_id: ID of the shared file
    - department: Department to notify
    - sender_id: User ID of the sender (optional)
    - send_email: Whether to send email notifications (optional)
    
    Returns:
    - List of created notification IDs
    """
    notification_ids = []
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get file and sender information
        query = """
            SELECT f.filename, f.filepath, 
                   COALESCE(u.name, 'Another user') as sender_name 
            FROM files f
            LEFT JOIN users u ON u.id = %s
            WHERE f.id = %s
        """
        cursor.execute(query, (sender_id, file_id))
        file_info = cursor.fetchone()
        
        if not file_info:
            logger.error(f"File not found for notification: {file_id}")
            return notification_ids
        
        # Get all users in the department
        cursor.execute("""
            SELECT id, email FROM users
            WHERE department = %s AND id != %s
        """, (department, sender_id))
        
        department_users = cursor.fetchall()
        
        # Notify each user in the department
        for user in department_users:
            # Create notification message
            message = f"{file_info['sender_name']} shared a file with the {department} department: {file_info['filename']}"
            
            # Create notification
            notification_id = create_notification(
                user_id=user['id'],
                notification_type='file_shared',
                message=message,
                related_file_id=file_id
            )
            
            if notification_id:
                notification_ids.append(notification_id)
            
            # TODO: Implement email notification if needed
            if send_email and user['email']:
                # send_email_notification(user['id'], message, file_info)
                pass
        
        logger.info(f"Created {len(notification_ids)} department notifications for file {file_id}")
        return notification_ids
        
    except Exception as e:
        logger.error(f"Error in notify_department_share: {e}")
        return notification_ids
    
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

def notify_file_expiration(file_id, user_id):
    """
    Notify a user when their file has expired
    
    Parameters:
    - file_id: ID of the expired file
    - user_id: User ID of the file owner
    
    Returns:
    - notification_id or None if an error occurs
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get file information
        cursor.execute("SELECT filename FROM files WHERE id = %s", (file_id,))
        file_info = cursor.fetchone()
        
        if not file_info:
            logger.error(f"File not found for expiration notification: {file_id}")
            return None
        
        # Create notification message
        message = f"Your file has expired and been moved to trash: {file_info['filename']}"
        
        # Create notification
        notification_id = create_notification(
            user_id=user_id,
            notification_type='file_expired',
            message=message,
            related_file_id=file_id
        )
        
        return notification_id
        
    except Exception as e:
        logger.error(f"Error in notify_file_expiration: {e}")
        return None
    
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

def notify_admin_file_action(file_id, action_type, message, owner_id):
    """
    Notify a user when an admin performs an action on their file
    
    Parameters:
    - file_id: ID of the file
    - action_type: Type of action ('file_deleted_by_admin', etc.)
    - message: Notification message
    - owner_id: User ID of the file owner
    
    Returns:
    - notification_id or None if an error occurs
    """
    return create_notification(
        user_id=owner_id,
        notification_type=action_type,
        message=message,
        related_file_id=file_id
    )