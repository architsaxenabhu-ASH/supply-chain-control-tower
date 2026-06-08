# Self-Learning Engine

## Vision

The platform should learn from every correction, approval, rejection, and mapping decision.

The goal is to reduce manual validation over time while keeping full auditability.

## What Learning Means In Phase 1

Learning does not mean uncontrolled AI changing transactions.

In Phase 1, learning means:

- Store user corrections.
- Store field-label mappings.
- Store product aliases.
- Store customer aliases.
- Store supplier aliases.
- Store carrier aliases.
- Store document-template patterns.
- Increase confidence when the same mapping is repeatedly approved.
- Reduce confidence when users correct or reject the mapping.
- Ask the user inside the application when a new country, warehouse, product, vertical, or document rule is not known.

## Continuous Learning Loop

```text
Upload
-> OCR / extraction
-> Validation
-> User correction
-> Learning event
-> Updated mapping confidence
-> Better future autofill
```

## Field Label Learning

Example:

Different documents may use:

- Batch No
- Lot No
- Lot Number
- BATCH NO

The user maps all of them to:

- `batch_number`

The system stores this as a learning rule.

Future documents can map these labels automatically.

## Product Recognition Learning

The system learns that:

- `MOZS20030`
- `MOZECSEB PTCA BALLOON CATHETER,2.00X30MM`
- `MOZECSEB 2.00X30`

may belong to the same Product Master record.

## First-Time Product Questions

When the system sees a new item code for the first time, it should ask:

- Product description
- Product category
- UOM
- Batch tracking required?
- Serial tracking required?
- Expiry tracking required?
- Storage condition
- Temperature requirement
- Regulatory classification
- HSN / HS code
- Default unit value currency

After the user answers once, the system stores the product profile.

Next time the same item code appears, the system autofills those values.

## Expiry Calculation Rule

Users should not manually enter remaining shelf life.

For import and inventory views, the system calculates:

```text
Days to Expiry = Expiry Date - Today
```

This value is used for FEFO visibility and expiry alerts.

Terminology note:

- True product shelf life usually means manufacturing date to expiry date.
- Operational remaining shelf life means today to expiry date.

## Customer Recognition Learning

The system learns aliases such as:

- Apollo
- Apollo Hospital
- Apollo Hospitals Enterprise Ltd

and maps them to the same customer master record after user confirmation.

## Confidence Rules

Suggested learning confidence behavior:

- New mapping starts with medium confidence.
- Every approval increases success count.
- Every correction increases failure count.
- Confidence is recalculated from success and failure history.

Suggested validation routing:

- Confidence above 98%: auto-fill and mark as auto-approved candidate.
- Confidence from 90% to 98%: send to review queue.
- Confidence below 90%: require manual validation.

## Important Governance Rule

The system can learn and autofill.

The system should not silently create financial, inventory, customs, or compliance transactions without approval until the business explicitly enables auto-approval rules.

## No Code-Based Learning

New master information should not be added by editing code.

The correct path is:

```text
Unknown value found
-> Ask user in the application
-> Save as candidate or learned profile
-> Approve if required
-> Reuse automatically next time
-> Require reason if user edits the learned value
```
