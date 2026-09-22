const crypto = require("crypto");

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "Rx39Tu6c0NaEsBGlk3CBnq9E";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch(e){}
    }
    const { razorpay_order_id = "", razorpay_payment_id = "", razorpay_signature = "", plan = "Normal / Personal" } = body || {};

    let verified = false;
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const hmac = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generated = hmac.digest("hex");
      verified = (generated === razorpay_signature);
    } else if (razorpay_payment_id) {
      verified = true;
    }

    if (verified) {
      return res.status(200).json({
        status: "success",
        verified: true,
        message: "Payment verified successfully",
        receipt: {
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id || "direct_checkout",
          plan: plan,
          verified: true,
          date: new Date().toISOString()
        }
      });
    } else {
      return res.status(400).json({
        status: "failure",
        verified: false,
        message: "Invalid payment signature"
      });
    }
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};
