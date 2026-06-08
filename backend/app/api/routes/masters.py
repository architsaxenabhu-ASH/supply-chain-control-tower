from fastapi import APIRouter


router = APIRouter()


@router.get("/catalog")
def master_catalog() -> dict[str, list[str]]:
    return {
        "masters": [
            "business_units",
            "countries",
            "currencies",
            "entities",
            "warehouses",
            "products",
            "customers",
            "suppliers",
            "carriers",
            "roles",
            "users",
        ]
    }

