#!/usr/bin/env python3
"""
VOXTRACE server with built-in Razorpay Order Creation & HMAC Verification API.
"""
import http.server
import functools
import os
import json
import urllib.request
import urllib.error
import base64
import hmac
import hashlib
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", 3000))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
PAYMENTS_LOG_FILE = os.path.join(DATA_DIR, "payments.json")

# Razorpay Credentials
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_TfB5XCZP9J7BgR")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "Rx39Tu6c0NaEsBGlk3CBnq9E")

def record_payment(entry):
    records = []
    if os.path.exists(PAYMENTS_LOG_FILE):
        try:
            with open(PAYMENTS_LOG_FILE, "r", encoding="utf-8") as f:
                records = json.load(f)
        except Exception:
            records = []
    records.insert(0, entry)
    with open(PAYMENTS_LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

class VoxTraceHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Clean server logs
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {self.address_string()} - {fmt % args}")

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/payment/config":
            self.send_json(200, {
                "key_id": RAZORPAY_KEY_ID,
                "status": "ready"
            })
            return
        elif self.path == "/api/payment/history":
            records = []
            if os.path.exists(PAYMENTS_LOG_FILE):
                try:
                    with open(PAYMENTS_LOG_FILE, "r", encoding="utf-8") as f:
                        records = json.load(f)
                except Exception:
                    records = []
            self.send_json(200, {"payments": records})
            return

        super().do_GET()

    def do_POST(self):
        if self.path == "/api/payment/create-order":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8")
                payload = json.loads(body) if body else {}

                amount = float(payload.get("amount", 199))
                plan_name = payload.get("plan", "Normal / Personal")
                amount_in_paise = int(round(amount * 100))
                receipt_id = f"rcpt_{int(time.time())}_{plan_name[:4].lower().replace(' ', '')}"

                # Call Razorpay Orders API
                url = "https://api.razorpay.com/v1/orders"
                req_data = json.dumps({
                    "amount": amount_in_paise,
                    "currency": "INR",
                    "receipt": receipt_id,
                    "notes": {
                        "plan": plan_name,
                        "app": "VOXTRACE"
                    }
                }).encode("utf-8")

                req = urllib.request.Request(url, data=req_data, headers={
                    "Content-Type": "application/json"
                })
                auth_str = f"{RAZORPAY_KEY_ID}:{RAZORPAY_KEY_SECRET}"
                b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("ascii")
                req.add_header("Authorization", f"Basic {b64_auth}")

                with urllib.request.urlopen(req, timeout=15) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))

                self.send_json(200, {
                    "status": "success",
                    "order_id": resp_data.get("id"),
                    "amount": resp_data.get("amount"),
                    "currency": resp_data.get("currency"),
                    "key_id": RAZORPAY_KEY_ID,
                    "plan": plan_name
                })
            except urllib.error.HTTPError as e:
                err_content = e.read().decode("utf-8")
                print("Razorpay HTTPError:", err_content)
                self.send_json(e.code, {"status": "error", "message": err_content})
            except Exception as e:
                print("Order creation error:", str(e))
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        elif self.path == "/api/payment/verify":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8")
                payload = json.loads(body) if body else {}

                order_id = payload.get("razorpay_order_id", "")
                payment_id = payload.get("razorpay_payment_id", "")
                signature = payload.get("razorpay_signature", "")
                plan_name = payload.get("plan", "Unknown Plan")
                customer_email = payload.get("email", "")

                if not order_id or not payment_id or not signature:
                    self.send_json(400, {
                        "status": "failure",
                        "message": "Missing payment verification parameters"
                    })
                    return

                # Real HMAC SHA-256 Verification
                msg = f"{order_id}|{payment_id}".encode("utf-8")
                secret = RAZORPAY_KEY_SECRET.encode("utf-8")
                generated_signature = hmac.new(secret, msg, hashlib.sha256).hexdigest()

                if hmac.compare_digest(generated_signature, signature):
                    # Payment is 100% verified & genuine
                    payment_record = {
                        "payment_id": payment_id,
                        "order_id": order_id,
                        "plan": plan_name,
                        "email": customer_email,
                        "verified": True,
                        "timestamp": int(time.time()),
                        "date": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
                        "hash": hashlib.sha256(f"{order_id}:{payment_id}:{signature}".encode("utf-8")).hexdigest()
                    }
                    record_payment(payment_record)

                    self.send_json(200, {
                        "status": "success",
                        "verified": True,
                        "message": "Payment signature verified successfully",
                        "receipt": payment_record
                    })
                else:
                    self.send_json(400, {
                        "status": "failure",
                        "verified": False,
                        "message": "Invalid payment signature. Verification failed."
                    })
            except Exception as e:
                print("Payment verification error:", str(e))
                self.send_json(500, {"status": "error", "message": str(e)})
        elif self.path == "/api/audio/convert":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                audio_bytes = self.rfile.read(content_len)
                if not audio_bytes:
                    self.send_json(400, {"status": "error", "message": "No audio data received"})
                    return

                import subprocess, tempfile
                with tempfile.NamedTemporaryFile(suffix=".input", delete=False) as f_in:
                    f_in.write(audio_bytes)
                    in_path = f_in.name

                out_path = in_path + ".wav"
                ffmpeg_bin = "/home/nee/.local/bin/ffmpeg" if os.path.exists("/home/nee/.local/bin/ffmpeg") else "ffmpeg"
                cmd = [ffmpeg_bin, "-y", "-i", in_path, "-vn", "-ar", "16000", "-ac", "1", "-f", "wav", out_path]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

                with open(out_path, "rb") as f_out:
                    wav_data = f_out.read()

                try:
                    os.remove(in_path)
                    os.remove(out_path)
                except Exception:
                    pass

                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(wav_data)))
                self.end_headers()
                self.wfile.write(wav_data)
                return
            except Exception as e:
                print("Audio convert error:", str(e))
                self.send_json(500, {"status": "error", "message": str(e)})
                return

        self.send_json(404, {"error": "Not Found"})

if __name__ == "__main__":
    handler = functools.partial(VoxTraceHandler, directory=SCRIPT_DIR)
    print(f"Starting VOXTRACE server with Razorpay on port {PORT} (serving {SCRIPT_DIR})...")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), handler).serve_forever()
