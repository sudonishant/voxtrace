module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_TfB5XCZP9J7BgR",
    status: "ready"
  });
};
