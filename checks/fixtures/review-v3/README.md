# Review-v3 production contract fixtures

These CSVs are byte-for-byte source-controlled copies of the current authoritative
V2 exports provided for reconciliation:

| Repository fixture | V2 capture | SHA-256 |
| --- | --- | --- |
| `production-review-schema-contracts.csv` | `C:\secure\production-review-schema-contracts-v2.csv` | `003f1a60d971fff170b69628c43944617b6edc2775650776dee4e935861e8f95` |
| `production-review-sync-contracts.csv` | `C:\secure\production-review-sync-contracts-v2.csv` | `272a3906a1feeebd0abacc2950595fb7e765152996f12244443945f52e7126ab` |
| `production-review-runtime-functions.csv` | `C:\secure\production-review-runtime-functions-v2.csv` | `19aaf9c818df3ddbf2db187e99706233e5b8daf31cd7a52dd4a1328c29fdcb3d` |

V1 is the superseded capture format and remains untouched outside the repository
for audit provenance. V2 is authoritative for the corrected catalog-backed table
ACL export, canonical boolean and `sub_name` representations, and exact
`pg_get_functiondef` output. Compared with V1, schema V2 adds the 13 captured
`MAINTAIN` grant rows; it contains no `PUBLIC` table grant. No other contract
semantics changed.

The pre-copy scan found schema/function metadata only: no credentials, secrets,
lecturer Review rows, or user content. The baseline null inventory is deliberately
not copied and remains untouched at
`C:\secure\production-baseline-null-inventory..csv`.

`documented-exceptions.json` is identity- and field-specific. It must never be
expanded into a wildcard or broad SQL normalization rule.
