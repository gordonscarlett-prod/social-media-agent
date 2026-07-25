from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from datetime import datetime
import logging

from database import SessionLocal
from models import Post, PostStatus
from publisher import publish_post

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="America/Denver")


def _execute_scheduled_post(post_id: int):
    """Called by APScheduler at the scheduled time."""
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            logger.error(f"Scheduled post {post_id} not found")
            return
        if post.status != PostStatus.SCHEDULED:
            logger.info(f"Post {post_id} is no longer scheduled (status={post.status}), skipping")
            return

        success, platform_post_id, error = publish_post(post)

        if success:
            post.status = PostStatus.PUBLISHED
            post.published_at = datetime.utcnow()
            post.platform_post_id = platform_post_id
            logger.info(f"Post {post_id} published to {post.platform}")
        else:
            post.status = PostStatus.FAILED
            post.error_message = error
            logger.error(f"Post {post_id} failed: {error}")

        db.commit()
    except Exception as e:
        logger.exception(f"Error publishing post {post_id}: {e}")
        db.rollback()
    finally:
        db.close()


def schedule_post(post_id: int, publish_at: datetime):
    """Add a post to the scheduler queue."""
    job_id = f"post_{post_id}"

    # Remove existing job if rescheduling
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    scheduler.add_job(
        _execute_scheduled_post,
        trigger=DateTrigger(run_date=publish_at, timezone="America/Denver"),
        args=[post_id],
        id=job_id,
        name=f"Publish post {post_id}",
        misfire_grace_time=300,
    )
    logger.info(f"Scheduled post {post_id} for {publish_at}")


def cancel_scheduled_post(post_id: int):
    """Remove a post from the scheduler."""
    job_id = f"post_{post_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Cancelled scheduled post {post_id}")


def restore_scheduled_posts():
    """On startup, re-queue future posts and immediately publish any past-due ones."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        all_pending = db.query(Post).filter(Post.status == PostStatus.SCHEDULED).all()

        future = [p for p in all_pending if p.scheduled_at and p.scheduled_at > now]
        overdue = [p for p in all_pending if not p.scheduled_at or p.scheduled_at <= now]

        for post in future:
            schedule_post(post.id, post.scheduled_at)

        for post in overdue:
            logger.info(f"Publishing overdue post {post.id} (was scheduled {post.scheduled_at})")
            _execute_scheduled_post(post.id)

        logger.info(f"Restored {len(future)} future posts, published {len(overdue)} overdue posts")
    finally:
        db.close()


def start_scheduler():
    scheduler.start()
    restore_scheduled_posts()
    logger.info("Scheduler started (America/Denver timezone)")


def stop_scheduler():
    scheduler.shutdown()
