import logging
import notifications
from flask import session

# Setup logging
logger = logging.getLogger(__name__)

def hook_admin_file_deletion(delete_route_function):
    """
    Decorator for admin file deletion routes to add notification hooks
    
    Args:
        delete_route_function: The Flask route function to decorate
    
    Returns:
        Wrapped function that adds notification functionality
    """
    def wrapper(*args, **kwargs):
        # Call the original route function
        response = delete_route_function(*args, **kwargs)
        
        # Check if response indicates success
        if hasattr(response, 'json') and (response.json.get('success') or response.status_code < 300):
            try:
                # Extract file and user information from the request
                from flask import request
                
                # For direct file deletion API
                data = request.json if request.is_json else {}
                file_id = data.get('file_id')
                owner_id = data.get('owner_id')
                
                # If not in JSON body, try to get from URL params
                if not file_id and 'file_id' in kwargs:
                    file_id = kwargs['file_id']
                
                # If owner ID wasn't provided in request, get it from database
                if not owner_id and file_id:
                    from user_routes import get_db_connection
                    conn = get_db_connection()
                    cursor = conn.cursor(dictionary=True)
                    
                    cursor.execute("SELECT user_id, filename FROM files WHERE id = %s", (file_id,))
                    file_info = cursor.fetchone()
                    
                    if file_info:
                        owner_id = file_info['user_id']
                        filename = file_info['filename']
                        
                        # Get admin name
                        admin_id = session.get('user_id')
                        admin_name = "An administrator"
                        
                        if admin_id:
                            cursor.execute("SELECT name FROM users WHERE id = %s", (admin_id,))
                            admin_info = cursor.fetchone()
                            if admin_info:
                                admin_name = admin_info['name']
                        
                        # Create notification message for the file owner
                        message = f"{admin_name} deleted your file: {filename}"
                        
                        # Send notification to file owner
                        if owner_id:
                            notifications.notify_admin_file_action(
                                file_id=file_id,
                                action_type='file_deleted_by_admin',
                                message=message,
                                owner_id=owner_id
                            )
                            
                            logger.info(f"Admin deletion notification sent to user {owner_id} for file {file_id}")
                    
                    cursor.close()
                    conn.close()
                
            except Exception as e:
                logger.error(f"Error in admin file deletion hook: {e}")
        
        return response
    
    # Set the wrapper function's name and docstring to match the original
    wrapper.__name__ = delete_route_function.__name__
    wrapper.__doc__ = delete_route_function.__doc__
    
    return wrapper

def hook_file_expiration(check_expired_files_function):
    """
    Decorator to add notification hooks to file expiration check
    
    Args:
        check_expired_files_function: The file expiration check function to decorate
    
    Returns:
        Wrapped function that adds notification functionality
    """
    def wrapper(*args, **kwargs):
        try:
            # Get database connection before original function runs
            from user_routes import get_db_connection
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Find files that are about to expire
            cursor.execute("""
                SELECT id, filename, user_id
                FROM files 
                WHERE expiration_datetime IS NOT NULL 
                AND expiration_datetime <= NOW() + INTERVAL 1 DAY
                AND expiration_datetime > NOW()
                AND is_deleted = 0
            """)
            
            soon_to_expire = cursor.fetchall()
            
            # Send notifications for files about to expire
            for file in soon_to_expire:
                # Check if notification already sent (avoid duplicates)
                cursor.execute("""
                    SELECT id FROM notifications
                    WHERE user_id = %s 
                    AND related_file_id = %s
                    AND notification_type = 'file_expiring_soon'
                    AND created_at > NOW() - INTERVAL 1 DAY
                """, (file['user_id'], file['id']))
                
                if not cursor.fetchone():
                    # Create notification
                    message = f"Your file will expire within 24 hours: {file['filename']}"
                    notifications.create_notification(
                        user_id=file['user_id'],
                        notification_type='file_expiring_soon',
                        message=message,
                        related_file_id=file['id']
                    )
                    
                    logger.info(f"File expiration warning notification sent for file {file['id']}")
            
            cursor.close()
            conn.close()
        except Exception as e:
            logger.error(f"Error in expiration notification check: {e}")
        
        # Call the original function
        result = check_expired_files_function(*args, **kwargs)
        
        try:
            # After original function runs, fetch files that were just marked as expired
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Find recently expired files that were just marked as deleted
            cursor.execute("""
                SELECT id, filename, user_id
                FROM files 
                WHERE expiration_datetime IS NOT NULL 
                AND expiration_datetime <= NOW()
                AND is_deleted = 1
                AND deleted_at > NOW() - INTERVAL 5 MINUTE
            """)
            
            just_expired = cursor.fetchall()
            
            # Send notifications for files that just expired
            for file in just_expired:
                message = f"Your file has expired and been moved to trash: {file['filename']}"
                notifications.notify_file_expiration(
                    file_id=file['id'],
                    user_id=file['user_id']
                )
                
                logger.info(f"File expiration notification sent for file {file['id']}")
            
            cursor.close()
            conn.close()
        except Exception as e:
            logger.error(f"Error in post-expiration notification: {e}")
        
        return result
    
    # Set the wrapper function's name and docstring to match the original
    wrapper.__name__ = check_expired_files_function.__name__
    wrapper.__doc__ = check_expired_files_function.__doc__
    
    return wrapper

# Function to patch admin functions with notification hooks
def add_notification_hooks():
    """
    Add notification hooks to relevant admin functions
    """
    try:
        # Import admin functions
        from admin import admin_bp
        
        # Patch admin delete file function
        if hasattr(admin_bp, 'delete_file'):
            admin_bp.delete_file = hook_admin_file_deletion(admin_bp.delete_file)
            logger.info("Added notification hook to admin_bp.delete_file")
            
        # Patch admin bulk delete function if it exists
        if hasattr(admin_bp, 'bulk_delete_files'):
            admin_bp.bulk_delete_files = hook_admin_file_deletion(admin_bp.bulk_delete_files)
            logger.info("Added notification hook to admin_bp.bulk_delete_files")
        
        logger.info("Admin notification hooks added successfully")
        return True
    except Exception as e:
        logger.error(f"Error adding admin notification hooks: {e}")
        return False