"""
Minimal default (system) category seed for Phase 1. This is intentionally a
small starter set, not the final list - Phase 4 revisits category defaults
per profile type once local research on Ethiopian shop owners comes back.
English-only for now; real Amharic content is a separate Phase 4 task.
"""

from sqlalchemy.orm import Session

from app.models.category import Category, CategoryKind, CategoryProfile

DEFAULT_CATEGORIES: list[dict] = [
    # shared
    {"name": "Salary", "icon": "cash", "type": CategoryKind.income, "profile_type": CategoryProfile.both},
    {"name": "Other Income", "icon": "wallet", "type": CategoryKind.income, "profile_type": CategoryProfile.both},
    {"name": "Food", "icon": "food", "type": CategoryKind.expense, "profile_type": CategoryProfile.both},
    {"name": "Transport", "icon": "car", "type": CategoryKind.expense, "profile_type": CategoryProfile.both},
    {"name": "Bills & Utilities", "icon": "receipt", "type": CategoryKind.expense, "profile_type": CategoryProfile.both},
    {"name": "Other", "icon": "dots", "type": CategoryKind.expense, "profile_type": CategoryProfile.both},
    # personal-specific
    {"name": "Savings", "icon": "piggy-bank", "type": CategoryKind.expense, "profile_type": CategoryProfile.personal},
    {"name": "Entertainment", "icon": "film", "type": CategoryKind.expense, "profile_type": CategoryProfile.personal},
    # business-specific
    {"name": "Sales", "icon": "storefront", "type": CategoryKind.income, "profile_type": CategoryProfile.business},
    {"name": "Inventory / Stock", "icon": "box", "type": CategoryKind.expense, "profile_type": CategoryProfile.business},
    {"name": "Rent", "icon": "building", "type": CategoryKind.expense, "profile_type": CategoryProfile.business},
]


def seed_default_categories(db: Session) -> None:
    existing_names = {c.name for c in db.query(Category).filter(Category.user_id.is_(None)).all()}
    created = False
    for entry in DEFAULT_CATEGORIES:
        if entry["name"] in existing_names:
            continue
        db.add(Category(user_id=None, **entry))
        created = True
    if created:
        db.commit()
