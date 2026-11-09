from dilution_pdf_service import DilutionReport, build_dilution_pdf
from commercial_pdf_service import CommercialReport, build_commercial_pdf
from nominal_solution_pdf_service import NominalSolutionReport, build_nominal_solution_pdf
from solution_label_pdf_service import SolutionLabelReport, build_solution_label_pdf
from solution_pdf_service import SolutionReport, build_solution_pdf
import logging
from fastapi import APIRouter, HTTPException, Request, Response
from physical_pdf_service import PhysicalReport, build_physical_pdf
from gc_pdf_service import GCReport, build_gc_pdf
from uncertainty_service import BudgetRequest, calculate_budget
from mc_study_service import MCStudyRequest, calculate_mc_study
from utils.deps import limiter

router = APIRouter(prefix="/uncertainty", tags=["Measurement uncertainty"])


@router.post('/mc-study')
@limiter.limit('10/minute')
def mc_study(request: Request, payload: MCStudyRequest):
    try:
        return calculate_mc_study(payload)
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError:
        logging.getLogger(__name__).exception('MC study engine unavailable')
        raise HTTPException(status_code=503, detail='MC study engine unavailable') from None


@router.post('/solution-label.pdf')
@limiter.limit('10/minute')
def solution_label_pdf(request: Request, payload: SolutionLabelReport):
    try:
        return Response(build_solution_label_pdf(payload), media_type='application/pdf', headers={
            'Content-Disposition': f'attachment; filename="artin-{payload.kind}-label-{payload.report.locale}.pdf"',
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RuntimeError, OSError):
        logging.getLogger(__name__).exception('Solution label PDF unavailable')
        raise HTTPException(status_code=503, detail='PDF export unavailable') from None


@router.post('/nominal-solution-report.pdf')
@limiter.limit('10/minute')
def nominal_solution_pdf(request: Request, payload: NominalSolutionReport):
    try:
        return Response(build_nominal_solution_pdf(payload), media_type='application/pdf', headers={
            'Content-Disposition': f'attachment; filename="artin-nominal-solution-{payload.locale}.pdf"',
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RuntimeError, OSError):
        logging.getLogger(__name__).exception('Nominal solution PDF unavailable')
        raise HTTPException(status_code=503, detail='PDF export unavailable') from None


@router.post('/commercial-report.pdf')
@limiter.limit('10/minute')
def commercial_pdf(request: Request, payload: CommercialReport):
    try:
        return Response(build_commercial_pdf(payload), media_type='application/pdf', headers={
            'Content-Disposition': f'attachment; filename="artin-commercial-{payload.locale}.pdf"',
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RuntimeError, OSError):
        logging.getLogger(__name__).exception('Commercial PDF unavailable')
        raise HTTPException(status_code=503, detail='PDF export unavailable') from None


@router.post('/gc-report.pdf')
@limiter.limit('10/minute')
def gc_pdf(request: Request, payload: GCReport):
    try:
        content = build_gc_pdf(payload)
        return Response(content, media_type='application/pdf', headers={
            'Content-Disposition': f'attachment; filename="artin-gc-{payload.locale}.pdf"',
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RuntimeError, OSError):
        logging.getLogger(__name__).exception('GC PDF unavailable')
        raise HTTPException(status_code=503, detail='PDF export unavailable') from None


@router.post('/physical-report.pdf')
@limiter.limit('10/minute')
def physical_pdf(request: Request, payload: PhysicalReport):
    try:
        content = build_physical_pdf(payload)
        return Response(content, media_type='application/pdf', headers={
            'Content-Disposition': f'attachment; filename="artin-{payload.kind}-{payload.locale}.pdf"',
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RuntimeError, OSError):
        logging.getLogger(__name__).exception('Physical PDF unavailable')
        raise HTTPException(status_code=503, detail='PDF export unavailable') from None


@router.post("/budget")
@limiter.limit("30/minute")
def budget(request: Request, payload: BudgetRequest):
    try:
        return calculate_budget(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError:
        logging.getLogger(__name__).exception("Uncertainty engine unavailable")
        raise HTTPException(status_code=503, detail="Uncertainty engine unavailable") from None


@router.post('/solution-report.pdf')
@limiter.limit('10/minute')
def solution_pdf(request: Request, payload: SolutionReport):
    try:
        content=build_solution_pdf(payload)
        return Response(content,media_type='application/pdf',headers={
            'Content-Disposition': f'attachment; filename="artin-solution-{payload.locale}.pdf"',
            'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
    except (ValueError,ArithmeticError) as error:
        raise HTTPException(status_code=422,detail=str(error)) from error
    except (RuntimeError,OSError):
        logging.getLogger(__name__).exception('Solution PDF unavailable')
        raise HTTPException(status_code=503,detail='PDF export unavailable') from None


@router.post('/dilution-report.pdf')
@limiter.limit('10/minute')
def dilution_pdf(request: Request, payload: DilutionReport):
    try:
        return Response(build_dilution_pdf(payload),media_type='application/pdf',headers={
            'Content-Disposition':f'attachment; filename="artin-dilution-{payload.locale}.pdf"',
            'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
    except (ValueError,ArithmeticError) as error:
        raise HTTPException(status_code=422,detail=str(error)) from error
    except (RuntimeError,OSError):
        logging.getLogger(__name__).exception('Dilution PDF unavailable')
        raise HTTPException(status_code=503,detail='PDF export unavailable') from None
