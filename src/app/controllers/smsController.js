import createError from "http-errors";
import { sendSMS } from "../utils/sms.js";

export const sendSms = async (req, res, next) => {
  const { to, message } = req.body;
  try {
    if (!to || !message) {
      throw createError(400, "Missing number or message");
    }
    const response = await sendSMS(to, message);
    if (response?.response_code !== 202) {
      return res.status(500).send({
        success: false,
        message: "Failed to send SMS",
        code: response?.response_code,
        error: response?.error_message || "Unknown error",
      });
    }

    res.status(200).send({
      success: true,
      message: "SMS sent successfully",
      data: response,
    });
  } catch (error) {
    next(error);
  }
};
