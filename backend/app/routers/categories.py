from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.category import Category, CategoryProfile
from app.models.user import User
from app.schemas import CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile_filters = [Category.profile_type == CategoryProfile.both]
    if current_user.profile_type is not None:
        profile_filters.append(Category.profile_type == CategoryProfile(current_user.profile_type.value))

    return (
        db.query(Category)
        .filter(
            or_(Category.user_id.is_(None), Category.user_id == current_user.id),
            or_(*profile_filters),
        )
        .order_by(Category.type, Category.name)
        .all()
    )
