"""
MedStock AI Service - FastAPI Application.
Complies with Section 9 of MedStock AI Project Specification:
- Pydantic v2 schemas for all inputs/outputs.
- Exception handlers returning clean JSON errors with no stack traces.
- Lifespan model loading once at startup.
- Automatic training on synthetic dataset if no active model exists.
- Endpoints: GET /health, GET /model-info, POST /forecast, POST /evaluate, POST /train.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .api.routes import router
from .services.model_registry import model_registry
from .services.trainer import train_global_model

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("medstock.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler:
    Loads model once at startup into memory.
    If no model exists on disk, trains initial model from synthetic data.
    """
    logger.info("Initializing MedStock AI Service...")
    os.makedirs(settings.MODEL_DIR, exist_ok=True)

    loaded = model_registry.load_active_model()
    if not loaded:
        logger.info("No active model found. Training initial global Random Forest on synthetic data...")
        try:
            train_global_model(version_note="init")
            logger.info("Initial model trained and loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to train initial model: {e}. Moving-average baseline will serve requests.")

    yield
    logger.info("Shutting down MedStock AI Service...")


app = FastAPI(
    title="MedStock AI Demand Forecasting Service",
    description="Microservice providing demand forecasting and evaluation for hospital inventory.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)


# --- Custom Exception Handlers (Clean JSON, No Stack Traces) ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handles Pydantic validation errors (e.g. invalid horizonDays or missing fields)
    returning clean, informative JSON with HTTP 422.
    """
    details = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error.get("loc", []))
        msg = error.get("msg", "Invalid value")
        details.append({"field": field, "message": msg})

    logger.warning(f"Request validation error on {request.url.path}: {details}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters or payload shape.",
                "details": details
            }
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Handles explicit HTTPExceptions (e.g. 422 INSUFFICIENT_HISTORY, 400 DATA_ERROR).
    """
    if isinstance(exc.detail, dict):
        err_body = exc.detail
    else:
        err_body = {"code": "HTTP_ERROR", "message": str(exc.detail)}

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": err_body
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Global catch-all exception handler ensuring internal errors
    never leak stack traces or sensitive environment variables.
    """
    logger.error(f"Unhandled server error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred while processing the request."
            }
        }
    )
