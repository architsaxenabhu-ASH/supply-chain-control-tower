from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Supply Chain Control Tower"
    app_version: str = "0.1.0"
    database_url: str = "sqlite:///data/control_tower.db"
    production_database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/control_tower"


settings = Settings()
