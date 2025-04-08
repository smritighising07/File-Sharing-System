from flask import Blueprint, jsonify, request, session
import logging
from datetime import datetime
from user_routes import get_db_connection

# Setup logging
logger = logging.getLogger(__name__)

# Create blueprint
notifications_bp = Blueprint('notifications_bp', __name__)

@notifications_bp.route('/api/notifications', methods=['GET'])
def get_notifications():
    """
    Retrieve a user's notifications with pagination
    """
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    
    # Get pagination parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    
    # Calculate offset for SQL query
    offset = (page - 1) * per_page
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get total count of notifications for this user
        cursor.execute("""
            SELECT COUNT(*) as total FROM notifications
            WHERE user_id = %s
        """, (user_id,))
        
        count_result = cursor.fetchone()
        total_notifications = count_result['total'] if count_result else 0
        
        # Calculate total pages
        total_pages = (total_notifications + per_page - 1) // per_page
        
        # Get notifications with pagination
        cursor.execute("""
            SELECT n.id, n.message, n.notification_type, n.related_file_id, 
                   n.is_read, n.created_at,
                   f.filename as file_name
            FROM notifications n
            LEFT JOIN files f ON n.related_file_id = f.id
            WHERE n.user_id = %s
            ORDER BY n.created_at DESC
            LIMIT %s OFFSET %s
        """, (user_id, per_page, offset))
        
        notifications = cursor.fetchall()
        
        # Process notifications for display
        for notification in notifications:
            # Convert datetime to string
            if notification['created_at']:
                # Calculate time ago
                now = datetime.now()
                diff = now - notification['created_at']
                
                if diff.days > 365:
                    years = diff.days // 365
                    notification['time_ago'] = f"{years} year{'s' if years > 1 else ''} ago"
                elif diff.days > 30:
                    months = diff.days // 30
                    notification['time_ago'] = f"{months} month{'s' if months > 1 else ''} ago"
                elif diff.days > 0:
                    notification['time_ago'] = f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
                elif diff.seconds > 3600:
                    hours = diff.seconds // 3600
                    notification['time_ago'] = f"{hours} hour{'s' if hours > 1 else ''} ago"
                elif diff.seconds > 60:
                    minutes = diff.seconds // 60
                    notification['time_ago'] = f"{minutes} minute{'s' if minutes > 1 else ''} ago"
                else:
                    notification['time_ago'] = "Just now"
                
                notification['created_at'] = notification['created_at'].isoformat()
            
            # Convert is_read to boolean for JSON
            notification['is_read'] = bool(notification['is_read'])
        
        return jsonify({
            "notifications": notifications,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total_notifications,
                "pages": total_pages
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        return jsonify({"error": f"Error getting notifications: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

@notifications_bp.route('/api/notifications/unread-count', methods=['GET'])
def get_unread_count():
    """
    Get count of unread notifications for the current user
    """
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT COUNT(*) as unread_count FROM notifications
            WHERE user_id = %s AND is_read = 0
        """, (user_id,))
        
        result = cursor.fetchone()
        unread_count = result['unread_count'] if result else 0
        
        return jsonify({"unread_count": unread_count}), 200
        
    except Exception as e:
        logger.error(f"Error getting unread notification count: {e}")
        return jsonify({"error": f"Error getting unread count: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

@notifications_bp.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    """
    Mark a specific notification as read
    """
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify the notification belongs to this user
        cursor.execute("""
            SELECT id FROM notifications
            WHERE id = %s AND user_id = %s
        """, (notification_id, user_id))
        
        notification = cursor.fetchone()
        
        if not notification:
            return jsonify({"error": "Notification not found or access denied"}), 404
        
        # Mark as read
        cursor.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE id = %s
        """, (notification_id,))
        
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": "Notification marked as read"
        }), 200
        
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        return jsonify({"error": f"Error marking notification as read: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

@notifications_bp.route('/api/notifications/mark-all-read', methods=['POST'])
def mark_all_read():
    """
    Mark all notifications as read for the current user
    """
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Mark all as read
        cursor.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE user_id = %s AND is_read = 0
        """, (user_id,))
        
        affected_rows = cursor.rowcount
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": f"Marked {affected_rows} notifications as read"
        }), 200
        
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        return jsonify({"error": f"Error marking all notifications as read: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

@notifications_bp.route('/api/notifications/delete/<int:notification_id>', methods=['DELETE'])
def delete_notification(notification_id):
    """
    Delete a specific notification
    """
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify the notification belongs to this user
        cursor.execute("""
            SELECT id FROM notifications
            WHERE id = %s AND user_id = %s
        """, (notification_id, user_id))
        
        notification = cursor.fetchone()
        
        if not notification:
            return jsonify({"error": "Notification not found or access denied"}), 404
        
        # Delete the notification
        cursor.execute("""
            DELETE FROM notifications
            WHERE id = %s
        """, (notification_id,))
        
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": "Notification deleted"
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        return jsonify({"error": f"Error deleting notification: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# Add routes for clearing all notifications if needed
@notifications_bp.route('/api/notifications/clear-all', methods=['DELETE'])
def clear_all_notifications():
    """
    Clear all notifications for the current user
    """
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 403

    user_id = session['user_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Delete all notifications for this user
        cursor.execute("""
            DELETE FROM notifications
            WHERE user_id = %s
        """, (user_id,))
        
        affected_rows = cursor.rowcount
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": f"Cleared {affected_rows} notifications"
        }), 200
        
    except Exception as e:
        logger.error(f"Error clearing all notifications: {e}")
        return jsonify({"error": f"Error clearing all notifications: {str(e)}"}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()