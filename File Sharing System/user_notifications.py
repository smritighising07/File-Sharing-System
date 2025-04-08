import logging
import notifications
from flask import session

# Setup logging
logger = logging.getLogger(__name__)

def hook_user_file_sharing(share_route_function):
    """
    Decorator for user file sharing routes to add notification hooks
    
    Args:
        share_route_function: The Flask route function to decorate
    
    Returns:
        Wrapped function that adds notification functionality
    """
    def wrapper(*args, **kwargs):
        # Call the original route function
        response = share_route_function(*args, **kwargs)
        
        # Check if response indicates success
        if hasattr(response, 'json') and (response.json.get('success') or response.status_code < 300):
            try:
                # Extract file and sharing information from the request
                from flask import request
                
                # For file upload with sharing
                if request.form:
                    file_id = response.json.get('file_id')
                    sender_id = session.get('user_id')
                    
                    if not file_id or not sender_id:
                        return response
                    
                    # Check if shared with department
                    share_with = request.form.get('shareWith', '')
                    departments = [dept.strip() for dept in share_with.split(',')] if share_with else []
                    
                    # Check if shared with users
                    share_with_users = request.form.getlist('shareWithUsers')
                    
                    # Only proceed if file is shared
                    if departments or share_with_users:
                        # Check if file is private
                        is_private = request.form.get('isPrivate', 'false') == 'true'
                        
                        if not is_private:
                            # Notify each department
                            for department in departments:
                                if department:
                                    notifications.notify_department_share(
                                        file_id=file_id,
                                        department=department,
                                        sender_id=sender_id,
                                        send_email=True  # Option to enable email
                                    )
                            
                            # Notify each user
                            for user_id in share_with_users:
                                notifications.notify_file_shared(
                                    file_id=file_id,
                                    receiver_id=user_id,
                                    sender_id=sender_id,
                                    send_email=True  # Option to enable email
                                )
                            
                            logger.info(f"Sent file sharing notifications for file {file_id}")
                
                # For direct share API
                elif request.json:
                    data = request.json
                    file_id = data.get('file_id')
                    departments = data.get('share_with_departments', [])
                    users = data.get('share_with_users', [])
                    
                    # Get sender info
                    sender_id = session.get('user_id')
                    
                    if not file_id or not sender_id:
                        return response
                    
                    # Notify each department
                    for department in departments:
                        notifications.notify_department_share(
                            file_id=file_id,
                            department=department,
                            sender_id=sender_id,
                            send_email=True  # Option to enable email
                        )
                    
                    # Notify each user
                    for user_id in users:
                        notifications.notify_file_shared(
                            file_id=file_id,
                            receiver_id=user_id,
                            sender_id=sender_id,
                            send_email=True  # Option to enable email
                        )
                    
                    logger.info(f"Sent file sharing notifications for file {file_id}")
            except Exception as e:
                logger.error(f"Error in user file sharing hook: {e}")
        
        return response
    
    # Set the wrapper function's name and docstring to match the original
    wrapper.__name__ = share_route_function.__name__
    wrapper.__doc__ = share_route_function.__doc__
    
    return wrapper

def hook_user_file_deletion(delete_route_function):
    """
    Decorator for user file deletion routes for potential future notification needs
    Currently users deleting their own files doesn't trigger notifications to others.
    
    Args:
        delete_route_function: The Flask route function to decorate
    
    Returns:
        Wrapped function that could add notification functionality
    """
    def wrapper(*args, **kwargs):
        # Call the original route function
        response = delete_route_function(*args, **kwargs)
        
        # For now, we don't notify anyone when a user deletes their own file
        # This is a placeholder for potential future notification needs
        
        return response
    
    # Set the wrapper function's name and docstring to match the original
    wrapper.__name__ = delete_route_function.__name__
    wrapper.__doc__ = delete_route_function.__doc__
    
    return wrapper

# Function to patch user functions with notification hooks
def add_notification_hooks():
    """
    Add notification hooks to relevant user functions
    """
    try:
        # Import user functions
        from user_routes import user_bp
        
        # Patch user upload file function (which can include sharing)
        if hasattr(user_bp, 'upload_file'):
            user_bp.upload_file = hook_user_file_sharing(user_bp.upload_file)
            logger.info("Added notification hook to user_bp.upload_file")
        
        # If you have a separate share_file function
        if hasattr(user_bp, 'share_file'):
            user_bp.share_file = hook_user_file_sharing(user_bp.share_file)
            logger.info("Added notification hook to user_bp.share_file")
        
        # Patch permanent delete file function
        if hasattr(user_bp, 'permanently_delete_file'):
            user_bp.permanently_delete_file = hook_user_file_deletion(user_bp.permanently_delete_file)
            logger.info("Added notification hook to user_bp.permanently_delete_file")
        
        logger.info("User notification hooks added successfully")
        return True
    except Exception as e:
        logger.error(f"Error adding user notification hooks: {e}")
        return False