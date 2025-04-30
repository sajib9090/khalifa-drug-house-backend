import "dotenv/config";

const port = process.env.PORT;
const mongoDB_URI = process.env.MONGODB_URI;

const jwtSecret = process.env.JWT_SECRET;
const jwtAccessToken = process.env.JWT_ACCESS_KEY;
const jwtRefreshToken = process.env.JWT_REFRESH_KEY;

const smsApiKey = process.env.SMS_API_KEY;
const smsSenderId = process.env.SMS_SENDER_ID;

export {
  port,
  mongoDB_URI,
  jwtSecret,
  jwtAccessToken,
  jwtRefreshToken,
  smsApiKey,
  smsSenderId,
};
