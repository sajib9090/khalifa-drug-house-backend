import createError from "http-errors";
import {
  customerAndSupplierCollection,
  transactionCollection,
} from "../collections/collections.js";
import { validateString } from "../utils/validateString.js";
import crypto from "crypto";
import { ObjectId } from "mongodb";

export const handleAddCustomerSupplier = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { name, mobile, type } = req.body;

  try {
    if (!name) throw createError(400, "Name is required field");
    if (!type) throw createError(400, "Type is required field");
    if (type !== "customer" && type !== "supplier") {
      throw createError(
        400,
        "Invalid type. Type must be either 'customer' or 'supplier'"
      );
    }

    const processedName = validateString(name, "Name", 1, 300);
    const processedMobile = mobile?.trim();

    // Mobile validation
    if (processedMobile) {
      const bangladeshiMobileRegex = /^(?:\+?88|0088)?01[3-9]\d{8}$/;
      if (!bangladeshiMobileRegex.test(processedMobile)) {
        throw createError(
          400,
          "Invalid Bangladeshi mobile number. Valid formats: 01312345678, +8801312345678, 008801312345678"
        );
      }
    }

    // Check for existing records
    const existingQuery = {
      pharmacy_id: user.pharmacy_id,
      $or: [
        { name: processedName },
        ...(processedMobile ? [{ mobile: processedMobile }] : []),
      ],
    };

    const existingCustomerSupplier =
      await customerAndSupplierCollection.findOne(existingQuery);

    if (existingCustomerSupplier) {
      const duplicatedFields = [];
      if (existingCustomerSupplier.name === processedName)
        duplicatedFields.push("name");
      if (existingCustomerSupplier.mobile === processedMobile)
        duplicatedFields.push("mobile");

      throw createError(
        409,
        `Customer/Supplier with same ${duplicatedFields.join(
          " and "
        )} already exists`
      );
    }
    const generateCode = crypto.randomBytes(32).toString("hex");
    // Create new entry
    const newData = {
      identity_id: generateCode,
      pharmacy_id: user.pharmacy_id,
      name: processedName,
      type: type,
      mobile: processedMobile,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const response = await customerAndSupplierCollection.insertOne(newData);

    if (!response?.insertedId) throw createError(500, "Addition failed");

    res.status(200).send({
      success: true,
      message: "Customer and supplier added successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetCustomerAndSupplier = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const search = req.query.search || "";
  const customerFilter = req.query.customer === "true";
  const supplierFilter = req.query.supplier === "true";

  try {
    const regExSearch = new RegExp(".*" + search + ".*", "i");
    const pharmacyId = user?.pharmacy_id;

    if (!pharmacyId) {
      return res.status(400).json({
        success: false,
        message: "Shop ID is required",
      });
    }

    // Build filter conditions
    const typeFilters = [];
    if (customerFilter) typeFilters.push("customer");
    if (supplierFilter) typeFilters.push("supplier");

    const pipeline = [
      {
        $match: {
          pharmacy_id: pharmacyId,
          ...(search && {
            $or: [{ name: regExSearch }, { mobile: regExSearch }],
          }),
          ...(typeFilters.length && { type: { $in: typeFilters } }),
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "transactions",
          let: { customerIdentityId: "$identity_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$identity_id", "$$customerIdentityId"] },
                    { $eq: ["$pharmacy_id", pharmacyId] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 1,
                amount: 1,
                type: 1,
                createdAt: 1,
                description: 1,
              },
            },
          ],
          as: "recent_transactions",
        },
      },
      {
        $lookup: {
          from: "transactions",
          let: { customerIdentityId: "$identity_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$identity_id", "$$customerIdentityId"] },
                    { $eq: ["$pharmacy_id", pharmacyId] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalCredit: {
                  $sum: {
                    $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
                  },
                },
                totalDebit: {
                  $sum: {
                    $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0],
                  },
                },
                transactionCount: { $sum: 1 },
              },
            },
          ],
          as: "transaction_summary",
        },
      },
      {
        $addFields: {
          totalCredit: {
            $ifNull: [
              { $arrayElemAt: ["$transaction_summary.totalCredit", 0] },
              0,
            ],
          },
          totalDebit: {
            $ifNull: [
              { $arrayElemAt: ["$transaction_summary.totalDebit", 0] },
              0,
            ],
          },
          transactionCount: {
            $ifNull: [
              { $arrayElemAt: ["$transaction_summary.transactionCount", 0] },
              0,
            ],
          },
          balance: {
            $subtract: [
              {
                $ifNull: [
                  { $arrayElemAt: ["$transaction_summary.totalCredit", 0] },
                  0,
                ],
              },
              {
                $ifNull: [
                  { $arrayElemAt: ["$transaction_summary.totalDebit", 0] },
                  0,
                ],
              },
            ],
          },
        },
      },
      { $project: { transaction_summary: 0 } },
    ];

    const data = await customerAndSupplierCollection
      .aggregate(pipeline)
      .toArray();

    res.status(200).json({
      success: true,
      message: "Data retrieved successfully with transactions",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSingleCustomerAndSupplier = async (req, res, next) => {
  const id = req.params.id;
  const user = req.user.user ? req.user.user : req.user;
  try {
    const pharmacyId = user?.pharmacy_id;

    if (!pharmacyId) {
      return res.status(400).json({
        success: false,
        message: "Shop ID is required",
      });
    }

    // Convert string ID to ObjectId
    const documentId = id;

    const result = await customerAndSupplierCollection
      .aggregate([
        {
          $match: {
            identity_id: documentId,
            pharmacy_id: pharmacyId,
          },
        },
        {
          $lookup: {
            from: "transactions",
            let: { id: "$identity_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$identity_id", "$$id"],
                  },
                },
              },
              {
                $sort: {
                  createdAt: -1, // Sort by newest first
                },
              },
            ],
            as: "transactions",
          },
        },
        {
          $project: {
            name: 1,
            mobile: 1,
            type: 1,
            pharmacy_id: 1,
            createdAt: 1,
            updatedAt: 1,
            transactions: {
              $map: {
                input: "$transactions",
                as: "transaction",
                in: {
                  _id: "$$transaction._id",
                  description: "$$transaction.description",
                  amount: "$$transaction.amount",
                  createdAt: "$$transaction.createdAt",
                  type: "$$transaction.type",
                },
              },
            },
          },
        },
      ])
      .toArray();

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Data retrieved successfully",
      data: result[0],
    });
  } catch (error) {
    next(error);
  }
};

export const handleAddTransaction = async (req, res, next) => {
  const { userId, amount, description, type } = req.body;
  try {
    // Validate required fields
    if (!userId || !amount || !type) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, amount, type",
      });
    }

    // Check customer existence
    const customer = await customerAndSupplierCollection.findOne({
      identity_id: userId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Validate and convert amount
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    // Validate transaction type
    const normalizedType = type.toLowerCase().trim();
    if (!["debit", "credit"].includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type - must be 'debit' or 'credit'",
      });
    }

    // Prepare transaction data
    const transactionData = {
      identity_id: userId,
      amount: parsedAmount,
      type: normalizedType,
      pharmacy_id: customer?.pharmacy_id,
      createdAt: new Date(),
    };

    // Add description if provided
    if (description && typeof description === "string") {
      transactionData.description = description.trim().toLowerCase();
    }

    // Insert transaction
    const result = await transactionCollection.insertOne(transactionData);

    await customerAndSupplierCollection.updateOne(
      { identity_id: userId },
      { $set: { updatedAt: new Date() } }
    );

    res.status(201).json({
      success: true,
      message: "Transaction added successfully",
      data: transactionData,
    });
  } catch (error) {
    next(error);
  }
};

export const handleRemoveCustomerOrSupplier = async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await customerAndSupplierCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      throw createError(404, "Data not found");
    }
    const transactionRes = await transactionCollection.deleteMany({
      identity_id: result?.identity_id,
    });
    if (!transactionRes) {
      throw createError(500, "Transaction not found/Not deleted");
    }
    const deleteRes = await customerAndSupplierCollection.deleteOne({
      identity_id: result?.identity_id,
    });
    if (!deleteRes?.deletedCount) {
      throw createError(500, "Customer/Supplier not deleted");
    }
    res.status(200).json({
      success: true,
      message:
        "Customer/Supplier and related transactions removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleRemoveTransaction = async (req, res, next) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    throw createError(400, "Invalid transaction ID");
  }

  try {
    const result = await transactionCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return next(createError(404, "Transaction not found or already deleted"));
    }
    res.status(200).send({
      success: true,
      message: "Transaction removed successfully",
    });
  } catch (error) {
    next(error);
  }
};
