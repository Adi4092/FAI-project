import os
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    MODEL_DIR: str = Field(default="./trained_models", description="Directory to persist trained models")
    DATA_DIR: str = Field(default="../data/synthetic", description="Directory for synthetic or exported data")
    LOG_LEVEL: str = Field(default="info", description="Logging level")
    HOST: str = Field(default="0.0.0.0", description="API Host")
    PORT: int = Field(default=8000, description="API Port")
    DEFAULT_HORIZON: int = Field(default=15, description="Default forecast horizon days")
    ACTIVE_MODEL_FILENAME: str = Field(default="active_model.joblib", description="Filename of active model artifact")
    METADATA_FILENAME: str = Field(default="active_model_meta.json", description="Filename of model metadata")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }


settings = Settings()
