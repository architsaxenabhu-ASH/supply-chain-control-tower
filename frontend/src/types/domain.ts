export type DocumentStatus = "uploaded" | "extracting" | "validation_pending" | "approved" | "rejected";

export type ShipmentStatus = "planned" | "in_transit" | "delivered" | "delayed" | "cancelled";

export type InventoryStatus = "available" | "reserved" | "quarantine" | "expired" | "damaged";

export type DocumentType =
  | "commercial_invoice"
  | "packing_list"
  | "air_waybill"
  | "bill_of_lading"
  | "bill_of_entry";

export type DocumentRecord = {
  document_id: string;
  filename: string;
  document_type: DocumentType;
  status: string;
  saved_path: string;
  extraction_master_path: string;
  master_candidates_path: string;
  extracted_field_count: number;
  master_candidate_count: number;
  required_field_count: number;
  missing_required_count: number;
  created_at: string;
};

export type ExtractedField = {
  document_id: string;
  field_name: string;
  extracted_value: string | null;
  confidence_score: number | null;
  corrected_value: string | null;
  validation_status: "pending" | "approved" | "corrected" | "rejected";
  page_number: number | null;
  bounding_box: Record<string, number> | null;
  source_engine: string | null;
};

export type DocumentExtractionMaster = {
  document: DocumentRecord;
  fields: ExtractedField[];
  master_candidates: MasterCandidate[];
  required_field_checks: RequiredFieldCheck[];
};

export type MasterCandidate = {
  document_id: string;
  candidate_type: "supplier" | "customer" | "product" | "carrier" | "uom" | "currency" | "country";
  candidate_name: string;
  candidate_code: string | null;
  source_fields: Record<string, string>;
  status: string;
};

export type RequiredFieldCheck = {
  requirement_name: string;
  accepted_fields: string[];
  is_satisfied: boolean;
  matched_field: string | null;
  matched_value: string | null;
};
