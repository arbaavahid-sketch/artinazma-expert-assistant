from calculation_activity import CalculationActivityRoute
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from auth_service import get_current_customer
from utils.deps import limiter
import lab_import_service as service

router = APIRouter(route_class=CalculationActivityRoute, prefix='/laboratory/imports', tags=['Reviewed file calculations'])


def fail(error):
    if isinstance(error, LookupError):
        raise HTTPException(404, detail='Import not found') from None
    if isinstance(error, ValueError):
        raise HTTPException(422, detail=str(error)[:2000]) from None
    logging.getLogger(__name__).exception('Laboratory import failed')
    raise HTTPException(422, detail='The file could not be read. Check its format or provide a smaller table.') from None


@router.get('/catalog')
def catalog(customer=Depends(get_current_customer)):
    return {'models': service.CATALOG['models']}


@router.post('')
@limiter.limit('6/minute')
def upload(request: Request, response: Response, file: UploadFile = File(...), header: bool = Form(True), customer=Depends(get_current_customer)):
    response.headers['Cache-Control'] = 'no-store'
    content = file.file.read(service.MAX_BYTES+1)
    try:
        return service.create_import(customer['customer_id'], file.filename or 'upload', content, header)
    except Exception as error:
        fail(error)


class FromAnalysis(BaseModel):
    question_id: int = Field(gt=0)
    header: bool = True


@router.post('/from-analysis')
@limiter.limit('6/minute')
def from_analysis(request: Request, response: Response, payload: FromAnalysis, customer=Depends(get_current_customer)):
    from repositories.questions_repo import get_question_by_id
    response.headers['Cache-Control'] = 'no-store'
    question = get_question_by_id(payload.question_id)
    meta = question.get('metadata', {}) if question else {}
    if meta.get('customer_id') != customer['customer_id'] or meta.get('analysis_type') not in ('file', 'image'):
        raise HTTPException(404, detail='Analysis not found')
    url = meta.get('file_url') or meta.get('image_url') or ''
    # Only an owned persisted analysis can select a local upload. No URL fetching.
    if not isinstance(url, str) or not url.startswith('/uploads/') or Path(url).name != url.removeprefix('/uploads/'):
        raise HTTPException(404, detail='Source file not found')
    root = Path('uploads').resolve()
    path = (root/Path(url).name).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(404, detail='Source file not found')
    try:
        with path.open('rb') as stream:
            content = stream.read(service.MAX_BYTES+1)
        return service.create_import(customer['customer_id'], meta.get('file_name') or path.name, content, payload.header)
    except Exception as error:
        fail(error)


@router.get('/{key}')
def get_import(key: str, response: Response, customer=Depends(get_current_customer)):
    response.headers['Cache-Control'] = 'no-store'
    try:
        return service.public_import(service.load_import(key, customer['customer_id']))
    except Exception as error:
        fail(error)


@router.get('/{key}/source')
def source(key: str, customer=Depends(get_current_customer)):
    try:
        body = service.load_import(key, customer['customer_id'])
        root = service.ROOT.resolve()
        path = (root/body['storage_name']).resolve()
        if path.parent != root or not path.is_file():
            raise LookupError('Source file not found')
        return FileResponse(path, filename=body['fileName'], media_type='application/octet-stream', headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
    except Exception as error:
        fail(error)


@router.post('/{key}/confirm')
@limiter.limit('10/minute')
def confirm(request: Request, response: Response, key: str, payload: service.ReviewedImport, customer=Depends(get_current_customer)):
    response.headers['Cache-Control'] = 'no-store'
    try:
        return service.confirm_import(key, customer['customer_id'], payload)
    except Exception as error:
        fail(error)


@router.post('/{key}/recalculate')
@limiter.limit('10/minute')
def recalculate(request: Request, response: Response, key: str, customer=Depends(get_current_customer)):
    response.headers['Cache-Control'] = 'no-store'
    try:
        return service.recalculate_import(key, customer['customer_id'])
    except Exception as error:
        fail(error)
