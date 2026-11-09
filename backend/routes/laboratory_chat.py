import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from guest_access import authorize_chat
from schemas.models import ChatRequest
from laboratory_chat import ask_laboratory
from utils.deps import limiter

router = APIRouter(tags=['Laboratory chat'])


@router.post('/chat/laboratory')
@limiter.limit('10/minute')
def laboratory_chat(request: Request, response: Response, body: ChatRequest = Depends(authorize_chat)):
    response.headers['Cache-Control'] = 'no-store'
    try:
        return ask_laboratory(body.message, body.history or [], body.laboratory, None, body.customer_id, body.chemical_cid)
    except ValueError:
        raise HTTPException(422, detail='Invalid laboratory data or conversation size') from None
    except Exception:
        logging.getLogger(__name__).exception('Laboratory conversation failed')
        raise HTTPException(503, detail='Laboratory assistant unavailable. Project data were not changed.') from None
