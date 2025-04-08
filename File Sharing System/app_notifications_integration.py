from flask import Flask
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    handlers=[
                        logging.FileHandler('app.log'),
                        logging.StreamHandler()
                    ])
logger = logging.getLogger(__name__)

def create_app():
    """
    Create and configure the Flask application
    
    This function integrates the notification system into the existing app
    """
    app = Flask(__name__)
    
    # App configuration code...
    app.secret_key = 'your_secret_key'  # This should be a secure value in production
    
    # Register existing blueprints
    from admin import admin_bp
    from user_routes import user_bp
    
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(user_bp)
    
    # Register notifications blueprint
    from notification_routes import notifications_bp
    app.register_blueprint(notifications_bp)
    
    # Add notification hooks to existing routes
    try:
        # Add admin notification hooks
        from admin_notifications import add_notification_hooks as add_admin_notification_hooks
        add_admin_notification_hooks()
        
        # Add user notification hooks
        from user_notifications import add_notification_hooks as add_user_notification_hooks
        add_user_notification_hooks()
        
        logger.info("Notification hooks added successfully")
    except Exception as e:
        logger.error(f"Error adding notification hooks: {e}")
    
    # Add notification check to scheduler for expired files
    try:
        from admin import check_expired_files
        from admin_notifications import hook_file_expiration
        
        # Patch the check_expired_files function with the notification hook
        if check_expired_files:
            check_expired_files = hook_file_expiration(check_expired_files)
            logger.info("File expiration notification hook added successfully")
    except Exception as e:
        logger.error(f"Error adding file expiration notification hook: {e}")
    
    # Add a route to serve notification JavaScript files
    @app.route('/static/js/notifications.js')
    def serve_notification_js():
        """
        Serve the appropriate notifications.js file based on user role
        """
        from flask import request, Response, session
        
        user_role = session.get('role', 'user')
        
        # Determine which notifications.js file to serve
        if user_role == 'admin':
            # Admin notification JavaScript
            with open('static/js/admin_notifications.js', 'r') as f:
                js_content = f.read()
        else:
            # User notification JavaScript
            with open('static/js/user_notifications.js', 'r') as f:
                js_content = f.read()
        
        # Serve JavaScript file with proper content type
        return Response(js_content, mimetype='application/javascript')
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)