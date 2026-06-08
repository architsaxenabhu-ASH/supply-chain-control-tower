# EXP 0361 Extraction Analysis

## Source Documents

- Commercial Invoice: `Exp 0361 Export Invoice.pdf`
- Packing List: `Exp 0361 Export Pkg List.pdf`
- Air Waybill: `Exp 2926200361-AWB-Italy.pdf`

## Extraction Method

- Invoice: text-readable PDF, extracted with `pypdf`.
- Packing List: text-readable PDF, extracted with `pypdf`.
- AWB: image-based PDF. Text extraction failed, so fields below were read from the embedded image.

Strict note: the AWB proves we need real OCR for scanned/image PDFs. Do not pretend simple PDF text extraction is enough.

## Document Group Keys

- Invoice Number: `2926200361`
- Invoice Date: `2026-05-29`
- Packing List Number: `2926200361`
- Packing List Date: `2026-05-29`
- Sales Order Number: `106752`
- Sales Order Date: `2026-05-16`
- Customer PO Number: `173/229`
- Customer PO Date: `2026-05-16`
- AWB Number: `020-04683840`
- Shipment / Flight Date: `2026-05-31`

## Parties

### Shipper / Exporter

- Name: `MERIL LIFE SCIENCES PVT. LTD.`
- Address: `Meril Park-3, First Floor (ML-1), Survey No. 1227, Muktanand Marg, Bhalitha, Vapi, Valsad-396191, Gujarat, India`
- IEC: `5207017977`
- GSTIN/PAN text was present but needs validation because PDF text merged labels.

### Buyer / Bill To

- Code: `1001018`
- Name: `Meril Italy S.R.L.`
- Address: `Piazza Tre torri 2, Milano 20145, Italy`
- Contact: `Mr. Vaibhav Sabale`
- Email: `vaibhav.sabale@merillife.com`
- Phone: `+39 3483899883`

### Consignee / Ship To

- Code: `1001321`
- Name: `Meril Italy S.R.L.`
- Address: `Via Piave 63, Rozzano, Milan-20072, Italy`
- Contact: `Mr. Carai Cristian`
- Email: `c.carai@ddmedservice.com`
- Phone: `+39 3483899883`
- EORI/VAT from AWB: `12845220966`

## Shipment Details

- Mode of Transport: `Air`
- Incoterm / Terms of Delivery: `CIF`
- Port / Place of Loading: `Mumbai, India`
- Port / Place of Discharge: `Milan / Italy`
- Final Destination: `Milan / Italy`
- Country of Origin: `India`
- Country of Final Destination: `Italy`
- Carrier: `Lufthansa Cargo AG Ltd`
- Issuing Agent: `Leaap International Private Limited`
- Airport of Departure: `Mumbai India`
- Airport of Destination: `Milan-Malpensa`
- Routing: `BOM/FRA/MXP`
- First Carrier: `LH`
- Flight Number: `LH8023`
- Flight Date: `2026-05-31`
- Executed Date: `2026-05-30`
- Freight Terms: `Freight Prepaid`
- Notify Party: `Meril Italy S.R.L.`

## Product / Inventory Details

Line item file:

- `outputs/exp-0361-line-items.csv`

Summary:

- Total line count: `7`
- Total quantity: `7 EA`
- HSN Code: `90183920`
- Product family: `MOZECSEB PTCA BALLOON CATHETER`
- Unit value: `EUR 71.00`
- Total invoice value: `EUR 497.00`
- All batches are above `365` days to expiry as of `2026-06-07`.
- Earliest expiry date: `2028-01-13`
- Earliest-expiring item: `MOZS35020 / MOZSAB03`

## Weight and Package Details

- No. of packages: `1`
- Net weight from invoice: `1.820 kg`
- Net weight from packing list: `1.820 kg`
- Gross weight from invoice: `2.420 kg`
- Gross weight from packing list: `2.420 kg`
- Gross weight from AWB: `2.4 kg`
- Chargeable weight from AWB: `2.5 kg`
- Package dimensions: `280 x 270 x 190 mm`
- Package dimensions also shown on AWB as `28 x 27 x 19 cm`

## Calculations

### Invoice and Quantity

- Total quantity = `7 EA`
- Total invoice value = `7 x EUR 71.00 = EUR 497.00`
- Average value per item = `EUR 71.00`

### Weight

- Tare / packaging weight = `2.420 - 1.820 = 0.600 kg`
- Net-to-gross ratio = `1.820 / 2.420 = 75.21%`
- Invoice value per gross kg = `EUR 497.00 / 2.420 = EUR 205.37 per kg`
- Invoice value per net kg = `EUR 497.00 / 1.820 = EUR 273.08 per kg`

### Volume and Chargeable Weight

Using `28 x 27 x 19 cm`:

- Volume = `28 x 27 x 19 = 14,364 cubic cm`
- CBM = `0.014364`
- Air volumetric weight using divisor 6000 = `14,364 / 6000 = 2.394 kg`
- AWB chargeable weight = `2.5 kg`

This matches the AWB logic because chargeable weight is rounded above the volumetric weight.

### Freight Charges From AWB

- Weight charge: `INR 11,000`
- Other charges due agent: `INR 150`
- Other charges due carrier: `INR 2,425`
- Total prepaid: `INR 13,575`
- Freight per chargeable kg = `INR 13,575 / 2.5 = INR 5,430 per kg`
- Freight per gross kg = `INR 13,575 / 2.420 = INR 5,609.50 per kg`

Other charges shown:

- `AWB 150`
- `MR 325`
- `XRY 500`
- `MCC 500`
- `AMS 1100`

## Cross-Document Validation

Passed:

- Invoice number `2926200361` appears across invoice, packing list, and AWB.
- Invoice date `2026-05-29` matches AWB invoice reference.
- SO number `106752` appears in invoice and packing list.
- Customer PO `173/229` appears in invoice and packing list.
- Total quantity `7 EA` matches invoice and packing list.
- Net weight `1.820 kg` matches invoice and packing list.
- Gross weight `2.420 kg` matches invoice and packing list; AWB shows rounded `2.4 kg`.
- HSN `90183920` appears in invoice and AWB.
- Origin `India` and destination `Italy/Milan` are consistent.

Needs validation:

- AWB number is blank on the invoice but present on the AWB as `020-04683840`.
- GSTIN/PAN labels in invoice text are merged and should be validated.
- The AWB is image-based, so automated OCR must be added for reliable extraction.
- Buyer and consignee are the same company but different codes/addresses; the system must preserve both.

## What The App Can Generate From These Documents

### Product Master Candidates

- `MOZS20030`
- `MOZS22530`
- `MOZS35020`
- `MOZS35017`
- `MOZS35014`
- `MOZS25030`
- `MOZS22525`

Suggested product attributes:

- Product category: `Cardio`
- UOM: `EA`
- HSN: `90183920`
- Product family: `MOZECSEB PTCA BALLOON CATHETER`
- Product status: `Active`

### Batch / Inventory Candidates

Each line can create a batch-level inventory candidate with:

- Item code
- Batch number
- Quantity
- UOM
- Expiry date
- Unit value
- Invoice reference
- Packing list reference

### Shipment Candidate

The documents can create a shipment candidate with:

- Shipment reference: `2926200361`
- AWB number: `020-04683840`
- Carrier: `Lufthansa Cargo AG Ltd`
- Agent: `Leaap International Private Limited`
- Origin: `Mumbai`
- Destination: `Milan-Malpensa`
- Route: `BOM/FRA/MXP`
- Flight: `LH8023`
- Flight date: `2026-05-31`
- Packages: `1`
- Gross weight: `2.420 kg`
- Chargeable weight: `2.5 kg`
- Freight cost: `INR 13,575`

## Critical Business Decision

You must decide the operating viewpoint.

Same documents can mean two different transactions:

1. If we are managing the India exporter warehouse:
   - This is an export dispatch.
   - Inventory should reduce from India stock after dispatch.

2. If we are managing the Italy recipient warehouse:
   - This is an inbound/import shipment.
   - Inventory should increase only after goods receipt in Italy.

Do not ignore this. If we choose the wrong viewpoint, the system will move stock in the wrong direction.

## Recommended Next Step

Tell Codex the operating viewpoint:

```text
We are managing India export warehouse.
```

or

```text
We are managing Italy receiving warehouse.
```

After that, build the validation screen for this document group:

```text
Invoice + Packing List + AWB
-> Extracted fields
-> Cross-document validation
-> Product/batch/shipment candidates
-> Approve
-> Create Dispatch or Inbound Shipment
```

