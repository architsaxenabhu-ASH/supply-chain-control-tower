# Import Validation Rules

## Destination Warehouse

The system must not assume a destination warehouse.

Rule:

- If warehouses exist for the destination country, show them in a dropdown.
- If no warehouse exists for that country, ask the user to enter/select one and create a pending warehouse candidate.

Stock should increase only when Goods Receipt is posted into the selected destination warehouse.

## Approver

Import validation approver:

- `Country Incharge`

RBAC rule:

- Only a user with the `Country Incharge` role can approve import validation for their country.

## Country-Specific Documents

Common global import documents:

- Commercial Invoice
- Packing List
- Air Waybill

Additional required documents are not fixed globally.

They depend on:

- Destination Country
- Vertical
- Material Code / Item Code

The system should learn these requirements over time.

User-entered example:

```text
Country: Italy
Vertical: Cardio
Material Code: MOZS20030
Required Document: Import Declaration
```

After this is learned, the same combination should suggest the required document automatically next time.

This must be captured in the application. A new country, vertical, material code, or document requirement must not require a code change.

## First-Time Item Handling

When an item appears for the first time:

- Ask free-text questions.
- Save the user answers as a product learning profile.

From the second time:

- Autofill known values.
- Keep fields editable.

## Editing Learned Values

If a user edits an autofilled value:

- Reason is mandatory.
- User is recorded.
- Time is recorded.
- Previous value is recorded.
- New value is recorded.

This edit becomes learning data.

## Validation Principle

The system may learn and autofill.

The system must not silently post inventory, customs, finance, or shipment transactions without validation and approval.

## No Hardcoded Master Data

Master data and learned rules should come from user input, approvals, uploaded documents, and saved records.

Temporary prototype samples are allowed only for testing. They must not become production logic.
