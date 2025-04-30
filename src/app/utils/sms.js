import axios from "axios";
import { smsApiKey, smsSenderId } from "../../../important.js";

// This function handles sending SMS using BulkSMSBD
export const sendSMS = async (to, message) => {
  const api_key = smsApiKey;
  const senderid = smsSenderId;

  const response = await axios.get("http://bulksmsbd.net/api/smsapi", {
    params: {
      api_key,
      type: "text",
      number: to,
      senderid,
      message,
    },
  });

  return response.data;
};
