from celery import Celery

def make_celery(app):
    celery = Celery(
        app.import_name,
        backend='redis://localhost:6379/0',  # Using Redis as the backend
        broker='redis://localhost:6379/0',   # Using Redis as the broker
    )
    celery.conf.update(app.config)
    return celery
