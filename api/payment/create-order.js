const https = require("https");

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_TfB5XCZP9J7BgR";
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
    const { amount = 9, plan = "Normal / Personal" } = body || {};
    const amountInPaise = Math.round(Number(amount) * 100);
    const receipt = `rcpt_${Date.now()}`;

    const postData = JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt,
      notes: { plan, app: "VOXTRACE" }
    });

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    const options = {
      hostname: "api.razorpay.com",
      port: 443,
      path: "/v1/orders",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const rzpReq = https.request(options, (rzpRes) => {
      let data = "";
      rzpRes.on("data", chunk => data += chunk);
      rzpRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          return res.status(200).json({
            status: "success",
            order_id: parsed.id,
            amount: parsed.amount,
            currency: parsed.currency,
            key_id: RAZORPAY_KEY_ID,
            plan: plan
          });
        } catch (e) {
          return res.status(500).json({ status: "error", message: data });
        }
      });
    });

    rzpReq.on("error", (err) => {
      return res.status(500).json({ status: "error", message: err.message });
    });

    rzpReq.write(postData);
    rzpReq.end();
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};
