# Global Import and Self-Learning Direction

## Corrected Business Direction

The system is for global stock movement.

Meril India is the origin manufacturer/exporter.

Foreign Meril entities are destination/importing subsidiaries.

The first portal should be the Import Portal.

## Portal Build Order

1. Import Portal
2. Sales Portal
3. Inventory Portal
4. Unified Control Tower

## Import Portal Scope

The import portal starts when the destination subsidiary receives:

- Commercial Invoice
- Packing List
- Air Waybill

These documents create an import file and import shipment candidate.

They do not directly increase inventory.

Inventory increases only after goods receipt in the destination warehouse.

## Auto-Learning Direction

When the system sees a new item code for the first time, it should ask questions:

- Product description
- Product category
- UOM
- Shelf life
- Batch tracking
- Serial tracking
- Expiry tracking
- Storage condition
- Temperature requirement
- HS/HSN code

After the user answers once, the system stores a product learning profile.

Next time the same item appears, the system autofills the known values.

## What Was Added

- Global import portal design
- Self-learning engine design
- Portal roadmap
- Import database tables
- Learning database tables
- Backend learning endpoints
- Backend import preview endpoint
- Product profile question logic

## Next Step

Build the Import Validation Screen for:

```text
Invoice + Packing List + AWB
```

The screen should show:

- Import file header
- Document matching status
- Product lines
- First-time item questions
- Known item autofill
- Cross-document validation
- Approve button
- Create import shipment candidate

## Implemented Control Rules

- Destination warehouse is not assumed.
- If no warehouse exists for the destination country, the app asks for one.
- Import validation approver is `Country Incharge`.
- Extra documents are learned by country, vertical, and material code.
- First-time item profile is captured through free text.
- Editing an autofilled product profile requires reason, user, and timestamp.
