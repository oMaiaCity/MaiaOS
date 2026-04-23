"""
Second tool: structured invoice / receipt extraction (vision + tool args -> canonical JSON).
The model reads the image and fills the parameters; this module only validates and stringifies.
"""

import json
import re
from collections.abc import Callable
from typing import Any


def _strip(s: str) -> str:
    t = s.replace("<|", "").replace("|>", "").strip()
    t = re.sub(r'^[\'"]|[\'"]$', "", t)  # common model quoting
    return t


def _safe_line_items(s: str) -> list[dict[str, Any]]:
    if not s or not s.strip():
        return []
    try:
        v = json.loads(s.strip())
        if isinstance(v, list):
            return [x for x in v if isinstance(x, dict)]
        return []
    except json.JSONDecodeError:
        return [{"raw": s, "parse_error": True}]


def make_extract_invoice(
    get_tool_result: Callable[[], dict | None],
) -> Callable[..., str]:
    """
    Return a function suitable for `create_conversation(..., tools=[..., extract_invoice])`.
    Fills the current call's `tool_result` (from get_tool_result()) with
    `invoice_output` and `used_tool` = "extract_invoice".
    """

    def extract_invoice(
        sender_name: str = "",
        sender_address: str = "",
        sender_email: str = "",
        sender_phone: str = "",
        sender_tax_id: str = "",
        sender_company_id: str = "",
        recipient_name: str = "",
        recipient_address: str = "",
        recipient_email: str = "",
        recipient_phone: str = "",
        recipient_tax_id: str = "",
        invoice_number: str = "",
        purchase_order: str = "",
        issue_date: str = "",
        due_date: str = "",
        service_period: str = "",
        currency: str = "",
        payment_method: str = "",
        payment_status: str = "",
        payment_terms: str = "",
        line_items_json: str = "[]",
        subtotal_before_tax: str = "",
        discount_total: str = "",
        tax_label: str = "",
        tax_rate: str = "",
        tax_amount: str = "",
        total_excluding_tax: str = "",
        total_including_tax: str = "",
        amount_due: str = "",
        already_paid: str = "",
        bank_details: str = "",
        notes: str = "",
    ) -> str:
        """Call when the user shows an invoice, receipt, or similar financial document. Fill fields from the image; use \" \" if unknown. line_items_json must be a valid JSON array of line objects."""
        out: dict[str, Any] = {
            "document_type": "invoice",
            "parties": {
                "sender": {
                    "full_name": _strip(sender_name),
                    "address": _strip(sender_address),
                    "email": _strip(sender_email),
                    "phone": _strip(sender_phone),
                    "tax_id": _strip(sender_tax_id),
                    "company_registration": _strip(sender_company_id),
                },
                "recipient": {
                    "full_name": _strip(recipient_name),
                    "address": _strip(recipient_address),
                    "email": _strip(recipient_email),
                    "phone": _strip(recipient_phone),
                    "tax_id": _strip(recipient_tax_id),
                },
            },
            "metadata": {
                "invoice_number": _strip(invoice_number),
                "purchase_order": _strip(purchase_order),
                "issue_date": _strip(issue_date),
                "due_date": _strip(due_date),
                "service_period": _strip(service_period),
                "currency": _strip(currency),
                "payment_method": _strip(payment_method),
                "payment_status": _strip(payment_status),
                "payment_terms": _strip(payment_terms),
            },
            "line_items": _safe_line_items(line_items_json),
            "totals": {
                "subtotal_before_tax": _strip(subtotal_before_tax),
                "discount_total": _strip(discount_total),
                "tax": {
                    "label": _strip(tax_label),
                    "rate": _strip(tax_rate),
                    "amount": _strip(tax_amount),
                },
                "total_excluding_tax": _strip(total_excluding_tax),
                "total_including_tax": _strip(total_including_tax),
                "amount_due": _strip(amount_due),
                "already_paid": _strip(already_paid),
            },
            "bank_details": _strip(bank_details),
            "notes": _strip(notes),
        }
        text = json.dumps(out, ensure_ascii=False, indent=2)
        tr = get_tool_result()
        if tr is not None:
            tr["used_tool"] = "extract_invoice"
            tr["invoice_output"] = text
        return text

    return extract_invoice
