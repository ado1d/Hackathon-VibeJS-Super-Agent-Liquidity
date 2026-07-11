from fastapi import APIRouter, Depends

from app.api.deps import current_user
from app.models import User
from app.permissions import permissions_for
from app.schemas import UserView

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserView)
async def me(user: User = Depends(current_user)) -> UserView:
    return UserView.model_validate(user).model_copy(
        update={"permissions": permissions_for(user.role)}
    )
