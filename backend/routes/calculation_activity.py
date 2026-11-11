from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, Request, Response, Query, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from utils.deps import require_admin, limiter
from auth_service import get_current_customer
import calculation_activity as service

router = APIRouter(tags=['Calculation usage'])


class ClientEvent(BaseModel):
    model_config = ConfigDict(extra='forbid')
    event_id: str = Field(pattern=r'^[a-f0-9-]{32,36}$')
    tool: str = Field(pattern=r'^(?:quick-[0-9]{1,2}|precision|intermediate|calibration|bias|control|decision|top-down|solution|commercial-solution|dilution-plan|stock-preparation)$')
    title: str = Field(default='', max_length=120)
    status: Literal['success', 'error']


@router.get('/calculation-activity/access', dependencies=[Depends(get_current_customer)])
@limiter.limit('60/minute')
async def access(request: Request, response: Response):
    await service.actor(request, response)
    response.headers['Cache-Control'] = 'no-store'
    return {'ready': True}


@router.post('/calculation-activity', dependencies=[Depends(get_current_customer)])
@limiter.limit('60/minute')
async def client_event(request: Request, response: Response, body: ClientEvent):
    who = await service.actor(request, response)
    service.record(who, body.tool, body.status, 'client', 'calculator', event_id=body.event_id, title=body.title)
    response.headers['Cache-Control'] = 'no-store'
    return {'recorded': True}


@router.get('/admin/calculation-activity/stats')
def activity_stats(response: Response, _=Depends(require_admin)):
    response.headers['Cache-Control'] = 'no-store'
    return service.stats()


@router.get('/admin/calculation-activity')
def activity_list(response: Response, q: str = Query(default='',max_length=120), status: Literal['','success','error']='', execution: Literal['','server','client']='',
                  actor_kind: Literal['','customer','identified_guest','anonymous']='', since: datetime|None=None, until: datetime|None=None,
                  limit: int=Query(default=25,ge=1,le=100), offset: int=Query(default=0,ge=0,le=1000000), _=Depends(require_admin)):
    response.headers['Cache-Control'] = 'no-store'
    if any(value and value.tzinfo is None for value in (since,until)):
        raise HTTPException(422, 'Date filters must include a UTC offset')
    if since and until and since >= until:
        raise HTTPException(422, 'The end of the date range must follow its start')
    def stamp(value):
        return value.astimezone(timezone.utc).isoformat(timespec='milliseconds') if value else ''
    return service.list_activity(limit, offset, q=q, status=status, execution=execution, actor_kind=actor_kind, since=stamp(since), until=stamp(until))
