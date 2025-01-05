import createError from "http-errors";
import { ObjectId } from "mongodb";
import validator from "validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  pharmaciesCollection,
  usersCollection,
} from "../collections/collections.js";
import createJWT from "../utils/createJWT.js";
import { jwtAccessToken, jwtRefreshToken } from "../../../important.js";
import { validateString } from "../utils/validateString.js";
import slugify from "slugify";
import crypto from "crypto";

export const handleRegisterUser = async (req, res, next) => {
  try {
    const { name, email, mobile, pharmacy_name, password } = req.body;

    if (!name) {
      throw createError(400, "Name is required field");
    }
    if (!email) {
      throw createError(400, "Email is required field");
    }
    if (!mobile) {
      throw createError(400, "Mobile is required field");
    }
    if (!pharmacy_name) {
      throw createError(400, "Pharmacy name is required field");
    }
    if (!password) {
      throw createError(400, "Password is required field");
    }

    const processedName = validateString(name, "Name", 3, 30);
    const processedPharmacyName = validateString(
      pharmacy_name,
      "Pharmacy name",
      3,
      30
    );

    const processedEmail = email?.toLowerCase();

    if (!validator.isEmail(processedEmail)) {
      throw createError(400, "Invalid email address");
    }

    if (mobile?.length !== 11) {
      throw createError(400, "Mobile number must be 11 characters");
    }

    if (!validator.isMobilePhone(mobile, "any")) {
      throw createError(400, "Invalid mobile number");
    }

    const existingEmail = await usersCollection.findOne({
      email: processedEmail,
    });

    if (existingEmail) {
      throw createError(400, "Email already exists");
    }
    const existingMobile = await usersCollection.findOne({
      mobile: mobile,
    });

    if (existingMobile) {
      throw createError(400, "Mobile already exists");
    }

    const trimmedPassword = password.replace(/\s/g, "");
    if (trimmedPassword.length < 8 || trimmedPassword.length > 30) {
      throw createError(
        400,
        "Password must be at least 8 characters long and not more than 30 characters long"
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(trimmedPassword, salt);

    const pharmacySlug = slugify(processedPharmacyName);

    const generateCode = crypto.randomBytes(8).toString("hex");
    const generateCode1 = crypto.randomBytes(8).toString("hex");

    const newPharmacy = {
      pharmacy_id: generateCode + Math.random() * 10,
      pharmacy_name: processedPharmacyName,
      pharmacy_slug: pharmacySlug,
      brand_logo: { id: null, url: null },
      address: { location: null, sub_district: null, district: null },
      contact: { mobile1: null, mobile2: null },
      subscription_info: {
        status: false,
        previous_payment_amount: null,
        previous_payment_time: null,
        end_time: null,
      },
      selected_plan: {
        id: null,
        name: null,
      },
      createdAt: new Date(),
    };

    const newUser = {
      user_id: generateCode1 + Math.random() * 10,
      name: processedName,
      avatar: { id: null, url: null },
      email: processedEmail,
      pharmacy_id: newPharmacy?.pharmacy_id,
      mobile: mobile,
      password: hashedPassword,
      role: "admin",
      banned_user: false,

      createdAt: new Date(),
    };

    const pharmacyResult = await pharmaciesCollection.insertOne(newPharmacy);

    const userResult = await usersCollection.insertOne(newUser);
    if (!userResult?.insertedId) {
      await pharmaciesCollection.deleteOne({
        _id: new ObjectId(pharmacyResult?.insertedId),
      });
      throw createError(500, "User created failed.");
    }
    res.status(200).send({
      success: true,
      message: "User register in successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleLoginUser = async (req, res, next) => {
  const { email_mobile, password } = req.body;

  try {
    if (!email_mobile || !password) {
      throw createError(400, "Email or mobile and password are required");
    }

    const stringData = email_mobile?.trim().replace(/\s+/g, "").toLowerCase();

    if (email_mobile?.length > 50 || email_mobile?.length < 3) {
      throw createError(400, "Email, or mobile should be valid");
    }

    const trimmedPassword = password.replace(/\s/g, "");

    if (trimmedPassword.length < 6 || trimmedPassword.length > 30) {
      throw createError(
        400,
        "Password must be at least 6 characters long and not more than 30 characters long"
      );
    }

    const user = await usersCollection.findOne({
      $or: [{ email: stringData }, { mobile: stringData }],
    });

    if (!user) {
      return next(
        createError.BadRequest("Invalid email address, or mobile. Not found")
      );
    }

    // Match password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(createError.Unauthorized("Invalid Password"));
    }

    // Check if user is banned
    if (user?.banned_user) {
      return next(
        createError.Unauthorized("You are banned. Please contact authority")
      );
    }

    const loggedInUser = {
      _id: user?._id,
      user_id: user?.user_id,
      name: user?.name,
      avatar: user?.avatar,
      email: user?.email,
      pharmacy_id: user?.pharmacy_id,
      mobile: user?.mobile,
      banned_user: user?.banned_user,
      role: user?.role,
      createdAt: user?.createdAt,
    };

    let pharmacyInfo;
    let userObject = { ...loggedInUser };

    if (user?.role !== "super admin") {
      pharmacyInfo = await pharmaciesCollection.findOne({
        pharmacy_id: user.pharmacy_id,
      });
      if (pharmacyInfo) {
        userObject = { ...loggedInUser, pharmacyInfo };
      }
    }

    const accessToken = await createJWT(userObject, jwtAccessToken, "1d");

    const refreshToken = await createJWT(userObject, jwtRefreshToken, "7d");

    res.cookie("refreshToken", refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.status(200).send({
      success: true,
      message: "User logged in successfully",
      data: {
        ...userObject,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const handleLogoutUser = async (req, res, next) => {
  try {
    const options = {
      httpOnly: true,
      secure: true,
    };
    // console.log(req.user);
    // res.clearCookie("accessToken", options);
    res.clearCookie("refreshToken", options);
    res.status(200).send({
      success: true,
      message: "User logout successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleRefreshToken = async (req, res, next) => {
  const oldRefreshToken = req.cookies.refreshToken;
  try {
    if (!oldRefreshToken) {
      throw createError(404, "Refresh token not found. Login first");
    }
    //verify refresh token
    const decodedToken = jwt.verify(oldRefreshToken, jwtRefreshToken);

    if (!decodedToken) {
      throw createError(401, "Invalid refresh token. Please Login");
    }

    // if token validation success generate new access token
    const accessToken = await createJWT(
      { user: decodedToken },
      jwtAccessToken,
      "1d"
    );
    // Update req.user with the new decoded user information
    req.user = decodedToken.user;

    res.status(200).send({
      success: true,
      message: "New access token generate successfully",
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};
