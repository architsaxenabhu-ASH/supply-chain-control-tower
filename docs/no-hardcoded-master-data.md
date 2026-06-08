# No Hardcoded Master Data Rule

## Principle

New business information must be entered, validated, and learned inside the application.

The code should not need to change when the business adds:

- a country
- a warehouse
- a product
- a customer
- a supplier
- a carrier
- a vertical
- a document requirement
- a product handling rule
- a country-specific import step

## Application Behavior

When the system does not know something, it should ask the user in the application.

Examples:

- If no destination warehouse exists for a country, ask for the warehouse and save it as a pending warehouse candidate.
- If an item code appears for the first time, ask free-text product questions and save the product learning profile.
- If an extra import document is required for a country, vertical, and material code, ask the user and save the learned rule.
- If an autofilled value is edited, require an edit reason and record user, time, old value, and new value.

## Learning Governance

Learning means controlled reuse of approved user input.

It does not mean the system silently creates inventory, customs, finance, or shipment transactions.

Inventory should increase only after Goods Receipt is posted into the approved destination warehouse.

## Prototype Fixture Rule

Temporary sample data may exist only for development and testing.

Sample data must not become production logic. The production version must read from uploaded documents, saved master records, learned rules, and approved workflow records.
