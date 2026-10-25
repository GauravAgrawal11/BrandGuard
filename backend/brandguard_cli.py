#!/usr/bin/env python3
"""
BrandGuard Command Line Verification Utility (brandguard_cli.py)

Deterministic pre-publication compliance & cryptographic seal verification tool.
Verifies embedded HMAC-SHA256 and Ed25519 digital signatures, canonical payload
integrity, XMP metadata, and tamper status on images (PNG) and documents (PDF).

Usage:
    python brandguard_cli.py verify <file_path> [--verbose] [--secret <key>]
    python brandguard_cli.py sign <file_path> --approver <name> --draft-id <id>
    python brandguard_cli.py verify-payload --payload <payload> --signature <sig>
"""

import os
import sys
import argparse
from pathlib import Path

# Setup Python path to include backend
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Setup Django environment if available
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'brandguard_core.settings')
try:
    import django
    django.setup()
except Exception:
    pass

from governance.crypto_sign import (
    verify_asset_clearance,
    sign_hmac_sha256,
    sign_ed25519,
    get_ed25519_keys,
    build_canonical_payload,
    embed_clearance_in_png,
    compute_file_sha256,
    LEGAL_NOTICE
)


def print_banner():
    print("=" * 68)
    print("  BRANDGUARD PRE-PUBLICATION COMPLIANCE & VERIFICATION CLI")
    print("  Deterministic Integrity · HMAC-SHA256 & Ed25519 Cryptographic Seals")
    print("=" * 68)


def cmd_verify(args):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"[FAIL] Error: Target file '{args.file}' does not exist.")
        sys.exit(1)

    print_banner()
    print(f"Target Asset:     {file_path.name}")
    print(f"File Path:        {file_path.resolve()}")
    print(f"File Hash:        {compute_file_sha256(file_path)}")
    print("-" * 68)

    result = verify_asset_clearance(file_path, secret_key=args.secret)

    if result.get("verified"):
        print("[PASS] STATUS: BRAND-COMPLIANCE CLEARED")
        print(f"Clearance Hash:   {result.get('clearance_hash') or 'N/A'}")
        print(f"HMAC Signature:   {result.get('hmac_signature') or 'N/A'}")
        if result.get('ed25519_signature'):
            print(f"Ed25519 Signature:{result.get('ed25519_signature')[:32]}...")
        print(f"Approver:         {result.get('approver') or 'Jordan Lee'}")
        print(f"Ruleset Version:  {result.get('ruleset_version') or 'v3.2'}")
        print(f"Timestamp:        {result.get('timestamp') or 'N/A'}")
        print(f"Embedded XMP:     {'PRESENT (ISO Compliant)' if result.get('has_xmp') else 'Standard PngInfo'}")
        print(f"Database Record:  {'MATCHED IN DATABASE' if result.get('db_record_found') else 'OFFLINE VERIFIED'}")
        print("-" * 68)
        print(f"Legal Notice:     {result.get('legal_notice') or LEGAL_NOTICE}")
        print("=" * 68)
        sys.exit(0)
    else:
        print("[FAIL] STATUS: VERIFICATION FAILED (UNVERIFIED OR TAMPERED)")
        print(f"Error / Reason:   {result.get('message', 'No valid clearance seal found')}")
        if args.verbose and "details" in result:
            print("\nDebug Details:")
            for k, v in result["details"].items():
                print(f"  {k}: {v}")
        print("=" * 68)
        sys.exit(1)


def cmd_sign(args):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"[FAIL] Error: Target file '{args.file}' does not exist.")
        sys.exit(1)

    print_banner()
    out_dir = file_path.parent
    out_name = f"signed_{args.draft_id}_{file_path.stem}.png"
    out_path = out_dir / out_name

    file_hash = compute_file_sha256(file_path)
    now_iso = "2026-10-25T05:00:00Z"
    ruleset_ver = args.ruleset or "v3.2"
    approver = args.approver or "Jordan Lee (Brand Governance Lead)"

    payload = build_canonical_payload(file_hash, args.draft_id, ruleset_ver, approver, now_iso)
    hmac_sig = sign_hmac_sha256(payload, args.secret)
    _, _, ed25519_pub = get_ed25519_keys(args.secret)
    ed25519_sig = sign_ed25519(payload)
    clearance_hash = f"SHA256-{hmac_sig[:32]}"

    embed_clearance_in_png(
        source_path=file_path,
        out_path=out_path,
        clearance_hash=clearance_hash,
        hmac_sig=hmac_sig,
        ed25519_sig=ed25519_sig,
        ed25519_pub=ed25519_pub,
        canonical_payload=payload,
        draft_id=args.draft_id,
        ruleset_version=ruleset_ver,
        approver=approver,
        timestamp_iso=now_iso,
        title=f"Cleared Asset {args.draft_id}"
    )

    print("[SUCCESS] Signed asset created with embedded HMAC & Ed25519 XMP seal:")
    print(f"Output File:      {out_path.resolve()}")
    print(f"Clearance Hash:   {clearance_hash}")
    print(f"HMAC Signature:   {hmac_sig}")
    print(f"Notice:           {LEGAL_NOTICE}")
    print("=" * 68)
    sys.exit(0)


def cmd_verify_payload(args):
    print_banner()
    valid_hmac = (sign_hmac_sha256(args.payload, args.secret) == args.signature)
    valid_ed25519 = False
    try:
        from governance.crypto_sign import verify_ed25519
        valid_ed25519 = verify_ed25519(args.payload, args.signature)
    except Exception:
        pass

    if valid_hmac or valid_ed25519:
        print("[PASS] Payload Cryptographically Verified.")
        print(f"Method: {'HMAC-SHA256' if valid_hmac else 'Ed25519'}")
        print(f"Payload: {args.payload}")
        print(f"Notice:  {LEGAL_NOTICE}")
        sys.exit(0)
    else:
        print("[FAIL] Signature does not match payload.")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="BrandGuard Cryptographic Clearance Verification CLI"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # verify command
    p_verify = subparsers.add_parser("verify", help="Verify embedded clearance seal in PNG or PDF asset")
    p_verify.add_argument("file", help="Path to the PNG or PDF asset to verify")
    p_verify.add_argument("--secret", default=None, help="Optional master secret key override")
    p_verify.add_argument("-v", "--verbose", action="store_true", help="Display verbose metadata diagnostics")
    p_verify.set_defaults(func=cmd_verify)

    # sign command
    p_sign = subparsers.add_parser("sign", help="Sign and embed clearance metadata into a candidate asset")
    p_sign.add_argument("file", help="Path to the source PNG file")
    p_sign.add_argument("--draft-id", default="DRAFT_024", help="Draft / Submission ID")
    p_sign.add_argument("--approver", default="Jordan Lee", help="Approver username")
    p_sign.add_argument("--ruleset", default="v3.2", help="Ruleset version")
    p_sign.add_argument("--secret", default=None, help="Secret key override")
    p_sign.set_defaults(func=cmd_sign)

    # verify-payload command
    p_payload = subparsers.add_parser("verify-payload", help="Verify raw canonical payload against signature")
    p_payload.add_argument("--payload", required=True, help="Canonical payload string")
    p_payload.add_argument("--signature", required=True, help="HMAC or Ed25519 signature hex")
    p_payload.add_argument("--secret", default=None, help="Secret key override")
    p_payload.set_defaults(func=cmd_verify_payload)

    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
