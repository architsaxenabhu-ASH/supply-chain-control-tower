from fastapi import APIRouter

from app.api.routes import (
    audit,
    allocations,
    assistant,
    business_intelligence,
    commercial,
    commitments,
    consignment,
    customers,
    dashboard,
    decisions,
    demand,
    dispatches,
    documents,
    erp_uploads,
    exceptions,
    executive,
    expiry,
    fulfillment,
    goods_receipts,
    inventory,
    inventory_counts,
    imports,
    intelligence,
    learning,
    master_data,
    movements,
    operational_intelligence,
    payables,
    reallocations,
    receivables,
    release,
    reservations,
    returns,
    masters,
    products,
    security,
    shipments,
    validation,
    warehouses,
)


api_router = APIRouter()
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(masters.router, prefix="/masters", tags=["masters"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(warehouses.router, prefix="/warehouses", tags=["warehouses"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(erp_uploads.router, prefix="/erp-uploads", tags=["erp-uploads"])
api_router.include_router(validation.router, prefix="/validation", tags=["validation"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
api_router.include_router(dispatches.router, prefix="/dispatches", tags=["dispatches"])
api_router.include_router(goods_receipts.router, prefix="/goods-receipts", tags=["goods-receipts"])
api_router.include_router(inventory_counts.router, prefix="/inventory-counts", tags=["inventory-counts"])
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(learning.router, prefix="/learning", tags=["learning"])
api_router.include_router(master_data.router, prefix="/master-data", tags=["master-data"])
api_router.include_router(movements.router, prefix="/movements", tags=["movements"])
api_router.include_router(security.router, prefix="/security", tags=["security"])
api_router.include_router(expiry.router, prefix="/expiry", tags=["expiry"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(intelligence.inventory_health_router, prefix="/inventory-health", tags=["intelligence"])
api_router.include_router(intelligence.expiry_router, prefix="/expiry-engine", tags=["intelligence"])
api_router.include_router(intelligence.events_router, prefix="/events", tags=["intelligence"])
api_router.include_router(decisions.router, prefix="/decisions", tags=["decisions"])
api_router.include_router(business_intelligence.supplier_router, prefix="/supplier-intelligence", tags=["business-intelligence"])
api_router.include_router(business_intelligence.carrier_router, prefix="/carrier-intelligence", tags=["business-intelligence"])
api_router.include_router(business_intelligence.customer_router, prefix="/customer-intelligence", tags=["business-intelligence"])
api_router.include_router(business_intelligence.document_router, prefix="/document-intelligence", tags=["business-intelligence"])
api_router.include_router(business_intelligence.relationships_router, prefix="/relationships", tags=["relationships"])
api_router.include_router(operational_intelligence.readiness_router, prefix="/document-readiness", tags=["operational-intelligence"])
api_router.include_router(operational_intelligence.control_tower_router, prefix="/document-control-tower", tags=["operational-intelligence"])
api_router.include_router(operational_intelligence.shipment_router, prefix="/shipment-intelligence", tags=["operational-intelligence"])
api_router.include_router(operational_intelligence.expiry_prevention_router, prefix="/expiry-prevention", tags=["operational-intelligence"])
api_router.include_router(release.router, prefix="/releases", tags=["release"])
api_router.include_router(exceptions.router, prefix="/exceptions", tags=["exceptions"])
api_router.include_router(reservations.reservations_router, prefix="/reservations", tags=["reservations"])
api_router.include_router(reservations.consumption_router, prefix="/reservation-consumption", tags=["reservations"])
api_router.include_router(reservations.risk_router, prefix="/reservation-risk", tags=["reservations"])
api_router.include_router(reservations.customer_consumption_router, prefix="/customer-consumption", tags=["reservations"])
api_router.include_router(reservations.commitment_router, prefix="/commitment-dashboard", tags=["reservations"])
api_router.include_router(reallocations.router, prefix="/reallocations", tags=["reallocations"])
api_router.include_router(allocations.allocations_router, prefix="/allocations", tags=["allocations"])
api_router.include_router(allocations.commitment_router, prefix="/inventory-commitment", tags=["allocations"])
api_router.include_router(allocations.distributor_router, prefix="/distributor-intelligence", tags=["allocations"])
api_router.include_router(allocations.country_router, prefix="/country-intelligence", tags=["allocations"])
api_router.include_router(allocations.recommendations_router, prefix="/allocation-recommendations", tags=["allocations"])
api_router.include_router(allocations.allocation_dashboard_router, prefix="/allocation-dashboard", tags=["allocations"])
api_router.include_router(demand.demand_router, prefix="/demand", tags=["demand"])
api_router.include_router(demand.demand_intelligence_router, prefix="/demand-intelligence", tags=["demand"])
api_router.include_router(demand.demand_gap_router, prefix="/demand-gap", tags=["demand"])
api_router.include_router(demand.customer_v2_router, prefix="/customer-intelligence-v2", tags=["commercial-intelligence"])
api_router.include_router(demand.distributor_performance_router, prefix="/distributor-performance", tags=["commercial-intelligence"])
api_router.include_router(demand.distributor_health_router, prefix="/distributor-health", tags=["commercial-intelligence"])
api_router.include_router(demand.country_performance_router, prefix="/country-performance", tags=["commercial-intelligence"])
api_router.include_router(demand.product_intelligence_router, prefix="/product-intelligence", tags=["commercial-intelligence"])
api_router.include_router(demand.inventory_efficiency_router, prefix="/inventory-efficiency", tags=["commercial-intelligence"])
api_router.include_router(demand.executive_router, prefix="/executive-command-center", tags=["commercial-intelligence"])
api_router.include_router(receivables.receivables_router, prefix="/receivables", tags=["financial"])
api_router.include_router(receivables.financial_router, prefix="/financial-intelligence", tags=["financial"])
api_router.include_router(receivables.payment_risk_router, prefix="/payment-risk", tags=["financial"])
api_router.include_router(receivables.credit_router, prefix="/credit-control", tags=["financial"])
api_router.include_router(fulfillment.commercial_readiness_router, prefix="/commercial-readiness", tags=["fulfillment"])
api_router.include_router(fulfillment.order_fulfillment_router, prefix="/order-fulfillment", tags=["fulfillment"])
api_router.include_router(fulfillment.allocation_priority_router, prefix="/allocation-priority", tags=["fulfillment"])
api_router.include_router(executive.approvals_router, prefix="/approvals", tags=["executive"])
api_router.include_router(executive.actions_router, prefix="/executive-actions", tags=["executive"])
api_router.include_router(executive.decisions_router, prefix="/executive-decisions", tags=["executive"])
api_router.include_router(executive.command_center_v2_router, prefix="/executive-command-center-v2", tags=["executive"])
api_router.include_router(payables.payables_router, prefix="/payables", tags=["payables"])
api_router.include_router(payables.partner_financial_router, prefix="/partner-financial-intelligence", tags=["payables"])
api_router.include_router(payables.payables_risk_router, prefix="/payables-risk", tags=["payables"])
api_router.include_router(payables.logistics_router, prefix="/logistics-partner-intelligence", tags=["partners"])
api_router.include_router(payables.customs_router, prefix="/customs-partner-intelligence", tags=["partners"])
api_router.include_router(payables.warehouse_partner_router, prefix="/warehouse-partner-intelligence", tags=["partners"])
api_router.include_router(payables.command_center_v3_router, prefix="/executive-command-center-v3", tags=["executive"])
# Phase 4 — commitment, commercial, consignment, returns, decision & learning intelligence
api_router.include_router(commitments.commitments_router, prefix="/customer-commitments", tags=["commitments"])
api_router.include_router(commitments.risk_router, prefix="/customer-commitment-risk", tags=["commitments"])
api_router.include_router(commitments.dashboard_router, prefix="/customer-commitment-dashboard", tags=["commitments"])
api_router.include_router(commercial.country_router, prefix="/country-performance-v2", tags=["commercial"])
api_router.include_router(commercial.vertical_router, prefix="/vertical-performance", tags=["commercial"])
api_router.include_router(commercial.distributor_router, prefix="/distributor-performance-v2", tags=["commercial"])
api_router.include_router(commercial.customer_router, prefix="/customer-performance", tags=["commercial"])
api_router.include_router(commercial.targets_router, prefix="/commercial-targets", tags=["commercial"])
api_router.include_router(commercial.review_router, prefix="", tags=["review"])
api_router.include_router(consignment.inventory_router, prefix="/consignment-inventory", tags=["consignment"])
api_router.include_router(consignment.reconciliation_router, prefix="/consignment-reconciliation", tags=["consignment"])
api_router.include_router(consignment.risk_router, prefix="/consignment-risk", tags=["consignment"])
api_router.include_router(consignment.dashboard_router, prefix="/consignment-dashboard", tags=["consignment"])
api_router.include_router(returns.returns_router, prefix="/returns", tags=["returns"])
api_router.include_router(returns.inspection_router, prefix="/return-inspection", tags=["returns"])
api_router.include_router(returns.dashboard_router, prefix="/return-dashboard", tags=["returns"])
api_router.include_router(decisions.effectiveness_router, prefix="/decision-effectiveness", tags=["decisions"])
api_router.include_router(decisions.history_router, prefix="/decision-history", tags=["decisions"])
api_router.include_router(decisions.similarity_router, prefix="/decision-similarity", tags=["decisions"])
api_router.include_router(decisions.learning_router, prefix="/learning-insights", tags=["learning"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
